import { getModelHealthStatus } from "./localAiEngine.js";
import { evaluateFinalResponseGuardrails } from "./healthEngine.js";
import { getOpenSourceParticipationPlan } from "./hybridModelRouter.js";
import { normalizeChatCompletionsEndpoint } from "./openSourceLocalRuntime.js";
import { getConnectivityPolicy, isEndpointUsableForThisRun } from "./runtimeConnectivity.js";

const DEFAULT_ASSIST_TIMEOUT_MS = 12000;

export function getLocalReasoningAssistStatus(env = process.env, input = {}, result = {}) {
  const connectivity = getConnectivityPolicy(env);
  const modelHealth = getModelHealthStatus(env);
  const ensemble = getOpenSourceParticipationPlan({
    ...input,
    preferredAgent: input.preferredAgent || result?.plan?.singleAgent?.route || result?.plan?.responseOwner?.route || result?.requirementProfile?.expectedRoute || ""
  }, env);
  const configuredParticipants = (ensemble.participants || [])
    .map((model, index) => ({
      id: model.id,
      provider: model.id,
      displayName: model.displayName,
      model: model.model,
      endpoint: normalizeChatCompletionsEndpoint(model.endpoint),
      endpointHost: model.endpoint ? safeHost(normalizeChatCompletionsEndpoint(model.endpoint)) : "",
      runtimeFamily: cleanText(model.runtimeFamily || ""),
      apiKey: model.apiKey || "",
      apiKeyHeader: model.apiKeyHeader || "",
      authScheme: model.authScheme || "Bearer",
      role: index === 0 ? "reasoner" : index === 1 ? "verifier" : "responder"
    }))
    .filter((candidate) => candidate.endpoint && candidate.model);
  const participants = [];
  const blockedParticipants = [];

  for (const candidate of configuredParticipants) {
    if (isEndpointUsableForThisRun(candidate.endpoint, env, { connectivity })) {
      participants.push(candidate);
    } else {
      blockedParticipants.push(candidate);
    }
  }

  const fallbackCandidate = buildFallbackCandidate(modelHealth);
  const fallbackConfigured = Boolean(fallbackCandidate && modelHealth.healthCheck?.available);
  const fallbackBlocked = Boolean(fallbackConfigured && !isEndpointUsableForThisRun(fallbackCandidate.endpoint, env, { connectivity }));
  const fallbackEligible = Boolean(fallbackConfigured && !fallbackBlocked);
  const primaryParticipant = participants[0] || null;
  const featureEnabled = readBooleanDefault(env.CARE_NOVA_LOCAL_REASONING_ASSIST_ENABLED, true);
  const enabled = featureEnabled && (participants.length > 0 || fallbackEligible);
  const timeoutMs = clampInteger(
    env.CARE_NOVA_LOCAL_REASONING_ASSIST_TIMEOUT_MS,
    2000,
    30000,
    modelHealth.timeoutMs || DEFAULT_ASSIST_TIMEOUT_MS
  );
  const configured = enabled && Boolean(participants.length || fallbackEligible);
  const endpoint = primaryParticipant?.endpoint || (fallbackEligible ? fallbackCandidate.endpoint : "");
  const status = !featureEnabled
    ? "disabled"
    : configured
      ? "ready"
      : blockedParticipants.length || fallbackBlocked
        ? "offline-policy-blocked"
        : "missing-configuration";

  return {
    enabled,
    configured,
    featureEnabled,
    policyBlocked: status === "offline-policy-blocked",
    provider: primaryParticipant?.provider || (fallbackEligible ? fallbackCandidate.provider : modelHealth.provider),
    displayName: primaryParticipant?.displayName || (fallbackEligible ? fallbackCandidate.displayName : modelHealth.displayName),
    model: primaryParticipant?.model || (fallbackEligible ? fallbackCandidate.model : modelHealth.model),
    runtimeFamily: primaryParticipant?.runtimeFamily || (fallbackEligible ? fallbackCandidate.runtimeFamily : modelHealth.runtimeFamily),
    endpoint,
    endpointHost: primaryParticipant?.endpointHost || (fallbackEligible ? fallbackCandidate.endpointHost : (endpoint ? safeHost(endpoint) : "")),
    timeoutMs,
    participants,
    participantCount: participants.length,
    blockedParticipants,
    blockedParticipantCount: blockedParticipants.length + (fallbackBlocked ? 1 : 0),
    fallbackCandidate: fallbackEligible ? fallbackCandidate : null,
    fallbackCandidateBlocked: fallbackBlocked,
    status,
    connectivity: {
      forceOffline: connectivity.forceOffline,
      internetAvailable: connectivity.internetAvailable
    },
    reasoningMode: "route-aware-open-source-local-second-pass",
    fallback: "deterministic-local-agent-output",
    reason: buildLocalReasoningStatusReason({
      featureEnabled,
      configured,
      participants,
      blockedParticipants,
      fallbackEligible,
      fallbackBlocked,
      connectivity
    })
  };
}

