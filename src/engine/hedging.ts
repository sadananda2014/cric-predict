import type { Position, RateEntry, Bet, Suggestion, BetType } from '../types';
import { calculateBetPnL } from './pnl';
import { getRateForTeam, stakeToPeti, formatPeti } from './rates';

/**
 * Projects what the position would look like if a hypothetical bet were placed.
 */
export function projectPosition(
  currentPosition: Position,
  hypotheticalBet: Bet,
  teamA: string,
  teamB: string
): Position {
  const pnlA = calculateBetPnL(hypotheticalBet, teamA);
  const pnlB = calculateBetPnL(hypotheticalBet, teamB);

  const newA = currentPosition.teamA_pnl + pnlA;
  const newB = currentPosition.teamB_pnl + pnlB;
  const newStaked = currentPosition.totalStaked + hypotheticalBet.stake;
  const newCount = currentPosition.betCount + 1;

  let classification: Position['classification'];
  if (newA >= 0 && newB >= 0) classification = 'profitable';
  else if (newA < 0 && newB < 0) classification = 'underwater';
  else classification = 'partial';

  return {
    teamA_pnl: newA,
    teamB_pnl: newB,
    totalStaked: newStaked,
    betCount: newCount,
    classification,
  };
}

/**
 * Calculates the optimal hedge bet to equalize P&L on both outcomes.
 */
export function calculateHedgeBet(
  position: Position,
  currentRate: RateEntry,
  teamA: string,
  teamB: string
): { team: string; betType: BetType; amount: number } {
  const { teamA_pnl, teamB_pnl } = position;

  // Determine which side needs hedging — bet on the team whose win gives worse P&L
  let hedgeTeam: string;
  let deficit: number;

  if (teamA_pnl < teamB_pnl) {
    // Team A winning is worse — we need to bet so that if team A wins, we gain
    hedgeTeam = teamA;
    deficit = teamB_pnl - teamA_pnl;
  } else {
    hedgeTeam = teamB;
    deficit = teamA_pnl - teamB_pnl;
  }

  const { rate, betType } = getRateForTeam(
    currentRate,
    hedgeTeam,
    teamA,
    teamB
  );

  // Calculate stake needed: we need the bet profit on hedgeTeam winning minus the loss
  // on hedgeTeam losing to offset the deficit.
  // If hedgeTeam wins: profit = stake * multiplier
  // If hedgeTeam loses: loss = -stake
  // Net swing = stake * multiplier + stake = stake * (multiplier + 1)
  // We need: net swing = deficit
  // So: stake = deficit / (multiplier + 1)
  const multiplier = betType === 'lagaai' ? rate / 100 : 100 / rate;
  const amount = Math.round(deficit / (multiplier + 1));

  return { team: hedgeTeam, betType, amount: Math.max(1, amount) };
}

/**
 * Generates a hedging suggestion based on the current position and rates.
 */
