# Hedera feedback: x402 payments cannot be bound to a Hedera allowance

## 1. Summary

The pitch for x402 on Hedera is "agents pay on their own, safely". Hedera has a native primitive made for the "safely" half: **crypto allowances**. An owner approves a spender up to a cap, and can revoke that approval in one transaction.

Today, though, the x402 `exact` scheme on Hedera settles a plain transfer **from the agent's own account**. There is no defined way for an x402 payment to spend *from an allowance*. So the operator's cap, the thing that makes autonomous spend safe, cannot be the source of the money. Every team ends up building spending controls off-chain, in its own gateway or client, and a facilitator cannot enforce them.

**Our proposal:** an allowance-aware variant of the Hedera `exact` scheme. The agent signs an approved transfer that debits the operator's account through its allowance, and the facilitator checks the remaining allowance on the mirror node before it settles. The operator's cap and revoke button then become on-chain properties of every x402 payment.

## 2. Context: what we built

Proofmark is a trust gate for MCP servers. Before an agent connects to a server, it pays the maintainer $0.002 over x402 on Hedera, settled by the Blocky402 facilitator. The Hedera track asks for **spending controls for agents**, and Hedera allowances are the obvious tool. We use:

- **x402 `exact` on `hedera:testnet`** for each connect ([x402.ts](../../apps/gateway/src/x402.ts)).
- **`AccountAllowanceApproveTransaction`** from the operator to the agent, with a cap ([allowance.ts](../../apps/gateway/src/allowance.ts)).
- **The mirror node** endpoint `/accounts/{owner}/allowances/crypto?spender.id=` to read what is left.

## 3. The pain point

We wanted the payment flow below. Today it cannot be expressed:

```
  Operator ──approve 5 HBAR──▶ Agent        (on-chain cap, revocable)
                                 │
                                 │  x402 payment of 0.02 HBAR
                                 ▼
             debit the OPERATOR through the allowance, credit the maintainer
             facilitator refuses if the allowance is gone or used up
```

What actually happens:

```
  Operator ──approve 5 HBAR──▶ Agent        (recorded, but nothing in x402 reads it)
  Agent's OWN balance ──x402──▶ Maintainer  (allowance not involved)
```

The allowance and the payment are disconnected. Revoking the allowance does **not** stop the agent paying, unless some application layer remembers to check first.

## 4. How we hit it (reproducible)

1. Approve an allowance from the operator to the agent:
   `npm run allowance -w @proofmark/gateway -- approve 5`
