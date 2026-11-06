import { PrivateKey } from "@hiero-ledger/sdk";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

/** Prints fresh keys to paste into .env. Nothing is written to disk. */
const attest = generatePrivateKey();
console.log("# Attestation and gateway signing key (EVM)");
console.log(`ATTEST_PRIVATE_KEY=${attest}`);
console.log(`# address ${privateKeyToAccount(attest).address}\n`);

const n = Number(process.argv[2] ?? 1);
for (let i = 0; i < n; i++) {
  const k = PrivateKey.generateECDSA();
  const evm = privateKeyToAccount(`0x${k.toStringRaw()}`);
  console.log(`# Agent ${i + 1} ECDSA key. Same key is the Hedera payer and the EVM address for the Agent Pass`);
  console.log(`AGENT_${i + 1}_HEDERA_PRIVATE_KEY=${k.toStringRaw()}`);
  console.log(`# EVM address ${evm.address}\n`);
}
