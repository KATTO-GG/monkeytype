import { createToken, validMode } from '../_lib/anticheat.js'

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  },
})

// Issues a signed, stateless test session token when a test starts.
export async function onRequestPost({ request, env }) {
  if (!env.LEADERBOARD_KV) return json({ error: 'Storage is not configured' }, 503)

  try {
    const origin = request.headers.get('Origin')
    if (origin && new URL(origin).host !== new URL(request.url).host) return json({ error: 'Forbidden' }, 403)

    const mode = await request.json().catch(() => null)
    if (!validMode(mode)) return json({ error: 'Invalid mode' }, 400)

    return json({ token: await createToken(env, mode.kind, mode.value) })
  } catch {
    return json({ error: 'Could not start session' }, 500)
  }
}
