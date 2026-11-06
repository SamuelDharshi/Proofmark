import type { Metadata } from "next";
import { Suspense } from "react";
import { Nav } from "@/components/Nav";
import { CheckTool } from "@/components/check/CheckTool";

export const metadata: Metadata = { title: "Check a server" };

export default function Page() {
  return (
    <main>
      <Nav solid />
      <Suspense>
        <CheckTool />
      </Suspense>
    </main>
  );
}
