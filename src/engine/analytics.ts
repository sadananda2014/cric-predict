import type { Bet, RateEntry, BetType } from '../types';
import { calculatePosition, calculateBetPnL } from './pnl';
import { projectPosition } from './hedging';
import { stakeToPeti, formatPeti } from './rates';

// ─── Breakeven Calculator ───────────────────────────────────────────

export interface BreakevenResult {
  teamA_breakevenRate: number | null; // Rate at which teamA outcome = 0
  teamB_breakevenRate: number | null;
  teamA_profitAbove: boolean; // Does teamA profit increase above this rate?
  teamB_profitAbove: boolean;
}

/**
 * For the current position, find the lagaai rate at which each team's
 * outcome P&L crosses zero. Uses binary search over rate 1–99.
 */
export function calculateBreakeven(
  bets: Bet[],
  favouriteTeam: string,
  teamA: string,
  teamB: string
): BreakevenResult {
  const position = calculatePosition(bets, teamA, teamB);

  function worstCaseAfterHedge(lagaaiRate: number): number {
    const khaaiRate = lagaaiRate + 1;

    // Hedge the weaker side
    const { teamA_pnl, teamB_pnl } = position;
    if (teamA_pnl === teamB_pnl) return teamA_pnl;

    let hedgeTeam: string;
    let hedgeBetType: BetType;
    let hedgeRate: number;
    let deficit: number;

    if (teamA_pnl < teamB_pnl) {
      hedgeTeam = teamA;
      deficit = teamB_pnl - teamA_pnl;
      hedgeBetType = hedgeTeam === favouriteTeam ? 'lagaai' : 'khaai';
      hedgeRate = hedgeBetType === 'lagaai' ? lagaaiRate : khaaiRate;
    } else {
      hedgeTeam = teamB;
      deficit = teamA_pnl - teamB_pnl;
      hedgeBetType = hedgeTeam === favouriteTeam ? 'lagaai' : 'khaai';
      hedgeRate = hedgeBetType === 'lagaai' ? lagaaiRate : khaaiRate;
    }

    const multiplier = hedgeBetType === 'lagaai' ? hedgeRate / 100 : 100 / hedgeRate;
    const hedgeStake = deficit / (multiplier + 1);

    const hedgeBet: Bet = {
      id: '', team: hedgeTeam, betType: hedgeBetType,
      rate: hedgeRate, stake: hedgeStake, createdAt: '',
    };

    const projected = projectPosition(position, hedgeBet, teamA, teamB);
    return Math.min(projected.teamA_pnl, projected.teamB_pnl);
  }

  // Find rate where worst case = 0 using search
  let teamA_be: number | null = null;
  let teamB_be: number | null = null;
  let teamA_above = true;
  let teamB_above = true;

  // Check P&L trend direction at rate=1 vs rate=99
  const low = worstCaseAfterHedge(1);
  const high = worstCaseAfterHedge(99);

  // Binary search for the rate where worst case crosses 0
  if ((low <= 0 && high >= 0) || (low >= 0 && high <= 0)) {
    let lo = 1, hi = 99;
    for (let i = 0; i < 30; i++) {
      const mid = Math.round((lo + hi) / 2);
      if (mid === lo || mid === hi) break;
      const val = worstCaseAfterHedge(mid);
      if (val === 0) { lo = mid; hi = mid; break; }
      if ((low < high && val < 0) || (low > high && val > 0)) {
        lo = mid;
      } else {
        hi = mid;
      }
    }
    const beRate = Math.round((lo + hi) / 2);
    teamA_be = beRate;
    teamB_be = beRate;
    teamA_above = high > low;
    teamB_above = high > low;
  }

  return {
    teamA_breakevenRate: teamA_be,
    teamB_breakevenRate: teamB_be,
    teamA_profitAbove: teamA_above,
    teamB_profitAbove: teamB_above,
  };
}

// ─── Profit Maximizer ───────────────────────────────────────────────

