import { useState, useEffect } from 'react'

interface LeaderboardEntry {
  id: string
  name: string
  wpm: number
  accuracy: number
  rawWpm: number
  consistency: number
  timestamp: number
}

interface SubmitScoreData {
  name: string
  wpm: number
  accuracy: number
  rawWpm: number
  consistency: number
}

const API_BASE = import.meta.env.VITE_API_BASE || ''

interface LeaderboardProps {
  onClose: () => void
  initialStats?: SubmitScoreData
}

export function Leaderboard({ onClose, initialStats }: LeaderboardProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [showSubmit, setShowSubmit] = useState(false)
  const [submitName, setSubmitName] = useState('')
  const [submitStats] = useState<SubmitScoreData | null>(initialStats || null)

  useEffect(() => {
    if (initialStats && !showSubmit) {
      setShowSubmit(true)
      setSubmitName(localStorage.getItem('leaderboardName') || '')
    }
  }, [initialStats])

  useEffect(() => {
    fetchLeaderboard()
  }, [])

  const fetchLeaderboard = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/leaderboard`)
      if (!res.ok) throw new Error('Failed to fetch leaderboard')
      const data = await res.json()
      setEntries(data)
    } catch (e) {
      setError('Failed to load leaderboard')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!submitName.trim() || !submitStats) return
    setSubmitting(true)
    try {
      const res = await fetch(`${API_BASE}/api/leaderboard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...submitStats, name: submitName.trim() })
      })
      if (!res.ok) throw new Error('Failed to submit score')
      setShowSubmit(false)
      setSubmitName('')
      fetchLeaderboard()
    } catch (e) {
      setError('Failed to submit score')
      console.error(e)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="leaderboard-overlay" onClick={onClose}>
      <div className="leaderboard-panel" onClick={(e) => e.stopPropagation()}>
        <header className="leaderboard-header">
          <h2>🏆 Leaderboard</h2>
          <button className="close-btn" onClick={onClose} aria-label="Close">×</button>
        </header>

        {showSubmit && submitStats && (
          <form className="submit-form" onSubmit={handleSubmit}>
            <h3>Submit Your Score</h3>
            <p>WPM: {submitStats.wpm} | Acc: {submitStats.accuracy}%</p>
            <input
              type="text"
              value={submitName}
              onChange={(e) => setSubmitName(e.target.value)}
              placeholder="Your name (max 20 chars)"
              maxLength={20}
              required
              autoFocus
            />
            <div className="submit-actions">
              <button type="button" className="btn-secondary" onClick={() => setShowSubmit(false)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </form>
        )}

        {!showSubmit && (
          <div className="leaderboard-content">
            {loading ? (
              <div className="loading">Loading...</div>
            ) : error ? (
              <div className="error">{error}</div>
            ) : entries.length === 0 ? (
              <div className="empty">No scores yet. Be the first!</div>
            ) : (
              <table className="leaderboard-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Name</th>
                    <th>WPM</th>
                    <th>Acc</th>
                    <th>Raw</th>
                    <th>Consistency</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry, i) => (
                    <tr key={entry.id} className={i < 3 ? 'top-3' : ''}>
                      <td className="rank">{i + 1}</td>
                      <td className="name">{entry.name}</td>
                      <td className="wpm">{entry.wpm}</td>
                      <td className="accuracy">{entry.accuracy}%</td>
                      <td className="raw">{entry.rawWpm}</td>
                      <td className="consistency">{entry.consistency}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {!showSubmit && submitStats && (
          <button className="submit-btn" onClick={() => setShowSubmit(true)}>
            Submit Score
          </button>
        )}

        <p className="privacy-link">
          <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
        </p>
      </div>
    </div>
  )
}