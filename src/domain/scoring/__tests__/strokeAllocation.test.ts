import { strokesReceivedOnHole, netOnHole } from '../strokeAllocation';

describe('strokesReceivedOnHole', () => {
  it('gives one stroke on the hardest N holes', () => {
    expect(strokesReceivedOnHole(5, 1)).toBe(1);
    expect(strokesReceivedOnHole(5, 5)).toBe(1);
    expect(strokesReceivedOnHole(5, 6)).toBe(0);
  });

  it('loops for handicaps above the hole count', () => {
    expect(strokesReceivedOnHole(20, 1)).toBe(2);
    expect(strokesReceivedOnHole(20, 2)).toBe(2);
    expect(strokesReceivedOnHole(20, 3)).toBe(1);
  });

  it('gives strokes back on the easiest holes for plus handicaps', () => {
    expect(strokesReceivedOnHole(-1, 18)).toBe(-1);
    expect(strokesReceivedOnHole(-1, 17)).toBe(0);
  });

  it('returns 0 with no strokes', () => {
    expect(strokesReceivedOnHole(0, 1)).toBe(0);
  });
});

describe('netOnHole', () => {
  it('subtracts strokes received from gross', () => {
    expect(netOnHole(5, 1, 1)).toBe(4);
    expect(netOnHole(5, 0, 1)).toBe(5);
  });
});
