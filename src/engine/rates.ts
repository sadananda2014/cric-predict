import type { RateEntry, BetType } from '../types';

export function getUnderdogTeam(
  rateEntry: RateEntry,
  teamA: string,
  teamB: string
): string {
  return rateEntry.favouriteTeam === teamA ? teamB : teamA;
}

export function getRateForTeam(
  rateEntry: RateEntry,
  team: string,
  _teamA: string,
  _teamB: string
): { rate: number; betType: BetType } {
  if (team === rateEntry.favouriteTeam) {
    return { rate: rateEntry.lagaaiRate, betType: 'lagaai' };
  }
  return { rate: rateEntry.khaaiRate, betType: 'khaai' };
}

const PETI = 100_000;

/**
 * Convert a stake (₹) to peti.
 * Lagaai stake is straightforward: peti = stake / 1L
 * Khaai stake: peti = stake / (khaaiRate × 1000)
 */
export function stakeToPeti(
  stake: number,
  betType: BetType,
  rate: number
): number {
  if (betType === 'lagaai') {
    return stake / PETI;
  }
  return stake / (rate * 1000);
}

/**
 * Convert peti to stake (₹).
 */
export function petiToStake(
  peti: number,
  betType: BetType,
  rate: number
): number {
  if (betType === 'lagaai') {
    return peti * PETI;
  }
  return peti * rate * 1000;
}

/**
 * Format a peti value for display (e.g. 2.5 peti, 0.25 peti)
 */
export function formatPeti(petiVal: number): string {
  if (petiVal === Math.floor(petiVal)) {
    return `${petiVal} peti`;
  }
  // Show up to 2 decimal places, strip trailing zeros
  return `${parseFloat(petiVal.toFixed(2))} peti`;
}
