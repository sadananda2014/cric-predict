/**
 * The Odds API service for fetching bookmaker odds and converting to Lagaai/Khaai rates.
 * Free tier: 500 requests/month — sign up at https://the-odds-api.com
 *
 * Conversion logic:
 *   Decimal odds → Lagaai/Khaai
 *   Favourite Lagaai rate = (decimal_odds - 1) × 100  (e.g. 1.96 → 96)
 *   Underdog Khaai rate  = 100 / (decimal_odds - 1)   (e.g. 2.03 → ~97)
 */

const ODDS_BASE_URL = 'https://api.the-odds-api.com/v4';
const SPORT_KEY = 'cricket_ipl';

const STORAGE_KEY = 'cric-predict-odds-apikey';

export interface OddsOutcome {
  name: string;
  price: number; // decimal odds
}

export interface OddsMarket {
  key: string;
  outcomes: OddsOutcome[];
  last_update?: string;
}

export interface OddsBookmaker {
  key: string;
  title: string;
  last_update: string;
  markets: OddsMarket[];
}

export interface OddsEvent {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: OddsBookmaker[];
}

export interface ConvertedRates {
  favouriteTeam: string;
  underdogTeam: string;
  lagaaiRate: number;
  khaaiRate: number;
  source: string; // bookmaker name
  lastUpdate: string;
}

// --- Storage ---

export function getOddsApiKey(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function hasOddsApiKey(): boolean {
  return !!getOddsApiKey();
}

export function saveOddsApiKey(key: string): void {
  localStorage.setItem(STORAGE_KEY, key.trim());
}

export function removeOddsApiKey(): void {
  localStorage.removeItem(STORAGE_KEY);
}

// --- API ---

async function fetchOddsApi<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const apiKey = getOddsApiKey();
  if (!apiKey) {
    throw new Error('Odds API key not configured. Go to Settings to add your The Odds API key.');
  }

  const url = new URL(`${ODDS_BASE_URL}/${endpoint}`);
  url.searchParams.set('apiKey', apiKey);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString());
  if (!response.ok) {
    if (response.status === 401) throw new Error('Invalid Odds API key');
    if (response.status === 429) throw new Error('Odds API rate limit reached. Try again later.');
    throw new Error(`Odds API request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

/**
 * Fetch IPL match odds (h2h market, decimal format)
 */
export async function getIPLOdds(): Promise<OddsEvent[]> {
  return fetchOddsApi<OddsEvent[]>(`sports/${SPORT_KEY}/odds`, {
    regions: 'eu,uk',
    markets: 'h2h',
    oddsFormat: 'decimal',
  });
}

/**
 * Find odds for a match by team names (fuzzy)
 */
export function findOddsByTeams(
  events: OddsEvent[],
  teamA: string,
  teamB: string
): OddsEvent | undefined {
  const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, '');
  const a = normalize(teamA);
  const b = normalize(teamB);

  // IPL team name mappings (short → full name patterns)
  const TEAM_ALIASES: Record<string, string[]> = {
    lsg: ['lucknow', 'supergiants', 'lucknowsupergiants'],
    dc: ['delhi', 'capitals', 'delhicapitals'],
    csk: ['chennai', 'superkings', 'chennaisuperkings'],
    mi: ['mumbai', 'indians', 'mumbaiindians'],
    rcb: ['bangalore', 'royalchallengers', 'rcb', 'bengaluru'],
    kkr: ['kolkata', 'knightriders', 'kolkataknightriders'],
    srh: ['hyderabad', 'sunrisers', 'sunrisershyderabad'],
    rr: ['rajasthan', 'royals', 'rajasthanroyals'],
    pbks: ['punjab', 'kings', 'punjabkings'],
    gt: ['gujarat', 'titans', 'gujarattitans'],
  };

  function matchesTeam(teamShortName: string, fullName: string): boolean {
    const n = normalize(fullName);
    if (n.includes(teamShortName) || teamShortName.includes(n)) return true;
    // Check aliases
    for (const aliases of Object.values(TEAM_ALIASES)) {
      if (aliases.some((alias) => teamShortName.includes(alias) || alias.includes(teamShortName))) {
        if (aliases.some((alias) => n.includes(alias) || alias.includes(n))) return true;
      }
    }
    return false;
  }

  return events.find((e) => {
    return (
      (matchesTeam(a, e.home_team) || matchesTeam(a, e.away_team)) &&
      (matchesTeam(b, e.home_team) || matchesTeam(b, e.away_team))
    );
  });
}

/**
 * Convert decimal odds to Lagaai/Khaai rates.
 *
 * The team with lower decimal odds (higher probability) is the favourite → gets Lagaai rate.
 * The team with higher decimal odds (lower probability) is the underdog → gets Khaai rate.
 */
export function convertDecimalToLagaaiKhaai(
  outcomes: OddsOutcome[]
): { favouriteTeam: string; underdogTeam: string; lagaaiRate: number; khaaiRate: number } | null {
  if (outcomes.length < 2) return null;

  // Sort: lower price = favourite
  const sorted = [...outcomes].sort((a, b) => a.price - b.price);
  const favourite = sorted[0];
  const underdog = sorted[1];

  // Lagaai rate for favourite: (decimal_odds - 1) × 100
  // e.g. 1.96 → 96 (bet 100, win 96 if favourite wins)
  const lagaaiRate = Math.round((favourite.price - 1) * 100);

  // Khaai rate for underdog: 100 / (decimal_odds - 1)
  // e.g. 2.03 → ~97 (bet 100, win ~103 if underdog wins)
  const khaaiRate = Math.round(100 / (underdog.price - 1));

  if (lagaaiRate < 1 || khaaiRate < 1) return null;

  return {
    favouriteTeam: favourite.name,
    underdogTeam: underdog.name,
    lagaaiRate,
    khaaiRate,
  };
}

/**
 * Fetch and convert odds for a specific match to Lagaai/Khaai rates.
 * Returns the best available conversion from the first bookmaker with h2h market.
 */
export async function fetchRatesForMatch(
  teamA: string,
  teamB: string
): Promise<ConvertedRates | null> {
  const events = await getIPLOdds();
  const event = findOddsByTeams(events, teamA, teamB);

  if (!event || event.bookmakers.length === 0) return null;

  // Try each bookmaker until we find valid h2h odds
  for (const bk of event.bookmakers) {
    const h2h = bk.markets.find((m) => m.key === 'h2h');
    if (!h2h) continue;

    const converted = convertDecimalToLagaaiKhaai(h2h.outcomes);
    if (!converted) continue;

    return {
      ...converted,
      source: bk.title,
      lastUpdate: bk.last_update,
    };
  }

  return null;
}
