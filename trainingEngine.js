import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const TRAINING_ENGINE_VERSION = "1.0.0";

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const trainingFile = resolve(rootDir, "data", "training", "agent-training-state.json");
const maxStoredExamples = 500;
let cachedTrainingState = null;
let cachedTrainingMtimeMs = 0;
let trainingWriteQueue = Promise.resolve();

const supportedRoutes = [
  "RAG_AGENT",
  "SPECIALIST_DOCTOR_AGENT",
  "VITALS_AGENT",
  "PHARMACY_AGENT",
  "LABS_AGENT",
  "WELLNESS_AGENT",
  "SCHEDULING_AGENT",
  "RECORDS_AGENT",
  "INSURANCE_AGENT",
  "ALERT_AGENT"
];

const routeAliases = {
  general: "RAG_AGENT",
  talk: "RAG_AGENT",
  symptom: "RAG_AGENT",
  symptoms: "RAG_AGENT",
  health: "RAG_AGENT",
  specialist: "SPECIALIST_DOCTOR_AGENT",
  disease: "SPECIALIST_DOCTOR_AGENT",
  diseases: "SPECIALIST_DOCTOR_AGENT",
  atlas: "SPECIALIST_DOCTOR_AGENT",
  library: "SPECIALIST_DOCTOR_AGENT",
  vitals: "VITALS_AGENT",
  vital: "VITALS_AGENT",
  bp: "VITALS_AGENT",
  medicine: "PHARMACY_AGENT",
  medication: "PHARMACY_AGENT",
  pharmacy: "PHARMACY_AGENT",
  labs: "LABS_AGENT",
  lab: "LABS_AGENT",
  report: "LABS_AGENT",
  wellness: "WELLNESS_AGENT",
  lifestyle: "WELLNESS_AGENT",
  visits: "SCHEDULING_AGENT",
  visit: "SCHEDULING_AGENT",
  appointment: "SCHEDULING_AGENT",
  appointments: "SCHEDULING_AGENT",
  safety: "ALERT_AGENT",
  urgent: "ALERT_AGENT",
  emergency: "ALERT_AGENT",
  alert: "ALERT_AGENT",
  records: "RECORDS_AGENT",
  record: "RECORDS_AGENT",
  summary: "RECORDS_AGENT",
  insurance: "INSURANCE_AGENT",
  claim: "INSURANCE_AGENT",
  claims: "INSURANCE_AGENT"
};

const stopWords = new Set([
  "a",
  "about",
  "after",
  "all",
  "also",
  "am",
  "an",
  "and",
  "any",
  "are",
  "as",
  "at",
  "be",
  "been",
  "before",
  "but",
  "by",
  "can",
  "could",
  "do",
  "does",
  "for",
  "from",
  "give",
  "had",
  "has",
  "have",
  "help",
  "how",
  "i",
  "in",
  "is",
  "it",
  "me",
  "my",
  "need",
  "of",
  "on",
  "or",
  "please",
  "should",
  "that",
  "the",
  "this",
  "to",
  "want",
  "was",
  "what",
  "when",
  "with",
  "you"
]);

export function getTrainingStorageInfo() {
  return {
    mode: "persistent-local-ml-training-store",
    file: formatProjectRelativePath(trainingFile),
    mirrorEligible: true,
    version: TRAINING_ENGINE_VERSION,
    privacy: "Stores approved feedback and de-identified training signals locally; raw PHI should not be used for model tuning.",
    maxStoredExamples,
    supportedRoutes
  };
}

