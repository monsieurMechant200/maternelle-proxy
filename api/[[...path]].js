// api/[[...path]].js
export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api/, '') || '/';
  const backendUrl = (process.env.RENDER_API_URL || '').replace(/\/$/, '');

  if (!backendUrl) {
    return new Response(JSON.stringify({ error: 'Backend non configuré (RENDER_API_URL manquant).' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const targetUrl = backendUrl + path + url.search;

  // Transférer les headers utiles
  const forwardHeaders = new Headers();
  for (const h of ['content-type', 'authorization', 'accept', 'x-admin-key']) {
    const val = request.headers.get(h);
    if (val) forwardHeaders.set(h, val);
  }

  const isBodyless = ['GET', 'HEAD', 'OPTIONS'].includes(request.method.toUpperCase());

  try {
    const res = await fetch(targetUrl, {
      method: request.method,
      headers: forwardHeaders,
      body: isBodyless ? undefined : request.body,
      duplex: 'half',
    });

    // Réponse du backend renvoyée telle quelle, avec CORS si nécessaire
    const headers = new Headers(res.headers);
    headers.set('Access-Control-Allow-Origin', '*');
    // Si c'est un export CSV, ajouter le header Content-Disposition
    return new Response(res.body, { status: res.status, headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Backend inaccessible.' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}