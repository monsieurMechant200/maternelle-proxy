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

  const fetchOptions: RequestInit & { duplex?: 'half' } = {
    method: request.method,
    headers: forwardHeaders,
    body: isBodyless ? undefined : request.body,
  }
  // duplex ne doit être précisé QUE quand un body en flux est réellement transmis,
  // sinon certains runtimes (dont l'Edge Runtime Vercel) lèvent une erreur.
  if (!isBodyless) {
    fetchOptions.duplex = 'half'
  }

  try {
    const res = await fetch(targetUrl, fetchOptions)

    const headers = new Headers(res.headers)
    headers.set('Access-Control-Allow-Origin', '*')
    // Debug temporaire : confirme quelle URL a été appelée côté Render.
    headers.set('X-Proxy-Target', targetUrl)

    return new Response(res.body, { status: res.status, headers })
  } catch (err) {
    // Debug temporaire : on expose le vrai message d'erreur pour diagnostiquer.
    // À retirer (remettre un message générique) une fois le problème identifié.
    const message = err instanceof Error ? err.message : String(err)
    console.error('Erreur proxy middleware:', message)
    return new Response(
      JSON.stringify({ error: 'Backend inaccessible.', debug: message, target: targetUrl }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
