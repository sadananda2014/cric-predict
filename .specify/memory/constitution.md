<!--
Sync Impact Report
- Version change: 1.2.0 → 1.3.0
- Modified principles:
  - I. Data Accuracy & Bet Tracking: clarified per-match
    isolation — each match has its own independent ledger.
  - III. Simplicity & YAGNI: updated from single-match to
    multi-match with match list as home screen.
- Added sections: None
- Removed sections: None
- Templates requiring updates:
  - .specify/templates/plan-template.md ✅ no changes needed
  - .specify/templates/spec-template.md ✅ no changes needed
  - .specify/templates/tasks-template.md ✅ no changes needed
- Follow-up TODOs: None
-->

# CricPredict Constitution

## Core Principles

### I. Data Accuracy & Bet Tracking

All prediction and hedging logic MUST operate on verified,
real-time or near-real-time match data AND the user's actual
bet history for the current match.

- **Prediction source**: The user references an external app
  (e.g., Cricket Guru) for live win probability and rate data.
  Our app does NOT generate its own match predictions — the
  user enters the rates they see in their prediction app.
- Match context (which team is batting, score, overs) MAY be
  sourced from a cricket data API or entered manually.
- The app MUST maintain a **per-match** bet ledger recording
  every bet the user places: team backed, rate at time of bet,
  and stake amount. Each match (e.g., LSG vs DC, RCB vs KKR)
  is a completely independent session — bets, rates, and P&L
  from one match MUST NOT affect another.
- When rates change, the user MUST be able to enter updated
  rates for that specific match so the system can recalculate
  the position.
- Prediction outputs MUST clearly display the current rates,
  data timestamp, and portfolio position (net P&L for each
  possible outcome).

#### Rate System (Lagaai/Khaai Format)

The app MUST use the Indian betting rate system as its
canonical odds format. Rates are displayed as two numbers:

- **Lagaai (red number)**: The rate for backing the favourite.
  Example: LSG rate = 96 means — bet ₹100 on LSG, if LSG
  wins you profit ₹96 (total return ₹196). If LSG loses,
  you lose your ₹100 stake.
- **Khaai (green number)**: The rate for backing the underdog.
  Example: DC rate = 97 means — bet ₹97 on DC, if DC wins
  you profit ₹100 (total return ₹197). If DC loses, you
  lose your ₹97 stake.

Key properties:
- Rates change continuously as the match progresses.
- The favourite team has the Lagaai rate; the underdog has
  the Khaai rate. Which team is favourite can flip mid-match.
- Users can bet any number of times on either team at
  whatever the current rate is.
- The app MUST accept rates in this format (integer values,
  typically 1–200+ range) and calculate P&L accordingly.

**Rationale**: This is the actual format users see in apps
like Cricket Guru. Using the same system eliminates
conversion errors and matches the user's mental model.

### II. Responsible Gambling (NON-NEGOTIABLE)

The application MUST include responsible gambling safeguards at
every layer where betting suggestions are displayed.

- Every prediction screen MUST show a visible disclaimer:
  "Predictions are informational only. Bet responsibly."
- The app MUST NOT guarantee outcomes or use language implying
  certainty (e.g., "sure win", "guaranteed profit").
- Confidence levels MUST be displayed as probabilities or ranges,
  never as absolutes.
- The app MUST include a link or reference to responsible
  gambling resources.

**Rationale**: Betting apps carry inherent risk. The product MUST
not encourage reckless behaviour or misrepresent prediction
accuracy.

### III. Simplicity & YAGNI

Start with the minimum viable feature set. Do not add features,
abstractions, or integrations that are not immediately needed.

- The app MUST support multiple concurrent matches, each as an
  independent session. The home screen is a **match list**
  showing all active matches (e.g., LSG vs DC, RCB vs KKR)
  with a quick status (total P&L, number of bets placed).
- Tapping a match opens its dedicated view with three sections:
  (1) rate entry (current Lagaai/Khaai), (2) bet ledger
  showing all bets placed for that match, (3) position
  summary showing net P&L per outcome and the system's
  suggestion.
- Users MUST be able to create a new match by entering the two
  team names. Completed matches can be archived/closed.
- No social features, user accounts, leaderboards, or cloud
  sync unless explicitly scoped.
- Hedging calculations MUST start with simple arithmetic
  (stake × rate profit/loss matrices) before introducing
  probabilistic models.
- UI MUST prioritize clarity: what bets are active, what the
  current position is, and what the system recommends — with
  clear reasoning.
- No premature optimization — correctness and usability first.

**Rationale**: Users bet on multiple matches in a day (e.g.,
IPL double-headers). Each match needs its own isolated
tracking. Keep each match view simple and focused.

### IV. Testable Prediction Logic

All prediction, hedging, and P&L logic MUST be independently
testable with deterministic inputs and outputs.

- Prediction functions MUST be pure: given a match state, odds,
  and existing bet portfolio, they produce a deterministic
  suggestion.
- Hedging calculations MUST be pure: given a list of bets and
  current odds, they produce exact P&L for each outcome and
  an optimal next-bet recommendation.
- Business logic MUST be separated from UI and data-fetching
  layers so it can be unit-tested in isolation.
- Edge cases MUST have explicit test coverage:
  - Match edge cases: rain delay, super over, all-out, tie.
  - Bet edge cases: single bet, multiple bets on same team,
    bets on both teams, zero-profit positions.
  - Odds edge cases: very high odds, very low odds, equal odds
    on both teams.

