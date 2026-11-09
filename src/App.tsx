import { useCallback, useEffect, useRef, useState } from 'react'
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
  const startRef = useRef<number | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const wordsRef = useRef<WordData[]>([])
  const timingsRef = useRef<number[]>([])
  const lastWordRef = useRef(0)
  wordsRef.current = words

  const restart = useCallback(() => {
    const next = generateWords(100)
    wordsRef.current = next
    setWords(next); setWordIndex(0); setCharIndex(0); setStarted(false); setFinished(false)
    setStats(emptyStats()); setFinalStats(null); setKeyPresses([]); setShowLeaderboard(false)
    startRef.current = null; timingsRef.current = []; lastWordRef.current = 0
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
  }, [])

  useEffect(() => { restart(); return () => { if (timerRef.current) clearInterval(timerRef.current) } }, [restart])

  const calculate = useCallback((source = wordsRef.current, end = Date.now()): Stats | null => {
    if (!startRef.current) return null
    const elapsed = (end - startRef.current) / 60000
    if (elapsed <= 0) return null
    let correct = 0, incorrect = 0
    source.forEach(w => w.chars.forEach(c => { if (c.status === 'correct') correct++; else if (c.status === 'incorrect') incorrect++ }))
    const typed = correct + incorrect
    const mean = timingsRef.current.length ? timingsRef.current.reduce((a,b) => a+b, 0) / timingsRef.current.length : 0
    const variance = mean ? timingsRef.current.reduce((a,b) => a + (b-mean) ** 2, 0) / timingsRef.current.length : 0
    const result = { wpm: Math.max(0, Math.round((correct-incorrect)/5/elapsed)), rawWpm: Math.round(typed/5/elapsed), accuracy: typed ? Math.round(correct/typed*100) : 100, consistency: mean ? Math.max(0, Math.round(100-Math.sqrt(variance)/mean*100)) : 0, errors: incorrect, time: Math.round(elapsed*60) }
    setStats(result)
    return result
  }, [])

  const finish = useCallback((finalWords: WordData[]) => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
    setFinished(true)
    const result = calculate(finalWords)
    if (result) setFinalStats(result)
  }, [calculate])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (finished || !words.length) return
    const key = e.key
    const starting = !started && key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey
    if (starting) {
      const now = Date.now()
      startRef.current = now; lastWordRef.current = now; setStarted(true)
      timerRef.current = setInterval(() => calculate(), 100)
    }
    if (!started && !starting) return

    if (key === 'Backspace') {
      e.preventDefault()
      if (charIndex > 0) {
        const target = charIndex - 1
        setWords(prev => prev.map((w,i) => i === wordIndex ? { ...w, completed: false, chars: w.chars.map((c,j) => j === target ? { ...c, status: 'pending' } : c) } : w))
        setCharIndex(target)
      } else if (wordIndex > 0) {
        const previous = wordIndex - 1
        const target = words[previous].chars.length - 1
        setWords(prev => prev.map((w,i) => i === previous ? { ...w, completed: false, chars: w.chars.map((c,j) => j === target ? { ...c, status: 'pending' } : c) } : w))
        setWordIndex(previous); setCharIndex(target)
      }
      return
    }

    if (key === ' ' ) {
      e.preventDefault()
      const current = words[wordIndex]
      if (current && charIndex === current.chars.length && !current.chars.some(c => c.status === 'incorrect')) {
        const now = Date.now()
        timingsRef.current.push(now-lastWordRef.current); lastWordRef.current = now
        const next = words.map((w,i) => i === wordIndex ? { ...w, completed: true } : w)
        setWords(next)
        if (wordIndex === words.length-1) finish(next)
        else { setWordIndex(wordIndex+1); setCharIndex(0) }
      }
      return
    }

    if (key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return
    const current = words[wordIndex]
    if (!current || charIndex >= current.chars.length) return
    const correct = key === current.chars[charIndex].char
    const updated = words.map((w,i) => i === wordIndex ? { ...w, chars: w.chars.map((c,j) => j === charIndex ? { ...c, status: correct ? 'correct' as const : 'incorrect' as const } : c) } : w)
    setWords(updated)
    setKeyPresses(prev => [...prev.slice(-15), { char: key, status: correct ? 'correct' : 'incorrect' }])
    setCharIndex(charIndex+1)
    if (charIndex === current.chars.length-1 && correct && !current.chars.some((c,j) => j !== charIndex && c.status === 'incorrect')) {
      const now = Date.now()
      timingsRef.current.push(now-lastWordRef.current); lastWordRef.current = now
      const completed = updated.map((w,i) => i === wordIndex ? { ...w, completed: true } : w)
      setWords(completed)
      if (wordIndex === words.length-1) finish(completed)
      else { setWordIndex(wordIndex+1); setCharIndex(0) }
    }
  }, [finished, words, started, wordIndex, charIndex, calculate, finish])

  return { words, wordIndex, started, finished, stats, finalStats, keyPresses, showLeaderboard, setShowLeaderboard, handleKeyDown, restart }
}