export function getMachineLearningCapabilityStatus(runtime = {}, env = process.env) {
  const localLlmUrl = env.LOCAL_LLM_URL || env.CARE_NOVA_LOCAL_LLM_URL || "https://api.deepseek.com/chat/completions";
  const localLlmModel = env.LOCAL_LLM_MODEL || env.CARE_NOVA_LOCAL_LLM_MODEL || env.DEEPSEEK_MODEL || "deepseek-reasoner";
  const onlineApiEnabled = env.CARE_NOVA_EXTERNAL_API_ENABLED === "true";

  return {
    ok: true,
    version: TRAINING_ENGINE_VERSION,
    status: "ml-dl-training-ready",
    summary: {
      classicalMlReady: true,
      deepLearningAdapterReady: true,
      activeFoundationTraining: false,
      onlineOfflineParity: true,
      localFirstStorage: true,
      safeMedicalBoundary: true
    },
    machineLearning: {
      mode: "local-agent-calibration",
      algorithms: [
        "TF-IDF-style route keyword weighting",
        "Agent route prior calibration",
        "Per-agent reliability scoring",
        "Confusion-matrix driven routing review",
        "Approved feedback loop with rollback-safe JSON state"
      ],
      trains: [
        "which agent should answer",
        "which route should own the response",
        "which prompt patterns need stronger context",
        "which tabs are under-performing"
      ],
      doesNotTrain: [
        "new medical facts from patient messages",
        "diagnosis logic without clinical review",
        "prescribing or dosage rules",
        "emergency contact automation"
      ]
    },
    deepLearning: {
      status: localLlmUrl ? "deepseek-r1-primary-configured" : "adapter-ready",
      activeTraining: false,
      localAdapters: [
        "DeepSeek-R1 primary reasoning endpoint",
        "OpenAI-compatible DeepSeek API shape",
        "Ollama-style localhost LLM endpoint",
        "ONNX/TensorFlow.js embedding adapter slot",
        "Vector database connector slot for approved offline corpora"
      ],
      currentEndpoint: localLlmUrl || "not configured",
      currentModel: localLlmModel,
      fallback: "If DeepSeek-R1 is unavailable, deterministic local routing, retrieval, safety, and report generation remain active.",
      policy: "DeepSeek-R1 can improve language understanding only after approved corpus setup, PHI removal, clinical evaluation, prompt controls, and rollback."
    },
    governance: {
      approvedFeedbackOnly: true,
      noPhiTraining: true,
      reviewerSignoffRequired: true,
      rollbackRequired: true,
      onlineApiEnabled,
      runtimeNode: runtime.node || ""
    },
    storage: getTrainingStorageInfo()
  };
}

export async function loadTrainingState() {
  try {
    await trainingWriteQueue.catch(() => {});
    const fileStats = await stat(trainingFile).catch((error) => {
      if (error.code === "ENOENT") {
        return null;
      }

      throw error;
    });

    if (cachedTrainingState && fileStats && cachedTrainingMtimeMs === fileStats.mtimeMs) {
      return cachedTrainingState;
    }

    if (cachedTrainingState && !fileStats && cachedTrainingMtimeMs === 0) {
      return cachedTrainingState;
    }

    if (!fileStats) {
      const state = createDefaultTrainingState();
      state.models.routeCalibrator = createRouteCalibratorModel(state.examples);
      await writeTrainingState(state);
      return state;
    }

    const parsed = JSON.parse(await readFile(trainingFile, "utf8"));
    const normalized = normalizeTrainingState(parsed);
    const parsedExampleCount = Array.isArray(parsed.examples) ? parsed.examples.length : 0;
    const approvedCount = normalized.examples.filter((example) => example.approved && example.expectedRoute).length;
    const modelCount = Number(normalized.models.routeCalibrator?.exampleCount || 0);

    if (normalized.examples.length !== parsedExampleCount || modelCount !== approvedCount) {
      normalized.models.routeCalibrator = createRouteCalibratorModel(normalized.examples);
      normalized.updatedAt = new Date().toISOString();
      await writeTrainingState(normalized);
    }

    cachedTrainingState = normalized;
    cachedTrainingMtimeMs = fileStats.mtimeMs;
    return cachedTrainingState;
  } catch (error) {
    if (error.code !== "ENOENT") {
      return normalizeTrainingState({});
    }

    const state = createDefaultTrainingState();
    state.models.routeCalibrator = createRouteCalibratorModel(state.examples);
    await writeTrainingState(state);
    return state;
  }
}

