// middleware.ts
declare const process: { env: Record<string, string | undefined> }

export const config = {
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
    // Ajout d'un timeout pour éviter les blocages prolongés (cold start de Render)
    signal: AbortSignal.timeout(30_000),
  }
  if (!isBodyless) {
    fetchOptions.duplex = 'half'
  }

  try {
    const res = await fetch(targetUrl, fetchOptions)

    // Bufferiser la réponse au lieu de streamer res.body
    // → plus de crash 500 non capturé dans l'Edge Runtime
    const buffer = await res.arrayBuffer()

    const headers = new Headers()
    // Transmettre les en-têtes utiles de la réponse d'origine
    const contentType = res.headers.get('content-type')
    if (contentType) headers.set('content-type', contentType)
    const cacheControl = res.headers.get('cache-control')
    if (cacheControl) headers.set('cache-control', cacheControl)
    headers.set('Access-Control-Allow-Origin', '*')
    // Debug temporaire (peut être retiré une fois stable)
    headers.set('X-Proxy-Target', targetUrl)

    return new Response(buffer, {
      status: res.status,
      statusText: res.statusText,
      headers,
    })
  } catch (err) {
    // Toute erreur (fetch, timeout, bufferisation) est capturée proprement
    const message = err instanceof Error ? err.message : String(err)
    console.error('Erreur proxy middleware:', message)
    return new Response(
      JSON.stringify({
        error: 'Backend inaccessible.',
        debug: message,
        target: targetUrl,
      }),
      {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}
