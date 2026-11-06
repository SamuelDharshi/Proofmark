import { resolveTxt } from "node:dns/promises";
import { env } from "./config";

/**
 * Proof that the person claiming a server controls its registry namespace.
 *
 * The registry's own check proves the package author owns the name. It says nothing about who is asking
 * to claim it here, so without this anyone could claim any server and point its fees at themselves.
 * The claimer publishes one line that binds their wallet to the name, somewhere only the namespace owner can write:
 *
 *   io.github.<user>/...   a public GitHub gist created by that user
 *   com.example/...        https://example.com/.well-known/proofmark.txt, or a TXT record on _proofmark.example.com
 */
export const challengeFor = (server: string, owner: string) => `proofmark claim ${owner.toLowerCase()} ${server}`;

export interface Control {
  ok: boolean;
  method: string;
  detail: string;
  challenge: string;
  where: string;
}

const gh = () => ({ "user-agent": "proofmark", accept: "application/vnd.github+json", ...(env.GITHUB_TOKEN ? { authorization: `Bearer ${env.GITHUB_TOKEN}` } : {}) });

async function viaGist(user: string, challenge: string): Promise<boolean> {
  const r = await fetch(`https://api.github.com/users/${encodeURIComponent(user)}/gists?per_page=30`, { headers: gh(), signal: AbortSignal.timeout(15_000) });
  if (!r.ok) throw new Error(`GitHub returned ${r.status} when listing gists for ${user}`);
  const gists = (await r.json()) as { files: Record<string, { raw_url: string; size: number }> }[];
  for (const g of gists)
    for (const f of Object.values(g.files)) {
      if (f.size > 4000) continue;
      const t = await fetch(f.raw_url, { signal: AbortSignal.timeout(10_000) }).then((x) => (x.ok ? x.text() : "")).catch(() => "");
      if (t.split(/\r?\n/).some((line) => line.trim() === challenge)) return true;
    }
  return false;
}

async function viaDomain(domain: string, challenge: string): Promise<boolean> {
  const well = await fetch(`https://${domain}/.well-known/proofmark.txt`, { signal: AbortSignal.timeout(10_000) }).then((x) => (x.ok ? x.text() : "")).catch(() => "");
  if (well.split(/\r?\n/).some((line) => line.trim() === challenge)) return true;
  const txt = await resolveTxt(`_proofmark.${domain}`).catch(() => [] as string[][]);
  return txt.some((parts) => parts.join("").trim() === challenge);
}

export async function verifyControl(server: string, owner: string): Promise<Control> {
  const challenge = challengeFor(server, owner);
  const ns = server.split("/")[0] ?? "";
  try {
    if (ns.startsWith("io.github.")) {
      const user = ns.slice("io.github.".length);
      const where = `a public gist on github.com/${user}`;
      const ok = await viaGist(user, challenge);
      return { ok, method: "GitHub gist", challenge, where, detail: ok ? `A gist by ${user} binds ${owner} to ${server}` : `No public gist by ${user} contains the line below yet` };
    }
    const domain = ns.split(".").reverse().join(".");
    if (!domain.includes(".")) return { ok: false, method: "none", challenge, where: "", detail: `Cannot tell who controls the namespace ${ns}` };
    const where = `https://${domain}/.well-known/proofmark.txt, or a TXT record on _proofmark.${domain}`;
    const ok = await viaDomain(domain, challenge);
    return { ok, method: "domain proof", challenge, where, detail: ok ? `${domain} publishes the proof for ${owner}` : `${domain} does not publish the line below yet` };
  } catch (e) {
    return { ok: false, method: "error", challenge, where: "", detail: (e as Error).message };
  }
}