export interface ProfitStrategy {
  team: string;
  betType: BetType;
  stake: number;
  peti: number;
  projectedMin: number;   // guaranteed minimum P&L
  projectedMax: number;   // best-case P&L
  projectedTeamA: number;
  projectedTeamB: number;
  description: string;
}

/**
 * Instead of just equalizing (hedge), find the bet that MAXIMIZES
 * the guaranteed minimum profit. Tests multiple stake sizes on both sides.
 */
export function findProfitMaximizingBet(
  bets: Bet[],
  currentRate: RateEntry,
  teamA: string,
  teamB: string
): ProfitStrategy[] {
  const position = calculatePosition(bets, teamA, teamB);
  if (position.classification === 'neutral') return [];

  const strategies: ProfitStrategy[] = [];
  const teams = [teamA, teamB];

  for (const team of teams) {
    const isFav = team === currentRate.favouriteTeam;
    const betType: BetType = isFav ? 'lagaai' : 'khaai';
    const rate = isFav ? currentRate.lagaaiRate : currentRate.khaaiRate;

    // Test peti values from 0.25 to 10
    const petiTests = [0.25, 0.5, 0.75, 1, 1.5, 2, 2.5, 3, 4, 5, 7, 10];

    for (const petiVal of petiTests) {
      const stake = betType === 'lagaai' ? petiVal * 100_000 : petiVal * rate * 1000;
      const hyp: Bet = { id: '', team, betType, rate, stake, createdAt: '' };
      const proj = projectPosition(position, hyp, teamA, teamB);
      const minPnL = Math.min(proj.teamA_pnl, proj.teamB_pnl);
      const maxPnL = Math.max(proj.teamA_pnl, proj.teamB_pnl);

      strategies.push({
        team,
        betType,
        stake: Math.round(stake),
        peti: petiVal,
        projectedMin: Math.round(minPnL),
        projectedMax: Math.round(maxPnL),
        projectedTeamA: Math.round(proj.teamA_pnl),
        projectedTeamB: Math.round(proj.teamB_pnl),
        description: `${formatPeti(petiVal)} ${betType} on ${team}`,
      });
    }
  }

  // Sort by highest guaranteed minimum profit
  strategies.sort((a, b) => b.projectedMin - a.projectedMin);

  return strategies.slice(0, 10);
}

// ─── Scalping / Arbitrage Detector ──────────────────────────────────

export interface ScalpOpportunity {
  description: string;
  entryRate: RateEntry;
  exitRate: RateEntry;
  profit: number;
  peti: number;
  riskFree: boolean;
}

/**
 * Detect scalping opportunities from rate history.
 * If the favourite flipped or rate moved significantly, you could have
 * bought at one rate and sold at another for guaranteed profit.
 */
