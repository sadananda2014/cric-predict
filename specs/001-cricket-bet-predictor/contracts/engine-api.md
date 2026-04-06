# Engine Contracts: Cricket Betting Predictor

**Feature**: 001-cricket-bet-predictor  
**Date**: 2026-04-01  
**Purpose**: Define the public interfaces of the pure engine modules (`src/engine/`). These are the contracts between the UI layer and the business logic.

> This project is a client-side SPA with no external API. The "contracts" are the internal engine function signatures that the UI layer consumes.

---

## Module: `engine/pnl.ts`

### `calculateBetPnL(bet: Bet, winningTeam: string): number`

Calculates the P&L of a single bet for a given match outcome.

**Input**:
- `bet`: A Bet object (team, betType, rate, stake)
- `winningTeam`: The team assumed to win

**Output**: A number representing profit (positive) or loss (negative) in ₹.

**Rules**:
- If `bet.team === winningTeam` and `bet.betType === "lagaai"`: return `bet.stake * (bet.rate / 100)`
- If `bet.team === winningTeam` and `bet.betType === "khaai"`: return `bet.stake * (100 / bet.rate)`
- If `bet.team !== winningTeam`: return `-bet.stake`

---

### `calculatePosition(bets: Bet[], teamA: string, teamB: string): Position`

Calculates the aggregate position across all bets.

**Input**:
- `bets`: Array of all Bet objects in a match
- `teamA`: First team name
- `teamB`: Second team name

**Output**: A Position object.

**Rules**:
- `teamA_pnl = sum of calculateBetPnL(bet, teamA) for all bets`
- `teamB_pnl = sum of calculateBetPnL(bet, teamB) for all bets`
- `totalStaked = sum of bet.stake for all bets`
- `betCount = bets.length`
- Classification derived from sign of teamA_pnl and teamB_pnl

---

## Module: `engine/hedging.ts`

### `generateSuggestion(position: Position, currentRate: RateEntry, teamA: string, teamB: string): Suggestion`

Generates a hedging suggestion based on the current position and rates.

**Input**:
- `position`: Current Position object
- `currentRate`: Most recent RateEntry
- `teamA`: First team name
- `teamB`: Second team name

**Output**: A Suggestion object.

**Rules**:
- `neutral` position → action: `wait`, reasoning: "Enter your first bet to get started."
- `profitable` position → action: `lock_profit`, with optional counter-bet to increase the weaker side
- `partial` position → action: `bet_now`, with specific hedge bet to equalize or improve both outcomes
- `underwater` position → evaluate rate movement:
  - Small movement (< 5 points from any prior rate entry) → action: `wait`
  - Significant movement → action: `reduce_exposure`, with bet that minimizes max loss

### `calculateHedgeBet(position: Position, currentRate: RateEntry, teamA: string, teamB: string): { team: string, betType: "lagaai" | "khaai", amount: number }`

Calculates the optimal hedge bet to equalize P&L on both outcomes.

**Input**: Same as `generateSuggestion`.

**Output**: The specific bet (team, type, amount) that brings both outcomes as close to equal as possible.

**Rules**:
- Identify the negative side (the outcome with worse P&L)
- Calculate the bet amount on the opposite team at the current rate that would offset the deficit
- Round to nearest ₹1

### `projectPosition(currentPosition: Position, hypotheticalBet: Bet, teamA: string, teamB: string): Position`

Projects what the position would look like if a hypothetical bet were placed.

**Input**:
- `currentPosition`: Current Position
- `hypotheticalBet`: A bet that hasn't been placed yet
- `teamA`, `teamB`: Team names

**Output**: A new Position reflecting the addition of the hypothetical bet.

---

## Module: `engine/rates.ts`

### `getUnderdogTeam(rateEntry: RateEntry, teamA: string, teamB: string): string`

Returns the underdog team name (the one NOT the favourite).

### `getRateForTeam(rateEntry: RateEntry, team: string, teamA: string, teamB: string): { rate: number, betType: "lagaai" | "khaai" }`

Returns the rate and bet type for a specific team given the current rate entry.

**Rules**:
- If `team === rateEntry.favouriteTeam`: return `{ rate: rateEntry.lagaaiRate, betType: "lagaai" }`
- Else: return `{ rate: rateEntry.khaaiRate, betType: "khaai" }`

---

## Module: `engine/validation.ts`

### `validateTeamName(name: string): { valid: boolean, error?: string }`

**Rules**:
- Must not be empty after trimming
- Must be ≤ 10 characters
- Must not contain only whitespace

### `validateRate(rate: number): { valid: boolean, error?: string }`

**Rules**:
- Must be a positive integer (≥ 1)
- Must be finite
- Must not be NaN

### `validateStake(stake: number): { valid: boolean, error?: string }`

**Rules**:
- Must be positive (> 0)
- Must be finite
- Must not be NaN

### `validateMatchTeams(teamA: string, teamB: string): { valid: boolean, error?: string }`

**Rules**:
- Both must pass `validateTeamName`
- Must not be the same (case-insensitive comparison)

---

## Module: `store/matchStore.ts` (Zustand)

### Store Interface

```typescript
interface MatchStore {
  matches: Record<string, Match>

  // Match CRUD
  createMatch(teamA: string, teamB: string): string  // returns match ID
  completeMatch(matchId: string, winner: string): void
  
  // Bet operations
  addBet(matchId: string, team: string, betType: BetType, rate: number, stake: number): void
  deleteBet(matchId: string, betId: string): void
  
  // Rate operations
  addRateEntry(matchId: string, favouriteTeam: string, lagaaiRate: number, khaaiRate: number): void
  
  // Selectors (derived)
  getMatch(matchId: string): Match | undefined
  getActiveMatches(): Match[]
  getCompletedMatches(): Match[]
  getLatestRate(matchId: string): RateEntry | undefined
}
```

**Persistence**: Zustand `persist` middleware with `localStorage` storage. Key: `cric-predict-store`.
