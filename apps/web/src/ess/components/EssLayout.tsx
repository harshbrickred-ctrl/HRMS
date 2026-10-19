import { Outlet } from 'react-router-dom';
import { EssToast } from './EssToast';
import '../ess.css';

export function EssLayout() {
  return (
    <>
      <Outlet />
      <EssToast />
    </>
  );
}
