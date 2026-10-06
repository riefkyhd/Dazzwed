import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";

const sans = Inter({ variable: "--font-sans-body", subsets: ["latin"], display: "swap" });
const serif = Playfair_Display({ variable: "--font-serif-head", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Disposable Cam",
  description: "Capture the moments of our wedding day.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0b0a09",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