function Word({ word, current }: { word: WordData; current: boolean }) {
  return <span className={`word${word.completed ? ' completed' : ''}${current ? ' current' : ''}`}>
    {word.chars.map((c,i) => <span key={i} className={`char ${c.status}`}>{c.char}</span>)}<span className="space" />
  </span>
}
function Stat({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return <div className="stat"><div className={`stat-value${accent ? ' accent' : ''}`}>{value}</div><div className="stat-label">{label}</div></div>
}
function StatsPanel({ stats }: { stats: Stats }) {
  return <div className="stats"><Stat label="WPM" value={stats.wpm} accent /><Stat label="Raw" value={stats.rawWpm} /><Stat label="Acc" value={`${stats.accuracy}%`} /><Stat label="Consistency" value={`${stats.consistency}%`} /></div>
}
function KeyPressIndicator({ presses }: { presses: KeyPress[] }) {
  return <div className="key-indicator" aria-hidden="true">{presses.map((p,i) => <span key={i} className={p.status === 'correct' ? 'key-correct' : 'key-incorrect'}>{p.char}</span>)}</div>
}
function Results({ stats, restart, submit }: { stats: Stats; restart: () => void; submit: () => void }) {
  const navigate = useNavigate()
  return <div className="results-overlay"><div className="results-panel"><h2>Test Complete</h2><div className="results-stats">
    <div className="result-stat"><div className="result-value">{stats.wpm}</div><div className="result-label">WPM</div></div>
    <div className="result-stat"><div className="result-value">{stats.rawWpm}</div><div className="result-label">Raw</div></div>
    <div className="result-stat"><div className="result-value">{stats.accuracy}%</div><div className="result-label">Accuracy</div></div>
    <div className="result-stat"><div className="result-value">{stats.consistency}%</div><div className="result-label">Consistency</div></div>
    <div className="result-stat"><div className="result-value">{stats.errors}</div><div className="result-label">Errors</div></div>
  </div><button className="restart-btn" onClick={restart}>Restart</button>
  <button className="restart-btn" style={{ marginTop: 12, background: 'var(--bg)', color: 'var(--fg)', border: '1px solid var(--border)' }} onClick={submit}>Submit score</button>
  <button className="restart-btn" style={{ marginTop: 12, background: 'var(--bg)', color: 'var(--fg)', border: '1px solid var(--border)' }} onClick={() => navigate('/leaderboard')}>View leaderboard</button>
  </div></div>
}
function TypingTest() {
  const appRef = useRef<HTMLDivElement>(null)
  const { words, wordIndex, started, finished, stats, finalStats, keyPresses, showLeaderboard, setShowLeaderboard, handleKeyDown, restart } = useTypingTest()
  useEffect(() => { appRef.current?.focus() }, [])
  return <div ref={appRef} className="app" onKeyDown={handleKeyDown} onClick={() => appRef.current?.focus()} tabIndex={0}>
    <header className="header"><div className="logo">Ape Type</div><nav className="header-controls"><LightModeToggle /><Link to="/leaderboard" className="mode-btn">Leaderboard</Link><Link to="/privacy" className="mode-btn">Privacy</Link></nav></header>
    <main className="main"><StatsPanel stats={stats} /><div className="typing-area">
      <div className="words-container" role="group" aria-label="Typing area">{words.map(word => <Word key={word.originalIndex} word={word} current={word.originalIndex === wordIndex} />)}</div>
      <KeyPressIndicator presses={keyPresses} />{!started && !finished && <div className="start-hint">Type to begin</div>}
    </div></main>
    {finished && finalStats && <Results stats={finalStats} restart={restart} submit={() => setShowLeaderboard(true)} />}
    {showLeaderboard && finalStats && <Leaderboard onClose={() => setShowLeaderboard(false)} initialStats={{ name: '', wpm: finalStats.wpm, accuracy: finalStats.accuracy, rawWpm: finalStats.rawWpm, consistency: finalStats.consistency }} />}
  </div>
}
function LeaderboardRoute() {
  const navigate = useNavigate()
  return <Leaderboard onClose={() => navigate('/')} />
}
export default function App() {
  return <BrowserRouter><Routes><Route path="/" element={<TypingTest />} /><Route path="/leaderboard" element={<LeaderboardRoute />} /><Route path="/privacy" element={<PrivacyPage />} /></Routes></BrowserRouter>
}
