/**
 * Convex auth wiring for Clerk.
 * The domain (issuer) is set in Vercel env as CLERK_JWT_ISSUER_DOMAIN —
 * find it in Clerk dashboard → JWT Templates → "convex" template after
 * creating it per https://docs.convex.dev/auth/clerk
 */
const config = {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN!,
      applicationID: "convex",
    },
  ],
};

export default config;
