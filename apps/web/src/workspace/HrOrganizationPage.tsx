import { useEffect, useMemo, useState } from 'react';
import { EmployeePhoto } from '../ess/components/EmployeePhoto';
import {
  createDepartment,
  createLocation,
  createTeam,
  deleteDepartment,
  deleteLocation,
  deleteTeam,
  fetchHrEmployees,
  fetchHrOrg,
  renameDepartment,
  renameLocation,
  updateTeam,
  type HrEmployee,
  type HrNamed,
  type HrTeam,
} from './hrApi';
import './hr-org.css';

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong';
}

function peopleLabel(count: number) {
  return count === 1 ? '1 person' : `${count} people`;
}

function fullName(person: { firstName: string; lastName: string }) {
  return `${person.firstName} ${person.lastName}`.trim();
}

export function HrOrganizationPage() {
  const [departments, setDepartments] = useState<HrNamed[]>([]);
  const [locations, setLocations] = useState<HrNamed[]>([]);
  const [teams, setTeams] = useState<HrTeam[]>([]);
  const [employees, setEmployees] = useState<HrEmployee[]>([]);
  const [ready, setReady] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function reload() {
    const [org, people] = await Promise.all([fetchHrOrg(), fetchHrEmployees()]);
    const nextDepartments = [...org.departments].sort((a, b) => a.name.localeCompare(b.name));
    setDepartments(nextDepartments);
    setLocations([...org.locations].sort((a, b) => a.name.localeCompare(b.name)));
    setTeams([...org.teams].sort((a, b) => a.name.localeCompare(b.name)));
    setEmployees(people);
    setSelectedId((current) =>
      current && nextDepartments.some((department) => department.id === current)
        ? current
        : (nextDepartments[0]?.id ?? null),
    );
    setReady(true);
  }

  useEffect(() => {
    void reload().catch((err) => setError(messageOf(err)));
  }, []);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      return true;
    } catch (err) {
      setError(messageOf(err));
      return false;
    } finally {
      setBusy(false);
    }
  }

  const counts = useMemo(() => {
    const tally = (pick: (person: HrEmployee) => string | null) => {
      const map = new Map<string, number>();
      for (const person of employees) {
        const id = pick(person);
        if (!id) continue;
        map.set(id, (map.get(id) ?? 0) + 1);
      }
      return map;
    };
    return {
      department: tally((person) => person.departmentId),
      location: tally((person) => person.locationId),
      team: tally((person) => person.teamId),
    };
  }, [employees]);

  const selected = departments.find((department) => department.id === selectedId) ?? null;
  const departmentTeams = teams.filter((team) => team.departmentId === selected?.id);
  const departmentPeople = employees.filter((person) => person.departmentId === selected?.id);

  if (!ready) {
    return <p className="hr-org-empty">{error ?? 'Loading organization…'}</p>;
  }

  return (
    <div className="hr-org">
      <dl className="hr-org-stats">
        <div>
          <dt>Departments</dt>
          <dd>{departments.length}</dd>
        </div>
        <div>
          <dt>Locations</dt>
          <dd>{locations.length}</dd>
        </div>
        <div>
          <dt>Teams</dt>
          <dd>{teams.length}</dd>
        </div>
      </dl>
      {error ? (
        <p className="hr-org-alert" role="alert">
          {error}
        </p>
      ) : null}
      <div className="hr-org-workspace">
        <DepartmentRail
          departments={departments}
          counts={counts.department}
          selectedId={selectedId}
          busy={busy}
          onSelect={setSelectedId}
          onCreate={async (name) => {
            let createdId = '';
            const ok = await run(async () => {
              const created = await createDepartment(name);
              createdId = created.id;
              await reload();
            });
            if (ok) setSelectedId(createdId);
            return ok;
          }}
        />
        <DepartmentDetail
          department={selected}
          teams={departmentTeams}
          people={departmentPeople}
          employees={employees}
          teamCounts={counts.team}
          busy={busy}
          run={run}
          onRename={async (name) => {
            if (!selected) return;
            await renameDepartment(selected.id, name);
            await reload();
          }}
          onDelete={async () => {
            if (!selected) return;
            await deleteDepartment(selected.id);
            await reload();
          }}
          onCreateTeam={async (input) => {
            if (!selected) return;
            await createTeam({ ...input, departmentId: selected.id });
            await reload();
          }}
          onSaveTeam={async (id, input) => {
            await updateTeam(id, input);
            await reload();
          }}
          onDeleteTeam={async (id) => {
            await deleteTeam(id);
            await reload();
          }}
        />
      </div>
      <LocationBoard
        locations={locations}
        counts={counts.location}
        busy={busy}
        run={run}
        onCreate={async (name) => {
          await createLocation(name);
          await reload();
        }}
        onRename={async (id, name) => {
          await renameLocation(id, name);
          await reload();
        }}
        onDelete={async (id) => {
          await deleteLocation(id);
          await reload();
        }}
      />
    </div>
  );
}

