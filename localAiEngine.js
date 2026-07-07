import { getHybridModelRouterStatus } from "./hybridModelRouter.js";
import { getConnectivityPolicy, isLocalEndpoint } from "./runtimeConnectivity.js";

export const LOCAL_AI_CORE_VERSION = "1.3.1";
export const PRIMARY_LLM_PROVIDER = "auto";
export const PRIMARY_LLM_MODEL = "local-open-source-auto";
export const PRIMARY_LLM_DISPLAY_NAME = "Auto Local Open-Source Ensemble";

const maxCorpusCacheEntries = 8;
const maxRankedQueryCacheEntries = 48;
const preparedCorpusByReference = new WeakMap();
const preparedCorpusBySignature = new Map();
const rankedQueryCache = new Map();

const stopWords = new Set([
  "a",
  "about",
  "after",
  "all",
  "also",
  "am",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "because",
  "before",
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
  "our",
  "please",
  "should",
  "tell",
  "the",
  "this",
  "to",
  "what",
  "when",
  "with",
  "you"
]);

const semanticFamilies = [
  {
    id: "cardio",
    label: "Cardio and blood pressure",
    terms: ["heart", "cardiac", "chest", "bp", "blood", "pressure", "pulse", "palpitation", "sweating", "jaw", "arm", "cholesterol"]
  },
  {
    id: "respiratory",
    label: "Breathing and lungs",
    terms: ["breathing", "breath", "cough", "wheeze", "asthma", "copd", "oxygen", "inhaler", "sputum", "choking"]
  },
  {
    id: "neuro",
    label: "Brain and nerves",
    terms: ["headache", "stroke", "weakness", "speech", "vision", "confusion", "seizure", "dizzy", "numbness"]
  },
  {
    id: "metabolic",
    label: "Diabetes and metabolism",
    terms: ["diabetes", "sugar", "glucose", "hba1c", "insulin", "metformin", "thirst", "urination", "thyroid"]
  },
  {
    id: "medicine",
    label: "Medicine safety",
    terms: ["medicine", "medication", "drug", "tablet", "pill", "dose", "interaction", "allergy", "rash", "swelling", "side"]
  },
  {
    id: "labs",
    label: "Labs and reports",
    terms: ["lab", "report", "cbc", "creatinine", "egfr", "ldl", "hdl", "cholesterol", "platelet", "hemoglobin", "scan", "ecg"]
  },
  {
    id: "urgent",
    label: "Urgent safety",
    terms: ["urgent", "emergency", "severe", "faint", "fainting", "bleeding", "blue", "confusion", "unable", "worst"]
  }
];

const medicalEntityGroups = [
  {
    id: "blood_pressure",
    label: "Blood pressure and hypertension",
    triggers: ["bp", "blood pressure", "hypertension", "systolic", "diastolic"],
    expansions: ["bp", "blood", "pressure", "hypertension", "systolic", "diastolic", "heart", "cardio"],
    categories: ["Vitals", "General", "Urgent Safety"]
  },
  {
    id: "blood_sugar",
    label: "Blood sugar and diabetes",
    triggers: ["sugar", "blood sugar", "glucose", "diabetes", "hba1c", "a1c", "insulin", "metformin"],
    expansions: ["sugar", "glucose", "diabetes", "hba1c", "a1c", "insulin", "metformin", "metabolic"],
    categories: ["Vitals", "Labs", "Medication", "General"]
  },
  {
    id: "medicine_safety",
    label: "Medicine safety",
    triggers: ["medicine", "medication", "tablet", "pill", "dose", "missed", "side effect", "interaction", "allergy"],
    expansions: ["medicine", "medication", "drug", "tablet", "pill", "dose", "missed", "interaction", "allergy", "pharmacy"],
    categories: ["Medication", "Urgent Safety"]
  },
  {
    id: "lab_report",
    label: "Lab report and test values",
    triggers: ["lab", "report", "test", "cbc", "cholesterol", "ldl", "hdl", "creatinine", "egfr", "thyroid", "tsh"],
    expansions: ["lab", "report", "test", "cbc", "cholesterol", "ldl", "hdl", "creatinine", "egfr", "thyroid", "tsh"],
    categories: ["Labs", "Vitals"]
  },
  {
    id: "breathing_safety",
    label: "Breathing safety",
    triggers: ["breathing", "breathless", "shortness of breath", "wheeze", "asthma", "oxygen", "spo2", "cough"],
    expansions: ["breathing", "breath", "breathless", "wheeze", "asthma", "oxygen", "spo2", "cough", "respiratory"],
    categories: ["General", "Urgent Safety", "Vitals"]
  },
  {
    id: "neuro_safety",
    label: "Neurologic safety",
    triggers: ["headache", "stroke", "weakness", "speech", "vision", "confusion", "seizure", "numbness"],
    expansions: ["headache", "stroke", "weakness", "speech", "vision", "confusion", "seizure", "numbness", "neuro"],
    categories: ["General", "Urgent Safety", "Vitals"]
  },
  {
    id: "visit_followup",
    label: "Visit and follow-up planning",
    triggers: ["appointment", "follow up", "follow-up", "visit", "doctor", "clinic", "schedule", "discharge"],
    expansions: ["appointment", "follow", "visit", "doctor", "clinic", "schedule", "discharge", "transition"],
    categories: ["Follow-up", "Care Transitions", "Records"]
  },
  {
    id: "insurance_claim",
    label: "Insurance and claims",
    triggers: ["insurance", "claim", "coverage", "eob", "bill", "prior authorization", "appeal"],
    expansions: ["insurance", "claim", "claims", "coverage", "eob", "bill", "authorization", "appeal"],
    categories: ["Insurance", "Claims Operations", "Utilization Management"]
  },
  {
    id: "quality_compliance",
    label: "Life-science quality and compliance",
    triggers: ["batch record", "deviation", "gxp", "qms", "sop", "technical file", "complaint", "capa", "traceability"],
    expansions: ["batch", "record", "deviation", "gxp", "qms", "sop", "technical", "complaint", "capa", "traceability"],
    categories: ["GxP Quality", "MedTech Compliance"]
  }
];

