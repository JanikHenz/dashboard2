export type SeriesPoint = { timestamp: number; value: number };

export type MetricKey = 'cpu' | 'memory' | 'gpu' | 'gpuTemp' | 'diskUsage' | 'nodesUp' | 'networkRx' | 'powerW';

export type StatusMessage = { type: 'status'; is_on?: boolean; uptime_ms?: number; error?: string };

export type MonitoringMessage = {
  type: 'monitoring';
  error?: string;
  start?: number;
  end?: number;
  series?: Partial<Record<MetricKey, SeriesPoint[]>>;
};

export type App = {
  name: string;
  url: string | null;
  icon: string | null;
  deployment: string;
  namespace: string;
};

export type PodPlacement = { pod: string; node: string | null; phase: string | null };

export type Deployment = {
  replicas?: number;
  readyReplicas?: number;
  availableReplicas?: number;
  unavailableReplicas?: number;
  desiredReplicas?: number;
  podPlacements?: PodPlacement[];
  cpuRequest?: string | null;
  cpuLimit?: string | null;
  memoryRequest?: string | null;
  memoryLimit?: string | null;
  error?: string;
};

export type AppsStateMessage = {
  type: 'appsState';
  apps?: App[];
  deployments?: Record<string, Deployment>;
  k8sUnavailable?: boolean;
  error?: string;
};

export type PodLog = { name: string; logs: string | null; error?: string };

export type LedState = 'online' | 'pending' | 'offline' | 'idle';
