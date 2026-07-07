import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const recordsFile = resolve(rootDir, "data", "records", "patient-records.json");
const maxRecordsPerPatient = 300;
let cachedStore = null;
let cachedStoreMtimeMs = 0;
let storeWriteQueue = Promise.resolve();

export function getRecordStorageInfo() {
  return {
    mode: "persistent-local-server",
    file: "data/records/patient-records.json",
    maxRecordsPerPatient
  };
}

export async function loadPatientDataRecords(patientId = "demo-patient") {
  const id = normalizePatientId(patientId);
  const store = await readStore();
  const patient = normalizePatientRecordStore(store.patients[id], id);

  return toPublicRecordStore(patient);
}

export async function savePatientDataRecords({
  patientId = "demo-patient",
  records = [],
  selectedRecordId = ""
} = {}) {
  const id = normalizePatientId(patientId);
  const store = await readStore();
  const existing = normalizePatientRecordStore(store.patients[id], id);
  const now = new Date().toISOString();
  const normalizedRecords = dedupeRecords(records.map(normalizeDataRecord)).slice(0, maxRecordsPerPatient);
  const selectedId = cleanText(selectedRecordId) || existing.selectedRecordId || normalizedRecords[0]?.id || "";

  store.patients[id] = {
    patientId: id,
    createdAt: existing.createdAt || now,
    updatedAt: now,
    selectedRecordId: normalizedRecords.some((record) => record.id === selectedId) ? selectedId : normalizedRecords[0]?.id || "",
    records: normalizedRecords,
    stats: buildRecordStats(normalizedRecords)
  };
  store.updatedAt = now;

  await writeStore(store, { replacePatientIds: [id] });
  return toPublicRecordStore(store.patients[id]);
}

export async function clearPatientDataRecords(patientId = "demo-patient") {
  const id = normalizePatientId(patientId);
  const store = await readStore();

  delete store.patients[id];
  store.updatedAt = new Date().toISOString();
  await writeStore(store, { deletePatientIds: [id] });

  return toPublicRecordStore(normalizePatientRecordStore(null, id));
}

