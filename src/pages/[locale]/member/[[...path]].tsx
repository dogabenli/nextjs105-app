import { GetServerSideProps } from 'next';
import { auth0 } from 'lib/auth0';
import { sanitizeReturnTo } from 'lib/auth/return-to';
import { decodeAccessTokenClaims } from 'lib/auth/decode-access-token';
import { sitecorePagePropsFactory } from 'lib/page-props-factory';
import { getVisibleMemberLinks } from 'lib/member-nav';
import SitecorePage from 'src/components/SitecorePage';
import {
  buildMemberFactoryParams,
  buildMemberReturnTo,
  normalizeCatchAllPath,
  normalizeLocale,
} from 'lib/member-route';

export const getServerSideProps: GetServerSideProps = async (context) => {
  context.res.setHeader('Cache-Control', 'private, no-store');

  const locale = normalizeLocale(context.params?.locale);
  const path = normalizeCatchAllPath(context.params?.path);
  const returnTo = sanitizeReturnTo(buildMemberReturnTo(path), '/member');

  const session = await auth0.getSession(context.req);
  if (!session) {
    return {
      redirect: {
        destination: `/auth/login?returnTo=${encodeURIComponent(returnTo)}`,
        permanent: false,
      },
    };
  }

  let accessToken: string | undefined;
  try {
    accessToken = (await auth0.getAccessToken(context.req, context.res)).token;
  } catch {
    console.error('member_access_token_unavailable');
    context.res.statusCode = 401;
    return { notFound: true };
  }

  if (!accessToken) {
    console.error('member_access_token_unavailable');
    context.res.statusCode = 401;
    return { notFound: true };
  }

  const factoryContext = {
    ...context,
    params: buildMemberFactoryParams(context.params, locale, path),
  };
  try {
    const props = await sitecorePagePropsFactory.create(factoryContext, {
      layoutServiceOptions: { accessToken },
    });

    // UX-only: roles are read from the unverified token payload purely to filter nav links.
    const { roles } = decodeAccessTokenClaims(accessToken);

    return {
      props: { ...props, memberNav: getVisibleMemberLinks(roles) },
      notFound: props.notFound,
    };
  } catch (error) {
    const status =
      typeof error === 'object' && error !== null && 'response' in error
        ? (error.response as { status?: unknown }).status
        : undefined;

    if (status === 401 || status === 403) {
      console.error(
        status === 401
          ? 'member_layout_authentication_failed'
          : 'member_layout_authorization_failed'
      );
      if (status === 403) {
        return {
          redirect: { destination: '/403', permanent: false },
        };
      }

      context.res.statusCode = status;
      return { notFound: true };
    }

    throw error;
  }
};

export default SitecorePage;
