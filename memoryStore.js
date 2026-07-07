import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const memoryFile = resolve(rootDir, "data", "memory", "patient-memory.json");
const maxHistoryItems = 40;
let cachedStore = null;
let cachedStoreMtimeMs = 0;
let storeWriteQueue = Promise.resolve();

export function getMemoryStorageInfo() {
  return {
    mode: "persistent-local-server",
    file: "data/memory/patient-memory.json",
    maxHistoryItems
  };
}

export async function loadPatientMemory(patientId = "demo-patient") {
  const id = normalizePatientId(patientId);
  const store = await readStore();
  const patient = normalizePatientRecord(store.patients[id], id);

  return toPublicMemory(patient);
}

export async function appendPatientMemory({ patientId = "demo-patient", payload = {}, result = {} }) {
  const id = normalizePatientId(patientId);
  const store = await readStore();
  const patient = normalizePatientRecord(store.patients[id], id);
  const nextProfile = mergeProfiles(patient.profile, payload.profile);
  const entry = createMemoryEntry({ payload, result, profileSnapshot: nextProfile });

  patient.profile = nextProfile;
  patient.history = dedupeHistory([entry, ...patient.history]).slice(0, maxHistoryItems);
  patient.lastMemoryPatch = result.memoryPatch || null;
  patient.stats = buildStats(patient.history);
  patient.updatedAt = entry.at;
  patient.createdAt = patient.createdAt || entry.at;
  store.patients[id] = patient;
  store.updatedAt = entry.at;

  await writeStore(store, { replacePatientIds: [id] });
  return toPublicMemory(patient);
}

export async function clearPatientMemory(patientId = "demo-patient") {
  const id = normalizePatientId(patientId);
  const store = await readStore();

  delete store.patients[id];
  store.updatedAt = new Date().toISOString();
  await writeStore(store, { deletePatientIds: [id] });

  return toPublicMemory(normalizePatientRecord(null, id));
}

export function mergeMemoryHistory(primaryHistory = [], fallbackHistory = []) {
  return dedupeHistory([...primaryHistory, ...fallbackHistory]).slice(0, maxHistoryItems);
}

async function readStore() {
  try {
    await storeWriteQueue.catch(() => {});
    const fileStats = await stat(memoryFile).catch((error) => {
      if (error.code === "ENOENT") {
        return null;
      }

      throw error;
    });

    if (cachedStore && fileStats && cachedStoreMtimeMs === fileStats.mtimeMs) {
      return cachedStore;
    }

    if (cachedStore && !fileStats && cachedStoreMtimeMs === 0) {
      return cachedStore;
    }

    if (!fileStats) {
      cachedStore = createEmptyStore();
      cachedStoreMtimeMs = 0;
      return cachedStore;
    }

    const raw = await readFile(memoryFile, "utf8");
    const parsed = JSON.parse(raw);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      cachedStore = createEmptyStore();
      cachedStoreMtimeMs = fileStats.mtimeMs;
      return cachedStore;
    }

    cachedStore = {
      version: 1,
      createdAt: parsed.createdAt || new Date().toISOString(),
      updatedAt: parsed.updatedAt || parsed.createdAt || new Date().toISOString(),
      patients: parsed.patients && typeof parsed.patients === "object" && !Array.isArray(parsed.patients)
        ? parsed.patients
        : {}
    };
    cachedStoreMtimeMs = fileStats.mtimeMs;
    return cachedStore;
  } catch (error) {
    if (error.code === "ENOENT") {
      cachedStore = createEmptyStore();
      cachedStoreMtimeMs = 0;
      return cachedStore;
    }

    if (error instanceof SyntaxError) {
      cachedStore = createEmptyStore();
      cachedStoreMtimeMs = 0;
      return cachedStore;
    }

    throw error;
  }
}

async function writeStore(store, options = {}) {
  storeWriteQueue = storeWriteQueue.catch(() => {}).then(async () => {
    const latestStore = await readStoreFromDisk();
    const nextStore = mergeStoreForWrite(latestStore, store, options);
    const body = `${JSON.stringify(nextStore, null, 2)}\n`;

    await mkdir(dirname(memoryFile), { recursive: true });
    const temporaryFile = `${memoryFile}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`;

    await writeFile(temporaryFile, body, "utf8");
    await replaceFileWithRetry(temporaryFile, memoryFile);
    const fileStats = await stat(memoryFile).catch(() => null);
    cachedStore = nextStore;
    cachedStoreMtimeMs = fileStats?.mtimeMs || Date.now();
  });

  await storeWriteQueue;
}

