import { useState, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Match } from '../../types';
import {
  calculateBreakeven,
  findProfitMaximizingBet,
  detectScalpingOpportunities,
  generateMultiStepStrategies,
  calculateKelly,
  getAlerts,
  saveAlert,
  removeAlert,
  checkAlerts,
} from '../../engine/analytics';
import { formatPeti } from '../../engine/rates';
import styles from './Analytics.module.css';

interface AnalyticsProps {
  match: Match;
}

export function Analytics({ match }: AnalyticsProps) {
  const latestRate = match.rateEntries.length > 0
    ? match.rateEntries[match.rateEntries.length - 1]
    : null;

  if (!latestRate || match.bets.length === 0) {
    return null;
  }

  return (
    <div className={`${styles.panel} ${styles.scrollable}`}>
      <BreakevenSection match={match} />
      <ProfitMaximizerSection match={match} />
      <ScalpDetectorSection match={match} />
      <StrategyPlannerSection match={match} />
      <KellySection match={match} />
      <AlertsSection match={match} />
    </div>
  );
}

// ─── Breakeven ──────────────────────────────────────────────────────

function BreakevenSection({ match }: { match: Match }) {
  const latestRate = match.rateEntries[match.rateEntries.length - 1];
  const result = useMemo(
    () => calculateBreakeven(match.bets, latestRate.favouriteTeam, match.teamA, match.teamB),
    [match.bets, match.rateEntries, match.teamA, match.teamB]
  );

  if (!result.teamA_breakevenRate && !result.teamB_breakevenRate) {
    return (
      <div className={styles.card}>
        <div className={styles.cardTitle}>
          <span className={styles.cardIcon}>⚖️</span> Breakeven
        </div>
        <div className={styles.empty}>No breakeven rate found for current position.</div>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardTitle}>
        <span className={styles.cardIcon}>⚖️</span> Breakeven Calculator
      </div>
      <div className={styles.subtitle}>Rate at which hedge brings worst-case to ₹0</div>
      {result.teamA_breakevenRate !== null && (
        <div className={styles.beRow}>
          <span>Breakeven rate</span>
          <span className={styles.beRate}>{result.teamA_breakevenRate}</span>
        </div>
      )}
      <div className={styles.beHint}>
        Current Lagaai: {latestRate.lagaaiRate} —{' '}
        {result.teamA_breakevenRate !== null && latestRate.lagaaiRate < result.teamA_breakevenRate
          ? 'Rate needs to go UP to breakeven'
          : 'Rate needs to go DOWN to breakeven'}
      </div>
    </div>
  );
}

// ─── Profit Maximizer ───────────────────────────────────────────────

