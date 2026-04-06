# Tasks: Cricket Betting Predictor

**Input**: Design documents from `/specs/001-cricket-bet-predictor/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Tests**: Not explicitly requested in the spec — test tasks are omitted. Add tests during Polish phase if needed.

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Project Initialization)

**Purpose**: Scaffold the Vite + React + TypeScript project and install all dependencies

- [x] T001 Scaffold Vite React TypeScript project using `npm create vite@latest . -- --template react-ts` in project root
- [x] T002 Install production dependencies: `npm install react-router-dom zustand uuid` and dev types `npm install -D @types/uuid`
- [x] T003 [P] Create directory structure per plan.md: `src/components/{MatchList,MatchDetail,BetForm,BetLedger,PositionSummary,Suggestion,common}/`, `src/engine/`, `src/store/`, `src/types/`, `src/pages/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core type definitions, pure engine modules, state store, and app shell that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Define all TypeScript interfaces (Match, Bet, RateEntry, Position, Suggestion, BetType) per data-model.md in src/types/index.ts
- [x] T005 [P] Implement input validation functions (validateTeamName, validateRate, validateStake, validateMatchTeams) per contracts/engine-api.md in src/engine/validation.ts
- [x] T006 [P] Implement rate utility functions (getUnderdogTeam, getRateForTeam) per contracts/engine-api.md in src/engine/rates.ts
- [x] T007 [P] Implement P&L calculation engine (calculateBetPnL, calculatePosition) per contracts/engine-api.md and research.md R1 in src/engine/pnl.ts
- [x] T008 Implement Zustand match store with persist middleware — createMatch, addBet, addRateEntry, deleteBet, getMatch, getLatestRate — per contracts/engine-api.md in src/store/matchStore.ts
- [x] T009 [P] Create shared UI primitives (Button, Input, Card, Disclaimer) with CSS Modules dark theme styling in src/components/common/
- [x] T010 Configure React Router v6 with two routes: `/` → HomePage, `/match/:id` → MatchPage in src/App.tsx
- [x] T011 [P] Setup global CSS with dark theme custom properties, mobile-first responsive base, and CSS reset in src/index.css

**Checkpoint**: Foundation ready — all engine modules, types, store, and routing in place. User story implementation can now begin.

---

## Phase 3: User Story 1 — Create Match & Record First Bet (Priority: P1) 🎯 MVP

**Goal**: User can create a match (two team names), enter Lagaai/Khaai rates, record a bet, and see instant P&L for both outcomes.

**Independent Test**: Create a match "LSG vs DC", enter rates LSG: 96 (Lagaai) / DC: 97 (Khaai), record a ₹1,000 bet on DC, verify position shows "If DC wins: +₹1,031 / If LSG wins: −₹1,000".

### Implementation for User Story 1

- [x] T012 [P] [US1] Create MatchList component with "New Match" button, match creation dialog (teamA/teamB inputs), and list of existing matches with navigation links in src/components/MatchList/MatchList.tsx
- [x] T013 [P] [US1] Create BetForm component with rate entry fields (favourite team selector, Lagaai rate, Khaai rate), bet placement fields (team selector, stake input), and submit action that calls store.addRateEntry + store.addBet in src/components/BetForm/BetForm.tsx
- [x] T014 [P] [US1] Create BetLedger component displaying all bets in a table with columns: team, bet type (Lagaai/Khaai), rate, stake amount, and timestamp in src/components/BetLedger/BetLedger.tsx
- [x] T015 [P] [US1] Create PositionSummary component that calls calculatePosition from engine/pnl.ts and displays net P&L for "If Team A wins" and "If Team B wins" with color coding (green positive, red negative) in src/components/PositionSummary/PositionSummary.tsx
- [x] T016 [US1] Create MatchDetail container component that loads match from store by ID and composes BetForm, BetLedger, and PositionSummary with match header (team names, status) in src/components/MatchDetail/MatchDetail.tsx
- [x] T017 [P] [US1] Implement HomePage that renders MatchList and handles navigation to match detail on match click in src/pages/HomePage.tsx
- [x] T018 [US1] Implement MatchPage that reads match ID from URL params, loads match data, and renders MatchDetail in src/pages/MatchPage.tsx

