import { AppraisalsService } from './appraisals.service';
import type { CycleKpiDto } from './dto/appraisal.dto';

describe('appraisal KPI weightage rules', () => {
  const service = Object.create(AppraisalsService.prototype) as AppraisalsService;
  const validate = (kpis: CycleKpiDto[]) => service['validateKpis'](kpis);
  const categories: CycleKpiDto[] = [
    { title: 'New KPI 1', category: 'New KPI 1', weight: 70, subKpiName: 'Test 1', subWeight: 30 },
    { title: 'New KPI 1', category: 'New KPI 1', weight: 70, subKpiName: 'Test 2', subWeight: 30 },
    { title: 'New KPI 1', category: 'New KPI 1', weight: 70, subKpiName: 'Test 3', subWeight: 40 },
    { title: 'New KPI 2', category: 'New KPI 2', weight: 30, subKpiName: 'Test 1', subWeight: 50 },
    { title: 'New KPI 2', category: 'New KPI 2', weight: 30, subKpiName: 'Test 2', subWeight: 50 },
  ];

  it('accepts separate parent and per-KPI sub-KPI totals of 100%', () => {
    expect(() => validate(categories)).not.toThrow();
  });

  it('rejects parent totals above or below 100%', () => {
    expect(() => validate(categories.map((kpi) => kpi.title === 'New KPI 1' ? { ...kpi, weight: 71 } : kpi)))
      .toThrow(/category weights must total exactly 100%/i);
    expect(() => validate(categories.map((kpi) => kpi.title === 'New KPI 1' ? { ...kpi, weight: 69 } : kpi)))
      .toThrow(/category weights must total exactly 100%/i);
  });

  it('rejects sub-KPI totals that do not independently equal 100%', () => {
    const changed = categories.map((kpi, index) => index === 0 ? { ...kpi, subWeight: 29 } : kpi);
    expect(() => validate(changed)).toThrow(/Sub-KPI weights .* total exactly 100%/i);
  });

  it('accepts weights with up to three decimal places', () => {
    const decimalWeights: CycleKpiDto[] = [
      { title: 'Delivery', category: 'Delivery', weight: 33.333, subKpiName: 'Quality', subWeight: 50.125 },
      { title: 'Delivery', category: 'Delivery', weight: 33.333, subKpiName: 'Timeliness', subWeight: 49.875 },
      { title: 'Collaboration', category: 'Collaboration', weight: 66.667, subKpiName: 'Teamwork', subWeight: 100 },
    ];
    expect(() => validate(decimalWeights)).not.toThrow();
  });

  it('uses the parent allocation only when calculating the final rating contribution', () => {
    const weightedRating = service['weightedRating']([
      { selfRating: 5, cycleKpi: { weight: 70, subWeight: 100, subKpiName: 'Delivery' } },
      { selfRating: 3, cycleKpi: { weight: 30, subWeight: 100, subKpiName: 'Collaboration' } },
    ], 'selfRating');

    expect(weightedRating).toBeCloseTo(4.4, 8);
  });

  it('validates employee CSV imports with independent child totals', async () => {
    const prisma = {
      appraisalCycle: { findFirst: jest.fn().mockResolvedValue({ status: 'Draft', name: 'FY 2026' }) },
      employee: { findMany: jest.fn().mockResolvedValue([{ employeeCode: 'EMP01', department: null }]) },
      employeeAppraisal: { findMany: jest.fn().mockResolvedValue([]) },
    };
    Object.defineProperty(service, 'prisma', { value: prisma });
    const headers = 'EmployeeCode,EmployeeName,Department,Designation,AppraisalPeriod,KPICategory,KPIName,KPIWeightage,SubKPIName,SubKPIWeightage,SelfRating,SelfJustification,ManagerRating,ManagerRemarks';
    const rows = [
      ['', '', '', '', 'FY 2026', 'Operations', 'New KPI 1', '70', 'Test 1', '30', '', '', '', ''],
      ['', '', '', '', 'FY 2026', 'Operations', 'New KPI 1', '70', 'Test 2', '30', '', '', '', ''],
      ['', '', '', '', 'FY 2026', 'Operations', 'New KPI 1', '70', 'Test 3', '40', '', '', '', ''],
      ['', '', '', '', 'FY 2026', 'Operations', 'New KPI 2', '30', 'Test 1', '50', '', '', '', ''],
      ['', '', '', '', 'FY 2026', 'Operations', 'New KPI 2', '30', 'Test 2', '50', '', '', '', ''],
    ];
    const csv = [headers, ...rows.map((row) => row.join(','))].join('\n');

    const preview = await service.previewImport('tenant', { cycleId: 'cycle', fileName: 'weights.csv', csv });

    expect(preview.canImport).toBe(true);
    expect(preview.errors).toEqual([]);

    const invalidPreview = await service.previewImport('tenant', {
      cycleId: 'cycle',
      fileName: 'weights.csv',
      csv: csv.replace(',Test 3,40,', ',Test 3,41,'),
    });

    expect(invalidPreview.canImport).toBe(false);
    expect(invalidPreview.errors.some((error) => /expected 100% independently/i.test(error.message))).toBe(true);

    prisma.appraisalCycle.findFirst.mockResolvedValue({ status: 'Active', name: 'FY 2026' });
    const activeCycleCsv = csv.replace(/\n,/g, '\nEMP01,');
    const activeCyclePreview = await service.previewImport('tenant', {
      cycleId: 'cycle',
      fileName: 'weights.csv',
      csv: activeCycleCsv,
    });

    expect(activeCyclePreview.canImport).toBe(true);

    prisma.employeeAppraisal.findMany.mockResolvedValue([{ employee: { employeeCode: 'EMP01' } }]);
    const duplicatePreview = await service.previewImport('tenant', {
      cycleId: 'cycle',
      fileName: 'weights.csv',
      csv: activeCycleCsv,
    });

    expect(duplicatePreview.canImport).toBe(false);
    expect(duplicatePreview.errors.some((error) => error.message.includes('already has an appraisal'))).toBe(true);
  });
});
