import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getSessionMock = vi.fn();
const getAccessTokenMock = vi.fn();

vi.mock('lib/auth0', () => ({
  auth0: {
    getSession: (...args: unknown[]) => getSessionMock(...args),
    getAccessToken: (...args: unknown[]) => getAccessTokenMock(...args),
  },
}));

import handler from '../../pages/api/auth-debug';

function createRes() {
  const res: {
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
    end: ReturnType<typeof vi.fn>;
  } = {
    status: vi.fn(),
    json: vi.fn(),
    end: vi.fn(),
  };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  res.end.mockReturnValue(res);
  return res;
}

describe('auth-debug endpoint', () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    getAccessTokenMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns 404 when NODE_ENV is not development', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const res = createRes();

    await handler({} as never, res as never);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(getSessionMock).not.toHaveBeenCalled();
  });

  it('returns 401 when there is no authenticated session', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    getSessionMock.mockResolvedValue(null);
    const res = createRes();

    await handler({} as never, res as never);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'not_authenticated' });
  });

  it('returns sanitized claims for an authenticated session', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    getSessionMock.mockResolvedValue({ user: { sub: 'auth0|123' } });

    const header = Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url');
    const body = Buffer.from(
      JSON.stringify({
        iss: 'https://tenant.eu.auth0.com/',
        aud: ['https://sitecore-member-poc-api'],
        sub: 'auth0|123',
        exp: 1234567890,
        'https://sitecore-member-poc.example/roles': ['member-basic'],
      })
    ).toString('base64url');
    getAccessTokenMock.mockResolvedValue({ token: `${header}.${body}.sig` });

    const res = createRes();
    await handler({} as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      issuer: 'https://tenant.eu.auth0.com/',
      audience: ['https://sitecore-member-poc-api'],
      hasSubject: true,
      expiresAt: 1234567890,
      roles: ['member-basic'],
    });
  });
});