export async function tryEnhanceAnalyzeResultWithLocalReasoning({ payload = {}, result = {}, env = process.env } = {}) {
  const status = getLocalReasoningAssistStatus(env, payload, result);
  const execution = {
    ...status,
    attempted: false,
    applied: false,
    fallbackUsed: true,
    error: ""
  };

  if (!status.enabled || !status.configured || !result?.finalResponse) {
    return execution;
  }

  execution.attempted = true;

  try {
    const review = await requestLocalReasoningReview({ payload, result, status, env });
    const merged = mergeLocalReasoningReviewIntoResult(result, review.review, review.candidate);
    const guardrails = evaluateFinalResponseGuardrails(merged.finalResponse);

    if (!guardrails.passed) {
      throw new Error("Open-source local reasoning assist failed local safety guardrails.");
    }

    result.finalResponse = merged.finalResponse;
    result.guardrails = guardrails;
    result.agentResults = merged.agentResults;
    execution.applied = true;
    execution.fallbackUsed = false;
    execution.provider = review.candidate?.displayName || execution.provider;
    execution.displayName = review.candidate?.displayName || execution.displayName;
    execution.model = review.candidate?.model || execution.model;
    execution.endpointHost = review.candidate?.endpointHost || execution.endpointHost;
    return execution;
  } catch (error) {
    execution.error = cleanText(error.message).slice(0, 240);

    if (result?.finalResponse) {
      result.finalResponse.localReasoningAssist = {
        enabled: true,
        attempted: true,
        applied: false,
        provider: status.displayName || status.provider,
        model: status.model,
        endpointHost: status.endpointHost,
        participants: status.participants.map((candidate) => ({
          role: candidate.role,
          displayName: candidate.displayName,
          model: candidate.model
        })),
        fallbackUsed: true,
        error: execution.error
      };
    }

    return execution;
  }
}

async function requestLocalReasoningReview({ payload, result, status, env }) {
  const candidates = Array.isArray(status.participants) && status.participants.length
    ? status.participants
    : status.fallbackCandidate
      ? [status.fallbackCandidate]
      : [{
        provider: status.provider,
        displayName: status.displayName,
        model: status.model,
        endpoint: status.endpoint,
        endpointHost: status.endpointHost,
        runtimeFamily: status.runtimeFamily,
        role: "reasoner"
      }];
  const errors = [];

  for (const candidate of candidates) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), status.timeoutMs);

    try {
      const request = buildRuntimeRequest({ candidate, payload, result, env });
      const response = await fetch(request.url, {
        method: "POST",
        headers: request.headers,
        body: JSON.stringify(request.body),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`${candidate.displayName} returned ${response.status}.`);
      }

      const json = await response.json();
      const text = extractResponseText(json);

      if (!text) {
        throw new Error(`${candidate.displayName} returned an empty response.`);
      }

      const parsed = parseJsonObject(text);

      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error(`${candidate.displayName} did not return valid JSON.`);
      }

      return {
        review: parsed,
        candidate
      };
    } catch (error) {
      errors.push(cleanText(error.message).slice(0, 160));
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error(
    errors.length
      ? `Open-source local reasoning chain failed. ${errors.join(" | ")}`
      : "Open-source local reasoning chain is not configured."
  );
}

function buildFallbackCandidate(modelHealth = {}) {
  const endpoint = normalizeChatCompletionsEndpoint(modelHealth.endpoint);

  if (!endpoint || !modelHealth.model) {
    return null;
  }

  return {
    provider: modelHealth.provider,
    displayName: modelHealth.displayName,
    model: modelHealth.model,
    endpoint,
    endpointHost: safeHost(endpoint),
    runtimeFamily: cleanText(modelHealth.runtimeFamily || ""),
    apiKey: modelHealth.apiKey || "",
    apiKeyHeader: modelHealth.apiKeyHeader || "",
    authScheme: modelHealth.authScheme || "Bearer",
    role: "reasoner"
  };
}

function buildRuntimeRequest({ candidate = {}, payload = {}, result = {}, env = process.env } = {}) {
  const messages = buildMessages({ payload, result });
  const runtimeFamily = cleanText(candidate.runtimeFamily).toLowerCase();
  const useOllamaNative = runtimeFamily === "ollama-compatible"
    || /localhost:11434|127\.0\.0\.1:11434/i.test(cleanText(candidate.endpoint));

  if (useOllamaNative) {
    return {
      url: toOllamaChatEndpoint(candidate.endpoint),
      headers: buildHeaders(env, candidate),
      body: {
        model: candidate.model,
        stream: false,
        format: buildReviewJsonSchema(),
        messages
      }
    };
  }

  return {
    url: candidate.endpoint,
    headers: buildHeaders(env, candidate),
    body: {
      model: candidate.model,
      temperature: 0.1,
      max_tokens: 520,
      messages
    }
  };
}

