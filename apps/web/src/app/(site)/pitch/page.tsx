import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { PitchPage } from "@/components/pitch/PitchPage";

export const metadata: Metadata = { title: "Pitch decks" };

export default function Page() {
  return (
    <main>
      <Nav solid />
      <PitchPage />
    </main>
  );
}
