import { GetStaticPaths, GetStaticProps } from 'next';
import { StaticPath } from '@sitecore-jss/sitecore-jss-nextjs';
import { sitecorePagePropsFactory } from 'lib/page-props-factory';
import { sitemapFetcher } from 'lib/sitemap-fetcher';
import { SUPPORTED_LOCALES } from 'lib/locale-resolver';
import SitecorePage from 'src/components/SitecorePage';

// The `locale` segment here is never visible in the browser - it's populated by an invisible
// middleware rewrite based on the request's subdomain (src/lib/middleware/plugins/locale-rewrite.ts).
// This restores SSG/ISR (compared to the earlier SSR-only approach) since `locale` now comes from
// route params instead of requiring the request/host. See docs/poc/domain-based-i18n-ssg-isr.md.
export const getStaticPaths: GetStaticPaths = async (context) => {
  // Fallback, along with revalidate in getStaticProps (below),
  // enables Incremental Static Regeneration. This allows us to
  // leave certain (or all) paths empty if desired and static pages
  // will be generated on request (development mode in this example).
  // Alternatively, the entire sitemap could be pre-rendered
  // ahead of time (non-development mode in this example).
  // See https://nextjs.org/docs/basic-features/data-fetching/incremental-static-regeneration

  let paths: StaticPath[] = [];
  let fallback: boolean | 'blocking' = 'blocking';

  if (
    process.env.NODE_ENV !== 'development' &&
    process.env.DISABLE_SSG_FETCH?.toLowerCase() !== 'true'
  ) {
    try {
      // Note: Next.js runs export in production mode
      const pathsByLocale = await Promise.all(
        SUPPORTED_LOCALES.map(async (locale) => {
          const localePaths = await sitemapFetcher.fetch({ ...context, locales: [locale] });
          return localePaths.map((staticPath) => ({
            params: { ...staticPath.params, locale },
          }));
        })
      );
      paths = pathsByLocale.flat();
    } catch (error) {
      console.log('Error occurred while fetching static paths');
      console.log(error);
    }

    fallback = process.env.EXPORT_MODE ? false : fallback;
  }

  return {
    paths,
    fallback,
  };
};

// This function gets called at build time on server-side.
// It may be called again, on a serverless function, if
// revalidation (or fallback) is enabled and a new request comes in.
export const getStaticProps: GetStaticProps = async (context) => {
  const props = await sitecorePagePropsFactory.create(context);

  return {
    props,
    // Next.js will attempt to re-generate the page:
    // - When a request comes in
    // - At most once every 5 seconds
    revalidate: 5, // In seconds
    notFound: props.notFound, // Returns custom 404 page with a status code of 404 when true
  };
};

export default SitecorePage;
