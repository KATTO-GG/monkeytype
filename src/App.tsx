import { useState, useEffect, useRef, useCallback } from 'react'
import { BrowserRouter, Routes, Route, Link, useNavigate } from 'react-router-dom'
import { LightModeToggle } from './components/LightModeToggle'
import { PrivacyPage } from './components/PrivacyPage'
import { Leaderboard } from './components/Leaderboard'
import './App.css'

const WORDS = [
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'I',
  'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
  'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
  'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what',
  'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me',
  'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know', 'take',
  'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see', 'other',
  'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also',
  'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way',
  'even', 'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most', 'us'
]

const PUNCTUATION = ['.', ',', ';', ':', '!', '?']

function generateWords(count: number): string[] {
  const result: string[] = []
  for (let i = 0; i < count; i++) {
    let word = WORDS[Math.floor(Math.random() * WORDS.length)]
    if (Math.random() < 0.1) {
      word += PUNCTUATION[Math.floor(Math.random() * PUNCTUATION.length)]
    }
    result.push(word)
  }
  return result
}

interface WordData {
  chars: { char: string; status: 'pending' | 'correct' | 'incorrect' | 'current-caret' }[]
  originalIndex: number
  completed: boolean
}

interface Stats {
  wpm: number
  rawWpm: number
  accuracy: number
  consistency: number
  errors: number
  time: number
}

interface KeyPress {
  char: string
  status: 'correct' | 'incorrect'
}

