export type CtcSalary = {
  ctc: number;
  basic: number;
  hra: number;
  pf: number;
  statutoryBonus: number;
  special: number;
  gratuity: number;
  leaveEncashment: number;
  gross: number;
};

export function salaryFromCtc(ctc: number): CtcSalary {
  const annual = Math.round(Math.max(0, ctc));
  const monthly = Math.round(annual / 12);
  const basic = Math.round(monthly * 0.5);
  const hra = Math.round(basic * 0.5);
  const statutoryBonus = 1400;
  const pf = Math.round((Math.min(basic, 25000) * 12) / 100);
  const special = Math.round(monthly - basic - hra - statutoryBonus);
  const gratuity = Math.round((basic / 30) * 26);
  const leaveEncashment = Math.round((basic / 20) * 10);
  return {
    ctc: annual,
    basic,
    hra,
    pf,
    statutoryBonus,
    special,
    gratuity,
    leaveEncashment,
    gross: basic + hra + Math.max(0, special) + statutoryBonus,
  };
}
