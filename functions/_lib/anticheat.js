// Shared anti-cheat helpers for Pages Functions.
// consistencyFromTimestamps must stay identical to src/anticheat.ts.

const WORDS = new Set('the be to of and a in that have I it for not on with he as you do at this but his by from they we say her she or an will my one all would there their what so up out if about who get which go me when make can like time no just him know take people into year your good some could them see other than then now look only come its over think also back after use two how our work first well way even new want because any these give day most us'.split(' '))
const PUNCTUATION = new Set(['.', ',', ';', ':', '!', '?'])
const MODES = { time: [15, 30, 60], words: [10, 25, 50] }
const MAX_AGE_MS = 15 * 60 * 1000
const LATENCY_TOLERANCE_MS = 4000
const MAX_EXTRA = 19
const MAX_WPM = 350

const encoder = new TextEncoder()
const decoder = new TextDecoder()

const toBase64Url = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const fromBase64Url = text => Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), char => char.charCodeAt(0))

export const validMode = mode => Boolean(mode) && (mode.kind === 'time' || mode.kind === 'words') && MODES[mode.kind].includes(mode.value)

export async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(text))
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

let cachedKey = null

async function getKey(env) {
  if (cachedKey) return cachedKey
  let secret = env.ANTICHEAT_SECRET
  if (!secret) {
    secret = await env.LEADERBOARD_KV.get('config:secret')
    if (!secret) {
      const fresh = [...crypto.getRandomValues(new Uint8Array(32))].map(byte => byte.toString(16).padStart(2, '0')).join('')
      await env.LEADERBOARD_KV.put('config:secret', fresh)
      secret = (await env.LEADERBOARD_KV.get('config:secret')) || fresh
    }
  }
  cachedKey = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
  return cachedKey
}

export async function createToken(env, kind, value) {
  const payload = toBase64Url(encoder.encode(JSON.stringify({ n: crypto.randomUUID(), s: Date.now(), k: kind, v: value })))
  const signature = await crypto.subtle.sign('HMAC', await getKey(env), encoder.encode(payload))
  return `${payload}.${toBase64Url(new Uint8Array(signature))}`
}

export async function verifyToken(env, token) {
  if (typeof token !== 'string' || token.length > 500) return null
  const parts = token.split('.')
  if (parts.length !== 2) return null
  try {
    const valid = await crypto.subtle.verify('HMAC', await getKey(env), fromBase64Url(parts[1]), encoder.encode(parts[0]))
    if (!valid) return null
    const payload = JSON.parse(decoder.decode(fromBase64Url(parts[0])))
    if (typeof payload.n !== 'string' || !Number.isFinite(payload.s) || !validMode({ kind: payload.k, value: payload.v })) return null
    return payload
  } catch {
    return null
  }
}

export function consistencyFromTimestamps(ts, elapsedMs, kind) {
  const seconds = kind === 'time' ? Math.floor(elapsedMs / 1000) - 1 : Math.floor(elapsedMs / 1000)
  if (seconds < 2) return 0
  const counts = new Array(seconds).fill(0)
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

function validateWords(words, typed, mode) {
  if (!Array.isArray(words) || !Array.isArray(typed)) return 'Invalid test data'
  if (words.length < 1 || words.length > 700 || typed.length < 1 || typed.length > words.length + 1) return 'Invalid test data'
  for (const word of words) {
    if (typeof word !== 'string' || word.length < 1 || word.length > 20 || !/^[A-Za-z]+[.,;:!?]?$/.test(word)) return 'Invalid test words'
    const base = PUNCTUATION.has(word[word.length - 1]) ? word.slice(0, -1) : word
    if (!WORDS.has(base)) return 'Invalid test words'
  }
  for (let i = 0; i < typed.length; i++) {
    const entry = typed[i]
    if (typeof entry !== 'string' || !/^[^\s\u0000-\u001f\u007f]*$/.test(entry)) return 'Invalid typed text'
    if (i < words.length && entry.length > words[i].length + MAX_EXTRA) return 'Invalid typed text'
  }
  if (mode.kind === 'words') {
    if (words.length !== mode.value) return 'Invalid test words'
    if (typed.length < mode.value || (typed.length === mode.value && typed[mode.value - 1] !== words[mode.value - 1])) return 'Test was not completed'
  }
  return null
}

function inspectTimings(ts) {
  for (let i = 0; i < ts.length; i++) {
    if (!Number.isInteger(ts[i]) || ts[i] < 0 || (i > 0 && ts[i] < ts[i - 1])) return 'Invalid keystroke log'
  }
  const intervals = []
  for (let i = 1; i < ts.length; i++) intervals.push(ts[i] - ts[i - 1])
  const sorted = [...intervals].sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)]
  const fast = intervals.filter(delta => delta < 12).length / intervals.length
  if (median < 25 || fast > 0.05) return 'Input speed looks inhuman'
  if (intervals.length >= 60) {
    const mean = intervals.reduce((sum, value) => sum + value, 0) / intervals.length
    const std = Math.sqrt(intervals.reduce((sum, value) => sum + (value - mean) ** 2, 0) / intervals.length)
    if (std < 6) return 'Input timing looks automated'
  }
  let start = 0
  for (let i = 0; i < ts.length; i++) {
    while (ts[i] - ts[start] > 1000) start++
    if (i - start + 1 > 40) return 'Input speed looks inhuman'
  }
  return null
}

