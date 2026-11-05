import test from "node:test";
import assert from "node:assert/strict";
import { hederaTxUrl, evmTxUrl } from "./explorers.ts";

test("hashscan tx url", () => {
  assert.equal(hederaTxUrl("0.0.123@1700000000.5"), "https://hashscan.io/testnet/transaction/0.0.123-1700000000-000000005");
});
test("sepolia tx url", () => {
  assert.equal(evmTxUrl(11155111, "0xabc"), "https://sepolia.etherscan.io/tx/0xabc");
});
