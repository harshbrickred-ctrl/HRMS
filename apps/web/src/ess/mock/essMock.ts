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
  halfDayStart: boolean;
  halfDayEnd: boolean;
  days: number;
  reason: string;
  status: LeaveStatus;
  submittedAt: string;
  decidedAt?: string;
  decisionNote?: string;
};

export type Holiday = {
  date: string;
  name: string;
};

export type AttendanceDay = {
  date: string;
  status: AttendanceStatus;
  checkIn?: string;
  checkOut?: string;
  note?: string;
};

export type CorrectionRequest = {
  id: string;
  date: string;
  requestedStatus: 'Present' | 'Absent';
  reason: string;
  status: LeaveStatus;
  submittedAt: string;
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
  href: string;
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
  workPhone: string;
  managerId?: string;
  managerName?: string;
  isSelf?: boolean;
};

export type ProfileContacts = {
  mobile: string;
  personalEmail: string;
  emergencyName: string;
  emergencyPhone: string;
  emergencyRelation: string;
};

export type EssProfile = {
  employeeCode: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  nationality: string;
  title: string;
  department: string;
  location: string;
  joinDate: string;
  employmentType: string;
  managerName: string;
  workEmail: string;
  workPhone: string;
  contacts: ProfileContacts;
};

export type EssState = {
  profile: EssProfile;
  leaveBalances: LeaveBalance[];
  leaveRequests: LeaveRequest[];
  holidays: Holiday[];
  attendance: AttendanceDay[];
  corrections: CorrectionRequest[];
  documents: EssDocument[];
  people: Person[];
  notifications: NotificationItem[];
  toast: string | null;
};

