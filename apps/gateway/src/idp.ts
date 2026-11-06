import { randomUUID, createHash } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { env, caps } from "./config";
import { writePass } from "./chain";
import { anchor } from "./hcs";
import { logEvent } from "./store";

/**
 * World ID Agent Pass, through the official World IdP (OpenID Connect).
 * A headless agent authenticates with the Device Authorization Grant: the gateway is the confidential
 * client, a human approves in the World app, the backend validates the ID token, and the validated
 * (iss, sub) is bound to the agent's ENS name. Nothing the client reports is trusted.
 * Guide: https://auth.world.org/docs/guides/oidc#sign-in-a-headless-agent-device-flow
 */
interface Discovery {
  issuer: string;
  jwks_uri: string;
  token_endpoint: string;
  device_authorization_endpoint: string;
}

let discovery: { t: number; v: Discovery } | null = null;
async function getDiscovery(): Promise<Discovery> {
  if (discovery && Date.now() - discovery.t < 10 * 60_000) return discovery.v;
  const r = await fetch(`${env.WORLD_IDP_ISSUER}/.well-known/openid-configuration`, { signal: AbortSignal.timeout(10_000) });
  if (!r.ok) throw new Error(`World IdP discovery failed (${r.status})`);
  const v = (await r.json()) as Discovery;
  if (v.issuer !== env.WORLD_IDP_ISSUER) throw new Error("discovered issuer does not match WORLD_IDP_ISSUER");
  discovery = { t: Date.now(), v };
  return v;
}

const enc = encodeURIComponent;

/** Client authentication in the method the client was registered with. */
function clientAuth(body: URLSearchParams): Record<string, string> {
  if (!caps.agentPass) throw new Error("World Agent Pass is not configured (WORLD_IDP_CLIENT_ID, WORLD_IDP_CLIENT_SECRET)");
  if (env.WORLD_IDP_AUTH_METHOD === "post") {
    body.set("client_id", env.WORLD_IDP_CLIENT_ID!);
    body.set("client_secret", env.WORLD_IDP_CLIENT_SECRET!);
    return {};
  }
  body.set("client_id", env.WORLD_IDP_CLIENT_ID!);
  return { authorization: `Basic ${Buffer.from(`${enc(env.WORLD_IDP_CLIENT_ID!)}:${enc(env.WORLD_IDP_CLIENT_SECRET!)}`).toString("base64")}` };
}

async function form(url: string, body: URLSearchParams) {
  const headers = { "content-type": "application/x-www-form-urlencoded", ...clientAuth(body) };
  const r = await fetch(url, { method: "POST", headers, body, signal: AbortSignal.timeout(15_000) });
  const json = (await r.json().catch(() => ({}))) as Record<string, any>;
  return { status: r.status, json };
}

interface Attempt {
  agent: string;
  deviceCode: string;
  expiresAt: number;
  interval: number;
  lastPoll: number;
}
const attempts = new Map<string, Attempt>();

export interface DeviceStart {
  attemptId: string;
  userCode: string;
  verificationUri: string;
  verificationUriComplete?: string;
  expiresIn: number;
  interval: number;
}

/** Step 1: start the device grant. The device code never leaves the gateway. */
export async function startAgentPass(agent: string): Promise<DeviceStart> {
  const d = await getDiscovery();
  const { status, json } = await form(d.device_authorization_endpoint, new URLSearchParams({ scope: "openid" }));
  if (status !== 200 || !json.device_code) throw new Error(`device authorization failed: ${json.error ?? status} ${json.error_description ?? ""}`.trim());
  const attemptId = randomUUID();
  attempts.set(attemptId, { agent, deviceCode: json.device_code, expiresAt: Date.now() + json.expires_in * 1000, interval: json.interval ?? 5, lastPoll: 0 });
  logEvent({ kind: "pass-requested", agent, detail: `Agent Pass requested for ${agent}. Waiting for a human to approve in World.` });
  return { attemptId, userCode: json.user_code, verificationUri: json.verification_uri, verificationUriComplete: json.verification_uri_complete, expiresIn: json.expires_in, interval: json.interval ?? 5 };
}

const accepted = () => env.WORLD_IDP_ACR.split(",").map((s) => s.trim()).filter(Boolean);

export type PollResult =
  | { status: "pending"; interval: number }
  | { status: "denied" | "expired" | "error"; message: string }
  | { status: "approved"; sub: string; acr: string; authTime: number; tx: string };

