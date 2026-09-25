const fs = require('fs');
const path = require('path');

const HISTORY_STEP_MS = 15_000;
const HISTORY_POINTS = 240;
const BOOT_DELAY_MS = 4000;
const POD_START_DELAY_MS = 6000;
const NODES = ['k3s-master', 'k3s-worker-1', 'k3s-worker-2'];

const MOCK_APPS = [
  { namespace: 'media', deployment: 'jellyfin-deployment', name: 'Jellyfin', replicas: 1 },
  { namespace: 'media', deployment: 'plex-deployment', name: 'Plex', replicas: 1 },
  { namespace: 'media', deployment: 'jellyseerr', name: 'Jellyseerr', replicas: 1 },
  { namespace: 'media', deployment: 'sonarr', name: 'Sonarr', replicas: 1 },
  { namespace: 'media', deployment: 'radarr', name: 'Radarr', replicas: 2 },
  { namespace: 'media', deployment: 'prowlarr', name: 'Prowlarr', replicas: 1 },
  { namespace: 'media', deployment: 'qbittorrent', name: 'qBittorrent', replicas: 0 },
  { namespace: 'monitoring', deployment: 'grafana', name: 'Grafana', replicas: 1 },
  { namespace: 'monitoring', deployment: 'prometheus', name: 'Prometheus', replicas: 1 },
  { namespace: 'tools', deployment: 'nextcloud', name: 'Nextcloud', replicas: 1, failing: true },
  { namespace: 'tools', deployment: 'vaultwarden', name: 'Vaultwarden', replicas: 1 },
  { namespace: 'tools', deployment: 'home-assistant', name: 'Home Assistant', replicas: 1 },
  { namespace: 'ai', deployment: 'ollama', name: 'Ollama', replicas: 1 },
  { namespace: 'ai', deployment: 'librechat', name: 'LibreChat', replicas: 1 },
  { namespace: 'ai', deployment: 'podinfo', name: 'Podinfo', replicas: 3 }
];

const LOG_TEMPLATES = [
  'INFO  http: GET /health 200 1.2ms',
  'INFO  scheduler: job "library-scan" finished in 842ms',
  'DEBUG cache: hit ratio 0.93 (entries=4211)',
  'INFO  http: GET /api/v1/items?limit=50 200 18ms',
  'WARN  db: slow query took 612ms',
  'INFO  worker: processed 12 tasks',
  'INFO  http: POST /api/v1/session 201 44ms',
  'DEBUG gc: pause 3.1ms heap=182MiB'
];

function createRandom(seed) {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
}

function createWalk({ base, amplitude, min, max, seed }) {
  const random = createRandom(seed);
  let value = base;
  return () => {
    value = Math.min(max, Math.max(min, value + (random() - 0.5) * amplitude));
    return Number(value.toFixed(2));
  };
}

function podName(deployment, index) {
  const suffix = createRandom(deployment.length * 97 + index)().toString(36).slice(2, 7);
  return `${deployment}-7c9f8-${suffix}`;
}

