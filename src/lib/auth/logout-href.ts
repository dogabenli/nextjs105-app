/**
 * The SDK's /auth/logout route resolves its own default post-logout redirect (an
 * absolute, registered URL) when called without a returnTo. Do not pass returnTo here -
 * a relative path (e.g. "/") would be forwarded to Auth0 as an invalid, unregistered
 * post_logout_redirect_uri.
 */
export function buildLogoutHref(): string {
  return '/auth/logout';
}
