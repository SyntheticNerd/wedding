import type { Metadata } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ConvexClerkProvider } from "@/lib/convex-client";
import { Toaster } from "@/components/ui/sonner";
import { COUPLE } from "@/lib/site-config";
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

export const metadata: Metadata = {
  title: `${COUPLE.bride} & ${COUPLE.groom}`,
  description: "Our wedding website.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <ConvexClerkProvider>
        <html
          lang="en"
          className={`${inter.variable} ${cormorant.variable} h-full antialiased`}
        >
          <body className="min-h-full flex flex-col">
            {children}
            <Toaster richColors />
          </body>
        </html>
      </ConvexClerkProvider>
    </ClerkProvider>
  );
}
