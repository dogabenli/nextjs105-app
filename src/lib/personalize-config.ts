export interface PersonalizeConfig {
  clientKey: string;
  targetUrl: string;
  pointOfSale: string;
  cookieDomain: string;
  channel: string;
  currency: string;
}

export type PersonalizeEnvironment = Record<string, string | undefined>;

export function readPersonalizeConfig(
  environment: PersonalizeEnvironment = process.env
): PersonalizeConfig | null {
  if (environment.NEXT_PUBLIC_PERSONALIZE_ENABLED !== 'true') return null;

  const clientKey = environment.NEXT_PUBLIC_PERSONALIZE_CLIENT_KEY?.trim();
  const targetUrl = environment.NEXT_PUBLIC_PERSONALIZE_TARGET_URL?.trim();
  const pointOfSale = environment.NEXT_PUBLIC_PERSONALIZE_POINT_OF_SALE?.trim();
  const cookieDomain = environment.NEXT_PUBLIC_PERSONALIZE_COOKIE_DOMAIN?.trim();
  const channel = environment.NEXT_PUBLIC_PERSONALIZE_CHANNEL?.trim();
  const currency = environment.NEXT_PUBLIC_PERSONALIZE_CURRENCY?.trim();

  if (!clientKey || !targetUrl || !pointOfSale || !cookieDomain || !channel || !currency) {
    return null;
  }

  let parsedTarget: URL;
  try {
    parsedTarget = new URL(targetUrl);
  } catch {
    return null;
  }

  if (
    parsedTarget.protocol !== 'https:' ||
    !parsedTarget.hostname ||
    parsedTarget.username ||
    parsedTarget.password ||
    parsedTarget.search ||
    parsedTarget.hash
  ) {
    return null;
  }

  if (
    !/^(?:\.?localhost|(?:\.?[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,})$/i.test(cookieDomain)
  ) {
    return null;
  }

  if (!/^[A-Z]{3}$/.test(currency) || !/^[A-Z][A-Z0-9_-]*$/.test(channel)) {
    return null;
  }

  return { clientKey, targetUrl, pointOfSale, cookieDomain, channel, currency };
}
