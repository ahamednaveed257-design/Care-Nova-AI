import "./src/envLoader.js";

import { createReadStream } from "node:fs";
import { createServer } from "node:http";
import { stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { APP_VERSION, analyzeHealthQuery, analyzeRealtimeHealthQuery, getDeploymentGuide, getDeploymentReadiness, getHybridModelRouterStatus, getLocalAiRuntimeStatus, getModelBlueprint, getOfflineKnowledgeDatabase, getReadinessReport, getTrainingReadiness } from "./src/healthEngine.js";
import { buildModelRouterPreview } from "./src/hybridModelRouter.js";
import {
  analyzeMultimodalIntake,
  buildAdvancedCapabilitySnapshot,
  buildDoctorReadyReport,
  buildEvidenceCitationPacket,
  buildHumanReviewPacket,
  buildPersonalizedPreventionPlan,
  getAdminTrustCenter,
  getAdvancedCapabilityCatalog,
  getEvaluationDashboard,
  getFhirConnectorStatus,
  getOfflinePackManager,
  getSecureBackupPlan,
  runClinicalSafetyTriage
} from "./src/advancedCapabilityEngine.js";
import { clearExternalKnowledgeCache, getExternalKnowledgeForRequest, getExternalKnowledgeStatus } from "./src/externalKnowledgeStore.js";
import { getTemporaryCloudLlmStatus, tryEnhanceAnalyzeResultWithCloudLlm } from "./src/cloudLlmGateway.js";
import { getLocalReasoningAssistStatus, tryEnhanceAnalyzeResultWithLocalReasoning } from "./src/localReasoningGateway.js";
import { clearPatientKnowledgeGraph, getKnowledgeGraphStorageInfo, loadPatientKnowledgeGraph, upsertPatientKnowledgeGraph } from "./src/knowledgeGraphStore.js";
import { getLocalDataMirrorInfo, getLocalDataMirrorStatus, syncLocalDataMirror } from "./src/localDataMirror.js";
import { appendPatientMemory, clearPatientMemory, getMemoryStorageInfo, loadPatientMemory, mergeMemoryHistory } from "./src/memoryStore.js";
import { getMedicineLookupStorageInfo, lookupMedicineEvidence } from "./src/medicineLookupStore.js";
import { startLocalRuntimeProbeLoop } from "./src/openSourceLocalRuntime.js";
import { buildTrustedSourcePlan, evaluateModelQuality, getFhirIntegrationGuide, getGovernanceReadiness, getModelQualityFramework, getOfflinePackCatalog, getReportTemplateCatalog, getTrustedSourceCatalog } from "./src/productIntelligence.js";
import { clearPatientDataRecords, getRecordStorageInfo, loadPatientDataRecords, savePatientDataRecords } from "./src/recordStore.js";
import { evaluateTrainingCalibration, getMachineLearningCapabilityStatus, getTrainingCalibration, getTrainingStorageInfo, loadTrainingState, recordTrainingExample, toPublicTrainingState, trainLocalAgentCalibrator } from "./src/trainingEngine.js";
import { getModelHealthStatus } from "./src/localAiEngine.js";
import { buildAdaptiveExecutionTrace, buildAdaptiveRuntimePolicy } from "./src/agenticRuntime.js";

const rootDir = fileURLToPath(new URL(".", import.meta.url));
const publicDir = resolve(rootDir, "public");
const largeAssetsDir = resolve(rootDir, "large-assets");
const port = parsePort(process.env.PORT || "4173");
const host = process.env.HOST || "127.0.0.1";
const allowedOrigin = process.env.ALLOWED_ORIGIN || "";
const frameAncestors = process.env.FRAME_ANCESTORS || "'self'";
const startedAt = new Date();

function parsePort(value) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 65535) {
    throw new Error(`Invalid PORT value: ${value}`);
  }

  return parsed;
}

function mergeRequestProfile(savedProfile = {}, requestProfile = {}) {
  const pickText = (primary, fallback) => {
    const value = String(primary ?? "").trim();
    return value ? primary : fallback;
  };
  const pickList = (primary, fallback) => {
    if (Array.isArray(primary)) {
      return primary.length ? primary : fallback;
    }

    return String(primary ?? "").trim() ? primary : fallback;
  };

  return {
    ...savedProfile,
    ...requestProfile,
    name: pickText(requestProfile?.name, savedProfile?.name),
    age: pickText(requestProfile?.age, savedProfile?.age),
    conditions: pickList(requestProfile?.conditions, savedProfile?.conditions),
    medications: pickList(requestProfile?.medications, savedProfile?.medications),
    allergies: pickList(requestProfile?.allergies, savedProfile?.allergies),
    baselineBp: pickText(requestProfile?.baselineBp, savedProfile?.baselineBp),
    gender: pickText(requestProfile?.gender, savedProfile?.gender),
    notes: pickText(requestProfile?.notes, savedProfile?.notes)
  };
}

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".webm": "video/webm",
  ".m3u8": "application/vnd.apple.mpegurl",
  ".ts": "video/mp2t",
  ".mpd": "application/dash+xml",
  ".m4s": "video/iso.segment",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8"
};

function getSecurityHeaders() {
  return {
    "Content-Security-Policy": `default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors ${frameAncestors}`,
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
    "X-DNS-Prefetch-Control": "off",
    "X-Content-Type-Options": "nosniff",
    ...(process.env.ENABLE_HSTS === "true" ? { "Strict-Transport-Security": "max-age=31536000; includeSubDomains" } : {})
  };
}