export async function recordTrainingExample(payload = {}) {
  const state = await loadTrainingState();
  const message = sanitizeTrainingText(payload.message || payload.input || payload.question || "");
  const expectedRoute = normalizeRoute(payload.expectedRoute || payload.correctRoute || payload.route || payload.tab, detectRouteFromText(message));
  const actualRoute = normalizeRoute(payload.actualRoute || payload.predictedRoute || payload.agentRoute, "");

  if (!message && !expectedRoute) {
    const error = new Error("Training example needs a message or expected route.");
    error.statusCode = 400;
    error.code = "EMPTY_TRAINING_EXAMPLE";
    throw error;
  }

  const example = {
    id: payload.id || randomUUID(),
    createdAt: payload.createdAt || new Date().toISOString(),
    patientFingerprint: hashId(payload.patientId || "demo-patient"),
    tab: normalizeTab(payload.tab || payload.interface || ""),
    message,
    expectedRoute,
    actualRoute,
    approved: payload.approved === true || payload.reviewerApproved === true,
    rating: normalizeRating(payload.rating || payload.score || payload.userRating),
    outcome: normalizeOutcome(payload.outcome || payload.result || ""),
    tags: normalizeTags(payload.tags || payload.labels || []),
    reviewer: sanitizeTrainingText(payload.reviewer || payload.reviewedBy || "").slice(0, 80),
    note: sanitizeTrainingText(payload.note || payload.feedback || payload.comment || "").slice(0, 240)
  };

  state.examples = [
    example,
    ...state.examples.filter((item) => item.id !== example.id)
  ].slice(0, maxStoredExamples);
  state.updatedAt = new Date().toISOString();
  await writeTrainingState(state);

  return {
    ok: true,
    status: "training-example-saved",
    example: toPublicTrainingExample(example),
    training: toPublicTrainingState(state),
    storage: getTrainingStorageInfo()
  };
}

export async function trainLocalAgentCalibrator(payload = {}) {
  const state = await loadTrainingState();

  if (Array.isArray(payload.examples)) {
    for (const example of payload.examples) {
      await recordTrainingExample(example);
    }
    return trainLocalAgentCalibrator({ ...payload, examples: undefined });
  }

  const approvedExamples = state.examples.filter((example) => example.approved && example.expectedRoute);
  const routeCounts = {};
  const tokenCounts = {};
  const reliabilityBuckets = {};
  const confusionMatrix = {};

  for (const route of supportedRoutes) {
    routeCounts[route] = 0;
    tokenCounts[route] = {};
    reliabilityBuckets[route] = {
      ratings: [],
      correct: 0,
      total: 0,
      needsReview: 0
    };
  }

  for (const example of approvedExamples) {
    const route = normalizeRoute(example.expectedRoute, "RAG_AGENT");
    const actualRoute = normalizeRoute(example.actualRoute, "");
    const tokens = tokenizeTrainingText(`${example.message} ${example.note} ${example.tags.join(" ")}`);
    const weight = 1 + (Number(example.rating || 3) - 3) * 0.12 + (example.outcome === "correct" ? 0.18 : 0);

    routeCounts[route] = (routeCounts[route] || 0) + 1;

    for (const token of new Set(tokens)) {
      tokenCounts[route][token] = (tokenCounts[route][token] || 0) + weight;
    }

    reliabilityBuckets[route].ratings.push(Number(example.rating || 3));
    reliabilityBuckets[route].total += 1;
    if (!actualRoute || actualRoute === route || example.outcome === "correct") {
      reliabilityBuckets[route].correct += 1;
    }
    if (example.outcome === "needs_review" || example.outcome === "incorrect") {
      reliabilityBuckets[route].needsReview += 1;
    }

    if (actualRoute) {
      confusionMatrix[actualRoute] = confusionMatrix[actualRoute] || {};
      confusionMatrix[actualRoute][route] = (confusionMatrix[actualRoute][route] || 0) + 1;
    }
  }

  const totalApproved = approvedExamples.length;
  const routePriors = {};
  const keywordRouteWeights = {};
  const agentReliability = {};

  for (const route of supportedRoutes) {
    routePriors[route] = totalApproved ? round(routeCounts[route] / totalApproved, 4) : 0;
    keywordRouteWeights[route] = Object.fromEntries(
      Object.entries(tokenCounts[route])
        .map(([token, score]) => [token, round(score / Math.max(routeCounts[route], 1), 4)])
        .sort((first, second) => second[1] - first[1])
        .slice(0, 80)
    );

    const bucket = reliabilityBuckets[route];
    const avgRating = bucket.ratings.length
      ? bucket.ratings.reduce((total, rating) => total + rating, 0) / bucket.ratings.length
      : 3;
    const correctRate = bucket.total ? bucket.correct / bucket.total : 0.8;
    const reviewPenalty = bucket.total ? bucket.needsReview / bucket.total : 0;
    const score = Math.round(clamp(50 + avgRating * 7 + correctRate * 14 - reviewPenalty * 12, 45, 98));

    agentReliability[route] = {
      score,
      examples: bucket.total,
      avgRating: round(avgRating, 2),
      correctRate: round(correctRate, 3),
      needsReviewRate: round(reviewPenalty, 3)
    };
  }

  state.models.routeCalibrator = {
    version: TRAINING_ENGINE_VERSION,
    status: totalApproved ? "trained" : "waiting-for-approved-feedback",
    trainedAt: new Date().toISOString(),
    exampleCount: totalApproved,
    routePriors,
    keywordRouteWeights,
    agentReliability,
    confusionMatrix,
    metrics: {
      approvedExampleCount: totalApproved,
      storedExampleCount: state.examples.length,
      routesCovered: Object.values(routeCounts).filter(Boolean).length,
      weightedAccuracy: totalApproved
        ? round(Object.values(reliabilityBuckets).reduce((total, bucket) => total + bucket.correct, 0) / totalApproved, 3)
        : 0,
      reviewerApprovedOnly: true,
      noPhiTraining: true,
      medicalFactTraining: false
    }
  };
  state.updatedAt = new Date().toISOString();
  await writeTrainingState(state);

  return {
    ok: true,
    status: state.models.routeCalibrator.status,
    model: state.models.routeCalibrator,
    calibration: buildTrainingCalibration(state),
    training: toPublicTrainingState(state),
    storage: getTrainingStorageInfo()
  };
}

