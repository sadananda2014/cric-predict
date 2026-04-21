/**
 * Predictive Analysis Engine
 *
 * Combines multiple signals to generate actionable predictions:
 * 1. Win Probability — estimated from live match situation (score/overs/wickets)
 * 2. Market Implied Probability — what the current rate says
 * 3. Value Detection — when market ≠ reality → profit opportunity
 * 4. Rate Momentum — rate trend direction and speed
 * 5. Smart Advisor — combined signal with clear action
 */

import type { Bet, RateEntry } from '../types';
import { calculatePosition } from './pnl';
import { projectPosition } from './hedging';
import { formatPeti } from './rates';

// ─── Types ──────────────────────────────────────────────────────────

export interface MatchSituation {
  battingTeam: string;
  bowlingTeam: string;
  runs: number;
  wickets: number;
  overs: number;
  target: number | null;   // null if 1st innings
  innings: 1 | 2;
}

export interface WinProbability {
  teamA: number;  // 0–100
  teamB: number;  // 0–100
  confidence: 'low' | 'medium' | 'high';
  source: string;
}

export interface MarketImplied {
  favouriteProb: number;   // 0–100
  underdogProb: number;    // 0–100
  favouriteTeam: string;
  underdogTeam: string;
}

export interface ValueBet {
  team: string;
  betType: 'lagaai' | 'khaai';
  edge: number;           // percentage edge (model_prob - market_prob)
  signal: 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'AVOID';
  peti: number;           // recommended peti
  projectedWin: number;
  projectedLoss: number;
  reasoning: string;
}

export interface RateMomentum {
  direction: 'rising' | 'falling' | 'stable';
  speed: 'fast' | 'moderate' | 'slow';
  change5: number;        // rate change in last 5 entries
  change10: number;       // rate change in last 10 entries
  prediction: string;     // "Rate likely to continue rising"
}

export interface PredictionSignal {
  action: 'PLAY_NOW' | 'WAIT' | 'SURE_PROFIT' | 'HIGH_VALUE' | 'HEDGE_NOW';
  confidence: number;     // 0–100
  team: string | null;
  betType: 'lagaai' | 'khaai' | null;
  peti: number | null;
  title: string;
  detail: string;
  reasoning: string[];
}

export interface PredictionResult {
  winProbability: WinProbability;
  marketImplied: MarketImplied;
  valueBets: ValueBet[];
  momentum: RateMomentum;
  signals: PredictionSignal[];
  timestamp: string;
}

// ─── Win Probability Calculator ─────────────────────────────────────

/**
 * IPL T20 win probability based on match situation.
 *
 * Uses historical IPL averages:
 * - Average 1st innings score: ~170
 * - Average run rate: ~8.5
 * - Par scores by over (1st innings)
 * - Chase success rates by required run rate and wickets
 */

// Par score at each over in 1st innings (IPL averages)
const PAR_SCORE_BY_OVER: Record<number, number> = {
  1: 9, 2: 18, 3: 26, 4: 34, 5: 42, 6: 52,
  7: 60, 8: 68, 9: 76, 10: 85, 11: 93, 12: 101,
  13: 110, 14: 118, 15: 128, 16: 138, 17: 148, 18: 157, 19: 165, 20: 170,
};

// Chase win probability based on required run rate (RRR) and wickets in hand
function chaseWinProb(rrr: number, wicketsInHand: number, oversLeft: number): number {
  // Base probability from required run rate
  let baseProb: number;
  if (rrr <= 6) baseProb = 85;
  else if (rrr <= 7) baseProb = 75;
  else if (rrr <= 8) baseProb = 65;
  else if (rrr <= 9) baseProb = 55;
  else if (rrr <= 10) baseProb = 45;
  else if (rrr <= 11) baseProb = 35;
  else if (rrr <= 12) baseProb = 25;
  else if (rrr <= 14) baseProb = 15;
  else if (rrr <= 18) baseProb = 8;
  else baseProb = 3;

  // Wicket adjustment: more wickets in hand → higher chance
  const wicketBonus = (wicketsInHand - 5) * 3; // ±15% swing
  baseProb += wicketBonus;

  // Overs left adjustment: more overs → better for chasing
  if (oversLeft > 10) baseProb += 5;
  else if (oversLeft < 4) baseProb -= 10;
  else if (oversLeft < 2) baseProb -= 20;

  return Math.max(2, Math.min(98, baseProb));
}