const intentFocusTagsByIntent = {
  GENERAL: ["General"],
  SPECIALIST_DOCTOR: ["Specialist"],
  MEDICATION: ["Medication"],
  APPOINTMENT: ["Care Transitions"],
  EMERGENCY: ["Urgent Safety"],
  VITALS_TRACKING: ["Vitals"],
  LAB_REPORT: ["Labs"],
  LIFESTYLE: ["Lifestyle"],
  MENTAL_WELLNESS: ["Lifestyle", "Urgent Safety"],
  HEALTH_RECORDS: ["Records"],
  INSURANCE_SUPPORT: ["Insurance"],
  CARE_TRANSITIONS: ["Care Transitions", "Records"],
  CLAIMS_OPERATIONS: ["Insurance"],
  UTILIZATION_MANAGEMENT: ["Insurance"],
  GXP_QUALITY: [],
  MEDTECH_COMPLIANCE: []
};

const clinicalDomainSignals = [
  { id: "cardiology", terms: ["cardiology", "cardiac", "heart", "hypertension", "blood pressure", "palpitation", "heart failure", "cholesterol", "lipid", "statin"] },
  { id: "endocrinology", terms: ["endocrinology", "diabetes", "glucose", "a1c", "hba1c", "insulin", "metformin", "thyroid", "hormone"] },
  { id: "pulmonology", terms: ["pulmonology", "asthma", "copd", "oxygen", "spo2", "wheeze", "inhaler", "respiratory"] },
  { id: "nephrology", terms: ["nephrology", "kidney", "renal", "creatinine", "egfr", "protein urine", "dialysis"] },
  { id: "neurology", terms: ["neurology", "stroke", "seizure", "migraine", "headache", "vision change", "numbness", "speech"] },
  { id: "hepatology", terms: ["hepatology", "liver", "bilirubin", "alt", "ast", "jaundice"] },
  { id: "gynecology", terms: ["gynecology", "pelvic", "period", "menopause", "pcos", "breast", "bleeding"] },
  { id: "pediatrics", terms: ["pediatrics", "pediatric", "infant", "newborn", "child"] },
  { id: "gastrointestinal", terms: ["gastrointestinal", "digestive", "reflux", "abdominal", "bowel", "ibd", "ulcer"] },
  { id: "maternal-health", terms: ["maternal", "pregnancy", "postpartum", "fetal", "preeclampsia"] },
  { id: "sleep-medicine", terms: ["sleep medicine", "sleep apnea", "snoring", "insomnia"] },
  { id: "travel-health", terms: ["travel health", "travel", "mosquito", "jet lag", "altitude"] },
  { id: "bone-health", terms: ["bone health", "osteoporosis", "fracture", "fall prevention", "calcium", "vitamin d"] }
];

export function getModelHealthStatus(env = process.env) {
  const timeoutMs = Number.parseInt(cleanText(env.LOCAL_LLM_TIMEOUT_MS || env.CARE_NOVA_LLM_TIMEOUT_MS || "20000"), 10);
  const enabled = readBooleanDefault(env.LOCAL_LLM_ENABLED, true);
  const connectivity = getConnectivityPolicy(env);
  const router = getHybridModelRouterStatus(env);
  const configuredOpenSourceModels = router.localModels.filter((model) => model.id !== "care-nova-local-core" && model.configured);
  const availableOpenSourceModels = configuredOpenSourceModels.filter((model) => model.available);
  const preferredProvider = cleanText(env.LOCAL_LLM_PROVIDER || env.CARE_NOVA_LLM_PROVIDER || PRIMARY_LLM_PROVIDER).toLowerCase();
  const preferredModel = availableOpenSourceModels.find((model) => model.selected)
    || availableOpenSourceModels[0]
    || configuredOpenSourceModels.find((model) => model.selected)
    || configuredOpenSourceModels[0]
    || null;
  const provider = cleanText(preferredModel?.id || preferredProvider || PRIMARY_LLM_PROVIDER);
  const endpoint = cleanText(preferredModel?.endpoint);
  const model = cleanText(preferredModel?.model) || PRIMARY_LLM_MODEL;
  const endpointIsLocal = isLocalEndpoint(endpoint);
  const missing = Array.isArray(preferredModel?.missing) ? preferredModel.missing : [];
  const available = enabled && Boolean(preferredModel?.available);
  const reason = !enabled
    ? "Local LLM connector is disabled and the deterministic healthcare engine remains active."
    : availableOpenSourceModels.length
      ? `Open-source local ensemble is ready with ${availableOpenSourceModels.map((item) => item.displayName).join(", ")}.`
      : configuredOpenSourceModels.length
        ? "Open-source local ensemble is configured and waiting for the local runtime to respond."
        : "No open-source local runtime is active yet; deterministic local core remains active.";

  return {
    provider,
    displayName: preferredModel?.displayName || PRIMARY_LLM_DISPLAY_NAME,
    primary: Boolean(preferredModel),
    enabled,
    available,
    endpoint,
    endpointIsLocal,
    runtimeFamily: preferredModel?.runtimeFamily || (endpointIsLocal ? "local-openai-compatible" : "remote-openai-compatible"),
    internetRequired: Boolean(endpoint && !endpointIsLocal),
    model,
    timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : 20000,
    status: !enabled
      ? "disabled-safe-offline-fallback"
      : available
        ? "configured"
        : configuredOpenSourceModels.length
          ? "configured-local-runtime-waiting"
          : missing.length
            ? "fallback-missing-configuration"
            : "fallback-no-local-runtime",
    missing,
    connectivity: {
      forceOffline: connectivity.forceOffline,
      internetAvailable: connectivity.internetAvailable,
      endpointIsLocal
    },
    healthCheck: {
      configured: Boolean(configuredOpenSourceModels.length),
      available,
      liveProbeRequired: Boolean(configuredOpenSourceModels.length && !available),
      lastCheckedAt: new Date().toISOString(),
      fallback: "local deterministic healthcare engine"
    },
    reason,
    apiKey: preferredModel?.apiKey || "",
    apiKeyHeader: preferredModel?.apiKeyHeader || "",
    authScheme: preferredModel?.authScheme || "Bearer",
    promptPolicy: {
      reasoning: "Use open-source local reasoning internally; never expose hidden chain-of-thought.",
      context: "Prefer compact patient memory, route decision, safety flags, evidence snippets, and report task data.",
      safety: "Medical safety guardrails and urgent-care override remain outside the LLM."
    }
  };
}

