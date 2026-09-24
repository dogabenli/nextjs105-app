const ROLES_CLAIM = 'https://sitecore-member-poc.example/roles';

export interface SanitizedAccessTokenInfo {
  issuer: string;
  audience: string[];
  hasSubject: boolean;
  expiresAt: number | null;
  roles: string[];
}

/**
 * `aud` may be a single string or an array per the JWT spec - always normalize to an array.
 */
export function normalizeAudience(aud: unknown): string[] {
  if (Array.isArray(aud)) {
    return aud.filter((value): value is string => typeof value === 'string');
  }
  if (typeof aud === 'string') {
    return [aud];
  }
  return [];
}

function decodeJwtPayload(accessToken: string): Record<string, unknown> {
  const parts = accessToken.split('.');
  if (parts.length !== 3) {
    throw new Error('Malformed access token');
  }
  const json = Buffer.from(parts[1], 'base64url').toString('utf8');
  return JSON.parse(json);
}

/**
 * Decodes only enough of the access token's payload to return a sanitized claim summary
 * for local development inspection.
 *
 * IMPORTANT: this performs no signature, issuer, audience, or expiry verification and must
 * never be treated as proof of authorization. The future Sitecore .NET backend will
 * independently validate signature, issuer, audience, and expiry before trusting any claim.
 */
export function decodeAccessTokenClaims(accessToken: string): SanitizedAccessTokenInfo {
  const payload = decodeJwtPayload(accessToken);
  const rolesClaim = payload[ROLES_CLAIM];

  return {
    issuer: typeof payload.iss === 'string' ? payload.iss : '',
    audience: normalizeAudience(payload.aud),
    hasSubject: typeof payload.sub === 'string' && payload.sub.length > 0,
    expiresAt: typeof payload.exp === 'number' ? payload.exp : null,
    roles: Array.isArray(rolesClaim)
      ? rolesClaim.filter((value): value is string => typeof value === 'string')
      : [],
  };
}
