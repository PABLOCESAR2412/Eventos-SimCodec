import type { APIRoute } from 'astro';
import { SESSION_COOKIE, sameOriginForm } from '../../lib/admin-auth';
export const POST: APIRoute = ({ cookies, request, url, redirect }) => {
  if (!sameOriginForm(request, url)) return new Response('Solicitud no válida.', { status: 403 });
  cookies.delete(SESSION_COOKIE, { path: '/admin', secure: url.protocol === 'https:', httpOnly: true, sameSite: 'strict' });
  return redirect('/admin/login', 303);
};