function DepartmentRail({
  departments,
  counts,
  selectedId,
  busy,
  onSelect,
  onCreate,
}: {
  departments: HrNamed[];
  counts: Map<string, number>;
  selectedId: string | null;
  busy: boolean;
  onSelect: (id: string) => void;
  onCreate: (name: string) => Promise<boolean>;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');

  return (
    <aside className="hr-org-rail">
      <div className="hr-org-rail-head">
        <h2>Departments</h2>
        <button type="button" className="ess-btn" onClick={() => setAdding((open) => !open)}>
          {adding ? 'Close' : 'Add'}
        </button>
      </div>
      {adding ? (
        <form
          className="hr-org-inline"
          onSubmit={(event) => {
            event.preventDefault();
            const next = name.trim();
            if (!next) return;
            void onCreate(next).then((ok) => {
              if (!ok) return;
              setName('');
              setAdding(false);
            });
          }}
        >
          <input
            aria-label="New department name"
            value={name}
            placeholder="Department name"
            onChange={(event) => setName(event.target.value)}
            required
            disabled={busy}
          />
          <button type="submit" className="ess-btn ess-btn-primary" disabled={busy}>
            Save
          </button>
        </form>
      ) : null}
      {departments.length === 0 ? <p className="hr-org-empty">No departments yet.</p> : null}
      <ul className="hr-org-rail-list" role="tablist" aria-label="Departments">
        {departments.map((department) => {
          const selected = department.id === selectedId;
          return (
            <li key={department.id}>
              <button
                type="button"
                role="tab"
                className={`hr-org-dept${selected ? ' is-selected' : ''}`}
                aria-selected={selected}
                onClick={() => onSelect(department.id)}
              >
                <strong>{department.name}</strong>
                <span>{counts.get(department.id) ?? 0}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

function DepartmentDetail({
  department,
  teams,
  people,
  employees,
  teamCounts,
  busy,
  run,
  onRename,
  onDelete,
  onCreateTeam,
  onSaveTeam,
  onDeleteTeam,
}: {
  department: HrNamed | null;
  teams: HrTeam[];
  people: HrEmployee[];
  employees: HrEmployee[];
  teamCounts: Map<string, number>;
  busy: boolean;
  run: (action: () => Promise<void>) => Promise<boolean>;
  onRename: (name: string) => Promise<void>;
  onDelete: () => Promise<void>;
  onCreateTeam: (input: { name: string; managerId?: string }) => Promise<void>;
  onSaveTeam: (
    id: string,
    input: { name: string; departmentId: string; managerId: string | null },
  ) => Promise<void>;
  onDeleteTeam: (id: string) => Promise<void>;
}) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState('');
  const [addingTeam, setAddingTeam] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [managerId, setManagerId] = useState('');
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: '', managerId: '' });

  useEffect(() => {
    setRenaming(false);
    setAddingTeam(false);
    setEditingTeamId(null);
  }, [department?.id]);

  if (!department) {
    return (
      <section className="hr-org-detail">
        <p className="hr-org-empty">Add a department to start the organization.</p>
      </section>
    );
  }

  const placed = new Set(teams.map((team) => team.id));
  const loose = people.filter((person) => !person.teamId || !placed.has(person.teamId));

  return (
    <section className="hr-org-detail" role="tabpanel" aria-label={department.name}>
      <div className="hr-org-detail-head">
        <div>
          {renaming ? (
            <form
              className="hr-org-inline"
              onSubmit={(event) => {
                event.preventDefault();
                void run(async () => {
                  await onRename(name.trim());
                  setRenaming(false);
                });
              }}
            >
              <input
                aria-label="Department name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                disabled={busy}
              />
              <button type="submit" className="ess-btn ess-btn-primary" disabled={busy}>
                Save
              </button>
              <button type="button" className="ess-btn" onClick={() => setRenaming(false)}>
                Cancel
              </button>
            </form>
          ) : (
            <>
              <h2>{department.name}</h2>
              <p className="hr-org-detail-copy">
                {peopleLabel(people.length)} · {teams.length === 1 ? '1 team' : `${teams.length} teams`}
              </p>
            </>
          )}
        </div>
        {renaming ? null : (
          <div className="hr-org-actions">
            <button
              type="button"
              className="ess-btn"
              onClick={() => {
                setName(department.name);
                setRenaming(true);
              }}
            >
              Rename
            </button>
            <button
              type="button"
              className="ess-btn ess-btn-danger"
              disabled={busy}
              onClick={() => {
                if (
                  !window.confirm(
                    `Remove ${department.name}? This stays blocked while people or teams still use it.`,
                  )
                ) {
                  return;
                }
                void run(onDelete);
              }}
            >
              Remove
            </button>
          </div>
        )}
      </div>

      <div className="hr-org-teams">
        <div className="hr-org-rail-head">
          <h3>Teams</h3>
          <button type="button" className="ess-btn" onClick={() => setAddingTeam((open) => !open)}>
            {addingTeam ? 'Close' : 'Add team'}
          </button>
        </div>
        {addingTeam ? (
          <form
            className="hr-org-team-form"
            onSubmit={(event) => {
              event.preventDefault();
              void run(async () => {
                await onCreateTeam({
                  name: teamName.trim(),
                  managerId: managerId || undefined,
                });
                setTeamName('');
                setManagerId('');
                setAddingTeam(false);
              });
            }}
          >
            <input
              aria-label="New team name"
              value={teamName}
              placeholder="Team name"
              onChange={(event) => setTeamName(event.target.value)}
              required
              disabled={busy}
            />
            <select
              aria-label="New team manager"
              value={managerId}
              onChange={(event) => setManagerId(event.target.value)}
              disabled={busy}
            >
              <option value="">No manager</option>
              {employees.map((person) => (
                <option key={person.id} value={person.id}>
                  {fullName(person)}
                </option>
              ))}
            </select>
            <button type="submit" className="ess-btn ess-btn-primary" disabled={busy}>
              Save
            </button>
          </form>
        ) : null}
        {teams.length === 0 ? <p className="hr-org-empty">No teams in this department yet.</p> : null}
        {teams.map((team) => {
          const members = people.filter((person) => person.teamId === team.id);
          const editing = editingTeamId === team.id;
          return (
            <article key={team.id} className="hr-org-team">
              {editing ? (
                <form
                  className="hr-org-team-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void run(async () => {
                      await onSaveTeam(team.id, {
                        name: draft.name.trim(),
                        departmentId: department.id,
                        managerId: draft.managerId || null,
                      });
                      setEditingTeamId(null);
                    });
                  }}
                >
                  <input
                    aria-label="Team name"
                    value={draft.name}
                    onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                    required
                    disabled={busy}
                  />
                  <select
                    aria-label="Team manager"
                    value={draft.managerId}
                    onChange={(event) => setDraft({ ...draft, managerId: event.target.value })}
                    disabled={busy}
                  >
                    <option value="">No manager</option>
                    {employees.map((person) => (
                      <option key={person.id} value={person.id}>
                        {fullName(person)}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className="ess-btn ess-btn-primary" disabled={busy}>
                    Save
                  </button>
                  <button type="button" className="ess-btn" onClick={() => setEditingTeamId(null)}>
                    Cancel
                  </button>
                </form>
              ) : (
                <div className="hr-org-team-head">
                  <div>
                    <strong>{team.name}</strong>
                    <span className="hr-org-quiet">
                      {team.managerName ?? 'No manager'} · {peopleLabel(teamCounts.get(team.id) ?? 0)}
                    </span>
                  </div>
                  <div className="hr-org-actions">
                    <button
                      type="button"
                      className="ess-btn"
                      onClick={() => {
                        setEditingTeamId(team.id);
                        setDraft({ name: team.name, managerId: team.managerId ?? '' });
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="ess-btn ess-btn-danger"
                      disabled={busy}
                      onClick={() => {
                        if (
                          !window.confirm(
                            `Remove ${team.name}? This stays blocked while people are still on the team.`,
                          )
                        ) {
                          return;
                        }
                        void run(() => onDeleteTeam(team.id));
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )}
              <People people={members} empty="No one is on this team yet." />
            </article>
          );
        })}
        {loose.length > 0 ? (
          <article className="hr-org-team">
            <div className="hr-org-team-head">
              <div>
                <strong>Not on a team</strong>
                <span className="hr-org-quiet">
                  {peopleLabel(loose.length)} in {department.name}
                </span>
              </div>
            </div>
            <People people={loose} empty="" />
          </article>
        ) : null}
      </div>
    </section>
  );
}

function People({ people, empty }: { people: HrEmployee[]; empty: string }) {
  if (people.length === 0) {
    return empty ? <p className="hr-org-empty">{empty}</p> : null;
  }
  return (
    <ul className="hr-org-people">
      {people
        .slice()
        .sort((a, b) => fullName(a).localeCompare(fullName(b)))
        .map((person) => (
          <li key={person.id} className="hr-org-person">
            <EmployeePhoto src={person.photo} name={fullName(person)} size="sm" />
            <span>
              <strong>{fullName(person)}</strong>
              <span>{person.designation || person.locationName || person.email}</span>
            </span>
          </li>
        ))}
    </ul>
  );
}

function LocationBoard({
  locations,
  counts,
  busy,
  run,
  onCreate,
  onRename,
  onDelete,
}: {
  locations: HrNamed[];
  counts: Map<string, number>;
  busy: boolean;
  run: (action: () => Promise<void>) => Promise<boolean>;
  onCreate: (name: string) => Promise<void>;
  onRename: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  return (
    <section className="hr-org-places">
      <div className="hr-org-places-head">
        <h2>Locations</h2>
        <button type="button" className="ess-btn" onClick={() => setAdding((open) => !open)}>
          {adding ? 'Close' : 'Add location'}
        </button>
      </div>
      {adding ? (
        <form
          className="hr-org-inline"
          onSubmit={(event) => {
            event.preventDefault();
            void run(async () => {
              await onCreate(name.trim());
              setName('');
              setAdding(false);
            });
          }}
        >
          <input
            aria-label="New location name"
            value={name}
            placeholder="Location name"
            onChange={(event) => setName(event.target.value)}
            required
            disabled={busy}
          />
          <button type="submit" className="ess-btn ess-btn-primary" disabled={busy}>
            Save
          </button>
        </form>
      ) : null}
      {locations.length === 0 ? <p className="hr-org-empty">No locations yet.</p> : null}
      <div className="hr-org-place-grid">
        {locations.map((location) => {
          const editing = editingId === location.id;
          return (
            <article key={location.id} className="hr-org-place">
              {editing ? (
                <form
                  className="hr-org-inline"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void run(async () => {
                      await onRename(location.id, draft.trim());
                      setEditingId(null);
                    });
                  }}
                >
                  <input
                    aria-label="Location name"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    required
                    disabled={busy}
                  />
                  <button type="submit" className="ess-btn ess-btn-primary" disabled={busy}>
                    Save
                  </button>
                  <button type="button" className="ess-btn" onClick={() => setEditingId(null)}>
                    Cancel
                  </button>
                </form>
              ) : (
                <>
                  <h3>{location.name}</h3>
                  <p className="hr-org-quiet">{peopleLabel(counts.get(location.id) ?? 0)}</p>
                  <div className="hr-org-actions">
                    <button
                      type="button"
                      className="ess-btn"
                      onClick={() => {
                        setEditingId(location.id);
                        setDraft(location.name);
                      }}
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      className="ess-btn ess-btn-danger"
                      disabled={busy}
                      onClick={() => {
                        if (
                          !window.confirm(
                            `Remove ${location.name}? This stays blocked while people still use it.`,
                          )
                        ) {
                          return;
                        }
                        void run(() => onDelete(location.id));
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
