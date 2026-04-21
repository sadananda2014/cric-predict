/**
 * Client-side service for the live rate scraper server.
 * The scraper runs at http://localhost:3377 (start with `npm run scraper`).
 */

const SCRAPER_BASE = 'http://localhost:3377';

export interface ScrapedRunner {
  name: string;
  backOdds: number;
  layOdds: number;
  backVolume: number;
  layVolume: number;
}

export interface ScrapedRates {
  runners: ScrapedRunner[];
  favouriteTeam: string;
  underdogTeam: string;
  lagaaiRate: number;
  khaaiRate: number;
  timestamp: string;
}

/**
 * Check if the scraper server is running.
 */
export async function isScraperRunning(): Promise<boolean> {
  try {
    const res = await fetch(`${SCRAPER_BASE}/health`, { signal: AbortSignal.timeout(2000) });
    const data = await res.json();
    return data.status === 'ok';
  } catch {
    return false;
  }
}

/**
 * Scrape live match odds from a betting site URL.
 * Returns Lagaai/Khaai rates plus raw runner data.
 */
export async function scrapeLiveRates(url: string): Promise<ScrapedRates> {
  const res = await fetch(
    `${SCRAPER_BASE}/scrape?url=${encodeURIComponent(url)}`,
    { signal: AbortSignal.timeout(40000) }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Scraper request failed' }));
    throw new Error(err.error || `Scraper returned ${res.status}`);
  }

  return res.json();
}

/**
 * Re-scrape the current page (faster, no navigation).
 */
export async function refreshLiveRates(): Promise<ScrapedRates> {
  const res = await fetch(`${SCRAPER_BASE}/refresh`, {
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Refresh failed' }));
    throw new Error(err.error || `Scraper returned ${res.status}`);
  }

  return res.json();
}

/**
 * Open the login page in the scraper's browser.
 */
export async function openLoginPage(url?: string): Promise<void> {
  const res = await fetch(
    `${SCRAPER_BASE}/login?url=${encodeURIComponent(url || 'https://alphabook247.com')}`,
    { method: 'POST', signal: AbortSignal.timeout(35000) }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to open login' }));
    throw new Error(err.error);
  }
}