function useTypingTest() {
  const [words, setWords] = useState<WordData[]>([])
  const [currentWordIndex, setCurrentWordIndex] = useState(0)
  const [currentCharIndex, setCurrentCharIndex] = useState(0)
  const [started, setStarted] = useState(false)
  const [finished, setFinished] = useState(false)
  const [stats, setStats] = useState<Stats>({ wpm: 0, rawWpm: 0, accuracy: 100, consistency: 0, errors: 0, time: 0 })
  const [keyPresses, setKeyPresses] = useState<KeyPress[]>([])
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [finalStats, setFinalStats] = useState<Stats | null>(null)

  const startTimeRef = useRef<number | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const wordTimesRef = useRef<number[]>([])
  const lastWordTimeRef = useRef<number>(0)

  const initTest = useCallback(() => {
    const newWords = generateWords(100).map((word, i) => ({
      chars: word.split('').map((char) => ({ char, status: 'pending' as const })),
      originalIndex: i,
      completed: false
    }))
    setWords(newWords)
    setCurrentWordIndex(0)
    setCurrentCharIndex(0)
    setStarted(false)
    setFinished(false)
    setStats({ wpm: 0, rawWpm: 0, accuracy: 100, consistency: 0, errors: 0, time: 0 })
    setKeyPresses([])
    setFinalStats(null)
    startTimeRef.current = null
    wordTimesRef.current = []
    lastWordTimeRef.current = 0
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  useEffect(() => {
    initTest()
  }, [initTest])

  const calculateStats = useCallback(() => {
    if (!startTimeRef.current) return
    const now = Date.now()
    const elapsed = (now - startTimeRef.current) / 1000 / 60
    if (elapsed <= 0) return

    let correctChars = 0
    let incorrectChars = 0
    let totalChars = 0

    words.forEach((word) => {
      word.chars.forEach((c) => {
        totalChars++
        if (c.status === 'correct') correctChars++
        else if (c.status === 'incorrect') incorrectChars++
      })
    })

    const rawWpm = Math.round(totalChars / 5 / elapsed)
    const wpm = Math.round((correctChars - incorrectChars) / 5 / elapsed)
    const accuracy = totalChars > 0 ? Math.round((correctChars / totalChars) * 100) : 100

    let consistency = 0
    if (wordTimesRef.current.length > 1) {
      const mean = wordTimesRef.current.reduce((a, b) => a + b, 0) / wordTimesRef.current.length
      const variance = wordTimesRef.current.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / wordTimesRef.current.length
      const stdDev = Math.sqrt(variance)
      consistency = Math.max(0, Math.round(100 - (stdDev / mean) * 100))
    }

    setStats({ wpm, rawWpm, accuracy, consistency, errors: incorrectChars, time: Math.round(elapsed * 60) })
  }, [words])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (finished) return

    const key = e.key

    if (!started && key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      setStarted(true)
      startTimeRef.current = Date.now()
      lastWordTimeRef.current = Date.now()
      intervalRef.current = setInterval(calculateStats, 100)
    }

    if (!started) return

    if (key === 'Backspace') {
      e.preventDefault()
      if (currentCharIndex > 0) {
        setCurrentCharIndex((prev) => prev - 1)
        setWords((prev) => {
          const next = [...prev]
          const word = next[currentWordIndex]
          const char = word.chars[currentCharIndex - 1]
          if (char.status === 'correct' || char.status === 'incorrect') {
            const newChars = [...word.chars]
            newChars[currentCharIndex - 1] = { ...char, status: 'pending' }
            next[currentWordIndex] = { ...word, chars: newChars, completed: false }
            if (currentWordIndex > 0) {
              const prevWord = next[currentWordIndex - 1]
              const lastChar = prevWord.chars[prevWord.chars.length - 1]
              if (lastChar.status === 'correct' || lastChar.status === 'incorrect') {
                const newPrevChars = [...prevWord.chars]
                newPrevChars[prevWord.chars.length - 1] = { ...lastChar, status: 'pending' }
                next[currentWordIndex - 1] = { ...prevWord, chars: newPrevChars, completed: false }
                setCurrentWordIndex((p) => p - 1)
                setCurrentCharIndex(prevWord.chars.length)
              }
            }
          }
          return next
        })
      } else if (currentWordIndex > 0) {
        const prevWord = words[currentWordIndex - 1]
        setCurrentWordIndex((p) => p - 1)
        setCurrentCharIndex(prevWord.chars.length)
        setWords((prev) => {
          const next = [...prev]
          const word = next[currentWordIndex]
          if (word.completed) {
            const newChars = word.chars.map((c) => (c.status === 'correct' || c.status === 'incorrect' ? { ...c, status: 'pending' as const } : c))
            next[currentWordIndex] = { ...word, chars: newChars, completed: false }
          }
          return next
        })
      }
      return
    }

    if (key === ' ') {
      e.preventDefault()
      const currentWord = words[currentWordIndex]
      const hasIncorrect = currentWord.chars.some((c) => c.status === 'incorrect')
      if (!hasIncorrect && currentCharIndex === currentWord.chars.length) {
        const now = Date.now()
        wordTimesRef.current.push(now - lastWordTimeRef.current)
        lastWordTimeRef.current = now
        setWords((prev) => {
          const next = [...prev]
          next[currentWordIndex] = { ...currentWord, completed: true }
          return next
        })
        setCurrentWordIndex((prev) => prev + 1)
        setCurrentCharIndex(0)
        if (currentWordIndex >= words.length - 1) {
          finishTest()
        }
      }
      return
    }

    if (key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const currentWord = words[currentWordIndex]
      if (currentCharIndex < currentWord.chars.length) {
        const expectedChar = currentWord.chars[currentCharIndex].char
        const isCorrect = key === expectedChar

        setWords((prev) => {
          const next = [...prev]
          const word = next[currentWordIndex]
          const newChars = [...word.chars]
          newChars[currentCharIndex] = { ...newChars[currentCharIndex], status: isCorrect ? 'correct' : 'incorrect' }
          next[currentWordIndex] = { ...word, chars: newChars }
          return next
        })

        setKeyPresses((prev) => [...prev.slice(-15), { char: key, status: isCorrect ? 'correct' : 'incorrect' }])
        setCurrentCharIndex((prev) => prev + 1)

        if (currentCharIndex === currentWord.chars.length - 1) {
          const hasIncorrect = currentWord.chars.some((c, i) => i !== currentCharIndex && c.status === 'incorrect')
          const nextCharCorrect = isCorrect
          if (!hasIncorrect && nextCharCorrect) {
            const now = Date.now()
            wordTimesRef.current.push(now - lastWordTimeRef.current)
            lastWordTimeRef.current = now
            setWords((prev) => {
              const next = [...prev]
              next[currentWordIndex] = { ...currentWord, completed: true }
              return next
            })
            setCurrentWordIndex((prev) => prev + 1)
            setCurrentCharIndex(0)
            if (currentWordIndex >= words.length - 1) {
              finishTest()
            }
          }
        }
      }
    }
  }, [words, currentWordIndex, currentCharIndex, finished, calculateStats])

  const finishTest = useCallback(() => {
    setFinished(true)
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    calculateStats()
    setFinalStats(stats)
    setShowLeaderboard(true)
  }, [calculateStats, stats])

  return {
    words,
    currentWordIndex,
    currentCharIndex,
    started,
    finished,
    stats,
    keyPresses,
    showLeaderboard,
    setShowLeaderboard,
    finalStats,
    handleKeyDown,
    initTest
  }
}

