import type { Engage } from '@sitecore/engage';
import { SUPPORTED_LOCALES } from 'lib/locale-resolver';
import { PersonalizeConfig } from 'lib/personalize-config';

type PersonalizeClient = Pick<Engage, 'pageView'>;

export interface RouteEvents {
  on(event: 'routeChangeComplete', handler: (url: string) => void): void;
  off(event: 'routeChangeComplete', handler: (url: string) => void): void;
}

export interface PersonalizePage {
  path: string;
  eligible: boolean;
}

export function getPersonalizePage(route: string): PersonalizePage {
  let url: URL;
  try {
    url = new URL(route, 'http://personalize.invalid');
  } catch {
    return { path: '/', eligible: false };
  }

  let path = url.pathname || '/';
  const segments = path.split('/');
  if (SUPPORTED_LOCALES.includes(segments[1])) {
    path = `/${segments.slice(2).join('/')}`;
    if (path === '/') path = '/';
  }

  const lowerPath = path.toLowerCase();
  const excludedPrefixes = [
    '/_next',
    '/api',
    '/auth',
    '/member',
    '/sitecore',
    '/-',
    '/healthz',
    '/403',
    '/404',
    '/_error',
  ];
  const technicalPath =
    excludedPrefixes.some((prefix) => lowerPath === prefix || lowerPath.startsWith(`${prefix}/`)) ||
    /^\/(?:favicon\.ico|robots\.txt|sitemap\.xml)$/.test(lowerPath) ||
    /\.(?:css|js|mjs|map|png|jpe?g|gif|svg|ico|woff2?|ttf|xml)$/i.test(lowerPath);
  const editingQuery = ['sc_itemid', 'sc_version', 'sc_lang', 'sc_site', 'sc_database'].some(
    (key) => url.searchParams.has(key)
  );
  const editingMode = ['edit', 'preview', 'chromeshell'].includes(
    (url.searchParams.get('sc_mode') || '').toLowerCase()
  );

  return { path, eligible: !technicalPath && !editingQuery && !editingMode };
}

export function triggerWebExperiences(): void {
  if (typeof window !== 'undefined' && typeof window.Engage?.triggerExperiences === 'function') {
    try {
      window.Engage.triggerExperiences();
    } catch {
      // Web Experience failures must not interrupt the default Sitecore render.
    }
  }
}

export async function initializeEngage(config: PersonalizeConfig): Promise<Engage> {
  if (typeof window === 'undefined') {
    throw new Error('Engage initialization is browser-only.');
  }

  if (!engageClientPromise) {
    engageClientPromise = import('@sitecore/engage')
      .then(({ init }) =>
        init({
          clientKey: config.clientKey,
          targetURL: config.targetUrl,
          pointOfSale: config.pointOfSale,
          cookieDomain: config.cookieDomain,
          forceServerCookieMode: false,
          includeUTMParameters: false,
          webPersonalization: true,
        })
      )
      .catch((error: unknown) => {
        engageClientPromise = undefined;
        throw error;
      });
  }

  return engageClientPromise;
}

let engageClientPromise: Promise<Engage> | undefined;

interface PersonalizeControllerOptions {
  config: PersonalizeConfig;
  router: RouteEvents;
  consentCheck: () => boolean;
  initialize?: (config: PersonalizeConfig) => Promise<PersonalizeClient>;
  getLanguage: () => string;
  getCurrentPath: () => string;
  subscribeConsent?: (listener: () => void) => () => void;
  trigger?: () => void;
  isBrowser?: () => boolean;
  warn?: (diagnostic: string) => void;
}

export function createPersonalizeController(options: PersonalizeControllerOptions): {
  start: (initialPath: string) => () => void;
  flush: () => Promise<void>;
} {
  let disposed = false;
  let client: PersonalizeClient | undefined;
  let initialization: Promise<PersonalizeClient> | undefined;
  let lastObservedPath: string | undefined;
  let queue: Promise<void> = Promise.resolve();

  const isBrowser = options.isBrowser ?? (() => typeof window !== 'undefined');
  const trigger = options.trigger ?? triggerWebExperiences;
  const initialize = options.initialize ?? initializeEngage;
  const warn = options.warn ?? safeDevelopmentWarning;

  const observeRoute = (route: string): void => {
    if (disposed || !isBrowser()) return;

    const page = getPersonalizePage(route);
    if (!options.consentCheck()) return;
    if (page.path === lastObservedPath) return;
    lastObservedPath = page.path;
    if (!page.eligible) return;

    queue = queue.then(async () => {
      if (disposed || !options.consentCheck()) return;

      const isInitialEngagePage = !client;
      try {
        initialization ??= initialize(options.config).catch((error: unknown) => {
          initialization = undefined;
          throw error;
        });
        client ??= await initialization;
        if (disposed || !options.consentCheck()) return;

        await client.pageView({
          channel: options.config.channel,
          currency: options.config.currency,
          pointOfSale: options.config.pointOfSale,
          language: options.getLanguage(),
          page: page.path,
        });

        if (!isInitialEngagePage && !disposed && options.consentCheck()) trigger();
      } catch {
        warn(client ? 'personalize_page_view_failed' : 'personalize_initialization_failed');
      }
    });
  };

  const onRouteChangeComplete = (url: string): void => observeRoute(url);

  const start = (initialPath: string): (() => void) => {
    if (!isBrowser()) return () => undefined;

    options.router.on('routeChangeComplete', onRouteChangeComplete);

    const unsubscribeConsent = options.subscribeConsent?.(() => {
      if (!options.consentCheck()) return;
      lastObservedPath = undefined;
      observeRoute(options.getCurrentPath());
    });

    observeRoute(initialPath);

    return () => {
      disposed = true;
      options.router.off('routeChangeComplete', onRouteChangeComplete);
      unsubscribeConsent?.();
    };
  };

  return { start, flush: () => queue };
}

function safeDevelopmentWarning(diagnostic: string): void {
  if (process.env.NODE_ENV === 'development') console.warn(diagnostic);
}
