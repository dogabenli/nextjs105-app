import { GetServerSidePropsContext, GetStaticPropsContext } from 'next';
import { DictionaryService, LayoutService } from '@sitecore-jss/sitecore-jss-nextjs';
import { dictionaryServiceFactory } from 'lib/dictionary-service-factory';
import { layoutServiceFactory } from 'lib/layout-service-factory';
import { SitecorePageProps } from 'lib/page-props';
import { pathExtractor } from 'lib/extract-path';
import { Plugin, isServerSidePropsContext } from '..';

class NormalModePlugin implements Plugin {
  private dictionaryServices: Map<string, DictionaryService>;
  private layoutServices: Map<string, LayoutService>;

  order = 1;

  constructor() {
    this.dictionaryServices = new Map<string, DictionaryService>();
    this.layoutServices = new Map<string, LayoutService>();
  }

  async exec(props: SitecorePageProps, context: GetServerSidePropsContext | GetStaticPropsContext) {
    if (context.preview) return props;

    // Get normalized Sitecore item path
    const path = pathExtractor.extract(context.params);

    // Locale is routed via language subdomains (en.*, da.*) rather than Next's i18n. The
    // `[locale]` route param is populated by an invisible middleware rewrite based on the
    // request's subdomain - see src/lib/middleware/plugins/locale-rewrite.ts and
    // docs/poc/domain-based-i18n-ssg-isr.md.
    const localeParam = context.params?.locale;
    props.locale = (Array.isArray(localeParam) ? localeParam[0] : localeParam) ?? props.site.language;

    // Fetch layout data, passing on req/res for SSR
    const layoutService = this.getLayoutService(props.site.name);
    props.layoutData = await layoutService.fetchLayoutData(
      path,
      props.locale,

      isServerSidePropsContext(context) ? (context as GetServerSidePropsContext).req : undefined,
      isServerSidePropsContext(context) ? (context as GetServerSidePropsContext).res : undefined
    );

    if (!props.layoutData.sitecore.route) {
      // A missing route value signifies an invalid path, so set notFound.
      // Our page routes will return this in getStatic/ServerSideProps,
      // which will trigger our custom 404 page with proper 404 status code.
      // You could perform additional logging here to track these if desired.
      props.notFound = true;
    }

    // Fetch dictionary data if layout data was present
    if (!props.notFound) {
      const dictionaryService = this.getDictionaryService(props.site.name);
      props.dictionary = await dictionaryService.fetchDictionaryData(props.locale);
    }

    // Initialize links to be inserted on the page
    props.headLinks = [];

    return props;
  }

  private getDictionaryService(siteName: string): DictionaryService {
    if (this.dictionaryServices.has(siteName)) {
      return this.dictionaryServices.get(siteName)!;
    }

    const dictionaryService = dictionaryServiceFactory.create(siteName);
    this.dictionaryServices.set(siteName, dictionaryService);

    return dictionaryService;
  }

  private getLayoutService(siteName: string): LayoutService {
    if (this.layoutServices.has(siteName)) {
      return this.layoutServices.get(siteName)!;
    }

    const layoutService = layoutServiceFactory.create(siteName);
    this.layoutServices.set(siteName, layoutService);

    return layoutService;
  }
}

export const normalModePlugin = new NormalModePlugin();
