import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { Marketplace } from "@/components/market/Marketplace";

export const metadata: Metadata = { title: "Marketplace" };

export default function Page() {
  return (
    <main>
      <Nav solid />
      <Marketplace />
    </main>
  );
}
