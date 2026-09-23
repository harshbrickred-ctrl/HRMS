import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  createInitialEssState,
  workingDaysBetween,
  type AttendanceStatus,
  type CorrectionRequest,
  type EssDocument,
  type EssState,
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
  name: string;
  category: string;
};

type EssDataContextValue = EssState & {
  applyLeave: (input: ApplyLeaveInput) => { ok: true } | { ok: false; error: string };
  withdrawLeave: (id: string) => void;
  markAttendance: (date: string) => void;
  requestCorrection: (
    input: ApplyCorrectionInput,
  ) => { ok: true } | { ok: false; error: string };
  uploadDocument: (input: UploadDocumentInput) => void;
  updateContacts: (contacts: ProfileContacts) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  clearToast: () => void;
  unreadCount: number;
  pendingLeaveCount: number;
};

const EssDataContext = createContext<EssDataContextValue | undefined>(undefined);

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

export function EssDataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<EssState>(() => createInitialEssState());

  const clearToast = useCallback(() => {
    setState((prev) => ({ ...prev, toast: null }));
  }, []);

  const applyLeave = useCallback(
    (input: ApplyLeaveInput): { ok: true } | { ok: false; error: string } => {
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
      if (days > balance.available) {
        return {
          ok: false,
          error: `Only ${balance.available} day(s) available for ${balance.type}.`,
        };
      }

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
      };

      setState((prev) => ({
        ...prev,
        leaveRequests: [request, ...prev.leaveRequests],
        leaveBalances: adjustBalance(prev.leaveBalances, balance.code, days),
        notifications: [
          {
            id: nextId('n'),
            title: 'Leave submitted',
            body: `${balance.type} for ${input.startDate} → ${input.endDate} is pending approval.`,
            createdAt: new Date().toISOString(),
            read: false,
            href: '/ess/leave',
            type: 'leave',
          },
          ...prev.notifications,
        ],
        toast: 'Leave request submitted.',
      }));
      return { ok: true };
    },
    [state.holidays, state.leaveBalances],
  );

  const withdrawLeave = useCallback((id: string) => {
    setState((prev) => {
      const req = prev.leaveRequests.find((r) => r.id === id);
      if (!req || req.status !== 'Pending') return prev;
      return {
        ...prev,
        leaveRequests: prev.leaveRequests.map((r) =>
          r.id === id ? { ...r, status: 'Withdrawn' as const } : r,
        ),
        leaveBalances: adjustBalance(prev.leaveBalances, req.typeCode, -req.days),
        toast: 'Leave request withdrawn.',
      };
    });
  }, []);

  const markAttendance = useCallback((date: string) => {
    setState((prev) => {
      const existing = prev.attendance.find((d) => d.date === date);
      if (existing && existing.status !== 'Absent' && existing.status) {
        if (
          existing.status === 'Present' ||
          existing.status === 'Holiday' ||
          existing.status === 'Weekend' ||
          existing.status === 'Leave' ||
          existing.status === 'PendingCorrection'
        ) {
          return {
            ...prev,
            toast:
              existing.status === 'Present'
                ? 'Already marked present for today.'
                : `Cannot mark attendance on a ${existing.status.toLowerCase()} day.`,
          };
        }
      }

      const now = new Date();
      const checkIn = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const day: (typeof prev.attendance)[number] = {
        date,
        status: 'Present',
        checkIn,
        checkOut: undefined,
      };

      const attendance = existing
        ? prev.attendance.map((d) => (d.date === date ? day : d))
        : [...prev.attendance, day].sort((a, b) => a.date.localeCompare(b.date));

      return {
        ...prev,
        attendance,
        toast: `Attendance marked at ${checkIn}.`,
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

      const correction: CorrectionRequest = {
        id: nextId('cr'),
        date: input.date,
        requestedStatus: input.requestedStatus,
        reason: input.reason.trim(),
        status: 'Pending',
        submittedAt: new Date().toISOString(),
      };

      setState((prev) => ({
        ...prev,
        corrections: [correction, ...prev.corrections],
        attendance: prev.attendance.map((d) =>
          d.date === input.date
            ? {
                ...d,
                status: 'PendingCorrection' as AttendanceStatus,
                note: input.reason.trim(),
              }
            : d,
        ),
        notifications: [
          {
            id: nextId('n'),
            title: 'Correction requested',
            body: `Attendance correction for ${input.date} is pending review.`,
            createdAt: new Date().toISOString(),
            read: false,
            href: '/ess/attendance',
            type: 'attendance',
          },
          ...prev.notifications,
        ],
        toast: 'Correction request submitted.',
      }));
      return { ok: true };
    },
    [state.corrections],
  );

  const uploadDocument = useCallback((input: UploadDocumentInput) => {
    const doc: EssDocument = {
      id: nextId('doc'),
      name: input.name,
      category: input.category,
      uploadedAt: new Date().toISOString().slice(0, 10),
      sizeLabel: '—',
      owner: 'mine',
    };
    setState((prev) => ({
      ...prev,
      documents: [doc, ...prev.documents],
      notifications: [
        {
          id: nextId('n'),
          title: 'Document uploaded',
          body: `${input.name} was added to My documents.`,
          createdAt: new Date().toISOString(),
          read: false,
          href: '/ess/documents',
          type: 'document',
        },
        ...prev.notifications,
      ],
      toast: 'Document uploaded (mock).',
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
    () => ({
      ...state,
      applyLeave,
      withdrawLeave,
      markAttendance,
      requestCorrection,
      uploadDocument,
      updateContacts,
      markNotificationRead,
      markAllNotificationsRead,
      clearToast,
      unreadCount,
      pendingLeaveCount,
    }),
    [
      state,
      applyLeave,
      withdrawLeave,
      markAttendance,
      requestCorrection,
      uploadDocument,
      updateContacts,
      markNotificationRead,
      markAllNotificationsRead,
      clearToast,
      unreadCount,
      pendingLeaveCount,
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
