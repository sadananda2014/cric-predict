export type BetType = 'lagaai' | 'khaai';

export type MatchStatus = 'active' | 'completed';

export type SuggestionAction = 'bet_now' | 'wait' | 'lock_profit' | 'reduce_exposure';

export type PositionClassification = 'profitable' | 'partial' | 'underwater' | 'neutral';

export interface Bet {
  id: string;
  team: string;
  betType: BetType;
  rate: number;
  stake: number;
  createdAt: string;
}

export interface RateEntry {
  id: string;
  favouriteTeam: string;
  lagaaiRate: number;
  khaaiRate: number;
  createdAt: string;
}

export interface Match {
  id: string;
  teamA: string;
  teamB: string;
  status: MatchStatus;
  winner: string | null;
  bets: Bet[];
  rateEntries: RateEntry[];
  createdAt: string;
  completedAt: string | null;
}

export interface Position {
  teamA_pnl: number;
  teamB_pnl: number;
  totalStaked: number;
  betCount: number;
  classification: PositionClassification;
}

export interface Suggestion {
  action: SuggestionAction;
  team: string | null;
  amount: number | null;
  betType: BetType | null;
  peti: number | null;
  reasoning: string;
  projectedPnL: { teamA: number; teamB: number } | null;
  currentWorstCase: number;
}
