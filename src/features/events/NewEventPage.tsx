import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, newId } from '../../db/dexie';
import { AdminOnly, Button, Card, Field, PageHeader, Select, TextInput } from '../../components/ui';
import LogoPicker from '../../components/LogoPicker';
import { useIsAdmin } from '../../lib/identity';
import type { EventTeam, GolfEvent, GolfSession } from '../../domain/model';

const today = () => new Date().toISOString().slice(0, 10);

export default function NewEventPage() {
  const navigate = useNavigate();
  const isAdmin = useIsAdmin();
  const courses = useLiveQuery(() => db.courses.orderBy('name').toArray(), []);
  const identities = useLiveQuery(() => db.teamIdentities.orderBy('name').toArray(), []);

  const [name, setName] = useState('');
  const [date, setDate] = useState(today());
  const [courseId, setCourseId] = useState('');
  const [teamAName, setTeamAName] = useState('Team A');
  const [teamAColor, setTeamAColor] = useState('#166534');
  const [teamBName, setTeamBName] = useState('Team B');
  const [teamBColor, setTeamBColor] = useState('#1d4ed8');
  const [teamALogo, setTeamALogo] = useState<string | undefined>(undefined);
  const [teamBLogo, setTeamBLogo] = useState<string | undefined>(undefined);
  const [pointsWin, setPointsWin] = useState('1');
  const [pointsTie, setPointsTie] = useState('0.5');

  const selectedCourse = courseId || courses?.[0]?.id || '';

  function applyIdentity(side: 'a' | 'b', identityId: string) {
    const id = identities?.find((i) => i.id === identityId);
    if (!id) return;
    if (side === 'a') {
      setTeamAName(id.name);
      setTeamAColor(id.color);
      setTeamALogo(id.logoDataUrl);
    } else {
      setTeamBName(id.name);
      setTeamBColor(id.color);
      setTeamBLogo(id.logoDataUrl);
    }
  }

  async function create(e: FormEvent) {
    e.preventDefault();
    const course = selectedCourse;
    if (!name.trim() || !course) return;

    const event: GolfEvent = {
      id: newId(),
      name: name.trim(),
      startDate: date,
      courseId: course,
      status: 'setup',
      pointsWin: Number(pointsWin) || 1,
      pointsTie: Number(pointsTie) || 0.5,
      createdAt: new Date().toISOString(),
    };
    await db.events.add(event);

    const teams: EventTeam[] = [
      { id: newId(), eventId: event.id, side: 'a', name: teamAName.trim() || 'Team A', color: teamAColor, logoDataUrl: teamALogo },
      { id: newId(), eventId: event.id, side: 'b', name: teamBName.trim() || 'Team B', color: teamBColor, logoDataUrl: teamBLogo },
    ];
    await db.eventTeams.bulkAdd(teams);

    const session: GolfSession = {
      id: newId(),
      eventId: event.id,
      name: 'Round 1',
      date,
      sequence: 1,
    };
    await db.sessions.add(session);

    navigate(`/events/${event.id}`);
  }

  if (!isAdmin) {
    return (
      <div>
        <PageHeader title="New event" />
        <AdminOnly message="Only the admin can create events." />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="New event" />
      <form onSubmit={create} className="space-y-4">
        <Card className="space-y-3">
          <Field label="Event name">
            <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Carolina Cup 2026" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start date">
              <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Course">
              <Select value={selectedCourse} onChange={(e) => setCourseId(e.target.value)}>
                {courses?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </Card>

        <Card className="space-y-3">
          <TeamFields
            title="Team A"
            name={teamAName}
            color={teamAColor}
            logo={teamALogo}
            identities={identities ?? []}
            onName={setTeamAName}
            onColor={setTeamAColor}
            onLogo={setTeamALogo}
            onIdentity={(id) => applyIdentity('a', id)}
          />
          <TeamFields
            title="Team B"
            name={teamBName}
            color={teamBColor}
            logo={teamBLogo}
            identities={identities ?? []}
            onName={setTeamBName}
            onColor={setTeamBColor}
            onLogo={setTeamBLogo}
            onIdentity={(id) => applyIdentity('b', id)}
          />
        </Card>

        <Card className="grid grid-cols-2 gap-3">
          <Field label="Points for a win">
            <TextInput value={pointsWin} onChange={(e) => setPointsWin(e.target.value)} inputMode="decimal" />
          </Field>
          <Field label="Points for a tie">
            <TextInput value={pointsTie} onChange={(e) => setPointsTie(e.target.value)} inputMode="decimal" />
          </Field>
        </Card>

        <Button type="submit" className="w-full">
          Create event
        </Button>
      </form>
    </div>
  );
}

function TeamFields({
  title,
  name,
  color,
  logo,
  identities,
  onName,
  onColor,
  onLogo,
  onIdentity,
}: {
  title: string;
  name: string;
  color: string;
  logo?: string;
  identities: { id: string; name: string; color: string }[];
  onName: (v: string) => void;
  onColor: (v: string) => void;
  onLogo: (v: string | undefined) => void;
  onIdentity: (id: string) => void;
}) {
  return (
    <div className="rounded-lg border border-green-100 p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="h-4 w-4 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-sm font-semibold text-green-900">{title}</span>
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <TextInput value={name} onChange={(e) => onName(e.target.value)} />
        <input
          type="color"
          value={color}
          onChange={(e) => onColor(e.target.value)}
          className="h-10 w-12 rounded-lg border border-green-200"
          aria-label={`${title} color`}
        />
      </div>
      <div className="mt-2">
        <LogoPicker value={logo} onChange={onLogo} size={40} fallbackColor={color} />
      </div>
      {identities.length > 0 && (
        <Select className="mt-2" defaultValue="" onChange={(e) => onIdentity(e.target.value)}>
          <option value="" disabled>
            Use saved team identity…
          </option>
          {identities.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </Select>
      )}
    </div>
  );
}
