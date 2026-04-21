import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { Match } from '../../types';
import type { MatchSituation, PredictionResult, PredictionSignal } from '../../engine/predictor';
import { generatePrediction } from '../../engine/predictor';
import {
  getCurrentMatches,
  findMatchByTeams,
  hasApiKey,
  type CricApiMatch,
} from '../../services/cricketApi';
import styles from './Predictor.module.css';

interface PredictorProps {
  match: Match;
}

/** Extract MatchSituation from CricAPI match data */
function extractSituation(apiMatch: CricApiMatch, teamA: string, teamB: string): MatchSituation | null {
  if (!apiMatch.score || apiMatch.score.length === 0) return null;

  const latest = apiMatch.score[apiMatch.score.length - 1];
  const innings = apiMatch.score.length as 1 | 2;

  // Determine batting team from inning string (e.g. "Lucknow Super Giants Inning 1")
  const inningStr = latest.inning?.toLowerCase() || '';
  const normA = teamA.toLowerCase();
  const normB = teamB.toLowerCase();

  let battingTeam = teamA;
  let bowlingTeam = teamB;

  if (inningStr.includes(normB) || inningStr.includes(normB.split(' ')[0])) {
    battingTeam = teamB;
    bowlingTeam = teamA;
  } else if (inningStr.includes(normA) || inningStr.includes(normA.split(' ')[0])) {
    battingTeam = teamA;
    bowlingTeam = teamB;
  }

  // If 2nd innings, target = 1st innings score + 1
  let target: number | null = null;
  if (innings >= 2 && apiMatch.score.length >= 2) {
    target = apiMatch.score[0].r + 1;
  }

  return {
    battingTeam,
    bowlingTeam,
    runs: latest.r,
    wickets: latest.w,
    overs: latest.o,
    target,
    innings: innings > 2 ? 2 : innings,
  };
}

export function Predictor({ match }: PredictorProps) {
  const [situation, setSituation] = useState<MatchSituation | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchSituation = useCallback(async () => {
    if (!hasApiKey()) return;
    try {
      const matches = await getCurrentMatches();
      const found = findMatchByTeams(matches, match.teamA, match.teamB);
      if (found) {
        const sit = extractSituation(found, match.teamA, match.teamB);
        setSituation(sit);
      }
    } catch {
      // Silently fail — prediction works without live data (50/50 fallback)
    }
  }, [match.teamA, match.teamB]);

  useEffect(() => {
    fetchSituation();
    intervalRef.current = setInterval(fetchSituation, 30_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchSituation]);

  const prediction: PredictionResult | null = useMemo(() => {
    if (match.rateEntries.length === 0) return null;
    return generatePrediction(
      situation,
      match.rateEntries,
      match.bets,
      match.teamA,
      match.teamB,
    );
  }, [situation, match.rateEntries, match.bets, match.teamA, match.teamB]);

  if (!prediction) {
    return (
      <div className={styles.card}>
        <div className={styles.sectionTitle}>🔮 Prediction</div>
        <div className={styles.noData}>Enter rates to see predictions</div>
      </div>
    );
  }

  const { winProbability, marketImplied, valueBets, momentum, signals } = prediction;

  return (
    <div className={styles.panel}>
      {/* Smart Signals */}
      {signals.length > 0 && (
        <div className={styles.card}>
          <div className={styles.sectionTitle}>🎯 Smart Signals</div>
          {signals.map((sig, i) => (
            <SignalCard key={i} signal={sig} />
          ))}
        </div>
      )}

      {/* Win Probability */}
      <div className={styles.card}>
        <div className={styles.sectionTitle}>📊 Win Probability</div>
        <div className={styles.probLabels}>
          <span>{match.teamA}</span>
          <span>{match.teamB}</span>
        </div>
        <div className={styles.probBar}>
          <div
            className={styles.probSideA}
            style={{ width: `${Math.max(5, winProbability.teamA)}%` }}
          >
            {winProbability.teamA}%
          </div>
          <div
            className={styles.probSideB}
            style={{ width: `${Math.max(5, winProbability.teamB)}%` }}
          >
            {winProbability.teamB}%
          </div>
        </div>
        <div className={styles.probSource}>{winProbability.source}</div>
      </div>

      {/* Market vs Model */}
      {valueBets.length > 0 && (
        <div className={styles.card}>
          <div className={styles.sectionTitle}>⚖️ Model vs Market</div>
          <div className={styles.compareTable}>
            <div className={styles.compareHeader}>Team</div>
            <div className={styles.compareHeader}>Model</div>
            <div className={styles.compareHeader}>Market</div>
            <div className={styles.compareHeader}>Edge</div>
            {valueBets.map((vb, i) => {
              const modelProb = vb.betType === 'lagaai'
                ? (vb.team === match.teamA ? winProbability.teamA : winProbability.teamB)
                : (vb.team === match.teamA ? winProbability.teamA : winProbability.teamB);
              const marketProb = vb.betType === 'lagaai'
                ? marketImplied.favouriteProb
                : marketImplied.underdogProb;
              return (
                <div key={i} style={{ display: 'contents' }}>
                  <div>{vb.team} ({vb.betType})</div>
                  <div>{modelProb.toFixed(0)}%</div>
                  <div>{marketProb.toFixed(0)}%</div>
                  <div className={`${styles.compareEdge} ${vb.edge > 0 ? styles.edgePositive : styles.edgeNegative}`}>
                    {vb.edge > 0 ? '+' : ''}{vb.edge}%
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Rate Momentum */}
      {match.rateEntries.length >= 2 && (
        <div className={styles.card}>
          <div className={styles.sectionTitle}>📈 Rate Momentum</div>
          <div className={styles.momentumBar}>
            <span className={styles.momentumIcon}>
              {momentum.direction === 'rising' ? '📈' : momentum.direction === 'falling' ? '📉' : '➡️'}
            </span>
            <div className={styles.momentumText}>
              {momentum.prediction}
            </div>
            <span
              className={`${styles.momentumSpeed} ${
                momentum.speed === 'fast' ? styles.speedFast
                  : momentum.speed === 'moderate' ? styles.speedModerate
                  : styles.speedSlow
              }`}
            >
              {momentum.speed}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function SignalCard({ signal }: { signal: PredictionSignal }) {
  const [expanded, setExpanded] = useState(false);

  const actionClass =
    signal.action === 'PLAY_NOW' ? styles.signalPlayNow
    : signal.action === 'SURE_PROFIT' ? styles.signalSureProfit
    : signal.action === 'HIGH_VALUE' ? styles.signalHighValue
    : signal.action === 'WAIT' ? styles.signalWait
    : styles.signalHedge;

  const confClass =
    signal.confidence >= 75 ? styles.confHigh
    : signal.confidence >= 50 ? styles.confMedium
    : styles.confLow;

  return (
    <div
      className={`${styles.signal} ${actionClass}`}
      onClick={() => setExpanded(!expanded)}
      style={{ cursor: 'pointer' }}
    >
      <div className={styles.signalTitle}>
        {signal.title}
        <span className={`${styles.confidenceBadge} ${confClass}`}>
          {signal.confidence}%
        </span>
      </div>
      <div className={styles.signalDetail}>{signal.detail}</div>
      {expanded && signal.reasoning.length > 0 && (
        <div className={styles.signalReasons}>
          {signal.reasoning.map((r, i) => (
            <div key={i} className={styles.signalReason}>{r}</div>
          ))}
        </div>
      )}
    </div>
  );
}
