import config from 'temp/config';

/**
 * Locales routed via language subdomains (see docs/poc/domain-based-i18n.md).
 * Kept as an explicit list rather than Next.js i18n config - see docs for why.
 */
export const SUPPORTED_LOCALES = ['en', 'da'];

/**
 * Resolves the Sitecore language from a request host/hostname, e.g. 'da.nextjs105.local:3000' -> 'da'.
 * Falls back to the default language when the subdomain isn't a recognized locale.
 * @param {string} [host] request host header or window.location.host/hostname
 */
export function resolveLocaleFromHost(host: string | undefined): string {
  const subdomain = host?.split(':')[0].split('.')[0];

  return subdomain && SUPPORTED_LOCALES.includes(subdomain)
    ? subdomain
    : (config.defaultLanguage as string);
}

/**
 * Builds the absolute URL for the same path on another locale's subdomain, e.g.
 * ('da.nextjs105.local:3000', '/styleguide', 'en') -> '//en.nextjs105.local:3000/styleguide'
 * @param {string} host current request host (including port)
 * @param {string} path current path (e.g. router asPath)
 * @param {string} targetLocale locale to switch to
 */
export function buildLocaleSwitchHref(host: string, path: string, targetLocale: string): string {
  const [, ...domainParts] = host.split('.');
  const targetHost = [targetLocale, ...domainParts].join('.');

  return `//${targetHost}${path}`;
}
