import { db } from '../db/dexie';
import type { Course } from '../domain/model';
import { mapApiCourse, normalizeSearchResults, type CourseSearchResult } from './courseMapper';

export type { CourseSearchResult };

const DIRECT_BASE = 'https://api.golfcourseapi.com';
const KEY_STORAGE = 'gca_key';

export function getApiKey(): string {
  return localStorage.getItem(KEY_STORAGE) ?? '';
}
export function setApiKey(key: string): void {
  if (key.trim()) localStorage.setItem(KEY_STORAGE, key.trim());
  else localStorage.removeItem(KEY_STORAGE);
}

/** When a Supabase project is configured, route through the key-hiding Edge Function. */
function proxyBase(): string | null {
  const url = import.meta.env.VITE_SUPABASE_URL;
  return url ? `${url}/functions/v1/course-proxy` : null;
}

export function isConfigured(): boolean {
  return Boolean(proxyBase()) || Boolean(getApiKey());
}

async function callApi(mode: 'search' | 'course', value: string): Promise<unknown> {
  const proxy = proxyBase();
  if (proxy) {
    const qs = new URLSearchParams(mode === 'search' ? { search: value } : { id: value });
    const res = await fetch(`${proxy}?${qs}`, {
      headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''}` },
    });
    if (!res.ok) throw new Error(`Course lookup failed (${res.status})`);
    return res.json();
  }

  const key = getApiKey();
  if (!key) throw new Error('Add your GolfCourseAPI key first.');
  const path = mode === 'search' ? `/v1/search?search_query=${encodeURIComponent(value)}` : `/v1/courses/${encodeURIComponent(value)}`;
  const res = await fetch(`${DIRECT_BASE}${path}`, { headers: { Authorization: `Key ${key}` } });
  if (!res.ok) throw new Error(`Course lookup failed (${res.status})`);
  return res.json();
}

export async function searchCourses(query: string): Promise<CourseSearchResult[]> {
  return normalizeSearchResults(await callApi('search', query));
}

/** Fetch, map, and cache a course into the local library (dedup by externalId). */
export async function importCourse(externalId: string): Promise<Course> {
  const raw = await callApi('course', externalId);
  const wrapper = raw as { course?: unknown };
  const course = mapApiCourse((wrapper.course ?? raw) as Parameters<typeof mapApiCourse>[0]);

  const existing = course.externalId
    ? await db.courses.filter((c) => c.externalId === course.externalId).first()
    : undefined;
  if (existing) {
    await db.courses.update(existing.id, { ...course, id: existing.id });
    return { ...course, id: existing.id };
  }
  await db.courses.add(course);
  return course;
}