export function calculateWinProbability(
  situation: MatchSituation | null,
  teamA: string,
  _teamB: string,
): WinProbability {
  // If no live data, return 50/50 with low confidence
  if (!situation) {
    return { teamA: 50, teamB: 50, confidence: 'low', source: 'No live data — using default 50/50' };
  }

  const { battingTeam, runs, wickets, overs, target, innings } = situation;

  const isBattingA = battingTeam.toLowerCase().includes(teamA.toLowerCase()) ||
    teamA.toLowerCase().includes(battingTeam.toLowerCase().split(' ')[0]);

  let battingWinProb: number;

  if (innings === 1) {
    // 1st innings: compare with par score
    const overInt = Math.min(20, Math.max(1, Math.floor(overs)));
    const par = PAR_SCORE_BY_OVER[overInt] || 85;
    const diff = runs - par;

    // Above par → batting team is doing well → bowling team will have harder chase
    // So batting team's win prob goes UP as they score above par
    battingWinProb = 50 + (diff * 0.8);

    // Wickets lost reduce batting win probability
    battingWinProb -= wickets * 2.5;

    // Late overs with lots of wickets = bad
    if (overs > 15 && wickets >= 7) battingWinProb -= 10;

    // Powerplay bonus for high scoring
    if (overs <= 6 && runs > 55) battingWinProb += 5;

    battingWinProb = Math.max(15, Math.min(85, battingWinProb));

    return {
      teamA: isBattingA ? Math.round(battingWinProb) : Math.round(100 - battingWinProb),
      teamB: isBattingA ? Math.round(100 - battingWinProb) : Math.round(battingWinProb),
      confidence: overs >= 10 ? 'medium' : 'low',
      source: `1st innings: ${runs}/${wickets} in ${overs} ov (par: ${par})`,
    };
  } else {
    // 2nd innings: chase calculation
    if (!target) {
      return { teamA: 50, teamB: 50, confidence: 'low', source: 'Missing target' };
    }

    const runsNeeded = target - runs;
    const oversLeft = 20 - overs;
    const wicketsInHand = 10 - wickets;

    if (runsNeeded <= 0) {
      // Chase completed
      battingWinProb = 100;
    } else if (wicketsInHand <= 0 || oversLeft <= 0) {
      battingWinProb = 0;
    } else {
      const rrr = runsNeeded / oversLeft;
      battingWinProb = chaseWinProb(rrr, wicketsInHand, oversLeft);
    }

    const confidence = overs >= 10 ? 'high' : overs >= 5 ? 'medium' : 'low';

    return {
      teamA: isBattingA ? Math.round(battingWinProb) : Math.round(100 - battingWinProb),
      teamB: isBattingA ? Math.round(100 - battingWinProb) : Math.round(battingWinProb),
      confidence,
      source: `2nd innings: need ${runsNeeded} from ${oversLeft.toFixed(1)} ov, ${wicketsInHand} wkts`,
    };
  }
}

// ─── Market Implied Probability ─────────────────────────────────────

export function getMarketImplied(rate: RateEntry, teamA: string, teamB: string): MarketImplied {
  const lag = rate.lagaaiRate;
  // Implied: favourite prob = 100 / (100 + lagaaiRate)
  const favouriteProb = (100 / (100 + lag)) * 100;
  const underdogProb = 100 - favouriteProb;

  const underdog = rate.favouriteTeam === teamA ? teamB : teamA;

  return {
    favouriteProb: Math.round(favouriteProb * 10) / 10,
    underdogProb: Math.round(underdogProb * 10) / 10,
    favouriteTeam: rate.favouriteTeam,
    underdogTeam: underdog,
  };
}

