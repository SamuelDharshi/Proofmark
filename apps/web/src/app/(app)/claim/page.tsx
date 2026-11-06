import { Suspense } from "react";
import type { Metadata } from "next";
import { ClaimWizard } from "@/components/claim/ClaimWizard";

export const metadata: Metadata = { title: "Claim a server" };

export default function Page() {
  return (
    <Suspense>
      <ClaimWizard />
    </Suspense>
  );
}
