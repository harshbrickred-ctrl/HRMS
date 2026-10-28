type StatusChipProps = {
  status: string;
  label?: string;
};

function chipClass(status: string) {
  const key = status.replace(/\s+/g, '').toLowerCase();
  return `ess-chip ess-chip-${key}`;
}

export function StatusChip({ status, label }: StatusChipProps) {
  return <span className={chipClass(status)}>{label ?? status}</span>;
}