async function readStore() {
  try {
    await storeWriteQueue.catch(() => {});
    const fileStats = await stat(recordsFile).catch((error) => {
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

    const raw = await readFile(recordsFile, "utf8");
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
    if (error.code === "ENOENT" || error instanceof SyntaxError) {
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

    await mkdir(dirname(recordsFile), { recursive: true });
    const temporaryFile = `${recordsFile}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`;

    await writeFile(temporaryFile, body, "utf8");
    await replaceFileWithRetry(temporaryFile, recordsFile);
    const fileStats = await stat(recordsFile).catch(() => null);
    cachedStore = nextStore;
    cachedStoreMtimeMs = fileStats?.mtimeMs || Date.now();
  });

  await storeWriteQueue;
}

async function readStoreFromDisk() {
  const raw = await readFile(recordsFile, "utf8").catch((error) => {
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
    const basePatient = normalizePatientRecordStore(merged.patients[patientId], patientId);
    const nextPatient = normalizePatientRecordStore(nextStore.patients?.[patientId], patientId);
    const records = nextPatient.records.slice(0, maxRecordsPerPatient);

    merged.patients[patientId] = {
      ...basePatient,
      ...nextPatient,
      createdAt: earliestIso(basePatient.createdAt, nextPatient.createdAt),
      updatedAt: nextPatient.updatedAt || basePatient.updatedAt,
      selectedRecordId: records.some((record) => record.id === nextPatient.selectedRecordId)
        ? nextPatient.selectedRecordId
        : records[0]?.id || "",
      records,
      stats: buildRecordStats(records)
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

function normalizePatientRecordStore(record, patientId) {
  const now = new Date().toISOString();
  const records = Array.isArray(record?.records)
    ? dedupeRecords(record.records.map(normalizeDataRecord)).slice(0, maxRecordsPerPatient)
    : [];
  const selectedRecordId = cleanText(record?.selectedRecordId);

  return {
    patientId,
    createdAt: record?.createdAt || now,
    updatedAt: record?.updatedAt || record?.createdAt || now,
    selectedRecordId: records.some((item) => item.id === selectedRecordId) ? selectedRecordId : records[0]?.id || "",
    records,
    stats: record?.stats || buildRecordStats(records)
  };
}

function toPublicRecordStore(patient) {
  return {
    ...getRecordStorageInfo(),
    patientId: patient.patientId,
    createdAt: patient.createdAt,
    updatedAt: patient.updatedAt,
    selectedRecordId: patient.selectedRecordId,
    recordCount: patient.records.length,
    records: patient.records,
    stats: buildRecordStats(patient.records)
  };
}

function normalizeDataRecord(record = {}) {
  const now = new Date().toISOString();
  const id = cleanRecordId(record.id) || `record-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`;

  return {
    id,
    createdAt: parseDate(record.createdAt) || now,
    updatedAt: parseDate(record.updatedAt) || now,
    patientName: cleanText(record.patientName).slice(0, 100) || "Patient",
    age: cleanText(record.age).slice(0, 20),
    type: cleanText(record.type || "profile").toLowerCase().replace(/[^a-z0-9_-]+/g, "-").slice(0, 40) || "profile",
    date: cleanDateInput(record.date) || new Date().toISOString().slice(0, 10),
    episode: cleanText(record.episode).slice(0, 120),
    tags: cleanList(record.tags, 12, 40),
    source: cleanText(record.source).slice(0, 120),
    documentCategory: cleanText(record.documentCategory).toLowerCase().replace(/[^a-z0-9_-]+/g, "-").slice(0, 60),
    documentName: cleanText(record.documentName).slice(0, 160),
    fileReferences: cleanMultiline(record.fileReferences || record.fileReference).slice(0, 1600),
    conditions: cleanMultiline(record.conditions).slice(0, 1200),
    allergies: cleanMultiline(record.allergies).slice(0, 800),
    medicines: cleanMultiline(record.medicines).slice(0, 1600),
    vitals: cleanMultiline(record.vitals).slice(0, 1200),
    labs: cleanMultiline(record.labs).slice(0, 1800),
    notes: cleanMultiline(record.notes).slice(0, 2400),
    followUp: cleanMultiline(record.followUp).slice(0, 1200),
    versionNote: cleanMultiline(record.versionNote).slice(0, 400),
    correctionHistory: normalizeCorrectionHistory(record.correctionHistory)
  };
}

function dedupeRecords(records) {
  const byId = new Map();

  for (const record of records) {
    if (!record.id) {
      continue;
    }

    const existing = byId.get(record.id);
    if (!existing || new Date(record.updatedAt).getTime() >= new Date(existing.updatedAt).getTime()) {
      byId.set(record.id, record);
    }
  }

  return Array.from(byId.values()).sort((a, b) => {
    const updatedDelta = new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    if (updatedDelta) {
      return updatedDelta;
    }

    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

function buildRecordStats(records) {
  const typeCounts = {};
  const patientNames = new Set();

  for (const record of records) {
    typeCounts[record.type] = (typeCounts[record.type] || 0) + 1;
    if (record.patientName) {
      patientNames.add(record.patientName.toLowerCase());
    }
  }

  return {
    totalRecords: records.length,
    patientCount: patientNames.size,
    typeCounts,
    latestUpdatedAt: records[0]?.updatedAt || null
  };
}

function normalizePatientId(value) {
  const cleaned = cleanText(value || "demo-patient")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return cleaned || "demo-patient";
}

function cleanRecordId(value) {
  return cleanText(value)
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function cleanDateInput(value) {
  const text = cleanText(value).slice(0, 40);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

function cleanList(value, limit = 12, itemLimit = 80) {
  const source = Array.isArray(value) ? value : String(value ?? "").split(/[,;\n]+/);
  const seen = new Set();
  const items = [];

  for (const item of source) {
    const cleaned = cleanText(item).replace(/^#/, "").slice(0, itemLimit);
    const key = cleaned.toLowerCase();

    if (!cleaned || seen.has(key)) {
      continue;
    }

    seen.add(key);
    items.push(cleaned);

    if (items.length >= limit) {
      break;
    }
  }

  return items;
}

function normalizeCorrectionHistory(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => ({
      at: parseDate(entry?.at) || new Date().toISOString(),
      note: cleanText(entry?.note).slice(0, 220),
      changes: cleanList(entry?.changes, 8, 60)
    }))
    .filter((entry) => entry.note || entry.changes.length)
    .slice(0, 10);
}

function parseDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function cleanText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function cleanMultiline(value) {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}
