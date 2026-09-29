import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GetServerSidePropsContext } from 'next';

const getSessionMock = vi.fn();
const getAccessTokenMock = vi.fn();
const createMock = vi.fn();

vi.mock('lib/auth0', () => ({
  auth0: {
    getSession: (...args: unknown[]) => getSessionMock(...args),
    getAccessToken: (...args: unknown[]) => getAccessTokenMock(...args),
  },
}));

vi.mock('lib/page-props-factory', () => ({
  sitecorePagePropsFactory: {
    create: (...args: unknown[]) => createMock(...args),
  },
}));

vi.mock('src/components/SitecorePage', () => ({ default: () => null }));

import { getServerSideProps } from '../pages/[locale]/member/[[...path]]';

function createContext(path?: string[]) {
  const response = {
    setHeader: vi.fn(),
    statusCode: 200,
  };
  return {
    req: { headers: {} },
    res: response,
    params: { locale: 'en', path },
  } as unknown as GetServerSidePropsContext;
}

describe('member page SSR authentication', () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    getAccessTokenMock.mockReset();
    createMock.mockReset();
    createMock.mockResolvedValue({
      site: { name: 'nextjs105-app' },
      layoutData: { sitecore: { route: { itemId: '1' } } },
      dictionary: {},
      componentProps: {},
      notFound: false,
      locale: 'en',
      headLinks: [],
    });
  });

  it('redirects an unauthenticated request without retrieving a token', async () => {
    getSessionMock.mockResolvedValue(null);
    const context = createContext(['page-1']);

    const result = await getServerSideProps(context);

    expect(result).toEqual({
      redirect: { destination: '/auth/login?returnTo=%2Fmember%2Fpage-1', permanent: false },
    });
    expect(getAccessTokenMock).not.toHaveBeenCalled();
    expect(createMock).not.toHaveBeenCalled();
  });

  it('retrieves the access token with the current request and response', async () => {
    getSessionMock.mockResolvedValue({ user: { sub: 'auth0|user' } });
    getAccessTokenMock.mockResolvedValue({ token: 'test-access-token' });
    const context = createContext(['page-1']);

    const result = await getServerSideProps(context);

    expect(getAccessTokenMock).toHaveBeenCalledWith(context.req, context.res);
    expect(createMock.mock.calls[0][1]).toEqual({
      layoutServiceOptions: { accessToken: 'test-access-token' },
    });
    expect(JSON.stringify(result)).not.toContain('test-access-token');
  });

  it('fails closed when the session has no usable access token', async () => {
    getSessionMock.mockResolvedValue({ user: { sub: 'auth0|user' } });
    getAccessTokenMock.mockResolvedValue({ token: '' });
    const context = createContext();

    const result = await getServerSideProps(context);

    expect(result).toEqual({ notFound: true });
    expect(createMock).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain('test-access-token');
  });

  it('uses the controlled forbidden page for a Sitecore 403', async () => {
    getSessionMock.mockResolvedValue({ user: { sub: 'auth0|user' } });
    getAccessTokenMock.mockResolvedValue({ token: 'test-access-token' });
    createMock.mockRejectedValue({ response: { status: 403 } });

    const result = await getServerSideProps(createContext(['page-3']));

    expect(result).toEqual({ redirect: { destination: '/403', permanent: false } });
  });

  it('fails closed without retrying anonymously after a Sitecore 401', async () => {
    getSessionMock.mockResolvedValue({ user: { sub: 'auth0|user' } });
    getAccessTokenMock.mockResolvedValue({ token: 'test-access-token' });
    createMock.mockRejectedValue({ response: { status: 401 } });

    const result = await getServerSideProps(createContext(['page-1']));

    expect(result).toEqual({ notFound: true });
    expect(createMock).toHaveBeenCalledOnce();
  });
});