// ─── Value Bet Detection ────────────────────────────────────────────

export function detectValueBets(
  winProb: WinProbability,
  market: MarketImplied,
  rate: RateEntry,
  bets: Bet[],
  teamA: string,
  teamB: string,
): ValueBet[] {
  const results: ValueBet[] = [];
  const position = calculatePosition(bets, teamA, teamB);

  // Check favourite (Lagaai side)
  const favModelProb = market.favouriteTeam === teamA ? winProb.teamA : winProb.teamB;
  const favEdge = favModelProb - market.favouriteProb;

  if (favEdge > 3) {
    // Model thinks favourite is MORE likely than market says → Lagaai is undervalued
    const signal: ValueBet['signal'] = favEdge > 15 ? 'STRONG_BUY' : favEdge > 8 ? 'BUY' : 'NEUTRAL';
    const recPeti = favEdge > 15 ? 2 : favEdge > 8 ? 1 : 0.5;
    const stake = recPeti * 100_000;
    const hyp: Bet = { id: '', team: market.favouriteTeam, betType: 'lagaai', rate: rate.lagaaiRate, stake, createdAt: '' };
    const proj = projectPosition(position, hyp, teamA, teamB);

    results.push({
      team: market.favouriteTeam,
      betType: 'lagaai',
      edge: Math.round(favEdge * 10) / 10,
      signal,
      peti: recPeti,
      projectedWin: Math.round(Math.max(proj.teamA_pnl, proj.teamB_pnl)),
      projectedLoss: Math.round(Math.min(proj.teamA_pnl, proj.teamB_pnl)),
      reasoning: `Model: ${favModelProb.toFixed(0)}% vs Market: ${market.favouriteProb.toFixed(0)}% → ${favEdge.toFixed(0)}% edge. ${market.favouriteTeam} is more likely to win than the rate suggests.`,
    });
  }

  // Check underdog (Khaai side)
  const undModelProb = market.underdogTeam === teamA ? winProb.teamA : winProb.teamB;
  const undEdge = undModelProb - market.underdogProb;

  if (undEdge > 3) {
    const signal: ValueBet['signal'] = undEdge > 15 ? 'STRONG_BUY' : undEdge > 8 ? 'BUY' : 'NEUTRAL';
    const recPeti = undEdge > 15 ? 2 : undEdge > 8 ? 1 : 0.5;
    const stake = recPeti * rate.khaaiRate * 1000;
    const hyp: Bet = { id: '', team: market.underdogTeam, betType: 'khaai', rate: rate.khaaiRate, stake, createdAt: '' };
    const proj = projectPosition(position, hyp, teamA, teamB);

    results.push({
      team: market.underdogTeam,
      betType: 'khaai',
      edge: Math.round(undEdge * 10) / 10,
      signal,
      peti: recPeti,
      projectedWin: Math.round(Math.max(proj.teamA_pnl, proj.teamB_pnl)),
      projectedLoss: Math.round(Math.min(proj.teamA_pnl, proj.teamB_pnl)),
      reasoning: `Model: ${undModelProb.toFixed(0)}% vs Market: ${market.underdogProb.toFixed(0)}% → ${undEdge.toFixed(0)}% edge. ${market.underdogTeam} has a better chance than the rate implies.`,
    });
  }

  // Sort by edge descending
  results.sort((a, b) => b.edge - a.edge);
  return results;
}

// ─── Rate Momentum Analysis ─────────────────────────────────────────

