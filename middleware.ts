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
    signal: AbortSignal.timeout(30_000),
  }
  if (!isBodyless) {
    fetchOptions.duplex = 'half'
  }

  try {
    const backendRes = await fetch(targetUrl, fetchOptions)

    const buffer = await backendRes.arrayBuffer()
    const contentType = backendRes.headers.get('content-type') || 'application/octet-stream'

    let finalStatus = backendRes.status
    let bodyText = new TextDecoder().decode(buffer)

    if (finalStatus >= 200 && finalStatus < 300 && contentType.includes('application/json')) {
      try {
        const parsed = JSON.parse(bodyText)
        if (parsed && typeof parsed.code === 'number' && parsed.code >= 400 && parsed.code < 600) {
          finalStatus = parsed.code
          bodyText = JSON.stringify({
            error: parsed.detail || parsed.error || 'Erreur',
            code: finalStatus,
          })
        }
      } catch (_) {
      }
    }


    const responseHeaders = new Headers()
    responseHeaders.set('content-type', 'application/json; charset=utf-8')
    responseHeaders.set('Access-Control-Allow-Origin', '*')
    responseHeaders.set('X-Proxy-Target', targetUrl)
    const cacheControl = backendRes.headers.get('cache-control')
    if (cacheControl) responseHeaders.set('cache-control', cacheControl)

    return new Response(bodyText, {
      status: finalStatus,
      statusText: finalStatus !== backendRes.status ? 'Error' : backendRes.statusText,
      headers: responseHeaders,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Erreur proxy middleware:', message)
    return new Response(
      JSON.stringify({
        error: 'Backend inaccessible.',
        debug: message,
        target: targetUrl,
      }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
