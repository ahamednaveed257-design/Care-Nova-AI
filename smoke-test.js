import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { createServerApp } from "../server.js";
import { tryEnhanceAnalyzeResultWithCloudLlm } from "../src/cloudLlmGateway.js";
import { selectHybridModelRoute } from "../src/hybridModelRouter.js";
import { rankLocalMedicalKnowledge } from "../src/localAiEngine.js";
import { offlineMedicalRecords } from "../src/offlineMedicalDatabase.js";

const profile = {
  name: "Naveed",
  age: "52",
  conditions: "Hypertension, Type 2 diabetes",
  medications: "Amlodipine, Metformin",
  allergies: "None",
  baselineBp: "130/85"
};

const validRuntimeStates = new Set(["Offline", "Online", "Online-ready"]);
const validRuntimeModes = new Set([
  "offline-forced-local",
  "online-api-augmented",
  "cached-reference-local",
  "offline-cache-fallback",
  "offline-api-fallback",
  "online-ready-local-safe-core",
  "offline-local-rag"
]);
const validHybridRouterStatuses = new Set([
  "local-ready",
  "hybrid-ready",
  "local-ready-cloud-disabled-by-policy"
]);

function rankLocalKnowledgeForRegression({
  query,
  intents,
  risk,
  routeCategories,
  primaryCategories,
  maxMatches = 5
}) {
  return rankLocalMedicalKnowledge({
    query,
    records: offlineMedicalRecords,
    intents,
    risk,
    routeCategories: new Set(routeCategories),
    primaryCategories: new Set(primaryCategories),
    categoryMap: {
      GENERAL: ["General", "Vitals"],
      SPECIALIST_DOCTOR: ["General", "Vitals", "Labs", "Medication", "Lifestyle", "Urgent Safety"],
      LAB_REPORT: ["Labs"],
      MEDICATION: ["Medication"],
      APPOINTMENT: ["Follow-up"],
      EMERGENCY: ["Urgent Safety"],
      VITALS_TRACKING: ["Vitals"],
      LIFESTYLE: ["Lifestyle"],
      MENTAL_WELLNESS: ["Mental Wellness", "Urgent Safety"],
      HEALTH_RECORDS: ["Records", "Memory"],
      INSURANCE_SUPPORT: ["Insurance", "Claims Operations", "Utilization Management"],
      CARE_TRANSITIONS: ["Care Transitions"]
    },
    maxMatches
  });
}

function runLocalKnowledgeRankingRegressions() {
  const specialistResult = rankLocalKnowledgeForRegression({
    query: "I want a cardiology review of repeated high blood pressure, palpitations, diabetes, glucose 268, and what tests I should discuss.",
    intents: [{ type: "SPECIALIST_DOCTOR", route: "SPECIALIST_DOCTOR_AGENT", confidence: 0.95 }],
    risk: { level: "MEDIUM" },
    routeCategories: ["General", "Vitals", "Labs", "Medication", "Lifestyle", "Urgent Safety"],
    primaryCategories: ["General", "Vitals", "Labs", "Medication", "Lifestyle", "Urgent Safety"]
  });
  const specialistTop3 = specialistResult.matches.slice(0, 3);

  assert.ok(
    specialistTop3.some((match) => /Hypertension Care Pathway|Cardiac Symptom Pathway/i.test(match.title || "")),
    "Local specialist ranking regression: a cardiology specialist query should surface a cardiology pathway in the top three matches."
  );

  const labsResult = rankLocalKnowledgeForRegression({
    query: "Ferritin is low and hemoglobin is low. explain anemia and what doctor questions I should ask.",
    intents: [{ type: "LAB_REPORT", route: "LABS_AGENT", confidence: 0.91 }],
    risk: { level: "LOW" },
    routeCategories: ["Labs", "Vitals"],
    primaryCategories: ["Labs", "Vitals"]
  });
  const labsTop3 = labsResult.matches.slice(0, 3);

  assert.ok(
    labsTop3.some((match) => /Anemia, Ferritin, and Iron Study Review/i.test(match.title || "")),
    "Local labs ranking regression: an anemia lab query should surface the anemia review in the top three matches."
  );
}

const cases = [
  {
    name: "normal symptom query",
    payload: {
      patientId: "demo-patient",
      message: "I have a mild headache and want general advice.",
      profile,
      vitals: {}
    },
    expectedRisk: "LOW",
    expectedAgents: ["RAG_AGENT"]
  },
  {
    name: "missed BP medicine",
    payload: {
      patientId: "demo-patient",
      message: "I feel dizzy and missed my BP tablet yesterday.",
      profile,
      vitals: {
        systolic: "154",
        diastolic: "96"
      }
    },
    expectedRisk: "MEDIUM",
    expectedAgents: ["PHARMACY_AGENT"]
  },
  {
    name: "high BP reading",
    payload: {
      patientId: "demo-patient",
      message: "My BP is high and I have a headache.",
      profile,
      vitals: {
        systolic: "182",
        diastolic: "116"
      }
    },
    expectedRisk: "HIGH",
    expectedAgents: ["ALERT_AGENT"]
  },
  {
    name: "very high BP with severe headache calibration",
    payload: {
      patientId: "demo-patient",
      message: "My BP is 188/122 with severe headache and blurred vision.",
      profile,
      vitals: {
        systolic: "188",
        diastolic: "122"
      }
    },
    expectedRisk: "CRITICAL",
    expectedAgents: ["ALERT_AGENT"]
  },
  {
    name: "chest pain critical warning path",
    payload: {
      patientId: "demo-patient",
      message: "I have chest pain with sweating and shortness of breath.",
      profile,
      vitals: {
        heartRate: "132"
      }
    },
    expectedRisk: "CRITICAL",
    expectedAgents: ["ALERT_AGENT"]
  },
  {
    name: "stroke warning wording path",
    payload: {
      patientId: "demo-patient",
      message: "My face is drooping and I have trouble speaking.",
      profile,
      vitals: {}
    },
    expectedRisk: "CRITICAL",
    expectedAgents: ["ALERT_AGENT"]
  },
  {
    name: "appointment scheduling path",
    payload: {
      patientId: "demo-patient",
      message: "Please help me book a doctor appointment and set a follow-up reminder.",
      profile,
      vitals: {},
      conversationHistory: []
    },
    expectedRisk: "LOW",
    expectedAgents: ["SCHEDULING_AGENT"]
  },
  {
    name: "lab report explanation path",
    payload: {
      patientId: "demo-patient",
      message: "Can you explain my HbA1c and cholesterol lab report in simple words?",
      profile,
      vitals: {}
    },
    expectedRisk: "LOW",
    expectedAgents: ["LABS_AGENT"]
  },
  {
    name: "lifestyle support path",
    payload: {
      patientId: "demo-patient",
      message: "I need diet, hydration, sleep, and walking guidance for better routine.",
      profile,
      vitals: {}
    },
    expectedRisk: "LOW",
    expectedAgents: ["LIFESTYLE_AGENT"]
  },
  {
    name: "mental wellness support path",
    payload: {
      patientId: "demo-patient",
      message: "I feel stressed and anxious and cannot sleep well.",
      profile,
      vitals: {}
    },
    expectedRisk: "LOW",
    expectedAgents: ["WELLNESS_AGENT"]
  },
  {
    name: "health records support path",
    payload: {
      patientId: "demo-patient",
      message: "Create a health record summary with my prescription, doctor note, and report summary.",
      profile,
      vitals: {}
    },
    expectedRisk: "LOW",
    expectedAgents: ["RECORDS_AGENT"]
  },
  {
    name: "insurance support path",
    payload: {
      patientId: "demo-patient",
      message: "Help me organize an insurance billing and coverage question for my claim.",
      profile,
      vitals: {}
    },
    expectedRisk: "LOW",
    expectedAgents: ["INSURANCE_AGENT"]
  },
  {
    name: "context red flag path",
    payload: {
      patientId: "demo-patient",
      message: "I feel weak and dizzy and I am worried.",
      profile,
      vitals: {},
      context: {
        duration: "1-3 days",
        severity: "8",
        careGoal: "urgency",
        supportNow: "alone",
        lastMedicationTime: "",
        redFlags: ["fainting"]
      }
    },
    expectedRisk: "CRITICAL",
    expectedAgents: ["ALERT_AGENT"]
  },
  {
    name: "extreme low sugar warning path",
    payload: {
      patientId: "demo-patient",
      message: "My blood sugar is 48 and I feel confused and faint.",
      profile,
      vitals: {
        bloodSugar: "48"
      }
    },
    expectedRisk: "CRITICAL",
    expectedAgents: ["ALERT_AGENT"]
  },
  {
    name: "message vital extraction path",
    payload: {
      patientId: "demo-patient",
      message: "My blood sugar is 48 and I feel confused and faint.",
      profile,
      vitals: {}
    },
    expectedRisk: "CRITICAL",
    expectedAgents: ["ALERT_AGENT"]
  },
  {
    name: "discharge transitions workflow",
    payload: {
      patientId: "demo-patient",
      message: "Prepare a discharge summary, patient instructions, care plan, post-discharge outreach, readmission monitoring, and quality reporting draft for high BP follow-up.",
      profile,
      vitals: {
        systolic: "166",
        diastolic: "102"
      }
    },
    expectedRisk: "MEDIUM",
    expectedAgents: ["CARE_TRANSITIONS_AGENT"]
  },
  {
    name: "claims operations workflow",
    payload: {
      patientId: "demo-patient",
      message: "Review a claims intake packet with adjudication exception, explanation of benefits, provider inquiry, validation edits, and regulatory reporting needs.",
      profile,
      vitals: {}
    },
    expectedRisk: "LOW",
    expectedAgents: ["CLAIMS_OPS_AGENT"]
  },
  {
    name: "prior auth appeal workflow",
    payload: {
      patientId: "demo-patient",
      message: "Summarize a prior authorization appeal packet with clinical document ingestion, medical policy checks, decision rationale, provider member communication, and audit logging.",
      profile,
      vitals: {}
    },
    expectedRisk: "LOW",
    expectedAgents: ["UTILIZATION_AGENT"]
  },
  {
    name: "gxp batch quality workflow",
    payload: {
      patientId: "demo-patient",
      message: "Review a master batch record with eBR execution, deviation exception narrative, release documentation, QA review, change control, SOP and QMS questions.",
      profile,
      vitals: {}
    },
    expectedRisk: "LOW",
    expectedAgents: ["GXP_QUALITY_AGENT"]
  },
  {
    name: "medtech compliance workflow",
    payload: {
      patientId: "demo-patient",
      message: "Draft MedTech design controls technical file with requirements, user needs, V&V evidence traceability, complaint handling, root cause, CAPA, cybersecurity SBOM, post-market surveillance and regulatory reporting.",
      profile,
      vitals: {}
    },
    expectedRisk: "LOW",
    expectedAgents: ["MEDTECH_COMPLIANCE_AGENT"]
  }
];

const server = createServerApp();
runLocalKnowledgeRankingRegressions();

const cloudRoutePreview = selectHybridModelRoute(
  {
    message: "Summarize a prior authorization appeal packet with clinical document ingestion, medical policy checks, decision rationale, provider member communication, audit logging, and source evidence.",
    risk: { level: "LOW" },
    intents: [{ type: "UTILIZATION_MANAGEMENT", label: "Utilization", route: "UTILIZATION_AGENT", confidence: 0.92 }],
    plan: { execute: ["UTILIZATION_AGENT"] },
    inputQuality: { score: 88 },
    requirementProfile: { answerMode: { id: "deep" }, detailLevel: "deep", expectedRoute: "UTILIZATION_AGENT" },
    medicalKnowledge: { matches: [{ id: "policy" }, { id: "appeal" }, { id: "audit" }], coverageScore: 86 }
  },
  {
    ...process.env,
    CARE_NOVA_MODEL_ROUTING_POLICY: "local-first-auto",
    CARE_NOVA_MODEL_COST_POLICY: "lowest-cost",
    CARE_NOVA_CLOUD_COMPLEXITY_THRESHOLD: "55",
    CARE_NOVA_FORCE_OFFLINE: "false",
    CARE_NOVA_PAID_MODELS_ENABLED: "true",
    CARE_NOVA_CLOUD_MODELS_ENABLED: "true",
    CARE_NOVA_OPENAI_ENABLED: "true",
    OPENAI_API_KEY: "test-key",
    OPENAI_MODEL: "gpt-family",
    CARE_NOVA_ONLINE_MODE: "true",
    CARE_NOVA_INTERNET_AVAILABLE: "true"
  }
);

assert.equal(cloudRoutePreview.generatedUsing, "Hybrid Processing");
assert.equal(cloudRoutePreview.selectedModel.primary.id, "openai");
assert.equal(cloudRoutePreview.failover.ready, true);

const forcedOfflinePreview = selectHybridModelRoute(
  { message: "Simple headache guidance.", risk: { level: "LOW" }, intents: [], plan: { execute: ["RAG_AGENT"] } },
  {
    ...process.env,
    CARE_NOVA_MODEL_ROUTING_POLICY: "local-first-auto",
    CARE_NOVA_FORCE_OFFLINE: "true",
    CARE_NOVA_PAID_MODELS_ENABLED: "true",
    CARE_NOVA_CLOUD_MODELS_ENABLED: "true",
    CARE_NOVA_OPENAI_ENABLED: "true",
    OPENAI_API_KEY: "test-key"
  }
);

assert.equal(forcedOfflinePreview.generatedUsing, "Local Model");
assert.equal(forcedOfflinePreview.connectivity.forcedOffline, true);

const cloudGatewayEnv = {
  ...process.env,
  CARE_NOVA_FORCE_OFFLINE: "false",
  CARE_NOVA_INTERNET_AVAILABLE: "true",
  CARE_NOVA_PAID_MODELS_ENABLED: "true",
  CARE_NOVA_CLOUD_MODELS_ENABLED: "true",
  CARE_NOVA_OPENAI_ENABLED: "true",
  OPENAI_API_KEY: "test-key",
  OPENAI_MODEL: "gpt-5.4",
  CARE_NOVA_TEMP_CLOUD_API_URL: "http://127.0.0.1:1234/v1/chat/completions"
};
const originalFetch = globalThis.fetch;

try {
  globalThis.fetch = async () => ({
    ok: true,
    async json() {
      return {
        choices: [{
          message: {
            content: JSON.stringify({
              title: "Appeal packet summary",
              summary: "Use the local packet to organize the appeal and highlight the policy gap.",
              whatToDoNow: ["Confirm the missing policy requirement.", "Prepare the provider-facing summary."],
              warningSigns: ["Escalate if the packet is missing required evidence."],
              doctorQuestion: "Which policy criterion is still missing from the packet?",
              evidenceFocus: ["Policy summary", "Appeal timeline"],
              confidenceLabel: "grounded-cloud-review"
            })
          }
        }]
      };
    }
  });

  const hybridCloudResult = {
    finalResponse: {
      title: "Local answer",
      summary: "Use the local workflow.",
      whatToDoNow: ["Review the appeal packet."],
      warningSigns: ["Do not submit with missing documents."],
      disclaimer: "Demo only.",
      responseFocus: {
        primaryRoute: "UTILIZATION_AGENT",
        requirement: {
          answerMode: "deep"
        }
      }
    },
    plan: {
      responseOwner: {
        route: "UTILIZATION_AGENT"
      }
    },
    risk: {
      label: "LOW",
      level: "LOW"
    },
    requirementProfile: {
      answerMode: {
        id: "deep"
      }
    },
    modelRouting: {
      processingType: "hybrid",
      selectedModel: {
        primary: {
          id: "openai",
          displayName: "OpenAI GPT",
          type: "cloud"
        },
        fallback: {
          id: "care-nova-local-core",
          displayName: "Care Nova Local Clinical Core",
          type: "local"
        }
      },
      failover: {
        chain: ["OpenAI GPT", "Care Nova Local Clinical Core"]
      }
    },
    agentResults: [{
      id: "UTILIZATION_AGENT",
      output: {
        summary: "Local utilization summary",
        checklist: ["Collect the payer policy."],
        doctorQuestions: []
      }
    }],
    medicalKnowledge: {
      matches: [{
        title: "Policy reference",
        category: "Insurance",
        summary: "Use the approved policy summary already in the packet.",
        safetyNotes: "Administrative draft only.",
        relevance: 91
      }]
    },
    memoryContext: {
      recentTurnCount: 2,
      recentRisks: ["LOW"],
      recentMessages: ["Need help with an appeal packet."]
    },
    model: {}
  };
  const hybridCloudExecution = await tryEnhanceAnalyzeResultWithCloudLlm({
    payload: {
      message: "Summarize this prior authorization appeal packet.",
      profile
    },
    result: structuredClone(hybridCloudResult),
    env: cloudGatewayEnv
  });

  assert.equal(hybridCloudExecution.applied, true);
  assert.equal(hybridCloudExecution.engagementMode, "route-aware-clinical-second-pass");
  assert.equal(hybridCloudExecution.requestedForThisRun, true);

  const localOnlyExecution = await tryEnhanceAnalyzeResultWithCloudLlm({
    payload: {
      message: "I have a mild headache and want general advice.",
      profile
    },
    result: {
      finalResponse: {
        title: "Local answer",
        summary: "Stay hydrated and monitor symptoms.",
        whatToDoNow: ["Hydrate."],
        warningSigns: ["Seek urgent care for severe symptoms."],
        disclaimer: "Demo only.",
        responseFocus: {
          primaryRoute: "RAG_AGENT",
          requirement: {
            answerMode: "quick"
          }
        }
      },
      plan: {
        responseOwner: {
          route: "RAG_AGENT"
        }
      },
      risk: {
        label: "LOW",
        level: "LOW"
      },
      requirementProfile: {
        answerMode: {
          id: "quick"
        }
      },
      modelRouting: {
        processingType: "local",
        selectedModel: {
          primary: {
            id: "deepseek-r1",
            displayName: "DeepSeek-R1",
            type: "local"
          },
          fallback: {
            id: "care-nova-local-core",
            displayName: "Care Nova Local Clinical Core",
            type: "local"
          }
        },
        failover: {
          chain: ["DeepSeek-R1", "Care Nova Local Clinical Core"]
        }
      },
      model: {}
    },
    env: cloudGatewayEnv
  });

  assert.equal(localOnlyExecution.requestedForThisRun, false);
  assert.equal(localOnlyExecution.attempted, false);
} finally {
  globalThis.fetch = originalFetch;
}

