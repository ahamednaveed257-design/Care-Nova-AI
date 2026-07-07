import { evaluateFinalResponseGuardrails } from "./healthEngine.js";
import { getConnectivityPolicy, isEndpointUsableForThisRun, isLocalEndpoint } from "./runtimeConnectivity.js";

const DEFAULT_OPENAI_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_TIMEOUT_MS = 12000;

export function getTemporaryCloudLlmStatus(env = process.env) {
  const provider = cleanText(env.CARE_NOVA_TEMP_CLOUD_PROVIDER || (readBoolean(env.CARE_NOVA_OPENAI_ENABLED) ? "openai" : "openai-compatible")) || "openai-compatible";
  const paidCloudAllowed = readBoolean(env.CARE_NOVA_PAID_MODELS_ENABLED) || readBoolean(env.CARE_NOVA_CLOUD_MODELS_ENABLED);
  const explicitRewriteEnabled = readBoolean(env.CARE_NOVA_TEMP_CLOUD_RESPONSE_ENABLED);
  const providerEnabled = readBoolean(env.CARE_NOVA_OPENAI_ENABLED) && paidCloudAllowed;
  const requested = explicitRewriteEnabled || providerEnabled;
  const apiKey = cleanText(env.CARE_NOVA_TEMP_CLOUD_API_KEY || env.OPENAI_API_KEY);
  const model = cleanText(env.CARE_NOVA_TEMP_CLOUD_MODEL || env.OPENAI_MODEL || "gpt-5.4");
  const endpoint = normalizeChatCompletionsEndpoint(
    env.CARE_NOVA_TEMP_CLOUD_API_URL
      || env.OPENAI_BASE_URL
      || (provider === "openai" || provider === "openai-compatible" ? DEFAULT_OPENAI_CHAT_COMPLETIONS_URL : "")
  );
  const connectivity = getConnectivityPolicy(env);
  const endpointIsLocal = Boolean(endpoint) && isLocalEndpoint(endpoint);
  const policyBlocked = requested && Boolean(endpoint) && !isEndpointUsableForThisRun(endpoint, env, { connectivity });
  const enabled = requested && !policyBlocked;
  const timeoutMs = clampInteger(env.CARE_NOVA_TEMP_CLOUD_TIMEOUT_MS, 2000, 30000, DEFAULT_TIMEOUT_MS);
  const keyRequired = Boolean(endpoint) && !endpointIsLocal;
  const configured = enabled && Boolean(model) && Boolean(endpoint) && (!keyRequired || Boolean(apiKey));
  const reason = !requested
    ? "Temporary cloud rewrite is disabled."
    : policyBlocked
      ? connectivity.forceOffline
        ? "Temporary cloud rewrite is configured but blocked by offline policy."
        : "Temporary cloud rewrite is configured but internet is unavailable."
      : keyRequired && !apiKey
        ? "API key is missing for the remote provider."
        : !model
          ? "Model is missing."
          : !endpoint
            ? "Endpoint is missing."
            : endpointIsLocal
              ? explicitRewriteEnabled
                ? "Temporary cloud rewrite is ready on a local OpenAI-compatible endpoint."
                : "OpenAI cloud second pass is ready on a local OpenAI-compatible endpoint."
              : explicitRewriteEnabled
                ? "Temporary cloud rewrite is ready."
                : "OpenAI cloud second pass is ready when the router selects a cloud or hybrid path.";

  return {
    enabled,
    requested,
    providerEnabled,
    explicitRewriteEnabled,
    configured,
    policyBlocked,
    provider,
    model,
    endpoint,
    endpointIsLocal,
    endpointHost: endpoint ? safeHost(endpoint) : "",
    timeoutMs,
    status: !enabled
      ? policyBlocked
        ? "offline-policy-blocked"
        : "disabled"
      : configured
        ? "ready"
        : "missing-configuration",
    connectivity: {
      forceOffline: connectivity.forceOffline,
      internetAvailable: connectivity.internetAvailable
    },
    activationPolicy: explicitRewriteEnabled
      ? "always-on-final-rewrite"
      : providerEnabled
        ? "router-driven-cloud-second-pass"
        : "disabled",
    usesDeidentifiedResponseOnly: true,
    fallback: "default-local-final-response",
    reason
  };
}