export function detectScalpingOpportunities(
  rateEntries: RateEntry[],
  _teamA: string,
  _teamB: string
): ScalpOpportunity[] {
  if (rateEntries.length < 2) return [];

  const opportunities: ScalpOpportunity[] = [];

  for (let i = 0; i < rateEntries.length - 1; i++) {
    const entry = rateEntries[i];
    const exit = rateEntries[rateEntries.length - 1]; // compare to latest

    // Same favourite — check if rate moved enough for arb
    if (entry.favouriteTeam === exit.favouriteTeam) {
      const rateDiff = Math.abs(exit.lagaaiRate - entry.lagaaiRate);
      if (rateDiff < 3) continue;

      // If rate went UP: Lagaai at old low rate → Khaai at new high rate
      // If rate went DOWN: Khaai at old high rate → Lagaai at new low rate
      const wentUp = exit.lagaaiRate > entry.lagaaiRate;

      // Calculate: 1 peti scalp profit
      const oldRate = entry.lagaaiRate;
      const newRate = exit.lagaaiRate;

      if (wentUp) {
        // Buy lagaai at old rate (risk 1L, win oldRate×1000)
        // Sell khaai at new rate (risk newKhaai×1000, win 1L)
        // If fav wins: +oldRate×1000 - newKhaai×1000
        // If underdog wins: -1L + 1L = 0
        const favWinProfit = oldRate * 1000 - exit.khaaiRate * 1000;
        const underdogWinProfit = 0; // cancel out
        if (favWinProfit > 0) {
          opportunities.push({
            description: `Rate moved ${oldRate}→${newRate}: Lagaai at ${oldRate}, then Khaai at ${exit.khaaiRate}. Favourite wins → +₹${favWinProfit.toLocaleString('en-IN')}/peti, Underdog wins → break even.`,
            entryRate: entry,
            exitRate: exit,
            profit: favWinProfit,
            peti: 1,
            riskFree: underdogWinProfit >= 0,
          });
        }
      } else {
        // Rate dropped: Khaai at old rate → Lagaai at new rate
        const underdogWinProfit = 0;
        const favWinProfit = newRate * 1000 - entry.khaaiRate * 1000;
        if (favWinProfit > 0 || underdogWinProfit > 0) {
          opportunities.push({
            description: `Rate dropped ${oldRate}→${newRate}: Khaai at ${entry.khaaiRate}, then Lagaai at ${newRate}. Net profit on favourite win.`,
            entryRate: entry,
            exitRate: exit,
            profit: Math.max(favWinProfit, 0),
            peti: 1,
            riskFree: favWinProfit >= 0 && underdogWinProfit >= 0,
          });
        }
      }
    } else {
      // Favourite flipped! This is a big opportunity
      // If you had lagaai on old favourite and now lagaai on new favourite,
      // both bets are lagaai on different teams — one MUST win
      const profit = entry.lagaaiRate * 1000 + exit.lagaaiRate * 1000 - 2 * 100_000;
      if (profit > 0) {
        opportunities.push({
          description: `Favourite flipped! ${entry.favouriteTeam}→${exit.favouriteTeam}. Lagaai both sides: guaranteed ₹${profit.toLocaleString('en-IN')}/peti profit!`,
          entryRate: entry,
          exitRate: exit,
          profit,
          peti: 1,
          riskFree: true,
        });
      }
    }
  }

  // Sort by profit desc
  return opportunities.sort((a, b) => b.profit - a.profit).slice(0, 5);
}

// ─── Multi-Step Strategy Planner ────────────────────────────────────

export interface StrategyStep {
  condition: string;
  action: string;
  team: string;
  betType: BetType;
  peti: number;
  stake: number;
  projectedMin: number;
  projectedTeamA: number;
  projectedTeamB: number;
}

export interface MultiStepPlan {
  name: string;
  steps: StrategyStep[];
  finalMin: number;
  finalMax: number;
}

/**
 * Generate conditional multi-step strategies based on rate movements.
 */
