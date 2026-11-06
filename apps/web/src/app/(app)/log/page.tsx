import type { Metadata } from "next";
import { ChainConsole } from "@/components/log/ChainConsole";

export const metadata: Metadata = { title: "On-chain" };

export default function Page() {
  return <ChainConsole />;
}