export function analyzeRateMomentum(rateEntries: RateEntry[]): RateMomentum {
  if (rateEntries.length < 2) {
    return {
      direction: 'stable',
      speed: 'slow',
      change5: 0,
      change10: 0,
      prediction: 'Not enough rate history to analyze trend.',
    };
  }

  const rates = rateEntries.map(r => r.lagaaiRate);
  const latest = rates[rates.length - 1];

  // Change over last 5 entries
  const from5 = rates.length >= 5 ? rates[rates.length - 5] : rates[0];
  const change5 = latest - from5;

  // Change over last 10 entries
  const from10 = rates.length >= 10 ? rates[rates.length - 10] : rates[0];
  const change10 = latest - from10;

  // Direction
  let direction: RateMomentum['direction'];
  if (Math.abs(change5) <= 1) direction = 'stable';
  else if (change5 > 0) direction = 'rising';
  else direction = 'falling';

  // Speed
  let speed: RateMomentum['speed'];
  const absChange = Math.abs(change5);
  if (absChange >= 8) speed = 'fast';
  else if (absChange >= 3) speed = 'moderate';
  else speed = 'slow';

  // Prediction
  let prediction: string;
  if (direction === 'stable') {
    prediction = 'Rate is stable — market is balanced. Good time to lock in current position.';
  } else if (direction === 'rising' && speed === 'fast') {
    prediction = `Rate rising fast (+${change5}). Favourite losing grip. If you have Lagaai, HEDGE NOW before rate goes higher. If you want Khaai, WAIT — rate may go higher.`;
  } else if (direction === 'rising') {
    prediction = `Rate trending up (+${change5}). Favourite under pressure. Khaai value may increase.`;
  } else if (direction === 'falling' && speed === 'fast') {
    prediction = `Rate dropping fast (${change5}). Favourite strengthening. If you want Lagaai, BUY NOW before rate drops more.`;
  } else {
    prediction = `Rate trending down (${change5}). Favourite gaining confidence.`;
  }

  return { direction, speed, change5, change10, prediction };
}

// ─── Smart Signal Generator ─────────────────────────────────────────

