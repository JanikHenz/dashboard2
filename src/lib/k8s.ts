import type { Deployment, LedState } from './types';

export function deploymentKey(namespace: string, name: string) {
  return `${namespace}/${name}`;
}

export function deploymentState(deployment: Deployment | undefined): LedState {
  if (!deployment || deployment.error) return 'offline';

  const replicas = Number(deployment.replicas) || 0;
  const ready = Number(deployment.readyReplicas) || 0;
  const desired = Number(deployment.desiredReplicas) || 0;

  if (desired === 0 && replicas === 0) return 'idle';
  if (replicas > 0 && ready === replicas) return 'online';
  return 'pending';
}

export const DEPLOYMENT_STATE_LABELS: Record<LedState, string> = {
  online: 'bereit',
  pending: 'startet oder ist nicht bereit',
  offline: 'nicht erreichbar',
  idle: 'gestoppt'
};

export const DEPLOYMENT_STATE_SHORT: Record<LedState, string> = {
  online: 'Bereit',
  pending: 'Startet',
  offline: 'Fehler',
  idle: 'Gestoppt'
};

export function podPhaseState(phase: string | null | undefined): LedState {
  switch (phase) {
    case 'Running':
      return 'online';
    case 'Pending':
      return 'pending';
    case 'Failed':
    case 'Unknown':
      return 'offline';
    default:
      return 'idle';
  }
}
