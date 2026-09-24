import { describe, expect, it } from 'vitest';
import { decodeAccessTokenClaims, normalizeAudience } from './decode-access-token';

const ROLES_CLAIM = 'https://sitecore-member-poc.example/roles';

function encodeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.signature`;
}

describe('normalizeAudience', () => {
  it('wraps a single string audience in an array', () => {
    expect(normalizeAudience('https://sitecore-member-poc-api')).toEqual([
      'https://sitecore-member-poc-api',
    ]);
  });

  it('keeps an array audience as-is', () => {
    expect(normalizeAudience(['a', 'b'])).toEqual(['a', 'b']);
  });

  it('returns an empty array for a missing or invalid audience', () => {
    expect(normalizeAudience(undefined)).toEqual([]);
    expect(normalizeAudience(42)).toEqual([]);
  });
});

describe('decodeAccessTokenClaims', () => {
  it('extracts roles only from the namespaced roles claim', () => {
    const token = encodeJwt({
      iss: 'https://tenant.eu.auth0.com/',
      aud: ['https://sitecore-member-poc-api'],
      sub: 'auth0|123',
      exp: 1234567890,
      [ROLES_CLAIM]: ['member-basic'],
      roles: ['should-be-ignored'],
    });

    const claims = decodeAccessTokenClaims(token);

    expect(claims.roles).toEqual(['member-basic']);
    expect(claims.audience).toEqual(['https://sitecore-member-poc-api']);
    expect(claims.hasSubject).toBe(true);
    expect(claims.expiresAt).toBe(1234567890);
    expect(claims.issuer).toBe('https://tenant.eu.auth0.com/');
  });

  it('returns an empty roles array when the claim is absent', () => {
    const token = encodeJwt({
      iss: 'https://tenant.eu.auth0.com/',
      aud: 'https://sitecore-member-poc-api',
      sub: 'auth0|1',
    });

    expect(decodeAccessTokenClaims(token).roles).toEqual([]);
  });

  it('normalizes a string audience to an array', () => {
    const token = encodeJwt({
      iss: 'https://tenant.eu.auth0.com/',
      aud: 'https://sitecore-member-poc-api',
      sub: 'auth0|1',
    });

    expect(decodeAccessTokenClaims(token).audience).toEqual(['https://sitecore-member-poc-api']);
  });

  it('reports hasSubject false when sub is missing', () => {
    const token = encodeJwt({ iss: 'https://tenant.eu.auth0.com/', aud: 'aud' });
    expect(decodeAccessTokenClaims(token).hasSubject).toBe(false);
  });
});
