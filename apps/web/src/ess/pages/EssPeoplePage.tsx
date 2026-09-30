import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { EmployeePhoto } from '../components/EmployeePhoto';
import { useEssData } from '../mock/EssDataContext';
import { ORGANIZATION, personForLogin, teams } from '../mock/essMock';

function teamName(teamId: string | undefined) {
  if (!teamId) return '';
  return teams.find((team) => team.id === teamId)?.name ?? '';
}

export function EssPeoplePage() {
  const { user } = useAuth();
  const { people } = useEssData();
  const me = personForLogin(user?.email, people);
  const [query, setQuery] = useState('');
  const [department, setDepartment] = useState('');
  const [location, setLocation] = useState('');

  const departments = useMemo(
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
        teamName(p.teamId).toLowerCase().includes(q) ||
        p.department.toLowerCase().includes(q)
      );
    });
  }, [people, query, department, location]);

  return (
    <div className="ess-section-stack">
      <div className="ess-insights">
        <article className="ess-panel ess-insight">
          <p className="ess-muted">People</p>
          <p className="ess-insight-value">{people.length}</p>
        </article>
        <article className="ess-panel ess-insight">
          <p className="ess-muted">Departments</p>
          <p className="ess-insight-value">{departments.length}</p>
        </article>
        <article className="ess-panel ess-insight">
          <p className="ess-muted">Locations</p>
          <p className="ess-insight-value">{locations.length}</p>
        </article>
      </div>

      <div className="ess-filters">
        <input
          type="search"
          placeholder="Search name, title, email…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search people"
        />
        <select
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          aria-label="Filter by department"
        >
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <select
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          aria-label="Filter by location"
        >
          <option value="">All locations</option>
          {locations.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </div>

      <p className="ess-muted" style={{ marginBottom: '0.85rem' }}>
        Showing {filtered.length} of {people.length}
      </p>

      {filtered.length === 0 ? (
        <p className="ess-empty">No people match your filters.</p>
      ) : (
        <div className="ess-person-grid">
          {filtered.map((p) => (
            <Link
              key={p.id}
              to={`/ess/people/${p.id}`}
              className="ess-person-card"
            >
              <EmployeePhoto src={p.photo} name={p.name} />
              <h3>
                {p.name}
                {p.id === me?.id ? (
                  <span className="ess-muted"> · You</span>
                ) : null}
              </h3>
              <span className="ess-muted">{p.title}</span>
              <span className="ess-muted">
                {p.employeeCode}
                {teamName(p.teamId) ? ` · ${teamName(p.teamId)}` : ''}
              </span>
              <span className="ess-muted">
                {p.department} · {p.location}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function EssPersonDetailPage() {
  const { user } = useAuth();
  const { id } = useParams<{ id: string }>();
  const { people } = useEssData();
  const me = personForLogin(user?.email, people);
  const navigate = useNavigate();
  const person = people.find((p) => p.id === id);

  if (!person) {
    return (
      <section className="ess-panel">
        <h2>Person not found</h2>
        <p className="ess-empty">This directory entry does not exist.</p>
        <button
          type="button"
          className="ess-btn"
          onClick={() => navigate('/ess/people')}
        >
          Back to People
        </button>
      </section>
    );
  }

  return (
    <div className="ess-section-stack">
      <div className="ess-actions">
        <Link to="/ess/people" className="ess-btn">
          ← People
        </Link>
        {person.id === me?.id ? (
          <Link to="/ess/profile" className="ess-btn ess-btn-primary">
            Open my profile
          </Link>
        ) : null}
      </div>

      <section className="ess-panel">
        <div className="ess-person-head">
          <EmployeePhoto src={person.photo} name={person.name} size="lg" />
          <div>
            <h2 style={{ margin: 0 }}>{person.name}</h2>
            <p className="ess-muted" style={{ margin: '0.2rem 0 0' }}>
              {person.title} · {person.employeeCode} · {ORGANIZATION.name}
            </p>
          </div>
        </div>

        <dl className="ess-dl" style={{ marginTop: '1.15rem' }}>
          <div>
            <dt>Employee id</dt>
            <dd>{person.employeeCode}</dd>
          </div>
          <div>
            <dt>Organization</dt>
            <dd>
              {ORGANIZATION.name} · {ORGANIZATION.code}
            </dd>
          </div>
          <div>
            <dt>Department</dt>
            <dd>{person.department}</dd>
          </div>
          <div>
            <dt>Team</dt>
            <dd>{teamName(person.teamId) || '—'}</dd>
          </div>
          <div>
            <dt>Location</dt>
            <dd>{person.location}</dd>
          </div>
          <div>
            <dt>Work email</dt>
            <dd>
              <a href={`mailto:${person.workEmail}`}>{person.workEmail}</a>
            </dd>
          </div>
          <div>
            <dt>Work phone</dt>
            <dd>{person.workPhone}</dd>
          </div>
          <div>
            <dt>Manager</dt>
            <dd>
              {person.managerId ? (
                <Link to={`/ess/people/${person.managerId}`}>
                  {person.managerName}
                </Link>
              ) : (
                person.managerName ?? '—'
              )}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
