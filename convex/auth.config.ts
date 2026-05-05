/**
 * Convex auth wiring for Clerk.
 *
 * `CLERK_JWT_ISSUER_DOMAIN` is set in the **Convex** dashboard (not Vercel)
 * because Convex evaluates this file inside its own runtime. Find the
 * issuer URL in Clerk dashboard → JWT Templates → "convex" template.
 *
 * To set it from CLI:
 *   npx convex env set CLERK_JWT_ISSUER_DOMAIN https://YOUR-APP.clerk.accounts.dev
 *
 * Until that's set, this file declares zero providers so `convex dev`
 * succeeds. Auth-gated queries/mutations will then reject with
 * "Not authenticated" — expected behavior pre-wiring.
 */
const clerkDomain = process.env.CLERK_JWT_ISSUER_DOMAIN;

const config = {
  providers: clerkDomain
    ? [
        {
          domain: clerkDomain,
          applicationID: "convex",
        },
      ]
    : [],
};

export default config;
