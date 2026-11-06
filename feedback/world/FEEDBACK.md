# World feedback: a verified proof uses up the nullifier even when the protected action fails

## 1. Summary

World ID's promise to an app is "one person, one action", enforced by the nullifier. In the flow as we built it, a proof is **verified and its nullifier spent in one step**. But the action the proof protects usually happens *after* verification, and it can fail: a chain write times out, a payment bounces, a server restarts. When it does, the person has already used their one verification, and with the default "one verification per action" setting they **cannot try again**.

**Our proposal:** two-phase verification. `verify` **reserves** the nullifier for a short time. The app then calls `commit` when the protected action succeeds, or `release` when it fails. A reservation that is never committed expires by itself. Uniqueness holds, and the user is never locked out by a failure that wasn't theirs.

## 2. Context: what we built

Proofmark uses World at two trust moments:

- **IDKit at the maintainer claim.** "One person, one claim" stops one person from squatting many MCP server names. We accept Proof of Human, passport or national ID, and verify on our backend ([world.ts](../../apps/gateway/src/world.ts)).
- **Agent Pass for agent spend.** A person authorizes an agent to pay ([idp.ts](../../apps/gateway/src/idp.ts)).

The claim is the protected action: **five ENS transactions on Sepolia** after the proof is verified ([routes/claim.ts](../../apps/gateway/src/routes/claim.ts)).

## 3. The pain point

```
  person ──proof──▶ app backend ──verify──▶ World     ✓ valid, nullifier SPENT
                         │
                         ▼
                 protected action (5 chain writes, ~60 s)
                         │
                         ✗ fails at write 3 (RPC timeout, deploy restart, out of gas)
                         │
  person tries again ──proof──▶ verify ──▶ World     ✗ "already verified"
```

The person is real and unique, and did nothing wrong. They are now locked out of the action World was meant to let them do once.

## 4. How we hit it (reproducible)

We hit this live during the hackathon:

1. **The claim failed partway.** A maintainer claim on our hosted gateway stopped after the World proof was verified ("Failed to fetch": the long request was cut off).
2. **The retry was refused.** The new proof came back "already verified".
3. **We had to change the action's settings** in the Developer Portal to allow more verifications, which weakens the "one person, one claim" guarantee the gate exists for.

Steps to reproduce: verify a proof on the backend, make the next step throw, then send a new proof for the same action. With the default limit, it is rejected.

## 5. Why it matters

| Who | Impact |
| --- | --- |
| **Users** | Locked out after a failure that wasn't theirs. Support can't help, because the nullifier is gone |
| **Developers** | Pushed to raise the verification limit, which quietly weakens uniqueness, or to build their own reservation logic |
| **Any action with on-chain or slow steps** | Claims, airdrops, mints, account recovery: exactly the "scarce benefit" uses the IDKit track asks for |
| **World** | "Verified once, then blocked" reads to users as World failing, not as the app failing |

## 6. Root cause

Verification and consumption are fused into one operation. That's correct for an *atomic* action, where verification **is** the action. Most real actions are not atomic. The proof unlocks a multi-step process, and only the app knows whether that process finished. The protocol gives the app no way to say "this did not happen, give the person their action back".

## 7. What could have been done

Payments solved the same problem long ago with **authorize, then capture**. A card is authorized, a hold is placed, and the charge is captured only when the goods ship. Otherwise the hold expires. Nullifiers can work the same way.

## 8. The proposed fix

### 8.1 Two-phase verification

```http
POST /v2/verify/{app_id}            # as today, plus a new option
{ ...proof, "mode": "reserve", "reserve_seconds": 600 }
→ 200 { "nullifier": "0x…", "reservation": "rsv_…", "expires_at": "…" }

POST /v2/reservations/{reservation}/commit    → 200   nullifier permanently spent
POST /v2/reservations/{reservation}/release   → 200   nullifier free again
(no call before expires_at)                   → reservation expires; nullifier free again
```

### 8.2 The rules that keep it safe

- **Uniqueness is never weakened.** While a nullifier is reserved, any other proof with it is refused, exactly like a spent one. Two people can't both claim, and one person can't claim twice in parallel.
- **Reservations are short and bounded,** for example 10 minutes at most, so a stalled app can't hold a nullifier forever.
- **Commit is idempotent,** and only the app that reserved can commit or release (it is signed with the RP key).
- **Default behaviour is unchanged.** Without `mode: "reserve"`, verify spends the nullifier immediately, as today.

### 8.3 The flow after the fix

```
  verify(reserve) ──▶ RESERVED ──protected action succeeds──▶ commit ──▶ SPENT
                         │
                         ├──action fails──▶ release ──▶ FREE (the person can retry)
                         │
                         └──app crashes──▶ (expires) ──▶ FREE
```

### 8.4 For on-chain verification

The same idea maps onto the on-chain verifier contract. A `reserve(nullifier, until)` call, then a `commit` inside the protected transaction. Better still, verify and act in **one transaction**, so failure reverts both. That pattern deserves a prominent place in the docs for multi-step actions.

## 9. Compatibility and migration

- **Opt-in** per request, so existing integrations are unaffected.
- **IDKit** gets a `reserve` option and helpers for `commit` and `release`.
- **The Developer Portal** shows reservations next to verifications, for support.

## 10. Alternatives we considered

| Alternative | Why it falls short |
| --- | --- |
| Raise "verifications per action" | Weakens uniqueness. One person can claim several times |
| A new action per attempt | Breaks uniqueness completely |
| Store the nullifier on our side and let the same nullifier resume (what we do) | Works only if the first verify reached our backend and was saved. Every app must rebuild it |
| Make the protected action atomic | Often impossible: several chain writes, payments or human steps |

## 11. What Proofmark does today

- **Resume with the same nullifier.** We store the nullifier the moment World verifies it. If the claim then fails, a retry with that nullifier for the *same org* is accepted, and the claim resumes where it stopped ([routes/claim.ts](../../apps/gateway/src/routes/claim.ts), the `prior` branch).
- **A polled job.** The claim runs as a background job the page polls, so a dropped connection no longer kills it.
- **Real reasons passed through.** We show World's own rejection reason to the user, instead of a generic "could not verify".

This is a reservation scheme built on our side. The proposal moves it into World, so nobody has to rebuild it.

## 12. How to measure the fix

- **A protected action that fails after verification** can be retried by the same person, with **no change** to the verification limit.
- **Two parallel proofs from one person** still produce exactly one success.
- **Reservations that are never committed** are freed within `reserve_seconds`.

## 13. Smaller friction we hit

Full detail is in [docs/WORLD_DEBRIEF.md](../../docs/WORLD_DEBRIEF.md).

| Friction | Suggestion |
| --- | --- |
| The Developer Portal shows the signer **address** next to the signing **key**. Pasting the address gives "expected 32 bytes, got 20" | Label them clearly, and have the error say "this looks like an address, not a key" |
| A staging QR code doesn't open the production World App, and nothing says to use the simulator | Detect staging, then show "use the simulator" in the IDKit dialog |
| A device-only Agent Pass client still needs an exact HTTPS redirect URI | Make the redirect URI optional for the device grant |
| Rejections came back as a generic message | Return a specific, documented reason code for each failure |
