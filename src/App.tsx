import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { BrowserRouter, Link, Route, Routes, useNavigate } from 'react-router-dom'
import { LightModeToggle } from './components/LightModeToggle'
import { PrivacyPage } from './components/PrivacyPage'
import { Leaderboard } from './components/Leaderboard'
import { BookPicker } from './components/BookPicker'
import { consistencyFromTimestamps, startSession, type Submission, type TestMode } from './anticheat'
import { customWords, fetchBookWords, loadSavedSource, readPos, saveSource, writePos, type Source } from './books'
import './App.css'
import './typing.css'

const WORDS = 'the be to of and a in that have I it for not on with he as you do at this but his by from they we say her she or an will my one all would there their what so up out if about who get which go me when make can like time no just him know take people into year your good some could them see other than then now look only come its over think also back after use two how our work first well way even new want because any these give day most us'.split(' ')
const PUNCTUATION = ['.', ',', ';', ':', '!', '?']
const MAX_EXTRA = 19
const MAX_VISIBLE_EXTRA = 4

interface Stats { wpm: number; rawWpm: number; accuracy: number; consistency: number; errors: number; time: number }
interface KeyPress { char: string; status: 'correct' | 'incorrect' }
type Mode = TestMode
type Phase = 'idle' | 'running' | 'done'
type WordStatus = 'upcoming' | 'current' | 'done'

const MODES: Mode[] = [
  { kind: 'time', value: 15 },
  { kind: 'time', value: 30 },
  { kind: 'time', value: 60 },
  { kind: 'words', value: 10 },
  { kind: 'words', value: 25 },
  { kind: 'words', value: 50 },
]
const DEFAULT_MODE: Mode = { kind: 'time', value: 30 }
const RANDOM_SOURCE: Source = { kind: 'random' }
const emptyStats = (): Stats => ({ wpm: 0, rawWpm: 0, accuracy: 100, consistency: 0, errors: 0, time: 0 })

function randomWords(count: number, previous = ''): string[] {
  const result: string[] = []
  let last = previous
  for (let i = 0; i < count; i++) {
    let base = WORDS[Math.floor(Math.random() * WORDS.length)]
    while (base === last) base = WORDS[Math.floor(Math.random() * WORDS.length)]
    last = base
    result.push(Math.random() < 0.1 ? base + PUNCTUATION[Math.floor(Math.random() * PUNCTUATION.length)] : base)
  }
  return result
}

