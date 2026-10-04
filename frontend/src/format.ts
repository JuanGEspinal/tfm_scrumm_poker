export function formatAverage(value: number | null): string {
  return value === null ? "—" : String(value);
}
