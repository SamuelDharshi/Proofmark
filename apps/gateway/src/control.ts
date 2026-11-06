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

/**
 * Primary check: the user's public gist page. Only gists listed on that user's own page belong to them, and reading
 * the page and the raw files does not use GitHub's API, whose anonymous limit is shared by every app on a host.
 */
async function viaGistPage(user: string, challenge: string): Promise<boolean> {
  const page = await fetch(`https://gist.github.com/${encodeURIComponent(user)}`, { headers: { "user-agent": "proofmark" }, signal: AbortSignal.timeout(15_000) });
  if (!page.ok) throw new Error(`GitHub returned ${page.status} for the gist page of ${user}`);
  const html = await page.text();
  if (!/^[A-Za-z0-9-]+$/.test(user)) throw new Error(`${user} is not a valid GitHub username`);
  const ids = [...new Set([...html.matchAll(new RegExp(`href="/${user}/([0-9a-f]{20,40})"`, "gi"))].map((m) => m[1]))].slice(0, 15);
  for (const id of ids) {
    const t = await fetch(`https://gist.githubusercontent.com/${encodeURIComponent(user)}/${id}/raw`, { signal: AbortSignal.timeout(10_000) }).then((x) => (x.ok ? x.text() : "")).catch(() => "");
    if (t.length < 4000 && t.split(/\r?\n/).some((line) => line.trim() === challenge)) return true;
  }
  return false;
}

async function viaGist(user: string, challenge: string): Promise<boolean> {
  try {
    return await viaGistPage(user, challenge);
  } catch (pageError) {
    return viaGistApi(user, challenge).catch((apiError) => {
      throw new Error(`${(pageError as Error).message}; ${(apiError as Error).message}`);
    });
  }
}

async function viaGistApi(user: string, challenge: string): Promise<boolean> {
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
    const where = ns.startsWith("io.github.") ? `a public gist on github.com/${ns.slice("io.github.".length)}` : `https://${ns.split(".").reverse().join(".")}/.well-known/proofmark.txt`;
    return { ok: false, method: "error", challenge, where, detail: (e as Error).message };
  }
}

/** A readable label for the namespace that was proven, stored on the org as `domain.verified`. */
export function namespaceOf(server: string): string {
  const ns = server.split("/")[0] ?? "";
  return ns.startsWith("io.github.") ? `github.com/${ns.slice("io.github.".length)}` : ns.split(".").reverse().join(".");
}