export function getLocalAiRuntimeStatus(env = process.env) {
  const modelHealth = getModelHealthStatus(env);
  const hybridRouter = getHybridModelRouterStatus(env);
  const connectivity = getConnectivityPolicy(env);
  const localLlmEnabled = modelHealth.enabled;
  const localLlmReady = modelHealth.available;
  const externalApiEnabled = readBoolean(env.CARE_NOVA_EXTERNAL_API_ENABLED) && Boolean(cleanText(env.CARE_NOVA_EXTERNAL_API_URL));
  const onlineModeEnabled = connectivity.networkAllowed && (readBoolean(env.CARE_NOVA_ONLINE_MODE) || externalApiEnabled);
  const mode = cleanText(env.CARE_NOVA_AI_MODE) || (localLlmReady ? "offline-plus-local-llm" : "offline-first");
  const localLlmUrl = modelHealth.endpoint;
  const localLlmModel = modelHealth.model;
  const openSourceParticipants = hybridRouter.localModels.filter((model) => model.available && model.id !== "care-nova-local-core");

  return {
    id: "CARE_NOVA_LOCAL_AI_CORE",
    version: LOCAL_AI_CORE_VERSION,
    mode,
    offlineReady: true,
    onlineReady: onlineModeEnabled,
    connectivity: {
      forceOffline: connectivity.forceOffline,
      internetAvailable: connectivity.internetAvailable
    },
    runtimeParity: {
      id: "ONLINE_OFFLINE_PARITY",
      sameCoreOnlineOffline: true,
      internetRequired: false,
      localServerRequired: true,
      onlinePath: "Same local Node API, local medical database, local evidence ranker, local memory, local records, and optional approved external API cache.",
      offlinePath: "Same local Node API, local medical database, local evidence ranker, local memory, and local records.",
      performanceModel: "Local CPU and local disk for the core engine; optional external API data is cached locally and never required for safe fallback.",
      dataStores: [
        "data/offline-medical-db.json",
        "data/offline-clinical-repository.json",
        "data/offline-knowledge-index.json",
        "data/offline-repository-manifest.json",
        "data/external/external-knowledge-cache.json",
        "data/memory/patient-memory.json",
        "data/records/patient-records.json",
        "browser localStorage for UI preferences and installed-app state"
      ],
      guarantee: "The core engine remains local. External API data is optional, de-identified, cached locally, and reused from disk for future requests."
    },
    runtime: "local-node-deterministic-ml",
    mlCore: {
      enabled: true,
      method: "TF-IDF style lexical retrieval, generated offline repository index, source-family filtering, synonym expansion, medical entity alignment, numeric signal awareness, semantic family scoring, route-aware evidence weighting, confidence calibration, and safety gating",
      runsWithoutInternet: true,
      trainsFromPatientData: false,
      learningBoundary: "Patient conversations improve local context memory only; medical facts stay in the governed offline database."
    },
    localLlm: {
      enabled: localLlmEnabled,
      provider: modelHealth.provider,
      displayName: modelHealth.displayName,
      primary: modelHealth.primary,
      status: modelHealth.status,
      available: modelHealth.available,
      endpoint: localLlmUrl,
      model: localLlmModel,
      health: modelHealth.healthCheck,
      missing: modelHealth.missing,
      endpointIsLocal: modelHealth.endpointIsLocal,
      internetRequired: modelHealth.internetRequired,
      connectivity: modelHealth.connectivity,
      reason: modelHealth.reason,
      promptPolicy: modelHealth.promptPolicy,
      ensembleEnabled: openSourceParticipants.length > 0,
      participants: openSourceParticipants.map(({ id, displayName, model, performanceClass }) => ({
        id,
        displayName,
        model,
        performanceClass
      })),
      fallback: "If one open-source local LLM is unavailable, the router continues with the next configured free model or the deterministic local core.",
      adapter: "Route-aware open-source local ensemble with deterministic healthcare safety fallback; the safe runtime does not require provider access."
    },
    hybridRouter: {
      id: hybridRouter.id,
      version: hybridRouter.version,
      status: hybridRouter.status,
      mode: hybridRouter.mode,
      processingLabels: hybridRouter.processingLabels,
      summary: hybridRouter.summary,
      connectivity: hybridRouter.connectivity,
      costPolicy: hybridRouter.costPolicy,
      fallbackPolicy: hybridRouter.fallbackPolicy,
      localModels: hybridRouter.localModels.map(({ id, displayName, model, status, available, offlineCapable, costTier, performanceClass }) => ({
        id,
        displayName,
        model,
        status,
        available,
        offlineCapable,
        costTier,
        performanceClass
      })),
      cloudModels: hybridRouter.cloudModels.map(({ id, displayName, model, status, available, costTier, performanceClass, internetRequired }) => ({
        id,
        displayName,
        model,
        status,
        available,
        costTier,
        performanceClass,
        internetRequired
      }))
    },
    onlineConnector: {
      enabled: onlineModeEnabled,
      status: !connectivity.networkAllowed
        ? connectivity.forceOffline
          ? "offline-policy-blocked"
          : "internet-unavailable"
        : externalApiEnabled
          ? "external-api-cache-enabled"
          : onlineModeEnabled
            ? "allowed-by-env-for-verified-sources"
            : "disabled",
      internetAvailable: connectivity.internetAvailable,
      forceOffline: connectivity.forceOffline,
      boundary: "Online mode should only use licensed, clinician-reviewed, approved medical sources.",
      cacheFile: "data/external/external-knowledge-cache.json",
      futureRequestReuse: externalApiEnabled
    },
    safety: {
      noDiagnosis: true,
      noPrescribing: true,
      noDoseCalculation: true,
      urgentCareOverride: true,
      clinicianReviewRequiredForMedicalFactUpdates: true
    }
  };
}