function toOllamaChatEndpoint(endpoint) {
  try {
    const parsed = new URL(normalizeChatCompletionsEndpoint(endpoint));
    return `${parsed.origin}/api/chat`;
  } catch {
    return endpoint;
  }
}

function buildReviewJsonSchema() {
  return {
    type: "object",
    properties: {
      summary_upgrade: { type: "string" },
      step_additions: {
        type: "array",
        items: { type: "string" }
      },
      warning_additions: {
        type: "array",
        items: { type: "string" }
      },
      missing_question: { type: "string" },
      evidence_focus: {
        type: "array",
        items: { type: "string" }
      },
      confidence_label: { type: "string" }
    },
    required: [
      "summary_upgrade",
      "step_additions",
      "warning_additions",
      "missing_question",
      "evidence_focus",
      "confidence_label"
    ],
    additionalProperties: false
  };
}

function buildLocalReasoningStatusReason({
  featureEnabled,
  configured,
  participants = [],
  blockedParticipants = [],
  fallbackEligible,
  fallbackBlocked,
  connectivity
} = {}) {
  if (!featureEnabled) {
    return "Local reasoning assist is disabled.";
  }

  if (configured) {
    const activeParticipants = participants.map((candidate) => candidate.displayName).filter(Boolean);
    const readyBase = activeParticipants.length > 1
      ? `Open-source local reasoning chain is ready with ${activeParticipants.join(", ")}.`
      : activeParticipants.length === 1
        ? `Open-source local reasoning assist is ready with ${activeParticipants[0]}.`
        : fallbackEligible
          ? "Primary local reasoning assist is ready on the configured local endpoint."
          : "Open-source local reasoning assist is ready.";

    return blockedParticipants.length || fallbackBlocked
      ? `${readyBase} Remote-only participants were skipped for this offline-safe run.`
      : readyBase;
  }

  if (blockedParticipants.length || fallbackBlocked) {
    return connectivity?.forceOffline
      ? "Remote local reasoning participants are blocked by offline policy."
      : "Remote local reasoning participants are unavailable because internet is unavailable.";
  }

  return "Open-source local reasoning assist is missing endpoint or model configuration.";
}

