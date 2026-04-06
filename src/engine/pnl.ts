import type { Bet, Position, PositionClassification } from '../types';

export function calculateBetPnL(bet: Bet, winningTeam: string): number {
  if (bet.team === winningTeam) {
    if (bet.betType === 'lagaai') {
      return bet.stake * (bet.rate / 100);
    }
    // khaai
    return bet.stake * (100 / bet.rate);
  }
  return -bet.stake;
}

export function calculatePosition(
  bets: Bet[],
  teamA: string,
  teamB: string
): Position {
  if (bets.length === 0) {
    return {
      teamA_pnl: 0,
      teamB_pnl: 0,
      totalStaked: 0,
      betCount: 0,
      classification: 'neutral',
    };
  }

  let teamA_pnl = 0;
  let teamB_pnl = 0;
  let totalStaked = 0;

  for (const bet of bets) {
    teamA_pnl += calculateBetPnL(bet, teamA);
    teamB_pnl += calculateBetPnL(bet, teamB);
    totalStaked += bet.stake;
  }

  let classification: PositionClassification;
  if (teamA_pnl >= 0 && teamB_pnl >= 0) {
    classification = 'profitable';
  } else if (teamA_pnl < 0 && teamB_pnl < 0) {
    classification = 'underwater';
  } else {
    classification = 'partial';
  }

  return {
    teamA_pnl,
    teamB_pnl,
    totalStaked,
    betCount: bets.length,
    classification,
  };
}