**Checkpoint**: User Story 1 complete — users can create a match, enter rates, record a bet, and see P&L. App is a functional bet tracker.

---

## Phase 4: User Story 2 — Update Rates & Record Multiple Bets (Priority: P1)

**Goal**: User can update rates as match progresses, record additional bets at different rates, see cumulative P&L, and delete incorrect bets.

**Independent Test**: Record 3 bets at different rates on both teams, verify cumulative P&L is correct for each outcome. Delete one bet, verify position recalculates.

### Implementation for User Story 2

- [x] T019 [P] [US2] Add rate-only update flow to BetForm — allow entering new rates and saving as RateEntry without placing a bet, with clear separation between "Update Rates" and "Place Bet" actions in src/components/BetForm/BetForm.tsx
- [x] T020 [P] [US2] Enhance BetLedger to show per-bet P&L for each outcome (calculated via calculateBetPnL), add delete button per bet row that calls store.deleteBet and triggers position recalculation in src/components/BetLedger/BetLedger.tsx
- [x] T021 [P] [US2] Update PositionSummary to reactively recalculate position when rates change (using latest RateEntry for display context) and show totalStaked and betCount in src/components/PositionSummary/PositionSummary.tsx

**Checkpoint**: User Story 2 complete — full multi-bet tracking with rate updates, per-bet P&L, and bet deletion.

---

## Phase 5: User Story 3 — Get Hedging Suggestion (Priority: P1)

**Goal**: After recording bets and updating rates, the system analyses the position and suggests: Bet Now (with team and amount), Wait, Lock Profit, or Reduce Exposure — with projected P&L.

**Independent Test**: Set up a portfolio with bets on both sides showing negative on one outcome. Update rates. Verify suggestion shows "Bet Now" with correct team, amount, and projected P&L matching the math.

### Implementation for User Story 3

- [x] T022 [P] [US3] Implement hedging engine — generateSuggestion (4-action decision tree per research.md R2), calculateHedgeBet (equalize P&L on both outcomes), projectPosition (hypothetical bet projection) — per contracts/engine-api.md in src/engine/hedging.ts
- [x] T023 [P] [US3] Create Suggestion component displaying action type badge, recommended bet details (team, amount, betType), reasoning text, projected P&L for both outcomes, current worst-case, and Disclaimer (FR-012) in src/components/Suggestion/Suggestion.tsx
- [x] T024 [US3] Integrate Suggestion into MatchDetail — call generateSuggestion when rates are updated and bets exist, display Suggestion component below PositionSummary in src/components/MatchDetail/MatchDetail.tsx

**Checkpoint**: User Story 3 complete — core value proposition delivered. Users get actionable hedging advice with full math transparency.

---

## Phase 6: User Story 4 — Manage Multiple Matches (Priority: P2)

**Goal**: Users can track bets across multiple concurrent matches with independent ledgers, complete matches by selecting a winner, and see active/archived sections.

**Independent Test**: Create two matches (LSG vs DC, RCB vs KKR), place bets in each, verify data is independent. Complete one match, verify it moves to archived section with realized P&L.

### Implementation for User Story 4

- [x] T025 [US4] Add completeMatch store action (set winner, calculate realized P&L, set status to "completed") and selectors (getActiveMatches, getCompletedMatches) to src/store/matchStore.ts
- [x] T026 [US4] Update MatchList to show active matches section and archived/completed section separately, display bet count and current P&L summary per match in src/components/MatchList/MatchList.tsx
- [x] T027 [US4] Add match completion UI to MatchDetail — "Complete Match" button with winner selection (teamA or teamB), show final realized P&L on completed match view in src/components/MatchDetail/MatchDetail.tsx

**Checkpoint**: User Story 4 complete — multi-match support with independent ledgers and match archival.

---

## Phase 7: User Story 5 — View Bet History & Match Summary (Priority: P3)

**Goal**: For completed matches, users can review the full chronological bet history, rate changes, and final outcome with summary statistics.

**Independent Test**: Complete a match with 5 bets, open the summary, verify all bets appear in chronological order with correct stats (total invested, total return, net profit/loss).

### Implementation for User Story 5

