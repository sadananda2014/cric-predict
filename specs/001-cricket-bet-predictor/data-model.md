# Data Model: Cricket Betting Predictor

**Feature**: 001-cricket-bet-predictor  
**Date**: 2026-04-01  
**Source**: spec.md (Key Entities), research.md (P&L math, hedging algorithm)

---

## Entities

### Match

Represents a single cricket match session with its own isolated ledger.

| Field | Type | Description |
|-------|------|-------------|
| id | string (UUID) | Unique identifier |
| teamA | string | First team short name (e.g., "LSG") |
| teamB | string | Second team short name (e.g., "DC") |
| status | "active" \| "completed" | Match lifecycle state |
| winner | string \| null | Team name of winner (null when active) |
| bets | Bet[] | Ordered list of all bets placed in this match |
| rateEntries | RateEntry[] | Ordered list of all rate snapshots |
| createdAt | string (ISO 8601) | When the match was created |
| completedAt | string (ISO 8601) \| null | When the match was completed |

**Relationships**:
- Contains 0..n Bets (ordered by timestamp)
- Contains 0..n RateEntries (ordered by timestamp; last entry = current rates)

**Validation Rules**:
- teamA and teamB must be non-empty strings, trimmed, max 10 characters
- teamA and teamB must not be the same (case-insensitive)
- status transitions: active → completed (one-way, irreversible)
- winner must be either teamA or teamB when set

---

### Bet

Represents a single bet placed by the user within a match.

| Field | Type | Description |
|-------|------|-------------|
| id | string (UUID) | Unique identifier |
| team | string | Team name being backed (must match teamA or teamB) |
| betType | "lagaai" \| "khaai" | Whether this is a favourite or underdog bet |
| rate | number (positive integer) | The rate at the time this bet was placed |
| stake | number (positive) | Amount wagered in ₹ |
| createdAt | string (ISO 8601) | When the bet was recorded |

**Validation Rules**:
- team must match parent Match's teamA or teamB
- betType must be "lagaai" or "khaai"
- rate must be a positive integer (≥ 1)
- stake must be a positive number (> 0)

**P&L Calculation** (per bet, per outcome):

```
If this bet's team wins:
  lagaai → profit = stake × (rate / 100)
  khaai  → profit = stake × (100 / rate)

If this bet's team loses:
  → loss = -stake
```

---

### RateEntry

A snapshot of market rates at a point in time during a match.

| Field | Type | Description |
|-------|------|-------------|
| id | string (UUID) | Unique identifier |
| favouriteTeam | string | Which team is currently favourite (has Lagaai rate) |
| lagaaiRate | number (positive integer) | Lagaai rate for the favourite |
| khaaiRate | number (positive integer) | Khaai rate for the underdog |
| createdAt | string (ISO 8601) | When this rate was entered |

**Validation Rules**:
- favouriteTeam must match parent Match's teamA or teamB
- lagaaiRate must be a positive integer (≥ 1)
- khaaiRate must be a positive integer (≥ 1)

**Derived property**: The underdog team is whichever team is NOT the favouriteTeam.

---

### Position (Calculated — not persisted)

The aggregate P&L across all bets in a match.

| Field | Type | Description |
|-------|------|-------------|
| teamA_pnl | number | Net P&L (₹) if teamA wins |
| teamB_pnl | number | Net P&L (₹) if teamB wins |
| totalStaked | number | Sum of all bet stakes |
| betCount | number | Number of bets placed |
| classification | "profitable" \| "partial" \| "underwater" \| "neutral" | Position type |

**Derivation**:
- `teamA_pnl = Σ betPnL(bet, teamA)` for all bets
- `teamB_pnl = Σ betPnL(bet, teamB)` for all bets
- Classification:
  - `neutral`: no bets placed
  - `profitable`: both teamA_pnl ≥ 0 AND teamB_pnl ≥ 0
  - `partial`: one ≥ 0, other < 0
  - `underwater`: both < 0

---

### Suggestion (Calculated — not persisted)

A hedging recommendation based on current position and rates.

| Field | Type | Description |
|-------|------|-------------|
| action | "bet_now" \| "wait" \| "lock_profit" \| "reduce_exposure" | Recommended action |
| team | string \| null | Team to bet on (null for "wait") |
| amount | number \| null | Suggested stake amount in ₹ (null for "wait") |
| betType | "lagaai" \| "khaai" \| null | Bet type for the suggestion (null for "wait") |
| reasoning | string | Human-readable explanation |
| projectedPnL | { teamA: number, teamB: number } \| null | P&L after following suggestion |
| currentWorstCase | number | Current worst P&L across outcomes |

**Derivation logic** (from research.md R2):
1. Compute Position from all bets
2. Classify position
3. Apply decision tree:
   - profitable → `lock_profit` (or "no action needed")
   - partial → `bet_now` (hedge the negative side)
   - underwater + small rate movement → `wait`
   - underwater + significant rate movement → `reduce_exposure`

---

## State Transitions

### Match Lifecycle

```
[Created] → active → completed
              ↑          |
              |   (select winner, irreversible)
              |
      bets added/removed
      rates updated
      suggestions generated
```

### Bet Lifecycle

```
[Created] → recorded → (can be deleted)
```

Bets are immutable once created (rate and stake cannot be edited). If incorrect, delete and re-enter.

---

## Storage Shape (localStorage)

```json
{
  "cric-predict-store": {
    "state": {
      "matches": {
        "uuid-1": {
          "id": "uuid-1",
          "teamA": "LSG",
          "teamB": "DC",
          "status": "active",
          "winner": null,
          "bets": [...],
          "rateEntries": [...],
          "createdAt": "2026-04-01T15:30:00.000Z",
          "completedAt": null
        },
        "uuid-2": { ... }
      }
    },
    "version": 0
  }
}
```

Key: `cric-predict-store` (Zustand persist middleware default).
Each match is keyed by UUID. Entire state serialized as JSON.
