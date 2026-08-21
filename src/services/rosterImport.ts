import type { EventTeam } from '../domain/model';

export interface ParsedGolfer {
  teamId: string;
  firstName: string;
  lastName: string;
  handicapIndex: number;
  ghinNumber?: string;
}

export interface RosterParseResult {
  golfers: ParsedGolfer[];
  skipped: number;
}

const HEADER_WORDS = new Set([
  'team',
  'first',
  'last',
  'name',
  'first name',
  'last name',
  'handicap',
  'handicap index',
  'hcp',
  'index',
  'ghin',
  'ghin #',
]);

function splitCells(line: string): string[] {
  return line.split(/[,\t]/).map((c) => c.trim());
}

function looksLikeHeader(cells: string[]): boolean {
  const hasWord = cells.some((c) => HEADER_WORDS.has(c.toLowerCase()));
  const hasNumber = cells.some((c) => /^\d+(\.\d+)?$/.test(c));
  return hasWord && !hasNumber;
}

function resolveTeamId(name: string, teamA: EventTeam, teamB: EventTeam): string | null {
  const n = name.trim().toLowerCase();
  if (!n) return null;
  const a = teamA.name.trim().toLowerCase();
  const b = teamB.name.trim().toLowerCase();
  if (n === a || n === 'a' || n === '1') return teamA.id;
  if (n === b || n === 'b' || n === '2') return teamB.id;
  if (a && (a.includes(n) || n.includes(a))) return teamA.id;
  if (b && (b.includes(n) || n.includes(b))) return teamB.id;
  return null;
}

/** Pull handicap index, GHIN number, and name tokens out of a row's cells. */
function extractGolfer(cells: string[]): { firstName: string; lastName: string; hi: number; ghin?: string } {
  let hi = 0;
  let hiSet = false;
  let ghin: string | undefined;
  const nameParts: string[] = [];

  for (const c of cells) {
    if (!c) continue;
    if (/^\d{5,}$/.test(c)) {
      ghin = c; // long integer -> GHIN number
      continue;
    }
    if (!hiSet && /^\d+(\.\d+)?$/.test(c) && Number(c) <= 54) {
      hi = Number(c); // small number -> handicap index
      hiSet = true;
      continue;
    }
    nameParts.push(c);
  }

  const tokens = nameParts.join(' ').split(/\s+/).filter(Boolean);
  return { firstName: tokens[0] ?? '', lastName: tokens.slice(1).join(' '), hi, ghin };
}

/**
 * Parse a pasted/uploaded roster into golfers with team assignments. Accepts
 * "Team, First, Last, Handicap, GHIN" (any subset), tolerates a header row, and
 * falls back to fallbackTeamId for rows whose first cell isn't a known team.
 */
export function parseTeamStructure(
  text: string,
  teamA: EventTeam,
  teamB: EventTeam,
  fallbackTeamId: string,
): RosterParseResult {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const golfers: ParsedGolfer[] = [];
  let skipped = 0;

  lines.forEach((line, idx) => {
    const cells = splitCells(line);
    if (idx === 0 && looksLikeHeader(cells)) return;

    const maybeTeam = resolveTeamId(cells[0] ?? '', teamA, teamB);
    const teamId = maybeTeam && cells.length >= 3 ? maybeTeam : fallbackTeamId;
    const rest = maybeTeam && cells.length >= 3 ? cells.slice(1) : cells;

    const { firstName, lastName, hi, ghin } = extractGolfer(rest);
    if (!firstName && !lastName) {
      skipped++;
      return;
    }
    golfers.push({
      teamId,
      firstName: firstName || lastName,
      lastName: firstName ? lastName : '',
      handicapIndex: hi,
      ghinNumber: ghin,
    });
  });

  return { golfers, skipped };
}
