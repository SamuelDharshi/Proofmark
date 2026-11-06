"use client";
import { useEffect, useState } from "react";

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "flow", label: "How a connect works" },
  { id: "hashes", label: "The two hashes" },
  { id: "tiers", label: "Tiers" },
  { id: "hedera", label: "Hedera" },
  { id: "ens", label: "ENSv2" },
  { id: "world", label: "World" },
  { id: "mcp", label: "MCP" },
  { id: "prior", label: "Prior art" },
  { id: "api", label: "API" },
  { id: "run", label: "Run it" },
];

function Section({ id, title, children, mark }: { id: string; title: string; children: React.ReactNode; mark?: { src: string; alt: string; h: number } }) {
  return (
    <section id={id} className="scroll-mt-28 border-t border-line py-12 first:border-0 first:pt-0">
      <div className="flex items-center gap-4">
        <h2 className="font-hero font-medium tracking-[-0.03em] text-[clamp(30px,3.4vw,44px)] leading-tight">{title}</h2>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {mark && <img src={mark.src} alt={mark.alt} style={{ height: mark.h, width: "auto" }} className="opacity-80" />}
      </div>
      <div className="prose-docs mt-5 space-y-4 text-[16px] leading-[1.75] text-muted [&_strong]:text-text [&_code]:num [&_code]:rounded [&_code]:bg-surface-2 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[13px] [&_code]:text-text">{children}</div>
    </section>
  );
}

