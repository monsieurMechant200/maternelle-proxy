// process.env est disponible dans l'Edge Runtime Vercel mais absent des types DOM/ESNext
declare const process: { env: Record<string, string | undefined> }

export const config = {
  // Ne match QUE les requêtes vers /api/* — tout le reste (front statique) passe normalement.
  matcher: ['/api/:path*'],
}

export default async function middleware(request: Request) {
  const url = new URL(request.url)

  const renderApiUrl = (process.env.RENDER_API_URL ?? '').replace(/\/$/, '')

  if (!renderApiUrl) {
    return new Response(
      JSON.stringify({ error: 'Backend non configuré (RENDER_API_URL manquant).' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Le backend FastAPI déclare ses routes AVEC le préfixe /api
  // (ex: @app.get("/api/admin/stats")) donc on NE retire PAS /api ici.
  const targetUrl = renderApiUrl + url.pathname + url.search

  const forwardHeaders = new Headers()
  for (const h of ['content-type', 'authorization', 'accept', 'x-admin-key']) {
    const val = request.headers.get(h)
    if (val) forwardHeaders.set(h, val)
  }

  const isBodyless = ['GET', 'HEAD', 'OPTIONS'].includes(request.method.toUpperCase())

  try {
    const res = await fetch(targetUrl, {
      method: request.method,
      headers: forwardHeaders,
      body: isBodyless ? undefined : request.body,
      // @ts-ignore - duplex requis pour les corps en streaming dans Edge Runtime
      duplex: 'half',
    })

    const headers = new Headers(res.headers)
    headers.set('Access-Control-Allow-Origin', '*')
    // Debug temporaire : confirme quelle URL a été appelée côté Render.
    headers.set('X-Proxy-Target', targetUrl)

    return new Response(res.body, { status: res.status, headers })
  } catch {
    return new Response(
      JSON.stringify({ error: 'Backend inaccessible.' }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
