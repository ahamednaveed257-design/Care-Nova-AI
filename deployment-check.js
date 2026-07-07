import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { createServerApp } from "../server.js";

function stripBom(text) {
  return text.replace(/^\uFEFF/, "");
}

function compareVersionStrings(left, right) {
  const leftParts = String(left || "").split(".").map((part) => Number.parseInt(part, 10) || 0);
  const rightParts = String(right || "").split(".").map((part) => Number.parseInt(part, 10) || 0);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const delta = (leftParts[index] || 0) - (rightParts[index] || 0);

    if (delta !== 0) {
      return delta;
    }
  }

  return 0;
}

const server = createServerApp();

await new Promise((resolve) => {
  server.listen(0, "127.0.0.1", resolve);
});

const { port } = server.address();
const baseUrl = `http://127.0.0.1:${port}`;
const packageJson = JSON.parse(stripBom(await readFile(new URL("../package.json", import.meta.url), "utf8")));
const expectedVersion = packageJson.version;

async function getJson(path) {
  const response = await fetch(`${baseUrl}${path}`);
  const payload = await response.json();

  assert.equal(response.status, 200, path);
  assert.equal(payload.ok, true, path);

  return { response, payload };
}

try {
  const { response: homeResponse, text: homeText } = await getText("/");
  assert.match(homeResponse.headers.get("content-security-policy") || "", /default-src 'self'/);
  assert.match(homeResponse.headers.get("content-security-policy") || "", /frame-ancestors/);
  assert.equal(homeResponse.headers.get("x-content-type-options"), "nosniff");
  assert.equal(homeResponse.headers.get("permissions-policy"), "camera=(), microphone=(), geolocation=(), payment=()");
  assert.equal(homeResponse.headers.has("x-powered-by"), false);

  const { payload: health } = await getJson("/api/health");
  assert.equal(health.status, "healthy");
  assert.equal(health.app, "Care Nova AI");
  assert.equal(health.version, expectedVersion);
  assert.equal(health.mode, "online-offline-local-parity");
  assert.equal(health.runtimeParity.sameCoreOnlineOffline, true);
  assert.equal(health.runtimeParity.internetRequired, false);
  assert.equal(health.memory.mode, "persistent-local-server");
  assert.equal(health.records.mode, "persistent-local-server");
  assert.equal(health.records.file, "data/records/patient-records.json");
  assert.equal(health.training.mode, "persistent-local-ml-training-store");
  assert.equal(health.machineLearning.classicalMlReady, true);
  assert.equal(health.hybridRouter.status, "local-ready");
  assert.equal(health.hybridRouter.summary.availableCloudModels, 0);
  assert.equal(health.hybridRouter.connectivity.offlineExecutionReady, true);
  assert.equal(health.externalKnowledge.mode, "disabled-local-cache-ready");
  assert.equal(health.externalKnowledge.cache.file, "data/external/external-knowledge-cache.json");
  assert.equal(health.trustedSources.status, "offline-first-trusted-source-ready");
  assert.equal(health.trustedSources.sourceCount, 5);
  assert.equal(health.advancedCapabilities.localFirst, true);
  assert.ok(health.advancedCapabilities.readyFeatures >= 5);
  assert.ok(health.evaluationDashboard.suiteCount >= 6);
  assert.equal(health.knowledgeGraph.file, "data/graph/patient-knowledge-graph.json");
  assert.equal(health.dataMirror.mode, "localhost-primary-plus-onedrive-local-mirror");
  assert.ok(health.dataMirror.mirrorRoot.includes("onedrive-mirror"));
  assert.equal(health.offlinePacks.runsWithoutInternet, true);
  assert.equal(health.fhir.noEhrCallByDefault, true);
  assert.equal(health.reports.downloadsSupported, true);
  assert.equal(health.deployment.globalReady, true);
  assert.equal(health.deployment.readinessEndpoint, "/api/ready");

  const { payload: ready } = await getJson("/api/ready");
  assert.equal(ready.status, "ready");
  assert.equal(ready.probes.deploymentReadiness, "/api/deployment-readiness");
  assert.equal(ready.probes.modelRouter, "/api/model-router");
  assert.equal(ready.probes.modelRouterPreview, "/api/model-router/preview");
  assert.equal(ready.probes.externalKnowledge, "/api/external-knowledge");
  assert.equal(ready.probes.trustedSources, "/api/trusted-sources");
  assert.equal(ready.probes.modelQuality, "/api/model-quality");
  assert.equal(ready.probes.governance, "/api/governance");
  assert.equal(ready.probes.offlinePacks, "/api/offline-packs");
  assert.equal(ready.probes.fhir, "/api/fhir");
  assert.equal(ready.probes.reportTemplates, "/api/report-templates");
  assert.equal(ready.probes.advancedCapabilities, "/api/advanced-capabilities");
  assert.equal(ready.probes.evaluationDashboard, "/api/evaluation-dashboard");
  assert.equal(ready.probes.knowledgeGraph, "/api/knowledge-graph");
  assert.equal(ready.probes.safetyTriage, "/api/safety-triage");
  assert.equal(ready.probes.evidenceCitations, "/api/evidence-citations");
  assert.equal(ready.probes.humanReview, "/api/human-review");
  assert.equal(ready.probes.multimodalIntake, "/api/multimodal-intake");
  assert.equal(ready.probes.preventionPlan, "/api/prevention-plan");
  assert.equal(ready.probes.doctorReadyReport, "/api/doctor-ready-report");
  assert.equal(ready.probes.localDataMirror, "/api/local-data-mirror");
  assert.equal(ready.probes.training, "/api/training");

  const { payload: deploymentReadiness } = await getJson("/api/deployment-readiness");
  assert.equal(deploymentReadiness.status, "deployment-ready");
  assert.equal(deploymentReadiness.score, 100);
  assert.equal(deploymentReadiness.releaseGate.command, "npm run release:check");
  assert.equal(deploymentReadiness.releaseGate.windowsCommand, "release-check.cmd");
  assert.ok(deploymentReadiness.checks.every((check) => check.status === "pass"));
  assert.ok(deploymentReadiness.checks.some((check) => check.id === "docker_packaging"));
  assert.ok(deploymentReadiness.checks.some((check) => check.id === "offline_database_packaged"));
  assert.ok(deploymentReadiness.checks.some((check) => check.id === "hybrid_model_router"));
  assert.ok(deploymentReadiness.checks.some((check) => check.id === "online_offline_parity"));
  assert.ok(deploymentReadiness.checks.some((check) => check.id === "medical_safety"));

  const { payload: deployment } = await getJson("/api/deployment");
  assert.equal(deployment.globalReady, true);
  assert.ok(deployment.endpoints.includes("/api/ready"));
  assert.ok(deployment.endpoints.includes("/api/deployment-readiness"));
  assert.ok(deployment.endpoints.includes("/api/memory"));
  assert.ok(deployment.endpoints.includes("/api/records"));
  assert.ok(deployment.endpoints.includes("/api/external-knowledge"));
  assert.ok(deployment.endpoints.includes("/api/model-router"));
  assert.ok(deployment.endpoints.includes("/api/model-router/preview"));
  assert.ok(deployment.endpoints.includes("/api/trusted-sources"));
  assert.ok(deployment.endpoints.includes("/api/model-quality"));
  assert.ok(deployment.endpoints.includes("/api/governance"));
  assert.ok(deployment.endpoints.includes("/api/offline-packs"));
  assert.ok(deployment.endpoints.includes("/api/fhir"));
  assert.ok(deployment.endpoints.includes("/api/report-templates"));
  assert.ok(deployment.endpoints.includes("/api/advanced-capabilities"));
  assert.ok(deployment.endpoints.includes("/api/evaluation-dashboard"));
  assert.ok(deployment.endpoints.includes("/api/local-data-mirror"));
  assert.ok(deployment.endpoints.includes("/api/knowledge-graph"));
  assert.ok(deployment.endpoints.includes("/api/safety-triage"));
  assert.ok(deployment.endpoints.includes("/api/evidence-citations"));
  assert.ok(deployment.endpoints.includes("/api/human-review"));
  assert.ok(deployment.endpoints.includes("/api/multimodal-intake"));
  assert.ok(deployment.endpoints.includes("/api/prevention-plan"));
  assert.ok(deployment.endpoints.includes("/api/doctor-ready-report"));
  assert.ok(deployment.endpoints.includes("/api/training"));
  assert.ok(deployment.endpoints.includes("/api/training/train"));
  assert.ok(deployment.guide.releaseCommands.includes("npm run release:check"));
  assert.ok(deployment.guide.releaseCommands.includes("release-check.cmd"));
  assert.equal(deployment.guide.container.includesOfflineDatabase, true);
  assert.equal(deployment.releaseGate.command, "npm run release:check");

  const { payload: readiness } = await getJson("/api/readiness");
  assert.equal(readiness.score, 100);
  assert.ok(readiness.checks.some((check) => check.id === "deployment_release_gate"));

  const { payload: knowledge } = await getJson("/api/knowledge");
  assert.equal(knowledge.database.offlineReady, true);
  assert.ok(knowledge.database.storedRecords >= 16);
  assert.equal(knowledge.database.trainingStatus, "not-foundation-model-training");

  const { payload: trainingStatus } = await getJson("/api/training");
  assert.equal(trainingStatus.training.storage.file, "data/training/agent-training-state.json");
  assert.equal(trainingStatus.machineLearning.status, "ml-dl-training-ready");
  assert.equal(trainingStatus.calibration.id, "LOCAL_AGENT_TRAINING_CALIBRATION");

  const { payload: localAi } = await getJson("/api/local-ai");
  assert.equal(localAi.ai.offlineReady, true);
  assert.equal(localAi.ai.mlCore.enabled, true);
  assert.equal(localAi.ai.runtimeParity.sameCoreOnlineOffline, true);
  assert.equal(localAi.ai.runtimeParity.internetRequired, false);
  assert.equal(localAi.ai.hybridRouter.status, "local-ready");
  assert.equal(localAi.ai.hybridRouter.summary.availableCloudModels, 0);
  assert.equal(localAi.ai.onlineConnector.cacheFile, "data/external/external-knowledge-cache.json");
  assert.equal(localAi.ai.safety.noDiagnosis, true);

  const { payload: modelRouter } = await getJson("/api/model-router");
  assert.equal(modelRouter.router.id, "CARE_NOVA_HYBRID_MODEL_ROUTER");
  assert.equal(modelRouter.router.summary.availableCloudModels, 0);
  assert.equal(modelRouter.router.connectivity.offlineExecutionReady, true);

  const routerPreviewResponse = await fetch(`${baseUrl}/api/model-router/preview`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ message: "Review a complex discharge summary and care plan with evidence." })
  });
  const routerPreview = await routerPreviewResponse.json();
  assert.equal(routerPreviewResponse.status, 200);
  assert.equal(routerPreview.ok, true);
  assert.equal(routerPreview.decision.generatedUsing, "Local Model");
  assert.equal(routerPreview.decision.failover.ready, true);

  const { payload: externalKnowledge } = await getJson("/api/external-knowledge");
  assert.equal(externalKnowledge.externalKnowledge.mode, "disabled-local-cache-ready");
  assert.equal(externalKnowledge.externalKnowledge.cache.file, "data/external/external-knowledge-cache.json");
  assert.equal(externalKnowledge.externalKnowledge.futureRequestReuse, true);

  const { payload: trustedSources } = await getJson("/api/trusted-sources?q=metformin side effect");
  assert.equal(trustedSources.trustedSources.sourceCount, 5);
  assert.equal(trustedSources.plan.queryType, "medicine");
  assert.ok(trustedSources.plan.plannedSources.some((source) => source.sourceId === "rxnorm-rxnav"));

  const trustedPlanResponse = await fetch(`${baseUrl}/api/trusted-sources/plan`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ message: "HbA1c and cholesterol lab report", tab: "labs" })
  });
  const trustedPlan = await trustedPlanResponse.json();
  assert.equal(trustedPlanResponse.status, 200);
  assert.equal(trustedPlan.ok, true);
  assert.equal(trustedPlan.plan.queryType, "lab");

  const { payload: quality } = await getJson("/api/model-quality");
  assert.equal(quality.quality.status, "quality-gate-ready");
  assert.ok(quality.quality.metrics.length >= 9);
  assert.ok(quality.quality.benchmarkCases.length >= 8);

  const { payload: governance } = await getJson("/api/governance");
  assert.equal(governance.governance.status, "governance-ready-for-demo");
  assert.equal(governance.governance.privacy.sendsPhiByDefault, false);
  assert.ok(governance.governance.humanReviewTriggers.length >= 5);

  const { payload: offlinePacks } = await getJson("/api/offline-packs");
  assert.equal(offlinePacks.offlinePacks.status, "offline-pack-ready");
  assert.equal(offlinePacks.offlinePacks.summary.runsWithoutInternet, true);
  assert.ok(offlinePacks.offlinePacks.packs.some((pack) => pack.id === "urgent-safety"));

  const { payload: fhir } = await getJson("/api/fhir");
  assert.equal(fhir.fhir.status, "fhir-ready-not-configured");
  assert.equal(fhir.fhir.summary.noEhrCallByDefault, true);
  assert.ok(fhir.fhir.resources.some((resource) => resource.resource === "Observation"));

  const { payload: reportTemplates } = await getJson("/api/report-templates");
  assert.equal(reportTemplates.reports.status, "report-template-ready");
  assert.equal(reportTemplates.reports.summary.downloadsSupported, true);
  assert.ok(reportTemplates.reports.templates.some((template) => template.id === "doctor-handoff"));

  const { payload: advancedCapabilities } = await getJson("/api/advanced-capabilities");
  assert.equal(advancedCapabilities.status, "advanced-agentic-capabilities-ready");
  assert.ok(advancedCapabilities.features.some((feature) => feature.id === "clinical_safety_triage"));

  const { payload: evaluationDashboard } = await getJson("/api/evaluation-dashboard");
  assert.equal(evaluationDashboard.status, "evaluation-dashboard-ready");
  assert.ok(evaluationDashboard.suites.some((suite) => suite.id === "source_traceability"));

  const { payload: offlinePackManager } = await getJson("/api/offline-pack-manager");
  assert.equal(offlinePackManager.status, "offline-pack-manager-ready");
  assert.ok(offlinePackManager.packs.every((pack) => pack.installState === "bundled"));

  const { payload: fhirConnector } = await getJson("/api/fhir-connector");
  assert.equal(fhirConnector.summary.noEhrCallByDefault, true);
  assert.ok(fhirConnector.scopes.includes("patient/DocumentReference.read"));

  const { payload: adminTrustCenter } = await getJson("/api/admin-trust-center");
  assert.equal(adminTrustCenter.status, "trust-center-ready");
  assert.ok(adminTrustCenter.ownerChecklist.length >= 3);

  const { payload: backupPlan } = await getJson("/api/backup-plan");
  assert.equal(backupPlan.status, "backup-plan-ready");
  assert.ok(backupPlan.files.includes("data/graph/patient-knowledge-graph.json"));

  const { payload: mirrorStatus } = await getJson("/api/local-data-mirror");
  assert.equal(mirrorStatus.mirror.mode, "localhost-primary-plus-onedrive-local-mirror");
  assert.ok(mirrorStatus.mirror.mirrorRoot.includes("onedrive-mirror"));

  const mirrorSyncResponse = await fetch(`${baseUrl}/api/local-data-mirror`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ reason: "deployment-check-sync" })
  });
  const mirrorSync = await mirrorSyncResponse.json();

  assert.equal(mirrorSyncResponse.status, 200);
  assert.equal(mirrorSync.ok, true);
  assert.equal(mirrorSync.mirror.status, "mirror-synced");
  assert.ok(mirrorSync.mirror.fileCount >= 1);
  assert.ok(mirrorSync.mirror.files.some((file) => file.mirror.includes("onedrive-mirror")));

  const { payload: graphBefore } = await getJson("/api/knowledge-graph?patientId=deployment-check");
  assert.equal(graphBefore.graph.mode, "persistent-local-server");

  const { payload: memoryBefore } = await getJson("/api/memory?patientId=deployment-check");
  assert.equal(memoryBefore.memory.mode, "persistent-local-server");

  const { payload: recordsBefore } = await getJson("/api/records?patientId=deployment-check");
  assert.equal(recordsBefore.records.mode, "persistent-local-server");
  assert.equal(recordsBefore.records.file, "data/records/patient-records.json");

  await fetch(`${baseUrl}/api/memory/clear`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ patientId: "deployment-check" })
  });

  const saveRecordsResponse = await fetch(`${baseUrl}/api/records`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      patientId: "deployment-check",
      selectedRecordId: "deploy-record-1",
      records: [
        {
          id: "deploy-record-1",
          patientName: "Deployment Patient",
          age: "52",
          type: "profile",
          date: "2026-06-26",
          conditions: "Hypertension",
          medicines: "Amlodipine",
          vitals: "BP 130/85",
          notes: "Deployment record persistence check"
        }
      ]
    })
  });
  const saveRecords = await saveRecordsResponse.json();

  assert.equal(saveRecordsResponse.status, 200);
  assert.equal(saveRecords.ok, true);
  assert.equal(saveRecords.records.recordCount, 1);
  assert.equal(saveRecords.records.records[0].id, "deploy-record-1");

  const { payload: recordsAfter } = await getJson("/api/records?patientId=deployment-check");
  assert.equal(recordsAfter.records.recordCount, 1);
  assert.equal(recordsAfter.records.selectedRecordId, "deploy-record-1");

  const { response: manifestResponse, text: manifestText } = await getText("/site.webmanifest");
  const manifest = JSON.parse(stripBom(manifestText));
  assert.equal(manifestResponse.headers.get("content-type"), "application/manifest+json; charset=utf-8");
  assert.equal(manifest.name, "Care Nova AI");
  assert.equal(manifest.display, "fullscreen");
  assert.ok(manifest.icons.length >= 2);
  assert.equal(
    /[?&]v=([0-9.]+)/.exec(manifest.start_url || "")?.[1],
    expectedVersion,
    "Manifest start_url should use the current app version."
  );
  assert.ok(
    (manifest.shortcuts || []).every((shortcut) => /[?&]v=([0-9.]+)/.exec(shortcut.url || "")?.[1] === expectedVersion),
    "Manifest shortcuts should use the current app version."
  );

  const { text: versionText } = await getText("/version.json");
  const versionManifest = JSON.parse(stripBom(versionText));
  assert.equal(versionManifest.appVersion, expectedVersion);
  assert.equal(versionManifest.assetVersion, expectedVersion);

  const appAssetVersion = /app\.js\?v=([0-9.]+)/.exec(homeText)?.[1];
  const visualAssetVersion = /visual-polish\.css\?v=([0-9.]+)/.exec(homeText)?.[1];
  const staticAssetVersions = [appAssetVersion, visualAssetVersion].filter(Boolean);
  assert.ok(staticAssetVersions.length, "App shell asset version is missing from index.html.");

  const { text: serviceWorker } = await getText("/sw.js");
  const publicAppJs = stripBom(await readFile(new URL("../public/app.js", import.meta.url), "utf8"));
  const serviceWorkerCacheVersion = /care-nova-ai-v([0-9.]+)/.exec(serviceWorker)?.[1];
  const newestStaticAssetVersion = staticAssetVersions.reduce((latest, version) => (
    compareVersionStrings(version, latest) > 0 ? version : latest
  ), staticAssetVersions[0]);
  assert.ok(serviceWorkerCacheVersion, "Service worker cache version is missing.");
  assert.ok(
    staticAssetVersions.every((version) => version === expectedVersion),
    `Static app shell version drift detected. Expected ${expectedVersion}, received ${staticAssetVersions.join(", ")}.`
  );
  assert.equal(
    newestStaticAssetVersion,
    expectedVersion,
    `Newest static asset version ${newestStaticAssetVersion} does not match package version ${expectedVersion}.`
  );
  assert.ok(
    compareVersionStrings(serviceWorkerCacheVersion, newestStaticAssetVersion) >= 0,
    `Service worker cache ${serviceWorkerCacheVersion} is older than app shell asset ${newestStaticAssetVersion}.`
  );
  assert.equal(
    serviceWorkerCacheVersion,
    expectedVersion,
    `Service worker cache version ${serviceWorkerCacheVersion} does not match package version ${expectedVersion}.`
  );
  for (const version of staticAssetVersions) {
    assert.match(serviceWorker, new RegExp(`\\?v=${version.replaceAll(".", "\\.")}`));
  }
  assert.match(serviceWorker, /OFFLINE_APP_SHELL/);
  assert.match(
    publicAppJs,
    /workerUrl\.searchParams\.set\("v", assetVersion\)/,
    "Service worker registration should include the current asset version."
  );
  assert.match(
    publicAppJs,
    /updateViaCache:\s*"none"/,
    "Service worker registration should bypass HTTP cache during updates."
  );
  assert.match(
    publicAppJs,
    /await registerCareNovaServiceWorker\(\)/,
    "Loopback and hosted runtimes should both register the Care Nova service worker."
  );
  assert.doesNotMatch(
    publicAppJs,
    /if\s*\(isLoopbackRuntime\(\)\)\s*\{\s*await clearCareNovaServiceWorkerArtifacts\(\)/s,
    "Loopback startup must not clear the offline app shell before the app loads."
  );
  assert.match(
    publicAppJs,
    /enforceHostedAssetVersionRefresh/,
    "Hosted builds should refresh when a newer asset version is deployed."
  );

  const criticalResponse = await fetch(`${baseUrl}/api/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      patientId: "deployment-check",
      message: "I have chest pain with sweating and shortness of breath.",
      profile: {
        name: "Demo Patient",
        age: "52",
        conditions: "Hypertension",
        medications: "Amlodipine"
      },
      vitals: {
        heartRate: "132"
      }
    })
  });
  const critical = await criticalResponse.json();

  assert.equal(criticalResponse.status, 200);
  assert.equal(critical.ok, true);
  assert.equal(critical.risk.level, "CRITICAL");
  assert.equal(critical.guardrails.passed, true);
  assert.equal(critical.processingMode, "Local Model");
  assert.equal(critical.modelRouting.generatedUsing, "Local Model");
  assert.equal(critical.finalResponse.processingMode, "Local Model");
  assert.ok(critical.llmBrain.gates.some((gate) => gate.id === "hybrid_model_routing"));
  assert.equal(critical.finalResponse.responseFocus.policy, "focused-answer-only");
  assert.ok(critical.finalResponse.whatToDoNow.length <= 3);
  assert.equal(critical.memory.saved, true);
  assert.equal(critical.externalKnowledge.cacheFile, "data/external/external-knowledge-cache.json");
  assert.equal(critical.externalKnowledge.usedForThisRequest, false);
  assert.equal(critical.trustedSourcePlan.queryType, "urgent-safety");
  assert.ok(critical.qualityEvaluation.score >= 80);
  assert.equal(critical.governanceSnapshot.notMedicalDevice, true);
  assert.ok(critical.knowledgeGraph.factCount >= 1);
  assert.equal(critical.knowledgeGraph.mode, "persistent-local-server");
  assert.equal(critical.safetyTriage.recommendedRoute, "ALERT_AGENT");
  assert.ok(["HIGH", "CRITICAL"].includes(critical.safetyTriage.level));
  assert.ok(critical.evidenceCitations.sourceCount >= 1);
  assert.equal(critical.humanReview.reviewRequired, true);
  assert.ok(critical.preventionPlan.daily.length >= 1);
  assert.equal(critical.doctorReadyReport.status, "doctor-ready-report-ready");
  assert.equal(critical.advancedCapabilities.status, "advanced-snapshot-ready");
  assert.equal(critical.localDataMirror.status, "mirror-synced");
  assert.ok(critical.localDataMirror.files.some((file) => file.mirror.includes("onedrive-mirror")));
  assert.equal(critical.memory.recentTurnCount, 1);
  assert.equal(critical.agenticReview.id, "AGENTIC_SUPERVISOR");
  assert.equal(critical.precisionSupervisor.id, "PRECISION_SUPERVISOR");
  assert.equal(critical.plan.responseOwner.route, "ALERT_AGENT");
  assert.equal(critical.finalResponse.responseFocus.primaryRoute, "ALERT_AGENT");
  assert.ok(critical.smartAnalysis.accuracyEngine.clinicalPrecisionReview.score >= 0);
  assert.equal(critical.modelFlow.activePath.includes("AGENTIC_SUPERVISOR"), false);
  assert.equal(critical.canonicalFlow.steps.length, 8);
  assert.equal(critical.canonicalFlow.activeBucket.route, "ALERT_AGENT");
  assert.equal(critical.modelFlow.qualityReview.id, "AGENTIC_SUPERVISOR");
  assert.ok(critical.agentResults.some((agent) => agent.id === "ALERT_AGENT"));

  await fetch(`${baseUrl}/api/memory/clear`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ patientId: "deployment-check" })
  });
  await fetch(`${baseUrl}/api/records/clear`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ patientId: "deployment-check" })
  });
  await fetch(`${baseUrl}/api/knowledge-graph/clear`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ patientId: "deployment-check" })
  });

  const methodResponse = await fetch(`${baseUrl}/api/health`, {
    method: "POST"
  });
  const methodPayload = await methodResponse.json();

  assert.equal(methodResponse.status, 405);
  assert.equal(methodPayload.code, "METHOD_NOT_ALLOWED");

  const dockerfile = await readFile("Dockerfile", "utf8");
  assert.match(dockerfile, /COPY data \.\/data/);
  assert.match(dockerfile, /HEALTHCHECK/);
  assert.match(dockerfile, /HOST=0\.0\.0\.0/);

  const packageJson = JSON.parse(stripBom(await readFile("package.json", "utf8")));
  assert.equal(packageJson.version, expectedVersion);
  const startLocalScript = await readFile("start-care-nova.cmd", "utf8");
  const startGlobalScript = await readFile("start-care-nova-global.cmd", "utf8");
  const openCareNovaScript = await readFile("scripts/open-care-nova.ps1", "utf8");
  const runCareNovaServerScript = await readFile("scripts/run-care-nova-server.cmd", "utf8");
  assert.match(startLocalScript, /open-care-nova\.ps1" -Mode local/);
  assert.match(startGlobalScript, /open-care-nova\.ps1" -Mode global/);
  assert.match(openCareNovaScript, /http:\/\/127\.0\.0\.1:\$port\//);
  assert.match(openCareNovaScript, /Start-Process -FilePath \$browserUrl/);
  assert.match(openCareNovaScript, /Start-Process -FilePath \$launcherPath/);
  assert.match(runCareNovaServerScript, /if not defined HOST set "HOST=127\.0\.0\.1"/);
  assert.match(runCareNovaServerScript, /if not defined PORT set "PORT=4173"/);
  assert.match(packageJson.scripts["release:check"], /src\/externalKnowledgeStore\.js|src\\externalKnowledgeStore\.js/);
  assert.match(packageJson.scripts["release:check"], /src\/productIntelligence\.js|src\\productIntelligence\.js/);
  assert.match(packageJson.scripts["release:check"], /src\/knowledgeGraphStore\.js|src\\knowledgeGraphStore\.js/);
  assert.match(packageJson.scripts["release:check"], /src\/localDataMirror\.js|src\\localDataMirror\.js/);
  assert.match(packageJson.scripts["release:check"], /src\/trainingEngine\.js|src\\trainingEngine\.js/);
  assert.match(packageJson.scripts["release:check"], /src\/advancedCapabilityEngine\.js|src\\advancedCapabilityEngine\.js/);
  assert.match(packageJson.scripts["release:check"], /scripts\/smoke-test\.js|scripts\\smoke-test\.js/);
  assert.match(packageJson.scripts["release:check"], /scripts\/deployment-check\.js|scripts\\deployment-check\.js/);
  assert.match(packageJson.scripts["release:check"], /scripts\/model-file-check\.js|scripts\\model-file-check\.js/);
  assert.equal(packageJson.scripts["deploy:check"], "node scripts/deployment-check.js");
  assert.equal(packageJson.scripts["model:files"], "node scripts/model-file-check.js");

  const envExample = await readFile(".env.example", "utf8");
  assert.match(envExample, /HOST=0\.0\.0\.0/);
  assert.match(envExample, /PORT=4173/);
  assert.match(envExample, /CARE_NOVA_EXTERNAL_API_ENABLED=false/);
  assert.match(envExample, /CARE_NOVA_MEDLINEPLUS_ENABLED=false/);
  assert.match(envExample, /CARE_NOVA_FHIR_BASE_URL=/);

  console.log("Deployment readiness checks passed.");
} finally {
  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

async function getText(path) {
  const response = await fetch(`${baseUrl}${path}`);
  const text = await response.text();

  assert.equal(response.status, 200, path);

  return { response, text };
}

