# Sponsor feedback

While building Proofmark on Hedera, ENSv2 and World, we hit one architectural pain point in each stack. Each one made us write a workaround in our own code, the kind of workaround every team building the same thing will write again. Each file below explains the problem, shows where we hit it, proposes a fix, and links to our workaround so a judge can check it.

| Sponsor | The pain point, in one line | File |
| --- | --- | --- |
| **Hedera** | An x402 payment cannot draw on a Hedera allowance, so the operator's spending cap is a gate we enforce off-chain, not something the payment is bound to on-chain | [hedera/FEEDBACK.md](hedera/FEEDBACK.md) |
| **ENS** | Resolver roles are scoped per resolver instance, not per name, so every org needs its own resolver contract deployed | [ens/FEEDBACK.md](ens/FEEDBACK.md) |
| **World** | A World ID nullifier is used up the moment a proof is verified, even if the action it protects then fails, so the user cannot retry | [world/FEEDBACK.md](world/FEEDBACK.md) |

Every file has the same sections, so the three are easy to compare:

1. **Summary**
2. **Context:** what we built with the technology
3. **The pain point**
4. **How we hit it:** evidence and steps to reproduce
5. **Why it matters**
6. **Root cause**
7. **What could have been done**
8. **The proposed fix**
9. **Compatibility and migration**
10. **Alternatives we considered**
11. **What Proofmark does today:** the workaround, with code links
12. **How to measure the fix**
13. **Smaller friction**
