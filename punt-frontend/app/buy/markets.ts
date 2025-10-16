export type Market = {
  id: string;
  product: string;
  question: string;
  targetUsd: number;
  deadline: string;
  currentPriceUsd: number;
  yesPool: number;
  noPool: number;
  packType: string;
  media: {
    src: string;
    alt: string;
  };
  oddsHistory: Array<{
    timestamp: string;
    yes: number;
    no: number;
  }>;
};

export const demoMarkets: Market[] = [
  {
    id: "venusaur-ex-sir",
    product: "Venusaur Ex #198",
    question: "Will Venusaur Ex #198 hit a price $95.00 USD by January 2026?",
    packType: "",
    targetUsd: 95,
    deadline: "Jan 15, 2026",
  currentPriceUsd: 74.95,
    yesPool: 482,
    noPool: 338,
    media: {
      src: "/media/markets/pokemon/venusaur-ex-198.jpg",
      alt: "Venusaur ex Special Illustration Rare card art",
    },
    oddsHistory: [
      { timestamp: "2025-08-01", yes: 52, no: 48 },
      { timestamp: "2025-09-01", yes: 55, no: 45 },
      { timestamp: "2025-10-01", yes: 58, no: 42 },
      { timestamp: "2025-11-01", yes: 61, no: 39 },
      { timestamp: "2025-12-01", yes: 63, no: 37 },
    ],
  },
  {
    id: "charizard-ex-sir",
    product: "Charizard Ex #199",
    question: "Will Charizard Ex #199 hit a price of $350.00 USD before year end?",
    packType: "",
    targetUsd: 350,
    deadline: "Dec 31, 2025",
  currentPriceUsd: 291.95,
    yesPool: 326,
    noPool: 401,
    media: {
      src: "/media/markets/pokemon/charizard-ex-199.jpg",
      alt: "Charizard ex Special Illustration Rare card art",
    },
    oddsHistory: [
      { timestamp: "2025-08-01", yes: 42, no: 58 },
      { timestamp: "2025-09-01", yes: 44, no: 56 },
      { timestamp: "2025-10-01", yes: 47, no: 53 },
      { timestamp: "2025-11-01", yes: 49, no: 51 },
      { timestamp: "2025-12-01", yes: 51, no: 49 },
    ],
  },
  {
    id: "blastoise-ex-sir",
    product: "Blastoise Ex #200",
    question: "Will Blastoise Ex #200 SIR hit a price of $120.00 USD by mid 2026?",
    packType: "",
    targetUsd: 120,
    deadline: "June 30, 2026",
  currentPriceUsd: 91.72,
    yesPool: 291,
    noPool: 561,
    media: {
      src: "/media/markets/pokemon/blastoise-ex-200.jpg",
      alt: "Blastoise ex Special Illustration Rare card art",
    },
    oddsHistory: [
      { timestamp: "2025-03-01", yes: 48, no: 52 },
      { timestamp: "2025-04-01", yes: 53, no: 47 },
      { timestamp: "2025-05-01", yes: 57, no: 43 },
      { timestamp: "2025-06-01", yes: 60, no: 40 },
      { timestamp: "2025-07-01", yes: 64, no: 36 },
      { timestamp: "2025-10-16", yes: 34, no: 66 },
    ],
  },
];

export const formatSol = (value: number, options?: Intl.NumberFormatOptions) =>
  `${value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
    ...options,
  })} SOL`;

export const formatSolDetailed = (value: number) =>
  `${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} SOL`;

export const formatUsd = (value: number, options?: Intl.NumberFormatOptions) =>
  `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options,
  })}`;
