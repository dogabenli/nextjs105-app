import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { MiddlewarePlugin } from '..';
import { resolveLocaleFromHost, SUPPORTED_LOCALES } from 'lib/locale-resolver';

/**
 * Rewrites every request to prefix the pathname with the locale resolved from the
 * subdomain (e.g. 'da.nextjs105.local/about' -> internally '/da/about'), so pages under
 * `pages/[locale]/[[...path]].tsx` can use SSG/ISR while the public URL stays locale-free.
 * See docs/poc/domain-based-i18n-ssg-isr.md.
 */
class LocaleRewritePlugin implements MiddlewarePlugin {
  order = 0;

  async exec(req: NextRequest): Promise<NextResponse> {
    const { pathname } = req.nextUrl;
    const firstSegment = pathname.split('/')[1];

    // Already locale-prefixed (e.g. a direct request for /da/... or a re-entrant rewrite) - skip.
    if (SUPPORTED_LOCALES.includes(firstSegment)) {
      return NextResponse.next();
    }

    const locale = resolveLocaleFromHost(req.headers.get('host') ?? undefined);
    const url = req.nextUrl.clone();
    url.pathname = `/${locale}${pathname}`;

    return NextResponse.rewrite(url);
  }
}

export const localeRewritePlugin = new LocaleRewritePlugin();