- [x] T028 [US5] Create match summary view for completed matches showing all bets in chronological order with rate at time of each bet, stake, and per-bet realized P&L in src/components/MatchDetail/MatchDetail.tsx
- [x] T029 [US5] Add match summary statistics panel showing total invested (sum of all stakes), total return, and net profit/loss for the completed match in src/components/MatchDetail/MatchDetail.tsx

**Checkpoint**: User Story 5 complete — users can review and learn from past matches.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Edge case handling, UX polish, and validation across all user stories

- [x] T030 [P] Add input validation error messages (inline) for rates (positive integer), stakes (positive number), and team names (non-empty, ≤10 chars, not identical) to BetForm per FR-013 in src/components/BetForm/BetForm.tsx
- [x] T031 [P] Add empty states to all views — no matches ("Create your first match"), no bets ("Enter rates and place your first bet"), no suggestion ("Place bets to get hedging advice") across src/components/
- [x] T032 [P] Verify Disclaimer component ("Predictions are informational only. Bet responsibly.") appears on every screen displaying a suggestion per FR-012 in src/components/Suggestion/Suggestion.tsx
- [x] T033 Run quickstart.md validation checklist end-to-end: dev server starts, create match, enter rates, record bet, verify P&L, verify all flows work

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — **BLOCKS all user stories**
- **US1 (Phase 3)**: Depends on Phase 2 — delivers MVP
- **US2 (Phase 4)**: Depends on Phase 3 (enhances US1 components)
- **US3 (Phase 5)**: Depends on Phase 2 only (engine is independent) — can start in parallel with US1/US2 for engine work, but MatchDetail integration requires US1
- **US4 (Phase 6)**: Depends on Phase 3 (extends MatchList and MatchDetail)
- **US5 (Phase 7)**: Depends on Phase 6 (needs match completion flow)
- **Polish (Phase 8)**: Depends on all desired user stories being complete

### User Story Dependencies

```
Phase 1 (Setup)
  └─► Phase 2 (Foundational) ──BLOCKS──┐
                                        ▼
                                  Phase 3 (US1 - MVP)
                                   ├─► Phase 4 (US2)
                                   ├─► Phase 5 (US3) *engine can start from Phase 2
                                   └─► Phase 6 (US4)
                                         └─► Phase 7 (US5)
                                               └─► Phase 8 (Polish)
```

### Within Each User Story

- Models/types before services before UI components
- Container components (MatchDetail) after leaf components (BetForm, BetLedger, PositionSummary)
- Pages after containers
- All [P] tasks within a phase can run in parallel

### Parallel Opportunities

**Phase 2 parallelism** (4 parallel tracks):
```
Track A: T005 (validation.ts)
Track B: T006 (rates.ts)
Track C: T007 (pnl.ts)
Track D: T009 (common/) + T011 (index.css)
→ Then: T008 (store) + T010 (App.tsx)
```

**Phase 3 parallelism** (4 parallel component tracks):
```
Track A: T012 (MatchList) → T017 (HomePage)
Track B: T013 (BetForm)   ─┐
Track C: T014 (BetLedger)  ├─► T016 (MatchDetail) → T018 (MatchPage)
Track D: T015 (PositionSummary) ─┘
```

**Phase 4 parallelism** (3 parallel):
```
T019 (BetForm update) | T020 (BetLedger enhance) | T021 (PositionSummary recalc)
```

**Phase 5 parallelism** (2 parallel then integrate):
```
T022 (hedging engine) | T023 (Suggestion component) → T024 (integrate into MatchDetail)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Create a match, enter rates, record a bet, verify P&L is correct
5. Deploy/demo if ready — app is already a functional bet tracker

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add User Story 1 → **MVP bet tracker** (create match, bet, see P&L)
3. Add User Story 2 → Multi-bet tracking with rate updates and bet deletion
4. Add User Story 3 → **Core value proposition** (hedging suggestions with math)
5. Add User Story 4 → Multi-match support with archival
6. Add User Story 5 → Historical review and learning
7. Polish → Edge cases, validation, empty states

### Suggested MVP Scope

**US1 alone** delivers a functional cricket bet tracker. US2 + US3 complete the P1 feature set and deliver the full hedging value proposition. Ship after Phase 5 for maximum impact.
