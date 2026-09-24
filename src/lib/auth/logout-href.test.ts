import { describe, expect, it } from 'vitest';
import { buildLogoutHref } from './logout-href';

describe('buildLogoutHref', () => {
  it('returns the SDK-managed /auth/logout route with no query string', () => {
    expect(buildLogoutHref()).toBe('/auth/logout');
  });

  it('never includes a returnTo parameter (relative or otherwise)', () => {
    const href = buildLogoutHref();

    expect(href).not.toContain('returnTo');
    expect(href).not.toContain('%2F');
  });
});
