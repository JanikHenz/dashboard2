const fs = require('fs');
const path = require('path');

const SYSTEM_NAMESPACES = new Set(['kube-system', 'kube-public', 'kube-node-lease']);
const URL_ANNOTATION = 'dashboard.pinned.dev/url';
const NAME_ANNOTATION = 'dashboard.pinned.dev/name';

function parseSimpleYamlApps(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return new Map();
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    let currentNamespace = null;
    let currentApp = null;
    const map = new Map();

    function parseKeyValue(str, target) {
      const colonIdx = str.indexOf(':');
      if (colonIdx === -1) return;
      const key = str.slice(0, colonIdx).trim();
      let val = str.slice(colonIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      } else if (val === 'null' || val === '~' || val === '') {
        val = null;
      }
      target[key] = val;
    }

    for (const rawLine of lines) {
      const line = rawLine.replace(/#.*$/, '');
      const trimmed = line.trim();
      if (!trimmed) continue;

      const nsMatch = line.match(/^ {2}([a-zA-Z0-9_-]+):$/);
      if (nsMatch) {
        currentNamespace = nsMatch[1];
        continue;
      }

      if (line.match(/^ {4}-\s*/)) {
        currentApp = {};
        const rest = line.replace(/^ {4}-\s*/, '').trim();
        if (rest) {
          parseKeyValue(rest, currentApp);
        }
        continue;
      }

      if (currentApp && line.match(/^ {6}/)) {
        parseKeyValue(trimmed, currentApp);
        if (currentApp.deployment && currentNamespace) {
          map.set(deploymentKey(currentNamespace, currentApp.deployment), {
            ...currentApp,
            namespace: currentNamespace
          });
        }
      }
    }
    return map;
  } catch (err) {
    console.error('Failed to parse apps.yml:', err.message);
    return new Map();
  }
}