export async function getTrainingCalibration() {
  const state = await loadTrainingState();

  return buildTrainingCalibration(state);
}

export async function evaluateTrainingCalibration(payload = {}) {
  const calibration = payload.calibration || await getTrainingCalibration();
  const message = sanitizeTrainingText(payload.message || payload.input || payload.question || "");
  const tokens = new Set(tokenizeTrainingText(message));
  const scoredRoutes = supportedRoutes.map((route) => {
    const weights = calibration.keywordRouteWeights?.[route] || {};
    const keywordScore = [...tokens].reduce((total, token) => total + Number(weights[token] || 0), 0);
    const priorScore = Number(calibration.routePriors?.[route] || 0);
    const reliability = Number(calibration.agentReliability?.[route]?.score || 70) / 100;
    const score = keywordScore * 0.62 + priorScore * 0.24 + reliability * 0.14;

    return {
      route,
      score: round(score, 4),
      keywordHits: [...tokens].filter((token) => Number(weights[token] || 0) > 0).slice(0, 10),
      reliability: calibration.agentReliability?.[route] || { score: 70, examples: 0 }
    };
  }).sort((first, second) => second.score - first.score);
  const topRoute = scoredRoutes[0] || { route: "RAG_AGENT", score: 0 };

  return {
    ok: true,
    status: calibration.enabled ? "calibration-evaluated" : "calibration-waiting-for-approved-feedback",
    recommendedRoute: topRoute.route,
    confidence: Math.round(clamp(topRoute.score * 100, calibration.enabled ? 46 : 30, 96)),
    evidence: topRoute.keywordHits,
    rankedRoutes: scoredRoutes.slice(0, 5),
    calibration: {
      enabled: calibration.enabled,
      trainedAt: calibration.trainedAt,
      exampleCount: calibration.exampleCount,
      modelVersion: calibration.modelVersion
    },
    boundary: calibration.safetyBoundary
  };
}

