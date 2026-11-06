/** The three pitch decks as data. Each has the same five slides: problem, solution, why, architecture, proof. */
export type Tone = "green" | "blue" | "red" | "light" | "dark" | "plain";
export interface Card { n?: string; title: string; body: string }

export type Slide =
  | { kind: "problem"; title: string; cards: Card[]; statement: string; notes: string }
  | { kind: "steps"; title: string; compact?: boolean; steps: { n?: string; title: string; body: string; tone?: Tone }[]; chips: { label: string; tone: Tone }[]; chipsAsBoxes?: boolean; footnote?: string; notes: string }
  | { kind: "split"; title: string; items: { mono: string; body: string }[]; panel: { label: string; lines: { strong?: string; text: string }[] }; notes: string }
  | { kind: "duo"; title: string; cards: { label: string; title: string; body: string }[]; chips: { label: string; tone: Tone }[]; footnote: string; notes: string }
  | { kind: "why"; title: string; cards: { title: string; body: string }[]; panel: { label: string; stats?: { big: string; text: string }[]; lines?: { strong: string; text: string }[]; closing?: string }; notes: string }
  | { kind: "flows"; title: string; columns: { title: string; tone: "light" | "dark"; items: { n?: string; text: string }[] }[]; bar?: string; notes: string }
  | { kind: "proof"; title: string; rows: [string, string][]; side: { label: string; lines: string[]; callout?: string }[]; links: string; notes: string };

export interface Deck { id: "hedera" | "ens" | "world"; footer: string; slides: Slide[] }

