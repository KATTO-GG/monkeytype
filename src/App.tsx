import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { BrowserRouter, Link, Route, Routes, useNavigate } from 'react-router-dom'
import { LightModeToggle } from './components/LightModeToggle'
import { PrivacyPage } from './components/PrivacyPage'
import { Leaderboard } from './components/Leaderboard'
import './App.css'

const WORDS = 'the be to of and a in that have I it for not on with he as you do at this but his by from they we say her she or an will my one all would there their what so up out if about who get which go me when make can like time no just him know take people into year your good some could them see other than then now look only come its over think also back after use two how our work first well way even new want because any these give day most us'.split(' ')
const PUNCTUATION = ['.', ',', ';', ':', '!', '?']
type CharStatus = 'pending' | 'correct' | 'incorrect'
interface WordData { chars: { char: string; status: CharStatus }[]; originalIndex: number; completed: boolean }
interface Stats { wpm: number; rawWpm: number; accuracy: number; consistency: number; errors: number; time: number }
interface KeyPress { char: string; status: 'correct' | 'incorrect' }
const emptyStats = (): Stats => ({ wpm: 0, rawWpm: 0, accuracy: 100, consistency: 0, errors: 0, time: 0 })

function generateWords(count: number): WordData[] {
  return Array.from({ length: count }, (_, i) => {
    let word = WORDS[Math.floor(Math.random() * WORDS.length)]
    if (Math.random() < 0.1) word += PUNCTUATION[Math.floor(Math.random() * PUNCTUATION.length)]
    return { chars: word.split('').map(char => ({ char, status: 'pending' as const })), originalIndex: i, completed: false }
  })
}

function useTypingTest() {
  const [words, setWords] = useState<WordData[]>([])
  const [wordIndex, setWordIndex] = useState(0)
  const [charIndex, setCharIndex] = useState(0)
  const [started, setStarted] = useState(false)
  const [finished, setFinished] = useState(false)
  const [stats, setStats] = useState<Stats>(emptyStats)
  const [finalStats, setFinalStats] = useState<Stats | null>(null)
  const [keyPresses, setKeyPresses] = useState<KeyPress[]>([])
  const [showLeaderboard, setShowLeaderboard] = useState(false)

  const startTimeRef = useRef<number | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timingsRef = useRef<number[]>([])
  const lastWordTimeRef = useRef(0)
  const totalTypedRef = useRef(0)
  const correctTypedRef = useRef(0)
  const errorsRef = useRef(0)

  const restart = useCallback(() => {
    setWords(generateWords(100))
    setWordIndex(0)
    setCharIndex(0)
    setStarted(false)
    setFinished(false)
    setStats(emptyStats())
    setFinalStats(null)
    setKeyPresses([])
    setShowLeaderboard(false)
    startTimeRef.current = null
    timingsRef.current = []
    lastWordTimeRef.current = 0
    totalTypedRef.current = 0
    correctTypedRef.current = 0
    errorsRef.current = 0
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
  }, [])

  useEffect(() => {
    restart()
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [restart])

  const calculateStats = useCallback((endTime = Date.now()): Stats | null => {
    if (startTimeRef.current === null) return null
    const elapsedMinutes = (endTime - startTimeRef.current) / 60000
    if (elapsedMinutes <= 0) return null

    const correct = correctTypedRef.current
    const total = totalTypedRef.current
    const intervals = timingsRef.current
    const mean = intervals.length ? intervals.reduce((sum, value) => sum + value, 0) / intervals.length : 0
    const variance = mean ? intervals.reduce((sum, value) => sum + (value - mean) ** 2, 0) / intervals.length : 0
    const result: Stats = {
      wpm: Math.max(0, Math.round(correct / 5 / elapsedMinutes)),
      rawWpm: Math.round(total / 5 / elapsedMinutes),
      accuracy: total ? Math.round(correct / total * 100) : 100,
      consistency: mean ? Math.max(0, Math.round(100 - Math.sqrt(variance) / mean * 100)) : 0,
      errors: errorsRef.current,
      time: Math.round(elapsedMinutes * 60),
    }
    setStats(result)
    return result
  }, [])

  const finish = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
    const result = calculateStats()
    if (result) {
      setStats(result)
      setFinalStats(result)
    }
    setFinished(true)
  }, [calculateStats])

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (finished || !words.length) return
    const { key } = event
    const printable = key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey

    if (!started && printable) {
      const now = Date.now()
      startTimeRef.current = now
      lastWordTimeRef.current = now
      setStarted(true)
      timerRef.current = setInterval(() => calculateStats(), 100)
    } else if (!started) {
      return
    }

    if (key === 'Backspace') {
      event.preventDefault()
      if (charIndex > 0) {
        const target = charIndex - 1
        setWords(current => current.map((word, index) => index === wordIndex
          ? { ...word, chars: word.chars.map((char, charPosition) => charPosition === target ? { ...char, status: 'pending' } : char) }
          : word))
        setCharIndex(target)
      } else if (wordIndex > 0) {
        const previousIndex = wordIndex - 1
        const previousLength = words[previousIndex].chars.length
        setWords(current => current.map((word, index) => index === previousIndex
          ? { ...word, completed: false, chars: word.chars.map((char, charPosition) => charPosition === previousLength - 1 ? { ...char, status: 'pending' } : char) }
          : word))
        setWordIndex(previousIndex)
        setCharIndex(Math.max(0, previousLength - 1))
      }
      return
    }

    if (key === ' ') {
      event.preventDefault()
      if (charIndex === 0) return
      const now = Date.now()
      timingsRef.current.push(now - lastWordTimeRef.current)
      lastWordTimeRef.current = now
      setWords(current => current.map((word, index) => index === wordIndex ? { ...word, completed: true } : word))
      if (wordIndex === words.length - 1) finish()
      else {
        setWordIndex(index => index + 1)
        setCharIndex(0)
      }
      return
    }

    if (!printable) return
    const currentWord = words[wordIndex]
    if (!currentWord || charIndex >= currentWord.chars.length) return

    const correct = key === currentWord.chars[charIndex].char
    totalTypedRef.current += 1
    if (correct) correctTypedRef.current += 1
    else errorsRef.current += 1

    setWords(current => current.map((word, index) => index === wordIndex
      ? { ...word, chars: word.chars.map((char, charPosition) => charPosition === charIndex ? { ...char, status: correct ? 'correct' : 'incorrect' } : char) }
      : word))
    setKeyPresses(current => [...current.slice(-15), { char: key, status: correct ? 'correct' : 'incorrect' }])
    setCharIndex(index => index + 1)
  }, [finished, words, started, wordIndex, charIndex, calculateStats, finish])

  return { words, wordIndex, started, finished, stats, finalStats, keyPresses, showLeaderboard, setShowLeaderboard, handleKeyDown, restart }
}

