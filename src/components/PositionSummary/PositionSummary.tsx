import { calculatePosition } from '../../engine/pnl';
import type { Match } from '../../types';
import styles from './PositionSummary.module.css';

interface PositionSummaryProps {
  match: Match;
}

export function PositionSummary({ match }: PositionSummaryProps) {
  const position = calculatePosition(match.bets, match.teamA, match.teamB);

  if (position.betCount === 0) return null;

  function formatPnL(value: number): string {
    const rounded = Math.round(value);
    const prefix = rounded >= 0 ? '+' : '';
    return `${prefix}₹${rounded.toLocaleString('en-IN')}`;
  }

  function pnlClass(value: number): string {
    return value >= 0 ? 'positive' : 'negative';
  }

  return (
    <div className={styles.container}>
      <div className={styles.title}>Position</div>
      <div className={styles.outcomes}>
        <div className={styles.outcome}>
          <div className={styles.outcomeLabel}>If {match.teamA} wins</div>
          <div className={`${styles.outcomeValue} ${pnlClass(position.teamA_pnl)}`}>
            {formatPnL(position.teamA_pnl)}
          </div>
        </div>
        <div className={styles.outcome}>
          <div className={styles.outcomeLabel}>If {match.teamB} wins</div>
          <div className={`${styles.outcomeValue} ${pnlClass(position.teamB_pnl)}`}>
            {formatPnL(position.teamB_pnl)}
          </div>
        </div>
      </div>
      <div className={styles.stats}>
        <span>{position.betCount} bet{position.betCount !== 1 ? 's' : ''}</span>
        <span>₹{position.totalStaked.toLocaleString('en-IN')} staked</span>
      </div>
    </div>
  );
}
