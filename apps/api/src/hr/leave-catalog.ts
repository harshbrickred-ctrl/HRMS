export type LeaveSeed = {
  code: string;
  type: string;
  entitled?: number;
  used?: number;
  pending?: number;
};

export const LEAVE_CATALOG: LeaveSeed[] = [
  { code: 'LOP', type: 'Loss of Pay' },
  { code: 'CO', type: 'Comp-off' },
  { code: 'CL', type: 'Casual Leave' },
  { code: 'EL', type: 'Earned Leave or Planned Leave' },
  { code: 'WFH', type: 'Work From Home' },
  { code: 'OBH', type: 'Optional - Birth Holiday' },
  { code: 'SL', type: 'Sick Leave' },
];

export const HARSH_LEAVE: Record<string, { entitled: number; used: number; pending: number }> = {
  LOP: { entitled: 0, used: 0, pending: 0 },
  CO: { entitled: 2, used: 0, pending: 0 },
  CL: { entitled: 12, used: 3, pending: 1 },
  EL: { entitled: 18, used: 5, pending: 0 },
  WFH: { entitled: 12, used: 2, pending: 0 },
  OBH: { entitled: 1, used: 0, pending: 0 },
  SL: { entitled: 10, used: 1, pending: 0 },
};
