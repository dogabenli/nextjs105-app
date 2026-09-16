import type { NextRequest } from 'next/server';
import middleware from 'lib/middleware';

export default async function proxy(req: NextRequest) {
  return middleware(req);
}

export const config = {
  /*
   * Match all paths except for:
   * 1. /api routes
   * 2. /_next (Next.js internals) - except /_next/data/* which needs the same locale
   *    rewrite as the page itself, so client-side SSG/ISR navigations fetch the right locale.
   * 3. /sitecore/api (Sitecore API routes)
   * 4. /- (Sitecore media)
   * 5. /healthz (Health check)
   * 6. all root files inside /public
   */
  matcher: [
    '/',
    '/((?!api/|_next/|healthz|sitecore/api/|-/|favicon.ico|sc_logo.svg).*)',
    '/_next/data/:path*',
  ],
};
