# Research: Cricket Betting Predictor

**Feature**: 001-cricket-bet-predictor  
**Date**: 2026-04-01  
**Purpose**: Resolve all technical unknowns; formalize the P&L math and hedging algorithm; confirm technology choices.

---

## R1: Lagaai/Khaai P&L Math Formalization

### Decision: Formalize P&L as piecewise arithmetic based on bet type

### Rationale

The Indian Lagaai/Khaai system is not standard decimal/fractional odds. Each bet type has different P&L mechanics:

**Lagaai bet (backing the favourite):**
- Stake: user-chosen amount (e.g., ₹1,000)
- If favourite wins: profit = stake × (rate / 100)
- If favourite loses: loss = stake
- Example: Bet ₹1,000 on LSG at Lagaai 96
  - LSG wins → profit = 1000 × (96/100) = +₹960
  - LSG loses → loss = −₹1,000

**Khaai bet (backing the underdog):**
- Stake: the rate amount itself (e.g., ₹97 per ₹100 unit)
- If underdog wins: profit = 100 per unit ×  (stake / rate)
  - Simplified: profit = stake × (100 / rate)
- If underdog loses: loss = stake
- Example: Bet ₹970 on DC at Khaai 97
  - DC wins → profit = 970 × (100/97) = +₹1,000
  - DC loses → loss = −₹970

**Generalized per-bet P&L function:**

```
function betPnL(bet, winningTeam):
  if bet.team == winningTeam:
    if bet.type == 'lagaai':
      return bet.stake * (bet.rate / 100)
    else: // khaai
      return bet.stake * (100 / bet.rate)
  else:
    return -bet.stake
```

**Portfolio position** = sum of betPnL for all bets, calculated for each possible winning team.

### Alternatives Considered

- **Decimal odds conversion**: Convert Lagaai/Khaai to decimal odds first, then use standard formulas. Rejected because it adds a conversion layer that doesn't match the user's mental model and introduces rounding errors.
- **Percentage-based display**: Show P&L as percentages. Rejected because users think in absolute rupee amounts.

---

## R2: Hedging Algorithm

### Decision: Use arithmetic hedging with 4-action decision tree

### Rationale

The hedging engine takes the current position (P&L for each outcome) and current rates, then determines the optimal action.

**Algorithm outline:**

1. **Calculate current position**: For each possible winner (Team A, Team B), sum all bet P&Ls.
   - `posA` = total P&L if Team A wins
   - `posB` = total P&L if Team B wins

2. **Classify position**:
   - Both positive → **profitable** (can lock profit)
   - One positive, one negative → **partial** (can hedge)
   - Both negative → **underwater** (need rate swing to recover)
   - Both zero → **neutral** (no bets placed)