export function rankLocalMedicalKnowledge({
  query,
  records = [],
  intents = [],
  risk = {},
  routeCategories = new Set(),
  primaryCategories = new Set(),
  categoryMap = {},
  maxMatches = 5
} = {}) {
  const { preparedRecords, corpusStats, cacheHit: corpusCacheHit, signature } = getPreparedCorpus(records);
  const queryText = normalizeText(query);
  const baseQueryTokens = tokenize(query);
  const queryExpansion = expandQueryTokens(baseQueryTokens, queryText);
  const queryTokens = queryExpansion.tokens;
  const queryCacheKey = buildRankedQueryCacheKey({
    signature,
    queryText,
    intents,
    risk,
    routeCategories,
    primaryCategories,
    maxMatches
  });
  const cachedRanking = rankedQueryCache.get(queryCacheKey);

  if (cachedRanking) {
    touchRankedQueryCacheEntry(queryCacheKey, cachedRanking);

    return {
      ...cachedRanking,
      cacheHit: true,
      corpusCacheHit,
      queryCacheHit: true,
      runtime: getLocalAiRuntimeStatus()
    };
  }

  const queryVector = buildVector(queryTokens, corpusStats.idf);
  const queryFamilies = matchSemanticFamilies(queryTokens);
  const queryEntities = detectMedicalQueryEntities(queryText, queryTokens);
  const queryPopulationTags = detectPopulationContext(queryText);
  const numericSignals = detectNumericClinicalSignals(queryText);
  const queryFocusTags = deriveIntentFocusTags({ intents, routeCategories, primaryCategories, risk });
  const querySupportTags = dedupe([...routeCategories, ...primaryCategories].map(cleanText).filter(Boolean));
  const queryFocusTagSet = new Set(queryFocusTags.map(normalizeText));
  const querySupportTagSet = new Set(querySupportTags.map(normalizeText));
  const queryClinicalDomains = detectClinicalQueryDomains(queryText, queryTokens);
  const queryClinicalDomainSet = new Set(queryClinicalDomains.map(normalizeText));
  const strictFocus = queryFocusTags.length > 0 && !queryFocusTags.includes("General");

  const ranked = preparedRecords
    .map((prepared) => {
      const cosine = cosineSimilarity(queryVector, prepared.vector);
      const phraseHits = findPhraseHits(queryText, prepared.keywordPhrases);
      const tokenHits = findTokenHits(queryTokens, prepared.keywordTokens);
      const familyHits = prepared.semanticFamilies.filter((family) => queryFamilies.some((item) => item.id === family.id));
      const entityHits = findEntityHits(queryEntities, prepared);
      const focusTagHits = prepared.routeTags.filter((tag) => queryFocusTagSet.has(normalizeText(tag)));
      const supportTagHits = prepared.routeTags.filter((tag) => !focusTagHits.includes(tag) && querySupportTagSet.has(normalizeText(tag)));
      const domainHits = prepared.clinicalDomains.filter((domain) => queryClinicalDomainSet.has(normalizeText(domain)));
      const populationHits = (prepared.source.populationTags || []).filter((tag) => queryPopulationTags.includes(tag));
      const numericHits = findNumericSignalHits(numericSignals, prepared);
      const intentCategoryBoost = intents.some((intent) => (categoryMap[intent.type] || []).includes(prepared.category)) || routeCategories.has(prepared.category) ? 10 : 0;
      const primaryCategoryBoost = primaryCategories.has(prepared.category) ? 8 : 0;
      const urgentBoost = risk.level && risk.level !== "LOW" && /urgent|safety/i.test(prepared.category) ? 14 : 0;
      const exactTitleBoost = queryText && prepared.titleText.includes(queryText) ? 18 : 0;
      const phraseScore = phraseHits.length * 9;
      const tokenScore = tokenHits.length * 4;
      const familyScore = familyHits.length * 5;
      const entityScore = entityHits.length * 7;
      const focusScore = focusTagHits.length * 12;
      const supportScore = focusTagHits.length ? 0 : Math.min(supportTagHits.length * 3, 6);
      const domainScore = domainHits.length * (focusTagHits.length ? 8 : strictFocus ? 3 : 6);
      const populationScore = populationHits.length * 6;
      const numericScore = numericHits.length * 6;
      const qualityBoost = clamp(Math.round(Number(prepared.source.qualityScore || 0) / 12), 0, 8);
      const semanticScore = Math.round(cosine * 58);
      const offFocusPenalty = strictFocus && !focusTagHits.length
        ? domainHits.length
          ? 4
          : risk.level && risk.level !== "LOW"
            ? 4
            : 8
        : 0;
      const broadRouteBoost = intentCategoryBoost + primaryCategoryBoost;
      const routeAlignmentBoost = focusTagHits.length
        ? broadRouteBoost
        : strictFocus
          ? Math.round(broadRouteBoost * 0.25)
          : broadRouteBoost;
      const relevance = clamp(
        semanticScore +
          phraseScore +
          tokenScore +
          familyScore +
          entityScore +
          focusScore +
          supportScore +
          domainScore +
          populationScore +
          numericScore +
          qualityBoost +
          routeAlignmentBoost +
          urgentBoost +
          exactTitleBoost -
          offFocusPenalty,
        0,
        99
      );

      return {
        ...prepared.source,
        relevance,
        matchedTerms: dedupe([...phraseHits, ...tokenHits, ...entityHits.map((entity) => entity.label), ...numericHits]).slice(0, 8),
        semanticFamilies: familyHits.map((family) => family.label),
        medicalEntities: entityHits.map((entity) => entity.label),
        routeTagHits: focusTagHits,
        clinicalDomainHits: domainHits,
        populationMatches: populationHits,
        numericSignals: numericHits,
        evidenceGrade: relevance >= 82 ? "strong" : relevance >= 64 ? "good" : relevance >= 42 ? "supporting" : "weak",
        localModelScore: {
          semantic: semanticScore,
          phrases: phraseScore,
          tokens: tokenScore,
          family: familyScore,
          entity: entityScore,
          focus: focusScore,
          support: supportScore,
          domain: domainScore,
          population: populationScore,
          numeric: numericScore,
          quality: qualityBoost,
          route: routeAlignmentBoost,
          safety: urgentBoost,
          penalty: offFocusPenalty
        }
      };
    })
    .filter((record) => record.relevance > 0)
    .sort((left, right) =>
      (right.relevance - left.relevance)
      || ((right.routeTagHits?.length || 0) - (left.routeTagHits?.length || 0))
      || ((right.clinicalDomainHits?.length || 0) - (left.clinicalDomainHits?.length || 0))
      || ((right.populationMatches?.length || 0) - (left.populationMatches?.length || 0))
      || ((right.medicalEntities?.length || 0) - (left.medicalEntities?.length || 0))
      || (Number(right.qualityScore || 0) - Number(left.qualityScore || 0))
      || left.title.localeCompare(right.title)
    );

  const matches = ranked.slice(0, maxMatches);
  const coverageScore = matches.length
    ? clamp(Math.round(matches.reduce((total, item) => total + item.relevance, 0) / matches.length) + Math.min(matches.length * 5, 18), 35, 99)
    : 35;

  const result = {
    id: "LOCAL_CLINICAL_ML_RANKER",
    version: LOCAL_AI_CORE_VERSION,
    mode: "offline-tfidf-entity-semantic-route-ranker",
    queryFamilies: queryFamilies.map((family) => family.label),
    queryFocusTags,
    queryClinicalDomains,
    queryEntities: queryEntities.map((entity) => entity.label),
    queryPopulationTags,
    numericSignals,
    queryTokenCount: baseQueryTokens.length,
    expandedQueryTokenCount: queryTokens.length,
    synonymExpansions: queryExpansion.expandedFrom,
    corpusSize: records.length,
    cacheHit: corpusCacheHit,
    corpusCacheHit,
    queryCacheHit: false,
    coverageScore,
    matches,
      runtime: getLocalAiRuntimeStatus(),
    scoring: {
      method: "local lexical vector similarity + phrase match + synonym expansion + medical entity alignment + population-context alignment + numeric vital/lab signal matching + semantic family match + route boost + urgent-safety boost",
      internetRequired: false,
      sameOnlineOfflineEngine: true,
      patientDataTraining: false
    }
  };

  rankedQueryCache.set(queryCacheKey, {
    ...result,
    runtime: null
  });
  pruneRankedQueryCache();

  return result;
}

