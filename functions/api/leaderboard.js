export async function onRequestGet({ env }) {
  try {
    const entries = await env.LEADERBOARD_KV.list({ limit: 1000 })
    const results = []

    for (const key of entries.keys) {
      const entry = await env.LEADERBOARD_KV.get(key.name, { type: 'json' })
      if (entry) {
        results.push(entry)
      }
    }

    results.sort((a, b) => b.wpm - a.wpm)

    return new Response(JSON.stringify(results.slice(0, 100)), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=30' }
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Failed to fetch leaderboard' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json()
    const { name, wpm, accuracy, rawWpm, consistency } = body

    if (!name || typeof wpm !== 'number' || typeof accuracy !== 'number') {
      return new Response(JSON.stringify({ error: 'Invalid submission' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const cleanName = name.trim().slice(0, 20)
    if (!cleanName) {
      return new Response(JSON.stringify({ error: 'Name required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const id = crypto.randomUUID()
    const entry = {
      id,
      name: cleanName,
      wpm: Math.round(wpm),
      accuracy: Math.round(accuracy),
      rawWpm: Math.round(rawWpm || 0),
      consistency: Math.round(consistency || 0),
      timestamp: Date.now()
    }

    await env.LEADERBOARD_KV.put(id, JSON.stringify(entry))

    const entries = await env.LEADERBOARD_KV.list({ limit: 1000 })
    const allEntries = []
    for (const key of entries.keys) {
      const e = await env.LEADERBOARD_KV.get(key.name, { type: 'json' })
      if (e) allEntries.push(e)
    }
    allEntries.sort((a, b) => b.wpm - a.wpm)

    if (allEntries.length > 1000) {
      const toDelete = allEntries.slice(1000)
      for (const e of toDelete) {
        await env.LEADERBOARD_KV.delete(e.id)
      }
    }

    return new Response(JSON.stringify({ success: true, entry }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Failed to submit score' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}