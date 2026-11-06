/** The three prize tracks the decks are written for. The slides themselves are in pitchSlides.ts. */
export const DECK_SLIDES = ["Problem", "Solution", "Why this sponsor", "Architecture", "Proof and next"] as const;

export const DECKS = [
  { id: "hedera", sponsor: "Hedera", track: "AI Agents That Pay: x402", logo: "/brands/hedera-wordmark-dark.png", w: 168, h: 34 },
  { id: "ens", sponsor: "ENS", track: "Best Use of ENSv2", logo: "/brands/ens-wordmark-dark.png", w: 112, h: 34 },
  { id: "world", sponsor: "World", track: "Agent Pass and IDKit", logo: "/brands/world-wordmark-dark.png", w: 132, h: 34 },
] as const;