function Word({ word, current }: { word: WordData; current: boolean }) {
  return <span className={`word${word.completed ? ' completed' : ''}${current ? ' current' : ''}`}>
    {word.chars.map((char, index) => <span key={index} className={`char ${char.status}`}>{char.char}</span>)}<span className="space" />
  </span>
}

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

function Results({ stats, restart, submit }: { stats: Stats; restart: () => void; submit: () => void }) {
  const navigate = useNavigate()
  return <div className="results-overlay"><div className="results-panel">
    <h2>Test Complete</h2>
    <div className="results-stats">
      <div className="result-stat"><div className="result-value">{stats.wpm}</div><div className="result-label">WPM</div></div>
      <div className="result-stat"><div className="result-value">{stats.rawWpm}</div><div className="result-label">Raw</div></div>
      <div className="result-stat"><div className="result-value">{stats.accuracy}%</div><div className="result-label">Accuracy</div></div>
      <div className="result-stat"><div className="result-value">{stats.consistency}%</div><div className="result-label">Consistency</div></div>
      <div className="result-stat"><div className="result-value">{stats.errors}</div><div className="result-label">Errors</div></div>
    </div>
    <button className="restart-btn" onClick={restart}>Restart</button>
    <button className="restart-btn" style={{ marginTop: 12, background: 'var(--bg)', color: 'var(--fg)', border: '1px solid var(--border)' }} onClick={submit}>Submit score</button>
    <button className="restart-btn" style={{ marginTop: 12, background: 'var(--bg)', color: 'var(--fg)', border: '1px solid var(--border)' }} onClick={() => navigate('/leaderboard')}>View leaderboard</button>
  </div></div>
}

function TypingTest() {
  const appRef = useRef<HTMLDivElement>(null)
  const { words, wordIndex, started, finished, stats, finalStats, keyPresses, showLeaderboard, setShowLeaderboard, handleKeyDown, restart } = useTypingTest()
  useEffect(() => { appRef.current?.focus() }, [])
  return <div ref={appRef} className="app" onKeyDown={handleKeyDown} onClick={() => appRef.current?.focus()} tabIndex={0}>
    <header className="header">
      <div className="logo">Ape Type</div>
      <nav className="header-controls"><LightModeToggle /><Link to="/leaderboard" className="mode-btn">Leaderboard</Link><Link to="/privacy" className="mode-btn">Privacy</Link></nav>
    </header>
    <main className="main">
      <StatsPanel stats={stats} />
      <div className="typing-area">
        <div className="words-container" role="group" aria-label="Typing area">
          {words.map(word => <Word key={word.originalIndex} word={word} current={word.originalIndex === wordIndex} />)}
        </div>
        <KeyPressIndicator presses={keyPresses} />
        {!started && !finished && <div className="start-hint">Type to begin</div>}
      </div>
    </main>
    {finished && finalStats && <Results stats={finalStats} restart={restart} submit={() => setShowLeaderboard(true)} />}
    {showLeaderboard && finalStats && <Leaderboard onClose={() => setShowLeaderboard(false)} initialStats={{ name: '', wpm: finalStats.wpm, accuracy: finalStats.accuracy, rawWpm: finalStats.rawWpm, consistency: finalStats.consistency }} />}
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