export function generateMultiStepStrategies(
  bets: Bet[],
  currentRate: RateEntry,
  teamA: string,
  teamB: string
): MultiStepPlan[] {
  const position = calculatePosition(bets, teamA, teamB);
  if (position.classification === 'neutral') return [];

  const plans: MultiStepPlan[] = [];
  const currentLagaai = currentRate.lagaaiRate;

  // Plan 1: "Rate goes up" strategy
  const upRate = Math.min(99, currentLagaai + 15);
  const upRateEntry: RateEntry = {
    id: '', favouriteTeam: currentRate.favouriteTeam,
    lagaaiRate: upRate, khaaiRate: upRate + 1, createdAt: '',
  };

  // Step 1 now: hedge at current rate
  const nowStrategies = findProfitMaximizingBet(bets, currentRate, teamA, teamB);
  const upStrategies = findProfitMaximizingBet(bets, upRateEntry, teamA, teamB);

  if (nowStrategies.length > 0 && upStrategies.length > 0) {
    const best = nowStrategies[0];
    const bestUp = upStrategies[0];

    plans.push({
      name: 'Wait for Rate Rise',
      steps: [
        {
          condition: `If rate stays at ${currentLagaai}`,
          action: best.description,
          team: best.team,
          betType: best.betType,
          peti: best.peti,
          stake: best.stake,
          projectedMin: best.projectedMin,
          projectedTeamA: best.projectedTeamA,
          projectedTeamB: best.projectedTeamB,
        },
        {
          condition: `If rate rises to ${upRate}`,
          action: bestUp.description,
          team: bestUp.team,
          betType: bestUp.betType,
          peti: bestUp.peti,
          stake: bestUp.stake,
          projectedMin: bestUp.projectedMin,
          projectedTeamA: bestUp.projectedTeamA,
          projectedTeamB: bestUp.projectedTeamB,
        },
      ],
      finalMin: Math.max(best.projectedMin, bestUp.projectedMin),
      finalMax: Math.max(best.projectedMax, bestUp.projectedMax),
    });
  }

  // Plan 2: "Rate drops" strategy
  const downRate = Math.max(1, currentLagaai - 15);
  const downRateEntry: RateEntry = {
    id: '', favouriteTeam: currentRate.favouriteTeam,
    lagaaiRate: downRate, khaaiRate: downRate + 1, createdAt: '',
  };
  const downStrategies = findProfitMaximizingBet(bets, downRateEntry, teamA, teamB);

  if (nowStrategies.length > 0 && downStrategies.length > 0) {
    const best = nowStrategies[0];
    const bestDown = downStrategies[0];

    plans.push({
      name: 'Wait for Rate Drop',
      steps: [
        {
          condition: `If rate stays at ${currentLagaai}`,
          action: best.description,
          team: best.team,
          betType: best.betType,
          peti: best.peti,
          stake: best.stake,
          projectedMin: best.projectedMin,
          projectedTeamA: best.projectedTeamA,
          projectedTeamB: best.projectedTeamB,
        },
        {
          condition: `If rate drops to ${downRate}`,
          action: bestDown.description,
          team: bestDown.team,
          betType: bestDown.betType,
          peti: bestDown.peti,
          stake: bestDown.stake,
          projectedMin: bestDown.projectedMin,
          projectedTeamA: bestDown.projectedTeamA,
          projectedTeamB: bestDown.projectedTeamB,
        },
      ],
      finalMin: Math.max(best.projectedMin, bestDown.projectedMin),
      finalMax: Math.max(best.projectedMax, bestDown.projectedMax),
    });
  }

  // Plan 3: Aggressive — overbet the profitable side
  const { teamA_pnl, teamB_pnl } = position;
  const lossSide = teamA_pnl > teamB_pnl ? teamB : teamA;
  const isFav = lossSide === currentRate.favouriteTeam;
  const aggressiveBetType: BetType = isFav ? 'lagaai' : 'khaai';
  const aggressiveRate = isFav ? currentRate.lagaaiRate : currentRate.khaaiRate;

  const currentLoss = Math.min(teamA_pnl, teamB_pnl);

  // Betting on lossSide: if lossSide wins, gain = stake * multiplier
  // We want: currentLoss + stake * multiplier > targetProfit (go big)
  // But risk: profitSide pnl drops by stake
  if (Math.abs(currentLoss) > 0) {
    const aggressiveStake = Math.abs(currentLoss) * 1.5;
    const aggressivePeti = stakeToPeti(aggressiveStake, aggressiveBetType, aggressiveRate);
    const hyp: Bet = { id: '', team: lossSide, betType: aggressiveBetType, rate: aggressiveRate, stake: aggressiveStake, createdAt: '' };
    const proj = projectPosition(position, hyp, teamA, teamB);

    plans.push({
      name: 'Aggressive Double-Down',
      steps: [
        {
          condition: `Go big at rate ${currentLagaai}`,
          action: `${formatPeti(aggressivePeti)} ${aggressiveBetType} on ${lossSide} — high risk, high reward`,
          team: lossSide,
          betType: aggressiveBetType,
          peti: aggressivePeti,
          stake: Math.round(aggressiveStake),
          projectedMin: Math.round(Math.min(proj.teamA_pnl, proj.teamB_pnl)),
          projectedTeamA: Math.round(proj.teamA_pnl),
          projectedTeamB: Math.round(proj.teamB_pnl),
        },
      ],
      finalMin: Math.round(Math.min(proj.teamA_pnl, proj.teamB_pnl)),
      finalMax: Math.round(Math.max(proj.teamA_pnl, proj.teamB_pnl)),
    });
  }

  // Sort plans by finalMin desc
  plans.sort((a, b) => b.finalMin - a.finalMin);

  return plans;
}

