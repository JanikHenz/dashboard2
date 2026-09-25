import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles.css';
import { DialogProvider } from '@/components/DialogProvider';
import { dashboardUrl, isDetailPageUnlocked } from '@/lib/detailAccess';
import { DetailApp, MissingTarget } from './DetailApp';

if (!isDetailPageUnlocked()) {
  window.location.replace(dashboardUrl());
} else {
  const params = new URLSearchParams(window.location.search);
  const namespace = params.get('namespace');
  const deployment = params.get('deployment');

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <DialogProvider>
        {namespace && deployment ? <DetailApp target={{ namespace, deployment }} /> : <MissingTarget />}
      </DialogProvider>
    </StrictMode>
  );
}