function formatDefaultAppName(deploymentName) {
  if (!deploymentName) return '';
  return deploymentName
    .replace(/-deployment$/, '')
    .replace(/-deploy$/, '')
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function extractPrimaryContainerResources(deployment) {
  const c = deployment?.spec?.template?.spec?.containers?.[0];
  const r = c?.resources;
  if (!r) {
    return {
      cpuRequest: null,
      cpuLimit: null,
      memoryRequest: null,
      memoryLimit: null
    };
  }
  const req = r.requests || {};
  const lim = r.limits || {};
  return {
    cpuRequest: req.cpu ?? null,
    cpuLimit: lim.cpu ?? null,
    memoryRequest: req.memory ?? null,
    memoryLimit: lim.memory ?? null
  };
}

function iconNameCandidates(deploymentName) {
  const candidates = [deploymentName];
  if (deploymentName.endsWith('-deployment')) {
    candidates.push(deploymentName.slice(0, -'-deployment'.length));
  }
  if (deploymentName.endsWith('-deploy')) {
    candidates.push(deploymentName.slice(0, -'-deploy'.length));
  }
  return [...new Set(candidates)];
}

function deploymentKey(namespace, deploymentName) {
  return `${namespace}/${deploymentName}`;
}

function deploymentMatchesServiceSelector(serviceSelector, deployment) {
  const selector = serviceSelector || {};
  const selectorKeys = Object.keys(selector);
  if (selectorKeys.length === 0) return false;

  const matchLabels = deployment?.spec?.selector?.matchLabels || {};
  const templateLabels = deployment?.spec?.template?.metadata?.labels || {};

  return selectorKeys.every((key) => {
    const expected = String(selector[key]);
    return matchLabels[key] === expected || templateLabels[key] === expected;
  });
}

function ingressUsesTlsForHost(ingress, host) {
  const tlsEntries = ingress?.spec?.tls;
  if (!Array.isArray(tlsEntries) || tlsEntries.length === 0) return false;

  return tlsEntries.some((entry) => {
    const hosts = entry?.hosts;
    if (!Array.isArray(hosts) || hosts.length === 0) return true;
    return hosts.includes(host);
  });
}

function buildHttpUrl(host, routePath, useHttps) {
  const scheme = useHttps ? 'https' : 'http';
  const normalizedPath = routePath && routePath !== '/' ? routePath : '';
  return `${scheme}://${host}${normalizedPath}`;
}

function parseHostFromTraefikMatch(match) {
  if (!match || typeof match !== 'string') return null;
  const hostMatch = match.match(/Host\(`([^`]+)`\)/i);
  return hostMatch ? hostMatch[1] : null;
}

function parsePathPrefixFromTraefikMatch(match) {
  if (!match || typeof match !== 'string') return '/';
  const pathMatch = match.match(/PathPrefix\(`([^`]+)`\)/i);
  return pathMatch ? pathMatch[1] : '/';
}

function entryPointsUseHttps(entryPoints) {
  const values = Array.isArray(entryPoints) ? entryPoints.map((entry) => String(entry).toLowerCase()) : [];
  if (values.some((entry) => entry.includes('secure') || entry === 'https' || entry === 'tls')) {
    return true;
  }
  if (values.some((entry) => entry === 'web' || entry === 'http')) {
    return false;
  }
  return false;
}

function isHttpUrl(value) {
  if (!value || typeof value !== 'string') return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch (_error) {
    return false;
  }
}

function createAppsService({ iconsDir, kubernetesService, appsConfigPath }) {
  const configPath = appsConfigPath || path.join(path.dirname(iconsDir), '..', '..', 'apps.yml');
  const configuredApps = parseSimpleYamlApps(configPath);

  function resolveIconForDeployment(deploymentName) {
    for (const baseName of iconNameCandidates(deploymentName)) {
      for (const ext of ['png', 'svg', 'webp']) {
        const filePath = path.join(iconsDir, `${baseName}.${ext}`);
        if (fs.existsSync(filePath)) {
          return `/img/icons/${baseName}.${ext}`;
        }
      }
    }
    const prefix = deploymentName.split('-')[0];
    if (prefix && prefix !== deploymentName) {
      for (const ext of ['png', 'svg', 'webp']) {
        const filePath = path.join(iconsDir, `${prefix}.${ext}`);
        if (fs.existsSync(filePath)) {
          return `/img/icons/${prefix}.${ext}`;
        }
      }
    }
    return null;
  }

  function buildServiceSelectorIndex(services) {
    const serviceSelectors = new Map();

    for (const service of services) {
      const namespace = service?.metadata?.namespace;
      const name = service?.metadata?.name;
      if (!namespace || !name) continue;
      serviceSelectors.set(deploymentKey(namespace, name), service?.spec?.selector || {});
    }

    return serviceSelectors;
  }

  function registerIngressUrl(urlByDeployment, deployments, namespace, serviceName, host, routePath, useHttps, serviceSelectors) {
    const selector = serviceSelectors.get(deploymentKey(namespace, serviceName));
    if (!selector) return;

    const url = buildHttpUrl(host, routePath, useHttps);
    const pathLength = routePath?.length || 1;

    for (const deployment of deployments) {
      if (deployment?.metadata?.namespace !== namespace) continue;

      const deploymentName = deployment?.metadata?.name;
      if (!deploymentName) continue;

      if (!deploymentMatchesServiceSelector(selector, deployment)) continue;

      const key = deploymentKey(namespace, deploymentName);
      const existing = urlByDeployment.get(key);
      if (!existing) {
        urlByDeployment.set(key, { url, useHttps, pathLength });
        continue;
      }

      if (useHttps && !existing.useHttps) {
        urlByDeployment.set(key, { url, useHttps, pathLength });
        continue;
      }

      if (useHttps === existing.useHttps && pathLength < existing.pathLength) {
        urlByDeployment.set(key, { url, useHttps, pathLength });
      }
    }
  }

  function buildIngressUrlIndex(ingresses, ingressRoutes, services, deployments) {
    const serviceSelectors = buildServiceSelectorIndex(services);
    const urlByDeployment = new Map();

    for (const ingress of ingresses) {
      const namespace = ingress?.metadata?.namespace;
      if (!namespace) continue;

      const rules = ingress?.spec?.rules;
      if (!Array.isArray(rules)) continue;

      for (const rule of rules) {
        const host = rule?.host;
        if (!host) continue;

        const paths = rule?.http?.paths;
        if (!Array.isArray(paths)) continue;

        const useHttps = ingressUsesTlsForHost(ingress, host);
        for (const route of paths) {
          const serviceName = route?.backend?.service?.name;
          if (!serviceName) continue;

          registerIngressUrl(
            urlByDeployment,
            deployments,
            namespace,
            serviceName,
            host,
            route?.path || '/',
            useHttps,
            serviceSelectors
          );
        }
      }
    }

    for (const ingressRoute of ingressRoutes) {
      const namespace = ingressRoute?.metadata?.namespace;
      if (!namespace) continue;

      const routes = ingressRoute?.spec?.routes;
      if (!Array.isArray(routes)) continue;

      const useHttps = entryPointsUseHttps(ingressRoute?.spec?.entryPoints);
      for (const route of routes) {
        const host = parseHostFromTraefikMatch(route?.match);
        if (!host) continue;

        const routePath = parsePathPrefixFromTraefikMatch(route?.match);
        const backendServices = route?.services;
        if (!Array.isArray(backendServices)) continue;

        for (const backend of backendServices) {
          const serviceName = backend?.name;
          if (!serviceName) continue;

          registerIngressUrl(
            urlByDeployment,
            deployments,
            namespace,
            serviceName,
            host,
            routePath,
            useHttps,
            serviceSelectors
          );
        }
      }
    }

    const resolvedUrls = new Map();
    for (const [key, entry] of urlByDeployment.entries()) {
      resolvedUrls.set(key, entry.url);
    }
    return resolvedUrls;
  }

  function getAppMeta(namespace, deploymentName) {
    const direct = configuredApps.get(deploymentKey(namespace, deploymentName));
    if (direct) return direct;
    for (const alt of iconNameCandidates(deploymentName)) {
      const match = configuredApps.get(deploymentKey(namespace, alt));
      if (match) return match;
    }
    return null;
  }

  function deploymentToApp(deployment, ingressUrls) {
    const namespace = deployment?.metadata?.namespace || '';
    const deploymentName = deployment?.metadata?.name || '';
    const annotations = deployment?.metadata?.annotations || {};
    const annotationUrl = annotations[URL_ANNOTATION] || null;
    const ingressUrl = ingressUrls.get(deploymentKey(namespace, deploymentName)) || null;
    const meta = getAppMeta(namespace, deploymentName);
    const url = isHttpUrl(annotationUrl) ? annotationUrl : (ingressUrl || (meta && meta.url !== undefined ? meta.url : null));

    return {
      name: annotations[NAME_ANNOTATION] || meta?.name || formatDefaultAppName(deploymentName),
      url,
      icon: meta?.icon || resolveIconForDeployment(deploymentName),
      deployment: deploymentName,
      namespace
    };
  }

  function filterDeployments(items) {
    return items.filter((deployment) => {
      const namespace = deployment?.metadata?.namespace;
      return namespace && !SYSTEM_NAMESPACES.has(namespace);
    });
  }

  function deploymentsToApps(items, ingressUrls) {
    return items
      .map((deployment) => deploymentToApp(deployment, ingressUrls))
      .filter((app) => Boolean(app.deployment))
      .sort((a, b) => {
        const byNamespace = a.namespace.localeCompare(b.namespace);
        if (byNamespace !== 0) return byNamespace;
        return a.name.localeCompare(b.name);
      });
  }

  async function loadKubernetesAppsContext() {
    if (!kubernetesService.isAvailable()) {
      const fallbackApps = [...configuredApps.values()].sort((a, b) => {
        const byNamespace = a.namespace.localeCompare(b.namespace);
        if (byNamespace !== 0) return byNamespace;
        return a.name.localeCompare(b.name);
      });
      return { apps: fallbackApps, items: [] };
    }

    const [deployments, ingresses, ingressRoutes, services] = await Promise.all([
      kubernetesService.listAllDeployments(),
      kubernetesService.listAllIngresses(),
      kubernetesService.listAllIngressRoutes(),
      kubernetesService.listAllServices()
    ]);

    const items = filterDeployments(deployments);
    const ingressUrls = buildIngressUrlIndex(ingresses, ingressRoutes, services, items);
    const apps = deploymentsToApps(items, ingressUrls);
    const visibleKeys = new Set(
      apps.map((app) => deploymentKey(app.namespace, app.deployment))
    );

    return {
      apps,
      items: items.filter((deployment) => (
        visibleKeys.has(deploymentKey(deployment?.metadata?.namespace, deployment?.metadata?.name))
      ))
    };
  }

  async function buildDeploymentStatus(items) {
    const deploymentStatus = {};

    for (const deployment of items) {
      const namespace = deployment?.metadata?.namespace;
      const deploymentName = deployment?.metadata?.name;
      if (!namespace || !deploymentName) continue;

      const status = deployment?.status || {};
      const spec = deployment?.spec || {};
      let podPlacements = [];
      try {
        podPlacements = await kubernetesService.listPodsForDeployment(namespace, deploymentName);
      } catch (podErr) {
        console.error(`Pods for ${namespace}/${deploymentName}:`, podErr.message);
      }

      deploymentStatus[deploymentKey(namespace, deploymentName)] = {
        replicas: status.replicas || 0,
        readyReplicas: status.readyReplicas || 0,
        availableReplicas: status.availableReplicas || 0,
        unavailableReplicas: status.unavailableReplicas || 0,
        desiredReplicas: spec.replicas ?? 1,
        podPlacements,
        ...extractPrimaryContainerResources(deployment)
      };
    }

    return deploymentStatus;
  }

  async function getStatePayload() {
    try {
      if (!kubernetesService.isAvailable()) {
        const fallbackApps = [...configuredApps.values()].sort((a, b) => {
          const byNamespace = a.namespace.localeCompare(b.namespace);
          if (byNamespace !== 0) return byNamespace;
          return a.name.localeCompare(b.name);
        });
        return { type: 'appsState', apps: fallbackApps, deployments: {}, k8sUnavailable: true };
      }

      const { apps, items } = await loadKubernetesAppsContext();
      return {
        type: 'appsState',
        apps,
        deployments: await buildDeploymentStatus(items)
      };
    } catch (error) {
      console.error('Apps/K8s payload error:', error);
      return { type: 'appsState', apps: [], deployments: {}, error: error.message || 'Loading failed' };
    }
  }

  async function getDeployments() {
    const { items } = await loadKubernetesAppsContext();
    return buildDeploymentStatus(items);
  }

  async function getAppsList() {
    const { apps } = await loadKubernetesAppsContext();
    return apps;
  }

  return {
    getStatePayload,
    getDeployments,
    getAppsList
  };
}

module.exports = { createAppsService };
