# Proofmark testing report

Run on 2026-11-07 against the deployed system: gateway on Render, web on Vercel, Hedera testnet, Ethereum Sepolia and the official MCP registry. Nothing here is mocked. Where a step needs a person, it says so and is marked BLOCKED, never simulated.

## Summary

| Area | Result |
| --- | --- |
| Unit tests (core 19, proxy 6, gateway 5) | 30 passed, 0 failed |
| Live end-to-end script (`npm run e2e`) | 16 passed, 0 failed, 0 blocked (second run) |
| Live system check (`npm run live:check`) | 22 passed, 0 failed |
| Production build of the web app | 11 routes built, no errors |
| Site, 12 pages on the live Vercel deployment in a real browser | 12 passed, no script errors |
| Claim of an already-claimed server, against the live gateway | returns the owner and a link to Maintain, not HTTP 409 |
| Hedera Agent Kit plugin against the live gateway | passed |

### Second run, later on 2026-11-07

New evidence from this run:
- Bond deposit [0.0.8149406-1794004053-697388103](https://hashscan.io/testnet/transaction/0.0.8149406-1794004053-697388103) verified. A 5 HBAR deposit [0.0.8149406-1794004053-081843488](https://hashscan.io/testnet/transaction/0.0.8149406-1794004053-081843488) was rejected as below the minimum.
- Co-maintainer `e2epbpe.samuel.proofmark.eth`:
  - added: [subname](https://sepolia.etherscan.io/tx/0xc31e50cefbafd8fa839132e0d0162546f82f274bd3fca40f53603b63689e6493), [role](https://sepolia.etherscan.io/tx/0x2aa6372ff2fbbbf94b6852606e64bf93a891f5b78e04480b52f34fda44d92f73), [key](https://sepolia.etherscan.io/tx/0xd41c46e0276e69d600b14329a5847db8e42de42e3ea466f0ba68145b7b986098)
  - then [revoked](https://sepolia.etherscan.io/tx/0xc39e07b54d0e671a332eff6981df0693aedc036c16f6d23ef37c5eebe17f16d7)
- The revocation went to HCS topic 0.0.11344888 as message #2. A subscribed proxy saw it 2.1 s after the HCS submit.
- Allowance [withdrawn](https://hashscan.io/testnet/transaction/0.0.8149406-1794004134-445493937): payment refused. [Approved again](https://hashscan.io/testnet/transaction/0.0.8149406-1794004142-331722408): payment allowed.
- `proofmark-files@1.0.0` was derived in a no-network sandbox. Its manifest is `0x0e05fb00…72d5f0`, and its artefact hash equals the registry's.

Still needs a person:
- The MetaMask signatures of the `sam` owner wallet (co-maintainer `main`, attestation approval).
- One World Agent Pass approval.

Until that approval, a paid connect is refused with HTTP 403, which is the denied path working as designed.

A page-by-page walkthrough is in [WALKTHROUGH.md](WALKTHROUGH.md).

## Reproduce

```
npm test                                           # 30 unit tests
npm run live:check -w @proofmark/gateway           # the deployed system against the chains
npm run e2e -w @proofmark/gateway                  # real transactions: bond, revocation, allowance, sandbox
npm test -w @proofmark/agent-kit-plugin            # the plugin's tools against the live gateway (run with tsx src/plugin.test.ts)
```

## Live end-to-end run

Every line is a real transaction or a real read.

| # | Check | Evidence |
| --- | --- | --- |
| 1 | Bond account is a 2-of-2 key list | [0.0.11344995](https://hashscan.io/testnet/account/0.0.11344995) |
| 2 | A 50 HBAR deposit from the payout account verifies on the mirror node | [0.0.8149406-1793996223-561800842](https://hashscan.io/testnet/transaction/0.0.8149406-1793996223-561800842) |
| 3 | The same deposit is rejected for a different payout account | gateway message: "must come from the org's payout account" |
| 4 | A 5 HBAR deposit is rejected as below the 50 HBAR minimum | [0.0.8149406-1793996227-927636122](https://hashscan.io/testnet/transaction/0.0.8149406-1793996227-927636122) |
| 5 | A transaction id that does not exist is rejected | gateway message: "was not found on the mirror node" |
| 6 | Co-maintainer subname with an expiring key and an `attest.key`-scoped role | [subname](https://sepolia.etherscan.io/tx/0xf9f3d624ad1412b138e2c14e071524915286fd38d72cc10399172a4f413560e8), [role](https://sepolia.etherscan.io/tx/0x1cb27db111cafe3823785b93f774881d25d691fa93f8d018cf6e1b417eee0680), [record](https://sepolia.etherscan.io/tx/0x9085e5083e8d3bd4a62bbbcee31e0e6c3c3dfffdb8876c749d5c3a535511cdba) |
| 7 | Revoke clears the key on ENS | [0xb7fdc520…c92](https://sepolia.etherscan.io/tx/0xb7fdc5208df711d4202aeb3c2f93ed40b46165cbf9945f731c70ddc8d9060c92) |
| 8 | The revocation is published to the HCS revocation topic | [topic 0.0.11344888, message #1](https://hashscan.io/testnet/topic/0.0.11344888) |
| 9 | A subscribed proxy sees it through the mirror node | **3.1 s** after the HCS submit. The ENS write itself took about 22 s to confirm on Sepolia, which is why the HCS message is the fast path |
| 10 | ENS, the source of truth, agrees the key is no longer live | key cleared |
| 11 | The agent has a capped on-chain allowance | 5 of 5 HBAR |
| 12 | After the operator withdraws it, the gate refuses payment | [withdraw](https://hashscan.io/testnet/transaction/0.0.8149406-1793996335-115130213) |
| 13 | After the operator approves it again, the gate allows payment | [approve](https://hashscan.io/testnet/transaction/0.0.8149406-1793996343-706388193) |
| 14 | A real registry server runs in the sandbox with no network, a read-only filesystem and no capabilities | `io.github.SamuelDharshi/proofmark-files@1.0.0`, tools `list_dir`, `read_file`, manifest `0x0e05fb00…72d5f0` |
| 15 | Its artefact hash equals what the registry publishes | npm integrity `sha512-UxwzvBpX8Eu0k…` |
| 16 | The file server refuses `..`, absolute paths and symlinks out of its root | checked separately, all refused |

Blocked on a person: the claim (needs the GitHub gist, the World credential and the owner's wallet) and everything after it (attest with the maintainer's key, certificate, paid connect, which also needs the World Agent Pass approved once).

## Requirements, by sponsor

### Hedera, AI Agents That Pay: x402

| Requirement | Status | Evidence |
| --- | --- | --- |
| An x402-protected endpoint settling on Hedera testnet through a listed facilitator | Met | Blocky402, `hedera:testnet`. Settled payment [0.0.7162784-1793921712-374513238](https://hashscan.io/testnet/transaction/0.0.7162784-1793921712-374513238), a SUCCESS on the mirror node |
| An agent completes a paid request with no human approving | Met earlier, to be repeated | The settled payment above. A fresh paid connect needs a claimed server and an Agent Pass (BLOCKED) |
| Public repo, README with setup, architecture, payment flow and a transaction id | Met | README |
| Demo video of 5 minutes or less with a HashScan link | You | |
| Extras: spending controls | Met | per-payment cap, ENS budget, on-chain allowance gate |
| Extras: HCS audit log | Met | attestation, payment, identity, bond and revocation messages |
| Extras: HCS-14 identity | Met | UAID on the agent's ENS name, anchored on HCS |
| Extras: ERC-8004 identity | Met | agent #11294 in the Sepolia Identity Registry |
| Extras: HTS tokens | Met | collection [0.0.11341242](https://hashscan.io/testnet/token/0.0.11341242), certificate #1 |
| Extras: Agent Kit | Met | `@proofmark/agent-kit-plugin`, tested live |

### Hedera, "No Solidity Allowed"

| Requirement | Status | Evidence |
| --- | --- | --- |
| Hedera JS SDK, no Solidity contracts | Met | `@hashgraph/sdk` only. No `.sol` files in the repo |
| At least two native services | Met | HCS (topics 0.0.11331506, 0.0.11344888), HTS (0.0.11341242), allowances, KeyList bond account 0.0.11344995 |
| README with setup and usage | Met | README |
| Demo video of 5 minutes or less | You | |
| Extras: Mirror Node, HCS integrity, Agent Kit, key management | Met | bond and allowance checks, the revocation watcher, the attestation rebuild from HCS, the Agent Kit plugin, the 2-of-2 key list |

### ENS, Best Use of ENSv2

| Requirement | Status | Evidence |
| --- | --- | --- |
| Built on ENSv2 on Sepolia, central to the product | Met | the root, org and agent registries, resolvers and roles are ENSv2 contracts; every tier decision reads them |
| Functional demo, not hard-coded values | Met for the parts exercised | the e2e run writes and reads live records. A claimed green server is BLOCKED on the claim |
| Live demo link and open source | Met | Vercel and GitHub |
| Bonus: AI agents | Met | agents are ENS names with wallet, budget, tools, operator, UAID and ERC-8004 records |

### World, Agent Pass and IDKit

| Requirement | Status | Evidence |
| --- | --- | --- |
| Integrate the official World ID Agent Pass | Configured | World IdP device flow, validated in the backend. A live approval needs one tap in World (BLOCKED) |
| Complete journey: request, user completion, validated result, protected action | Pending the approval above | |
| A denied path where the protected action does not occur | Met | a signed agent request with no pass is refused with HTTP 403 before any payment; a forged signature gets 401 |
| Validate in a secure backend, no client secrets exposed | Met | signing key and verification stay on the gateway |
| Written debrief | Met | [WORLD_DEBRIEF.md](WORLD_DEBRIEF.md) |
| IDKit in a working flow, credential verified server-side | Met in code | the gateway enforces the credential set and checks the nullifier. A successful live proof is BLOCKED on the owner |
| Explain why the credential is the minimum sufficient | Met | docs: uniqueness is the property needed, and World alone is not trusted for identity |
| A meaningful alternative path | Met | docs and tests: closed dialog, rejected proof, duplicate nullifier, credential not accepted |

## Ways of working that were exercised

1. **Web app with wallet signatures.** Claim, bond, co-maintainer and attest approval are each one wallet signature. The server side of each is covered above. The wallet signatures themselves need you (see below).
2. **Command line and scripts.** `e2e`, `live:check`, `allowance`, `bond:pay`, `fund` and the attest worker drive the same gateway logic without a browser.
3. **An agent through the proxy.** The proxy pays, verifies both hashes, applies the allowed-tool policy and re-hashes on `tools/list_changed`. Its 4 end-to-end tests pass. A live paid connect is BLOCKED on the claim and the Agent Pass.
4. **A Hedera Agent Kit agent.** The plugin's two tools run against the live gateway.
5. **Fast revocation.** HCS topic plus mirror node, 3.1 s in the live run, with ENS as the source of truth.
6. **Recovery after a restart.** The attestation index is rebuilt from HCS and a forged message is ignored (automated test).

## Defects found while testing, and fixed

| Defect | Fix |
| --- | --- |
| A server could be claimed by anyone, because a registry listing was accepted as proof | The claimer must now prove control of the namespace, with a GitHub gist or a domain file. The wrong claim was cleared on-chain |
| The claim dropped partway on a hosted gateway | It runs as a polled job and an unfinished org can be resumed by its on-chain owner |
| GitHub's anonymous API returned 403 to the gateway | The proof is read from the public gist page |
| World reported a generic failure | The gateway passes World's own reason through |
| The World signing key was an address, not a key | A clear message, and the correct key set |
| Attestations lived only in one gateway's memory | They are written to HCS in full and rebuilt after a restart |
| The first published test server had no path limit and a hidden test switch | Replaced by `proofmark-files`, confined to a root and tested against escapes |
| Scrolling lagged | The artwork is served as pre-rendered images, with a measured 17 ms average frame |

## Open items, and what each needs from you

1. **Render environment.** Set `REVOKE_TOPIC_ID=0.0.11344888`, `BOND_ACCOUNT_ID=0.0.11344995`, `BOND_MIN_HBAR=50`, `HTS_TOKEN_ID=0.0.11341242` and the correct `WORLD_RP_SIGNING_KEY`. Optionally `GITHUB_TOKEN`.
2. **Claim `io.github.SamuelDharshi/proofmark-files`.** Public gist, World credential, owner signature.
3. **Bond.** `npm run bond:pay -w @proofmark/gateway -- 0.0.8150748 <your key> 50`, then paste the transaction id on the claim page and sign.
4. **Attest.** Add a co-maintainer, attest, approve with the wallet.
5. **Agent Pass.** Approve once in World for `claude-1`.
6. **Then** a live paid connect, the attack beat and a UI revoke can be run end to end and added to this report.

## Known limits, stated plainly

- The bond is held in a two-key account and the gateway is trusted to mark it forfeited. A contract or HTS escrow is the next step.
- World proves uniqueness at the claim and spend authority for the agent. It does not prove who the maintainer is, and a shared credential is a known weakness. The namespace proof and the bond exist because of that.
- The x402 payment settles from the agent's own account. The operator allowance is the on-chain gate and cap, not the funding source.
- Proofmark does not prove code is safe.
