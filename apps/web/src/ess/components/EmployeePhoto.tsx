type EmployeePhotoProps = {
  src: string;
  name: string;
  size?: 'sm' | 'md' | 'lg';
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0] ?? '?').slice(0, 2).toUpperCase();
}

export function EmployeePhoto({ src, name, size = 'md' }: EmployeePhotoProps) {
  if (!src) {
    return (
      <span className={`ess-employee-photo ess-employee-photo--${size}`} aria-hidden>
        {initials(name)}
      </span>
    );
  }
  return (
    <img
      className={`ess-employee-photo ess-employee-photo--${size}`}
      src={src}
      alt={`${name} photo`}
    />
  );
}
