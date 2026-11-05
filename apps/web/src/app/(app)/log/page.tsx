import type { Metadata } from "next";
import { LogView } from "@/components/log/LogView";

export const metadata: Metadata = { title: "HCS log" };

export default function Page() {
  return <LogView />;
}