export async function tryEnhanceAnalyzeResultWithCloudLlm({ payload = {}, result = {}, env = process.env } = {}) {
  const status = getTemporaryCloudLlmStatus(env);
  const executionPlan = buildCloudExecutionPlan({ status, result });
  const execution = {
    ...status,
    ...executionPlan,
    attempted: false,
    applied: false,
    fallbackUsed: true,
    actualProcessingType: "local",
    actualGeneratedUsing: "Local Model",
    error: ""
  };

  reconcileActualExecution(result, execution);

  if (!status.enabled || !status.configured || !result?.finalResponse || !execution.requestedForThisRun) {
    return execution;
  }

  execution.attempted = true;

  try {
    const cloudDraft = await requestCloudAssist({ payload, result, status, execution, env });
    const merged = mergeCloudDraftIntoResult({ result, draft: cloudDraft, status, execution });
    const guardrails = evaluateFinalResponseGuardrails(merged.finalResponse);

    if (!guardrails.passed) {
      throw new Error("Cloud second pass failed local safety guardrails.");
    }

    result.finalResponse = merged.finalResponse;
    result.agentResults = merged.agentResults;
    result.guardrails = guardrails;
    execution.applied = true;
    execution.fallbackUsed = false;
    execution.actualProcessingType = "hybrid";
    execution.actualGeneratedUsing = "Hybrid Processing";
    reconcileActualExecution(result, execution);
    return execution;
  } catch (error) {
    execution.error = cleanText(error.message).slice(0, 240);
    reconcileActualExecution(result, execution);

    if (result?.finalResponse) {
      result.finalResponse = {
        ...result.finalResponse,
        processingMode: "Local Model",
        cloudLlm: {
          enabled: true,
          attempted: true,
          applied: false,
          provider: status.provider,
          model: status.model,
          endpointHost: status.endpointHost,
          engagementMode: execution.engagementMode,
          requestedForThisRun: execution.requestedForThisRun,
          fallbackUsed: true,
          error: execution.error,
          usesDeidentifiedResponseOnly: status.usesDeidentifiedResponseOnly
        }
      };
    }

    return execution;
  }
}

function buildCloudExecutionPlan({ status = {}, result = {} } = {}) {
  const plannedProcessingType = cleanText(result?.modelRouting?.processingType || "local").toLowerCase() || "local";
  const plannedPrimary = result?.modelRouting?.selectedModel?.primary || null;
  const plannedPrimaryType = cleanText(plannedPrimary?.type).toLowerCase();
  const plannedPrimaryId = cleanText(plannedPrimary?.id).toLowerCase();
  const plannedPrimaryModelName = cleanText(plannedPrimary?.displayName || plannedPrimary?.model || "");
  const plannedByRouter = plannedPrimaryType === "cloud" && (plannedProcessingType === "cloud" || plannedProcessingType === "hybrid");
  const gatewayMatchesPlan = !plannedByRouter
    || plannedPrimaryId === "openai"
    || plannedPrimaryId === "azure-openai"
    || /openai/i.test(cleanText(status.provider));
  const requestedForThisRun = Boolean(status.explicitRewriteEnabled || (plannedByRouter && gatewayMatchesPlan));
  const engagementMode = plannedByRouter && gatewayMatchesPlan
    ? "route-aware-clinical-second-pass"
    : "final-response-rewrite";
  const skipReason = requestedForThisRun
    ? ""
    : plannedByRouter && !gatewayMatchesPlan
      ? "A non-OpenAI cloud provider was selected for this request, so the OpenAI gateway stayed idle."
      : "OpenAI cloud path is ready but this request stayed on the local route.";

  return {
    engagementMode,
    plannedByRouter,
    plannedProcessingType,
    plannedPrimaryModelId: plannedPrimaryId,
    plannedPrimaryModelName,
    requestedForThisRun,
    skipReason
  };
}