function getPreparedCorpus(records = []) {
  const referenceCached = preparedCorpusByReference.get(records);

  if (referenceCached) {
    return {
      ...referenceCached,
      cacheHit: true
    };
  }

  const signature = buildCorpusSignature(records);
  const signatureCached = preparedCorpusBySignature.get(signature);

  if (signatureCached) {
    preparedCorpusByReference.set(records, signatureCached);
    return {
      ...signatureCached,
      cacheHit: true
    };
  }

  const preparedRecords = records.map((record) => prepareRecord(record));
  const corpusStats = buildCorpusStats(preparedRecords);
  const preparedCorpus = {
    preparedRecords,
    corpusStats,
    signature
  };

  preparedCorpusByReference.set(records, preparedCorpus);
  preparedCorpusBySignature.set(signature, preparedCorpus);
  prunePreparedCorpusCache();

  return {
    ...preparedCorpus,
    cacheHit: false
  };
}

function buildCorpusSignature(records = []) {
  return records
    .map((record) => [
      cleanText(record?.id),
      cleanText(record?.title),
      cleanText(record?.category),
      cleanText(record?.contentType),
      Array.isArray(record?.keywords) ? record.keywords.map(cleanText).join(",") : "",
      Array.isArray(record?.aliases) ? record.aliases.map(cleanText).join(",") : "",
      Array.isArray(record?.relatedTerms) ? record.relatedTerms.map(cleanText).join(",") : "",
      Array.isArray(record?.routeTags) ? record.routeTags.map(cleanText).join(",") : "",
      Array.isArray(record?.clinicalDomains) ? record.clinicalDomains.map(cleanText).join(",") : "",
      Array.isArray(record?.populationTags) ? record.populationTags.map(cleanText).join(",") : "",
      cleanText(record?.summary),
      cleanText(record?.safetyNotes),
      Array.isArray(record?.whatToTrack) ? record.whatToTrack.map(cleanText).join(",") : "",
      Array.isArray(record?.careQuestions) ? record.careQuestions.map(cleanText).join(",") : "",
      Array.isArray(record?.precautions) ? record.precautions.map(cleanText).join(",") : "",
      Array.isArray(record?.redFlagTerms) ? record.redFlagTerms.map(cleanText).join(",") : "",
      Array.isArray(record?.queryPrompts) ? record.queryPrompts.map(cleanText).join(",") : "",
      Array.isArray(record?.sourceReferences) ? record.sourceReferences.map(cleanText).join(",") : "",
      Array.isArray(record?.maintenanceTags) ? record.maintenanceTags.map(cleanText).join(",") : "",
      Array.isArray(record?.evidenceSignals) ? record.evidenceSignals.map(cleanText).join(",") : "",
      cleanText(record?.qualityScore),
      cleanText(record?.sections?.overview),
      Array.isArray(record?.sections?.whatToTrack) ? record.sections.whatToTrack.map(cleanText).join(",") : "",
      Array.isArray(record?.sections?.careQuestions) ? record.sections.careQuestions.map(cleanText).join(",") : "",
      Array.isArray(record?.sections?.precautions) ? record.sections.precautions.map(cleanText).join(",") : "",
      Array.isArray(record?.sections?.sourceReferences) ? record.sections.sourceReferences.map(cleanText).join(",") : "",
      cleanText(record?.source),
      cleanText(record?.sourceFamily),
      cleanText(record?.evidenceLevel),
      cleanText(record?.verificationStatus),
      cleanText(record?.retrievalText)
    ].join("\u001f"))
    .join("\u001e");
}

