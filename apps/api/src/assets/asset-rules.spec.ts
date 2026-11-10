import {
  NEXT_STATUSES,
  RETURN_STATUS,
  addWorkingDays,
  assertMove,
  canMove,
  categoryCode,
  cleanCustomFields,
  depreciation,
  formatTag,
  monthsBetween,
  normaliseSerial,
  parseFieldDefs,
  parseSheetDate,
  requestReference,
  sheetFlag,
  sheetIssueCondition,
  sheetStatus,
  ticketReference,
  validateFieldDefs,
} from './asset-rules';

describe('asset sheet values', () => {
  it('reads the date formats Excel writes, day first', () => {
    expect(parseSheetDate('2026-03-15')).toBe('2026-03-15');
    expect(parseSheetDate('15-03-2026')).toBe('2026-03-15');
    expect(parseSheetDate('5/3/26')).toBe('2026-03-05');
    expect(parseSheetDate('15-Mar-2026')).toBe('2026-03-15');
    expect(parseSheetDate('15 March 2026')).toBe('2026-03-15');
    expect(parseSheetDate('46096')).toBe('2026-03-15');
    expect(parseSheetDate(' ')).toBeNull();
    expect(() => parseSheetDate('31-02-2026')).toThrow(/not a date/);
    expect(() => parseSheetDate('soon')).toThrow(/not a date/);
  });

  it('treats tick columns as yes unless they say no', () => {
    expect(sheetFlag('Yes')).toBe(true);
    expect(sheetFlag('Dell 65W')).toBe(true);
    expect(sheetFlag('N/A')).toBe(false);
    expect(sheetFlag('no')).toBe(false);
    expect(sheetFlag('')).toBeNull();
  });

  it('maps working status and condition words', () => {
    expect(sheetStatus('Working')).toBeNull();
    expect(sheetStatus('')).toBeNull();
    expect(sheetStatus('Not Working')).toBe('under_maintenance');
    expect(sheetStatus('Stolen')).toBe('lost');
    expect(sheetStatus('Scrapped')).toBe('retired');
    expect(() => sheetStatus('On loan')).toThrow(/should be Working/);
    expect(sheetIssueCondition('Good')).toBe('good');
    expect(sheetIssueCondition('Minor scratches')).toBe('fair');
    expect(sheetIssueCondition('Screen cracked')).toBe('damaged');
    expect(sheetIssueCondition('Brand new')).toBe('new');
    expect(sheetIssueCondition('Sticker on lid')).toBeNull();
  });
});

describe('book value', () => {
  const day = (value: string) => new Date(`${value}T00:00:00Z`);

  it('counts whole months only', () => {
    expect(monthsBetween(day('2026-03-14'), day('2026-10-13'))).toBe(6);
    expect(monthsBetween(day('2026-03-14'), day('2026-10-14'))).toBe(7);
    expect(monthsBetween(day('2026-10-14'), day('2026-03-14'))).toBe(0);
  });

  it('depreciates straight line and stops at zero', () => {
    expect(depreciation(62000, day('2026-03-14'), 48, day('2026-10-20'))).toEqual({
      lifeMonths: 48,
      monthsUsed: 7,
      depreciated: 9041.67,
      bookValue: 52958.33,
    });
    expect(depreciation(48000, day('2020-01-01'), 48, day('2026-10-20'))?.bookValue).toBe(0);
  });

  it('skips weekends when counting working days', () => {
    // 2026-11-03 is a Tuesday; three working days later is Friday, five is the next Tuesday.
    expect(addWorkingDays(day('2026-11-03'), 3).toISOString().slice(0, 10)).toBe('2026-11-06');
    expect(addWorkingDays(day('2026-11-03'), 5).toISOString().slice(0, 10)).toBe('2026-11-10');
    expect(addWorkingDays(day('2026-11-03'), 0).toISOString().slice(0, 10)).toBe('2026-11-03');
  });

  it('has no book value without a cost or purchase date', () => {
    expect(depreciation(null, day('2026-01-01'), 48, day('2026-10-20'))).toBeNull();
    expect(depreciation(1000, null, 48, day('2026-10-20'))).toBeNull();
  });
});