export function toPublicTrainingState(state = createDefaultTrainingState()) {
  const normalized = normalizeTrainingState(state);
  const model = normalized.models.routeCalibrator;

  return {
    ok: true,
    status: model.status,
    version: TRAINING_ENGINE_VERSION,
    updatedAt: normalized.updatedAt,
    exampleCount: normalized.examples.length,
    approvedExampleCount: normalized.examples.filter((example) => example.approved).length,
    model: {
      version: model.version,
      status: model.status,
      trainedAt: model.trainedAt,
      exampleCount: model.exampleCount,
      routesCovered: model.metrics?.routesCovered || 0,
      weightedAccuracy: model.metrics?.weightedAccuracy || 0,
      reviewerApprovedOnly: true,
      medicalFactTraining: false
    },
    recentExamples: normalized.examples.slice(0, 6).map(toPublicTrainingExample),
    storage: getTrainingStorageInfo(),
    machineLearning: getMachineLearningCapabilityStatus().summary
  };
}

function buildTrainingCalibration(state) {
  const model = normalizeTrainingState(state).models.routeCalibrator;
  const enabled = model.status === "trained" && Number(model.exampleCount || 0) > 0;

  return {
    id: "LOCAL_AGENT_TRAINING_CALIBRATION",
    modelVersion: model.version || TRAINING_ENGINE_VERSION,
    enabled,
    status: model.status || "waiting-for-approved-feedback",
    trainedAt: model.trainedAt || "",
    exampleCount: Number(model.exampleCount || 0),
    routePriors: model.routePriors || {},
    keywordRouteWeights: model.keywordRouteWeights || {},
    agentReliability: model.agentReliability || {},
    confusionMatrix: model.confusionMatrix || {},
    metrics: model.metrics || {},
    safetyBoundary: "Local ML/DL training calibrates agent routing and answer precision only; it does not create new medical facts, diagnoses, prescriptions, or dosage rules."
  };
}

function createDefaultTrainingState() {
  const baselineExamples = createBaselineTrainingExamples();

  return {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    examples: baselineExamples,
    models: {
      routeCalibrator: {
        version: TRAINING_ENGINE_VERSION,
        status: "waiting-for-approved-feedback",
        trainedAt: "",
        exampleCount: 0,
        routePriors: {},
        keywordRouteWeights: {},
        agentReliability: {},
        confusionMatrix: {},
        metrics: {
          approvedExampleCount: 0,
          storedExampleCount: 0,
          routesCovered: 0,
          weightedAccuracy: 0,
          reviewerApprovedOnly: true,
          noPhiTraining: true,
          medicalFactTraining: false
        }
      }
    }
  };
}

function normalizeTrainingState(value = {}) {
  const storedExamples = Array.isArray(value.examples) ? value.examples.map(normalizeStoredExample).filter(Boolean) : [];
  const storedIds = new Set(storedExamples.map((example) => example.id));
  const examples = [
    ...storedExamples,
    ...createBaselineTrainingExamples().filter((example) => !storedIds.has(example.id))
  ].slice(0, maxStoredExamples);
  const state = {
    ...createDefaultTrainingState(),
    ...value,
    examples,
    models: {
      ...createDefaultTrainingState().models,
      ...(value.models && typeof value.models === "object" ? value.models : {})
    }
  };

  state.models.routeCalibrator = {
    ...createDefaultTrainingState().models.routeCalibrator,
    ...(state.models.routeCalibrator && typeof state.models.routeCalibrator === "object" ? state.models.routeCalibrator : {})
  };

  return state;
}

