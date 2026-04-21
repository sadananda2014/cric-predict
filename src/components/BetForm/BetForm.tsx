import { useState, useEffect } from 'react';
import { useMatchStore } from '../../store/matchStore';
import { validateRate, validateStake } from '../../engine/validation';
import { calculatePosition } from '../../engine/pnl';
import { projectPosition } from '../../engine/hedging';
import { hasOddsApiKey, fetchRatesForMatch } from '../../services/oddsApi';
import { isScraperRunning, scrapeLiveRates, refreshLiveRates } from '../../services/liveScraper';
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
  const [betRate, setBetRate] = useState('');
  const [stake, setStake] = useState('');
  const [stakeMode, setStakeMode] = useState<'stake' | 'peti'>('stake');
  const [peti, setPeti] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [fetchingRates, setFetchingRates] = useState(false);
  const [rateSource, setRateSource] = useState('');
  const [scraperAvailable, setScraperAvailable] = useState(false);
  const [scrapingLive, setScrapingLive] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [scraperUrl, setScraperUrl] = useState(match.scraperUrl || '');
  const setScraperUrlStore = useMatchStore((s) => s.setScraperUrl);

  // Check if scraper server is running on mount
  useEffect(() => {
    isScraperRunning().then(setScraperAvailable);
  }, []);

  // Auto-fill bet rate when team or rates change
  useEffect(() => {
    if (!betTeam) return;
    const isFav = betTeam === favouriteTeam;
    setBetRate(isFav ? lagaaiRate : khaaiRate);
  }, [betTeam, favouriteTeam, lagaaiRate, khaaiRate]);

  // Auto-refresh: poll every 5 seconds
  useEffect(() => {
    if (!autoRefresh || !scraperAvailable || !scraperUrl) return;
    const interval = setInterval(async () => {
      try {
        const result = await refreshLiveRates();
        applyScrapedRates(result);
      } catch {
        // silent fail on auto-refresh
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, scraperAvailable, scraperUrl]);

  function matchTeamName(scraped: string, short: string): boolean {
    const s = scraped.toLowerCase();
    const t = short.toLowerCase();
    // Direct substring
    if (s.includes(t) || t.includes(s)) return true;
    // Word match
    if (s.split(' ').some(w => w.length > 2 && t.includes(w))) return true;
    // IPL alias mapping: short code → keywords in full name
    const ALIASES: Record<string, string[]> = {
      kkr: ['kolkata', 'knight'],
      lsg: ['lucknow', 'super giant'],
      csk: ['chennai', 'super king'],
      mi: ['mumbai', 'indian'],
      rcb: ['bangalore', 'bengaluru', 'royal challenger'],
      dc: ['delhi', 'capital'],
      srh: ['hyderabad', 'sunriser'],
      rr: ['rajasthan', 'royal'],
      pbks: ['punjab', 'king'],
      gt: ['gujarat', 'titan'],
    };
    const aliases = ALIASES[t] || [];
    return aliases.some(a => s.includes(a));
  }

  function applyScrapedRates(result: Awaited<ReturnType<typeof scrapeLiveRates>>) {
    // Map scraped favourite to our match teams
    const isFavA = matchTeamName(result.favouriteTeam, match.teamA);
    const isFavB = matchTeamName(result.favouriteTeam, match.teamB);
    if (isFavA) setFavouriteTeam(match.teamA);
    else if (isFavB) setFavouriteTeam(match.teamB);
    setLagaaiRate(result.lagaaiRate.toString());
    setKhaaiRate(result.khaaiRate.toString());
    setRateSource(`Live · ${new Date(result.timestamp).toLocaleTimeString()}`);
    // Auto-save the rate entry
    const favTeam = isFavA ? match.teamA : match.teamB;
    addRateEntry(match.id, favTeam, result.lagaaiRate, result.khaaiRate);
  }

  async function handleScrapeLive() {
    if (!scraperUrl) {
      setErrors((prev) => ({ ...prev, scraper: 'Enter a betting site URL' }));
      return;
    }
    setScrapingLive(true);
    setErrors((prev) => { const { scraper: _, ...rest } = prev; return rest; });
    try {
      // Save URL to match
      setScraperUrlStore(match.id, scraperUrl);
      const result = await scrapeLiveRates(scraperUrl);
      applyScrapedRates(result);
    } catch (err) {
      setErrors((prev) => ({ ...prev, scraper: err instanceof Error ? err.message : 'Scrape failed' }));
    } finally {
      setScrapingLive(false);
    }
  }

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

    // Custom bet rate
    const customRate = Number(betRate);
    const customRateResult = validateRate(customRate);
    if (!customRateResult.valid) errs.betRate = customRateResult.error!;

    let stakeVal: number;
    const isFavourite = betTeam === favouriteTeam;

    if (stakeMode === 'peti') {
      const petiVal = Number(peti);
      if (!Number.isFinite(petiVal) || petiVal <= 0 || petiVal > 99) {
        errs.peti = 'Enter 0.25–99 peti';
      } else {
        if (isFavourite) {
          // Lagaai: risk = peti × 1 lakh
          stakeVal = petiVal * 100_000;
        } else {
          // Khaai: risk = peti × betRate × 1000
          stakeVal = petiVal * customRate * 1000;
        }
      }
      stakeVal = stakeVal!;
    } else {
      const enteredStake = Number(stake);
      const stakeResult = validateStake(enteredStake);
      if (!stakeResult.valid) errs.stake = stakeResult.error!;

      if (!isFavourite && enteredStake > 0 && customRate > 0) {
        const petiEquiv = enteredStake / 100_000;
        stakeVal = petiEquiv * customRate * 1000;
      } else {
        stakeVal = enteredStake;
      }
    }

    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    // Save rate entry first
    addRateEntry(match.id, favouriteTeam, lagVal, khaVal);

    // Use custom bet rate for the actual bet
    const betType = isFavourite ? 'lagaai' as const : 'khaai' as const;

    addBet(match.id, betTeam, betType, customRate, stakeVal);
    setStake('');
    setPeti('');
    setBetTeam('');    setBetRate('');  }

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

      {/* Live Scraper */}
      {scraperAvailable && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>🔴 Live Rates (AlphaBook)</div>
          <Input
            label="Match URL"
            placeholder="https://alphabook247.com/client/.../event_detail/..."
            value={scraperUrl}
            onChange={(e) => setScraperUrl(e.target.value)}
          />
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <Button
              variant="secondary"
              onClick={handleScrapeLive}
              disabled={scrapingLive}
            >
              {scrapingLive ? '⏳ Scraping…' : '🔴 Fetch Live'}
            </Button>
            <label style={{ fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                style={{ accentColor: 'var(--accent)' }}
              />
              Auto (5s)
            </label>
          </div>
          {rateSource && rateSource.startsWith('Live') && (
            <span style={{ fontSize: '0.68rem', color: 'var(--green)', textAlign: 'center' }}>
              ✓ {rateSource}
            </span>
          )}
          {errors.scraper && (
            <span style={{ fontSize: '0.7rem', color: 'var(--red)', textAlign: 'center' }}>
              {errors.scraper}
            </span>
          )}
        </div>
      )}

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

        {/* Custom Bet Rate */}
        {betTeam && (
          <Input
            label={`Bet Rate (${betTeam === favouriteTeam ? 'Lagaai' : 'Khaai'})`}
            type="number"
            placeholder={betTeam === favouriteTeam ? lagaaiRate : khaaiRate}
            value={betRate}
            onChange={(e) => setBetRate(e.target.value)}
            error={errors.betRate}
            min={1}
          />
        )}

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
          <div>
            <Input
              label="Stake (₹)"
              type="number"
              placeholder="e.g. 1000"
              value={stake}
              onChange={(e) => setStake(e.target.value)}
              error={errors.stake}
              min={1}
            />
            {stake && betTeam && Number(stake) > 0 && (() => {
              const enteredStake = Number(stake);
              const isFav = betTeam === favouriteTeam;
              const curBetRate = Number(betRate) || (isFav ? Number(lagaaiRate) : Number(khaaiRate));
              const betType = isFav ? 'lagaai' as const : 'khaai' as const;

              if (!curBetRate || curBetRate <= 0) return null;

              // Convert to peti (entered ₹ / 1L), then calc same as peti mode
              const petiEquiv = enteredStake / 100_000;
              const thisBetWin = isFav ? petiEquiv * curBetRate * 1000 : petiEquiv * 100_000;
              const thisBetLoss = isFav ? petiEquiv * 100_000 : petiEquiv * curBetRate * 1000;

              // Actual stake for engine: lagaai = entered, khaai = peti × rate × 1000
              const actualStake = isFav ? enteredStake : petiEquiv * curBetRate * 1000;

              const currentPos = calculatePosition(match.bets, match.teamA, match.teamB);
              const hypBet: Bet = { id: '', team: betTeam, betType, rate: curBetRate, stake: actualStake, createdAt: '' };
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
                    +₹{Math.round(thisBetWin).toLocaleString('en-IN')}
                  </div>
                  <div>
                    <span style={{ color: 'var(--red)' }}>✗ {betTeam === favouriteTeam ? underdogTeam : favouriteTeam} wins:</span>{' '}
                    −₹{Math.round(thisBetLoss).toLocaleString('en-IN')}
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
              const curBetRate = Number(betRate) || (isFav ? Number(lagaaiRate) : Number(khaaiRate));
              const betType = isFav ? 'lagaai' as const : 'khaai' as const;
              const betStake = isFav ? petiVal * 100_000 : petiVal * curBetRate * 1000;

              // This bet's individual P&L
              const thisBetWin = isFav ? petiVal * curBetRate * 1000 : petiVal * 100_000;
              const thisBetLoss = isFav ? petiVal * 100_000 : petiVal * curBetRate * 1000;

              // Overall projected position
              const currentPos = calculatePosition(match.bets, match.teamA, match.teamB);
              const hypBet: Bet = { id: '', team: betTeam, betType, rate: curBetRate, stake: betStake, createdAt: '' };
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
