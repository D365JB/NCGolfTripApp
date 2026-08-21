import { strokesReceivedOnHole } from '../strokeAllocation';
import type { HoleInfo, HoleNet, HoleScore } from '../types';

/** Gross score for a side/player on a specific hole, if entered. */
export function grossOnHole(scores: HoleScore[], hole: number): number | undefined {
  return scores.find((s) => s.hole === hole)?.gross;
}

/** Computes a side's net score on a hole, or undefined if no score is entered. */
export type SideNetFn = (hole: HoleInfo) => number | undefined;

/** Build hole-by-hole nets, skipping holes not yet scored by both sides. */
export function buildHoleNets(holes: HoleInfo[], netA: SideNetFn, netB: SideNetFn): HoleNet[] {
  const out: HoleNet[] = [];
  for (const h of [...holes].sort((x, y) => x.hole - y.hole)) {
    const a = netA(h);
    const b = netB(h);
    if (a === undefined || b === undefined) continue;
    out.push({ hole: h.hole, netA: a, netB: b });
  }
  return out;
}

/** Net for a single ball given its strokes-received allocation. */
export function ballNet(
  scores: HoleScore[],
  strokes: number,
  hole: HoleInfo,
  totalHoles: number,
): number | undefined {
  const g = grossOnHole(scores, hole.hole);
  if (g === undefined) return undefined;
  return g - strokesReceivedOnHole(strokes, hole.strokeIndex, totalHoles);
}
