import { JSX } from 'react';
import { useRouter } from 'next/router';
import { useUser } from '@auth0/nextjs-auth0';
import { sanitizeReturnTo } from 'lib/auth/return-to';
import { buildLogoutHref } from 'lib/auth/logout-href';

/**
 * Minimal login/logout/current-user display. Does not affect page rendering strategy -
 * the session is read client-side via useUser() (SWR against /auth/profile).
 */
const AuthStatus = (): JSX.Element | null => {
  const { user, isLoading } = useUser();
  const { asPath } = useRouter();

  if (isLoading) {
    return null;
  }

  const returnTo = sanitizeReturnTo(asPath);

  if (!user) {
    return (
      <a className="p-2 text-dark" href={`/auth/login?returnTo=${encodeURIComponent(returnTo)}`}>
        Log in
      </a>
    );
  }

  return (
    <span className="p-2 text-dark">
      {user.name ?? user.email ?? 'Logged in'}{' '}
      <a className="p-2 text-dark" href={buildLogoutHref()}>
        Log out
      </a>
    </span>
  );
};

export default AuthStatus;
