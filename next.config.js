const jssConfig = require('./src/temp/config');
const plugins = require('./src/temp/next-config-plugins') || {};

const publicUrl = jssConfig.publicUrl;

/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  // Set assetPrefix to our public URL
  assetPrefix: publicUrl,

  // Allow specifying a distinct distDir when concurrently running app in a container
  distDir: process.env.NEXTJS_DIST_DIR || '.next',

  // Make the same PUBLIC_URL available as an environment variable on the client bundle
  env: {
    PUBLIC_URL: publicUrl,
  },

  // NOTE: language-subdomain routing (en.*/da.*) is handled manually via
  // src/lib/locale-resolver.ts + getServerSideProps, NOT Next's built-in `i18n` config.
  // See docs/poc/domain-based-i18n.md for why: `i18n.domains` conflicts with the
  // `rewrites()` below and throws a client-side hard-navigation invariant for any
  // domain whose defaultLocale isn't the global defaultLocale.

  // Enable React Strict Mode
  reactStrictMode: true,

  // Disable the X-Powered-By header. Follows security best practices.
  poweredByHeader: false,

  allowedDevOrigins: [
    "nextjs-105xpsc.dev.local",
    "*.nextjs105.local",
  ],
   async headers() {
    return process.env.NODE_ENV === 'development'
      ? [
          {
            source: '/_next/:path*',
            headers: [
              {
                key: 'Access-Control-Allow-Origin',
                value: '*',
              },
              {
                key: 'Access-Control-Allow-Methods',
                value: 'GET,OPTIONS',
              },
            ],
          },
        ]
      : [];
  },

  // use this configuration to ensure that only images from the whitelisted domains
  // can be served from the Next.js Image Optimization API
  // see https://nextjs.org/docs/app/api-reference/components/image#remotepatterns
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'edge*.**',
        port: '',
      },
      {
        protocol: 'https',
        hostname: 'xmc-*.**',
        port: '',
      },
    ],
    localPatterns: [
      {
        pathname: '/-/jssmedia/**',
      }
    ]
  },

  async rewrites() {
    // When in connected mode we want to proxy Sitecore paths off to Sitecore
    return [
      // API endpoints
      {
        source: '/sitecore/api/:path*',
        destination: `${jssConfig.sitecoreApiHost}/sitecore/api/:path*`,
      },
      // media items
      {
        source: '/-/:path*',
        destination: `${jssConfig.sitecoreApiHost}/-/:path*`,
      },
      // healthz check
      {
        source: '/healthz',
        destination: '/api/healthz',
      },
      // rewrite for Sitecore service pages
      {
        source: '/sitecore/service/:path*',
        destination: `${jssConfig.sitecoreApiHost}/sitecore/service/:path*`,
      },
    ];
  },
};

module.exports = () => {
  // Run the base config through any configured plugins
  return Object.values(plugins).reduce((acc, plugin) => plugin(acc), nextConfig);
};