function analyze(words, typed) {
  const last = typed.length - 1
  let correctChars = 0
  let rawChars = 0
  let mismatches = 0
  for (let i = 0; i <= last; i++) {
    const entry = typed[i]
    const target = words[i] ?? ''
    rawChars += entry.length
    for (let j = 0; j < entry.length; j++) if (entry[j] !== target[j]) mismatches += 1
    if (i < last) {
      rawChars += 1
      if (entry === target) correctChars += target.length + 1
    } else if (entry.length > 0 && entry === target.slice(0, entry.length)) {
      correctChars += entry.length
    }
  }
  return { correctChars, rawChars, mismatches }
}

// Returns { error } or the server-verified { wpm, rawWpm, consistency, accuracy }.
export function validateSubmission(body, payload, now) {
  const mode = { kind: payload.k, value: payload.v }
  const { words, typed, ts } = body

  const age = now - payload.s
  if (!(age >= 0) || age > MAX_AGE_MS) return { error: 'Test session expired. Retake the test.' }
  if (!Array.isArray(ts) || ts.length < 20 || ts.length > 4000) return { error: 'Test too short to submit' }

  const wordsError = validateWords(words, typed, mode)
  if (wordsError) return { error: wordsError }
  const timingError = inspectTimings(ts)
  if (timingError) return { error: timingError }

  const lastTs = ts[ts.length - 1]
  let elapsedMs
  if (mode.kind === 'time') {
    elapsedMs = mode.value * 1000
    if (lastTs > elapsedMs + 500) return { error: 'Invalid keystroke log' }
  } else {
    elapsedMs = Number(body.elapsedMs)
    if (!Number.isFinite(elapsedMs) || elapsedMs < lastTs || elapsedMs > lastTs + 1500) return { error: 'Invalid keystroke log' }
  }
  if (age < elapsedMs - LATENCY_TOLERANCE_MS) return { error: 'Test finished too fast' }

  const { correctChars, rawChars, mismatches } = analyze(words, typed)
  if (rawChars > ts.length) return { error: 'Typed text does not match keystroke log' }

  const minutes = Math.max(elapsedMs, 1000) / 60000
  const wpm = Math.round(correctChars / 5 / minutes)
  const rawWpm = Math.round(rawChars / 5 / minutes)
  if (wpm > MAX_WPM) return { error: 'Score rejected' }
  if (Math.abs(wpm - body.wpm) > 3 || Math.abs(rawWpm - body.rawWpm) > 3) return { error: 'Score does not match typing log' }

  const maxAccuracy = Math.floor((ts.length - mismatches) / ts.length * 100) + 1
  if (body.accuracy > maxAccuracy) return { error: 'Score does not match typing log' }

  return {
    wpm,
    rawWpm,
    consistency: consistencyFromTimestamps(ts, elapsedMs, mode.kind),
    accuracy: Math.round(body.accuracy),
  }
}
