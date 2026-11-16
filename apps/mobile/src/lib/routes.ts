import type { Href } from 'expo-router';

const EXACT: Record<string, Href> = {
  '/ess': '/(tabs)',
  '/ess/leave': '/(tabs)/leave',
  '/ess/attendance': '/(tabs)/attendance',
  '/ess/people': '/(tabs)/people',
  '/team': '/team',
  '/ess/team': '/team',
  '/documents': '/documents',
  '/ess/documents': '/documents',
  '/profile': '/profile',
  '/permissions': '/permissions',
  '/ess/profile': '/profile',
  '/salary': '/salary',
  '/ess/salary': '/salary',
  '/notifications': '/notifications',
  '/ess/notifications': '/notifications',
  '/settings': '/settings',
  '/ess/settings': '/settings',
  '/helpdesk': '/helpdesk',
  '/ess/helpdesk': '/helpdesk',
  '/manager': '/manager',
  '/manager/inbox': '/manager/inbox',
  '/manager/team-leave': '/manager/team-leave',
  '/manager/team-attendance': '/manager/team-attendance',
  '/manager/directory': '/manager/directory',
  '/hr': '/hr',
  '/hr/employees': '/hr/employees',
  '/hr/organization': '/hr/organization',
  '/hr/leave': '/hr/leave',
  '/hr/attendance': '/hr/attendance',
  '/hr/documents': '/hr/documents',
  '/hr/workflows': '/hr/workflows',
  '/hr/reports': '/hr/reports',
  '/hr/migration': '/hr/migration',
  '/admin': '/admin',
  '/admin/employees': '/admin/employees',
  '/admin/leave': '/admin/leave',
  '/admin/roles': '/admin/roles',
  '/admin/audit': '/admin/audit',
  '/admin/notifications': '/admin/notifications',
  '/admin/settings': '/admin/settings',
  '/admin/jobs': '/admin/jobs',
  '/exec': '/exec',
  '/exec/reports': '/exec/reports',
  '/it/assets': '/it/assets',
  '/it/tickets': '/it/tickets',
};

export function hrefToRoute(href: string): Href {
  if (href.startsWith('/ess/people/')) {
    return `/people/${href.slice('/ess/people/'.length)}` as Href;
  }
  return EXACT[href] ?? '/(tabs)';
}
