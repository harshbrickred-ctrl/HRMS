export type LeaveStatus = 'Pending' | 'Approved' | 'Rejected' | 'Withdrawn';
export type AttendanceStatus =
  | 'Present'
  | 'Absent'
  | 'Holiday'
  | 'Weekend'
  | 'Leave'
  | 'PendingCorrection'
  | 'HalfDay'
  | 'MissingPunch';

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
  approverName?: string;
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
  approverName?: string;
};

export type EssDocument = {
  id: string;
  name: string;
  category: string;
  uploadedAt: string;
  sizeLabel: string;
  owner: 'mine' | 'company';
  remote?: boolean;
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

export type Department = {
  id: string;
  name: string;
};

export type Team = {
  id: string;
  name: string;
  departmentId: string;
  managerId: string;
};

export type Person = {
  id: string;
  photo: string;
  employeeCode: string;
  organizationId: string;
  name: string;
  title: string;
  department: string;
  location: string;
  workEmail: string;
  workPhone: string;
  teamId?: string;
  managerId?: string;
  managerName?: string;
  isSelf?: boolean;
};

export const departments: Department[] = [
  { id: 'd-eng', name: 'Engineering' },
  { id: 'd-product', name: 'Product' },
  { id: 'd-hr', name: 'Human Resources' },
  { id: 'd-fin', name: 'Finance' },
  { id: 'd-lead', name: 'Leadership' },
];

export const teams: Team[] = [
  { id: 't-platform', name: 'Platform', departmentId: 'd-eng', managerId: 'p-002' },
  { id: 't-quality', name: 'Quality', departmentId: 'd-eng', managerId: 'p-004' },
  { id: 't-design', name: 'Design', departmentId: 'd-product', managerId: 'p-008' },
  { id: 't-people', name: 'People', departmentId: 'd-hr', managerId: 'p-006' },
  { id: 't-accounts', name: 'Accounts', departmentId: 'd-fin', managerId: 'p-012' },
];

export type ProfileContacts = {
  mobile: string;
  personalEmail: string;
  emergencyName: string;
  emergencyPhone: string;
  emergencyRelation: string;
};

export type ProfileAddress = {
  lines: string;
  name: string;
  email: string;
  phone1: string;
  phone2: string;
  mobile: string;
  extension: string;
  fax: string;
};

export type ProfileStatutoryId = {
  label: string;
  value: string;
  unverified: boolean;
};

export type ProfileFamilyMember = {
  relation: string;
  name: string;
  dateOfBirth: string;
  bloodGroup: string;
  gender: string;
  nationality: string;
};

export type EssProfile = {
  photo: string;
  employeeCode: string;
  organizationId: string;
  teamName: string;
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
  extension: string;
  bloodGroup: string;
  maritalStatus: string;
  marriageDate: string;
  spouse: string;
  placeOfBirth: string;
  residentialStatus: string;
  fatherName: string;
  religion: string;
  physicallyChallenged: string;
  internationalEmployee: string;
  height: string;
  weight: string;
  identificationMark: string;
  address: ProfileAddress;
  education: string[];
  bankName: string;
  bankAccountNumber: string;
  bankBranch: string;
  pfAccount: string;
  statutoryIds: ProfileStatutoryId[];
  family: ProfileFamilyMember[];
  costCenter: string;
  division: string;
  grade: string;
  shift: string;
  webLogin: string;
  previousPositions: string[];
  accessCardNo: string;
  accessCardValidity: string;
  previousAssets: string[];
};

export type SalaryLine = {
  label: string;
  amount: number;
};

export type Payslip = {
  id: string;
  month: string;
  label: string;
  earnings: SalaryLine[];
  deductions: SalaryLine[];
};

export type HelpTicket = {
  id: string;
  subject: string;
  category: string;
  status: 'Open' | 'In progress' | 'Resolved';
  createdAt: string;
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
  payslips: Payslip[];
  notifications: NotificationItem[];
  tickets: HelpTicket[];
  toast: string | null;
};

function iso(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

const SEPTEMBER_PUNCHES: Record<string, { checkIn: string; checkOut?: string }> = {
  '2026-09-01': { checkIn: '08:54', checkOut: '18:06' },
  '2026-09-03': { checkIn: '09:22', checkOut: '18:11' },
  '2026-09-04': { checkIn: '09:06' },
  '2026-09-07': { checkIn: '08:58', checkOut: '17:36' },
  '2026-09-09': { checkIn: '09:04', checkOut: '18:18' },
  '2026-09-11': { checkIn: '09:31', checkOut: '18:02' },
  '2026-09-14': { checkIn: '08:49', checkOut: '18:09' },
  '2026-09-16': { checkIn: '09:11', checkOut: '16:48' },
  '2026-09-17': { checkIn: '09:01', checkOut: '18:04' },
  '2026-09-18': { checkIn: '08:57', checkOut: '18:22' },
  '2026-09-21': { checkIn: '09:18', checkOut: '18:07' },
  '2026-09-22': { checkIn: '09:03', checkOut: '18:01' },
  '2026-09-23': { checkIn: '10:05', checkOut: '18:40' },
  '2026-09-24': { checkIn: '08:52', checkOut: '17:12' },
  '2026-09-25': { checkIn: '09:08', checkOut: '18:15' },
  '2026-09-28': { checkIn: '09:00', checkOut: '18:00' },
};

function buildAttendanceMonth(year: number, month: number): AttendanceDay[] {
  const days: AttendanceDay[] = [];
  const last = new Date(year, month, 0).getDate();
  const holidays = new Set(['2026-09-02', '2026-10-02']);

  for (let d = 1; d <= last; d++) {
    const date = iso(year, month, d);
    const dow = new Date(year, month - 1, d).getDay();
    if (holidays.has(date)) {
      days.push({ date, status: 'Holiday', note: 'Ganesh Chaturthi' });
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
      days.push({ date, status: 'Absent', note: 'No punches recorded' });
      continue;
    }
    const punch = SEPTEMBER_PUNCHES[date];
    if (punch) {
      days.push({ date, status: 'Present', ...punch });
    }
  }
  return days;
}

export function buildLightAttendanceMonth(
  year: number,
  month: number,
  holidays: Holiday[],
): AttendanceDay[] {
  const holidayByDate = new Map(holidays.map((holiday) => [holiday.date, holiday.name]));
  const days: AttendanceDay[] = [];
  const last = new Date(year, month, 0).getDate();

  for (let d = 1; d <= last; d++) {
    const date = iso(year, month, d);
    const dow = new Date(year, month - 1, d).getDay();
    const holiday = holidayByDate.get(date);
    if (holiday) {
      days.push({ date, status: 'Holiday', note: holiday });
      continue;
    }
    if (dow === 0 || dow === 6) {
      days.push({ date, status: 'Weekend' });
    }
  }
  return days;
}

export const ORGANIZATION = {
  name: 'Brickred Systems',
  code: 'BR',
} as const;

export const CURRENT_USER_ID = 'p-001';

export function createInitialEssState(): EssState {
  return {
    profile: {
      photo: '/employees/harsh-yadav.png',
      employeeCode: 'BR266',
      organizationId: ORGANIZATION.code,
      teamName: 'Platform',
      firstName: 'Harsh',
      lastName: 'Yadav',
      dateOfBirth: 'XX XXX 2003',
      gender: '',
      nationality: '',
      title: 'Analyst - Development',
      department: 'Engineering',
      location: 'Noida',
      joinDate: '',
      employmentType: '',
      managerName: 'Rohit Mehta',
      workEmail: 'harsh.yadav@brickredsys.in',
      workPhone: 'XXXXXX9587',
      contacts: {
        mobile: 'XXXXXX9587',
        personalEmail: '',
        emergencyName: 'Harsh Yadav',
        emergencyPhone: '',
        emergencyRelation: 'Father',
      },
      extension: '',
      bloodGroup: '',
      maritalStatus: 'XXXXXXXXX',
      marriageDate: '',
      spouse: '',
      placeOfBirth: '',
      residentialStatus: '',
      fatherName: 'Harsh Yadav',
      religion: '',
      physicallyChallenged: 'No',
      internationalEmployee: 'No',
      height: '',
      weight: '',
      identificationMark: '',
      address: {
        lines:
          'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
        name: 'Harsh Yadav',
        email: '',
        phone1: 'XXXXXXX9587',
        phone2: '',
        mobile: '',
        extension: '',
        fax: '',
      },
      education: [],
      bankName: 'Kotak Mahindra Bank',
      bankAccountNumber: 'XXXXXX8032',
      bankBranch: '',
      pfAccount: 'Not covered under PF',
      statutoryIds: [
        { label: 'AADHAAR', value: '************', unverified: true },
        {
          label: 'Bank Details for Identification',
          value: 'XXXXXX8032',
          unverified: true,
        },
        { label: 'Permanent Account Number', value: 'XXXXXX557P', unverified: true },
      ],
      family: [
        {
          relation: 'Father',
          name: 'Harsh Yadav',
          dateOfBirth: '',
          bloodGroup: '',
          gender: '',
          nationality: '',
        },
      ],
      costCenter: 'NA',
      division: 'NA',
      grade: 'A2',
      shift: 'General Shift',
      webLogin: 'No',
      previousPositions: [],
      accessCardNo: '266',
      accessCardValidity: 'Jul 2025 – ongoing',
      previousAssets: [],
    },
    leaveBalances: [
      {
        type: 'Loss of Pay',
        code: 'LOP',
        entitled: 0,
        used: 0,
        pending: 0,
        available: 0,
      },
      {
        type: 'Comp-off',
        code: 'CO',
        entitled: 2,
        used: 0,
        pending: 0,
        available: 2,
      },
      {
        type: 'Casual Leave',
        code: 'CL',
        entitled: 12,
        used: 3,
        pending: 1,
        available: 8,
      },
      {
        type: 'Earned Leave or Planned Leave',
        code: 'EL',
        entitled: 18,
        used: 5,
        pending: 0,
        available: 13,
      },
      {
        type: 'Work From Home',
        code: 'WFH',
        entitled: 12,
        used: 2,
        pending: 0,
        available: 10,
      },
      {
        type: 'Optional - Birth Holiday',
        code: 'OBH',
        entitled: 1,
        used: 0,
        pending: 0,
        available: 1,
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
        approverName: 'Rohit Mehta',
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
        type: 'Earned Leave or Planned Leave',
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
      {
        id: 'lr-5',
        type: 'Comp-off',
        typeCode: 'CO',
        startDate: '2026-06-19',
        endDate: '2026-06-19',
        halfDayStart: false,
        halfDayEnd: false,
        days: 1,
        reason: 'Worked the release weekend',
        status: 'Approved',
        submittedAt: '2026-06-16T10:00:00+05:30',
        decidedAt: '2026-06-17T09:30:00+05:30',
      },
      {
        id: 'lr-6',
        type: 'Work From Home',
        typeCode: 'WFH',
        startDate: '2026-09-30',
        endDate: '2026-09-30',
        halfDayStart: false,
        halfDayEnd: false,
        days: 1,
        reason: 'Home repair appointment',
        status: 'Pending',
        submittedAt: '2026-09-22T11:15:00+05:30',
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
        approverName: 'Rohit Mehta',
      },
    ],
    documents: [
      {
        id: 'doc-br-1',
        name: 'BR offer letter Acceptance',
        category: 'Brickred Documents',
        uploadedAt: '2025-11-26',
        sizeLabel: '180 KB',
        owner: 'mine',
      },
      {
        id: 'doc-br-2',
        name: 'NDA Acceptance',
        category: 'Brickred Documents',
        uploadedAt: '2025-11-26',
        sizeLabel: '96 KB',
        owner: 'mine',
      },
      {
        id: 'doc-br-3',
        name: 'BR Letter of Appointment Acceptance',
        category: 'Brickred Documents',
        uploadedAt: '2025-11-26',
        sizeLabel: '210 KB',
        owner: 'mine',
      },
      {
        id: 'doc-br-4',
        name: 'BR Joining Report & Confidential Agreement',
        category: 'Brickred Documents',
        uploadedAt: '2025-11-26',
        sizeLabel: '240 KB',
        owner: 'mine',
      },
      {
        id: 'doc-edu-1',
        name: '12th Pass Certificate',
        category: 'Educational Certificates',
        uploadedAt: '2025-11-26',
        sizeLabel: '320 KB',
        owner: 'mine',
      },
      {
        id: 'doc-edu-2',
        name: '12th Marksheet',
        category: 'Educational Certificates',
        uploadedAt: '2025-11-26',
        sizeLabel: '280 KB',
        owner: 'mine',
      },
      {
        id: 'doc-emp-1',
        name: 'Voter ID',
        category: 'Employee Documents',
        uploadedAt: '2025-11-26',
        sizeLabel: '140 KB',
        owner: 'mine',
      },
      {
        id: 'doc-emp-2',
        name: '10th Pass Certificate',
        category: 'Employee Documents',
        uploadedAt: '2025-11-26',
        sizeLabel: '300 KB',
        owner: 'mine',
      },
      {
        id: 'doc-emp-3',
        name: 'Bank Passbook',
        category: 'Employee Documents',
        uploadedAt: '2025-11-26',
        sizeLabel: '260 KB',
        owner: 'mine',
      },
      {
        id: 'doc-emp-4',
        name: 'passport pic',
        category: 'Employee Documents',
        uploadedAt: '2025-11-26',
        sizeLabel: '85 KB',
        owner: 'mine',
      },
      {
        id: 'doc-emp-5',
        name: 'PAN',
        category: 'Employee Documents',
        uploadedAt: '2025-11-26',
        sizeLabel: '120 KB',
        owner: 'mine',
      },
      {
        id: 'doc-emp-6',
        name: 'Aadhar Card',
        category: 'Employee Documents',
        uploadedAt: '2025-11-26',
        sizeLabel: '160 KB',
        owner: 'mine',
      },
      {
        id: 'doc-past-1',
        name: 'Pay Slip Mar-May',
        category: 'Past Employment Documents',
        uploadedAt: '2025-11-26',
        sizeLabel: '90 KB',
        owner: 'mine',
      },
      {
        id: 'doc-past-2',
        name: 'Resignation Acceptance Redlinux Technologies',
        category: 'Past Employment Documents',
        uploadedAt: '2025-11-26',
        sizeLabel: '150 KB',
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
        photo: '/employees/harsh-yadav.png',
        employeeCode: 'BR266',
        organizationId: ORGANIZATION.code,
        name: 'Harsh Yadav',
        title: 'Analyst - Development',
        department: 'Engineering',
        location: 'Noida',
        workEmail: 'harsh.yadav@brickredsys.in',
        workPhone: 'XXXXXX9587',
        teamId: 't-platform',
        managerId: 'p-002',
        managerName: 'Rohit Mehta',
        isSelf: true,
      },
      {
        id: 'p-002',
        photo: '/employees/rohit-mehta.png',
        employeeCode: 'BR123',
        organizationId: ORGANIZATION.code,
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
        photo: '/employees/kabir-singh.png',
        employeeCode: 'BR221',
        organizationId: ORGANIZATION.code,
        name: 'Kabir Singh',
        title: 'Frontend Engineer',
        department: 'Engineering',
        location: 'Bengaluru',
        workEmail: 'kabir.singh@peopleos.local',
        workPhone: '+91 80 4000 1202',
        teamId: 't-platform',
        managerId: 'p-002',
        managerName: 'Rohit Mehta',
      },
      {
        id: 'p-004',
        photo: '/employees/meera-iyer.png',
        employeeCode: 'BR318',
        organizationId: ORGANIZATION.code,
        name: 'Meera Iyer',
        title: 'Backend Engineer',
        department: 'Engineering',
        location: 'Hyderabad',
        workEmail: 'meera.iyer@peopleos.local',
        workPhone: '+91 40 4000 1301',
        teamId: 't-platform',
        managerId: 'p-002',
        managerName: 'Rohit Mehta',
      },
      {
        id: 'p-005',
        photo: '/employees/ananya-desai.png',
        employeeCode: 'BR156',
        organizationId: ORGANIZATION.code,
        name: 'Ananya Desai',
        title: 'HR Executive',
        department: 'Human Resources',
        location: 'Mumbai',
        workEmail: 'hr@peopleos.local',
        workPhone: '+91 22 4000 1400',
        teamId: 't-people',
        managerId: 'p-006',
        managerName: 'Suresh Pillai',
      },
      {
        id: 'p-006',
        photo: '/employees/suresh-pillai.png',
        employeeCode: 'BR077',
        organizationId: ORGANIZATION.code,
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
        photo: '/employees/neha-kapoor.png',
        employeeCode: 'BR390',
        organizationId: ORGANIZATION.code,
        name: 'Neha Kapoor',
        title: 'Product Designer',
        department: 'Product',
        location: 'Bengaluru',
        workEmail: 'neha.kapoor@peopleos.local',
        workPhone: '+91 80 4000 1501',
        teamId: 't-design',
        managerId: 'p-008',
        managerName: 'Vikram Rao',
      },
      {
        id: 'p-008',
        photo: '/employees/vikram-rao.png',
        employeeCode: 'BR205',
        organizationId: ORGANIZATION.code,
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
        photo: '/employees/arjun-patel.png',
        employeeCode: 'BR442',
        organizationId: ORGANIZATION.code,
        name: 'Arjun Patel',
        title: 'QA Engineer',
        department: 'Engineering',
        location: 'Pune',
        workEmail: 'arjun.patel@peopleos.local',
        workPhone: '+91 20 4000 1601',
        teamId: 't-quality',
        managerId: 'p-004',
        managerName: 'Meera Iyer',
      },
      {
        id: 'p-010',
        photo: '/employees/priya-nair.png',
        employeeCode: 'BR014',
        organizationId: ORGANIZATION.code,
        name: 'Priya Nair',
        title: 'Director of Operations',
        department: 'Leadership',
        location: 'Bengaluru',
        workEmail: 'priya.nair@peopleos.local',
        workPhone: '+91 80 4000 1000',
      },
      {
        id: 'p-011',
        photo: '/employees/fatima-sheikh.png',
        employeeCode: 'BR268',
        organizationId: ORGANIZATION.code,
        name: 'Fatima Sheikh',
        title: 'Finance Analyst',
        department: 'Finance',
        location: 'Mumbai',
        workEmail: 'fatima.sheikh@peopleos.local',
        workPhone: '+91 22 4000 1701',
        teamId: 't-accounts',
        managerId: 'p-012',
        managerName: 'Dev Sharma',
      },
      {
        id: 'p-012',
        photo: '/employees/dev-sharma.png',
        employeeCode: 'BR133',
        organizationId: ORGANIZATION.code,
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
    tickets: [
      {
        id: 't-1',
        subject: 'Payslip for July not visible',
        category: 'Payroll',
        status: 'In progress',
        createdAt: '2026-09-12',
      },
    ],
    payslips: [
      {
        id: 'ps-2026-08',
        month: '2026-08',
        label: 'August 2026',
        earnings: [
          { label: 'Basic', amount: 10000 },
          { label: 'HRA', amount: 2500 },
          { label: 'Special allowance', amount: 1500 },
        ],
        deductions: [
          { label: 'Professional tax', amount: 100 },
          { label: 'Income tax', amount: 400 },
        ],
      },
      {
        id: 'ps-2026-07',
        month: '2026-07',
        label: 'July 2026',
        earnings: [
          { label: 'Basic', amount: 10000 },
          { label: 'HRA', amount: 2500 },
          { label: 'Special allowance', amount: 1200 },
        ],
        deductions: [
          { label: 'Professional tax', amount: 100 },
          { label: 'Income tax', amount: 350 },
        ],
      },
      {
        id: 'ps-2026-06',
        month: '2026-06',
        label: 'June 2026',
        earnings: [
          { label: 'Basic', amount: 10000 },
          { label: 'HRA', amount: 2500 },
          { label: 'Special allowance', amount: 1000 },
        ],
        deductions: [
          { label: 'Professional tax', amount: 100 },
          { label: 'Income tax', amount: 300 },
        ],
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

const LOGIN_PHOTOS: Record<string, string> = {
  'employee@peopleos.local': '/employees/harsh-yadav.png',
  'manager@peopleos.local': '/employees/rohit-mehta.png',
  'hr@peopleos.local': '/employees/ananya-desai.png',
};

const LOGIN_PERSON: Record<string, string> = {
  'employee@peopleos.local': 'p-001',
  'manager@peopleos.local': 'p-002',
  'hr@peopleos.local': 'p-005',
};

export function photoForEmail(email: string | undefined) {
  if (!email) return undefined;
  return LOGIN_PHOTOS[email.trim().toLowerCase()];
}

export function personForLogin(email: string | undefined, people: Person[]) {
  const id = email ? LOGIN_PERSON[email.trim().toLowerCase()] : undefined;
  if (id) return people.find((person) => person.id === id);
  return people.find((person) => person.isSelf);
}

export function teamLedBy(personId: string) {
  return teams.find((team) => team.managerId === personId);
}

export function teamOf(person: Person) {
  return teamLedBy(person.id) ?? teams.find((team) => team.id === person.teamId);
}

const EMPTY_CONTACTS: ProfileContacts = {
  mobile: '',
  personalEmail: '',
  emergencyName: '',
  emergencyPhone: '',
  emergencyRelation: '',
};

const EMPTY_ADDRESS: ProfileAddress = {
  lines: '',
  name: '',
  email: '',
  phone1: '',
  phone2: '',
  mobile: '',
  extension: '',
  fax: '',
};

export function profileForPerson(person: Person, richProfile: EssProfile): EssProfile {
  if (person.id === CURRENT_USER_ID || person.isSelf) return richProfile;

  const [firstName, ...rest] = person.name.trim().split(/\s+/);
  const team = teamOf(person);
  return {
    photo: person.photo,
    employeeCode: person.employeeCode,
    organizationId: person.organizationId,
    teamName: team?.name ?? '',
    firstName: firstName ?? '',
    lastName: rest.join(' '),
    dateOfBirth: '',
    gender: '',
    nationality: '',
    title: person.title,
    department: person.department,
    location: person.location,
    joinDate: '',
    employmentType: '',
    managerName: person.managerName ?? '',
    workEmail: person.workEmail,
    workPhone: person.workPhone,
    contacts: EMPTY_CONTACTS,
    extension: '',
    bloodGroup: '',
    maritalStatus: '',
    marriageDate: '',
    spouse: '',
    placeOfBirth: '',
    residentialStatus: '',
    fatherName: '',
    religion: '',
    physicallyChallenged: '',
    internationalEmployee: '',
    height: '',
    weight: '',
    identificationMark: '',
    address: EMPTY_ADDRESS,
    education: [],
    bankName: '',
    bankAccountNumber: '',
    bankBranch: '',
    pfAccount: '',
    statutoryIds: [],
    family: [],
    costCenter: '',
    division: '',
    grade: '',
    shift: '',
    webLogin: person.workEmail,
    previousPositions: [],
    accessCardNo: '',
    accessCardValidity: '',
    previousAssets: [],
  };
}

export function departmentOf(person: Person) {
  const team = teamOf(person);
  if (team) return departments.find((department) => department.id === team.departmentId);
  return departments.find((department) => department.name === person.department);
}

export function approverFor(person: Person, people: Person[]) {
  const memberTeam = teams.find((team) => team.id === person.teamId);
  if (memberTeam && memberTeam.managerId !== person.id) {
    return people.find((candidate) => candidate.id === memberTeam.managerId);
  }
  if (!person.managerId) return undefined;
  return people.find((candidate) => candidate.id === person.managerId);
}

export function teammatesOf(person: Person, people: Person[]) {
  const team = teamOf(person);
  if (!team) return [];
  return people.filter((candidate) => candidate.teamId === team.id && candidate.id !== person.id);
}

export function employeeIdFor(taken: string[]) {
  const used = new Set(taken);
  let serial = 100;
  let code = `${ORGANIZATION.code}${serial}`;
  while (used.has(code)) {
    serial += 1;
    code = `${ORGANIZATION.code}${serial}`;
  }
  return code;
}
