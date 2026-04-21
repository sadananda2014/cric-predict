import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type { Match, BetType, RateEntry } from '../types';

export interface MatchStore {
  matches: Record<string, Match>;

  createMatch(teamA: string, teamB: string, scraperUrl?: string): string;
  importMatch(match: Match): void;
  completeMatch(matchId: string, winner: string): void;
  setScraperUrl(matchId: string, url: string): void;

  addBet(
    matchId: string,
    team: string,
    betType: BetType,
    rate: number,
    stake: number
  ): void;
  deleteBet(matchId: string, betId: string): void;

  addRateEntry(
    matchId: string,
    favouriteTeam: string,
    lagaaiRate: number,
    khaaiRate: number
  ): void;

  getMatch(matchId: string): Match | undefined;
  getActiveMatches(): Match[];
  getCompletedMatches(): Match[];
  getLatestRate(matchId: string): RateEntry | undefined;
}

export const useMatchStore = create<MatchStore>()(
  persist(
    (set, get) => ({
      matches: {},

      createMatch(teamA: string, teamB: string, scraperUrl?: string): string {
        const id = uuidv4();
        const match: Match = {
          id,
          teamA: teamA.trim(),
          teamB: teamB.trim(),
          status: 'active',
          winner: null,
          bets: [],
          rateEntries: [],
          createdAt: new Date().toISOString(),
          completedAt: null,
          scraperUrl: scraperUrl?.trim() || null,
        };
        set((state) => ({
          matches: { ...state.matches, [id]: match },
        }));
        return id;
      },

      importMatch(match: Match): void {
        set((state) => ({
          matches: { ...state.matches, [match.id]: match },
        }));
      },

      completeMatch(matchId: string, winner: string): void {
        set((state) => {
          const match = state.matches[matchId];
          if (!match || match.status === 'completed') return state;
          return {
            matches: {
              ...state.matches,
              [matchId]: {
                ...match,
                status: 'completed',
                winner,
                completedAt: new Date().toISOString(),
              },
            },
          };
        });
      },

      setScraperUrl(matchId: string, url: string): void {
        set((state) => {
          const match = state.matches[matchId];
          if (!match) return state;
          return {
            matches: {
              ...state.matches,
              [matchId]: { ...match, scraperUrl: url.trim() || null },
            },
          };
        });
      },

      addBet(
        matchId: string,
        team: string,
        betType: BetType,
        rate: number,
        stake: number
      ): void {
        set((state) => {
          const match = state.matches[matchId];
          if (!match || match.status === 'completed') return state;
          const bet = {
            id: uuidv4(),
            team,
            betType,
            rate,
            stake,
            createdAt: new Date().toISOString(),
          };
          return {
            matches: {
              ...state.matches,
              [matchId]: {
                ...match,
                bets: [...match.bets, bet],
              },
            },
          };
        });
      },

      deleteBet(matchId: string, betId: string): void {
        set((state) => {
          const match = state.matches[matchId];
          if (!match) return state;
          return {
            matches: {
              ...state.matches,
              [matchId]: {
                ...match,
                bets: match.bets.filter((b) => b.id !== betId),
              },
            },
          };
        });
      },

      addRateEntry(
        matchId: string,
        favouriteTeam: string,
        lagaaiRate: number,
        khaaiRate: number
      ): void {
        set((state) => {
          const match = state.matches[matchId];
          if (!match || match.status === 'completed') return state;
          const entry: RateEntry = {
            id: uuidv4(),
            favouriteTeam,
            lagaaiRate,
            khaaiRate,
            createdAt: new Date().toISOString(),
          };
          return {
            matches: {
              ...state.matches,
              [matchId]: {
                ...match,
                rateEntries: [...match.rateEntries, entry],
              },
            },
          };
        });
      },

      getMatch(matchId: string): Match | undefined {
        return get().matches[matchId];
      },

      getActiveMatches(): Match[] {
        return Object.values(get().matches)
          .filter((m) => m.status === 'active')
          .sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
      },

      getCompletedMatches(): Match[] {
        return Object.values(get().matches)
          .filter((m) => m.status === 'completed')
          .sort(
            (a, b) =>
              new Date(b.completedAt ?? b.createdAt).getTime() -
              new Date(a.completedAt ?? a.createdAt).getTime()
          );
      },

      getLatestRate(matchId: string): RateEntry | undefined {
        const match = get().matches[matchId];
        if (!match || match.rateEntries.length === 0) return undefined;
        return match.rateEntries[match.rateEntries.length - 1];
      },
    }),
    {
      name: 'cric-predict-store',
    }
  )
);