function ProfitMaximizerSection({ match }: { match: Match }) {
  const latestRate = match.rateEntries[match.rateEntries.length - 1];
  const strategies = useMemo(
    () => findProfitMaximizingBet(match.bets, latestRate, match.teamA, match.teamB),
    [match.bets, match.rateEntries, match.teamA, match.teamB]
  );

  if (strategies.length === 0) {
    return null;
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardTitle}>
        <span className={styles.cardIcon}>💰</span> Profit Maximizer
      </div>
      <div className={styles.subtitle}>Top bets ranked by guaranteed minimum P&L</div>
      <div className={styles.strategyList}>
        {strategies.slice(0, 5).map((s, i) => (
          <div key={i} className={styles.strategyItem}>
            <span className={styles.strategyRank}>#{i + 1}</span>
            <div className={styles.strategyDesc}>
              {s.description}
              {i === 0 && <span className={`${styles.tag} ${styles.tagGreen}`}>BEST</span>}
            </div>
            <div className={styles.strategyPnl}>
              <div style={{ color: s.projectedMin >= 0 ? 'var(--green)' : 'var(--red)' }}>
                Min: {s.projectedMin >= 0 ? '+' : ''}₹{s.projectedMin.toLocaleString('en-IN')}
              </div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                Max: +₹{s.projectedMax.toLocaleString('en-IN')}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Scalping Detector ──────────────────────────────────────────────

function ScalpDetectorSection({ match }: { match: Match }) {
  const opportunities = useMemo(
    () => detectScalpingOpportunities(match.rateEntries, match.teamA, match.teamB),
    [match.rateEntries, match.teamA, match.teamB]
  );

  if (opportunities.length === 0) {
    return (
      <div className={styles.card}>
        <div className={styles.cardTitle}>
          <span className={styles.cardIcon}>📡</span> Scalping Detector
        </div>
        <div className={styles.empty}>No scalping opportunities detected yet. Need more rate movement.</div>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardTitle}>
        <span className={styles.cardIcon}>📡</span> Scalping / Arb Detector
      </div>
      <div className={styles.subtitle}>Opportunities from rate movements</div>
      {opportunities.map((opp, i) => (
        <div key={i} className={styles.scalpCard}>
          <div>{opp.description}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem' }}>
            <span>
              Profit: <strong style={{ color: 'var(--green)' }}>₹{opp.profit.toLocaleString('en-IN')}/peti</strong>
            </span>
            {opp.riskFree && <span className={styles.riskFree}>✓ RISK-FREE</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Strategy Planner ───────────────────────────────────────────────

function StrategyPlannerSection({ match }: { match: Match }) {
  const latestRate = match.rateEntries[match.rateEntries.length - 1];
  const plans = useMemo(
    () => generateMultiStepStrategies(match.bets, latestRate, match.teamA, match.teamB),
    [match.bets, match.rateEntries, match.teamA, match.teamB]
  );

  if (plans.length === 0) {
    return null;
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardTitle}>
        <span className={styles.cardIcon}>🗺️</span> Strategy Planner
      </div>
      <div className={styles.subtitle}>Conditional multi-step plans based on rate movement</div>
      {plans.map((plan, pi) => (
        <div key={pi} style={{ marginTop: pi > 0 ? '0.5rem' : 0 }}>
          <div className={styles.planName}>
            {plan.name}
            <span className={`${styles.tag} ${plan.finalMin >= 0 ? styles.tagGreen : styles.tagYellow}`}>
              Min: {plan.finalMin >= 0 ? '+' : ''}₹{plan.finalMin.toLocaleString('en-IN')}
            </span>
          </div>
          <div className={styles.strategyList}>
            {plan.steps.map((step, si) => (
              <div key={si} className={styles.stepRow}>
                <div className={styles.stepCondition}>{step.condition}</div>
                <div className={styles.stepAction}>→ {step.action}</div>
                <div className={styles.stepPnl}>
                  {match.teamA}: {step.projectedTeamA >= 0 ? '+' : ''}₹{step.projectedTeamA.toLocaleString('en-IN')} |{' '}
                  {match.teamB}: {step.projectedTeamB >= 0 ? '+' : ''}₹{step.projectedTeamB.toLocaleString('en-IN')}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Kelly Criterion ────────────────────────────────────────────────

function KellySection({ match }: { match: Match }) {
  const [bankroll, setBankroll] = useState(1000000); // default 10L
  const latestRate = match.rateEntries[match.rateEntries.length - 1];

  const results = useMemo(
    () => calculateKelly(latestRate, bankroll, match.teamA, match.teamB),
    [match.rateEntries, bankroll, match.teamA, match.teamB]
  );

  return (
    <div className={styles.card}>
      <div className={styles.cardTitle}>
        <span className={styles.cardIcon}>🎯</span> Kelly Criterion Sizing
      </div>
      <div className={styles.subtitle}>Optimal bet sizing based on edge & bankroll</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem' }}>
        <label>Bankroll ₹</label>
        <input
          type="number"
          value={bankroll}
          onChange={(e) => setBankroll(Number(e.target.value) || 0)}
          style={{
            width: '100px',
            padding: '0.25rem 0.4rem',
            background: 'var(--bg-body)',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            color: 'var(--text)',
            fontSize: '0.75rem',
          }}
          min={0}
          step={100000}
        />
        <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>
          ({formatPeti(bankroll / 100000)} peti)
        </span>
      </div>
      {results.length === 0 ? (
        <div className={styles.empty}>No positive edge detected at current rates.</div>
      ) : (
        results.map((r, i) => (
          <div key={i} className={styles.kellyRow}>
            <div>
              <div>{r.description}</div>
              <div className={styles.kellyMeta}>
                Edge: {r.edge}% | Kelly fraction: {r.kellyFraction}%
              </div>
            </div>
            <div className={styles.kellyPeti}>{formatPeti(r.optimalPeti)}</div>
          </div>
        ))
      )}
    </div>
  );
}

// ─── Rate Alerts ────────────────────────────────────────────────────

function AlertsSection({ match }: { match: Match }) {
  const [targetRate, setTargetRate] = useState('');
  const [direction, setDirection] = useState<'above' | 'below'>('above');
  const [alerts, setAlerts] = useState(() => getAlerts().filter((a) => a.matchId === match.id));

  const latestRate = match.rateEntries[match.rateEntries.length - 1];

  // Check triggered alerts on rate change
  useMemo(() => {
    const triggered = checkAlerts(match.id, latestRate.lagaaiRate);
    if (triggered.length > 0) {
      setAlerts(getAlerts().filter((a) => a.matchId === match.id));
    }
  }, [match.rateEntries, match.id]);

  function handleAdd() {
    const rate = Number(targetRate);
    if (!rate || rate < 1 || rate > 99) return;
    const alert = {
      id: uuidv4(),
      matchId: match.id,
      targetRate: rate,
      direction,
      triggered: false,
      createdAt: new Date().toISOString(),
    };
    saveAlert(alert);
    setAlerts(getAlerts().filter((a) => a.matchId === match.id));
    setTargetRate('');
  }

  function handleRemove(id: string) {
    removeAlert(id);
    setAlerts(getAlerts().filter((a) => a.matchId === match.id));
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardTitle}>
        <span className={styles.cardIcon}>🔔</span> Rate Alerts
      </div>
      <div className={styles.subtitle}>Get notified when rate reaches a target</div>
      <div className={styles.alertForm}>
        <input
          type="number"
          placeholder="Rate"
          value={targetRate}
          onChange={(e) => setTargetRate(e.target.value)}
          min={1}
          max={99}
          style={{
            width: '60px',
            padding: '0.25rem 0.4rem',
            background: 'var(--bg-body)',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            color: 'var(--text)',
            fontSize: '0.75rem',
          }}
        />
        <select
          value={direction}
          onChange={(e) => setDirection(e.target.value as 'above' | 'below')}
          style={{
            padding: '0.25rem 0.4rem',
            background: 'var(--bg-body)',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            color: 'var(--text)',
            fontSize: '0.75rem',
          }}
        >
          <option value="above">≥ Above</option>
          <option value="below">≤ Below</option>
        </select>
        <button
          onClick={handleAdd}
          style={{
            padding: '0.25rem 0.6rem',
            background: 'var(--accent)',
            border: 'none',
            borderRadius: '4px',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '0.75rem',
          }}
        >
          Add
        </button>
      </div>
      {alerts.length === 0 ? (
        <div className={styles.empty}>No alerts set.</div>
      ) : (
        <div className={styles.alertList}>
          {alerts.map((a) => (
            <div key={a.id} className={`${styles.alertItem} ${a.triggered ? styles.alertTriggered : ''}`}>
              <span>
                Rate {a.direction === 'above' ? '≥' : '≤'} {a.targetRate}
                {a.triggered && <span className={`${styles.tag} ${styles.tagGreen}`}>TRIGGERED</span>}
              </span>
              <button className={styles.deleteBtn} onClick={() => handleRemove(a.id)}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
