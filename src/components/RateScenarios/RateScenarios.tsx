import { useMemo } from 'react';
import { calculatePosition } from '../../engine/pnl';
import { generateSuggestion } from '../../engine/hedging';
import { formatPeti } from '../../engine/rates';
import type { Match, RateEntry, Suggestion } from '../../types';
import styles from './RateScenarios.module.css';

interface RateScenariosProps {
  match: Match;
}

interface ScenarioCard {
  lagaaiRate: number;
  khaaiRate: number;
  isCurrent: boolean;
  suggestion: Suggestion;
}

const ACTION_STYLES: Record<string, { label: string; cls: string }> = {
  bet_now: { label: 'Bet Now', cls: 'betNow' },
  wait: { label: 'Wait', cls: 'wait' },
  lock_profit: { label: 'Lock Profit', cls: 'lockProfit' },
  reduce_exposure: { label: 'Reduce', cls: 'reduceExposure' },
};

export function RateScenarios({ match }: RateScenariosProps) {
  const latestRate = match.rateEntries[match.rateEntries.length - 1];

  const scenarios = useMemo(() => {
    if (!latestRate || match.bets.length === 0) return [];

    const position = calculatePosition(match.bets, match.teamA, match.teamB);
    const currentLagaai = latestRate.lagaaiRate;

    // Full range 1–99
    const ratePoints = new Set<number>();
    ratePoints.add(currentLagaai);
    for (let r = 1; r <= 99; r += 5) {
      ratePoints.add(r);
    }
    // Near current rate
    if (currentLagaai > 1) ratePoints.add(currentLagaai - 1);
    if (currentLagaai < 99) ratePoints.add(currentLagaai + 1);
    if (currentLagaai > 5) ratePoints.add(currentLagaai - 5);
    if (currentLagaai < 95) ratePoints.add(currentLagaai + 5);

    const selected = Array.from(ratePoints)
      .filter((r) => r >= 1 && r <= 99)
      .sort((a, b) => a - b);

    const cards = selected.map((lagaai): ScenarioCard => {
      const khaai = lagaai + 1;
      const hypotheticalRate: RateEntry = {
        id: '',
        favouriteTeam: latestRate.favouriteTeam,
        lagaaiRate: lagaai,
        khaaiRate: khaai,
        createdAt: '',
      };

      const suggestion = generateSuggestion(position, hypotheticalRate, match.teamA, match.teamB);

      return {
        lagaaiRate: lagaai,
        khaaiRate: khaai,
        isCurrent: lagaai === currentLagaai,
        suggestion,
      };
    });

    // Sort by best outcome first: highest projected worst-case P&L
    cards.sort((a, b) => {
      // Cards with projected P&L beat those without
      const aProj = a.suggestion.projectedPnL;
      const bProj = b.suggestion.projectedPnL;
      if (!aProj && !bProj) return 0;
      if (!aProj) return 1;
      if (!bProj) return -1;
      // Compare by worst-case (min of teamA, teamB) — higher is better
      const aWorst = Math.min(aProj.teamA, aProj.teamB);
      const bWorst = Math.min(bProj.teamA, bProj.teamB);
      return bWorst - aWorst;
    });

    return cards;
  }, [match.bets, match.rateEntries, match.teamA, match.teamB, latestRate]);

  if (scenarios.length === 0) return null;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>Rate Scenarios</span>
        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
          {latestRate.favouriteTeam} favourite
        </span>
      </div>

      <div className={styles.grid}>
        {scenarios.map((sc) => {
          const actionInfo = ACTION_STYLES[sc.suggestion.action] ?? { label: sc.suggestion.action, cls: 'wait' };

          return (
            <div
              key={sc.lagaaiRate}
              className={`${styles.card} ${sc.isCurrent ? styles.cardCurrent : ''}`}
            >
              {/* Rate header */}
              <div className={styles.rateRow}>
                <span className={styles.rateLabel}>
                  {sc.lagaaiRate} – {sc.khaaiRate}
                </span>
                {sc.isCurrent && <span className={styles.currentBadge}>NOW</span>}
              </div>

              {/* Action badge */}
              <span className={`${styles.actionBadge} ${styles[actionInfo.cls] ?? ''}`}>
                {actionInfo.label}
              </span>

              {/* Suggestion details */}
              {sc.suggestion.team && sc.suggestion.amount != null && sc.suggestion.betType && (
                <div className={styles.actionLine}>
                  {sc.suggestion.betType === 'lagaai' ? 'L' : 'K'}{' '}
                  {sc.suggestion.peti != null && <>{formatPeti(sc.suggestion.peti)} </>}
                  on {sc.suggestion.team}
                  <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.65rem' }}>
                    {' '}(₹{sc.suggestion.amount.toLocaleString('en-IN')})
                  </span>
                </div>
              )}

              {/* Projected P&L */}
              {sc.suggestion.projectedPnL && (
                <>
                  <div className={styles.projRow}>
                    <span className={styles.projLabel}>{match.teamA}:</span>
                    <span className={sc.suggestion.projectedPnL.teamA >= 0 ? 'positive' : 'negative'}>
                      {sc.suggestion.projectedPnL.teamA >= 0 ? '+' : ''}₹
                      {Math.abs(sc.suggestion.projectedPnL.teamA).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className={styles.projRow}>
                    <span className={styles.projLabel}>{match.teamB}:</span>
                    <span className={sc.suggestion.projectedPnL.teamB >= 0 ? 'positive' : 'negative'}>
                      {sc.suggestion.projectedPnL.teamB >= 0 ? '+' : ''}₹
                      {Math.abs(sc.suggestion.projectedPnL.teamB).toLocaleString('en-IN')}
                    </span>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
