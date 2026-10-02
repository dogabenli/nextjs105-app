import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextApiRequest, NextApiResponse } from 'next';
import { REVALIDATE_SECRET_HEADER, revalidateHandler } from './revalidate-handler';

const SECRET = 'test-placeholder-secret';

function createRes() {
  const res: Partial<NextApiResponse> & {
    revalidate: ReturnType<typeof vi.fn>;
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
    setHeader: ReturnType<typeof vi.fn>;
  } = {
    revalidate: vi.fn().mockResolvedValue(undefined),
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    setHeader: vi.fn(),
  };
  return res as unknown as NextApiResponse & {
    revalidate: ReturnType<typeof vi.fn>;
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
    setHeader: ReturnType<typeof vi.fn>;
  };
}

function createReq(overrides: Partial<NextApiRequest> = {}): NextApiRequest {
  return {
    method: 'POST',
    headers: { [REVALIDATE_SECRET_HEADER]: SECRET },
    body: { path: '/about' },
    ...overrides,
  } as unknown as NextApiRequest;
}

describe('revalidateHandler', () => {
  beforeEach(() => {
    process.env.REVALIDATE_SECRET = SECRET;
  });

  it('revalidates the exact canonical path with a correct secret', async () => {
    const req = createReq();
    const res = createRes();

    await revalidateHandler(req, res);

    expect(res.revalidate).toHaveBeenCalledOnce();
    expect(res.revalidate).toHaveBeenCalledWith('/en/about');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ revalidated: true, path: '/en/about' });
  });

  it('rejects a missing secret without calling revalidate', async () => {
    const req = createReq({ headers: {} });
    const res = createRes();

    await revalidateHandler(req, res);

    expect(res.revalidate).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('rejects a wrong secret without calling revalidate', async () => {
    const req = createReq({ headers: { [REVALIDATE_SECRET_HEADER]: 'wrong' } });
    const res = createRes();

    await revalidateHandler(req, res);

    expect(res.revalidate).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('fails closed when no secret is configured', async () => {
    delete process.env.REVALIDATE_SECRET;
    const req = createReq();
    const res = createRes();

    await revalidateHandler(req, res);

    expect(res.revalidate).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 405 with an Allow header for unsupported methods', async () => {
    const req = createReq({ method: 'GET' });
    const res = createRes();

    await revalidateHandler(req, res);

    expect(res.revalidate).not.toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith('Allow', 'POST');
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it('rejects a missing path', async () => {
    const req = createReq({ body: {} });
    const res = createRes();

    await revalidateHandler(req, res);

    expect(res.revalidate).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects a non-string path', async () => {
    const req = createReq({ body: { path: 42 } });
    const res = createRes();

    await revalidateHandler(req, res);

    expect(res.revalidate).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects multiple paths', async () => {
    const req = createReq({ body: { path: ['/about', '/member'] } });
    const res = createRes();

    await revalidateHandler(req, res);

    expect(res.revalidate).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects /member without calling revalidate', async () => {
    const req = createReq({ body: { path: '/member' } });
    const res = createRes();

    await revalidateHandler(req, res);

    expect(res.revalidate).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects /member/page-1 without calling revalidate', async () => {
    const req = createReq({ body: { path: '/member/page-1' } });
    const res = createRes();

    await revalidateHandler(req, res);

    expect(res.revalidate).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns a controlled response when res.revalidate throws', async () => {
    const req = createReq();
    const res = createRes();
    res.revalidate.mockRejectedValueOnce(new Error('boom'));

    await revalidateHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'revalidation_failed' });
  });
});
