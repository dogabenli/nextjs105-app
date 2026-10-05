export const PERSONALIZE_CONSENT_EVENT = 'personalize-consent-change';
export const PERSONALIZE_DEMO_CONSENT_KEY = 'personalize-demo-consent';

export type PersonalizeConsentCheck = () => boolean;

export const hasPersonalizationConsent: PersonalizeConsentCheck = () => {
  if (typeof window === 'undefined') return false;

  try {
    return window.localStorage.getItem(PERSONALIZE_DEMO_CONSENT_KEY) === 'granted';
  } catch {
    return false;
  }
};
