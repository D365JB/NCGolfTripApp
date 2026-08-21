import { useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, newId } from '../../db/dexie';
import { standardPar72Holes } from '../../db/seed';
import { AdminOnly, Button, Card, Empty, Field, PageHeader, Select, TextInput } from '../../components/ui';
import {
  searchCourses,
  importCourse,
  getApiKey,
  setApiKey,
  isConfigured,
  type CourseSearchResult,
} from '../../services/courseApi';
import type { Course, CourseHole } from '../../domain/model';
import { useIsAdmin } from '../../lib/identity';

export default function CoursesPage() {
  const isAdmin = useIsAdmin();
  const courses = useLiveQuery(() => db.courses.orderBy('name').toArray(), []);
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [cr, setCr] = useState('71.0');
  const [slope, setSlope] = useState('118');
  const [editing, setEditing] = useState<string | null>(null);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const holes = standardPar72Holes();
    const course: Course = {
      id: newId(),
      name: name.trim(),
      city: city.trim() || undefined,
      state: 'NC',
      par: holes.reduce((s, h) => s + h.par, 0),
      courseRating: Number(cr) || 72,
      slopeRating: Number(slope) || 113,
      holes,
      source: 'manual',
    };
    await db.courses.add(course);
    setName('');
    setCity('');
  }

  if (!isAdmin) {
    return (
      <div>
        <PageHeader title="Courses" />
        <AdminOnly message="Only the admin can import or edit courses." />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Courses" />
      <p className="mb-4 text-sm text-green-700">
        Import real courses from GolfCourseAPI, or add one manually. Par, stroke index and yardages are editable.
      </p>
      <CourseImport />
      <Card className="mb-4">
        <form onSubmit={add} className="grid grid-cols-2 gap-3">
          <Field label="Course name">
            <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Tobacco Road" />
          </Field>
          <Field label="City (optional)">
            <TextInput value={city} onChange={(e) => setCity(e.target.value)} placeholder="Sanford" />
          </Field>
          <Field label="Course Rating">
            <TextInput value={cr} onChange={(e) => setCr(e.target.value)} inputMode="decimal" />
          </Field>
          <Field label="Slope Rating">
            <TextInput value={slope} onChange={(e) => setSlope(e.target.value)} inputMode="numeric" />
          </Field>
          <div className="col-span-2">
            <Button type="submit">Add course (par-72 template)</Button>
          </div>
        </form>
      </Card>

      {courses && courses.length === 0 && <Empty>No courses yet.</Empty>}
      <ul className="space-y-2">
        {courses?.map((c) => (
          <li key={c.id}>
            <Card>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-green-950">{c.name}</p>
                  <p className="text-xs text-green-700">
                    Par {c.par} · CR {c.courseRating} · Slope {c.slopeRating}
                    {c.city ? ` · ${c.city}, ${c.state}` : ` · ${c.state}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setEditing(editing === c.id ? null : c.id)}>
                    {editing === c.id ? 'Close' : 'Edit'}
                  </Button>
                  <Button variant="danger" onClick={() => db.courses.delete(c.id)}>
                    Remove
                  </Button>
                </div>
              </div>
              {editing === c.id && <CourseEditor course={c} onDone={() => setEditing(null)} />}
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CourseEditor({ course, onDone }: { course: Course; onDone: () => void }) {
  const [holes, setHoles] = useState<CourseHole[]>(course.holes.map((h) => ({ ...h })));

  function update(index: number, patch: Partial<CourseHole>) {
    setHoles((prev) => prev.map((h, i) => (i === index ? { ...h, ...patch } : h)));
  }

  async function save() {
    await db.courses.update(course.id, {
      holes,
      par: holes.reduce((s, h) => s + h.par, 0),
    });
    onDone();
  }

  return (
    <div className="mt-4 border-t border-green-100 pt-3">
      <div className="grid grid-cols-[2rem_1fr_1fr_1.3fr] gap-2 text-[11px] font-semibold text-green-800">
        <span>#</span>
        <span>Par</span>
        <span>SI</span>
        <span>Yards</span>
      </div>
      <div className="mt-1 max-h-72 space-y-1 overflow-y-auto">
        {holes.map((h, i) => (
          <div key={h.hole} className="grid grid-cols-[2rem_1fr_1fr_1.3fr] items-center gap-2">
            <span className="text-sm text-green-700">{h.hole}</span>
            <Select value={h.par} onChange={(e) => update(i, { par: Number(e.target.value) })}>
              {[3, 4, 5, 6].map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
            <Select value={h.strokeIndex} onChange={(e) => update(i, { strokeIndex: Number(e.target.value) })}>
              {Array.from({ length: 18 }, (_, n) => n + 1).map((si) => (
                <option key={si} value={si}>
                  {si}
                </option>
              ))}
            </Select>
            <TextInput
              inputMode="numeric"
              value={h.yardage ?? ''}
              onChange={(e) => update(i, { yardage: e.target.value === '' ? undefined : Number(e.target.value) })}
              placeholder="—"
            />
          </div>
        ))}
      </div>
      <div className="mt-3">
        <Button onClick={save}>Save scorecard</Button>
      </div>
    </div>
  );
}

function CourseImport() {
  const [key, setKeyState] = useState(getApiKey());
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CourseSearchResult[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const configured = isConfigured();

  function saveKey() {
    setApiKey(key);
    setKeyState(getApiKey());
    setStatus('Key saved.');
  }

  async function runSearch(e: FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setBusy(true);
    setStatus(null);
    setResults([]);
    try {
      const rows = await searchCourses(query.trim());
      setResults(rows);
      if (rows.length === 0) setStatus('No courses found.');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Search failed.');
    } finally {
      setBusy(false);
    }
  }

  async function doImport(externalId: string, courseName: string) {
    setBusy(true);
    setStatus(null);
    try {
      await importCourse(externalId);
      setStatus(`Imported ${courseName}.`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Import failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mb-4">
      <p className="mb-2 text-sm font-semibold text-green-900">Import from GolfCourseAPI</p>
      {!configured && (
        <div className="mb-3 space-y-2">
          <p className="text-xs text-green-700">
            Paste your free API key from golfcourseapi.com — stored only in this browser.
          </p>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <TextInput value={key} onChange={(e) => setKeyState(e.target.value)} placeholder="GolfCourseAPI key" />
            <Button type="button" onClick={saveKey}>
              Save key
            </Button>
          </div>
        </div>
      )}
      <form onSubmit={runSearch} className="grid grid-cols-[1fr_auto] gap-2">
        <TextInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search e.g. Pinehurst" />
        <Button type="submit" disabled={busy || !configured}>
          {busy ? 'Searching…' : 'Search'}
        </Button>
      </form>
      {status && <p className="mt-2 text-xs text-green-700">{status}</p>}
      {results.length > 0 && (
        <ul className="mt-3 space-y-2">
          {results.map((r) => (
            <li key={r.externalId} className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-green-950">{r.name}</p>
                {r.location && <p className="text-xs text-green-600">{r.location}</p>}
              </div>
              <Button variant="ghost" disabled={busy} onClick={() => doImport(r.externalId, r.name)}>
                Import
              </Button>
            </li>
          ))}
        </ul>
      )}
      {getApiKey() && (
        <button
          type="button"
          onClick={() => {
            setApiKey('');
            setKeyState('');
            setStatus('Key cleared.');
          }}
          className="mt-2 text-[11px] text-green-500 underline"
        >
          Clear saved key
        </button>
      )}
    </Card>
  );
}
