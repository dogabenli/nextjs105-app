import { afterEach, describe, expect, it, vi } from 'vitest';
import { LayoutServiceFactory } from './layout-service-factory';

const layoutResponse = {
  sitecore: {
    context: { pageEditing: false, language: 'en' },
    route: null,
  },
};

function mockFetch() {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Headers(),
    json: async () => layoutResponse,
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('LayoutServiceFactory', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('forwards only the request-scoped bearer token and preserves REST parameters', async () => {
    const fetchMock = mockFetch();
    const service = new LayoutServiceFactory().create('nextjs105-app', {
      accessToken: 'test-access-token',
    });

    await service.fetchLayoutData('/member/page-1', 'en');

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, requestInit] = fetchMock.mock.calls[0];
    expect(url).toContain('/sitecore/api/layout/render/jss');
    expect(url).toContain('item=%2Fmember%2Fpage-1');
    expect(url).toContain('sc_apikey=%7B5C3484F7-FED6-4FEE-A955-B2C651D947F1%7D');
    expect(url).toContain('sc_site=nextjs105-app');
    expect(url).toContain('sc_lang=en');
    expect(requestInit.headers.get('authorization')).toBe('Bearer test-access-token');
    expect(requestInit.headers.get('cookie')).toBeNull();
  });

  it('does not add authorization to the ordinary public REST service', async () => {
    const fetchMock = mockFetch();
    const service = new LayoutServiceFactory().create('nextjs105-app');

    await service.fetchLayoutData('/public-page', 'en');

    expect(fetchMock.mock.calls[0][1]?.headers.get('authorization')).toBeNull();
  });

  it('keeps concurrent authenticated services isolated', async () => {
    const fetchMock = mockFetch();
    const firstService = new LayoutServiceFactory().create('nextjs105-app', {
      accessToken: 'first-token',
    });
    const secondService = new LayoutServiceFactory().create('nextjs105-app', {
      accessToken: 'second-token',
    });

    await Promise.all([
      firstService.fetchLayoutData('/member/page-1', 'en'),
      secondService.fetchLayoutData('/member/page-2', 'en'),
    ]);

    expect(fetchMock.mock.calls.map(([url, init]) => [url, init.headers.get('authorization')])).toEqual([
      [expect.stringContaining('page-1'), 'Bearer first-token'],
      [expect.stringContaining('page-2'), 'Bearer second-token'],
    ]);
  });
});
