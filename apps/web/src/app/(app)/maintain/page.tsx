import type { Metadata } from "next";
import { Suspense } from "react";
import { MaintainPage } from "@/components/claim/MaintainPage";

export const metadata: Metadata = { title: "Maintain" };

export default function Page() {
  return (
    <Suspense>
      <MaintainPage />
    </Suspense>
  );
}
