import type { AssetSheetImportRow, AssetSheetRow } from './assetsApi';

/**
 * Columns of the IT team's asset register sheet, in its order and with its headings. Export, the
 * sample file and import all use this list, so a file exported here imports straight back.
 */
export const SHEET_COLUMNS = [
  { key: 'sno', header: 'S.No', aliases: ['srno', 'slno', 'sn', 'no'] },
  { key: 'vendor', header: 'Vender', aliases: ['vendor', 'supplier'] },
  { key: 'purchasedOn', header: 'Purchase Date', aliases: ['purchasedon', 'dateofpurchase'] },
  { key: 'owner', header: 'Assest Owner', aliases: ['assetowner', 'owner'] },
  { key: 'assignTo', header: 'Assign To', aliases: ['assignedto'] },
  { key: 'manager', header: 'Reporting Manager', aliases: ['manager'] },
  { key: 'project', header: 'Projects/ Work Details', aliases: ['project', 'projects', 'workdetails'] },
  { key: 'name', header: 'Device Name', aliases: ['assetname', 'name', 'device'] },
  { key: 'processor', header: 'Processor', aliases: ['cpu'] },
  { key: 'make', header: 'Make', aliases: ['brand'] },
  { key: 'model', header: 'Model No', aliases: ['model', 'modelnumber'] },
  { key: 'serialNo', header: 'Serial no.', aliases: ['serialnumber', 'serial'] },
  { key: 'workingStatus', header: 'Working status', aliases: ['status'] },
  { key: 'assignedToEmployee', header: 'Assigned to Employee', aliases: [] },
  { key: 'assignedOn', header: 'Assigned Date', aliases: ['assignedon', 'issuedate', 'issuedon'] },
  { key: 'employeeCode', header: 'Employee ID', aliases: ['empid', 'employeecode', 'empcode'] },
  { key: 'email', header: 'Email ID', aliases: ['email', 'emailaddress'] },
  { key: 'mobile', header: 'Mobile No', aliases: ['mobile', 'mobilenumber', 'phone', 'contactno'] },
  { key: 'assignedReceived', header: 'Assigned/Received', aliases: [] },
  { key: 'employmentType', header: 'Employment Type', aliases: [] },
  { key: 'bag', header: 'Laptop Bag', aliases: ['bag'] },
  { key: 'charger', header: 'Charger/ Adaptor', aliases: ['charger', 'adaptor', 'adapter', 'chargeradapter'] },
  { key: 'mouse', header: 'Mouse', aliases: [] },
  { key: 'headphone', header: 'Headphone', aliases: ['headphones', 'headset'] },
  { key: 'keyboard', header: 'Keyboard', aliases: [] },
  { key: 'os', header: 'OS', aliases: ['operatingsystem'] },
  { key: 'ram', header: 'RAM/GB', aliases: ['ram'] },
  { key: 'storage', header: 'SSD/HHD/(GB)', aliases: ['ssdhddgb', 'ssdhdd', 'storage', 'ssd', 'hdd'] },
  { key: 'condition', header: 'Laptop Condition', aliases: ['condition'] },
  { key: 'remarks', header: 'Remarks', aliases: ['remark', 'notes', 'comments'] },
] as const;

type SheetKey = (typeof SHEET_COLUMNS)[number]['key'];

/** Worked out by the system on import, so they are only ever exported. */
const EXPORT_ONLY = new Set<SheetKey>(['sno', 'manager']);
const DATE_KEYS = new Set<SheetKey>(['purchasedOn', 'assignedOn']);
/** Columns that show a file is the asset sheet at all. */
const DEVICE_KEYS = new Set<SheetKey>(['name', 'make', 'model', 'serialNo']);