async function readStoreFromDisk() {
  const raw = await readFile(memoryFile, "utf8").catch((error) => {
    if (error.code === "ENOENT") {
      return "";
    }

    throw error;
  });

  if (!raw.trim()) {
    return createEmptyStore();
  }

  try {
    const parsed = JSON.parse(raw);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return createEmptyStore();
    }

    return {
      version: 1,
      createdAt: parsed.createdAt || new Date().toISOString(),
      updatedAt: parsed.updatedAt || parsed.createdAt || new Date().toISOString(),
      patients: parsed.patients && typeof parsed.patients === "object" && !Array.isArray(parsed.patients)
        ? parsed.patients
        : {}
    };
  } catch {
    return createEmptyStore();
  }
}

function mergeStoreForWrite(baseStore, nextStore, options = {}) {
  const replacePatientIds = new Set(options.replacePatientIds || []);
  const deletePatientIds = new Set(options.deletePatientIds || []);
  const merged = {
    version: 1,
    createdAt: baseStore.createdAt || nextStore.createdAt || new Date().toISOString(),
    updatedAt: nextStore.updatedAt || baseStore.updatedAt || new Date().toISOString(),
    patients: {
      ...(baseStore.patients || {})
    }
  };

  for (const patientId of deletePatientIds) {
    delete merged.patients[patientId];
  }

  for (const patientId of replacePatientIds) {
    const basePatient = normalizePatientRecord(merged.patients[patientId], patientId);
    const nextPatient = normalizePatientRecord(nextStore.patients?.[patientId], patientId);
    const history = mergeMemoryHistory(nextPatient.history, basePatient.history);

    merged.patients[patientId] = {
      ...basePatient,
      ...nextPatient,
      createdAt: earliestIso(basePatient.createdAt, nextPatient.createdAt),
      updatedAt: nextPatient.updatedAt || basePatient.updatedAt,
      history,
      stats: buildStats(history),
      lastMemoryPatch: nextPatient.lastMemoryPatch || basePatient.lastMemoryPatch
    };
  }

  if (!replacePatientIds.size && !deletePatientIds.size) {
    merged.patients = {
      ...(baseStore.patients || {}),
      ...(nextStore.patients || {})
    };
  }

  return merged;
}

function earliestIso(first, second) {
  const firstTime = new Date(first).getTime();
  const secondTime = new Date(second).getTime();

  if (!Number.isFinite(firstTime)) {
    return second || new Date().toISOString();
  }

  if (!Number.isFinite(secondTime)) {
    return first || new Date().toISOString();
  }

  return firstTime <= secondTime ? first : second;
}

async function replaceFileWithRetry(source, target) {
  let lastError = null;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      await rename(source, target);
      return;
    } catch (error) {
      lastError = error;

      if (!["EBUSY", "EPERM", "EACCES"].includes(error.code)) {
        throw error;
      }

      await wait(25 * (attempt + 1));
    }
  }

  throw lastError;
}

