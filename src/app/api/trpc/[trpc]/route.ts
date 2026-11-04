import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from '@/server/router';
import { createContext } from '@/server/trpc';
import { hasSameOrigin } from '@/server/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handler(req: Request) {
  if (req.method === 'POST') {
    if (!hasSameOrigin(req)) return Response.json({ error: 'A same-origin request is required.' }, { status: 403 });
    if (new TextEncoder().encode(await req.clone().text()).byteLength > 12_000) {
      return Response.json({ error: 'Request exceeds the input size limit.' }, { status: 413 });
    }
  }
  const response = await fetchRequestHandler({
    endpoint: '/api/trpc', req, router: appRouter, allowBatching: false,
    createContext: () => createContext(req),
  });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export { handler as GET, handler as POST };