function useTypingTest() {
  const [mode, setMode] = useState<Mode>(DEFAULT_MODE)
  const [source, setSource] = useState<Source>(RANDOM_SOURCE)
  const [sourceLoading, setSourceLoading] = useState(false)
  const [sourceError, setSourceError] = useState<string | null>(null)
  const [bookProgress, setBookProgress] = useState<{ pos: number; total: number } | null>(null)
  const [words, setWords] = useState<string[]>([])
  const [typed, setTyped] = useState<string[]>([''])
  const [started, setStarted] = useState(false)
  const [finished, setFinished] = useState(false)
  const [stats, setStats] = useState<Stats>(emptyStats)
  const [finalStats, setFinalStats] = useState<Stats | null>(null)
  const [submission, setSubmission] = useState<Submission | null>(null)
  const [keyPresses, setKeyPresses] = useState<KeyPress[]>([])
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [timeLeft, setTimeLeft] = useState(DEFAULT_MODE.value)

  const modeRef = useRef<Mode>(DEFAULT_MODE)
  const sourceRef = useRef<Source>(RANDOM_SOURCE)
  const bookWordsRef = useRef<string[]>([])
  const cursorRef = useRef(0)
  const startPosRef = useRef(0)
  const blockedRef = useRef(false)
  const wordsRef = useRef<string[]>([])
  const typedRef = useRef<string[]>([''])
  const phaseRef = useRef<Phase>('idle')
  const startRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const totalKeysRef = useRef(0)
  const correctKeysRef = useRef(0)
  const errorsRef = useRef(0)
  const charCountRef = useRef(0)
  const samplesRef = useRef<number[]>([])
  const sampleMarkRef = useRef({ second: 0, chars: 0 })
  const tsRef = useRef<number[]>([])
  const sessionRef = useRef<Promise<string | null> | null>(null)

  const setBlocked = useCallback((value: boolean) => { blockedRef.current = value }, [])

  const stopTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
  }, [])

  // Next words come from the active book (looping at the end) or from the random word list.
  const pullWords = useCallback((count: number, previous = ''): string[] => {
    const book = bookWordsRef.current
    if (sourceRef.current.kind === 'book' && book.length > 0) {
      const result: string[] = []
      for (let i = 0; i < count; i++) {
        result.push(book[cursorRef.current % book.length])
        cursorRef.current += 1
      }
      return result
    }
    return randomWords(count, previous)
  }, [])

  const compute = useCallback((elapsedMs: number): Stats => {
    const targets = wordsRef.current
    const typedWords = typedRef.current
    const last = typedWords.length - 1
    let correctChars = 0
    let rawChars = 0
    for (let i = 0; i <= last; i++) {
      const word = typedWords[i]
      const target = targets[i] ?? ''
      rawChars += word.length
      if (i < last) {
        rawChars += 1
        if (word === target) correctChars += target.length + 1
      } else if (word.length > 0 && word === target.slice(0, word.length)) {
        correctChars += word.length
      }
    }
    const minutes = Math.max(elapsedMs, 1000) / 60000
    const samples = samplesRef.current
    let consistency = 0
    if (samples.length > 1) {
      const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length
      if (mean > 0) {
        const variance = samples.reduce((sum, value) => sum + (value - mean) ** 2, 0) / samples.length
        consistency = Math.max(0, Math.min(100, Math.round(100 - Math.sqrt(variance) / mean * 100)))
      }
    }
    const totalKeys = totalKeysRef.current
    return {
      wpm: Math.round(correctChars / 5 / minutes),
      rawWpm: Math.round(rawChars / 5 / minutes),
      accuracy: totalKeys ? Math.round(correctKeysRef.current / totalKeys * 100) : 100,
      consistency,
      errors: errorsRef.current,
      time: Math.round(elapsedMs / 1000),
    }
  }, [])

  const finish = useCallback(() => {
    if (phaseRef.current === 'done') return
    phaseRef.current = 'done'
    stopTimer()
    const current = modeRef.current
    const elapsed = current.kind === 'time' ? current.value * 1000 : Math.round(Date.now() - startRef.current)
    const result = compute(elapsed)
    const timestamps = tsRef.current.slice()
    result.consistency = consistencyFromTimestamps(timestamps, elapsed, current.kind)
    const typedNow = typedRef.current.slice()
    const activeSource = sourceRef.current
    if (activeSource.kind === 'book') writePos(activeSource.id, startPosRef.current + Math.max(0, typedNow.length - 1))
    setSubmission({
      token: sessionRef.current ?? Promise.resolve(null),
      mode: current,
      words: wordsRef.current.slice(0, typedNow.length),
      typed: typedNow,
      ts: timestamps,
      elapsedMs: elapsed,
    })
    setStats(result)
    setFinalStats(result)
    setFinished(true)
    if (current.kind === 'time') setTimeLeft(0)
  }, [compute, stopTimer])

  const tick = useCallback(() => {
    const elapsed = Date.now() - startRef.current
    const current = modeRef.current
    if (current.kind === 'time' && elapsed >= current.value * 1000) {
      finish()
      return
    }
    const second = Math.floor(elapsed / 1000)
    if (second > sampleMarkRef.current.second) {
      samplesRef.current.push((charCountRef.current - sampleMarkRef.current.chars) * 12)
      sampleMarkRef.current = { second, chars: charCountRef.current }
    }
    if (current.kind === 'time') setTimeLeft(Math.max(0, Math.ceil(current.value - elapsed / 1000)))
    setStats(compute(elapsed))
  }, [compute, finish])

  const begin = useCallback(() => {
    phaseRef.current = 'running'
    startRef.current = Date.now()
    // Only random-word tests can be ranked, so only they get an anti-cheat session
    sessionRef.current = sourceRef.current.kind === 'random' ? startSession(modeRef.current) : null
    setStarted(true)
    timerRef.current = setInterval(tick, 100)
  }, [tick])

  const restart = useCallback((next?: Mode, nextSource?: Source) => {
    const nextMode = next ?? modeRef.current
    const nextSrc = nextSource ?? sourceRef.current
    stopTimer()
    modeRef.current = nextMode
    sourceRef.current = nextSrc
    phaseRef.current = 'idle'
    if (nextSrc.kind === 'book') {
      const total = Math.max(1, bookWordsRef.current.length)
      cursorRef.current = readPos(nextSrc.id) % total
    } else {
      cursorRef.current = 0
    }
    startPosRef.current = cursorRef.current
    const initial = pullWords(nextMode.kind === 'words' ? nextMode.value : 100)
    wordsRef.current = initial
    typedRef.current = ['']
    totalKeysRef.current = 0
    correctKeysRef.current = 0
    errorsRef.current = 0
    charCountRef.current = 0
    samplesRef.current = []
    sampleMarkRef.current = { second: 0, chars: 0 }
    tsRef.current = []
    sessionRef.current = null
    setMode(nextMode)
    setSource(nextSrc)
    setBookProgress(nextSrc.kind === 'book' ? { pos: startPosRef.current, total: bookWordsRef.current.length } : null)
    setWords(initial)
    setTyped([''])
    setStarted(false)
    setFinished(false)
    setStats(emptyStats())
    setFinalStats(null)
    setSubmission(null)
    setKeyPresses([])
    setShowLeaderboard(false)
    setTimeLeft(nextMode.kind === 'time' ? nextMode.value : 0)
  }, [pullWords, stopTimer])

  const chooseSource = useCallback(async (next: Source) => {
    setSourceError(null)
    if (next.kind === 'random') {
      bookWordsRef.current = []
      saveSource(next)
      restart(undefined, next)
      return
    }
    setSourceLoading(true)
    try {
      const bookWords = next.custom ? customWords(next.id) : await fetchBookWords(next.id)
      if (!bookWords || bookWords.length < 20) throw new Error('Text not found')
      bookWordsRef.current = bookWords
      saveSource(next)
      restart(undefined, next)
    } catch (cause) {
      setSourceError(cause instanceof Error ? cause.message : 'Could not load book')
    } finally {
      setSourceLoading(false)
    }
  }, [restart])

  useEffect(() => {
    restart()
    return stopTimer
  }, [restart, stopTimer])

  useEffect(() => {
    const saved = loadSavedSource()
    if (saved) void chooseSource(saved)
  }, [chooseSource])

  const registerKey = useCallback((ok: boolean) => {
    totalKeysRef.current += 1
    charCountRef.current += 1
    tsRef.current.push(Math.round(Date.now() - startRef.current))
    if (ok) correctKeysRef.current += 1
    else errorsRef.current += 1
  }, [])

  const handleKey = useCallback((event: KeyboardEvent) => {
    if (!event.isTrusted || blockedRef.current) return
    const el = event.target as HTMLElement | null
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
    const { key } = event

    if (key === 'Escape' || key === 'Tab') {
      event.preventDefault()
      restart()
      return
    }
    if (phaseRef.current === 'done') return

    const printable = key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey
    if (!printable && key !== 'Backspace') return
    if (el && (el.tagName === 'BUTTON' || el.tagName === 'A')) el.blur()
    event.preventDefault()
    if (printable && event.repeat) return

    if (phaseRef.current === 'idle') {
      if (!printable) return
      begin()
    }

    const targets = wordsRef.current
    const current = typedRef.current.slice()
    let index = current.length - 1
    let completed = false

    if (key === 'Backspace') {
      const wholeWord = event.ctrlKey || event.altKey || event.metaKey
      if (current[index].length > 0) {
        current[index] = wholeWord ? '' : current[index].slice(0, -1)
      } else if (index > 0 && current[index - 1] !== targets[index - 1]) {
        current.pop()
        index -= 1
        if (wholeWord) current[index] = ''
      } else {
        return
      }
    } else if (key === ' ') {
      if (current[index].length === 0) return
      registerKey(current[index] === targets[index])
      current.push('')
      if (index >= targets.length - 1) {
        completed = true
      } else if (modeRef.current.kind === 'time' && current.length > targets.length - 40) {
        wordsRef.current = [...targets, ...pullWords(60, targets[targets.length - 1])]
        setWords(wordsRef.current)
      }
    } else {
      if (current[index].length >= targets[index].length + MAX_EXTRA) return
      current[index] += key
      const ok = key === targets[index][current[index].length - 1]
      registerKey(ok)
      setKeyPresses(previous => [...previous.slice(-15), { char: key, status: ok ? 'correct' : 'incorrect' }])
      if (modeRef.current.kind === 'words' && index === targets.length - 1 && current[index] === targets[index]) completed = true
    }

    typedRef.current = current
    setTyped(current)
    if (completed) finish()
  }, [begin, finish, pullWords, registerKey, restart])

  return {
    mode, source, sourceLoading, sourceError, bookProgress, words, typed, started, finished, stats, finalStats, submission,
    keyPresses, timeLeft, showLeaderboard, setShowLeaderboard, setBlocked, chooseSource, handleKey, restart,
  }
}

