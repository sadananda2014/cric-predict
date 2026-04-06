# Implementation Plan: Cricket Betting Predictor

**Branch**: `001-cricket-bet-predictor` | **Date**: 2026-04-01 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-cricket-bet-predictor/spec.md`

## Summary

Build a client-side React web app that lets users track live cricket match bets using the Indian Lagaai/Khaai rate system. Users create match sessions, enter rates from Cricket Guru, record bets, and receive real-time hedging suggestions (Bet Now / Wait / Lock Profit / Reduce Exposure) with full P&L math. Multiple concurrent matches are supported with independent ledgers. All data persists locally via localStorage.

## Technical Context

**Language/Version**: TypeScript 5.x  
**Primary Dependencies**: React 18, React Router v6, Zustand (state management), Vitest (testing)  
**Storage**: localStorage (browser) — each match serialized as independent JSON record  
**Testing**: Vitest + React Testing Library  
**Target Platform**: Web (mobile-responsive, PWA-capable) — any modern browser  
**Project Type**: Single-page web application (SPA)  
**Performance Goals**: P&L recalculation < 16ms (single frame), UI interaction < 100ms  
**Constraints**: Fully offline after initial load, no backend, no external API calls, local-only data  
**Scale/Scope**: Single user, 5-10 concurrent matches, ~50 bets per match max

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | How Addressed |
|-----------|--------|---------------|
| I. Data Accuracy & Bet Tracking | ✅ PASS | Per-match ledger with rate snapshots; all data user-entered; Lagaai/Khaai format as canonical input |
| II. Responsible Gambling | ✅ PASS | Disclaimer component on every suggestion screen (FR-012); no certainty language in suggestion templates |
| III. Simplicity & YAGNI | ✅ PASS | SPA with 2 routes (match list, match detail); no backend, no auth, no cloud sync; Zustand for minimal state management |
| IV. Testable Prediction Logic | ✅ PASS | P&L and hedging engine in pure TypeScript modules under `src/engine/` — zero UI or storage dependencies; tested with Vitest |
| V. Security & Privacy | ✅ PASS | No credentials stored; localStorage only; all input validated; no external API calls; HTTPS for hosting |
| VI. Smart Hedging & Position Management | ✅ PASS | Dedicated hedging engine calculates position from bet array + current rates; suggests from 4 action types with projected P&L |

**Gate Result**: ✅ ALL PASS — proceeding to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/001-cricket-bet-predictor/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
src/
├── components/          # React UI components
│   ├── MatchList/       # Home screen — list of matches
│   ├── MatchDetail/     # Single match view (rates, ledger, position, suggestion)
│   ├── BetForm/         # Rate entry + bet recording form
│   ├── BetLedger/       # Table of all bets in a match
│   ├── PositionSummary/ # P&L display per outcome
│   ├── Suggestion/      # Hedging suggestion card
│   └── common/          # Shared UI primitives (Button, Input, Card, Disclaimer)
├── engine/              # Pure business logic (NO React, NO storage dependencies)
│   ├── pnl.ts           # P&L calculation from bet array
│   ├── hedging.ts       # Hedging optimizer — generates suggestions
│   ├── rates.ts         # Rate system utilities (Lagaai/Khaai math)
│   └── validation.ts    # Input validation (rates, stakes, team names)
├── store/               # Zustand stores
│   └── matchStore.ts    # Match CRUD, bet CRUD, rate entries, persistence
├── types/               # TypeScript type definitions
│   └── index.ts         # Match, Bet, RateEntry, Position, Suggestion types
├── pages/               # Route-level page components
│   ├── HomePage.tsx      # Match list page
│   └── MatchPage.tsx     # Match detail page
├── App.tsx              # Root component + router
├── main.tsx             # Entry point
└── index.css            # Global styles

tests/
├── unit/
│   ├── engine/
│   │   ├── pnl.test.ts       # P&L calculation tests
│   │   ├── hedging.test.ts   # Hedging logic tests
│   │   ├── rates.test.ts     # Rate system math tests
│   │   └── validation.test.ts # Input validation tests
│   └── store/
│       └── matchStore.test.ts # Store logic tests
└── integration/
    ├── matchFlow.test.tsx     # Full match creation → bet → P&L flow
    └── hedgingFlow.test.tsx   # Multi-bet hedging suggestion flow
```

**Structure Decision**: Single project (Option 1 adapted for React SPA). No backend needed — all logic is client-side. The `src/engine/` directory isolates pure business logic from React, satisfying Constitution Principle IV (testable prediction logic). Components are organized by feature for co-location.

## Complexity Tracking

> No constitution violations — this section is intentionally empty.