2. Run an x402 payment from the agent. It settles from the agent's account, as a plain `CRYPTOTRANSFER` with the agent as payer. Our settled example is [0.0.7162784-1793921712-374513238](https://hashscan.io/testnet/transaction/0.0.7162784-1793921712-374513238).
3. Withdraw the allowance: `npm run allowance -w @proofmark/gateway -- withdraw`. Our run is [0.0.8149406-1794004134-445493937](https://hashscan.io/testnet/transaction/0.0.8149406-1794004134-445493937).
4. The facilitator would still settle the next x402 payment. Only our **own gateway check** refuses it ([routes/attest.ts](../../apps/gateway/src/routes/attest.ts), the `allowance-invalid` branch).

## 5. Why it matters

| Who | Impact |
| --- | --- |
| **Operators** | "I revoked the agent's spending" is only true if every gateway it talks to is honest and checks first. |
| **Agent builders** | Each team re-implements budgets, allowlists and caps in its client, in different and incompatible ways. |
| **Facilitators** | They cannot offer "spend controls" as a feature, because the payload carries no link to an owner's approval. |
| **Hedera** | The best thing Hedera has for safe agent spend, native, revocable, mirror-node-visible allowances, goes unused by its flagship agent payment standard. |

## 6. Root cause

The `exact` scheme on Hedera was modelled on the EVM pattern: the payer signs a transfer of their *own* funds. On EVM, `transferFrom` after `approve` is how delegated spending works, and x402 on EVM can express that through EIP-3009 or Permit2-style flows. On Hedera, the equivalent is an **approved transfer**: `TransferTransaction.addApprovedHbarTransfer` or `addApprovedTokenTransfer`, signed by the spender. The Hedera scheme spec and the facilitators treat the payer and the debited account as the same account, so the approved-transfer path was never specified.

## 7. What could have been done

When x402 was ported to Hedera, the port could have mapped *both* EVM patterns: a direct transfer **and** a delegated one. The delegated one maps onto approved transfers. The spec would need one extra field (the owner account) and one extra facilitator check (the allowance, read from the mirror node).

## 8. The proposed fix

### 8.1 Scheme: `exact`, with an optional `owner`

```jsonc
// PaymentRequirements: unchanged
{ "scheme": "exact", "network": "hedera:testnet", "asset": "0.0.0", "amount": "2000000", "payTo": "0.0.8149406" }

// PaymentPayload: new optional field
{
  "scheme": "exact",
  "payload": {
    "transaction": "<base64 TransferTransaction, signed by the agent (spender)>",
    "owner": "0.0.8149406"   // NEW: the account that is debited through the allowance
  }
}
```

### 8.2 The agent builds an approved transfer

```ts
new TransferTransaction()
  .addApprovedHbarTransfer(owner, Hbar.fromTinybars(-amount))  // debited via the allowance
  .addHbarTransfer(payTo, Hbar.fromTinybars(amount))
  .setTransactionId(TransactionId.generate(facilitatorFeePayer)) // the facilitator still pays fees
  .freezeWith(client)
  .sign(agentKey);                                                // the spender signs, not the owner
```

### 8.3 The facilitator verifies before settling

```
verify(payload):
  1. decode the transaction; the only debit is `owner`, marked as approved
  2. GET /api/v1/accounts/{owner}/allowances/crypto?spender.id={agent}
       → amount_granted / amount remaining ≥ requirement.amount, else reject "allowance-insufficient"
  3. credit equals payTo · amount, and the fee payer is the facilitator   (as today)
settle(payload):
  4. co-sign as fee payer and submit. Hedera itself enforces the allowance at consensus
```

Step 4 is what makes this better than any off-chain check. **The network enforces the cap.** If the operator revokes between verify and settle, the transaction fails with `SPENDER_DOES_NOT_HAVE_ALLOWANCE` and no money moves.

### 8.4 What it unlocks

```
  Operator wallet ──approve(agent-1, 5 ℏ)──▶   revoke: one transaction, every facilitator honours it
                 ──approve(agent-2, 1 ℏ)──▶   per-agent caps, visible on HashScan
                 ──approve(agent-3, 0 ℏ)──▶   a paused agent, with no app logic needed
```

Per-agent budgets, instant revocation and an audit trail all come from the network, with no custom code in any client.

## 9. Compatibility and migration

- **Backwards compatible.** `owner` is optional. Without it, the scheme behaves exactly as today.
- **Facilitators** add one mirror-node read in `verify` and handle one new error.
- **Clients** (`@x402/hedera`) add an `owner` option to the payment signer.
- **Tokens** work the same way through `addApprovedTokenTransfer` and token allowances, so it covers USDC on HTS too.

## 10. Alternatives we considered

| Alternative | Why it falls short |
| --- | --- |
| Operator tops up the agent's account periodically | The cap becomes "whatever is in the account". Revoking means draining it, and an agent can be refilled by mistake. |
| Scheduled transactions with the operator as co-signer | A human or service must sign every payment, which breaks "no human approving". |
| Off-chain checks in each gateway (what we do) | Only as strong as the most careless gateway, and facilitators cannot enforce it. |
| A smart-contract wallet | Possible on Hedera EVM, but it leaves native accounts and allowances behind, and adds gas and audit cost. |

## 11. What Proofmark does today

- **Our own gate:** the gateway reads the allowance from the mirror node before it quotes or accepts a payment ([allowance.ts](../../apps/gateway/src/allowance.ts)), and refuses with `allowance-invalid` when it's gone.
- **Live run:** our end-to-end run shows a [withdraw](https://hashscan.io/testnet/transaction/0.0.8149406-1794004134-445493937) turning payment off, and an [approve](https://hashscan.io/testnet/transaction/0.0.8149406-1794004142-331722408) turning it back on.
- **Stated honestly:** the README says the allowance is "the operator's revocable authority and the gate, not the funding source". That is exactly the gap this proposal closes.

## 12. How to measure the fix

- A facilitator **refuses** a payment within one mirror-node read of an allowance being revoked, with no app code.
- A payment that races a revoke **fails at consensus** with `SPENDER_DOES_NOT_HAVE_ALLOWANCE`.
- HashScan shows each x402 payment as an approved transfer, with owner, spender and payee all visible.

## 13. Smaller friction we hit

| Friction | Suggestion |
| --- | --- |
| Transaction ids appear in two formats: `0.0.x@s.n` from the SDK, and `0.0.x-s-n` in mirror-node URLs. Every app writes a normaliser ([bond.ts](../../apps/gateway/src/bond.ts) `normalizeTxId`) | The mirror node accepts both forms |
| An HCS subscription in a browser or a serverless function means polling REST, because gRPC streams aren't available there | A server-sent events endpoint on the mirror node for topic messages |
| Testnet USDC token ids differ between docs and facilitators | `GET /supported` on facilitators lists the token ids, and the docs link to it instead of hard-coding ids |
