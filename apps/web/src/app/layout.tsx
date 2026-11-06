import type { Metadata, Viewport } from "next";
import { Inter_Tight, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import { GeistPixelSquare } from "geist/font/pixel";
import "./globals.css";

const grotesk = Inter_Tight({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-grotesk", display: "swap" });
const space = Space_Grotesk({ subsets: ["latin"], variable: "--font-space", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "Proofmark. A human still backs this server.", template: "%s · Proofmark" },
  description: "Agents pay over x402 on Hedera to check that a verified human still stands behind an MCP server, and are refused when its tools change.",
  icons: { icon: [{ url: "/favicon.svg", type: "image/svg+xml" }, { url: "/favicon.ico" }], apple: "/apple-touch-icon.png" },
  openGraph: { title: "Proofmark", description: "A human still backs this server. x402 on Hedera.", images: ["/og-image.png"], type: "website" },
  twitter: { card: "summary_large_image", title: "Proofmark", description: "A human still backs this server. x402 on Hedera.", images: ["/og-image.png"] },
};

export const viewport: Viewport = { themeColor: "#e7e6e4" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${grotesk.variable} ${space.variable} ${mono.variable} ${GeistPixelSquare.variable}`}>
      <body>{children}</body>
    </html>
  );
}
