/**
 * Live rate scraper server using Puppeteer.
 *
 * Launches a persistent Chrome browser. The user logs in once (the session is
 * saved to disk). The frontend calls GET /scrape?url=... to fetch live
 * Match Odds and receive Lagaai/Khaai rates.
 *
 * Usage:
 *   npx tsx server/scraper.ts          # or via npm script
 *   GET http://localhost:3377/scrape?url=https://alphabook247.com/client/316004/event_detail/35460131
 *   GET http://localhost:3377/health
 *   POST http://localhost:3377/login?url=https://alphabook247.com  (opens login page for user)
 */

import express from 'express';
import cors from 'cors';
import puppeteer, { type Browser, type Page } from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const USER_DATA_DIR = path.join(__dirname, '..', '.scraper-profile');

const PORT = 3377;

let browser: Browser | null = null;
let page: Page | null = null;

// ─── Browser Management ─────────────────────────────────────────────

async function getBrowser(): Promise<Browser> {
  if (browser && browser.connected) return browser;

  console.log('🚀 Launching Chrome (persistent session)...');
  browser = await puppeteer.launch({
    headless: false, // visible so user can log in
    userDataDir: USER_DATA_DIR,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--window-size=1200,800',
    ],
    defaultViewport: { width: 1200, height: 800 },
  });

  browser.on('disconnected', () => {
    console.log('⚠️  Browser disconnected');
    browser = null;
    page = null;
  });

  return browser;
}

async function getPage(): Promise<Page> {
  const b = await getBrowser();
  if (page && !page.isClosed()) return page;

  const pages = await b.pages();
  page = pages[0] || (await b.newPage());
  return page;
}

// ─── DOM Scraping Logic ─────────────────────────────────────────────

interface ScrapedRunner {
  name: string;
  backOdds: number; // best back (b3 = closest to lay)
  layOdds: number;  // best lay (l1 = closest to back)
  backVolume: number;
  layVolume: number;
}

interface ScrapedResult {
  runners: ScrapedRunner[];
  favouriteTeam: string;
  underdogTeam: string;
  lagaaiRate: number;
  khaaiRate: number;
  timestamp: string;
}

