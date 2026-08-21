import { pointsForResult, DEFAULT_POINTS } from '../points';

describe('pointsForResult', () => {
  it('awards a win to the correct side', () => {
    expect(pointsForResult('a', 1)).toEqual({ a: 1, b: 0 });
    expect(pointsForResult('b', 1)).toEqual({ a: 0, b: 1 });
  });

  it('splits a tie', () => {
    expect(pointsForResult('tie', 1)).toEqual({ a: 0.5, b: 0.5 });
  });

  it('scales by the match point value', () => {
    expect(pointsForResult('a', 2, DEFAULT_POINTS)).toEqual({ a: 2, b: 0 });
  });
});