export function generatePrediction(
  situation: MatchSituation | null,
  rateEntries: RateEntry[],
  bets: Bet[],
  teamA: string,
  teamB: string,
): PredictionResult {
  const latestRate = rateEntries[rateEntries.length - 1];
  if (!latestRate) {
    return {
      winProbability: { teamA: 50, teamB: 50, confidence: 'low', source: 'No rates' },
      marketImplied: { favouriteProb: 50, underdogProb: 50, favouriteTeam: teamA, underdogTeam: teamB },
      valueBets: [],
      momentum: analyzeRateMomentum([]),
      signals: [],
      timestamp: new Date().toISOString(),
    };
  }

  const winProb = calculateWinProbability(situation, teamA, teamB);
  const market = getMarketImplied(latestRate, teamA, teamB);
  const valueBets = detectValueBets(winProb, market, latestRate, bets, teamA, teamB);
  const momentum = analyzeRateMomentum(rateEntries);

  const signals: PredictionSignal[] = [];
  const position = calculatePosition(bets, teamA, teamB);

  // Signal 1: Sure Profit detection
  if (position.classification === 'profitable') {
    signals.push({
      action: 'SURE_PROFIT',
      confidence: 95,
      team: null,
      betType: null,
      peti: null,
      title: '✅ SURE PROFIT — You\'re already green on both sides!',
      detail: `Both outcomes are positive. Lock this in or play more to increase profit.`,
      reasoning: [
        `${teamA} wins: +₹${Math.round(position.teamA_pnl).toLocaleString('en-IN')}`,
        `${teamB} wins: +₹${Math.round(position.teamB_pnl).toLocaleString('en-IN')}`,
        'Consider adding more if value bet exists, otherwise hold.'
      ],
    });
  }

  // Signal 2: Value bet → PLAY NOW
  if (valueBets.length > 0) {
    const best = valueBets[0];
    const isSureBet = best.edge > 12 && winProb.confidence !== 'low';

    signals.push({
      action: best.signal === 'STRONG_BUY' ? 'PLAY_NOW' : 'HIGH_VALUE',
      confidence: Math.min(90, 50 + best.edge * 2),
      team: best.team,
      betType: best.betType,
      peti: best.peti,
      title: isSureBet
        ? `🔥 STRONG: ${formatPeti(best.peti)} ${best.betType} on ${best.team} — ${best.edge}% edge!`
        : `💡 VALUE: ${formatPeti(best.peti)} ${best.betType} on ${best.team} — ${best.edge}% edge`,
      detail: best.reasoning,
      reasoning: [
        `Your model: ${best.team} win chance ${best.betType === 'lagaai' ? winProb.teamA >= winProb.teamB ? winProb.teamA : winProb.teamB : winProb.teamA <= winProb.teamB ? winProb.teamA : winProb.teamB}%`,
        `Market rate implies: ${best.betType === 'lagaai' ? market.favouriteProb : market.underdogProb}%`,
        `Edge: ${best.edge}% — market is underrating ${best.team}`,
        `Projected: Win +₹${best.projectedWin.toLocaleString('en-IN')} / Risk −₹${Math.abs(best.projectedLoss).toLocaleString('en-IN')}`,
      ],
    });
  }

  // Signal 3: Rate momentum → WAIT or HEDGE
  if (momentum.direction !== 'stable' && momentum.speed !== 'slow') {
    const hasBets = bets.length > 0;
    const isRising = momentum.direction === 'rising';

    if (hasBets && isRising && position.teamA_pnl !== position.teamB_pnl) {
      // Rate going up = favourite weakening. If user has lagaai, might want to hedge
      const worstSide = position.teamA_pnl < position.teamB_pnl ? teamA : teamB;
      signals.push({
        action: 'HEDGE_NOW',
        confidence: momentum.speed === 'fast' ? 80 : 60,
        team: worstSide,
        betType: null,
        peti: null,
        title: `⚡ Rate ${isRising ? 'RISING' : 'FALLING'} ${momentum.speed === 'fast' ? 'FAST' : ''} — Hedge before it moves more`,
        detail: momentum.prediction,
        reasoning: [
          `Rate moved ${momentum.change5 > 0 ? '+' : ''}${momentum.change5} in last 5 updates`,
          `Current: ${latestRate.lagaaiRate} Lagaai`,
          momentum.prediction,
        ],
      });
    } else if (!hasBets) {
      // No bets + strong momentum → wait for better entry
      signals.push({
        action: 'WAIT',
        confidence: 55,
        team: null,
        betType: null,
        peti: null,
        title: `⏳ WAIT — Rate ${isRising ? 'rising' : 'falling'} ${momentum.speed}`,
        detail: `Rate is moving ${momentum.speed}ly. Wait for it to stabilize for a better entry point.`,
        reasoning: [
          `Rate moved ${momentum.change5 > 0 ? '+' : ''}${momentum.change5} recently`,
          momentum.prediction,
          'Volatile rates = risky entry. Patience pays.'
        ],
      });
    }
  }

  // Signal 4: Double profit opportunity
  if (bets.length > 0 && valueBets.length > 0) {
    const best = valueBets[0];
    const currentMin = Math.min(position.teamA_pnl, position.teamB_pnl);
    if (best.projectedWin > currentMin * 2 && best.projectedWin > 0) {
      signals.push({
        action: 'PLAY_NOW',
        confidence: 70,
        team: best.team,
        betType: best.betType,
        peti: best.peti,
        title: `🚀 DOUBLE PROFIT: ${formatPeti(best.peti)} ${best.betType} on ${best.team} could 2x your upside`,
        detail: `Current best: +₹${Math.round(Math.max(position.teamA_pnl, position.teamB_pnl)).toLocaleString('en-IN')} → Projected: +₹${best.projectedWin.toLocaleString('en-IN')}`,
        reasoning: [
          `Current position max: +₹${Math.round(Math.max(position.teamA_pnl, position.teamB_pnl)).toLocaleString('en-IN')}`,
          `After this bet max: +₹${best.projectedWin.toLocaleString('en-IN')}`,
          `Risk: worst case moves to ₹${best.projectedLoss.toLocaleString('en-IN')}`,
          `Edge: ${best.edge}% in your favour`,
        ],
      });
    }
  }

  // Sort signals by confidence
  signals.sort((a, b) => b.confidence - a.confidence);

  return {
    winProbability: winProb,
    marketImplied: market,
    valueBets,
    momentum,
    signals,
    timestamp: new Date().toISOString(),
  };
}