function wait(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function createEmptyStore() {
  const now = new Date().toISOString();

  return {
    version: 1,
    createdAt: now,
    updatedAt: now,
    patients: {}
  };
}

function normalizePatientRecord(record, patientId) {
  const now = new Date().toISOString();
  const history = Array.isArray(record?.history)
    ? dedupeHistory(record.history.map(normalizeHistoryItem)).slice(0, maxHistoryItems)
    : [];

  return {
    patientId,
    createdAt: record?.createdAt || now,
    updatedAt: record?.updatedAt || record?.createdAt || now,
    profile: sanitizeProfile(record?.profile || {}),
    history,
    lastMemoryPatch: record?.lastMemoryPatch || null,
    stats: record?.stats || buildStats(history)
  };
}

function toPublicMemory(patient) {
  return {
    ...getMemoryStorageInfo(),
    patientId: patient.patientId,
    createdAt: patient.createdAt,
    updatedAt: patient.updatedAt,
    recentTurnCount: patient.history.length,
    profile: patient.profile,
    history: patient.history,
    stats: patient.stats,
    lastMemoryPatch: patient.lastMemoryPatch
  };
}

function createMemoryEntry({ payload, result, profileSnapshot = {} }) {
  const patch = result.memoryPatch || {};
  const risk = result.risk || {};
  const response = result.finalResponse || {};
  const agentResults = Array.isArray(result.agentResults) ? result.agentResults : [];

  return normalizeHistoryItem({
    id: globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    at: patch.lastInteractionAt || new Date().toISOString(),
    message: patch.lastMessage || payload.message || "",
    risk: risk.level || patch.latestRiskLevel || "UNKNOWN",
    riskLabel: risk.label || "",
    riskScore: Number.isFinite(risk.score) ? risk.score : null,
    intents: Array.isArray(patch.latestIntents) ? patch.latestIntents : [],
    routes: Array.isArray(patch.latestRoutes) ? patch.latestRoutes : [],
    requirement: patch.latestRequirement || null,
    agents: agentResults.map((agent) => agent.name || agent.id).filter(Boolean).slice(0, 8),
    vitals: patch.recentReadings || {},
    context: patch.latestContextSignals || {},
    profile: patch.profileSnapshot || profileSnapshot || payload.profile || {},
    knowledgeSnapshot: patch.knowledgeSnapshot || null,
    summary: response.summary || ""
  });
}

function normalizeHistoryItem(item = {}) {
  return {
    id: cleanText(item.id) || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    at: parseDate(item.at) || new Date().toISOString(),
    message: cleanText(item.message || item.lastMessage).slice(0, 240),
    risk: cleanText(item.risk || item.latestRiskLevel || "UNKNOWN").toUpperCase(),
    riskLabel: cleanText(item.riskLabel || ""),
    riskScore: Number.isFinite(Number(item.riskScore)) ? Number(item.riskScore) : null,
    intents: normalizeTextArray(item.intents || item.latestIntents),
    routes: normalizeTextArray(item.routes || item.latestRoutes),
    requirement: item.requirement && typeof item.requirement === "object"
      ? sanitizeObject(item.requirement)
      : null,
    agents: normalizeTextArray(item.agents),
    vitals: sanitizeObject(item.vitals || item.recentReadings),
    context: sanitizeObject(item.context || item.latestContextSignals),
    profile: sanitizeProfile(item.profile || item.profileSnapshot || {}),
    knowledgeSnapshot: item.knowledgeSnapshot && typeof item.knowledgeSnapshot === "object"
      ? sanitizeObject(item.knowledgeSnapshot)
      : null,
    summary: cleanText(item.summary).slice(0, 360)
  };
}

function dedupeHistory(history) {
  const seen = new Set();
  const unique = [];

  for (const item of history.map(normalizeHistoryItem)) {
    const key = `${item.at}:${item.message}:${item.risk}`;

    if (!item.message || seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(item);
  }

  return unique.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

function buildStats(history) {
  const riskCounts = {};

  for (const item of history) {
    riskCounts[item.risk] = (riskCounts[item.risk] || 0) + 1;
  }

  return {
    totalTurns: history.length,
    riskCounts,
    latestRisk: history[0]?.risk || "NONE",
    latestInteractionAt: history[0]?.at || null
  };
}

function sanitizeProfile(profile = {}) {
  return {
    name: cleanText(profile.name).slice(0, 80),
    age: cleanText(profile.age).slice(0, 20),
    conditions: normalizeProfileList(profile.conditions).slice(0, 12),
    medications: normalizeProfileList(profile.medications).slice(0, 12),
    allergies: normalizeProfileList(profile.allergies).slice(0, 12),
    baselineBp: cleanText(profile.baselineBp).slice(0, 40),
    gender: cleanText(profile.gender).slice(0, 60),
    notes: cleanText(profile.notes).slice(0, 400)
  };
}

function mergeProfiles(baseProfile = {}, overrideProfile = {}) {
  const base = sanitizeProfile(baseProfile);
  const override = sanitizeProfile(overrideProfile);

  return {
    name: override.name || base.name,
    age: override.age || base.age,
    conditions: override.conditions.length ? override.conditions : base.conditions,
    medications: override.medications.length ? override.medications : base.medications,
    allergies: override.allergies.length ? override.allergies : base.allergies,
    baselineBp: override.baselineBp || base.baselineBp,
    gender: override.gender || base.gender,
    notes: mergeProfileNotes(base.notes, override.notes)
  };
}

function mergeProfileNotes(baseNotes = "", overrideNotes = "") {
  const base = cleanText(baseNotes).slice(0, 400);
  const override = cleanText(overrideNotes).slice(0, 400);

  if (!override) {
    return base;
  }

  if (!base) {
    return override;
  }

  const baseNormalized = base.toLowerCase();
  const overrideNormalized = override.toLowerCase();

  if (baseNormalized === overrideNormalized || baseNormalized.includes(overrideNormalized)) {
    return base;
  }

  if (overrideNormalized.includes(baseNormalized)) {
    return override;
  }

  return `${override}; ${base}`.slice(0, 400);
}

function normalizeProfileList(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => cleanText(item).slice(0, 120))
      .filter(Boolean);
  }

  return String(value || "")
    .split(/[,\n;|]+/)
    .map((item) => cleanText(item).slice(0, 120))
    .filter(Boolean);
}

function sanitizeObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entryValue]) => entryValue !== null && entryValue !== undefined && entryValue !== "")
      .map(([key, entryValue]) => [
        cleanText(key).slice(0, 80),
        Array.isArray(entryValue)
          ? normalizeTextArray(entryValue).slice(0, 8)
          : typeof entryValue === "object"
            ? sanitizeObject(entryValue)
            : cleanText(entryValue).slice(0, 240)
      ])
      .filter(([key]) => Boolean(key))
  );
}

function normalizeTextArray(value) {
  return Array.isArray(value)
    ? value.map((item) => cleanText(item).slice(0, 120)).filter(Boolean)
    : [];
}

function normalizePatientId(value) {
  const cleaned = cleanText(value || "demo-patient")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return cleaned || "demo-patient";
}

function cleanText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function parseDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}
