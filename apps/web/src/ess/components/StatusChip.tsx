type StatusChipProps = {
  status: string;
};

function chipClass(status: string) {
  const key = status.replace(/\s+/g, '').toLowerCase();
  return `ess-chip ess-chip-${key}`;
}

export function StatusChip({ status }: StatusChipProps) {
  return <span className={chipClass(status)}>{status}</span>;
}
