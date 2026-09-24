import { GetServerSideProps } from 'next';
import { auth0 } from 'lib/auth0';
import { sanitizeReturnTo } from 'lib/auth/return-to';
import { sitecorePagePropsFactory } from 'lib/page-props-factory';
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

  const factoryContext = {
    ...context,
    params: buildMemberFactoryParams(context.params, locale, path),
  };
  const props = await sitecorePagePropsFactory.create(factoryContext);

  return {
    props,
    notFound: props.notFound,
  };
};

export default SitecorePage;
