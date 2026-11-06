# ENS feedback: resolver roles are scoped per resolver, not per name

## 1. Summary

ENSv2's Permissioned Resolver and Enhanced Access Control (EAC) make a powerful promise: *give someone the right to change exactly one record on exactly one name*. As we used it, a role granted on a resolver applies to **every name that resolver instance serves**. The only safe way to give two parties separate permissions is to give each of them **their own resolver contract**.

For any product with many tenants (orgs, teams, users, agents), that means deploying a resolver proxy per tenant: extra gas, extra transactions, extra addresses to track, and an onboarding flow that can fail halfway.

**Our proposal:** resource-scoped grants in the Permissioned Resolver. A role is granted for one name (a `namehash`), optionally for one record key, and optionally until an expiry. One shared resolver can then safely serve thousands of tenants.

## 2. Context: what we built

Proofmark puts every MCP server maintainer on ENSv2 (Sepolia):

```
proofmark.eth
├── sam.proofmark.eth                 org: payto, price, bond.tx, domain.verified, ...
│   ├── main.sam.proofmark.eth        co-maintainer: may set attest.key, nothing else
│   └── bob.sam.proofmark.eth         co-maintainer: may set attest.key, nothing else
└── claude-1.agents.proofmark.eth     agent: budget, allowed.tools, pass.*, erc8004
```

The security property we need is simple. **Bob can rotate his own `attest.key` and nothing else.** He must not touch `status`, `payto` or any other org's records. A write he isn't allowed must revert (`EACUnauthorizedAccountRoles`), and we show that revert as evidence.

## 3. The pain point

A grant like "Bob may call `setText(…, "attest.key", …)`" is scoped to the resolver contract. If `sam` and `acme` shared one resolver, a role meant for `bob.sam` would also cover every name `acme` keeps on that resolver.

So every org claim deploys its own contracts:

```
claim "sam"  ──▶ deployProxy(PermissionedResolverImpl)   tx 1   new resolver for sam only
             ──▶ deployProxy(UserRegistryImpl)           tx 2   new subname registry for sam
             ──▶ register sam in the root registry       tx 3
             ──▶ write org records                       tx 4
             ──▶ register the server name                tx 5
```

Five Sepolia transactions, about a minute, before a maintainer can do anything. Ours runs as a background job that can resume halfway, because a hosted gateway's HTTP request kept timing out ([routes/claim.ts](../../apps/gateway/src/routes/claim.ts)).

## 4. How we hit it (reproducible)

