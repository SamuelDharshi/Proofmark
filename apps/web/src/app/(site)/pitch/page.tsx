import type { Metadata } from "next";
import { Suspense } from "react";
import { Nav } from "@/components/Nav";
import { PitchViewer } from "@/components/pitch/PitchViewer";

export const metadata: Metadata = { title: "Pitch decks" };

export default function Page() {
  return (
    <main>
      <Nav solid />
      <Suspense>
        <PitchViewer />
      </Suspense>
    </main>
  );
}
