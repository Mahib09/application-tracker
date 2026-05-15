import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_BASE_URL ?? "https://paila.app",
  ),
  title: {
    default: "Paila — The application tracker that tracks itself",
    template: "%s · Paila",
  },
  description:
    "Connect Gmail once. Paila classifies every reply and shows you what's working, what's not, and who's gone quiet.",
  openGraph: {
    title: "Paila — The application tracker that tracks itself",
    description:
      "Connect Gmail once. Paila classifies every reply automatically.",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={GeistSans.variable}>
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
