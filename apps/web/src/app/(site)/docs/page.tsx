import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { Docs } from "@/components/docs/Docs";

export const metadata: Metadata = { title: "Docs" };

export default function Page() {
  return (
    <main>
      <Nav solid />
      <Docs />
    </main>
  );
}
