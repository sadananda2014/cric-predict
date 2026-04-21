import { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMatchStore } from '../../store/matchStore';
import { validateMatchTeams } from '../../engine/validation';
import { calculatePosition } from '../../engine/pnl';
import { Button, Input } from '../common';
import type { Match } from '../../types';
import styles from './MatchList.module.css';

export function MatchList() {
  const navigate = useNavigate();
  const matches = useMatchStore((s) => s.matches);
  const createMatch = useMatchStore((s) => s.createMatch);
  const importMatch = useMatchStore((s) => s.importMatch);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [teamA, setTeamA] = useState('');
  const [teamB, setTeamB] = useState('');
  const [matchUrl, setMatchUrl] = useState('');
  const [error, setError] = useState('');

  const activeMatches = Object.values(matches)
    .filter((m) => m.status === 'active')
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

  const completedMatches = Object.values(matches)
    .filter((m) => m.status === 'completed')
    .sort(
      (a, b) =>
        new Date(b.completedAt ?? b.createdAt).getTime() -
        new Date(a.completedAt ?? a.createdAt).getTime()
    );

  function handleCreate() {
    const result = validateMatchTeams(teamA, teamB);
    if (!result.valid) {
      setError(result.error!);
      return;
    }
    const id = createMatch(teamA, teamB, matchUrl || undefined);
    setTeamA('');
    setTeamB('');
    setMatchUrl('');
    setShowCreate(false);
    setError('');
    navigate(`/match/${id}`);
  }

  function handleLoadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string) as Match;
        if (!data.id || !data.teamA || !data.teamB) {
          alert('Invalid match file');
          return;
        }
        importMatch(data);
        navigate(`/match/${data.id}`);
      } catch {
        alert('Could not read file. Make sure it is a valid saved match JSON.');
      }
    };
    reader.readAsText(file);
    // Reset so the same file can be loaded again
    e.target.value = '';
  }

  function renderMatchItem(match: (typeof matches)[string]) {
    const pos = calculatePosition(match.bets, match.teamA, match.teamB);
    const worst = Math.min(pos.teamA_pnl, pos.teamB_pnl);
    const best = Math.max(pos.teamA_pnl, pos.teamB_pnl);

    return (
      <div
        key={match.id}
        className={styles.matchItem}
        onClick={() => navigate(`/match/${match.id}`)}
      >
        <div>
          <div className={styles.matchName}>
            {match.teamA} vs {match.teamB}
          </div>
          <div className={styles.matchMeta}>
            {pos.betCount} bet{pos.betCount !== 1 ? 's' : ''} · ₹
            {pos.totalStaked.toLocaleString('en-IN')} staked
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          {pos.betCount > 0 && (
            <>
              <div className={best >= 0 ? 'positive' : 'negative'}>
                ₹{best.toFixed(0)}
              </div>
              <div
                className={worst >= 0 ? 'positive' : 'negative'}
                style={{ fontSize: '0.75rem' }}
              >
                ₹{worst.toFixed(0)}
              </div>
            </>
          )}
          {match.status === 'completed' && (
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              {match.winner} won
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>🏏 CricPredict</h1>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <Link to="/settings" style={{ fontSize: '1.2rem', textDecoration: 'none' }} title="Settings">
            ⚙️
          </Link>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={handleLoadFile}
          />
          <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
            📂 Load
          </Button>
          {!showCreate && (
            <Button onClick={() => setShowCreate(true)}>+ New Match</Button>
          )}
        </div>
      </div>

      {showCreate && (
        <div className={styles.dialog}>
          <Input
            label="Team A"
            placeholder="e.g. LSG"
            value={teamA}
            onChange={(e) => setTeamA(e.target.value)}
            maxLength={10}
          />
          <Input
            label="Team B"
            placeholder="e.g. DC"
            value={teamB}
            onChange={(e) => setTeamB(e.target.value)}
            maxLength={10}
          />
          <Input
            label="Betting Site URL (optional)"
            placeholder="e.g. https://alphabook247.com/client/.../event_detail/..."
            value={matchUrl}
            onChange={(e) => setMatchUrl(e.target.value)}
          />
          {error && (
            <span style={{ color: 'var(--red)', fontSize: '0.8rem' }}>
              {error}
            </span>
          )}
          <div className={styles.dialogActions}>
            <Button
              variant="secondary"
              onClick={() => {
                setShowCreate(false);
                setError('');
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleCreate}>Create Match</Button>
          </div>
        </div>
      )}

      {activeMatches.length > 0 && (
        <>
          <h2>Active Matches</h2>
          {activeMatches.map(renderMatchItem)}
        </>
      )}

      {completedMatches.length > 0 && (
        <>
          <h2 style={{ marginTop: '0.5rem' }}>Completed</h2>
          {completedMatches.map(renderMatchItem)}
        </>
      )}

      {activeMatches.length === 0 && completedMatches.length === 0 && !showCreate && (
        <div className={styles.emptyState}>
          No matches yet. Create your first match to get started!
        </div>
      )}
    </div>
  );
}
