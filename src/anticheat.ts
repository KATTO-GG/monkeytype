export const API_BASE: string = import.meta.env.VITE_API_BASE || ''

export interface TestMode { kind: 'time' | 'words'; value: number }

export interface Submission {
  token: Promise<string | null>
  mode: TestMode
  words: string[]
  typed: string[]
  ts: number[]
  elapsedMs: number
}

export function startSession(mode: TestMode): Promise<string | null> {
  return fetch(`${API_BASE}/api/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(mode),
  })
    .then(response => (response.ok ? response.json() : null))
    .then((data: { token?: unknown } | null) => (typeof data?.token === 'string' ? data.token : null))
    .catch(() => null)
}

// Must stay identical to consistencyFromTimestamps in functions/_lib/anticheat.js
export function consistencyFromTimestamps(ts: number[], elapsedMs: number, kind: TestMode['kind']): number {
  const seconds = kind === 'time' ? Math.floor(elapsedMs / 1000) - 1 : Math.floor(elapsedMs / 1000)
  if (seconds < 2) return 0
  const counts = new Array<number>(seconds).fill(0)
  for (const t of ts) {
    const bucket = Math.floor(t / 1000)
    if (bucket >= 0 && bucket < seconds) counts[bucket] += 1
  }
  const samples = counts.map(count => count * 12)
  const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length
  if (mean <= 0) return 0
  const variance = samples.reduce((sum, value) => sum + (value - mean) ** 2, 0) / samples.length
  return Math.max(0, Math.min(100, Math.round(100 - Math.sqrt(variance) / mean * 100)))
}
