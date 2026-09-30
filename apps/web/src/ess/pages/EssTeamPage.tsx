import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { useWorkspace } from '../../workspace/workspaceMock';
import { EmployeePhoto } from '../components/EmployeePhoto';
import { StatusChip } from '../components/StatusChip';
import { useEssData } from '../mock/EssDataContext';
import { departmentOf, ORGANIZATION, personForLogin, teammatesOf, teamOf } from '../mock/essMock';

export function EssTeamPage() {
  const { user } = useAuth();
  const { people } = useEssData();
  const { inbox } = useWorkspace();
  const me = personForLogin(user?.email, people);

  if (!me) {
    return (
      <section className="ess-panel">
        <h2>My Team</h2>
        <p className="ess-empty">Your employee record is not in the directory.</p>
      </section>
    );
  }

  const team = teamOf(me);
  const department = departmentOf(me);
  const reportsTo = me.managerId ? people.find((person) => person.id === me.managerId) : undefined;
  const teammates = teammatesOf(me, people);
  const open = inbox.filter((item) => item.personId === me.id && item.status === 'Pending');
  const leads = team?.managerId === me.id;

  return (
    <div className="ess-section-stack">
      <div className="ess-insights">
        <article className="ess-panel ess-insight">
          <p className="ess-muted">Employee id</p>
          <p className="ess-insight-value">{me.employeeCode}</p>
        </article>
        <article className="ess-panel ess-insight">
          <p className="ess-muted">Team</p>
          <p className="ess-insight-value">{team?.name ?? '—'}</p>
        </article>
        <article className="ess-panel ess-insight">
          <p className="ess-muted">With your manager</p>
          <p className="ess-insight-value">{open.length}</p>
        </article>
      </div>
      <p className="ess-att-facts">
        <span>
          {ORGANIZATION.name} · {ORGANIZATION.code}
          {' · '}
          {department?.name ?? me.department}
          {team ? (
            <>
              {' '}
              · <strong>{team.name}</strong>
            </>
          ) : null}
        </span>
        <span>
          {leads ? 'You lead this team' : 'You are on this team'}
        </span>
      </p>

      {!team ? (
        <section className="ess-panel">
          <h2>No team</h2>
          <p className="ess-empty">You are not assigned to a team.</p>
        </section>
      ) : (
        <div className="ess-att-split">
          <section className="ess-panel">
            <h2>{leads ? 'You report to' : 'Manager'}</h2>
            {reportsTo ? (
              <Link to={`/ess/people/${reportsTo.id}`} className="ess-team-manager">
                <EmployeePhoto src={reportsTo.photo} name={reportsTo.name} size="lg" />
                <div>
                  <strong>{reportsTo.name}</strong>
                  <span className="ess-muted">{reportsTo.title}</span>
                  <span className="ess-muted">{reportsTo.employeeCode}</span>
                  <span>{reportsTo.workEmail}</span>
                  <span className="ess-muted">{reportsTo.workPhone}</span>
                </div>
              </Link>
            ) : (
              <p className="ess-empty">No manager is assigned.</p>
            )}
          </section>
          <section className="ess-panel">
            <h2>With {reportsTo?.name ?? 'your manager'}</h2>
            {open.length === 0 ? (
              <p className="ess-empty">Nothing is waiting with your manager.</p>
            ) : (
              <ul className="ess-list">
                {open.map((item) => (
                  <li key={item.id} className="ess-list-item">
                    <div className="ess-leave-request-head">
                      <strong>{item.kind}</strong>
                      <StatusChip status={item.status} />
                    </div>
                    <span className="ess-muted">{item.summary}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {team ? (
        <section className="ess-panel">
          <h2>Teammates</h2>
          {teammates.length === 0 ? (
            <p className="ess-empty">No other people are on this team.</p>
          ) : (
            <div className="ess-person-grid">
              {teammates.map((person) => (
                <Link key={person.id} to={`/ess/people/${person.id}`} className="ess-person-card">
                  <EmployeePhoto src={person.photo} name={person.name} />
                  <h3>{person.name}</h3>
                  <span className="ess-muted">{person.title}</span>
                  <span className="ess-muted">{person.employeeCode}</span>
                </Link>
              ))}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
