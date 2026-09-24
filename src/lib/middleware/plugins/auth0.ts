import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { MiddlewarePlugin } from '..';
import { auth0 } from 'lib/auth0';

/**
 * Mounts Auth0's /auth/login, /auth/callback, /auth/logout, /auth/profile routes and
 * refreshes the rolling session cookie on every request. Must run before any plugin that
 * rewrites the request path (e.g. locale-rewrite), so Auth0 sees the original /auth/* path.
 */
class Auth0Plugin implements MiddlewarePlugin {
  order = -100;

  async exec(req: NextRequest, res?: NextResponse): Promise<NextResponse> {
    const authRes = await auth0.middleware(req);

    if (req.nextUrl.pathname.startsWith('/auth')) {
      return authRes;
    }

    // Not an auth route - merge any rolling-session Set-Cookie headers onto the
    // response so far and let later plugins (e.g. locale-rewrite) continue the chain.
    const merged = res ?? NextResponse.next();
    authRes.headers.getSetCookie().forEach((cookie) => merged.headers.append('set-cookie', cookie));
    return merged;
  }
}

export const auth0Plugin = new Auth0Plugin();
