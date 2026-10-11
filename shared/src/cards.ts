export const CARD_VALUES = ["1", "2", "3", "5", "8", "13", "21", "∞", "?"] as const;

export type CardValue = (typeof CARD_VALUES)[number];

const NUMERIC_CARDS = new Set(["1", "2", "3", "5", "8", "13", "21"]);

export const FIBONACCI_ESTIMATES = [0, 1, 2, 3, 5, 8, 13, 21] as const;

export type FibonacciEstimate = (typeof FIBONACCI_ESTIMATES)[number];

export function isFibonacciEstimate(value: number): value is FibonacciEstimate {
  return (FIBONACCI_ESTIMATES as readonly number[]).includes(value);
}

export function roundToFibonacci(value: number): FibonacciEstimate {
  let best: FibonacciEstimate = FIBONACCI_ESTIMATES[0];
  let bestDistance = Infinity;
  for (const candidate of FIBONACCI_ESTIMATES) {
    const distance = Math.abs(value - candidate);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

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
  return roundToFibonacci(sum / numbers.length);
}
