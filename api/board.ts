// Vercel Function — proxy in front of the Google Apps Script Web App.
//
// Why: Apps Script takes ~5s per call (30s+ on a cold start). Putting the
// read behind Vercel's CDN with stale-while-revalidate means every visitor —
// first-timers and incognito included — gets the board in ~100ms, while the
// slow Apps Script call happens in the background at most once a minute.
// It also keeps GAS_TOKEN on the server instead of in the browser bundle.
//
//   GET  /api/board            → board, cached on Vercel's CDN (60s, SWR 1 day)
//   GET  /api/board?fresh=1    → bypass cache (client uses this right after a write)
//   POST /api/board {action…}  → forwarded to Apps Script with the token added
//
// Env (Vercel → Settings → Environment Variables, NOT prefixed with VITE_):
//   GAS_URL    Apps Script Web App URL ending in /exec
//   GAS_TOKEN  same value as the script property API_TOKEN

export const config = { maxDuration: 60 };

/**
 * `cdn` goes in Vercel-CDN-Cache-Control, which only Vercel's edge reads. The
 * browser always gets `no-store`: if it honoured stale-while-revalidate itself
 * it would hand the app a day-old copy and refresh only its own HTTP cache.
 */
const json = (body: unknown, status = 200, cdn?: string) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...(cdn ? { 'Vercel-CDN-Cache-Control': cdn } : {}),
    },
  });

function env() {
  const url = process.env.GAS_URL;
  const token = process.env.GAS_TOKEN ?? '';
  if (!url) throw new Error('GAS_URL is not set on Vercel');
  return { url, token };
}

export async function GET(request: Request) {
  try {
    const { url, token } = env();
    const fresh = new URL(request.url).searchParams.has('fresh');
    const u = new URL(url);
    u.searchParams.set('action', 'list');
    if (token) u.searchParams.set('token', token);
    const res = await fetch(u, { redirect: 'follow' });
    const data = await res.json();
    if (!data.ok) return json(data, 502);
    // The CDN keeps it 60s, then serves the stale copy while refetching in the
    // background for up to a day. `?fresh=1` is a different cache key and is
    // never stored, so it always reaches Apps Script.
    return json(data, 200, fresh ? undefined : 'max-age=60, stale-while-revalidate=86400');
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
}

const ACTIONS = new Set(['upsert', 'delete', 'batch']);

export async function POST(request: Request) {
  try {
    const { url, token } = env();
    const body = await request.json();
    if (!body || !ACTIONS.has(body.action)) return json({ ok: false, error: 'Unknown action' }, 400);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...body, token }),
      redirect: 'follow',
    });
    const data = await res.json();
    return json(data, data.ok ? 200 : 502);
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
}
