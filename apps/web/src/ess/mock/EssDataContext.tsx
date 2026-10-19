import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '../../auth/AuthContext';
import { adjustMyLeave, downloadMyDocument, fetchMyEmployee } from '../../workspace/hrApi';
import { setApprovalStatus, submitApproval } from '../../workspace/workspaceMock';
import {
  approverFor,
  createInitialEssState,
  personForLogin,
  profileForPerson,
  workingDaysBetween,
  type AttendanceDay,
  type AttendanceStatus,
  type CorrectionRequest,
  type EssDocument,
  type EssState,
  type HelpTicket,
  type LeaveRequest,
  type ProfileContacts,
} from './essMock';

export type ApplyLeaveInput = {
  typeCode: string;
  startDate: string;
  endDate: string;
  halfDayStart: boolean;
  halfDayEnd: boolean;
  reason: string;
};

export type ApplyCorrectionInput = {
  date: string;
  requestedStatus: 'Present' | 'Absent';
  reason: string;
};

export type UploadDocumentInput = {
  category: string;
  file: File;
};

const sessionFiles = new Map<string, File>();

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${kb >= 10 ? Math.round(kb) : kb.toFixed(1)} KB`;
  }
  const mb = kb / 1024;
  return `${mb >= 10 ? Math.round(mb) : mb.toFixed(1)} MB`;
}

export function downloadEssDocument(doc: EssDocument) {
  if (doc.remote) {
    void downloadMyDocument(doc.id, doc.name);
    return;
  }
  const stored = sessionFiles.get(doc.id);
  const blob =
    stored ??
    new Blob(
      [`${doc.name}\nCategory: ${doc.category}\nUploaded: ${doc.uploadedAt}\n`],
      { type: 'text/plain;charset=utf-8' },
    );
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const stem = doc.name.replace(/\.[^.]+$/, '') || doc.name;
  anchor.href = url;
  anchor.download = stored ? stored.name : `${stem}.txt`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export type CreateTicketInput = {
  subject: string;
  category: string;
};

type EssDataContextValue = EssState & {
  applyLeave: (
    input: ApplyLeaveInput,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  withdrawLeave: (id: string) => Promise<void>;
  punchIn: (date: string) => void;
  punchOut: (date: string) => void;
  requestCorrection: (
    input: ApplyCorrectionInput,
  ) => { ok: true } | { ok: false; error: string };
  uploadDocument: (input: UploadDocumentInput) => void;
  createTicket: (input: CreateTicketInput) => void;
  updateContacts: (contacts: ProfileContacts) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  clearToast: () => void;
  unreadCount: number;
  pendingLeaveCount: number;
  salaryHidden: boolean;
  toggleSalaryHidden: () => void;
  showAmount: (amount: number) => string;
};

const EssDataContext = createContext<EssDataContextValue | undefined>(undefined);

export function localToday() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function clockNow() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

const PUNCH_BLOCKED = new Set<AttendanceStatus>([
  'Holiday',
  'Weekend',
  'Leave',
  'PendingCorrection',
]);

function punchBlockMessage(status: AttendanceStatus, action: 'in' | 'out') {
  const label = status === 'PendingCorrection' ? 'pending correction' : status.toLowerCase();
  return `Cannot punch ${action} on a ${label} day.`;
}

export function formatInr(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

const SALARY_MASK = '₹ ••••••';
const SALARY_HIDDEN_KEY = 'peopleos-salary-hidden';

function readSalaryHidden() {
  try {
    return sessionStorage.getItem(SALARY_HIDDEN_KEY) !== '0';
  } catch {
    return true;
  }
}

function nextId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function adjustBalance(
  balances: EssState['leaveBalances'],
  typeCode: string,
  deltaPending: number,
  deltaUsed = 0,
) {
  return balances.map((b) => {
    if (b.code !== typeCode) return b;
    const pending = Math.max(0, b.pending + deltaPending);
    const used = Math.max(0, b.used + deltaUsed);
    const available = Math.max(0, b.entitled - used - pending);
    return { ...b, pending, used, available };
  });
}

function shortDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  });
}

export function EssDataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<EssState>(() => createInitialEssState());
  const [employment, setEmployment] = useState<Awaited<ReturnType<typeof fetchMyEmployee>> | null>(
    null,
  );

  useEffect(() => {
    if (!user?.email) return;
    let cancelled = false;
    fetchMyEmployee()
      .then((employee) => {
        if (cancelled) return;
        setEmployment(employee);
        setState((prev) => ({
          ...prev,
          leaveBalances: employee.leaveBalances ?? prev.leaveBalances,
          documents: [
            ...prev.documents.filter((doc) => doc.owner === 'company'),
            ...(employee.documents ?? []).map((doc) => ({
              id: doc.id,
              name: doc.fileName,
              category: doc.category,
              uploadedAt: doc.uploadedAt,
              sizeLabel: '',
              owner: 'mine' as const,
              remote: true,
            })),
          ],
        }));
      })
      .catch(() => {
        if (!cancelled) setEmployment(null);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.email]);
  const [salaryHidden, setSalaryHidden] = useState(readSalaryHidden);
  const toggleSalaryHidden = useCallback(() => {
    setSalaryHidden((hidden) => {
      const next = !hidden;
      try {
        sessionStorage.setItem(SALARY_HIDDEN_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);
  const showAmount = useCallback(
    (amount: number) => (salaryHidden ? SALARY_MASK : formatInr(amount)),
    [salaryHidden],
  );

  const clearToast = useCallback(() => {
    setState((prev) => ({ ...prev, toast: null }));
  }, []);

  const applyLeave = useCallback(
    async (input: ApplyLeaveInput): Promise<{ ok: true } | { ok: false; error: string }> => {
      const balance = state.leaveBalances.find((b) => b.code === input.typeCode);
      if (!balance) return { ok: false, error: 'Unknown leave type.' };
      if (!input.startDate || !input.endDate) {
        return { ok: false, error: 'Start and end dates are required.' };
      }
      if (input.endDate < input.startDate) {
        return { ok: false, error: 'End date cannot be before start date.' };
      }
      if (!input.reason.trim()) {
        return { ok: false, error: 'Reason is required.' };
      }

      const days = workingDaysBetween(
        input.startDate,
        input.endDate,
        state.holidays,
        input.halfDayStart,
        input.halfDayEnd,
      );
      if (days <= 0) {
        return { ok: false, error: 'Selected range has no working days.' };
      }
      const uncapped = balance.code === 'LOP';
      if (!uncapped && days > balance.available) {
        return {
          ok: false,
          error: `Only ${balance.available} day(s) available for ${balance.type}.`,
        };
      }

      const me = personForLogin(user?.email, state.people);
      const approver = me ? approverFor(me, state.people) : undefined;
      const request: LeaveRequest = {
        id: nextId('lr'),
        type: balance.type,
        typeCode: balance.code,
        startDate: input.startDate,
        endDate: input.endDate,
        halfDayStart: input.halfDayStart,
        halfDayEnd: input.halfDayEnd,
        days,
        reason: input.reason.trim(),
        status: 'Pending',
        submittedAt: new Date().toISOString(),
        approverName: approver?.name,
      };
      const dateLabel =
        input.startDate === input.endDate
          ? shortDate(input.startDate)
          : `${shortDate(input.startDate)} – ${shortDate(input.endDate)}`;

      if (me && approver) {
        submitApproval({
          id: request.id,
          kind: 'Leave',
          person: me.name,
          personId: me.id,
          approverId: approver.id,
          approverName: approver.name,
          summary: `${balance.type} · ${dateLabel} · ${input.reason.trim()}`,
        });
      }

      let leaveBalances = uncapped
        ? state.leaveBalances
        : adjustBalance(state.leaveBalances, balance.code, days);
      if (!uncapped) {
        try {
          const updated = await adjustMyLeave(balance.code, days, 'apply');
          if (updated.leaveBalances) leaveBalances = updated.leaveBalances;
        } catch (err) {
          const text = err instanceof Error ? err.message : '';
          if (!text.includes('No employee record')) {
            return { ok: false, error: text || 'Could not update the leave balance.' };
          }
        }
      }

      setState((prev) => ({
        ...prev,
        leaveRequests: [request, ...prev.leaveRequests],
        leaveBalances,
        notifications: [
          {
            id: nextId('n'),
            title: 'Leave submitted',
            body: `${balance.type} for ${input.startDate} → ${input.endDate} is with ${approver?.name ?? 'your manager'}.`,
            createdAt: new Date().toISOString(),
            read: false,
            href: '/ess/leave',
            type: 'leave',
          },
          ...prev.notifications,
        ],
        toast: `Leave request sent to ${approver?.name ?? 'your manager'}.`,
      }));
      return { ok: true };
    },
    [state.holidays, state.leaveBalances, state.people, user?.email],
  );

  const withdrawLeave = useCallback(async (id: string) => {
    const current = state.leaveRequests.find((request) => request.id === id);
    if (!current || current.status !== 'Pending') return;
    let leaveBalances = state.leaveBalances;
    if (current.typeCode !== 'LOP') {
      try {
        const updated = await adjustMyLeave(current.typeCode, current.days, 'withdraw');
        if (updated.leaveBalances) leaveBalances = updated.leaveBalances;
      } catch (err) {
        const text = err instanceof Error ? err.message : '';
        if (!text.includes('No employee record')) {
          setState((prev) => ({
            ...prev,
            toast: text || 'Could not update the leave balance.',
          }));
          return;
        }
        leaveBalances = adjustBalance(state.leaveBalances, current.typeCode, -current.days);
      }
    }
    setApprovalStatus(id, 'Withdrawn');
    setState((prev) => ({
      ...prev,
      leaveRequests: prev.leaveRequests.map((request) =>
        request.id === id ? { ...request, status: 'Withdrawn' as const } : request,
      ),
      leaveBalances,
      toast: 'Leave request withdrawn.',
    }));
  }, [state.leaveBalances, state.leaveRequests]);

  const punchIn = useCallback((date: string) => {
    setState((prev) => {
      const existing = prev.attendance.find((d) => d.date === date);
      if (existing && PUNCH_BLOCKED.has(existing.status)) {
        return { ...prev, toast: punchBlockMessage(existing.status, 'in') };
      }
      if (existing?.checkIn) {
        return { ...prev, toast: `Already punched in at ${existing.checkIn}.` };
      }

      const checkIn = clockNow();
      const day: AttendanceDay = {
        ...(existing ?? { date, status: 'Present' }),
        status: 'Present',
        checkIn,
      };
      const attendance = existing
        ? prev.attendance.map((d) => (d.date === date ? day : d))
        : [...prev.attendance, day].sort((a, b) => a.date.localeCompare(b.date));

      return {
        ...prev,
        attendance,
        toast: `Punched in at ${checkIn}.`,
      };
    });
  }, []);

  const punchOut = useCallback((date: string) => {
    setState((prev) => {
      const existing = prev.attendance.find((d) => d.date === date);
      if (existing && PUNCH_BLOCKED.has(existing.status)) {
        return { ...prev, toast: punchBlockMessage(existing.status, 'out') };
      }
      if (!existing?.checkIn) {
        return { ...prev, toast: 'Punch in before punching out.' };
      }
      if (existing.checkOut) {
        return { ...prev, toast: `Already punched out at ${existing.checkOut}.` };
      }

      const checkOut = clockNow();
      const day: AttendanceDay = { ...existing, checkOut };
      return {
        ...prev,
        attendance: prev.attendance.map((d) => (d.date === date ? day : d)),
        toast: `Punched out at ${checkOut}.`,
      };
    });
  }, []);

  const requestCorrection = useCallback(
    (
      input: ApplyCorrectionInput,
    ): { ok: true } | { ok: false; error: string } => {
      if (!input.date) return { ok: false, error: 'Date is required.' };
      if (!input.reason.trim()) return { ok: false, error: 'Reason is required.' };

      const pendingSame = state.corrections.some(
        (c) => c.date === input.date && c.status === 'Pending',
      );
      if (pendingSame) {
        return { ok: false, error: 'A correction is already pending for this date.' };
      }

      const me = personForLogin(user?.email, state.people);
      const approver = me ? approverFor(me, state.people) : undefined;
      const correction: CorrectionRequest = {
        id: nextId('cr'),
        date: input.date,
        requestedStatus: input.requestedStatus,
        reason: input.reason.trim(),
        status: 'Pending',
        submittedAt: new Date().toISOString(),
        approverName: approver?.name,
      };

      if (me && approver) {
        submitApproval({
          id: correction.id,
          kind: 'Attendance',
          person: me.name,
          personId: me.id,
          approverId: approver.id,
          approverName: approver.name,
          summary: `Correction · ${shortDate(input.date)} · ${input.reason.trim()}`,
        });
      }

      setState((prev) => {
        const existing = prev.attendance.find((d) => d.date === input.date);
        const updated: AttendanceDay = {
          ...(existing ?? { date: input.date }),
          status: 'PendingCorrection',
          note: input.reason.trim(),
        };
        const attendance = existing
          ? prev.attendance.map((d) => (d.date === input.date ? updated : d))
          : [...prev.attendance, updated].sort((a, b) => a.date.localeCompare(b.date));

        return {
          ...prev,
          corrections: [correction, ...prev.corrections],
          attendance,
          notifications: [
            {
              id: nextId('n'),
              title: 'Correction requested',
              body: `Attendance correction for ${input.date} is with ${approver?.name ?? 'your manager'}.`,
              createdAt: new Date().toISOString(),
              read: false,
              href: '/ess/attendance',
              type: 'attendance',
            },
            ...prev.notifications,
          ],
          toast: `Correction sent to ${approver?.name ?? 'your manager'}.`,
        };
      });
      return { ok: true };
    },
    [state.corrections, state.people, user?.email],
  );

  const uploadDocument = useCallback((input: UploadDocumentInput) => {
    const id = nextId('doc');
    sessionFiles.set(id, input.file);
    const doc: EssDocument = {
      id,
      name: input.file.name,
      category: input.category,
      uploadedAt: localToday(),
      sizeLabel: formatFileSize(input.file.size),
      owner: 'mine',
    };
    setState((prev) => ({
      ...prev,
      documents: [doc, ...prev.documents],
      notifications: [
        {
          id: nextId('n'),
          title: 'Document uploaded',
          body: `${input.file.name} was added to My documents.`,
          createdAt: new Date().toISOString(),
          read: false,
          href: '/ess/documents',
          type: 'document',
        },
        ...prev.notifications,
      ],
      toast: 'Document added to My documents.',
    }));
  }, []);

  const createTicket = useCallback((input: CreateTicketInput) => {
    const ticket: HelpTicket = {
      id: nextId('t'),
      subject: input.subject.trim(),
      category: input.category,
      status: 'Open',
      createdAt: new Date().toISOString().slice(0, 10),
    };
    setState((prev) => ({
      ...prev,
      tickets: [ticket, ...prev.tickets],
      toast: 'Ticket submitted.',
    }));
  }, []);

  const updateContacts = useCallback((contacts: ProfileContacts) => {
    setState((prev) => ({
      ...prev,
      profile: { ...prev.profile, contacts },
      toast: 'Contact details saved.',
    }));
  }, []);

  const markNotificationRead = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n,
      ),
    }));
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    setState((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) => ({ ...n, read: true })),
      toast: 'All notifications marked read.',
    }));
  }, []);

  const unreadCount = state.notifications.filter((n) => !n.read).length;
  const pendingLeaveCount = state.leaveRequests.filter(
    (r) => r.status === 'Pending',
  ).length;

  const value = useMemo<EssDataContextValue>(
    () => {
      const me = personForLogin(user?.email, state.people);
      const base = me ? profileForPerson(me, state.profile) : state.profile;
      const profile = employment
        ? {
            ...base,
            photo: employment.photo || base.photo,
            firstName: employment.firstName,
            lastName: employment.lastName,
            employeeCode: employment.employeeCode,
            title: employment.designation || base.title,
            department: employment.departmentName ?? '',
            location: employment.locationName ?? '',
            teamName: employment.teamName ?? '',
            managerName: employment.managerName ?? '',
            workEmail: employment.email,
          }
        : base;
      return {
        ...state,
        profile,
        applyLeave,
        withdrawLeave,
        punchIn,
        punchOut,
        requestCorrection,
        uploadDocument,
        createTicket,
        updateContacts,
        markNotificationRead,
        markAllNotificationsRead,
        clearToast,
        unreadCount,
        pendingLeaveCount,
        salaryHidden,
        toggleSalaryHidden,
        showAmount,
      };
    },
    [
      state,
      user,
      employment,
      applyLeave,
      withdrawLeave,
      punchIn,
      punchOut,
      requestCorrection,
      uploadDocument,
      createTicket,
      updateContacts,
      markNotificationRead,
      markAllNotificationsRead,
      clearToast,
      unreadCount,
      pendingLeaveCount,
      salaryHidden,
      toggleSalaryHidden,
      showAmount,
    ],
  );

  return (
    <EssDataContext.Provider value={value}>{children}</EssDataContext.Provider>
  );
}

export function useEssData() {
  const ctx = useContext(EssDataContext);
  if (!ctx) {
    throw new Error('useEssData must be used within EssDataProvider');
  }
  return ctx;
}
