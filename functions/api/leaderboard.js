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
    const listed = await env.LEADERBOARD_KV.list({ limit: 1000 })
    const entries = await Promise.all(listed.keys.map(key => env.LEADERBOARD_KV.get(key.name, { type: 'json' })))
    const results = entries
      .filter(entry => entry && typeof entry.name === 'string' && Number.isFinite(entry.wpm))
      .sort((a, b) => b.wpm - a.wpm || b.timestamp - a.timestamp)
      .slice(0, 100)

    return json(results)
  } catch {
    return json({ error: 'Failed to fetch leaderboard' }, 500)
  }
}

export async function onRequestPost({ request, env }) {
  if (!env.LEADERBOARD_KV) return json({ error: 'Leaderboard storage is not configured' }, 503)

  try {
    const body = await request.json()
    const rawName = typeof body?.name === 'string' ? body.name : ''
    const name = rawName.replace(/[\u0000-\u001f\u007f]/g, '').trim().replace(/\s+/g, ' ').slice(0, 20)
    const { wpm, accuracy, rawWpm, consistency } = body || {}

    if (!name ||
      !Number.isFinite(wpm) || wpm < 0 || wpm > 500 ||
      !Number.isFinite(accuracy) || accuracy < 0 || accuracy > 100 ||
      !Number.isFinite(rawWpm) || rawWpm < 0 || rawWpm > 1000 ||
      !Number.isFinite(consistency) || consistency < 0 || consistency > 100) {
      return json({ error: 'Please provide a valid name and score' }, 400)
    }

    const id = crypto.randomUUID()
    const entry = {
      id,
      name,
      wpm: Math.round(wpm),
      accuracy: Math.round(accuracy),
      rawWpm: Math.round(rawWpm),
      consistency: Math.round(consistency),
      timestamp: Date.now(),
    }

    await env.LEADERBOARD_KV.put(id, JSON.stringify(entry))

    const listed = await env.LEADERBOARD_KV.list({ limit: 1000 })
    if (listed.keys.length > 1000) {
      const all = await Promise.all(listed.keys.map(key => env.LEADERBOARD_KV.get(key.name, { type: 'json' })))
      const ordered = all.filter(Boolean).sort((a, b) => b.wpm - a.wpm)
      await Promise.all(ordered.slice(1000).map(item => env.LEADERBOARD_KV.delete(item.id)))
    }

    return json({ success: true, entry }, 201)
  } catch {
    return json({ error: 'Failed to submit score' }, 500)
  }
}