function getCorsHeaders() {
  if (!allowedOrigin) {
    return {};
  }

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Vary": "Origin"
  };
}

function sendJson(response, statusCode, payload, extraHeaders = {}) {
  const body = process.env.CARE_NOVA_PRETTY_JSON === "true"
    ? JSON.stringify(payload, null, 2)
    : JSON.stringify(payload);

  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(body),
    ...getSecurityHeaders(),
    ...getCorsHeaders(),
    ...extraHeaders
  });
  response.end(body);
}

function sendText(response, statusCode, message) {
  response.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
    ...getSecurityHeaders(),
    ...getCorsHeaders()
  });
  response.end(message);
}

function getRuntimeSnapshot() {
  return {
    node: process.version,
    nodeEnv: process.env.NODE_ENV || "development",
    host,
    port,
    uptimeSeconds: Math.round(process.uptime()),
    startedAt: startedAt.toISOString()
  };
}

function getAdaptiveRuntimePolicy(overrides = {}) {
  return buildAdaptiveRuntimePolicy({
    localAi: overrides.localAi || getLocalAiRuntimeStatus(),
    externalKnowledge: overrides.externalKnowledge || getExternalKnowledgeStatus(),
    memory: overrides.memory || getMemoryStorageInfo(),
    records: overrides.records || getRecordStorageInfo(),
    knowledgeGraph: overrides.knowledgeGraph || getKnowledgeGraphStorageInfo(),
    runtime: overrides.runtime || getRuntimeSnapshot()
  });
}

function getHealthPayload() {
  const ai = getLocalAiRuntimeStatus();
  const runtime = getRuntimeSnapshot();
  const externalKnowledge = getExternalKnowledgeStatus();
  const trustedSources = getTrustedSourceCatalog();
  const quality = getModelQualityFramework(runtime);
  const governance = getGovernanceReadiness(runtime);
  const offlinePacks = getOfflinePackCatalog();
  const fhir = getFhirIntegrationGuide();
  const reports = getReportTemplateCatalog();
  const advancedCapabilities = getAdvancedCapabilityCatalog(runtime);
  const evaluationDashboard = getEvaluationDashboard(runtime);
  const machineLearning = getMachineLearningCapabilityStatus(runtime);
  const hybridRouter = getHybridModelRouterStatus();

  return {
    ok: true,
    status: "healthy",
    app: "Care Nova AI",
    version: APP_VERSION,
    mode: "online-offline-local-parity",
    realtime: true,
    install: "pwa-ready",
    ai,
    agenticRuntime: getAdaptiveRuntimePolicy({ localAi: ai, externalKnowledge, runtime }),
    machineLearning: machineLearning.summary,
    runtimeParity: ai.runtimeParity,
    hybridRouter: {
      status: hybridRouter.status,
      mode: hybridRouter.mode,
      processingLabels: hybridRouter.processingLabels,
      summary: hybridRouter.summary,
      connectivity: hybridRouter.connectivity,
      fallbackPolicy: hybridRouter.fallbackPolicy
    },
    externalKnowledge,
    medicineLookup: getMedicineLookupStorageInfo(),
    trustedSources: {
      status: trustedSources.status,
      sourceCount: trustedSources.sourceCount,
      enabledCount: trustedSources.enabledCount
    },
    quality: quality.summary,
    advancedCapabilities: advancedCapabilities.summary,
    evaluationDashboard: evaluationDashboard.summary,
    governance: governance.summary,
    offlinePacks: offlinePacks.summary,
    fhir: fhir.summary,
    reports: reports.summary,
    memory: getMemoryStorageInfo(),
    records: getRecordStorageInfo(),
    knowledgeGraph: getKnowledgeGraphStorageInfo(),
    training: getTrainingStorageInfo(),
    dataMirror: getLocalDataMirrorInfo(),
    deployment: {
      host,
      port,
      globalReady: true,
      readinessEndpoint: "/api/ready",
      releaseGate: "npm run release:check"
    },
    runtime,
    timestamp: new Date().toISOString()
  };
}

const mirrorDataFiles = {
  memory: "data/memory/patient-memory.json",
  records: "data/records/patient-records.json",
  training: "data/training/agent-training-state.json",
  externalKnowledge: "data/external/external-knowledge-cache.json",
  medicineLookup: "data/external/medicine-lookup-cache.json"
};

async function syncDataMirrorSafely(reason, files = []) {
  try {
    return await syncLocalDataMirror(reason, process.env, { files });
  } catch (error) {
    return {
      ...getLocalDataMirrorInfo(),
      status: "mirror-sync-error",
      reason,
      error: error.message || "Unable to sync local OneDrive mirror.",
      syncedAt: new Date().toISOString(),
      fileCount: 0,
      files: []
    };
  }
}

function buildAnalyzeMirrorFiles(patientId) {
  return [
    mirrorDataFiles.memory,
    buildPatientGraphMirrorFile(patientId)
  ];
}

function buildPatientGraphMirrorFile(patientId) {
  return `data/graph/patients/${normalizeDataPatientId(patientId)}.json`;
}

function normalizeDataPatientId(value) {
  const cleaned = String(value || "demo-patient")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return cleaned || "demo-patient";
}

async function readJsonBody(request) {
  const chunks = [];
  let bodyLength = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bodyLength += buffer.length;

    if (bodyLength > 5_000_000) {
      const error = new Error("Request body is too large.");
      error.statusCode = 413;
      throw error;
    }

    chunks.push(buffer);
  }

  const body = Buffer.concat(chunks, bodyLength).toString("utf8");

  if (!body.trim()) {
    return {};
  }

  try {
    return JSON.parse(body);
  } catch {
    const error = new Error("Request body must be valid JSON.");
    error.statusCode = 400;
    error.code = "INVALID_JSON";
    throw error;
  }
}