function createBaselineTrainingExamples() {
  const createdAt = "2026-06-28T00:00:00.000Z";
  const patientFingerprint = "baseline-training";
  const rows = [
    {
      id: "baseline-general-health-guidance",
      tab: "general",
      message: "I have a mild headache since morning, no fever, and want safe general guidance.",
      expectedRoute: "RAG_AGENT",
      tags: ["general", "symptom", "headache"]
    },
    {
      id: "baseline-specialist-core-disease",
      tab: "specialist",
      message: "Explain hypertension and type 2 diabetes prevention, monitoring, and questions for a doctor.",
      expectedRoute: "SPECIALIST_DOCTOR_AGENT",
      tags: ["specialist", "disease", "diabetes", "hypertension"]
    },
    {
      id: "baseline-vitals-review",
      tab: "vitals",
      message: "My BP is 160/98, pulse is fast, and I need help reviewing daily vital readings.",
      expectedRoute: "VITALS_AGENT",
      tags: ["vitals", "bp", "pulse"]
    },
    {
      id: "baseline-medicine-safety",
      tab: "medicine",
      message: "I missed my blood pressure tablet and want to understand medicine safety and side effects.",
      expectedRoute: "PHARMACY_AGENT",
      tags: ["medicine", "missed dose", "side effect"]
    },
    {
      id: "baseline-lab-report-review",
      tab: "labs",
      message: "Explain my HbA1c, LDL cholesterol, CBC, kidney, and thyroid lab report in simple words.",
      expectedRoute: "LABS_AGENT",
      tags: ["labs", "hba1c", "cholesterol"]
    },
    {
      id: "baseline-wellness-plan",
      tab: "wellness",
      message: "Build a healthy life routine for sleep, stress, diet, hydration, walking, and age group habits.",
      expectedRoute: "WELLNESS_AGENT",
      tags: ["wellness", "habit", "sleep", "diet"]
    },
    {
      id: "baseline-visit-follow-up",
      tab: "visits",
      message: "Help me book a doctor appointment, prepare questions, and plan follow-up reminders.",
      expectedRoute: "SCHEDULING_AGENT",
      tags: ["visit", "appointment", "follow up"]
    },
    {
      id: "baseline-records-summary",
      tab: "records",
      message: "Create a patient health record summary with symptoms, medicines, vitals, labs, and visit notes.",
      expectedRoute: "RECORDS_AGENT",
      tags: ["records", "summary", "doctor note"]
    },
    {
      id: "baseline-insurance-claim",
      tab: "insurance",
      message: "Help with insurance claim, coverage, EOB, benefits, prior authorization, and missing documents.",
      expectedRoute: "INSURANCE_AGENT",
      tags: ["insurance", "claim", "coverage"]
    },
    {
      id: "baseline-safety-alert",
      tab: "safety",
      message: "Chest pain, trouble breathing, fainting, one-sided weakness, or severe allergy warning signs.",
      expectedRoute: "ALERT_AGENT",
      tags: ["safety", "urgent", "warning signs"]
    }
  ];

  return rows.map((row) => normalizeStoredExample({
    ...row,
    createdAt,
    patientFingerprint,
    actualRoute: row.expectedRoute,
    approved: true,
    rating: 4,
    outcome: "correct",
    reviewer: "baseline",
    note: "Safe synthetic baseline example for local route calibration."
  }));
}

