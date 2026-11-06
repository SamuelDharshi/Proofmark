<p align="center">
  <img src="apps/web/public/logo.svg" width="72" alt="Proofmark" />
</p>

<h1 align="center">Proofmark</h1>

<p align="center"><strong>A human still backs this server. x402 on Hedera.</strong></p>

Proofmark is an MCP trust gate. Before an agent connects to an MCP server, which gets shell, filesystem and credential access, it pays $0.002 over x402 on Hedera for a fresh attestation that a verified human still stands behind this exact build and these exact tools. If the server later advertises a tool it did not have when it was attested, the hashes diverge and the connection is refused before the model sees the tool list. If a maintainer's key is revoked, running agents block on their next check.

It is an MCP proxy, a Hono gateway that is an x402 merchant, an attestation worker, and a Next.js app with a marketplace, a public `/check` page and a fleet view.

<p align="center"><img src="docs/architecture.svg" alt="Proofmark architecture" /></p>

## Proof it runs

Everything below is reproducible from a clean clone.

**Live on Hedera testnet**

| What | Link |
| --- | --- |
| x402 settlement, agent `0.0.11331191` pays maintainer `0.0.8149406` $0.002 (0.02 HBAR), no human approving | [HashScan transaction](https://hashscan.io/testnet/transaction/0.0.7162784-1793921712-374513238) |
| HCS topic holding every attestation and payment | [Topic 0.0.11331506](https://hashscan.io/testnet/topic/0.0.11331506) |
| Maintainer account | [0.0.8149406](https://hashscan.io/testnet/account/0.0.8149406) |
| Paying agent account | [0.0.11331191](https://hashscan.io/testnet/account/0.0.11331191) |

**Live on Sepolia (ENSv2)**

| What | Link |
| --- | --- |
| Root name | [proofmark.eth](https://sepolia.app.ens.domains/proofmark.eth) |
| Org registry proxy and org resolver proxy for `demo.proofmark.eth` | [resolver](https://sepolia.etherscan.io/tx/0xc5b8d89f42498ee44f3d51a839b26e54f729ba73b699b7cb685bc5c9dc169783), [registry](https://sepolia.etherscan.io/tx/0x8a2251888028671212db07806cdf7e1c05c6654436c356721ad5a05a0fbc763e) |
| Org name registered and records written | [register](https://sepolia.etherscan.io/tx/0x9a0fd456eefa59c56bd888420a4186115336b3346fda339319d7f4cdf771b84a), [records](https://sepolia.etherscan.io/tx/0x9ba046f0910a20a344bd2d05ae1b4c54d2f44ed0dcf0fa1bffe01f832d6a2541) |
| Co-maintainer `gateway.demo.proofmark.eth` with an expiring key | [subname](https://sepolia.etherscan.io/tx/0xb2a8e03a59f1db1912e458d1159636b8fc0fdc1d935dc864ef1c4614c3cd24f4), [attest.key role](https://sepolia.etherscan.io/tx/0xc0993ea3172d74d94d42ba5c7e7582286e77896d560b76f3dfbfe04e11f90fb2), [attest.key record](https://sepolia.etherscan.io/tx/0x676bf728d8ceb8f81c2938de9722c08aff6f9a82e8e85dfaf72f564dea81e0ef) |
| Unauthorised write to `status` by that co-maintainer | Reverts with `EACUnauthorizedAccountRoles`. Reproduce with `npm run ens:spike -w @proofmark/gateway` |

| What | How to see it |
| --- | --- |
| Derived manifest hash and mismatch refusal | `npm test`. The proxy suite runs the real demo MCP server clean, then mutated, and asserts the refusal names `read_env` |
| x402 settlement on Hedera testnet | Connect one agent. The proxy logs a HashScan link for the settled transaction and the gateway records it on the Fleet page |
| Public replayable log | The HCS log page reads the topic back from the Hedera mirror node. The topic link is returned by `GET /config` |
| ENSv2 hierarchy | `GET /config` returns the contract addresses used. Each org, co-maintainer and revocation links to Sepolia Etherscan and the ENS app |
| Denied path | Fleet, Agents tab: expire an agent's pass, then connect. The payment is refused and no connection is made |
| Public read-only page | `/check` resolves any server name. Unclaimed names honestly return sandboxed |

## Track requirements

| Partner | Requirement | How Proofmark meets it | Code |
| --- | --- | --- | --- |
| Hedera | x402-protected endpoint settling on Hedera testnet through a listed facilitator | `GET /attest` uses `@x402/hedera` exact scheme with the Blocky402 facilitator | [x402.ts:33](apps/gateway/src/x402.ts#L33), [x402.ts:69](apps/gateway/src/x402.ts#L69) |
| Hedera | A paid request with no human approving | The proxy signs and pays on its own. The Agent Pass gates authority to spend, not each payment | [connect.ts:48](apps/proxy/src/connect.ts#L48), [attest.ts:31](apps/gateway/src/routes/attest.ts#L31) |
| Hedera | HCS audit topic | Every attestation and every settled payment is one HCS message | [hcs.ts:27](apps/gateway/src/hcs.ts#L27), [x402.ts:37](apps/gateway/src/x402.ts#L37) |
| Hedera | Per-run budget and approval threshold | Budget lives on the agent record and is enforced before payment | [attest.ts:31](apps/gateway/src/routes/attest.ts#L31) |
| ENS | ENSv2 on Sepolia, addresses from the deployments table | Addresses and ABIs load from an export of the deployments table | [ens.ts](apps/gateway/src/ens.ts), [deployments.sepolia.json](apps/gateway/ens/deployments.sepolia.json) |
| ENS | Permissioned Registry, per-maintainer Permissioned Resolver, EAC roles scoped per record key | One resolver proxy per org. Co-maintainers get a setter role for `attest.key` only | [ens.ts:103](apps/gateway/src/ens.ts#L103), [ens.ts:133](apps/gateway/src/ens.ts#L133) |
| ENS | Expiring co-maintainer subnames, surgical revocation | Subname registered with an expiry. Revocation is one write | [ens.ts:150](apps/gateway/src/ens.ts#L150) |
| ENS | An unauthorised write reverts | `eth_call` as the co-maintainer writing `status` returns `EACUnauthorizedAccountRoles` | [ens.ts:159](apps/gateway/src/ens.ts#L159) |
| ENS | Wildcard resolution, public read-only page | Any unclaimed name resolves to sandboxed on `/check` | [check.ts](apps/gateway/src/check.ts) |
| ENS | Reads cached 15s, invalidated on `TextUpdated` and `EACRolesChanged` | Cache plus chain event watchers | [ens.ts:188](apps/gateway/src/ens.ts#L188) |
| World | Official World ID Agent Pass integrated, spend authority depends on it | The official World IdP over OIDC: a headless device grant, the ID token validated on the gateway (signature, issuer, audience, expiry, `auth_time`, `acr`, `amr`), and the validated pass written to the agent's ENS name | [idp.ts](apps/gateway/src/idp.ts), [agents.ts](apps/gateway/src/agents.ts) |
| World | Denied path | Expired or revoked pass: payment refused, no connection | [attest.ts:31](apps/gateway/src/routes/attest.ts#L31) |
| World | IDKit Proof of Human on the claim, duplicate nullifier rejected | Backend verification, nullifier stored per action | [world.ts:39](apps/gateway/src/world.ts#L39) |
| World | Validation on a secure backend | RP signing and proof verification run only on the gateway | [world.ts:10](apps/gateway/src/world.ts#L10) |

## How it works

```mermaid
sequenceDiagram
  participant A as Agent client
  participant P as Proofmark proxy
  participant G as Gateway
  participant H as Hedera
  participant E as ENS
  participant S as MCP server
  A->>P: connect to server
  P->>G: GET /attest (signed by agent wallet)
  G->>G: Agent Pass, budget, tier
  G-->>P: 402 payment required
  P->>H: pay over x402, no human approving
  H-->>G: settled, anchored on HCS
  G->>E: key live? (cached 15s)
  G-->>P: signed hash pair
  P->>S: spawn the pinned artefact
  S-->>P: tools/list
  P->>P: hash what the server sent, compare
  P-->>A: tools, or a refusal naming the added tool
```

### The two hashes

| Hash | Source | Catches |
| --- | --- | --- |
| Artefact | Registry integrity field: mcpb `fileSha256`, OCI digest, npm `dist.integrity` | A changed binary |
| Tool manifest | SHA-256 over sorted tool names, descriptions and input schemas | The same binary quietly offering a new tool |

The manifest is derived, never requested. The attestation worker fetches the pinned artefact, verifies its hash, runs it with no network and captures `tools/list` itself, so a split view implies a different binary. Canonicalisation sorts keys, normalises whitespace and strips volatile fields: [canonical.ts](packages/core/src/canonical.ts).

### Rechecks

The proxy checks at connect, again on every `notifications/tools/list_changed` ([cli.ts:103](apps/proxy/src/cli.ts#L103)), and re-checks liveness against the gateway every 15 seconds. Every attestation carries `revocationCheckedAt` and a 24 hour `validUntil`, so a cached one is evidence that goes stale rather than a free pass.

### Tiers

```mermaid
stateDiagram-v2
  [*] --> Sandboxed: name unclaimed
  [*] --> Blocked: one or two edits from a claimed name
  Sandboxed --> Green: a verified human claims it
  Green --> Blocked: hash mismatch
  Green --> Blocked: key revoked or expired
  Blocked --> Green: fresh attestation by a live key
```

There is no amber tier. Pinning to the last attested version would let an attacker freeze everyone on a vulnerable build by stopping attestation. Policy: [tiers.ts](packages/core/src/tiers.ts).

### ENS tree

```
proofmark.eth                     Permissioned Registry, administered by Proofmark
  acme.proofmark.eth              maintainer org, owned by the claiming human
      status, payto, x402.price, world.verified
    alice.acme.proofmark.eth      co-maintainer: attest.key, expires
    bob.acme.proofmark.eth        co-maintainer: attest.key, expires
```

One resolver instance per org, because argument-scoped grants apply to every name an instance serves. Claim and revoke are one write each. Nothing is written per attestation.

## Sponsor integrations

### Hedera
`@x402/hedera` exact scheme on `hedera:testnet`, settled by the Blocky402 facilitator. The price and `payTo` account are set per maintainer and capped at $0.05 ([x402.ts:69](apps/gateway/src/x402.ts#L69)). The asset is configurable and defaults to HBAR, because testnet USDC token ids are not reliable across facilitators. HCS carries every attestation and payment ([hcs.ts](apps/gateway/src/hcs.ts)). Every transaction id in the app links to HashScan.

### ENS
ENSv2 on Sepolia: Permissioned Registry subname registries, a Permissioned Resolver per org, Enhanced Access Control roles scoped to `attest.key`, expiring co-maintainer subnames and wildcard resolution to the sandboxed tier ([ens.ts](apps/gateway/src/ens.ts)).

### World
Agent Pass, through the official World IdP (OpenID Connect), proves a verified human operates the paying agent. The gateway runs the Device Authorization Grant, validates the ID token and records the pass on the agent's ENS name. Spend authority lapses when the authentication is older than the allowed age, so an expired pass is refused with no override. IDKit Proof of Human gates the maintainer claim, one nullifier to one identity. For a maintainer, uniqueness is the property needed, and a passport-grade credential would break the pseudonymity open source relies on. For the agent, the pass only has to show that some verified human is accountable for it ([world.ts](apps/gateway/src/world.ts), [agents.ts](apps/gateway/src/agents.ts)).

### MCP
Name ownership uses the official registry's own verification: `mcpName` in package.json, an `mcp-name:` README line or an OCI label ([registry.ts](apps/gateway/src/registry.ts)).

## Prior art

| Work | What it does | What it leaves open |
| --- | --- | --- |
| [Stacklok ToolHive](https://stacklok.com/blog/from-unknown-to-verified-solving-the-mcp-server-trust-problem/) | Verifies Sigstore signatures and build attestations on MCP images before deployment | No revocation, no human identity beyond a GitHub account, nothing once deployed |
| [Tool-definition hash pinning](https://codeongrass.com/blog/mcp-tool-shadowing-defenses-detect-poisoned-descriptions/) | Canonical SHA-256 over tool names, descriptions and schemas | Nobody ships or signs it, nothing binds it to a person |
| [Official MCP registry](https://modelcontextprotocol.io/registry/about) | Verifies name ownership | No signing, no revocation, no identity |
| [A trustworthy MCP registry](https://www.mdpi.com/1999-5903/18/5/243) | Sigstore signing plus runtime JWS | No revocation, no human identity, no payments |

Proofmark adds three narrow things: revocation that reaches a running fleet, one human instead of one account, and a recurring payment that makes the freshness check sustainable.

## Run it

Nothing here is simulated. Claims, prices, payees, agent budgets and co-maintainer keys live on ENS, spend lives in the HCS log, and settlement happens on Hedera testnet.

```bash
npm install
cp .env.example .env                          # fill in the values, see below
npm run keys -w @proofmark/gateway            # fresh signing key for ATTEST_PRIVATE_KEY
npm run hcs:create -w @proofmark/gateway      # prints HCS_TOPIC_ID
npm run ens:status -w @proofmark/gateway      # confirms the admin wallet owns the root name
npm run agents:create -w @proofmark/gateway -- 2 5 1   # 2 agents as ENS names, 5 HBAR each, 1 USD budget
npm run gateway                               # http://localhost:8787
npm run web                                   # http://localhost:3000
npm test                                      # core and proxy suites
```

**Accounts you need**

| For | What |
| --- | --- |
| Hedera | A testnet account with an ECDSA key. It is the maintainer payee, the HCS submitter and the funder of agent accounts |
| ENS | A Sepolia wallet that owns the root name, with Sepolia ETH |
| World Agent Pass | An OIDC client from the [World IdP portal](https://auth.world.org/portal): client id and secret in `WORLD_IDP_CLIENT_ID` and `WORLD_IDP_CLIENT_SECRET` |
| World IDKit | An app, RP id and signing key from the [Developer Portal](https://developer.world.org) for the maintainer claim |

**Using it.** A maintainer opens `/claim`, proves ownership through the registry and a World Proof of Human, and the gateway registers the org and the server name on ENS. Each agent gets an Agent Pass from the Fleet page: the gateway starts World's device flow, a human approves in World, the gateway validates the ID token and writes the pass to the agent's ENS name. Point an agent client at the proxy instead of the server:

```json
{
  "mcpServers": {
    "server": {
      "command": "npx",
      "args": ["tsx", "apps/proxy/src/cli.ts", "--server", "<registry name>", "--gateway", "http://localhost:8787",
               "--artifact", "<tarball or file to hash>", "--", "<command that starts the server>"],
      "env": { "AGENT_ENS_NAME": "claude-1.agents.proofmark.eth" }
    }
  }
}
```

## Repo map

```
packages/core      canonical manifest hash, tier policy, typosquat check, explorer links
packages/runner    spawn an MCP server, in a hermetic container when one is available
apps/gateway       Hono gateway: x402, attestation worker, HCS, ENS, World, claim, revoke
apps/proxy         the MCP proxy agents connect through
apps/demo-server   a small MCP server the proxy test suite runs, clean and mutated
apps/web           Next.js app: landing, marketplace, inspector, check, fleet, claim, docs
docs               architecture diagram
```

## Credits

Marks for Hedera, ENS, World and the Model Context Protocol belong to their owners and appear here only to show the technology Proofmark is built with.