function getStaticPath(pathname) {
  let decodedPath;

  try {
    decodedPath = decodeURIComponent(pathname === "/" ? "/index.html" : pathname);
  } catch {
    return null;
  }

  const staticRoot = decodedPath.startsWith("/large-assets/")
    ? largeAssetsDir
    : publicDir;
  const staticPath = decodedPath.startsWith("/large-assets/")
    ? decodedPath.replace(/^\/large-assets/, "")
    : decodedPath;
  const targetPath = resolve(staticRoot, `.${staticPath}`);
  const publicPrefix = staticRoot.endsWith(sep) ? staticRoot : `${staticRoot}${sep}`;

  if (targetPath !== staticRoot && !targetPath.startsWith(publicPrefix)) {
    return null;
  }

  return targetPath;
}

async function serveStatic(request, requestUrl, response) {
  const targetPath = getStaticPath(requestUrl.pathname);

  if (!targetPath) {
    sendText(response, 403, "Forbidden");
    return;
  }

  try {
    const fileStats = await stat(targetPath);

    if (!fileStats.isFile()) {
      sendText(response, 404, "Not found");
      return;
    }

    const contentType = mimeTypes[extname(targetPath)] || "application/octet-stream";
    const range = request.headers.range;
    const baseHeaders = {
      "Content-Type": contentType,
      "Cache-Control": "no-store",
      "Accept-Ranges": "bytes",
      ...getSecurityHeaders(),
      ...getCorsHeaders()
    };

    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);

      if (!match) {
        response.writeHead(416, {
          ...baseHeaders,
          "Content-Range": `bytes */${fileStats.size}`
        });
        response.end();
        return;
      }

      const requestedStart = match[1] ? Number.parseInt(match[1], 10) : null;
      const requestedEnd = match[2] ? Number.parseInt(match[2], 10) : null;
      const suffixLength = requestedStart === null ? requestedEnd || 0 : 0;
      const start = requestedStart === null ? Math.max(0, fileStats.size - suffixLength) : requestedStart;
      const end = requestedStart === null ? fileStats.size - 1 : Math.min(requestedEnd ?? fileStats.size - 1, fileStats.size - 1);

      if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || start >= fileStats.size || (requestedStart === null && suffixLength <= 0)) {
        response.writeHead(416, {
          ...baseHeaders,
          "Content-Range": `bytes */${fileStats.size}`
        });
        response.end();
        return;
      }

      const stream = createReadStream(targetPath, { start, end });
      response.writeHead(206, {
        ...baseHeaders,
        "Content-Length": end - start + 1,
        "Content-Range": `bytes ${start}-${end}/${fileStats.size}`
      });

      if (request.method === "HEAD") {
        response.end();
        return;
      }

      stream.pipe(response);
      return;
    }

    response.writeHead(200, {
      ...baseHeaders,
      "Content-Length": fileStats.size
    });

    if (request.method === "HEAD") {
      response.end();
      return;
    }

    createReadStream(targetPath).pipe(response);
  } catch (error) {
    if (error.code === "ENOENT") {
      sendText(response, 404, "Not found");
      return;
    }

    throw error;
  }
}

