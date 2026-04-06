# Quickstart: Cricket Betting Predictor

**Feature**: 001-cricket-bet-predictor  
**Date**: 2026-04-01

---

## Prerequisites

- Node.js 18+ (LTS recommended)
- npm 9+ (comes with Node.js)

## Setup

```bash
# Clone and enter project
cd cric-info-app

# Install dependencies
npm install

# Start development server
npm run dev
```

The app opens at `http://localhost:5173`.

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run only engine tests (P&L, hedging, validation)
npm test -- --reporter=verbose tests/unit/engine/

# Run integration tests
npm test -- tests/integration/
```

## Project Layout

```
src/
├── engine/        ← Pure business logic (start here for understanding P&L math)
├── store/         ← Zustand state management
├── components/    ← React UI components
├── pages/         ← Route pages (HomePage, MatchPage)
├── types/         ← TypeScript interfaces
└── App.tsx        ← Root component + router
```

## Key Concepts

### Rate System (Lagaai/Khaai)

The app uses the Indian betting rate format:

- **Lagaai** (favourite): Bet ₹100, profit = rate (e.g., rate 96 → profit ₹96)
- **Khaai** (underdog): Bet = rate, profit = ₹100 (e.g., rate 97 → bet ₹97, profit ₹100)

### Core Flow

1. **Create a match** → enter two team names (e.g., LSG vs DC)
2. **Enter rates** → Lagaai and Khaai rates from Cricket Guru
3. **Record a bet** → pick team, enter stake
4. **View position** → see P&L for each possible outcome
5. **Get suggestion** → system recommends: Bet Now / Wait / Lock Profit / Reduce Exposure

### Engine Modules (pure functions, no React dependency)

| Module | Purpose |
|--------|---------|
| `engine/pnl.ts` | P&L calculation per bet and aggregate position |
| `engine/hedging.ts` | Hedging suggestions and optimal bet sizing |
| `engine/rates.ts` | Rate system utilities |
| `engine/validation.ts` | Input validation |

## Build for Production

```bash
npm run build
```

Output goes to `dist/`. Can be deployed to any static hosting (Netlify, Vercel, GitHub Pages).

## Validation Checklist

After setup, verify these work:

- [ ] `npm run dev` starts without errors
- [ ] Create a match with two teams
- [ ] Enter rates and record a bet
- [ ] Position summary shows correct P&L
- [ ] `npm test` passes all unit tests