function iso(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function buildAttendanceMonth(year: number, month: number): AttendanceDay[] {
  const days: AttendanceDay[] = [];
  const last = new Date(year, month, 0).getDate();
  const holidays = new Set(['2026-09-02', '2026-10-02']);

  for (let d = 1; d <= last; d++) {
    const date = iso(year, month, d);
    const dow = new Date(year, month - 1, d).getDay();
    if (holidays.has(date)) {
      days.push({ date, status: 'Holiday', note: 'Public holiday' });
      continue;
    }
    if (dow === 0 || dow === 6) {
      days.push({ date, status: 'Weekend' });
      continue;
    }
    if (date === '2026-09-10') {
      days.push({ date, status: 'Leave', note: 'Casual leave' });
      continue;
    }
    if (date === '2026-09-15') {
      days.push({
        date,
        status: 'PendingCorrection',
        checkIn: '10:42',
        note: 'Late punch — correction requested',
      });
      continue;
    }
    if (date === '2026-09-08') {
      days.push({ date, status: 'Absent' });
      continue;
    }
    if (date <= '2026-09-22') {
      days.push({
        date,
        status: 'Present',
        checkIn: '09:12',
        checkOut: '18:05',
      });
    }
  }
  return days;
}

export const CURRENT_USER_ID = 'p-001';

export function createInitialEssState(): EssState {
  return {
    profile: {
      employeeCode: 'EMP-1042',
      firstName: 'Asha',
      lastName: 'Verma',
      dateOfBirth: '1994-03-18',
      gender: 'Female',
      nationality: 'Indian',
      title: 'Software Engineer',
      department: 'Engineering',
      location: 'Bengaluru',
      joinDate: '2023-06-12',
      employmentType: 'Full-time',
      managerName: 'Rohit Mehta',
      workEmail: 'employee@peopleos.local',
      workPhone: '+91 80 4000 1201',
      contacts: {
        mobile: '+91 98765 43210',
        personalEmail: 'asha.verma@mail.test',
        emergencyName: 'Rajesh Verma',
        emergencyPhone: '+91 98765 00011',
        emergencyRelation: 'Father',
      },
    },
    leaveBalances: [
      {
        type: 'Casual Leave',
        code: 'CL',
        entitled: 12,
        used: 3,
        pending: 1,
        available: 8,
      },
      {
        type: 'Earned Leave',
        code: 'EL',
        entitled: 18,
        used: 5,
        pending: 0,
        available: 13,
      },
      {
        type: 'Sick Leave',
        code: 'SL',
        entitled: 10,
        used: 1,
        pending: 0,
        available: 9,
      },
    ],
    leaveRequests: [
      {
        id: 'lr-1',
        type: 'Casual Leave',
        typeCode: 'CL',
        startDate: '2026-09-10',
        endDate: '2026-09-10',
        halfDayStart: false,
        halfDayEnd: false,
        days: 1,
        reason: 'Personal errand',
        status: 'Approved',
        submittedAt: '2026-09-05T09:00:00+05:30',
        decidedAt: '2026-09-06T11:20:00+05:30',
      },
      {
        id: 'lr-2',
        type: 'Casual Leave',
        typeCode: 'CL',
        startDate: '2026-09-28',
        endDate: '2026-09-29',
        halfDayStart: false,
        halfDayEnd: false,
        days: 2,
        reason: 'Family function',
        status: 'Pending',
        submittedAt: '2026-09-18T14:30:00+05:30',
      },
      {
        id: 'lr-3',
        type: 'Sick Leave',
        typeCode: 'SL',
        startDate: '2026-08-04',
        endDate: '2026-08-04',
        halfDayStart: true,
        halfDayEnd: false,
        days: 0.5,
        reason: 'Fever',
        status: 'Approved',
        submittedAt: '2026-08-04T08:10:00+05:30',
        decidedAt: '2026-08-04T10:00:00+05:30',
      },
      {
        id: 'lr-4',
        type: 'Earned Leave',
        typeCode: 'EL',
        startDate: '2026-07-14',
        endDate: '2026-07-18',
        halfDayStart: false,
        halfDayEnd: false,
        days: 5,
        reason: 'Vacation',
        status: 'Rejected',
        submittedAt: '2026-07-01T12:00:00+05:30',
        decidedAt: '2026-07-02T16:45:00+05:30',
        decisionNote: 'Team delivery week — please replan',
      },
    ],
    holidays: [
      { date: '2026-01-26', name: 'Republic Day' },
      { date: '2026-03-14', name: 'Holi' },
      { date: '2026-08-15', name: 'Independence Day' },
      { date: '2026-09-02', name: 'Ganesh Chaturthi' },
      { date: '2026-10-02', name: 'Gandhi Jayanti' },
      { date: '2026-10-20', name: 'Dussehra' },
      { date: '2026-11-08', name: 'Diwali' },
      { date: '2026-12-25', name: 'Christmas' },
    ],
    attendance: buildAttendanceMonth(2026, 9),
    corrections: [
      {
        id: 'cr-1',
        date: '2026-09-15',
        requestedStatus: 'Present',
        reason: 'Forgot to punch in — was in office from 09:05',
        status: 'Pending',
        submittedAt: '2026-09-16T09:30:00+05:30',
      },
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
        name: 'PAN_card.pdf',
        category: 'KYC',
        uploadedAt: '2023-06-12',
        sizeLabel: '180 KB',
        owner: 'mine',
      },
      {
        id: 'doc-3',
        name: 'Offer_letter.pdf',
        category: 'Employment',
        uploadedAt: '2023-06-01',
        sizeLabel: '420 KB',
        owner: 'mine',
      },
      {
        id: 'doc-4',
        name: 'Leave_policy_2026.pdf',
        category: 'Policy',
        uploadedAt: '2026-01-05',
        sizeLabel: '1.1 MB',
        owner: 'company',
      },
      {
        id: 'doc-5',
        name: 'Code_of_conduct.pdf',
        category: 'Policy',
        uploadedAt: '2025-04-01',
        sizeLabel: '890 KB',
        owner: 'company',
      },
      {
        id: 'doc-6',
        name: 'IT_acceptable_use.pdf',
        category: 'Policy',
        uploadedAt: '2025-09-15',
        sizeLabel: '540 KB',
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
        workPhone: '+91 80 4000 1201',
        managerId: 'p-002',
        managerName: 'Rohit Mehta',
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
        workPhone: '+91 80 4000 1100',
        managerId: 'p-010',
        managerName: 'Priya Nair',
      },
      {
        id: 'p-003',
        employeeCode: 'EMP-1105',
        name: 'Kabir Singh',
        title: 'Frontend Engineer',
        department: 'Engineering',
        location: 'Bengaluru',
        workEmail: 'kabir.singh@peopleos.local',
        workPhone: '+91 80 4000 1202',
        managerId: 'p-002',
        managerName: 'Rohit Mehta',
      },
      {
        id: 'p-004',
        employeeCode: 'EMP-1120',
        name: 'Meera Iyer',
        title: 'Backend Engineer',
        department: 'Engineering',
        location: 'Hyderabad',
        workEmail: 'meera.iyer@peopleos.local',
        workPhone: '+91 40 4000 1301',
        managerId: 'p-002',
        managerName: 'Rohit Mehta',
      },
      {
        id: 'p-005',
        employeeCode: 'EMP-0912',
        name: 'Ananya Desai',
        title: 'HR Executive',
        department: 'Human Resources',
        location: 'Mumbai',
        workEmail: 'hr@peopleos.local',
        workPhone: '+91 22 4000 1400',
        managerId: 'p-006',
        managerName: 'Suresh Pillai',
      },
      {
        id: 'p-006',
        employeeCode: 'EMP-0701',
        name: 'Suresh Pillai',
        title: 'HR Head',
        department: 'Human Resources',
        location: 'Mumbai',
        workEmail: 'suresh.pillai@peopleos.local',
        workPhone: '+91 22 4000 1401',
        managerId: 'p-010',
        managerName: 'Priya Nair',
      },
      {
        id: 'p-007',
        employeeCode: 'EMP-0955',
        name: 'Neha Kapoor',
        title: 'Product Designer',
        department: 'Product',
        location: 'Bengaluru',
        workEmail: 'neha.kapoor@peopleos.local',
        workPhone: '+91 80 4000 1501',
        managerId: 'p-008',
        managerName: 'Vikram Rao',
      },
      {
        id: 'p-008',
        employeeCode: 'EMP-0820',
        name: 'Vikram Rao',
        title: 'Product Manager',
        department: 'Product',
        location: 'Bengaluru',
        workEmail: 'vikram.rao@peopleos.local',
        workPhone: '+91 80 4000 1500',
        managerId: 'p-010',
        managerName: 'Priya Nair',
      },
      {
        id: 'p-009',
        employeeCode: 'EMP-1011',
        name: 'Arjun Patel',
        title: 'QA Engineer',
        department: 'Engineering',
        location: 'Pune',
        workEmail: 'arjun.patel@peopleos.local',
        workPhone: '+91 20 4000 1601',
        managerId: 'p-002',
        managerName: 'Rohit Mehta',
      },
      {
        id: 'p-010',
        employeeCode: 'EMP-0500',
        name: 'Priya Nair',
        title: 'Director of Operations',
        department: 'Leadership',
        location: 'Bengaluru',
        workEmail: 'priya.nair@peopleos.local',
        workPhone: '+91 80 4000 1000',
      },
      {
        id: 'p-011',
        employeeCode: 'EMP-1066',
        name: 'Fatima Sheikh',
        title: 'Finance Analyst',
        department: 'Finance',
        location: 'Mumbai',
        workEmail: 'fatima.sheikh@peopleos.local',
        workPhone: '+91 22 4000 1701',
        managerId: 'p-012',
        managerName: 'Dev Sharma',
      },
      {
        id: 'p-012',
        employeeCode: 'EMP-0788',
        name: 'Dev Sharma',
        title: 'Finance Manager',
        department: 'Finance',
        location: 'Mumbai',
        workEmail: 'dev.sharma@peopleos.local',
        workPhone: '+91 22 4000 1700',
        managerId: 'p-010',
        managerName: 'Priya Nair',
      },
    ],
    notifications: [
      {
        id: 'n-1',
        title: 'Leave approved',
        body: 'Your casual leave on 10 Sep 2026 was approved by Rohit Mehta.',
        createdAt: '2026-09-06T11:20:00+05:30',
        read: true,
        href: '/ess/leave',
        type: 'leave',
      },
      {
        id: 'n-2',
        title: 'Leave pending review',
        body: 'Your leave for 28–29 Sep is waiting for manager approval.',
        createdAt: '2026-09-18T14:31:00+05:30',
        read: false,
        href: '/ess/leave',
        type: 'leave',
      },
      {
        id: 'n-3',
        title: 'Attendance correction submitted',
        body: 'Correction for 15 Sep is pending review.',
        createdAt: '2026-09-16T09:31:00+05:30',
        read: false,
        href: '/ess/attendance',
        type: 'attendance',
      },
      {
        id: 'n-4',
        title: 'Policy updated',
        body: 'Leave policy 2026 is available in Documents.',
        createdAt: '2026-01-05T10:00:00+05:30',
        read: true,
        href: '/ess/documents',
        type: 'document',
      },
      {
        id: 'n-5',
        title: 'Welcome to PeopleOS',
        body: 'Complete your profile contacts and upload remaining KYC docs.',
        createdAt: '2023-06-12T09:00:00+05:30',
        read: true,
        href: '/ess/profile',
        type: 'general',
      },
    ],
    toast: null,
  };
}

function localIso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function workingDaysBetween(
  start: string,
  end: string,
  holidays: Holiday[],
  halfDayStart: boolean,
  halfDayEnd: boolean,
): number {
  const holidaySet = new Set(holidays.map((h) => h.date));
  const startDt = new Date(start + 'T12:00:00');
  const endDt = new Date(end + 'T12:00:00');
  if (endDt < startDt) return 0;

  let days = 0;
  const cursor = new Date(startDt);
  while (cursor <= endDt) {
    const isoDate = localIso(cursor);
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6 && !holidaySet.has(isoDate)) {
      days += 1;
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  if (days === 0) return 0;
  if (start === end && (halfDayStart || halfDayEnd)) return 0.5;
  let result = days;
  if (halfDayStart) result -= 0.5;
  if (halfDayEnd && start !== end) result -= 0.5;
  return Math.max(result, 0.5);
}
