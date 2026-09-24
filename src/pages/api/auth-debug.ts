import type { NextApiRequest, NextApiResponse } from 'next';
import { auth0 } from 'lib/auth0';
import { decodeAccessTokenClaims } from 'lib/auth/decode-access-token';

/**
 * Development-only endpoint to inspect sanitized access-token claims. Never available
 * outside NODE_ENV=development, and never returns or logs the raw access token.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (process.env.NODE_ENV !== 'development') {
    res.status(404).end();
    return;
  }

  const session = await auth0.getSession(req);
  if (!session) {
    res.status(401).json({ error: 'not_authenticated' });
    return;
  }

  try {
    const { token } = await auth0.getAccessToken(req, res);

    // Decoding here is for local developer inspection only - it is NOT authorization proof.
    // The future Sitecore .NET backend independently validates signature, issuer, audience,
    // and expiry before trusting any claim; nothing decoded here should be trusted as-is.
    const claims = decodeAccessTokenClaims(token);
    res.status(200).json(claims);
  } catch {
    res.status(401).json({ error: 'no_access_token' });
  }
}
