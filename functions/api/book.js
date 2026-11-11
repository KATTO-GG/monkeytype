// Serves public-domain book text from Project Gutenberg (no CORS in browsers, so we proxy and cache).
const BOOK_IDS = new Set([
  '1342', '158', '1260', '768', '11', '84', '345', '2701', '1661', '244', '1400', '98',
  '120', '43', '174', '74', '76', '16', '55', '35', '215', '5200', '132',
])
const MAX_CHARS = 3000000

const json = (data, status = 200, cache = 'no-store') => new Response(JSON.stringify(data), {
  status,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': cache,
    'X-Content-Type-Options': 'nosniff',
  },
})

export async function onRequestGet({ request }) {
  const id = new URL(request.url).searchParams.get('id') || ''
  if (!BOOK_IDS.has(id)) return json({ error: 'Unknown book' }, 404)

  try {
    const upstream = await fetch(`https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`, {
      headers: { 'User-Agent': 'ApeType/1.0 (https://type.spenc.vip)' },
      cf: { cacheTtl: 604800, cacheEverything: true },
    })
    if (!upstream.ok) return json({ error: 'Could not load book' }, 502)

    let text = (await upstream.text()).replace(/\r/g, '')
    const start = text.match(/\*\*\* ?START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^\n]*\n/i)
    if (start) text = text.slice(start.index + start[0].length)
    const end = text.search(/\*\*\* ?END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK/i)
    if (end > 0) text = text.slice(0, end)

    return json({ id, text: text.trim().slice(0, MAX_CHARS) }, 200, 'public, max-age=86400')
  } catch {
    return json({ error: 'Could not load book' }, 502)
  }
}
