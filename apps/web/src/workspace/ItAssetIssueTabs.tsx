import { NavLink } from 'react-router-dom';

const TABS = [
  { to: '/it/allocate', label: 'Issue' },
  { to: '/it/return', label: 'Return' },
  { to: '/it/transfer', label: 'Transfer' },
  { to: '/it/employee-assets', label: 'Employee assets' },
];

/** The pages behind "Issue and return" in the sidebar. */
export function ItAssetIssueTabs() {
  return (
    <nav className="ess-tabs" aria-label="Issue and return">
      {TABS.map((tab) => (
        <NavLink key={tab.to} to={tab.to} className={({ isActive }) => `ess-tab${isActive ? ' is-active' : ''}`}>
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
