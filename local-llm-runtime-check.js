import "../src/envLoader.js";

import { refreshLocalRuntimeProbe } from "../src/openSourceLocalRuntime.js";
import { getLocalAiRuntimeStatus } from "../src/localAiEngine.js";
import { getLocalReasoningAssistStatus } from "../src/localReasoningGateway.js";

await refreshLocalRuntimeProbe();

const localAi = getLocalAiRuntimeStatus();
const localReasoning = getLocalReasoningAssistStatus();

const report = {
  localAi: {
    mode: localAi.mode,
    localLlm: localAi.localLlm,
    hybridRouter: {
      status: localAi.hybridRouter?.status,
      summary: localAi.hybridRouter?.summary
    }
  },
  localReasoning: {
    featureEnabled: localReasoning.featureEnabled,
    enabled: localReasoning.enabled,
    configured: localReasoning.configured,
    status: localReasoning.status,
    provider: localReasoning.provider,
    model: localReasoning.model,
    runtimeFamily: localReasoning.runtimeFamily,
    endpointHost: localReasoning.endpointHost,
    participantCount: localReasoning.participantCount,
    participants: (localReasoning.participants || []).map((item) => ({
      displayName: item.displayName,
      model: item.model,
      runtimeFamily: item.runtimeFamily,
      endpointHost: item.endpointHost
    })),
    reason: localReasoning.reason
  }
};

console.log(JSON.stringify(report, null, 2));

const localLlmExpected = Boolean(localAi.localLlm?.enabled);
const localLlmHealthy = !localLlmExpected || Boolean(localAi.localLlm?.available);
const localReasoningExpected = Boolean(localReasoning.featureEnabled && localReasoning.enabled);
const localReasoningHealthy = !localReasoningExpected || Boolean(localReasoning.configured);

if (!localLlmHealthy || !localReasoningHealthy) {
  process.exitCode = 1;
}