function buildRankedQueryCacheKey({ signature, queryText, intents, risk, routeCategories, primaryCategories, maxMatches }) {
  const intentSignature = [...(intents || [])]
    .map((intent) => [
      cleanText(intent?.type),
      cleanText(intent?.route),
      Math.round(Number(intent?.confidence || 0) * 100)
    ].join(":"))
    .sort()
    .join("|");

  return [
    signature,
    queryText,
    cleanText(risk?.level || "LOW"),
    Array.from(routeCategories || []).map(cleanText).sort().join("|"),
    Array.from(primaryCategories || []).map(cleanText).sort().join("|"),
    intentSignature,
    cleanText(maxMatches)
  ].join("\u001d");
}

function touchRankedQueryCacheEntry(key, value) {
  rankedQueryCache.delete(key);
  rankedQueryCache.set(key, value);
}

function prunePreparedCorpusCache() {
  while (preparedCorpusBySignature.size > maxCorpusCacheEntries) {
    const oldestKey = preparedCorpusBySignature.keys().next().value;
    preparedCorpusBySignature.delete(oldestKey);
  }
}

function pruneRankedQueryCache() {
  while (rankedQueryCache.size > maxRankedQueryCacheEntries) {
    const oldestKey = rankedQueryCache.keys().next().value;
    rankedQueryCache.delete(oldestKey);
  }
}

