import config from 'temp/config';
import { SUPPORTED_LOCALES } from 'lib/locale-resolver';

const PROTECTED_SEGMENT = 'member';
const ABSOLUTE_SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:/i;
const ENCODED_SEQUENCE_PATTERN = /%[0-9a-fA-F]{2}/;

export interface CanonicalPathResult {
  ok: boolean;
  /** Exact path to pass to res.revalidate(). Only set when ok is true. */
  path?: string;
  reason?: string;
}

function isRejectedLocaleValue(locale: unknown): locale is string {
  return typeof locale === 'string' && !SUPPORTED_LOCALES.includes(locale);
}

/**
 * Canonicalizes a single public path (plus optional locale) into the exact path
 * this app's `res.revalidate()` must be called with.
 *
 * The public catch-all route lives at `pages/[locale]/[[...path]].tsx` and the
 * browser-visible URL never carries a locale segment (it's resolved from the
 * request subdomain by middleware before Next.js routing - see
 * `lib/locale-resolver.ts` and `lib/middleware/plugins/locale-rewrite.ts`).
 * Internally, though, each locale has its own statically generated page instance
 * at `/<locale>/<path>`, which is the identity `res.revalidate()` operates on.
 * Callers therefore submit a locale-free public `path` plus an optional `locale`
 * (defaulting to the site's default language) to say which locale's static page
 * to refresh - never multiple paths and never the locale baked into `path` itself.
 */
export function canonicalizePublicRevalidatePath(
  rawPath: unknown,
  rawLocale: unknown
): CanonicalPathResult {
  if (typeof rawPath !== 'string' || rawPath.length === 0) {
    return { ok: false, reason: 'path must be a non-empty string' };
  }

  if (isRejectedLocaleValue(rawLocale)) {
    return { ok: false, reason: 'unsupported locale' };
  }
  if (rawLocale !== undefined && typeof rawLocale !== 'string') {
    return { ok: false, reason: 'locale must be a string' };
  }

  const locale = (rawLocale as string | undefined) ?? (config.defaultLanguage as string);

  // Reject backslashes and control/whitespace characters before any decoding.
  if (/[\\\s\0]/.test(rawPath)) {
    return { ok: false, reason: 'path contains invalid characters' };
  }

  if (rawPath.startsWith('//') || ABSOLUTE_SCHEME_PATTERN.test(rawPath)) {
    return { ok: false, reason: 'path must be a relative site path' };
  }

  if (!rawPath.startsWith('/')) {
    return { ok: false, reason: 'path must start with /' };
  }

  // Not supported by this app's routing - reject rather than silently strip.
  if (rawPath.includes('?') || rawPath.includes('#')) {
    return { ok: false, reason: 'query strings and fragments are not supported' };
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(rawPath);
  } catch {
    return { ok: false, reason: 'malformed percent-encoding' };
  }

  // A remaining encoded sequence after one decode pass means the input was
  // double-encoded (or otherwise ambiguous) - reject rather than guess intent.
  if (ENCODED_SEQUENCE_PATTERN.test(decoded)) {
    return { ok: false, reason: 'ambiguous (double-encoded) path' };
  }

  if (decoded.includes('\\') || /[\x00-\x1f]/.test(decoded)) {
    return { ok: false, reason: 'path contains invalid characters' };
  }

  if (decoded.startsWith('//') || ABSOLUTE_SCHEME_PATTERN.test(decoded)) {
    return { ok: false, reason: 'path must be a relative site path' };
  }

  // Normalize one trailing slash convention; collapse repeated slashes via segment filtering.
  const trimmed = decoded.length > 1 && decoded.endsWith('/') ? decoded.slice(0, -1) : decoded;
  const segments = trimmed.split('/').filter((segment) => segment.length > 0);

  for (const segment of segments) {
    if (segment === '.' || segment === '..') {
      return { ok: false, reason: 'path traversal is not allowed' };
    }
  }

  // Defense in depth: a caller-supplied locale prefix inside `path` itself is stripped
  // (the real locale always comes from the separate `locale` field/default) but must
  // still be checked for a protected segment underneath it.
  const hasLeadingLocale =
    segments.length > 0 && SUPPORTED_LOCALES.includes(segments[0].toLowerCase());
  const contentSegments = hasLeadingLocale ? segments.slice(1) : segments;

  if (contentSegments[0]?.toLowerCase() === PROTECTED_SEGMENT) {
    return { ok: false, reason: 'member routes cannot be revalidated' };
  }

  const canonicalPath =
    contentSegments.length > 0 ? `/${locale}/${contentSegments.join('/')}` : `/${locale}`;

  return { ok: true, path: canonicalPath };
}
