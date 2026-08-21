import type { Course, CourseHole } from '../domain/model';
import { db, newId } from './dexie';

// Standard men's stroke-index allocation (odd on the front nine, even on the back).
const FRONT_SI = [5, 7, 17, 1, 11, 3, 15, 13, 9];
const BACK_SI = [4, 12, 8, 18, 2, 10, 16, 6, 14];
const FRONT_PAR = [4, 4, 3, 5, 4, 4, 3, 4, 5];
const BACK_PAR = [4, 4, 4, 3, 5, 4, 3, 5, 4];

export function standardPar72Holes(): CourseHole[] {
  const holes: CourseHole[] = [];
  for (let i = 0; i < 9; i++) {
    holes.push({ hole: i + 1, par: FRONT_PAR[i], strokeIndex: FRONT_SI[i] });
  }
  for (let i = 0; i < 9; i++) {
    holes.push({ hole: i + 10, par: BACK_PAR[i], strokeIndex: BACK_SI[i] });
  }
  return holes;
}

/** Seeds a neutral, editable par-72 template so the app is usable before course lookup is wired. */
export async function seedIfEmpty(): Promise<void> {
  const count = await db.courses.count();
  if (count > 0) return;

  const template: Course = {
    id: newId(),
    name: 'Par 72 Template (edit for your course)',
    state: 'NC',
    par: 72,
    courseRating: 71.0,
    slopeRating: 118,
    holes: standardPar72Holes(),
    source: 'manual',
  };
  await db.courses.add(template);
}