/** Step 2: poll no faster than the interval, stop on the rules in the guide, validate, then bind on-chain. */
export async function pollAgentPass(attemptId: string): Promise<PollResult> {
  const a = attempts.get(attemptId);
  if (!a) return { status: "expired", message: "Unknown or finished attempt. Start again." };
  if (Date.now() > a.expiresAt) {
    attempts.delete(attemptId);
    return { status: "expired", message: "The approval window closed. Start again." };
  }
  if (Date.now() - a.lastPoll < a.interval * 1000) return { status: "pending", interval: a.interval };
  a.lastPoll = Date.now();

  const d = await getDiscovery();
  let res;
  try {
    res = await form(d.token_endpoint, new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:device_code", device_code: a.deviceCode }));
  } catch (e) {
    return { status: "error", message: `World IdP unreachable: ${(e as Error).message}` };
  }
  const { status, json } = res;

  if (status === 400 && json.error === "authorization_pending") return { status: "pending", interval: a.interval };
  if (status === 400 && json.error === "slow_down") {
    a.interval += 5;
    return { status: "pending", interval: a.interval };
  }
  if (status === 503) {
    attempts.delete(attemptId);
    return { status: "error", message: "World IdP is temporarily unavailable. This is not an approval. Start again." };
  }
  if (status !== 200) {
    attempts.delete(attemptId);
    const denied = json.error === "access_denied";
    logEvent({ kind: "denied", agent: a.agent, detail: denied ? "The human declined the Agent Pass request." : `Agent Pass failed: ${json.error ?? status}` });
    return { status: denied ? "denied" : json.error === "expired_token" ? "expired" : "error", message: json.error_description ?? json.error ?? `HTTP ${status}` };
  }

  attempts.delete(attemptId); // a device code redeems once
  try {
    const claims = await validateIdToken(json.id_token);
    const hash = await writePass(a.agent, { iss: claims.iss, sub: claims.sub, authTime: claims.authTime, acr: claims.acr });
    const subHash = "0x" + createHash("sha256").update(`${claims.iss}|${claims.sub}`).digest("hex");
    const hcs = await anchor({ type: "agent-pass", agent: a.agent, subHash, acr: claims.acr, authTime: claims.authTime, ensTx: hash }).catch(() => null);
    logEvent({ kind: "pass", agent: a.agent, detail: `Agent Pass bound to ${a.agent}: ${claims.acr.split("/").pop()} Agent Pass`, tx: { chain: "sepolia", id: hash } });
    void hcs;
    return { status: "approved", sub: claims.sub, acr: claims.acr, authTime: claims.authTime, tx: hash };
  } catch (e) {
    logEvent({ kind: "denied", agent: a.agent, detail: `Agent Pass rejected: ${(e as Error).message}` });
    return { status: "denied", message: (e as Error).message };
  }
}

/** Validate the ID token as the guide requires, then enforce the assurance policy. */
async function validateIdToken(idToken: string | undefined) {
  if (!idToken) throw new Error("World IdP returned no ID token");
  const d = await getDiscovery();
  const jwks = createRemoteJWKSet(new URL(d.jwks_uri));
  const { payload } = await jwtVerify(idToken, jwks, { issuer: d.issuer, audience: env.WORLD_IDP_CLIENT_ID!, algorithms: ["RS256"], clockTolerance: 30 });
  const sub = payload.sub;
  const authTime = payload.auth_time;
  const acr = payload.acr;
  const amr = payload.amr;
  if (!sub) throw new Error("ID token has no subject");
  if (typeof authTime !== "number") throw new Error("ID token has no auth_time");
  if (typeof acr !== "string") throw new Error("This World account is not verified. Verify with the World app first.");
  if (!accepted().includes(acr)) throw new Error(`Credential class ${acr} is not accepted. Accepted: ${accepted().join(", ")}`);
  if (!Array.isArray(amr) || !amr.includes("pop")) throw new Error("A fresh World ID proof is required. A passkey alone does not prove a human.");
  if (authTime * 1000 > Date.now() + 60_000) throw new Error("auth_time is in the future");
  if (Date.now() - authTime * 1000 > env.PASS_MAX_AGE_SECONDS * 1000) throw new Error("Authentication is already older than the allowed age");
  return { iss: d.issuer, sub, acr, authTime };
}

export const idpStatus = () => ({ configured: caps.agentPass, issuer: env.WORLD_IDP_ISSUER, maxAgeSeconds: env.PASS_MAX_AGE_SECONDS, acceptedAcr: accepted() });
