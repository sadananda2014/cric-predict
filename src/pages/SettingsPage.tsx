import { useState } from 'react';
import { Link } from 'react-router-dom';
import { hasApiKey, saveApiKey, removeApiKey } from '../services/cricketApi';
import { hasOddsApiKey, saveOddsApiKey, removeOddsApiKey } from '../services/oddsApi';
import { Button, Input } from '../components/common';

const cardStyle = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '0.75rem',
  display: 'flex',
  flexDirection: 'column' as const,
  gap: '0.6rem',
};

export function SettingsPage() {
  const [apiKey, setApiKey] = useState('');
  const [configured, setConfigured] = useState(hasApiKey());
  const [saved, setSaved] = useState(false);

  const [oddsKey, setOddsKey] = useState('');
  const [oddsConfigured, setOddsConfigured] = useState(hasOddsApiKey());
  const [oddsSaved, setOddsSaved] = useState(false);

  function handleSave() {
    if (!apiKey.trim()) return;
    saveApiKey(apiKey);
    setConfigured(true);
    setSaved(true);
    setApiKey('');
    setTimeout(() => setSaved(false), 2000);
  }

  function handleRemove() {
    removeApiKey();
    setConfigured(false);
  }

  function handleOddsSave() {
    if (!oddsKey.trim()) return;
    saveOddsApiKey(oddsKey);
    setOddsConfigured(true);
    setOddsSaved(true);
    setOddsKey('');
    setTimeout(() => setOddsSaved(false), 2000);
  }

  function handleOddsRemove() {
    removeOddsApiKey();
    setOddsConfigured(false);
  }

  return (
    <div style={{ padding: '1rem', maxWidth: 480, margin: '0 auto' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem',
        }}
      >
        <h1 style={{ fontSize: '1.15rem', fontWeight: 700 }}>⚙️ Settings</h1>
        <Link
          to="/"
          style={{ fontSize: '0.85rem', color: 'var(--accent)' }}
        >
          ← Back
        </Link>
      </div>

      {/* CricAPI - Live Scores */}
      <div style={cardStyle}>
        <div>
          <h2
            style={{
              fontSize: '0.85rem',
              fontWeight: 600,
              marginBottom: '0.25rem',
            }}
          >
            Live Score API Key
          </h2>
          <p
            style={{
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              lineHeight: 1.4,
            }}
          >
            Get a free API key from{' '}
            <a
              href="https://cricapi.com"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--accent)' }}
            >
              cricapi.com
            </a>{' '}
            (100 requests/day free). This enables live score updates in match
            view.
          </p>
        </div>

        {configured ? (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span
              style={{
                fontSize: '0.8rem',
                color: 'var(--green)',
                fontWeight: 600,
              }}
            >
              ✓ API key configured
            </span>
            <Button variant="danger" onClick={handleRemove}>
              Remove
            </Button>
          </div>
        ) : (
          <>
            <Input
              label="API Key"
              type="password"
              placeholder="Paste your CricAPI key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <Button onClick={handleSave} disabled={!apiKey.trim()}>
              Save Key
            </Button>
          </>
        )}

        {saved && (
          <span
            style={{
              fontSize: '0.8rem',
              color: 'var(--green)',
              textAlign: 'center',
            }}
          >
            Saved! Live scores are now enabled.
          </span>
        )}
      </div>

      {/* The Odds API - Betting Rates */}
      <div style={{ ...cardStyle, marginTop: '0.75rem' }}>
        <div>
          <h2
            style={{
              fontSize: '0.85rem',
              fontWeight: 600,
              marginBottom: '0.25rem',
            }}
          >
            Betting Odds API Key
          </h2>
          <p
            style={{
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              lineHeight: 1.4,
            }}
          >
            Get a free API key from{' '}
            <a
              href="https://the-odds-api.com"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--accent)' }}
            >
              the-odds-api.com
            </a>{' '}
            (500 requests/month free). This enables auto-fetching Lagaai/Khaai
            rates from bookmaker odds.
          </p>
        </div>

        {oddsConfigured ? (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span
              style={{
                fontSize: '0.8rem',
                color: 'var(--green)',
                fontWeight: 600,
              }}
            >
              ✓ Odds API key configured
            </span>
            <Button variant="danger" onClick={handleOddsRemove}>
              Remove
            </Button>
          </div>
        ) : (
          <>
            <Input
              label="API Key"
              type="password"
              placeholder="Paste your The Odds API key"
              value={oddsKey}
              onChange={(e) => setOddsKey(e.target.value)}
            />
            <Button onClick={handleOddsSave} disabled={!oddsKey.trim()}>
              Save Key
            </Button>
          </>
        )}

        {oddsSaved && (
          <span
            style={{
              fontSize: '0.8rem',
              color: 'var(--green)',
              textAlign: 'center',
            }}
          >
            Saved! Auto-fetch rates are now enabled.
          </span>
        )}
      </div>
    </div>
  );
}
