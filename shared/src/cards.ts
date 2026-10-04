export const CARD_VALUES = ["1", "2", "3", "5", "8", "13", "21", "∞", "?"] as const;

export type CardValue = (typeof CARD_VALUES)[number];

const NUMERIC_CARDS = new Set(["1", "2", "3", "5", "8", "13", "21"]);

export function isCardValue(value: unknown): value is CardValue {
  return typeof value === "string" && (CARD_VALUES as readonly string[]).includes(value);
}

export function numericCardValue(value: CardValue): number | null {
  if (!NUMERIC_CARDS.has(value)) {
    return null;
  }
  return Number(value);
}

export function averageVotes(votes: Array<CardValue | null>): number | null {
  const numbers = votes
    .filter((vote): vote is CardValue => vote !== null)
    .map(numericCardValue)
    .filter((n): n is number => n !== null);

  if (numbers.length === 0) {
    return null;
  }

  const sum = numbers.reduce((acc, n) => acc + n, 0);
  return Math.round((sum / numbers.length) * 10) / 10;
}