- **Our code:** [ens.ts](../../apps/gateway/src/ens.ts), `registerOrg`, calls `deployProxy` on the `VerifiableFactory` for a resolver and a registry **per org**.
- **Live:** look at any Proofmark org claim on Sepolia, for example the [resolver deploy](https://sepolia.etherscan.io/tx/0xc5b8d89f42498ee44f3d51a839b26e54f729ba73b699b7cb685bc5c9dc169783) and the [registry deploy](https://sepolia.etherscan.io/tx/0x8a2251888028671212db07806cdf7e1c05c6654436c356721ad5a05a0fbc763e) for one org.
- **To reproduce the problem:** put two orgs on one resolver, grant org A's co-maintainer a `setText` role, then call `setText` on a name of org B. Per our reading of the EAC model, it succeeds, which is why we never shipped it that way.

## 5. Why it matters

| Who | Impact |
| --- | --- |
| **Multi-tenant apps** (registries, DAOs, agent fleets) | Gas and latency grow with the number of tenants. Onboarding is several transactions, and each one can fail |
| **Agents as names** | Giving each agent its own scoped permissions means a contract per agent, which is the opposite of cheap, disposable identities |
| **Indexers and clients** | Thousands of resolver addresses to discover and track instead of one |
| **ENS** | The access-control feature that sets v2 apart is the one that is hardest to use at scale |

## 6. Root cause

EAC roles are keyed by **(account, role bitmap)** on a contract. The argument-scoped variant narrows *which function arguments* are allowed, but the grant still lives on the resolver as a whole. The resolver has no first-class idea of "this grant applies to this node only". Ownership of a name does not imply resolver roles either: owning `bob.sam.proofmark.eth` grants nothing on the resolver until a role is granted explicitly.

## 7. What could have been done

The Permissioned Resolver already knows which node every write targets: the `node` argument of `setText`, `setAddr` and the rest. Keying grants by **(node, account, role)** instead of **(account, role)** costs one extra mapping dimension. It would make one resolver safe for any number of tenants.

## 8. The proposed fix

### 8.1 Resource-scoped grants

```solidity
// grant: `account` may perform `roles` on `node`, only for record `key` (0 = any), until `expiry` (0 = forever)
function grantNodeRoles(bytes32 node, address account, uint256 roles, bytes32 key, uint64 expiry) external;
function revokeNodeRoles(bytes32 node, address account, uint256 roles) external;

// check inside every setter
modifier onlyNodeRole(bytes32 node, uint256 role, bytes32 key) {
    require(
        hasRootRoles(role, msg.sender) ||          // existing resolver-wide grant, unchanged
        hasNodeRole(node, msg.sender, role, key),  // NEW: this name, this key, not expired
        EACUnauthorizedAccountRoles(...)
    );
    _;
}
```

### 8.2 Inherit from the name owner

Make "the owner of a name may manage grants on that name" the default. Then the owner of `sam.proofmark.eth` can grant `bob.sam` a role on `attest.key` **without asking the resolver admin**.

### 8.3 Expiry and events built in

- An `expiry` on each grant, so a co-maintainer's rights lapse with their subname. No clean-up transaction, and nobody has to remember.
- Emit `NodeRolesGranted` and `NodeRolesRevoked` with `(node, account, roles, key, expiry)`, so clients can watch one resolver for every permission change.

### 8.4 The result

```
claim "sam"  ──▶ register sam in the root registry (shared resolver)   tx 1
             ──▶ write org records                                     tx 2
add co-maintainer bob ──▶ grantNodeRoles(bob.sam, bob, SET_TEXT, "attest.key", +180d)
```

That's five transactions down to two, no contract deployments, one resolver address for the whole namespace, and expiring per-key grants that need no clean-up.

## 9. Compatibility and migration

- **Additive.** Resolver-wide grants keep working, and `hasRootRoles` is checked first.
- Existing per-tenant resolvers keep working. New tenants can use the shared one.
- Clients see the same `setText` and `text` interface. Only the grant calls are new.

## 10. Alternatives we considered

| Alternative | Why it falls short |
| --- | --- |
| One resolver per tenant (what we do) | Gas and latency per tenant, and many addresses to track |
| One shared resolver with an app server as gatekeeper | Puts a trusted server back in the path, which defeats on-chain permissions |
| A custom resolver contract | Gives up the audited Permissioned Resolver, and everyone writes their own |
| Separate subname registries only, no resolver roles | Registries control names, not records, so per-key permissions are still impossible |

## 11. What Proofmark does today

- **A resolver and a registry proxy per org,** deployed through the `VerifiableFactory` ([ens.ts](../../apps/gateway/src/ens.ts) `registerOrg`).
- **A per-co-maintainer role** that can set `attest.key` and nothing else. Writing `status` reverts with `EACUnauthorizedAccountRoles`.
- **Claims run as a resumable background job,** because five sequential transactions don't fit in one hosted HTTP request ([routes/claim.ts](../../apps/gateway/src/routes/claim.ts)).
- **Expiry is enforced at read time,** from the subname's expiry ([chain.ts](../../apps/gateway/src/chain.ts) `readKey`), because grants don't expire on their own.

## 12. How to measure the fix

- **Onboarding one tenant** takes 2 transactions instead of 5, with no deployments.
- **An unauthorised cross-tenant write** reverts on a shared resolver.
- **An expired grant** stops working at its expiry with no transaction sent.
- **One `eth_getLogs` call** on one resolver lists every permission change for every tenant.

## 13. Smaller friction we hit

| Friction | Suggestion |
| --- | --- |
| Reading a name's current owner from the ENSv2 registry went through `getState(anyId)`, which wasn't obvious from the docs | A plain `ownerOf(label)` view, and a docs example |
| Sepolia addresses and ABIs came from the deployments table, which we exported by hand | A versioned npm package of addresses and ABIs for each network |
| Expiring subnames emit nothing at expiry, so clients must poll to learn a key has lapsed | Document this clearly, and pair it with the grant events above |
