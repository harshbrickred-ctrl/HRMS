type EmployeePhotoProps = {
  src: string;
  name: string;
  size?: 'sm' | 'md' | 'lg';
};

export function EmployeePhoto({ src, name, size = 'md' }: EmployeePhotoProps) {
  return (
    <img
      className={`ess-employee-photo ess-employee-photo--${size}`}
      src={src}
      alt={`${name} photo`}
    />
  );
}