// ─── Kelly Criterion ────────────────────────────────────────────────

export interface KellyResult {
  team: string;
  betType: BetType;
  optimalPeti: number;
  optimalStake: number;
  edge: number;      // expected value per unit staked
  kellyFraction: number;
  description: string;
}

/**
 * Kelly Criterion: f* = (bp - q) / b
 * where b = net odds (multiplier), p = probability of winning, q = 1-p
 *
 * We estimate probability from the rate:
 *   Favourite probability ≈ 1 - (lagaaiRate / 100) (higher rate = less certain)
 *   Opposite view: use implied probability from Lagaai/Khaai spread
 */
export function calculateKelly(
  currentRate: RateEntry,
  bankroll: number, // total bankroll in ₹
  teamA: string,
  teamB: string
): KellyResult[] {
  const results: KellyResult[] = [];
  const lag = currentRate.lagaaiRate;
  const kha = currentRate.khaaiRate;

  // Implied probabilities from Lagaai/Khaai rates
  // Lagaai rate R means: pay 100, get R if favourite wins
  // Implied favourite prob = 100 / (100 + R)
  // Khaai rate K means: pay K×stake, get 100 if underdog wins
  // Implied underdog prob = K / (100 + K)
  const favProb = 100 / (100 + lag);
  const underdogProb = 1 - favProb;

  // Lagaai bet: multiplier = lag/100
  const lagMultiplier = lag / 100;
  const lagEdge = favProb * lagMultiplier - underdogProb;
  const lagKelly = lagEdge > 0 ? lagEdge / lagMultiplier : 0;

  if (lagKelly > 0) {
    const halfKelly = lagKelly / 2; // Conservative: half-Kelly
    const optStake = Math.round(bankroll * halfKelly);
    const optPeti = stakeToPeti(optStake, 'lagaai', lag);
    results.push({
      team: currentRate.favouriteTeam,
      betType: 'lagaai',
      optimalPeti: parseFloat(optPeti.toFixed(2)),
      optimalStake: optStake,
      edge: parseFloat((lagEdge * 100).toFixed(1)),
      kellyFraction: parseFloat((halfKelly * 100).toFixed(1)),
      description: `${formatPeti(parseFloat(optPeti.toFixed(2)))} lagaai on ${currentRate.favouriteTeam} (${(halfKelly * 100).toFixed(1)}% of bankroll, edge: ${(lagEdge * 100).toFixed(1)}%)`,
    });
  }

  // Khaai bet: multiplier = 100/kha
  const underdog = currentRate.favouriteTeam === teamA ? teamB : teamA;
  const khaMultiplier = 100 / kha;
  const khaEdge = underdogProb * khaMultiplier - favProb;
  const khaKelly = khaEdge > 0 ? khaEdge / khaMultiplier : 0;

  if (khaKelly > 0) {
    const halfKelly = khaKelly / 2;
    const optStake = Math.round(bankroll * halfKelly);
    const optPeti = stakeToPeti(optStake, 'khaai', kha);
    results.push({
      team: underdog,
      betType: 'khaai',
      optimalPeti: parseFloat(optPeti.toFixed(2)),
      optimalStake: optStake,
      edge: parseFloat((khaEdge * 100).toFixed(1)),
      kellyFraction: parseFloat((halfKelly * 100).toFixed(1)),
      description: `${formatPeti(parseFloat(optPeti.toFixed(2)))} khaai on ${underdog} (${(halfKelly * 100).toFixed(1)}% of bankroll, edge: ${(khaEdge * 100).toFixed(1)}%)`,
    });
  }

  return results;
}

