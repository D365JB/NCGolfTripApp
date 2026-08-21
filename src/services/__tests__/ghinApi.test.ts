import { parseHandicapIndex, mapGhinResponse } from '../ghinApi';

describe('parseHandicapIndex', () => {
  it('parses a normal index', () => {
    expect(parseHandicapIndex('8.4')).toBe(8.4);
    expect(parseHandicapIndex(5)).toBe(5);
  });
  it('treats a leading + as a plus (negative) handicap', () => {
    expect(parseHandicapIndex('+2.1')).toBe(-2.1);
  });
  it('returns 0 for blank/invalid', () => {
    expect(parseHandicapIndex('')).toBe(0);
    expect(parseHandicapIndex('N/A')).toBe(0);
  });
});

describe('mapGhinResponse', () => {
  it('maps a { golfers: [...] } wrapper with names and club', () => {
    const raw = {
      golfers: [
        { ghin: 1234567, first_name: 'Rory', last_name: 'McIlroy', hi_value: '8.4', club_name: 'Pinehurst' },
      ],
    };
    expect(mapGhinResponse('0', raw)).toEqual({
      ghinNumber: '1234567',
      handicapIndex: 8.4,
      firstName: 'Rory',
      lastName: 'McIlroy',
      club: 'Pinehurst',
    });
  });

  it('falls back to the requested GHIN and handles plus handicaps', () => {
    expect(mapGhinResponse('7654321', { handicap_index: '+1.5' })).toMatchObject({
      ghinNumber: '7654321',
      handicapIndex: -1.5,
    });
  });
});
