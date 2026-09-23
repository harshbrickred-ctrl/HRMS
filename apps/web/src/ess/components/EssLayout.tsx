import { Outlet } from 'react-router-dom';
import { EssDataProvider } from '../mock/EssDataContext';
import { EssToast } from './EssToast';
import '../ess.css';

export function EssLayout() {
  return (
    <EssDataProvider>
      <Outlet />
      <EssToast />
    </EssDataProvider>
  );
}
