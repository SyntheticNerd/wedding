import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";

const isAdminRoute = createRouteMatcher(["/admin(.*)"]);

// Clerk's middleware throws without a publishable key. In preview/dev without
// keys, fall back to a pass-through so public pages render. Production stays
// fail-closed: keys are required there, so a missing key errors loudly rather
// than silently leaving /admin unprotected.
const useClerk =
  Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) ||
  process.env.VERCEL_ENV === "production";

export default useClerk
  ? clerkMiddleware(async (auth, request) => {
      if (isAdminRoute(request)) {
        await auth.protect();
      }
    })
  : (_request: NextRequest) => NextResponse.next();

export const config = {
  matcher: [
    // Skip Next.js internals and static assets
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
