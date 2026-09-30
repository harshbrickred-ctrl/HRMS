import type { LucideIcon } from 'lucide-react';
import {
  ArrowLeftRight,
  Bell,
  Briefcase,
  Building2,
  CalendarDays,
  ClipboardList,
  Clock,
  FileText,
  FolderOpen,
  Headset,
  GitBranch,
  Home,
  IndianRupee,
  Inbox,
  LayoutDashboard,
  ScrollText,
  Settings,
  Shield,
  User,
  UserCog,
  Users,
  UsersRound,
  BarChart3,
  Smartphone,
} from 'lucide-react';
import type { NavIconId } from './appNav';

export const NAV_ICONS: Record<NavIconId, LucideIcon> = {
  home: Home,
  leave: CalendarDays,
  attendance: Clock,
  people: Users,
  myTeam: UsersRound,
  documents: FileText,
  profile: User,
  salary: IndianRupee,
  notifications: Bell,
  helpdesk: Headset,
  overview: LayoutDashboard,
  inbox: Inbox,
  teamLeave: CalendarDays,
  teamAttendance: Clock,
  teamDirectory: Users,
  employees: Users,
  organization: Building2,
  leaveAdmin: ClipboardList,
  attendanceAdmin: Clock,
  hrDocuments: FolderOpen,
  workflows: GitBranch,
  reports: BarChart3,
  migration: ArrowLeftRight,
  roles: UserCog,
  audit: ScrollText,
  adminNotifications: Bell,
  settings: Settings,
  jobs: Briefcase,
  leadership: Shield,
  leadershipReports: BarChart3,
  mobile: Smartphone,
};

type NavIconProps = {
  id: NavIconId;
  size?: number;
  className?: string;
  strokeWidth?: number;
};

export function NavIcon({
  id,
  size = 18,
  className,
  strokeWidth = 2,
}: NavIconProps) {
  const Icon = NAV_ICONS[id];
  return (
    <Icon
      size={size}
      className={className}
      strokeWidth={strokeWidth}
      aria-hidden
    />
  );
}
