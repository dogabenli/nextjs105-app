import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { canonicalizePublicRevalidatePath } from 'lib/revalidate-path';

export const REVALIDATE_SECRET_HEADER = 'x-revalidate-secret';

function safeCompare(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufferA, bufferB);
}

/**
 * POST-only, secret-protected on-demand ISR endpoint for public pages only.
 * Never accepts or forwards member/Auth0 credentials - see docs/member-poc/02-milestones.md
 * Milestone 7.
 */
export async function revalidateHandler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  const configuredSecret = process.env.REVALIDATE_SECRET;
  const providedSecret = req.headers[REVALIDATE_SECRET_HEADER];

  if (
    !configuredSecret ||
    typeof providedSecret !== 'string' ||
    !safeCompare(providedSecret, configuredSecret)
  ) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  const body = req.body as unknown;
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    res.status(400).json({ error: 'invalid_body' });
    return;
  }

  const { path, locale } = body as Record<string, unknown>;
  const result = canonicalizePublicRevalidatePath(path, locale);

  if (!result.ok || !result.path) {
    res.status(400).json({ error: 'invalid_path', reason: result.reason });
    return;
  }

  try {
    await res.revalidate(result.path);
    res.status(200).json({ revalidated: true, path: result.path });
  } catch (error) {
    // Safe to log the canonical path (no secrets/tokens); never log headers or the body verbatim.
    console.error('revalidate_failed', {
      path: result.path,
      error: error instanceof Error ? error.message : 'unknown_error',
    });
    res.status(500).json({ error: 'revalidation_failed' });
  }
}
