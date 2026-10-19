import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { fetchDirectory } from '../../workspace/hrApi';
import { EmployeePhoto } from '../components/EmployeePhoto';
import { useEssData } from '../mock/EssDataContext';
import { departments, ORGANIZATION, personForLogin, teams, type Person } from '../mock/essMock';

type DirPerson = Person & { teamLabel: string };

function teamName(teamId: string | undefined) {
  if (!teamId) return '';
  return teams.find((team) => team.id === teamId)?.name ?? '';
}

function teamLabelOf(person: Person & { teamLabel?: string }) {
  return person.teamLabel || teamName(person.teamId);
}

function useDirectoryPeople() {
  const { user } = useAuth();
  const { people: mockPeople } = useEssData();
  const [directory, setDirectory] = useState<DirPerson[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchDirectory()
      .then((rows) => {
        if (cancelled) return;
        setDirectory(
          rows.map((row) => ({
            id: row.id,
            photo: row.photo,
            employeeCode: row.employeeCode,
            organizationId: ORGANIZATION.code,
            name: `${row.firstName} ${row.lastName}`.trim(),
            title: row.designation,
            department: row.departmentName ?? 'Unassigned',
            location: row.locationName ?? '',
            workEmail: row.email,
            workPhone: '',
            teamId: row.teamId ?? undefined,
            managerId: row.managerId ?? undefined,
            managerName: row.managerName ?? undefined,
            teamLabel: row.teamName ?? '',
          })),
        );
      })
      .catch(() => {
        if (!cancelled) setDirectory(null);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.email]);

  const people: DirPerson[] =
    directory ??
    mockPeople.map((person) => ({ ...person, teamLabel: teamName(person.teamId) }));
  const me =
    people.find((person) => person.workEmail.toLowerCase() === user?.email?.toLowerCase()) ??
    personForLogin(user?.email, people);
  return { user, people, me: me as DirPerson | undefined };
}

function reportsTo(person: Person, people: Person[]) {
  return people
    .filter((candidate) => candidate.managerId === person.id && candidate.id !== person.id)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function peersOf(person: Person, people: Person[]) {
  if (!person.teamId) return [];
  return people
    .filter(
      (candidate) =>
        candidate.teamId === person.teamId &&
        candidate.id !== person.id &&
        candidate.managerId !== person.id,
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}

function PersonLink({ person }: { person: Person }) {
  return (
    <Link to={`/ess/people/${person.id}`} className="ess-report-person">
      <EmployeePhoto src={person.photo} name={person.name} />
      <span>
        <strong>{person.name}</strong>
        <span className="ess-muted">{person.title}</span>
      </span>
    </Link>
  );
}

export function EssPeoplePage() {
  const { people, me } = useDirectoryPeople();
  const [query, setQuery] = useState('');
  const [department, setDepartment] = useState('');
  const [location, setLocation] = useState('');

  const departmentNames = useMemo(
    () => [...new Set(people.map((p) => p.department))].sort(),
    [people],
  );
  const locations = useMemo(
    () => [...new Set(people.map((p) => p.location))].sort(),
    [people],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return people.filter((p) => {
      if (department && p.department !== department) return false;
      if (location && p.location !== location) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.title.toLowerCase().includes(q) ||
        p.workEmail.toLowerCase().includes(q) ||
        p.employeeCode.toLowerCase().includes(q) ||
        p.organizationId.toLowerCase().includes(q) ||
        teamLabelOf(p).toLowerCase().includes(q) ||
        p.department.toLowerCase().includes(q) ||
        p.location.toLowerCase().includes(q)
      );
    });
  }, [people, query, department, location]);

  const groups = useMemo(() => {
    const order = new Map(departments.map((item, index) => [item.name, index]));
    const byDepartment = new Map<string, Person[]>();
    for (const person of filtered) {
      const list = byDepartment.get(person.department) ?? [];
      list.push(person);
      byDepartment.set(person.department, list);
    }
    return [...byDepartment.entries()]
      .sort(([a], [b]) => (order.get(a) ?? 99) - (order.get(b) ?? 99) || a.localeCompare(b))
      .map(([name, members]) => ({
        name,
        members: [...members].sort((a, b) => {
          if (a.id === me?.id) return -1;
          if (b.id === me?.id) return 1;
          return a.name.localeCompare(b.name);
        }),
      }));
  }, [filtered, me?.id]);

  const filtersOn = Boolean(query.trim() || department || location);

  return (
    <div className="ess-section-stack">
      <p className="ess-page-lead">
        Work details for everyone at {ORGANIZATION.name}. Personal records stay on your profile.
      </p>

      <div className="ess-filters">
        <label className="ess-filter-field ess-filter-search">
          Search
          <input
            type="search"
            placeholder="Name, role, team, or email"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label className="ess-filter-field">
          Department
          <select value={department} onChange={(e) => setDepartment(e.target.value)}>
            <option value="">All</option>
            {departmentNames.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <label className="ess-filter-field">
          Location
          <select value={location} onChange={(e) => setLocation(e.target.value)}>
            <option value="">All</option>
            {locations.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </label>
        {filtersOn ? (
          <button
            type="button"
            className="ess-btn ess-btn-ghost"
            onClick={() => {
              setQuery('');
              setDepartment('');
              setLocation('');
            }}
          >
            Clear
          </button>
        ) : null}
      </div>

      <p className="ess-result-count">
        {filtersOn
          ? `${filtered.length} of ${people.length} people`
          : `${people.length} people`}
      </p>

      {groups.length === 0 ? (
        <p className="ess-empty">No one matches this search.</p>
      ) : (
        <div className="ess-dir">
          {groups.map((group) => (
            <section key={group.name} className="ess-dir-group">
              <h2>
                {group.name}
                <span>{group.members.length}</span>
              </h2>
              <div className="ess-dir-cols" aria-hidden="true">
                <span className="ess-dir-head">
                  <span>Person</span>
                  <span>Role</span>
                  <span>Team and location</span>
                </span>
                <span>Contact</span>
              </div>
              <ul>
                {group.members.map((p) => {
                  const team = teamLabelOf(p);
                  return (
                    <li key={p.id} className="ess-dir-row">
                      <Link to={`/ess/people/${p.id}`} className="ess-dir-main">
                        <span className="ess-dir-person">
                          <EmployeePhoto src={p.photo} name={p.name} />
                          <span>
                            <strong>
                              {p.name}
                              {p.id === me?.id ? <span className="ess-you">You</span> : null}
                            </strong>
                            <span className="ess-dir-meta">{p.employeeCode}</span>
                          </span>
                        </span>
                        <span className="ess-dir-role">{p.title}</span>
                        <span className="ess-dir-place">
                          {team ? `${team} · ${p.location}` : p.location}
                        </span>
                      </Link>
                      <span className="ess-dir-contact">
                        <a href={`mailto:${p.workEmail}`}>{p.workEmail}</a>
                        <a href={`tel:${p.workPhone}`}>{p.workPhone}</a>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

export function EssPersonDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { people, me } = useDirectoryPeople();
  const navigate = useNavigate();
  const person = people.find((p) => p.id === id);
  const manager = person?.managerId
    ? people.find((candidate) => candidate.id === person.managerId)
    : undefined;
  const reports = person ? reportsTo(person, people) : [];
  const peers = person ? peersOf(person, people) : [];
  const team = person ? teamLabelOf(person) : '';

  if (!person) {
    return (
      <section className="ess-panel">
        <h2>Person not found</h2>
        <p className="ess-empty">This directory entry does not exist.</p>
        <button type="button" className="ess-btn" onClick={() => navigate('/ess/people')}>
          Back to People
        </button>
      </section>
    );
  }

  return (
    <div className="ess-section-stack">
      <div className="ess-actions">
        <Link to="/ess/people" className="ess-btn">
          People
        </Link>
        {person.id === me?.id ? (
          <Link to="/ess/profile" className="ess-btn ess-btn-primary">
            Open my profile
          </Link>
        ) : null}
      </div>

      <section className="ess-panel ess-dir-profile">
        <header className="ess-dir-identity">
          <EmployeePhoto src={person.photo} name={person.name} size="lg" />
          <div>
            <h2>
              {person.name}
              {person.id === me?.id ? <span className="ess-you">You</span> : null}
            </h2>
            <p>{person.title}</p>
            <p className="ess-muted">
              {person.employeeCode} · {ORGANIZATION.name}
            </p>
          </div>
        </header>

        <div className="ess-dir-facts">
          <div>
            <h3>Work</h3>
            <dl className="ess-dl">
              <div>
                <dt>Department</dt>
                <dd>{person.department}</dd>
              </div>
              <div>
                <dt>Team</dt>
                <dd>{team || '—'}</dd>
              </div>
              <div>
                <dt>Location</dt>
                <dd>{person.location}</dd>
              </div>
              <div>
                <dt>Manager</dt>
                <dd>
                  {manager ? (
                    <Link to={`/ess/people/${manager.id}`}>{manager.name}</Link>
                  ) : (
                    '—'
                  )}
                </dd>
              </div>
            </dl>
          </div>
          <div>
            <h3>Contact</h3>
            <dl className="ess-dl">
              <div>
                <dt>Work email</dt>
                <dd>
                  <a href={`mailto:${person.workEmail}`}>{person.workEmail}</a>
                </dd>
              </div>
              <div>
                <dt>Work phone</dt>
                <dd>
                  <a href={`tel:${person.workPhone}`}>{person.workPhone}</a>
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      <section className="ess-panel">
        <h2>Reporting line</h2>
        <ol className="ess-report-line">
          {manager ? (
            <li>
              <span className="ess-report-role">Manager</span>
              <PersonLink person={manager} />
            </li>
          ) : null}
          <li>
            <span className="ess-report-role">{person.id === me?.id ? 'You' : 'This person'}</span>
            <span className="ess-report-person">
              <EmployeePhoto src={person.photo} name={person.name} />
              <span>
                <strong>{person.name}</strong>
                <span className="ess-muted">{person.title}</span>
              </span>
            </span>
          </li>
          {reports.map((report) => (
            <li key={report.id}>
              <span className="ess-report-role">Reports</span>
              <PersonLink person={report} />
            </li>
          ))}
        </ol>

        {team && peers.length > 0 ? (
          <>
            <h3 className="ess-subhead">Also on {team}</h3>
            <ol className="ess-report-line">
              {peers.map((peer) => (
                <li key={peer.id}>
                  <span className="ess-report-role">Teammate</span>
                  <PersonLink person={peer} />
                </li>
              ))}
            </ol>
          </>
        ) : null}
      </section>
    </div>
  );
}
