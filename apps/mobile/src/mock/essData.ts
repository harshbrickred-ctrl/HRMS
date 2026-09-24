export type LeaveStatus = 'Pending' | 'Approved' | 'Rejected' | 'Withdrawn';
export type AttendanceStatus =
  | 'Present'
  | 'Absent'
  | 'Holiday'
  | 'Weekend'
  | 'Leave'
  | 'PendingCorrection';

export type LeaveBalance = {
  type: string;
  code: string;
  entitled: number;
  used: number;
  pending: number;
  available: number;
};

export type LeaveRequest = {
  id: string;
  type: string;
  typeCode: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: LeaveStatus;
};

export type AttendanceDay = {
  date: string;
  status: AttendanceStatus;
  checkIn?: string;
  checkOut?: string;
  note?: string;
};

export type EssDocument = {
  id: string;
  name: string;
  category: string;
  uploadedAt: string;
  sizeLabel: string;
  owner: 'mine' | 'company';
};

export type NotificationItem = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  type: 'leave' | 'attendance' | 'document' | 'general';
};

export type Person = {
  id: string;
  employeeCode: string;
  name: string;
  title: string;
  department: string;
  location: string;
  workEmail: string;
  isSelf?: boolean;
};

export type EssProfile = {
  employeeCode: string;
  firstName: string;
  lastName: string;
  title: string;
  department: string;
  location: string;
  joinDate: string;
  managerName: string;
  workEmail: string;
  workPhone: string;
  mobile: string;
};

export type EssData = {
  profile: EssProfile;
  leaveBalances: LeaveBalance[];
  leaveRequests: LeaveRequest[];
  attendance: AttendanceDay[];
  documents: EssDocument[];
  people: Person[];
  notifications: NotificationItem[];
};

export const essData: EssData = {
  profile: {
    employeeCode: 'EMP-1042',
    firstName: 'Asha',
    lastName: 'Verma',
    title: 'Software Engineer',
    department: 'Engineering',
    location: 'Bengaluru',
    joinDate: '2023-06-12',
    managerName: 'Rohit Mehta',
    workEmail: 'employee@peopleos.local',
    workPhone: '+91 80 4000 1201',
    mobile: '+91 98765 43210',
  },
  leaveBalances: [
    { type: 'Casual Leave', code: 'CL', entitled: 12, used: 3, pending: 1, available: 8 },
    { type: 'Earned Leave', code: 'EL', entitled: 18, used: 5, pending: 0, available: 13 },
    { type: 'Sick Leave', code: 'SL', entitled: 10, used: 1, pending: 0, available: 9 },
  ],
  leaveRequests: [
    {
      id: 'lr-1',
      type: 'Casual Leave',
      typeCode: 'CL',
      startDate: '2026-09-10',
      endDate: '2026-09-10',
      days: 1,
      reason: 'Personal errand',
      status: 'Approved',
    },
    {
      id: 'lr-2',
      type: 'Casual Leave',
      typeCode: 'CL',
      startDate: '2026-09-28',
      endDate: '2026-09-29',
      days: 2,
      reason: 'Family function',
      status: 'Pending',
    },
    {
      id: 'lr-3',
      type: 'Earned Leave',
      typeCode: 'EL',
      startDate: '2026-07-14',
      endDate: '2026-07-18',
      days: 5,
      reason: 'Vacation',
      status: 'Rejected',
    },
  ],
  attendance: [
    { date: '2026-09-22', status: 'Present', checkIn: '09:12', checkOut: '18:05' },
    { date: '2026-09-21', status: 'Present', checkIn: '09:05', checkOut: '18:10' },
    { date: '2026-09-20', status: 'Weekend' },
    { date: '2026-09-19', status: 'Weekend' },
    { date: '2026-09-18', status: 'Present', checkIn: '09:18', checkOut: '17:55' },
    {
      date: '2026-09-15',
      status: 'PendingCorrection',
      checkIn: '10:42',
      note: 'Late punch — correction requested',
    },
    { date: '2026-09-10', status: 'Leave', note: 'Casual leave' },
    { date: '2026-09-08', status: 'Absent' },
  ],
  documents: [
    {
      id: 'doc-1',
      name: 'Aadhaar_card.pdf',
      category: 'KYC',
      uploadedAt: '2023-06-12',
      sizeLabel: '240 KB',
      owner: 'mine',
    },
    {
      id: 'doc-2',
      name: 'Offer_letter.pdf',
      category: 'Employment',
      uploadedAt: '2023-06-01',
      sizeLabel: '420 KB',
      owner: 'mine',
    },
    {
      id: 'doc-3',
      name: 'Leave_policy_2026.pdf',
      category: 'Policy',
      uploadedAt: '2026-01-05',
      sizeLabel: '1.1 MB',
      owner: 'company',
    },
  ],
  people: [
    {
      id: 'p-001',
      employeeCode: 'EMP-1042',
      name: 'Asha Verma',
      title: 'Software Engineer',
      department: 'Engineering',
      location: 'Bengaluru',
      workEmail: 'employee@peopleos.local',
      isSelf: true,
    },
    {
      id: 'p-002',
      employeeCode: 'EMP-0881',
      name: 'Rohit Mehta',
      title: 'Engineering Manager',
      department: 'Engineering',
      location: 'Bengaluru',
      workEmail: 'manager@peopleos.local',
    },
    {
      id: 'p-003',
      employeeCode: 'EMP-1108',
      name: 'Priya Nair',
      title: 'Product Designer',
      department: 'Design',
      location: 'Bengaluru',
      workEmail: 'priya.nair@peopleos.local',
    },
    {
      id: 'p-004',
      employeeCode: 'EMP-0920',
      name: 'Kabir Shah',
      title: 'HR Executive',
      department: 'People',
      location: 'Mumbai',
      workEmail: 'hr@peopleos.local',
    },
  ],
  notifications: [
    {
      id: 'n-1',
      title: 'Leave approved',
      body: 'Your casual leave on 10 Sep was approved.',
      createdAt: '2026-09-06T11:20:00+05:30',
      read: false,
      type: 'leave',
    },
    {
      id: 'n-2',
      title: 'Correction pending',
      body: 'Attendance correction for 15 Sep is awaiting review.',
      createdAt: '2026-09-16T09:30:00+05:30',
      read: false,
      type: 'attendance',
    },
    {
      id: 'n-3',
      title: 'Policy update',
      body: 'Leave policy 2026 is available in Documents.',
      createdAt: '2026-01-05T10:00:00+05:30',
      read: true,
      type: 'document',
    },
  ],
};
