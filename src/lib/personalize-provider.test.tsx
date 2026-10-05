import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RouterContext } from 'next/dist/shared/lib/router-context.shared-runtime';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ContentBlock from 'components/ContentBlock';
import { readPersonalizeConfig } from 'lib/personalize-config';
import { resolveLocaleFromHost } from 'lib/locale-resolver';
import {
  createPersonalizeController,
  getPersonalizePage,
  initializeEngage,
  triggerWebExperiences,
} from 'lib/personalize-runtime';

const { engageInitMock } = vi.hoisted(() => ({ engageInitMock: vi.fn() }));
vi.mock('@sitecore/engage', () => ({ init: engageInitMock }));

const validEnvironment = {
  NEXT_PUBLIC_PERSONALIZE_ENABLED: 'true',
  NEXT_PUBLIC_PERSONALIZE_CLIENT_KEY: 'public-test-key',
  NEXT_PUBLIC_PERSONALIZE_TARGET_URL: 'https://api-engage-eu.sitecorecloud.io',
  NEXT_PUBLIC_PERSONALIZE_POINT_OF_SALE: 'jss-poc-web',
  NEXT_PUBLIC_PERSONALIZE_COOKIE_DOMAIN: 'nextjs105.local',
  NEXT_PUBLIC_PERSONALIZE_CHANNEL: 'WEB',
  NEXT_PUBLIC_PERSONALIZE_CURRENCY: 'EUR',
};

const config = readPersonalizeConfig(validEnvironment)!;

class FakeRouter {
  private listeners = new Set<(url: string) => void>();

  on(_event: 'routeChangeComplete', handler: (url: string) => void): void {
    this.listeners.add(handler);
  }

  off(_event: 'routeChangeComplete', handler: (url: string) => void): void {
    this.listeners.delete(handler);
  }

  complete(url: string): void {
    this.listeners.forEach((handler) => handler(url));
  }

  get listenerCount(): number {
    return this.listeners.size;
  }
}

function makeClient() {
  return { pageView: vi.fn().mockResolvedValue(null) };
}

function makeController(options: Partial<Parameters<typeof createPersonalizeController>[0]> = {}) {
  const router = new FakeRouter();
  const client = makeClient();
  const initialize = vi.fn().mockResolvedValue(client);
  const trigger = vi.fn();
  const controller = createPersonalizeController({
    config,
    router,
    consentCheck: () => true,
    initialize,
    getLanguage: () => resolveLocaleFromHost('en.nextjs105.local'),
    getCurrentPath: () => '/personalize-demo',
    trigger,
    isBrowser: () => true,
    ...options,
  });

  return { controller, router, client, initialize, trigger };
}

describe('Personalize configuration and route rules', () => {
  it('does not configure Engage when disabled or incomplete', () => {
    expect(
      readPersonalizeConfig({ ...validEnvironment, NEXT_PUBLIC_PERSONALIZE_ENABLED: 'false' })
    ).toBeNull();
    expect(
      readPersonalizeConfig({ ...validEnvironment, NEXT_PUBLIC_PERSONALIZE_CLIENT_KEY: '' })
    ).toBeNull();
    expect(
      readPersonalizeConfig({
        ...validEnvironment,
        NEXT_PUBLIC_PERSONALIZE_TARGET_URL: 'http://localhost',
      })
    ).toBeNull();
    expect(config).toEqual({
      clientKey: 'public-test-key',
      targetUrl: 'https://api-engage-eu.sitecorecloud.io',
      pointOfSale: 'jss-poc-web',
      cookieDomain: 'nextjs105.local',
      channel: 'WEB',
      currency: 'EUR',
    });
  });

  it('excludes technical, editing, and member routes while cleaning locale prefixes', () => {
    expect(getPersonalizePage('/da/personalize-demo?utm_source=test')).toEqual({
      path: '/personalize-demo',
      eligible: true,
    });
    for (const route of [
      '/_next/data/build/about.json',
      '/api/revalidate',
      '/auth/login',
      '/member',
      '/member/page-1',
      '/sitecore/service/preview',
      '/healthz',
      '/personalize-demo?sc_mode=edit',
      '/personalize-demo?sc_itemid={id}',
    ]) {
      expect(getPersonalizePage(route).eligible, route).toBe(false);
    }
  });
});

