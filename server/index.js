const express = require('express');
const fs = require('fs');
const http = require('http');
const path = require('path');
const {
  PORT,
  projectRoot,
  appsConfigPath,
  distDir,
  iconsDir,
  MOCK,
  PC_IP,
  PI_IP,
  PROMETHEUS_BASE_URL,
  STATUS_BROADCAST_MS,
  MONITORING_BROADCAST_MS,
  APPS_BROADCAST_MS
} = require('./config');
const { registerRoutes } = require('./routes/registerRoutes');
const { createDashboardWebSocket } = require('./websocket');

function createRealServices() {
  const { createPrometheusService } = require('./services/prometheusService');
  const { createPcStatusService } = require('./services/pcStatusService');
  const { createKubernetesService } = require('./services/kubernetesService');
  const { createAppsService } = require('./services/appsService');
  const { createPowerService } = require('./services/powerService');

  const kubernetesService = createKubernetesService();
  const prometheusService = createPrometheusService({
    pcIp: PC_IP,
    fallbackUrls: [PROMETHEUS_BASE_URL, `http://${PC_IP}:30090`, 'http://127.0.0.1:30090']
  });

  return {
    kubernetesService,
    prometheusService,
    pcStatusService: createPcStatusService({ pcIp: PC_IP, prometheusService }),
    appsService: createAppsService({
      iconsDir,
      kubernetesService,
      appsConfigPath
    }),
    powerService: createPowerService({ piIp: PI_IP })
  };
}

function createServices() {
  if (!MOCK) return createRealServices();
  console.log('MOCK mode: serving simulated homelab data');
  return require('./mock').createMockServices({ iconsDir });
}

const app = express();
const server = http.createServer(app);
const services = createServices();

app.use(express.json());
registerRoutes(app, services);

const pages = { '/': 'index.html', '/index.html': 'index.html', '/app-detail.html': 'app-detail.html' };
Object.entries(pages).forEach(([route, file]) => {
  app.get(route, (_req, res) => {
    const filePath = path.join(distDir, file);
    if (!fs.existsSync(filePath)) {
      res.status(503).type('text').send('Frontend is not built. Run "npm run build" or use "npm run dev".');
      return;
    }
    res.sendFile(filePath);
  });
});
app.use(express.static(distDir, { index: false }));

const ws = createDashboardWebSocket(server, services);

services.kubernetesService.init().finally(() => {
  server.listen(PORT, () => {
    console.log(`Dashboard running on port ${PORT}`);
    setInterval(ws.broadcastStatus, STATUS_BROADCAST_MS);
    setInterval(ws.broadcastMonitoring, MONITORING_BROADCAST_MS);
    setInterval(ws.broadcastAppsState, APPS_BROADCAST_MS);
  });
});
