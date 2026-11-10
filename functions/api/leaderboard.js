import { sha256Hex, validateSubmission, verifyToken } from '../_lib/anticheat.js'

const BOARD_KEY = 'board:v2'
const BOARD_SIZE = 100

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  },
})

export async function onRequestGet({ env }) {
  if (!env.LEADERBOARD_KV) return json({ error: 'Leaderboard storage is not configured' }, 503)

  try {
    const board = await env.LEADERBOARD_KV.get(BOARD_KEY, { type: 'json' })
    return json(Array.isArray(board) ? board : [])
  } catch {
    return json({ error: 'Failed to fetch leaderboard' }, 500)
  }
}

export async function onRequestPost({ request, env }) {
  if (!env.LEADERBOARD_KV) return json({ error: 'Leaderboard storage is not configured' }, 503)

  try {
    const origin = request.headers.get('Origin')
    if (origin && new URL(origin).host !== new URL(request.url).host) return json({ error: 'Forbidden' }, 403)
    if (Number(request.headers.get('Content-Length') || 0) > 100000) return json({ error: 'Payload too large' }, 413)

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') return json({ error: 'Invalid request' }, 400)

    const rawName = typeof body.name === 'string' ? body.name : ''
    const name = rawName.replace(/[\u0000-\u001f\u007f]/g, '').trim().replace(/\s+/g, ' ').slice(0, 20)
    const { wpm, accuracy, rawWpm } = body
    if (!name ||
      !Number.isFinite(wpm) || wpm <= 0 || wpm > 500 ||
      !Number.isFinite(accuracy) || accuracy < 0 || accuracy > 100 ||
      !Number.isFinite(rawWpm) || rawWpm < 0 || rawWpm > 1000) {
      return json({ error: 'Please provide a valid name and score' }, 400)
    }

    const kv = env.LEADERBOARD_KV
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown'
    const rateKey = `rl:${(await sha256Hex(ip)).slice(0, 32)}`
    if (await kv.get(rateKey)) return json({ error: 'Slow down. Wait a minute between submissions.' }, 429)

    const payload = await verifyToken(env, body.token)
    if (!payload) return json({ error: 'Invalid or missing test session. Retake the test.' }, 400)
    if (await kv.get(`used:${payload.n}`)) return json({ error: 'This score was already submitted' }, 400)

    const verified = validateSubmission(body, payload, Date.now())
    if (verified.error) return json({ error: verified.error }, 400)

    await kv.put(`used:${payload.n}`, '1', { expirationTtl: 1800 })
    await kv.put(rateKey, '1', { expirationTtl: 60 })

    const entry = {
      id: crypto.randomUUID(),
      name,
      wpm: verified.wpm,
      accuracy: verified.accuracy,
      rawWpm: verified.rawWpm,
      consistency: verified.consistency,
      timestamp: Date.now(),
    }

    const board = await kv.get(BOARD_KEY, { type: 'json' })
    const next = [...(Array.isArray(board) ? board : []), entry]
      .sort((a, b) => b.wpm - a.wpm || a.timestamp - b.timestamp)
      .slice(0, BOARD_SIZE)
    await kv.put(BOARD_KEY, JSON.stringify(next))

    return json({ success: true, entry }, 201)
  } catch {
    return json({ error: 'Failed to submit score' }, 500)
  }
}