export function generateSuggestion(
  position: Position,
  currentRate: RateEntry,
  teamA: string,
  teamB: string
): Suggestion {
  const worstCase = Math.min(position.teamA_pnl, position.teamB_pnl);

  // Neutral — no bets
  if (position.classification === 'neutral') {
    return {
      action: 'wait',
      team: null,
      amount: null,
      betType: null,
      peti: null,
      reasoning: 'Enter your first bet to get started.',
      projectedPnL: null,
      currentWorstCase: 0,
    };
  }

  // Helper to compute peti + format reasoning
  function hedgePetiInfo(hedge: { team: string; betType: BetType; amount: number }) {
    const rate = hedge.betType === 'lagaai' ? currentRate.lagaaiRate : currentRate.khaaiRate;
    return stakeToPeti(hedge.amount, hedge.betType, rate);
  }

  // Profitable — both outcomes positive
  if (position.classification === 'profitable') {
    const hedge = calculateHedgeBet(position, currentRate, teamA, teamB);
    const petiVal = hedgePetiInfo(hedge);
    const hypotheticalBet: Bet = {
      id: '',
      team: hedge.team,
      betType: hedge.betType,
      rate:
        hedge.betType === 'lagaai'
          ? currentRate.lagaaiRate
          : currentRate.khaaiRate,
      stake: hedge.amount,
      createdAt: '',
    };
    const projected = projectPosition(position, hypotheticalBet, teamA, teamB);

    return {
      action: 'lock_profit',
      team: hedge.team,
      amount: hedge.amount,
      betType: hedge.betType,
      peti: petiVal,
      reasoning: `You're green on both outcomes! Place ${formatPeti(petiVal)} (₹${hedge.amount.toLocaleString('en-IN')}) ${hedge.betType} on ${hedge.team} to balance your position and lock guaranteed profit.`,
      projectedPnL: {
        teamA: Math.round(projected.teamA_pnl),
        teamB: Math.round(projected.teamB_pnl),
      },
      currentWorstCase: Math.round(worstCase),
    };
  }

  // Partial — one positive, one negative → hedge
  if (position.classification === 'partial') {
    const hedge = calculateHedgeBet(position, currentRate, teamA, teamB);
    const petiVal = hedgePetiInfo(hedge);
    const hypotheticalBet: Bet = {
      id: '',
      team: hedge.team,
      betType: hedge.betType,
      rate:
        hedge.betType === 'lagaai'
          ? currentRate.lagaaiRate
          : currentRate.khaaiRate,
      stake: hedge.amount,
      createdAt: '',
    };
    const projected = projectPosition(position, hypotheticalBet, teamA, teamB);

    return {
      action: 'bet_now',
      team: hedge.team,
      amount: hedge.amount,
      betType: hedge.betType,
      peti: petiVal,
      reasoning: `Hedge by placing ${formatPeti(petiVal)} (₹${hedge.amount.toLocaleString('en-IN')}) ${hedge.betType} on ${hedge.team} to equalize your position across both outcomes.`,
      projectedPnL: {
        teamA: Math.round(projected.teamA_pnl),
        teamB: Math.round(projected.teamB_pnl),
      },
      currentWorstCase: Math.round(worstCase),
    };
  }

  // Underwater — both negative
  // Check rate movement (compare current to see if significant)
  const hedge = calculateHedgeBet(position, currentRate, teamA, teamB);
  const petiVal = hedgePetiInfo(hedge);
  const hypotheticalBet: Bet = {
    id: '',
    team: hedge.team,
    betType: hedge.betType,
    rate:
      hedge.betType === 'lagaai'
        ? currentRate.lagaaiRate
        : currentRate.khaaiRate,
    stake: hedge.amount,
    createdAt: '',
  };
  const projected = projectPosition(position, hypotheticalBet, teamA, teamB);
  const projectedWorst = Math.min(projected.teamA_pnl, projected.teamB_pnl);

  // If hedging doesn't improve worst case by much, suggest waiting
  if (Math.abs(projectedWorst - worstCase) < Math.abs(worstCase) * 0.1) {
    return {
      action: 'wait',
      team: null,
      amount: null,
      betType: null,
      peti: null,
      reasoning: `Rate movement too small for an effective hedge. Current worst-case: ₹${Math.round(worstCase).toLocaleString('en-IN')}. Wait for rates to shift further.`,
      projectedPnL: null,
      currentWorstCase: Math.round(worstCase),
    };
  }

  return {
    action: 'reduce_exposure',
    team: hedge.team,
    amount: hedge.amount,
    betType: hedge.betType,
    peti: petiVal,
    reasoning: `Reduce exposure by placing ${formatPeti(petiVal)} (₹${hedge.amount.toLocaleString('en-IN')}) ${hedge.betType} on ${hedge.team}. This minimizes your worst-case from ₹${Math.round(worstCase).toLocaleString('en-IN')} to ₹${Math.round(projectedWorst).toLocaleString('en-IN')}.`,
    projectedPnL: {
      teamA: Math.round(projected.teamA_pnl),
      teamB: Math.round(projected.teamB_pnl),
    },
    currentWorstCase: Math.round(worstCase),
  };
}