const Word = memo(function Word({ target, typed, status }: { target: string; typed: string; status: WordStatus }) {
  // Extra chars are drawn in a zero-width overlay so a mistake never changes the word width or line wrapping
  const visibleLength = Math.max(target.length, Math.min(typed.length, target.length + MAX_VISIBLE_EXTRA))
  const caretBefore = status === 'current' && typed.length < target.length ? typed.length : -1
  const caretAfter = status === 'current' && typed.length >= target.length ? visibleLength - 1 : -1
  const chars = []
  const extras = []
  for (let i = 0; i < visibleLength; i++) {
    const expected = target[i]
    const got = typed[i]
    let state: string
    if (got === undefined) state = status === 'done' ? 'missing' : 'pending'
    else if (expected === undefined) state = 'incorrect extra'
    else state = got === expected ? 'correct' : 'incorrect'
    if (i === caretBefore) state += ' caret-before'
    if (i === caretAfter) state += ' caret-after'
    const node = <span key={i} className={`char ${state}`}>{expected ?? got}</span>
    if (expected === undefined) extras.push(node)
    else chars.push(node)
  }
  const error = status === 'done' && typed !== target
  return <span className={`word ${status}${error ? ' error' : ''}`}>{chars}{extras.length > 0 && <span className="extras" aria-hidden="true">{extras}</span>}<span className="space" /></span>
})