**Rationale**: Betting suggestions carry financial implications
for users. Logic correctness — especially P&L math — MUST be
verifiable through automated tests, not manual spot-checks.

### V. Security & Privacy

User data MUST be handled with care. The app MUST NOT store
sensitive financial information.

- The app MUST NOT collect, store, or transmit betting account
  credentials or payment information.
- If any user preferences are persisted (e.g., favourite teams),
  storage MUST be local-only (device storage) in v1 — no remote
  database without explicit user consent.
- All external API calls MUST use HTTPS.
- Input validation MUST be applied to all user-provided data
  (odds, match parameters) to prevent injection attacks.

**Rationale**: A prediction tool has no legitimate need for
financial credentials. Minimizing data collection minimizes
risk exposure.

### VI. Smart Hedging & Position Management

The app's core value is not just tracking bets — it MUST
actively manage the user's bet portfolio and suggest optimal
actions to minimize loss or maximize profit as rates change
during a live match.

- The system MUST calculate and display the user's net position
  (profit/loss) for EVERY possible match outcome at all times,
  based on all recorded bets and current rates.
- When the user enters updated rates, the system MUST suggest
  one of these actions with clear reasoning:
  - **Bet now**: Place a specific bet (team, amount) to hedge
    or increase position. MUST show projected P&L if this bet
    is placed.
  - **Wait**: Hold off — current rates are not favourable for
    action. MUST explain why (e.g., "rate has moved only 2
    points; wait for a bigger swing").
  - **Cash out / lock profit**: Place a counter-bet to lock in
    guaranteed profit regardless of outcome. MUST show the
    exact amount and team.
  - **Reduce exposure**: Place a counter-bet to cap maximum
    loss. MUST show worst-case and best-case after the hedge.
- Suggestions MUST include the math: show the user exactly how
  each bet changes their position per outcome.
- Multiple simultaneous bets MUST be supported — the user may
  place bets on both teams at different rates throughout the
  match.
- The system MUST clearly distinguish between "locking profit"
  (guaranteed green on all outcomes) and "reducing loss"
  (minimizing red on the worst outcome).

#### Example Scenario

```
Match: LSG vs DC

Rate 1: LSG 96 (Lagaai) / DC 97 (Khaai)
  User bets: DC ₹1,000 at rate 97
  Position: If DC wins → +₹1,031  If LSG wins → -₹1,000

Rate 2: LSG 30 (Lagaai) / DC 60 (Khaai)
  (LSG now strong favourite, rate dropped)
  User bets: LSG ₹2,000 at rate 30
  Position: If LSG wins → +₹600-1,000=-400
            If DC wins  → +₹1,031-2,000=-969
  → System suggests: "You're red on both sides.
     Wait for rate swing or hedge at [amount]."

Rate 3: LSG 90 / DC 90 (match gets tight)
  → System calculates optimal hedge bet to minimize
     worst-case or lock profit if position allows.
```

**Rationale**: This is the primary differentiator of the app.
Raw predictions are available in Cricket Guru —
portfolio-aware, rate-aware hedging advice is the unique
value proposition.

## Technology Constraints

- **Platform**: Mobile app (React Native or Flutter) or web app
  (React/Next.js) — to be decided during planning phase.
- **Language**: TypeScript preferred for web; Dart if Flutter.
- **Prediction Source**: User manually enters rates from
  Cricket Guru or similar app. Our app does NOT generate
  match predictions — it consumes user-entered rates.
- **Rate Format**: Indian Lagaai/Khaai integer format
  (e.g., 96/97). The app MUST NOT use Western decimal or
  fractional odds unless an explicit conversion mode is added.
- **Storage**: Local device storage only for v1 (AsyncStorage,
  SharedPreferences, or localStorage). Bet history persists
  per match. Each match is stored as an independent record
  with its own ledger, rate history, and P&L state.
- **No Backend Required for v1**: The app SHOULD run entirely
  client-side. All P&L and hedging calculations happen on
  device.

## Development Workflow

- **Branch Strategy**: Feature branches off `main`; PRs required
  for merge.
- **Code Review**: All prediction logic changes MUST be reviewed
  before merge.
- **Testing Gate**: PRs MUST pass all unit tests for prediction
  logic. UI tests are encouraged but not blocking for v1.
- **Commit Messages**: Follow conventional commits format
  (e.g., `feat:`, `fix:`, `docs:`).
- **Responsible Gambling Review**: Any UI change displaying
  betting suggestions MUST be checked against Principle II
  before approval.

## Governance

This constitution is the highest-authority document for the
CricPredict project. All design decisions, code reviews, and
feature additions MUST comply with the principles above.

- **Amendments**: Any change to this constitution MUST be
  documented with a version bump, rationale, and updated date.
  Breaking changes to principles require MAJOR version bump.
- **Versioning**: MAJOR.MINOR.PATCH semantic versioning.
  - MAJOR: principle removal or incompatible redefinition.
  - MINOR: new principle or material expansion.
  - PATCH: wording clarifications, typo fixes.
- **Compliance Review**: At each milestone (spec, plan, tasks),
  verify alignment with this constitution before proceeding.
- **Conflict Resolution**: If a design decision conflicts with
  a principle, the principle wins unless amended first.

**Version**: 1.3.0 | **Ratified**: 2026-04-01 | **Last Amended**: 2026-04-01