async function handleRequest(request, response) {
  const requestUrl = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
      ...getSecurityHeaders(),
      ...getCorsHeaders()
    });
    response.end();
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/health") {
    sendJson(response, 200, getHealthPayload(), {
      "Access-Control-Allow-Origin": "*",
      "Cross-Origin-Resource-Policy": "cross-origin"
    });
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/ready") {
    sendJson(response, 200, {
      ok: true,
      status: "ready",
      app: "Care Nova AI",
      version: APP_VERSION,
      probes: {
        health: "/api/health",
        deploymentReadiness: "/api/deployment-readiness",
        offlineKnowledge: "/api/knowledge",
        localAi: "/api/local-ai",
        agenticRuntime: "/api/agentic-runtime",
        modelRouter: "/api/model-router",
        modelRouterPreview: "/api/model-router/preview",
        modelHealth: "/api/model-health",
        externalKnowledge: "/api/external-knowledge",
        trustedSources: "/api/trusted-sources",
        modelQuality: "/api/model-quality",
        governance: "/api/governance",
        offlinePacks: "/api/offline-packs",
        fhir: "/api/fhir",
        reportTemplates: "/api/report-templates",
        advancedCapabilities: "/api/advanced-capabilities",
        evaluationDashboard: "/api/evaluation-dashboard",
        knowledgeGraph: "/api/knowledge-graph",
        safetyTriage: "/api/safety-triage",
        evidenceCitations: "/api/evidence-citations",
        humanReview: "/api/human-review",
        multimodalIntake: "/api/multimodal-intake",
        preventionPlan: "/api/prevention-plan",
        offlinePackManager: "/api/offline-pack-manager",
        fhirConnector: "/api/fhir-connector",
        adminTrustCenter: "/api/admin-trust-center",
        backupPlan: "/api/backup-plan",
        doctorReadyReport: "/api/doctor-ready-report",
        localDataMirror: "/api/local-data-mirror",
        medicineLookup: "/api/medicine/lookup",
        training: "/api/training",
        trainingExample: "/api/training/example",
        trainingRun: "/api/training/train",
        trainingEvaluate: "/api/training/evaluate"
      },
      runtime: getRuntimeSnapshot(),
      timestamp: new Date().toISOString()
    });
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/agentic-runtime") {
    sendJson(response, 200, {
      ok: true,
      app: "Care Nova AI",
      version: APP_VERSION,
      agenticRuntime: getAdaptiveRuntimePolicy(),
      timestamp: new Date().toISOString()
    });
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/model") {
    sendJson(response, 200, getModelBlueprint());
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/model-router") {
    sendJson(response, 200, {
      ok: true,
      app: "Care Nova AI",
      version: APP_VERSION,
      router: getHybridModelRouterStatus(),
      timestamp: new Date().toISOString()
    });
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/model-router/preview") {
    try {
      const payload = await readJsonBody(request);

      sendJson(response, 200, {
        app: "Care Nova AI",
        version: APP_VERSION,
        ...buildModelRouterPreview(payload)
      });
    } catch (error) {
      sendJson(response, error.statusCode || 500, {
        ok: false,
        code: error.code || "MODEL_ROUTER_PREVIEW_ERROR",
        message: error.message || "Unable to preview model routing."
      });
    }
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/readiness") {
    sendJson(response, 200, getReadinessReport());
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/deployment") {
    sendJson(response, 200, getDeploymentGuide());
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/deployment-readiness") {
    sendJson(response, 200, getDeploymentReadiness(getRuntimeSnapshot()));
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/knowledge") {
    sendJson(response, 200, getOfflineKnowledgeDatabase());
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/local-ai") {
    sendJson(response, 200, {
      ok: true,
      app: "Care Nova AI",
      version: APP_VERSION,
      ai: getLocalAiRuntimeStatus(),
      localReasoningAssist: getLocalReasoningAssistStatus(),
      temporaryCloudLlm: getTemporaryCloudLlmStatus(),
      modelHealth: getModelHealthStatus(),
      timestamp: new Date().toISOString()
    });
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/model-health") {
    const hybridRouter = getHybridModelRouterStatus();

    sendJson(response, 200, {
      ok: true,
      app: "Care Nova AI",
      version: APP_VERSION,
      modelHealth: getModelHealthStatus(),
      localReasoningAssist: getLocalReasoningAssistStatus(),
      temporaryCloudLlm: getTemporaryCloudLlmStatus(),
      hybridRouter: {
        status: hybridRouter.status,
        mode: hybridRouter.mode,
        summary: hybridRouter.summary,
        connectivity: hybridRouter.connectivity,
        fallbackPolicy: hybridRouter.fallbackPolicy
      },
      fallbackAvailable: true,
      timestamp: new Date().toISOString()
    });
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/external-knowledge") {
    sendJson(response, 200, {
      ok: true,
      app: "Care Nova AI",
      version: APP_VERSION,
      externalKnowledge: getExternalKnowledgeStatus(),
      timestamp: new Date().toISOString()
    });
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/trusted-sources") {
    const queryPayload = {
      message: requestUrl.searchParams.get("q") || "",
      tab: requestUrl.searchParams.get("tab") || ""
    };

    sendJson(response, 200, {
      ok: true,
      app: "Care Nova AI",
      version: APP_VERSION,
      trustedSources: getTrustedSourceCatalog(),
      plan: buildTrustedSourcePlan(queryPayload),
      timestamp: new Date().toISOString()
    });
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/medicine/lookup") {
    try {
      const lookup = await lookupMedicineEvidence({
        query: requestUrl.searchParams.get("q") || requestUrl.searchParams.get("name") || "",
        forceOnline: requestUrl.searchParams.get("refresh") === "true"
      });
      const mirror = lookup.fetchedOnline
        ? await syncDataMirrorSafely("medicine-lookup-cache", [mirrorDataFiles.medicineLookup])
        : null;

      sendJson(response, lookup.ok ? 200 : 400, {
        ok: lookup.ok,
        app: "Care Nova AI",
        version: APP_VERSION,
        lookup,
        mirror,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      sendJson(response, error.statusCode || 500, {
        ok: false,
        code: error.code || "MEDICINE_LOOKUP_ERROR",
        message: error.message || "Unable to check medicine evidence."
      });
    }
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/trusted-sources/plan") {
    try {
      const payload = await readJsonBody(request);

      sendJson(response, 200, {
        ok: true,
        app: "Care Nova AI",
        version: APP_VERSION,
        plan: buildTrustedSourcePlan(payload),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      sendJson(response, error.statusCode || 500, {
        ok: false,
        code: error.code || "TRUSTED_SOURCE_PLAN_ERROR",
        message: error.message || "Unable to build trusted source plan."
      });
    }
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/model-quality") {
    sendJson(response, 200, {
      ok: true,
      app: "Care Nova AI",
      version: APP_VERSION,
      quality: getModelQualityFramework(getRuntimeSnapshot()),
      timestamp: new Date().toISOString()
    });
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/model-quality/evaluate") {
    try {
      const payload = await readJsonBody(request);

      sendJson(response, 200, {
        ok: true,
        app: "Care Nova AI",
        version: APP_VERSION,
        evaluation: evaluateModelQuality(payload.result || {}, payload, getRuntimeSnapshot()),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      sendJson(response, error.statusCode || 500, {
        ok: false,
        code: error.code || "MODEL_QUALITY_EVALUATION_ERROR",
        message: error.message || "Unable to evaluate model quality."
      });
    }
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/governance") {
    sendJson(response, 200, {
      ok: true,
      app: "Care Nova AI",
      version: APP_VERSION,
      governance: getGovernanceReadiness(getRuntimeSnapshot()),
      timestamp: new Date().toISOString()
    });
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/offline-packs") {
    sendJson(response, 200, {
      ok: true,
      app: "Care Nova AI",
      version: APP_VERSION,
      offlinePacks: getOfflinePackCatalog(),
      timestamp: new Date().toISOString()
    });
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/fhir") {
    sendJson(response, 200, {
      ok: true,
      app: "Care Nova AI",
      version: APP_VERSION,
      fhir: getFhirIntegrationGuide(),
      timestamp: new Date().toISOString()
    });
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/report-templates") {
    sendJson(response, 200, {
      ok: true,
      app: "Care Nova AI",
      version: APP_VERSION,
      reports: getReportTemplateCatalog(),
      timestamp: new Date().toISOString()
    });
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/advanced-capabilities") {
    sendJson(response, 200, {
      ...getAdvancedCapabilityCatalog(getRuntimeSnapshot()),
      app: "Care Nova AI",
      version: APP_VERSION
    });
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/evaluation-dashboard") {
    sendJson(response, 200, {
      ...getEvaluationDashboard(getRuntimeSnapshot()),
      app: "Care Nova AI",
      version: APP_VERSION
    });
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/offline-pack-manager") {
    sendJson(response, 200, {
      ...getOfflinePackManager(),
      app: "Care Nova AI",
      version: APP_VERSION
    });
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/fhir-connector") {
    sendJson(response, 200, {
      ...getFhirConnectorStatus(),
      app: "Care Nova AI",
      version: APP_VERSION
    });
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/admin-trust-center") {
    sendJson(response, 200, {
      ...getAdminTrustCenter(getRuntimeSnapshot()),
      app: "Care Nova AI",
      version: APP_VERSION
    });
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/backup-plan") {
    sendJson(response, 200, {
      ...getSecureBackupPlan(),
      app: "Care Nova AI",
      version: APP_VERSION
    });
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/local-data-mirror") {
    sendJson(response, 200, {
      ok: true,
      app: "Care Nova AI",
      version: APP_VERSION,
      mirror: await getLocalDataMirrorStatus(),
      timestamp: new Date().toISOString()
    });
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/local-data-mirror") {
    try {
      const payload = await readJsonBody(request);
      const mirror = await syncLocalDataMirror(payload.reason || "manual-api-sync");

      sendJson(response, 200, {
        ok: true,
        app: "Care Nova AI",
        version: APP_VERSION,
        mirror,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      sendJson(response, error.statusCode || 500, {
        ok: false,
        code: error.code || "LOCAL_DATA_MIRROR_ERROR",
        message: error.message || "Unable to sync local OneDrive mirror."
      });
    }
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/knowledge-graph") {
    const patientId = requestUrl.searchParams.get("patientId") || "demo-patient";
    const graph = await loadPatientKnowledgeGraph(patientId);

    sendJson(response, 200, {
      ok: true,
      app: "Care Nova AI",
      version: APP_VERSION,
      graph,
      timestamp: new Date().toISOString()
    });
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/evidence-citations") {
    try {
      const payload = await readJsonBody(request);

      sendJson(response, 200, {
        ok: true,
        app: "Care Nova AI",
        version: APP_VERSION,
        evidence: buildEvidenceCitationPacket({ payload, result: payload.result || {} }),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      sendJson(response, error.statusCode || 500, {
        ok: false,
        code: error.code || "EVIDENCE_CITATION_ERROR",
        message: error.message || "Unable to build evidence citations."
      });
    }
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/safety-triage") {
    try {
      const payload = await readJsonBody(request);

      sendJson(response, 200, {
        ok: true,
        app: "Care Nova AI",
        version: APP_VERSION,
        triage: runClinicalSafetyTriage({ payload, result: payload.result || {} }),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      sendJson(response, error.statusCode || 500, {
        ok: false,
        code: error.code || "SAFETY_TRIAGE_ERROR",
        message: error.message || "Unable to run safety triage."
      });
    }
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/multimodal-intake") {
    try {
      const payload = await readJsonBody(request);

      sendJson(response, 200, {
        ok: true,
        app: "Care Nova AI",
        version: APP_VERSION,
        intake: analyzeMultimodalIntake(payload),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      sendJson(response, error.statusCode || 500, {
        ok: false,
        code: error.code || "MULTIMODAL_INTAKE_ERROR",
        message: error.message || "Unable to review document intake."
      });
    }
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/prevention-plan") {
    try {
      const payload = await readJsonBody(request);
      const graph = payload.graph || await loadPatientKnowledgeGraph(payload.patientId || "demo-patient");

      sendJson(response, 200, {
        ok: true,
        app: "Care Nova AI",
        version: APP_VERSION,
        preventionPlan: buildPersonalizedPreventionPlan({ payload, result: payload.result || {}, graph }),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      sendJson(response, error.statusCode || 500, {
        ok: false,
        code: error.code || "PREVENTION_PLAN_ERROR",
        message: error.message || "Unable to build prevention plan."
      });
    }
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/human-review") {
    try {
      const payload = await readJsonBody(request);
      const graph = payload.graph || await loadPatientKnowledgeGraph(payload.patientId || "demo-patient");

      sendJson(response, 200, {
        ok: true,
        app: "Care Nova AI",
        version: APP_VERSION,
        review: buildHumanReviewPacket({ payload, result: payload.result || {}, graph }),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      sendJson(response, error.statusCode || 500, {
        ok: false,
        code: error.code || "HUMAN_REVIEW_ERROR",
        message: error.message || "Unable to build human review packet."
      });
    }
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/doctor-ready-report") {
    try {
      const payload = await readJsonBody(request);
      const graph = payload.graph || await loadPatientKnowledgeGraph(payload.patientId || "demo-patient");

      sendJson(response, 200, {
        ok: true,
        app: "Care Nova AI",
        version: APP_VERSION,
        report: buildDoctorReadyReport({ payload, result: payload.result || {}, graph }),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      sendJson(response, error.statusCode || 500, {
        ok: false,
        code: error.code || "DOCTOR_READY_REPORT_ERROR",
        message: error.message || "Unable to build doctor-ready report."
      });
    }
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/memory") {
    const patientId = requestUrl.searchParams.get("patientId") || "demo-patient";
    const memory = await loadPatientMemory(patientId);

    sendJson(response, 200, {
      ok: true,
      memory,
      timestamp: new Date().toISOString()
    });
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/records") {
    const patientId = requestUrl.searchParams.get("patientId") || "demo-patient";
    const records = await loadPatientDataRecords(patientId);

    sendJson(response, 200, {
      ok: true,
      records,
      timestamp: new Date().toISOString()
    });
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/training-readiness") {
    sendJson(response, 200, getTrainingReadiness());
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/training") {
    const state = await loadTrainingState();
    const runtime = getRuntimeSnapshot();

    sendJson(response, 200, {
      ok: true,
      app: "Care Nova AI",
      version: APP_VERSION,
      training: toPublicTrainingState(state),
      calibration: await getTrainingCalibration(),
      machineLearning: getMachineLearningCapabilityStatus(runtime),
      timestamp: new Date().toISOString()
    });
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/training/example") {
    try {
      const payload = await readJsonBody(request);
      const training = await recordTrainingExample(payload);
      const mirror = await syncDataMirrorSafely("training-example-save", [mirrorDataFiles.training]);

      sendJson(response, 200, {
        ...training,
        app: "Care Nova AI",
        version: APP_VERSION,
        mirror,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      sendJson(response, error.statusCode || 500, {
        ok: false,
        code: error.code || "TRAINING_EXAMPLE_ERROR",
        message: error.message || "Unable to save training feedback."
      });
    }
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/training/train") {
    try {
      const payload = await readJsonBody(request);
      const training = await trainLocalAgentCalibrator(payload);
      const mirror = await syncDataMirrorSafely("training-run-save", [mirrorDataFiles.training]);

      sendJson(response, 200, {
        ...training,
        app: "Care Nova AI",
        version: APP_VERSION,
        mirror,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      sendJson(response, error.statusCode || 500, {
        ok: false,
        code: error.code || "TRAINING_RUN_ERROR",
        message: error.message || "Unable to train the local agent calibrator."
      });
    }
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/training/evaluate") {
    try {
      const payload = await readJsonBody(request);

      sendJson(response, 200, {
        ok: true,
        app: "Care Nova AI",
        version: APP_VERSION,
        evaluation: await evaluateTrainingCalibration(payload),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      sendJson(response, error.statusCode || 500, {
        ok: false,
        code: error.code || "TRAINING_EVALUATION_ERROR",
        message: error.message || "Unable to evaluate the local training calibration."
      });
    }
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/analyze") {
    try {
      const payload = await readJsonBody(request);
      const patientId = String(payload.patientId || "demo-patient");
      const runtime = getRuntimeSnapshot();
      const [memoryBefore, patientRecords, externalKnowledge, trainingCalibration] = await Promise.all([
        loadPatientMemory(patientId),
        loadPatientDataRecords(patientId),
        getExternalKnowledgeForRequest(payload),
        getTrainingCalibration()
      ]);
      const agenticRuntimePolicy = getAdaptiveRuntimePolicy({ externalKnowledge, runtime });
      const result = await analyzeHealthQuery({
        ...payload,
        profile: mergeRequestProfile(memoryBefore.profile, payload.profile),
        trainingCalibration,
        externalKnowledge,
        conversationHistory: mergeMemoryHistory(memoryBefore.history, payload.conversationHistory || payload.history)
      });
      const localReasoningAssist = await tryEnhanceAnalyzeResultWithLocalReasoning({ payload, result });

      result.localReasoningAssist = localReasoningAssist;
      result.model.localReasoningAssist = {
        enabled: localReasoningAssist.enabled,
        configured: localReasoningAssist.configured,
        attempted: localReasoningAssist.attempted,
        applied: localReasoningAssist.applied,
        provider: localReasoningAssist.provider,
        model: localReasoningAssist.model,
        endpointHost: localReasoningAssist.endpointHost,
        participants: localReasoningAssist.participants || [],
        fallbackUsed: localReasoningAssist.fallbackUsed,
        error: localReasoningAssist.error
      };

      if (Array.isArray(result.auditTrail)) {
        result.auditTrail.push({
          step: "open_source_local_reasoning_assist",
          status: "complete",
          detail: localReasoningAssist.applied
            ? "Open-source local reasoning assist strengthened the grounded local answer using evidence, memory, and agent output."
            : localReasoningAssist.attempted
              ? `Open-source local reasoning assist failed or was rejected, so the deterministic local answer stayed active. ${localReasoningAssist.error || ""}`.trim()
              : localReasoningAssist.enabled
                ? "Open-source local reasoning assist is enabled but missing configuration, so the deterministic local answer stayed active."
                : "Open-source local reasoning assist is disabled, so the deterministic local answer stayed active.",
          timestamp: new Date().toISOString()
        });
      }

      const temporaryCloudLlm = await tryEnhanceAnalyzeResultWithCloudLlm({ payload, result });

      result.temporaryCloudLlm = temporaryCloudLlm;
      result.model.temporaryCloudLlm = {
        enabled: temporaryCloudLlm.enabled,
        configured: temporaryCloudLlm.configured,
        requestedForThisRun: temporaryCloudLlm.requestedForThisRun,
        plannedByRouter: temporaryCloudLlm.plannedByRouter,
        engagementMode: temporaryCloudLlm.engagementMode,
        attempted: temporaryCloudLlm.attempted,
        applied: temporaryCloudLlm.applied,
        provider: temporaryCloudLlm.provider,
        model: temporaryCloudLlm.model,
        endpointHost: temporaryCloudLlm.endpointHost,
        actualProcessingType: temporaryCloudLlm.actualProcessingType,
        fallbackUsed: temporaryCloudLlm.fallbackUsed,
        skipReason: temporaryCloudLlm.skipReason,
        error: temporaryCloudLlm.error
      };

      if (Array.isArray(result.auditTrail)) {
        result.auditTrail.push({
          step: "temporary_cloud_llm",
          status: "complete",
          detail: temporaryCloudLlm.applied
            ? temporaryCloudLlm.engagementMode === "route-aware-clinical-second-pass"
              ? `Route-aware OpenAI cloud second pass applied through ${temporaryCloudLlm.provider} (${temporaryCloudLlm.model}) after local specialist synthesis and before the final guarded reply.`
              : `Temporary cloud rewrite applied through ${temporaryCloudLlm.provider} (${temporaryCloudLlm.model}) after local safety output generation.`
            : temporaryCloudLlm.attempted
              ? temporaryCloudLlm.engagementMode === "route-aware-clinical-second-pass"
                ? `Route-aware OpenAI cloud second pass failed or was rejected, so the local response stayed active. ${temporaryCloudLlm.error || ""}`.trim()
                : `Temporary cloud rewrite failed or was rejected, so the default local response stayed active. ${temporaryCloudLlm.error || ""}`.trim()
              : temporaryCloudLlm.requestedForThisRun === false && temporaryCloudLlm.skipReason
                ? temporaryCloudLlm.skipReason
                : temporaryCloudLlm.enabled
                  ? "Temporary cloud path is enabled but missing configuration, so the default local response stayed active."
                  : "Temporary cloud rewrite is disabled, so the default local response stayed active.",
          timestamp: new Date().toISOString()
        });
      }

      const qualityEvaluation = evaluateModelQuality(result, payload, runtime);
      const [memoryAfter, knowledgeGraph] = await Promise.all([
        appendPatientMemory({ patientId, payload, result }),
        upsertPatientKnowledgeGraph({
          patientId,
          payload,
          result,
          records: patientRecords.records
        })
      ]);
      const safetyTriage = runClinicalSafetyTriage({ payload, result });
      const evidenceCitations = buildEvidenceCitationPacket({ payload, result });
      const preventionPlan = buildPersonalizedPreventionPlan({ payload, result, graph: knowledgeGraph });
      const humanReview = buildHumanReviewPacket({ payload, result, graph: knowledgeGraph });
      const multimodalIntake = analyzeMultimodalIntake(payload);
      const doctorReadyReport = buildDoctorReadyReport({ payload, result, graph: knowledgeGraph });

      result.memoryContext = {
        ...result.memoryContext,
        persistence: "persistent-local-server",
        storage: memoryAfter.file,
        savedTurns: memoryAfter.recentTurnCount
      };
      result.memory = {
        ok: true,
        saved: true,
        ...memoryAfter
      };
      result.trustedSourcePlan = qualityEvaluation.trustedSourcePlan;
      result.qualityEvaluation = qualityEvaluation;
      result.governanceSnapshot = getGovernanceReadiness(runtime).summary;
      result.agenticRuntime = buildAdaptiveExecutionTrace({
        policy: agenticRuntimePolicy,
        payload,
        result,
        externalKnowledge,
        memoryBefore,
        memoryAfter,
        qualityEvaluation
      });
      result.model.adaptiveRuntime = {
        id: result.agenticRuntime.id,
        systemState: result.agenticRuntime.systemState,
        activeMode: result.agenticRuntime.activeMode,
        fallbackApplied: result.agenticRuntime.decision.fallbackApplied,
        latestDataUsed: result.agenticRuntime.latestDataUsed
      };
      result.recommendedReportTemplates = getReportTemplateCatalog().templates
        .filter((template) => (template.tabs || []).some((tab) => tab.toLowerCase() === String(payload.tab || "").toLowerCase()))
        .slice(0, 2);
      result.knowledgeGraph = knowledgeGraph;
      result.safetyTriage = safetyTriage;
      result.evidenceCitations = evidenceCitations;
      result.preventionPlan = preventionPlan;
      result.humanReview = humanReview;
      result.multimodalIntake = multimodalIntake;
      result.doctorReadyReport = doctorReadyReport;
      result.advancedCapabilities = buildAdvancedCapabilitySnapshot({
        payload,
        result,
        graph: knowledgeGraph,
        runtime,
        precomputed: {
          evidence: evidenceCitations,
          safetyTriage,
          humanReview,
          preventionPlan,
          multimodalIntake
        }
      });
      result.machineLearning = getMachineLearningCapabilityStatus(runtime).summary;
      result.localDataMirror = await syncDataMirrorSafely("analyze-memory-graph-sync", buildAnalyzeMirrorFiles(patientId));
      sendJson(response, 200, result);
    } catch (error) {
      sendJson(response, error.statusCode || 500, {
        ok: false,
        code: error.code || "ANALYSIS_ERROR",
        message: error.message || "Unable to analyze the request."
      });
    }
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/external-knowledge/clear") {
    try {
      const externalKnowledge = await clearExternalKnowledgeCache();
      const mirror = await syncDataMirrorSafely("external-knowledge-clear", [mirrorDataFiles.externalKnowledge]);

      sendJson(response, 200, {
        ok: true,
        externalKnowledge,
        mirror,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      sendJson(response, error.statusCode || 500, {
        ok: false,
        code: error.code || "EXTERNAL_KNOWLEDGE_CLEAR_ERROR",
        message: error.message || "Unable to clear the external knowledge cache."
      });
    }
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/memory/clear") {
    try {
      const payload = await readJsonBody(request);
      const memory = await clearPatientMemory(payload.patientId || "demo-patient");
      const mirror = await syncDataMirrorSafely("memory-clear", [mirrorDataFiles.memory]);

      sendJson(response, 200, {
        ok: true,
        memory,
        mirror,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      sendJson(response, error.statusCode || 500, {
        ok: false,
        code: error.code || "MEMORY_CLEAR_ERROR",
        message: error.message || "Unable to clear patient memory."
      });
    }
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/records") {
    try {
      const payload = await readJsonBody(request);
      const records = await savePatientDataRecords({
        patientId: payload.patientId || "demo-patient",
        records: Array.isArray(payload.records) ? payload.records : [],
        selectedRecordId: payload.selectedRecordId || ""
      });
      const mirror = await syncDataMirrorSafely("records-save", [mirrorDataFiles.records]);

      sendJson(response, 200, {
        ok: true,
        records,
        mirror,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      sendJson(response, error.statusCode || 500, {
        ok: false,
        code: error.code || "RECORD_SAVE_ERROR",
        message: error.message || "Unable to save patient records."
      });
    }
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/records/clear") {
    try {
      const payload = await readJsonBody(request);
      const records = await clearPatientDataRecords(payload.patientId || "demo-patient");
      const mirror = await syncDataMirrorSafely("records-clear", [mirrorDataFiles.records]);

      sendJson(response, 200, {
        ok: true,
        records,
        mirror,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      sendJson(response, error.statusCode || 500, {
        ok: false,
        code: error.code || "RECORD_CLEAR_ERROR",
        message: error.message || "Unable to clear patient records."
      });
    }
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/knowledge-graph/clear") {
    try {
      const payload = await readJsonBody(request);
      const graph = await clearPatientKnowledgeGraph(payload.patientId || "demo-patient");
      const mirror = await syncDataMirrorSafely("knowledge-graph-clear", [buildPatientGraphMirrorFile(payload.patientId || "demo-patient")]);

      sendJson(response, 200, {
        ok: true,
        graph,
        mirror,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      sendJson(response, error.statusCode || 500, {
        ok: false,
        code: error.code || "KNOWLEDGE_GRAPH_CLEAR_ERROR",
        message: error.message || "Unable to clear the patient knowledge graph."
      });
    }
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/realtime") {
    try {
      const payload = await readJsonBody(request);
      const patientId = String(payload.patientId || "demo-patient");
      const [trainingCalibration, memoryBefore] = await Promise.all([
        getTrainingCalibration(),
        loadPatientMemory(patientId)
      ]);
      const result = analyzeRealtimeHealthQuery({
        ...payload,
        profile: mergeRequestProfile(memoryBefore.profile, payload.profile),
        conversationHistory: mergeMemoryHistory(memoryBefore.history, payload.conversationHistory || payload.history),
        trainingCalibration
      });
      result.agenticRuntime = buildAdaptiveExecutionTrace({
        policy: getAdaptiveRuntimePolicy(),
        payload,
        result,
        externalKnowledge: getExternalKnowledgeStatus(),
        qualityEvaluation: {
          score: result.reasoningQuality?.score || 0,
          label: result.reasoningQuality?.label || "Realtime quality checked"
        }
      });
      sendJson(response, 200, result);
    } catch (error) {
      sendJson(response, error.statusCode || 500, {
        ok: false,
        code: error.code || "REALTIME_ANALYSIS_ERROR",
        message: error.message || "Unable to run real-time analysis."
      });
    }
    return;
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    sendJson(response, 405, {
      ok: false,
      code: "METHOD_NOT_ALLOWED",
      message: "This endpoint only supports GET or POST where documented."
    });
    return;
  }

  await serveStatic(request, requestUrl, response);
}

export function createServerApp() {
  startLocalRuntimeProbeLoop(process.env);

  const server = createServer((request, response) => {
    handleRequest(request, response).catch((error) => {
      console.error(error);
      sendJson(response, 500, {
        ok: false,
        code: "SERVER_ERROR",
        message: "The demo server hit an unexpected error."
      });
    });
  });

  server.requestTimeout = 15_000;
  server.headersTimeout = 16_000;

  return server;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const server = createServerApp();

  function shutdown(signal) {
    console.log(`Care Nova AI received ${signal}; closing server...`);
    server.close(() => {
      console.log("Care Nova AI server closed.");
      process.exit(0);
    });

    setTimeout(() => {
      console.error("Care Nova AI forced shutdown after timeout.");
      process.exit(1);
    }, 5_000).unref();
  }

  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));

  server.on("error", (error) => {
    console.error(`Care Nova AI failed to start: ${error.message}`);
    process.exit(1);
  });

  server.listen(port, host, () => {
    console.log(`Care Nova AI ${APP_VERSION} running at http://${host}:${port}`);
  });
}
