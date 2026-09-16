/**
 * @param {import('next').NextConfig} nextConfig
 */
const styleguidePlugin = (nextConfig = {}) => {
  // Note: this plugin previously injected a dummy `i18n: { locales: ['en', 'da-DK'] }` config.
  // That was sample scaffold data unrelated to the real app locales and conflicted with the
  // manual host-based locale resolution used by this app (see docs/poc/domain-based-i18n.md).
  return Object.assign({}, nextConfig);
};

module.exports = styleguidePlugin;