async function requestCloudAssist({ payload, result, status, execution, env }) {
  const request = buildCloudRequest({ payload, result, execution });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), status.timeoutMs);

  try {
    const response = await fetch(status.endpoint, {
      method: "POST",
      headers: buildHeaders(status, env),
      body: JSON.stringify({
        model: status.model,
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        messages: request.messages
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Cloud LLM returned ${response.status}.`);
    }

    const json = await response.json();
    const text = extractResponseText(json);

    if (!text) {
      throw new Error("Cloud LLM returned an empty response.");
    }

    const parsed = parseJsonObject(text);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Cloud LLM did not return valid JSON.");
    }

    return parsed;
  } finally {
    clearTimeout(timer);
  }
}

function buildCloudRequest({ payload = {}, result = {}, execution = {} } = {}) {
  return execution.engagementMode === "route-aware-clinical-second-pass"
    ? {
      temperature: 0.15,
      maxTokens: 520,
      messages: buildRouteAwareMessages({ payload, result })
    }
    : {
      temperature: 0.2,
      maxTokens: 380,
      messages: buildRewriteMessages({ payload, result })
    };
}

function buildRewriteMessages({ payload = {}, result = {} }) {
  const finalResponse = result.finalResponse || {};
  const packet = {
    route: cleanText(finalResponse?.responseFocus?.primaryRoute || result?.plan?.responseOwner?.route || "RAG_AGENT"),
    risk: cleanText(result?.risk?.label || result?.risk?.level || "LOW"),
    answerMode: cleanText(result?.requirementProfile?.answerMode?.id || finalResponse?.responseFocus?.requirement?.answerMode || "quick"),
    localTitle: cleanText(finalResponse.title).slice(0, 140),
    localSummary: cleanText(finalResponse.summary).slice(0, 500),
    localSteps: Array.isArray(finalResponse.whatToDoNow) ? finalResponse.whatToDoNow.map((item) => cleanText(item).slice(0, 220)).filter(Boolean).slice(0, 4) : [],
    localWarnings: Array.isArray(finalResponse.warningSigns) ? finalResponse.warningSigns.map((item) => cleanText(item).slice(0, 220)).filter(Boolean).slice(0, 4) : [],
    disclaimer: cleanText(finalResponse.disclaimer).slice(0, 220),
    agentSummary: cleanText(finalResponse.agentSummary).slice(0, 700)
  };

  return [
    {
      role: "system",
      content: [
        "You rewrite a healthcare support response for clarity only.",
        "Use only the facts in the provided JSON.",
        "Do not add diagnoses, prescriptions, dosages, or new medical claims.",
        "Preserve urgency and safety wording.",
        "Return strict JSON with keys: title, summary, whatToDoNow, warningSigns."
      ].join(" ")
    },
    {
      role: "user",
      content: `Rewrite this local response in the same meaning with shorter, cleaner wording.\n${JSON.stringify(packet)}`
    }
  ];
}

function buildRouteAwareMessages({ payload = {}, result = {} }) {
  const finalResponse = result.finalResponse || {};
  const primaryRoute = cleanText(finalResponse?.responseFocus?.primaryRoute || result?.plan?.responseOwner?.route || "RAG_AGENT");
  const primaryAgent = Array.isArray(result.agentResults)
    ? result.agentResults.find((agent) => agent.id === primaryRoute) || result.agentResults[0]
    : null;
  const profile = result.memoryContext?.profile || payload.profile || {};
  const latestVitals = result.memoryContext?.latestVitals || payload.vitals || {};
  const evidence = Array.isArray(result.medicalKnowledge?.matches)
    ? result.medicalKnowledge.matches.slice(0, 5).map((match) => ({
      title: cleanText(match.title).slice(0, 120),
      category: cleanText(match.category).slice(0, 60),
      summary: cleanText(match.summary).slice(0, 240),
      safetyNotes: cleanText(match.safetyNotes).slice(0, 180),
      relevance: Number(match.relevance || 0)
    }))
    : [];
  const packet = {
    route: primaryRoute,
    risk: cleanText(result?.risk?.label || result?.risk?.level || "LOW"),
    answerMode: cleanText(result?.requirementProfile?.answerMode?.id || finalResponse?.responseFocus?.requirement?.answerMode || "quick"),
    message: cleanText(payload.message || "").slice(0, 320),
    context: {
      vitals: normalizeVitalsPacket(latestVitals),
      profile: {
        age: cleanText(profile.age).slice(0, 24),
        gender: cleanText(profile.gender).slice(0, 40),
        conditions: normalizeStringList(toArray(profile.conditions), 4, 80),
        medications: normalizeStringList(toArray(profile.medications), 4, 80),
        allergies: normalizeStringList(toArray(profile.allergies), 4, 80)
      },
      memory: {
        recentTurns: Number(result.memoryContext?.recentTurnCount || 0),
        recentRisks: normalizeStringList(result.memoryContext?.recentRisks, 3, 40),
        recentMessages: normalizeStringList(result.memoryContext?.recentMessages, 2, 120)
      }
    },
    evidence,
    primaryAgent: primaryAgent
      ? {
        id: primaryAgent.id,
        name: cleanText(primaryAgent.name),
        summary: cleanText(primaryAgent.output?.summary || "").slice(0, 360),
        patientAnswerSummary: cleanText(primaryAgent.output?.patientAnswerSummary || "").slice(0, 260),
        checklist: normalizeStringList(primaryAgent.output?.checklist, 4, 180),
        missing: normalizeStringList(primaryAgent.output?.missing || primaryAgent.output?.missingContext, 3, 160)
      }
      : null,
    localAnswer: {
      title: cleanText(finalResponse.title).slice(0, 140),
      summary: cleanText(finalResponse.summary).slice(0, 520),
      steps: normalizeStringList(finalResponse.whatToDoNow, 4, 220),
      warnings: normalizeStringList(finalResponse.warningSigns, 4, 220),
      disclaimer: cleanText(finalResponse.disclaimer).slice(0, 220)
    }
  };

  return [
    {
      role: "system",
      content: [
        "You are the paid cloud reasoning layer for a local-first healthcare support system.",
        "Improve the grounded local answer only from the supplied JSON packet.",
        "Do not add diagnoses, prescriptions, dosages, new medical claims, or emergency actions.",
        "Preserve urgent safety wording, uncertainty, and local evidence boundaries.",
        "Return strict JSON with keys:",
        "title, summary, whatToDoNow, warningSigns, doctorQuestion, evidenceFocus, confidenceLabel."
      ].join(" ")
    },
    {
      role: "user",
      content: `Strengthen this routed care answer without changing its medical boundary.\n${JSON.stringify(packet)}`
    }
  ];
}

function mergeCloudDraftIntoResult({ result = {}, draft = {}, status = {}, execution = {} } = {}) {
  const finalResponse = result.finalResponse || {};
  const engagementMode = execution.engagementMode || "final-response-rewrite";
  const title = cleanText(draft.title || draft.title_upgrade).slice(0, 140) || cleanText(finalResponse.title);
  const summary = cleanText(draft.summary || draft.summary_upgrade).slice(0, 520) || cleanText(finalResponse.summary);
  const stepItems = normalizeStringList(draft.whatToDoNow || draft.steps || draft.step_additions, 4, 220);
  const warningItems = normalizeStringList(draft.warningSigns || draft.watchFor || draft.redFlags || draft.warning_additions, 4, 220);
  const evidenceFocus = normalizeStringList(draft.evidenceFocus || draft.evidence_focus, 4, 180);
  const doctorQuestion = cleanText(draft.doctorQuestion || draft.doctor_question || draft.missing_question).slice(0, 220);
  const confidenceLabel = cleanText(draft.confidenceLabel || draft.confidence_label).slice(0, 80);
  const whatToDoNow = engagementMode === "route-aware-clinical-second-pass"
    ? dedupeItems([
      ...(Array.isArray(finalResponse.whatToDoNow) ? finalResponse.whatToDoNow : []),
      ...stepItems
    ]).slice(0, 5)
    : stepItems.length
      ? stepItems
      : (Array.isArray(finalResponse.whatToDoNow) ? finalResponse.whatToDoNow : []);
  const warningSigns = engagementMode === "route-aware-clinical-second-pass"
    ? dedupeItems([
      ...(Array.isArray(finalResponse.warningSigns) ? finalResponse.warningSigns : []),
      ...warningItems
    ]).slice(0, 5)
    : warningItems.length
      ? warningItems
      : (Array.isArray(finalResponse.warningSigns) ? finalResponse.warningSigns : []);
  const mergedFinalResponse = {
    ...finalResponse,
    title: title || finalResponse.title,
    summary: summary || finalResponse.summary,
    whatToDoNow,
    warningSigns,
    disclaimer: cleanText(finalResponse.disclaimer) || "This is not a diagnosis or prescription. Use a clinician for personal medical decisions.",
    processingMode: "Hybrid Processing",
    cloudLlm: {
      enabled: true,
      attempted: true,
      applied: true,
      provider: status.provider,
      model: status.model,
      endpointHost: status.endpointHost,
      engagementMode,
      requestedForThisRun: execution.requestedForThisRun,
      plannedByRouter: execution.plannedByRouter,
      evidenceFocus,
      doctorQuestion,
      confidenceLabel,
      usesDeidentifiedResponseOnly: status.usesDeidentifiedResponseOnly
    }
  };
  const primaryRoute = cleanText(finalResponse?.responseFocus?.primaryRoute || result?.plan?.responseOwner?.route || "");
  const mergedAgentResults = engagementMode === "route-aware-clinical-second-pass" && Array.isArray(result.agentResults)
    ? result.agentResults.map((agent) => {
      if (agent.id !== primaryRoute) {
        return agent;
      }

      const output = agent.output || {};
      return {
        ...agent,
        output: {
          ...output,
          summary: summary || output.summary,
          checklist: dedupeItems([
            ...(Array.isArray(output.checklist) ? output.checklist : []),
            ...stepItems
          ]).slice(0, 5),
          doctorQuestions: dedupeItems([
            ...(Array.isArray(output.doctorQuestions) ? output.doctorQuestions : []),
            doctorQuestion
          ]).slice(0, 6),
          cloudLlm: {
            applied: true,
            provider: status.provider,
            model: status.model,
            engagementMode,
            evidenceFocus,
            doctorQuestion,
            confidenceLabel
          }
        }
      };
    })
    : result.agentResults;

  return {
    finalResponse: mergedFinalResponse,
    agentResults: mergedAgentResults
  };
}

function reconcileActualExecution(result = {}, execution = {}) {
  const plannedModelRouting = result.modelRouting && typeof result.modelRouting === "object" ? result.modelRouting : null;
  const plannedPrimary = plannedModelRouting?.selectedModel?.plannedPrimary || plannedModelRouting?.selectedModel?.primary || null;
  const localFallback = plannedModelRouting?.selectedModel?.fallback;
  const localAssist = plannedModelRouting?.selectedModel?.assist;
  const localPrimary = (localAssist && localAssist.type === "local" ? localAssist : null)
    || (localFallback && localFallback.type === "local" ? localFallback : null)
    || {
      id: "care-nova-local-core",
      displayName: "Care Nova Local Clinical Core",
      type: "local",
      family: "deterministic-local",
      model: "offline-ranker-safety-engine",
      status: "ready",
      costTier: "free",
      performanceClass: "safe-deterministic",
      offlineCapable: true,
      internetRequired: false
    };
  const actualPrimary = execution.applied ? plannedPrimary || localPrimary : localPrimary;
  const actualProcessingType = execution.actualProcessingType || (execution.applied ? "hybrid" : "local");
  const actualGeneratedUsing = execution.actualGeneratedUsing || (execution.applied ? "Hybrid Processing" : "Local Model");

  result.processingMode = actualGeneratedUsing;

  if (result.finalResponse && typeof result.finalResponse === "object") {
    result.finalResponse.processingMode = actualGeneratedUsing;
  }

  if (!plannedModelRouting) {
    return;
  }

  const nextModelRouting = {
    ...plannedModelRouting,
    processingType: actualProcessingType,
    label: actualGeneratedUsing,
    generatedUsing: actualGeneratedUsing,
    selectedModel: {
      ...plannedModelRouting.selectedModel,
      primary: actualPrimary,
      plannedPrimary
    },
    failover: {
      ...plannedModelRouting.failover,
      fallbackTriggered: execution.applied
        ? false
        : execution.attempted
          ? execution.error || "temporary-cloud-fallback"
          : plannedModelRouting.failover?.fallbackTriggered || false
    },
    actualExecution: {
      processingType: actualProcessingType,
      generatedUsing: actualGeneratedUsing,
      engagementMode: execution.engagementMode || "",
      requestedCloudExecution: Boolean(execution.requestedForThisRun),
      plannedByRouter: Boolean(execution.plannedByRouter),
      attemptedCloudRewrite: Boolean(execution.attempted),
      cloudRewriteApplied: Boolean(execution.applied),
      fallbackUsed: execution.fallbackUsed !== false,
      provider: execution.provider || "",
      model: execution.model || "",
      endpointHost: execution.endpointHost || "",
      error: execution.error || "",
      skipReason: execution.skipReason || ""
    }
  };

  result.modelRouting = nextModelRouting;

  if (result.finalResponse && typeof result.finalResponse === "object") {
    result.finalResponse.modelRouting = nextModelRouting;
  }

  if (result.model && typeof result.model === "object") {
    result.model.actualExecution = nextModelRouting.actualExecution;
  }
}

function buildHeaders(status, env) {
  const apiKeyHeader = cleanText(env.CARE_NOVA_TEMP_CLOUD_API_KEY_HEADER);
  const authScheme = cleanText(env.CARE_NOVA_TEMP_CLOUD_API_AUTH_SCHEME || "Bearer");
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json; charset=utf-8"
  };
  const apiKey = cleanText(env.CARE_NOVA_TEMP_CLOUD_API_KEY || env.OPENAI_API_KEY);

  if (apiKey && apiKeyHeader) {
    headers[apiKeyHeader] = apiKey;
  } else if (apiKey) {
    headers.Authorization = `${authScheme} ${apiKey}`.trim();
  }

  return headers;
}

function extractResponseText(payload) {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  if (typeof payload.output_text === "string") {
    return payload.output_text;
  }

  const responseOutput = Array.isArray(payload.output) ? payload.output : [];

  for (const item of responseOutput) {
    const contentItems = Array.isArray(item?.content) ? item.content : [];
    const text = contentItems
      .map((entry) => cleanText(entry?.text || entry?.content || ""))
      .filter(Boolean)
      .join("\n");

    if (text) {
      return text;
    }
  }

  const message = payload.choices?.[0]?.message?.content;

  if (typeof message === "string") {
    return message;
  }

  if (Array.isArray(message)) {
    return message
      .map((entry) => cleanText(entry?.text || entry?.content || ""))
      .filter(Boolean)
      .join("\n");
  }

  return cleanText(payload.choices?.[0]?.text || "");
}

function parseJsonObject(text) {
  const source = String(text || "").trim();

  if (!source) {
    return null;
  }

  try {
    return JSON.parse(source);
  } catch {
    const start = source.indexOf("{");
    const end = source.lastIndexOf("}");

    if (start === -1 || end <= start) {
      return null;
    }

    try {
      return JSON.parse(source.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

function normalizeStringList(value, limit, maxLength) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(new Set(
    value
      .map((item) => cleanText(item).slice(0, maxLength))
      .filter(Boolean)
  )).slice(0, limit);
}

function normalizeVitalsPacket(vitals = {}) {
  const source = vitals && typeof vitals === "object" ? vitals : {};
  const allowed = ["systolic", "diastolic", "bloodSugar", "heartRate", "temperatureC", "oxygenSaturation", "weightKg", "heightCm"];

  return Object.fromEntries(
    Object.entries(source)
      .filter(([key, value]) => allowed.includes(key) && value !== null && value !== undefined && cleanText(value))
      .slice(0, 8)
  );
}

function dedupeItems(items = []) {
  return Array.from(new Set((items || []).map((item) => cleanText(item)).filter(Boolean)));
}

function toArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  const text = cleanText(value);
  return text ? text.split(",").map((item) => item.trim()).filter(Boolean) : [];
}

function normalizeChatCompletionsEndpoint(value) {
  const endpoint = cleanText(value);

  if (!endpoint) {
    return "";
  }

  if (/\/chat\/completions$/i.test(endpoint)) {
    return endpoint;
  }

  if (/\/responses$/i.test(endpoint)) {
    return endpoint.replace(/\/responses$/i, "/chat/completions");
  }

  if (/\/v\d+\/?$/i.test(endpoint)) {
    return `${endpoint.replace(/\/$/, "")}/chat/completions`;
  }

  if (/api\.openai\.com$/i.test(safeHost(endpoint))) {
    return `${endpoint.replace(/\/$/, "")}/v1/chat/completions`;
  }

  return endpoint;
}

function safeHost(value) {
  const text = cleanText(value);

  if (!text) {
    return "";
  }

  try {
    return new URL(text).host || text;
  } catch {
    return text.replace(/\/.*$/, "");
  }
}

function clampInteger(value, min, max, fallback) {
  const parsed = Number.parseInt(cleanText(value), 10);
  const number = Number.isInteger(parsed) ? parsed : fallback;
  return Math.min(max, Math.max(min, number));
}

function readBoolean(value) {
  return /^(1|true|yes|on)$/i.test(cleanText(value));
}

function cleanText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}
