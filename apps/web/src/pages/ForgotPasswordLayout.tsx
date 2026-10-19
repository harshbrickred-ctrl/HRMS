import type { ReactNode } from 'react';
import { ThemeToggle } from '../theme/ThemeToggle';
import './ForgotPassword.css';

type Props = {
  children: ReactNode;
  title: string;
  subtitle: string;
};

export function ForgotPasswordLayout({ children, title, subtitle }: Props) {
  return (
    <div className="fp-page">
      <div className="fp-theme">
        <ThemeToggle />
      </div>
      <div className="fp-panel" role="main">
        <p className="fp-brand">PeopleOS</p>
        <h1>{title}</h1>
        <p className="fp-sub">{subtitle}</p>
        {children}
      </div>
    </div>
  );
}
