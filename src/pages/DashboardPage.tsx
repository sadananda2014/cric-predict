import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useMatchStore } from '../store/matchStore';
import { calculateSessionStats } from '../engine/analytics';
import styles from './DashboardPage.module.css';

export function DashboardPage() {
  const matches = useMatchStore((s) => s.matches);

  const stats = useMemo(() => calculateSessionStats(matches), [matches]);

  if (stats.totalMatches === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <span className={styles.title}>Session Dashboard</span>
          <Link to="/" className={styles.backLink}>← Back</Link>
        </div>
        <div className={styles.empty}>
          No matches yet. Create some matches to see session stats.
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>Session Dashboard</span>
        <Link to="/" className={styles.backLink}>← Back</Link>
      </div>

      <div className={styles.grid}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total Matches</div>
          <div className={styles.statValue}>{stats.totalMatches}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Active / Completed</div>
          <div className={styles.statValue}>
            {stats.activeMatches} / {stats.completedMatches}
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total Bets</div>
          <div className={styles.statValue}>{stats.totalBets}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total Staked</div>
          <div className={styles.statValue}>
            ₹{stats.totalStaked.toLocaleString('en-IN')}
          </div>
        </div>
      </div>

      <div className={styles.grid}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Net P&L</div>
          <div
            className={styles.statValue}
            style={{ color: stats.totalPnL >= 0 ? 'var(--green)' : 'var(--red)' }}
          >
            {stats.totalPnL >= 0 ? '+' : ''}₹{stats.totalPnL.toLocaleString('en-IN')}
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>ROI</div>
          <div
            className={styles.statValue}
            style={{ color: stats.roi >= 0 ? 'var(--green)' : 'var(--red)' }}
          >
            {stats.roi >= 0 ? '+' : ''}{stats.roi}%
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Win Rate</div>
          <div className={styles.statValue}>
            {stats.completedMatches > 0
              ? Math.round((stats.winningMatches / stats.completedMatches) * 100)
              : 0}%
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Avg P&L / Match</div>
          <div
            className={styles.statValue}
            style={{ color: stats.avgPnLPerMatch >= 0 ? 'var(--green)' : 'var(--red)' }}
          >
            {stats.avgPnLPerMatch >= 0 ? '+' : ''}₹{stats.avgPnLPerMatch.toLocaleString('en-IN')}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <div className={styles.highlight}>
          <div className={styles.highlightRow}>
            <span className={styles.highlightLabel}>Best Match</span>
            {stats.bestMatch && (
              <span style={{ color: 'var(--green)', fontWeight: 700 }}>
                +₹{stats.bestMatch.pnl.toLocaleString('en-IN')}
              </span>
            )}
          </div>
          {stats.bestMatch && (
            <div style={{ fontSize: '0.8rem' }}>{stats.bestMatch.name}</div>
          )}
          {!stats.bestMatch && (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No completed matches</div>
          )}
        </div>

        <div className={styles.highlight}>
          <div className={styles.highlightRow}>
            <span className={styles.highlightLabel}>Worst Match</span>
            {stats.worstMatch && (
              <span style={{ color: 'var(--red)', fontWeight: 700 }}>
                ₹{stats.worstMatch.pnl.toLocaleString('en-IN')}
              </span>
            )}
          </div>
          {stats.worstMatch && (
            <div style={{ fontSize: '0.8rem' }}>{stats.worstMatch.name}</div>
          )}
          {!stats.worstMatch && (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No completed matches</div>
          )}
        </div>
      </div>

      <div className={styles.highlight}>
        <div className={styles.highlightRow}>
          <span className={styles.highlightLabel}>Winning Matches</span>
          <span style={{ color: 'var(--green)' }}>{stats.winningMatches}</span>
        </div>
        <div className={styles.highlightRow}>
          <span className={styles.highlightLabel}>Losing Matches</span>
          <span style={{ color: 'var(--red)' }}>{stats.losingMatches}</span>
        </div>
      </div>
    </div>
  );
}