describe('asset tags and serial numbers', () => {
  it('pads generated tags', () => {
    expect(formatTag('LAP', 7)).toBe('LAP-0007');
    expect(formatTag('SWL', 12345)).toBe('SWL-12345');
  });

  it('treats serials as case-insensitive and blanks as none', () => {
    expect(normaliseSerial('  ab12 ')).toBe('AB12');
    expect(normaliseSerial('   ')).toBeNull();
    expect(normaliseSerial(null)).toBeNull();
    expect(normaliseSerial(undefined)).toBeNull();
  });
});

describe('category codes', () => {
  it('derives a stable code from the name', () => {
    expect(categoryCode('Software Licence')).toBe('software_licence');
    expect(categoryCode('  ID  Card! ')).toBe('id_card');
  });
});

describe('custom fields', () => {
  const defs = validateFieldDefs([
    { key: 'ram', label: 'RAM', type: 'text', required: true },
    { key: 'seat_count', label: 'Seat Count', type: 'number' },
    { key: 'renewal', label: 'Renewal', type: 'date' },
  ]);

  it('coerces values and drops blanks', () => {
    expect(cleanCustomFields(defs, { ram: ' 16 GB ', seat_count: '25', renewal: '' })).toEqual({
      ram: '16 GB',
      seat_count: 25,
    });
  });

  it('rejects unknown, missing, and malformed values', () => {
    expect(() => cleanCustomFields(defs, { ram: '8', imei: '1' })).toThrow(/not a field/);
    expect(() => cleanCustomFields(defs, {})).toThrow(/RAM is required/);
    expect(() => cleanCustomFields(defs, { ram: '8', seat_count: 'many' })).toThrow(/number/);
    expect(() => cleanCustomFields(defs, { ram: '8', renewal: '31/03/2027' })).toThrow(/date/);
  });

  it('checks definitions', () => {
    expect(() => validateFieldDefs([{ key: 'Bad Key', label: 'x', type: 'text' }])).toThrow(/lowercase/);
    expect(() => validateFieldDefs([{ key: 'a', label: '  ', type: 'text' }])).toThrow(/label/);
    expect(() =>
      validateFieldDefs([
        { key: 'a', label: 'A', type: 'text' },
        { key: 'a', label: 'Again', type: 'text' },
      ]),
    ).toThrow(/twice/);
  });

  it('reads stored definitions defensively', () => {
    expect(parseFieldDefs(null)).toEqual([]);
    expect(parseFieldDefs([{ key: 'ram', label: 'RAM', type: 'odd' }, { label: 'no key' }])).toEqual([
      { key: 'ram', label: 'RAM', type: 'text', required: false },
    ]);
  });
});

describe('asset lifecycle', () => {
  it('allows exactly the agreed moves', () => {
    const moves = Object.entries(NEXT_STATUSES)
      .flatMap(([from, targets]) => targets.map((to) => `${from}>${to}`))
      .sort();
    expect(moves).toEqual(
      [
        'in_stock>allocated',
        'in_stock>under_maintenance',
        'in_stock>retired',
        'allocated>in_stock',
        'allocated>lost',
        'allocated>under_maintenance',
        'under_maintenance>in_stock',
        'under_maintenance>retired',
        'lost>in_stock',
        'lost>written_off',
        'retired>disposed',
      ].sort(),
    );
  });

  it('treats disposed and written off as final', () => {
    expect(NEXT_STATUSES.disposed).toEqual([]);
    expect(NEXT_STATUSES.written_off).toEqual([]);
    expect(() => assertMove('disposed', 'in_stock')).toThrow(/cannot move/);
  });

  it('blocks allocating anything not in stock', () => {
    expect(canMove('in_stock', 'allocated')).toBe(true);
    for (const from of ['under_maintenance', 'lost', 'retired', 'disposed', 'written_off'] as const) {
      expect(canMove(from, 'allocated')).toBe(false);
    }
  });

  it('only returns good assets to stock', () => {
    expect(RETURN_STATUS.good).toBe('in_stock');
    expect(RETURN_STATUS.damaged).toBe('under_maintenance');
    expect(RETURN_STATUS.requires_repair).toBe('under_maintenance');
    expect(RETURN_STATUS.missing_components).toBe('under_maintenance');
  });
});

describe('report references', () => {
  it('pads the ticket number', () => {
    expect(ticketReference(42)).toBe('AT-000042');
    expect(ticketReference(1234567)).toBe('AT-1234567');
    expect(requestReference(7)).toBe('AR-000007');
  });
});