function createRouteCalibratorModel(examples = []) {
  const approvedExamples = examples.filter((example) => example.approved && example.expectedRoute);
  const routeCounts = {};
  const tokenCounts = {};
  const reliabilityBuckets = {};
  const confusionMatrix = {};

  for (const route of supportedRoutes) {
    routeCounts[route] = 0;
    tokenCounts[route] = {};
    reliabilityBuckets[route] = {
      ratings: [],
      correct: 0,
      total: 0,
      needsReview: 0
    };
  }

  for (const example of approvedExamples) {
    const route = normalizeRoute(example.expectedRoute, "RAG_AGENT");
    const actualRoute = normalizeRoute(example.actualRoute, "");
    const tokens = tokenizeTrainingText(`${example.message} ${example.note} ${example.tags.join(" ")}`);
    const weight = 1 + (Number(example.rating || 3) - 3) * 0.12 + (example.outcome === "correct" ? 0.18 : 0);

    routeCounts[route] = (routeCounts[route] || 0) + 1;

    for (const token of new Set(tokens)) {
      tokenCounts[route][token] = (tokenCounts[route][token] || 0) + weight;
    }

    reliabilityBuckets[route].ratings.push(Number(example.rating || 3));
    reliabilityBuckets[route].total += 1;
    if (!actualRoute || actualRoute === route || example.outcome === "correct") {
      reliabilityBuckets[route].correct += 1;
    }
    if (example.outcome === "needs_review" || example.outcome === "incorrect") {
      reliabilityBuckets[route].needsReview += 1;
    }

    if (actualRoute) {
      confusionMatrix[actualRoute] = confusionMatrix[actualRoute] || {};
      confusionMatrix[actualRoute][route] = (confusionMatrix[actualRoute][route] || 0) + 1;
    }
  }

  const totalApproved = approvedExamples.length;
  const routePriors = {};
  const keywordRouteWeights = {};
  const agentReliability = {};

  for (const route of supportedRoutes) {
    routePriors[route] = totalApproved ? round(routeCounts[route] / totalApproved, 4) : 0;
    keywordRouteWeights[route] = Object.fromEntries(
      Object.entries(tokenCounts[route])
        .map(([token, score]) => [token, round(score / Math.max(routeCounts[route], 1), 4)])
        .sort((first, second) => second[1] - first[1])
        .slice(0, 80)
    );

    const bucket = reliabilityBuckets[route];
    const avgRating = bucket.ratings.length
      ? bucket.ratings.reduce((total, rating) => total + rating, 0) / bucket.ratings.length
      : 3;
    const correctRate = bucket.total ? bucket.correct / bucket.total : 0.8;
    const reviewPenalty = bucket.total ? bucket.needsReview / bucket.total : 0;
    const score = Math.round(clamp(50 + avgRating * 7 + correctRate * 14 - reviewPenalty * 12, 45, 98));

    agentReliability[route] = {
      score,
      examples: bucket.total,
      avgRating: round(avgRating, 2),
      correctRate: round(correctRate, 3),
      needsReviewRate: round(reviewPenalty, 3)
    };
  }

  return {
    version: TRAINING_ENGINE_VERSION,
    status: totalApproved ? "trained" : "waiting-for-approved-feedback",
    trainedAt: new Date().toISOString(),
    exampleCount: totalApproved,
    routePriors,
    keywordRouteWeights,
    agentReliability,
    confusionMatrix,
    metrics: {
      approvedExampleCount: totalApproved,
      storedExampleCount: examples.length,
      routesCovered: Object.values(routeCounts).filter(Boolean).length,
      weightedAccuracy: totalApproved
        ? round(Object.values(reliabilityBuckets).reduce((total, bucket) => total + bucket.correct, 0) / totalApproved, 3)
        : 0,
      reviewerApprovedOnly: true,
      noPhiTraining: true,
      medicalFactTraining: false
    }
  };
}

function normalizeStoredExample(example) {
  if (!example || typeof example !== "object") {
    return null;
  }

  return {
    id: String(example.id || randomUUID()),
    createdAt: String(example.createdAt || new Date().toISOString()),
    patientFingerprint: String(example.patientFingerprint || hashId(example.patientId || "demo-patient")),
    tab: normalizeTab(example.tab || ""),
    message: sanitizeTrainingText(example.message || "").slice(0, 700),
    expectedRoute: normalizeRoute(example.expectedRoute || example.route || "", ""),
    actualRoute: normalizeRoute(example.actualRoute || "", ""),
    approved: example.approved === true,
    rating: normalizeRating(example.rating),
    outcome: normalizeOutcome(example.outcome || ""),
    tags: normalizeTags(example.tags || []),
    reviewer: sanitizeTrainingText(example.reviewer || "").slice(0, 80),
    note: sanitizeTrainingText(example.note || "").slice(0, 240)
  };
}

function toPublicTrainingExample(example) {
  return {
    id: example.id,
    createdAt: example.createdAt,
    tab: example.tab,
    expectedRoute: example.expectedRoute,
    actualRoute: example.actualRoute,
    approved: example.approved,
    rating: example.rating,
    outcome: example.outcome,
    tags: example.tags,
    preview: example.message ? `${example.message.slice(0, 90)}${example.message.length > 90 ? "..." : ""}` : ""
  };
}

async function writeTrainingState(state) {
  const body = `${JSON.stringify(state, null, 2)}\n`;

  trainingWriteQueue = trainingWriteQueue.catch(() => {}).then(async () => {
    await mkdir(dirname(trainingFile), { recursive: true });
    const tmpFile = `${trainingFile}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`;
    await writeFile(tmpFile, body, "utf8");
    await rename(tmpFile, trainingFile);
    const fileStats = await stat(trainingFile).catch(() => null);
    cachedTrainingState = state;
    cachedTrainingMtimeMs = fileStats?.mtimeMs || Date.now();
  });

  await trainingWriteQueue;
}