async function scrapeMatchOdds(url: string): Promise<ScrapedResult> {
  const p = await getPage();

  // Navigate and wait for the odds to load
  const currentUrl = p.url();
  if (currentUrl !== url) {
    await p.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  }

  // Wait for the match odds section to appear
  await p.waitForSelector('.match_odds_section .runner_name', { timeout: 15000 });

  // Small delay for odds to populate
  await new Promise((r) => setTimeout(r, 1500));

  // Extract odds from DOM
  const runners = await p.evaluate(() => {
    const results: {
      name: string;
      backOdds: number;
      layOdds: number;
      backVolume: number;
      layVolume: number;
    }[] = [];

    const section = document.querySelector('.match_odds_section');
    if (!section) return results;

    const runnerDivs = section.querySelectorAll('.match_odds');

    for (const div of runnerDivs) {
      const nameEl = div.querySelector('.runner_name');
      if (!nameEl) continue;

      const name = (nameEl.textContent || '').trim();

      // Best back = the back box closest to lay (the one WITHOUT hide-on-small-only
      // and with class 'back' but not 'back-1' or 'back-2')
      // From the DOM: b3 is the best back (no hide-on-small-only)
      const backBoxes = div.querySelectorAll('.back.odds_box');
      const layBoxes = div.querySelectorAll('.lay.odds_box');

      // Best back = last back box (b3 in DOM order, the one without back-1/back-2)
      let bestBack = 0;
      let bestBackVol = 0;
      for (const box of backBoxes) {
        const oddEl = box.querySelector('.odd');
        const volEl = box.querySelector('.volume');
        if (oddEl) {
          const val = parseFloat(oddEl.textContent || '0');
          if (val > 0) {
            bestBack = val;
            bestBackVol = parseFloat((volEl?.textContent || '0').replace(/,/g, ''));
          }
        }
      }

      // Best lay = first lay box (l1 in DOM order, the one without lay-1/lay-2)
      let bestLay = 0;
      let bestLayVol = 0;
      for (const box of layBoxes) {
        const oddEl = box.querySelector('.odd');
        const volEl = box.querySelector('.volume');
        if (oddEl) {
          const val = parseFloat(oddEl.textContent || '0');
          if (val > 0 && bestLay === 0) {
            bestLay = val;
            bestLayVol = parseFloat((volEl?.textContent || '0').replace(/,/g, ''));
          }
        }
      }

      if (name && bestBack > 0) {
        results.push({
          name,
          backOdds: bestBack,
          layOdds: bestLay || bestBack,
          backVolume: bestBackVol,
          layVolume: bestLayVol,
        });
      }
    }

    return results;
  });

  if (runners.length < 2) {
    throw new Error('Could not find 2 runners in Match Odds section. Is the page loaded and logged in?');
  }

  // Sort by back odds: lower = favourite
  const sorted = [...runners].sort((a, b) => a.backOdds - b.backOdds);
  const favourite = sorted[0];
  const underdog = sorted[1];

  // Convert decimal odds to Lagaai/Khaai
  // Lagaai rate = (favourite_back_odds - 1) × 100
  const lagaaiRate = Math.round((favourite.backOdds - 1) * 100);

  // Khaai rate = 100 / (underdog_back_odds - 1)
  const khaaiRate = Math.round(100 / (underdog.backOdds - 1));

  return {
    runners,
    favouriteTeam: favourite.name,
    underdogTeam: underdog.name,
    lagaaiRate: Math.max(1, lagaaiRate),
    khaaiRate: Math.max(1, khaaiRate),
    timestamp: new Date().toISOString(),
  };
}

// ─── Express Server ─────────────────────────────────────────────────

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    browserConnected: browser?.connected ?? false,
  });
});

// Open a URL for the user to log in manually
app.post('/login', async (req, res) => {
  try {
    const url = (req.query.url as string) || 'https://alphabook247.com';
    const p = await getPage();
    await p.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    res.json({ status: 'ok', message: 'Login page opened in browser. Please log in manually.' });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Scrape match odds from a URL
app.get('/scrape', async (req, res) => {
  const url = req.query.url as string;
  if (!url) {
    res.status(400).json({ error: 'Missing ?url= parameter' });
    return;
  }

  // Basic URL validation
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes('alphabook') && !parsed.hostname.includes('localhost')) {
      res.status(400).json({ error: 'URL must be from alphabook domain' });
      return;
    }
  } catch {
    res.status(400).json({ error: 'Invalid URL' });
    return;
  }

  try {
    const result = await scrapeMatchOdds(url);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Refresh: re-scrape current page without navigating (for faster polling)
app.get('/refresh', async (_req, res) => {
  try {
    const p = await getPage();
    const url = p.url();
    if (!url || url === 'about:blank') {
      res.status(400).json({ error: 'No page loaded. Use /scrape?url=... first.' });
      return;
    }
    const result = await scrapeMatchOdds(url);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Start ──────────────────────────────────────────────────────────

app.listen(PORT, async () => {
  console.log(`\n🏏 CricPredict Scraper running on http://localhost:${PORT}`);
  console.log(`\n📋 Endpoints:`);
  console.log(`   GET  /health              - Server status`);
  console.log(`   POST /login?url=...       - Open login page in browser`);
  console.log(`   GET  /scrape?url=...      - Scrape match odds`);
  console.log(`   GET  /refresh             - Re-scrape current page\n`);

  // Pre-launch the browser
  try {
    await getBrowser();
    console.log('✅ Chrome launched. Session will persist between restarts.\n');
  } catch (err) {
    console.error('⚠️  Failed to launch browser:', (err as Error).message);
  }
});
