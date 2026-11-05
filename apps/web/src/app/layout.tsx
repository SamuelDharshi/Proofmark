import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Bricolage_Grotesque, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import { GeistPixelSquare } from "geist/font/pixel";
import "./globals.css";

const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-instrument", display: "swap" });
const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage", display: "swap" });
const space = Space_Grotesk({ subsets: ["latin"], variable: "--font-space", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "THANKS. A human still backs this server.", template: "%s · THANKS" },
  description: "Agents pay over x402 on Hedera to check that a verified human still stands behind an MCP server, and are refused when its tools change.",
  icons: { icon: [{ url: "/favicon.svg", type: "image/svg+xml" }, { url: "/favicon.ico" }], apple: "/apple-touch-icon.png" },
  openGraph: { title: "THANKS", description: "A human still backs this server. x402 on Hedera.", images: ["/og-image.png"], type: "website" },
  twitter: { card: "summary_large_image", title: "THANKS", description: "A human still backs this server. x402 on Hedera.", images: ["/og-image.png"] },
};

export const viewport: Viewport = { themeColor: "#0a0b0d" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${serif.variable} ${bricolage.variable} ${space.variable} ${mono.variable} ${GeistPixelSquare.variable}`}>
      <body>{children}</body>
    </html>
  );
}
