import type { Course, CourseHole } from '../domain/model';

// Shapes are intentionally loose — GolfCourseAPI responses vary by course/plan.
interface ApiHole {
  par?: number;
  yardage?: number;
  handicap?: number; // stroke index
}
interface ApiTee {
  tee_name?: string;
  course_rating?: number;
  slope_rating?: number;
  par_total?: number;
  number_of_holes?: number;
  holes?: ApiHole[];
}
export interface ApiCourse {
  id?: number | string;
  club_name?: string;
  course_name?: string;
  location?: { city?: string; state?: string; country?: string };
  tees?: { male?: ApiTee[]; female?: ApiTee[] };
}

export interface CourseSearchResult {
  externalId: string;
  name: string;
  location: string;
}

function displayName(c: ApiCourse): string {
  return [c.club_name, c.course_name].filter(Boolean).join(' — ') || c.course_name || c.club_name || 'Course';
}

function firstTee(c: ApiCourse): ApiTee | undefined {
  const tees = c.tees ?? {};
  return [...(tees.male ?? []), ...(tees.female ?? [])][0];
}

/** Map a GolfCourseAPI course object to our local Course model. */
export function mapApiCourse(raw: ApiCourse): Course {
  const tee = firstTee(raw);
  const holes: CourseHole[] = (tee?.holes ?? []).map((h, i) => ({
    hole: i + 1,
    par: Number(h.par) || 4,
    strokeIndex: Number(h.handicap) > 0 ? Number(h.handicap) : i + 1,
    yardage: h.yardage ? Number(h.yardage) : undefined,
  }));
  const par = Number(tee?.par_total) || holes.reduce((s, h) => s + h.par, 0) || 72;

  return {
    id: crypto.randomUUID(),
    externalId: raw.id != null ? String(raw.id) : undefined,
    name: displayName(raw),
    city: raw.location?.city,
    state: raw.location?.state || 'NC',
    par,
    courseRating: Number(tee?.course_rating) || 72,
    slopeRating: Number(tee?.slope_rating) || 113,
    holes,
    source: 'api',
  };
}

/** Normalize a search response (array or { courses: [...] }) into result rows. */
export function normalizeSearchResults(raw: unknown): CourseSearchResult[] {
  const list: ApiCourse[] = Array.isArray(raw)
    ? (raw as ApiCourse[])
    : ((raw as { courses?: ApiCourse[] })?.courses ?? []);
  return list.map((c) => ({
    externalId: c.id != null ? String(c.id) : '',
    name: displayName(c),
    location: [c.location?.city, c.location?.state].filter(Boolean).join(', '),
  }));
}
