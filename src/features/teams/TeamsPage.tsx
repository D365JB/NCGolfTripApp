import { useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, newId } from '../../db/dexie';
import { AdminOnly, Button, Card, Empty, Field, PageHeader, TextInput } from '../../components/ui';
import LogoPicker from '../../components/LogoPicker';
import { useIsAdmin } from '../../lib/identity';
import type { TeamIdentity } from '../../domain/model';

const PRESET_COLORS = ['#166534', '#1d4ed8', '#b91c1c', '#a16207', '#7c3aed', '#0f766e'];

export default function TeamsPage() {
  const isAdmin = useIsAdmin();
  const teams = useLiveQuery(() => db.teamIdentities.orderBy('name').toArray(), []);
  const [name, setName] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [logo, setLogo] = useState<string | undefined>(undefined);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const identity: TeamIdentity = { id: newId(), name: name.trim(), color, logoDataUrl: logo };
    await db.teamIdentities.add(identity);
    setName('');
    setLogo(undefined);
  }

  if (!isAdmin) {
    return (
      <div>
        <PageHeader title="Teams" />
        <AdminOnly message="Only the admin can create or edit team identities." />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Teams" />
      <p className="mb-4 text-sm text-green-700">
        Persistent team identities you can reuse across events.
      </p>
      <Card className="mb-4">
        <form onSubmit={add} className="space-y-3">
          <Field label="Team name">
            <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="The Sandbaggers" />
          </Field>
          <Field label="Color">
            <div className="flex gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={`Color ${c}`}
                  className="h-8 w-8 rounded-full ring-offset-2"
                  style={{ backgroundColor: c, outline: color === c ? `2px solid ${c}` : 'none' }}
                />
              ))}
            </div>
          </Field>
          <Field label="Logo (optional)">
            <LogoPicker value={logo} onChange={setLogo} fallbackColor={color} />
          </Field>
          <Button type="submit">Add team</Button>
        </form>
      </Card>

      {teams && teams.length === 0 && <Empty>No team identities yet.</Empty>}
      <ul className="space-y-2">
        {teams?.map((t) => (
          <li key={t.id}>
            <Card className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <LogoPicker
                  value={t.logoDataUrl}
                  onChange={(url) => db.teamIdentities.update(t.id, { logoDataUrl: url })}
                  size={40}
                  fallbackColor={t.color}
                />
                <input
                  key={t.name}
                  defaultValue={t.name}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && v !== t.name) db.teamIdentities.update(t.id, { name: v });
                    else e.target.value = t.name;
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur();
                  }}
                  aria-label="Team name"
                  className="min-w-0 flex-1 truncate rounded-md border border-transparent bg-transparent px-1 py-0.5 font-semibold text-green-950 outline-none hover:border-black/10 focus:border-brand-500 focus:bg-white"
                />
              </div>
              <Button variant="danger" onClick={() => db.teamIdentities.delete(t.id)}>
                Remove
              </Button>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