function createMockServices({ iconsDir }) {
  const bootedAt = Date.now();
  let isOn = true;
  let onSince = Date.now() - (3 * 86_400_000 + 7 * 3_600_000 + 42 * 60_000);
  let pendingPower = null;

  const deployments = new Map(MOCK_APPS.map((app) => [
    `${app.namespace}/${app.deployment}`,
    {
      ...app,
      desired: app.replicas,
      readySince: app.replicas > 0 ? bootedAt - POD_START_DELAY_MS : null,
      cpuRequest: '250m',
      cpuLimit: '1',
      memoryRequest: '512Mi',
      memoryLimit: '1Gi'
    }
  ]));

  const walks = {
    cpu: createWalk({ base: 34, amplitude: 9, min: 4, max: 96, seed: 7 }),
    memory: createWalk({ base: 52, amplitude: 2, min: 30, max: 78, seed: 11 }),
    networkRx: createWalk({ base: 14, amplitude: 7, min: 0, max: 90, seed: 13 }),
    gpu: createWalk({ base: 22, amplitude: 8, min: 0, max: 100, seed: 17 }),
    gpuTemp: createWalk({ base: 54, amplitude: 1.6, min: 36, max: 82, seed: 19 }),
    powerW: createWalk({ base: 118, amplitude: 12, min: 62, max: 210, seed: 23 }),
    diskUsage: createWalk({ base: 63, amplitude: 0.15, min: 60, max: 67, seed: 29 }),
    nodesUp: () => NODES.length
  };

  const history = Object.fromEntries(Object.keys(walks).map((key) => [key, []]));
  const firstTimestamp = Date.now() - (HISTORY_POINTS - 1) * HISTORY_STEP_MS;
  for (let i = 0; i < HISTORY_POINTS; i += 1) {
    Object.entries(walks).forEach(([key, next]) => {
      history[key].push({ timestamp: firstTimestamp + i * HISTORY_STEP_MS, value: next() });
    });
  }

  function advanceHistory() {
    const now = Date.now();
    const last = history.cpu.at(-1).timestamp;
    for (let timestamp = last + HISTORY_STEP_MS; timestamp <= now; timestamp += HISTORY_STEP_MS) {
      Object.entries(walks).forEach(([key, next]) => {
        history[key].push({ timestamp, value: next() });
        history[key].shift();
      });
    }
  }

  function iconFor(deployment) {
    const candidates = [deployment, deployment.replace(/-deploy(ment)?$/, '')];
    const match = candidates.find((name) => fs.existsSync(path.join(iconsDir, `${name}.png`)));
    return match ? `/img/icons/${match}.png` : null;
  }

  function statusOf(entry) {
    const now = Date.now();
    const isReady = entry.readySince !== null && now >= entry.readySince;
    const replicas = entry.desired;
    const ready = entry.failing ? 0 : (isReady ? replicas : 0);
    const podPlacements = Array.from({ length: replicas }, (_, index) => ({
      pod: podName(entry.deployment, index),
      node: NODES[(entry.deployment.length + index) % NODES.length],
      phase: entry.failing ? 'Failed' : (isReady ? 'Running' : 'Pending')
    }));

    return {
      replicas,
      readyReplicas: ready,
      availableReplicas: ready,
      unavailableReplicas: replicas - ready,
      desiredReplicas: entry.desired,
      podPlacements,
      cpuRequest: entry.cpuRequest,
      cpuLimit: entry.cpuLimit,
      memoryRequest: entry.memoryRequest,
      memoryLimit: entry.memoryLimit
    };
  }

  function appsList() {
    return [...deployments.values()]
      .map((entry) => ({
        name: entry.name,
        url: `https://${entry.deployment.replace(/-deployment$/, '')}.example.com`,
        icon: iconFor(entry.deployment),
        deployment: entry.deployment,
        namespace: entry.namespace
      }))
      .sort((a, b) => a.namespace.localeCompare(b.namespace) || a.name.localeCompare(b.name));
  }

  function deploymentStatus() {
    return Object.fromEntries([...deployments.entries()].map(([key, entry]) => [key, statusOf(entry)]));
  }

  function findDeployment(namespace, deployment) {
    const entry = deployments.get(`${namespace}/${deployment}`);
    if (!entry) throw new Error(`Deployment ${namespace}/${deployment} not found`);
    return entry;
  }

  function settlePower() {
    if (pendingPower && Date.now() >= pendingPower.at) {
      isOn = pendingPower.target;
      if (isOn) onSince = Date.now();
      pendingPower = null;
    }
  }

  function schedulePower(target, delayMs) {
    pendingPower = { target, at: Date.now() + delayMs };
    return { ok: true, status: 200, body: { success: true } };
  }

  return {
    kubernetesService: {
      init: async () => {},
      isAvailable: () => true,
      async scaleDeployment(namespace, deployment, replicas) {
        const entry = findDeployment(namespace, deployment);
        const count = Number.parseInt(replicas, 10);
        entry.desired = count;
        entry.readySince = count > 0 ? Date.now() + POD_START_DELAY_MS : null;
        return { success: true, replicas: count };
      },
      async updatePrimaryContainerRequests(namespace, deployment, { cpuRequest, memoryRequest }) {
        const entry = findDeployment(namespace, deployment);
        if (cpuRequest) entry.cpuRequest = String(cpuRequest);
        if (memoryRequest) entry.memoryRequest = String(memoryRequest);
        return { success: true, cpuRequest: entry.cpuRequest, memoryRequest: entry.memoryRequest };
      },
      async getDeploymentPodLogs(namespace, deployment, tailLines) {
        const entry = findDeployment(namespace, deployment);
        const lines = Math.min(Math.max(1, Number(tailLines) || 150), 2000);
        const { podPlacements } = statusOf(entry);
        const pods = podPlacements.map(({ pod }, podIndex) => {
          if (entry.failing) {
            return { name: pod, logs: '', error: 'container "app" in pod is waiting to start: CrashLoopBackOff' };
          }
          const random = createRandom(pod.length * 31 + podIndex);
          const start = Date.now() - lines * 2000;
          const logs = Array.from({ length: lines }, (_, index) => {
            const time = new Date(start + index * 2000).toISOString();
            return `${time} ${LOG_TEMPLATES[Math.floor(random() * LOG_TEMPLATES.length)]}`;
          }).join('\n');
          return { name: pod, logs };
        });
        return { pods, tailLines: lines };
      }
    },
    appsService: {
      async getStatePayload() {
        return { type: 'appsState', apps: appsList(), deployments: deploymentStatus() };
      },
      getDeployments: async () => deploymentStatus(),
      getAppsList: async () => appsList()
    },
    prometheusService: {
      async getOverview() {
        advanceHistory();
        if (!isOn) return { error: 'Monitoring data could not be loaded' };
        const series = Object.fromEntries(Object.entries(history).map(([key, points]) => [key, [...points]]));
        return {
          start: series.cpu[0].timestamp,
          end: series.cpu.at(-1).timestamp,
          step: HISTORY_STEP_MS / 1000,
          series,
          units: { cpu: '%', memory: '%', networkRx: 'Mbit/s', gpu: '%', gpuTemp: '°C', powerW: 'W', diskUsage: '%', nodesUp: '' }
        };
      },
      resolvePcUptimeMs: async () => (isOn ? Date.now() - onSince : 0)
    },
    pcStatusService: {
      async getPayload() {
        settlePower();
        return { is_on: isOn, uptime_ms: isOn ? Date.now() - onSince : 0 };
      }
    },
    powerService: {
      pressButton: async () => schedulePower(!isOn, BOOT_DELAY_MS),
      hardShutdown: async () => schedulePower(false, 1500)
    }
  };
}

module.exports = { createMockServices };
