import { describe, expect, it } from 'vitest';
import { isSafeReturnTo, sanitizeReturnTo } from './return-to';

describe('isSafeReturnTo', () => {
  it('accepts a single-leading-slash relative path', () => {
    expect(isSafeReturnTo('/member/dashboard')).toBe(true);
  });

  it('rejects a protocol-relative //external URL', () => {
    expect(isSafeReturnTo('//evil.example.com')).toBe(false);
  });

  it('rejects absolute external URLs and non-http schemes', () => {
    expect(isSafeReturnTo('https://evil.example.com')).toBe(false);
    expect(isSafeReturnTo('javascript:alert(1)')).toBe(false);
  });

  it('rejects values without a leading slash', () => {
    expect(isSafeReturnTo('member/dashboard')).toBe(false);
  });

  it('rejects empty or missing values', () => {
    expect(isSafeReturnTo(undefined)).toBe(false);
    expect(isSafeReturnTo(null)).toBe(false);
    expect(isSafeReturnTo('')).toBe(false);
  });
});

describe('sanitizeReturnTo', () => {
  it('passes through a safe value', () => {
    expect(sanitizeReturnTo('/member')).toBe('/member');
  });

  it('falls back to "/" for unsafe values by default', () => {
    expect(sanitizeReturnTo('//evil.example.com')).toBe('/');
  });

  it('falls back to a custom fallback for unsafe values', () => {
    expect(sanitizeReturnTo('https://evil.example.com', '/home')).toBe('/home');
  });
});
