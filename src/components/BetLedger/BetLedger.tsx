import { useMatchStore } from '../../store/matchStore';
import { calculateBetPnL } from '../../engine/pnl';
import { stakeToPeti, formatPeti } from '../../engine/rates';
import type { Match } from '../../types';
import styles from './BetLedger.module.css';

interface BetLedgerProps {
  match: Match;
}

export function BetLedger({ match }: BetLedgerProps) {
  const deleteBet = useMatchStore((s) => s.deleteBet);

  if (match.bets.length === 0) {
    return (
      <div className={styles.emptyState}>
        No bets yet. Enter rates and place your first bet.
      </div>
    );
  }

  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th>Team</th>
          <th>Type</th>
          <th>Rate</th>
          <th>Peti</th>
          <th>Stake</th>
          <th>If {match.teamA}</th>
          <th>If {match.teamB}</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {match.bets.map((bet) => {
          const pnlA = calculateBetPnL(bet, match.teamA);
          const pnlB = calculateBetPnL(bet, match.teamB);
          const petiVal = stakeToPeti(bet.stake, bet.betType, bet.rate);
          return (
            <tr key={bet.id}>
              <td>{bet.team}</td>
              <td>
                <span
                  className={`${styles.betType} ${
                    bet.betType === 'lagaai' ? styles.lagaai : styles.khaai
                  }`}
                >
                  {bet.betType === 'lagaai' ? 'L' : 'K'}
                </span>
              </td>
              <td>{bet.rate}</td>
              <td style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{formatPeti(petiVal)}</td>
              <td>₹{bet.stake.toLocaleString('en-IN')}</td>
              <td className={pnlA >= 0 ? 'positive' : 'negative'}>
                {pnlA >= 0 ? '+' : ''}₹{Math.round(pnlA).toLocaleString('en-IN')}
              </td>
              <td className={pnlB >= 0 ? 'positive' : 'negative'}>
                {pnlB >= 0 ? '+' : ''}₹{Math.round(pnlB).toLocaleString('en-IN')}
              </td>
              <td>
                {match.status === 'active' && (
                  <button
                    className={styles.deleteBtn}
                    onClick={() => deleteBet(match.id, bet.id)}
                    title="Delete bet"
                  >
                    ✕
                  </button>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