function Word({ word, isCurrent, isCompleted }: { word: WordData; isCurrent: boolean; isCompleted: boolean }) {
  return (
    <span className={`word${isCompleted ? ' completed' : ''}${isCurrent ? ' current' : ''}`}>
      {word.chars.map((c, i) => (
        <span
          key={i}
          className={`char${c.status !== 'pending' ? ` ${c.status}` : ''}${c.status === 'pending' ? ' pending' : ''}`}
        >
          {c.char === ' ' ? <span className="space" /> : c.char}
        </span>
      ))}
      <span className="space" />
    </span>
  )
}

function Stat({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="stat">
      <div className={`stat-value${accent ? ' accent' : ''}`}>{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  )
}

function StatsPanel({ stats }: { stats: Stats }) {
  return (
    <div className="stats">
      <Stat label="WPM" value={stats.wpm} accent />
      <Stat label="Raw" value={stats.rawWpm} />
      <Stat label="Acc" value={`${stats.accuracy}%`} />
      <Stat label="Consistency" value={`${stats.consistency}%`} />
    </div>
  )
}

function KeyPressIndicator({ keyPresses }: { keyPresses: KeyPress[] }) {
  return (
    <div className="key-indicator" aria-hidden="true">
      {keyPresses.map((kp, i) => (
        <span key={i} className={kp.status === 'correct' ? 'key-correct' : 'key-incorrect'}>
          {kp.char}
        </span>
      ))}
    </div>
  )
}

function Results({ stats, onRestart }: { stats: Stats; onRestart: () => void }) {
  const navigate = useNavigate()
  return (
    <div className="results-overlay" onClick={() => {}}>
      <div className="results-panel">
        <h2>Test Complete</h2>
        <div className="results-stats">
          <div className="result-stat">
            <div className="result-value">{stats.wpm}</div>
            <div className="result-label">WPM</div>
          </div>
          <div className="result-stat">
            <div className="result-value">{stats.rawWpm}</div>
            <div className="result-label">Raw</div>
          </div>
          <div className="result-stat">
            <div className="result-value">{stats.accuracy}%</div>
            <div className="result-label">Accuracy</div>
          </div>
          <div className="result-stat">
            <div className="result-value">{stats.consistency}%</div>
            <div className="result-label">Consistency</div>
          </div>
          <div className="result-stat">
            <div className="result-value">{stats.errors}</div>
            <div className="result-label">Errors</div>
          </div>
        </div>
        <button className="restart-btn" onClick={onRestart}>
          Restart
        </button>
        <button className="restart-btn" style={{ marginTop: '12px', background: 'var(--bg)', color: 'var(--fg)', border: '1px solid var(--border)' }} onClick={() => navigate('/leaderboard')}>
          View Leaderboard
        </button>
      </div>
    </div>
  )
}

function TypingTest() {
  const {
    words,
    currentWordIndex,
    started,
    finished,
    stats,
    keyPresses,
    showLeaderboard,
    setShowLeaderboard,
    finalStats,
    handleKeyDown,
    initTest
  } = useTypingTest()

  return (
    <div className="app" onKeyDown={handleKeyDown} tabIndex={0}>
      <header className="header">
        <div className="logo">MonkeyType</div>
        <nav className="header-controls">
          <LightModeToggle />
          <Link to="/leaderboard" className="mode-btn">Leaderboard</Link>
          <Link to="/privacy" className="mode-btn">Privacy</Link>
        </nav>
      </header>
      <main className="main">
        <StatsPanel stats={stats} />
        <div className="typing-area">
          <div className="words-container" role="textarea" aria-label="Typing area">
            {words.map((word) => (
              <Word
                key={word.originalIndex}
                word={word}
                isCurrent={word.originalIndex === currentWordIndex}
                isCompleted={word.completed}
              />
            ))}
          </div>
          <KeyPressIndicator keyPresses={keyPresses} />
          {!started && !finished && (
            <div className="start-hint">Type to begin</div>
          )}
        </div>
      </main>
      {finished && finalStats && <Results stats={finalStats} onRestart={initTest} />}
      {showLeaderboard && finalStats && (
        <Leaderboard onClose={() => setShowLeaderboard(false)} initialStats={{ name: '', wpm: finalStats.wpm, accuracy: finalStats.accuracy, rawWpm: finalStats.rawWpm, consistency: finalStats.consistency }} />
      )}
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<TypingTest />} />
        <Route path="/leaderboard" element={<Leaderboard onClose={() => {}} />} />
        <Route path="/privacy" element={<PrivacyPage />} />
      </Routes>
    </BrowserRouter>
  )
}