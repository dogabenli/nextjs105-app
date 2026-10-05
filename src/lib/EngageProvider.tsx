import { JSX, ReactNode, useEffect } from 'react';
import {
  PersonalizeConsentCheck,
  hasPersonalizationConsent,
  PERSONALIZE_CONSENT_EVENT,
} from 'lib/personalize-consent';
import { readPersonalizeConfig } from 'lib/personalize-config';
import { createPersonalizeController, RouteEvents } from 'lib/personalize-runtime';
import { resolveLocaleFromHost } from 'lib/locale-resolver';

const personalizeConfig = readPersonalizeConfig({
  NEXT_PUBLIC_PERSONALIZE_ENABLED: process.env.NEXT_PUBLIC_PERSONALIZE_ENABLED,
  NEXT_PUBLIC_PERSONALIZE_CLIENT_KEY: process.env.NEXT_PUBLIC_PERSONALIZE_CLIENT_KEY,
  NEXT_PUBLIC_PERSONALIZE_TARGET_URL: process.env.NEXT_PUBLIC_PERSONALIZE_TARGET_URL,
  NEXT_PUBLIC_PERSONALIZE_POINT_OF_SALE: process.env.NEXT_PUBLIC_PERSONALIZE_POINT_OF_SALE,
  NEXT_PUBLIC_PERSONALIZE_COOKIE_DOMAIN: process.env.NEXT_PUBLIC_PERSONALIZE_COOKIE_DOMAIN,
  NEXT_PUBLIC_PERSONALIZE_CHANNEL: process.env.NEXT_PUBLIC_PERSONALIZE_CHANNEL,
  NEXT_PUBLIC_PERSONALIZE_CURRENCY: process.env.NEXT_PUBLIC_PERSONALIZE_CURRENCY,
});

interface EngageProviderProps {
  children: ReactNode;
  router: RouteEvents;
  disabled?: boolean;
  consentCheck?: PersonalizeConsentCheck;
}

const EngageProvider = ({
  children,
  router,
  disabled = false,
  consentCheck = hasPersonalizationConsent,
}: EngageProviderProps): JSX.Element => {
  useEffect(() => {
    if (!personalizeConfig || disabled || typeof window === 'undefined') return;

    const controller = createPersonalizeController({
      config: personalizeConfig,
      router,
      consentCheck,
      getLanguage: () => resolveLocaleFromHost(window.location.host),
      getCurrentPath: () => `${window.location.pathname}${window.location.search}`,
      subscribeConsent: (listener) => {
        const handleConsentChange = (): void => listener();
        window.addEventListener(PERSONALIZE_CONSENT_EVENT, handleConsentChange);
        return () => window.removeEventListener(PERSONALIZE_CONSENT_EVENT, handleConsentChange);
      },
    });

    return controller.start(`${window.location.pathname}${window.location.search}`);
  }, [router, disabled, consentCheck]);

  return <>{children}</>;
};

export { EngageProvider };
