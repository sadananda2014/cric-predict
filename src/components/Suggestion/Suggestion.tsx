import type { Suggestion as SuggestionType } from '../../types';
import { formatPeti } from '../../engine/rates';
import { Disclaimer } from '../common';
import styles from './Suggestion.module.css';

interface SuggestionProps {
  suggestion: SuggestionType;
  teamA: string;
  teamB: string;
}

const ACTION_LABELS: Record<string, { label: string; className: string }> = {
  bet_now: { label: 'Bet Now', className: 'actionBetNow' },
  wait: { label: 'Wait', className: 'actionWait' },
  lock_profit: { label: 'Lock Profit', className: 'actionLockProfit' },
  reduce_exposure: { label: 'Reduce Exposure', className: 'actionReduce' },
};

export function Suggestion({ suggestion, teamA, teamB }: SuggestionProps) {
  const actionInfo = ACTION_LABELS[suggestion.action] ?? {
    label: suggestion.action,
    className: '',
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>Suggestion</span>
        <span
          className={`${styles.actionBadge} ${
            styles[actionInfo.className] ?? ''
          }`}
        >
          {actionInfo.label}
        </span>
      </div>

      {/* Recommended bet details */}
      {suggestion.team && suggestion.amount && suggestion.betType && (
        <div className={styles.betDetails}>
          <div className={styles.betTeam}>{suggestion.team}</div>
          <div className={styles.betInfo}>
            <span className={styles.betType}>
              {suggestion.betType === 'lagaai' ? 'L' : 'K'}
            </span>
            {suggestion.peti != null && (
              <span className={styles.betAmount} style={{ fontWeight: 700 }}>
                {formatPeti(suggestion.peti)}
              </span>
            )}
            <span className={styles.betAmount}>
              ₹{suggestion.amount.toLocaleString('en-IN')}
            </span>
          </div>
        </div>
      )}

      {/* Reasoning */}
      <div className={styles.reasoning}>{suggestion.reasoning}</div>

      {/* Projected P&L */}
      {suggestion.projectedPnL && (
        <div className={styles.projection}>
          <div className={styles.projLabel}>Projected P&L</div>
          <div className={styles.projRow}>
            <span>If {teamA} wins:</span>
            <span
              className={
                suggestion.projectedPnL.teamA >= 0 ? 'positive' : 'negative'
              }
            >
              {suggestion.projectedPnL.teamA >= 0 ? '+' : ''}₹
              {Math.abs(suggestion.projectedPnL.teamA).toLocaleString('en-IN')}
            </span>
          </div>
          <div className={styles.projRow}>
            <span>If {teamB} wins:</span>
            <span
              className={
                suggestion.projectedPnL.teamB >= 0 ? 'positive' : 'negative'
              }
            >
              {suggestion.projectedPnL.teamB >= 0 ? '+' : ''}₹
              {Math.abs(suggestion.projectedPnL.teamB).toLocaleString('en-IN')}
            </span>
          </div>
        </div>
      )}

      {/* Current worst case */}
      {suggestion.currentWorstCase !== 0 && (
        <div className={styles.worstCase}>
          Current worst-case:{' '}
          <span className={suggestion.currentWorstCase >= 0 ? 'positive' : 'negative'}>
            {suggestion.currentWorstCase >= 0 ? '+' : ''}₹
            {Math.abs(suggestion.currentWorstCase).toLocaleString('en-IN')}
          </span>
        </div>
      )}

      <Disclaimer />
    </div>
  );
}
