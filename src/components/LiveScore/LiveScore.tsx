import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getCurrentMatches,
  findMatchByTeams,
  hasApiKey,
  type CricApiMatch,
} from '../../services/cricketApi';
import styles from './LiveScore.module.css';

interface LiveScoreProps {
  teamA: string;
  teamB: string;
}

export function LiveScore({ teamA, teamB }: LiveScoreProps) {
  const [match, setMatch] = useState<CricApiMatch | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchLiveScore = useCallback(async () => {
    if (!hasApiKey()) {
      setError('Add your CricAPI key in Settings to see live scores.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // First try current matches list (cheaper API call)
      const matches = await getCurrentMatches();
      const found = findMatchByTeams(matches, teamA, teamB);

      if (found) {
        setMatch(found);
        setLastUpdated(new Date());
      } else {
        setError(`No live match found for ${teamA} vs ${teamB}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch score');
    } finally {
      setLoading(false);
    }
  }, [teamA, teamB]);

  // Fetch on mount and set up auto-refresh every 30s
  useEffect(() => {
    fetchLiveScore();

    intervalRef.current = setInterval(fetchLiveScore, 30000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchLiveScore]);

  if (!hasApiKey()) {
    return (
      <div className={styles.container}>
        <div className={styles.noKey}>
          <span className={styles.icon}>📡</span>
          <span>
            Add your free{' '}
            <a
              href="https://cricapi.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              CricAPI
            </a>{' '}
            key in{' '}
            <a href="/settings" className={styles.settingsLink}>
              Settings
            </a>{' '}
            to see live scores
          </span>
        </div>
      </div>
    );
  }

  if (loading && !match) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Fetching live score...</div>
      </div>
    );
  }

  if (error && !match) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <span>{error}</span>
          <button className={styles.retryBtn} onClick={fetchLiveScore}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!match) return null;

  const isLive = match.matchStarted && !match.matchEnded;
  const scores = match.score ?? [];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.liveTag}>
          {isLive ? (
            <>
              <span className={styles.liveDot} /> LIVE
            </>
          ) : match.matchEnded ? (
            'FINISHED'
          ) : (
            'UPCOMING'
          )}
        </div>
        <button
          className={styles.refreshBtn}
          onClick={fetchLiveScore}
          disabled={loading}
          title="Refresh score"
        >
          {loading ? '⟳' : '↻'}
        </button>
      </div>

      <div className={styles.matchStatus}>{match.status}</div>

      {scores.length > 0 && (
        <div className={styles.scores}>
          {scores.map((s, i) => (
            <div key={i} className={styles.inning}>
              <span className={styles.inningTeam}>{s.inning}</span>
              <span className={styles.inningScore}>
                {s.r}/{s.w} ({s.o} ov)
              </span>
            </div>
          ))}
        </div>
      )}

      {lastUpdated && (
        <div className={styles.updated}>
          Updated {lastUpdated.toLocaleTimeString()}
          {' · '}
          <span className={styles.autoRefresh}>auto-refresh 30s</span>
        </div>
      )}
    </div>
  );
}