function prepareRecord(record = {}) {
  const title = cleanText(record.title);
  const category = cleanText(record.category);
  const contentType = cleanText(record.contentType);
  const keywords = Array.isArray(record.keywords) ? record.keywords.map(cleanText).filter(Boolean) : [];
  const aliases = Array.isArray(record.aliases) ? record.aliases.map(cleanText).filter(Boolean) : [];
  const relatedTerms = Array.isArray(record.relatedTerms) ? record.relatedTerms.map(cleanText).filter(Boolean) : [];
  const routeTags = Array.isArray(record.routeTags) ? record.routeTags.map(cleanText).filter(Boolean) : [];
  const clinicalDomains = Array.isArray(record.clinicalDomains) ? record.clinicalDomains.map(cleanText).filter(Boolean) : [];
  const populationTags = Array.isArray(record.populationTags) ? record.populationTags.map(cleanText).filter(Boolean) : [];
  const summary = cleanText(record.summary);
  const safetyNotes = cleanText(record.safetyNotes);
  const whatToTrack = Array.isArray(record.whatToTrack) ? record.whatToTrack.map(cleanText).filter(Boolean) : [];
  const careQuestions = Array.isArray(record.careQuestions) ? record.careQuestions.map(cleanText).filter(Boolean) : [];
  const precautions = Array.isArray(record.precautions) ? record.precautions.map(cleanText).filter(Boolean) : [];
  const redFlagTerms = Array.isArray(record.redFlagTerms) ? record.redFlagTerms.map(cleanText).filter(Boolean) : [];
  const queryPrompts = Array.isArray(record.queryPrompts) ? record.queryPrompts.map(cleanText).filter(Boolean) : [];
  const sourceReferences = Array.isArray(record.sourceReferences) ? record.sourceReferences.map(cleanText).filter(Boolean) : [];
  const maintenanceTags = Array.isArray(record.maintenanceTags) ? record.maintenanceTags.map(cleanText).filter(Boolean) : [];
  const evidenceSignals = Array.isArray(record.evidenceSignals) ? record.evidenceSignals.map(cleanText).filter(Boolean) : [];
  const qualityScore = Number.isFinite(Number(record.qualityScore)) ? Number(record.qualityScore) : 0;
  const sectionOverview = cleanText(record.sections?.overview);
  const sectionTracking = Array.isArray(record.sections?.whatToTrack) ? record.sections.whatToTrack.map(cleanText).filter(Boolean) : [];
  const sectionQuestions = Array.isArray(record.sections?.careQuestions) ? record.sections.careQuestions.map(cleanText).filter(Boolean) : [];
  const sectionPrecautions = Array.isArray(record.sections?.precautions) ? record.sections.precautions.map(cleanText).filter(Boolean) : [];
  const sectionSources = Array.isArray(record.sections?.sourceReferences) ? record.sections.sourceReferences.map(cleanText).filter(Boolean) : [];
  const retrievalText = cleanText(record.retrievalText);
  const sourceFamily = cleanText(record.sourceFamily);
  const evidenceLevel = cleanText(record.evidenceLevel);
  const verificationStatus = cleanText(record.verificationStatus);
  const source = {
    ...record,
    title,
    category,
    contentType,
    keywords,
    aliases,
    relatedTerms,
    routeTags,
    clinicalDomains,
    populationTags,
    summary,
    safetyNotes,
    whatToTrack,
    careQuestions,
    precautions,
    redFlagTerms,
    queryPrompts,
    sourceReferences,
    maintenanceTags,
    evidenceSignals,
    qualityScore,
    sections: {
      overview: sectionOverview,
      whatToTrack: sectionTracking,
      careQuestions: sectionQuestions,
      precautions: sectionPrecautions,
      sourceReferences: sectionSources
    },
    retrievalText,
    sourceFamily,
    evidenceLevel,
    verificationStatus
  };
  const text = normalizeText([
    title,
    category,
    contentType,
    keywords.join(" "),
    aliases.join(" "),
    relatedTerms.join(" "),
    routeTags.join(" "),
    clinicalDomains.join(" "),
    populationTags.join(" "),
    summary,
    safetyNotes,
    whatToTrack.join(" "),
    careQuestions.join(" "),
    precautions.join(" "),
    redFlagTerms.join(" "),
    queryPrompts.join(" "),
    sourceReferences.join(" "),
    maintenanceTags.join(" "),
    evidenceSignals.join(" "),
    String(qualityScore),
    sectionOverview,
    sectionTracking.join(" "),
    sectionQuestions.join(" "),
    sectionPrecautions.join(" "),
    sectionSources.join(" "),
    record.source,
    sourceFamily,
    evidenceLevel,
    verificationStatus,
    retrievalText
  ].join(" "));
  const tokens = tokenize(text);
  const keywordTokens = dedupe([...keywords, ...aliases, ...relatedTerms, ...routeTags, ...clinicalDomains, ...redFlagTerms, ...sourceReferences, ...maintenanceTags, ...evidenceSignals].flatMap(tokenize));

  return {
    source,
    titleText: normalizeText(title),
    category,
    routeTags,
    routeTagSet: new Set(routeTags.map(normalizeText)),
    clinicalDomains,
    clinicalDomainSet: new Set(clinicalDomains.map(normalizeText)),
    text,
    tokens,
    tokenSet: new Set(tokens),
    vector: null,
    keywordPhrases: keywords.map(normalizeText).filter((keyword) => keyword.includes(" ")),
    keywordTokens,
    keywordTokenSet: new Set(keywordTokens),
    semanticFamilies: matchSemanticFamilies(tokens)
  };
}

function buildCorpusStats(records) {
  const documentFrequency = new Map();

  for (const record of records) {
    const uniqueTerms = new Set(record.tokens);
    for (const term of uniqueTerms) {
      documentFrequency.set(term, (documentFrequency.get(term) || 0) + 1);
    }
  }

  const idf = new Map();
  const totalDocuments = Math.max(records.length, 1);

  for (const [term, count] of documentFrequency) {
    idf.set(term, Math.log((totalDocuments + 1) / (count + 1)) + 1);
  }

  for (const record of records) {
    record.vector = buildVector(record.tokens, idf);
  }

  return { idf };
}

function buildVector(tokens, idf) {
  const counts = new Map();
  for (const token of tokens) {
    counts.set(token, (counts.get(token) || 0) + 1);
  }

  const vector = new Map();
  const length = Math.max(tokens.length, 1);

  for (const [token, count] of counts) {
    vector.set(token, (count / length) * (idf.get(token) || 1));
  }

  return vector;
}

