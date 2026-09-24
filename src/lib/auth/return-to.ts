// Matches an absolute URL scheme (e.g. "https:", "javascript:") anywhere at the start.
const EXTERNAL_SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:/i;

/**
 * A safe `returnTo` value must be a local, single-leading-slash relative path.
 * Rejects protocol-relative URLs ("//evil.com"), absolute URLs with a scheme
 * ("https://evil.com", "javascript:..."), and anything not starting with "/".
 */
export function isSafeReturnTo(value: string | null | undefined): value is string {
  if (!value) {
    return false;
  }

  if (!value.startsWith('/')) {
    return false;
  }

  if (value.startsWith('//')) {
    return false;
  }

  if (EXTERNAL_SCHEME_PATTERN.test(value)) {
    return false;
  }

  return true;
}

/**
 * Returns `value` if it is a safe local returnTo path, otherwise `fallback`.
 */
export function sanitizeReturnTo(value: string | null | undefined, fallback = '/'): string {
  return isSafeReturnTo(value) ? value : fallback;
}