3. **Decision logic**:

   **Lock Profit** (both positive):
   - Already profitable on both sides. Suggest: "You're green on both outcomes. No action needed, or place a small bet to increase the weaker side."

   **Bet Now / Hedge** (one positive, one negative):
   - Calculate the hedge bet to equalize both outcomes:
     - If posA > 0 and posB < 0: hedge by betting on Team B
     - Required hedge stake (Lagaai on Team B): `hedgeStake = |posB| / (rateB / 100 + 1)` approximately
     - Or if Khaai: `hedgeStake = |posB| / (100 / rateB + 1)`
   - Show projected P&L after hedge.
   - If rounding prevents perfect balance, show the closest achievable balance.

   **Wait** (both negative, rates haven't moved enough):
   - Calculate minimum rate change needed for a profitable hedge.
   - If current rates are within 5 points of the last rate entry, suggest waiting.
   - Show: "Wait for rate to move at least X points. Current worst-case: −₹Y."

   **Reduce Exposure** (both negative, rates have moved significantly):
   - Calculate the bet that minimizes the worst-case outcome.
   - `optimalBet = amount that minimizes max(|posA_new|, |posB_new|)`
   - Show worst-case and best-case after the hedge.

4. **Always include**:
   - Projected P&L for both outcomes if suggestion is followed
   - The math breakdown (what changes with this bet)
   - Current worst-case scenario

### Alternatives Considered

- **Linear programming solver**: Use a full LP solver for optimal bet sizing. Rejected per Constitution Principle III (YAGNI) — arithmetic hedging is sufficient for v1 and keeps the engine dependency-free.
- **Kelly criterion**: Use Kelly for bet sizing. Rejected because Kelly requires probability estimates; our app uses rates, not probabilities. The user doesn't input win probability — they input market rates.
- **Monte Carlo simulation**: Simulate match outcomes. Rejected — overkill for a two-outcome system (Team A wins or Team B wins). Pure arithmetic gives exact answers.

---

## R3: State Management — Zustand + localStorage

### Decision: Zustand with `persist` middleware for localStorage

### Rationale

- **Zustand** is chosen over Redux/Context because:
  - Minimal boilerplate — no providers, reducers, or action types
  - Built-in `persist` middleware handles localStorage serialization
  - Works outside React components (engine can read state if needed)
  - Bundle size ~1KB vs Redux ~7KB

- **Persistence pattern**:
  - Each match is stored as an object keyed by match ID (UUID)
  - Zustand `persist` middleware auto-syncs state to localStorage on every mutation
  - On app reload, state is hydrated from localStorage automatically
  - No manual save/load logic needed

- **Store shape**:
  ```typescript
  interface MatchStore {
    matches: Record<string, Match>
    createMatch(teamA: string, teamB: string): string  // returns match ID
    addBet(matchId: string, bet: NewBet): void
    deleteBet(matchId: string, betId: string): void
    addRateEntry(matchId: string, entry: NewRateEntry): void
    completeMatch(matchId: string, winner: string): void
    archiveMatch(matchId: string): void
  }
  ```

### Alternatives Considered

- **Redux Toolkit**: Industry standard but excessive boilerplate for a single-store app. Rejected per Principle III.
- **React Context + useReducer**: No external dependency, but no built-in persistence. Would require manual localStorage sync code. Rejected for ergonomics.
- **IndexedDB**: More storage capacity and structured queries. Rejected for v1 — localStorage is simpler and sufficient for the expected data volume (~50 bets × 10 matches = ~500 records).

---

## R4: Project Tooling — Vite + React + TypeScript

### Decision: Vite as build tool with React + TypeScript template

### Rationale

- **Vite** is the standard React scaffolding tool (Create React App is deprecated).
- `npm create vite@latest -- --template react-ts` generates the project skeleton.
- Vitest is Vite-native, shares the same config, and supports TypeScript natively.
- Dev server starts in <500ms, HMR is instant.

**Dependencies (production)**:
- `react`, `react-dom` — UI framework
- `react-router-dom` — client-side routing (2 routes: match list, match detail)
- `zustand` — state management + persistence
- `uuid` — match/bet ID generation (or `crypto.randomUUID()`)

**Dependencies (development)**:
- `vitest` — test runner
- `@testing-library/react` — component testing
- `@testing-library/jest-dom` — DOM matchers

**No additional dependencies needed.** The hedging engine is pure TypeScript with zero external deps.

### Alternatives Considered

- **Next.js**: SSR framework. Rejected — no server-side rendering needed for a fully client-side app. Adds unnecessary complexity (Principle III).
- **Create React App**: Deprecated and unmaintained. Rejected.
- **Webpack manual config**: Too much boilerplate. Vite handles it all out of the box.

---

## R5: UI Approach — Minimal CSS, Mobile-First

### Decision: Plain CSS with CSS Modules, mobile-first responsive design

### Rationale

- No CSS framework (Tailwind, MUI, etc.) is needed for v1 — the app has 2 pages and ~7 components.
- CSS Modules (built into Vite) provide scoped styles without runtime overhead.
- Mobile-first design because users hold their phone with Cricket Guru on one app and CricPredict on another (split screen or app-switching).
- Dark theme preferred (matches Cricket Guru's dark UI — reduces visual jarring when switching between apps).

### Alternatives Considered

- **Tailwind CSS**: Utility-first CSS. Rejected for v1 — adds build-time dependency for a small component set. Can be added later.
- **Material UI / Chakra UI**: Component libraries. Rejected — would dictate UI patterns and add ~100KB+ to bundle. Principle III.
- **Styled Components**: CSS-in-JS. Rejected — runtime overhead, unnecessary abstraction for this scale.

---

## Summary of Technology Decisions

| Decision | Choice | Key Reason |
|----------|--------|------------|
| P&L Math | Piecewise arithmetic (Lagaai/Khaai native) | Matches user mental model, no conversion errors |
| Hedging Algorithm | Arithmetic 4-action decision tree | Exact answers for 2-outcome system, zero dependencies |
| State Management | Zustand + persist middleware | Minimal boilerplate, built-in localStorage sync |
| Build Tool | Vite + React 18 + TypeScript | Fast dev server, native Vitest integration |
| Testing | Vitest + React Testing Library | Vite-native, fast, good TypeScript support |
| Styling | CSS Modules, dark theme, mobile-first | Minimal deps, matches Cricket Guru aesthetic |
| Routing | React Router v6 | 2 routes only, standard solution |