const Table = ({ head, rows }: { head: string[]; rows: (string | React.ReactNode)[][] }) => (
  <div className="card overflow-x-auto">
    <table className="w-full min-w-[560px] text-left text-[14px]">
      <thead className="border-b border-line text-[12px] text-muted">
        <tr>{head.map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr>
      </thead>
      <tbody className="divide-y divide-line">
        {rows.map((r, i) => (
          <tr key={i}>{r.map((c, j) => <td key={j} className={`px-4 py-3 align-top ${j === 0 ? "text-text" : ""}`}>{c}</td>)}</tr>
        ))}
      </tbody>
    </table>
  </div>
);

export function Docs() {
  const [active, setActive] = useState("overview");
  useEffect(() => {
    const obs = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && setActive(e.target.id)), { rootMargin: "-30% 0px -60% 0px" });
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, []);

  return (
    <div className="wrap pb-10 pt-32">
      <p className="font-pixel text-[13px] tracking-widest text-accent">DOCS</p>
      <h1 className="mt-3 max-w-[820px] font-hero font-medium tracking-[-0.03em] text-[clamp(44px,6vw,84px)] leading-[0.98]">How Proofmark works.</h1>

      <div className="mt-14 grid gap-12 lg:grid-cols-[200px_1fr]">
        <nav aria-label="On this page" className="hidden lg:block">
          <ul className="sticky top-28 space-y-1 border-l border-line">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className={`-ml-px block border-l py-1.5 pl-4 font-label text-[13px] transition-colors ${active === s.id ? "border-accent text-text" : "border-transparent text-muted hover:text-text"}`}>
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <article className="min-w-0 max-w-[760px]">
          <Section id="overview" title="Overview">
            <p>Before an agent connects to an MCP server, which gets shell, filesystem and credential access, it pays <strong>$0.002 over x402 on Hedera</strong> for proof that a verified human still stands behind this exact build and these exact tools. The connection is refused when the tools change underneath it.</p>
            <p>Proofmark sells <strong>liveness, not provenance</strong>. Signatures prove an account built something. Proofmark proves one human still backs it this minute, and lets that human take it back. It does not prove the code is safe, and nothing here claims it does.</p>
          </Section>

          <Section id="flow" title="How a connect works">
            <p>The agent client talks to the Proofmark proxy instead of the server. The proxy stays in the path for the whole session.</p>
            <ol className="list-decimal space-y-2 pl-6">
              <li>The proxy signs the request with the agent wallet and asks the gateway for <code>GET /attest</code>.</li>
              <li>The gateway checks the <strong>Agent Pass</strong>, the agent&apos;s budget and the server&apos;s tier. A bad pass or a blocked tier is refused before any payment.</li>
              <li>The gateway answers <code>402</code>. The proxy pays over x402 on Hedera with no human approving, and the settlement is anchored on HCS.</li>
              <li>The proxy checks the maintainer signature, hashes the artefact it is about to run, spawns the server and hashes the tool list the server actually sent.</li>
              <li>Both hashes match, so the session proceeds. On every <code>tools/list_changed</code> the proxy hashes again, and every few seconds it re-checks liveness.</li>
            </ol>
            <p>The Agent Pass gates <strong>authority to spend</strong>. It is not a per-payment approval.</p>
          </Section>

          <Section id="hashes" title="The two hashes">
            <Table
              head={["Hash", "Source", "Catches"]}
              rows={[
                ["Artefact", "Registry integrity field: mcpb fileSha256, OCI digest, npm dist.integrity", "A changed binary"],
                ["Tool manifest", "SHA-256 over sorted tool names, descriptions and input schemas", "The same binary quietly offering a new tool"],
              ]}
            />
            <p>The manifest is <strong>derived, never asked for</strong>. The attestation worker fetches the pinned artefact, verifies its hash, runs it with no network and captures <code>tools/list</code> itself. A server that later advertises a different manifest therefore implies a different binary. Canonicalisation sorts keys, normalises whitespace and strips volatile fields, so identical servers never produce false mismatches.</p>
          </Section>

          <Section id="tiers" title="Tiers">
            <Table
              head={["Tier", "Condition", "Result"]}
              rows={[
                ["Green", "Claimed, attested, both hashes match, key live", "Connect normally, full tool set, maintainer paid"],
                ["Sandboxed", "No verified human has claimed the name", "Container with no network, read-only filesystem and dropped capabilities. Read-only tools only. A server that cannot be containerised is not launched locally."],
                ["Blocked", "Hash mismatch, revoked or expired key, or a name one to two edits from a claimed server", "Refused, with the reason and the added tool named"],
              ]}
            />
            <p>There is no amber tier. Pinning to the last attested version would let an attacker freeze everyone on a vulnerable build by simply stopping attestation.</p>
          </Section>

          <Section id="hedera" title="Hedera" mark={{ src: "/brands/hedera-wordmark.png", alt: "Hedera", h: 22 }}>
            <p><strong>x402.</strong> The gateway is an x402 merchant on <code>hedera:testnet</code> using the official <code>@x402/hedera</code> exact scheme and the Blocky402 facilitator. The price and <code>payTo</code> account are set per maintainer and capped at $0.05. The asset is configurable and defaults to HBAR, because the testnet USDC token id is not reliable across facilitators.</p>
            <p><strong>HCS.</strong> Every attestation and every payment is one message on a public topic, carrying the hash pair and the settlement transaction id. The topic is replayable from any mirror node, and the HCS log page reads it back.</p>
            <p>Every transaction id in the app links to HashScan.</p>
          </Section>

          <Section id="ens" title="ENSv2" mark={{ src: "/brands/ens-wordmark-light.png", alt: "ENS", h: 20 }}>
            <p>The tree runs on Sepolia. Addresses and ABIs are loaded from the ENS deployments table, not hard-coded.</p>
            <pre className="num overflow-x-auto border border-line bg-surface p-4 text-[12.5px] leading-relaxed text-text">{`proofmark.eth                     Permissioned Registry, administered by Proofmark
  acme.proofmark.eth              maintainer org, owned by the claiming human
      status, payto, x402.price, world.verified
    alice.acme.proofmark.eth      co-maintainer: attest.key, expires
    bob.acme.proofmark.eth        co-maintainer: attest.key, expires`}</pre>
            <ul className="list-disc space-y-2 pl-6">
              <li><strong>One resolver per org.</strong> Argument-scoped grants apply to every name an instance serves, so a shared resolver would let one org write another&apos;s <code>payto</code>.</li>
              <li><strong>Per-key roles.</strong> A co-maintainer&apos;s role covers <code>attest.key</code> and nothing else. Writing <code>status</code> reverts with <code>EACUnauthorizedAccountRoles</code>.</li>
              <li><strong>Surgical revocation.</strong> Revoking one subname invalidates what that key signed and leaves every other co-maintainer&apos;s attestations standing.</li>
              <li><strong>Expiry.</strong> Subnames expire on their own, so a co-maintainer who drifts away loses the ability to attest without anyone cleaning up.</li>
              <li><strong>Wildcard.</strong> Any name that is not claimed resolves to sandboxed, so there is an answer for every server.</li>
              <li><strong>Gas.</strong> Claim and revoke are one write each. Nothing is written per attestation.</li>
            </ul>
          </Section>

          <Section id="world" title="World" mark={{ src: "/brands/world-wordmark-light.png", alt: "World", h: 22 }}>
            <p><strong>Agent Pass.</strong> The official World ID Agent Pass is the World IdP, an OpenID Connect issuer. An agent has no browser, so the gateway runs the Device Authorization Grant for it: a human approves in World, the gateway validates the ID token (signature, issuer, audience, expiry, <code>auth_time</code>, <code>acr</code> and <code>amr</code>) and records the validated pass on the agent&apos;s ENS name. The pass is a pure function of that record and the clock, so when the authentication is older than the allowed age the payment is refused and the connection never happens. Nothing can override it.</p>
            <p><strong>IDKit Proof of Human.</strong> Claiming a server needs a Proof of Human. The gateway signs the request context, forwards the proof to the World Developer Portal and stores the nullifier. A second claim with the same nullifier is rejected. The client result is never trusted.</p>
            <p><strong>Minimum sufficient assurance.</strong> For a maintainer, uniqueness is the property needed. A passport-grade identity would break the pseudonymity open source relies on, so Proof of Human is the strongest credential this flow asks for. For the agent, the pass only has to show that some verified human is accountable for it.</p>
            <p><strong>When verification does not succeed.</strong> Closing the World dialog collects no proof, so Claim stays on the human step and nothing is written to ENS. A proof the gateway rejects (wrong action, bad signature, or a nullifier that already claimed) returns an error and no organisation is registered. An agent with no pass, an expired pass or too weak a credential is refused before any payment, so the protected action never happens.</p>
          </Section>

          <Section id="mcp" title="MCP" mark={{ src: "/brands/mcp-white.svg", alt: "Model Context Protocol", h: 28 }}>
            <p>Name ownership is solved by the official registry, so Proofmark uses it: <code>mcpName</code> in package.json, an <code>mcp-name:</code> line in the README, or an OCI label. There is no challenge file.</p>
            <p>The proxy is a transparent MCP server. It exposes the real server&apos;s tools once verified, plus <code>proofmark_explain</code> and <code>proofmark_budget</code>. MCP has no protocol-level per-tool access control, so the proxy filters what reaches the model and the container bounds what reaches the machine.</p>
          </Section>

          <Section id="prior" title="Prior art">
            <Table
              head={["Work", "What it does", "What is left"]}
              rows={[
                ["Stacklok ToolHive", "Verifies Sigstore signatures and build attestations on MCP images before deployment", "No revocation, no human identity beyond a GitHub account, nothing once deployed"],
                ["Tool-definition hash pinning", "Canonical SHA-256 over tool names, descriptions and schemas, rechecked on reconnect", "Nobody ships or signs it, and nothing binds it to a person"],
                ["Official MCP registry", "Verifies name ownership. mcpb entries carry fileSha256", "No signing, no revocation, no identity"],
                ["Trustworthy registry paper", "Sigstore signing plus runtime JWS", "No revocation, no human identity, no payments"],
              ]}
            />
            <p>Proofmark adds three narrow things: revocation that reaches a running fleet, one human instead of one account, and a recurring payment that makes the freshness check sustainable.</p>
          </Section>

          <Section id="api" title="API">
            <Table
              head={["Endpoint", "What it does"]}
              rows={[
                [<code key="a">GET /attest?server=</code>, "x402-protected. Returns the signed hash pair with a live revocation check."],
                [<code key="b">GET /check?server=</code>, "Public and free. Resolves any name through the wildcard."],
                [<code key="c">POST /claim</code>, "Registry ownership, World proof, ENS registration."],
                [<code key="d">POST /comaintainers</code>, "Add an expiring co-maintainer subname. Owner signature required."],
                [<code key="e">POST /revoke</code>, "Revoke one co-maintainer key. Owner signature required."],
                [<code key="f">POST /gossip</code>, "A client reports the manifest hash it observed."],
                [<code key="g">GET /hcs</code>, "The public anchor log read from the mirror node."],
              ]}
            />
          </Section>

          <Section id="run" title="Run it">
            <pre className="num overflow-x-auto border border-line bg-surface p-4 text-[12.5px] leading-relaxed text-text">{`npm install
cp .env.example .env      # fill in the values
npm run hcs:create -w @proofmark/gateway
npm run agents:create -w @proofmark/gateway -- 2 5 1
npm run gateway           # http://localhost:8787
npm run web               # http://localhost:3000`}</pre>
          </Section>
        </article>
      </div>
    </div>
  );
}
