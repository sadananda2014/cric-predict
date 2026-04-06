# Feature Specification: Cricket Betting Predictor

**Feature Branch**: `001-cricket-bet-predictor`  
**Created**: 2026-04-01  
**Status**: Draft  
**Input**: User description: "Cricket betting prediction app with live match bet portfolio management, hedging optimization, and Lagaai/Khaai rate system"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create Match and Record First Bet (Priority: P1)

A user opens the app and sees the match list (empty on first use). They create a new match by entering the two team names (e.g., "LSG" and "DC"). After creating the match, they enter the current rates from Cricket Guru (e.g., LSG: 96 Lagaai, DC: 97 Khaai), pick a team, enter the stake amount, and record their first bet. The bet appears in the match's bet ledger, and the position summary instantly shows profit/loss for each possible outcome.

**Why this priority**: Without the ability to create matches and record bets, no other feature has meaning. This is the foundational data-entry flow that everything else depends on.

**Independent Test**: Can be fully tested by creating a match, entering rates, recording a bet, and verifying the P&L display is correct for both outcomes. Delivers immediate value as a bet tracker even without hedging suggestions.

**Acceptance Scenarios**:

1. **Given** the user is on the match list screen with no matches, **When** they tap "New Match" and enter "LSG" and "DC" as team names, **Then** a new match "LSG vs DC" appears in the list with 0 bets and ₹0 P&L.
2. **Given** the user has opened the "LSG vs DC" match, **When** they enter rates LSG: 96 (Lagaai) / DC: 97 (Khaai) and record a bet on DC for ₹1,000, **Then** the bet ledger shows one entry (DC, rate 97, ₹1,000) and the position summary shows: "If DC wins: +₹1,031 / If LSG wins: −₹1,000".
3. **Given** the user has recorded a bet, **When** they return to the match list, **Then** the "LSG vs DC" row shows "1 bet" and the current net position summary.

---

### User Story 2 - Update Rates and Record Multiple Bets (Priority: P1)

As the match progresses, the user checks Cricket Guru and sees the rates have changed. They return to the match, enter the new rates, and record additional bets. The bet ledger grows with each entry (each recording the rate at the time of that bet), and the position summary recalculates based on ALL bets placed so far against the current rates.

**Why this priority**: Matches are dynamic — rates change constantly and users place multiple bets. Without multi-bet support and rate updates, the app cannot track real match-day activity.

**Independent Test**: Can be tested by recording 3+ bets at different rates on both teams and verifying the cumulative P&L is correct for each outcome.

**Acceptance Scenarios**:

1. **Given** the user has one bet recorded (DC ₹1,000 at rate 97) and rates have changed to LSG: 30 / DC: 60, **When** they update the current rates and record a new bet on LSG for ₹2,000 at rate 30, **Then** the ledger shows 2 bets and the position summary shows the combined P&L: "If LSG wins: −₹400 / If DC wins: −₹969".
2. **Given** the user has multiple bets recorded, **When** they enter updated rates without placing a new bet, **Then** the position summary recalculates using the new rates for display purposes but existing bets retain their original recorded rates.
3. **Given** the user has bets on both teams at different rates, **When** they view the bet ledger, **Then** each bet shows the team, stake, rate at time of bet, and individual P&L for each outcome.

---

### User Story 3 - Get Hedging Suggestion (Priority: P1)

After recording bets and updating rates, the user wants to know what to do next. The app analyses their current position (all bets, all rates) and provides a clear suggestion: bet now (with exact team and amount), wait for better rates, lock profit, or reduce exposure. The suggestion includes the math showing how the recommended action changes the P&L for each outcome.

**Why this priority**: This is the core value proposition — transforming raw bet data into actionable advice. Without this, the app is just a ledger.

**Independent Test**: Can be tested by setting up a known bet portfolio and rates, then verifying the suggestion is mathematically correct and the projected P&L after following the suggestion matches expected values.

**Acceptance Scenarios**:

1. **Given** the user has bets on both sides and the current position is negative on both outcomes, **When** the rates shift to a more balanced state (e.g., 90/90), **Then** the system suggests a specific hedge bet (team, amount) and shows the projected P&L for both outcomes if that bet is placed.
2. **Given** the user's position allows locking guaranteed profit on all outcomes, **When** they view the suggestion, **Then** the app displays "Lock Profit" with the exact counter-bet (team, amount) and the guaranteed minimum profit.
3. **Given** the user's current rates show minimal movement from last entry, **When** they request a suggestion, **Then** the app displays "Wait — rate movement too small for effective hedge. Current worst-case: −₹X" with an explanation.
4. **Given** the user follows a "Bet Now" suggestion, **When** they record the suggested bet, **Then** the position summary updates and the new P&L matches the projected values shown in the suggestion.

---

### User Story 4 - Manage Multiple Matches (Priority: P2)

The user is tracking bets across multiple live matches (e.g., IPL double-header: LSG vs DC and RCB vs KKR). They can switch between matches from the match list, and each match maintains its own independent bet ledger, rate history, and position. Completed matches can be closed/archived.

**Why this priority**: Users commonly bet on multiple matches in a single day. Isolation between matches is important but the core single-match flow (P1 stories) must work first.

**Independent Test**: Can be tested by creating two matches, placing bets in each, verifying that bets and P&L in one match are completely independent of the other.

**Acceptance Scenarios**:

1. **Given** the user has two active matches (LSG vs DC and RCB vs KKR), **When** they view the match list, **Then** each match shows its own bet count and P&L summary independently.
2. **Given** the user is in the 'LSG vs DC' match, **When** they record a bet, **Then** the 'RCB vs KKR' match data remains unchanged.
3. **Given** a match has concluded, **When** the user marks it as completed and selects the winning team, **Then** the match shows the final realized P&L and moves to an archived/completed section.
4. **Given** there are archived matches, **When** the user views the match list, **Then** active matches appear at the top and archived matches appear in a separate section below.

---

### User Story 5 - View Bet History and Match Summary (Priority: P3)

After a match ends, the user wants to review how their bets played out — the sequence of bets, rate changes, suggestions received, and ultimate outcome. This helps them learn from past matches and improve their betting strategy.

**Why this priority**: This is a review/learning feature. Valuable for long-term users but not required for the core live betting workflow.

**Independent Test**: Can be tested by completing a match with multiple bets and verifying the summary shows the full chronological sequence and correct final P&L.

**Acceptance Scenarios**:

1. **Given** a match is archived with 5 bets placed, **When** the user opens the match summary, **Then** all bets are displayed in chronological order with the rate at time of each bet, the stake, and individual P&L.
2. **Given** a completed match, **When** the user views the summary, **Then** it shows total invested, total return, and net profit/loss for the match.

---

### Edge Cases

