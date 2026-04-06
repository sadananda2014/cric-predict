export function validateTeamName(name: string): { valid: boolean; error?: string } {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: 'Team name cannot be empty' };
  }
  if (trimmed.length > 10) {
    return { valid: false, error: 'Team name must be 10 characters or less' };
  }
  return { valid: true };
}

export function validateRate(rate: number): { valid: boolean; error?: string } {
  if (!Number.isFinite(rate)) {
    return { valid: false, error: 'Rate must be a finite number' };
  }
  if (!Number.isInteger(rate)) {
    return { valid: false, error: 'Rate must be a whole number' };
  }
  if (rate < 1) {
    return { valid: false, error: 'Rate must be at least 1' };
  }
  return { valid: true };
}

export function validateStake(stake: number): { valid: boolean; error?: string } {
  if (!Number.isFinite(stake)) {
    return { valid: false, error: 'Stake must be a finite number' };
  }
  if (stake <= 0) {
    return { valid: false, error: 'Stake must be greater than 0' };
  }
  return { valid: true };
}

export function validateMatchTeams(
  teamA: string,
  teamB: string
): { valid: boolean; error?: string } {
  const resultA = validateTeamName(teamA);
  if (!resultA.valid) {
    return { valid: false, error: `Team A: ${resultA.error}` };
  }
  const resultB = validateTeamName(teamB);
  if (!resultB.valid) {
    return { valid: false, error: `Team B: ${resultB.error}` };
  }
  if (teamA.trim().toLowerCase() === teamB.trim().toLowerCase()) {
    return { valid: false, error: 'Team names must be different' };
  }
  return { valid: true };
}
