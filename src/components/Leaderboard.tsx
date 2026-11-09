import { useCallback, useEffect, useState } from 'react'

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
  const [showSubmit, setShowSubmit] = useState(Boolean(initialStats))
  const [submitName, setSubmitName] = useState(() => {
    try { return localStorage.getItem('leaderboardName') || '' } catch { return '' }
  })

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`${API_BASE}/api/leaderboard`, { cache: 'no-store' })
      if (!response.ok) throw new Error('Leaderboard request failed')
      const data: unknown = await response.json()
      if (!Array.isArray(data)) throw new Error('Invalid leaderboard response')
      setEntries(data as LeaderboardEntry[])
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load leaderboard')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void fetchLeaderboard() }, [fetchLeaderboard])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const name = submitName.trim().replace(/\s+/g, ' ').slice(0, 20)
    if (!name || !initialStats || submitting) return

    setSubmitting(true)
    setError(null)
    try {
      const response = await fetch(`${API_BASE}/api/leaderboard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...initialStats, name }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(result?.error || 'Score submission failed')

      try { localStorage.setItem('leaderboardName', name) } catch { /* Storage may be unavailable */ }
      setShowSubmit(false)
      setSubmitName(name)
      await fetchLeaderboard()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not submit score')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="leaderboard-overlay" onClick={onClose}>
      <div className="leaderboard-panel" onClick={event => event.stopPropagation()}>
        <header className="leaderboard-header">
          <h2>Leaderboard</h2>
          <button className="close-btn" onClick={onClose} aria-label="Close">×</button>
        </header>

        {showSubmit && initialStats && (
          <form className="submit-form" onSubmit={handleSubmit}>
            <h3>Submit your score</h3>
            <p>WPM: {initialStats.wpm} | Accuracy: {initialStats.accuracy}%</p>
            <input
              type="text"
              value={submitName}
              onChange={event => setSubmitName(event.target.value)}
              placeholder="Your name (max 20 characters)"
              maxLength={20}
              minLength={1}
              autoComplete="nickname"
              required
              autoFocus
            />
            <div className="submit-actions">
              <button type="button" className="btn-secondary" onClick={() => setShowSubmit(false)} disabled={submitting}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={submitting || !submitName.trim()}>
                {submitting ? 'Submitting…' : 'Submit score'}
              </button>
            </div>
          </form>
        )}

        {!showSubmit && (
          <div className="leaderboard-content">
            {loading ? <div className="loading">Loading leaderboard…</div>
              : error ? <div className="error">{error}</div>
                : entries.length === 0 ? <div className="empty">No scores yet. Be the first!</div>
                  : (
                    <table className="leaderboard-table">
                      <thead><tr><th>#</th><th>Name</th><th>WPM</th><th>Acc</th><th>Raw</th><th>Consistency</th></tr></thead>
                      <tbody>
                        {entries.map((entry, index) => (
                          <tr key={entry.id} className={index < 3 ? 'top-3' : ''}>
                            <td className="rank">{index + 1}</td>
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

        {error && showSubmit && <p className="error" role="alert">{error}</p>}
        {!showSubmit && initialStats && (
          <button className="submit-btn" onClick={() => { setError(null); setShowSubmit(true) }}>Submit score</button>
        )}
        <p className="privacy-link"><a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy policy</a></p>
      </div>
    </div>
  )
}
