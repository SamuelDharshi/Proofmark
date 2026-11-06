# Proofmark, page by page

How each page works, what to click, and where to see the result on-chain. Live site: https://proofmark-web.vercel.app

## 1. Home `/`

- **What it shows:** the problem and how Proofmark answers it.
- **Do:** scroll.
  - The 3D **P** turns as you scroll.
  - Three checks light up in order: ENS name, World human, Hedera payment.
  - The counter under them is read live from Hedera: HCS messages and HTS certificates.
- **Say:** "An agent never connects to an MCP server on trust. It resolves the maintainer on ENS, checks a human stands behind it with World, and pays on Hedera, where the payment and the proof are logged for anyone to replay."

## 2. Marketplace `/marketplace`

- **What it shows:** MCP servers from the official registry, each graded green, sandboxed or blocked.
- **Do:**
  - Watch the cards flip up into place.
  - Hover a card: it leans toward the cursor.
  - Use the tabs (All, Green, Sandboxed, Blocked) and the search box.
- **Hedera:**
  - Each card shows its price in HBAR (0.02 ℏ, which is $0.002).
  - The dark strip above the cards shows live HCS and HTS totals, and links to the On-chain page.

## 3. Check `/check`

- **Do:** enter a server name, for example `io.github.SamuelDharshi/proofmark-files`.
- **Result:**
  - The tier and the reason.
  - The layers: unique (World), domain-verified (GitHub gist or domain) and bonded (Hedera).
  - The ENS org and the payout account.
- **Say:** "Every value on this page is read from ENS on Sepolia and from Hedera. Nothing comes from our database."

## 4. Server page `/server/<name>`

- **What it shows:** the registry facts, the tool manifest hash, the HTS certificate for the attested version, and links to HashScan and Etherscan.

## 5. Fleet `/fleet`

- **What it shows:** the agents. Each agent card shows:
  - its ENS name, HCS-14 UAID and ERC-8004 id
  - its budget and operator allowance
  - its World Agent Pass state
- **Do:** press **Get pass**, then approve the code in World.
  - The pass is validated on the gateway and written to the agent's ENS name.
- **Denied path:** with no pass, an expired pass or a forged signature, the request is refused before any payment. The feed shows the refusal.

## 6. Claim `/claim` (maintainer)

1. **Server:** enter the registry name, connect MetaMask, then publish the GitHub gist line the page shows and verify.
   - If the server is already yours, the page says so and opens Maintain.
2. **Human:** verify with World ID (IDKit). The gateway checks the proof. A second claim with the same identity is refused.
3. **Organisation:** pick an org name, a Hedera payout account and a price.
   - The gateway writes the org on ENSv2 and shows each Sepolia transaction as it lands.

## 7. Maintain `/maintain`

- The org fills in by itself from ENS.
- **Bond:** paste the transaction id of a 50 HBAR deposit to the bond account, then sign. The gateway checks it on the mirror node and writes `bond.tx` on ENS.
- **Co-maintainer:** add a key with an expiry, then sign. It becomes an ENS subname that can only set `attest.key`.
- **Attest:**
  1. The local worker derives the tool manifest inside a sandbox.
  2. Your wallet signs it.
  3. The gateway writes it to HCS and mints an HTS certificate.
- **Revoke:** one ENS write, plus an HCS message. Connected agents go red within seconds.

## 8. On-chain `/log`

- **What it shows:** everything Proofmark did on Hedera, read straight from the mirror node and refreshed every 8 seconds:
  - HBAR payments and transfers
  - HCS audit and revocation messages
  - HTS mints
  - allowances
- **Do:** click any row to open it on HashScan. Press F12 to see each transaction printed to the browser console.

## 9. Docs `/docs` and Pitch `/pitch`

- **Docs:** how it works, the tiers, the API, and each sponsor integration.
- **Pitch:** three decks (Hedera, ENS, World), five slides each.
  - Arrow keys move between slides.
  - **F** presents full screen.
  - Speaker notes sit under each slide.

## The agent side (terminal)

```
npm start -w @proofmark/proxy -- --server io.github.SamuelDharshi/proofmark-files -- npx -y proofmark-files .
```

The proxy resolves the server on ENS, pays $0.002 over x402 on Hedera with no human approving, checks both hashes, and connects. If the server's tools change, it disconnects.
