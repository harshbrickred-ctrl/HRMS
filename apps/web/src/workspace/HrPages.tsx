import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useWorkspace } from './workspaceMock';
import { fetchHrEmployees } from './hrApi';
import { fetchReportSummary, fetchWorkflowQueues } from './reportsApi';
import { HrDocumentsPage } from './HrDocumentsPage';
import { HrEmployeesPage } from './HrEmployeesPage';
import { HrLeaveAdminPage } from './HrLeaveAdminPage';
import { HrOrganizationPage } from './HrOrganizationPage';

export { HrDocumentsPage, HrEmployeesPage, HrLeaveAdminPage, HrOrganizationPage };

function Insights({ items }: { items: Array<[string, string | number]> }) {
  return (
    <div className="ess-insights">
      {items.map(([label, value]) => (
        <article key={label} className="ess-panel ess-insight">
          <p className="ess-muted">{label}</p>
          <p className="ess-insight-value">{value}</p>
        </article>
      ))}
    </div>
  );
}

export function HrOverviewPage() {
  const { imports } = useWorkspace();
  const [incomplete, setIncomplete] = useState(0);
  const [people, setPeople] = useState(0);

  useEffect(() => {
    void fetchHrEmployees()
      .then((rows) => {
        setPeople(rows.length);
        setIncomplete(
          rows.filter(
            (person) => !person.departmentId || !person.locationId || !person.designation.trim(),
          ).length,
        );
      })
      .catch(() => undefined);
  }, []);

  return (
    <div className="ess-section-stack">
      <Insights
        items={[
          ['Employees', people],
          ['Incomplete profiles', incomplete],
          ['Import rows', imports.length],
        ]}
      />
      <section className="ess-panel">
        <h2>Queues</h2>
        <ul className="ess-list">
          <li className="ess-list-item">
            <strong>Profiles</strong>
            <span className="ess-muted">
              {incomplete} people missing a department, location, or designation
            </span>
          </li>
          <li className="ess-list-item">
            <strong>Imports</strong>
            <span className="ess-muted">
              {imports.length === 0 ? 'No files recorded yet' : `${imports.length} recorded`}
            </span>
          </li>
        </ul>
      </section>
    </div>
  );
}

function useReportFigures() {
  const [figures, setFigures] = useState<Array<[string, number]>>([
    ['Headcount', 0],
    ['On leave', 0],
    ['Exceptions', 0],
    ['Open tickets', 0],
  ]);
  useEffect(() => {
    fetchReportSummary()
      .then((data) => {
        setFigures([
          ['Headcount', data.headcount],
          ['On leave', data.onLeave],
          ['Exceptions', data.attendanceExceptions],
          ['Open tickets', data.openTickets],
        ]);
      })
      .catch(() => undefined);
  }, []);
  return figures;
}

export function HrWorkflowsPage() {
  const [queues, setQueues] = useState<Array<{ id: string; name: string; stuck: number; href: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    fetchWorkflowQueues()
      .then((data) => {
        setQueues(data.queues);
        setError(null);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not load queues.'));
  }, []);
  const stuck = queues.reduce((sum, item) => sum + item.stuck, 0);
  return (
    <div className="ess-section-stack">
      <Insights
        items={[
          ['Queues', queues.length],
          ['Stuck', stuck],
          ['Clear', queues.filter((item) => item.stuck === 0).length],
        ]}
      />
      {error ? <p className="ess-alert">{error}</p> : null}
      <section className="ess-panel">
        <h2>Live queues</h2>
        <ul className="ess-list">
          {queues.map((item) => (
            <li key={item.id} className="ess-list-item">
              <div className="ess-leave-request-head">
                <strong>{item.name}</strong>
                <span>{item.stuck} stuck</span>
              </div>
              <Link to={item.href} className="ess-btn ess-btn-ghost">
                Open
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function HrReportsPage() {
  const figures = useReportFigures();
  return (
    <div className="ess-section-stack">
      <Insights items={figures} />
      <section className="ess-panel">
        <h2>This month</h2>
        <ul className="ess-list">
          {figures.map(([label, value]) => (
            <li key={label} className="ess-list-item">
              <div className="ess-leave-request-head">
                <strong>{label}</strong>
                <span>{value}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