export const DECK_DATA: Deck[] = [
  /* ------------------------------------------------------------------ Hedera */
  {
    id: "hedera",
    footer: "Proofmark · AI Agents That Pay: x402 on Hedera",
    slides: [
      {
        kind: "problem",
        title: "An agent connects to an MCP server and hands over its shell.",
        cards: [
          { n: "01", title: "Servers get the keys", body: "An MCP server runs with shell, filesystem and credential access on the agent’s machine." },
          { n: "02", title: "Tools change after approval", body: "A trusted server can quietly add a tool such as read_env. Nothing re-checks the tool list." },
          { n: "03", title: "Nobody can take it back", body: "A signature shows an account built it, not who backs it now. A running fleet cannot be told to stop." },
        ],
        statement: "Agents have no human to ask. The check has to be automatic, cheap and fast.",
        notes: "Open with the picture: an agent connects to a stranger's process and gives it a shell. Three failures: servers get broad access, the tool list can change after you approved it, and a signature cannot be withdrawn from a running fleet. The key point for this track: agents have nobody to ask, so the check has to be automatic and cheap enough to run on every connection.",
      },
      {
        kind: "steps",
        title: "Agents pay $0.002 over x402 to check a server before they connect.",
        steps: [
          { n: "1 · Ask", title: "", body: "The proxy names the server and signs the request with the agent’s wallet." },
          { n: "2 · Check", title: "", body: "The gateway reads the maintainer, key and bond from ENS, and gates on Agent Pass and allowance." },
          { n: "3 · Pay", title: "", body: "$0.002 in HBAR settles on Hedera through Blocky402 and is logged to an HCS topic." },
          { n: "4 · Connect", title: "", body: "Both hashes match, or the connection is refused before the model sees a tool." },
        ],
        chips: [
          { label: "Green · full tool set", tone: "green" },
          { label: "Sandboxed · container, read-only", tone: "blue" },
          { label: "Blocked · refused, reason shown", tone: "red" },
        ],
        notes: "Walk the four steps left to right. The proxy asks, the gateway reads the on-chain trust record and checks that the agent is allowed to spend, the agent pays two tenths of a cent over x402 on Hedera, and only then does the proxy verify both hashes and connect. There are three outcomes and no amber tier: pinning to an old version would let an attacker freeze everyone on a bad build.",
      },
      {
        kind: "why",
        title: "A micropayment only works where payments are this small and this fast.",
        cards: [
          { title: "x402 settles natively", body: "The exact scheme runs on hedera:testnet through the Blocky402 facilitator, paid in HBAR." },
          { title: "Native services, no contracts", body: "HCS is the audit log and the revocation bus. HTS mints certificates. Allowances and key lists give spend authority and the bond." },
          { title: "Anyone can replay it", body: "Every attestation, payment and revocation is a mirror-node read away." },
        ],
        panel: {
          label: "What is unique",
          stats: [
            { big: "3.1 s", text: "from an HCS revocation to a subscribed proxy, measured live" },
            { big: "$0.002", text: "per check, paid by the agent with no human approving" },
          ],
          closing: "Others sell provenance. Proofmark sells liveness.",
        },
        notes: "Why Hedera: the business model is a two-tenth-of-a-cent check, which needs a network where the fee is a fraction of that and settlement takes seconds. We use Hedera natively: x402 through Blocky402, HCS for the log and for revocation, HTS for certificate NFTs, and allowances and key lists for spend authority and the bond. What is unique: signatures prove an account built something; Proofmark proves a maintainer still backs it now, and lets that be withdrawn across a fleet in seconds. In our live run a revocation reached a subscribed proxy 3.1 seconds after the HCS message.",
      },
      {
        kind: "steps",
        title: "Every step is a Hedera or ENS read or write.",
        compact: true,
        steps: [
          { title: "Agent client", body: "Any MCP client with an ENS name, a Hedera account and an allowance", tone: "light" },
          { title: "Proofmark proxy", body: "Pays, checks both hashes, re-hashes on every list change, watches HCS", tone: "light" },
          { title: "Gateway", body: "x402 paywall, tier logic, gates on pass, allowance and budget", tone: "dark" },
          { title: "Hedera testnet", body: "x402 settlement, two HCS topics, HTS certificates, allowances, 2-of-2 bond account", tone: "green" },
        ],
        chips: [
          { label: "ENS on Sepolia holds the maintainer, price, key, bond and namespace the gateway reads.", tone: "plain" },
          { label: "Sandbox worker derives the tool manifest: no network, read-only, no capabilities.", tone: "plain" },
          { label: "Mirror node feeds the proxy revocations and lets anyone replay the log.", tone: "plain" },
        ],
        chipsAsBoxes: true,
        footnote: "Sign, then gate (pass, allowance, budget), then pay, then verify both hashes, then connect, then watch HCS for a revocation.",
        notes: "Read the top row as the request path: the agent client, the proxy that sits in front of every server, the gateway with the x402 paywall, and Hedera. Below it, the three supporting systems: ENS holds the trust record, the sandbox worker derives the tool manifest without network access, and the mirror node carries revocations back to the proxy. The sentence at the bottom is the whole workflow in order. The payment itself settles from the agent's own account; the allowance is the operator's capped, revocable authority and the gate that decides whether the agent may pay at all.",
      },
      {
        kind: "proof",
        title: "Live on Hedera testnet, every transaction on HashScan.",
        rows: [
          ["x402 settling on Hedera testnet", "Settled payment 0.0.7162784-1793921712-374513238"],
          ["Agent pays, no human approving", "The proxy pays from its own wallet"],
          ["HCS audit log, revocation topic", "0.0.11331506 and 0.0.11344888"],
          ["Spending controls", "Cap, ENS budget, Hedera allowance (5 HBAR)"],
          ["HTS certificates", "Collection 0.0.11341242"],
          ["HCS-14, ERC-8004, Agent Kit", "UAID, agent #11294, plugin tested live"],
        ],
        side: [
          {
            label: "Next",
            lines: ["Bond escrow in a contract or HTS instead of a two-key account", "A paid connect to a freshly claimed server with a live Agent Pass", "Payments drawn directly from the allowance"],
            callout: "Proofmark does not prove code is safe.",
          },
        ],
        links: "proofmark-web.vercel.app · github.com/SamuelDharshi/Proofmark",
        notes: "This is the evidence slide. Each row maps a qualification requirement to something a judge can open on HashScan: the settled x402 payment, the two HCS topics, the allowance, the HTS collection, and the identity extras. Be direct about what is still ahead: the bond is held in a two-key account and the gateway marks forfeiture today, a fresh paid connect needs a claimed server and an Agent Pass approval, and payments settle from the agent's account rather than the allowance. Close on the line that matters for trust: this does not prove the code is safe. Repo and live demo are at the bottom.",
      },
    ],
  },

  /* --------------------------------------------------------------------- ENS */
  {
    id: "ens",
    footer: "Proofmark · Best Use of ENSv2",
    slides: [
      {
        kind: "problem",
        title: "Trust for MCP servers lives in someone’s database.",
        cards: [
          { n: "01", title: "A name is not an owner", body: "A registry lists names. Nothing on-chain says who backs a server, what it costs or which key may sign for it." },
          { n: "02", title: "Keys leak, trust stays", body: "When a maintainer’s key leaks, every release it signed stays trusted until someone notices." },
          { n: "03", title: "Claims prove nothing", body: "A name one letter off a popular server looks the same to an agent. Claiming a name shows nothing about who is asking." },
        ],
        statement: "Agents need a public trust record that anyone can read and only the right key can write.",
        notes: "Set up the gap ENS fills. Registries list names, but there is no public, programmable record of who stands behind a server, which key may sign for it, or whether that key has been withdrawn. Name imitation is real, and claiming a name does not show who is asking, which we found the hard way and fixed: a claim now needs proof that you control the namespace. The close is the requirement: a record anyone can read and only the right key can write.",
      },
      {
        kind: "split",
        title: "ENS is the trust database. Every decision is a read from it.",
        items: [
          { mono: "samuel.proofmark.eth", body: "Org: status, payto, price, owner, world.verified, bond, namespace" },
          { mono: "ci.samuel.proofmark.eth", body: "Co-maintainer: attest.key, with its own expiry and role" },
          { mono: "<server>.proofmark.eth", body: "Server claim: mcp.name and the org that backs it" },
          { mono: "claude-1.agents.proofmark.eth", body: "Agent: wallet, budget, tool allow-list, risk ceiling, pass, operator" },
        ],
        panel: {
          label: "What it answers",
          lines: [
            { strong: "Who claimed this server?", text: "" },
            { strong: "Which key may sign, and is it still live?", text: "" },
            { strong: "What may this agent spend and call?", text: "" },
            { text: "An unclaimed name has no record. That wildcard answer is sandboxed." },
          ],
        },
        notes: "Four kinds of name, each carrying records the product acts on. Orgs hold the payout, price, owner, bond and verified namespace. Co-maintainers are subnames holding an attest key with its own expiry. A server claim points at the org that backs it. Agents are names too, carrying wallet, budget, tool allow-list, risk ceiling, Agent Pass and operator. The right-hand panel is the point: three questions the gateway answers by reading ENS, and an unclaimed name resolves to nothing, which is the safe sandboxed answer.",
      },
      {
        kind: "why",
        title: "ENSv2 lets each org own its records and each key own one record.",
        cards: [
          { title: "One resolver per org", body: "A PermissionedResolver per org, so one org can never write another’s price or payout." },
          { title: "Roles scoped to one record", body: "Enhanced Access Control lets a co-maintainer write attest.key and nothing else. Anything more reverts." },
          { title: "Expiring subnames", body: "Each co-maintainer is its own subname. Clearing one key revokes it and leaves its siblings alone." },
          { title: "Registries per org", body: "Each org gets its own registry through the VerifiableFactory." },
        ],
        panel: {
          label: "What is unique",
          lines: [
            { strong: "Agents are ENS names.", text: "Wallet, budget, tool allow-list, risk ceiling, operator, UAID and ERC-8004 id live on the agent’s own name." },
            { strong: "Policy, not just identity.", text: "Revoking is one write that every proxy re-reads. Nothing is stored in the app." },
          ],
        },
        notes: "This is the ENSv2 specific slide. A per-org PermissionedResolver means isolation by construction. Enhanced Access Control roles scoped to a single record mean a leaked co-maintainer key can write attest.key and nothing else, and we show that an unauthorised write reverts. Expiring subnames give per-key revocation. What is unique is how far we push ENS: agents are names with budget, tools and operator records, and the trust policy is a public record, so revoking is one write that every proxy re-reads. The app stores no trust data of its own.",
      },
      {
        kind: "flows",
        title: "One write to claim. One read to decide. One write to revoke.",
        columns: [
          {
            title: "Claim",
            tone: "light",
            items: [
              { n: "1", text: "Prove control of the namespace with a GitHub gist or a domain file." },
              { n: "2", text: "World limits each identity to one claim, checked on the backend." },
              { n: "3", text: "A job writes the org registry, resolver, name, records and server claim to Sepolia." },
              { n: "4", text: "The owner adds the bond and a co-maintainer with one wallet signature." },
            ],
          },
          {
            title: "Connect",
            tone: "light",
            items: [
              { n: "1", text: "Resolve the server name to its org and records." },
              { n: "2", text: "Read the attest key: is it live, unexpired, the one that signed?" },
              { n: "3", text: "Compare the attested hashes with what the server shows." },
              { n: "4", text: "Decide the tier: green, sandboxed or blocked." },
            ],
          },
          {
            title: "Revoke",
            tone: "dark",
            items: [
              { n: "1", text: "The owner signs. The gateway clears the key record on-chain." },
              { n: "2", text: "A message goes to an HCS topic." },
              { n: "3", text: "Proxies drop the session in seconds and re-read ENS as the source of truth." },
            ],
          },
        ],
        bar: "Reads go through the Universal Resolver and are cached for 15 seconds, then invalidated the moment a TextUpdated or EACRolesChanged event fires.",
        notes: "Three flows, all on ENS. Claim: a namespace proof, a World uniqueness check, then a background job writes the org and server records to Sepolia, and the owner adds the bond and co-maintainers with wallet signatures. Connect: the gateway reads the server name, the org, the attest key and its expiry, compares the attested hashes, and decides a tier. Revoke: clear the key record, announce it on an HCS topic, and proxies drop the session in seconds while ENS stays the source of truth. The bottom line explains why reads are fast and still fresh: a short cache invalidated by the resolver's own events.",
      },
      {
        kind: "proof",
        title: "Live on Sepolia, written and read on-chain.",
        rows: [
          ["Built on ENSv2 on Sepolia", "proofmark.eth, org and agent registries"],
          ["Central, not cosmetic", "Every tier, price, payout and key is an ENS read"],
          ["Functional, not hard-coded", "Live co-maintainer add and revoke on Sepolia"],
          ["Unauthorised write reverts", "EACUnauthorizedAccountRoles"],
          ["Bonus: AI agents", "claude-1.agents.proofmark.eth"],
          ["Live demo and open source", "proofmark-web.vercel.app, GitHub"],
        ],
        side: [
          { label: "Rigor", lines: ["We found our own flaw: anyone could claim any server. A claim now needs proof of namespace control, and the wrong claim was cleared on-chain."] },
          { label: "Next", lines: ["Mainnet deployment and a public org directory read straight from ENS."] },
        ],
        links: "proofmark-web.vercel.app · github.com/SamuelDharshi/Proofmark",
        notes: "Each row maps a qualification requirement to evidence you can open: the root name, the org and agent registries, and live co-maintainer add and revoke transactions on Sepolia Etherscan from our end-to-end run. The unauthorised write reverts with EACUnauthorizedAccountRoles. The bonus requirement is met by the agent name carrying budget, tools and operator. Mention the rigor point: we found that a registry listing was not proof of who is claiming, fixed it with a namespace proof, and cleared the mistaken claim on-chain. Next steps are mainnet and a directory read from ENS.",
      },
    ],
  },

  /* ------------------------------------------------------------------- World */
  {
    id: "world",
    footer: "Proofmark · World Agent Pass and IDKit",
    slides: [
      {
        kind: "problem",
        title: "Agents need a person to authorise spend, and a limit on who can claim.",
        cards: [
          { n: "01", title: "Agents spend alone", body: "A headless agent pays for things on its own. Nothing shows that a verified person authorised it, or can switch that off." },
          { n: "02", title: "Sockpuppets are free", body: "Anyone can register unlimited maintainer orgs and make a server look trusted." },
          { n: "03", title: "A credential is not a maintainer", body: "World proves uniqueness, not who someone is, and a shared credential is a known weakness." },
        ],
        statement: "We use World for the two jobs it can do honestly, and put identity on layers built for it.",
        notes: "Frame the problem in World's terms. First, agents spend money with no human authority behind it, which is what Agent Pass is for. Second, claiming a maintainer identity is free and unlimited, which is where uniqueness matters. Third, and this is the honest part: World does not prove who the maintainer is, and a household member could share a credential. So we do not overclaim. World handles spend authority and uniqueness, and identity is carried by two other layers.",
      },
      {
        kind: "duo",
        title: "World does two jobs: it authorises spend and it limits claims.",
        cards: [
          { label: "Agent Pass", title: "Spend authority", body: "A headless agent gets a pass through the device flow. A person approves in World. The gateway validates the token and writes the pass to the agent’s ENS name. It expires, and spending stops until it is renewed." },
          { label: "IDKit", title: "Uniqueness at the claim", body: "One World identity, one claim. The gateway verifies the proof, enforces which credentials count, and stores the nullifier so a second claim is rejected." },
        ],
        chips: [
          { label: "World · unique", tone: "green" },
          { label: "Namespace · GitHub or domain", tone: "light" },
          { label: "Bond · money at stake", tone: "light" },
        ],
        footnote: "Identity rests on three layers. World is one of them, on purpose.",
        notes: "Two uses, each the minimum that does the job. Agent Pass is spend authority: a person approved this agent, and the approval expires. IDKit is a uniqueness gate on the maintainer claim: one identity, one claim. The strip at the bottom is the honest framing the track asks for: World is one layer of three. A verified namespace shows the claimer controls the GitHub account or domain behind the name, and a Hedera bond puts money at stake. A shared credential does not make a fake maintainer free.",
      },
      {
        kind: "why",
        title: "Only World gives uniqueness without asking who you are.",
        cards: [
          { title: "Sybil resistance, no KYC", body: "A nullifier proves one person without revealing who. Maintainers stay pseudonymous." },
          { title: "The minimum sufficient credential", body: "We need one real person per claim. Proof of Human, a passport or a national ID each prove that. A device or a selfie alone does not, so the gateway rejects them." },
          { title: "A person for a headless agent", body: "The device flow gives an agent with no browser a pass a person approved, validated on the backend." },
          { title: "We say what it does not prove", body: "It is not proof of who the maintainer is. The docs and the UI say so." },
        ],
        panel: {
          label: "What is unique",
          lines: [
            { strong: "Spend authority, not a login screen.", text: "The Agent Pass gates money. A payment is refused before it happens when the pass is missing or stale." },
            { strong: "Honest by design.", text: "World is one layer of three, and the weakness of a shared credential is named, not hidden." },
          ],
        },
        notes: "This slide answers the track's judging language directly. We are not rewarding the most credentials; we picked the minimum that does the job. The property we need at the claim is uniqueness: one real person, one claim. Proof of Human, a passport or a national ID each give it, a device or a selfie alone does not, and the gateway enforces that list itself rather than trusting the browser. For agents, the device flow gives a headless agent a pass that a person approved. And what is unique here is that the pass gates money, it is not a sign-in screen, and we say plainly what World does not prove.",
      },
      {
        kind: "flows",
        title: "Both flows are validated on the backend. The client is never trusted.",
        columns: [
          {
            title: "Agent Pass (spend)",
            tone: "light",
            items: [
              { n: "1", text: "The agent’s wallet signs a request to start a pass." },
              { n: "2", text: "The gateway starts the World device authorization." },
              { n: "3", text: "A person approves in World." },
              { n: "4", text: "The gateway validates the ID token: signature, issuer, audience, expiry, auth_time, acr and amr." },
              { n: "5", text: "The pass is written to the agent’s ENS name." },
              { n: "6", text: "Every payment checks pass freshness, then allowance, then budget." },
            ],
          },
          {
            title: "IDKit (claim)",
            tone: "light",
            items: [
              { n: "1", text: "The gateway signs the request context." },
              { n: "2", text: "The widget asks for an accepted credential." },
              { n: "3", text: "The proof goes to the gateway, not the page." },
              { n: "4", text: "The gateway checks the credential type, then verifies with World." },
              { n: "5", text: "The nullifier is stored. A second claim is rejected." },
              { n: "6", text: "Only then do the ENS writes run." },
            ],
          },
        ],
        bar: "Denied path: no pass, an expired pass or a forged signature gets a refusal before any payment. The protected action never happens.",
        notes: "Two flows, side by side. In the Agent Pass flow, a headless agent starts a device authorization, a person approves in World, and the gateway validates the ID token against World's keys, checking issuer, audience, expiry, authentication time and the authentication methods, including proof of presence. The result is written to the agent's ENS name, so the pass is a pure function of that record and the clock, and nothing can override it. In the IDKit flow the page only collects the proof; the gateway signs the request, checks the credential type, verifies with World and stores the nullifier. The dark bar is the denied path the track requires: the protected action does not occur.",
      },
      {
        kind: "proof",
        title: "Integrated, tested on the denied path, and honest about friction.",
        rows: [
          ["Official Agent Pass", "World IdP device flow, configured on the gateway"],
          ["Denied path, no action", "No pass: HTTP 403 before payment. Forged: 401"],
          ["Secure backend validation", "Keys and token checks stay server-side"],
          ["IDKit verified on the server", "Accepted credentials enforced, nullifier stored"],
          ["Alternative paths", "Closed dialog, rejected, duplicate, not accepted"],
          ["Complete journey", "[add after the live approval is recorded]"],
        ],
        side: [
          {
            label: "Friction we hit",
            lines: [
              "Device-only clients still need an exact HTTPS redirect URI at registration.",
              "The portal shows a signer address beside the signing key, and the address fails with a key-length error.",
              "One verification per action by default, so a claim that failed after verifying could not retry.",
              "In staging, the QR links to a host the normal World App does not open.",
            ],
            callout: "Time to first success: [__ hours]",
          },
        ],
        links: "proofmark-web.vercel.app · github.com/SamuelDharshi/Proofmark",
        notes: "Evidence first. The denied path is tested live: a signed agent request with no pass is refused with a 403 before any payment, and a forged signature gets a 401. The two bracketed items are yours to fill: the complete journey needs the live approval recorded, and the time to first success is a number only you know. Then the debrief the track asks for. Four real points of friction we hit: the redirect URI requirement for device-only clients, the signer address shown next to the signing key, the single verification per action that blocks a retry, and the staging QR link. The one improvement with the greatest impact would be to make a failed or interrupted claim not consume the verification. Close with the repo and live demo.",
      },
    ],
  },
];
