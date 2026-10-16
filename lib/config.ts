import { DEFAULT_TODAY } from './health';

// The brief says: "Treat today as Monday, 12 October 2026". All recency and
// renewal maths uses this date so the tool tells the same story every day.
export const TODAY = process.env.APP_TODAY || DEFAULT_TODAY;

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}
