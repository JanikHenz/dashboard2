import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles.css';
import { DialogProvider } from '@/components/DialogProvider';
import { lockDetailPage } from '@/lib/detailAccess';
import { DashboardApp } from './DashboardApp';

// Jeder Besuch des Dashboards sperrt die Detailseiten wieder. Das gehört zum Scanner-Spass.
lockDetailPage();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DialogProvider>
      <DashboardApp />
    </DialogProvider>
  </StrictMode>
);