describe('Personalize provider controller', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('waits for consent, sends one initial VIEW, then triggers after an eligible navigation VIEW', async () => {
    let consentGranted = false;
    let consentListener = (): void => undefined;
    const { controller, router, client, initialize, trigger } = makeController({
      consentCheck: () => consentGranted,
      subscribeConsent: (listener) => {
        consentListener = listener;
        return () => {
          consentListener = (): void => undefined;
        };
      },
    });

    const cleanup = controller.start('/personalize-demo');
    await controller.flush();
    expect(initialize).not.toHaveBeenCalled();

    consentGranted = true;
    consentListener();
    await controller.flush();
    expect(initialize).toHaveBeenCalledOnce();
    expect(client.pageView).toHaveBeenCalledOnce();
    expect(client.pageView).toHaveBeenCalledWith({
      channel: 'WEB',
      currency: 'EUR',
      pointOfSale: 'jss-poc-web',
      language: 'en',
      page: '/personalize-demo',
    });
    expect(trigger).not.toHaveBeenCalled();

    router.complete('/about');
    router.complete('/about');
    await controller.flush();
    expect(client.pageView).toHaveBeenCalledTimes(2);
    expect(trigger).toHaveBeenCalledOnce();
    cleanup();
  });

  it('does not count initial load again when the router completes the same path', async () => {
    const { controller, router, client, trigger } = makeController();
    const cleanup = controller.start('/personalize-demo');
    router.complete('/personalize-demo');
    await controller.flush();

    expect(client.pageView).toHaveBeenCalledOnce();
    expect(trigger).not.toHaveBeenCalled();
    cleanup();
  });

  it('calls the hosted trigger after an eligible route and tolerates an absent hosted global', async () => {
    const hostedTrigger = vi.fn();
    vi.stubGlobal('window', {
      Engage: { triggerExperiences: hostedTrigger },
      location: { host: 'en.nextjs105.local', pathname: '/about', search: '' },
    });
    const { controller, router } = makeController({ trigger: undefined });
    const cleanup = controller.start('/about');
    await controller.flush();
    expect(hostedTrigger).not.toHaveBeenCalled();

    router.complete('/personalize-demo');
    await controller.flush();
    expect(hostedTrigger).toHaveBeenCalledOnce();

    vi.stubGlobal('window', {
      location: { host: 'en.nextjs105.local', pathname: '/about', search: '' },
    });
    expect(() => triggerWebExperiences()).not.toThrow();
    cleanup();
  });

  it('initializes the typed SDK client only once with browser cookies and web personalization', async () => {
    const client = makeClient();
    engageInitMock.mockResolvedValue(client);
    vi.stubGlobal('window', {});

    const [first, second] = await Promise.all([initializeEngage(config), initializeEngage(config)]);

    expect(first).toBe(client);
    expect(second).toBe(client);
    expect(engageInitMock).toHaveBeenCalledOnce();
    expect(engageInitMock).toHaveBeenCalledWith({
      clientKey: 'public-test-key',
      targetURL: 'https://api-engage-eu.sitecorecloud.io',
      pointOfSale: 'jss-poc-web',
      cookieDomain: 'nextjs105.local',
      forceServerCookieMode: false,
      includeUTMParameters: false,
      webPersonalization: true,
    });
  });

  it('does not trigger ineligible routes and removes the router listener on cleanup', async () => {
    const { controller, router, client, initialize, trigger } = makeController();
    const cleanup = controller.start('/member/page-1');
    await controller.flush();
    expect(initialize).not.toHaveBeenCalled();

    router.complete('/api/revalidate');
    router.complete('/sitecore/service/preview');
    router.complete('/member/page-1');
    await controller.flush();
    expect(client.pageView).not.toHaveBeenCalled();
    expect(trigger).not.toHaveBeenCalled();

    expect(router.listenerCount).toBe(1);
    cleanup();
    expect(router.listenerCount).toBe(0);
  });

  it('catches initialization failures without affecting default ContentBlock HTML', async () => {
    const failingInitialize = vi.fn().mockRejectedValue(new Error('private sdk error'));
    const { controller, client } = makeController({
      initialize: failingInitialize,
      warn: vi.fn(),
    });
    controller.start('/personalize-demo');
    await controller.flush();
    expect(failingInitialize).toHaveBeenCalledOnce();
    expect(client.pageView).not.toHaveBeenCalled();

    const markup = renderToStaticMarkup(
      React.createElement(
        RouterContext.Provider,
        { value: { asPath: '/', locale: 'en' } as never },
        React.createElement(ContentBlock, {
          rendering: { dataSource: 'content-block-datasource' },
          fields: {
            heading: { value: 'Default heading' },
            content: { value: '<p>Default content</p>' },
          },
        } as never)
      )
    );
    expect(markup).toContain('data-personalize-slot="content-block"');
    expect(markup).toContain('class="contentBlock"');
    expect(markup).toContain('class="contentTitle"');
    expect(markup).toContain('class="contentDescription"');
    expect(markup).toContain('Default heading');
    expect(markup).toContain('Default content');
  });

  it('contains rejected VIEW events and does not trigger an experience after failure', async () => {
    const client = makeClient();
    client.pageView.mockRejectedValue(new Error('private event error'));
    const warn = vi.fn();
    const { controller, router, trigger } = makeController({
      initialize: vi.fn().mockResolvedValue(client),
      warn,
    });
    const cleanup = controller.start('/personalize-demo');

    await expect(controller.flush()).resolves.toBeUndefined();
    router.complete('/about');
    await expect(controller.flush()).resolves.toBeUndefined();

    expect(client.pageView).toHaveBeenCalledTimes(2);
    expect(trigger).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith('personalize_page_view_failed');
    cleanup();
  });
});