const SAMPLE_ROWS: Array<Partial<Record<SheetKey, string>>> = [
  {
    sno: '1',
    vendor: 'Dell India Pvt Ltd',
    purchasedOn: '15-03-2025',
    owner: 'Company',
    assignTo: 'Asha Verma',
    manager: 'Rohit Mehta',
    project: 'HRMS portal',
    name: 'Dell Latitude 5440',
    processor: 'Intel Core i5-1335U',
    make: 'Dell',
    model: 'Latitude 5440',
    serialNo: 'SAMPLE-SN-0001',
    workingStatus: 'Working',
    assignedToEmployee: 'Yes',
    assignedOn: '01-04-2025',
    employeeCode: 'EMP-0001',
    email: 'asha.verma@company.com',
    mobile: '9876543210',
    assignedReceived: 'Assigned',
    employmentType: 'Permanent',
    bag: 'Yes',
    charger: 'Yes',
    mouse: 'Yes',
    headphone: 'No',
    keyboard: 'No',
    os: 'Windows 11 Pro',
    ram: '16',
    storage: '512',
    condition: 'Good',
    remarks: 'Delete these sample rows before importing',
  },
  {
    sno: '2',
    vendor: 'Lenovo Store',
    purchasedOn: '10-01-2025',
    owner: 'Company',
    name: 'Lenovo ThinkPad E14',
    processor: 'AMD Ryzen 5 7530U',
    make: 'Lenovo',
    model: 'ThinkPad E14 Gen 5',
    serialNo: 'SAMPLE-SN-0002',
    workingStatus: 'Working',
    assignedToEmployee: 'No',
    os: 'Windows 11 Pro',
    ram: '8',
    storage: '256',
    condition: 'Good',
    remarks: 'Spare in the IT store',
  },
];

function squash(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** 2026-03-15 → 15-03-2026, the way the sheet writes dates. */
function sheetDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : value;
}

/** Reads a CSV saved from Excel: quoted fields, embedded commas and quotes, CRLF line ends. */
export function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function csvCell(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Saves rows as a CSV that Excel opens with the right characters (UTF-8 with a byte order mark). */
export function downloadCsv(fileName: string, rows: Array<Array<string | number | null | undefined>>) {
  const blob = new Blob([`﻿${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}`], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function sheetRows(rows: Array<Partial<Record<string, string>>>) {
  return [
    SHEET_COLUMNS.map((column) => column.header),
    ...rows.map((row) =>
      SHEET_COLUMNS.map((column) => {
        const value = row[column.key] ?? '';
        return DATE_KEYS.has(column.key) ? sheetDate(value) : value;
      }),
    ),
  ];
}

export function downloadSheetSample() {
  downloadCsv('asset-register-sample.csv', sheetRows(SAMPLE_ROWS));
}

export function downloadSheet(fileName: string, rows: AssetSheetRow[]) {
  downloadCsv(fileName, sheetRows(rows));
}

const COLUMN_BY_NAME = new Map<string, SheetKey>(
  SHEET_COLUMNS.flatMap((column) => [
    [squash(column.header), column.key] as const,
    ...column.aliases.map((alias) => [alias, column.key] as const),
  ]),
);

/**
 * Rows of an asset sheet CSV, matched to columns by heading, in any order. Headings above the table
 * (a title row, say) are skipped; columns the sheet does not have are ignored and reported.
 */
export function readSheet(text: string) {
  const table = parseCsv(text);
  const headerAt = table.findIndex(
    (cells) => cells.filter((cell) => COLUMN_BY_NAME.has(squash(cell))).length >= 3,
  );
  const header = headerAt >= 0 ? table[headerAt] : [];
  const keys = header.map((cell) => COLUMN_BY_NAME.get(squash(cell)) ?? null);
  if (!keys.some((key) => key && DEVICE_KEYS.has(key))) {
    throw new Error(
      'This file does not have the asset sheet headings (Device Name, Make, Model No, Serial no.). Download the sample file to start.',
    );
  }
  const ignored = header.filter((cell, index) => cell.trim() && !keys[index]).map((cell) => cell.trim());
  const rows: AssetSheetImportRow[] = [];
  table.slice(headerAt + 1).forEach((cells, index) => {
    const row: AssetSheetImportRow = { line: headerAt + index + 2 };
    let filled = false;
    keys.forEach((key, column) => {
      const value = (cells[column] ?? '').trim();
      if (!key || !value || EXPORT_ONLY.has(key) || row[key]) return;
      row[key] = value;
      filled = true;
    });
    if (filled) rows.push(row);
  });
  return { rows, ignored };
}
