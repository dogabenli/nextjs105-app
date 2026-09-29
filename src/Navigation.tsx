import { JSX, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useI18n } from 'next-localization';
import { useUser } from '@auth0/nextjs-auth0';
import config from 'temp/config';
import {
  SUPPORTED_LOCALES,
  resolveLocaleFromHost,
  buildLocaleSwitchHref,
} from 'lib/locale-resolver';
import AuthStatus from 'components/AuthStatus';

// Prefix public assets with a public URL to enable compatibility with Sitecore editors.
// If you're not supporting Sitecore editors, you can remove this.
const publicUrl = config.publicUrl;

const Navigation = (): JSX.Element => {
  const { t } = useI18n();
  const { asPath } = useRouter();
  const { user, isLoading } = useUser();
  // Host is only known in the browser, so the switcher renders once mounted to avoid a hydration mismatch.
  const [host, setHost] = useState<string | undefined>(undefined);

  useEffect(() => {
    setHost(window.location.host);
  }, []);

  const currentLocale = resolveLocaleFromHost(host);

  return (
    <div className="d-flex flex-column flex-md-row align-items-center p-3 px-md-4 mb-3 bg-white border-bottom">
      <h5 className="my-0 me-md-auto fw-normal">
        <Link href="/" className="text-dark">
          <img src={`${publicUrl}/sc_logo.svg`} alt="Sitecore" />
        </Link>
      </h5>
      <nav className="my-2 my-md-0 me-md-3">
        <a
          className="p-2 text-dark"
          href="https://jss.sitecore.com"
          target="_blank"
          rel="noopener noreferrer"
        >
          {t('Documentation')}
        </a>
        <Link className="p-2 text-dark" href="/styleguide">
          {t('Styleguide')}
        </Link>
        <Link className="p-2 text-dark" href="/graphql">
          {t('GraphQL')}
        </Link>
        {!isLoading && user && (
          <Link className="p-2 text-dark" href="/member">
            {t('Member')}
          </Link>
        )}
      </nav>
      {host && (
        <nav className="my-2 my-md-0">
          {SUPPORTED_LOCALES.map((locale) => (
            <a
              key={locale}
              className={`p-2 ${locale === currentLocale ? 'fw-bold text-dark' : 'text-secondary'}`}
              href={buildLocaleSwitchHref(host, asPath, locale)}
              aria-current={locale === currentLocale ? 'true' : undefined}
            >
              {locale.toUpperCase()}
            </a>
          ))}
        </nav>
      )}
      <nav className="my-2 my-md-0">
        <AuthStatus />
      </nav>
    </div>
  );
};

export default Navigation;
