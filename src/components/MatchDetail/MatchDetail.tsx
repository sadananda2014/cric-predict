import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useMatchStore } from '../../store/matchStore';
import { calculateBetPnL, calculatePosition } from '../../engine/pnl';
import { generateSuggestion } from '../../engine/hedging';
import { BetForm } from '../BetForm/BetForm';
import { BetLedger } from '../BetLedger/BetLedger';
import { PositionSummary } from '../PositionSummary/PositionSummary';
import { Suggestion } from '../Suggestion/Suggestion';
import { RateScenarios } from '../RateScenarios/RateScenarios';
import { LiveScore } from '../LiveScore/LiveScore';
import { RateChart } from '../RateChart/RateChart';
import { Analytics } from '../Analytics/Analytics';
import { Predictor } from '../Predictor/Predictor';
import { Button } from '../common';
import type { Match } from '../../types';
import styles from './MatchDetail.module.css';

interface MatchDetailProps {
  match: Match;
}

export function MatchDetail({ match }: MatchDetailProps) {
  const completeMatch = useMatchStore((s) => s.completeMatch);
  const [selectedWinner, setSelectedWinner] = useState('');
  const [showComplete, setShowComplete] = useState(false);
  const [showSave, setShowSave] = useState(false);
  const [saveName, setSaveName] = useState(`${match.teamA} vs ${match.teamB}`);

  // Hedging suggestion
  const latestRate = match.rateEntries.length > 0
    ? match.rateEntries[match.rateEntries.length - 1]
    : null;

  const suggestion = useMemo(() => {
    if (match.status !== 'active' || match.bets.length === 0 || !latestRate) {
      return null;
    }
    const position = calculatePosition(match.bets, match.teamA, match.teamB);
    return generateSuggestion(position, latestRate, match.teamA, match.teamB);
  }, [match.bets, match.rateEntries, match.teamA, match.teamB, match.status, latestRate]);

  function handleComplete() {
    if (!selectedWinner) return;
    completeMatch(match.id, selectedWinner);
    setShowComplete(false);
  }

  function handleSave() {
    const fileName = saveName.trim() || `${match.teamA} vs ${match.teamB}`;
    const data = JSON.stringify(match, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setShowSave(false);
  }

  // Calculate realized P&L for completed matches
  const realizedPnL =
    match.status === 'completed' && match.winner
      ? match.bets.reduce(
          (sum, bet) => sum + calculateBetPnL(bet, match.winner!),
          0
        )
      : null;

  const totalStaked = match.bets.reduce((sum, b) => sum + b.stake, 0);

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <Link to="/" className={styles.backLink}>
          ← Back
        </Link>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            type="button"
            className={styles.saveBtn}
            onClick={() => setShowSave(!showSave)}
            title="Save match to file"
          >
            💾 Save
          </button>
          <span
            className={`${styles.statusBadge} ${
              match.status === 'active' ? styles.active : styles.completed
            }`}
          >
            {match.status}
          </span>
        </div>
      </div>

      {/* Save Dialog */}
      {showSave && (
        <div className={styles.saveDialog}>
          <input
            type="text"
            className={styles.saveInput}
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            placeholder="Enter file name"
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            autoFocus
          />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button variant="secondary" onClick={() => setShowSave(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Download</Button>
          </div>
        </div>
      )}
      <div className={styles.matchTitle}>
        {match.teamA} vs {match.teamB}
      </div>

      {/* Live Score */}
      {match.status === 'active' && (
        <LiveScore teamA={match.teamA} teamB={match.teamB} />
      )}

      {/* Completed match result */}
      {match.status === 'completed' && realizedPnL !== null && (
        <div className={styles.finalResult}>
          <div className={styles.finalLabel}>
            {match.winner} won — Final P&L
          </div>
          <div
            className={`${styles.finalValue} ${
              realizedPnL >= 0 ? 'positive' : 'negative'
            }`}
          >
            {realizedPnL >= 0 ? '+' : ''}₹
            {Math.round(realizedPnL).toLocaleString('en-IN')}
          </div>
          <div className={styles.summaryStats}>
            <span>{match.bets.length} bets</span>
            <span>₹{totalStaked.toLocaleString('en-IN')} invested</span>
            <span>Return: {totalStaked > 0 ? ((realizedPnL / totalStaked) * 100).toFixed(1) : '0'}%</span>
          </div>
        </div>
      )}

      {/* 3-Column Layout */}
      <div className={styles.columns}>
        {/* Column 1: Current Rates, Place Bet, Bet Ledger */}
        <div className={styles.column}>
          {match.status === 'active' && <BetForm match={match} />}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Bet Ledger</div>
            <BetLedger match={match} />
          </div>
        </div>

        {/* Column 2: Position, Suggestion, RateChart */}
        <div className={styles.column}>
          <PositionSummary match={match} />
          {suggestion && (
            <Suggestion
              suggestion={suggestion}
              teamA={match.teamA}
              teamB={match.teamB}
            />
          )}
          {match.status === 'active' && (
            <Predictor match={match} />
          )}
          {match.status === 'active' && match.rateEntries.length >= 2 && (
            <RateChart
              rateEntries={match.rateEntries}
              favouriteTeam={match.rateEntries[match.rateEntries.length - 1].favouriteTeam}
            />
          )}
        </div>

        {/* Column 3: Rate Scenarios, Analytics */}
        <div className={styles.column}>
          {match.status === 'active' && match.bets.length > 0 && latestRate && (
            <RateScenarios match={match} />
          )}
          {match.status === 'active' && (
            <Analytics match={match} />
          )}
        </div>
      </div>

      {/* Complete Match (active, has bets) */}
      {match.status === 'active' && match.bets.length > 0 && (
        <div className={styles.completeSection}>
          {!showComplete ? (
            <Button
              variant="secondary"
              onClick={() => setShowComplete(true)}
            >
              Complete Match
            </Button>
          ) : (
            <>
              <div className={styles.sectionTitle}>Select Winner</div>
              <div className={styles.winnerBtns}>
                <button
                  type="button"
                  className={`${styles.winnerBtn} ${
                    selectedWinner === match.teamA
                      ? styles.winnerBtnActive
                      : ''
                  }`}
                  onClick={() => setSelectedWinner(match.teamA)}
                >
                  {match.teamA}
                </button>
                <button
                  type="button"
                  className={`${styles.winnerBtn} ${
                    selectedWinner === match.teamB
                      ? styles.winnerBtnActive
                      : ''
                  }`}
                  onClick={() => setSelectedWinner(match.teamB)}
                >
                  {match.teamB}
                </button>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowComplete(false);
                    setSelectedWinner('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  onClick={handleComplete}
                  disabled={!selectedWinner}
                >
                  Confirm
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
