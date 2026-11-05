import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { CheckTool } from "@/components/check/CheckTool";

export const metadata: Metadata = { title: "Check a server" };

export default function Page() {
  return (
    <main>
      <Nav solid />
      <CheckTool />
    </main>
  );
}