function buildMessages({ payload = {}, result = {} }) {
  const finalResponse = result.finalResponse || {};
  const primaryRoute = cleanText(finalResponse?.responseFocus?.primaryRoute || result?.plan?.responseOwner?.route || "RAG_AGENT");
  const primaryAgent = Array.isArray(result.agentResults)
    ? result.agentResults.find((agent) => agent.id === primaryRoute) || result.agentResults[0]
    : null;
  const profile = result.memoryContext?.profile || payload.profile || {};
  const latestVitals = result.memoryContext?.latestVitals || payload.vitals || {};
  const evidence = Array.isArray(result.medicalKnowledge?.matches)
    ? result.medicalKnowledge.matches.slice(0, 4).map((match) => ({
        title: cleanText(match.title).slice(0, 120),
        category: cleanText(match.category).slice(0, 60),
        summary: cleanText(match.summary).slice(0, 240),
        safetyNotes: cleanText(match.safetyNotes).slice(0, 180),
        relevance: Number(match.relevance || 0)
      }))
    : [];
  const packet = {
    route: primaryRoute,
    risk: cleanText(result.risk?.label || result.risk?.level || "LOW"),
    answerMode: cleanText(result.requirementProfile?.answerMode?.id || finalResponse?.responseFocus?.requirement?.answerMode || "quick"),
    message: cleanText(payload.message || "").slice(0, 320),
    context: {
      vitals: normalizeVitalsPacket(latestVitals),
      profile: {
        age: cleanText(profile.age).slice(0, 24),
        gender: cleanText(profile.gender).slice(0, 40),
        conditions: normalizeStringList(profile.conditions, 4, 80),
        medications: normalizeStringList(profile.medications, 4, 80),
        allergies: normalizeStringList(profile.allergies, 4, 80)
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
      disclaimer: cleanText(finalResponse.disclaimer).slice(0, 200)
    }
  };

  return [
    {
      role: "system",
      content: [
        "You are a healthcare reasoning assistant for a local-first agent system.",
        "Improve accuracy only by grounding in the supplied evidence, vitals, profile, memory, and local agent output.",
        "Do not add diagnosis, prescriptions, doses, or new medical claims.",
        "Preserve urgent safety wording and uncertainty.",
        "Return strict JSON with keys:",
        "summary_upgrade, step_additions, warning_additions, missing_question, evidence_focus, confidence_label."
      ].join(" ")
    },
    {
      role: "user",
      content: `Strengthen the local answer using this grounded packet.\n${JSON.stringify(packet)}`
    }
  ];
}

function mergeLocalReasoningReviewIntoResult(result = {}, review = {}, candidate = {}) {
  const finalResponse = result.finalResponse || {};
  const groundedSummary = cleanText(finalResponse.summary);
  const summaryUpgrade = cleanText(review.summary_upgrade || review.summary || "").slice(0, 520);
  const stepAdditions = normalizeStringList(review.step_additions || review.steps, 3, 220);
  const warningAdditions = normalizeStringList(review.warning_additions || review.warningSigns, 3, 220);
  const evidenceFocus = normalizeStringList(review.evidence_focus, 4, 180);
  const missingQuestion = cleanText(review.missing_question).slice(0, 220);
  const confidenceLabel = cleanText(review.confidence_label).slice(0, 80);
  const mergedFinalResponse = {
    ...finalResponse,
    summary: groundedSummary,
    whatToDoNow: dedupeItems([
      ...(Array.isArray(finalResponse.whatToDoNow) ? finalResponse.whatToDoNow : []),
      ...stepAdditions
    ]).slice(0, 5),
    warningSigns: dedupeItems([
      ...(Array.isArray(finalResponse.warningSigns) ? finalResponse.warningSigns : []),
      ...warningAdditions
    ]).slice(0, 5),
    localReasoningAssist: {
      enabled: true,
      attempted: true,
      applied: true,
      provider: candidate.displayName || candidate.provider || "Local reasoning",
      model: candidate.model || "",
      summaryUpgrade,
      evidenceFocus,
      missingQuestion,
      confidenceLabel
    }
  };
  const primaryRoute = cleanText(finalResponse?.responseFocus?.primaryRoute || result?.plan?.responseOwner?.route || "");
  const mergedAgentResults = Array.isArray(result.agentResults)
    ? result.agentResults.map((agent) => {
        if (agent.id !== primaryRoute) {
          return agent;
        }

        const output = agent.output || {};
        return {
          ...agent,
          output: {
            ...output,
            summary: cleanText(output.summary),
            checklist: dedupeItems([
              ...(Array.isArray(output.checklist) ? output.checklist : []),
              ...stepAdditions
            ]).slice(0, 5),
            doctorQuestions: dedupeItems([
              ...(Array.isArray(output.doctorQuestions) ? output.doctorQuestions : []),
              missingQuestion
            ]).slice(0, 6),
            localReasoningAssist: {
              applied: true,
              provider: candidate.displayName || candidate.provider || "Local reasoning",
              model: candidate.model || "",
              summaryUpgrade,
              evidenceFocus,
              missingQuestion,
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

function buildHeaders(env, candidate = {}) {
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json; charset=utf-8"
  };
  const apiKey = cleanText(candidate.apiKey || env.DEEPSEEK_API_KEY || env.LOCAL_LLM_API_KEY || env.CARE_NOVA_LLM_API_KEY);
  const apiKeyHeader = cleanText(candidate.apiKeyHeader || env.CARE_NOVA_LOCAL_REASONING_API_KEY_HEADER);
  const authScheme = cleanText(candidate.authScheme || env.CARE_NOVA_LOCAL_REASONING_API_AUTH_SCHEME || "Bearer");

  if (apiKey && apiKeyHeader) {
    headers[apiKeyHeader] = apiKey;
  } else if (apiKey) {
    headers.Authorization = `${authScheme} ${apiKey}`.trim();
  }

  return headers;
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

function normalizeStringList(value, limit, maxLength) {
  if (!Array.isArray(value)) {
    return [];
  }

  return dedupeItems(
    value.map((item) => cleanText(item).slice(0, maxLength))
  ).slice(0, limit);
}

function extractResponseText(payload) {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const ollamaMessage = payload.message?.content;

  if (typeof ollamaMessage === "string") {
    return ollamaMessage;
  }

  if (Array.isArray(ollamaMessage)) {
    return ollamaMessage
      .map((entry) => cleanText(entry?.text || entry?.content || ""))
      .filter(Boolean)
      .join("\n");
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

  if (typeof payload.output_text === "string") {
    return payload.output_text;
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

function readBooleanDefault(value, defaultValue = false) {
  const cleaned = cleanText(value);

  if (!cleaned) {
    return defaultValue;
  }

  return /^(1|true|yes|on)$/i.test(cleaned);
}

function cleanText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}