function detectRouteFromText(message) {
  const text = normalizeText(message);

  if (/\b(chest pain|shortness of breath|cannot breathe|faint|stroke|severe allergy|suicide|self harm)\b/.test(text)) {
    return "ALERT_AGENT";
  }
  if (/\b(medicine|medication|tablet|dose|side effect|metformin|amlodipine|insulin|drug)\b/.test(text)) {
    return "PHARMACY_AGENT";
  }
  if (/\b(bp|blood pressure|sugar|glucose|pulse|heart rate|temperature|bmi|weight)\b/.test(text)) {
    return "VITALS_AGENT";
  }
  if (/\b(hba1c|cholesterol|cbc|lab|report|creatinine|egfr|ldl|hdl)\b/.test(text)) {
    return "LABS_AGENT";
  }
  if (/\b(appointment|visit|follow up|schedule|book|doctor)\b/.test(text)) {
    return "SCHEDULING_AGENT";
  }
  if (/\b(insurance|claim|coverage|prior auth|appeal|eob|benefit)\b/.test(text)) {
    return "INSURANCE_AGENT";
  }
  if (/\b(record|summary|history|vault|profile)\b/.test(text)) {
    return "RECORDS_AGENT";
  }
  if (/\b(diet|sleep|stress|exercise|walking|habit|wellness|mental)\b/.test(text)) {
    return "WELLNESS_AGENT";
  }
  if (/\b(disease|condition|diabetes|hypertension|asthma|kidney|heart)\b/.test(text)) {
    return "SPECIALIST_DOCTOR_AGENT";
  }

  return "RAG_AGENT";
}

function normalizeRoute(value, fallback = "RAG_AGENT") {
  const raw = String(value || "").trim();

  if (!raw) {
    return fallback;
  }

  const upper = raw.toUpperCase().replace(/[^A-Z0-9_]+/g, "_");
  if (supportedRoutes.includes(upper)) {
    return upper;
  }

  return routeAliases[normalizeText(raw)] || fallback;
}

function normalizeTab(value) {
  return normalizeText(value).slice(0, 40);
}

function normalizeOutcome(value) {
  const text = normalizeText(value);

  if (["correct", "success", "helpful", "accepted"].includes(text)) {
    return "correct";
  }
  if (["wrong", "incorrect", "bad", "failed"].includes(text)) {
    return "incorrect";
  }
  if (["review", "needs review", "needs_review", "unclear"].includes(text)) {
    return "needs_review";
  }

  return text || "not_reviewed";
}

function normalizeRating(value) {
  const rating = Number.parseFloat(value);

  if (!Number.isFinite(rating)) {
    return 3;
  }

  return Math.round(clamp(rating, 1, 5));
}

function normalizeTags(value) {
  const tags = Array.isArray(value) ? value : String(value || "").split(",");

  return tags
    .map((tag) => sanitizeTrainingText(tag).slice(0, 32))
    .filter(Boolean)
    .slice(0, 8);
}

function tokenizeTrainingText(value) {
  const words = normalizeText(value)
    .split(" ")
    .filter((word) => word.length > 1 && !stopWords.has(word));
  const tokens = [...words];

  for (let index = 0; index < words.length - 1; index += 1) {
    const phrase = `${words[index]} ${words[index + 1]}`;
    if (!stopWords.has(words[index]) && !stopWords.has(words[index + 1])) {
      tokens.push(phrase);
    }
  }

  return tokens.slice(0, 160);
}

function sanitizeTrainingText(value) {
  return String(value || "")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/\b(?:\+?\d[\d\s().-]{7,}\d)\b/g, "[phone]")
    .replace(/\b(?:mrn|medical record|patient id)\s*[:#-]?\s*[a-z0-9-]+\b/gi, "[identifier]")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hashId(value) {
  return createHash("sha256").update(String(value || "demo-patient")).digest("hex").slice(0, 16);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

function round(value, precision = 2) {
  const factor = 10 ** precision;

  return Math.round((Number(value) || 0) * factor) / factor;
}

function formatProjectRelativePath(filePath) {
  const projectRelative = relative(rootDir, filePath).replace(/\\/g, "/");

  if (!projectRelative || projectRelative.startsWith("..")) {
    return filePath;
  }

  return projectRelative;
}
