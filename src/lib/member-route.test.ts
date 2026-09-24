import { describe, expect, it } from 'vitest';
import { isSafeReturnTo } from './auth/return-to';
import {
  buildMemberFactoryParams,
  buildMemberReturnTo,
  buildMemberSitecorePath,
  normalizeCatchAllPath,
} from './member-route';

describe('member route helpers', () => {
  it('normalizes an undefined catch-all path to the member root', () => {
    expect(normalizeCatchAllPath(undefined)).toEqual([]);
    expect(buildMemberSitecorePath(undefined)).toEqual(['member']);
    expect(buildMemberReturnTo(undefined)).toBe('/member');
  });

  it('reconstructs a single child path', () => {
    expect(buildMemberSitecorePath(['page-1'])).toEqual(['member', 'page-1']);
    expect(buildMemberReturnTo(['page-1'])).toBe('/member/page-1');
  });

  it('reconstructs nested paths without including the locale', () => {
    expect(buildMemberSitecorePath(['folder', 'page'])).toEqual(['member', 'folder', 'page']);
    expect(buildMemberReturnTo(['folder', 'page'])).toBe('/member/folder/page');
    expect(buildMemberFactoryParams({ locale: 'da', path: ['page'] }, 'da', ['page'])).toEqual({
      locale: 'da',
      path: ['member', 'page'],
    });
  });

  it('produces a safe local returnTo and rejects unsafe values', () => {
    const returnTo = buildMemberReturnTo(['page-1']);

    expect(isSafeReturnTo(returnTo)).toBe(true);
    expect(isSafeReturnTo('//external-site.example')).toBe(false);
    expect(isSafeReturnTo('https://external-site.example')).toBe(false);
  });
});
