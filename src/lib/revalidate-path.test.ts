import { describe, expect, it } from 'vitest';
import { canonicalizePublicRevalidatePath } from './revalidate-path';

describe('canonicalizePublicRevalidatePath', () => {
  it('canonicalizes an ordinary public path using the default locale', () => {
    expect(canonicalizePublicRevalidatePath('/about', undefined)).toEqual({
      ok: true,
      path: '/en/about',
    });
  });

  it('honors an explicit supported locale', () => {
    expect(canonicalizePublicRevalidatePath('/about', 'da')).toEqual({
      ok: true,
      path: '/da/about',
    });
  });

  it('canonicalizes the root path', () => {
    expect(canonicalizePublicRevalidatePath('/', 'en')).toEqual({ ok: true, path: '/en' });
  });

  it('normalizes a trailing slash', () => {
    expect(canonicalizePublicRevalidatePath('/about/', 'en')).toEqual({
      ok: true,
      path: '/en/about',
    });
  });

  it('keeps /membership eligible as a public path', () => {
    expect(canonicalizePublicRevalidatePath('/membership', 'en')).toEqual({
      ok: true,
      path: '/en/membership',
    });
  });

  it('rejects /member and descendants', () => {
    expect(canonicalizePublicRevalidatePath('/member', 'en').ok).toBe(false);
    expect(canonicalizePublicRevalidatePath('/member/page-1', 'en').ok).toBe(false);
  });

  it('rejects a locale-prefixed protected path embedded in path', () => {
    expect(canonicalizePublicRevalidatePath('/da/member', 'en').ok).toBe(false);
    expect(canonicalizePublicRevalidatePath('/da/member/page-1', 'en').ok).toBe(false);
  });

  it('rejects an encoded protected variant', () => {
    // "/member" fully percent-encoded
    expect(canonicalizePublicRevalidatePath('/%6d%65%6d%62%65%72', 'en').ok).toBe(false);
    expect(canonicalizePublicRevalidatePath('/da/%6d%65%6d%62%65%72', 'en').ok).toBe(false);
  });

  it('rejects non-string, missing, or array path values', () => {
    expect(canonicalizePublicRevalidatePath(undefined, 'en').ok).toBe(false);
    expect(canonicalizePublicRevalidatePath(null, 'en').ok).toBe(false);
    expect(canonicalizePublicRevalidatePath(42, 'en').ok).toBe(false);
    expect(canonicalizePublicRevalidatePath(['/about', '/member'], 'en').ok).toBe(false);
  });

  it('rejects an unsupported locale', () => {
    expect(canonicalizePublicRevalidatePath('/about', 'fr').ok).toBe(false);
  });

  it('rejects absolute URLs and protocol-relative paths', () => {
    expect(canonicalizePublicRevalidatePath('https://evil.example/about', 'en').ok).toBe(false);
    expect(canonicalizePublicRevalidatePath('//evil.example/about', 'en').ok).toBe(false);
    expect(canonicalizePublicRevalidatePath('javascript:alert(1)', 'en').ok).toBe(false);
  });

  it('rejects query strings and fragments', () => {
    expect(canonicalizePublicRevalidatePath('/about?x=1', 'en').ok).toBe(false);
    expect(canonicalizePublicRevalidatePath('/about#section', 'en').ok).toBe(false);
  });

  it('rejects path traversal and backslashes', () => {
    expect(canonicalizePublicRevalidatePath('/about/../../etc', 'en').ok).toBe(false);
    expect(canonicalizePublicRevalidatePath('/about\\..\\etc', 'en').ok).toBe(false);
  });

  it('rejects malformed and double-encoded percent sequences', () => {
    expect(canonicalizePublicRevalidatePath('/about%', 'en').ok).toBe(false);
    expect(canonicalizePublicRevalidatePath('/about%zz', 'en').ok).toBe(false);
    // "%2e%2e" (encoded "..") re-encoded once more
    expect(canonicalizePublicRevalidatePath('/%252e%252e/etc', 'en').ok).toBe(false);
  });

  it('does not require path to start with / to be rejected safely', () => {
    expect(canonicalizePublicRevalidatePath('about', 'en').ok).toBe(false);
  });
});
