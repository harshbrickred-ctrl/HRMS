import type { ReactNode } from 'react';
import './mobile-phone-frame.css';

export function MobilePhoneFrame({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`mobile-phone-frame ${className}`.trim()}
      aria-label="Phone frame"
    >
      <div className="mobile-phone-frame__notch" aria-hidden />
      <div className="mobile-phone-frame__screen">{children}</div>
    </div>
  );
}