await new Promise((resolve) => {
  server.listen(0, "127.0.0.1", resolve);
});

const { port } = server.address();
const baseUrl = `http://127.0.0.1:${port}`;

try {
  const healthResponse = await fetch(`${baseUrl}/api/health`);
  assert.equal(healthResponse.status, 200);
  const health = await healthResponse.json();
  assert.equal(health.ok, true);
  assert.equal(health.status, "healthy");
  assert.equal(health.app, "Care Nova AI");
  assert.equal(health.mode, "online-offline-local-parity");
  assert.equal(health.realtime, true);
  assert.equal(health.install, "pwa-ready");
  assert.equal(health.runtimeParity.sameCoreOnlineOffline, true);
  assert.equal(health.runtimeParity.internetRequired, false);
  assert.equal(health.memory.mode, "persistent-local-server");
  assert.equal(health.memory.file, "data/memory/patient-memory.json");
  assert.equal(health.records.mode, "persistent-local-server");
  assert.equal(health.records.file, "data/records/patient-records.json");
  assert.equal(health.externalKnowledge.mode, "disabled-local-cache-ready");
  assert.equal(health.externalKnowledge.cache.file, "data/external/external-knowledge-cache.json");
  assert.equal(health.externalKnowledge.futureRequestReuse, true);
  assert.equal(health.agenticRuntime.status, "adaptive-runtime-ready");
  assert.ok(validRuntimeStates.has(health.agenticRuntime.systemState));
  assert.ok(validRuntimeModes.has(health.agenticRuntime.activeMode));
  assert.equal(health.agenticRuntime.decision.selectedPath, health.agenticRuntime.activeMode);
  assert.equal(health.agenticRuntime.offline.ready, true);
  assert.equal(health.agenticRuntime.fallbackStrategy.applied, true);
  assert.ok(validHybridRouterStatuses.has(health.hybridRouter.status));
  assert.ok(Number.isInteger(health.hybridRouter.summary.availableCloudModels));
  assert.ok(health.hybridRouter.summary.availableCloudModels >= 0);
  assert.ok(health.hybridRouter.summary.cloudModelCount >= health.hybridRouter.summary.availableCloudModels);
  assert.equal(health.hybridRouter.connectivity.offlineExecutionReady, true);
  assert.ok(health.hybridRouter.processingLabels.includes("Local Model"));
  assert.equal(health.trustedSources.status, "offline-first-trusted-source-ready");
  assert.equal(health.trustedSources.sourceCount, 5);
  assert.equal(health.quality.metricCount, 9);
  assert.equal(health.advancedCapabilities.localFirst, true);
  assert.ok(health.advancedCapabilities.readyFeatures >= 5);
  assert.ok(health.evaluationDashboard.suiteCount >= 6);
  assert.equal(health.knowledgeGraph.mode, "persistent-local-server");
  assert.equal(health.training.mode, "persistent-local-ml-training-store");
  assert.equal(health.machineLearning.classicalMlReady, true);
  assert.equal(health.machineLearning.deepLearningAdapterReady, true);
  assert.equal(health.dataMirror.mode, "localhost-primary-plus-onedrive-local-mirror");
  assert.ok(health.dataMirror.mirrorRoot.includes("onedrive-mirror"));
  assert.equal(health.offlinePacks.runsWithoutInternet, true);
  assert.equal(health.fhir.noEhrCallByDefault, true);
  assert.equal(health.reports.downloadsSupported, true);
  assert.equal(health.deployment.globalReady, true);
  assert.equal(health.deployment.readinessEndpoint, "/api/ready");
  assert.equal(health.deployment.releaseGate, "npm run release:check");

  const readyResponse = await fetch(`${baseUrl}/api/ready`);
  const ready = await readyResponse.json();

  assert.equal(readyResponse.status, 200);
  assert.equal(ready.ok, true);
  assert.equal(ready.status, "ready");
  assert.equal(ready.probes.deploymentReadiness, "/api/deployment-readiness");
  assert.equal(ready.probes.agenticRuntime, "/api/agentic-runtime");
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
  assert.equal(ready.probes.trainingExample, "/api/training/example");
  assert.equal(ready.probes.trainingRun, "/api/training/train");
  assert.equal(ready.probes.trainingEvaluate, "/api/training/evaluate");

  const externalKnowledgeResponse = await fetch(`${baseUrl}/api/external-knowledge`);
  const externalKnowledge = await externalKnowledgeResponse.json();

  assert.equal(externalKnowledgeResponse.status, 200);
  assert.equal(externalKnowledge.ok, true);
  assert.equal(externalKnowledge.externalKnowledge.mode, "disabled-local-cache-ready");
  assert.equal(externalKnowledge.externalKnowledge.cache.file, "data/external/external-knowledge-cache.json");
  assert.equal(externalKnowledge.externalKnowledge.futureRequestReuse, true);

  const agenticRuntimeResponse = await fetch(`${baseUrl}/api/agentic-runtime`);
  const agenticRuntime = await agenticRuntimeResponse.json();

  assert.equal(agenticRuntimeResponse.status, 200);
  assert.equal(agenticRuntime.ok, true);
  assert.equal(agenticRuntime.agenticRuntime.id, "ADAPTIVE_AGENTIC_RUNTIME");
  assert.ok(validRuntimeStates.has(agenticRuntime.agenticRuntime.systemState));
  assert.ok(validRuntimeModes.has(agenticRuntime.agenticRuntime.activeMode));
  assert.equal(agenticRuntime.agenticRuntime.responseContract.complexQueries, "plan-execute-validate-respond");

  const modelRouterResponse = await fetch(`${baseUrl}/api/model-router`);
  const modelRouter = await modelRouterResponse.json();

  assert.equal(modelRouterResponse.status, 200);
  assert.equal(modelRouter.ok, true);
  assert.equal(modelRouter.router.id, "CARE_NOVA_HYBRID_MODEL_ROUTER");
  assert.ok(validHybridRouterStatuses.has(modelRouter.router.status));
  assert.ok(Number.isInteger(modelRouter.router.summary.availableCloudModels));
  assert.ok(modelRouter.router.summary.availableCloudModels >= 0);
  assert.ok(modelRouter.router.summary.cloudModelCount >= modelRouter.router.summary.availableCloudModels);
  assert.equal(modelRouter.router.connectivity.offlineExecutionReady, true);

  const modelRouterPreviewResponse = await fetch(`${baseUrl}/api/model-router/preview`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ message: "Summarize a prior authorization appeal packet with policy evidence and audit logging." })
  });
  const modelRouterPreview = await modelRouterPreviewResponse.json();

  assert.equal(modelRouterPreviewResponse.status, 200);
  assert.equal(modelRouterPreview.ok, true);
  assert.equal(modelRouterPreview.decision.generatedUsing, "Local Model");
  assert.equal(modelRouterPreview.decision.failover.ready, true);

  const trustedSourcesResponse = await fetch(`${baseUrl}/api/trusted-sources?q=cholesterol report`);
  const trustedSources = await trustedSourcesResponse.json();

  assert.equal(trustedSourcesResponse.status, 200);
  assert.equal(trustedSources.ok, true);
  assert.equal(trustedSources.trustedSources.sourceCount, 5);
  assert.equal(trustedSources.plan.queryType, "lab");

  const trustedPlanResponse = await fetch(`${baseUrl}/api/trusted-sources/plan`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ message: "What are metformin side effects?", tab: "medicine" })
  });
  const trustedPlan = await trustedPlanResponse.json();

  assert.equal(trustedPlanResponse.status, 200);
  assert.equal(trustedPlan.ok, true);
  assert.equal(trustedPlan.plan.queryType, "medicine");

  const qualityResponse = await fetch(`${baseUrl}/api/model-quality`);
  const quality = await qualityResponse.json();

  assert.equal(qualityResponse.status, 200);
  assert.equal(quality.ok, true);
  assert.equal(quality.quality.status, "quality-gate-ready");
  assert.ok(quality.quality.metrics.some((metric) => metric.id === "guardrail_compliance"));
  assert.ok(quality.quality.benchmarkCases.some((item) => item.expectedRoute === "ALERT_AGENT"));

  const governanceResponse = await fetch(`${baseUrl}/api/governance`);
  const governance = await governanceResponse.json();

  assert.equal(governanceResponse.status, 200);
  assert.equal(governance.ok, true);
  assert.equal(governance.governance.status, "governance-ready-for-demo");
  assert.equal(governance.governance.privacy.sendsPhiByDefault, false);

  const offlinePacksResponse = await fetch(`${baseUrl}/api/offline-packs`);
  const offlinePacks = await offlinePacksResponse.json();

  assert.equal(offlinePacksResponse.status, 200);
  assert.equal(offlinePacks.ok, true);
  assert.equal(offlinePacks.offlinePacks.summary.runsWithoutInternet, true);
  assert.ok(offlinePacks.offlinePacks.packs.some((pack) => pack.id === "cardiometabolic"));

  const fhirResponse = await fetch(`${baseUrl}/api/fhir`);
  const fhir = await fhirResponse.json();

  assert.equal(fhirResponse.status, 200);
  assert.equal(fhir.ok, true);
  assert.equal(fhir.fhir.summary.noEhrCallByDefault, true);
  assert.ok(fhir.fhir.resources.some((resource) => resource.resource === "Patient"));

  const reportsResponse = await fetch(`${baseUrl}/api/report-templates`);
  const reports = await reportsResponse.json();

  assert.equal(reportsResponse.status, 200);
  assert.equal(reports.ok, true);
  assert.equal(reports.reports.summary.patientSpecific, true);
  assert.ok(reports.reports.templates.some((template) => template.id === "insurance-claim-packet"));

  const advancedCapabilitiesResponse = await fetch(`${baseUrl}/api/advanced-capabilities`);
  const advancedCapabilities = await advancedCapabilitiesResponse.json();

  assert.equal(advancedCapabilitiesResponse.status, 200);
  assert.equal(advancedCapabilities.ok, true);
  assert.equal(advancedCapabilities.status, "advanced-agentic-capabilities-ready");
  assert.ok(advancedCapabilities.features.some((feature) => feature.id === "local_knowledge_graph"));

  const evaluationDashboardResponse = await fetch(`${baseUrl}/api/evaluation-dashboard`);
  const evaluationDashboard = await evaluationDashboardResponse.json();

  assert.equal(evaluationDashboardResponse.status, 200);
  assert.equal(evaluationDashboard.ok, true);
  assert.equal(evaluationDashboard.status, "evaluation-dashboard-ready");
  assert.ok(evaluationDashboard.suites.some((suite) => suite.id === "red_flag_recall"));

  const offlinePackManagerResponse = await fetch(`${baseUrl}/api/offline-pack-manager`);
  const offlinePackManager = await offlinePackManagerResponse.json();

  assert.equal(offlinePackManagerResponse.status, 200);
  assert.equal(offlinePackManager.ok, true);
  assert.equal(offlinePackManager.status, "offline-pack-manager-ready");
  assert.ok(offlinePackManager.packs.every((pack) => pack.checksum));

  const fhirConnectorResponse = await fetch(`${baseUrl}/api/fhir-connector`);
  const fhirConnector = await fhirConnectorResponse.json();

  assert.equal(fhirConnectorResponse.status, 200);
  assert.equal(fhirConnector.ok, true);
  assert.equal(fhirConnector.summary.noEhrCallByDefault, true);
  assert.ok(fhirConnector.scopes.includes("patient/Observation.read"));

  const trustCenterResponse = await fetch(`${baseUrl}/api/admin-trust-center`);
  const trustCenter = await trustCenterResponse.json();

  assert.equal(trustCenterResponse.status, 200);
  assert.equal(trustCenter.ok, true);
  assert.equal(trustCenter.status, "trust-center-ready");
  assert.ok(trustCenter.controls.length >= 4);

  const backupPlanResponse = await fetch(`${baseUrl}/api/backup-plan`);
  const backupPlan = await backupPlanResponse.json();

  assert.equal(backupPlanResponse.status, 200);
  assert.equal(backupPlan.ok, true);
  assert.equal(backupPlan.status, "backup-plan-ready");
  assert.ok(backupPlan.files.includes("data/graph/patient-knowledge-graph.json"));

  const mirrorStatusResponse = await fetch(`${baseUrl}/api/local-data-mirror`);
  const mirrorStatus = await mirrorStatusResponse.json();

  assert.equal(mirrorStatusResponse.status, 200);
  assert.equal(mirrorStatus.ok, true);
  assert.equal(mirrorStatus.mirror.mode, "localhost-primary-plus-onedrive-local-mirror");
  assert.ok(mirrorStatus.mirror.mirrorRoot.includes("onedrive-mirror"));

  const mirrorSyncResponse = await fetch(`${baseUrl}/api/local-data-mirror`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ reason: "smoke-test-sync" })
  });
  const mirrorSync = await mirrorSyncResponse.json();

  assert.equal(mirrorSyncResponse.status, 200);
  assert.equal(mirrorSync.ok, true);
  assert.equal(mirrorSync.mirror.status, "mirror-synced");
  assert.ok(mirrorSync.mirror.fileCount >= 1);
  assert.ok(mirrorSync.mirror.files.some((file) => file.mirror.includes("onedrive-mirror")));

  const knowledgeGraphResponse = await fetch(`${baseUrl}/api/knowledge-graph?patientId=smoke-test`);
  const knowledgeGraph = await knowledgeGraphResponse.json();

  assert.equal(knowledgeGraphResponse.status, 200);
  assert.equal(knowledgeGraph.ok, true);
  assert.equal(knowledgeGraph.graph.mode, "persistent-local-server");

  const safetyTriageResponse = await fetch(`${baseUrl}/api/safety-triage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ message: "I have chest pain and shortness of breath.", profile: { age: "52" } })
  });
  const safetyTriage = await safetyTriageResponse.json();

  assert.equal(safetyTriageResponse.status, 200);
  assert.equal(safetyTriage.ok, true);
  assert.equal(safetyTriage.triage.recommendedRoute, "ALERT_AGENT");
  assert.ok(["HIGH", "CRITICAL"].includes(safetyTriage.triage.level));

  const evidenceResponse = await fetch(`${baseUrl}/api/evidence-citations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ message: "metformin side effects", tab: "medicine" })
  });
  const evidence = await evidenceResponse.json();

  assert.equal(evidenceResponse.status, 200);
  assert.equal(evidence.ok, true);
  assert.ok(evidence.evidence.sourceCount >= 1);

  const multimodalResponse = await fetch(`${baseUrl}/api/multimodal-intake`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ reportText: "HbA1c 8.2 LDL 160 creatinine 1.1 lab result" })
  });
  const multimodal = await multimodalResponse.json();

  assert.equal(multimodalResponse.status, 200);
  assert.equal(multimodal.ok, true);
  assert.equal(multimodal.intake.documentType.id, "lab_report");
  assert.ok(multimodal.intake.markers.some((marker) => marker.marker === "HbA1c"));

  const preventionResponse = await fetch(`${baseUrl}/api/prevention-plan`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ patientId: "smoke-test", message: "diabetes and high blood pressure", profile: { age: "52", conditions: "Diabetes, hypertension" } })
  });
  const prevention = await preventionResponse.json();

  assert.equal(preventionResponse.status, 200);
  assert.equal(prevention.ok, true);
  assert.ok(prevention.preventionPlan.focusAreas.length >= 1);

  const humanReviewResponse = await fetch(`${baseUrl}/api/human-review`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ patientId: "smoke-test", message: "I fainted with chest pain.", result: { risk: { level: "CRITICAL" } } })
  });
  const humanReview = await humanReviewResponse.json();

  assert.equal(humanReviewResponse.status, 200);
  assert.equal(humanReview.ok, true);
  assert.equal(humanReview.review.reviewRequired, true);

  const doctorReportResponse = await fetch(`${baseUrl}/api/doctor-ready-report`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ patientId: "smoke-test", message: "BP is 160/98 and headache", profile: { name: "Test", age: "52" }, vitals: { bpSystolic: "160", bpDiastolic: "98" } })
  });
  const doctorReport = await doctorReportResponse.json();

  assert.equal(doctorReportResponse.status, 200);
  assert.equal(doctorReport.ok, true);
  assert.equal(doctorReport.report.status, "doctor-ready-report-ready");

  const modelResponse = await fetch(`${baseUrl}/api/model`);
  const model = await modelResponse.json();

  assert.equal(modelResponse.status, 200);
  assert.equal(model.ok, true);
  assert.equal(model.model.name, "Care Nova Medical Intelligence Model");
  assert.ok(model.model.integrationTargets.includes("Patient health intake"));
  assert.ok(model.model.integrationTargets.includes("Worldwide PWA installation"));
  assert.ok(model.model.integrationTargets.includes("Cloud or VM deployment"));
  assert.ok(model.model.integrationTargets.includes("Docker container deployment"));
  assert.ok(model.model.integrationTargets.includes("Provider discharge transition workspace"));
  assert.ok(model.model.integrationTargets.includes("Vitals and risk trend workspace"));
  assert.ok(model.model.integrationTargets.includes("Lab report explanation workspace"));
  assert.ok(model.model.integrationTargets.includes("Lifestyle and wellness workspace"));
  assert.ok(model.model.integrationTargets.includes("Records and insurance support workspace"));
  assert.ok(model.model.performancePillars.includes("User-friendly patient intake"));
  assert.ok(model.model.performancePillars.includes("Debounced real-time safety preview while the patient types"));
  assert.ok(model.model.performancePillars.includes("Worldwide-ready installation and deployment packaging"));
  assert.ok(model.model.performancePillars.includes("Offline medical database stored locally for safe demo retrieval"));
  assert.ok(model.model.performancePillars.includes("Offline-first medical knowledge retrieval"));
  assert.ok(model.model.performancePillars.includes("Trillion-scale approved medical corpus ingestion readiness"));
  assert.ok(model.model.performancePillars.includes("Evidence-grounded answers instead of unsafe memorized claims"));
  assert.ok(model.model.performancePillars.includes("Personalized Care Pack with next steps, monitoring, doctor questions, safety signs, and evidence notes"));
  assert.ok(model.model.performancePillars.includes("Four core specialist agents: RAG, Pharmacy, Scheduling, and Alert"));
  assert.ok(model.model.performancePillars.includes("Optional specialty workspaces for vitals, labs, lifestyle, mental wellness, records, insurance, and care coordination"));
  assert.ok(model.model.performancePillars.includes("Clinical accuracy engine with route, evidence, safety, and consistency cross-checks"));
  assert.ok(model.model.architectureLayers.includes("Offline medical database"));
  assert.ok(model.model.architectureLayers.includes("Offline medical knowledge retrieval"));
  assert.ok(model.model.architectureLayers.includes("Optional approved external API cache"));
  assert.ok(model.model.architectureLayers.includes("Clinical knowledge scale layer"));
  assert.ok(model.model.architectureLayers.includes("Clinical accuracy engine"));
  assert.ok(model.model.architectureLayers.includes("Four core specialist agents"));
  assert.ok(model.model.architectureLayers.includes("Personalized Care Pack generator"));
  assert.equal(model.model.knowledgeScale.status, "architecture-ready");
  assert.ok(model.model.knowledgeScale.dataDomains.length >= 8);
  assert.ok(model.model.knowledgeScale.validationGates.length >= 6);
  assert.equal(model.enterpriseUseCases.length, 5);
  assert.equal(model.workflowMatrix.length, 4);
  assert.ok(model.workflowMatrix.some((item) => item.agentRoute === "CLAIMS_OPS_AGENT" && item.workflow === "Claims Intake, Adjudication & Post-Payment Ops"));
  assert.ok(model.workflowMatrix.some((item) => item.agentRoute === "GXP_QUALITY_AGENT" && item.audience === "Pharma & Biopharma"));
  assert.ok(model.workflowMatrix.some((item) => item.agentRoute === "CARE_TRANSITIONS_AGENT" && item.businessArea === "Care Delivery"));
  assert.ok(model.workflowMatrix.some((item) => item.agentRoute === "MEDTECH_COMPLIANCE_AGENT" && item.capabilities.includes("RAG")));
  assert.ok(model.enterpriseUseCases.some((item) => item.agentRoute === "CARE_TRANSITIONS_AGENT"));
  assert.ok(model.enterpriseUseCases.some((item) => item.agentRoute === "CLAIMS_OPS_AGENT"));
  assert.ok(model.enterpriseUseCases.some((item) => item.agentRoute === "UTILIZATION_AGENT"));
  assert.ok(model.enterpriseUseCases.some((item) => item.agentRoute === "GXP_QUALITY_AGENT"));
  assert.ok(model.enterpriseUseCases.some((item) => item.agentRoute === "MEDTECH_COMPLIANCE_AGENT"));
  assert.equal(model.model.flowSteps.length, 8);
  assert.equal(model.model.flowSteps[4].title, "Response Synthesizer");
  assert.equal(model.model.flowSteps[7].title, "Update Memory");
  assert.equal(model.coreAgentBuckets.length, 4);
  assert.ok(model.coreAgentBuckets.some((bucket) => bucket.route === "RAG_AGENT"));
  assert.ok(model.coreAgentBuckets.some((bucket) => bucket.route === "PHARMACY_AGENT"));
  assert.ok(model.coreAgentBuckets.some((bucket) => bucket.route === "SCHEDULING_AGENT"));
  assert.ok(model.coreAgentBuckets.some((bucket) => bucket.route === "ALERT_AGENT"));
  assert.equal(model.canonicalFlow.steps.length, 8);
  assert.equal(model.canonicalFlow.nextTurnLoop, "MEMORY_UPDATE -> PATIENT_INPUT -> MEMORY_STORE");
  assert.ok(model.flow.nodes.some((node) => node.id === "MEMORY_STORE"));
  assert.ok(model.flow.nodes.some((node) => node.id === "AGENTIC_SUPERVISOR"));
  assert.ok(model.flow.nodes.some((node) => node.id === "VITALS_AGENT"));
  assert.ok(model.flow.nodes.some((node) => node.id === "LABS_AGENT"));
  assert.ok(model.flow.nodes.some((node) => node.id === "LIFESTYLE_AGENT"));
  assert.ok(model.flow.nodes.some((node) => node.id === "WELLNESS_AGENT"));
  assert.ok(model.flow.nodes.some((node) => node.id === "RECORDS_AGENT"));
  assert.ok(model.flow.nodes.some((node) => node.id === "INSURANCE_AGENT"));
  assert.ok(model.flow.nodes.some((node) => node.id === "CARE_TRANSITIONS_AGENT"));
  assert.ok(model.flow.nodes.some((node) => node.id === "CLAIMS_OPS_AGENT"));
  assert.ok(model.flow.nodes.some((node) => node.id === "UTILIZATION_AGENT"));
  assert.ok(model.flow.nodes.some((node) => node.id === "GXP_QUALITY_AGENT"));
  assert.ok(model.flow.nodes.some((node) => node.id === "MEDTECH_COMPLIANCE_AGENT"));
  assert.equal(model.knowledgeSystem.mode, "offline-first");
  assert.ok(model.knowledgeSystem.corpusSize >= 30);
  assert.ok(model.knowledgeSystem.offlineDatabase.storedRecords >= 16);
  assert.equal(model.knowledgeScale.target, "Governed trillion-scale medical corpus readiness");
  assert.equal(model.globalDeployment.status, "global-ready");
  assert.ok(model.model.endpoints.some((endpoint) => endpoint.path === "/api/realtime"));
  assert.ok(model.model.endpoints.some((endpoint) => endpoint.path === "/api/memory"));
  assert.ok(model.model.endpoints.some((endpoint) => endpoint.path === "/api/records"));
  assert.ok(model.model.endpoints.some((endpoint) => endpoint.path === "/api/agentic-runtime"));
  assert.ok(model.model.endpoints.some((endpoint) => endpoint.path === "/api/external-knowledge"));
  assert.ok(model.model.endpoints.some((endpoint) => endpoint.path === "/api/external-knowledge/clear"));
  assert.ok(model.model.endpoints.some((endpoint) => endpoint.path === "/api/trusted-sources"));
  assert.ok(model.model.endpoints.some((endpoint) => endpoint.path === "/api/model-quality"));
  assert.ok(model.model.endpoints.some((endpoint) => endpoint.path === "/api/governance"));
  assert.ok(model.model.endpoints.some((endpoint) => endpoint.path === "/api/offline-packs"));
  assert.ok(model.model.endpoints.some((endpoint) => endpoint.path === "/api/fhir"));
  assert.ok(model.model.endpoints.some((endpoint) => endpoint.path === "/api/report-templates"));
  assert.ok(model.model.endpoints.some((endpoint) => endpoint.path === "/api/advanced-capabilities"));
  assert.ok(model.model.endpoints.some((endpoint) => endpoint.path === "/api/evaluation-dashboard"));
  assert.ok(model.model.endpoints.some((endpoint) => endpoint.path === "/api/local-data-mirror"));
  assert.ok(model.model.endpoints.some((endpoint) => endpoint.path === "/api/knowledge-graph"));
  assert.ok(model.model.endpoints.some((endpoint) => endpoint.path === "/api/safety-triage"));
  assert.ok(model.model.endpoints.some((endpoint) => endpoint.path === "/api/evidence-citations"));
  assert.ok(model.model.endpoints.some((endpoint) => endpoint.path === "/api/multimodal-intake"));
  assert.ok(model.model.endpoints.some((endpoint) => endpoint.path === "/api/human-review"));
  assert.ok(model.model.endpoints.some((endpoint) => endpoint.path === "/api/prevention-plan"));
  assert.ok(model.model.endpoints.some((endpoint) => endpoint.path === "/api/doctor-ready-report"));
  assert.ok(model.model.endpoints.some((endpoint) => endpoint.path === "/api/knowledge-graph/clear"));
  assert.ok(model.model.endpoints.some((endpoint) => endpoint.path === "/api/training-readiness"));
  assert.ok(model.model.endpoints.some((endpoint) => endpoint.path === "/api/training"));
  assert.ok(model.model.endpoints.some((endpoint) => endpoint.path === "/api/training/example"));
  assert.ok(model.model.endpoints.some((endpoint) => endpoint.path === "/api/training/train"));
  assert.ok(model.model.endpoints.some((endpoint) => endpoint.path === "/api/training/evaluate"));
  assert.ok(model.model.endpoints.some((endpoint) => endpoint.path === "/api/ready"));
  assert.ok(model.model.endpoints.some((endpoint) => endpoint.path === "/api/deployment-readiness"));

  const knowledgeResponse = await fetch(`${baseUrl}/api/knowledge`);
  const knowledge = await knowledgeResponse.json();

  assert.equal(knowledgeResponse.status, 200);
  assert.equal(knowledge.ok, true);
  assert.equal(knowledge.database.offlineReady, true);
  assert.equal(knowledge.database.trainingStatus, "not-foundation-model-training");
  assert.equal(knowledge.database.scaleTarget, "trillion-token governed medical corpus readiness");
  assert.ok(knowledge.database.storedRecords >= 16);
  assert.ok(knowledge.database.validationGates.length >= 8);
  assert.ok(knowledge.records.some((record) => record.id === "offline-cardiovascular-risk"));

  const trainingResponse = await fetch(`${baseUrl}/api/training-readiness`);
  const training = await trainingResponse.json();

  assert.equal(trainingResponse.status, 200);
  assert.equal(training.ok, true);
  assert.equal(training.status, "governed-training-ready");
  assert.equal(training.activeTraining, false);
  assert.equal(training.trainingStatus, "not-foundation-model-training");
  assert.ok(training.pipeline.some((step) => step.id === "source_approval"));
  assert.ok(training.pipeline.some((step) => step.id === "clinical_evaluation"));
  assert.ok(training.safetyLocks.includes("No unsupervised self-training from patient conversations"));
  assert.equal(training.machineLearning.summary.classicalMlReady, true);
  assert.equal(training.machineLearning.summary.deepLearningAdapterReady, true);
  assert.equal(training.localTrainingCapabilities.status, "ready");

  const trainingStatusResponse = await fetch(`${baseUrl}/api/training`);
  const trainingStatus = await trainingStatusResponse.json();

  assert.equal(trainingStatusResponse.status, 200);
  assert.equal(trainingStatus.ok, true);
  assert.equal(trainingStatus.training.storage.file, "data/training/agent-training-state.json");
  assert.equal(trainingStatus.machineLearning.status, "ml-dl-training-ready");

  const trainingExampleResponse = await fetch(`${baseUrl}/api/training/example`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      id: "smoke-insurance-route-calibration",
      patientId: "smoke-test",
      tab: "insurance",
      message: "Help me organize an insurance claim denial, EOB, appeal deadline, and missing documents.",
      expectedRoute: "INSURANCE_AGENT",
      actualRoute: "INSURANCE_AGENT",
      approved: true,
      rating: 5,
      outcome: "correct",
      tags: ["insurance", "appeal", "claim"]
    })
  });
  const trainingExample = await trainingExampleResponse.json();

  assert.equal(trainingExampleResponse.status, 200);
  assert.equal(trainingExample.ok, true);
  assert.equal(trainingExample.example.expectedRoute, "INSURANCE_AGENT");
  assert.equal(trainingExample.mirror.status, "mirror-synced");

  const trainingRunResponse = await fetch(`${baseUrl}/api/training/train`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({})
  });
  const trainingRun = await trainingRunResponse.json();

  assert.equal(trainingRunResponse.status, 200);
  assert.equal(trainingRun.ok, true);
  assert.equal(trainingRun.status, "trained");
  assert.equal(trainingRun.calibration.enabled, true);
  assert.ok(trainingRun.model.exampleCount >= 1);

  const trainingEvalResponse = await fetch(`${baseUrl}/api/training/evaluate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      message: "I need help with my insurance appeal and claim documents."
    })
  });
  const trainingEval = await trainingEvalResponse.json();

  assert.equal(trainingEvalResponse.status, 200);
  assert.equal(trainingEval.ok, true);
  assert.equal(trainingEval.evaluation.recommendedRoute, "INSURANCE_AGENT");
  assert.equal(trainingEval.evaluation.calibration.enabled, true);

  const readinessResponse = await fetch(`${baseUrl}/api/readiness`);
  const readiness = await readinessResponse.json();

  assert.equal(readinessResponse.status, 200);
  assert.equal(readiness.ok, true);
  assert.equal(readiness.label, "Healthcare safety ready");
  assert.equal(readiness.score, 100);
  assert.ok(readiness.checks.every((check) => check.status === "complete"));
  assert.ok(readiness.checks.some((check) => check.id === "realtime_mode"));
  assert.ok(readiness.checks.some((check) => check.id === "governed_training_pipeline"));
  assert.ok(readiness.checks.some((check) => check.id === "multi_interface"));
  assert.ok(readiness.checks.some((check) => check.id === "care_routes"));
  assert.ok(readiness.checks.some((check) => check.id === "specialist_agents"));
  assert.ok(readiness.checks.some((check) => check.id === "medical_knowledge"));
  assert.ok(readiness.checks.some((check) => check.id === "offline_database"));
  assert.ok(readiness.checks.some((check) => check.id === "knowledge_scale_layer"));
  assert.ok(readiness.checks.some((check) => check.id === "provider_discharge_transitions"));
  assert.ok(readiness.checks.some((check) => check.id === "payer_claims_ops"));
  assert.ok(readiness.checks.some((check) => check.id === "utilization_management"));
  assert.ok(readiness.checks.some((check) => check.id === "gxp_quality"));
  assert.ok(readiness.checks.some((check) => check.id === "medtech_compliance"));
  assert.ok(readiness.checks.some((check) => check.id === "accuracy_controls"));
  assert.ok(readiness.checks.some((check) => check.id === "clinical_accuracy_engine"));
  assert.ok(readiness.checks.some((check) => check.id === "care_pack"));
  assert.ok(readiness.checks.some((check) => check.id === "global_install"));
  assert.ok(readiness.checks.some((check) => check.id === "deployment_release_gate"));
  assert.ok(readiness.checks.some((check) => check.id === "offline_mode"));
  assert.ok(readiness.checks.some((check) => check.id === "local_learning"));
  assert.ok(readiness.checks.some((check) => check.id === "polished_ux"));

  const deploymentResponse = await fetch(`${baseUrl}/api/deployment`);
  const deployment = await deploymentResponse.json();

  assert.equal(deploymentResponse.status, 200);
  assert.equal(deployment.ok, true);
  assert.equal(deployment.globalReady, true);
  assert.equal(deployment.guide.status, "global-ready");
  assert.ok(deployment.guide.installModes.includes("Docker container for portable deployment"));
  assert.ok(deployment.guide.releaseCommands.includes("npm run release:check"));
  assert.ok(deployment.guide.releaseCommands.includes("release-check.cmd"));
  assert.equal(deployment.guide.container.includesOfflineDatabase, true);
  assert.equal(deployment.releaseGate.command, "npm run release:check");
  assert.equal(deployment.releaseGate.windowsCommand, "release-check.cmd");
  assert.ok(deployment.guide.worldwideChecklist.length >= 5);

  const deploymentReadinessResponse = await fetch(`${baseUrl}/api/deployment-readiness`);
  const deploymentReadiness = await deploymentReadinessResponse.json();

  assert.equal(deploymentReadinessResponse.status, 200);
  assert.equal(deploymentReadiness.ok, true);
  assert.equal(deploymentReadiness.status, "deployment-ready");
  assert.equal(deploymentReadiness.score, 100);
  assert.ok(deploymentReadiness.checks.every((check) => check.status === "pass"));
  assert.ok(deploymentReadiness.checks.some((check) => check.id === "docker_packaging"));
  assert.ok(deploymentReadiness.checks.some((check) => check.id === "medical_safety"));

  const dockerfile = await readFile("Dockerfile", "utf8");
  const localLauncher = await readFile("start-care-nova.cmd", "utf8");
  const globalLauncher = await readFile("start-care-nova-global.cmd", "utf8");
  const offlineDatabaseFile = await readFile("data/offline-medical-db.json", "utf8");
  const projectFileMap = await readFile("PROJECT_FILES.md", "utf8");
  const envExample = await readFile(".env.example", "utf8");

  assert.ok(dockerfile.includes("HOST=0.0.0.0"));
  assert.ok(dockerfile.includes("EXPOSE 4173"));
  assert.ok(dockerfile.includes("COPY data ./data"));
  assert.ok(dockerfile.includes("HEALTHCHECK"));
  assert.ok(localLauncher.includes("open-care-nova.ps1"));
  assert.ok(localLauncher.includes("-Mode local"));
  assert.ok(globalLauncher.includes("open-care-nova.ps1"));
  assert.ok(globalLauncher.includes("-Mode global"));
  assert.ok(offlineDatabaseFile.includes("trillion-token governed medical corpus readiness"));
  assert.ok(offlineDatabaseFile.includes("offline-cardiovascular-risk"));
  assert.ok(projectFileMap.includes("Main Model Files"));
  assert.ok(projectFileMap.includes("User Interface Files"));
  assert.ok(projectFileMap.includes("Local Utility Files"));
  assert.ok(envExample.includes("HOST=0.0.0.0"));
  assert.ok(envExample.includes("ENABLE_HSTS=false"));

  const staticFiles = [
    { path: "/", expected: "Ask Care Nova" },
    { path: "/", expected: "profile-summary" },
    { path: "/", expected: "Patient Profile Vault" },
    { path: "/", expected: "data-interface=\"profile\"" },
    { path: "/", expected: "Add patient" },
    { path: "/", expected: "Delete patient" },
    { path: "/", expected: "Common health questions" },
    { path: "/", expected: "Measurement & Safety Context" },
    { path: "/", expected: "Current Safety Check" },
    { path: "/", expected: "Ask Care Nova" },
    { path: "/", expected: "Safe Use Boundary" },
    { path: "/", expected: "Local AI" },
    { path: "/", expected: "general-route-card" },
    { path: "/", expected: "Answer precision" },
    { path: "/", expected: "General" },
    { path: "/", expected: "data-interface=\"specialist\"" },
    { path: "/", expected: "Specialist Disease Intelligence" },
    { path: "/", expected: "data-interface=\"vitals\"" },
    { path: "/", expected: "data-interface=\"medications\"" },
    { path: "/", expected: "data-interface=\"labs\"" },
    { path: "/", expected: "data-interface=\"wellness\"" },
    { path: "/", expected: "data-interface=\"appointments\"" },
    { path: "/", expected: "data-interface=\"records\"" },
    { path: "/", expected: "data-interface=\"insurance\"" },
    { path: "/", expected: "insuranceSamplePack" },
    { path: "/", expected: "What Happened Till Now" },
    { path: "/", expected: "Plan" },
    { path: "/", expected: "Care Nova Care Hub" },
    { path: "/", expected: "Personal Care Team" },
    { path: "/", expected: "Care Nova Care Team" },
    { path: "/", expected: "Care helper network" },
    { path: "/", expected: "Access Center" },
    { path: "/", expected: "Online and offline access" },
    { path: "/", expected: "model-intelligence-strip" },
    { path: "/", expected: "Intent Classifier" },
    { path: "/", expected: "RAG Retrieval" },
    { path: "/", expected: "Four Agents" },
    { path: "/", expected: "Core Agentic Flow" },
    { path: "/", expected: "Response Synthesizer" },
    { path: "/", expected: "Agent Tool Map" },
    { path: "/", expected: "Memory Store" },
    { path: "/", expected: "Safety & Guardrails" },
    { path: "/", expected: "Reference library" },
    { path: "/", expected: "Overview" },
    { path: "/", expected: "Routes" },
    { path: "/", expected: "Evidence" },
    { path: "/", expected: "Offline Library" },
    { path: "/", expected: "Trusted Sources" },
    { path: "/", expected: "Offline Packs" },
    { path: "/", expected: "Readiness" },
    { path: "/", expected: "Quality Gates" },
    { path: "/", expected: "Governance" },
    { path: "/", expected: "FHIR Ready" },
    { path: "/", expected: "How Care Nova Helps" },
    { path: "/", expected: "Health Safety Guidelines" },
    { path: "/", expected: "First Safe Actions" },
    { path: "/", expected: "Safety Topic Library" },
    { path: "/", expected: "Before You Call Care" },
    { path: "/", expected: "Do / Avoid" },
    { path: "/", expected: "Caregiver Safety Setup" },
    { path: "/", expected: "Safety Check Console" },
    { path: "/", expected: "Vital Specialist Agent" },
    { path: "/", expected: "BMI & Body Metrics" },
    { path: "/", expected: "Daily Maintenance" },
    { path: "/", expected: "vitals-agent-grid" },
    { path: "/", expected: "Medicine Specialist Agent" },
    { path: "/", expected: "Label & Use Safety" },
    { path: "/", expected: "Ask Pharmacist" },
    { path: "/", expected: "medicine-agent-grid" },
    { path: "/", expected: "Lab Intelligence Agent" },
    { path: "/", expected: "Report Readiness" },
    { path: "/", expected: "Extracted Markers" },
    { path: "/", expected: "Clinician Packet" },
    { path: "/", expected: "Trend View" },
    { path: "/", expected: "Saved Lab Reports" },
    { path: "/", expected: "Wellness Coach Agent" },
    { path: "/", expected: "Readiness Score" },
    { path: "/", expected: "7-Day Adaptive Plan" },
    { path: "/", expected: "Daily Check-in" },
    { path: "/", expected: "Visit Planner Agent" },
    { path: "/", expected: "Planning Options" },
    { path: "/", expected: "Local Visit History" },
    { path: "/", expected: "Lab Report" },
    { path: "/", expected: "Lifestyle Guide" },
    { path: "/", expected: "Mental Wellness" },
    { path: "/", expected: "Patient Records Vault" },
    { path: "/", expected: "Record Browser" },
    { path: "/", expected: "Vault Status" },
    { path: "/", expected: "Insurance Help" },
    { path: "/", expected: "Insurance Claim Navigator" },
    { path: "/", expected: "Care Transition" },
    { path: "/", expected: "modelRouteCount" },
    { path: "/", expected: "modelActiveRoutes" },
    { path: "/", expected: "modelDatabaseList" },
    { path: "/", expected: "general-main-grid" },
    { path: "/", expected: "precision-snapshot" },
    { path: "/", expected: "precisionClarity" },
    { path: "/", expected: "precisionEvidence" },
    { path: "/", expected: "messageCount" },
    { path: "/", expected: "riskDial" },
    { path: "/", expected: "Save summary" },
    { path: "/", expected: "icon-install" },
    { path: "/", expected: "livePreviewTitle" },
    { path: "/", expected: "Smart triage route" },
    { path: "/", expected: "previewScore" },
    { path: "/", expected: "routePreview" },
    { path: "/", expected: "realTimeMode" },
    { path: "/", expected: "Ready when you are" },
    { path: "/", expected: "realTimeSummary" },
    { path: "/", expected: "Training" },
    { path: "/", expected: "modelTrainingList" },
    { path: "/", expected: "Knowledge Update Path" },
    { path: "/", expected: "Report Templates" },
    { path: "/styles.css", expected: ".care-pack" },
    { path: "/styles.css", expected: ".response-graphic" },
    { path: "/styles.css", expected: ".care-details-panel" },
    { path: "/styles.css", expected: ".care-action-board" },
    { path: "/styles.css", expected: ".visit-note-card" },
    { path: "/styles.css", expected: ".agent-tool-grid" },
    { path: "/styles.css", expected: ".action-board-tools" },
    { path: "/styles.css", expected: ".live-preview" },
    { path: "/styles.css", expected: ".realtime-card" },
    { path: "/styles.css", expected: ".switch-control" },
    { path: "/styles.css", expected: ".preview-actions" },
    { path: "/styles.css", expected: "--font-reading" },
    { path: "/styles.css", expected: ".care-pack-icon" },
    { path: "/styles.css", expected: ".precision-card:hover" },
    { path: "/", expected: "data-theme=\"clinical\"" },
    { path: "/", expected: "data-theme=\"calm\"" },
    { path: "/", expected: "Light" },
    { path: "/", expected: "Calm" },
    { path: "/", expected: "data-interface-view=\"atlas\"" },
    { path: "/", expected: "atlasInterface" },
    { path: "/", expected: "atlas-shelf-panel" },
    { path: "/", expected: "Library shelves" },
    { path: "/", expected: "icon-sprite" },
    { path: "/styles.css", expected: ".interface-tabs" },
    { path: "/styles.css", expected: ".command-dock" },
    { path: "/styles.css", expected: ".command-status" },
    { path: "/styles.css", expected: ".command-button" },
    { path: "/styles.css", expected: ".care-map-scan" },
    { path: "/styles.css", expected: ".profile-details" },
    { path: "/styles.css", expected: ".quick-scenarios" },
    { path: "/styles.css", expected: ".workspace-search" },
    { path: "/styles.css", expected: ".workspace-search-result" },
    { path: "/styles.css", expected: ".workspace-result-chip" },
    { path: "/styles.css", expected: ".interface-tab.has-signal" },
    { path: "/styles.css", expected: ".model-intelligence-card" },
    { path: "/styles.css", expected: ".agent-hero" },
    { path: "/styles.css", expected: ".autonomous-agent-card" },
    { path: "/styles.css", expected: ".access-hero" },
    { path: "/styles.css", expected: ".access-card" },
    { path: "/styles.css", expected: ".safety-detail-panel" },
    { path: "/styles.css", expected: ".safety-topic-grid" },
    { path: "/styles.css", expected: ".safety-review-map" },
    { path: "/styles.css", expected: ".safety-do-grid" },
    { path: "/styles.css", expected: "@keyframes commandSignal" },
    { path: "/styles.css", expected: ".model-tabs" },
    { path: "/styles.css", expected: ".training-hero" },
    { path: "/styles.css", expected: ".model-route-card" },
    { path: "/styles.css", expected: ".specialty-grid" },
    { path: "/styles.css", expected: ".specialty-hero-card" },
    { path: "/styles.css", expected: ".atlas-grid" },
    { path: "/styles.css", expected: ".atlas-body-map" },
    { path: "/styles.css", expected: ".atlas-shelf-card" },
    { path: "/styles.css", expected: "minmax(min(100%, 240px), 1fr)" },
    { path: "/styles.css", expected: ".route-vitals" },
    { path: "/styles.css", expected: ".route-labs" },
    { path: "/styles.css", expected: ".route-wellness" },
    { path: "/styles.css", expected: ".model-hero-card" },
    { path: "/styles.css", expected: ".care-graphic" },
    { path: "/styles.css", expected: ".graph-node.is-transition" },
    { path: "/styles.css", expected: ".graph-node.is-supervisor" },
    { path: "/styles.css", expected: "@keyframes graphic-scan" },
    { path: "/styles.css", expected: ".workspace-card" },
    { path: "/styles.css", expected: ".general-main-grid" },
    { path: "/styles.css", expected: ".risk-dial" },
    { path: "/styles.css", expected: ".precision-snapshot" },
    { path: "/styles.css", expected: ".precision-card" },
    { path: "/styles.css", expected: "@keyframes carePulse" },
    { path: "/styles.css", expected: ".empty-state-icon" },
    { path: "/app.js", expected: "iconForAgent" },
    { path: "/app.js", expected: "formatAgentDetail" },
    { path: "/app.js", expected: "accuracyProfile" },
    { path: "/app.js", expected: "accuracyEngine" },
    { path: "/app.js", expected: "knowledgeScale" },
    { path: "/app.js", expected: "loadKnowledge" },
    { path: "/app.js", expected: "loadTrainingReadiness" },
    { path: "/app.js", expected: "scheduleRealtimeAnalysis" },
    { path: "/app.js", expected: "/api/realtime" },
    { path: "/app.js", expected: "modelDatabaseList" },
    { path: "/app.js", expected: "updatePrecisionSnapshot" },
    { path: "/app.js", expected: "compactText" },
    { path: "/app.js", expected: "switchModelTab" },
    { path: "/app.js", expected: "renderModelHub" },
    { path: "/app.js", expected: "buildDashboardDoctorNote" },
    { path: "/app.js", expected: "switchInterface" },
    { path: "/app.js", expected: "syncThemeBackground" },
    { path: "/app.js", expected: "themeSurfaces" },
    { path: "/app.js", expected: "interfaceLabels" },
    { path: "/app.js", expected: "updateCommandDock" },
    { path: "/app.js", expected: "commandDockStatus" },
    { path: "/app.js", expected: "interfaceNames" },
    { path: "/app.js", expected: "specialtyWorkspaces" },
    { path: "/app.js", expected: "Medical Atlas Agent" },
    { path: "/app.js", expected: "atlasReferenceExpansionPacks" },
    { path: "/app.js", expected: "Adult Screening Checklist" },
    { path: "/app.js", expected: "Vaccine & Immunization Planner" },
    { path: "/app.js", expected: "Medical Terms Decoder" },
    { path: "/app.js", expected: "renderSpecialtyWorkspaces" },
    { path: "/app.js", expected: "applySpecialtyTemplate" },
    { path: "/app.js", expected: "updateCareCompass" },
    { path: "/app.js", expected: "updateRiskDial" },
    { path: "/app.js", expected: "initializeInstallApp" },
    { path: "/app.js", expected: "beforeinstallprompt" },
    { path: "/app.js", expected: "createCarePackCard" },
    { path: "/app.js", expected: "createCareActionBoard" },
    { path: "/app.js", expected: "updateActionBoardProgress" },
    { path: "/app.js", expected: "buildCareActionNote" },
    { path: "/app.js", expected: "buildVisitNote" },
    { path: "/app.js", expected: "createResponseGraphic" },
    { path: "/app.js", expected: "createCareDetails" },
    { path: "/app.js", expected: "updateLivePreview" },
    { path: "/app.js", expected: "initializeWorkspaceSearch" },
    { path: "/app.js", expected: "workspaceSearchConfig" },
    { path: "/app.js", expected: "singleAgentMode" },
    { path: "/app.js", expected: "preferredAgent" },
    { path: "/app.js", expected: "agentRoute" },
    { path: "/app.js", expected: "requirementProfile" },
    { path: "/app.js", expected: "requirementFit" },
    { path: "/app.js", expected: "handleWorkspaceSearchSubmit" },
    { path: "/app.js", expected: "renderInterfaceStatus" },
    { path: "/app.js", expected: "createResultMetaChip" },
    { path: "/app.js", expected: "applyPreviewAction" },
    { path: "/app.js", expected: "applyAgentLaunch" },
    { path: "/app.js", expected: "handleAccessAction" },
    { path: "/app.js", expected: "renderAccessStatus" },
    { path: "/app.js", expected: "renderAgentWorkspace" },
    { path: "/app.js", expected: "loadProductIntelligence" },
    { path: "/app.js", expected: "getPatientDataRecordsStorageKey" },
    { path: "/app.js", expected: "downloadPatientReportJson" },
    { path: "/app.js", expected: "downloadPatientRecordsCsv" },
    { path: "/app.js", expected: "updateMessageCount" },
    { path: "/sw.js", expected: "CACHE_NAME" },
    { path: "/sw.js", expected: "OFFLINE_APP_SHELL" },
    { path: "/site.webmanifest", expected: "Care Nova AI" },
    { path: "/site.webmanifest", expected: "display_override" },
    { path: "/site.webmanifest", expected: "app-icon.svg" },
    { path: "/app-icon.svg", expected: "Care Nova AI" },
    { path: "/favicon.svg", expected: "Care Nova AI" },
    { path: "/robots.txt", expected: "Allow: /" }
  ];

  for (const staticFile of staticFiles) {
    const response = await fetch(`${baseUrl}${staticFile.path}`);
    const content = await response.text();

    assert.equal(response.status, 200, staticFile.path);
    assert.ok(content.includes(staticFile.expected), staticFile.path);
  }

  const homeResponse = await fetch(`${baseUrl}/`);
  const homeContent = await homeResponse.text();
  assert.equal(homeContent.includes('data-theme="care"'), false);
  assert.equal(homeContent.includes('data-theme="night"'), false);
  assert.equal(homeContent.includes('data-interface="impact"'), false);
  assert.equal(homeContent.includes("Care Intelligence Proof"), false);
  assert.equal(homeContent.includes("Submission details"), false);
  assert.equal(homeContent.includes("Business Impact Brief"), false);
  assert.equal((homeContent.match(/class="theme-button/g) || []).length, 3);

  const realtimeResponse = await fetch(`${baseUrl}/api/realtime`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      patientId: "demo-patient",
      message: "I have chest pain with sweating and shortness of breath.",
      profile,
      vitals: {
        heartRate: "132"
      },
      conversationHistory: []
    })
  });
  const realtime = await realtimeResponse.json();

  assert.equal(realtimeResponse.status, 200);
  assert.equal(realtime.ok, true);
  assert.equal(realtime.risk.level, "CRITICAL");
  assert.equal(realtime.realtime.enabled, true);
  assert.equal(realtime.realtime.memoryWrite, false);
  assert.equal(realtime.realtime.historyWrite, false);
  assert.ok(Number.isFinite(realtime.realtime.latencyMs));

  const precisionOwnerCases = [
    {
      name: "doctor note handoff response owner",
      expectedRoute: "RECORDS_AGENT",
      expectedOwner: "RECORDS_AGENT",
      message: "Prepare a doctor note handoff summary for my BP follow-up.",
      answerMode: "handoff",
      vitals: {
        systolic: "154",
        diastolic: "94"
      }
    },
    {
      name: "claims operations response owner",
      expectedRoute: "CLAIMS_OPS_AGENT",
      expectedOwner: "CLAIMS_OPS_AGENT",
      unexpectedRoute: "GXP_QUALITY_AGENT",
      message: "Review a claims intake packet with adjudication exception and provider inquiry.",
      vitals: {}
    },
    {
      name: "high risk safety response owner",
      expectedRoute: "ALERT_AGENT",
      expectedOwner: "ALERT_AGENT",
      message: "I have chest pain with sweating and shortness of breath.",
      vitals: {
        heartRate: "132"
      }
    }
  ];

  for (const [index, testCase] of precisionOwnerCases.entries()) {
    const patientId = `precision-owner-smoke-${Date.now()}-${index}`;
    const response = await fetch(`${baseUrl}/api/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        patientId,
        message: testCase.message,
        profile,
        vitals: testCase.vitals,
        answerMode: testCase.answerMode
      })
    });
    const result = await response.json();
    const evidenceGate = result.precisionSupervisor?.gates?.find((gate) => gate.id === "evidence_grounding");

    assert.equal(response.status, 200, testCase.name);
    assert.equal(result.ok, true, testCase.name);
    assert.equal(result.precisionSupervisor?.id, "PRECISION_SUPERVISOR", testCase.name);
    assert.equal(result.requirementProfile?.expectedRoute, testCase.expectedRoute, testCase.name);
    assert.equal(result.plan?.responseOwner?.route, testCase.expectedOwner, testCase.name);
    assert.equal(result.finalResponse?.responseFocus?.primaryRoute, testCase.expectedOwner, testCase.name);
    assert.ok(result.precisionSupervisor?.routeEvidence?.some((item) => item.route === testCase.expectedOwner && item.passed), testCase.name);
    assert.equal(evidenceGate?.passed, true, testCase.name);
    assert.ok(result.trustedSourcePlan?.plannedSources?.length >= 1, testCase.name);
    assert.ok(result.qualityEvaluation?.score >= 65, testCase.name);
    assert.equal(result.governanceSnapshot?.notMedicalDevice, true, testCase.name);
    assert.ok(result.knowledgeGraph?.factCount >= 1, testCase.name);
    assert.equal(result.knowledgeGraph?.mode, "persistent-local-server", testCase.name);
    assert.ok(result.evidenceCitations?.sourceCount >= 1, testCase.name);
    assert.ok(result.safetyTriage?.recommendedRoute, testCase.name);
    assert.ok(result.preventionPlan?.daily?.length >= 1, testCase.name);
    assert.ok(result.humanReview?.checklist?.length >= 3, testCase.name);
    assert.equal(result.doctorReadyReport?.status, "doctor-ready-report-ready", testCase.name);
    assert.equal(result.advancedCapabilities?.status, "advanced-snapshot-ready", testCase.name);
    assert.equal(result.localDataMirror?.status, "mirror-synced", testCase.name);
    assert.ok(result.localDataMirror?.files?.some((file) => file.mirror.includes("onedrive-mirror")), testCase.name);

    if (testCase.unexpectedRoute) {
      assert.equal(result.plan.execute.includes(testCase.unexpectedRoute), false, testCase.name);
    }

    await fetch(`${baseUrl}/api/memory/clear`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ patientId })
    });
  }

  const singleAgentCases = [
    {
      name: "medicine tab single-agent response",
      preferredAgent: "PHARMACY_AGENT",
      interfaceName: "medications",
      message: "I missed my blood pressure tablet yesterday and feel dizzy.",
      vitals: {
        systolic: "158",
        diastolic: "98"
      }
    },
    {
      name: "vitals tab single-agent response",
      preferredAgent: "VITALS_AGENT",
      interfaceName: "vitals",
      message: "My BP is 170/105 and I have a headache.",
      vitals: {
        systolic: "170",
        diastolic: "105"
      }
    },
    {
      name: "atlas tab single-agent education response",
      preferredAgent: "RAG_AGENT",
      interfaceName: "atlas",
      message: "Explain hypertension disease symptoms, prevention, medicine side effects, interactions, charts, and medical images without diagnosis or dosage.",
      vitals: {}
    },
    {
      name: "specialist tab single-agent disease response",
      preferredAgent: "SPECIALIST_DOCTOR_AGENT",
      interfaceName: "specialist",
      message: "Specialist doctor review - heart and blood pressure: Explain hypertension prevention, tests, symptoms to watch, and urgent signs.",
      vitals: {
        systolic: "148",
        diastolic: "92"
      }
    },
    {
      name: "safety tab single-agent response",
      preferredAgent: "ALERT_AGENT",
      interfaceName: "safety",
      message: "I have chest pain with sweating and shortness of breath.",
      vitals: {
        heartRate: "132"
      }
    }
  ];

  for (const [index, testCase] of singleAgentCases.entries()) {
    const patientId = `single-agent-smoke-${Date.now()}-${index}`;
    const response = await fetch(`${baseUrl}/api/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        patientId,
        message: testCase.message,
        profile,
        vitals: testCase.vitals,
        interfaceName: testCase.interfaceName,
        singleAgentMode: true,
        preferredAgent: testCase.preferredAgent
      })
    });
    const result = await response.json();

    assert.equal(response.status, 200, testCase.name);
    assert.equal(result.ok, true, testCase.name);
    assert.equal(result.plan.strategy, "single-agent-tab-response", testCase.name);
    assert.equal(result.plan.parallel, false, testCase.name);
    assert.deepEqual(result.plan.execute, [testCase.preferredAgent], testCase.name);
    assert.equal(result.plan.responseOwner?.route, testCase.preferredAgent, testCase.name);
    assert.equal(result.singleAgent.enabled, true, testCase.name);
    assert.equal(result.singleAgent.route, testCase.preferredAgent, testCase.name);
    assert.equal(result.precisionSupervisor?.id, "PRECISION_SUPERVISOR", testCase.name);
    assert.equal(result.precisionSupervisor?.plan?.responseOwner?.route, testCase.preferredAgent, testCase.name);
    assert.ok(result.precisionSupervisor?.gates?.some((gate) => gate.id === "safety_coverage" && gate.passed), testCase.name);
    assert.ok(result.precisionSupervisor?.routeEvidence?.some((item) => item.route === testCase.preferredAgent), testCase.name);
    assert.equal(result.agentResults.length, 1, testCase.name);
    assert.equal(result.agentResults[0].id, testCase.preferredAgent, testCase.name);
    assert.ok(result.agentResults[0].output.reasoning?.score >= 0, testCase.name);
    assert.ok(result.agentResults[0].output.reasoning?.evidence?.length > 0, testCase.name);
    assert.ok(result.reasoningQuality?.score >= 0, testCase.name);
    assert.ok(result.performance?.score >= 0, testCase.name);
    assert.equal(result.requirementProfile.expectedRoute, testCase.preferredAgent, testCase.name);
    assert.ok(result.requirementProfile.score >= 0, testCase.name);
    assert.ok(result.smartAnalysis.requirementFit.score >= 0, testCase.name);

    if (testCase.preferredAgent === "SPECIALIST_DOCTOR_AGENT") {
      const specialistOutput = result.agentResults[0].output || {};
      const referenceTitles = Array.isArray(specialistOutput.references)
        ? specialistOutput.references.map((item) => item.title || item.source || "")
        : [];

      assert.match(specialistOutput.specialty || "", /heart|blood pressure/i, `${testCase.name} should keep the requested specialist domain`);
      assert.ok(
        referenceTitles.some((title) => /blood pressure|cardio|heart/i.test(title)),
        `${testCase.name} should keep on-domain specialist references`
      );
      assert.ok(
        Array.isArray(specialistOutput.specialistActions) && specialistOutput.specialistActions.length >= 3,
        `${testCase.name} should expose actionable specialist next steps`
      );
    }
    assert.ok(result.smartAnalysis.agentContracts.some((contract) => contract.id === testCase.preferredAgent && contract.responseOwner), testCase.name);
    assert.equal(result.finalResponse.responseFocus.policy, "focused-answer-only", testCase.name);
    assert.equal(result.finalResponse.responseFocus.primaryRoute, testCase.preferredAgent, testCase.name);
    assert.ok(result.finalResponse.requirementFit.score >= 0, testCase.name);
    assert.ok(result.finalResponse.reasoningQuality?.score >= 0, testCase.name);
    assert.equal(result.guardrails.passed, true, testCase.name);
    assert.deepEqual(result.memory.history[0].routes, [testCase.preferredAgent], testCase.name);
    assert.equal(result.memory.history[0].requirement.expectedRoute, testCase.preferredAgent, testCase.name);

    await fetch(`${baseUrl}/api/memory/clear`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ patientId })
    });
  }

  {
    const patientId = `specialist-structured-${Date.now()}`;
    const response = await fetch(`${baseUrl}/api/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        patientId,
        profile,
        interfaceName: "specialist",
        singleAgentMode: true,
        preferredAgent: "SPECIALIST_DOCTOR_AGENT",
        vitals: {
          systolic: "150",
          diastolic: "95",
          heartRate: "88"
        },
        context: {
          duration: "more-than-3-days",
          severity: "6",
          careGoal: "understand",
          supportNow: "with-someone",
          redFlags: [],
          specialistLens: "tests",
          riskModifiers: ["diabetes", "high-blood-pressure"]
        },
        message: [
          "Specialist doctor review - heart and blood pressure: Patient question: I have repeated high blood pressure with headache and want a specialist review of what tests to discuss and what warning signs matter.",
          "Structured specialist intake:",
          "Specialty: Heart and blood pressure.",
          "Timeline: more-than-3-days; severity: moderate; goal: tests.",
          "Lens: tests.",
          "History: Hypertension with Type 2 diabetes.",
          "Risks: age over 50, diabetes.",
          "Readings: BP 150/95, pulse 88.",
          "Reports: LDL and kidney labs if available.",
          "Meds/allergies: Amlodipine, Metformin.",
          "Risk modifiers: diabetes, high blood pressure.",
          "Urgent signs: none.",
          "Disease guide focus: Heart and blood pressure.",
          "Specialist library map: severe headache, vision change, chest discomfort, BP log, kidney labs, ECG.",
          "Use only the specialist disease intelligence agent."
        ].join("\n")
      })
    });
    const result = await response.json();
    const specialistOutput = result.agentResults?.[0]?.output || {};
    const safetyGate = specialistOutput.specialistProfile?.safetyGate || specialistOutput.safetyGate || {};

    assert.equal(response.status, 200, "specialist structured intake regression");
    assert.equal(result.ok, true, "specialist structured intake regression");
    assert.equal(result.finalResponse?.responseFocus?.primaryRoute, "SPECIALIST_DOCTOR_AGENT", "specialist structured intake regression");
    assert.notEqual(result.risk.level, "CRITICAL", "specialist structured intake regression");
    assert.notEqual(safetyGate.level, "urgent-first", "specialist structured intake regression");
    assert.ok(!(safetyGate.signals || []).some((signal) => /chest pain|breathing trouble|stroke-like sign|fainting|seizure/i.test(String(signal))), "specialist structured intake regression");
    assert.match(
      `${specialistOutput.priorityAnswer || ""} ${(specialistOutput.doctorQuestions || []).join(" ")}`,
      /test|reading|bp|ecg|kidney|follow-up/i,
      "specialist structured intake regression should stay aligned to the selected tests lens"
    );

    await fetch(`${baseUrl}/api/memory/clear`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ patientId })
    });
  }

  {
    const patientId = `specialist-explicit-focus-${Date.now()}`;
    const response = await fetch(`${baseUrl}/api/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        patientId,
        profile,
        interfaceName: "specialist",
        singleAgentMode: true,
        preferredAgent: "SPECIALIST_DOCTOR_AGENT",
        vitals: {
          systolic: "154",
          diastolic: "96",
          heartRate: "102",
          bloodSugar: "268"
        },
        context: {
          duration: "more-than-3-days",
          severity: "5",
          careGoal: "follow-up",
          supportNow: "with-someone",
          redFlags: [],
          specialistFocus: "cardiology",
          specialistLens: "tests",
          riskModifiers: ["diabetes", "high-blood-pressure"]
        },
        message: "I want a cardiology review of whether high BP and palpitations change what tests I should discuss. I also have diabetes, glucose 268, HbA1c 9.1, urine albumin positive, and use metformin and insulin."
      })
    });
    const result = await response.json();
    const specialistOutput = result.agentResults?.[0]?.output || {};

    assert.equal(response.status, 200, "specialist explicit focus regression");
    assert.equal(result.ok, true, "specialist explicit focus regression");
    assert.equal(result.finalResponse?.responseFocus?.primaryRoute, "SPECIALIST_DOCTOR_AGENT", "specialist explicit focus regression");
    assert.equal(specialistOutput.specialistProfile?.domainId, "cardiology", "specialist explicit focus regression");
    assert.equal(specialistOutput.specialty, "Heart and blood pressure", "specialist explicit focus regression");
    assert.equal(specialistOutput.supportReview?.active, true, "specialist explicit focus regression");
    assert.ok(
      Array.isArray(specialistOutput.supportReview?.activeChecks)
        && specialistOutput.supportReview.activeChecks.some((item) => /vitals|medicine|labs/i.test(String(item))),
      "specialist explicit focus regression"
    );
    assert.ok(
      (specialistOutput.references || []).slice(0, 2).some((reference) => /blood pressure|heart|bp|cardio/i.test(`${reference.title || ""} ${reference.source || ""}`)),
      "specialist explicit focus regression"
    );

    await fetch(`${baseUrl}/api/memory/clear`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ patientId })
    });
  }

  {
    const patientId = `specialist-support-lane-${Date.now()}`;
    const response = await fetch(`${baseUrl}/api/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        patientId,
        profile: {
          ...profile,
          medications: "",
          allergies: "",
          notes: ""
        },
        interfaceName: "specialist",
        singleAgentMode: true,
        preferredAgent: "SPECIALIST_DOCTOR_AGENT",
        vitals: {
          systolic: "148",
          diastolic: "92",
          heartRate: "84"
        },
        context: {
          duration: "more-than-3-days",
          severity: "5",
          careGoal: "understand",
          supportNow: "with-someone",
          redFlags: [],
          specialistFocus: "cardiology",
          specialistLens: "tests",
          riskModifiers: ["high-blood-pressure"]
        },
        message: [
          "Specialist doctor review - heart and blood pressure: Patient question: I have repeated high blood pressure and headache and want to know what tests to discuss next.",
          "Structured specialist intake:",
          "Specialty: Heart and blood pressure.",
          "Timeline: more-than-3-days; severity: moderate; goal: tests.",
          "Lens: tests.",
          "History: Hypertension.",
          "Risks: age over 50.",
          "Readings: BP 148/92, pulse 84.",
          "Reports: none.",
          "Meds/allergies: none.",
          "Risk modifiers: high blood pressure.",
          "Urgent signs: none.",
          "Disease guide focus: Heart and blood pressure.",
          "Specialist library map: severe headache, vision change, chest discomfort, BP log, kidney labs, ECG.",
          "The specialist disease intelligence agent owns the response.",
          "Use internal vitals, medicine, and lab cross-checks only when the patient entered that context."
        ].join("\n")
      })
    });
    const result = await response.json();
    const specialistOutput = result.agentResults?.[0]?.output || {};
    const activeChecks = Array.isArray(specialistOutput.supportReview?.activeChecks)
      ? specialistOutput.supportReview.activeChecks.map((item) => String(item).toLowerCase())
      : [];

    assert.equal(response.status, 200, "specialist support-lane regression");
    assert.equal(result.ok, true, "specialist support-lane regression");
    assert.equal(result.finalResponse?.responseFocus?.primaryRoute, "SPECIALIST_DOCTOR_AGENT", "specialist support-lane regression");
    assert.ok(activeChecks.includes("vitals specialist"), "specialist support-lane regression");
    assert.ok(!activeChecks.includes("medicine safety"), "specialist support-lane regression");
    assert.ok(!activeChecks.includes("labs and reports"), "specialist support-lane regression");

    await fetch(`${baseUrl}/api/memory/clear`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ patientId })
    });
  }

  {
    const patientId = `specialist-neuro-warning-${Date.now()}`;
    const response = await fetch(`${baseUrl}/api/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        patientId,
        profile,
        interfaceName: "specialist",
        singleAgentMode: true,
        preferredAgent: "SPECIALIST_DOCTOR_AGENT",
        vitals: {
          systolic: "138",
          diastolic: "86"
        },
        context: {
          duration: "1-3-days",
          severity: "5",
          careGoal: "understand",
          supportNow: "with-someone",
          redFlags: [],
          specialistFocus: "neurology",
          specialistLens: "full-review"
        },
        message: "I want a neurology review of recurring headaches with nausea and light sensitivity for three days. What warning signs and precautions matter most?"
      })
    });
    const result = await response.json();

    assert.equal(response.status, 200, "specialist neuro warning regression");
    assert.equal(result.ok, true, "specialist neuro warning regression");
    assert.equal(result.finalResponse?.responseFocus?.primaryRoute, "SPECIALIST_DOCTOR_AGENT", "specialist neuro warning regression");
    assert.ok(
      Array.isArray(result.finalResponse?.warningSigns)
        && result.finalResponse.warningSigns.some((item) => /headache|stroke|vision|seizure|confusion/i.test(item)),
      "specialist neuro warning regression"
    );

    await fetch(`${baseUrl}/api/memory/clear`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ patientId })
    });
  }

  {
    const patientId = `general-disease-wording-${Date.now()}`;
    const response = await fetch(`${baseUrl}/api/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        patientId,
        profile,
        interfaceName: "advisor",
        singleAgentMode: true,
        preferredAgent: "RAG_AGENT",
        message: "I have hypertension and a mild headache since morning. What should I watch for today?",
        vitals: {
          systolic: "132",
          diastolic: "84"
        }
      })
    });
    const result = await response.json();

    assert.equal(response.status, 200, "general disease wording stays general");
    assert.equal(result.ok, true, "general disease wording stays general");
    assert.equal(result.finalResponse?.responseFocus?.primaryRoute, "RAG_AGENT", "general disease wording stays general");
    assert.notEqual(result.requirementProfile?.outputType, "specialist_disease_review", "general disease wording stays general");

    await fetch(`${baseUrl}/api/memory/clear`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ patientId })
    });
  }

  {
    const patientId = `general-guidance-wording-${Date.now()}`;
    const response = await fetch(`${baseUrl}/api/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        patientId,
        profile,
        interfaceName: "advisor",
        singleAgentMode: true,
        preferredAgent: "RAG_AGENT",
        message: "I have cough and fever since yesterday. Need general advice and precautions.",
        vitals: {
          temperatureC: "38.1"
        }
      })
    });
    const result = await response.json();

    assert.equal(response.status, 200, "general guidance wording stays general");
    assert.equal(result.ok, true, "general guidance wording stays general");
    assert.equal(result.finalResponse?.responseFocus?.primaryRoute, "RAG_AGENT", "general guidance wording stays general");
    assert.notEqual(result.requirementProfile?.outputType, "specialist_disease_review", "general guidance wording stays general");
    assert.ok(
      Array.isArray(result.finalResponse?.warningSigns)
        && result.finalResponse.warningSigns.some((item) => /breathing|blue lips|dehydration|fever/i.test(item)),
      "general guidance wording should keep respiratory warning signs in the general lane"
    );

    await fetch(`${baseUrl}/api/memory/clear`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ patientId })
    });
  }

  {
    const patientId = `general-atlas-education-${Date.now()}`;
    const response = await fetch(`${baseUrl}/api/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        patientId,
        profile,
        interfaceName: "advisor",
        singleAgentMode: true,
        preferredAgent: "RAG_AGENT",
        message: "What is hypertension? Explain precautions and prevention.",
        vitals: {
          systolic: "132",
          diastolic: "84"
        }
      })
    });
    const result = await response.json();

    assert.equal(response.status, 200, "general atlas education");
    assert.equal(result.ok, true, "general atlas education");
    assert.equal(result.finalResponse?.responseFocus?.primaryRoute, "RAG_AGENT", "general atlas education");
    assert.equal(result.requirementProfile?.outputType, "medical_atlas", "general atlas education");
    assert.ok(
      Array.isArray(result.finalResponse?.supportSections)
        && result.finalResponse.supportSections.some((section) => /overview/i.test(section.title) && Array.isArray(section.items) && section.items.length)
        && result.finalResponse.supportSections.some((section) => /precautions/i.test(section.title) && Array.isArray(section.items) && section.items.length),
      "general atlas education should expose overview and precautions sections"
    );

    await fetch(`${baseUrl}/api/memory/clear`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ patientId })
    });
  }

  {
    const patientId = `general-specialist-review-${Date.now()}`;
    const response = await fetch(`${baseUrl}/api/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        patientId,
        profile,
        interfaceName: "advisor",
        singleAgentMode: true,
        message: "Explain migraine treatment, precautions, and doctor questions.",
        vitals: {}
      })
    });
    const result = await response.json();

    assert.equal(response.status, 200, "general specialist review");
    assert.equal(result.ok, true, "general specialist review");
    assert.equal(result.finalResponse?.responseFocus?.primaryRoute, "SPECIALIST_DOCTOR_AGENT", "general specialist review");
    assert.ok(
      Array.isArray(result.finalResponse?.supportSections)
        && result.finalResponse.supportSections.some((section) => /treatment/i.test(section.title) && Array.isArray(section.items) && section.items.length)
        && result.finalResponse.supportSections.some((section) => /doctor questions/i.test(section.title) && Array.isArray(section.items) && section.items.length)
        && result.finalResponse.supportSections.some((section) => /precautions/i.test(section.title) && Array.isArray(section.items) && section.items.length),
      "general specialist review should expose treatment, precautions, and doctor questions"
    );

    await fetch(`${baseUrl}/api/memory/clear`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ patientId })
    });
  }

  {
    const patientId = `general-wellness-owner-${Date.now()}`;
    const response = await fetch(`${baseUrl}/api/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        patientId,
        profile,
        interfaceName: "advisor",
        singleAgentMode: true,
        preferredAgent: "RAG_AGENT",
        message: "I feel stressed and anxious and cannot sleep well.",
        vitals: {}
      })
    });
    const result = await response.json();

    assert.equal(response.status, 200, "general wellness owner");
    assert.equal(result.ok, true, "general wellness owner");
    assert.equal(result.finalResponse?.responseFocus?.primaryRoute, "WELLNESS_AGENT", "general wellness owner");
    assert.ok(
      Array.isArray(result.finalResponse?.supportSections)
        && result.finalResponse.supportSections.some((section) => /support plan|safety notes/i.test(section.title) && Array.isArray(section.items) && section.items.length),
      "general wellness owner should expose wellness support sections"
    );

    await fetch(`${baseUrl}/api/memory/clear`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ patientId })
    });
  }

  {
    const patientId = `general-records-owner-${Date.now()}`;
    const response = await fetch(`${baseUrl}/api/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        patientId,
        profile,
        interfaceName: "advisor",
        singleAgentMode: true,
        preferredAgent: "RAG_AGENT",
        message: "Create a health record summary with my prescription, doctor note, and report summary.",
        vitals: {}
      })
    });
    const result = await response.json();

    assert.equal(response.status, 200, "general records owner");
    assert.equal(result.ok, true, "general records owner");
    assert.equal(result.finalResponse?.responseFocus?.primaryRoute, "RECORDS_AGENT", "general records owner");
    assert.ok(
      Array.isArray(result.finalResponse?.supportSections)
        && result.finalResponse.supportSections.some((section) => /next actions|packet gaps|share checklist/i.test(section.title) && Array.isArray(section.items) && section.items.length),
      "general records owner should expose record packet sections"
    );

    await fetch(`${baseUrl}/api/memory/clear`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ patientId })
    });
  }

  {
    const patientId = `general-mixed-support-${Date.now()}`;
    const response = await fetch(`${baseUrl}/api/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        patientId,
        profile,
        interfaceName: "advisor",
        singleAgentMode: true,
        preferredAgent: "RAG_AGENT",
        message: "I missed my blood pressure medicine yesterday, BP is 158/98, and I want diet and sleep advice too.",
        vitals: {
          systolic: "158",
          diastolic: "98"
        }
      })
    });
    const result = await response.json();
    const activeRoutes = Array.isArray(result.agentResults) ? result.agentResults.map((agent) => agent.id) : [];

    assert.equal(response.status, 200, "general mixed support");
    assert.equal(result.ok, true, "general mixed support");
    assert.equal(result.finalResponse?.responseFocus?.primaryRoute, "PHARMACY_AGENT", "general mixed support");
    assert.ok(activeRoutes.includes("VITALS_AGENT"), "general mixed support should keep vitals active");
    assert.ok(activeRoutes.includes("LIFESTYLE_AGENT"), "general mixed support should keep lifestyle active");
    assert.ok(
      Array.isArray(result.finalResponse?.supportSections)
        && result.finalResponse.supportSections.some((section) => /medication safety|precautions|vitals to track|lifestyle support/i.test(section.title) && Array.isArray(section.items) && section.items.length),
      "general mixed support should expose specialist support sections"
    );

    await fetch(`${baseUrl}/api/memory/clear`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ patientId })
    });
  }

  for (const [index, testCase] of cases.entries()) {
    const payload = {
      ...testCase.payload,
      patientId: `smoke-${Date.now()}-${index}`
    };
    const response = await fetch(`${baseUrl}/api/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    const result = await response.json();

    assert.equal(response.status, 200, testCase.name);
    assert.equal(result.ok, true, testCase.name);
    assert.equal(result.risk.level, testCase.expectedRisk, testCase.name);
    assert.ok(result.context, testCase.name);
    assert.ok(Array.isArray(result.intents), testCase.name);
    assert.ok(Array.isArray(result.agentResults), testCase.name);
    assert.ok(result.requirementProfile?.score >= 0, testCase.name);
    assert.ok(result.requirementProfile?.answerContract?.length > 0, testCase.name);
    assert.equal(result.medicalKnowledge?.offlineReady, true, testCase.name);
    assert.ok(result.medicalKnowledge?.offlineDatabase?.storedRecords >= 16, testCase.name);
    assert.equal(result.medicalKnowledge?.offlineDatabase?.trainingStatus, "not-foundation-model-training", testCase.name);
    assert.ok(result.medicalKnowledge?.matches?.length > 0, testCase.name);
    assert.ok(result.medicalKnowledge?.coverageScore >= 35, testCase.name);
    assert.equal(result.externalKnowledge?.cacheFile, "data/external/external-knowledge-cache.json", testCase.name);
    assert.equal(result.externalKnowledge?.usedForThisRequest, false, testCase.name);
    assert.equal(result.medicalKnowledge?.externalKnowledge?.recordsUsed, 0, testCase.name);
    assert.equal(result.agenticRuntime?.id, "ADAPTIVE_AGENTIC_RUNTIME", testCase.name);
    assert.ok(validRuntimeStates.has(result.agenticRuntime?.systemState), testCase.name);
    assert.ok(validRuntimeModes.has(result.agenticRuntime?.activeMode), testCase.name);
    assert.equal(result.agenticRuntime?.decision?.selectedPath, result.agenticRuntime?.activeMode, testCase.name);
    assert.equal(result.agenticRuntime?.offline?.ready, true, testCase.name);
    assert.ok(result.agenticRuntime?.executionTrace?.steps?.length >= 5, testCase.name);
    assert.equal(result.model?.adaptiveRuntime?.id, "ADAPTIVE_AGENTIC_RUNTIME", testCase.name);
    assert.equal(result.processingMode, "Local Model", testCase.name);
    assert.equal(result.modelRouting?.generatedUsing, "Local Model", testCase.name);
    assert.equal(result.modelRouting?.failover?.ready, true, testCase.name);
    assert.equal(result.finalResponse?.processingMode, "Local Model", testCase.name);
    assert.equal(result.llmBrain?.processingMode, "Local Model", testCase.name);
    assert.ok(result.llmBrain?.gates?.some((gate) => gate.id === "hybrid_model_routing"), testCase.name);
    assert.ok(result.modelFlow?.activePath?.includes("MEMORY_STORE"), testCase.name);
    assert.equal(result.modelFlow?.activePath?.includes("AGENTIC_SUPERVISOR"), false, testCase.name);
    assert.ok(result.modelFlow?.activePath?.includes("SAFETY_GUARDRAILS"), testCase.name);
    assert.equal(result.canonicalFlow?.steps?.length, 8, testCase.name);
    assert.ok(["GENERAL_HEALTH", "MEDICATION", "APPOINTMENT", "EMERGENCY"].includes(result.canonicalFlow?.activeBucket?.id), testCase.name);
    assert.equal(result.canonicalFlow?.nextTurnLoop, "MEMORY_UPDATE -> PATIENT_INPUT -> MEMORY_STORE", testCase.name);
    assert.equal(result.agenticReview?.id, "AGENTIC_SUPERVISOR", testCase.name);
    assert.ok(result.agenticReview?.score >= 0, testCase.name);
    assert.ok(result.agenticReview?.reasoningQuality?.score >= 0, testCase.name);
    assert.ok(result.agenticReview?.requirementFit?.score >= 0, testCase.name);
    assert.ok(result.agenticReview?.toolTrace?.length >= result.agentResults.length, testCase.name);
    assert.equal(result.precisionSupervisor?.id, "PRECISION_SUPERVISOR", testCase.name);
    assert.ok(result.precisionSupervisor?.score >= 0, testCase.name);
    assert.ok(result.precisionSupervisor?.gates?.length >= 5, testCase.name);
    assert.ok(result.precisionSupervisor?.routeEvidence?.length >= result.plan.execute.length, testCase.name);
    assert.equal(result.llmBrain?.id, "LLM_COGNITIVE_CORE", testCase.name);
    assert.ok(result.llmBrain?.score >= 0, testCase.name);
    assert.ok(result.llmBrain?.gates?.length >= 6, testCase.name);
    assert.ok(result.llmBrain?.routeDecision?.ownerRoute, testCase.name);
    assert.ok(result.llmBrain?.routeScores?.length >= result.plan.execute.length, testCase.name);
    assert.ok(result.plan?.brain?.score >= 0, testCase.name);
    assert.ok(result.plan?.decisionTrace?.length >= 3, testCase.name);
    assert.ok(result.plan?.responseOwner?.route, testCase.name);
    assert.equal(result.smartAnalysis?.precisionSupervisor?.id, "PRECISION_SUPERVISOR", testCase.name);
    assert.equal(result.smartAnalysis?.llmBrain?.id, "LLM_COGNITIVE_CORE", testCase.name);
    assert.ok(result.smartAnalysis?.agenticReview?.nextBestAction, testCase.name);
    assert.equal(result.guardrails.passed, true, testCase.name);
    assert.ok(result.finalResponse?.whatToDoNow?.length > 0, testCase.name);
    assert.equal(result.finalResponse?.responseFocus?.policy, "focused-answer-only", testCase.name);
    assert.ok(result.finalResponse?.responseFocus?.primaryRoute, testCase.name);
    assert.ok(result.finalResponse?.brain?.score >= 0, testCase.name);
    assert.ok(result.finalResponse?.requirementFit?.score >= 0, testCase.name);
    assert.ok(result.finalResponse?.whatToDoNow?.length <= (result.risk.level === "LOW" ? 2 : 3), testCase.name);
    assert.ok(result.finalResponse?.summary?.length <= 170, testCase.name);
    assert.ok(result.carePack?.sections?.length >= 5, testCase.name);
    assert.ok(result.carePack?.score >= 0, testCase.name);
    assert.ok(result.carePack?.sections?.some((section) => section.id === "today"), testCase.name);
    assert.ok(result.carePack?.sections?.some((section) => section.id === "safety"), testCase.name);
    assert.ok(result.smartAnalysis?.summary?.length > 0, testCase.name);
    assert.ok(result.smartAnalysis?.confidence?.score >= 35, testCase.name);
    assert.ok(result.smartAnalysis?.reasoningQuality?.score >= 0, testCase.name);
    assert.ok(result.reasoningQuality?.agentProfiles?.length >= result.agentResults.length, testCase.name);
    assert.ok(result.performance?.agentCount >= result.agentResults.length, testCase.name);
    assert.ok(result.smartAnalysis?.intentAnalysis?.length > 0, testCase.name);
    assert.ok(result.smartAnalysis?.vitalAssessment?.length > 0, testCase.name);
    assert.ok(result.smartAnalysis?.riskBreakdown?.length > 0, testCase.name);
    assert.ok(result.smartAnalysis?.routeAnalysis?.length > 0, testCase.name);
    assert.ok(result.smartAnalysis?.contextSignals?.length > 0, testCase.name);
    assert.ok(result.smartAnalysis?.handoffSummary?.length > 0, testCase.name);
    assert.ok(result.smartAnalysis?.dataQuality?.score >= 0, testCase.name);
    assert.ok(result.smartAnalysis?.carePath?.length > 0, testCase.name);
    assert.ok(result.smartAnalysis?.automationPreview?.length > 0, testCase.name);
    assert.ok(result.smartAnalysis?.handoffText?.includes("Care Nova AI Handoff"), testCase.name);
    assert.ok(result.smartAnalysis?.signalMatrix?.length >= 5, testCase.name);
    assert.ok(result.smartAnalysis?.modelReadiness?.score >= 0, testCase.name);
    assert.ok(result.smartAnalysis?.carePack?.summary?.length > 0, testCase.name);
    assert.ok(result.smartAnalysis?.medicalKnowledge?.matches?.length > 0, testCase.name);
    assert.ok(result.knowledgeScale?.score >= 0, testCase.name);
    assert.ok(result.knowledgeScale?.scalePlan?.length >= 4, testCase.name);
    assert.equal(result.knowledgeScale?.trainedFoundationModel, false, testCase.name);
    assert.ok(result.smartAnalysis?.knowledgeScale?.validationGates?.length >= 6, testCase.name);
    assert.ok(result.smartAnalysis?.modelReadiness?.pillars?.some((pillar) => pillar.includes("Knowledge scale")), testCase.name);
    assert.ok(result.smartAnalysis?.modelReadiness?.pillars?.some((pillar) => pillar.includes("LLM brain")), testCase.name);
    assert.ok(result.smartAnalysis?.accuracyProfile?.score >= 0, testCase.name);
    assert.ok(result.smartAnalysis?.accuracyProfile?.checks?.length >= 4, testCase.name);
    assert.ok(result.smartAnalysis?.accuracyEngine?.score >= 0, testCase.name);
    assert.ok(result.smartAnalysis?.accuracyEngine?.checks?.length >= 6, testCase.name);
    assert.ok(result.smartAnalysis?.accuracyEngine?.requirementFit?.score >= 0, testCase.name);
    assert.ok(result.smartAnalysis?.requirementProfile?.score >= 0, testCase.name);
    assert.ok(result.smartAnalysis?.requirementFit?.score >= 0, testCase.name);
    assert.ok(result.smartAnalysis?.agentContracts?.length >= result.agentResults.length, testCase.name);
    assert.ok(result.smartAnalysis?.accuracyEngine?.safetyCalibration?.score >= 0, testCase.name);
    assert.ok(result.smartAnalysis?.accuracyEngine?.consistencyReview?.score >= 0, testCase.name);
    assert.ok(result.smartAnalysis?.accuracyEngine?.clinicalPrecisionReview?.score >= 0, testCase.name);
    assert.ok(result.smartAnalysis?.accuracyEngine?.clinicalPrecisionReview?.checks?.length >= 1, testCase.name);
    assert.ok(result.smartAnalysis?.accuracyControls?.checks?.length >= 6, testCase.name);
    assert.equal(result.smartAnalysis?.deploymentMode?.offlineReady, true, testCase.name);
    assert.ok(result.smartAnalysis?.learningMemory?.boundary?.includes("medical knowledge"), testCase.name);
    assert.ok(result.smartAnalysis?.whatIfGuidance?.length > 0, testCase.name);
    assert.ok(result.memoryPatch?.knowledgeSnapshot?.references?.length > 0, testCase.name);
    assert.equal(result.memory?.saved, true, testCase.name);
    assert.equal(result.memory?.mode, "persistent-local-server", testCase.name);
    assert.ok(result.memory?.history?.length >= 1, testCase.name);
    assert.ok(result.knowledgeGraph?.factCount >= 1, testCase.name);
    assert.equal(result.knowledgeGraph?.mode, "persistent-local-server", testCase.name);
    assert.ok(result.evidenceCitations?.sourceCount >= 1, testCase.name);
    assert.ok(result.safetyTriage?.recommendedRoute, testCase.name);
    assert.ok(result.preventionPlan?.focusAreas?.length >= 1, testCase.name);
    assert.ok(result.humanReview?.checklist?.length >= 3, testCase.name);
    assert.equal(result.doctorReadyReport?.status, "doctor-ready-report-ready", testCase.name);
    assert.equal(result.advancedCapabilities?.status, "advanced-snapshot-ready", testCase.name);
    assert.equal(result.localDataMirror?.status, "mirror-synced", testCase.name);
    assert.ok(result.localDataMirror?.files?.some((file) => file.mirror.includes("onedrive-mirror")), testCase.name);
    assert.ok(result.inputQuality?.score >= 0, testCase.name);
    assert.ok(result.smartAnalysis?.inputQuality?.label, testCase.name);
    assert.equal(result.enterpriseUseCases?.length, 5, testCase.name);
    assert.equal(result.model?.enterpriseUseCases?.length, 5, testCase.name);
    assert.equal(result.workflowMatrix?.length, 4, testCase.name);
    assert.equal(result.model?.workflowMatrix?.length, 4, testCase.name);
    assert.equal(result.agenticFlowContract?.passed, true, `${testCase.name}: canonical agentic flow contract`);
    assert.equal(result.model?.agenticFlowContract?.passed, true, `${testCase.name}: model agentic flow contract`);
    assert.equal(result.canonicalFlow?.steps?.length, 8, `${testCase.name}: canonical eight steps`);
    assert.equal(result.canonicalFlow?.steps?.[1]?.id, "MEMORY_STORE", `${testCase.name}: memory before classifier`);
    assert.equal(result.canonicalFlow?.steps?.[2]?.id, "INTENT_CLASSIFIER", `${testCase.name}: classifier after memory`);
    assert.ok(
      ["RAG_AGENT", "PHARMACY_AGENT", "SCHEDULING_AGENT", "ALERT_AGENT"].includes(result.agenticFlowContract?.activeBucket?.route),
      `${testCase.name}: one of four required core routes`
    );
    assert.ok(
      result.auditTrail?.findIndex((entry) => entry.step === "memory_store")
        < result.auditTrail?.findIndex((entry) => entry.step === "intent_classifier_agent"),
      `${testCase.name}: memory audit precedes classifier`
    );

    const actualAgents = result.agentResults.map((agent) => agent.id);

    for (const expectedAgent of testCase.expectedAgents) {
      assert.ok(actualAgents.includes(expectedAgent), `${testCase.name}: ${expectedAgent}`);
    }

    for (const agent of result.agentResults) {
      assert.ok(agent.output.reasoning?.score >= 0, `${testCase.name}: ${agent.id} reasoning score`);
      assert.ok(agent.output.reasoning?.safetyChecks?.length >= 2, `${testCase.name}: ${agent.id} safety checks`);
      assert.ok(agent.output.capabilityProfile?.score >= 0, `${testCase.name}: ${agent.id} capability score`);
      assert.ok(agent.output.capabilityProfile?.gates?.length >= 5, `${testCase.name}: ${agent.id} capability gates`);
      assert.ok(agent.output.capabilityProfile?.domain?.length > 0, `${testCase.name}: ${agent.id} capability domain`);
      assert.ok(agent.output.qualityGate?.status, `${testCase.name}: ${agent.id} quality gate`);
      assert.ok(agent.output.accuracyReview?.strengths?.length >= 1, `${testCase.name}: ${agent.id} accuracy strengths`);
      assert.ok(agent.output.performance?.deterministic, `${testCase.name}: ${agent.id} deterministic performance`);
      assert.ok(agent.output.performance?.accuracyScore >= 0, `${testCase.name}: ${agent.id} performance accuracy score`);

      if (["CLAIMS_OPS_AGENT", "GXP_QUALITY_AGENT", "CARE_TRANSITIONS_AGENT", "MEDTECH_COMPLIANCE_AGENT"].includes(agent.id)) {
        assert.equal(agent.output.workflowMatrix?.agentRoute, agent.id, `${testCase.name}: ${agent.id} workflow matrix`);
        assert.ok(agent.output.workflowMatrix?.generatedOutputs?.length >= 3, `${testCase.name}: ${agent.id} matrix outputs`);
        assert.ok(agent.output.workflowMatrix?.capabilities?.includes("Reasoning"), `${testCase.name}: ${agent.id} matrix capabilities`);
      }
    }

    await fetch(`${baseUrl}/api/memory/clear`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ patientId: payload.patientId })
    });
  }

  const generalDeepModeResponse = await fetch(`${baseUrl}/api/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      patientId: `general-deep-mode-${Date.now()}`,
      message: "I have had a headache since morning and feel tired.",
      profile,
      vitals: {
        systolic: "130",
        diastolic: "85",
        bloodSugar: "180",
        heartRate: "78",
        temperatureC: "37"
      },
      context: {
        duration: "since-morning",
        severity: "4",
        careGoal: "understand-symptoms",
        redFlags: []
      },
      interfaceName: "advisor",
      singleAgentMode: true,
      preferredAgent: "RAG_AGENT",
      answerMode: {
        id: "deep",
        label: "Deep Review"
      }
    })
  });
  const generalDeepMode = await generalDeepModeResponse.json();

  assert.equal(generalDeepModeResponse.status, 200);
  assert.equal(generalDeepMode.ok, true);
  assert.equal(generalDeepMode.finalResponse.responseFocus.primaryRoute, "RAG_AGENT");
  assert.equal(generalDeepMode.finalResponse.responseFocus.requirement.answerMode, "deep");
  assert.match(generalDeepMode.finalResponse.title, /deep review/i);
  assert.ok(generalDeepMode.finalResponse.whatToDoNow.length >= 2);
  assert.ok(
    Array.isArray(generalDeepMode.finalResponse.supportSections)
      && generalDeepMode.finalResponse.supportSections.length >= 3,
    "general deep mode should include structured support sections"
  );
  assert.ok(
    generalDeepMode.finalResponse.supportSections.some((section) => section.id === "track"),
    "general deep mode should include a tracking section"
  );
  assert.ok(
    generalDeepMode.finalResponse.supportSections.some((section) => section.id === "precautions"),
    "general deep mode should include a precautions section"
  );

  const generalPrecisionResponse = await fetch(`${baseUrl}/api/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      patientId: `general-precision-${Date.now()}`,
      message: "I have had a headache since morning and feel tired.",
      profile,
      vitals: {
        systolic: "130",
        diastolic: "85",
        bloodSugar: "180",
        heartRate: "78",
        temperatureC: "37"
      },
      context: {
        duration: "since-morning",
        severity: "4",
        careGoal: "understand-symptoms",
        redFlags: []
      },
      interfaceName: "advisor",
      singleAgentMode: true,
      preferredAgent: "RAG_AGENT",
      answerMode: {
        id: "quick",
        label: "Quick"
      }
    })
  });
  const generalPrecision = await generalPrecisionResponse.json();
  const generalRagOutput = generalPrecision.agentResults.find((agent) => agent.id === "RAG_AGENT")?.output || {};

  assert.equal(generalPrecisionResponse.status, 200);
  assert.equal(generalPrecision.ok, true);
  assert.match(generalRagOutput.patientAnswerSummary, /headache concern/i);
  assert.doesNotMatch(generalRagOutput.patientAnswerSummary, /dizziness/i);
  assert.ok(
    Array.isArray(generalPrecision.finalResponse.warningSigns)
      && generalPrecision.finalResponse.warningSigns.some((item) => /headache|vision|speech|weakness/i.test(item)),
    "general precision warning signs should be headache-specific"
  );

  const generalMixedPrecisionResponse = await fetch(`${baseUrl}/api/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      patientId: `general-mixed-precision-${Date.now()}`,
      message: "I have a headache since morning, BP is 150/95, and I feel a little dizzy. What should I do?",
      profile,
      vitals: {
        systolic: "150",
        diastolic: "95",
        heartRate: "78",
        temperatureC: "37"
      },
      context: {
        duration: "since-morning",
        severity: "4",
        careGoal: "understand-symptoms",
        redFlags: []
      },
      interfaceName: "advisor",
      singleAgentMode: true,
      preferredAgent: "RAG_AGENT",
      answerMode: {
        id: "deep",
        label: "Deep Review"
      }
    })
  });
  const generalMixedPrecision = await generalMixedPrecisionResponse.json();
  const generalMixedRagOutput = generalMixedPrecision.agentResults.find((agent) => agent.id === "RAG_AGENT")?.output || {};

  assert.equal(generalMixedPrecisionResponse.status, 200);
  assert.equal(generalMixedPrecision.ok, true);
  assert.equal(generalMixedPrecision.risk.level, "MEDIUM");
  assert.match(generalMixedRagOutput.patientAnswerSummary, /blood-pressure concern with headache and dizziness/i);
  assert.ok(
    Array.isArray(generalMixedPrecision.finalResponse.whatToDoNow)
      && generalMixedPrecision.finalResponse.whatToDoNow.some((item) => /same-day clinician review|repeat bp stays elevated|headache or dizziness does not settle|contact a clinician|usual pattern/i.test(item)),
    "mixed BP and headache guidance should include follow-up escalation"
  );
  assert.ok(
    Array.isArray(generalMixedPrecision.finalResponse.supportSections)
      && generalMixedPrecision.finalResponse.supportSections.some((section) => section.id === "track" && section.items.some((item) => /repeat bp|repeat the bp|headache|dizziness/i.test(item))),
    "mixed BP and headache guidance should include focused tracking"
  );
  assert.ok(
    Array.isArray(generalMixedPrecision.finalResponse.supportSections)
      && generalMixedPrecision.finalResponse.supportSections.some((section) => section.id === "precautions" && section.items.some((item) => /driving|vision|speech|weakness|breathing|chest/i.test(item))),
    "mixed BP and headache guidance should include focused precautions"
  );

  const generalMixedQuickResponse = await fetch(`${baseUrl}/api/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      patientId: `general-mixed-quick-${Date.now()}`,
      message: "My BP is 154/96, I feel dizzy and have headache. What should I do?",
      profile,
      vitals: {},
      interfaceName: "advisor",
      singleAgentMode: true,
      preferredAgent: "RAG_AGENT",
      answerMode: {
        id: "quick",
        label: "Quick"
      }
    })
  });
  const generalMixedQuick = await generalMixedQuickResponse.json();
  const generalMixedQuickOverview = Array.isArray(generalMixedQuick.finalResponse.supportSections)
    ? generalMixedQuick.finalResponse.supportSections.find((section) => section.id === "overview")
    : null;

  assert.equal(generalMixedQuickResponse.status, 200);
  assert.equal(generalMixedQuick.ok, true);
  assert.equal(generalMixedQuick.risk.level, "MEDIUM");
  assert.deepEqual(
    generalMixedQuick.finalResponse.whatToDoNow,
    [
      "Rest for 5 minutes, repeat the BP, and note the reading with headache or dizziness severity and any vision, weakness, speech, chest, or breathing change.",
      "Use same-day clinician review if the repeat BP stays elevated or the headache or dizziness does not settle after rest."
    ],
    "quick BP guidance should keep the immediate step and the escalation step together"
  );
  assert.ok(
    Array.isArray(generalMixedQuickOverview?.items)
      && generalMixedQuickOverview.items.some((item) => /Blood Pressure Review/i.test(item)),
    "quick BP guidance should surface blood-pressure-specific local evidence first"
  );

  const generalDiabetesPrecisionResponse = await fetch(`${baseUrl}/api/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      patientId: `general-diabetes-precision-${Date.now()}`,
      message: "I feel very tired and thirsty, I have diabetes, and my sugar is 245. What should I do next?",
      profile: {
        ...profile,
        conditions: "",
        medications: ""
      },
      vitals: {
        bloodSugar: "245"
      },
      context: {
        duration: "today",
        severity: "5",
        careGoal: "understand-symptoms",
        redFlags: []
      },
      interfaceName: "advisor",
      singleAgentMode: true,
      preferredAgent: "RAG_AGENT",
      answerMode: {
        id: "deep",
        label: "Deep Review"
      }
    })
  });
  const generalDiabetesPrecision = await generalDiabetesPrecisionResponse.json();
  const generalDiabetesRagOutput = generalDiabetesPrecision.agentResults.find((agent) => agent.id === "RAG_AGENT")?.output || {};

  assert.equal(generalDiabetesPrecisionResponse.status, 200);
  assert.equal(generalDiabetesPrecision.ok, true);
  assert.equal(generalDiabetesPrecision.risk.level, "MEDIUM");
  assert.doesNotMatch(generalDiabetesRagOutput.patientAnswerSummary, /known conditions and regular medicines/i);
  assert.match(generalDiabetesRagOutput.patientAnswerSummary, /regular medicines/i);
  assert.ok(
    Array.isArray(generalDiabetesPrecision.finalResponse.whatToDoNow)
      && generalDiabetesPrecision.finalResponse.whatToDoNow.some((item) => /recheck glucose|same-day clinician review|sugar stays high/i.test(item)),
    "diabetes guidance should include glucose-specific follow-up"
  );
  assert.ok(
    Array.isArray(generalDiabetesPrecision.finalResponse.whatToDoNow)
      && generalDiabetesPrecision.finalResponse.whatToDoNow.every((item) => !/Improve accuracy/i.test(item)),
    "diabetes action list should keep clarification prompts out of the main steps"
  );

  const generalRespiratoryPrecisionResponse = await fetch(`${baseUrl}/api/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      patientId: `general-respiratory-precision-${Date.now()}`,
      message: "I have cough and fever for 2 days. What should I track?",
      profile,
      vitals: {
        temperatureC: "38.3"
      },
      context: {
        duration: "1-3 days",
        severity: "4",
        careGoal: "understand-symptoms",
        redFlags: []
      },
      interfaceName: "advisor",
      singleAgentMode: true,
      preferredAgent: "RAG_AGENT",
      answerMode: {
        id: "deep",
        label: "Deep Review"
      }
    })
  });
  const generalRespiratoryPrecision = await generalRespiratoryPrecisionResponse.json();
  const respiratoryOverview = Array.isArray(generalRespiratoryPrecision.finalResponse.supportSections)
    ? generalRespiratoryPrecision.finalResponse.supportSections.find((section) => section.id === "overview")
    : null;

  assert.equal(generalRespiratoryPrecisionResponse.status, 200);
  assert.equal(generalRespiratoryPrecision.ok, true);
  assert.ok(
    Array.isArray(respiratoryOverview?.items)
      && respiratoryOverview.items.some((item) => /Respiratory Illness Review/i.test(item)),
    "respiratory general guidance should prefer respiratory-specific local evidence"
  );
  assert.ok(
    Array.isArray(respiratoryOverview?.items)
      && respiratoryOverview.items.every((item) => !/Oxygen Saturation Review/i.test(item)),
    "respiratory general guidance without oxygen context should avoid oxygen-first overview text"
  );
  assert.deepEqual(
    generalRespiratoryPrecision.finalResponse.whatToDoNow,
    [
      "Track temperature, cough pattern, breathing effort, and hydration over the next day.",
      "Reduce smoke, dust, and heavy exertion while cough or fever is active.",
      "Contact a clinician if breathing gets harder, fever is rising, or you are not improving after the next 2 to 3 days."
    ],
    "respiratory action list should stay practical-first and logically ordered"
  );

  const generalDigestiveWarningResponse = await fetch(`${baseUrl}/api/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      patientId: `general-digestive-warning-${Date.now()}`,
      message: "Since morning I have stomach pain with vomiting. Give me general guidance and warning signs.",
      profile,
      vitals: {},
      context: {
        duration: "today",
        severity: "5",
        careGoal: "understand-symptoms",
        redFlags: []
      },
      interfaceName: "advisor",
      singleAgentMode: true,
      preferredAgent: "RAG_AGENT",
      answerMode: {
        id: "quick",
        label: "Quick"
      }
    })
  });
  const generalDigestiveWarning = await generalDigestiveWarningResponse.json();

  assert.equal(generalDigestiveWarningResponse.status, 200);
  assert.equal(generalDigestiveWarning.ok, true);
  assert.ok(
    Array.isArray(generalDigestiveWarning.finalResponse.whatToDoNow)
      && generalDigestiveWarning.finalResponse.whatToDoNow.some((item) => /same-day clinician review|cannot keep fluids down|dehydration/i.test(item)),
    "digestive quick guidance should include a dehydration-focused follow-up step"
  );
  assert.ok(
    Array.isArray(generalDigestiveWarning.finalResponse.warningSigns)
      && generalDigestiveWarning.finalResponse.warningSigns.some((item) => /vomiting|dehydration|blood|pain|confusion/i.test(item)),
    "digestive quick guidance should expose digestive-specific warning signs"
  );

  const generalAgenticResponse = await fetch(`${baseUrl}/api/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      patientId: `general-agentic-${Date.now()}`,
      message: "I have had a headache since morning, my BP is 160/98, and I feel tired. What should I do?",
      profile,
      vitals: {
        systolic: "160",
        diastolic: "98",
        bloodSugar: "180",
        heartRate: "78",
        temperatureC: "37"
      },
      context: {
        duration: "since-morning",
        severity: "4",
        careGoal: "understand-symptoms",
        redFlags: []
      },
      interfaceName: "advisor",
      singleAgentMode: true,
      preferredAgent: "VITALS_AGENT",
      answerMode: {
        id: "deep",
        label: "Deep Review"
      }
    })
  });
  const generalAgentic = await generalAgenticResponse.json();

  assert.equal(generalAgenticResponse.status, 200);
  assert.equal(generalAgentic.ok, true);
  assert.equal(generalAgentic.finalResponse.responseFocus.primaryRoute, "VITALS_AGENT");
  assert.ok(generalAgentic.plan.execute.includes("VITALS_AGENT"), "general agentic review should keep the vital owner route");
  assert.ok(generalAgentic.plan.execute.includes("RAG_AGENT"), "general agentic review should keep general support active");
  assert.ok(generalAgentic.plan.execute.includes("ALERT_AGENT"), "general agentic review should keep safety support active");
  assert.ok(
    Array.isArray(generalAgentic.finalResponse.whatToDoNow)
      && generalAgentic.finalResponse.whatToDoNow.some((item) => /repeat the abnormal reading|repeat the bp|repeat/i.test(item))
      && generalAgentic.finalResponse.whatToDoNow.some((item) => /clinician|urgent|same-day|worsen/i.test(item)),
    "general agentic review should include action plus escalation support"
  );
  assert.ok(
    Array.isArray(generalAgentic.finalResponse.warningSigns)
      && generalAgentic.finalResponse.warningSigns.some((item) => /headache|vision|speech|weakness|abnormal/i.test(item)),
    "general agentic review should include symptom-aware warning signs"
  );

  const memoryPatientId = `memory-smoke-${Date.now()}`;
  const clearBeforeMemoryResponse = await fetch(`${baseUrl}/api/memory/clear`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ patientId: memoryPatientId })
  });
  const clearBeforeMemory = await clearBeforeMemoryResponse.json();

  assert.equal(clearBeforeMemoryResponse.status, 200);
  assert.equal(clearBeforeMemory.ok, true);
  assert.equal(clearBeforeMemory.memory.recentTurnCount, 0);

  const firstMemoryResponse = await fetch(`${baseUrl}/api/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      patientId: memoryPatientId,
      message: "Remember that I had high BP today and felt dizzy.",
      profile,
      vitals: {
        systolic: "168",
        diastolic: "104"
      }
    })
  });
  const firstMemory = await firstMemoryResponse.json();

  assert.equal(firstMemoryResponse.status, 200);
  assert.equal(firstMemory.ok, true);
  assert.equal(firstMemory.memory.saved, true);
  assert.equal(firstMemory.memory.recentTurnCount, 1);

  const secondMemoryResponse = await fetch(`${baseUrl}/api/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      patientId: memoryPatientId,
      message: "Does my previous BP check matter for this headache?",
      profile,
      vitals: {}
    })
  });
  const secondMemory = await secondMemoryResponse.json();

  assert.equal(secondMemoryResponse.status, 200);
  assert.equal(secondMemory.ok, true);
  assert.equal(secondMemory.memoryContext.recentTurnCount, 1);
  assert.ok(secondMemory.memoryContext.recentMessages.some((message) => message.includes("high BP")));
  assert.equal(secondMemory.memory.recentTurnCount, 2);

  const getMemoryResponse = await fetch(`${baseUrl}/api/memory?patientId=${memoryPatientId}`);
  const getMemory = await getMemoryResponse.json();

  assert.equal(getMemoryResponse.status, 200);
  assert.equal(getMemory.ok, true);
  assert.equal(getMemory.memory.mode, "persistent-local-server");
  assert.equal(getMemory.memory.recentTurnCount, 2);
  assert.ok(getMemory.memory.history[0].message.includes("previous BP"));

  const clearAfterMemoryResponse = await fetch(`${baseUrl}/api/memory/clear`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ patientId: memoryPatientId })
  });
  const clearAfterMemory = await clearAfterMemoryResponse.json();

  assert.equal(clearAfterMemoryResponse.status, 200);
  assert.equal(clearAfterMemory.ok, true);
  assert.equal(clearAfterMemory.memory.recentTurnCount, 0);

  const recordPatientId = `record-persistence-smoke-${Date.now()}`;
  await fetch(`${baseUrl}/api/records/clear`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ patientId: recordPatientId })
  });

  const saveRecordResponse = await fetch(`${baseUrl}/api/records`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      patientId: recordPatientId,
      selectedRecordId: "smoke-record-1",
      records: [
        {
          id: "smoke-record-1",
          patientName: "Smoke Patient",
          age: "52",
          type: "lab",
          date: "2026-06-26",
          source: "Smoke test",
          documentName: "HbA1c report",
          conditions: "Type 2 diabetes",
          medicines: "Metformin",
          vitals: "BP 130/85",
          labs: "HbA1c 8.2",
          notes: "Localhost records persistence check",
          followUp: "Review with clinician"
        }
      ]
    })
  });
  const saveRecord = await saveRecordResponse.json();

  assert.equal(saveRecordResponse.status, 200);
  assert.equal(saveRecord.ok, true);
  assert.equal(saveRecord.records.mode, "persistent-local-server");
  assert.equal(saveRecord.records.file, "data/records/patient-records.json");
  assert.equal(saveRecord.records.recordCount, 1);
  assert.equal(saveRecord.records.records[0].documentName, "HbA1c report");

  const getRecordResponse = await fetch(`${baseUrl}/api/records?patientId=${recordPatientId}`);
  const getRecord = await getRecordResponse.json();

  assert.equal(getRecordResponse.status, 200);
  assert.equal(getRecord.ok, true);
  assert.equal(getRecord.records.recordCount, 1);
  assert.equal(getRecord.records.selectedRecordId, "smoke-record-1");
  assert.equal(getRecord.records.stats.typeCounts.lab, 1);

  const clearRecordResponse = await fetch(`${baseUrl}/api/records/clear`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ patientId: recordPatientId })
  });
  const clearRecord = await clearRecordResponse.json();

  assert.equal(clearRecordResponse.status, 200);
  assert.equal(clearRecord.ok, true);
  assert.equal(clearRecord.records.recordCount, 0);

  const emptyResponse = await fetch(`${baseUrl}/api/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      patientId: "demo-patient",
      message: "",
      profile,
      vitals: {}
    })
  });
  const emptyResult = await emptyResponse.json();

  assert.equal(emptyResponse.status, 400);
  assert.equal(emptyResult.code, "EMPTY_MESSAGE");

  const longResponse = await fetch(`${baseUrl}/api/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      patientId: "demo-patient",
      message: "x".repeat(1401),
      profile,
      vitals: {}
    })
  });
  const longResult = await longResponse.json();

  assert.equal(longResponse.status, 200);
  assert.equal(longResult.ok, true);

  const invalidVitalsPatientId = `invalid-vitals-smoke-${Date.now()}`;
  const invalidVitalsResponse = await fetch(`${baseUrl}/api/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      patientId: invalidVitalsPatientId,
      message: "I entered a test reading and want guidance.",
      profile,
      vitals: {
        systolic: "999",
        heartRate: "abc"
      }
    })
  });
  const invalidVitalsResult = await invalidVitalsResponse.json();

  assert.equal(invalidVitalsResponse.status, 200);
  assert.equal(invalidVitalsResult.ok, true);
  assert.equal(invalidVitalsResult.memoryContext.latestVitals.systolic, undefined);
  assert.ok(invalidVitalsResult.inputQuality.ignoredVitals.length >= 2);

  await fetch(`${baseUrl}/api/memory/clear`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ patientId: invalidVitalsPatientId })
  });

  const invalidJsonResponse = await fetch(`${baseUrl}/api/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: "{bad json"
  });
  const invalidJsonResult = await invalidJsonResponse.json();

  assert.equal(invalidJsonResponse.status, 400);
  assert.equal(invalidJsonResult.code, "INVALID_JSON");

  const headResponse = await fetch(`${baseUrl}/`, {
    method: "HEAD"
  });

  assert.equal(headResponse.status, 200);

  console.log("Smoke tests passed.");
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
