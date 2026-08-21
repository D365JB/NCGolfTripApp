/**
 * Strokes a player receives on a given hole, based on total strokes received
 * across the round allocated by Stroke Index.
 *
 * Positive strokesReceived: 1 stroke on the hardest `strokesReceived` holes
 * (Stroke Index 1..n), looping for handicaps above the hole count.
 * Negative strokesReceived (plus handicaps): strokes given back on the easiest holes.
 */
export function strokesReceivedOnHole(
  strokesReceived: number,
  strokeIndex: number,
  totalHoles = 18,
): number {
  if (strokesReceived === 0) return 0;

  if (strokesReceived > 0) {
    const base = Math.floor(strokesReceived / totalHoles);
    const remainder = strokesReceived % totalHoles;
    return base + (strokeIndex <= remainder ? 1 : 0);
  }

  const abs = -strokesReceived;
  const base = Math.floor(abs / totalHoles);
  const remainder = abs % totalHoles;
  const given = base + (strokeIndex > totalHoles - remainder ? 1 : 0);
  return given === 0 ? 0 : -given;
}

/** Net score on a hole = gross minus strokes received on that hole. */
export function netOnHole(
  gross: number,
  strokesReceived: number,
  strokeIndex: number,
  totalHoles = 18,
): number {
  return gross - strokesReceivedOnHole(strokesReceived, strokeIndex, totalHoles);
}