function Stat({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return <div className="stat"><div className={`stat-value${accent ? ' accent' : ''}`}>{value}</div><div className="stat-label">{label}</div></div>
}

function StatsPanel({ stats }: { stats: Stats }) {
  return <div className="stats">
    <Stat label="WPM" value={stats.wpm} accent />
    <Stat label="Raw" value={stats.rawWpm} />
    <Stat label="Acc" value={`${stats.accuracy}%`} />
    <Stat label="Consistency" value={`${stats.consistency}%`} />
  </div>
}

function KeyPressIndicator({ presses }: { presses: KeyPress[] }) {
  return <div className="key-indicator" aria-hidden="true">
    {presses.map((press, index) => <span key={index} className={press.status === 'correct' ? 'key-correct' : 'key-incorrect'}>{press.char}</span>)}
  </div>
}

function Results({ stats, canSubmit, restart, submit }: { stats: Stats; canSubmit: boolean; restart: () => void; submit: () => void }) {
  const navigate = useNavigate()
  const secondary = { marginTop: 12, background: 'var(--bg)', color: 'var(--fg)', border: '1px solid var(--border)' }
  return <div className="results-overlay"><div className="results-panel">
    <h2>Test Complete</h2>
    <div className="results-stats">
      <div className="result-stat"><div className="result-value">{stats.wpm}</div><div className="result-label">WPM</div></div>
      <div className="result-stat"><div className="result-value">{stats.rawWpm}</div><div className="result-label">Raw</div></div>
      <div className="result-stat"><div className="result-value">{stats.accuracy}%</div><div className="result-label">Accuracy</div></div>
      <div className="result-stat"><div className="result-value">{stats.consistency}%</div><div className="result-label">Consistency</div></div>
      <div className="result-stat"><div className="result-value">{stats.errors}</div><div className="result-label">Errors</div></div>
    </div>
    <button className="restart-btn" onClick={restart}>{canSubmit ? 'Restart' : 'Next passage'}</button>
    {canSubmit
      ? <button className="restart-btn" style={secondary} onClick={submit}>Submit score</button>
      : <p className="book-note">Book and imported-text tests are not ranked.</p>}
    <button className="restart-btn" style={secondary} onClick={() => navigate('/leaderboard')}>View leaderboard</button>
  </div></div>
}

function TypingTest() {
  const {
    mode, source, sourceLoading, sourceError, bookProgress, words, typed, started, finished, stats, finalStats, submission,
    keyPresses, timeLeft, showLeaderboard, setShowLeaderboard, setBlocked, chooseSource, handleKey, restart,
  } = useTypingTest()
  const innerRef = useRef<HTMLDivElement>(null)
  const [offset, setOffset] = useState(0)
  const [pickerOpen, setPickerOpen] = useState(false)
  const wordIndex = Math.max(0, Math.min(typed.length - 1, words.length - 1))

  useEffect(() => {
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleKey])

  useEffect(() => { setBlocked(pickerOpen) }, [pickerOpen, setBlocked])

  const updateOffset = useCallback(() => {
    const el = innerRef.current?.children[wordIndex] as HTMLElement | undefined
    if (el) setOffset(Math.max(0, el.offsetTop - el.offsetHeight))
  }, [wordIndex])

  useLayoutEffect(() => { updateOffset() }, [updateOffset, words])

  useEffect(() => {
    window.addEventListener('resize', updateOffset)
    return () => window.removeEventListener('resize', updateOffset)
  }, [updateOffset])

  const wordStatus = (index: number): WordStatus => index < typed.length - 1 ? 'done' : index === typed.length - 1 ? 'current' : 'upcoming'
  const hidden = started || finished ? 'hidden' : 'visible'
  const activeId = source.kind === 'book' ? source.id : null

  return <div className="app">
    <header className="header">
      <div className="logo">Ape Type</div>
      <nav className="header-controls">
        <LightModeToggle />
        <button className="mode-btn" onClick={() => setPickerOpen(true)}>Books</button>
        <Link to="/leaderboard" className="mode-btn">Leaderboard</Link>
        <Link to="/privacy" className="mode-btn">Privacy</Link>
      </nav>
    </header>
    <main className="main">
      <div className="mode-bar" style={{ visibility: hidden }}>
        {MODES.map(option => {
          const active = option.kind === mode.kind && option.value === mode.value
          return <button key={`${option.kind}-${option.value}`} className={`mode-btn${active ? ' active' : ''}`} onClick={() => restart(option)}>{option.kind === 'time' ? `${option.value}s` : `${option.value} words`}</button>
        })}
      </div>
      <div className="book-bar" style={{ visibility: hidden }}>
        {source.kind === 'book'
          ? <>
            <span>Typing: {source.title}{bookProgress ? ` (word ${bookProgress.pos.toLocaleString()} of ${bookProgress.total.toLocaleString()})` : ''}</span>
            <button className="mode-btn" onClick={() => void chooseSource({ kind: 'random' })}>Random words</button>
          </>
          : <button className="mode-btn" onClick={() => setPickerOpen(true)}>Type a book or your own text</button>}
        {sourceLoading && <span>Loading...</span>}
        {sourceError && <span className="book-error">{sourceError}</span>}
      </div>
      <StatsPanel stats={stats} />
      <div className="typing-area">
        <div className="progress">{mode.kind === 'time' ? timeLeft : `${Math.min(typed.length - 1, mode.value)}/${mode.value}`}</div>
        <div className="words-container" role="group" aria-label="Typing area">
          <div className="words-window">
            <div className="words-inner" ref={innerRef} style={{ transform: `translateY(-${offset}px)` }}>
              {words.map((word, index) => <Word key={index} target={word} typed={typed[index] ?? ''} status={wordStatus(index)} />)}
            </div>
          </div>
        </div>
        <KeyPressIndicator presses={keyPresses} />
        {!started && !finished && <div className="start-hint">Type to begin</div>}
      </div>
    </main>
    {pickerOpen && <BookPicker
      activeId={activeId}
      onClose={() => setPickerOpen(false)}
      onPick={next => { setPickerOpen(false); void chooseSource(next) }}
      onRandom={() => { setPickerOpen(false); void chooseSource({ kind: 'random' }) }}
      onRemoved={id => { if (source.kind === 'book' && source.id === id) void chooseSource({ kind: 'random' }) }}
    />}
    {finished && finalStats && <Results stats={finalStats} canSubmit={source.kind === 'random'} restart={() => restart()} submit={() => setShowLeaderboard(true)} />}
    {showLeaderboard && finalStats && <Leaderboard onClose={() => setShowLeaderboard(false)} initialStats={{ name: '', wpm: finalStats.wpm, accuracy: finalStats.accuracy, rawWpm: finalStats.rawWpm, consistency: finalStats.consistency, submission: submission ?? undefined }} />}
  </div>
}

function LeaderboardRoute() {
  const navigate = useNavigate()
  return <Leaderboard onClose={() => navigate('/')} />
}

export default function App() {
  return <BrowserRouter><Routes>
    <Route path="/" element={<TypingTest />} />
    <Route path="/leaderboard" element={<LeaderboardRoute />} />
    <Route path="/privacy" element={<PrivacyPage />} />
  </Routes></BrowserRouter>
}
