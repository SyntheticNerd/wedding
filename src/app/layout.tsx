import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Ephesis, Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ConvexClerkProvider } from "@/lib/convex-client";
import { Toaster } from "@/components/ui/sonner";
import { COUPLE, WEDDING } from "@/lib/site-config";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const ephesis = Ephesis({
  variable: "--font-ephesis",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const coupleTitle = `${COUPLE.groom} ${COUPLE.joiner} ${COUPLE.bride}`;
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://andrewandjewel.com";
const description = WEDDING.dateISO
  ? `Join ${COUPLE.groom} and ${COUPLE.bride} on ${WEDDING.dateISO}${
      WEDDING.location && WEDDING.location !== "TBD"
        ? ` in ${WEDDING.location}`
        : ""
    }. RSVP and event details inside.`
  : `${coupleTitle} — wedding details and RSVP.`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: coupleTitle,
    template: `%s · ${coupleTitle}`,
  },
  description,
  applicationName: coupleTitle,
  openGraph: {
    title: coupleTitle,
    description,
    siteName: coupleTitle,
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: coupleTitle,
    description,
  },
  // Site contains private guest data accessible via shareable invitation links;
  // keep search engines out so guest names and RSVP state never get indexed.
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAF6F1" },
    { media: "(prefers-color-scheme: dark)", color: "#2E2A26" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${cormorant.variable} ${ephesis.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ClerkProvider
          afterSignOutUrl="/"
          signInUrl="/sign-in"
          signUpUrl="/sign-in"
          signInForceRedirectUrl="/admin"
          signUpForceRedirectUrl="/admin"
        >
          <ConvexClerkProvider>
            {children}
            <Toaster richColors />
          </ConvexClerkProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
