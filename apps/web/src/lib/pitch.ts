/** The three pitch decks, one per prize track. Each has the same five slides. */
export const DECK_SLIDES = ["Problem", "Solution", "Why this sponsor", "Architecture", "Proof and next"] as const;

export const DECKS = [
  {
    id: "hedera",
    sponsor: "Hedera",
    track: "AI Agents That Pay: x402",
    line: "A $0.002 check, paid by the agent on Hedera, with HCS revocation, an on-chain allowance and a bond.",
    url: "https://claude.ai/artifact/UzDZCurArvXmLbu4ozmFkK",
    logo: "/brands/hedera-wordmark-dark.png",
    w: 168,
    h: 34,
  },
  {
    id: "ens",
    sponsor: "ENS",
    track: "Best Use of ENSv2",
    line: "ENS as the trust database: per-org resolvers, record-scoped roles, expiring subnames and agents as names.",
    url: "https://claude.ai/artifact/U3JbJQXbSTU1kk6DZXrAGt",
    logo: "/brands/ens-wordmark-dark.png",
    w: 112,
    h: 34,
  },
  {
    id: "world",
    sponsor: "World",
    track: "Agent Pass and IDKit",
    line: "World for spend authority and uniqueness at the claim, framed honestly as one layer of three.",
    url: "https://claude.ai/artifact/R3oiSzMK4LfW8vwDhbp983",
    logo: "/brands/world-wordmark-dark.png",
    w: 132,
    h: 34,
  },
] as const;
