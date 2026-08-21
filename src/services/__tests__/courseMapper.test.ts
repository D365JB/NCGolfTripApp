import { mapApiCourse, normalizeSearchResults, type ApiCourse } from '../courseMapper';

function sampleCourse(): ApiCourse {
  const holes = Array.from({ length: 18 }, (_, i) => ({
    par: i % 3 === 2 ? 3 : i % 5 === 4 ? 5 : 4,
    yardage: 350 + i * 5,
    handicap: i + 1,
  }));
  return {
    id: 4321,
    club_name: 'Tobacco Road Golf Club',
    course_name: 'Championship',
    location: { city: 'Sanford', state: 'NC', country: 'United States' },
    tees: {
      male: [
        {
          tee_name: 'Blue',
          course_rating: 71.2,
          slope_rating: 149,
          par_total: 71,
          number_of_holes: 18,
          holes,
        },
      ],
    },
  };
}

describe('mapApiCourse', () => {
  it('maps club/course, ratings, and per-hole par/SI/yardage', () => {
    const c = mapApiCourse(sampleCourse());
    expect(c.name).toBe('Tobacco Road Golf Club — Championship');
    expect(c.city).toBe('Sanford');
    expect(c.state).toBe('NC');
    expect(c.courseRating).toBe(71.2);
    expect(c.slopeRating).toBe(149);
    expect(c.par).toBe(71);
    expect(c.externalId).toBe('4321');
    expect(c.source).toBe('api');
    expect(c.holes).toHaveLength(18);
    expect(c.holes[0]).toEqual({ hole: 1, par: 4, strokeIndex: 1, yardage: 350 });
  });

  it('falls back to hole order when stroke index is missing', () => {
    const raw: ApiCourse = {
      id: 1,
      club_name: 'Test',
      tees: { male: [{ par_total: 72, holes: [{ par: 4 }, { par: 5 }] }] },
    };
    const c = mapApiCourse(raw);
    expect(c.holes[0].strokeIndex).toBe(1);
    expect(c.holes[1].strokeIndex).toBe(2);
    expect(c.holes[1].yardage).toBeUndefined();
  });
});

describe('normalizeSearchResults', () => {
  it('handles a { courses: [...] } wrapper', () => {
    const rows = normalizeSearchResults({
      courses: [{ id: 7, club_name: 'Pinehurst', course_name: 'No. 2', location: { city: 'Pinehurst', state: 'NC' } }],
    });
    expect(rows).toEqual([{ externalId: '7', name: 'Pinehurst — No. 2', location: 'Pinehurst, NC' }]);
  });

  it('handles a bare array', () => {
    const rows = normalizeSearchResults([{ id: 8, course_name: 'Grandover' }]);
    expect(rows[0]).toEqual({ externalId: '8', name: 'Grandover', location: '' });
  });
});
