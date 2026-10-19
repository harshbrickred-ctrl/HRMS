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
  const reportsTo = me.managerId
    ? people.find((person) => person.id === me.managerId)
    : undefined;
  const teammates = teammatesOf(me, people);
  const open = inbox.filter((item) => item.personId === me.id && item.status === 'Pending');
  const leads = team?.managerId === me.id;
  const managerName = reportsTo?.name ?? 'your manager';

  return (
    <div className="ess-section-stack">
      <p className="ess-page-lead">
        {ORGANIZATION.name}
        {department ? ` · ${department.name}` : ` · ${me.department}`}
        {team ? ` · ${team.name}` : ''}
        {team ? (leads ? '. You lead this team.' : '. You are on this team.') : '.'}
      </p>

      {!team ? (
        <section className="ess-panel">
          <h2>No team</h2>
          <p className="ess-empty">You are not assigned to a team.</p>
        </section>
      ) : (
        <section className="ess-panel">
          <h2>Reporting line</h2>
          <ol className="ess-report-line">
            {reportsTo ? (
              <li>
                <span className="ess-report-role">Manager</span>
                <Link to={`/ess/people/${reportsTo.id}`} className="ess-report-person">
                  <EmployeePhoto src={reportsTo.photo} name={reportsTo.name} />
                  <span>
                    <strong>{reportsTo.name}</strong>
                    <span className="ess-muted">{reportsTo.title}</span>
                  </span>
                </Link>
              </li>
            ) : null}
            <li>
              <span className="ess-report-role">You</span>
              <Link to={`/ess/people/${me.id}`} className="ess-report-person">
                <EmployeePhoto src={me.photo} name={me.name} />
                <span>
                  <strong>{me.name}</strong>
                  <span className="ess-muted">{me.title}</span>
                </span>
              </Link>
            </li>
          </ol>
          <h3 className="ess-subhead">{leads ? 'People you lead' : 'Teammates'}</h3>
          {teammates.length === 0 ? (
            <p className="ess-empty">No other people are on this team.</p>
          ) : (
            <ol className="ess-report-line">
              {teammates.map((person) => (
                <li key={person.id}>
                  <span className="ess-report-role">{leads ? 'Reports' : 'Teammate'}</span>
                  <Link to={`/ess/people/${person.id}`} className="ess-report-person">
                    <EmployeePhoto src={person.photo} name={person.name} />
                    <span>
                      <strong>{person.name}</strong>
                      <span className="ess-muted">{person.title}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      <section className="ess-panel">
        <h2>Requests waiting on {managerName}</h2>
        {open.length === 0 ? (
          <p className="ess-empty">Nothing is waiting on {managerName}.</p>
        ) : (
          <ul className="ess-list">
            {open.map((item) => (
              <li key={item.id} className="ess-list-item">
                <div className="ess-leave-request-head">
                  <Link to={item.kind === 'Leave' ? '/ess/leave' : '/ess/attendance'}>
                    <strong>{item.kind}</strong>
                  </Link>
                  <StatusChip status={item.status} />
                </div>
                <span className="ess-muted">{item.summary}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