- What happens when the user enters a rate of 0 or a negative number? The app MUST reject it with a clear validation message.
- What happens when the user enters a stake of 0? The app MUST reject it — no zero-amount bets.
- How does the system handle when both rates are equal (e.g., 90/90)? The system MUST still calculate valid P&L and suggestions — equal rates are a normal match state.
- What happens when the user has only placed bets on one team? The system MUST calculate position correctly (one outcome is purely profit, the other is purely loss) and suggest hedging on the other team if beneficial.
- What happens when the user has no bets placed but enters rates? The system MUST show a neutral position (₹0/₹0) and suggest which team to bet on based on value or display "Enter your first bet to get started."
- What happens when the user deletes/removes a bet they entered incorrectly? The system MUST recalculate the entire position from the remaining bets.
- How does the system handle very high rates (e.g., 300+)? The system MUST accept any positive integer rate and calculate correctly — rates above 100 indicate heavy underdog status.
- What happens if the favourite/underdog flips mid-match (e.g., Team A was Lagaai now becomes Khaai)? The system MUST handle the flip — each bet records which format (Lagaai or Khaai) it was placed under.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Users MUST be able to create a new match session by entering two team names (short names, e.g., "LSG", "DC", "RCB", "KKR").
- **FR-002**: Users MUST be able to enter the current match rates in Lagaai/Khaai format — two integer values, one per team, with indication of which is the favourite (Lagaai) and which is the underdog (Khaai).
- **FR-003**: Users MUST be able to record a bet by selecting a team, entering a stake amount, and the system MUST automatically capture the current rate at time of bet entry.
- **FR-004**: The system MUST calculate and display the net profit/loss for EVERY possible match outcome (Team A wins or Team B wins) based on all recorded bets.
- **FR-005**: When the user enters updated rates, the system MUST recalculate the position summary and generate a hedging suggestion.
- **FR-006**: The system MUST suggest one of four actions after each rate update: "Bet Now" (with team and amount), "Wait" (with reasoning), "Lock Profit" (with exact counter-bet), or "Reduce Exposure" (with counter-bet and projected worst-case).
- **FR-007**: Each suggestion MUST include the projected P&L for both outcomes if the user follows the recommendation.
- **FR-008**: The system MUST support multiple concurrent match sessions, each with independent bet ledgers and rate histories.
- **FR-009**: Users MUST be able to mark a match as completed by selecting the winning team, at which point the system calculates and displays final realized P&L.
- **FR-010**: Users MUST be able to delete an incorrectly entered bet, and the system MUST recalculate the position immediately.
- **FR-011**: All bet and match data MUST persist locally on the device so the user can close and reopen the app without losing data.
- **FR-012**: Every screen displaying a suggestion MUST include a visible disclaimer: "Predictions are informational only. Bet responsibly."
- **FR-013**: The system MUST validate all user inputs: rates must be positive integers, stake amounts must be positive numbers, team names must not be empty.
- **FR-014**: The system MUST display each bet in the ledger with: team name, bet type (Lagaai/Khaai), rate at time of bet, stake amount, and per-bet P&L for each outcome.

### Key Entities

- **Match**: Represents a single cricket match session. Has two team names, a status (active/completed), a winning team (when completed), and a creation timestamp. Contains a collection of Bets and Rate Entries.
- **Bet**: Represents a single bet placed by the user within a match. Has team backed, bet type (Lagaai or Khaai), rate at time of bet, stake amount, and timestamp.
- **Rate Entry**: A snapshot of the rates at a point in time within a match. Has Lagaai rate, Khaai rate, favourite team indicator, and timestamp. The most recent entry is the "current" rate.
- **Position**: A calculated (not stored) entity representing the user's net profit/loss for each possible outcome based on all Bets in a match. Derived from the bet ledger.
- **Suggestion**: A calculated (not stored) recommendation based on the current Position and current Rate Entry. Has an action type (Bet Now / Wait / Lock Profit / Reduce Exposure), reasoning text, and projected P&L if followed.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can create a match and record their first bet in under 30 seconds.
- **SC-002**: Position summary (P&L per outcome) updates within 1 second of entering a new bet or updating rates.
- **SC-003**: Hedging suggestions correctly calculate the optimal bet amount to within ₹1 accuracy (no rounding errors that affect financial decisions).
- **SC-004**: Users can manage 5+ concurrent active matches with no data leakage between match sessions.
- **SC-005**: 90% of users can complete the full flow (create match → enter rates → record bet → get suggestion) on first attempt without external help.
- **SC-006**: The app works fully offline after initial load — no network dependency for bet recording, rate entry, or hedging calculations.
- **SC-007**: All historical match data persists across app restarts — zero data loss during normal usage.

## Assumptions

- Users are familiar with the Indian Lagaai/Khaai betting rate system and do not need an in-app tutorial explaining it.
- Users have a separate app (e.g., Cricket Guru) open alongside this app for live rate data — CricPredict does not source its own predictions.
- The app does not need user authentication or accounts for v1 — it is a single-user, single-device tool.
- Currency is assumed to be Indian Rupees (₹) — no multi-currency support needed.
- Rates are always whole numbers (integers) as displayed in Cricket Guru.
- The app does not need to connect to any external APIs for v1 — all data is manually entered by the user.
- Match data does not need to sync across devices — local storage on the user's device is sufficient.
