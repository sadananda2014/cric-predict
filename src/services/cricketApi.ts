/**
 * Cricket API service using CricAPI (cricapi.com)
 * Free tier: 100 requests/day — sign up at https://cricapi.com
 */

const BASE_URL = 'https://api.cricapi.com/v1';

export interface CricApiMatch {
  id: string;
  name: string;
  matchType: string;
  status: string;
  venue: string;
  date: string;
  dateTimeGMT: string;
  teams: string[];
  teamInfo?: Array<{
    name: string;
    shortname: string;
    img: string;
  }>;
  score?: Array<{
    r: number;   // runs
    w: number;   // wickets
    o: number;   // overs
    inning: string;
  }>;
  series_id?: string;
  fantasyEnabled?: boolean;
  bbbEnabled?: boolean;
  hasSquad?: boolean;
  matchStarted?: boolean;
  matchEnded?: boolean;
}

export interface CricApiResponse<T> {
  apikey: string;
  data: T;
  status: string;
  info: {
    hitsToday: number;
    hitsUsed: number;
    hitsLimit: number;
    credits: number;
    server: number;
    offsetRows: number;
    totalRows: number;
    queryTime: number;
    s: number;
    cache: number;
  };
}

function getApiKey(): string | null {
  try {
    const stored = localStorage.getItem('cric-predict-apikey');
    return stored;
  } catch {
    return null;
  }
}

async function fetchApi<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('API key not configured. Go to Settings to add your CricAPI key.');
  }

  const url = new URL(`${BASE_URL}/${endpoint}`);
  url.searchParams.set('apikey', apiKey);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  const data = await response.json();
  if (data.status === 'failure') {
    throw new Error(data.reason || 'API request failed');
  }

  return data as T;
}

/**
 * Fetch current/recent matches (live + recent finished)
 */
export async function getCurrentMatches(): Promise<CricApiMatch[]> {
  const response = await fetchApi<CricApiResponse<CricApiMatch[]>>('currentMatches', { offset: '0' });
  return response.data ?? [];
}

/**
 * Fetch specific match info by CricAPI match ID
 */
export async function getMatchInfo(matchId: string): Promise<CricApiMatch> {
  const response = await fetchApi<CricApiResponse<CricApiMatch>>('match_info', { id: matchId });
  return response.data;
}

/**
 * Search for IPL 2026 matches
 */
export async function searchIPLMatches(): Promise<CricApiMatch[]> {
  const all = await getCurrentMatches();
  return all.filter(
    (m) =>
      m.name?.toLowerCase().includes('ipl') ||
      m.name?.toLowerCase().includes('indian premier league') ||
      m.series_id?.toLowerCase().includes('ipl')
  );
}

/**
 * Find a match by team names (fuzzy match)
 */
export function findMatchByTeams(
  matches: CricApiMatch[],
  teamA: string,
  teamB: string
): CricApiMatch | undefined {
  const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, '');
  const a = normalize(teamA);
  const b = normalize(teamB);

  return matches.find((m) => {
    const matchTeams = m.teams?.map(normalize) ?? [];
    const matchName = normalize(m.name ?? '');
    return (
      (matchTeams.some((t) => t.includes(a) || a.includes(t)) &&
        matchTeams.some((t) => t.includes(b) || b.includes(t))) ||
      (matchName.includes(a) && matchName.includes(b))
    );
  });
}

/**
 * Check if API key is configured
 */
export function hasApiKey(): boolean {
  return !!getApiKey();
}

/**
 * Save API key to localStorage
 */
export function saveApiKey(key: string): void {
  localStorage.setItem('cric-predict-apikey', key.trim());
}

/**
 * Remove API key
 */
export function removeApiKey(): void {
  localStorage.removeItem('cric-predict-apikey');
}
