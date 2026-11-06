# World integration debrief

Proofmark uses World twice, at two different trust moments:

- **IDKit, at the maintainer claim.** The protected event is claiming an MCP server's name on ENS. A claim turns a server green for every agent that connects to it, so it must be one person, one claim.
- **Agent Pass, at the agent's spend.** The protected action is an agent paying for, and connecting to, a server. A verified person must have authorized that agent recently.

## Why this credential, and no stronger one

The claim needs **uniqueness**. It does not need legal identity. World cannot tell us that the person holding a credential is the real maintainer, so asking for a passport would add friction without closing that gap. The namespace proof (a GitHub gist or a domain file) and the 50 HBAR bond close it instead. Proof of Human is the minimum that gives one nullifier per person per action, and that is what stops one person from squatting many names. Passport and national ID are accepted as equivalents, for people without an Orb verification. The gateway rejects a proof that used none of the accepted credentials. That set is configured by `WORLD_CREDENTIALS`.

## Time to first success

- **IDKit:** backend verification was written in about an hour. The first proof the gateway accepted came about 19 hours later, after the friction points below.
- **Agent Pass:** the device flow and ID-token validation worked against the World IdP on the first day. A live approval is one tap in World, still to be done. Its result will go in `docs/TESTING.md`.

## Friction encountered

1. A device-only client (Agent Pass for a headless agent) still needs an exact HTTPS redirect URI when it is registered, so we had to host a callback page that is never used.
2. The Developer Portal shows the signer **address** next to the signing **key**. We pasted the address, and the library error ("expected 32 bytes, got 20") did not say which value was wrong.
3. A staging QR code does not open the production World App. Only the simulator works, and the error does not say so.
4. An action allows one verification per person by default. During testing this gave "already verified" with no hint that the limit is a setting on the action.
5. Rejections came back as a generic "could not verify" until we passed World's own reason through.

## Missing capability or documentation

- A table, in the docs, of each credential's assurance and its fallback behavior.
- A test mode for the "credential not available" path.

## The one improvement with the greatest impact

Return specific, actionable errors across the whole flow, for example "staging app id, use the simulator", "this action allows one verification", or "key is an address". Every hour we lost would have been minutes.
