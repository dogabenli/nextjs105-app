import { ParsedUrlQuery } from 'querystring';
import { sanitizeReturnTo } from 'lib/auth/return-to';

export function normalizeCatchAllPath(value: string | string[] | undefined): string[] {
  if (typeof value === 'string') {
    return [value];
  }

  return Array.isArray(value)
    ? value.filter((segment): segment is string => typeof segment === 'string')
    : [];
}

export function normalizeLocale(value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' ? value : Array.isArray(value) ? value[0] : undefined;
}

export function buildMemberSitecorePath(path: string | string[] | undefined): string[] {
  return ['member', ...normalizeCatchAllPath(path)];
}

export function buildMemberReturnTo(path: string | string[] | undefined): string {
  const returnTo = `/${buildMemberSitecorePath(path).join('/')}`;
  return sanitizeReturnTo(returnTo, '/member');
}

export function buildMemberFactoryParams(
  params: ParsedUrlQuery | undefined,
  locale: string | undefined,
  path: string | string[] | undefined
): ParsedUrlQuery {
  return {
    ...params,
    ...(locale ? { locale } : {}),
    path: buildMemberSitecorePath(path),
  };
}