// ─── Session Dashboard Stats ────────────────────────────────────────

export interface SessionStats {
  totalMatches: number;
  completedMatches: number;
  activeMatches: number;
  totalBets: number;
  totalStaked: number;
  totalPnL: number;
  winningMatches: number;
  losingMatches: number;
  bestMatch: { name: string; pnl: number } | null;
  worstMatch: { name: string; pnl: number } | null;
  roi: number; // percentage
  avgPnLPerMatch: number;
}

export function calculateSessionStats(
  matches: Record<string, import('../types').Match>
): SessionStats {
  const all = Object.values(matches);
  const completed = all.filter((m) => m.status === 'completed');
  const active = all.filter((m) => m.status === 'active');

  let totalPnL = 0;
  let totalStaked = 0;
  let totalBets = 0;
  let winningMatches = 0;
  let losingMatches = 0;
  let bestMatch: { name: string; pnl: number } | null = null;
  let worstMatch: { name: string; pnl: number } | null = null;

  for (const m of completed) {
    const staked = m.bets.reduce((s, b) => s + b.stake, 0);
    totalStaked += staked;
    totalBets += m.bets.length;

    if (m.winner) {
      let pnl = 0;
      for (const bet of m.bets) {
        pnl += calculateBetPnL(bet, m.winner);
      }
      totalPnL += pnl;
      if (pnl >= 0) winningMatches++;
      else losingMatches++;

      const name = `${m.teamA} vs ${m.teamB}`;
      if (!bestMatch || pnl > bestMatch.pnl) bestMatch = { name, pnl: Math.round(pnl) };
      if (!worstMatch || pnl < worstMatch.pnl) worstMatch = { name, pnl: Math.round(pnl) };
    }
  }

  for (const m of active) {
    totalBets += m.bets.length;
    totalStaked += m.bets.reduce((s, b) => s + b.stake, 0);
  }

  return {
    totalMatches: all.length,
    completedMatches: completed.length,
    activeMatches: active.length,
    totalBets,
    totalStaked: Math.round(totalStaked),
    totalPnL: Math.round(totalPnL),
    winningMatches,
    losingMatches,
    bestMatch,
    worstMatch,
    roi: totalStaked > 0 ? parseFloat(((totalPnL / totalStaked) * 100).toFixed(1)) : 0,
    avgPnLPerMatch: completed.length > 0 ? Math.round(totalPnL / completed.length) : 0,
  };
}

// ─── Rate Alert ─────────────────────────────────────────────────────

const ALERTS_KEY = 'cric-predict-rate-alerts';

export interface RateAlert {
  id: string;
  matchId: string;
  targetRate: number;
  direction: 'above' | 'below';
  triggered: boolean;
  createdAt: string;
}

export function getAlerts(): RateAlert[] {
  try {
    const raw = localStorage.getItem(ALERTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveAlert(alert: RateAlert): void {
  const alerts = getAlerts();
  alerts.push(alert);
  localStorage.setItem(ALERTS_KEY, JSON.stringify(alerts));
}

export function removeAlert(id: string): void {
  const alerts = getAlerts().filter((a) => a.id !== id);
  localStorage.setItem(ALERTS_KEY, JSON.stringify(alerts));
}

export function checkAlerts(matchId: string, currentRate: number): RateAlert[] {
  const alerts = getAlerts();
  const triggered: RateAlert[] = [];

  for (const alert of alerts) {
    if (alert.matchId !== matchId || alert.triggered) continue;
    if (
      (alert.direction === 'above' && currentRate >= alert.targetRate) ||
      (alert.direction === 'below' && currentRate <= alert.targetRate)
    ) {
      alert.triggered = true;
      triggered.push(alert);
    }
  }

  if (triggered.length > 0) {
    localStorage.setItem(ALERTS_KEY, JSON.stringify(alerts));
  }

  return triggered;
}