function cosineSimilarity(left, right) {
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (const value of left.values()) {
    leftMagnitude += value * value;
  }

  for (const value of right.values()) {
    rightMagnitude += value * value;
  }

  for (const [term, value] of left) {
    dot += value * (right.get(term) || 0);
  }

  if (!leftMagnitude || !rightMagnitude) {
    return 0;
  }

  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

function findPhraseHits(queryText, phrases) {
  return phrases.filter((phrase) => phrase && queryText.includes(phrase));
}

function findTokenHits(queryTokens, keywordTokens) {
  const querySet = new Set(queryTokens);
  return keywordTokens.filter((token) => querySet.has(token));
}

function matchSemanticFamilies(tokens) {
  const tokenSet = new Set(tokens);
  return semanticFamilies.filter((family) => family.terms.some((term) => tokenSet.has(term)));
}

function expandQueryTokens(tokens, queryText) {
  const tokenSet = new Set(tokens);
  const expandedFrom = [];

  for (const group of medicalEntityGroups) {
    const matched = group.triggers.some((trigger) => {
      const normalizedTrigger = normalizeText(trigger);
      return normalizedTrigger.includes(" ")
        ? queryText.includes(normalizedTrigger)
        : tokenSet.has(normalizedTrigger);
    });

    if (!matched) {
      continue;
    }

    expandedFrom.push(group.label);
    for (const token of group.expansions.flatMap(tokenize)) {
      tokenSet.add(token);
    }
  }

  return {
    tokens: Array.from(tokenSet),
    expandedFrom
  };
}

function detectMedicalQueryEntities(queryText, queryTokens) {
  const tokenSet = new Set(queryTokens);

  return medicalEntityGroups
    .map((group) => {
      const matchedTriggers = group.triggers.filter((trigger) => {
        const normalizedTrigger = normalizeText(trigger);
        return normalizedTrigger.includes(" ")
          ? queryText.includes(normalizedTrigger)
          : tokenSet.has(normalizedTrigger);
      });

      return matchedTriggers.length
        ? {
          id: group.id,
          label: group.label,
          categories: group.categories,
          terms: dedupe([...matchedTriggers, ...group.expansions.flatMap(tokenize)])
        }
        : null;
    })
    .filter(Boolean);
}

function findEntityHits(queryEntities, prepared) {
  return queryEntities.filter((entity) => {
    const categoryHit = entity.categories.some((category) =>
      category === prepared.category || prepared.routeTagSet.has(normalizeText(category))
    );
    const tokenHit = entity.terms.some((term) => prepared.tokenSet.has(term) || prepared.keywordTokenSet.has(term));

    return categoryHit || tokenHit;
  });
}

function deriveIntentFocusTags({ intents = [], routeCategories = new Set(), primaryCategories = new Set(), risk = {} }) {
  const focusTags = intents.flatMap((intent) => intentFocusTagsByIntent[intent.type] || []);

  if (!focusTags.length) {
    if (risk.level && risk.level !== "LOW") {
      focusTags.push("Urgent Safety");
    } else {
      for (const tag of [...primaryCategories, ...routeCategories]) {
        if (["Specialist", "Labs", "Medication", "Vitals", "Lifestyle", "Records", "Care Transitions", "Insurance"].includes(tag)) {
          focusTags.push(tag);
        }
      }
    }
  }

  return dedupe(focusTags.map(cleanText).filter(Boolean));
}

function detectClinicalQueryDomains(queryText, queryTokens) {
  const tokenSet = new Set(queryTokens);

  return clinicalDomainSignals
    .filter((domain) => domain.terms.some((term) => {
      const normalized = normalizeText(term);
      return normalized.includes(" ")
        ? queryText.includes(normalized)
        : tokenSet.has(normalized);
    }))
    .map((domain) => domain.id);
}

function detectNumericClinicalSignals(queryText) {
  const signals = [];

  if (/\b\d{2,3}\s*\/\s*\d{2,3}\b/.test(queryText) || /\bbp\b|\bblood pressure\b/.test(queryText)) {
    signals.push("blood pressure reading");
  }

  if (/\b(?:sugar|glucose|blood sugar|hba1c|a1c)\b/.test(queryText)) {
    signals.push("glucose or diabetes marker");
  }

  if (/\b(?:pulse|heart rate|hr)\b/.test(queryText)) {
    signals.push("heart rate reading");
  }

  if (/\b(?:oxygen|spo2|o2)\b/.test(queryText)) {
    signals.push("oxygen saturation reading");
  }

  if (/\b(?:temperature|temp|fever)\b/.test(queryText)) {
    signals.push("temperature reading");
  }

  if (/\b(?:bmi|weight|height|waist)\b/.test(queryText)) {
    signals.push("body composition metric");
  }

  if (/\b(?:ldl|hdl|cholesterol|creatinine|egfr|tsh|hemoglobin|platelet|wbc|alt|ast|bilirubin|potassium|sodium)\b/.test(queryText)) {
    signals.push("lab value marker");
  }

  return dedupe(signals);
}

function detectPopulationContext(queryText) {
  const signals = [];

  if (/\b(child|infant|baby|pediatric|newborn|toddler)\b/.test(queryText)) {
    signals.push("pediatric");
  }

  if (/\b(pregnan\w*|postpartum|maternal|fetal|baby movement)\b/.test(queryText)) {
    signals.push("maternal");
  }

  if (/\b(older adult|elderly|geriatric|frail|walker|balance issue)\b/.test(queryText)) {
    signals.push("older-adult");
  }

  if (/\b(cancer|oncology|chemo|chemotherapy|immune suppression)\b/.test(queryText)) {
    signals.push("oncology");
  }

  if (/\b(travel|airport|flight|mosquito|food safety abroad|international trip)\b/.test(queryText)) {
    signals.push("travel-health");
  }

  if (/\b(caregiver|caregiver support|family support|care partner)\b/.test(queryText)) {
    signals.push("caregiver-support");
  }

  if (/\b(chronic|follow up|monitoring|baseline|long-term)\b/.test(queryText)) {
    signals.push("longitudinal-care");
  }

  return dedupe(signals);
}

function findNumericSignalHits(numericSignals, prepared) {
  if (!numericSignals.length) {
    return [];
  }

  return numericSignals.filter((signal) => {
    const routeTags = prepared.routeTagSet;

    if (/blood pressure|heart rate|oxygen|temperature|body composition/.test(signal)) {
      return ["Vitals", "Urgent Safety", "General"].some((tag) => routeTags.has(normalizeText(tag)) || prepared.category === tag);
    }

    if (/glucose|diabetes|lab value/.test(signal)) {
      return ["Vitals", "Labs", "Medication", "General"].some((tag) => routeTags.has(normalizeText(tag)) || prepared.category === tag);
    }

    return false;
  });
}

function tokenize(value) {
  return normalizeText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !stopWords.has(token));
}

function normalizeText(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9/%.\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function dedupe(items = []) {
  return Array.from(new Set(items.filter(Boolean)));
}

function readBoolean(value) {
  return /^(1|true|yes|on)$/i.test(cleanText(value));
}

function readBooleanDefault(value, defaultValue = false) {
  const cleaned = cleanText(value);
  if (!cleaned) {
    return defaultValue;
  }
  return /^(1|true|yes|on)$/i.test(cleaned);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}
