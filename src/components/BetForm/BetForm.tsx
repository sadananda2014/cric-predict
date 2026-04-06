import { useState } from 'react';
import { useMatchStore } from '../../store/matchStore';
import { getRateForTeam } from '../../engine/rates';
import { validateRate, validateStake } from '../../engine/validation';
import { calculatePosition } from '../../engine/pnl';
import { projectPosition } from '../../engine/hedging';
import { hasOddsApiKey, fetchRatesForMatch } from '../../services/oddsApi';
import { Button, Input } from '../common';
import type { Match, Bet } from '../../types';
import styles from './BetForm.module.css';

interface BetFormProps {
  match: Match;
}

export function BetForm({ match }: BetFormProps) {
  const addRateEntry = useMatchStore((s) => s.addRateEntry);
  const addBet = useMatchStore((s) => s.addBet);

  const latestRate = match.rateEntries[match.rateEntries.length - 1];

  const [favouriteTeam, setFavouriteTeam] = useState(
    latestRate?.favouriteTeam ?? match.teamA
  );
  const [lagaaiRate, setLagaaiRate] = useState(
    latestRate?.lagaaiRate?.toString() ?? ''
  );
  const [khaaiRate, setKhaaiRate] = useState(
    latestRate?.khaaiRate?.toString() ?? ''
  );
  const [betTeam, setBetTeam] = useState('');
  const [stake, setStake] = useState('');
  const [stakeMode, setStakeMode] = useState<'stake' | 'peti'>('stake');
  const [peti, setPeti] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [fetchingRates, setFetchingRates] = useState(false);
  const [rateSource, setRateSource] = useState('');

  async function handleFetchRates() {
    setFetchingRates(true);
    setRateSource('');
    try {
      const rates = await fetchRatesForMatch(match.teamA, match.teamB);
      if (!rates) {
        setErrors((prev) => ({ ...prev, fetch: 'No odds found for this match' }));
        return;
      }
      // Map favourite team name to match teams
      const favNorm = rates.favouriteTeam.toLowerCase();
      const isFavA = match.teamA.toLowerCase().includes(favNorm) || favNorm.includes(match.teamA.toLowerCase());
      setFavouriteTeam(isFavA ? match.teamA : match.teamB);
      setLagaaiRate(rates.lagaaiRate.toString());
      setKhaaiRate(rates.khaaiRate.toString());
      setRateSource(`${rates.source} · ${new Date(rates.lastUpdate).toLocaleTimeString()}`);
      setErrors({});
    } catch (err) {
      setErrors((prev) => ({ ...prev, fetch: err instanceof Error ? err.message : 'Failed to fetch rates' }));
    } finally {
      setFetchingRates(false);
    }
  }

  function validateRates(): boolean {
    const errs: Record<string, string> = {};
    const lagVal = Number(lagaaiRate);
    const khaVal = Number(khaaiRate);
    const lagResult = validateRate(lagVal);
    if (!lagResult.valid) errs.lagaai = lagResult.error!;
    const khaResult = validateRate(khaVal);
    if (!khaResult.valid) errs.khaai = khaResult.error!;
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleUpdateRates() {
    if (!validateRates()) return;
    addRateEntry(match.id, favouriteTeam, Number(lagaaiRate), Number(khaaiRate));
  }

  function handlePlaceBet() {
    const errs: Record<string, string> = {};
    const lagVal = Number(lagaaiRate);
    const khaVal = Number(khaaiRate);
    const lagResult = validateRate(lagVal);
    if (!lagResult.valid) errs.lagaai = lagResult.error!;
    const khaResult = validateRate(khaVal);
    if (!khaResult.valid) errs.khaai = khaResult.error!;
    if (!betTeam) errs.team = 'Select a team';

    let stakeVal: number;

    if (stakeMode === 'peti') {
      const petiVal = Number(peti);
      if (!Number.isFinite(petiVal) || petiVal <= 0 || petiVal > 99) {
        errs.peti = 'Enter 0.25–99 peti';
      } else {
        // Determine betType to compute correct stake
        const isFavourite = betTeam === favouriteTeam;
        if (isFavourite) {
          // Lagaai: risk = peti × 1 lakh
          stakeVal = petiVal * 100_000;
        } else {
          // Khaai: risk = peti × khaaiRate × 1000
          stakeVal = petiVal * khaVal * 1000;
        }
      }
      stakeVal = stakeVal!;
    } else {
      stakeVal = Number(stake);
      const stakeResult = validateStake(stakeVal);
      if (!stakeResult.valid) errs.stake = stakeResult.error!;
    }

    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    // Save rate entry first
    addRateEntry(match.id, favouriteTeam, lagVal, khaVal);

    // Get the rate and bet type for the selected team
    const rateEntry = {
      id: '',
      favouriteTeam,
      lagaaiRate: lagVal,
      khaaiRate: khaVal,
      createdAt: '',
    };
    const { rate, betType } = getRateForTeam(
      rateEntry,
      betTeam,
      match.teamA,
      match.teamB
    );

    addBet(match.id, betTeam, betType, rate, stakeVal);
    setStake('');
    setPeti('');
    setBetTeam('');
  }

  if (match.status === 'completed') return null;

  const underdogTeam =
    favouriteTeam === match.teamA ? match.teamB : match.teamA;

  return (
    <div className={styles.form}>
      {/* Rate Entry */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Current Rates</div>
        <div>
          <label
            style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}
          >
            Favourite
          </label>
          <div className={styles.teamSelector}>
            <button
              type="button"
              className={`${styles.teamBtn} ${favouriteTeam === match.teamA ? styles.teamBtnActive : ''}`}
              onClick={() => setFavouriteTeam(match.teamA)}
            >
              {match.teamA}
            </button>
            <button
              type="button"
              className={`${styles.teamBtn} ${favouriteTeam === match.teamB ? styles.teamBtnActive : ''}`}
              onClick={() => setFavouriteTeam(match.teamB)}
            >
              {match.teamB}
            </button>
          </div>
        </div>
        <div className={styles.row}>
          <Input
            label={`${favouriteTeam} Lagaai`}
            type="number"
            placeholder="e.g. 96"
            value={lagaaiRate}
            onChange={(e) => setLagaaiRate(e.target.value)}
            error={errors.lagaai}
            min={1}
          />
          <Input
            label={`${underdogTeam} Khaai`}
            type="number"
            placeholder="e.g. 97"
            value={khaaiRate}
            onChange={(e) => setKhaaiRate(e.target.value)}
            error={errors.khaai}
            min={1}
          />
        </div>
        <Button variant="secondary" onClick={handleUpdateRates}>
          Update Rates Only
        </Button>
        {hasOddsApiKey() && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            <Button
              variant="secondary"
              onClick={handleFetchRates}
              disabled={fetchingRates}
            >
              {fetchingRates ? '⏳ Fetching…' : '📡 Fetch Rates'}
            </Button>
            {rateSource && (
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                via {rateSource}
              </span>
            )}
            {errors.fetch && (
              <span style={{ fontSize: '0.7rem', color: 'var(--red)', textAlign: 'center' }}>
                {errors.fetch}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Bet Placement */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Place Bet</div>
        <div>
          <label
            style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}
          >
            Bet on
          </label>
          <div className={styles.teamSelector}>
            <button
              type="button"
              className={`${styles.teamBtn} ${betTeam === match.teamA ? styles.teamBtnActive : ''}`}
              onClick={() => setBetTeam(match.teamA)}
            >
              {match.teamA}{' '}
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                ({favouriteTeam === match.teamA ? 'Lagaai' : 'Khaai'})
              </span>
            </button>
            <button
              type="button"
              className={`${styles.teamBtn} ${betTeam === match.teamB ? styles.teamBtnActive : ''}`}
              onClick={() => setBetTeam(match.teamB)}
            >
              {match.teamB}{' '}
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                ({favouriteTeam === match.teamB ? 'Lagaai' : 'Khaai'})
              </span>
            </button>
          </div>
          {errors.team && (
            <span style={{ color: 'var(--red)', fontSize: '0.75rem' }}>
              {errors.team}
            </span>
          )}
        </div>

        {/* Stake Mode Toggle */}
        <div>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Amount Type
          </label>
          <div className={styles.teamSelector}>
            <button
              type="button"
              className={`${styles.teamBtn} ${stakeMode === 'stake' ? styles.teamBtnActive : ''}`}
              onClick={() => setStakeMode('stake')}
            >
              Stake (₹)
            </button>
            <button
              type="button"
              className={`${styles.teamBtn} ${stakeMode === 'peti' ? styles.teamBtnActive : ''}`}
              onClick={() => setStakeMode('peti')}
            >
              Peti (1L)
            </button>
          </div>
        </div>

        {stakeMode === 'stake' ? (
          <Input
            label="Stake (₹)"
            type="number"
            placeholder="e.g. 1000"
            value={stake}
            onChange={(e) => setStake(e.target.value)}
            error={errors.stake}
            min={1}
          />
        ) : (
          <div>
            <Input
              label="Peti (1 peti = ₹1,00,000)"
              type="number"
              placeholder="e.g. 0.5, 1, 2.5"
              value={peti}
              onChange={(e) => setPeti(e.target.value)}
              error={errors.peti}
              min={0.25}
              max={99}
              step={0.25}
            />
            {peti && betTeam && Number(peti) > 0 && Number(peti) <= 99 && (() => {
              const petiVal = Number(peti);
              const isFav = betTeam === favouriteTeam;
              const betRate = isFav ? Number(lagaaiRate) : Number(khaaiRate);
              const betType = isFav ? 'lagaai' as const : 'khaai' as const;
              const betStake = isFav ? petiVal * 100_000 : petiVal * Number(khaaiRate) * 1000;

              // This bet's individual P&L
              const thisBetWin = isFav ? petiVal * Number(lagaaiRate) * 1000 : petiVal * 100_000;
              const thisBetLoss = isFav ? petiVal * 100_000 : petiVal * Number(khaaiRate) * 1000;

              // Overall projected position
              const currentPos = calculatePosition(match.bets, match.teamA, match.teamB);
              const hypBet: Bet = { id: '', team: betTeam, betType, rate: betRate, stake: betStake, createdAt: '' };
              const projected = projectPosition(currentPos, hypBet, match.teamA, match.teamB);
              const hasExistingBets = match.bets.length > 0;

              return (
                <div
                  style={{
                    fontSize: '0.72rem',
                    color: 'var(--text-muted)',
                    marginTop: '0.25rem',
                    padding: '0.4rem',
                    background: 'var(--bg-body)',
                    borderRadius: 6,
                    lineHeight: 1.6,
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: '0.2rem', color: 'var(--text-primary)' }}>
                    This Bet
                  </div>
                  <div>
                    <span style={{ color: 'var(--green)' }}>✓ {betTeam} wins:</span>{' '}
                    +₹{thisBetWin.toLocaleString('en-IN')}
                  </div>
                  <div>
                    <span style={{ color: 'var(--red)' }}>✗ {betTeam === favouriteTeam ? underdogTeam : favouriteTeam} wins:</span>{' '}
                    −₹{thisBetLoss.toLocaleString('en-IN')}
                  </div>

                  {hasExistingBets && (
                    <>
                      <div style={{ borderTop: '1px solid var(--border)', marginTop: '0.35rem', paddingTop: '0.35rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        Overall Position (after this bet)
                      </div>
                      <div>
                        <span style={{ color: projected.teamA_pnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
                          {match.teamA} wins:
                        </span>{' '}
                        {projected.teamA_pnl >= 0 ? '+' : '−'}₹{Math.abs(Math.round(projected.teamA_pnl)).toLocaleString('en-IN')}
                      </div>
                      <div>
                        <span style={{ color: projected.teamB_pnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
                          {match.teamB} wins:
                        </span>{' '}
                        {projected.teamB_pnl >= 0 ? '+' : '−'}₹{Math.abs(Math.round(projected.teamB_pnl)).toLocaleString('en-IN')}
                      </div>
                    </>
                  )}
                </div>
              );
            })()}
          </div>
        )}
        <Button onClick={handlePlaceBet}>Place Bet</Button>
      </div>
    </div>
  );
}
