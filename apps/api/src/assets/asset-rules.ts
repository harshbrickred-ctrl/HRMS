import { BadRequestException } from '@nestjs/common';
import type { AssetReturnCondition, AssetStatus } from '@prisma/client';

export type CategoryFieldType = 'text' | 'number' | 'date';

export type CategoryField = {
  key: string;
  label: string;
  type: CategoryFieldType;
  required: boolean;
};

const FIELD_TYPES = new Set<string>(['text', 'number', 'date']);
const FIELD_KEY = /^[a-z][a-z0-9_]{0,39}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function formatTag(prefix: string, number: number) {
  return `${prefix}-${String(number).padStart(4, '0')}`;
}

/** Serial numbers compare case-insensitively; blank means the asset has none. */
export function normaliseSerial(value: string | null | undefined) {
  return (value ?? '').trim().toUpperCase() || null;
}

/** Category code from its name, e.g. "Software Licence" → software_licence. */
export function categoryCode(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

/** Reads field definitions stored on a category. */
export function parseFieldDefs(raw: unknown): CategoryField[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map((item) => ({
      key: typeof item.key === 'string' ? item.key : '',
      label: typeof item.label === 'string' ? item.label : '',
      type: (FIELD_TYPES.has(item.type as string) ? item.type : 'text') as CategoryFieldType,
      required: item.required === true,
    }))
    .filter((item) => item.key);
}

/** Checks field definitions an admin submitted for a category. */
export function validateFieldDefs(defs: Array<Omit<CategoryField, 'required'> & { required?: boolean }>) {
  const seen = new Set<string>();
  return defs.map((def) => {
    const label = def.label.trim();
    if (!FIELD_KEY.test(def.key)) {
      throw new BadRequestException(
        `Field key "${def.key}" must start with a letter and use lowercase letters, digits, or underscores.`,
      );
    }
    if (!label) throw new BadRequestException(`Field "${def.key}" needs a label.`);
    if (!FIELD_TYPES.has(def.type)) throw new BadRequestException(`${label} has an unknown type.`);
    if (seen.has(def.key)) throw new BadRequestException(`${label} is listed twice.`);
    seen.add(def.key);
    return { key: def.key, label, type: def.type, required: def.required === true };
  });
}

/** Keeps only this category's fields, coerces their types, and enforces required ones. */
export function cleanCustomFields(defs: CategoryField[], input: Record<string, unknown> | undefined) {
  const source = input ?? {};
  const known = new Set(defs.map((def) => def.key));
  for (const key of Object.keys(source)) {
    if (!known.has(key)) throw new BadRequestException(`"${key}" is not a field of this category.`);
  }
  const clean: Record<string, string | number> = {};
  for (const def of defs) {
    const raw = source[def.key];
    const text = typeof raw === 'string' || typeof raw === 'number' ? String(raw).trim() : '';
    if (!text) {
      if (def.required) throw new BadRequestException(`${def.label} is required for this category.`);
      continue;
    }
    if (def.type === 'number') {
      const value = Number(text);
      if (!Number.isFinite(value)) throw new BadRequestException(`${def.label} must be a number.`);
      clean[def.key] = value;
    } else if (def.type === 'date') {
      if (!DAY.test(text) || Number.isNaN(Date.parse(`${text}T00:00:00Z`))) {
        throw new BadRequestException(`${def.label} must be a date.`);
      }
      clean[def.key] = text;
    } else {
      clean[def.key] = text.slice(0, 500);
    }
  }
  return clean;
}

export const STATUS_LABELS: Record<AssetStatus, string> = {
  in_stock: 'In Stock',
  allocated: 'Allocated',
  under_maintenance: 'Under Maintenance',
  lost: 'Lost',
  retired: 'Retired',
  disposed: 'Disposed',
  written_off: 'Written Off',
};

/** The only moves an asset can make. Disposed and Written Off are final. */
export const NEXT_STATUSES: Record<AssetStatus, AssetStatus[]> = {
  in_stock: ['allocated', 'under_maintenance', 'retired'],
  allocated: ['in_stock', 'lost', 'under_maintenance'],
  under_maintenance: ['in_stock', 'retired'],
  lost: ['in_stock', 'written_off'],
  retired: ['disposed'],
  disposed: [],
  written_off: [],
};

export function canMove(from: AssetStatus, to: AssetStatus) {
  return NEXT_STATUSES[from].includes(to);
}

export function assertMove(from: AssetStatus, to: AssetStatus) {
  if (!canMove(from, to)) {
    throw new BadRequestException(
      `An asset that is ${STATUS_LABELS[from]} cannot move to ${STATUS_LABELS[to]}.`,
    );
  }
}

/** Anything not returned in good order goes to maintenance before it can be issued again. */
export const RETURN_STATUS: Record<AssetReturnCondition, AssetStatus> = {
  good: 'in_stock',
  damaged: 'under_maintenance',
  requires_repair: 'under_maintenance',
  missing_components: 'under_maintenance',
};

export const FAULT_CATEGORIES = {
  hardware: 'Hardware Problem',
  software: 'Software Problem',
  physical_damage: 'Physical Damage',
  battery: 'Battery Problem',
  accessories_missing: 'Accessories Missing',
  other: 'Other',
} as const;

/** "Warranty ending" means within this many days, on the dashboard, register and maintenance screens. */
export const WARRANTY_WINDOW_DAYS = 30;

/** The day N working days (Monday to Friday) after a date. */
export function addWorkingDays(from: Date, days: number) {
  const next = new Date(from.getTime());
  let left = Math.max(0, Math.floor(days));
  while (left > 0) {
    next.setUTCDate(next.getUTCDate() + 1);
    const weekday = next.getUTCDay();
    if (weekday !== 0 && weekday !== 6) left -= 1;
  }
  return next;
}

/** Whole months from one day to another, never negative. */
export function monthsBetween(from: Date, to: Date) {
  const months = (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
  const partial = to.getUTCDate() < from.getUTCDate() ? 1 : 0;
  return Math.max(0, months - partial);
}

/**
 * Straight-line depreciation to zero over the category's useful life, counted from the purchase
 * date. Assets without a cost or purchase date have no book value to report.
 */
export function depreciation(cost: number | null, purchasedOn: Date | null, lifeMonths: number, asOf: Date) {
  if (cost === null || !purchasedOn) return null;
  const life = Math.max(1, lifeMonths);
  const monthsUsed = Math.min(monthsBetween(purchasedOn, asOf), life);
  const depreciated = Math.round(((cost * monthsUsed) / life) * 100) / 100;
  return { lifeMonths: life, monthsUsed, depreciated, bookValue: Math.round((cost - depreciated) * 100) / 100 };
}

/** Ticket category for an employee asking IT to take an asset back (ticket type Request). */
export const RETURN_REQUEST = 'return';

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const EXCEL_EPOCH = Date.UTC(1899, 11, 30);

/**
 * A date as typed in the asset sheet: 2026-03-15, 15-03-2026, 15/03/26, 15-Mar-2026, 15 March 2026,
 * or an Excel day number. Numeric dates are read day first, as Excel writes them in India.
 */
export function parseSheetDate(text: string | undefined) {
  const value = (text ?? '').trim();
  if (!value) return null;
  let year: number;
  let month: number;
  let date: number;
  let match: RegExpExecArray | null;
  if ((match = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(value))) {
    [year, month, date] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else if ((match = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/.exec(value))) {
    [date, month, year] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else if ((match = /^(\d{1,2})[-\s/]+([a-z]{3,9})[-\s/,]+(\d{2}|\d{4})$/i.exec(value))) {
    [date, month, year] = [Number(match[1]), MONTHS.indexOf(match[2].slice(0, 3).toLowerCase()) + 1, Number(match[3])];
  } else if (/^\d{5}$/.test(value)) {
    return new Date(EXCEL_EPOCH + Number(value) * 86_400_000).toISOString().slice(0, 10);
  } else {
    throw new BadRequestException(`"${value}" is not a date. Use DD-MM-YYYY.`);
  }
  if (year < 100) year += 2000;
  const parsed = new Date(Date.UTC(year, month - 1, date));
  if (month < 1 || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== date) {
    throw new BadRequestException(`"${value}" is not a date. Use DD-MM-YYYY.`);
  }
  return parsed.toISOString().slice(0, 10);
}

const NO_WORDS = new Set(['no', 'n', 'false', '0', 'na', 'n/a', 'nil', 'none', '-', 'not given', 'not provided']);
const YES_WORDS = new Set(['yes', 'y', 'true', '1', 'given', 'provided', 'issued', 'ok']);

/** Yes, no, or blank for a sheet tick column. Anything else written in it, such as "Dell 65W", counts as yes. */
export function sheetFlag(text: string | undefined) {
  const value = (text ?? '').trim().toLowerCase();
  if (!value) return null;
  return !NO_WORDS.has(value);
}

export function isSheetFlagWord(text: string | undefined) {
  const value = (text ?? '').trim().toLowerCase();
  return NO_WORDS.has(value) || YES_WORDS.has(value);
}

/** Status a sheet's "Working status" asks for. Null means working: in stock, or with the employee named. */
export function sheetStatus(text: string | undefined): AssetStatus | null {
  const value = (text ?? '').trim().toLowerCase().replace(/[^a-z]+/g, ' ').trim();
  if (!value || /^(working|ok|good|active|in use|functional|fine|available|spare|in stock|yes)$/.test(value)) {
    return null;
  }
  if (/lost|stolen|missing|written off/.test(value)) return 'lost';
  if (/retire|scrap|dispos|e waste|obsolete/.test(value)) return 'retired';
  if (/not working|repair|maintenance|faulty|defect|damage|dead|broken|not ok/.test(value)) return 'under_maintenance';
  throw new BadRequestException(`Working status "${text?.trim()}" should be Working, Not working, Lost or Retired.`);
}

export const SHEET_STATUS_LABELS: Record<AssetStatus, string> = {
  in_stock: 'Working',
  allocated: 'Working',
  under_maintenance: 'Not working',
  lost: 'Lost',
  retired: 'Retired',
  disposed: 'Disposed',
  written_off: 'Written off',
};

/** The issue condition a sheet's "Laptop Condition" describes, or null when it is free text. */
export function sheetIssueCondition(text: string | undefined) {
  const value = (text ?? '').trim().toLowerCase();
  if (!value) return null;
  if (/^(brand )?new\b/.test(value)) return 'new';
  if (/damage|broken|crack|bad|poor|not (ok|working)/.test(value)) return 'damaged';
  if (/fair|average|scratch|used|minor/.test(value)) return 'fair';
  if (/good|excellent|fine|working|\bok\b/.test(value)) return 'good';
  return null;
}

/** Accessory columns of the sheet, as they are written into an allocation's accessories. */
export const SHEET_ACCESSORIES = [
  { key: 'bag', label: 'Bag', match: /\bbag\b/i },
  { key: 'charger', label: 'Charger', match: /charger|adapt/i },
  { key: 'mouse', label: 'Mouse', match: /mouse/i },
  { key: 'headphone', label: 'Headphone', match: /head ?(phone|set)|earphone|earbud/i },
  { key: 'keyboard', label: 'Keyboard', match: /keyboard/i },
] as const;

export function ticketReference(number: number) {
  return `AT-${String(number).padStart(6, '0')}`;
}

export function requestReference(number: number) {
  return `AR-${String(number).padStart(6, '0')}`;
}
