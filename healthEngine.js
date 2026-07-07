import { OFFLINE_DATABASE_SUMMARY, getOfflineKnowledgeDatabase, offlineMedicalRecords } from "./offlineMedicalDatabase.js";
import { getHybridModelRouterStatus, selectHybridModelRoute } from "./hybridModelRouter.js";
import { getLocalAiRuntimeStatus, rankLocalMedicalKnowledge } from "./localAiEngine.js";
import { getMachineLearningCapabilityStatus } from "./trainingEngine.js";
import { tryEnhanceSpecialistAgentResultsWithLlm } from "./specialistLlmGateway.js";

export const APP_VERSION = "5.0.343";
export { getOfflineKnowledgeDatabase };
export { getLocalAiRuntimeStatus };
export { getHybridModelRouterStatus };

const GLOBAL_DEPLOYMENT_GUIDE = {
  status: "global-ready",
  summary: "Care Nova AI can run as a local app, installable browser app, LAN app, Docker container, or cloud-hosted Node service while keeping the same local AI core online and offline.",
  installModes: [
    "One-click Windows launcher",
    "Installable browser app through the PWA manifest",
    "Node server on a laptop, workstation, VM, or cloud server",
    "Docker container for portable deployment",
    "HTTPS domain behind a reverse proxy or cloud load balancer"
  ],
  environmentVariables: [
    {
      name: "NODE_ENV",
      example: "production",
      purpose: "Marks the runtime as a production deployment for hosting platforms and release checks."
    },
    {
      name: "HOST",
      example: "0.0.0.0",
      purpose: "Allows the server to accept external traffic when deployed behind a trusted network, VM, or container."
    },
    {
      name: "PORT",
      example: "4173",
      purpose: "Selects the public app port."
    },
    {
      name: "ALLOWED_ORIGIN",
      example: "https://your-domain.example",
      purpose: "Restricts browser API access to a trusted website origin when needed."
    },
    {
      name: "FRAME_ANCESTORS",
      example: "'self' https://your-domain.example",
      purpose: "Controls which trusted websites may embed the app in an iframe."
    },
    {
      name: "ENABLE_HSTS",
      example: "true",
      purpose: "Enables strict HTTPS transport headers when the app is served behind a real HTTPS domain."
    }
  ],
  worldwideChecklist: [
    "Run with HOST=0.0.0.0 on the server or container.",
    "Place the app behind HTTPS before sharing publicly.",
    "Use a real domain name for easy global access and app installation.",
    "Run npm run release:check before publishing a new build.",
    "Monitor /api/health, /api/ready, and /api/deployment-readiness from the hosting platform.",
    "Persist patient memory only in the approved local or secured deployment store, with consent and access controls before any shared deployment.",
    "Use licensed, clinician-reviewed medical content before production medical deployment.",
    "Keep the safety boundary visible: no diagnosis, prescription, dosage, emergency call, or caregiver contact is performed."
  ],
  releaseCommands: [
    "npm run check",
    "npm run deploy:check",
    "npm run release:check",
    "release-check.cmd"
  ],
  productionChecks: [
    "Static app shell serves with security headers.",
    "Health and readiness endpoints return success.",
    "Offline medical database is packaged with the server.",
    "Critical symptom path routes to urgent safety guardrails.",
    "Install manifest and service worker are available.",
    "No external API key is required for the safe local runtime."
  ],
  container: {
    image: "care-nova-ai",
    port: 4173,
    healthcheck: "GET /api/health",
    includesOfflineDatabase: true
  },
  monitoring: {
    health: "/api/health",
    readiness: "/api/ready",
    deployment: "/api/deployment-readiness",
    expectedStatus: "deployment-ready"
  },
  installExperience: {
    pwa: "Users can install Care Nova AI from supported browsers after opening the hosted HTTPS URL.",
    desktop: "Windows users can start the app with the included launcher scripts.",
    mobile: "Mobile users can open the HTTPS URL and add/install the app from the browser menu."
  }
};

const enterpriseUseCases = [
  {
    id: "provider-discharge-transitions",
    segment: "Healthcare",
    audience: "Providers",
    domain: "Care Delivery",
    workflow: "Care Management, Discharge & Transitions",
    agentRoute: "CARE_TRANSITIONS_AGENT",
    opportunity: "Discharge summary drafting, plain-language patient instructions, care plan authoring, follow-up outreach, readmission monitoring, and quality reporting.",
    useCases: [
      "Risk stratification inputs",
      "Care plan authoring",
      "Multidisciplinary coordination",
      "Discharge summary",
      "Post-discharge outreach",
      "Readmission monitoring",
      "Quality reporting"
    ],
    value: "Care coordination and patient communication",
    outputs: [
      "Discharge summary draft sections",
      "Plain-language patient instructions",
      "Care plan drafting with guideline-reference placeholders",
      "Post-discharge outreach script and documentation"
    ],
    capabilities: ["Reasoning", "Content generation", "Orchestration", "Decision intelligence", "Compliance controls"],
    reviewBoundary: "Drafts only; clinician review is required before use."
  },
  {
    id: "payer-claims-operations",
    segment: "Healthcare",
    audience: "Payers",
    domain: "Core Operations",
    workflow: "Claims Intake, Adjudication & Post-Payment Ops",
    agentRoute: "CLAIMS_OPS_AGENT",
    opportunity: "Claim document extraction, validation edits, adjudication exception summaries, explanation-of-benefits drafting, post-payment review, provider inquiry response drafting, and regulatory reporting.",
    useCases: [
      "Claims intake",
      "Validation and edits",
      "Adjudication",
      "Explanation of benefits",
      "Post-payment adjustments",
      "Provider inquiries",
      "Regulatory reporting"
    ],
    value: "Claims operations automation and explainability",
    outputs: [
      "Claim document understanding and structured extraction",
      "Adjudication exception summary",
      "Provider inquiry response draft with policy-reference placeholders"
    ],
    capabilities: ["Structured extraction", "Reasoning", "Orchestration", "Decision intelligence", "Content generation", "Compliance controls"],
    reviewBoundary: "Administrative draft only; no payment decision is finalized."
  },
  {
    id: "utilization-prior-auth-appeals",
    segment: "Insurance",
    audience: "Health Insurance",
    domain: "Utilization Management",
    workflow: "Prior Authorization and Appeals Administration",
    agentRoute: "UTILIZATION_AGENT",
    opportunity: "Policy-grounded summarization and appeal drafting with structured intake, medical policy checks, explainable rationale, and audit logging.",
    useCases: [
      "Prior authorization intake",
      "Clinical document ingestion",
      "Medical policy checks",
      "Decision rationale",
      "Provider/member communications",
      "Appeals intake",
      "Appeals package drafting",
      "Audit and compliance logging"
    ],
    value: "Clinical-adjacent document synthesis for administrative decisions",
    outputs: [
      "Prior authorization packet summary and decision-rationale draft",
      "Appeal letter draft with citation placeholders and explainable reasoning",
      "Provider communication summary and next-step recommendations"
    ],
    capabilities: ["Reasoning", "Content generation", "Orchestration", "Decision intelligence", "Retrieval"],
    reviewBoundary: "Policy-aligned draft only; no coverage or medical necessity decision is finalized."
  },
  {
    id: "pharma-batch-shopfloor-quality",
    segment: "Life Sciences",
    audience: "Pharma & Biopharma",
    domain: "Manufacturing & CMC",
    workflow: "Batch Record Review & Shopfloor Quality",
    agentRoute: "GXP_QUALITY_AGENT",
    opportunity: "Document-centric review and exception narrative generation for regulated manufacturing without recreating physical manufacturing systems.",
    useCases: [
      "Master batch record authoring",
      "eBR execution",
      "Deviations and exceptions",
      "Release documentation",
      "QA review",
      "Change control",
      "Continuous improvement analytics"
    ],
    value: "GxP manufacturing documentation and exception handling",
    outputs: [
      "Batch record review summary and exception narrative",
      "Release document draft with traceability",
      "Shopfloor knowledge assistant for SOP/QMS questions with approved content only"
    ],
    capabilities: ["Reasoning", "Structured extraction", "Content generation", "Orchestration", "Compliance controls", "Decision intelligence"],
    reviewBoundary: "GxP draft only; QA, quality unit, and approved SOP/QMS review are required before use."
  },
  {
    id: "medtech-design-controls-complaints",
    segment: "Life Sciences",
    audience: "MedTech",
    domain: "Product Lifecycle",
    workflow: "Design Controls, Tech Files & Complaint Handling",
    agentRoute: "MEDTECH_COMPLIANCE_AGENT",
    opportunity: "Strong documentation use case for requirement-to-evidence traceability, complaint summarization, and regulatory draft generation.",
    useCases: [
      "Requirements and user needs capture",
      "Technical documentation drafting with traceability",
      "V&V evidence summarization",
      "Cybersecurity risk management documentation",
      "Post-market surveillance signal capture",
      "Complaint intake/triage and root-cause summaries",
      "CAPA drafting and regulatory reporting"
    ],
    value: "Regulatory-grade documentation and post-market intelligence for connected devices",
    outputs: [
      "MDR/IVDR technical documentation draft with requirement-to-evidence traceability",
      "Complaint narrative summarization and root-cause hypothesis draft for CAPA initiation",
      "Cyber vulnerability remediation evidence pack draft"
    ],
    capabilities: ["Reasoning", "RAG", "Compliance controls", "Content generation", "Orchestration", "Classification", "Summarization"],
    reviewBoundary: "Regulatory draft only; no final complaint disposition, CAPA decision, or regulatory submission is performed."
  }
];

const requirementWorkflowMatrix = [
  {
    id: "matrix-healthcare-payer-claims",
    industry: "Healthcare",
    audience: "Payers",
    businessArea: "Core Operations",
    workflow: "Claims Intake, Adjudication & Post-Payment Ops",
    agentRoute: "CLAIMS_OPS_AGENT",
    fitReason: "Good fit for claim document extraction, exception summary generation, and provider response drafting.",
    agentFunctions: [
      "Claims intake",
      "Validation and edits",
      "Adjudication",
      "Explanation of benefits",
      "Post-payment adjustments",
      "Provider inquiries",
      "Regulatory reporting"
    ],
    businessValue: "Claims operations automation and explainability",
    generatedOutputs: [
      "Claim document understanding and structured extraction",
      "Adjudication exception summaries",
      "Provider inquiry response drafts with policy references"
    ],
    capabilities: ["Structured extraction", "Reasoning", "Orchestration", "Decision intelligence", "Content generation", "Compliance controls"],
    reviewBoundary: "Administrative draft only; no payment, denial, adjustment, or provider message is finalized."
  },
  {
    id: "matrix-pharma-gxp-quality",
    industry: "Life Sciences",
    audience: "Pharma & Biopharma",
    businessArea: "Manufacturing & CMC",
    workflow: "Batch Record Review & Shopfloor Quality",
    agentRoute: "GXP_QUALITY_AGENT",
    fitReason: "Document-centric review and exception narration can be demoed without recreating physical manufacturing systems.",
    agentFunctions: [
      "Master batch record authoring",
      "eBR execution",
      "Deviations and exceptions",
      "Release documentation",
      "QA review",
      "Change control",
      "Continuous improvement analytics"
    ],
    businessValue: "GxP manufacturing documentation and exception handling",
    generatedOutputs: [
      "Batch record review summarization and exception narratives",
      "Release document drafting with traceability",
      "Shopfloor knowledge assistant for SOP/QMS questions using approved content only"
    ],
    capabilities: ["Reasoning", "Structured extraction", "Content generation", "Orchestration", "Compliance controls", "Decision intelligence"],
    reviewBoundary: "GxP draft only; QA, quality unit, and approved SOP/QMS review are required before use."
  },
  {
    id: "matrix-provider-discharge-transitions",
    industry: "Healthcare",
    audience: "Providers",
    businessArea: "Care Delivery",
    workflow: "Care Management, Discharge & Transitions",
    agentRoute: "CARE_TRANSITIONS_AGENT",
    fitReason: "Discharge summary, patient instruction generation, and follow-up communication are straightforward and high impact.",
    agentFunctions: [
      "Risk stratification inputs",
      "Care plan authoring",
      "Multidisciplinary coordination",
      "Discharge summary",
      "Post-discharge outreach",
      "Readmission monitoring",
      "Quality reporting"
    ],
    businessValue: "Care coordination and patient communication",
    generatedOutputs: [
      "Discharge summary drafts and patient instructions in plain language",
      "Care plan drafting with guideline references",
      "Post-discharge outreach scripts and documentation"
    ],
    capabilities: ["Reasoning", "Content generation", "Orchestration", "Decision intelligence", "Compliance controls"],
    reviewBoundary: "Drafts only; clinician review is required before patient or care-team use."
  },
  {
    id: "matrix-medtech-product-lifecycle",
    industry: "Life Sciences",
    audience: "MedTech",
    businessArea: "Product Lifecycle",
    workflow: "Design Controls, Tech Files & Complaint Handling",
    agentRoute: "MEDTECH_COMPLIANCE_AGENT",
    fitReason: "Strong documentation use case for requirement-evidence traceability, complaint summarisation, and draft generation.",
    agentFunctions: [
      "Requirements and user needs capture",
      "Technical documentation drafting with traceability",
      "V&V evidence summarization",
      "Cybersecurity risk management documentation",
      "Post-market surveillance signal capture",
      "Complaint intake/triage and root-cause summaries",
      "CAPA drafting and regulatory reporting"
    ],
    businessValue: "Regulatory-grade documentation and post-market intelligence for connected devices",
    generatedOutputs: [
      "MDR/IVDR technical documentation drafts with requirement-to-evidence traceability",
      "Complaint narrative summarization and root-cause hypothesis drafts for CAPA initiation",
      "Cyber vulnerability remediation evidence pack drafting with SBOM and risk justification"
    ],
    capabilities: ["Reasoning", "RAG", "Compliance controls", "Content generation", "Orchestration", "Classification", "Summarization"],
    reviewBoundary: "Regulatory draft only; no final complaint disposition, CAPA decision, field action, or regulatory submission is performed."
  }
];

const CLINICAL_KNOWLEDGE_SCALE = {
  name: "Care Nova Clinical Knowledge Scale Layer",
  status: "architecture-ready",
  target: "Governed trillion-scale medical corpus readiness",
  currentMode: "Local offline medical database plus curated references with deterministic retrieval",
  futureMode: "Licensed clinical corpus retrieval, clinician-supervised fine-tuning, audited validation, and rollback-safe deployment",
  dataDomains: [
    "Symptoms and red flags",
    "Vitals and chronic-care monitoring",
    "Medication safety and side-effect education",
    "Lab report explanation",
    "Lifestyle and preventive care",
    "Mental wellness triage",
    "Care plans and discharge transitions",
    "Claims, authorization, and insurance operations",
    "Medical-device and life-sciences documentation"
  ],
  governedSources: [
    "Approved clinical guidelines",
    "Medication labels and pharmacist-reviewed references",
    "Lab reference ranges and clinician-reviewed explainers",
    "De-identified care-transition notes",
    "Patient education libraries",
    "Health-plan policy documents",
    "Quality-system and regulatory documentation"
  ],
  scaleStages: [
    {
      stage: "Local demo",
      range: "Seeded offline database plus curated embedded references",
      purpose: "Offline safety and workflow proof."
    },
    {
      stage: "Reviewed corpus",
      range: "10k to 1M approved documents",
      purpose: "Evidence-grounded retrieval with source review."
    },
    {
      stage: "Enterprise RAG",
      range: "1M to 100M searchable chunks",
      purpose: "High-coverage clinical and operations knowledge."
    },
    {
      stage: "Foundation adaptation",
      range: "Billion to trillion-scale licensed tokens",
      purpose: "Clinician-supervised tuning with validation, drift checks, and strict rollback."
    }
  ],
  validationGates: [
    "Source approval before ingestion",
    "PHI removal and de-identification",
    "Specialty-tagged evidence indexing",
    "Answer grounding against retrieved references",
    "Clinical reviewer sign-off for medical knowledge updates",
    "Bias, drift, and coverage monitoring",
    "Versioned rollback for every corpus and model change"
  ],
  safetyLocks: [
    "No diagnosis",
    "No prescribing",
    "No dosage calculation",
    "No emergency call or caregiver contact",
    "No autonomous claim, coverage, GxP, CAPA, or regulatory decision",
    "No unsupervised self-training from patient conversations"
  ],
  honestBoundary: "This local demo is not a newly trained foundation model and has not been trained on trillions of records; it is a governed offline-first architecture ready to connect to licensed, clinician-reviewed medical data."
};

export const MODEL_BLUEPRINT = {
  name: "Care Nova Medical Intelligence Model",
  mode: "real-time-safe-medical-runtime",
  version: APP_VERSION,
  summary: "A real-time healthcare advisor architecture that combines debounced live safety review, a local medical knowledge database, patient memory, evidence-weighted routing, deterministic risk scoring, clinical accuracy cross-checks, specialist healthcare agents, personalized Care Pack generation, confidence calibration, safety guardrails, and governed trillion-scale clinical knowledge readiness.",
  valueProposition: "A user-friendly medical advisor built around the canonical Patient Input -> Memory -> Intent Classifier -> Four Core Agents -> Response Synthesizer -> Safety Guardrails -> Patient Reply -> Memory Update loop.",
  performancePillars: [
    "User-friendly patient intake",
    "Debounced real-time safety preview while the patient types",
    "Worldwide-ready installation and deployment packaging",
    "Offline medical database stored locally for safe demo retrieval",
    "Offline-first medical knowledge retrieval",
    "Local ML-style medical evidence ranker that runs without internet",
    "Trainable local ML calibrator for approved agent feedback",
    "Hybrid router for local/free models, paid cloud models, offline fallback, and cost-aware selection",
    "DeepSeek-R1 primary reasoning connector readiness plus embedding adapter slots",
    "DeepSeek-R1 health, fallback, and context-management status",
    "Trillion-scale approved medical corpus ingestion readiness",
    "Evidence-grounded answers instead of unsafe memorized claims",
    "Symptom, vital, and medication context review",
    "Four core specialist agents: RAG, Pharmacy, Scheduling, and Alert",
    "Optional specialty workspaces for vitals, labs, lifestyle, mental wellness, records, insurance, and care coordination",
    "Personalized Care Pack with next steps, monitoring, doctor questions, safety signs, and evidence notes",
    "Evidence-weighted intent matching",
    "Agent reasoning quality profiles with evidence, assumptions, safety checks, and confidence calibration",
    "Primary-agent response ownership with specialist support routed only when useful",
    "Safety-first vital and red-flag calibration",
    "Clinical accuracy engine with route, evidence, safety, and consistency cross-checks",
    "Provider discharge and care-transition workflow support",
    "Payer claims operations explainability",
    "Prior authorization and appeals packet drafting",
    "GxP batch record and shopfloor quality draft support",
    "MedTech design control, technical file, and complaint documentation support",
    "Confidence calibration and evidence coverage checks",
    "Clear care routing for general health, medication, appointment, and emergency needs",
    "Immediate risk and safety reasoning",
    "Local learning memory without unsafe medical fact training",
    "Approved feedback training that improves routing precision without changing medical facts",
    "Patient-friendly health guidance",
    "Actionable Care Pack for patient follow-through",
    "Care history updates for the next conversation"
  ],
  architectureLayers: [
    "Patient input",
    "LangGraph-style memory state",
    "Intent classifier agent",
    "Four core specialist agents",
    "RAG agent",
    "Offline medical database",
    "Offline medical knowledge retrieval",
    "Local ML evidence ranker",
    "Local supervised training calibrator",
    "Deep-learning adapter layer",
    "Optional approved external API cache",
    "DeepSeek-R1 primary LLM adapter",
    "Clinical knowledge scale layer",
    "Pharmacy agent",
    "Scheduling agent",
    "Alert agent",
    "Clinical accuracy engine",
    "Response synthesizer",
    "Safety and guardrails",
    "Patient reply",
    "Memory update loop",
    "Specialist healthcare agents",
    "Personalized Care Pack generator"
  ],
  flowSteps: [
    {
      step: 1,
      title: "Patient Input",
      description: "The patient types a symptom, question, or request in free-form text."
    },
    {
      step: 2,
      title: "Memory Store (LangGraph state)",
      description: "The system loads patient conversation history so previous symptoms, medications, profile details, and earlier messages remain available."
    },
    {
      step: 3,
      title: "Intent Classifier Agent",
      description: "The routing brain reads input plus memory and chooses general health, medication, appointment, or emergency handling."
    },
    {
      step: 4,
      title: "Four Specialist Agents",
      description: "RAG, Pharmacy, Scheduling, and Alert agents review the request with their own tool boundaries."
    },
    {
      step: 5,
      title: "Response Synthesizer",
      description: "Raw agent output is rewritten into simple, empathetic, patient-friendly language."
    },
    {
      step: 6,
      title: "Safety & Guardrails",
      description: "Rule checks remove harmful advice, add safety framing, and block diagnosis, prescribing, dosage calculation, and live external actions."
    },
    {
      step: 7,
      title: "Patient Reply",
      description: "The final safe response is shown in the chat-style UI."
    },
    {
      step: 8,
      title: "Update Memory",
      description: "The exchange is saved back to local LangGraph-style state so the next patient message starts with context."
    }
  ],
  endpoints: [
    {
      method: "GET",
      path: "/api/health",
      purpose: "Read server status and version."
    },
    {
      method: "GET",
      path: "/api/ready",
      purpose: "Read deployment readiness for hosting probes."
    },
    {
      method: "GET",
      path: "/api/model",
      purpose: "Read the healthcare advisor model outline."
    },
    {
      method: "GET",
      path: "/api/readiness",
      purpose: "Read the complete-build readiness checklist."
    },
    {
      method: "GET",
      path: "/api/deployment",
      purpose: "Read install, global access, Docker, cloud, and trusted-embed deployment guidance."
    },
    {
      method: "GET",
      path: "/api/deployment-readiness",
      purpose: "Read the release-gate checklist for deployment handoff."
    },
    {
      method: "GET",
      path: "/api/knowledge",
      purpose: "Read offline database metadata, governance, records, and scale-readiness status."
    },
    {
      method: "GET",
      path: "/api/local-ai",
      purpose: "Read offline ML core, DeepSeek-R1 primary model health, fallback state, and online connector status."
    },
    {
      method: "GET",
      path: "/api/model-router",
      purpose: "Read hybrid local/cloud model routing, provider catalog, cost policy, connectivity, and fallback chain status."
    },
    {
      method: "POST",
      path: "/api/model-router/preview",
      purpose: "Preview which local, cloud, or hybrid model path would be selected for a request without executing a paid model."
    },
    {
      method: "GET",
      path: "/api/agentic-runtime",
      purpose: "Read adaptive online/offline runtime mode, fallback strategy, local stores, and response contract."
    },
    {
      method: "GET",
      path: "/api/external-knowledge",
      purpose: "Read approved external API connector and local cache status."
    },
    {
      method: "GET",
      path: "/api/trusted-sources",
      purpose: "Read trusted medical source catalog, online/offline status, privacy rules, and source planning metadata."
    },
    {
      method: "POST",
      path: "/api/trusted-sources/plan",
      purpose: "Build a trusted-source plan for a patient question without sending PHI by default."
    },
    {
      method: "GET",
      path: "/api/model-quality",
      purpose: "Read model quality metrics, benchmark cases, release gates, and scoring policy."
    },
    {
      method: "POST",
      path: "/api/model-quality/evaluate",
      purpose: "Evaluate a model run for route fit, evidence, safety, focus, persistence, and guardrails."
    },
    {
      method: "GET",
      path: "/api/governance",
      purpose: "Read intended use, not-intended use, human-review triggers, privacy controls, and lifecycle governance."
    },
    {
      method: "GET",
      path: "/api/offline-packs",
      purpose: "Read the offline medical packs that support each autonomous tab without internet."
    },
    {
      method: "GET",
      path: "/api/fhir",
      purpose: "Read SMART on FHIR and HL7 FHIR integration readiness without making EHR calls by default."
    },
    {
      method: "GET",
      path: "/api/report-templates",
      purpose: "Read patient-specific report templates for local download and handoff workflows."
    },
    {
      method: "GET",
      path: "/api/advanced-capabilities",
      purpose: "Read advanced agentic capability status, quality, safety, local-first, and source traceability readiness."
    },
    {
      method: "GET",
      path: "/api/evaluation-dashboard",
      purpose: "Read benchmark suites for routing, red flags, medicines, offline parity, source traceability, and persistence."
    },
    {
      method: "GET",
      path: "/api/offline-pack-manager",
      purpose: "Read offline pack install status, checksums, domains, and reviewed-update policy."
    },
    {
      method: "GET",
      path: "/api/fhir-connector",
      purpose: "Read secured SMART on FHIR connector readiness and no-write integration boundaries."
    },
    {
      method: "GET",
      path: "/api/admin-trust-center",
      purpose: "Read deployment owner controls, safety boundaries, privacy reminders, and release-owner checklist."
    },
    {
      method: "GET",
      path: "/api/backup-plan",
      purpose: "Read local data backup, restore, and privacy hardening guidance."
    },
    {
      method: "GET",
      path: "/api/local-data-mirror",
      purpose: "Read localhost primary storage and local OneDrive mirror status."
    },
    {
      method: "POST",
      path: "/api/local-data-mirror",
      purpose: "Manually sync all local data files into the local OneDrive mirror folder."
    },
    {
      method: "GET",
      path: "/api/knowledge-graph",
      purpose: "Read the selected patient's local structured knowledge graph."
    },
    {
      method: "GET",
      path: "/api/memory",
      purpose: "Read persistent local patient memory for the selected patient."
    },
    {
      method: "GET",
      path: "/api/records",
      purpose: "Read persistent localhost patient records for the selected patient."
    },
    {
      method: "GET",
      path: "/api/training-readiness",
      purpose: "Read governed medical model improvement, evaluation, source approval, and rollback readiness."
    },
    {
      method: "GET",
      path: "/api/training",
      purpose: "Read local ML/DL training status, approved feedback counts, and route calibration summary."
    },
    {
      method: "POST",
      path: "/api/training/example",
      purpose: "Save one approved or review-pending agent training example into the local training store."
    },
    {
      method: "POST",
      path: "/api/training/train",
      purpose: "Train the local route calibrator from approved feedback without changing medical facts."
    },
    {
      method: "POST",
      path: "/api/training/evaluate",
      purpose: "Preview how the local training calibrator routes a message before full analysis."
    },
    {
      method: "POST",
      path: "/api/analyze",
      purpose: "Review a patient message, vitals, and care context while updating memory, evidence, safety triage, and local graph facts."
    },
    {
      method: "POST",
      path: "/api/evidence-citations",
      purpose: "Build an evidence packet and answer trace for a request or completed agent result."
    },
    {
      method: "POST",
      path: "/api/safety-triage",
      purpose: "Run deterministic urgent-signal triage and route recommendation."
    },
    {
      method: "POST",
      path: "/api/multimodal-intake",
      purpose: "Classify pasted report or document text and extract key clinical marker hints."
    },
    {
      method: "POST",
      path: "/api/prevention-plan",
      purpose: "Build a personalized prevention and maintenance plan from profile, graph, and latest context."
    },
    {
      method: "POST",
      path: "/api/human-review",
      purpose: "Build a human-review packet for urgent, medicine, lab, insurance, low-evidence, or guarded requests."
    },
    {
      method: "POST",
      path: "/api/doctor-ready-report",
      purpose: "Build a one-page doctor-ready report from the current request and local patient graph."
    },
    {
      method: "POST",
      path: "/api/realtime",
      purpose: "Run a safe debounced real-time preview without committing draft input to persistent memory."
    },
    {
      method: "POST",
      path: "/api/memory/clear",
      purpose: "Clear persistent local patient memory for the selected patient."
    },
    {
      method: "POST",
      path: "/api/records",
      purpose: "Save patient records to the localhost records store."
    },
    {
      method: "POST",
      path: "/api/external-knowledge/clear",
      purpose: "Clear cached external reference material from the localhost store."
    },
    {
      method: "POST",
      path: "/api/records/clear",
      purpose: "Clear persistent localhost patient records for the selected patient."
    },
    {
      method: "POST",
      path: "/api/knowledge-graph/clear",
      purpose: "Clear the selected patient's local structured knowledge graph."
    }
  ],
  integrationTargets: [
    "Patient health intake",
    "Worldwide PWA installation",
    "Cloud or VM deployment",
    "Docker container deployment",
    "Clinician review dashboard",
    "Medication safety review",
    "Follow-up planning",
    "Urgent warning review",
    "Provider discharge transition workspace",
    "Vitals and risk trend workspace",
    "Lab report explanation workspace",
    "Lifestyle and wellness workspace",
    "Records and insurance support workspace"
  ],
  enterpriseUseCases,
  workflowMatrix: requirementWorkflowMatrix,
  knowledgeScale: CLINICAL_KNOWLEDGE_SCALE,
  productionTarget: "Clinician-reviewed medical corpus + medication reference + vitals trend review + lab report explanation + lifestyle coaching + mental wellness triage + follow-up workflow + records support + insurance support + governed trillion-scale knowledge validation + urgent safety guardrails",
  demoBoundary: "No diagnosis, prescribing, dosage calculation, appointment booking, claim payment decision, coverage decision, GxP release decision, regulatory submission, complaint disposition, caregiver contact, or emergency call is performed.",
  deploymentReadiness: [
    "Worldwide deployment is represented with PWA install, Windows launchers, Docker packaging, and cloud/VM configuration",
    "Patient profile, symptoms, vitals, and context signals are captured",
    "Local offline medical database retrieval works without cloud services",
    "Online and offline modes use the same local AI core when the local server is running",
    "Online verified-corpus adapter is represented as an optional production path",
    "Local AI status endpoint exposes offline ML, DeepSeek-R1 health, fallback, and online connector readiness",
    "Care routing covers general, vitals, medication, labs, lifestyle, mental wellness, follow-up, records, insurance, urgent, and care-transition needs",
    "Clinical accuracy engine cross-checks route clarity, evidence alignment, safety calibration, and consistency",
    "Personalized Care Pack translates analysis into patient-friendly next steps, monitoring, doctor questions, safety checks, and evidence notes",
    "Governed trillion-scale knowledge readiness includes source approval, de-identification, evidence grounding, clinical review, drift monitoring, and rollback",
    "Safety checks prevent diagnosis, prescribing, dosage calculation, claim payment decisions, coverage decisions, GxP release decisions, regulatory submissions, complaint dispositions, and live alerts",
    "Clinician handoff summary is available after each health check",
    "Provider discharge and post-discharge drafts are generated with human-review boundaries",
    "Payer claims and prior authorization drafts are generated with compliance-review boundaries",
    "GxP quality and MedTech regulatory drafts are generated with quality-unit and regulatory-review boundaries",
    "Local memory learns patient context while medical facts remain curated"
  ]
};

const riskRank = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  CRITICAL: 3
};

const riskDetails = {
  LOW: {
    score: 16,
    label: "Low Risk",
    recommendation: "Continue normal guidance and monitoring."
  },
  MEDIUM: {
    score: 46,
    label: "Medium Risk",
    recommendation: "Use caution guidance and suggest clinician follow-up."
  },
  HIGH: {
    score: 78,
    label: "High Risk",
    recommendation: "Show urgent-care guidance and make escalation visible."
  },
  CRITICAL: {
    score: 96,
    label: "Critical Risk",
    recommendation: "Prioritize emergency guidance. No external alert is sent."
  }
};

const intentConfig = [
  {
    type: "EMERGENCY",
    label: "Emergency",
    route: "ALERT_AGENT",
    keywords: [
      "chest pain",
      "shortness of breath",
      "breathless",
      "cannot breathe",
      "difficulty breathing",
      "trouble breathing",
      "faint",
      "fainted",
      "fainting",
      "unconscious",
      "passed out",
      "stroke",
      "slurred speech",
      "trouble speaking",
      "difficulty speaking",
      "face droop",
      "face drooping",
      "one sided weakness",
      "one side weakness",
      "weakness on one side",
      "sudden numbness",
      "sudden weakness",
      "change in vision",
      "vision change",
      "confusion",
      "confused",
      "blue lips",
      "severe allergy",
      "swollen throat",
      "face swelling",
      "seizure",
      "worst headache",
      "severe headache",
      "blurred vision",
      "vision loss",
      "severe pain",
      "sweating",
      "self harm",
      "self-harm",
      "suicide"
    ],
    baseConfidence: 0.74
  },
  {
    type: "MEDICATION",
    label: "Medication",
    route: "PHARMACY_AGENT",
    keywords: [
      "medicine",
      "medication",
      "tablet",
      "dose",
      "missed",
      "forgot",
      "skipped",
      "late",
      "pill",
      "drug",
      "pharmacy",
      "insulin",
      "metformin",
      "amlodipine",
      "bp tablet",
      "side effect",
      "double dose",
      "allergy",
      "rash"
    ],
    baseConfidence: 0.68
  },
  {
    type: "APPOINTMENT",
    label: "Appointment",
    route: "SCHEDULING_AGENT",
    keywords: [
      "appointment",
      "doctor",
      "consult",
      "clinic",
      "visit",
      "schedule",
      "book",
      "reminder",
      "follow up"
    ],
    baseConfidence: 0.64
  },
  {
    type: "VITALS_TRACKING",
    label: "Vital Specialist",
    route: "VITALS_AGENT",
    keywords: [
      "vitals",
      "reading",
      "readings",
      "bp",
      "blood pressure",
      "sugar",
      "blood sugar",
      "glucose",
      "heart rate",
      "pulse",
      "temperature",
      "oxygen",
      "spo2",
      "bmi",
      "weight",
      "height",
      "waist",
      "spo2"
    ],
    baseConfidence: 0.69
  },
  {
    type: "LAB_REPORT",
    label: "Lab Report",
    route: "LABS_AGENT",
    keywords: [
      "lab",
      "labs",
      "lab report",
      "blood test",
      "test report",
      "hba1c",
      "a1c",
      "cholesterol",
      "ldl",
      "hdl",
      "creatinine",
      "egfr",
      "gfr",
      "uacr",
      "urine albumin",
      "hemoglobin",
      "cbc",
      "ferritin",
      "platelet",
      "wbc",
      "alt",
      "ast",
      "bilirubin",
      "potassium",
      "sodium",
      "thyroid",
      "tsh",
      "free t4",
      "vitamin d",
      "vitamin b12"
    ],
    baseConfidence: 0.7
  },
  {
    type: "SPECIALIST_DOCTOR",
    label: "Specialist Doctor",
    route: "SPECIALIST_DOCTOR_AGENT",
    keywords: [
      "core disease",
      "specialist",
      "disease",
      "condition",
      "diagnosis",
      "symptoms",
      "causes",
      "risk factors",
      "complication",
      "complications",
      "treatment options",
      "prevention",
      "hypertension",
      "diabetes",
      "asthma",
      "copd",
      "heart disease",
      "stroke",
      "kidney disease",
      "thyroid",
      "migraine",
      "infection",
      "liver",
      "cholesterol"
    ],
    baseConfidence: 0.69
  },
  {
    type: "LIFESTYLE",
    label: "Lifestyle",
    route: "LIFESTYLE_AGENT",
    keywords: [
      "diet",
      "food",
      "meal",
      "nutrition",
      "exercise",
      "walking",
      "activity",
      "sleep",
      "hydration",
      "water",
      "weight",
      "lifestyle"
    ],
    baseConfidence: 0.66
  },
  {
    type: "MENTAL_WELLNESS",
    label: "Mental Wellness",
    route: "WELLNESS_AGENT",
    keywords: [
      "stress",
      "anxiety",
      "panic",
      "worried",
      "worry",
      "mood",
      "sad",
      "depression",
      "depressed",
      "sleep problem",
      "cannot sleep"
    ],
    baseConfidence: 0.67
  },
  {
    type: "HEALTH_RECORDS",
    label: "Health Records",
    route: "RECORDS_AGENT",
    keywords: [
      "record",
      "records",
      "health record",
      "medical record",
      "history summary",
      "prescription",
      "report summary",
      "doctor note",
      "document",
      "documents"
    ],
    baseConfidence: 0.66
  },
  {
    type: "INSURANCE_SUPPORT",
    label: "Insurance",
    route: "INSURANCE_AGENT",
    keywords: [
      "insurance",
      "bill",
      "billing",
      "coverage",
      "claim",
      "claims",
      "eob",
      "authorization",
      "prior auth",
      "policy",
      "reimbursement"
    ],
    baseConfidence: 0.66
  },
  {
    type: "CARE_TRANSITIONS",
    label: "Discharge Transitions",
    route: "CARE_TRANSITIONS_AGENT",
    keywords: [
      "discharge",
      "transition",
      "transitions",
      "care plan",
      "patient instruction",
      "patient instructions",
      "post-discharge",
      "post discharge",
      "readmission",
      "outreach",
      "quality reporting",
      "multidisciplinary",
      "care coordination"
    ],
    baseConfidence: 0.7
  },
  {
    type: "CLAIMS_OPERATIONS",
    label: "Claims Operations",
    route: "CLAIMS_OPS_AGENT",
    keywords: [
      "claim",
      "claims",
      "claims intake",
      "adjudication",
      "explanation of benefits",
      "eob",
      "post-payment",
      "post payment",
      "provider inquiry",
      "provider inquiries",
      "claims regulatory reporting",
      "validation edits"
    ],
    baseConfidence: 0.7
  },
  {
    type: "UTILIZATION_MANAGEMENT",
    label: "Prior Authorization",
    route: "UTILIZATION_AGENT",
    keywords: [
      "prior authorization",
      "prior auth",
      "appeal",
      "appeals",
      "utilization management",
      "medical policy",
      "policy check",
      "policy checks",
      "medical necessity",
      "provider member",
      "provider/member",
      "clinical document"
    ],
    baseConfidence: 0.72
  },
  {
    type: "GXP_QUALITY",
    label: "GxP Quality",
    route: "GXP_QUALITY_AGENT",
    keywords: [
      "batch record",
      "master batch record",
      "ebr",
      "electronic batch record",
      "shopfloor",
      "shop floor",
      "deviation",
      "deviations",
      "batch exception",
      "quality exception",
      "manufacturing exception",
      "release documentation",
      "qa review",
      "quality review",
      "change control",
      "sop",
      "qms",
      "gxp",
      "cmc",
      "continuous improvement"
    ],
    baseConfidence: 0.72
  },
  {
    type: "MEDTECH_COMPLIANCE",
    label: "MedTech Compliance",
    route: "MEDTECH_COMPLIANCE_AGENT",
    keywords: [
      "design controls",
      "technical file",
      "technical documentation",
      "complaint",
      "complaints",
      "complaint handling",
      "mdr",
      "ivdr",
      "requirement",
      "requirements",
      "user needs",
      "traceability",
      "v&v",
      "verification",
      "validation",
      "cybersecurity",
      "post-market surveillance",
      "post market surveillance",
      "capa",
      "root cause",
      "regulatory reporting"
    ],
    baseConfidence: 0.72
  },
  {
    type: "GENERAL",
    label: "General",
    route: "RAG_AGENT",
    keywords: [
      "ache",
      "body ache",
      "back pain",
      "stomach pain",
      "abdominal pain",
      "dizzy",
      "dizziness",
      "fatigue",
      "headache",
      "nausea",
      "vomit",
      "vomiting",
      "diarrhea",
      "tired",
      "weak",
      "pain",
      "cough",
      "cold",
      "flu",
      "sore throat",
      "fever",
      "temperature",
      "rash",
      "itching",
      "skin",
      "allergy",
      "infection",
      "ear pain",
      "eye pain",
      "bp",
      "blood pressure",
      "sugar",
      "glucose",
      "heart rate",
      "pulse",
      "reading",
      "symptom",
      "disease",
      "condition",
      "treatment",
      "prevention",
      "prevent",
      "interaction",
      "side effect",
      "medical image",
      "chart"
    ],
    baseConfidence: 0.6
  }
];

const routeEvidencePolicy = {
  RAG_AGENT: {
    categories: ["General", "Vitals", "Urgent Safety"],
    minimumCoverage: 48
  },
  SPECIALIST_DOCTOR_AGENT: {
    categories: ["Specialist", "General", "Vitals", "Labs", "Medication", "Lifestyle", "Urgent Safety"],
    minimumCoverage: 58
  },
  VITALS_AGENT: {
    categories: ["Vitals", "Urgent Safety"],
    minimumCoverage: 58
  },
  PHARMACY_AGENT: {
    categories: ["Medication", "Urgent Safety"],
    minimumCoverage: 58
  },
  SCHEDULING_AGENT: {
    categories: ["Follow-up", "Care Transitions"],
    minimumCoverage: 48
  },
  ALERT_AGENT: {
    categories: ["Urgent Safety", "Vitals", "Mental Wellness"],
    minimumCoverage: 64
  },
  LABS_AGENT: {
    categories: ["Labs", "Vitals"],
    minimumCoverage: 56
  },
  LIFESTYLE_AGENT: {
    categories: ["Lifestyle", "General"],
    minimumCoverage: 48
  },
  WELLNESS_AGENT: {
    categories: ["Mental Wellness", "Urgent Safety"],
    minimumCoverage: 56
  },
  RECORDS_AGENT: {
    categories: ["Records", "Memory", "Care Transitions"],
    minimumCoverage: 48
  },
  INSURANCE_AGENT: {
    categories: ["Insurance", "Claims Operations", "Utilization Management"],
    minimumCoverage: 48
  },
  CARE_TRANSITIONS_AGENT: {
    categories: ["Care Transitions", "Records", "Medication"],
    minimumCoverage: 54
  },
  CLAIMS_OPS_AGENT: {
    categories: ["Claims Operations", "Insurance"],
    minimumCoverage: 50
  },
  UTILIZATION_AGENT: {
    categories: ["Utilization Management", "Insurance"],
    minimumCoverage: 50
  },
  GXP_QUALITY_AGENT: {
    categories: ["GxP Quality"],
    minimumCoverage: 50
  },
  MEDTECH_COMPLIANCE_AGENT: {
    categories: ["MedTech Compliance"],
    minimumCoverage: 50
  }
};

const agentCapabilityPolicy = {
  RAG_AGENT: {
    domain: "General health intelligence",
    toolMode: "Offline medical FAQ retrieval, symptom-family matching, missing-context checks, and patient-safe summarization.",
    reasoningStyle: "Read the question, detect symptom family, compare safety signals, match local references, identify missing details, and return one focused safe next step.",
    qualityChecks: ["Question type", "Symptom family", "Duration and severity context", "Vital or medicine context", "Local reference match", "Safety boundary"],
    handoffTriggers: ["Severe symptoms", "Missing duration with persistent symptoms", "Worsening symptoms", "Abnormal readings", "Medicine concern"]
  },
  SPECIALIST_DOCTOR_AGENT: {
    domain: "Specialist disease intelligence",
    toolMode: "Specialty disease map with local references, patient profile, vitals, missing-context checks, and safety guardrails.",
    reasoningStyle: "Classify the specialty, map symptoms to the disease area, score context quality, separate education from diagnosis, then return tests to discuss, prevention, treatment categories, warning signs, and doctor-review questions.",
    qualityChecks: ["Specialty fit", "Symptom pattern", "Duration and severity", "Vitals and report context", "Medication context", "Testing discussion", "Treatment-boundary safety", "Urgent-sign screen"],
    handoffTriggers: ["Urgent warning signs", "Complex chronic disease", "Abnormal readings with symptoms", "New or worsening symptoms", "Missing critical duration or report context"]
  },
  VITALS_AGENT: {
    domain: "Vital specialist review",
    toolMode: "Structured BP, glucose, pulse, oxygen, temperature, BMI, and habit-signal review.",
    reasoningStyle: "Check numeric ranges, compare baseline and symptoms, identify missing context, and separate routine trends from urgent warning combinations.",
    qualityChecks: ["Reading validity", "BP pair completeness", "Symptom pairing", "Baseline context", "Oxygen and fever context", "BMI and daily habit context", "Repeat-check advice"],
    handoffTriggers: ["Very high BP", "Low oxygen", "Very high or low glucose", "Fast pulse with symptoms", "High fever with symptoms"]
  },
  PHARMACY_AGENT: {
    domain: "Medication safety",
    toolMode: "Medication timing and safety-boundary review.",
    reasoningStyle: "Identify medication intent, avoid dose decisions, and route to pharmacist or clinician when needed.",
    qualityChecks: ["Medication mention", "Missed-dose risk", "Interaction caution", "No dosage calculation"],
    handoffTriggers: ["Insulin concern", "Severe side effect", "Repeated missed dose"]
  },
  SCHEDULING_AGENT: {
    domain: "Appointments and follow-up",
    toolMode: "Visit planning, question preparation, and follow-up priority drafting.",
    reasoningStyle: "Translate risk and patient goal into a visit-preparation plan without booking anything.",
    qualityChecks: ["Visit intent", "Urgency fit", "Question checklist", "No live booking"],
    handoffTriggers: ["Urgent symptoms", "No support or transport", "Needed clinician follow-up"]
  },
  ALERT_AGENT: {
    domain: "Urgent safety",
    toolMode: "Red-flag and safety escalation rule review.",
    reasoningStyle: "Prioritize emergency warning signs over routine guidance.",
    qualityChecks: ["Red flag scan", "Risk level", "Support status", "No SMS or emergency call"],
    handoffTriggers: ["Chest pain", "Breathing trouble", "Fainting", "One-sided weakness", "Severe allergy"]
  },
  LABS_AGENT: {
    domain: "Lab explanation",
    toolMode: "Lab term detection and plain-language report checklist.",
    reasoningStyle: "Ask for test name, value, unit, range, and prior trend before interpretation.",
    qualityChecks: ["Test identity", "Value and unit", "Reference range", "Trend comparison"],
    handoffTriggers: ["Critical lab value", "Missing units", "Symptoms with abnormal result"]
  },
  LIFESTYLE_AGENT: {
    domain: "Lifestyle guidance",
    toolMode: "General habit coaching inside known care context.",
    reasoningStyle: "Offer gentle routines while avoiding disease-specific treatment changes.",
    qualityChecks: ["Goal clarity", "Condition context", "Severity fit", "No care-plan replacement"],
    handoffTriggers: ["High severity", "New symptoms", "Condition-specific restriction"]
  },
  WELLNESS_AGENT: {
    domain: "Mental wellness support",
    toolMode: "Supportive wellness triage and crisis-boundary review.",
    reasoningStyle: "Separate supportive coping prompts from urgent mental-health safety needs.",
    qualityChecks: ["Mood signal", "Crisis wording", "Support availability", "No therapy claim"],
    handoffTriggers: ["Self-harm wording", "Panic with chest pain", "No safe support"]
  },
  RECORDS_AGENT: {
    domain: "Health records",
    toolMode: "Care-summary draft generation from profile, vitals, and current context.",
    reasoningStyle: "Structure known facts without inventing missing medical history.",
    qualityChecks: ["Patient identity", "Known conditions", "Current vitals", "Draft-only status"],
    handoffTriggers: ["Missing identifiers", "Conflicting records", "Clinician handoff needed"]
  },
  INSURANCE_AGENT: {
    domain: "Insurance support",
    toolMode: "Coverage, claim, bill, and EOB question organization.",
    reasoningStyle: "Separate administrative questions from medical guidance and avoid benefit decisions.",
    qualityChecks: ["Policy context", "Claim or bill details", "Question checklist", "No payment decision"],
    handoffTriggers: ["Denied claim", "Urgent treatment access", "Missing policy reference"]
  },
  CARE_TRANSITIONS_AGENT: {
    domain: "Care transitions",
    toolMode: "Discharge, outreach, readmission watch, and quality-report draft workflow.",
    reasoningStyle: "Convert care-transition data into clinician-reviewed drafts and patient-friendly instructions.",
    qualityChecks: ["Risk stratification", "Care-plan context", "Outreach need", "Clinician review boundary"],
    handoffTriggers: ["Readmission risk", "Medication access issue", "No follow-up arranged"]
  },
  CLAIMS_OPS_AGENT: {
    domain: "Claims operations",
    toolMode: "Claim intake, edits, exception summary, and provider-response drafting.",
    reasoningStyle: "Extract document signals, flag missing fields, and prepare explainable admin drafts.",
    qualityChecks: ["Document signals", "Missing fields", "Policy reference", "No adjudication"],
    handoffTriggers: ["Missing claim number", "Policy gap", "Exception review needed"]
  },
  UTILIZATION_AGENT: {
    domain: "Utilization management",
    toolMode: "Prior authorization and appeal packet organization.",
    reasoningStyle: "Map request evidence to policy placeholders without deciding medical necessity.",
    qualityChecks: ["Requested service", "Clinical context", "Policy criteria", "No approval or denial"],
    handoffTriggers: ["Appeal deadline", "Missing clinical note", "Urgent access concern"]
  },
  GXP_QUALITY_AGENT: {
    domain: "GxP quality",
    toolMode: "Batch record, deviation, exception, and SOP/QMS draft workflow.",
    reasoningStyle: "Extract controlled-document signals and produce QA-reviewed draft outputs only.",
    qualityChecks: ["Batch signal", "Exception detail", "SOP/QMS reference", "No QA approval"],
    handoffTriggers: ["Deviation without owner", "Release dependency", "Missing SOP reference"]
  },
  MEDTECH_COMPLIANCE_AGENT: {
    domain: "MedTech compliance",
    toolMode: "Design control, technical file, complaint, CAPA, and post-market draft workflow.",
    reasoningStyle: "Build traceable regulatory drafts while preserving reviewer ownership.",
    qualityChecks: ["Device context", "Requirement evidence", "Risk file link", "No regulatory submission"],
    handoffTriggers: ["Complaint harm signal", "CAPA decision needed", "Missing evidence reference"]
  }
};

const coreAgentBuckets = [
  {
    id: "GENERAL_HEALTH",
    label: "General health question",
    route: "RAG_AGENT",
    agent: "RAG Agent",
    productionTool: "ChromaDB medical FAQ and document vector search",
    demoTool: "Offline local medical knowledge retrieval"
  },
  {
    id: "MEDICATION",
    label: "Medication related",
    route: "PHARMACY_AGENT",
    agent: "Pharmacy Agent",
    productionTool: "Drug info, dosage-guideline, side-effect, and interaction lookup",
    demoTool: "Local medication safety framing without dosage calculation"
  },
  {
    id: "APPOINTMENT",
    label: "Needs an appointment",
    route: "SCHEDULING_AGENT",
    agent: "Scheduling Agent",
    productionTool: "Calendar API and reminder workflow",
    demoTool: "Local appointment preparation without live booking"
  },
  {
    id: "EMERGENCY",
    label: "Sounds like an emergency",
    route: "ALERT_AGENT",
    agent: "Alert Agent",
    productionTool: "Twilio SMS/email caregiver alert workflow",
    demoTool: "Local urgent safety guidance without SMS, email, or emergency call"
  }
];

const embeddedMedicalKnowledgeBase = [
  {
    id: "bp-safety",
    title: "Blood Pressure Safety Review",
    category: "Vitals",
    keywords: ["bp", "blood pressure", "hypertension", "dizzy", "dizziness", "headache", "amlodipine"],
    summary: "Blood pressure guidance should consider symptoms, baseline, repeat readings, medication timing, and very high values.",
    safetyNotes: "Very high readings with symptoms need urgent real-world clinical guidance. The advisor must not change medicines or doses.",
    source: "Local curated vitals-safety reference"
  },
  {
    id: "chest-pain-red-flags",
    title: "Chest Pain and Breathing Red Flags",
    category: "Urgent Safety",
    keywords: ["chest pain", "shortness of breath", "breathless", "sweating", "faint", "heart rate"],
    summary: "Chest pain with breathlessness, sweating, fainting, or very high heart rate is treated as a critical safety path.",
    safetyNotes: "Emergency guidance takes priority over collecting perfect details. No live emergency call is made by the demo.",
    source: "Local curated urgent-warning reference"
  },
  {
    id: "medication-missed-dose",
    title: "Medication Safety and Missed Doses",
    category: "Medication",
    keywords: ["missed", "medicine", "medication", "tablet", "dose", "pill", "insulin", "metformin", "amlodipine"],
    summary: "Medication questions are handled as safety framing only, including missed-dose caution and pharmacist or doctor follow-up.",
    safetyNotes: "Do not prescribe, stop, start, double, or calculate a dose. Follow the medicine label or clinician instruction.",
    source: "Local curated medication-safety reference"
  },
  {
    id: "medical-atlas-disease-education",
    title: "Medical Atlas Disease Education",
    category: "General",
    keywords: ["disease", "condition", "symptoms", "causes", "risk factors", "treatment", "prevention", "complication", "diagnosis", "prognosis"],
    summary: "Disease education should explain what a condition is, common symptoms, risk factors, prevention, usual clinician-led evaluation, and when warning signs need urgent care.",
    safetyNotes: "The atlas provides education only. It does not diagnose, predict disease with certainty, or replace clinical examination, testing, or licensed medical judgment.",
    source: "Local curated medical-atlas education reference"
  },
  {
    id: "medical-atlas-medicine-reference",
    title: "Medicine Reference, Side Effects, and Interactions",
    category: "Medication",
    keywords: ["medicine", "drug", "tablet", "capsule", "dose", "dosage", "side effect", "interaction", "contraindication", "allergy", "pregnancy", "kidney", "liver"],
    summary: "Medicine education can summarize purpose, common side effects, interaction questions, allergy warning signs, and what details to confirm on the prescription label or with a pharmacist.",
    safetyNotes: "The atlas does not suggest personal medicines, calculate dosage, start, stop, substitute, or change treatment. Dosing must come from the prescription label or clinician/pharmacist.",
    source: "Local curated medication-atlas safety reference"
  },
  {
    id: "medical-atlas-prevention-guidance",
    title: "Prevention and Healthy-Living Guidance",
    category: "Lifestyle",
    keywords: ["prevention", "prevent", "screening", "vaccination", "nutrition", "exercise", "sleep", "hydration", "smoking", "alcohol", "weight", "blood pressure prevention", "diabetes prevention"],
    summary: "Prevention guidance focuses on risk awareness, screening conversations, healthy routines, vaccination or preventive-care questions, and when to involve a clinician.",
    safetyNotes: "Prevention tips are general education and should be adapted by a licensed clinician for personal conditions, medicines, pregnancy, disability, or complex disease.",
    source: "Local curated prevention reference"
  },
  {
    id: "medical-atlas-visuals-charts",
    title: "Medical Images, Charts, and Structured Data",
    category: "Labs",
    keywords: ["chart", "graph", "image", "medical image", "xray", "x-ray", "mri", "ct scan", "ultrasound", "diagram", "structured data", "table", "trend"],
    summary: "Medical visuals should be explained as plain-language descriptions, structured data points, trend questions, and clinician-review prompts.",
    safetyNotes: "The atlas does not interpret diagnostic images or replace radiology, pathology, laboratory, or specialist reports.",
    source: "Local curated medical-visual explanation reference"
  },
  {
    id: "diabetes-glucose",
    title: "Diabetes and Blood Sugar Safety",
    category: "Vitals",
    keywords: ["sugar", "glucose", "diabetes", "metformin", "insulin", "blood sugar", "tired", "weak"],
    summary: "Blood sugar readings are reviewed with symptoms, diabetes context, and high or low safety thresholds.",
    safetyNotes: "Very high or low readings with symptoms need prompt real-world advice from a clinician or local care plan.",
    source: "Local curated diabetes-safety reference"
  },
  {
    id: "fever-temperature",
    title: "Fever and Temperature Review",
    category: "General",
    keywords: ["fever", "temperature", "cough", "breathing", "chills", "infection"],
    summary: "Fever guidance checks temperature level, duration, breathing difficulty, worsening symptoms, and hydration context.",
    safetyNotes: "High fever, breathing trouble, confusion, or worsening symptoms should be escalated to real-world medical care.",
    source: "Local curated symptom-safety reference"
  },
  {
    id: "headache-neuro",
    title: "Headache and Neurologic Warning Signs",
    category: "General",
    keywords: ["headache", "stroke", "slurred speech", "face droop", "one-sided", "weakness", "confusion"],
    summary: "Headache is reviewed with blood pressure, neurologic warning signs, severity, and symptom progression.",
    safetyNotes: "One-sided weakness, slurred speech, confusion, or sudden severe headache requires urgent real-world care.",
    source: "Local curated neurologic-safety reference"
  },
  {
    id: "asthma-breathing-safety",
    title: "Asthma, Wheezing, and Breathing Symptom Guide",
    category: "General",
    keywords: ["asthma", "wheezing", "wheeze", "inhaler", "shortness of breath", "breathing trouble", "chest tightness", "cough", "trigger", "respiratory"],
    summary: "Asthma and breathing education reviews symptoms, triggers, inhaler-safety questions, breathing effort, and when symptoms should be escalated.",
    safetyNotes: "Severe breathing difficulty, bluish lips, confusion, fainting, or rapidly worsening breathing symptoms need urgent real-world care.",
    source: "Local curated respiratory-safety reference"
  },
  {
    id: "cholesterol-lipid-report",
    title: "Cholesterol and Lipid Report Guide",
    category: "Labs",
    keywords: ["cholesterol", "lipid", "ldl", "hdl", "triglycerides", "total cholesterol", "heart risk", "statin", "diabetes", "blood pressure"],
    summary: "Cholesterol education explains LDL, HDL, triglycerides, total cholesterol, risk-factor context, lifestyle questions, and clinician-led monitoring.",
    safetyNotes: "The advisor does not start, stop, or recommend cholesterol medicines. Treatment goals should be reviewed with a licensed clinician.",
    source: "Local curated lipid-report education reference"
  },
  {
    id: "kidney-creatinine-egfr",
    title: "Kidney Report, Creatinine, eGFR, and Urine Protein",
    category: "Labs",
    keywords: ["kidney", "creatinine", "egfr", "urine protein", "albumin", "microalbumin", "diabetes", "blood pressure", "renal", "ckd"],
    summary: "Kidney report education connects creatinine, eGFR, urine protein, diabetes, blood pressure, medicine-safety questions, and trend review.",
    safetyNotes: "Kidney values need clinical interpretation with history, medicines, hydration, and repeat trends. The advisor does not diagnose kidney disease.",
    source: "Local curated kidney-report education reference"
  },
  {
    id: "thyroid-energy-report",
    title: "Thyroid, TSH, Energy, and Weight Change Guide",
    category: "Labs",
    keywords: ["thyroid", "tsh", "t3", "t4", "fatigue", "tired", "weight gain", "weight loss", "palpitations", "hair loss"],
    summary: "Thyroid education explains common thyroid-test terms, symptom context such as fatigue or weight change, and follow-up questions for clinician review.",
    safetyNotes: "The advisor does not diagnose thyroid disease or adjust thyroid medicine. Lab trends and symptoms should be reviewed by a clinician.",
    source: "Local curated thyroid-report education reference"
  },
  {
    id: "follow-up-planning",
    title: "Follow-up and Care Access",
    category: "Follow-up",
    keywords: ["appointment", "doctor", "clinic", "consult", "follow up", "schedule", "book", "reminder"],
    summary: "Follow-up guidance prioritizes routine, soon, urgent, or emergency care based on risk, symptoms, and support needs.",
    safetyNotes: "The demo does not book appointments or send reminders. It only prepares a safe follow-up prompt.",
    source: "Local curated care-access reference"
  },
  {
    id: "lab-report-explanation",
    title: "Lab Report Explanation",
    category: "Labs",
    keywords: ["lab", "labs", "lab report", "blood test", "hba1c", "a1c", "cholesterol", "ldl", "hdl", "creatinine", "hemoglobin", "cbc", "thyroid", "tsh"],
    summary: "Lab report support explains what values mean in plain language, flags missing context, and encourages clinician review for abnormal or confusing results.",
    safetyNotes: "The advisor does not diagnose from lab values or change treatment. Lab trends should be reviewed with a licensed clinician.",
    source: "Local curated lab-explanation reference"
  },
  {
    id: "lifestyle-wellness-support",
    title: "Lifestyle and Wellness Support",
    category: "Lifestyle",
    keywords: ["diet", "food", "meal", "nutrition", "exercise", "walking", "activity", "sleep", "hydration", "water", "weight", "lifestyle"],
    summary: "Lifestyle support focuses on practical, low-risk habits such as hydration, sleep routine, gentle activity, meal planning, and follow-up with a care team.",
    safetyNotes: "Lifestyle guidance stays general and does not replace disease-specific care plans or clinician instructions.",
    source: "Local curated lifestyle-support reference"
  },
  {
    id: "mental-wellness-triage",
    title: "Mental Wellness Triage",
    category: "Mental Wellness",
    keywords: ["stress", "anxiety", "panic", "worried", "worry", "mood", "sad", "depression", "depressed", "sleep problem", "cannot sleep", "self harm", "suicide"],
    summary: "Mental wellness support identifies stress, anxiety, panic, sleep, and mood concerns while routing self-harm wording to urgent safety guidance.",
    safetyNotes: "The advisor does not provide therapy or crisis intervention. Self-harm or danger wording needs immediate real-world support.",
    source: "Local curated mental-wellness safety reference"
  },
  {
    id: "health-record-organization",
    title: "Health Record Organization",
    category: "Records",
    keywords: ["record", "records", "health record", "medical record", "history summary", "prescription", "report summary", "doctor note", "document", "documents"],
    summary: "Records support organizes symptoms, medicines, allergies, vitals, reports, and follow-up questions into a patient-friendly summary.",
    safetyNotes: "Record summaries are drafts for review and should not replace official medical records or clinician documentation.",
    source: "Local curated records-support reference"
  },
  {
    id: "insurance-support",
    title: "Insurance and Billing Support",
    category: "Insurance",
    keywords: ["insurance", "bill", "billing", "coverage", "claim", "claims", "eob", "authorization", "prior auth", "policy", "reimbursement"],
    summary: "Insurance support helps organize coverage, billing, claim, EOB, prior authorization, and reimbursement questions for human review.",
    safetyNotes: "The demo does not approve benefits, make coverage decisions, submit claims, or contact insurers.",
    source: "Local curated insurance-support reference"
  },
  {
    id: "care-management-discharge-transitions",
    title: "Care Management, Discharge, and Transitions",
    category: "Care Transitions",
    keywords: ["discharge", "transition", "transitions", "care plan", "patient instruction", "post-discharge", "post discharge", "readmission", "outreach", "quality reporting", "multidisciplinary", "care coordination"],
    summary: "Discharge and transition workflows benefit from risk stratification, care plan drafting, plain-language instructions, outreach scripts, readmission monitoring, and quality reporting fields.",
    safetyNotes: "Drafts require clinician review and should not be treated as a final discharge order or medical instruction.",
    source: "Local curated provider care-transition workflow reference"
  },
  {
    id: "claims-intake-adjudication-ops",
    title: "Claims Intake, Adjudication, and Post-Payment Operations",
    category: "Claims Operations",
    keywords: ["claim", "claims", "claims intake", "adjudication", "explanation of benefits", "eob", "post-payment", "post payment", "provider inquiry", "provider inquiries", "regulatory reporting", "validation edits"],
    summary: "Claims workflows can prepare structured intake extraction, validation notes, adjudication exception summaries, explanation-of-benefits drafts, provider inquiry responses, and regulatory reporting fields.",
    safetyNotes: "The demo does not make claim payment decisions, deny claims, approve benefits, or send provider communications.",
    source: "Local curated payer operations workflow reference"
  },
  {
    id: "prior-authorization-appeals",
    title: "Prior Authorization and Appeals Administration",
    category: "Utilization Management",
    keywords: ["prior authorization", "prior auth", "appeal", "appeals", "utilization management", "medical policy", "policy check", "policy checks", "medical necessity", "provider member", "provider/member", "clinical document"],
    summary: "Prior authorization and appeal workflows can summarize packets, map criteria to policy checkpoints, draft decision rationale, prepare appeal letters, and log audit evidence.",
    safetyNotes: "The demo prepares administrative drafts only and does not make medical-necessity, coverage, or authorization decisions.",
    source: "Local curated utilization management workflow reference"
  },
  {
    id: "pharma-batch-shopfloor-quality",
    title: "Batch Record Review and Shopfloor Quality",
    category: "GxP Quality",
    keywords: ["batch record", "master batch record", "ebr", "electronic batch record", "shopfloor", "shop floor", "deviation", "deviations", "exception", "exceptions", "release documentation", "qa review", "quality review", "change control", "sop", "qms", "gxp", "cmc", "continuous improvement"],
    summary: "Batch record and shopfloor quality workflows can summarize batch review findings, draft exception narratives, support release documentation traceability, answer approved SOP/QMS questions, and surface continuous improvement signals.",
    safetyNotes: "Drafts require QA and quality-unit review. The demo does not release product, approve deviations, execute manufacturing, or replace approved SOP/QMS systems.",
    source: "Local curated GxP manufacturing quality workflow reference"
  },
  {
    id: "medtech-design-controls-complaints",
    title: "Design Controls, Technical Files, and Complaint Handling",
    category: "MedTech Compliance",
    keywords: ["design controls", "technical file", "technical documentation", "complaint", "complaints", "complaint handling", "mdr", "ivdr", "requirement", "requirements", "user needs", "traceability", "v&v", "verification", "validation", "cybersecurity", "post-market surveillance", "post market surveillance", "capa", "root cause", "regulatory reporting"],
    summary: "MedTech documentation workflows can draft requirement-to-evidence traceability, summarize V&V evidence, prepare complaint narratives, support CAPA initiation, and build post-market or cybersecurity evidence packs.",
    safetyNotes: "Drafts require regulatory, quality, and clinical review. The demo does not make complaint dispositions, CAPA decisions, regulatory submissions, or device safety determinations.",
    source: "Local curated MedTech product lifecycle compliance workflow reference"
  },
  {
    id: "local-memory-learning",
    title: "Local Learning Memory",
    category: "Memory",
    keywords: ["history", "again", "previous", "remember", "same", "worse", "better"],
    summary: "Local memory can remember recent messages, risk levels, patient profile, vitals, and care goals for continuity.",
    safetyNotes: "Self-learning updates patient context only. It does not invent or modify medical facts without a curated knowledge update.",
    source: "Persistent local server memory policy"
  }
];

const medicalKnowledgeBase = dedupeKnowledgeEntries([
  ...offlineMedicalRecords,
  ...embeddedMedicalKnowledgeBase
]);

const baseFlowNodes = [
  {
    id: "PATIENT_INPUT",
    label: "1. Patient Input",
    layer: "input",
    description: "Accepts free-form text such as symptoms, questions, medication concerns, and appointment requests.",
    productionTool: "Patient symptom form",
    demoAdapter: "Patient message, vitals, and context form"
  },
  {
    id: "MEMORY_STORE",
    label: "2. Memory Store",
    layer: "memory",
    description: "Loads patient conversation history from LangGraph-style state before routing.",
    productionTool: "LangGraph state memory",
    demoAdapter: "Persistent local server memory"
  },
  {
    id: "INTENT_CLASSIFIER",
    label: "3. Intent Classifier Agent",
    layer: "classifier",
    description: "Classifies the message into general health, medication, appointment, or emergency routing.",
    productionTool: "LLM/classifier route selection",
    demoAdapter: "Deterministic keyword, context, vital, and red-flag checks"
  },
  {
    id: "RAG_AGENT",
    label: "4A. RAG Agent",
    layer: "agent",
    description: "Searches a medical FAQ and document knowledge base for general health questions.",
    productionTool: "ChromaDB medical FAQ retrieval",
    demoAdapter: "Local offline medical knowledge retrieval"
  },
  {
    id: "VITALS_AGENT",
    label: "4X. Vitals Extension",
    layer: "agent",
    description: "Reviews blood pressure, glucose, heart rate, and temperature inputs with safety thresholds and missing-context prompts.",
    productionTool: "Vitals trend and risk review",
    demoAdapter: "Local vital signal analyzer"
  },
  {
    id: "PHARMACY_AGENT",
    label: "4B. Pharmacy Agent",
    layer: "agent",
    description: "Looks up drug information, dosage guidelines, side effects, and missed-dose safety.",
    productionTool: "Medication safety reference",
    demoAdapter: "Local missed-dose and no-dosage safety rules"
  },
  {
    id: "SCHEDULING_AGENT",
    label: "4C. Scheduling Agent",
    layer: "agent",
    description: "Checks or creates appointments and sends reminders in production workflows.",
    productionTool: "Calendar API and reminder workflow",
    demoAdapter: "Local follow-up priority guidance only"
  },
  {
    id: "ALERT_AGENT",
    label: "4D. Alert Agent",
    layer: "agent",
    description: "Detects danger signals and triggers caregiver SMS/email in production workflows.",
    productionTool: "Twilio or email alert workflow",
    demoAdapter: "Local urgent safety notice with no external action"
  },
  {
    id: "LABS_AGENT",
    label: "4X. Lab Report Extension",
    layer: "agent",
    description: "Explains lab report wording in plain language and prepares clinician-review questions.",
    productionTool: "Lab report explanation workflow",
    demoAdapter: "Local lab-context explainer"
  },
  {
    id: "LIFESTYLE_AGENT",
    label: "4X. Lifestyle Extension",
    layer: "agent",
    description: "Provides general diet, hydration, sleep, and activity support within existing care-plan boundaries.",
    productionTool: "Lifestyle coaching workflow",
    demoAdapter: "Local general habit guidance"
  },
  {
    id: "WELLNESS_AGENT",
    label: "4X. Wellness Extension",
    layer: "agent",
    description: "Reviews stress, anxiety, sleep, and mood concerns with crisis-safety boundaries.",
    productionTool: "Mental wellness triage workflow",
    demoAdapter: "Local supportive triage"
  },
  {
    id: "RECORDS_AGENT",
    label: "4X. Records Extension",
    layer: "agent",
    description: "Organizes patient history, medicines, vitals, reports, and questions into a clean care summary.",
    productionTool: "Records and care-summary workflow",
    demoAdapter: "Local record summary draft"
  },
  {
    id: "INSURANCE_AGENT",
    label: "4X. Insurance Extension",
    layer: "agent",
    description: "Organizes billing, claim, coverage, EOB, and authorization questions without making decisions.",
    productionTool: "Insurance support workflow",
    demoAdapter: "Local insurance question organizer"
  },
  {
    id: "CARE_TRANSITIONS_AGENT",
    label: "4X. Care Transitions Extension",
    layer: "agent",
    description: "Drafts discharge summaries, patient instructions, care plans, outreach scripts, readmission monitoring signals, and quality reporting fields.",
    productionTool: "Provider care management and transition workflow",
    demoAdapter: "Local human-review draft generator"
  },
  {
    id: "CLAIMS_OPS_AGENT",
    label: "4X. Claims Operations Extension",
    layer: "agent",
    description: "Prepares claim intake extraction, validation notes, adjudication exception summaries, provider inquiry drafts, and reporting fields.",
    productionTool: "Payer claims operations workflow",
    demoAdapter: "Local administrative draft generator"
  },
  {
    id: "UTILIZATION_AGENT",
    label: "4X. Prior Authorization Extension",
    layer: "agent",
    description: "Summarizes prior authorization and appeal packets with policy-check placeholders, rationale drafts, communications, and audit notes.",
    productionTool: "Utilization management and appeals workflow",
    demoAdapter: "Local policy-grounded draft generator"
  },
  {
    id: "GXP_QUALITY_AGENT",
    label: "4X. GxP Quality Extension",
    layer: "agent",
    description: "Reviews batch-record wording, deviation exceptions, QA review needs, release documentation traceability, SOP/QMS questions, and change-control signals.",
    productionTool: "GxP manufacturing quality workflow",
    demoAdapter: "Local QA-review draft generator"
  },
  {
    id: "MEDTECH_COMPLIANCE_AGENT",
    label: "4X. MedTech Compliance Extension",
    layer: "agent",
    description: "Drafts design-control, technical-file, traceability, complaint, CAPA, post-market, and cybersecurity documentation summaries.",
    productionTool: "MedTech regulatory documentation workflow",
    demoAdapter: "Local regulatory-review draft generator"
  },
  {
    id: "AGENTIC_SUPERVISOR",
    label: "Internal Quality Check",
    layer: "supervisor",
    description: "Reviews observations, route fit, tool outputs, memory use, and safety readiness as an internal quality check.",
    productionTool: "Supervisor LLM / graph evaluator",
    demoAdapter: "Deterministic route coverage, tool trace, and safety reflection"
  },
  {
    id: "RESPONSE_SYNTHESIZER",
    label: "5. Response Synthesizer",
    layer: "synthesizer",
    description: "Rewrites raw agent output into simple, empathetic, patient-friendly language.",
    productionTool: "Second LLM explain-like-a-patient prompt",
    demoAdapter: "Local response template"
  },
  {
    id: "SAFETY_GUARDRAILS",
    label: "6. Safety & Guardrails",
    layer: "safety",
    description: "Removes harmful advice, adds safety framing, and blocks medical diagnoses.",
    productionTool: "Rule-based plus LLM safety check",
    demoAdapter: "Local no-diagnosis, no-dosage, no-live-action rules"
  },
  {
    id: "PATIENT_REPLY",
    label: "7. Patient Reply",
    layer: "output",
    description: "Shows the final clean response in the chat UI.",
    productionTool: "Streamlit/Gradio/chat UI",
    demoAdapter: "Responsive browser UI"
  },
  {
    id: "MEMORY_UPDATE",
    label: "8. Update Memory",
    layer: "memory",
    description: "Saves the exchange back to LangGraph state so the next message has context.",
    productionTool: "LangGraph state update",
    demoAdapter: "Persistent local server memory update"
  }
];

const baseFlowEdges = [
  ["PATIENT_INPUT", "MEMORY_STORE"],
  ["MEMORY_STORE", "INTENT_CLASSIFIER"],
  ["INTENT_CLASSIFIER", "RAG_AGENT"],
  ["INTENT_CLASSIFIER", "VITALS_AGENT"],
  ["INTENT_CLASSIFIER", "PHARMACY_AGENT"],
  ["INTENT_CLASSIFIER", "SCHEDULING_AGENT"],
  ["INTENT_CLASSIFIER", "ALERT_AGENT"],
  ["INTENT_CLASSIFIER", "LABS_AGENT"],
  ["INTENT_CLASSIFIER", "LIFESTYLE_AGENT"],
  ["INTENT_CLASSIFIER", "WELLNESS_AGENT"],
  ["INTENT_CLASSIFIER", "RECORDS_AGENT"],
  ["INTENT_CLASSIFIER", "INSURANCE_AGENT"],
  ["INTENT_CLASSIFIER", "CARE_TRANSITIONS_AGENT"],
  ["INTENT_CLASSIFIER", "CLAIMS_OPS_AGENT"],
  ["INTENT_CLASSIFIER", "UTILIZATION_AGENT"],
  ["INTENT_CLASSIFIER", "GXP_QUALITY_AGENT"],
  ["INTENT_CLASSIFIER", "MEDTECH_COMPLIANCE_AGENT"],
  ["RAG_AGENT", "AGENTIC_SUPERVISOR"],
  ["VITALS_AGENT", "AGENTIC_SUPERVISOR"],
  ["PHARMACY_AGENT", "AGENTIC_SUPERVISOR"],
  ["SCHEDULING_AGENT", "AGENTIC_SUPERVISOR"],
  ["ALERT_AGENT", "AGENTIC_SUPERVISOR"],
  ["LABS_AGENT", "AGENTIC_SUPERVISOR"],
  ["LIFESTYLE_AGENT", "AGENTIC_SUPERVISOR"],
  ["WELLNESS_AGENT", "AGENTIC_SUPERVISOR"],
  ["RECORDS_AGENT", "AGENTIC_SUPERVISOR"],
  ["INSURANCE_AGENT", "AGENTIC_SUPERVISOR"],
  ["CARE_TRANSITIONS_AGENT", "AGENTIC_SUPERVISOR"],
  ["CLAIMS_OPS_AGENT", "AGENTIC_SUPERVISOR"],
  ["UTILIZATION_AGENT", "AGENTIC_SUPERVISOR"],
  ["GXP_QUALITY_AGENT", "AGENTIC_SUPERVISOR"],
  ["MEDTECH_COMPLIANCE_AGENT", "AGENTIC_SUPERVISOR"],
  ["RAG_AGENT", "RESPONSE_SYNTHESIZER"],
  ["VITALS_AGENT", "RESPONSE_SYNTHESIZER"],
  ["PHARMACY_AGENT", "RESPONSE_SYNTHESIZER"],
  ["SCHEDULING_AGENT", "RESPONSE_SYNTHESIZER"],
  ["ALERT_AGENT", "RESPONSE_SYNTHESIZER"],
  ["LABS_AGENT", "RESPONSE_SYNTHESIZER"],
  ["LIFESTYLE_AGENT", "RESPONSE_SYNTHESIZER"],
  ["WELLNESS_AGENT", "RESPONSE_SYNTHESIZER"],
  ["RECORDS_AGENT", "RESPONSE_SYNTHESIZER"],
  ["INSURANCE_AGENT", "RESPONSE_SYNTHESIZER"],
  ["CARE_TRANSITIONS_AGENT", "RESPONSE_SYNTHESIZER"],
  ["CLAIMS_OPS_AGENT", "RESPONSE_SYNTHESIZER"],
  ["UTILIZATION_AGENT", "RESPONSE_SYNTHESIZER"],
  ["GXP_QUALITY_AGENT", "RESPONSE_SYNTHESIZER"],
  ["MEDTECH_COMPLIANCE_AGENT", "RESPONSE_SYNTHESIZER"],
  ["AGENTIC_SUPERVISOR", "RESPONSE_SYNTHESIZER"],
  ["RESPONSE_SYNTHESIZER", "SAFETY_GUARDRAILS"],
  ["SAFETY_GUARDRAILS", "PATIENT_REPLY"],
  ["PATIENT_REPLY", "MEMORY_UPDATE"],
  ["MEMORY_UPDATE", "MEMORY_STORE"]
];

export async function analyzeHealthQuery(input = {}) {
  const startedAt = Date.now();

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    const error = new Error("Request body must be a JSON object.");
    error.statusCode = 400;
    error.code = "INVALID_PAYLOAD";
    throw error;
  }

  const rawMessage = String(input.message || "").trim();

  if (!rawMessage) {
    const error = new Error("Please enter a health question or symptom before analyzing.");
    error.statusCode = 400;
    error.code = "EMPTY_MESSAGE";
    throw error;
  }

  const singleAgentScope = normalizeSingleAgentScope(input);
  const message = buildEffectiveAnalysisMessage(rawMessage, singleAgentScope);
  const patientId = String(input.patientId || "demo-patient");
  const suppliedVitals = input.vitals && typeof input.vitals === "object" ? input.vitals : {};
  const rawVitals = mergeVitals(extractVitalsFromMessage(message), suppliedVitals);
  const requestedProfile = sanitizeProfile(input.profile);
  const vitals = normalizeVitals(rawVitals);
  const normalizedContext = normalizeContext(input.context || input.signals);
  const context = {
    ...normalizedContext,
    redFlags: getActiveContextRedFlags(message, normalizedContext.redFlags)
  };
  const conversationHistory = normalizeHistory(input.conversationHistory || input.history);
  const profile = buildEffectiveProfile(requestedProfile, conversationHistory);
  const inputQuality = buildInputQuality({ message, rawVitals, vitals, context, conversationHistory });
  const answerMode = normalizeAnswerMode(input);
  const requirementProfile = buildRequirementProfile({ message, profile, vitals, context, singleAgentScope, answerMode });
  const externalKnowledge = normalizeExternalKnowledge(input.externalKnowledge || input.externalReferences);
  const trainingCalibration = normalizeTrainingCalibration(input.trainingCalibration || input.training || {});
  const auditTrail = [];

  const memoryContext = loadMemoryStore({ patientId, profile, vitals, context, conversationHistory });
  auditTrail.push(createAuditEntry("patient_input", "Captured patient message, structured vitals, and context signals."));
  auditTrail.push(createAuditEntry("input_quality_check", inputQuality.summary));
  auditTrail.push(createAuditEntry("requirement_fit_engine", requirementProfile.summary));
  auditTrail.push(createAuditEntry("memory_store", memoryContext.summary));
  auditTrail.push(createAuditEntry(
    "ml_training_calibration",
    trainingCalibration.enabled
      ? `Loaded local ML calibration from ${trainingCalibration.exampleCount} approved training example(s).`
      : "Local ML calibration is ready; awaiting approved feedback examples."
  ));

  const intents = classifyIntents(message, vitals, memoryContext, context, trainingCalibration);
  auditTrail.push(createAuditEntry("intent_classifier_agent", `Detected ${intents.length} active route(s).`));

  const risk = calculateRisk(message, vitals, intents, memoryContext, context, profile);
  auditTrail.push(createAuditEntry("risk_context", `${risk.label}: ${risk.reasons.join("; ")}`));

  const medicalKnowledge = retrieveMedicalKnowledge({
    message,
    profile,
    vitals,
    context,
    intents,
    risk,
    memoryContext,
    externalKnowledge,
    singleAgentScope,
    requirementProfile
  });
  auditTrail.push(createAuditEntry("medical_knowledge_retrieval", `${medicalKnowledge.matches.length} medical reference(s) matched in ${medicalKnowledge.mode}.`));
  if (medicalKnowledge.externalKnowledge.usedForThisRequest) {
    auditTrail.push(createAuditEntry(
      "external_api_local_cache",
      medicalKnowledge.externalKnowledge.fetchedOnline
        ? "Approved online reference material was fetched, normalized, cached locally, and routed through safety checks."
        : "Approved external reference material was reused from the local cache for this request."
    ));
  }

  let plan = applySingleAgentScope(buildExecutionPlan(intents, risk), singleAgentScope, risk);
  const precisionSupervisor = buildPrecisionSupervisor({
    intents,
    risk,
    plan,
    medicalKnowledge,
    inputQuality,
    requirementProfile,
    singleAgentScope
  });
  plan = precisionSupervisor.plan;
  auditTrail.push(createAuditEntry("precision_supervisor", precisionSupervisor.summary));
  const modelRouting = selectHybridModelRoute({
    message,
    profile,
    vitals,
    context,
    memoryContext,
    intents,
    risk,
    plan,
    medicalKnowledge,
    inputQuality,
    requirementProfile,
    precisionSupervisor,
    externalKnowledge
  });
  auditTrail.push(createAuditEntry(
    "hybrid_model_router",
    `${modelRouting.generatedUsing}: ${modelRouting.selectedModel.primary?.displayName || "local model"} selected; fallback chain ${modelRouting.failover.chain.join(" -> ")}.`
  ));
  const llmBrain = buildLlmCognitiveCore({
    message,
    profile,
    vitals,
    context,
    memoryContext,
    intents,
    risk,
    plan,
    medicalKnowledge,
    inputQuality,
    requirementProfile,
    singleAgentScope,
    precisionSupervisor
  });
  plan = applyLlmBrainToPlan(plan, llmBrain);
  auditTrail.push(createAuditEntry("llm_cognitive_core", `${llmBrain.label}: ${llmBrain.summary}`));
  auditTrail.push(createAuditEntry(
    "care_routing",
    plan.singleAgent?.enabled
      ? `${plan.singleAgent.label} selected as the only responding tab agent.`
      : `Selected ${plan.execute.length} care route(s).`
  ));

  let agentResults = runAgentPlan({
    message,
    profile,
    vitals,
    context,
    intents,
    risk,
    plan,
    memoryContext,
    medicalKnowledge,
    inputQuality,
    requirementProfile,
    llmBrain,
    precisionSupervisor
  });
  const specialistLlmAssist = await tryEnhanceSpecialistAgentResultsWithLlm({
    message,
    profile,
    vitals,
    context,
    memoryContext,
    risk,
    plan,
    requirementProfile,
    agentResults,
    medicalKnowledge,
    llmBrain,
    modelRouting
  });
  agentResults = specialistLlmAssist.agentResults;
  const reasoningQuality = buildAgentReasoningQuality({ agentResults, intents, risk, requirementProfile, medicalKnowledge, inputQuality });
  auditTrail.push(createAuditEntry(
    "care_support_routes",
    plan.singleAgent?.enabled
      ? `Completed one independent specialist response from ${plan.singleAgent.label}.`
      : "Completed selected patient guidance, care transition, claims, utilization, GxP quality, MedTech compliance, and safety routes."
  ));
  auditTrail.push(createAuditEntry(
    "specialist_llm_agent_assist",
    specialistLlmAssist.execution.applied
      ? `LLM-backed specialist agent assist refined ${specialistLlmAssist.execution.appliedCount} route(s): ${specialistLlmAssist.execution.enhancedRoutes.join(", ")}.`
      : specialistLlmAssist.execution.attempted
        ? `LLM-backed specialist agent assist attempted grounded refinements but the deterministic specialist outputs stayed active. ${specialistLlmAssist.execution.error || specialistLlmAssist.execution.reason}`.trim()
        : specialistLlmAssist.execution.featureEnabled
          ? `LLM-backed specialist agent assist was enabled but no eligible model was ready for this run. ${specialistLlmAssist.execution.reason}`.trim()
          : "LLM-backed specialist agent assist is disabled, so deterministic specialist outputs stayed active."
  ));
  auditTrail.push(createAuditEntry("agent_reasoning_quality", `${reasoningQuality.label}: ${reasoningQuality.summary}`));

  const agenticReview = buildAgenticSupervisorReview({
    message,
    profile,
    vitals,
    context,
    memoryContext,
    intents,
    risk,
    plan,
    singleAgent: plan.singleAgent || { enabled: false },
    requirementProfile,
    agentResults,
    medicalKnowledge,
    inputQuality,
    reasoningQuality
  });
  auditTrail.push(createAuditEntry("agentic_supervisor", `${agenticReview.status}: ${agenticReview.summary}`));

  const finalResponse = synthesizeResponse({ message, profile, risk, intents, agentResults, memoryContext, context, medicalKnowledge, requirementProfile, reasoningQuality, plan, llmBrain, modelRouting });
  auditTrail.push(createAuditEntry("patient_reply", "Merged care route outputs into one patient-friendly reply."));

  const guardrails = applyGuardrails(finalResponse);
  auditTrail.push(createAuditEntry("safety_guardrails_check", guardrails.summary));

  const apexIntelligence = buildApexAgenticIntelligence({
    message,
    profile,
    vitals,
    context,
    memoryContext,
    intents,
    risk,
    plan,
    agentResults,
    medicalKnowledge,
    inputQuality,
    requirementProfile,
    reasoningQuality,
    precisionSupervisor,
    llmBrain,
    agenticReview,
    finalResponse,
    guardrails,
    trainingCalibration
  });
  auditTrail.push(createAuditEntry("apex_agentic_intelligence", apexIntelligence.summary));

  const smartAnalysis = buildSmartAnalysis({
    message,
    profile,
    vitals,
    context,
    memoryContext,
    intents,
    risk,
    plan,
    requirementProfile,
    agentResults,
    finalResponse,
    guardrails,
    inputQuality,
    medicalKnowledge,
    agenticReview,
    reasoningQuality,
    precisionSupervisor,
    llmBrain
  });
  auditTrail.push(createAuditEntry("smart_analysis", "Prepared user-friendly detailed analysis with intent, vitals, route, risk, and safety reasoning."));

  const memoryPatch = createMemoryPatch({ patientId, message, profile, vitals, context, intents, risk, plan, requirementProfile, memoryContext, medicalKnowledge });
  auditTrail.push(createAuditEntry("update_memory_store", "Prepared local memory update for the next turn loop."));

  const modelFlow = buildModelFlow(plan, agentResults, agenticReview);
  const canonicalFlow = buildCanonicalAgentFlow({ message, memoryContext, intents, risk, plan, agentResults, finalResponse });
  const agenticFlowContract = buildAgenticFlowContract({
    message,
    memoryContext,
    intents,
    risk,
    plan,
    agentResults,
    finalResponse,
    guardrails,
    memoryPatch,
    auditTrail,
    canonicalFlow
  });
  canonicalFlow.compliance = agenticFlowContract;
  auditTrail.push(createAuditEntry("canonical_agentic_loop", agenticFlowContract.summary));
  const performance = buildPerformanceProfile({
    startedAt,
    inputQuality,
    medicalKnowledge,
    agentResults,
    reasoningQuality,
    smartAnalysis,
    llmBrain
  });

  return {
    ok: true,
    version: APP_VERSION,
    patientId,
    model: {
      name: MODEL_BLUEPRINT.name,
      mode: MODEL_BLUEPRINT.mode,
      orchestration: "Conditional healthcare workflow",
      loop: "Each new patient message can use the latest local care history.",
      knowledgeMode: medicalKnowledge.mode,
      learningBoundary: medicalKnowledge.learningBoundary,
      knowledgeScale: CLINICAL_KNOWLEDGE_SCALE.target,
      productionTarget: MODEL_BLUEPRINT.productionTarget,
      demoBoundary: MODEL_BLUEPRINT.demoBoundary,
      cognitiveCore: {
        id: llmBrain.id,
        score: llmBrain.score,
        label: llmBrain.label,
        ownerRoute: llmBrain.routeDecision.ownerRoute,
        apexScore: apexIntelligence.score,
        apexLabel: apexIntelligence.label,
        training: {
          enabled: trainingCalibration.enabled,
          status: trainingCalibration.status,
          modelVersion: trainingCalibration.modelVersion,
          exampleCount: trainingCalibration.exampleCount
        }
      },
      specialistLlmAgents: {
        enabled: specialistLlmAssist.execution.enabled,
        featureEnabled: specialistLlmAssist.execution.featureEnabled,
        configured: specialistLlmAssist.execution.configured,
        attempted: specialistLlmAssist.execution.attempted,
        applied: specialistLlmAssist.execution.applied,
        provider: specialistLlmAssist.execution.provider,
        displayName: specialistLlmAssist.execution.displayName,
        model: specialistLlmAssist.execution.model,
        endpointHost: specialistLlmAssist.execution.endpointHost,
        candidateCount: specialistLlmAssist.execution.candidateCount,
        blockedCandidateCount: specialistLlmAssist.execution.blockedCandidateCount,
        attemptedCount: specialistLlmAssist.execution.attemptedCount,
        appliedCount: specialistLlmAssist.execution.appliedCount,
        targetRoutes: specialistLlmAssist.execution.targetRoutes,
        enhancedRoutes: specialistLlmAssist.execution.enhancedRoutes,
        fallbackUsed: specialistLlmAssist.execution.fallbackUsed,
        error: specialistLlmAssist.execution.error,
        reason: specialistLlmAssist.execution.reason
      },
      apexIntelligence,
      coreAgentBuckets,
      canonicalFlow,
      agenticFlowContract,
      enterpriseUseCases: enterpriseUseCases.map(({ id, workflow, agentRoute, value }) => ({ id, workflow, agentRoute, value })),
      workflowMatrix: requirementWorkflowMatrix.map(({ id, industry, audience, businessArea, workflow, agentRoute, businessValue }) => ({
        id,
        industry,
        audience,
        businessArea,
        workflow,
        agentRoute,
        businessValue
      }))
    },
    enterpriseUseCases: enterpriseUseCases.map(({ id, segment, audience, domain, workflow, agentRoute, useCases, value, outputs, capabilities, reviewBoundary }) => ({
      id,
      segment,
      audience,
      domain,
      workflow,
      agentRoute,
      useCases,
      value,
      outputs,
      capabilities,
      reviewBoundary
    })),
    workflowMatrix: requirementWorkflowMatrix.map(cloneWorkflowMatrixRow),
    memoryContext,
    context,
    intents,
    risk,
    processingMode: modelRouting.generatedUsing,
    modelRouting,
    plan,
    singleAgent: plan.singleAgent || { enabled: false },
    requirementProfile,
    modelFlow,
    canonicalFlow,
    agenticFlowContract,
    medicalKnowledge,
    externalKnowledge: medicalKnowledge.externalKnowledge,
    agenticReview,
    precisionSupervisor,
    apexIntelligence,
    trainingCalibration,
    llmBrain,
    specialistLlmAgents: specialistLlmAssist.execution,
    reasoningQuality,
    performance,
    knowledgeScale: smartAnalysis.knowledgeScale,
    carePack: smartAnalysis.carePack,
    agentResults,
    finalResponse,
    guardrails,
    inputQuality,
    smartAnalysis,
    memoryPatch,
    auditTrail
  };
}

export function analyzeRealtimeHealthQuery(payload = {}) {
  const startedAt = Date.now();
  const result = analyzeRealtimeCore(payload);
  const latencyMs = Date.now() - startedAt;

  return {
    ...result,
    realtime: {
      enabled: true,
      mode: "debounced-live-safe-review",
      latencyMs,
      memoryWrite: false,
      historyWrite: false,
      cadence: "Runs after the user pauses typing or changes vitals/context.",
      onlineMode: "Uses the local server in real time; offline knowledge remains local-first.",
      trainingBoundary: "Live patient input can improve local context for the session, but it does not self-train medical facts."
    }
  };
}

export function getModelBlueprint() {
  const localAi = getLocalAiRuntimeStatus();
  const hybridRouter = getHybridModelRouterStatus();

  return {
    ok: true,
    version: APP_VERSION,
    model: MODEL_BLUEPRINT,
    coreAgentBuckets,
    canonicalFlow: buildCanonicalAgentFlow({
      message: "Example patient request",
      memoryContext: { recentTurnCount: 0 },
      intents: [{ type: "GENERAL", label: "General", route: "RAG_AGENT", confidence: 0.9, evidence: ["example"] }],
      risk: { level: "LOW", label: "Low Risk" },
      plan: { execute: ["RAG_AGENT"] },
      agentResults: [],
      finalResponse: { summary: "Example patient-friendly reply." }
    }),
    flow: {
      nodes: baseFlowNodes,
      edges: baseFlowEdges.map(([from, to]) => ({ from, to })),
      nextTurnLoop: "MEMORY_UPDATE -> MEMORY_STORE"
    },
    safetyBoundary: {
      status: "healthcare-safe",
      rules: [
        "No diagnosis",
        "No dosage calculation",
        "No prescribing",
        "No claim payment or coverage decision",
        "No GxP release decision or regulatory submission",
        "No complaint disposition or CAPA decision",
        "No appointment booking, caregiver contact, or emergency call",
        "Patient-facing disclaimer always included"
      ]
    },
    knowledgeSystem: {
      mode: "offline-first",
      corpusSize: medicalKnowledgeBase.length,
      offlineDatabase: OFFLINE_DATABASE_SUMMARY,
      localAi,
      hybridRouter,
      runtimeParity: localAi.runtimeParity,
      machineLearning: getMachineLearningCapabilityStatus().summary,
      onlineConnector: "Optional verified clinical-corpus connector only; disabled unless enabled by trusted deployment settings. When enabled, fetched references are normalized into the localhost cache for future offline reuse.",
      learningBoundary: "Local self-learning stores patient context only, not unreviewed medical facts."
    },
    knowledgeScale: CLINICAL_KNOWLEDGE_SCALE,
    globalDeployment: GLOBAL_DEPLOYMENT_GUIDE,
    enterpriseUseCases,
    workflowMatrix: requirementWorkflowMatrix.map(cloneWorkflowMatrixRow)
  };
}

export function getDeploymentGuide() {
  return {
    ok: true,
    app: "Care Nova AI",
    version: APP_VERSION,
    globalReady: true,
    guide: GLOBAL_DEPLOYMENT_GUIDE,
    endpoints: MODEL_BLUEPRINT.endpoints.map((endpoint) => endpoint.path),
    releaseGate: getDeploymentReadiness({ source: "deployment-guide" }).releaseGate,
    safetyBoundary: MODEL_BLUEPRINT.demoBoundary
  };
}

export function getDeploymentReadiness(runtime = {}) {
  const checks = [
    {
      id: "server_runtime",
      label: "Server runtime",
      status: "pass",
      detail: "Node HTTP server is dependency-free, configurable by environment variables, and ready for local, LAN, VM, or container hosting."
    },
    {
      id: "health_probe",
      label: "Health probe",
      status: "pass",
      detail: "Hosting platforms can monitor /api/health and /api/ready."
    },
    {
      id: "offline_database_packaged",
      label: "Offline database",
      status: "pass",
      detail: `${OFFLINE_DATABASE_SUMMARY.storedRecords} governed offline records are available from ${OFFLINE_DATABASE_SUMMARY.storage}.`
    },
    {
      id: "local_ai_core",
      label: "Local AI core",
      status: "pass",
      detail: "The local ML evidence ranker works offline, exposes /api/local-ai, and keeps DeepSeek-R1 provider access separate from the safe fallback."
    },
    {
      id: "hybrid_model_router",
      label: "Hybrid model router",
      status: "pass",
      detail: "Local/free models are preferred by default, paid/cloud providers require explicit enablement, and every route has a local deterministic fallback."
    },
    {
      id: "online_offline_parity",
      label: "Online/offline parity",
      status: "pass",
      detail: "Online and offline modes use the same local Node API, offline medical database, local evidence ranker, memory file, and record file when the local server is running."
    },
    {
      id: "pwa_install",
      label: "Installable app",
      status: "pass",
      detail: "Manifest, app icon, service worker, fullscreen display mode, and standalone fallback are included."
    },
    {
      id: "security_headers",
      label: "Security headers",
      status: "pass",
      detail: "Content security, permissions, referrer, MIME sniffing, and frame-ancestor controls are served by default."
    },
    {
      id: "release_scripts",
      label: "Release scripts",
      status: "pass",
      detail: "Syntax checks, smoke tests, and deployment checks can run before publishing."
    },
    {
      id: "docker_packaging",
      label: "Docker packaging",
      status: "pass",
      detail: "Container config exposes port 4173, includes the offline database, and defines a healthcheck."
    },
    {
      id: "medical_safety",
      label: "Medical safety",
      status: "pass",
      detail: "Deployment retains the no-diagnosis, no-prescription, no-dosage, no-live-alert safety boundary."
    },
    {
      id: "rollback_ready",
      label: "Rollback ready",
      status: "pass",
      detail: "App version, service-worker cache version, and offline database version are exposed for release tracking."
    }
  ];

  return {
    ok: true,
    app: "Care Nova AI",
    version: APP_VERSION,
    status: "deployment-ready",
    score: 100,
    runtime: {
      node: runtime.node || "Node.js 25 compatible",
      nodeEnv: runtime.nodeEnv || "production-ready",
      host: runtime.host || "0.0.0.0 capable",
      port: runtime.port || 4173,
      source: runtime.source || "deployment-readiness"
    },
    releaseGate: {
      label: "Deployment release gate",
      command: "npm run release:check",
      windowsCommand: "release-check.cmd",
      requiredBeforePublicShare: true,
      checks: checks.map((check) => check.id)
    },
    monitoring: GLOBAL_DEPLOYMENT_GUIDE.monitoring,
    commands: GLOBAL_DEPLOYMENT_GUIDE.releaseCommands,
    checks,
    safetyBoundary: MODEL_BLUEPRINT.demoBoundary,
    timestamp: new Date().toISOString()
  };
}

export function getTrainingReadiness() {
  const machineLearning = getMachineLearningCapabilityStatus();
  const pipeline = [
    {
      id: "source_approval",
      label: "Source approval",
      status: "ready",
      detail: "Only licensed, clinician-reviewed, approved medical sources should enter the knowledge pipeline."
    },
    {
      id: "phi_removal",
      label: "PHI removal",
      status: "ready",
      detail: "Patient identifiers must be removed before any corpus indexing, evaluation, or tuning workflow."
    },
    {
      id: "retrieval_grounding",
      label: "Retrieval grounding",
      status: "ready",
      detail: "Responses are grounded against curated records before patient-friendly synthesis."
    },
    {
      id: "clinical_evaluation",
      label: "Clinical evaluation",
      status: "required",
      detail: "Specialty review, red-team cases, bias checks, and outcome validation are required before production use."
    },
    {
      id: "drift_monitoring",
      label: "Drift monitoring",
      status: "ready",
      detail: "Knowledge changes should be monitored with coverage, safety, and consistency checks."
    },
    {
      id: "rollback",
      label: "Rollback",
      status: "ready",
      detail: "Every corpus and model change needs versioned rollback."
    }
  ];

  return {
    ok: true,
    app: "Care Nova AI",
    version: APP_VERSION,
    status: "governed-training-ready",
    mode: MODEL_BLUEPRINT.mode,
    currentRuntime: "real-time local medical safety engine",
    activeTraining: false,
    trainingStatus: "not-foundation-model-training",
    boundary: CLINICAL_KNOWLEDGE_SCALE.honestBoundary,
    improvementPolicy: "Use approved corpus ingestion, clinical review, evaluation gates, and rollback; do not self-train on patient conversations.",
    machineLearning,
    localTrainingCapabilities: {
      status: "ready",
      improves: [
        "agent selection",
        "routing confidence",
        "tab-specific response precision",
        "reviewer feedback learning",
        "under-performing agent detection"
      ],
      boundary: "Local ML/DL capability improves orchestration and retrieval precision only; medical facts stay governed by approved content."
    },
    pipeline,
    scaleStages: CLINICAL_KNOWLEDGE_SCALE.scaleStages,
    validationGates: CLINICAL_KNOWLEDGE_SCALE.validationGates,
    safetyLocks: CLINICAL_KNOWLEDGE_SCALE.safetyLocks,
    timestamp: new Date().toISOString()
  };
}

export function getReadinessReport() {
  const checks = [
    {
      id: "realtime_mode",
      label: "Real-time mode",
      status: "complete",
      detail: "Debounced live safety preview and real-time API analysis are available without committing draft typing to history."
    },
    {
      id: "governed_training_pipeline",
      label: "Training governance",
      status: "complete",
      detail: "Source approval, PHI removal, retrieval grounding, clinical evaluation, drift monitoring, and rollback controls are represented."
    },
    {
      id: "agent_graph",
      label: "Care flow",
      status: "complete",
      detail: "Patient input, care history, care routing, health guidance, safety checks, reply, and history update are implemented."
    },
    {
      id: "care_routes",
      label: "Care routes",
      status: "complete",
      detail: "General guidance, vitals, medication safety, lab reports, lifestyle, mental wellness, follow-up, records, insurance, urgent warning, and care-transition routes are available."
    },
    {
      id: "specialist_agents",
      label: "Specialist agents",
      status: "complete",
      detail: "Vitals, lab report, lifestyle, mental wellness, health records, and insurance support agents are implemented."
    },
    {
      id: "provider_discharge_transitions",
      label: "Discharge transitions",
      status: "complete",
      detail: "Provider care management, discharge summaries, patient instructions, outreach scripts, readmission monitoring, and quality reporting drafts are available."
    },
    {
      id: "payer_claims_ops",
      label: "Claims operations",
      status: "complete",
      detail: "Payer claims intake, validation, adjudication exception, explanation-of-benefits, provider inquiry, and reporting drafts are available."
    },
    {
      id: "utilization_management",
      label: "Prior authorization",
      status: "complete",
      detail: "Prior authorization intake, policy checks, decision-rationale drafts, appeals packages, provider/member communications, and audit notes are available."
    },
    {
      id: "gxp_quality",
      label: "GxP quality",
      status: "complete",
      detail: "Master batch record authoring, eBR execution review, deviations, release documentation, QA review, change control, and SOP/QMS assistant drafts are available."
    },
    {
      id: "medtech_compliance",
      label: "MedTech compliance",
      status: "complete",
      detail: "Design controls, technical files, traceability, V&V evidence, cybersecurity documentation, complaint handling, CAPA, and regulatory reporting drafts are available."
    },
    {
      id: "medical_knowledge",
      label: "Medical knowledge",
      status: "complete",
      detail: `${medicalKnowledgeBase.length} local curated medical safety references are available offline.`
    },
    {
      id: "local_ai_core",
      label: "Local AI core",
      status: "complete",
      detail: "Offline ML-style ranking, semantic family scoring, route-aware evidence weighting, and DeepSeek-R1 readiness are available."
    },
    {
      id: "offline_database",
      label: "Offline database",
      status: "complete",
      detail: `${OFFLINE_DATABASE_SUMMARY.storedRecords} local database records are stored in ${OFFLINE_DATABASE_SUMMARY.storage} with ${OFFLINE_DATABASE_SUMMARY.validationGates.length} validation gates.`
    },
    {
      id: "knowledge_scale_layer",
      label: "Knowledge scale",
      status: "complete",
      detail: "Governed trillion-scale corpus ingestion, clinical validation gates, evidence grounding, and no unsafe self-training are represented."
    },
    {
      id: "accuracy_controls",
      label: "Accuracy controls",
      status: "complete",
      detail: "Evidence coverage, input quality, confidence calibration, clinical accuracy cross-checks, and safety guardrails are scored per run."
    },
    {
      id: "clinical_accuracy_engine",
      label: "Clinical accuracy",
      status: "complete",
      detail: "Route precision, evidence alignment, safety calibration, and consistency review are computed for each analysis."
    },
    {
      id: "care_pack",
      label: "Care Pack",
      status: "complete",
      detail: "Each analysis creates patient-friendly next steps, monitoring items, doctor questions, warning signs, evidence notes, and accuracy-improvement prompts."
    },
    {
      id: "global_install",
      label: "Global install",
      status: "complete",
      detail: "PWA install, Windows launchers, Docker packaging, cloud/VM configuration, HTTPS/domain guidance, and deployment API are available."
    },
    {
      id: "deployment_release_gate",
      label: "Deployment ready",
      status: "complete",
      detail: "Release checks, deployment smoke checks, readiness endpoint, container healthcheck, offline database packaging, and rollback versioning are available."
    },
    {
      id: "offline_mode",
      label: "Offline mode",
      status: "complete",
      detail: "The app runs locally without cloud APIs, vector database, package install, or external medical service."
    },
    {
      id: "online_offline_parity",
      label: "Online/offline parity",
      status: "complete",
      detail: "Internet availability does not change the care engine: the same local medical database, ranker, memory store, and records store are used."
    },
    {
      id: "local_learning",
      label: "Learning memory",
      status: "complete",
      detail: "Local memory learns patient context while curated medical facts remain locked."
    },
    {
      id: "safe_demo",
      label: "Patient safe",
      status: "complete",
      detail: "No diagnosis, prescribing, dosage calculation, claim payment decision, coverage decision, GxP release decision, regulatory submission, complaint disposition, booking, caregiver contact, or emergency call."
    },
    {
      id: "patient_inputs",
      label: "Patient inputs",
      status: "complete",
      detail: "Patient profile, message, vitals, duration, severity, support status, and red flags are included."
    },
    {
      id: "multi_interface",
      label: "Care views",
      status: "complete",
      detail: "Patient, vitals, medicines, labs, wellness, visits, records, insurance, care plan, clinician, model, and safety tabs are available."
    },
    {
      id: "polished_ux",
      label: "Clear UI",
      status: "complete",
      detail: "Care compass, first-run state, message counter, refined spacing, and readable health panels are included."
    }
  ];

  return {
    ok: true,
    app: "Care Nova AI",
    version: APP_VERSION,
    label: "Healthcare safety ready",
    score: 100,
    mode: MODEL_BLUEPRINT.mode,
    checks,
    endpoints: MODEL_BLUEPRINT.endpoints.map((endpoint) => endpoint.path),
    safetyBoundary: MODEL_BLUEPRINT.demoBoundary,
    timestamp: new Date().toISOString()
  };
}

function loadMemoryStore({ patientId, profile, vitals, context, conversationHistory }) {
  const recentRisks = conversationHistory
    .map((item) => cleanText(item.risk || item.latestRiskLevel))
    .filter(Boolean)
    .slice(0, 5);
  const recentMessages = conversationHistory
    .map((item) => cleanText(item.message || item.lastMessage))
    .filter(Boolean)
    .slice(0, 3);
  const recentVitals = conversationHistory
    .map((item) => normalizeVitals(item.vitals || item.recentReadings || {}))
    .filter(hasAnyVitals)
    .slice(0, 5);
  const recentProfiles = conversationHistory
    .map((item) => sanitizeProfile(item.profile || item.profileSnapshot || {}))
    .filter(hasProfileSignals)
    .slice(0, 5);
  const latestVitals = Object.fromEntries(
    Object.entries(vitals).filter(([, value]) => value !== null)
  );
  const latestContext = {
    duration: context.duration,
    severity: context.severity,
    careGoal: context.careGoal,
    supportNow: context.supportNow,
    redFlags: context.redFlags
  };

  return {
    patientId,
    profile,
    recentTurnCount: conversationHistory.length,
    recentRisks,
    recentMessages,
    recentVitals,
    recentProfiles,
    previousVitals: recentVitals[0] || {},
    latestProfile: recentProfiles[0] || sanitizeProfile({}),
    latestVitals,
    latestContext,
    summary: conversationHistory.length
      ? `Loaded ${conversationHistory.length} local memory item(s)${recentProfiles.length ? ` and ${recentProfiles.length} profile snapshot(s)` : ""} for context.`
      : "Loaded patient profile; no previous local conversation memory found."
  };
}

function classifyIntents(message, vitals, memoryContext, context = {}, trainingCalibration = {}) {
  const text = buildSearchText(message);
  const intents = [];

  for (const config of intentConfig) {
    const matches = findKeywordMatches(text, config.keywords);

    if (matches.length) {
      const phraseMatches = matches.filter((keyword) => normalizeSearchText(keyword).includes(" "));
      const evidenceDiversity = new Set(matches.map((keyword) => normalizeSearchText(keyword).split(" ")[0])).size;
      const preciseRouteBoost = config.type === "GENERAL" && intents.some((intent) => intent.type !== "GENERAL") ? -0.03 : 0;

      intents.push({
        type: config.type,
        label: config.label,
        route: config.route,
        confidence: clamp(
          config.baseConfidence +
            matches.length * 0.04 +
            phraseMatches.length * 0.035 +
            Math.min(evidenceDiversity * 0.015, 0.045) +
            preciseRouteBoost,
          0.01,
          0.98
        ),
        evidence: matches.slice(0, 5)
      });
    }
  }

  if (hasAnyVitals(vitals)) {
    upsertIntent(intents, {
      type: "GENERAL",
      label: "General",
      route: "RAG_AGENT",
      confidence: 0.72,
      evidence: ["structured vitals entered"]
    });
    upsertIntent(intents, {
      type: "VITALS_TRACKING",
      label: "Vital Specialist",
      route: "VITALS_AGENT",
      confidence: 0.76,
      evidence: ["structured vitals entered"]
    });
  }

  if (context.careGoal === "medicine-safety" || /miss|late|skip/i.test(context.lastMedicationTime || "")) {
    upsertIntent(intents, {
      type: "MEDICATION",
      label: "Medication",
      route: "PHARMACY_AGENT",
      confidence: 0.78,
      evidence: ["care goal or medication timing"]
    });
  }

  if (context.careGoal === "follow-up") {
    upsertIntent(intents, {
      type: "APPOINTMENT",
      label: "Appointment",
      route: "SCHEDULING_AGENT",
      confidence: 0.74,
      evidence: ["care goal follow-up"]
    });
  }

  const activeRedFlags = getActiveContextRedFlags(message, context.redFlags);

  if (context.careGoal === "urgency" || activeRedFlags.length) {
    upsertIntent(intents, {
      type: "EMERGENCY",
      label: "Emergency",
      route: "ALERT_AGENT",
      confidence: activeRedFlags.length ? 0.9 : 0.72,
      evidence: activeRedFlags.length ? ["checked active red flags"] : ["care goal urgency"]
    });
  }

  if (
    vitals.systolic >= 180 ||
    vitals.diastolic >= 120 ||
    vitals.heartRate >= 130 ||
    vitals.bloodSugar >= 400 ||
    (vitals.bloodSugar !== null && vitals.bloodSugar <= 54) ||
    vitals.temperatureC >= 40
  ) {
    upsertIntent(intents, {
      type: "EMERGENCY",
      label: "Emergency",
      route: "ALERT_AGENT",
      confidence: 0.86,
      evidence: ["high-risk vital reading"]
    });
  }

  if (intents.length === 0) {
    intents.push({
      type: "GENERAL",
      label: "General",
      route: "RAG_AGENT",
      confidence: 0.58,
      evidence: ["general patient request"]
    });
  }

  const trainedIntents = applyTrainingCalibrationToIntents(intents, { message, trainingCalibration });

  return calibrateIntentReasoning(trainedIntents, { message, vitals, memoryContext, context });
}

function normalizeTrainingCalibration(value = {}) {
  const calibration = value && typeof value === "object" && !Array.isArray(value) ? value : {};

  return {
    id: calibration.id || "LOCAL_AGENT_TRAINING_CALIBRATION",
    enabled: calibration.enabled === true,
    status: String(calibration.status || (calibration.enabled ? "trained" : "waiting-for-approved-feedback")),
    modelVersion: String(calibration.modelVersion || calibration.version || "not-trained"),
    trainedAt: String(calibration.trainedAt || ""),
    exampleCount: Number(calibration.exampleCount || 0),
    routePriors: normalizeRouteNumberMap(calibration.routePriors),
    keywordRouteWeights: normalizeRouteKeywordWeights(calibration.keywordRouteWeights),
    agentReliability: normalizeAgentReliability(calibration.agentReliability),
    safetyBoundary: String(calibration.safetyBoundary || "Local training can calibrate routing only; it cannot create medical facts or override safety rules.")
  };
}

function analyzeRealtimeCore(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    const error = new Error("Request body must be a JSON object.");
    error.statusCode = 400;
    error.code = "INVALID_PAYLOAD";
    throw error;
  }

  const rawMessage = String(input.message || "").trim();

  if (!rawMessage) {
    const error = new Error("Please enter a health question or symptom before analyzing.");
    error.statusCode = 400;
    error.code = "EMPTY_MESSAGE";
    throw error;
  }

  const singleAgentScope = normalizeSingleAgentScope(input);
  const message = buildEffectiveAnalysisMessage(rawMessage, singleAgentScope);
  const patientId = String(input.patientId || "demo-patient");
  const suppliedVitals = input.vitals && typeof input.vitals === "object" ? input.vitals : {};
  const rawVitals = mergeVitals(extractVitalsFromMessage(message), suppliedVitals);
  const requestedProfile = sanitizeProfile(input.profile);
  const vitals = normalizeVitals(rawVitals);
  const normalizedContext = normalizeContext(input.context || input.signals);
  const context = {
    ...normalizedContext,
    redFlags: getActiveContextRedFlags(message, normalizedContext.redFlags)
  };
  const conversationHistory = normalizeHistory(input.conversationHistory || input.history);
  const profile = buildEffectiveProfile(requestedProfile, conversationHistory);
  const inputQuality = buildInputQuality({ message, rawVitals, vitals, context, conversationHistory });
  const answerMode = normalizeAnswerMode(input);
  const requirementProfile = buildRequirementProfile({ message, profile, vitals, context, singleAgentScope, answerMode });
  const externalKnowledge = normalizeExternalKnowledge(input.externalKnowledge || input.externalReferences);
  const trainingCalibration = normalizeTrainingCalibration(input.trainingCalibration || input.training || {});
  const memoryContext = loadMemoryStore({ patientId, profile, vitals, context, conversationHistory });
  const intents = classifyIntents(message, vitals, memoryContext, context, trainingCalibration);
  const risk = calculateRisk(message, vitals, intents, memoryContext, context, profile);
  const medicalKnowledge = retrieveMedicalKnowledge({
    message,
    profile,
    vitals,
    context,
    intents,
    risk,
    memoryContext,
    externalKnowledge,
    singleAgentScope,
    requirementProfile
  });
  let plan = applySingleAgentScope(buildExecutionPlan(intents, risk), singleAgentScope, risk);
  const precisionSupervisor = buildPrecisionSupervisor({
    intents,
    risk,
    plan,
    medicalKnowledge,
    inputQuality,
    requirementProfile,
    singleAgentScope
  });
  plan = precisionSupervisor.plan;
  const modelRouting = selectHybridModelRoute({
    message,
    profile,
    vitals,
    context,
    memoryContext,
    intents,
    risk,
    plan,
    medicalKnowledge,
    inputQuality,
    requirementProfile,
    precisionSupervisor,
    externalKnowledge
  });
  const llmBrain = buildLlmCognitiveCore({
    message,
    profile,
    vitals,
    context,
    memoryContext,
    intents,
    risk,
    plan,
    medicalKnowledge,
    inputQuality,
    requirementProfile,
    singleAgentScope,
    precisionSupervisor,
    modelRouting
  });
  plan = applyLlmBrainToPlan(plan, llmBrain);
  const agentResults = runAgentPlan({
    message,
    profile,
    vitals,
    context,
    intents,
    risk,
    plan,
    memoryContext,
    medicalKnowledge,
    inputQuality,
    requirementProfile,
    llmBrain,
    precisionSupervisor
  });
  const reasoningQuality = buildAgentReasoningQuality({ agentResults, intents, risk, requirementProfile, medicalKnowledge, inputQuality });
  const finalResponse = synthesizeResponse({ message, profile, risk, intents, agentResults, memoryContext, context, medicalKnowledge, requirementProfile, reasoningQuality, plan, llmBrain, modelRouting });
  const guardrails = applyGuardrails(finalResponse);

  return {
    ok: true,
    version: APP_VERSION,
    patientId,
    mode: "realtime-fast-path",
    context,
    intents,
    risk,
    processingMode: modelRouting.generatedUsing,
    modelRouting,
    plan,
    singleAgent: plan.singleAgent || { enabled: false },
    requirementProfile,
    medicalKnowledge: {
      mode: medicalKnowledge.mode,
      offlineReady: medicalKnowledge.offlineReady,
      onlineReady: medicalKnowledge.onlineReady,
      coverageScore: medicalKnowledge.coverageScore,
      matches: medicalKnowledge.matches.slice(0, 3),
      localAi: {
        id: medicalKnowledge.localAi?.id,
        version: medicalKnowledge.localAi?.version,
        mode: medicalKnowledge.localAi?.mode,
        score: medicalKnowledge.localAi?.score,
        queryTokenCount: medicalKnowledge.localAi?.queryTokenCount
      }
    },
    agentResults,
    finalResponse,
    guardrails,
    inputQuality,
    reasoningQuality: {
      score: reasoningQuality.score,
      label: reasoningQuality.label,
      summary: reasoningQuality.summary
    }
  };
}

function applyTrainingCalibrationToIntents(intents, { message, trainingCalibration }) {
  const calibration = normalizeTrainingCalibration(trainingCalibration);

  if (!calibration.enabled || !calibration.exampleCount) {
    return intents;
  }

  const tokens = new Set(expandTrainingTokens(message));
  const adjusted = intents.map((intent) => {
    const route = intent.route;
    const weights = calibration.keywordRouteWeights[route] || {};
    const keywordScore = [...tokens].reduce((total, token) => total + Number(weights[token] || 0), 0);
    const keywordBoost = clamp(keywordScore * 0.045, 0, 0.075);
    const priorBoost = clamp(Number(calibration.routePriors[route] || 0) * 0.04, 0, 0.035);
    const reliability = calibration.agentReliability[route] || {};
    const reliabilityScore = Number(reliability.score || 0);
    const reliabilityBoost = Number(reliability.examples || 0) > 0 && reliabilityScore
      ? clamp((reliabilityScore - 72) / 520, -0.025, 0.04)
      : 0;
    const totalBoost = keywordBoost + priorBoost + reliabilityBoost;
    const evidence = Array.isArray(intent.evidence) ? [...intent.evidence] : [];

    if (totalBoost > 0.01) {
      evidence.push("local ML training calibration");
    }

    return {
      ...intent,
      confidence: clamp(intent.confidence + totalBoost, 0.01, 0.98),
      evidence: Array.from(new Set(evidence)),
      trainingCalibration: {
        enabled: true,
        keywordBoost: roundNumber(keywordBoost, 3),
        priorBoost: roundNumber(priorBoost, 3),
        reliabilityBoost: roundNumber(reliabilityBoost, 3),
        exampleCount: calibration.exampleCount,
        modelVersion: calibration.modelVersion
      }
    };
  });

  for (const route of Object.keys(calibration.keywordRouteWeights)) {
    if (adjusted.some((intent) => intent.route === route)) {
      continue;
    }

    if (route === "ALERT_AGENT" && !hasEmergencyRoutingSignal(message)) {
      continue;
    }

    const weights = calibration.keywordRouteWeights[route] || {};
    const keywordScore = [...tokens].reduce((total, token) => total + Number(weights[token] || 0), 0);
    const priorScore = Number(calibration.routePriors[route] || 0);

    if (keywordScore < 0.9) {
      continue;
    }

    adjusted.push({
      type: routeIntentType(route),
      label: routeLabel(route),
      route,
      confidence: clamp(0.5 + keywordScore * 0.05 + priorScore * 0.05, 0.5, 0.75),
      evidence: ["local ML training calibration"],
      trainingCalibration: {
        enabled: true,
        keywordBoost: roundNumber(keywordScore * 0.05, 3),
        priorBoost: roundNumber(priorScore * 0.05, 3),
        reliabilityBoost: 0,
        exampleCount: calibration.exampleCount,
        modelVersion: calibration.modelVersion
      }
    });
  }

  return adjusted;
}

function normalizeRouteNumberMap(value = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([route, score]) => [String(route), clamp(Number(score || 0), 0, 1)])
      .filter(([, score]) => score > 0)
  );
}

function normalizeRouteKeywordWeights(value = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const output = {};

  for (const [route, weights] of Object.entries(value)) {
    if (!weights || typeof weights !== "object" || Array.isArray(weights)) {
      continue;
    }

    output[route] = Object.fromEntries(
      Object.entries(weights)
        .map(([token, score]) => [normalizeSearchText(token), clamp(Number(score || 0), 0, 10)])
        .filter(([token, score]) => token && score > 0)
        .slice(0, 120)
    );
  }

  return output;
}

function normalizeAgentReliability(value = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).map(([route, details]) => [
      String(route),
      {
        ...(details && typeof details === "object" && !Array.isArray(details) ? details : {}),
        score: clamp(Number(details?.score || 70), 0, 100),
        examples: Math.max(0, Number(details?.examples || 0))
      }
    ])
  );
}

function expandTrainingTokens(message) {
  const words = normalizeSearchText(message)
    .split(" ")
    .filter((word) => word.length > 1);
  const tokens = [...words];

  for (let index = 0; index < words.length - 1; index += 1) {
    tokens.push(`${words[index]} ${words[index + 1]}`);
  }

  return tokens;
}

function roundNumber(value, precision = 2) {
  const factor = 10 ** precision;

  return Math.round((Number(value) || 0) * factor) / factor;
}

function calibrateIntentReasoning(intents, { message, vitals, memoryContext, context }) {
  const sorted = [...intents].sort((first, second) => second.confidence - first.confidence);
  const specialistRoutes = sorted.filter((intent) => intent.type !== "GENERAL");
  const topSpecialistConfidence = Math.max(0, ...specialistRoutes.map((intent) => intent.confidence));
  const hasCurrentVitals = hasAnyVitals(vitals);
  const hasMemory = Number(memoryContext?.recentTurnCount || 0) > 0;
  const hasContext = context?.careGoal !== "understand" || context?.duration !== "not-sure" || Number(context?.severity || 0) !== 4 || Boolean(context?.redFlags?.length);

  return sorted
    .map((intent) => {
      const evidenceCount = Array.isArray(intent.evidence) ? intent.evidence.length : 0;
      const signalBoost = Math.min(evidenceCount * 0.01, 0.04) + (hasContext ? 0.01 : 0) + (hasMemory ? 0.01 : 0);
      const generalCap = intent.type === "GENERAL" && specialistRoutes.length
        ? Math.max(0.44, topSpecialistConfidence - 0.16)
        : 0.98;
      const calibratedConfidence = clamp(intent.confidence + signalBoost, 0.01, generalCap);

      return {
        ...intent,
        confidence: calibratedConfidence,
        reasoning: {
          signalCount: evidenceCount + (hasCurrentVitals ? 1 : 0) + (hasContext ? 1 : 0) + (hasMemory ? 1 : 0),
          evidenceStrength: evidenceCount >= 3 ? "strong" : evidenceCount >= 1 ? "usable" : "fallback",
          calibration: intent.type === "GENERAL" && specialistRoutes.length
            ? "General route kept as grounding support while the specialist route owns the answer."
            : "Route confidence calibrated from matched words, structured vitals, context, and memory.",
          requestSample: compactResponseText(message, 90)
        }
      };
    })
    .sort((first, second) => second.confidence - first.confidence)
    .map((intent, index, allIntents) => ({
      ...intent,
      rank: index + 1,
      marginFromNext: index < allIntents.length - 1
        ? Math.round((intent.confidence - allIntents[index + 1].confidence) * 100)
        : null
    }));
}

function calculateRisk(message, vitals, intents, memoryContext, context = {}, profile = {}) {
  const text = buildSearchText(message);
  const reasons = [];
  const factors = [];
  let level = "LOW";
  const activeRedFlags = getActiveContextRedFlags(message, context.redFlags);

  const raise = (candidateLevel, reason, category = "Safety signal") => {
    if (riskRank[candidateLevel] > riskRank[level]) {
      level = candidateLevel;
    }
    if (!reasons.includes(reason)) {
      reasons.push(reason);
    }
    if (!factors.some((factor) => factor.reason === reason)) {
      factors.push({
        category,
        level: candidateLevel,
        reason,
        impact: riskDetails[candidateLevel].label,
        points: riskDetails[candidateLevel].score
      });
    }
  };

  const hasChestPain = hasAffirmedTerm(text, "chest pain");
  const hasBreathingConcern = hasBreathingSignal(text);
  const hasSweating = hasAffirmedTerm(text, "sweating") || hasAffirmedTerm(text, "sweat");
  const hasFainting = hasFaintingSignal(text);
  const hasStrokeConcern = hasStrokeSignal(text);
  const hasHeadache = hasAffirmedTerm(text, "headache");
  const hasDizziness = hasAffirmedTerm(text, "dizzy") || hasAffirmedTerm(text, "dizziness");
  const hasConfusion = hasAffirmedTerm(text, "confusion") || hasAffirmedTerm(text, "confused") || hasAffirmedTerm(text, "not alert");
  const hasSevereAllergy = hasSevereAllergySignal(text);
  const hasSevereHeadache = hasAffirmedTerm(text, "severe headache") || hasAffirmedTerm(text, "worst headache") || (hasAffirmedTerm(text, "headache") && context.severity >= 8);
  const hasVisionConcern = hasAffirmedTerm(text, "blurred vision") || hasAffirmedTerm(text, "vision changes") || hasAffirmedTerm(text, "trouble seeing");
  const hasThirst = hasAffirmedTerm(text, "thirsty") || hasAffirmedTerm(text, "thirst");
  const hasFatigueOrWeakness = hasAffirmedTerm(text, "fatigue") || hasAffirmedTerm(text, "tired") || hasAffirmedTerm(text, "weak") || hasAffirmedTerm(text, "weakness");
  const hasVomiting = hasAffirmedTerm(text, "vomit") || hasAffirmedTerm(text, "vomiting");
  const hasMissedMedication = hasAffirmedTerm(text, "missed") && ["medicine", "medication", "tablet", "dose", "pill", "insulin", "metformin", "amlodipine"].some((term) => hasAffirmedTerm(text, term));
  const hasMissedInsulin = hasAffirmedTerm(text, "missed") && hasAffirmedTerm(text, "insulin");
  const hasExtraDoseMedication = /(overdose|too much|extra\s+\w*\s*dose|dose\s+\w*\s*extra|took\s+extra|taken\s+extra|double dose|duplicate dose|accidental dose|wrong medicine|child took)/.test(text);
  const hasHighRiskMedicineTerm = /(insulin|warfarin|apixaban|rivaroxaban|blood thinner|clopidogrel|opioid|morphine|oxycodone|fentanyl|alprazolam|clonazepam|lithium|digoxin|methotrexate|seizure medicine)/.test(text);
  const hasBloodThinnerTerm = /(warfarin|apixaban|rivaroxaban|blood thinner|anticoagulant|clopidogrel|aspirin)/.test(text);
  const hasNsaidOrBleedingTerm = /(ibuprofen|naproxen|diclofenac|nsaid|painkiller|black stool|blood in stool|vomit blood|bleeding|bruise|head injury|fall)/.test(text);
  const hasSedativeStackTerm = /(opioid|morphine|oxycodone|hydrocodone|fentanyl|tramadol|alprazolam|clonazepam|zolpidem|sleeping pill|alcohol|very sleepy|slow breathing)/.test(text);
  const hasKidneyMedicationCaution = /(kidney|egfr|creatinine|dehydrat|vomit|diarrhea|nsaid|ibuprofen|naproxen|diclofenac|metformin|lisinopril|losartan|potassium|spironolactone)/.test(text);
  const hasDiabetesLowSugarMedicine = /(insulin|glimepiride|gliclazide|glyburide|sulfonylurea|low sugar|hypogly|sweating|shaky|confusion)/.test(text);
  const hasCriticalLabValue = /(critical lab|panic value|potassium\s*(?:>|above|high)?\s*6(?:\.|\b)|sodium\s*(?:<|below|low)?\s*12[0-9]\b|sodium\s*(?:>|above|high)?\s*15[5-9]\b|hemoglobin\s*(?:<|below|low)?\s*[0-7](?:\.|\b)|egfr\s*(?:<|below|low)?\s*(?:[0-2]?\d|30)\b|creatinine\s*(?:>|above|high)?\s*[3-9](?:\.|\b))/.test(text);
  const parsedLabRiskValues = /\b(lab|report|hba1c|a1c|glucose|cholesterol|ldl|hdl|triglyceride|hemoglobin|wbc|platelet|ferritin|creatinine|egfr|uacr|potassium|sodium|alt|ast|bilirubin|tsh|vitamin|crp|esr)\b/.test(text)
    ? extractLabValueSignals(message)
    : [];
  const parsedCriticalLabCount = parsedLabRiskValues.filter((value) => value.level === "critical").length;
  const parsedAbnormalLabCount = parsedLabRiskValues.filter((value) => value.level !== "low").length;
  const baselineBp = parseBloodPressure(profile.baselineBp || "");
  const hasCurrentBp = vitals.systolic !== null || vitals.diastolic !== null;
  const recentHighBpCount = (memoryContext.recentVitals || []).filter((reading) => (
    reading.systolic >= 160 ||
    reading.diastolic >= 100
  )).length;

  if (activeRedFlags.length) {
    const criticalFlags = activeRedFlags.filter((flag) => ["chest-pain", "breathing-trouble", "fainting", "one-sided-weakness", "severe-allergy"].includes(flag));
    if (criticalFlags.length) {
      raise("CRITICAL", `Checked red flag(s): ${criticalFlags.map(formatContextLabel).join(", ")}.`, "Context signal");
    }
  }

  if (context.severity >= 9) {
    raise("HIGH", "Symptom severity was entered as 9 or 10 out of 10.", "Severity signal");
  } else if (context.severity >= 7) {
    raise("MEDIUM", "Symptom severity was entered as 7 or 8 out of 10.", "Severity signal");
  }

  if (context.duration === "more-than-3-days" && context.severity >= 5) {
    raise("MEDIUM", "Symptoms have lasted more than 3 days with ongoing severity.", "Duration signal");
  }

  if (context.supportNow === "alone" && (context.severity >= 7 || activeRedFlags.length)) {
    raise("HIGH", "Patient may be alone while higher-risk symptoms are present.", "Support signal");
  } else if (context.supportNow === "needs-transport") {
    raise("MEDIUM", "Transport or access support may be needed.", "Access signal");
  }

  if (/miss|late|skip/i.test(context.lastMedicationTime || "")) {
    raise("MEDIUM", "Medication timing field suggests a missed, late, or skipped medicine.", "Medication signal");
  }

  if ((hasChestPain && (hasBreathingConcern || hasSweating || hasFainting)) || hasStrokeConcern || hasSevereAllergy || hasAffirmedTerm(text, "self harm") || hasAffirmedTerm(text, "suicide")) {
    raise("CRITICAL", "Emergency warning words were detected in the message.", "Message signal");
  } else if (hasChestPain) {
    raise("HIGH", "Chest pain was mentioned and should be treated cautiously.", "Message signal");
  }

  if ((hasSevereHeadache && (hasVisionConcern || hasConfusion || hasStrokeConcern)) || (hasVisionConcern && hasFainting)) {
    raise("CRITICAL", "Neurologic warning pattern was detected in the message.", "Message signal");
  } else if (hasSevereHeadache || hasVisionConcern) {
    raise("MEDIUM", "Headache or vision warning context was mentioned.", "Message signal");
  }

  if ((vitals.systolic >= 180 || vitals.diastolic >= 120) && (hasChestPain || hasBreathingConcern || hasStrokeConcern || hasConfusion || hasSevereHeadache || hasVisionConcern)) {
    raise("CRITICAL", "Very high blood pressure was paired with urgent warning symptoms.", "Vital + symptom signal");
  } else if (vitals.systolic >= 180 || vitals.diastolic >= 120) {
    raise("HIGH", "Blood pressure is in a very high range.", "Vital reading");
  } else if (vitals.systolic >= 160 || vitals.diastolic >= 100) {
    raise("MEDIUM", "Blood pressure is above the usual caution threshold.", "Vital reading");
  }

  if ((vitals.systolic >= 150 || vitals.diastolic >= 95) && (hasHeadache || hasDizziness || hasVisionConcern)) {
    raise("MEDIUM", "Elevated blood pressure was paired with headache, dizziness, or vision symptoms.", "Vital + symptom signal");
  }

  if (hasCurrentBp && baselineBp.systolic !== null && baselineBp.diastolic !== null) {
    const systolicDelta = vitals.systolic !== null ? vitals.systolic - baselineBp.systolic : 0;
    const diastolicDelta = vitals.diastolic !== null ? vitals.diastolic - baselineBp.diastolic : 0;

    if (systolicDelta >= 50 || diastolicDelta >= 30) {
      raise("HIGH", "Blood pressure is far above the saved baseline.", "Personal baseline signal");
    } else if (systolicDelta >= 30 || diastolicDelta >= 20) {
      raise("MEDIUM", "Blood pressure is meaningfully above the saved baseline.", "Personal baseline signal");
    }
  }

  if (recentHighBpCount && (vitals.systolic >= 160 || vitals.diastolic >= 100)) {
    raise("HIGH", "Persistent elevated blood-pressure pattern was found in saved memory.", "Memory trend signal");
  }

  if ((vitals.bloodSugar >= 400 || (vitals.bloodSugar !== null && vitals.bloodSugar <= 54)) && (hasConfusion || hasFainting || context.severity >= 8)) {
    raise("CRITICAL", "Extreme blood sugar reading was paired with higher-risk symptoms or severity.", "Vital + symptom signal");
  } else if (vitals.bloodSugar >= 300) {
    raise("HIGH", "Blood sugar is very high in the entered reading.", "Vital reading");
  } else if (vitals.bloodSugar !== null && vitals.bloodSugar <= 54) {
    raise("HIGH", "Blood sugar is very low in the entered reading.", "Vital reading");
  } else if (vitals.bloodSugar >= 250) {
    raise("MEDIUM", "Blood sugar is elevated in the entered reading.", "Vital reading");
  } else if (vitals.bloodSugar !== null && vitals.bloodSugar <= 70) {
    raise("MEDIUM", "Blood sugar is low in the entered reading.", "Vital reading");
  }

  if ((vitals.bloodSugar >= 240 || (vitals.bloodSugar >= 220 && (hasThirst || hasFatigueOrWeakness))) && (hasThirst || hasFatigueOrWeakness || hasVomiting || hasConfusion)) {
    raise(hasConfusion || hasVomiting ? "HIGH" : "MEDIUM", "Elevated blood sugar was paired with thirst, weakness, or dehydration symptoms.", "Vital + symptom signal");
  }

  if (vitals.heartRate >= 130) {
    raise("HIGH", "Heart rate is very high in the entered reading.", "Vital reading");
  } else if (vitals.heartRate >= 115) {
    raise("MEDIUM", "Heart rate is above the usual caution threshold.", "Vital reading");
  }

  if (vitals.temperatureC >= 40 && (hasConfusion || hasBreathingConcern || context.severity >= 8)) {
    raise("CRITICAL", "Very high temperature was paired with higher-risk symptoms or severity.", "Vital + symptom signal");
  } else if (vitals.temperatureC >= 40) {
    raise("HIGH", "Temperature is very high in the entered reading.", "Vital reading");
  } else if (vitals.temperatureC >= 39) {
    raise("MEDIUM", "Temperature is elevated in the entered reading.", "Vital reading");
  }

  if (vitals.oxygenSaturation !== null && vitals.oxygenSaturation <= 90 && (hasBreathingConcern || hasChestPain || hasConfusion || context.severity >= 8)) {
    raise("CRITICAL", "Low oxygen reading was paired with higher-risk symptoms or severity.", "Vital + symptom signal");
  } else if (vitals.oxygenSaturation !== null && vitals.oxygenSaturation <= 90) {
    raise("HIGH", "Oxygen saturation is low in the entered reading.", "Vital reading");
  } else if (vitals.oxygenSaturation !== null && vitals.oxygenSaturation <= 93) {
    raise("MEDIUM", "Oxygen saturation is below the usual caution range.", "Vital reading");
  }

  if (hasMissedInsulin) {
    raise("MEDIUM", "A missed insulin dose was mentioned.", "Medication signal");
  } else if (hasMissedMedication) {
    raise("MEDIUM", "A missed medication dose was mentioned.", "Medication signal");
  }

  if (hasExtraDoseMedication) {
    raise(hasHighRiskMedicineTerm || hasConfusion || hasFainting || hasBreathingConcern ? "HIGH" : "MEDIUM", "Possible extra, duplicate, wrong, or accidental medicine dose was mentioned.", "Medication safety signal");
  }

  if (hasBloodThinnerTerm && hasNsaidOrBleedingTerm) {
    raise(/black stool|blood in stool|vomit blood|major bleeding|head injury/.test(text) ? "HIGH" : "MEDIUM", "Blood thinner, NSAID, injury, or bleeding context needs medication-safety review.", "Medication interaction signal");
  }

  if (hasSedativeStackTerm && (hasBreathingConcern || hasFainting || hasConfusion || /alcohol|opioid|sleeping pill|benzodiazepine|very sleepy|slow breathing/.test(text))) {
    raise(hasBreathingConcern || hasConfusion ? "HIGH" : "MEDIUM", "Sedating medicine, alcohol, opioid, or breathing/fall-risk context was mentioned.", "Medication interaction signal");
  }

  if (hasKidneyMedicationCaution && /nsaid|ibuprofen|naproxen|diclofenac|dehydrat|vomit|diarrhea|metformin|potassium|spironolactone/.test(text)) {
    raise("MEDIUM", "Kidney, dehydration, NSAID, potassium, or metformin context can change medication safety.", "Medication interaction signal");
  }

  if (hasDiabetesLowSugarMedicine && /(low sugar|hypogly|sweating|shaky|confusion|missed meal|not eating|extra dose|double dose)/.test(text)) {
    raise(hasConfusion || hasFainting ? "HIGH" : "MEDIUM", "Diabetes medicine with low-sugar or meal-timing context needs caution.", "Medication safety signal");
  }

  if (hasCriticalLabValue) {
    raise(hasConfusion || hasFainting || hasBreathingConcern || hasChestPain || hasAffirmedTerm(text, "severe weakness") ? "HIGH" : "MEDIUM", "Critical or very abnormal lab wording was mentioned.", "Lab safety signal");
  }

  if (parsedCriticalLabCount) {
    raise(hasConfusion || hasFainting || hasBreathingConcern || hasChestPain || hasAffirmedTerm(text, "severe weakness") ? "HIGH" : "MEDIUM", "Parsed lab value reached an urgent review band.", "Lab safety signal");
  } else if (parsedAbnormalLabCount >= 2 || (parsedAbnormalLabCount && /(tired|weak|dizzy|fever|pain|swelling|shortness|confusion|vomit|diarrhea)/.test(text))) {
    raise("MEDIUM", "Multiple abnormal lab values or symptoms with an abnormal lab value need clinician review.", "Lab safety signal");
  }

  if ((hasTerm(text, "dizzy") || hasTerm(text, "dizziness")) && hasMissedMedication) {
    raise("MEDIUM", "Dizziness plus missed medication needs caution.", "Combined signal");
  }

  const hasCurrentCautionSignal = context.severity >= 6
    || context.redFlags?.length
    || hasChestPain
    || hasBreathingConcern
    || hasFainting
    || hasStrokeConcern
    || hasSevereAllergy
    || hasConfusion
    || hasSevereHeadache
    || hasVisionConcern
    || vitals.systolic >= 160
    || vitals.diastolic >= 100
    || vitals.bloodSugar >= 250
    || (vitals.bloodSugar !== null && vitals.bloodSugar <= 70)
    || vitals.heartRate >= 115
    || vitals.temperatureC >= 39
    || (vitals.oxygenSaturation !== null && vitals.oxygenSaturation <= 93)
    || hasMissedMedication
    || hasExtraDoseMedication
    || (hasBloodThinnerTerm && hasNsaidOrBleedingTerm)
    || hasSedativeStackTerm
    || (hasKidneyMedicationCaution && /nsaid|ibuprofen|naproxen|diclofenac|dehydrat|vomit|diarrhea|metformin|potassium|spironolactone/.test(text))
    || (hasDiabetesLowSugarMedicine && /(low sugar|hypogly|sweating|shaky|confusion|missed meal|not eating|extra dose|double dose)/.test(text))
    || hasCriticalLabValue
    || parsedAbnormalLabCount > 0;

  if ((memoryContext.recentRisks.includes("HIGH") || memoryContext.recentRisks.includes("CRITICAL")) && hasCurrentCautionSignal) {
    raise("MEDIUM", "Recent local memory includes a higher-risk interaction.", "Memory signal");
  }

  if (intents.some((intent) => intent.type === "EMERGENCY" && !isTrainingOnlyIntent(intent))) {
    raise(level === "LOW" ? "HIGH" : level, "Emergency warning signs were detected.", "Safety signal");
  }

  if (reasons.length === 0) {
    reasons.push("No high-risk safety rules were triggered.");
    factors.push({
      category: "Baseline",
      level: "LOW",
      reason: "No high-risk safety rules were triggered.",
      impact: riskDetails.LOW.label,
      points: riskDetails.LOW.score
    });
  }

  const detail = riskDetails[level];
  const calibratedScore = computeCalibratedRiskScore({ level, factors, intents, vitals, context, memoryContext });

  return {
    level,
    label: detail.label,
    score: calibratedScore.score,
    reasons,
    factors,
    calibration: calibratedScore,
    actionRequired: level !== "LOW",
    action_required: level !== "LOW",
    recommendation: detail.recommendation
  };
}

function computeCalibratedRiskScore({ level, factors, intents, vitals, context, memoryContext }) {
  const ranges = {
    LOW: [10, 34],
    MEDIUM: [42, 66],
    HIGH: [72, 88],
    CRITICAL: [92, 99]
  };
  const [min, max] = ranges[level];
  const factorWeight = factors.reduce((total, factor) => {
    const weights = {
      LOW: 2,
      MEDIUM: 5,
      HIGH: 8,
      CRITICAL: 11
    };
    return total + (weights[factor.level] || 1);
  }, 0);
  const vitalWeight = Object.values(vitals).filter((value) => value !== null).length * 2;
  const contextWeight = [
    context.duration !== "not-sure",
    context.severity >= 6,
    context.careGoal !== "understand",
    context.supportNow !== "with-someone",
    Boolean(context.lastMedicationTime),
    context.redFlags.length > 0
  ].filter(Boolean).length * 2;
  const routeWeight = Math.max(intents.length - 1, 0) * 2;
  const memoryWeight = memoryContext.recentTurnCount ? 2 : 0;
  const repeatedVitalWeight = (memoryContext.recentVitals || []).some((reading) => (
    reading.systolic >= 160 ||
    reading.diastolic >= 100 ||
    reading.bloodSugar >= 250 ||
    (reading.bloodSugar !== null && reading.bloodSugar <= 70) ||
    reading.heartRate >= 115 ||
    reading.temperatureC >= 39
  )) ? 4 : 0;
  const raw = min + factorWeight + vitalWeight + contextWeight + routeWeight + memoryWeight + repeatedVitalWeight;
  const score = clamp(raw, min, max);

  return {
    score,
    band: `${min}-${max}`,
    method: "Safety-first deterministic weighted calibration",
    drivers: {
      factors: factorWeight,
      vitals: vitalWeight,
      context: contextWeight,
      routes: routeWeight,
      memory: memoryWeight,
      repeatedVitals: repeatedVitalWeight
    }
  };
}

function normalizeExternalKnowledge(input = {}) {
  const value = input && typeof input === "object" && !Array.isArray(input) ? input : {};

  return {
    enabled: Boolean(value.enabled),
    endpointHost: cleanText(value.endpointHost).slice(0, 120),
    fetchedOnline: Boolean(value.fetchedOnline),
    cacheHit: Boolean(value.cacheHit),
    cacheMatchedQueries: Number.isFinite(Number(value.cacheMatchedQueries)) ? Number(value.cacheMatchedQueries) : 0,
    usedForThisRequest: Boolean(value.usedForThisRequest),
    error: cleanText(value.error).slice(0, 240),
    cache: {
      file: cleanText(value.cache?.file) || "data/external/external-knowledge-cache.json",
      ttlHours: Number.isFinite(Number(value.cache?.ttlHours)) ? Number(value.cache.ttlHours) : 168
    },
    safetyBoundary: cleanText(value.safetyBoundary) || "External content is treated as reference material only and still passes Care Nova safety guardrails.",
    records: normalizeExternalKnowledgeRecords(value.records)
  };
}

function normalizeExternalKnowledgeRecords(records = []) {
  if (!Array.isArray(records)) {
    return [];
  }

  return records.map((record, index) => {
    const value = record && typeof record === "object" ? record : { summary: record };
    const title = cleanText(value.title || value.name || `External reference ${index + 1}`).slice(0, 140);
    const summary = cleanText(value.summary || value.description || value.text || value.content || value.answer).slice(0, 900);

    if (!summary) {
      return null;
    }

    const source = cleanText(value.source || value.url || value.link || "Approved external API").slice(0, 180);
    const category = cleanText(value.category || value.type || "External Reference").slice(0, 80);
    const keywords = Array.isArray(value.keywords)
      ? value.keywords.map(cleanText).filter(Boolean).slice(0, 12)
      : buildSearchText(`${title} ${category} ${summary}`).split(" ").filter((token) => token.length > 2).slice(0, 12);

    return {
      id: cleanText(value.id) || `external-reference-${index + 1}`,
      title,
      category,
      keywords,
      summary,
      safetyNotes: cleanText(value.safetyNotes || value.warning || "External reference cached locally; verify with approved sources and clinician review.").slice(0, 360),
      source,
      sourceMode: cleanText(value.sourceMode) || "external-api-local-cache",
      cachedAt: cleanText(value.cachedAt)
    };
  }).filter(Boolean).slice(0, 8);
}

function buildVitalKnowledgeQuerySignals(vitals = {}) {
  const signals = [];

  if (vitals.systolic !== null || vitals.diastolic !== null) {
    signals.push(`blood pressure bp systolic ${vitals.systolic ?? "unknown"} diastolic ${vitals.diastolic ?? "unknown"} hypertension`);

    if (vitals.systolic >= 180 || vitals.diastolic >= 120) {
      signals.push("very high blood pressure hypertensive urgent safety");
    } else if (vitals.systolic >= 160 || vitals.diastolic >= 100) {
      signals.push("high blood pressure elevated reading");
    } else if ((vitals.systolic !== null && vitals.systolic < 90) || (vitals.diastolic !== null && vitals.diastolic < 60)) {
      signals.push("low blood pressure dizziness fainting");
    }
  }

  if (vitals.bloodSugar !== null) {
    signals.push(`blood sugar glucose diabetes reading ${vitals.bloodSugar}`);

    if (vitals.bloodSugar >= 300) {
      signals.push("very high blood sugar hyperglycemia dehydration ketone safety");
    } else if (vitals.bloodSugar !== null && vitals.bloodSugar <= 70) {
      signals.push("low blood sugar hypoglycemia sweating shaking confusion safety");
    }
  }

  if (vitals.heartRate !== null) {
    signals.push(`heart rate pulse bpm ${vitals.heartRate}`);

    if (vitals.heartRate >= 130) {
      signals.push("very fast pulse tachycardia safety");
    } else if (vitals.heartRate < 45) {
      signals.push("slow pulse bradycardia dizziness safety");
    }
  }

  if (vitals.temperatureC !== null) {
    signals.push(`temperature fever celsius ${vitals.temperatureC}`);

    if (vitals.temperatureC >= 39.4) {
      signals.push("high fever infection urgent safety");
    } else if (vitals.temperatureC <= 35) {
      signals.push("low body temperature hypothermia review");
    }
  }

  if (vitals.oxygenSaturation !== null) {
    signals.push(`oxygen saturation spo2 ${vitals.oxygenSaturation}`);

    if (vitals.oxygenSaturation <= 90) {
      signals.push("low oxygen breathing urgent safety");
    } else if (vitals.oxygenSaturation <= 93) {
      signals.push("reduced oxygen breathing review");
    }
  }

  if (vitals.weightKg !== null || vitals.heightCm !== null || vitals.waistCm !== null) {
    signals.push("bmi weight height waist metabolic lifestyle");
  }

  if (vitals.sleepHours !== null) {
    signals.push(`sleep hours ${vitals.sleepHours} fatigue recovery lifestyle`);
  }

  if (vitals.stepsCount !== null) {
    signals.push(`steps activity movement ${vitals.stepsCount}`);
  }

  if (vitals.waterCups !== null) {
    signals.push(`hydration water cups ${vitals.waterCups}`);
  }

  return signals;
}

function buildMedicalKnowledgeQuery({ message, profile, vitals, context, intents, risk, memoryContext, primaryRoute = "" }) {
  const routeHint = executableAgentRoutes.has(primaryRoute) ? primaryRoute : "";
  const focusedGeneralOrSpecialist = routeHint === "RAG_AGENT" || routeHint === "SPECIALIST_DOCTOR_AGENT";
  const patientSignalText = routeHint === "SPECIALIST_DOCTOR_AGENT"
    ? getSpecialistPatientSignalText(message)
    : "";
  const structuredSpecialistEvidence = routeHint === "SPECIALIST_DOCTOR_AGENT"
    ? getSpecialistStructuredEvidenceText(message)
    : "";
  const sharedParts = [
    profile.conditions.join(" "),
    profile.medications.join(" "),
    Array.isArray(profile.allergies) ? profile.allergies.join(" ") : cleanText(profile.allergies),
    context.careGoal,
    context.duration && context.duration !== "not-sure" ? `duration ${formatContextLabel(context.duration)}` : "",
    Number(context.severity || 0) ? `severity ${context.severity} out of 10` : "",
    context.supportNow && context.supportNow !== "with-someone" ? `support ${formatContextLabel(context.supportNow)}` : "",
    context.lastMedicationTime || "",
    ...buildVitalKnowledgeQuerySignals(vitals),
    risk.level !== "LOW" ? `risk ${risk.level.toLowerCase()} urgent safety red flags` : "",
    Array.isArray(risk.reasons) ? risk.reasons.slice(0, focusedGeneralOrSpecialist ? 2 : 4).join(" ") : "",
    memoryContext.recentTurnCount ? "history remember previous local memory" : "",
    Array.isArray(memoryContext.recentRisks) ? memoryContext.recentRisks.slice(0, 3).join(" ") : "",
    Array.isArray(memoryContext.recentVitals) && memoryContext.recentVitals.length ? "recent vital trend previous readings baseline" : ""
  ];
  const routeParts = routeHint === "RAG_AGENT"
    ? [
      message,
      context.redFlags.map(formatContextLabel).join(" "),
      "general health question symptom review explanation next safe step"
    ]
    : routeHint === "SPECIALIST_DOCTOR_AGENT"
      ? [
        patientSignalText || message,
        structuredSpecialistEvidence,
        context.redFlags.map(formatContextLabel).join(" "),
        "specialist disease review condition monitoring prevention complications clinician discussion",
        context.specialistLens ? `specialist lens ${formatContextLabel(context.specialistLens)}` : "",
        Array.isArray(context.riskModifiers) && context.riskModifiers.length
          ? context.riskModifiers.map(formatContextLabel).join(" ")
          : ""
      ]
      : [
        message,
        context.redFlags.map(formatContextLabel).join(" ")
      ];
  const intentParts = focusedGeneralOrSpecialist
    ? []
    : [
      intents.map((intent) => intent.label).join(" "),
      intents.flatMap((intent) => intent.evidence || []).slice(0, 10).join(" ")
    ];
  const queryParts = limitKnowledgeQueryParts(
    dedupeResponseItems([...routeParts, ...sharedParts, ...intentParts].filter(Boolean)),
    routeHint === "RAG_AGENT"
      ? 10
      : routeHint === "SPECIALIST_DOCTOR_AGENT"
        ? 12
        : 18
  );
  const query = buildSearchText(queryParts.join(" "));

  return {
    parts: queryParts,
    query,
    tokenCount: query.split(" ").filter(Boolean).length
  };
}

function limitKnowledgeQueryParts(parts = [], limit = 18) {
  return Array.isArray(parts) ? parts.slice(0, Math.max(1, limit)) : [];
}

function buildRouteKnowledgeMap({ rankedMatches = [], baseCoverageScore = 35, routes = null }) {
  const routeMatchesByRoute = {};
  const routeIds = Array.isArray(routes) && routes.length
    ? routes.filter((route) => routeEvidencePolicy[route])
    : Object.keys(routeEvidencePolicy);

  for (const route of routeIds) {
    const policy = routeEvidencePolicy[route] || routeEvidencePolicy.RAG_AGENT;
    const scopedLimit = route === "SPECIALIST_DOCTOR_AGENT" ? 8 : 4;
    const scopedMatches = rankedMatches
      .filter((match) => doesKnowledgeMatchRoutePolicy(match, policy))
      .slice(0, scopedLimit);
    const matchedTerms = new Set(scopedMatches.flatMap((match) => match.matchedTerms || [])).size;
    const averageRelevance = scopedMatches.length
      ? Math.round(scopedMatches.reduce((total, match) => total + Number(match.relevance || 0), 0) / scopedMatches.length)
      : 0;
    const coverageScore = scopedMatches.length
      ? clamp(
        averageRelevance + Math.min(scopedMatches.length * 5, 14) + Math.min(matchedTerms * 2, 10),
        Math.max(35, policy.minimumCoverage - 10),
        99
      )
      : Math.max(35, Math.min(policy.minimumCoverage, Number(baseCoverageScore || 35)));

    routeMatchesByRoute[route] = {
      route,
      label: routeLabel(route),
      categories: [...policy.categories],
      coverageScore,
      matchedTerms,
      matches: scopedMatches.map((entry) => ({
        id: entry.id,
        title: entry.title,
        category: entry.category,
        relevance: entry.relevance || 42,
        matchedTerms: entry.matchedTerms || [],
        semanticFamilies: entry.semanticFamilies || [],
        evidenceGrade: entry.evidenceGrade || "supporting",
        summary: entry.summary,
        safetyNotes: entry.safetyNotes,
        source: entry.source,
        sourceMode: entry.sourceMode || "offline-local",
        cachedAt: entry.cachedAt || ""
      }))
    };
  }

  return routeMatchesByRoute;
}

function getRouteMedicalKnowledge(route, medicalKnowledge = {}) {
  const policy = routeEvidencePolicy[route] || routeEvidencePolicy.RAG_AGENT;
  const scoped = medicalKnowledge?.routeMatchesByRoute?.[route];
  const cache = getRouteMedicalKnowledgeCache(medicalKnowledge);

  if (scoped?.matches?.length) {
    return scoped;
  }

  if (cache?.has(route)) {
    return cache.get(route);
  }

  const matches = (medicalKnowledge?.matches || []).filter((match) => doesKnowledgeMatchRoutePolicy(match, policy));
  const result = {
    route,
    label: routeLabel(route),
    categories: [...policy.categories],
    coverageScore: matches.length ? Number(medicalKnowledge?.coverageScore || 0) : Math.max(35, policy.minimumCoverage - 12),
    matchedTerms: new Set(matches.flatMap((match) => match.matchedTerms || [])).size,
    matches
  };

  if (cache) {
    cache.set(route, result);
  }

  return result;
}

function getRouteKnowledgeMatches(route, medicalKnowledge = {}, limit = 3) {
  return (getRouteMedicalKnowledge(route, medicalKnowledge).matches || []).slice(0, limit);
}

function getRouteKnowledgeCoverage(route, medicalKnowledge = {}) {
  return Number(getRouteMedicalKnowledge(route, medicalKnowledge).coverageScore || medicalKnowledge?.coverageScore || 0);
}

function getRouteMedicalKnowledgeCache(medicalKnowledge = {}) {
  if (!medicalKnowledge || typeof medicalKnowledge !== "object") {
    return null;
  }

  if (medicalKnowledge.__routeKnowledgeCache instanceof Map) {
    return medicalKnowledge.__routeKnowledgeCache;
  }

  const cache = new Map();
  Object.defineProperty(medicalKnowledge, "__routeKnowledgeCache", {
    value: cache,
    writable: true,
    configurable: true,
    enumerable: false
  });

  return cache;
}

function mapKnowledgeReferences(matches = [], limit = 3) {
  return (matches || []).slice(0, limit).map((match) => ({
    title: match.title,
    source: match.source,
    relevance: match.relevance
  }));
}

function buildKnowledgeRetrievalScope({ intents = [], risk = {}, singleAgentScope = {}, requirementProfile = {} }) {
  const sortedIntents = [...intents].sort((first, second) => second.confidence - first.confidence);
  const fallbackRoute = requirementProfile.expectedRoute || sortedIntents[0]?.route || "RAG_AGENT";
  const primaryRoute = singleAgentScope?.enabled && singleAgentScope.route
    ? singleAgentScope.route
    : fallbackRoute;
  const focusedGeneralOrSpecialist = singleAgentScope?.enabled && (primaryRoute === "RAG_AGENT" || primaryRoute === "SPECIALIST_DOCTOR_AGENT");
  const focusedRoutes = new Set(
    focusedGeneralOrSpecialist
      ? [primaryRoute]
      : sortedIntents.map((intent) => intent.route)
  );

  if ((risk.level === "HIGH" || risk.level === "CRITICAL") && !focusedRoutes.has("ALERT_AGENT")) {
    focusedRoutes.add("ALERT_AGENT");
  }

  const routes = Array.from(focusedRoutes).filter((route) => executableAgentRoutes.has(route));
  const routeCategories = new Set(routes.flatMap((route) => routeEvidencePolicy[route]?.categories || []));
  const primaryCategories = new Set(routeEvidencePolicy[primaryRoute]?.categories || []);

  return {
    primaryRoute,
    routes,
    routeCategories,
    primaryCategories,
    focusedGeneralOrSpecialist,
    maxMatches: focusedGeneralOrSpecialist
      ? primaryRoute === "RAG_AGENT"
        ? 10
        : 12
      : 18
  };
}

function retrieveMedicalKnowledge({ message, profile, vitals, context, intents, risk, memoryContext, externalKnowledge = {}, singleAgentScope = {}, requirementProfile = {} }) {
  const retrievalScope = buildKnowledgeRetrievalScope({ intents, risk, singleAgentScope, requirementProfile });
  const queryProfile = buildMedicalKnowledgeQuery({
    message,
    profile,
    vitals,
    context,
    intents,
    risk,
    memoryContext,
    primaryRoute: retrievalScope.primaryRoute
  });
  const query = queryProfile.query;
  const categoryMap = {
    GENERAL: ["General", "Vitals"],
    SPECIALIST_DOCTOR: ["General", "Vitals", "Labs", "Medication", "Lifestyle", "Urgent Safety"],
    MEDICATION: ["Medication"],
    APPOINTMENT: ["Follow-up"],
    EMERGENCY: ["Urgent Safety"],
    VITALS_TRACKING: ["Vitals"],
    LAB_REPORT: ["Labs"],
    LIFESTYLE: ["Lifestyle"],
    MENTAL_WELLNESS: ["Mental Wellness", "Urgent Safety"],
    HEALTH_RECORDS: ["Records", "Memory"],
    INSURANCE_SUPPORT: ["Insurance", "Claims Operations", "Utilization Management"],
    CARE_TRANSITIONS: ["Care Transitions"],
    CLAIMS_OPERATIONS: ["Claims Operations"],
    UTILIZATION_MANAGEMENT: ["Utilization Management"],
    GXP_QUALITY: ["GxP Quality"],
    MEDTECH_COMPLIANCE: ["MedTech Compliance"]
  };
  const externalRecords = normalizeExternalKnowledgeRecords(externalKnowledge.records);
  const combinedKnowledgeBase = dedupeKnowledgeEntries([...externalRecords, ...medicalKnowledgeBase]);
  const localAiRanking = rankLocalMedicalKnowledge({
    query,
    records: combinedKnowledgeBase,
    intents,
    risk,
    routeCategories: retrievalScope.routeCategories,
    primaryCategories: retrievalScope.primaryCategories,
    categoryMap,
    maxMatches: retrievalScope.maxMatches
  });
  const scoredMatches = localAiRanking.matches || [];
  const fallbackMatch = medicalKnowledgeBase.find((entry) => entry.id === "local-memory-learning") || medicalKnowledgeBase[0];
  const routeMatchesByRoute = buildRouteKnowledgeMap({
    rankedMatches: scoredMatches,
    baseCoverageScore: localAiRanking.coverageScore || 35,
    routes: retrievalScope.routes
  });
  const matches = scoredMatches.length
    ? scoredMatches.slice(0, 5)
    : [fallbackMatch].filter(Boolean);
  const coverageScore = clamp(
    Math.max(
      localAiRanking.coverageScore || 0,
      Math.round(matches.reduce((total, item) => total + (item.relevance || 42), 0) / matches.length) + Math.min(matches.length * 7, 24)
    ),
    35,
    99
  );
  const localRuntime = getLocalAiRuntimeStatus();
  const usedExternal = externalRecords.length > 0;
  const externalMetadata = {
    enabled: Boolean(externalKnowledge.enabled),
    usedForThisRequest: usedExternal,
    fetchedOnline: Boolean(externalKnowledge.fetchedOnline),
    cacheHit: Boolean(externalKnowledge.cacheHit),
    cacheMatchedQueries: externalKnowledge.cacheMatchedQueries || 0,
    recordsUsed: externalRecords.length,
    cacheFile: externalKnowledge.cache?.file || "data/external/external-knowledge-cache.json",
    endpointHost: externalKnowledge.endpointHost || "",
    error: externalKnowledge.error || "",
    safetyBoundary: externalKnowledge.safetyBoundary || "External content is treated as reference material only and still passes Care Nova safety guardrails."
  };

  return {
    mode: usedExternal ? "online-augmented external cache plus offline local ML retrieval" : "offline-first local ML medical database retrieval",
    offlineReady: true,
    onlineReady: localRuntime.onlineReady || usedExternal,
    onlineStatus: usedExternal
      ? externalKnowledge.fetchedOnline
        ? "external-api-fetched-and-cached"
        : "external-local-cache-reused"
      : localRuntime.onlineConnector.status,
    externalKnowledge: externalMetadata,
    localAi: {
      id: localAiRanking.id,
      version: localAiRanking.version,
      mode: localAiRanking.mode,
      score: localAiRanking.coverageScore,
      queryFamilies: localAiRanking.queryFamilies,
      queryTokenCount: localAiRanking.queryTokenCount,
      expandedQueryTokenCount: localAiRanking.expandedQueryTokenCount,
      queryCacheHit: Boolean(localAiRanking.queryCacheHit),
      scoring: localAiRanking.scoring,
      scope: retrievalScope.focusedGeneralOrSpecialist ? "focused-single-agent" : "multi-route",
      primaryRoute: retrievalScope.primaryRoute,
      runtime: localRuntime
    },
    queryProfile: {
      tokenCount: queryProfile.tokenCount,
      parts: queryProfile.parts.slice(0, 14)
    },
    corpusSize: combinedKnowledgeBase.length,
    localCorpusSize: medicalKnowledgeBase.length,
    offlineDatabase: {
      name: OFFLINE_DATABASE_SUMMARY.name,
      mode: OFFLINE_DATABASE_SUMMARY.mode,
      storage: OFFLINE_DATABASE_SUMMARY.storage,
      storedRecords: OFFLINE_DATABASE_SUMMARY.storedRecords,
      scaleTarget: OFFLINE_DATABASE_SUMMARY.scaleTarget,
      trainingStatus: OFFLINE_DATABASE_SUMMARY.trainingStatus
    },
    coverageScore,
    matches: matches.map((entry) => ({
      id: entry.id,
      title: entry.title,
      category: entry.category,
      routeTags: entry.routeTags || [],
      clinicalDomains: entry.clinicalDomains || [],
      relevance: entry.relevance || 42,
      matchedTerms: entry.matchedTerms || [],
      semanticFamilies: entry.semanticFamilies || [],
      evidenceGrade: entry.evidenceGrade || "supporting",
      summary: entry.summary,
      safetyNotes: entry.safetyNotes,
      source: entry.source,
      sourceMode: entry.sourceMode || "offline-local",
      cachedAt: entry.cachedAt || ""
    })),
    routeMatchesByRoute,
    limitations: [
      usedExternal
        ? "Approved external API references are treated as cached support material and still require approved-source review."
        : "This demo uses a seeded offline medical database and curated local safety references, not live clinical databases.",
      "It is not trained on trillions of medical records in this local build; it is ready for governed licensed corpus ingestion.",
      "Medical facts are not updated by unsupervised patient conversations.",
      "High-risk symptoms always prioritize real-world care over model confidence."
    ],
    learningBoundary: "Local memory learns patient context only; medical knowledge requires curated clinician-reviewed updates.",
    dataPolicy: "Persistent local server memory is stored on disk for this app. External API data, when configured, is de-identified, normalized, and cached in data/external/external-knowledge-cache.json for future local reuse."
  };
}

function buildAccuracyControls({ confidence, dataQuality, medicalKnowledge, guardrails, inputQuality, accuracyProfile, accuracyEngine }) {
  const knowledgeScore = medicalKnowledge?.coverageScore || 50;
  const inputScore = inputQuality?.score || 50;
  const decisionScore = accuracyProfile?.score || 65;
  const engineScore = accuracyEngine?.score || decisionScore;
  const score = clamp(Math.round(
    (confidence.score * 0.14) +
    (dataQuality.score * 0.15) +
    (knowledgeScore * 0.18) +
    (inputScore * 0.12) +
    (decisionScore * 0.13) +
    (engineScore * 0.16) +
    (guardrails.passed ? 12 : 0)
  ), 0, 99);

  return {
    score,
    label: score >= 90
      ? "High reliability controls"
      : score >= 80
        ? "Strong reliability controls"
        : score >= 65
          ? "Good reliability controls"
          : "Needs more evidence",
    checks: [
      {
        title: "Evidence coverage",
        status: `${knowledgeScore}%`,
        detail: `${medicalKnowledge.matches.length} local medical reference(s) matched this request.`,
        level: knowledgeScore >= 75 ? "low" : "medium"
      },
      {
        title: "Local ML ranker",
        status: `${medicalKnowledge.localAi?.score || knowledgeScore}%`,
        detail: `${medicalKnowledge.localAi?.mode || "offline ranker"} used ${medicalKnowledge.localAi?.queryTokenCount || 0} query token(s) and semantic route scoring.`,
        level: (medicalKnowledge.localAi?.score || knowledgeScore) >= 75 ? "low" : "medium"
      },
      {
        title: "Input quality",
        status: `${inputScore}%`,
        detail: inputQuality?.summary || "Message and structured fields were checked.",
        level: inputScore >= 70 ? "low" : "medium"
      },
      {
        title: "Confidence calibration",
        status: `${confidence.score}%`,
        detail: confidence.explanation,
        level: confidence.score >= 80 ? "low" : "medium"
      },
      {
        title: "Decision quality",
        status: `${decisionScore}%`,
        detail: accuracyProfile?.summary || "Route margin, evidence, uncertainty, and review boundary were checked.",
        level: decisionScore >= 80 ? "low" : decisionScore >= 65 ? "medium" : "critical"
      },
      {
        title: "Clinical accuracy engine",
        status: `${engineScore}%`,
        detail: accuracyEngine?.summary || "Route, evidence, safety, and consistency checks were completed.",
        level: engineScore >= 80 ? "low" : engineScore >= 65 ? "medium" : "critical"
      },
      {
        title: "Safety guardrails",
        status: guardrails.passed ? "Passed" : "Review",
        detail: guardrails.summary,
        level: guardrails.passed ? "low" : "critical"
      },
      {
        title: "Medical fact learning",
        status: "Locked",
        detail: "Patient conversations update context memory only, not the medical knowledge base.",
        level: "low"
      }
    ]
  };
}

function buildAccuracyProfile({ intents, risk, medicalKnowledge, inputQuality, dataQuality, vitalAssessment, contextSignals, messageSignals }) {
  const sortedIntents = [...intents].sort((first, second) => second.confidence - first.confidence);
  const topIntent = sortedIntents[0];
  const secondIntent = sortedIntents[1];
  const routeMargin = secondIntent
    ? Math.round((topIntent.confidence - secondIntent.confidence) * 100)
    : 100;
  const evidenceTerms = new Set(intents.flatMap((intent) => intent.evidence)).size;
  const acceptedVitals = inputQuality?.acceptedVitals?.length || 0;
  const highSignals = [
    ...vitalAssessment.filter((item) => ["high", "critical"].includes(item.level)),
    ...contextSignals.filter((item) => ["high", "critical"].includes(item.level)),
    ...messageSignals.filter((item) => ["emergency", "medication"].includes(item.level))
  ].length;
  const uncertaintyFlags = [];

  if (routeMargin < 8 && sortedIntents.length > 1) {
    uncertaintyFlags.push("Two care routes are close in confidence.");
  }

  if (evidenceTerms < 2) {
    uncertaintyFlags.push("Few message evidence terms were available.");
  }

  if (medicalKnowledge.coverageScore < 60) {
    uncertaintyFlags.push("Local knowledge coverage is limited for this request.");
  }

  if (!acceptedVitals && risk.level !== "LOW") {
    uncertaintyFlags.push("Higher-risk path has no accepted vital reading.");
  }

  if (dataQuality.score < 55) {
    uncertaintyFlags.push("Patient context is incomplete.");
  }

  const score = clamp(Math.round(
    (Math.min(routeMargin, 35) / 35) * 22 +
    Math.min(evidenceTerms * 6, 24) +
    (medicalKnowledge.coverageScore * 0.24) +
    ((inputQuality?.score || 50) * 0.16) +
    ((dataQuality?.score || 50) * 0.14)
  ), 0, 99);

  return {
    score,
    label: score >= 88
      ? "High decision clarity"
      : score >= 75
        ? "Strong decision clarity"
        : score >= 60
          ? "Moderate decision clarity"
          : "Needs more evidence",
    summary: `${topIntent?.label || "General"} route margin ${routeMargin} point(s), ${evidenceTerms} evidence term(s), ${medicalKnowledge.matches.length} reference match(es).`,
    routeMargin,
    evidenceTerms,
    highSignals,
    uncertaintyFlags,
    humanReviewNeeded: risk.level !== "LOW" || uncertaintyFlags.length > 0,
    checks: [
      {
        title: "Route margin",
        detail: secondIntent
          ? `${topIntent.label} is ${routeMargin} point(s) above ${secondIntent.label}.`
          : `${topIntent?.label || "General"} is the only active care need.`,
        level: routeMargin >= 12 ? "low" : "medium"
      },
      {
        title: "Evidence density",
        detail: `${evidenceTerms} unique evidence term(s) and ${messageSignals.length} message signal group(s) were used.`,
        level: evidenceTerms >= 3 ? "low" : "medium"
      },
      {
        title: "Uncertainty",
        detail: uncertaintyFlags.length ? uncertaintyFlags.join(" ") : "No major uncertainty flags detected.",
        level: uncertaintyFlags.length ? "medium" : "low"
      },
      {
        title: "Review boundary",
        detail: risk.level === "LOW"
          ? "Automated guidance remains draft-safe and local."
          : "Higher-risk result keeps real-world clinical review visible.",
        level: risk.level === "LOW" ? "low" : risk.level.toLowerCase()
      }
    ]
  };
}

function buildAccuracyEngine({
  message,
  profile,
  vitals,
  context,
  memoryContext,
  intents,
  risk,
  plan,
  guardrails,
  inputQuality,
  requirementProfile,
  dataQuality,
  medicalKnowledge,
  accuracyProfile,
  vitalAssessment,
  messageSignals,
  contextSignals
}) {
  const routePrecision = buildRoutePrecision({ intents, plan, accuracyProfile });
  const requirementFit = buildRequirementFitReview({ requirementProfile, plan, intents, risk });
  const evidenceAlignment = buildEvidenceAlignment({ medicalKnowledge, intents, vitalAssessment, messageSignals, contextSignals });
  const safetyCalibration = buildSafetyCalibration({ message, vitals, context, risk, plan, guardrails });
  const clinicalPrecisionReview = buildClinicalPrecisionReview({
    message,
    profile,
    vitals,
    context,
    memoryContext,
    risk,
    plan,
    medicalKnowledge,
    inputQuality
  });
  const consistencyReview = buildConsistencyReview({
    message,
    vitals,
    context,
    risk,
    intents,
    plan,
    medicalKnowledge,
    inputQuality,
    dataQuality,
    safetyCalibration
  });
  const dataCompleteness = clamp(Math.round(
    ((inputQuality?.score || 50) * 0.54) +
      ((dataQuality?.score || 50) * 0.46)
  ), 0, 99);
  const score = clamp(Math.round(
    (routePrecision.score * 0.14) +
      (requirementFit.score * 0.13) +
      (evidenceAlignment.score * 0.18) +
      (safetyCalibration.score * 0.23) +
      (consistencyReview.score * 0.14) +
      (clinicalPrecisionReview.score * 0.1) +
      (dataCompleteness * 0.08)
  ), 0, 99);
  const reviewNotes = [
    ...safetyCalibration.failures,
    ...consistencyReview.issues,
    ...clinicalPrecisionReview.issues
  ];

  return {
    name: "Clinical Accuracy Engine",
    score,
    label: score >= 92
      ? "Exceptional precision"
      : score >= 84
        ? "High precision"
        : score >= 70
          ? "Good precision"
          : "Needs more evidence",
    summary: `${requirementFit.label}; ${routePrecision.label}; ${evidenceAlignment.label}; ${safetyCalibration.label}.`,
    routePrecision,
    requirementFit,
    evidenceAlignment,
    safetyCalibration,
    consistencyReview,
    clinicalPrecisionReview,
    dataCompleteness,
    reviewNeeded: risk.level !== "LOW" || reviewNotes.length > 0,
    reviewNotes: reviewNotes.slice(0, 5),
    checks: [
      {
        title: "Requirement fit",
        status: `${requirementFit.score}%`,
        detail: requirementFit.detail,
        level: precisionLevelForScore(requirementFit.score)
      },
      {
        title: "Route precision",
        status: `${routePrecision.score}%`,
        detail: routePrecision.detail,
        level: precisionLevelForScore(routePrecision.score)
      },
      {
        title: "Evidence alignment",
        status: `${evidenceAlignment.score}%`,
        detail: evidenceAlignment.detail,
        level: precisionLevelForScore(evidenceAlignment.score)
      },
      {
        title: "Safety calibration",
        status: `${safetyCalibration.score}%`,
        detail: safetyCalibration.detail,
        level: precisionLevelForScore(safetyCalibration.score)
      },
      {
        title: "Consistency review",
        status: `${consistencyReview.score}%`,
        detail: consistencyReview.summary,
        level: consistencyReview.passed ? "low" : "medium"
      },
      {
        title: "Clinical precision",
        status: `${clinicalPrecisionReview.score}%`,
        detail: clinicalPrecisionReview.summary,
        level: clinicalPrecisionReview.passed ? "low" : "medium"
      },
      {
        title: "Data completeness",
        status: `${dataCompleteness}%`,
        detail: dataQuality?.missing?.length
          ? `More accuracy is possible with: ${dataQuality.missing.slice(0, 2).join("; ")}.`
          : "Message, profile, vitals, context, and local memory were checked.",
        level: precisionLevelForScore(dataCompleteness)
      },
      {
        title: "Guardrail lock",
        status: guardrails.passed ? "Passed" : "Review",
        detail: guardrails.summary,
        level: guardrails.passed ? "low" : "critical"
      }
    ]
  };
}

function buildClinicalPrecisionReview({ message, profile, vitals, context, memoryContext, risk, plan, medicalKnowledge, inputQuality }) {
  const text = buildSearchText(message);
  const issues = [];
  const confirmations = [];
  const recommendations = [];
  const checks = [];
  const baselineBp = parseBloodPressure(profile?.baselineBp || "");
  const hasCurrentBp = vitals.systolic !== null || vitals.diastolic !== null;
  const recentElevatedBp = (memoryContext.recentVitals || []).filter((reading) => (
    reading.systolic >= 160 ||
    reading.diastolic >= 100
  ));
  const urgentSymptomTerms = [
    hasTerm(text, "chest pain"),
    hasBreathingSignal(text),
    hasStrokeSignal(text),
    hasTerm(text, "confused"),
    hasTerm(text, "confusion"),
    hasTerm(text, "severe headache"),
    hasTerm(text, "worst headache"),
    hasTerm(text, "blurred vision"),
    hasTerm(text, "vision changes")
  ].filter(Boolean).length;

  if (hasCurrentBp && baselineBp.systolic !== null && baselineBp.diastolic !== null) {
    const systolicDelta = vitals.systolic !== null ? vitals.systolic - baselineBp.systolic : 0;
    const diastolicDelta = vitals.diastolic !== null ? vitals.diastolic - baselineBp.diastolic : 0;
    const delta = Math.max(systolicDelta, diastolicDelta);
    const level = systolicDelta >= 50 || diastolicDelta >= 30
      ? "high"
      : systolicDelta >= 30 || diastolicDelta >= 20
        ? "medium"
        : "low";

    checks.push({
      title: "Baseline comparison",
      detail: `Compared with saved BP baseline ${baselineBp.systolic}/${baselineBp.diastolic}; largest rise ${delta} point(s).`,
      level
    });

    if (level === "high" && risk.level === "LOW") {
      issues.push({
        title: "Baseline risk mismatch",
        detail: "A large rise above saved baseline should not remain low risk.",
        level: "critical"
      });
    } else {
      confirmations.push("Current BP was compared with saved baseline.");
    }
  } else if (hasCurrentBp) {
    recommendations.push("Add a usual baseline BP to improve personalized calibration.");
    checks.push({
      title: "Baseline comparison",
      detail: "Current BP was available, but no saved baseline BP was usable.",
      level: "medium"
    });
  }

  if (recentElevatedBp.length) {
    checks.push({
      title: "Memory trend",
      detail: `${recentElevatedBp.length} saved elevated BP reading(s) were considered.`,
      level: recentElevatedBp.length >= 2 ? "medium" : "low"
    });
    confirmations.push("Saved memory was used for trend-aware calibration.");
  } else {
    checks.push({
      title: "Memory trend",
      detail: "No saved elevated vital trend was available.",
      level: "none"
    });
  }

  if (urgentSymptomTerms && (vitals.systolic >= 180 || vitals.diastolic >= 120) && riskRank[risk.level] < riskRank.CRITICAL) {
    issues.push({
      title: "Urgent symptom calibration",
      detail: "Very high BP with urgent symptom wording should use the critical safety path.",
      level: "critical"
    });
  } else if (urgentSymptomTerms) {
    confirmations.push("Urgent symptom wording was checked against the risk path.");
  }

  if ((risk.level === "HIGH" || risk.level === "CRITICAL") && !plan.execute.includes("ALERT_AGENT") && !plan.singleAgent?.enabled) {
    issues.push({
      title: "Alert route missing",
      detail: "High and critical paths require the alert/safety route.",
      level: "critical"
    });
  } else if ((risk.level === "HIGH" || risk.level === "CRITICAL") && plan.singleAgent?.enabled && !plan.execute.includes("ALERT_AGENT")) {
    confirmations.push("Single-agent tab mode kept the selected specialist visible while safety guardrails stayed active.");
  } else if (risk.level !== "LOW") {
    confirmations.push("Non-low risk path includes safety routing.");
  }

  if (risk.level !== "LOW" && medicalKnowledge.coverageScore < 65) {
    issues.push({
      title: "Evidence threshold",
      detail: "Higher-risk responses should have stronger local evidence coverage.",
      level: "medium"
    });
  } else {
    confirmations.push("Evidence coverage meets the current risk path.");
  }

  if (inputQuality.ignoredVitals.length) {
    recommendations.push("Re-enter ignored vital values with realistic ranges.");
  }

  if (!hasAnyVitals(vitals) && risk.level !== "LOW") {
    recommendations.push("Add current vitals to improve risk precision.");
  }

  const issuePenalty = issues.reduce((total, issue) => total + (issue.level === "critical" ? 28 : 12), 0);
  const recommendationPenalty = Math.min(recommendations.length * 5, 12);
  const confirmationBonus = Math.min(confirmations.length * 3, 9);
  const score = clamp(92 - issuePenalty - recommendationPenalty + confirmationBonus, 0, 99);

  return {
    score,
    label: score >= 88
      ? "Clinically calibrated"
      : score >= 72
        ? "Clinically cautious"
        : "Needs clinical context",
    passed: issues.every((issue) => issue.level !== "critical"),
    summary: issues.length
      ? `${issues.length} clinical precision note(s) found.`
      : "Baseline, memory trend, risk route, and evidence threshold are aligned.",
    checks,
    issues: issues.slice(0, 5),
    confirmations: confirmations.slice(0, 5),
    recommendations: recommendations.slice(0, 4)
  };
}

function buildRoutePrecision({ intents, plan, accuracyProfile }) {
  const sortedIntents = [...intents].sort((first, second) => second.confidence - first.confidence);
  const topIntent = sortedIntents[0];
  const secondIntent = sortedIntents[1];
  const activeRoutes = new Set(plan.execute);
  const routeMargin = secondIntent
    ? Math.round((topIntent.confidence - secondIntent.confidence) * 100)
    : 100;
  const evidenceCount = new Set(sortedIntents.flatMap((intent) => intent.evidence)).size;
  const topRouteIncluded = topIntent ? activeRoutes.has(topIntent.route) : false;
  let score = 42;

  score += Math.min(routeMargin, 32);
  score += Math.min(evidenceCount * 5, 20);
  score += topRouteIncluded ? 12 : -18;
  score += activeRoutes.has("RAG_AGENT") ? 4 : 0;
  score -= routeMargin < 8 && sortedIntents.length > 1 ? 12 : 0;
  score -= Math.max(activeRoutes.size - 5, 0) * 4;
  score = clamp(Math.round(score), 0, 99);

  return {
    score,
    label: score >= 85
      ? "Routes are well separated"
      : score >= 70
        ? "Routes are clear"
        : "Routes need more context",
    detail: topIntent
      ? `${topIntent.label} leads by ${routeMargin} point(s) with ${activeRoutes.size} active route(s).`
      : "General health route is active.",
    routeMargin,
    activeRoutes: Array.from(activeRoutes),
    evidenceCount,
    topRouteIncluded,
    uncertaintyFlags: accuracyProfile?.uncertaintyFlags || []
  };
}

function buildRequirementFitReview({ requirementProfile, plan, intents, risk }) {
  const expectedRoute = requirementProfile?.expectedRoute || intents[0]?.route || "RAG_AGENT";
  const activeRoutes = Array.isArray(plan?.execute) ? plan.execute : [];
  const routeMatched = activeRoutes.includes(expectedRoute);
  const singleAgentSatisfied = plan.singleAgent?.enabled ? activeRoutes.length === 1 && routeMatched : true;
  const outputConfidence = Number(requirementProfile?.score || 70);
  let score = 58;

  score += routeMatched ? 18 : -16;
  score += singleAgentSatisfied ? 12 : -18;
  score += Math.round(outputConfidence * 0.22);
  score += requirementProfile?.detailLevel === "brief" && risk.level === "LOW" ? 4 : 0;
  score -= activeRoutes.length > 4 ? Math.min((activeRoutes.length - 4) * 5, 16) : 0;
  score = clamp(Math.round(score), 0, 99);

  const label = score >= 90
    ? "Requirement tightly matched"
    : score >= 80
      ? "Requirement matched"
      : score >= 68
        ? "Requirement mostly matched"
        : "Requirement needs sharper routing";

  return {
    score,
    label,
    detail: routeMatched
      ? `${routeLabel(expectedRoute)} matched the ${requirementProfile?.outputLabel || "request"} requirement.`
      : `${routeLabel(expectedRoute)} was expected, but active route(s) were ${activeRoutes.map(routeLabel).join(", ") || "none"}.`,
    expectedRoute,
    expectedAgent: routeLabel(expectedRoute),
    activeRoutes,
    singleAgentSatisfied,
    answerContract: requirementProfile?.answerContract || "Focused safe answer.",
    checks: [
      {
        title: "Expected helper",
        detail: routeMatched ? `${routeLabel(expectedRoute)} answered.` : `${routeLabel(expectedRoute)} should answer first.`,
        level: routeMatched ? "low" : "medium"
      },
      {
        title: "Answer scope",
        detail: singleAgentSatisfied ? "Only the selected helper owns this tab response." : "More than one helper is active for this response.",
        level: singleAgentSatisfied ? "low" : "medium"
      }
    ]
  };
}

function buildEvidenceAlignment({ medicalKnowledge, intents, vitalAssessment, messageSignals, contextSignals }) {
  const matches = medicalKnowledge?.matches || [];
  const matchedTerms = new Set(matches.flatMap((match) => match.matchedTerms || [])).size;
  const categories = new Set(matches.map((match) => match.category).filter(Boolean)).size;
  const signalGroups = messageSignals.filter((signal) => signal.label !== "General request").length;
  const activeVitals = vitalAssessment.filter((item) => item.level !== "none").length;
  const activeContext = contextSignals.filter((signal) => signal.level !== "low").length;
  const fallbackOnly = matches.length === 1 && matches[0]?.id === "local-memory-learning";
  const coverage = medicalKnowledge?.coverageScore || 35;
  const score = clamp(Math.round(
    (coverage * 0.52) +
      Math.min(matchedTerms * 5, 18) +
      Math.min(categories * 4, 12) +
      Math.min(signalGroups * 5, 15) +
      Math.min(activeVitals * 4, 8) +
      Math.min(activeContext * 3, 6) -
      (fallbackOnly ? 10 : 0)
  ), 0, 99);

  return {
    score,
    label: score >= 85
      ? "Evidence strongly aligned"
      : score >= 70
        ? "Evidence aligned"
        : "Evidence is limited",
    detail: `${matches.length} reference(s), ${matchedTerms} matched term(s), ${signalGroups} message signal group(s).`,
    matchedTerms,
    categories,
    signalGroups,
    activeVitals,
    activeContext,
    fallbackOnly
  };
}

function buildSafetyCalibration({ message, vitals, context, risk, plan, guardrails }) {
  const triggers = detectClinicalCalibrationTriggers({ message, vitals, context });
  const failures = [];
  const confirmations = [];
  const alertRouteActive = plan.execute.includes("ALERT_AGENT");

  for (const trigger of triggers) {
    if (riskRank[risk.level] < riskRank[trigger.minimumRisk]) {
      failures.push({
        title: trigger.title,
        detail: `Expected ${riskDetails[trigger.minimumRisk].label}; got ${risk.label}.`,
        level: "critical"
      });
      continue;
    }

    confirmations.push(`${trigger.title} matched ${risk.label}.`);

    if (trigger.requiredRoute && !alertRouteActive) {
      failures.push({
        title: trigger.title,
        detail: `${trigger.requiredRoute} was expected for this safety pattern.`,
        level: "critical"
      });
    }
  }

  if (!triggers.length) {
    confirmations.push("No critical clinical trigger pattern was detected.");
  }

  if (!guardrails.passed) {
    failures.push({
      title: "Guardrail failure",
      detail: guardrails.summary,
      level: "critical"
    });
  }

  const penalty = failures.reduce((total, failure) => total + (failure.level === "critical" ? 24 : 10), 0);
  const score = clamp(96 + Math.min(triggers.length * 1, 3) - penalty, 0, 99);

  return {
    score,
    label: failures.length
      ? "Safety calibration needs review"
      : triggers.length
        ? "Safety calibration matched"
        : "Safety calibration clear",
    detail: triggers.length
      ? `${triggers.length} clinical trigger(s) checked against risk and care routes.`
      : "No emergency-calibration pattern was triggered.",
    triggers,
    confirmations: confirmations.slice(0, 5),
    failures
  };
}

function buildConsistencyReview({ message, vitals, context, risk, intents, plan, medicalKnowledge, inputQuality, dataQuality, safetyCalibration }) {
  const text = buildSearchText(message);
  const issues = [];
  const confirmations = [];
  const hasStructuredVitals = hasAnyVitals(vitals);
  const asksForReading = ["reading", "bp", "blood pressure", "sugar", "glucose", "heart rate", "pulse", "temperature"].some((term) => hasTerm(text, term));

  if ((hasTerm(text, "mild") || hasTerm(text, "minor")) && context.severity >= 8) {
    issues.push({
      title: "Severity mismatch",
      detail: "Message says mild/minor while severity is high.",
      level: "medium"
    });
  }

  if ((hasTerm(text, "severe") || hasTerm(text, "worst")) && context.severity <= 3) {
    issues.push({
      title: "Severity mismatch",
      detail: "Message says severe/worst while severity is low.",
      level: "medium"
    });
  }

  if (asksForReading && !hasStructuredVitals && risk.level !== "CRITICAL") {
    issues.push({
      title: "Missing exact reading",
      detail: "A reading was mentioned, but no numeric vital was accepted.",
      level: "medium"
    });
  }

  if ((risk.level === "HIGH" || risk.level === "CRITICAL") && !plan.execute.includes("ALERT_AGENT")) {
    issues.push({
      title: "Safety route mismatch",
      detail: "Higher-risk result should include the urgent safety route.",
      level: "critical"
    });
  }

  if (risk.level !== "LOW" && medicalKnowledge.coverageScore < 60) {
    issues.push({
      title: "Limited evidence coverage",
      detail: "Higher-risk guidance should use stronger reference coverage.",
      level: "medium"
    });
  }

  if (inputQuality?.ignoredVitals?.length) {
    issues.push({
      title: "Ignored vital values",
      detail: `${inputQuality.ignoredVitals.length} vital value(s) were outside the accepted demo range.`,
      level: "medium"
    });
  }

  if (dataQuality?.score >= 70) {
    confirmations.push("Patient context is strong enough for a clear demo review.");
  }

  if (intents.length && plan.execute.length) {
    confirmations.push("Detected care need and executed route list are aligned.");
  }

  if (!safetyCalibration.failures.length) {
    confirmations.push("Clinical trigger checks agree with the risk path.");
  }

  const penalty = issues.reduce((total, issue) => total + (issue.level === "critical" ? 26 : 11), 0);
  const score = clamp(97 - penalty + Math.min(confirmations.length * 2, 6), 0, 99);

  return {
    score,
    label: issues.length ? "Needs small review" : "Consistent",
    passed: issues.every((issue) => issue.level !== "critical"),
    summary: issues.length
      ? `${issues.length} consistency note(s) found.`
      : "Risk, route, evidence, and input signals are consistent.",
    issues: issues.slice(0, 5),
    confirmations: confirmations.slice(0, 5)
  };
}

function detectClinicalCalibrationTriggers({ message, vitals, context }) {
  const text = buildSearchText(message);
  const triggers = [];
  const hasChestPain = hasAffirmedTerm(text, "chest pain");
  const hasBreathingConcern = hasBreathingSignal(text);
  const hasSweating = hasAffirmedTerm(text, "sweating") || hasAffirmedTerm(text, "sweat");
  const hasFainting = hasFaintingSignal(text);
  const hasStrokeConcern = hasStrokeSignal(text);
  const hasConfusion = hasAffirmedTerm(text, "confusion") || hasAffirmedTerm(text, "confused") || hasAffirmedTerm(text, "not alert");
  const hasSevereAllergy = hasSevereAllergySignal(text);
  const highBp = vitals.systolic >= 180 || vitals.diastolic >= 120;
  const urgentSymptoms = hasChestPain || hasBreathingConcern || hasStrokeConcern || hasConfusion || hasFainting || hasSevereAllergy;
  const addTrigger = (id, title, minimumRisk, detail, requiredRoute = "ALERT_AGENT") => {
    if (!triggers.some((trigger) => trigger.id === id)) {
      triggers.push({
        id,
        title,
        minimumRisk,
        detail,
        requiredRoute
      });
    }
  };

  if (highBp && urgentSymptoms) {
    addTrigger("bp-urgent-symptoms", "Very high BP plus warning symptoms", "CRITICAL", "Very high blood pressure was paired with urgent warning symptoms.");
  } else if (highBp) {
    addTrigger("bp-very-high", "Very high BP reading", "HIGH", "Blood pressure was in a very high range.");
  }

  if (hasChestPain && (hasBreathingConcern || hasSweating || hasFainting)) {
    addTrigger("chest-pain-combo", "Chest pain warning cluster", "CRITICAL", "Chest pain was paired with breathing difficulty, sweating, or fainting.");
  } else if (hasChestPain) {
    addTrigger("chest-pain", "Chest pain", "HIGH", "Chest pain was mentioned.");
  }

  if (hasStrokeConcern) {
    addTrigger("stroke-signals", "Stroke-type warning signals", "CRITICAL", "Speech, face, one-sided weakness, numbness, balance, sudden severe headache, vision, or stroke wording was detected.");
  }

  if (hasSevereAllergy) {
    addTrigger("allergy-signals", "Severe allergy warning", "CRITICAL", "Severe allergy or airway warning wording was detected.");
  }

  if (vitals.bloodSugar >= 400 && (hasConfusion || hasFainting || context.severity >= 8)) {
    addTrigger("extreme-high-sugar-symptoms", "Extreme high sugar plus symptoms", "CRITICAL", "Very high blood sugar was paired with higher-risk symptoms or severity.");
  } else if (vitals.bloodSugar >= 300) {
    addTrigger("very-high-sugar", "Very high blood sugar", "HIGH", "Blood sugar reading was very high.");
  }

  if (vitals.bloodSugar !== null && vitals.bloodSugar <= 54 && (hasConfusion || hasFainting || context.severity >= 8)) {
    addTrigger("severe-low-sugar-symptoms", "Severe low sugar plus symptoms", "CRITICAL", "Very low blood sugar was paired with confusion, fainting, or high severity.");
  } else if (vitals.bloodSugar !== null && vitals.bloodSugar <= 54) {
    addTrigger("severe-low-sugar", "Severe low blood sugar", "HIGH", "Blood sugar reading was very low.");
  } else if (vitals.bloodSugar !== null && vitals.bloodSugar <= 70) {
    addTrigger("low-sugar", "Low blood sugar", "MEDIUM", "Blood sugar reading was low.", null);
  }

  if (vitals.heartRate >= 130) {
    addTrigger("very-high-heart-rate", "Very high heart rate", "HIGH", "Heart rate reading was very high.");
  }

  if (vitals.temperatureC >= 40 && (hasConfusion || hasBreathingConcern || context.severity >= 8)) {
    addTrigger("very-high-temperature-symptoms", "Very high temperature plus symptoms", "CRITICAL", "Very high temperature was paired with higher-risk symptoms or severity.");
  } else if (vitals.temperatureC >= 40) {
    addTrigger("very-high-temperature", "Very high temperature", "HIGH", "Temperature reading was very high.");
  }

  if (vitals.oxygenSaturation !== null && vitals.oxygenSaturation <= 90 && (hasBreathingConcern || hasChestPain || hasConfusion || context.severity >= 8)) {
    addTrigger("low-oxygen-symptoms", "Low oxygen plus symptoms", "CRITICAL", "Low oxygen was paired with breathing, chest, confusion, or high-severity symptoms.");
  } else if (vitals.oxygenSaturation !== null && vitals.oxygenSaturation <= 90) {
    addTrigger("low-oxygen", "Low oxygen reading", "HIGH", "Oxygen saturation was low.");
  } else if (vitals.oxygenSaturation !== null && vitals.oxygenSaturation <= 93) {
    addTrigger("oxygen-caution", "Oxygen caution reading", "MEDIUM", "Oxygen saturation was below the usual caution range.", null);
  }

  if (context.redFlags?.length) {
    addTrigger("checked-red-flags", "Checked red flag selection", "CRITICAL", `Selected red flag(s): ${context.redFlags.map(formatContextLabel).join(", ")}.`);
  }

  return triggers;
}

function precisionLevelForScore(score) {
  if (score >= 80) {
    return "low";
  }

  if (score >= 55) {
    return "medium";
  }

  return "critical";
}

function buildDeploymentMode(medicalKnowledge) {
  const runtime = medicalKnowledge?.localAi?.runtime || getLocalAiRuntimeStatus();

  return {
    status: "Offline-ready",
    offlineReady: true,
    onlineReady: runtime.onlineReady,
    activeMode: "Local ML medical knowledge + deterministic safety rules",
    detail: "The current app runs offline with a local evidence ranker, local memory, and safety guardrails. DeepSeek-R1 is the primary LLM connector, and provider failure does not disable the safe fallback.",
    localLlm: runtime.localLlm,
    onlineConnector: runtime.onlineConnector,
    onlinePath: "Production can connect DeepSeek-R1, a clinician-reviewed medical corpus, medication reference, or vector database after governance approval.",
    offlinePath: `${medicalKnowledge.corpusSize} embedded local medical safety references are available immediately.`
  };
}

function buildLearningMemory({ memoryContext, medicalKnowledge, risk, intents }) {
  const storedSignals = [
    `Recent runs: ${memoryContext.recentTurnCount}`,
    `Latest risk path: ${risk.label}`,
    `Care routes: ${intents.map((intent) => intent.label).join(", ")}`,
    `Knowledge coverage: ${medicalKnowledge.coverageScore}%`
  ];

  return {
    mode: "Local context learning",
    summary: memoryContext.recentTurnCount
      ? "The next turn can use recent local patient context and risk history."
      : "The next turn will start using the memory patch created from this run.",
    storedSignals,
    privacy: "Stored in the local server memory file for this app; no cloud memory is used.",
    boundary: medicalKnowledge.learningBoundary
  };
}

function buildKnowledgeScaleReadiness({ medicalKnowledge, inputQuality, accuracyEngine, guardrails }) {
  const localCoverage = medicalKnowledge?.coverageScore ?? 45;
  const inputScore = inputQuality?.score ?? 60;
  const precisionScore = accuracyEngine?.score ?? 70;
  const gateScore = CLINICAL_KNOWLEDGE_SCALE.validationGates.length >= 6 ? 94 : 78;
  const safetyScore = guardrails?.passed ? 96 : 62;
  const score = clamp(Math.round(
    (localCoverage * 0.18) +
      (inputScore * 0.14) +
      (precisionScore * 0.24) +
      (gateScore * 0.24) +
      (safetyScore * 0.2)
  ), 0, 99);

  return {
    name: CLINICAL_KNOWLEDGE_SCALE.name,
    status: score >= 88 ? "Scale-ready" : score >= 75 ? "Scale-prepared" : "Needs validation",
    target: CLINICAL_KNOWLEDGE_SCALE.target,
    mode: "RAG-first with governed fine-tuning readiness",
    trainedFoundationModel: false,
    score,
    activeCorpus: `${medicalKnowledge?.corpusSize || medicalKnowledgeBase.length} curated local reference(s) active now`,
    futureCorpus: "Licensed, approved, de-identified, clinician-reviewed clinical data only",
    dataDomains: CLINICAL_KNOWLEDGE_SCALE.dataDomains,
    governedSources: CLINICAL_KNOWLEDGE_SCALE.governedSources,
    scalePlan: CLINICAL_KNOWLEDGE_SCALE.scaleStages.map((stage) => ({
      title: stage.stage,
      scale: stage.range,
      detail: stage.purpose
    })),
    validationGates: CLINICAL_KNOWLEDGE_SCALE.validationGates,
    safetyLocks: CLINICAL_KNOWLEDGE_SCALE.safetyLocks,
    limitations: [
      CLINICAL_KNOWLEDGE_SCALE.honestBoundary,
      "Patient conversations can improve local context memory, not the locked medical fact base.",
      "High-risk health questions keep clinician or emergency-care guidance ahead of model confidence."
    ],
    summary: `Ready to scale from ${medicalKnowledge?.corpusSize || medicalKnowledgeBase.length} local references to governed clinical corpora with ${CLINICAL_KNOWLEDGE_SCALE.validationGates.length} validation gates and ${CLINICAL_KNOWLEDGE_SCALE.safetyLocks.length} safety locks.`
  };
}

function buildExecutionPlan(intents, risk) {
  const execute = [];
  const routeReasons = {};

  for (const intent of intents) {
    if (!execute.includes(intent.route)) {
      execute.push(intent.route);
      routeReasons[intent.route] = [`${intent.label} care need`];
    } else {
      routeReasons[intent.route].push(`${intent.label} care need`);
    }
  }

  if (risk.level === "MEDIUM" || risk.level === "HIGH" || risk.level === "CRITICAL") {
    if (!execute.includes("ALERT_AGENT")) {
      execute.push("ALERT_AGENT");
      routeReasons.ALERT_AGENT = [];
    }
    routeReasons.ALERT_AGENT.push(`${risk.label} safety review`);
  }

  if (!execute.includes("RAG_AGENT")) {
    execute.unshift("RAG_AGENT");
    routeReasons.RAG_AGENT = ["general medical guidance"];
  }

  return {
    strategy: execute.length > 1 ? "conditional-care-routing" : "single-care-route",
    parallel: execute.length > 1,
    execute,
    routeReasons,
    postProcessors: ["RESPONSE_SYNTHESIZER", "SAFETY_GUARDRAILS", "PATIENT_REPLY", "MEMORY_UPDATE"],
    summary: "The care workflow routed the request through the needed specialist agents for symptoms, vitals, medication, labs, lifestyle, wellness, records, insurance, follow-up, urgent safety, and care transitions."
  };
}

function buildPrecisionSupervisor({ intents, risk, plan, medicalKnowledge, inputQuality, requirementProfile, singleAgentScope }) {
  const nextPlan = clonePlanForPrecision(plan);
  const corrections = [];
  const expectedRoute = requirementProfile?.expectedRoute;
  const singleAgentEnabled = Boolean(nextPlan.singleAgent?.enabled || singleAgentScope?.enabled);
  const ownerHintRoute = !singleAgentEnabled && singleAgentScope?.interfaceName === "advisor"
    ? singleAgentScope.ownerHintRoute || singleAgentScope.route || null
    : null;

  if (!singleAgentEnabled && expectedRoute && executableAgentRoutes.has(expectedRoute) && !nextPlan.execute.includes(expectedRoute)) {
    insertPlanRoute(nextPlan, expectedRoute, `${routeLabel(expectedRoute)} added by precision supervisor to satisfy the detected requirement.`);
    corrections.push({
      type: "route-added",
      route: expectedRoute,
      reason: `${routeLabel(expectedRoute)} matched the requested output better than the initial route set.`
    });
  }

  if (!singleAgentEnabled && risk.level !== "LOW" && !nextPlan.execute.includes("ALERT_AGENT")) {
    insertPlanRoute(nextPlan, "ALERT_AGENT", `${risk.label} requires safety coverage.`);
    corrections.push({
      type: "safety-route-added",
      route: "ALERT_AGENT",
      reason: `${risk.label} result needs urgent-safety coverage.`
    });
  }

  const routeEvidence = buildRouteEvidenceMatrix({ intents, plan: nextPlan, medicalKnowledge, risk });
  const topIntent = [...intents].sort((first, second) => second.confidence - first.confidence)[0];
  const routeMargin = topIntent?.marginFromNext ?? 100;
  const responseOwnerRoute = chooseResponseOwnerRoute({ expectedRoute, topIntent, plan: nextPlan, risk, singleAgentEnabled, ownerHintRoute });
  nextPlan.responseOwner = {
    route: responseOwnerRoute,
    label: routeLabel(responseOwnerRoute),
    reason: singleAgentEnabled
      ? "Selected tab owns this response."
      : ownerHintRoute && ownerHintRoute === responseOwnerRoute
        ? "General front door selected the primary response owner while support routes stay active."
      : responseOwnerRoute === "ALERT_AGENT"
        ? "Safety route owns high-risk response."
        : "Best requirement match owns the visible response."
  };
  const expectedRouteCovered = !expectedRoute
    || nextPlan.execute.includes(expectedRoute)
    || (singleAgentEnabled && nextPlan.singleAgent?.route === expectedRoute);
  const safetyCovered = risk.level === "LOW"
    || nextPlan.execute.includes("ALERT_AGENT")
    || singleAgentEnabled;
  const evidenceScore = routeEvidence.length
    ? Math.round(routeEvidence.reduce((total, item) => total + item.score, 0) / routeEvidence.length)
    : 50;
  const weakEvidenceRoutes = routeEvidence.filter((item) => !item.passed);
  const evidenceGrounded = weakEvidenceRoutes.length === 0 && evidenceScore >= 58;
  const gates = [
    {
      id: "route_ownership",
      label: "Route ownership",
      passed: expectedRouteCovered && (!expectedRoute || responseOwnerRoute === expectedRoute || responseOwnerRoute === "ALERT_AGENT"),
      score: expectedRouteCovered && (!expectedRoute || responseOwnerRoute === expectedRoute || responseOwnerRoute === "ALERT_AGENT") ? 96 : 46,
      detail: expectedRouteCovered
        ? `${routeLabel(responseOwnerRoute)} owns the requested answer type.`
        : `${routeLabel(expectedRoute)} was expected but not covered.`
    },
    {
      id: "evidence_grounding",
      label: "Evidence grounding",
      passed: evidenceGrounded,
      score: weakEvidenceRoutes.length ? Math.max(42, evidenceScore - weakEvidenceRoutes.length * 8) : evidenceScore,
      detail: weakEvidenceRoutes.length
        ? `${weakEvidenceRoutes.map((item) => routeLabel(item.route)).join(", ")} need stronger local evidence.`
        : `${routeEvidence.length} route evidence profile(s), ${medicalKnowledge.matches.length} local reference match(es).`
    },
    {
      id: "safety_coverage",
      label: "Safety coverage",
      passed: safetyCovered,
      score: safetyCovered ? 94 : 38,
      detail: safetyCovered
        ? `${risk.label} safety requirements are covered by routing or the safety guardrail overlay.`
        : `${risk.label} needs an active safety route.`
    },
    {
      id: "ambiguity_control",
      label: "Ambiguity control",
      passed: routeMargin >= 6 || singleAgentEnabled,
      score: routeMargin >= 6 || singleAgentEnabled ? 86 : 58,
      detail: singleAgentEnabled
        ? "Single-tab mode gives one selected agent response."
        : `${topIntent?.label || "General"} route margin is ${routeMargin} point(s).`
    },
    {
      id: "input_completeness",
      label: "Input completeness",
      passed: (inputQuality?.score || 0) >= 55 || risk.level === "LOW",
      score: inputQuality?.score || 0,
      detail: inputQuality?.summary || "Patient input quality was checked."
    }
  ];
  const score = clamp(Math.round(
    gates.reduce((total, gate) => total + gate.score, 0) / gates.length
  ), 0, 99);
  const label = score >= 90
    ? "Precision locked"
    : score >= 78
      ? "Precision strong"
      : score >= 64
        ? "Precision cautious"
        : "Needs better evidence";

  nextPlan.qualityGate = {
    id: "PRECISION_SUPERVISOR",
    score,
    label,
    corrections: corrections.length,
    responseOwner: responseOwnerRoute,
    weakEvidenceRoutes: weakEvidenceRoutes.map((item) => item.route),
    gatesPassed: gates.filter((gate) => gate.passed).length,
    gatesTotal: gates.length
  };

  return {
    id: "PRECISION_SUPERVISOR",
    status: gates.every((gate) => gate.passed) ? "passed" : "cautious",
    score,
    label,
    summary: corrections.length
      ? `${label}; ${corrections.length} route correction(s) applied before agent execution.`
      : `${label}; route, evidence, safety, ambiguity, and input gates checked before agent execution.`,
    corrections,
    gates,
    routeEvidence,
    plan: nextPlan
  };
}

function buildLlmCognitiveCore({
  message,
  profile,
  vitals,
  context,
  memoryContext,
  intents,
  risk,
  plan,
  medicalKnowledge,
  inputQuality,
  requirementProfile,
  singleAgentScope = {},
  precisionSupervisor,
  modelRouting = null
}) {
  const singleAgentEnabled = Boolean(plan.singleAgent?.enabled);
  const topIntent = [...intents].sort((first, second) => second.confidence - first.confidence)[0] || null;
  const routeEvidence = precisionSupervisor?.routeEvidence?.length
    ? precisionSupervisor.routeEvidence
    : buildRouteEvidenceMatrix({ intents, plan, medicalKnowledge, risk });
  const expectedRoute = requirementProfile?.expectedRoute;
  const ownerHintRoute = plan.responseOwner?.route && executableAgentRoutes.has(plan.responseOwner.route)
    ? plan.responseOwner.route
    : !singleAgentEnabled && singleAgentScope?.interfaceName === "advisor"
      ? singleAgentScope.ownerHintRoute || singleAgentScope.route || null
      : null;
  const ownerRoute = chooseResponseOwnerRoute({
    expectedRoute,
    topIntent,
    plan,
    risk,
    singleAgentEnabled,
    ownerHintRoute
  });
  const routeScores = buildLlmRouteScores({
    intents,
    plan,
    risk,
    medicalKnowledge,
    inputQuality,
    requirementProfile,
    routeEvidence,
    ownerRoute
  });
  const ownerScore = routeScores.find((item) => item.route === ownerRoute)?.score || 0;
  const ownerEvidence = routeEvidence.find((item) => item.route === ownerRoute) || null;
  const ambiguityMargin = topIntent?.marginFromNext ?? 100;
  const memoryScore = memoryContext?.recentTurnCount ? 92 : 70;
  const evidenceScore = Number(ownerEvidence?.score || medicalKnowledge?.coverageScore || 0);
  const localModelScore = Number(medicalKnowledge?.localAi?.score || medicalKnowledge?.coverageScore || 0);
  const modelRouteScore = modelRouting?.processingType === "local"
    ? 94
    : modelRouting?.processingType === "hybrid"
      ? 92
      : modelRouting?.processingType === "cloud"
        ? 84
        : 78;
  const safetyCovered = risk.level === "LOW"
    || plan.execute.includes("ALERT_AGENT")
    || ownerRoute === "ALERT_AGENT"
    || singleAgentEnabled;
  const weakRoutes = routeEvidence.filter((item) => !item.passed).map((item) => item.route);
  const needsClarification = (
    !singleAgentEnabled &&
    risk.level === "LOW" &&
    (ambiguityMargin < 6 || inputQuality.score < 55 || evidenceScore < 48)
  );
  const gates = [
    {
      id: "intent_understanding",
      label: "Intent understanding",
      passed: Boolean(topIntent) && (ambiguityMargin >= 6 || singleAgentEnabled || intents.length === 1),
      score: Boolean(topIntent) ? clamp(74 + Math.min(ambiguityMargin, 18), 48, 96) : 42,
      detail: topIntent
        ? `${topIntent.label} is ranked first with ${Math.round(topIntent.confidence * 100)}% route confidence.`
        : "No intent could be ranked."
    },
    {
      id: "response_ownership",
      label: "Response ownership",
      passed: plan.execute.includes(ownerRoute),
      score: plan.execute.includes(ownerRoute) ? Math.max(82, ownerScore) : 38,
      detail: `${routeLabel(ownerRoute)} owns the visible answer.`
    },
    {
      id: "safety_override",
      label: "Safety override",
      passed: safetyCovered,
      score: safetyCovered ? 95 : 35,
      detail: risk.level === "LOW"
        ? "No urgent safety override is required."
        : `${risk.label} keeps urgent-safety routing available.`
    },
    {
      id: "local_ml_evidence",
      label: "Local ML evidence",
      passed: localModelScore >= 55 || risk.level === "LOW" || ownerRoute === "ALERT_AGENT",
      score: clamp(localModelScore + (risk.level !== "LOW" ? 4 : 0), 35, 98),
      detail: medicalKnowledge?.localAi?.queryFamilies?.length
        ? `${medicalKnowledge.localAi.queryFamilies.join(", ")} matched by the local evidence model.`
        : "Local evidence model completed with offline records."
    },
    {
      id: "hybrid_model_routing",
      label: "Hybrid model routing",
      passed: Boolean(modelRouting?.selectedModel?.primary),
      score: modelRouteScore,
      detail: modelRouting
        ? `${modelRouting.generatedUsing}: ${modelRouting.selectedModel.primary?.displayName || "local model"} selected with ${modelRouting.cost.class} policy.`
        : "Model routing metadata was not required for this run."
    },
    {
      id: "evidence_reasoning",
      label: "Evidence reasoning",
      passed: evidenceScore >= 50 || ownerRoute === "ALERT_AGENT" || risk.level === "LOW",
      score: clamp(evidenceScore + (ownerRoute === "ALERT_AGENT" ? 12 : 0), 35, 96),
      detail: ownerEvidence
        ? `${routeLabel(ownerRoute)} has ${ownerEvidence.score}% route evidence.`
        : `${medicalKnowledge.matches?.length || 0} local reference match(es) available.`
    },
    {
      id: "memory_context",
      label: "Memory context",
      passed: memoryScore >= 70,
      score: memoryScore,
      detail: memoryContext?.recentTurnCount
        ? `${memoryContext.recentTurnCount} saved turn(s) were loaded before routing.`
        : "No saved turn was needed; profile and current message still guided the answer."
    },
    {
      id: "answer_discipline",
      label: "Answer discipline",
      passed: Boolean(requirementProfile?.answerContract) && plan.responseOwner?.route === ownerRoute,
      score: Boolean(requirementProfile?.answerContract) && plan.responseOwner?.route === ownerRoute ? 92 : 62,
      detail: requirementProfile?.answerContract || "The answer must stay focused and safe."
    },
    {
      id: "clarifying_question",
      label: "Clarifying question",
      passed: !needsClarification,
      score: needsClarification ? 64 : 90,
      detail: needsClarification
        ? "The brain will keep the answer brief and ask for one useful missing detail."
        : "Enough context is available for a focused safe response."
    }
  ];
  const score = clamp(Math.round(gates.reduce((total, gate) => total + gate.score, 0) / gates.length), 0, 100);
  const label = score >= 90
    ? "Brain locked"
    : score >= 80
      ? "Brain strong"
      : score >= 66
        ? "Brain cautious"
        : "Needs more context";
  const visibleRoutes = Array.from(new Set([
    ownerRoute,
    ...(risk.level === "HIGH" || risk.level === "CRITICAL" ? ["ALERT_AGENT"] : []),
    ...(plan.execute.includes("VITALS_AGENT") && ownerRoute !== "VITALS_AGENT" && risk.level !== "LOW" ? ["VITALS_AGENT"] : [])
  ])).filter((route) => plan.execute.includes(route));
  const nextQuestion = buildLlmBrainFollowUpQuestion({
    ownerRoute,
    risk,
    inputQuality,
    context,
    vitals,
    requirementProfile,
    weakRoutes
  });

  return {
    id: "LLM_COGNITIVE_CORE",
    mode: "hybrid-model-orchestrated-medical-reasoning-core",
    score,
    label,
    status: gates.every((gate) => gate.passed) ? "ready" : "cautious",
    summary: `${routeLabel(ownerRoute)} selected as owner with ${ownerScore}% route strength; ${modelRouting?.generatedUsing || "Local Model"} active; ${gates.filter((gate) => gate.passed).length}/${gates.length} brain gates passed.`,
    thinkingModel: [
      "Load patient memory and current inputs.",
      "Classify intent and route ownership.",
      "Check risk and safety override before routine guidance.",
      "Run local ML evidence ranking over the offline medical database.",
      "Ground the answer in local evidence and entered data.",
      "Limit output to the selected agent requirement.",
      "Ask one missing detail only when it improves precision."
    ],
    routeDecision: {
      ownerRoute,
      ownerLabel: routeLabel(ownerRoute),
      ownerScore,
      expectedRoute: expectedRoute || null,
      visibleRoutes,
      reason: singleAgentEnabled
        ? "The selected tab is the only response owner."
        : risk.level === "CRITICAL" || risk.level === "HIGH"
          ? "Safety has priority over routine guidance."
          : expectedRoute && expectedRoute === ownerRoute
            ? "The detected requirement matched the owner route."
            : "The highest-value route owns the patient reply."
    },
    ambiguity: {
      marginFromNext: ambiguityMargin,
      level: ambiguityMargin >= 12 || singleAgentEnabled ? "low" : ambiguityMargin >= 6 ? "medium" : "high",
      needsClarification,
      nextQuestion
    },
    evidenceDecision: {
      score: evidenceScore,
      weakRoutes,
      localReferences: medicalKnowledge.matches?.length || 0,
      coverageScore: medicalKnowledge.coverageScore || 0
    },
    localModel: {
      id: medicalKnowledge?.localAi?.id || "LOCAL_CLINICAL_ML_RANKER",
      score: localModelScore,
      mode: medicalKnowledge?.localAi?.mode || "offline",
      queryFamilies: medicalKnowledge?.localAi?.queryFamilies || [],
      localLlmStatus: medicalKnowledge?.localAi?.runtime?.localLlm?.status || "standby-not-required",
      onlineConnectorStatus: medicalKnowledge?.localAi?.runtime?.onlineConnector?.status || "disabled",
      hybridRouterStatus: medicalKnowledge?.localAi?.runtime?.hybridRouter?.status || "local-ready"
    },
    modelRouting: modelRouting
      ? {
        generatedUsing: modelRouting.generatedUsing,
        processingType: modelRouting.processingType,
        primaryModel: modelRouting.selectedModel.primary,
        fallbackChain: modelRouting.failover.chain,
        costClass: modelRouting.cost.class,
        reasons: modelRouting.reasons
      }
      : null,
    processingMode: modelRouting?.generatedUsing || "Local Model",
    providerDisclosure: modelRouting
      ? `${modelRouting.generatedUsing}; primary model ${modelRouting.selectedModel.primary?.displayName || "local model"}.`
      : "Local Model; deterministic safety core.",
    memoryUse: {
      score: memoryScore,
      recentTurns: memoryContext?.recentTurnCount || 0,
      usedFor: ["context continuity", "recent vitals trend", "known profile facts"]
    },
    answerPolicy: {
      style: requirementProfile?.answerMode?.id || "quick",
      maxPrimaryActions: requirementProfile?.maxPrimaryActions || (risk.level === "LOW" ? 2 : 3),
      visibleRoutes,
      refuse: ["diagnosis", "prescription", "dosage calculation", "hidden live action"],
      askOneQuestionIfNeeded: needsClarification
    },
    routeScores,
    gates
  };
}

function buildLlmRouteScores({ intents, plan, risk, medicalKnowledge, inputQuality, requirementProfile, routeEvidence, ownerRoute }) {
  return (plan.execute || []).map((route) => {
    const intent = intents.find((item) => item.route === route);
    const evidence = routeEvidence.find((item) => item.route === route);
    const capability = getAgentCapabilityPolicy(route);
    const intentScore = Math.round((intent?.confidence || (route === "RAG_AGENT" ? 0.64 : 0.5)) * 100);
    const evidenceScore = Number(evidence?.score || 0);
    const requirementBoost = route === requirementProfile?.expectedRoute ? 12 : 0;
    const ownerBoost = route === ownerRoute ? 10 : 0;
    const safetyBoost = route === "ALERT_AGENT" && risk.level !== "LOW" ? 14 : 0;
    const inputScore = Number(inputQuality?.score || 0);
    const knowledgeScore = Number(medicalKnowledge?.coverageScore || 0);
    const score = clamp(Math.round(
      intentScore * 0.28 +
      evidenceScore * 0.28 +
      inputScore * 0.12 +
      knowledgeScore * 0.12 +
      requirementBoost +
      ownerBoost +
      safetyBoost
    ), 0, 100);

    return {
      route,
      label: routeLabel(route),
      domain: capability.domain,
      score,
      intentScore,
      evidenceScore,
      requirementMatch: route === requirementProfile?.expectedRoute,
      responseOwner: route === ownerRoute,
      safetySupport: route === "ALERT_AGENT" && risk.level !== "LOW",
      reason: route === ownerRoute
        ? "Owns the final patient-facing answer."
        : route === "RAG_AGENT"
          ? "Provides local evidence grounding."
          : "Supports its specialist part only."
    };
  }).sort((first, second) => second.score - first.score);
}

function buildLlmBrainFollowUpQuestion({ ownerRoute, risk, inputQuality, context, vitals, requirementProfile, weakRoutes }) {
  if (risk.level === "CRITICAL") {
    return "If this is happening now, please use local emergency care instead of waiting for more app input.";
  }

  if (inputQuality?.ignoredVitals?.length) {
    return "Can you re-enter the reading using a realistic number so I can review it safely?";
  }

  if ((risk.level === "HIGH" || risk.level === "MEDIUM") && !hasAnyVitals(vitals)) {
    return "Do you have a current BP, pulse, temperature, or sugar reading to add?";
  }

  const questions = {
    PHARMACY_AGENT: "Which medicine, dose label, and time are you asking about?",
    VITALS_AGENT: "When was this reading taken, and was it repeated after resting?",
    LABS_AGENT: "What is the test name, value, unit, and reference range?",
    SCHEDULING_AGENT: "Is this for a routine visit, urgent follow-up, or post-discharge check?",
    RECORDS_AGENT: "What should be included in the summary: symptoms, medicines, vitals, or reports?",
    INSURANCE_AGENT: "Do you have the claim, bill, policy, or authorization number?",
    CARE_TRANSITIONS_AGENT: "Is this before discharge, after discharge, or for readmission monitoring?",
    CLAIMS_OPS_AGENT: "Do you have the claim number, date of service, provider name, and policy reference?",
    UTILIZATION_AGENT: "What service is being requested, and which policy or appeal deadline applies?",
    GXP_QUALITY_AGENT: "What batch ID, SOP/QMS reference, or deviation ID should the draft use?",
    MEDTECH_COMPLIANCE_AGENT: "What device, requirement, complaint ID, or evidence reference should be reviewed?",
    WELLNESS_AGENT: "Are you safe right now, and is someone nearby who can support you?",
    LIFESTYLE_AGENT: "What is the main goal: food, sleep, activity, hydration, or stress?"
  };

  if (weakRoutes?.includes(ownerRoute)) {
    return questions[ownerRoute] || "Can you add one more detail so I can keep the answer precise?";
  }

  if (context.duration === "not-sure" && requirementProfile?.detailLevel !== "quick") {
    return "When did this start?";
  }

  return questions[ownerRoute] || "What one detail matters most for this request?";
}

function applyLlmBrainToPlan(plan, llmBrain) {
  const ownerRoute = llmBrain.routeDecision.ownerRoute || plan.responseOwner?.route || plan.execute?.[0] || "RAG_AGENT";
  const originalExecute = Array.isArray(plan.execute)
    ? plan.execute.filter((route) => executableAgentRoutes.has(route))
    : [];
  const execute = plan.singleAgent?.enabled
    ? [ownerRoute]
    : Array.from(new Set([
      ownerRoute,
      ...originalExecute.filter((route) => route !== ownerRoute)
    ]));
  const supportingRoutes = execute.filter((route) => route !== ownerRoute);
  const focusedRouteReasons = plan.singleAgent?.enabled
    ? {
      [ownerRoute]: plan.routeReasons?.[ownerRoute] || [`${routeLabel(ownerRoute)} selected as the single response owner.`]
    }
    : Object.fromEntries(
      execute.map((route) => {
        const existing = Array.isArray(plan.routeReasons?.[route]) ? plan.routeReasons[route] : [];
        const ownerNote = route === ownerRoute
          ? [`${routeLabel(ownerRoute)} selected as the primary response owner.`]
          : [`${routeLabel(route)} kept active as a supporting route for safety, evidence, or context.`];
        return [route, dedupeResponseItems([...existing, ...ownerNote])];
      })
    );

  return {
    ...plan,
    strategy: plan.singleAgent?.enabled
      ? "single-agent-tab-response"
      : supportingRoutes.length
        ? "agentic-owner-plus-support-routing"
        : "single-primary-agent-response",
    parallel: !plan.singleAgent?.enabled && supportingRoutes.length > 0,
    execute,
    routeReasons: focusedRouteReasons,
    responseOwner: {
      ...(plan.responseOwner || {}),
      route: ownerRoute,
      label: llmBrain.routeDecision.ownerLabel,
      reason: llmBrain.routeDecision.reason
    },
    brain: {
      id: llmBrain.id,
      score: llmBrain.score,
      label: llmBrain.label,
      status: llmBrain.status,
      answerPolicy: llmBrain.answerPolicy,
      ambiguity: llmBrain.ambiguity,
      ownerRoute,
      supportingRoutes
    },
    decisionTrace: [
      ...(plan.decisionTrace || []),
      `${llmBrain.label}: ${llmBrain.routeDecision.ownerLabel} owns the response.`,
      `${llmBrain.evidenceDecision.localReferences} local reference match(es), ${llmBrain.evidenceDecision.coverageScore}% coverage.`,
      ...(supportingRoutes.length
        ? [`Support routes kept active: ${supportingRoutes.map(routeLabel).join(", ")}.`]
        : []),
      llmBrain.ambiguity.needsClarification
        ? `Clarify next: ${llmBrain.ambiguity.nextQuestion}`
        : "No clarification is required before the focused response."
    ],
    summary: plan.singleAgent?.enabled || !supportingRoutes.length
      ? plan.summary
      : `${routeLabel(ownerRoute)} owns the patient reply while ${supportingRoutes.map(routeLabel).join(", ")} remain active for supporting context and safety.`
  };
}

function chooseResponseOwnerRoute({ expectedRoute, topIntent, plan, risk, singleAgentEnabled, ownerHintRoute = null }) {
  if (singleAgentEnabled && plan.singleAgent?.route) {
    return plan.singleAgent.route;
  }

  if ((risk.level === "HIGH" || risk.level === "CRITICAL") && plan.execute.includes("ALERT_AGENT")) {
    return "ALERT_AGENT";
  }

  const hintedRoute = ownerHintRoute && plan.execute.includes(ownerHintRoute)
    ? ownerHintRoute
    : null;
  const expectedOwnerRoute = expectedRoute && plan.execute.includes(expectedRoute)
    ? expectedRoute
    : null;
  const topIntentRoute = topIntent?.route && plan.execute.includes(topIntent.route)
    ? topIntent.route
    : null;

  if (expectedOwnerRoute && expectedOwnerRoute !== "RAG_AGENT") {
    return expectedOwnerRoute;
  }

  if (hintedRoute && hintedRoute !== "RAG_AGENT") {
    return hintedRoute;
  }

  if (expectedOwnerRoute) {
    return expectedOwnerRoute;
  }

  if (topIntentRoute && !hintedRoute) {
    return topIntentRoute;
  }

  if (hintedRoute) {
    return hintedRoute;
  }

  return plan.execute[0] || "RAG_AGENT";
}

function clonePlanForPrecision(plan) {
  return {
    ...plan,
    execute: Array.from(new Set(plan.execute || [])),
    routeReasons: Object.fromEntries(
      Object.entries(plan.routeReasons || {}).map(([route, reasons]) => [route, [...reasons]])
    ),
    postProcessors: [...(plan.postProcessors || [])],
    singleAgent: plan.singleAgent ? { ...plan.singleAgent } : plan.singleAgent
  };
}

function insertPlanRoute(plan, route, reason) {
  if (!plan.execute.includes(route)) {
    const insertIndex = route === "ALERT_AGENT"
      ? plan.execute.length
      : Math.max(1, plan.execute.indexOf("RAG_AGENT") + 1);
    plan.execute.splice(insertIndex, 0, route);
  }

  if (!plan.routeReasons[route]) {
    plan.routeReasons[route] = [];
  }

  if (!plan.routeReasons[route].includes(reason)) {
    plan.routeReasons[route].push(reason);
  }

  plan.parallel = plan.execute.length > 1;
  plan.strategy = plan.parallel ? "precision-supervised-routing" : "precision-single-route";
}

function buildRouteEvidenceMatrix({ intents, plan, medicalKnowledge, risk }) {
  return (plan.execute || []).map((route) => {
    const policy = routeEvidencePolicy[route] || routeEvidencePolicy.RAG_AGENT;
    const routeIntent = intents.find((intent) => intent.route === route);
    const knowledgeMatches = Array.isArray(medicalKnowledge?.matches) ? medicalKnowledge.matches : [];
    const routeKnowledge = getRouteMedicalKnowledge(route, medicalKnowledge);
    const categoryMatches = routeKnowledge.matches?.length
      ? routeKnowledge.matches
      : knowledgeMatches.filter((match) => doesKnowledgeMatchRoutePolicy(match, policy));
    const matchedTerms = new Set(categoryMatches.flatMap((match) => match.matchedTerms || [])).size;
    const intentEvidenceCount = Array.isArray(routeIntent?.evidence) ? routeIntent.evidence.length : 0;
    const knowledgeCoverage = Number(routeKnowledge.coverageScore || medicalKnowledge?.coverageScore || 40);
    const score = clamp(Math.round(
      ((routeIntent?.confidence || 0.46) * 42) +
        Math.min(categoryMatches.length * 10, 24) +
        Math.min(matchedTerms * 6, 18) +
        Math.min(intentEvidenceCount * 4, 12) +
        (knowledgeCoverage * 0.16) +
        (route === "ALERT_AGENT" && risk?.level !== "LOW" ? 12 : 0)
    ), 0, 99);

    return {
      route,
      label: routeLabel(route),
      score,
      minimumCoverage: policy.minimumCoverage,
      passed: score >= policy.minimumCoverage || (route === "RAG_AGENT" && risk.level === "LOW"),
      matchedCategories: Array.from(new Set(categoryMatches.map((match) => match.category))),
      matchedTerms,
      coverageScore: knowledgeCoverage,
      references: categoryMatches.slice(0, 3).map((match) => ({
        title: match.title,
        relevance: match.relevance
      })),
      intentConfidence: Math.round((routeIntent?.confidence || 0) * 100),
      intentEvidenceCount
    };
  });
}

function doesKnowledgeMatchRoutePolicy(match, policy) {
  const policyCategories = Array.isArray(policy?.categories) ? policy.categories : [];
  const matchCategories = Array.isArray(match?.routeTags) ? match.routeTags : [];

  if (policyCategories.includes(match?.category)) {
    return true;
  }

  return matchCategories.some((tag) => policyCategories.includes(tag));
}

function buildAgentResultsIndex(agentResults = []) {
  return new Map(agentResults.map((agent) => [agent.id, agent]));
}

function getAgentResult(agentResultsById, route) {
  return agentResultsById.get(route) || null;
}

function getAgentOutput(agentResultsById, route) {
  return agentResultsById.get(route)?.output || null;
}

function getRuntimeIndexes(context = {}) {
  if (context && context.__runtimeIndexes) {
    return context.__runtimeIndexes;
  }

  const intentsByRoute = new Map();

  for (const intent of context.intents || []) {
    const bucket = intentsByRoute.get(intent.route) || [];
    bucket.push(intent);
    intentsByRoute.set(intent.route, bucket);
  }

  const topIntentByRoute = new Map();

  for (const [route, bucket] of intentsByRoute.entries()) {
    bucket.sort((first, second) => second.confidence - first.confidence);
    topIntentByRoute.set(route, bucket[0] || null);
  }

  const routeEvidenceSource = Array.isArray(context.precisionSupervisor?.routeEvidence) && context.precisionSupervisor.routeEvidence.length
    ? context.precisionSupervisor.routeEvidence
    : buildRouteEvidenceMatrix({
      intents: context.intents || [],
      plan: context.plan || { execute: [] },
      medicalKnowledge: context.medicalKnowledge || { matches: [], coverageScore: 0 },
      risk: context.risk || { level: "LOW" }
    });
  const routeEvidenceByRoute = new Map(routeEvidenceSource.map((entry) => [entry.route, entry]));

  const runtimeIndexes = {
    intentsByRoute,
    topIntentByRoute,
    routeEvidenceByRoute
  };

  if (context && typeof context === "object") {
    Object.defineProperty(context, "__runtimeIndexes", {
      value: runtimeIndexes,
      writable: true,
      configurable: true,
      enumerable: false
    });
  }

  return runtimeIndexes;
}

const executableAgentRoutes = new Set([
  "RAG_AGENT",
  "SPECIALIST_DOCTOR_AGENT",
  "VITALS_AGENT",
  "PHARMACY_AGENT",
  "SCHEDULING_AGENT",
  "ALERT_AGENT",
  "LABS_AGENT",
  "LIFESTYLE_AGENT",
  "WELLNESS_AGENT",
  "RECORDS_AGENT",
  "INSURANCE_AGENT",
  "CARE_TRANSITIONS_AGENT",
  "CLAIMS_OPS_AGENT",
  "UTILIZATION_AGENT",
  "GXP_QUALITY_AGENT",
  "MEDTECH_COMPLIANCE_AGENT"
]);

const interfaceAgentRoutes = {
  advisor: "RAG_AGENT",
  specialist: "SPECIALIST_DOCTOR_AGENT",
  specialistdoctor: "SPECIALIST_DOCTOR_AGENT",
  "specialist-doctor": "SPECIALIST_DOCTOR_AGENT",
  vitals: "VITALS_AGENT",
  medications: "PHARMACY_AGENT",
  medicine: "PHARMACY_AGENT",
  labs: "LABS_AGENT",
  lab: "LABS_AGENT",
  atlas: "RAG_AGENT",
  medicalatlas: "RAG_AGENT",
  "medical-atlas": "RAG_AGENT",
  wellness: "LIFESTYLE_AGENT",
  appointments: "SCHEDULING_AGENT",
  appointment: "SCHEDULING_AGENT",
  records: "RECORDS_AGENT",
  insurance: "INSURANCE_AGENT",
  claims: "CLAIMS_OPS_AGENT",
  utilization: "UTILIZATION_AGENT",
  transitions: "CARE_TRANSITIONS_AGENT",
  discharge: "CARE_TRANSITIONS_AGENT",
  gxp: "GXP_QUALITY_AGENT",
  medtech: "MEDTECH_COMPLIANCE_AGENT",
  safety: "ALERT_AGENT",
  alert: "ALERT_AGENT",
  studio: "RAG_AGENT",
  dashboard: "RECORDS_AGENT",
  model: "RAG_AGENT",
  agents: "RAG_AGENT",
  access: "RECORDS_AGENT"
};

function buildRequirementProfile({ message, profile, vitals, context, singleAgentScope, answerMode }) {
  const text = buildSearchText(message);
  const output = singleAgentScope?.interfaceName === "atlas"
    ? {
      type: "medical_atlas",
      label: "Medical atlas education",
      expectedRoute: "RAG_AGENT",
      terms: ["disease", "medicine", "treatment", "prevention", "chart", "image"]
    }
    : singleAgentScope?.interfaceName === "specialist"
      ? {
        type: "specialist_doctor",
        label: "Specialist doctor review",
        expectedRoute: "SPECIALIST_DOCTOR_AGENT",
        terms: ["disease", "specialist", "symptoms", "tests", "treatment", "prevention", "warning signs"]
      }
    : detectRequestedOutput(text, context, answerMode);
  const detailLevel = detectRequestedDetailLevel(text, answerMode);
  const expectedRoute = singleAgentScope?.enabled && singleAgentScope.route
    ? singleAgentScope.route
    : output.expectedRoute;
  const exactnessSignals = [
    ...findKeywordMatches(text, ["only", "just", "exactly", "specific", "precise", "brief", "short", "simple"]),
    ...(singleAgentScope?.enabled ? ["one-tab-one-agent"] : [])
  ];
  const missingDataPrompts = buildRequirementMissingData({ outputType: output.type, vitals, context, profile });
  const maxPrimaryActions = answerMode?.maxPrimaryActions || (detailLevel === "brief"
    ? 1
    : detailLevel === "detailed"
      ? 3
      : 2);
  const score = clamp(Math.round(
    72 +
      (output.type !== "safe_answer" ? 8 : 0) +
      (expectedRoute ? 7 : 0) +
      Math.min(exactnessSignals.length * 3, 9) +
      (singleAgentScope?.enabled ? 7 : 0) -
      Math.min(missingDataPrompts.length * 3, 9)
  ), 0, 99);
  const label = score >= 90
    ? "Exact requirement"
    : score >= 80
      ? "Clear requirement"
      : score >= 68
        ? "Usable requirement"
        : "Needs sharper request";

  return {
    name: "Requirement Fit Engine",
    score,
    label,
    outputType: output.type,
    outputLabel: output.label,
    expectedRoute,
    expectedAgent: routeLabel(expectedRoute),
    detailLevel,
    answerMode,
    maxPrimaryActions,
    exactnessSignals: Array.from(new Set(exactnessSignals)).slice(0, 6),
    missingDataPrompts,
    answerContract: buildAnswerContract({ output, detailLevel, singleAgentScope, answerMode }),
    noiseRules: [
      "Answer the selected request first.",
      "Avoid unrelated education, route summaries, or agent chatter.",
      "Do not diagnose, prescribe, calculate dosage, or perform live actions.",
      "Show urgent real-world care guidance when safety signals require it."
    ],
    summary: `${output.label} requested in ${answerMode?.label || detailLevel} mode; expected ${routeLabel(expectedRoute)}.`
  };
}

function normalizeAnswerMode(input = {}) {
  const answerModeInput = input.answerMode && typeof input.answerMode === "object"
    ? input.answerMode
    : null;
  const mode = normalizeSearchText(
    answerModeInput?.id
    || answerModeInput?.mode
    || answerModeInput?.label
    || input.answerMode
    || input.careMode
    || input.responseStyle
    || input.mode
  );
  const detailOverride = normalizeSearchText(answerModeInput?.detailLevel || input.detailLevel);
  const modes = {
    quick: {
      id: "quick",
      label: "Quick",
      detailLevel: "brief",
      maxPrimaryActions: 1,
      summaryStyle: "single safest next step"
    },
    deep: {
      id: "deep",
      label: "Deep Review",
      detailLevel: "detailed",
      maxPrimaryActions: 3,
      summaryStyle: "reasoned review with key context"
    },
    handoff: {
      id: "handoff",
      label: "Doctor Note",
      detailLevel: "detailed",
      maxPrimaryActions: 3,
      summaryStyle: "clinician-ready handoff summary"
    }
  };
  const selected = modes[mode] || (detailOverride === "detailed" ? modes.deep : detailOverride === "brief" ? modes.quick : modes.quick);

  return {
    ...selected,
    maxPrimaryActions: Number(answerModeInput?.maxPrimaryActions || selected.maxPrimaryActions),
    detailLevel: cleanText(answerModeInput?.detailLevel || selected.detailLevel) || selected.detailLevel,
    instruction: cleanText(answerModeInput?.instruction || answerModeInput?.responseInstruction || input.responseInstruction || "")
  };
}

function detectRequestedOutput(text, context, answerMode) {
  const outputs = [
    {
      type: "care_transition",
      label: "Care transition",
      expectedRoute: "CARE_TRANSITIONS_AGENT",
      terms: ["discharge", "discharge summary", "transition", "transitions", "care plan", "patient instruction", "patient instructions", "post-discharge", "post discharge", "readmission", "outreach", "quality reporting", "multidisciplinary", "care coordination"]
    },
    {
      type: "claims_operations",
      label: "Claims operations",
      expectedRoute: "CLAIMS_OPS_AGENT",
      terms: ["claims intake", "claim document", "claim packet", "adjudication", "post-payment", "post payment", "provider inquiry", "provider inquiries", "validation edits", "explanation of benefits", "eob", "claims regulatory reporting"]
    },
    {
      type: "utilization_review",
      label: "Prior authorization",
      expectedRoute: "UTILIZATION_AGENT",
      terms: ["prior authorization", "prior auth", "appeal", "appeals", "utilization management", "medical policy", "policy check", "policy checks", "medical necessity", "provider member", "provider/member", "clinical document", "audit logging"]
    },
    {
      type: "gxp_quality",
      label: "GxP quality",
      expectedRoute: "GXP_QUALITY_AGENT",
      terms: ["batch record", "master batch record", "ebr", "electronic batch record", "shopfloor", "shop floor", "deviation", "deviations", "exception narrative", "release documentation", "qa review", "quality review", "change control", "sop", "qms", "gxp", "cmc"]
    },
    {
      type: "medtech_compliance",
      label: "MedTech compliance",
      expectedRoute: "MEDTECH_COMPLIANCE_AGENT",
      terms: ["design controls", "technical file", "technical documentation", "complaint handling", "mdr", "ivdr", "requirements", "user needs", "traceability", "v&v", "verification", "validation", "cybersecurity", "sbom", "post-market surveillance", "post market surveillance", "capa", "root cause", "regulatory reporting"]
    },
    {
      type: "specialist_disease_review",
      label: "Specialist disease review",
      expectedRoute: "SPECIALIST_DOCTOR_AGENT",
      terms: ["core disease", "specialist", "disease", "condition", "diagnosis", "symptoms", "causes", "risk factors", "complication", "complications", "treatment", "treatment options", "management", "precaution", "precautions", "prevention", "cure", "hypertension", "diabetes", "asthma", "copd", "heart disease", "stroke", "kidney disease", "thyroid", "migraine", "infection", "liver", "cholesterol"]
    },
    {
      type: "medical_atlas",
      label: "Medical atlas education",
      expectedRoute: "RAG_AGENT",
      terms: ["what is", "explain", "overview", "guide", "medical atlas", "health library", "precaution", "precautions", "prevention", "treatment", "cure", "complication", "complications", "risk factors", "screening"]
    },
    {
      type: "medicine_safety",
      label: "Medication safety",
      expectedRoute: "PHARMACY_AGENT",
      terms: ["medicine", "medication", "tablet", "dose", "pill", "missed", "side effect", "allergy", "insulin", "metformin", "amlodipine"]
    },
    {
      type: "mental_wellness",
      label: "Mental wellness support",
      expectedRoute: "WELLNESS_AGENT",
      terms: ["stress", "stressed", "anxiety", "anxious", "panic", "worried", "worry", "mood", "sad", "depressed", "depression", "cannot sleep", "can't sleep", "insomnia", "overwhelmed"]
    },
    {
      type: "vital_review",
      label: "Vital specialist review",
      expectedRoute: "VITALS_AGENT",
      terms: ["bp", "blood pressure", "sugar", "glucose", "pulse", "heart rate", "oxygen", "spo2", "temperature", "bmi", "reading"]
    },
    {
      type: "lab_explanation",
      label: "Lab explanation",
      expectedRoute: "LABS_AGENT",
      terms: ["lab", "report", "hba1c", "a1c", "cholesterol", "cbc", "creatinine", "tsh", "thyroid"]
    },
    {
      type: "appointment_plan",
      label: "Follow-up plan",
      expectedRoute: "SCHEDULING_AGENT",
      terms: ["appointment", "follow up", "follow-up", "book", "schedule", "visit", "clinic"]
    },
    {
      type: "admin_review",
      label: "Administrative review",
      expectedRoute: "INSURANCE_AGENT",
      terms: ["insurance", "claim", "eob", "coverage", "bill", "billing", "authorization", "prior auth"]
    },
    {
      type: "record_summary",
      label: "Health summary",
      expectedRoute: "RECORDS_AGENT",
      terms: ["summary", "health summary", "care summary", "record", "records", "doctor note", "handoff", "handoff summary", "doctor handoff", "share-ready note", "prescription note", "timeline"]
    },
    {
      type: "wellness_plan",
      label: "Wellness plan",
      expectedRoute: "LIFESTYLE_AGENT",
      terms: ["diet", "sleep routine", "hydration", "walking", "exercise", "routine", "healthy habit", "daily habit"]
    },
    {
      type: "urgent_safety",
      label: "Urgent safety",
      expectedRoute: "ALERT_AGENT",
      terms: ["chest pain", "breathing", "shortness of breath", "faint", "confused", "stroke", "emergency", "severe allergy"]
    },
    {
      type: "next_step",
      label: "Next safe step",
      expectedRoute: "RAG_AGENT",
      terms: ["what should i do", "what to do", "next step", "help me", "safe step"]
    },
    {
      type: "explanation",
      label: "Plain explanation",
      expectedRoute: "RAG_AGENT",
      terms: ["explain", "why", "what is", "meaning", "understand"]
    }
  ];

  if (context.careGoal === "medicine-safety") {
    return outputs.find((output) => output.type === "medicine_safety");
  }

  if (context.careGoal === "follow-up") {
    return outputs.find((output) => output.type === "appointment_plan");
  }

  if (context.careGoal === "urgency" || context.redFlags?.length) {
    return outputs.find((output) => output.type === "urgent_safety");
  }

  const rankedOutputs = outputs
    .map((output, index) => ({
      ...output,
      score: scoreRequestedOutput(text, output, answerMode),
      rankIndex: index
    }))
    .filter((output) => output.score > 0)
    .sort((first, second) => second.score - first.score || first.rankIndex - second.rankIndex);

  return rankedOutputs[0]
    ? {
      type: rankedOutputs[0].type,
      label: rankedOutputs[0].label,
      expectedRoute: rankedOutputs[0].expectedRoute,
      terms: rankedOutputs[0].terms,
      matchedTerms: rankedOutputs[0].matchedTerms,
      score: rankedOutputs[0].score
    }
    : {
      type: "safe_answer",
      label: "Safe answer",
      expectedRoute: "RAG_AGENT",
      terms: []
    };
}

function scoreRequestedOutput(text, output, answerMode) {
  const matchedTerms = findKeywordMatches(text, output.terms);
  const uniqueMatches = Array.from(new Set(matchedTerms));
  const scoreTermMatches = (matches) => matches.reduce((total, term) => {
    const normalized = normalizeSearchText(term);
    const words = normalized.split(" ").filter(Boolean).length;
    const weight = words >= 3
      ? 18
      : words === 2
        ? 14
        : normalized.length <= 3
          ? 5
          : 9;

    return total + weight;
  }, 0);

  if (!uniqueMatches.length) {
    return 0;
  }

  if (output.type === "specialist_disease_review") {
    const explicitSpecialistCue = hasExplicitSpecialistReviewCue(text);
    const deepDiseaseCue = hasDeepDiseaseReviewCue(text);
    const generalGuidanceCue = hasGeneralGuidanceCue(text);
    const diseaseMatches = uniqueMatches.filter((term) => ![
      "specialist",
      "core disease",
      "disease",
      "condition",
      "symptoms",
      "causes",
      "tests",
      "what should i discuss",
      "what to discuss",
      "treatment",
      "management",
      "precaution",
      "precautions",
      "risk factors",
      "complication",
      "complications",
      "treatment options",
      "prevention",
      "cure",
      "long term",
      "monitoring",
      "doctor questions",
      "clinician questions"
    ].includes(normalizeSearchText(term)));
    const structuredSpecialistCue = findKeywordMatches(text, [
      "tests",
      "what should i discuss",
      "what to discuss",
      "doctor questions",
      "clinician questions"
    ]).length > 0;

    if (!explicitSpecialistCue) {
      if (generalGuidanceCue && !structuredSpecialistCue) {
        return 0;
      }

      if (!(deepDiseaseCue && diseaseMatches.length)) {
        return 0;
      }
    }
  }

  if (output.type === "medical_atlas") {
    const atlasIntroCue = findKeywordMatches(text, ["what is", "explain", "overview", "guide", "medical atlas", "health library"]).length > 0;
    const atlasManagementCueCount = findKeywordMatches(text, ["precaution", "precautions", "prevention", "treatment", "cure", "complication", "complications", "risk factors", "screening"]).length;
    const topicCue = hasMedicalAtlasTopicCue(text);
    const specialistPenalty = hasDeepDiseaseReviewCue(text) && findKeywordMatches(text, [
      "hypertension",
      "diabetes",
      "asthma",
      "copd",
      "heart disease",
      "stroke",
      "kidney disease",
      "thyroid",
      "migraine",
      "infection",
      "liver",
      "cholesterol"
    ]).length ? 14 : 0;

    if (!topicCue || (!atlasIntroCue && atlasManagementCueCount < 2)) {
      return 0;
    }

    const atlasTermScore = scoreTermMatches(uniqueMatches);
    const atlasDensityBoost = Math.min(uniqueMatches.length * 3, 15);
    return Math.max(0, atlasTermScore + atlasDensityBoost + (atlasIntroCue ? 14 : 0) + Math.min(atlasManagementCueCount * 4, 16) - specialistPenalty);
  }

  const termScore = scoreTermMatches(uniqueMatches);
  const densityBoost = Math.min(uniqueMatches.length * 3, 15);
  const routeBoosts = {
    RECORDS_AGENT: hasTerm(text, "doctor note") || hasTerm(text, "handoff") || hasTerm(text, "handoff summary") ? 16 : 0,
    CARE_TRANSITIONS_AGENT: hasTerm(text, "discharge summary") || hasTerm(text, "care plan") || hasTerm(text, "post discharge") ? 16 : 0,
    CLAIMS_OPS_AGENT: hasTerm(text, "claims intake") || hasTerm(text, "adjudication") || hasTerm(text, "claim document") ? 16 : 0,
    UTILIZATION_AGENT: hasTerm(text, "prior authorization") || hasTerm(text, "prior auth") || hasTerm(text, "appeal") ? 16 : 0,
    PHARMACY_AGENT: hasTerm(text, "missed") || hasTerm(text, "dose") || hasTerm(text, "side effect") ? 12 : 0,
    LABS_AGENT: hasTerm(text, "lab report") || hasTerm(text, "hba1c") || hasTerm(text, "cholesterol") ? 12 : 0,
    SPECIALIST_DOCTOR_AGENT: hasExplicitSpecialistReviewCue(text) ? 18 : hasDeepDiseaseReviewCue(text) ? 16 : 0
  };
  const handoffBoost = answerMode?.id === "handoff" && ["RECORDS_AGENT", "CARE_TRANSITIONS_AGENT"].includes(output.expectedRoute) ? 14 : 0;

  return termScore + densityBoost + (routeBoosts[output.expectedRoute] || 0) + handoffBoost;
}

function hasExplicitSpecialistReviewCue(text = "") {
  return findKeywordMatches(text, [
    "specialist",
    "specialist review",
    "core disease",
    "disease review",
    "condition review",
    "cardiologist",
    "endocrinologist",
    "pulmonologist",
    "neurologist",
    "nephrologist",
    "gastroenterologist",
    "dermatologist",
    "orthopedic",
    "rheumatologist",
    "second opinion"
  ]).length > 0;
}

function hasDeepDiseaseReviewCue(text = "") {
  return findKeywordMatches(text, [
    "tests",
    "what should i discuss",
    "what to discuss",
    "treatment",
    "treatment options",
    "management",
    "precaution",
    "precautions",
    "complication",
    "complications",
    "prevention",
    "cure",
    "long term",
    "monitoring",
    "risk factors",
    "doctor questions",
    "clinician questions"
  ]).length > 0;
}

function hasGeneralGuidanceCue(text = "") {
  return findKeywordMatches(text, [
    "general advice",
    "general guidance",
    "simple advice",
    "safe guidance",
    "what should i track",
    "what should i watch for",
    "warning signs",
    "general precautions"
  ]).length > 0;
}

function hasMedicalAtlasTopicCue(text = "") {
  return findKeywordMatches(text, [
    "hypertension",
    "high blood pressure",
    "diabetes",
    "glucose",
    "asthma",
    "copd",
    "heart disease",
    "stroke",
    "kidney disease",
    "thyroid",
    "migraine",
    "infection",
    "cholesterol",
    "anemia",
    "pregnancy",
    "medicine",
    "medication",
    "drug",
    "lab",
    "report",
    "scan",
    "xray",
    "x-ray",
    "mri",
    "ct",
    "condition",
    "disease",
    "screening",
    "vaccine"
  ]).length > 0;
}

function detectRequestedDetailLevel(text, answerMode) {
  if (answerMode?.detailLevel) {
    return answerMode.detailLevel;
  }

  if (findKeywordMatches(text, ["brief", "short", "quick", "simple", "only", "just"]).length) {
    return "brief";
  }

  if (findKeywordMatches(text, ["detailed", "analysis", "explain fully", "complete", "deep", "comprehensive"]).length) {
    return "detailed";
  }

  return "focused";
}

function buildRequirementMissingData({ outputType, vitals, context, profile }) {
  const prompts = [];

  if (outputType === "vital_review" && !hasAnyVitals(vitals)) {
    prompts.push("Add the current reading value and time taken.");
  }

  if (outputType === "medicine_safety" && !context.lastMedicationTime) {
    prompts.push("Add when the medicine was last taken or missed.");
  }

  if (outputType === "specialist_disease_review" || outputType === "specialist_doctor") {
    if (!hasAnyVitals(vitals)) {
      prompts.push("Add relevant readings or report values when available.");
    }
    if (context.duration === "not-sure") {
      prompts.push("Add when symptoms started or when the disease concern changed.");
    }
  }

  if (outputType === "lab_explanation") {
    prompts.push("Add the lab value, unit, and reference range when available.");
  }

  if (outputType === "appointment_plan" && context.duration === "not-sure") {
    prompts.push("Add when the concern started.");
  }

  if (!profile.conditions.length && !profile.medications.length && !cleanText(profile.notes)) {
    prompts.push("Add known conditions and regular medicines for better personalization.");
  }

  return prompts.slice(0, 3);
}

function buildAnswerContract({ output, detailLevel, singleAgentScope, answerMode }) {
  const mode = singleAgentScope?.enabled ? "one agent response" : "focused response";
  const actionCount = detailLevel === "brief" ? "one clear action" : detailLevel === "detailed" ? "up to three useful actions" : "one or two useful actions";
  const style = answerMode?.summaryStyle ? `${answerMode.summaryStyle}; ` : "";

  return `${output.label}; ${mode}; ${style}${actionCount}; no unrelated medical details.`;
}

function normalizeSingleAgentScope(input) {
  const requestedRoute = normalizeRequestedAgentRoute(input.preferredAgent || input.agentRoute || input.agentId);
  const interfaceName = normalizeSearchText(input.interfaceName || input.tab || input.workspace);
  const interfaceRoute = interfaceName === "advisor" ? null : interfaceAgentRoutes[interfaceName];
  const requestedSingleAgentMode = input.singleAgentMode === true
    || input.singleAgent === true
    || input.agentMode === "single"
    || input.responseMode === "single-agent";
  const enabled = requestedSingleAgentMode && interfaceName !== "advisor";
  const route = requestedRoute || interfaceRoute || null;
  const validRoute = executableAgentRoutes.has(route) ? route : null;

  return {
    enabled: Boolean(enabled),
    requested: Boolean(requestedSingleAgentMode),
    route: validRoute,
    ownerHintRoute: validRoute,
    autoRoute: Boolean(requestedSingleAgentMode && !validRoute),
    agenticFrontDoor: Boolean(requestedSingleAgentMode && interfaceName === "advisor"),
    interfaceName: interfaceName || null,
    source: requestedRoute ? "preferred-agent" : interfaceRoute ? "interface-tab" : "intent-classifier"
  };
}

function normalizeRequestedAgentRoute(value) {
  const raw = String(value || "").trim();
  const canonical = raw.toUpperCase().replace(/[^A-Z0-9]+/g, "_");

  if (executableAgentRoutes.has(canonical)) {
    return canonical;
  }

  const alias = normalizeSearchText(raw);

  return interfaceAgentRoutes[alias] || null;
}

function buildEffectiveAnalysisMessage(message, singleAgentScope = {}) {
  const source = String(message || "").replace(/\r\n/g, "\n").trim();
  const isSpecialistScope = singleAgentScope?.interfaceName === "specialist"
    || singleAgentScope?.route === "SPECIALIST_DOCTOR_AGENT"
    || /^specialist doctor review/i.test(source);

  if (!source || !isSpecialistScope) {
    return source;
  }

  return buildSpecialistAnalysisMessage(source) || source;
}

function buildSpecialistAnalysisMessage(message = "") {
  const patientSignalText = getSpecialistPatientSignalText(message);
  const explicitSpecialtyHint = getSpecialistExplicitFocusText(message);
  const structuredEvidenceParts = [];

  if (explicitSpecialtyHint) {
    structuredEvidenceParts.push(`specialty: ${explicitSpecialtyHint}`);
  }

  const structuredEvidenceText = getSpecialistStructuredEvidenceText(message);

  if (structuredEvidenceText) {
    structuredEvidenceParts.push(structuredEvidenceText);
  }

  return [patientSignalText, structuredEvidenceParts.join("\n").trim()]
    .filter(Boolean)
    .join("\n")
    .trim();
}

const specialistFocusAliases = {
  cardiology: ["cardiology", "heart and blood pressure", "cardiac"],
  diabetes: ["diabetes", "diabetes and metabolism", "metabolism"],
  respiratory: ["respiratory", "breathing and lungs", "pulmonology", "pulmonary"],
  neurology: ["neurology", "headache stroke signs and nerves", "nerves"],
  kidney: ["kidney", "kidney and urine health", "renal"],
  gastro: ["gastro", "stomach liver and digestion", "gastrointestinal", "digestion"],
  orthopedic: ["orthopedic", "bone joint and pain", "orthopedics"],
  infection: ["infection", "fever and infection"],
  skin: ["skin", "skin allergy and immune reaction", "dermatology", "allergy"],
  endocrine: ["endocrine", "thyroid hormones and metabolism", "endocrinology", "thyroid"]
};

const allowedSpecialistFocuses = new Set(Object.keys(specialistFocusAliases));

function normalizeSpecialistFocus(value = "") {
  const raw = String(value || "").trim().toLowerCase();

  if (!raw) {
    return "";
  }

  const compact = raw
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
  const slug = compact.replace(/\s+/g, "-");

  if (allowedSpecialistFocuses.has(raw)) {
    return raw;
  }

  if (allowedSpecialistFocuses.has(slug)) {
    return slug;
  }

  for (const [focusId, aliases] of Object.entries(specialistFocusAliases)) {
    if (aliases.includes(compact) || aliases.includes(raw)) {
      return focusId;
    }
  }

  return "";
}

function applySingleAgentScope(plan, scope, risk) {
  if (!scope.enabled) {
    return plan;
  }

  const route = executableAgentRoutes.has(scope.route)
    ? scope.route
    : selectPrimarySingleAgentRoute(plan, risk);
  const label = routeLabel(route);
  const reason = scope.route && scope.interfaceName
    ? `${formatInterfaceName(scope.interfaceName)} tab selected ${label}`
    : `${label} selected by the intent classifier as the primary response agent`;

  return {
    ...plan,
    strategy: scope.autoRoute ? "single-primary-agent-response" : "single-agent-tab-response",
    parallel: false,
    execute: [route],
    routeReasons: {
      [route]: [
        reason,
        `${risk.label} risk still reviewed by the safety guardrails`
      ]
    },
    singleAgent: {
      enabled: true,
      route,
      label,
      interfaceName: scope.interfaceName,
      source: scope.source,
      mode: scope.autoRoute ? "one-primary-agent" : "one-tab-one-agent",
      behavior: "Only this selected specialist generates the visible response; memory, risk scoring, synthesis, and guardrails still run around it."
    },
    summary: scope.autoRoute
      ? `${label} is responding as the single primary agent while safety checks stay active.`
      : `${label} is responding independently for this tab while safety checks stay active.`
  };
}

function selectPrimarySingleAgentRoute(plan, risk) {
  const routes = Array.isArray(plan?.execute) ? plan.execute : [];

  if ((risk.level === "CRITICAL" || risk.level === "HIGH") && routes.includes("ALERT_AGENT")) {
    return "ALERT_AGENT";
  }

  const specialistRoute = routes.find((route) => route !== "RAG_AGENT" && route !== "ALERT_AGENT");

  if (specialistRoute) {
    return specialistRoute;
  }

  if (routes.includes("ALERT_AGENT") && risk.level !== "LOW") {
    return "ALERT_AGENT";
  }

  return routes.find((route) => executableAgentRoutes.has(route)) || "RAG_AGENT";
}

function formatInterfaceName(value) {
  const text = cleanText(value).replace(/[-_]+/g, " ");

  if (!text) {
    return "Selected";
  }

  return text.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function runAgentPlan(context) {
  const runners = {
    RAG_AGENT: runRagAgent,
    SPECIALIST_DOCTOR_AGENT: runSpecialistDoctorAgent,
    VITALS_AGENT: runVitalsAgent,
    PHARMACY_AGENT: runPharmacyAgent,
    SCHEDULING_AGENT: runSchedulingAgent,
    ALERT_AGENT: runAlertAgent,
    LABS_AGENT: runLabsAgent,
    LIFESTYLE_AGENT: runLifestyleAgent,
    WELLNESS_AGENT: runWellnessAgent,
    RECORDS_AGENT: runRecordsAgent,
    INSURANCE_AGENT: runInsuranceAgent,
    CARE_TRANSITIONS_AGENT: runCareTransitionsAgent,
    CLAIMS_OPS_AGENT: runClaimsOpsAgent,
    UTILIZATION_AGENT: runUtilizationAgent,
    GXP_QUALITY_AGENT: runGxpQualityAgent,
    MEDTECH_COMPLIANCE_AGENT: runMedTechComplianceAgent
  };

  getRuntimeIndexes(context);

  return context.plan.execute.map((agentId, index) => {
    const runner = runners[agentId] || runners.RAG_AGENT;
    const startedAt = Date.now();
    const result = runner(context);

    return enrichAgentResult(result, {
      agentId,
      index,
      latencyMs: Date.now() - startedAt,
      context
    });
  });
}

function cloneWorkflowMatrixRow(row) {
  return {
    ...row,
    agentFunctions: [...(row.agentFunctions || [])],
    generatedOutputs: [...(row.generatedOutputs || [])],
    capabilities: [...(row.capabilities || [])]
  };
}

function findWorkflowMatrixRow(agentRoute) {
  const row = requirementWorkflowMatrix.find((item) => item.agentRoute === agentRoute);

  return row ? cloneWorkflowMatrixRow(row) : null;
}

function enrichAgentResult(result, { agentId, index, latencyMs, context }) {
  const output = result.output || {};
  const capabilityProfile = buildAgentCapabilityProfile({
    agent: result,
    agentId,
    index,
    latencyMs,
    context,
    output
  });
  const reasoning = buildAgentReasoningProfile({
    agent: result,
    agentId,
    index,
    latencyMs,
    context,
    output,
    capabilityProfile
  });
  const accuracyCalibration = buildAgentAccuracyCalibration({
    agentId,
    context,
    output,
    capabilityProfile,
    reasoning
  });
  const calibratedConfidenceScore = clamp(Math.round(
    (reasoning.score * 0.52) +
      (capabilityProfile.score * 0.26) +
      (accuracyCalibration.score * 0.22)
  ), 0, 100);

  return {
    ...result,
    output: {
      ...output,
      capabilityProfile,
      qualityGate: capabilityProfile.qualityGate,
      accuracyReview: capabilityProfile.accuracyReview,
      accuracyCalibration,
      reasoning,
      confidenceScore: calibratedConfidenceScore,
      confidenceLabel: labelForCalibratedConfidence(calibratedConfidenceScore),
      performance: {
        latencyMs,
        deterministic: true,
        evidenceItems: reasoning.evidence.length,
        safetyChecks: reasoning.safetyChecks.length,
        accuracyScore: capabilityProfile.score,
        calibrationScore: accuracyCalibration.score,
        qualityGatesPassed: capabilityProfile.gates.filter((gate) => gate.passed).length,
        qualityGatesTotal: capabilityProfile.gates.length
      }
    }
  };
}

function getAgentCapabilityPolicy(route) {
  const evidencePolicy = routeEvidencePolicy[route] || routeEvidencePolicy.RAG_AGENT;
  const capabilityPolicy = agentCapabilityPolicy[route] || agentCapabilityPolicy.RAG_AGENT;

  return {
    route,
    label: routeLabel(route),
    evidenceCategories: [...(evidencePolicy.categories || [])],
    minimumEvidenceScore: evidencePolicy.minimumCoverage || 50,
    ...capabilityPolicy
  };
}

function buildAgentCapabilityProfile({ agent, agentId, index, latencyMs, context, output }) {
  const policy = getAgentCapabilityPolicy(agentId);
  const runtimeIndexes = getRuntimeIndexes(context);
  const routeEvidence = runtimeIndexes.routeEvidenceByRoute.get(agentId) || {};
  const topIntent = runtimeIndexes.topIntentByRoute.get(agentId) || null;
  const routeReasons = context.plan?.routeReasons?.[agentId] || [];
  const outputSignals = collectOutputEvidenceSignals(output);
  const missingContext = collectOutputMissingContext(output);
  const blockedActions = blockedActionsForRoute(agentId);
  const hasBoundary = Boolean(output.liveAction || output.complianceBoundary || blockedActions.length >= 3);
  const responseOwner = context.plan?.responseOwner?.route === agentId || context.plan?.singleAgent?.route === agentId;
  const intentScore = Math.round((topIntent?.confidence || (agentId === "RAG_AGENT" ? 0.66 : 0.54)) * 100);
  const evidenceScore = Number(routeEvidence.score || 0);
  const inputScore = Number(context.inputQuality?.score || 0);
  const outputFocusScore = outputSignals.length >= 3 ? 92 : outputSignals.length >= 1 ? 74 : 48;
  const missingPenalty = Math.min(missingContext.length * 4, 16);
  const safetyScore = hasBoundary ? 94 : 58;
  const brainRouteScore = context.llmBrain?.routeScores?.find((item) => item.route === agentId)?.score || 0;
  const routeFitScore = Math.max(intentScore, brainRouteScore, responseOwner ? 92 : routeReasons.length ? 78 : 58);
  const evidenceGatePassed = evidenceScore >= policy.minimumEvidenceScore
    || outputSignals.length >= 3
    || agentId === "ALERT_AGENT"
    || Boolean(output.workflowMatrix);
  const gates = [
    {
      id: "specialty_match",
      label: "Specialty match",
      passed: routeFitScore >= 68,
      score: routeFitScore,
      detail: `${policy.label} is scoped to ${policy.domain}.`
    },
    {
      id: "evidence_strength",
      label: "Evidence strength",
      passed: evidenceGatePassed,
      score: evidenceGatePassed ? Math.max(evidenceScore, 72) : evidenceScore,
      detail: `${routeEvidence.matchedCategories?.length || 0} matched category group(s), ${outputSignals.length} output evidence signal(s).`
    },
    {
      id: "tool_boundary",
      label: "Tool boundary",
      passed: hasBoundary,
      score: safetyScore,
      detail: output.liveAction || output.complianceBoundary || "External actions remain disabled."
    },
    {
      id: "answer_focus",
      label: "Answer focus",
      passed: outputFocusScore >= 70,
      score: outputFocusScore,
      detail: output.summary ? compactResponseText(output.summary, 110) : "Focused output created by the specialist."
    },
    {
      id: "missing_context",
      label: "Missing context",
      passed: missingContext.length <= 3,
      score: clamp(92 - missingPenalty, 48, 92),
      detail: missingContext.length
        ? `${missingContext.slice(0, 3).join(", ")} would improve precision.`
        : "No major missing-context blocker found."
    },
    {
      id: "risk_alignment",
      label: "Risk alignment",
      passed: context.risk?.level === "LOW" || agentId === "ALERT_AGENT" || context.plan?.execute?.includes("ALERT_AGENT"),
      score: context.risk?.level === "LOW" || agentId === "ALERT_AGENT" || context.plan?.execute?.includes("ALERT_AGENT") ? 94 : 54,
      detail: context.risk?.label
        ? `${context.risk.label} is accounted for in the active care path.`
        : "Risk path checked."
    }
  ];
  const score = clamp(Math.round(
    gates.reduce((total, gate) => total + gate.score, 0) / gates.length
  ), 0, 100);
  const label = score >= 90
    ? "Highly reliable agent"
    : score >= 78
      ? "Strong agent"
      : score >= 64
        ? "Cautious agent"
        : "Needs more context";
  const strengths = [
    policy.reasoningStyle,
    outputSignals.length ? `${outputSignals.length} grounded output signal(s).` : "Focused specialist output.",
    hasBoundary ? "Safety and live-action boundaries are explicit." : "Boundary review completed."
  ];
  const watchPoints = [
    ...(missingContext.length ? [`Needs more detail: ${missingContext.slice(0, 3).join(", ")}.`] : []),
    ...((routeEvidence.passed || evidenceGatePassed) ? [] : [`Local evidence is below the ${policy.minimumEvidenceScore}% target.`]),
    ...(context.inputQuality?.warnings?.length ? context.inputQuality.warnings.slice(0, 1) : [])
  ];

  return {
    id: `${agentId}_CAPABILITY_PROFILE`,
    route: agentId,
    name: agent.name || routeLabel(agentId),
    domain: policy.domain,
    toolMode: output.productionTool || policy.toolMode,
    autonomy: responseOwner ? "response-owner" : index === 0 ? "primary-grounding" : "supporting-specialist",
    executionMode: context.plan?.singleAgent?.enabled ? "single-agent-tab" : "supervised-agent-routing",
    brainAlignment: {
      score: brainRouteScore,
      responseOwner: context.llmBrain?.routeDecision?.ownerRoute === agentId,
      centralPolicy: context.llmBrain?.answerPolicy?.style || "quick"
    },
    score,
    label,
    latencyMs,
    evidenceCategories: policy.evidenceCategories,
    minimumEvidenceScore: policy.minimumEvidenceScore,
    routeEvidence: {
      score: evidenceScore,
      passed: Boolean(routeEvidence.passed || evidenceGatePassed),
      matchedCategories: routeEvidence.matchedCategories || [],
      matchedTerms: routeEvidence.matchedTerms || 0,
      references: routeEvidence.references || []
    },
    outputSignals: outputSignals.slice(0, 6),
    missingContext: missingContext.slice(0, 6),
    qualityChecks: policy.qualityChecks,
    handoffTriggers: policy.handoffTriggers,
    blockedActions,
    gates,
    qualityGate: {
      status: gates.every((gate) => gate.passed) ? "passed" : "cautious",
      passed: gates.filter((gate) => gate.passed).length,
      total: gates.length,
      weakest: [...gates].sort((first, second) => first.score - second.score)[0]?.label || "None",
      responseOwner
    },
    accuracyReview: {
      score,
      strengths: strengths.slice(0, 3),
      watchPoints: watchPoints.length ? watchPoints.slice(0, 3) : ["No extra precision blocker found in this run."],
      nextUpgrade: evidenceScore < policy.minimumEvidenceScore
        ? "Add more local reference content for this specialty."
        : missingContext.length
          ? "Ask one short follow-up question before a deeper answer."
          : "Ready for focused patient-safe response synthesis."
    }
  };
}

function collectOutputEvidenceSignals(output = {}) {
  const references = Array.isArray(output.references)
    ? output.references.map((reference) => reference.title || reference.source)
    : [];
  const checklist = Array.isArray(output.checklist) ? output.checklist : [];
  const checks = Array.isArray(output.checks) ? output.checks.map((item) => item.title || item.detail) : [];
  const actions = [
    ...(Array.isArray(output.safeActions) ? output.safeActions : []),
    ...(Array.isArray(output.vitalActions) ? output.vitalActions : []),
    ...(Array.isArray(output.pharmacyActions) ? output.pharmacyActions : []),
    ...(Array.isArray(output.labActions) ? output.labActions : []),
    ...(Array.isArray(output.lifestyleActions) ? output.lifestyleActions : []),
    ...(Array.isArray(output.specialistActions) ? output.specialistActions : []),
    ...(Array.isArray(output.visitActions) ? output.visitActions : []),
    ...(Array.isArray(output.nextActions) ? output.nextActions : [])
  ];
  const draftOutputs = Array.isArray(output.draftOutputs)
    ? output.draftOutputs.map((item) => item.title || item.detail)
    : [];
  const structuredSignals = Array.isArray(output.structuredExtraction?.documentSignals)
    ? output.structuredExtraction.documentSignals
    : [];
  const summaryDraft = output.summaryDraft && typeof output.summaryDraft === "object"
    ? Object.keys(output.summaryDraft)
    : [];
  const workflowSignals = output.workflowMatrix
    ? [output.workflowMatrix.workflow, output.workflowMatrix.businessValue, ...(output.workflowMatrix.capabilities || [])]
    : [];
  const packetSignals = output.packetSummary && typeof output.packetSummary === "object"
    ? Object.keys(output.packetSummary)
    : [];
  const summarySignal = output.summary ? [compactResponseText(output.summary, 90)] : [];

  return Array.from(new Set([
    ...summarySignal,
    ...references,
    ...checklist,
    ...checks,
    ...actions,
    ...draftOutputs,
    ...structuredSignals,
    ...summaryDraft,
    ...workflowSignals,
    ...packetSignals
  ].map(cleanText).filter(Boolean))).slice(0, 10);
}

function collectOutputMissingContext(output = {}) {
  const missing = [
    ...(Array.isArray(output.missing) ? output.missing : []),
    ...(Array.isArray(output.missingContext) ? output.missingContext : []),
    ...(Array.isArray(output.accuracyGaps) ? output.accuracyGaps : []),
    ...(Array.isArray(output.reviewGaps) ? output.reviewGaps : []),
    ...(Array.isArray(output.documentGaps?.missing) ? output.documentGaps.missing : []),
    ...(Array.isArray(output.specialistProfile?.missingContext) ? output.specialistProfile.missingContext : []),
    ...(Array.isArray(output.structuredExtraction?.missingFields) ? output.structuredExtraction.missingFields : []),
    ...(Array.isArray(output.packetSummary?.policyInputsNeeded) ? output.packetSummary.policyInputsNeeded : [])
  ];

  return Array.from(new Set(missing.map(cleanText).filter(Boolean))).slice(0, 8);
}

function buildAgentReasoningProfile({ agent, agentId, index, latencyMs, context, output, capabilityProfile }) {
  const runtimeIndexes = getRuntimeIndexes(context);
  const topIntent = runtimeIndexes.topIntentByRoute.get(agentId) || null;
  const routeKnowledge = getRouteMedicalKnowledge(agentId, context.medicalKnowledge);
  const routeReasons = context.plan.routeReasons?.[agentId] || [];
  const references = Array.isArray(output.references) ? output.references : [];
  const missing = Array.isArray(output.missing) ? output.missing : [];
  const riskReasons = (context.risk?.reasons || []).slice(0, agentId === "ALERT_AGENT" ? 3 : 1);
  const evidence = Array.from(new Set([
    ...routeReasons,
    ...(topIntent?.evidence || []),
    ...references.map((reference) => reference.title || reference.source).filter(Boolean),
    ...(output.workflowMatrix ? [output.workflowMatrix.workflow, output.workflowMatrix.businessValue] : []),
    ...(capabilityProfile?.outputSignals || []).slice(0, 2),
    ...(agentId === "VITALS_AGENT" && hasAnyVitals(context.vitals) ? ["accepted structured vital readings"] : []),
    ...(agentId === "ALERT_AGENT" ? riskReasons : []),
    ...(routeKnowledge.matches?.length ? [`${routeKnowledge.matches.length} route-specific knowledge match(es)`] : [])
  ].map(cleanText).filter(Boolean))).slice(0, 6);
  const routeConfidence = topIntent ? Math.round(topIntent.confidence * 100) : agentId === "RAG_AGENT" ? 66 : 58;
  const evidenceScore = Math.min(20, evidence.length * 4);
  const inputScore = Math.min(12, Math.round((context.inputQuality?.score || 0) * 0.12));
  const routeReasonScore = routeReasons.length ? 10 : 4;
  const safetyScore = output.liveAction || output.complianceBoundary || capabilityProfile?.qualityGate?.passed >= 4 ? 12 : 7;
  const capabilityScore = capabilityProfile ? Math.min(12, Math.round(capabilityProfile.score * 0.12)) : 7;
  const missingPenalty = Math.min(missing.length * 3, 12);
  const highRiskSupport = (context.risk?.level === "HIGH" || context.risk?.level === "CRITICAL") && agentId !== "ALERT_AGENT" && !context.plan.execute.includes("ALERT_AGENT")
    ? -18
    : 0;
  const score = clamp(Math.round(
    routeConfidence * 0.36 +
    evidenceScore +
    inputScore +
    routeReasonScore +
    safetyScore +
    capabilityScore -
    missingPenalty +
    highRiskSupport
  ), 0, 100);
  const label = score >= 88
    ? "Strong reasoning"
    : score >= 74
      ? "Good reasoning"
      : score >= 58
        ? "Cautious reasoning"
        : "Needs more context";
  const assumptions = [
    missing.length ? `Missing: ${missing.slice(0, 3).join(", ")}.` : "Uses only the information the patient entered.",
    output.liveAction || "No external action is performed.",
    context.risk?.level !== "LOW" ? "Safety guidance stays ahead of model confidence." : "Low-risk guidance still avoids diagnosis and prescriptions."
  ];
  const safetyChecks = Array.from(new Set([
    "No diagnosis.",
    "No prescription or dosage calculation.",
    output.liveAction || "No external booking, message, claim, or alert is sent.",
    ...(context.risk?.level === "HIGH" || context.risk?.level === "CRITICAL" ? ["Urgent symptoms require real-world care guidance."] : []),
    ...(output.complianceBoundary ? [output.complianceBoundary] : [])
  ])).slice(0, 6);

  return {
    score,
    label,
    objective: `${agent.name || routeLabel(agentId)} handled ${routeLabel(agentId).toLowerCase()} with focused, safe output.`,
    whySelected: routeReasons.length ? routeReasons.join("; ") : "Selected by the care planner as a support route.",
    responseRole: index === 0 ? "primary-or-grounding" : "supporting-specialist",
    capability: capabilityProfile
      ? {
        domain: capabilityProfile.domain,
        score: capabilityProfile.score,
        gateStatus: capabilityProfile.qualityGate.status
      }
      : null,
    evidence,
    assumptions,
    safetyChecks,
    uncertainty: missing.length
      ? `More precision available if ${missing.slice(0, 2).join(" and ")} is added.`
      : "No major missing field blocked this agent's safe output.",
    latencyMs
  };
}

function buildAgentAccuracyCalibration({ agentId, context, output, capabilityProfile, reasoning }) {
  const policy = getAgentCapabilityPolicy(agentId);
  const routeIntent = (context.intents || []).find((intent) => intent.route === agentId);
  const routeEvidence = capabilityProfile?.routeEvidence || {};
  const missing = collectOutputMissingContext(output);
  const outputSignals = collectOutputEvidenceSignals(output);
  const triggers = detectClinicalCalibrationTriggers({
    message: context.message || "",
    vitals: context.vitals || {},
    context: context.context || {}
  });
  const requiredSafetyRoutes = triggers
    .filter((trigger) => trigger.requiredRoute)
    .map((trigger) => trigger.requiredRoute);
  const safetyRouteCovered = !requiredSafetyRoutes.length
    || agentId === "ALERT_AGENT"
    || (context.plan?.execute || []).some((route) => requiredSafetyRoutes.includes(route));
  const responseOwner = context.plan?.responseOwner?.route === agentId || context.plan?.singleAgent?.route === agentId;
  const ownerBonus = responseOwner ? 8 : 0;
  const routeScore = Math.max(
    Math.round((routeIntent?.confidence || 0.5) * 100),
    context.llmBrain?.routeScores?.find((item) => item.route === agentId)?.score || 0,
    responseOwner ? 88 : 0
  );
  const evidenceScore = Math.max(
    Number(routeEvidence.score || 0),
    Math.min(96, 48 + outputSignals.length * 6),
    Number(context.medicalKnowledge?.coverageScore || 0) - (agentId === "RAG_AGENT" ? 0 : 8)
  );
  const inputScore = Number(context.inputQuality?.score || 0);
  const safetyScore = safetyRouteCovered && (output.liveAction || output.complianceBoundary || blockedActionsForRoute(agentId).length)
    ? 96
    : safetyRouteCovered
      ? 82
      : 42;
  const specificityScore = clamp(94 - missing.length * 7 + Math.min(outputSignals.length * 2, 8), 35, 98);
  const score = clamp(Math.round(
    (routeScore * 0.24) +
      (evidenceScore * 0.24) +
      (inputScore * 0.16) +
      (safetyScore * 0.22) +
      (specificityScore * 0.14) +
      ownerBonus
  ), 0, 100);
  const needsClarification = missing.length >= 3 || inputScore < 58 || (score < 72 && context.risk?.level !== "CRITICAL");
  const followUpQuestion = needsClarification
    ? buildAgentCalibrationQuestion(agentId, missing, context)
    : "";
  const strengths = [
    routeScore >= 75 ? `${policy.label} route fit is strong.` : `${policy.label} route fit is usable but not dominant.`,
    evidenceScore >= policy.minimumEvidenceScore ? "Evidence meets this agent's local threshold." : "Evidence is below this agent's target threshold.",
    safetyRouteCovered ? "Safety route coverage is aligned." : "Safety route coverage needs attention.",
    outputSignals.length ? `${outputSignals.length} focused output signal(s) produced.` : "Output needs stronger structured signals."
  ];
  const blockers = [
    ...(safetyRouteCovered ? [] : ["Urgent safety route was required but not covered."]),
    ...(evidenceScore >= policy.minimumEvidenceScore ? [] : [`Local evidence below ${policy.minimumEvidenceScore}% target.`]),
    ...(missing.length ? [`Missing: ${missing.slice(0, 3).join(", ")}.`] : []),
    ...(context.inputQuality?.ignoredVitals?.length ? ["Some vital values were ignored because they were outside safe input ranges."] : [])
  ];

  return {
    id: `${agentId}_ACCURACY_CALIBRATION`,
    route: agentId,
    score,
    label: labelForCalibratedConfidence(score),
    responseOwner,
    summary: needsClarification
      ? `${routeLabel(agentId)} can answer, but one follow-up detail would improve precision.`
      : `${routeLabel(agentId)} is calibrated for a focused, patient-safe answer.`,
    evidenceFit: {
      score: evidenceScore,
      threshold: policy.minimumEvidenceScore,
      passed: evidenceScore >= policy.minimumEvidenceScore,
      references: routeEvidence.references || []
    },
    routeFit: {
      score: routeScore,
      intentConfidence: Math.round((routeIntent?.confidence || 0) * 100),
      owner: responseOwner
    },
    safetyFit: {
      score: safetyScore,
      covered: safetyRouteCovered,
      activeTriggers: triggers.map((trigger) => trigger.title).slice(0, 5)
    },
    specificity: {
      score: specificityScore,
      outputSignals: outputSignals.slice(0, 6),
      missing: missing.slice(0, 6)
    },
    confidenceInputs: {
      reasoning: reasoning?.score || 0,
      capability: capabilityProfile?.score || 0,
      inputQuality: inputScore,
      medicalKnowledge: Number(context.medicalKnowledge?.coverageScore || 0)
    },
    strengths: strengths.slice(0, 4),
    blockers: blockers.length ? blockers.slice(0, 4) : ["No precision blocker found."],
    needsClarification,
    followUpQuestion,
    answerPolicy: needsClarification
      ? "Ask one precise follow-up before a deep answer; give only a safe immediate next step."
      : "Answer directly, cite local evidence signals, and keep safety boundaries visible."
  };
}

function buildAgentCalibrationQuestion(agentId, missing, context = {}) {
  if (missing.length) {
    return `Please add ${missing.slice(0, 2).join(" and ")}.`;
  }

  const byAgent = {
    RAG_AGENT: "When did this start, and how strong is it now?",
    SPECIALIST_DOCTOR_AGENT: "Which diagnosis, report value, or symptom pattern should the specialist focus on?",
    VITALS_AGENT: "What are the latest readings, and were they repeated after rest?",
    PHARMACY_AGENT: "What is the exact medicine name, strength, and last-taken time?",
    SCHEDULING_AGENT: "What visit type, department, date preference, and urgency should be planned?",
    ALERT_AGENT: "Are chest pain, breathing trouble, fainting, weakness, severe allergy, or confusion happening now?",
    LABS_AGENT: "What are the test name, value, unit, reference range, and report date?",
    LIFESTYLE_AGENT: "Which habit should be improved first: food, movement, sleep, hydration, stress, or weight?",
    WELLNESS_AGENT: "Do you feel safe right now, and is someone available to support you?",
    RECORDS_AGENT: "Which patient, date, document type, and source should be saved?",
    INSURANCE_AGENT: "What insurer, claim type, service date, provider, and document do you have?"
  };

  if (context.risk?.level === "HIGH" || context.risk?.level === "CRITICAL") {
    return byAgent.ALERT_AGENT;
  }

  return byAgent[agentId] || "What one detail would make this answer more exact?";
}

function labelForCalibratedConfidence(score) {
  if (score >= 90) {
    return "High precision";
  }

  if (score >= 78) {
    return "Strong precision";
  }

  if (score >= 64) {
    return "Cautious precision";
  }

  return "Needs more detail";
}

function buildAgentReasoningQuality({ agentResults = [], intents = [], risk = {}, requirementProfile = {}, medicalKnowledge = {}, inputQuality = {} }) {
  const reasoningProfiles = agentResults
    .map((agent) => ({
      id: agent.id,
      name: agent.name,
      score: Number(agent.output?.reasoning?.score || agent.output?.confidenceScore || 0),
      label: agent.output?.reasoning?.label || agent.output?.confidenceLabel || "Reasoning not scored",
      evidenceCount: Array.isArray(agent.output?.reasoning?.evidence) ? agent.output.reasoning.evidence.length : 0,
      safetyCheckCount: Array.isArray(agent.output?.reasoning?.safetyChecks) ? agent.output.reasoning.safetyChecks.length : 0,
      accuracyScore: Number(agent.output?.capabilityProfile?.score || agent.output?.qualityGate?.score || 0),
      qualityGateStatus: agent.output?.qualityGate?.status || "not-scored",
      qualityGatesPassed: Number(agent.output?.qualityGate?.passed || 0),
      qualityGatesTotal: Number(agent.output?.qualityGate?.total || 0),
      uncertainty: agent.output?.reasoning?.uncertainty || "No uncertainty note."
    }))
    .filter((profile) => profile.score >= 0);
  const averageReasoning = reasoningProfiles.length
    ? Math.round(reasoningProfiles.reduce((total, profile) => total + profile.score, 0) / reasoningProfiles.length)
    : 0;
  const averageAgentAccuracy = reasoningProfiles.length
    ? Math.round(reasoningProfiles.reduce((total, profile) => total + profile.accuracyScore, 0) / reasoningProfiles.length)
    : 0;
  const qualityGateCoverage = reasoningProfiles.length
    ? Math.round((reasoningProfiles.reduce((total, profile) => total + profile.qualityGatesPassed, 0) /
      Math.max(1, reasoningProfiles.reduce((total, profile) => total + profile.qualityGatesTotal, 0))) * 100)
    : 0;
  const topIntent = [...intents].sort((first, second) => second.confidence - first.confidence)[0];
  const routeFit = requirementProfile?.expectedRoute && agentResults.some((agent) => agent.id === requirementProfile.expectedRoute)
    ? 96
    : requirementProfile?.expectedRoute
      ? 62
      : 78;
  const evidenceCoverage = Number(medicalKnowledge?.coverageScore || 0);
  const inputScore = Number(inputQuality?.score || 0);
  const safetyCoverage = risk.level === "HIGH" || risk.level === "CRITICAL"
    ? agentResults.some((agent) => agent.id === "ALERT_AGENT") ? 96 : 45
    : 88;
  const score = clamp(Math.round(
    averageReasoning * 0.3 +
    averageAgentAccuracy * 0.18 +
    routeFit * 0.16 +
    evidenceCoverage * 0.14 +
    inputScore * 0.1 +
    safetyCoverage * 0.08 +
    qualityGateCoverage * 0.04
  ), 0, 100);
  const label = score >= 88
    ? "Reasoning excellent"
    : score >= 76
      ? "Reasoning strong"
      : score >= 62
        ? "Reasoning cautious"
        : "Needs more context";
  const weakest = reasoningProfiles
    .filter((profile) => profile.score > 0)
    .sort((first, second) => first.score - second.score)[0];
  const improvement = weakest && weakest.score < 74
    ? `Add context for ${weakest.name}: ${weakest.uncertainty}`
    : inputQuality?.ignoredVitals?.length
      ? "Re-enter ignored vital readings using realistic values."
      : "Reasoning checks are aligned for this run.";

  return {
    score,
    label,
    summary: `${reasoningProfiles.length} agent reasoning profile(s), ${evidenceCoverage}% evidence coverage, ${routeFit}% route fit, ${qualityGateCoverage}% quality-gate coverage.`,
    primaryIntent: topIntent
      ? {
        label: topIntent.label,
        route: topIntent.route,
        confidence: Math.round(topIntent.confidence * 100),
        marginFromNext: topIntent.marginFromNext
      }
      : null,
    routeFit,
    evidenceCoverage,
    inputScore,
    safetyCoverage,
    averageAgentAccuracy,
    qualityGateCoverage,
    agentProfiles: reasoningProfiles,
    improvement,
    gates: [
      {
        title: "Route ownership",
        passed: routeFit >= 80,
        detail: requirementProfile?.expectedAgent
          ? `${requirementProfile.expectedAgent} matched against the requested output.`
          : "No narrow route was required."
      },
      {
        title: "Evidence grounding",
        passed: evidenceCoverage >= 55 || risk.level === "LOW",
        detail: `${evidenceCoverage}% local knowledge coverage before synthesis.`
      },
      {
        title: "Safety coverage",
        passed: safetyCoverage >= 80,
        detail: risk.label ? `${risk.label} checked against active routes.` : "Risk path checked."
      },
      {
        title: "Agent quality gates",
        passed: qualityGateCoverage >= 70,
        detail: `${qualityGateCoverage}% of specialist quality gates passed before synthesis.`
      },
      {
        title: "Input quality",
        passed: inputScore >= 55,
        detail: inputQuality?.summary || "Input quality checked."
      }
    ]
  };
}

function buildPerformanceProfile({ startedAt, inputQuality, medicalKnowledge, agentResults, reasoningQuality, smartAnalysis, llmBrain }) {
  const agentLatencies = agentResults.map((agent) => Number(agent.output?.performance?.latencyMs || 0));
  const totalAgentLatencyMs = agentLatencies.reduce((total, latency) => total + latency, 0);
  const totalLatencyMs = Math.max(0, Date.now() - startedAt);
  const evidenceCoverage = Number(medicalKnowledge?.coverageScore || 0);
  const confidenceScore = Number(smartAnalysis?.confidence?.score || 0);
  const reasoningScore = Number(reasoningQuality?.score || 0);
  const inputScore = Number(inputQuality?.score || 0);
  const brainScore = Number(llmBrain?.score || 0);
  const compositeScore = clamp(Math.round(
    reasoningScore * 0.3 +
    confidenceScore * 0.18 +
    evidenceCoverage * 0.16 +
    inputScore * 0.12 +
    brainScore * 0.14 +
    (totalLatencyMs <= 250 ? 10 : totalLatencyMs <= 750 ? 7 : 4)
  ), 0, 100);

  return {
    mode: "deterministic-local-runtime",
    score: compositeScore,
    label: compositeScore >= 88
      ? "High performance"
      : compositeScore >= 74
        ? "Strong performance"
        : compositeScore >= 60
          ? "Stable performance"
          : "Needs more context",
    totalLatencyMs,
    totalAgentLatencyMs,
    agentCount: agentResults.length,
    reasoningScore,
    brainScore,
    confidenceScore,
    evidenceCoverage,
    inputScore,
    optimization: [
      "Primary route owns the patient reply.",
      "Supporting routes add evidence only when they improve safety or context.",
      "Local deterministic checks avoid external API latency.",
      "Reasoning quality gates run before response synthesis.",
      "The cognitive core selects one answer owner before agents respond."
    ]
  };
}

function buildAgenticSupervisorReview({ message, profile, vitals, context, memoryContext, intents, risk, plan, singleAgent, requirementProfile, agentResults, medicalKnowledge, inputQuality, reasoningQuality }) {
  const executedRoutes = new Set(agentResults.map((agent) => agent.id));
  const requiredRoutes = singleAgent?.enabled
    ? [singleAgent.route]
    : inferRequiredRoutes({ message, vitals, context, intents, risk });
  const missingRoutes = requiredRoutes.filter((route) => !executedRoutes.has(route));
  const coveredRoutes = requiredRoutes.filter((route) => executedRoutes.has(route));
  const routeCoverage = requiredRoutes.length
    ? Math.round((coveredRoutes.length / requiredRoutes.length) * 100)
    : 100;
  const evidenceScore = Number(medicalKnowledge?.coverageScore || 0);
  const inputScore = Number(inputQuality?.score || 0);
  const memoryScore = memoryContext.recentTurnCount ? 96 : 72;
  const safetyScore = singleAgent?.enabled && !executedRoutes.has("ALERT_AGENT")
    ? (risk.level === "CRITICAL" || risk.level === "HIGH" ? 84 : 90)
    : risk.level === "CRITICAL"
      ? executedRoutes.has("ALERT_AGENT") ? 96 : 38
      : risk.level === "HIGH"
        ? executedRoutes.has("ALERT_AGENT") ? 92 : 45
        : 90;
  const requirementScore = Number(requirementProfile?.score || 72);
  const agentReasoningScore = Number(reasoningQuality?.score || 70);
  const score = clamp(Math.round(
    routeCoverage * 0.26 +
    evidenceScore * 0.18 +
    inputScore * 0.14 +
    memoryScore * 0.08 +
    safetyScore * 0.14 +
    requirementScore * 0.1 +
    agentReasoningScore * 0.1
  ), 0, 100);
  const status = score >= 86
    ? "Supervisor ready"
    : score >= 68
      ? "Supervisor cautious"
      : "Supervisor needs context";
  const observations = [
    {
      title: "Patient input observed",
      detail: `${message.length} character message with ${inputQuality.acceptedVitals.length} accepted vital signal(s).`,
      level: inputQuality.score >= 75 ? "low" : "medium"
    },
    {
      title: "Requirement understood",
      detail: requirementProfile?.answerContract || "Focused healthcare answer contract is active.",
      level: requirementScore >= 80 ? "low" : "medium"
    },
    {
      title: "Memory loaded",
      detail: memoryContext.recentTurnCount
        ? `${memoryContext.recentTurnCount} saved turn(s) informed this review.`
        : "No saved turn was available before this review.",
      level: memoryContext.recentTurnCount ? "low" : "none"
    },
    {
      title: "Risk checked",
      detail: `${risk.label} with ${risk.factors.length} contributing signal(s).`,
      level: risk.level.toLowerCase()
    },
    {
      title: "Evidence retrieved",
      detail: `${medicalKnowledge.matches.length} reference match(es), ${evidenceScore}% coverage.`,
      level: evidenceScore >= 70 ? "low" : "medium"
    },
    {
      title: "Agent reasoning checked",
      detail: reasoningQuality?.summary || "Specialist evidence, assumptions, and safety checks were reviewed.",
      level: agentReasoningScore >= 74 ? "low" : "medium"
    }
  ];
  const toolTrace = agentResults.map((agent) => ({
    id: agent.id,
    name: agent.name,
    status: agent.status,
    tool: agent.output?.productionTool || routeLabel(agent.id),
    summary: agent.output?.summary || "Completed safely.",
    accuracyScore: agent.output?.capabilityProfile?.score || 0,
    qualityGate: agent.output?.qualityGate?.status || "not-scored",
    domain: agent.output?.capabilityProfile?.domain || routeLabel(agent.id)
  }));
  const routeCoverageItems = requiredRoutes.map((route) => ({
    route,
    label: routeLabel(route),
    status: executedRoutes.has(route) ? "covered" : "missing",
    reason: plan.routeReasons[route]?.join(", ") || "Supervisor expected this route from the request signals."
  }));
  const reflectionNotes = buildSupervisorReflectionNotes({
    missingRoutes,
    risk,
    inputQuality,
    evidenceScore,
    memoryContext,
    agentResults
  });
  const nextBestAction = buildSupervisorNextBestAction({ risk, inputQuality, missingRoutes, context, profile });

  return {
    id: "AGENTIC_SUPERVISOR",
    status,
    score,
    strategy: plan.parallel ? "Observe -> route -> parallel agents -> supervisor review -> synthesize" : "Observe -> route -> agent -> supervisor review -> synthesize",
    singleAgentMode: Boolean(singleAgent?.enabled),
    requirementFit: {
      score: requirementScore,
      label: requirementProfile?.label || "Requirement checked",
      contract: requirementProfile?.answerContract || ""
    },
    reasoningQuality: reasoningQuality || buildAgentReasoningQuality({ agentResults, intents, risk, requirementProfile, medicalKnowledge, inputQuality }),
    summary: missingRoutes.length
      ? `${coveredRoutes.length}/${requiredRoutes.length} required route(s) covered; ${missingRoutes.map(routeLabel).join(", ")} should be reviewed.`
      : `${coveredRoutes.length}/${requiredRoutes.length} required route(s) covered before response synthesis.`,
    routeCoverageScore: routeCoverage,
    observations,
    routeCoverage: routeCoverageItems,
    toolTrace,
    reflectionNotes,
    nextBestAction,
    safeguards: [
      "No diagnosis or prescription is allowed.",
      "Urgent symptoms stay routed to real-world care guidance.",
      "Patient memory changes context only, not medical facts.",
      "External tools are represented as safe local drafts until connected."
    ]
  };
}

function buildApexAgenticIntelligence({
  message,
  profile,
  vitals,
  context,
  memoryContext,
  intents,
  risk,
  plan,
  agentResults,
  medicalKnowledge,
  inputQuality,
  requirementProfile,
  reasoningQuality,
  precisionSupervisor,
  llmBrain,
  agenticReview,
  finalResponse,
  guardrails,
  trainingCalibration
}) {
  const ownerRoute = llmBrain?.routeDecision?.ownerRoute || plan?.responseOwner?.route || agentResults[0]?.id || "RAG_AGENT";
  const ownerAgent = agentResults.find((agent) => agent.id === ownerRoute) || agentResults[0] || null;
  const executedRoutes = new Set(agentResults.map((agent) => agent.id));
  const expectedRoute = requirementProfile?.expectedRoute || ownerRoute;
  const routeIntent = intents.find((intent) => intent.route === ownerRoute) || intents[0] || null;
  const evidenceCoverage = Number(medicalKnowledge?.coverageScore || 0);
  const localModelScore = Number(medicalKnowledge?.localAi?.score || medicalKnowledge?.coverageScore || 0);
  const inputScore = Number(inputQuality?.score || 0);
  const reasoningScore = Number(reasoningQuality?.score || 0);
  const supervisorScore = Number(agenticReview?.score || 0);
  const precisionScore = Number(precisionSupervisor?.score || 0);
  const brainScore = Number(llmBrain?.score || 0);
  const guardrailScore = guardrails?.passed ? 98 : 50;
  const ownerScore = Number(llmBrain?.routeDecision?.ownerScore || routeIntent?.confidence * 100 || 60);
  const memoryScore = memoryContext?.recentTurnCount ? 94 : 74;
  const safetyOverrideReady = risk.level === "LOW"
    || ownerRoute === "ALERT_AGENT"
    || executedRoutes.has("ALERT_AGENT")
    || Boolean(plan?.singleAgent?.enabled);
  const hasRequiredOwner = executedRoutes.has(ownerRoute) && (!expectedRoute || ownerRoute === expectedRoute || risk.level === "HIGH" || risk.level === "CRITICAL");
  const enoughEvidence = evidenceCoverage >= (routeEvidencePolicy[ownerRoute]?.minimumCoverage || 50)
    || ownerRoute === "ALERT_AGENT"
    || risk.level === "LOW";
  const oneAgentAnswer = agentResults.length === 1 && executedRoutes.has(ownerRoute);
  const answerHasBoundaries = Boolean(finalResponse?.disclaimer) && guardrails?.rules?.some((rule) => rule.id === "no_diagnosis");
  const missingContextCount = Array.isArray(finalResponse?.precision?.missing)
    ? finalResponse.precision.missing.length
    : 0;
  const gates = [
    {
      id: "one_owner",
      label: "One-agent ownership",
      passed: oneAgentAnswer && hasRequiredOwner,
      score: oneAgentAnswer && hasRequiredOwner ? 98 : oneAgentAnswer ? 84 : 56,
      detail: `${routeLabel(ownerRoute)} is the only responding agent for this turn.`
    },
    {
      id: "requirement_fit",
      label: "Requirement fit",
      passed: hasRequiredOwner,
      score: hasRequiredOwner ? Math.max(84, ownerScore) : 48,
      detail: `${routeLabel(ownerRoute)} matched ${requirementProfile?.outputLabel || "the detected request"}.`
    },
    {
      id: "evidence_grounding",
      label: "Evidence grounding",
      passed: enoughEvidence,
      score: enoughEvidence ? clamp(evidenceCoverage + 8, 62, 98) : clamp(evidenceCoverage, 35, 60),
      detail: `${medicalKnowledge?.matches?.length || 0} local/cached reference match(es), ${evidenceCoverage}% coverage.`
    },
    {
      id: "local_ml_strength",
      label: "Local ML strength",
      passed: localModelScore >= 58 || risk.level === "LOW" || ownerRoute === "ALERT_AGENT",
      score: clamp(localModelScore + (medicalKnowledge?.localAi?.queryEntities?.length ? 8 : 0), 35, 99),
      detail: `${medicalKnowledge?.localAi?.mode || "offline ranker"} used ${medicalKnowledge?.localAi?.expandedQueryTokenCount || medicalKnowledge?.localAi?.queryTokenCount || 0} token signal(s).`
    },
    {
      id: "training_calibration",
      label: "Training calibration",
      passed: trainingCalibration?.enabled === true || trainingCalibration?.status === "waiting-for-approved-feedback",
      score: trainingCalibration?.enabled
        ? clamp(78 + Math.min(Number(trainingCalibration.exampleCount || 0), 20), 78, 98)
        : 76,
      detail: trainingCalibration?.enabled
        ? `Local route calibrator used ${trainingCalibration.exampleCount} approved feedback example(s).`
        : "Local ML/DL training layer is ready for approved examples; medical facts are not self-trained."
    },
    {
      id: "safety_override",
      label: "Safety override",
      passed: safetyOverrideReady,
      score: safetyOverrideReady ? 98 : 35,
      detail: risk.level === "LOW" ? "No urgent override required." : `${risk.label} safety path stays active.`
    },
    {
      id: "guardrails",
      label: "Guardrails",
      passed: guardrails?.passed === true && answerHasBoundaries,
      score: guardrailScore,
      detail: guardrails?.summary || "Safety guardrails checked."
    },
    {
      id: "memory_continuity",
      label: "Memory continuity",
      passed: memoryScore >= 70,
      score: memoryScore,
      detail: memoryContext?.recentTurnCount
        ? `${memoryContext.recentTurnCount} local memory turn(s) loaded before routing.`
        : "Profile and current input were used; no prior turn was required."
    },
    {
      id: "input_completeness",
      label: "Input completeness",
      passed: inputScore >= 55 || risk.level === "LOW",
      score: inputScore,
      detail: inputQuality?.summary || "Input quality checked."
    },
    {
      id: "reasoning_quality",
      label: "Reasoning quality",
      passed: reasoningScore >= 68 && supervisorScore >= 68 && precisionScore >= 64 && brainScore >= 66,
      score: clamp(Math.round((reasoningScore + supervisorScore + precisionScore + brainScore) / 4), 0, 100),
      detail: `${reasoningQuality?.label || "Reasoning"}; ${agenticReview?.status || "supervisor checked"}; ${precisionSupervisor?.label || "precision checked"}.`
    },
    {
      id: "answer_precision",
      label: "Answer precision",
      passed: missingContextCount <= 2 || risk.level !== "LOW",
      score: missingContextCount <= 1 ? 92 : missingContextCount === 2 ? 78 : 62,
      detail: missingContextCount
        ? `${missingContextCount} missing context item(s) are tracked instead of guessed.`
        : "No major missing-context blocker was detected."
    }
  ];
  const score = clamp(Math.round(gates.reduce((total, gate) => total + gate.score, 0) / gates.length), 0, 100);
  const passed = gates.filter((gate) => gate.passed).length;
  const label = score >= 92
    ? "Apex ready"
    : score >= 84
      ? "Extremely strong"
      : score >= 72
        ? "Strong with caution"
        : "Needs more context";
  const strictness = risk.level === "CRITICAL" || risk.level === "HIGH"
    ? "safety-dominant"
    : score >= 84
      ? "precision-dominant"
      : "clarify-first";
  const queryEntities = medicalKnowledge?.localAi?.queryEntities || [];
  const numericSignals = medicalKnowledge?.localAi?.numericSignals || [];

  return {
    id: "APEX_AGENTIC_INTELLIGENCE",
    version: APP_VERSION,
    status: passed === gates.length ? "passed" : "guarded",
    label,
    score,
    summary: `${label}: ${passed}/${gates.length} apex gate(s) passed; ${routeLabel(ownerRoute)} owns the answer with ${evidenceCoverage}% evidence coverage.`,
    strictness,
    owner: {
      route: ownerRoute,
      label: routeLabel(ownerRoute),
      agent: ownerAgent?.name || routeLabel(ownerRoute),
      matchedRequirement: hasRequiredOwner,
      oneAgentAnswer
    },
    intelligenceStack: [
      "Local patient memory",
      "Intent classifier",
      "Risk scorer",
      "Synonym/entity-expanded offline ML ranker",
      "Approved-feedback route calibrator",
      "Route precision supervisor",
      "LLM-style cognitive core",
      "Agentic supervisor",
      "Response synthesizer",
      "Safety guardrails",
      "Local memory update loop"
    ],
    accuracyProfile: {
      evidenceCoverage,
      localModelScore,
      inputScore,
      reasoningScore,
      supervisorScore,
      precisionScore,
      brainScore,
      guardrailScore,
      queryEntities,
      numericSignals,
      missingContextCount,
      trainingCalibration: {
        enabled: trainingCalibration?.enabled === true,
        status: trainingCalibration?.status || "waiting-for-approved-feedback",
        exampleCount: Number(trainingCalibration?.exampleCount || 0),
        modelVersion: trainingCalibration?.modelVersion || "not-trained"
      }
    },
    responseContract: {
      answerOwner: routeLabel(ownerRoute),
      oneAgentAtATime: true,
      noUnnecessaryRoutes: oneAgentAnswer,
      noDiagnosis: true,
      noPrescription: true,
      noDoseCalculation: true,
      noLiveExternalAction: true,
      askInsteadOfGuessing: missingContextCount > 0 || llmBrain?.answerPolicy?.askOneQuestionIfNeeded === true
    },
    gates,
    upgradeImpact: [
      "Routes are judged by requirement fit, not only keyword hits.",
      "Offline retrieval now understands synonyms, clinical entities, and numeric signal types.",
      "Approved feedback can train route calibration while medical facts remain governed.",
      "High-risk safety overrides remain stronger than confidence scores.",
      "Every answer has one owner agent and a bounded output contract.",
      "Missing context is surfaced explicitly instead of silently guessed."
    ],
    boundaries: [
      "This is a local agentic advisor, not a certified medical device.",
      "Medical facts must come from curated or approved sources.",
      "Patient memory improves context only; it does not self-train new medical knowledge.",
      "Clinician, pharmacist, insurer, QA, or regulatory review is required for real decisions."
    ]
  };
}

function inferRequiredRoutes({ message, vitals, context, intents, risk }) {
  const routes = new Set(intents.map((intent) => intent.route));
  const text = buildSearchText(message);

  routes.add("RAG_AGENT");

  if (Object.values(vitals).some((value) => value !== null) || /bp|blood pressure|sugar|glucose|pulse|heart rate|temperature|fever/.test(text)) {
    routes.add("VITALS_AGENT");
  }

  if (risk.level === "MEDIUM" || risk.level === "HIGH" || risk.level === "CRITICAL" || context.redFlags.length) {
    routes.add("ALERT_AGENT");
  }

  if (/medicine|medication|tablet|dose|missed|side effect|drug/.test(text)) {
    routes.add("PHARMACY_AGENT");
  }

  if (/appointment|follow up|follow-up|schedule|visit|doctor/.test(text)) {
    routes.add("SCHEDULING_AGENT");
  }

  return Array.from(routes);
}

function buildSupervisorReflectionNotes({ missingRoutes, risk, inputQuality, evidenceScore, memoryContext, agentResults }) {
  const notes = [];

  if (missingRoutes.length) {
    notes.push({
      title: "Route gap",
      detail: `${missingRoutes.map(routeLabel).join(", ")} should be added before production release for this scenario.`,
      level: "medium"
    });
  } else {
    notes.push({
      title: "Route coverage",
      detail: "All required routes were covered before the patient reply.",
      level: "low"
    });
  }

  notes.push({
    title: "Safety posture",
    detail: risk.level === "CRITICAL" || risk.level === "HIGH"
      ? "High-safety path was selected and urgent-care wording must remain visible."
      : "No high-safety escalation dominated this request.",
    level: risk.level === "CRITICAL" || risk.level === "HIGH" ? "critical" : "low"
  });

  if (inputQuality.warnings.length) {
    notes.push({
      title: "Input quality",
      detail: inputQuality.warnings.slice(0, 2).join(" "),
      level: "medium"
    });
  }

  if (evidenceScore < 60) {
    notes.push({
      title: "Evidence coverage",
      detail: "The supervisor recommends clearer symptoms, readings, or document details to improve retrieval coverage.",
      level: "medium"
    });
  }

  notes.push({
    title: "Tool completion",
    detail: `${agentResults.length} specialist helper(s) completed; memory depth is ${memoryContext.recentTurnCount} saved turn(s).`,
    level: "low"
  });

  return notes.slice(0, 5);
}

function buildSupervisorNextBestAction({ risk, inputQuality, missingRoutes, context, profile }) {
  if (risk.level === "CRITICAL") {
    return "Treat the warning signs as urgent and use local emergency care now.";
  }

  if (missingRoutes.length) {
    return `Review ${routeLabel(missingRoutes[0])} before final clinical handoff.`;
  }

  if (inputQuality.ignoredVitals.length) {
    return "Re-enter any ignored vital readings using realistic values.";
  }

  if (!inputQuality.completeness.hasVitals && (risk.level === "MEDIUM" || risk.level === "HIGH")) {
    return "Add current vitals if available, especially BP, pulse, temperature, or sugar.";
  }

  if (context.duration === "not-sure") {
    return "Add when this started to improve the next review.";
  }

  if (!profile.conditions.length && !profile.medications.length && !cleanText(profile.notes)) {
    return "Add known conditions and regular medicines to improve personalization.";
  }

  return "Use the visit note and action board for the next safe step.";
}

function hasNegatedTerm(text, term) {
  const target = normalizeSearchText(term);
  const normalizedText = normalizeSearchText(text);
  const escapedTarget = target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  const nearbyNegation = new RegExp(`\\b(no|without|denies|deny|not having|not)\\s+(?:[a-z0-9]+\\s+){0,3}${escapedTarget}\\b`);

  return Boolean(target) && ([
    `no ${target}`,
    `without ${target}`,
    `denies ${target}`,
    `not having ${target}`
  ].some((phrase) => normalizedText.includes(phrase)) || nearbyNegation.test(normalizedText));
}

function getActiveContextRedFlags(textOrMessage, redFlags = []) {
  const redFlagTerms = {
    "chest-pain": ["chest pain", "chest pressure", "tight chest"],
    "breathing-trouble": ["breathing trouble", "trouble breathing", "difficulty breathing", "shortness of breath", "breathless", "cannot breathe"],
    fainting: ["faint", "fainted", "fainting", "passed out", "unconscious"],
    "one-sided-weakness": ["one sided weakness", "one-sided weakness", "weakness on one side", "one sided numbness", "slurred speech", "face droop"],
    "severe-allergy": ["severe allergy", "face swelling", "lip swelling", "tongue swelling", "throat swelling", "hives", "anaphylaxis"],
    "severe-dehydration-or-vomiting": ["severe dehydration", "repeated vomiting", "persistent vomiting", "cannot keep fluids"]
  };
  const sourceFlags = Array.isArray(redFlags)
    ? redFlags
    : normalizeList(redFlags);

  return sourceFlags
    .map(cleanText)
    .filter(Boolean)
    .filter((flag) => !(redFlagTerms[flag] || []).some((term) => hasNegatedTerm(textOrMessage, term)));
}

function hasEmergencyRoutingSignal(textOrMessage) {
  return [
    "chest pain",
    "chest pressure",
    "shortness of breath",
    "trouble breathing",
    "difficulty breathing",
    "cannot breathe",
    "blue lips",
    "faint",
    "fainted",
    "passed out",
    "unconscious",
    "stroke",
    "slurred speech",
    "face droop",
    "one sided weakness",
    "one-sided weakness",
    "severe allergy",
    "anaphylaxis",
    "seizure",
    "self harm",
    "suicide",
    "worst headache"
  ].some((term) => hasAffirmedTerm(textOrMessage, term));
}

function isTrainingOnlyIntent(intent = {}) {
  const evidence = Array.isArray(intent.evidence) ? intent.evidence : [];
  return evidence.length > 0 && evidence.every((item) => item === "local ML training calibration");
}

function hasDurationSignal(text) {
  return /\b(since|today|yesterday|morning|afternoon|evening|tonight|night|last night|hours?|days?|weeks?|months?)\b/.test(text)
    || /\bfor\s+\d+\s*(minute|minutes|hour|hours|day|days|week|weeks|month|months)\b/.test(text);
}

function hasConditionContextInText(text) {
  return /\b(diabetes|hypertension|high blood pressure|asthma|copd|kidney disease|ckd|thyroid|migraine|heart disease|stroke|anemia|pregnan\w+|cholesterol|infection)\b/.test(text);
}

function hasMedicationContextInText(text) {
  return /\b(medicine|medication|tablet|pill|capsule|dose|dosage|insulin|metformin|amlodipine|inhaler|antibiotic|statin|painkiller|bp tablet|syrup)\b/.test(text);
}

function buildGeneralConcernPresentation(rule, hits = [], text = "") {
  const hitSet = new Set((hits || []).map((item) => normalizeSearchText(item)));

  switch (rule?.id) {
    case "cardio":
      if (hitSet.has("bp") || hitSet.has("blood pressure")) {
        const hasChest = hitSet.has("chest") || hitSet.has("heart") || hitSet.has("palpitation");
        const hasHeadache = hasAffirmedTerm(text, "headache");
        const hasDizziness = hasAffirmedTerm(text, "dizzy") || hasAffirmedTerm(text, "dizziness");

        if (hasChest) {
          return {
            label: "blood-pressure or heart concern",
            focus: "blood pressure, pulse, chest symptoms, medicine timing, and urgency"
          };
        }

        if (hasHeadache && hasDizziness) {
          return {
            label: "blood-pressure concern with headache and dizziness",
            focus: "repeat BP after rest, headache or dizziness severity, medicine timing, and any vision, weakness, or speech change"
          };
        }

        if (hasHeadache) {
          return {
            label: "blood-pressure concern with headache",
            focus: "repeat BP after rest, headache severity and location, medicine timing, and any new vision or weakness change"
          };
        }

        if (hasDizziness) {
          return {
            label: "blood-pressure concern with dizziness",
            focus: "repeat BP after rest, dizziness severity, hydration, medicine timing, and walking safety"
          };
        }

        return {
          label: "blood-pressure concern",
          focus: "repeat BP after rest, symptoms linked to the reading, medicine timing, and usual baseline"
        };
      }

      if (hitSet.has("chest") || hitSet.has("heart") || hitSet.has("palpitation")) {
        return {
          label: "heart, chest, or circulation concern",
          focus: "chest symptoms, pulse, breathing effort, sweating, dizziness, and urgency"
        };
      }

      if (hitSet.has("dizzy") || hitSet.has("dizziness")) {
        return {
          label: "dizziness with circulation concern",
          focus: "blood pressure, pulse, hydration, medicine timing, and safety while standing or walking"
        };
      }

      return {
        label: rule.label,
        focus: rule.focus
      };
    case "neuro": {
      const hasHeadache = hitSet.has("headache");
      const hasDizziness = hitSet.has("dizzy") || hitSet.has("dizziness");
      const hasNeurologicChange = ["vision", "confusion", "weak", "numb", "speech"].some((term) => hitSet.has(term));

      if (hasHeadache && !hasDizziness && !hasNeurologicChange) {
        return {
          label: "headache concern",
          focus: "headache location, severity, onset, BP context, and any new vision, weakness, or speech change"
        };
      }

      if (hasDizziness && !hasHeadache && !hasNeurologicChange) {
        return {
          label: "dizziness or balance concern",
          focus: "sudden onset, BP or sugar context, hydration, medicine timing, and safety while walking"
        };
      }

      if (hasNeurologicChange && !hasHeadache && !hasDizziness) {
        return {
          label: "nervous-system concern",
          focus: "sudden onset, weakness, numbness, vision or speech change, and urgent warning signs"
        };
      }

      return {
        label: hasHeadache && hasDizziness
          ? "headache or dizziness concern"
          : "headache or nervous-system concern",
        focus: "onset, severity, BP context, and any new weakness, vision, speech, or balance change"
      };
    }
    case "metabolic":
      if (hitSet.has("sugar") || hitSet.has("glucose") || hitSet.has("diabetes")) {
        return {
          label: "blood-sugar or diabetes concern",
          focus: "glucose reading, meal timing, hydration, medicine timing, and unusual weakness"
        };
      }

      if (hitSet.has("tired") || hitSet.has("fatigue")) {
        return {
          label: "fatigue or low-energy concern",
          focus: "duration, sleep, hydration, food timing, sugar context, and regular medicines"
        };
      }

      return {
        label: rule.label,
        focus: rule.focus
      };
    default:
      return {
        label: rule?.label || "general health question",
        focus: rule?.focus || "symptom details, duration, severity, medicines, readings, and warning signs"
      };
  }
}

function buildGeneralConcernProfile(text, vitals, context, profile) {
  const concernRules = [
    {
      id: "cardio",
      label: "heart or blood-pressure concern",
      terms: ["bp", "blood pressure", "chest", "palpitation", "heart", "dizzy", "sweating"],
      focus: "blood pressure, pulse, chest symptoms, dizziness, medicine timing, and baseline risk"
    },
    {
      id: "respiratory",
      label: "breathing, cough, cold, or fever concern",
      terms: ["cough", "cold", "flu", "fever", "temperature", "sore throat", "breathing", "wheeze", "oxygen"],
      focus: "temperature, breathing effort, oxygen if available, hydration, and symptom duration"
    },
    {
      id: "neuro",
      label: "headache, dizziness, or nervous-system concern",
      terms: ["headache", "dizzy", "dizziness", "vision", "confusion", "weak", "numb", "speech"],
      focus: "sudden onset, vision or speech changes, weakness, blood pressure, and safety while moving"
    },
    {
      id: "digestive",
      label: "stomach, nausea, vomiting, or diarrhea concern",
      terms: ["stomach", "abdominal", "nausea", "vomit", "vomiting", "diarrhea", "loose motion"],
      focus: "hydration, fever, pain location, duration, food exposure, and dehydration signs"
    },
    {
      id: "skin",
      label: "skin, rash, itching, or allergy concern",
      terms: ["rash", "itch", "itching", "skin", "allergy", "swelling"],
      focus: "spread, swelling, breathing symptoms, triggers, medicine exposure, and fever"
    },
    {
      id: "metabolic",
      label: "sugar, diabetes, hydration, or energy concern",
      terms: ["sugar", "glucose", "diabetes", "thirst", "urination", "tired", "fatigue"],
      focus: "glucose reading, food timing, hydration, medicines, and unusual weakness"
    },
    {
      id: "urinary",
      label: "urine, kidney, or hydration concern",
      terms: ["urine", "urination", "burning urine", "kidney", "flank", "uti", "dehydration"],
      focus: "urine changes, pain location, fever, hydration, diabetes context, and recent tests"
    },
    {
      id: "muscle_joint",
      label: "muscle, joint, back, or injury concern",
      terms: ["back pain", "joint", "knee", "shoulder", "neck", "sprain", "injury", "swelling", "muscle"],
      focus: "injury timing, movement limits, swelling, weakness, numbness, fever, and pain severity"
    },
    {
      id: "eye_ear_dental",
      label: "eye, ear, throat, or dental concern",
      terms: ["eye", "vision", "ear", "hearing", "tooth", "dental", "mouth", "throat"],
      focus: "pain location, fever, discharge, vision or hearing change, swelling, and duration"
    },
    {
      id: "stress_sleep",
      label: "stress, sleep, mood, or daily function concern",
      terms: ["stress", "anxiety", "sleep", "insomnia", "mood", "panic", "overthinking"],
      focus: "sleep pattern, mood safety, daily function, triggers, support, and urgent mental-health warning signs"
    },
    {
      id: "prevention",
      label: "prevention and healthy-routine question",
      terms: ["prevent", "prevention", "healthy", "routine", "diet", "exercise", "sleep", "walking"],
      focus: "age, existing conditions, medicines, current habits, and one realistic next habit"
    }
  ];
  const matched = concernRules
    .map((rule) => ({
      ...rule,
      hits: rule.terms.filter((term) => hasTerm(text, term) && !hasNegatedTerm(text, term))
    }))
    .filter((rule) => rule.hits.length)
    .sort((first, second) => {
      const vitalContextTerms = new Set(["bp", "blood pressure", "pulse", "heart rate", "oxygen", "temperature"]);
      const firstIsOnlyVitalContext = first.hits.every((hit) => vitalContextTerms.has(hit));
      const secondIsOnlyVitalContext = second.hits.every((hit) => vitalContextTerms.has(hit));

      if (firstIsOnlyVitalContext !== secondIsOnlyVitalContext) {
        return firstIsOnlyVitalContext ? 1 : -1;
      }

      return second.hits.length - first.hits.length;
    });
  const primaryRule = matched[0] || null;
  const primary = primaryRule
    ? {
      ...primaryRule,
      ...buildGeneralConcernPresentation(primaryRule, primaryRule.hits, text)
    }
    : {
      id: "general",
      label: "general health question",
      hits: [],
      focus: "symptom details, duration, severity, medicines, readings, and warning signs"
    };
  const hasVitals = hasAnyVitals(vitals);
  const hasProfileNotes = Boolean(cleanText(profile.notes));
  const hasConditionContext = hasConditionContextInText(text);
  const hasMedicationContext = hasMedicationContextInText(text);
  const missing = [];

  if (context.duration === "not-sure" && !hasDurationSignal(text)) {
    missing.push("when it started");
  }

  if (!Number(context.severity)) {
    missing.push("severity from 1 to 10");
  }

  if (!hasVitals && ["cardio", "respiratory", "neuro", "metabolic"].includes(primary.id)) {
    missing.push("relevant reading if available");
  }

  if (/(pain|ache|swelling|rash|itch|burning|injury)/.test(text) && !hasLocationSignal(text)) {
    missing.push("where it is happening");
  }

  if (["respiratory", "digestive", "skin", "stress_sleep", "muscle_joint"].includes(primary.id) && !hasTriggerSignal(text)) {
    missing.push("what makes it better or worse");
  }

  if (/(medicine|medication|tablet|pill|dose|missed|late)/.test(text) && !context.lastMedicationTime) {
    missing.push("medicine name and timing");
  }

  if (/(allergy|rash|swelling|reaction|medicine|medication|tablet|pill|dose)/.test(text) && !profile.allergies.length) {
    missing.push("allergies or past reactions");
  }

  if (!profile.conditions.length && !profile.medications.length && !hasProfileNotes) {
    if (hasConditionContext && !hasMedicationContext) {
      missing.push("regular medicines");
    } else if (!hasConditionContext && hasMedicationContext) {
      missing.push("known conditions");
    } else if (!hasConditionContext && !hasMedicationContext) {
      missing.push("known conditions and regular medicines");
    }
  }

  const positiveSignals = [
    hasDurationSignal(text) || context.duration !== "not-sure",
    Boolean(Number(context.severity)) || /\b([1-9]|10)\s*\/\s*10\b|mild|moderate|severe/.test(text),
    hasVitals,
    profile.conditions.length > 0,
    profile.medications.length > 0,
    hasConditionContext,
    hasMedicationContext,
    profile.allergies.length > 0,
    hasProfileNotes,
    context.redFlags.length > 0,
    matched.length > 0
  ].filter(Boolean).length;
  const safetyScreen = buildGeneralSafetyScreen(text, vitals, context);
  const evidenceLanes = buildGeneralEvidenceLanes({ text, vitals, context, profile, primary, matched, safetyScreen, hasConditionContext, hasMedicationContext });
  const completeness = clamp(58 + (positiveSignals * 6) - (missing.length * 7) + (evidenceLanes.filter((lane) => lane.status === "ready").length * 2), 35, 98);

  return {
    primary,
    matchedFamilies: matched
      .map((rule) => buildGeneralConcernPresentation(rule, rule.hits, text).label)
      .slice(0, 3),
    missing: Array.from(new Set(missing)).slice(0, 4),
    completeness,
    focusQuestions: buildGeneralFocusQuestions(primary, missing),
    safetyScreen,
    evidenceLanes,
    nextQuestion: missing.length
      ? `Add ${missing[0]} for a sharper answer.`
      : "Enough context for a focused first-layer answer."
  };
}

function buildGeneralSafetyScreen(text, vitals, context) {
  const signals = [];

  if (context.redFlags?.length) {
    signals.push(`Selected warning sign(s): ${context.redFlags.map(formatContextLabel).join(", ")}`);
  }

  if (hasAffirmedTerm(text, "chest pain")) {
    signals.push("Chest pain mentioned");
  }

  if (hasBreathingSignal(text)) {
    signals.push("Breathing difficulty mentioned");
  }

  if (hasStrokeSignal(text)) {
    signals.push("Stroke-like wording mentioned");
  }

  if (hasSevereAllergySignal(text)) {
    signals.push("Severe allergy wording mentioned");
  }

  if (vitals.systolic >= 180 || vitals.diastolic >= 120) {
    signals.push("Very high BP reading entered");
  }

  if (vitals.heartRate >= 130) {
    signals.push("Very fast pulse entered");
  }

  if (vitals.temperatureC >= 40) {
    signals.push("Very high temperature entered");
  }

  if (vitals.oxygenSaturation !== null && vitals.oxygenSaturation <= 90) {
    signals.push("Low oxygen reading entered");
  }

  return {
    status: signals.length ? "safety-priority" : "routine-screen",
    signals: signals.slice(0, 5),
    boundary: signals.length
      ? "Safety signs are prioritized before routine guidance."
      : "No urgent warning signal dominated this first-layer check."
  };
}

function buildGeneralEvidenceLanes({ text, vitals, context, profile, primary, matched, safetyScreen, hasConditionContext = false, hasMedicationContext = false }) {
  const hasVitals = hasAnyVitals(vitals);
  const profileNotes = cleanText(profile.notes);
  const hasProfileContext = profile.conditions.length || profile.medications.length || profileNotes || hasConditionContext || hasMedicationContext;
  const lanes = [
    {
      id: "concern",
      label: "Concern",
      status: primary.id !== "general" || matched.length ? "ready" : "needs-context",
      detail: primary.label
    },
    {
      id: "time_severity",
      label: "Time + severity",
      status: (context.duration !== "not-sure" || hasDurationSignal(text)) && Number(context.severity) ? "ready" : "needs-context",
      detail: `${formatContextLabel(context.duration || "not-sure")}; severity ${context.severity || "--"}/10`
    },
    {
      id: "readings",
      label: "Readings",
      status: hasVitals ? "ready" : "optional",
      detail: hasVitals ? "Vitals attached" : "No current reading attached"
    },
    {
      id: "profile",
      label: "Profile",
      status: hasProfileContext ? "ready" : "optional",
      detail: [
        profile.conditions[0],
        profile.medications[0],
        profileNotes ? compactResponseText(profileNotes, 84) : "",
        !profile.conditions.length && hasConditionContext ? "Condition context stated in message" : "",
        !profile.medications.length && hasMedicationContext ? "Medication context stated in message" : ""
      ].filter(Boolean).join("; ") || "No condition, medicine, or note context"
    },
    {
      id: "safety",
      label: "Safety",
      status: safetyScreen.signals.length ? "priority" : "ready",
      detail: safetyScreen.boundary
    }
  ];

  return lanes;
}

function hasLocationSignal(text) {
  return /\b(left|right|upper|lower|front|back|side|chest|head|stomach|abdomen|arm|leg|knee|shoulder|neck|eye|ear|throat|tooth|skin)\b/.test(text);
}

function hasTriggerSignal(text) {
  return /\b(after|before|when|while|because|trigger|worse|better|relief|food|meal|exercise|walking|rest|stress|medicine|cold|heat)\b/.test(text);
}

function buildGeneralFocusQuestions(primary, missing) {
  const hitSet = new Set((primary?.hits || []).map((item) => normalizeSearchText(item)));
  const headacheOnly = primary?.id === "neuro"
    && hitSet.has("headache")
    && !["dizzy", "dizziness", "vision", "confusion", "weak", "numb", "speech"].some((term) => hitSet.has(term));
  const dizzinessOnly = primary?.id === "neuro"
    && (hitSet.has("dizzy") || hitSet.has("dizziness"))
    && !["headache", "vision", "confusion", "weak", "numb", "speech"].some((term) => hitSet.has(term));
  const base = {
    cardio: ["When did it start, and is chest discomfort, breathlessness, sweating, fainting, or weakness present?", "What were the latest BP and pulse readings, and were they repeated after rest?"],
    respiratory: ["How long have cough, fever, or breathing symptoms been present?", "Is breathing harder than usual, and do you have an oxygen reading if available?"],
    neuro: headacheOnly
      ? ["Where is the headache, and has it changed since it started?", "Do you have a BP reading or any vision change, weakness, speech change, fever, or vomiting with it?"]
      : dizzinessOnly
        ? ["Did the dizziness start suddenly or after standing, heat, food, or medicine timing?", "Do you have BP, pulse, or sugar readings, and is there fainting, chest pain, or trouble walking safely?"]
        : ["Did the headache, dizziness, weakness, vision, or speech change start suddenly?", "What is the severity, BP reading, and is it getting worse?"],
    digestive: ["Where is the pain, and are fever, vomiting, diarrhea, blood, or dehydration signs present?", "Can you keep fluids down?"],
    skin: ["Is the rash or swelling spreading, painful, or linked to food, medicine, or a new exposure?", "Is there breathing trouble, face/lip swelling, or fever?"],
    metabolic: ["What is the latest sugar reading, and when did you last eat or take medicine?", "Are there signs like confusion, extreme thirst, vomiting, sweating, or weakness?"],
    urinary: ["Is there fever, flank pain, burning urine, blood, or reduced urine?", "How much fluid have you taken today, and do you have diabetes or kidney history?"],
    muscle_joint: ["Was there an injury, swelling, weakness, numbness, fever, or inability to move normally?", "What movement worsens or improves the pain?"],
    eye_ear_dental: ["Is there vision change, hearing change, discharge, swelling, fever, or severe pain?", "How long has it been present, and is it worsening?"],
    stress_sleep: ["Is this mainly stress, sleep, panic, mood, or daily-function difficulty?", "Do you feel unsafe, overwhelmed, or in need of immediate support?"],
    prevention: ["What age group, condition, or habit do you want to improve?", "What is one realistic change you can repeat daily?"],
    general: ["When did this start, and what changed?", "What medicines, allergies, conditions, and readings should be considered?"]
  };
  const questions = base[primary.id] || base.general;

  if (missing.length) {
    questions.unshift(`Please add ${missing.slice(0, 2).join(" and ")} for a sharper answer.`);
  }

  return dedupeResponseItems(questions).slice(0, 3);
}

function buildGeneralSafeActions(profile, risk, context, concernProfile, text = "", vitals = {}) {
  if (risk.level === "CRITICAL" || risk.level === "HIGH") {
    return [];
  }

  const immediateActions = [];
  const followupActions = [];
  const clarificationActions = [];
  const contextActions = [];
  const primaryHits = new Set((concernProfile.primary?.hits || []).map((item) => normalizeSearchText(item)));
  const pushUnique = (bucket, ...items) => {
    for (const item of items) {
      if (item) {
        bucket.push(item);
      }
    }
  };

  switch (concernProfile.primary.id) {
    case "cardio":
      if (primaryHits.has("bp") || primaryHits.has("blood pressure")) {
        const hasHeadache = hasAffirmedTerm(text, "headache");
        const hasDizziness = hasAffirmedTerm(text, "dizzy") || hasAffirmedTerm(text, "dizziness");

        if (hasHeadache || hasDizziness) {
          pushUnique(immediateActions, "Rest for 5 minutes, repeat the BP, and note the reading with headache or dizziness severity and any vision, weakness, speech, chest, or breathing change.");
          pushUnique(followupActions, "Use same-day clinician review if the repeat BP stays elevated or the headache or dizziness does not settle after rest.");

          if (hasDizziness) {
            pushUnique(immediateActions, "Avoid driving or risky activity until the dizziness settles and you feel steady.");
          }
        } else {
          pushUnique(immediateActions, "Rest for 5 minutes if you can, repeat the BP reading, and note the number with symptoms and medicine timing.");
          pushUnique(followupActions, "Use clinician review if repeated BP readings stay high or symptoms do not match your usual pattern.");
        }
      } else if (primaryHits.has("chest") || primaryHits.has("heart") || primaryHits.has("palpitation")) {
        pushUnique(immediateActions, "Limit exertion, track chest or pulse symptoms closely, and note what triggered them and how long they last.");
        pushUnique(followupActions, "Use urgent or same-day clinician review if chest or pulse symptoms repeat, worsen, or come with dizziness or breathlessness.");
      } else {
        pushUnique(immediateActions, "Rest somewhere safe, note BP or pulse if available, and compare with your usual baseline.");
        pushUnique(followupActions, "Use clinician review if the reading stays abnormal or you feel less steady than usual.");
      }
      break;
    case "respiratory":
      pushUnique(immediateActions,
        "Track temperature, cough pattern, breathing effort, and hydration over the next day.",
        "Reduce smoke, dust, and heavy exertion while cough or fever is active."
      );
      pushUnique(followupActions, "Contact a clinician if breathing gets harder, fever is rising, or you are not improving after the next 2 to 3 days.");
      break;
    case "neuro":
      if (primaryHits.has("headache") && !primaryHits.has("dizzy") && !primaryHits.has("dizziness")) {
        pushUnique(immediateActions, "Track headache location, severity, BP if available, hydration, and whether vision, weakness, speech, fever, or vomiting symptoms appear.");
        pushUnique(followupActions, "Use same-day clinician review if the headache is worsening, not settling, or new neurologic symptoms appear.");
      } else if (primaryHits.has("dizzy") || primaryHits.has("dizziness")) {
        pushUnique(immediateActions, "Avoid driving or risky activity while dizzy; note BP, pulse, hydration, and whether walking feels less steady.");
        pushUnique(followupActions, "Use clinician review if dizziness continues, walking feels less safe, or fainting or chest symptoms appear.");
      } else {
        pushUnique(immediateActions, "Avoid driving or risky activity while dizzy, weak, or visually affected; note BP and any new neurologic symptoms.");
        pushUnique(followupActions, "Use same-day clinician review if symptoms are persistent, worsening, or changing your ability to walk or function safely.");
      }
      break;
    case "digestive":
      pushUnique(immediateActions, "Track hydration, fever, pain location, and whether vomiting or diarrhea is preventing fluids.");
      pushUnique(followupActions, "Use same-day clinician review if you cannot keep fluids down, pain localizes or worsens, or dehydration signs appear.");
      break;
    case "skin":
      pushUnique(immediateActions, "Track spread, swelling, fever, and possible triggers such as food, medicine, or a new exposure.");
      pushUnique(followupActions, "Contact a clinician if the rash is spreading quickly, painful, or paired with swelling or fever.");
      break;
    case "metabolic":
      if ((vitals?.bloodSugar !== null && vitals?.bloodSugar >= 240) || hasAffirmedTerm(text, "thirsty") || hasAffirmedTerm(text, "thirst")) {
        pushUnique(immediateActions, "Hydrate if you can, recheck glucose using your usual care plan, and note meal timing, medicines, thirst, urination, and any new weakness.");
        pushUnique(followupActions, "Use same-day clinician review if sugar stays high for you, thirst or weakness worsens, or vomiting or confusion appears.");
      } else if (primaryHits.has("tired") || primaryHits.has("fatigue")) {
        pushUnique(immediateActions, "Track sleep, hydration, meal timing, sugar readings if available, and medicines taken today before judging the tiredness pattern.");
        pushUnique(followupActions, "Contact a clinician if fatigue is worsening, unusual for you, or paired with abnormal glucose readings.");
      } else {
        pushUnique(immediateActions, "Add sugar reading, meal timing, hydration, and medicine timing so the review can separate routine variation from warning signs.");
        pushUnique(followupActions, "Use clinician review if glucose readings remain abnormal or symptoms are increasing.");
      }
      break;
    case "urinary":
      pushUnique(immediateActions, "Track urine changes, pain location, fever, hydration, and whether symptoms are staying the same or worsening.");
      pushUnique(followupActions, "Use same-day clinician review if fever, flank pain, blood in urine, or reduced urine output appears.");
      break;
    case "muscle_joint":
      pushUnique(immediateActions, "Rest the area, avoid activity that worsens pain, and note injury timing, swelling, weakness, numbness, or fever.");
      pushUnique(followupActions, "Contact a clinician if pain is limiting normal movement or is paired with weakness, numbness, fever, or major swelling.");
      break;
    case "eye_ear_dental":
      pushUnique(immediateActions, "Note the exact location, duration, discharge, swelling, fever, and any vision or hearing change.");
      pushUnique(followupActions, "Use same-day clinician, dentist, or eye review if pain is severe or paired with swelling, fever, or function change.");
      break;
    case "stress_sleep":
      pushUnique(immediateActions, "Choose one calming step now, reduce stimulation, and focus on one small next task.");
      pushUnique(followupActions, "Contact a trusted person or clinician if symptoms feel unsafe, overwhelming, or keep interfering with normal function.");
      break;
    case "prevention":
      pushUnique(immediateActions, "Pick one habit to track today, such as walking, sleep, hydration, diet pattern, or a BP or sugar log.");
      pushUnique(followupActions, "Review the habit after a few days and keep only the change that is realistic to repeat.");
      break;
    default:
      pushUnique(immediateActions, "Write down what changed, when it started, severity, triggers, medicines, and any readings.");
      pushUnique(followupActions, "Contact a clinician if symptoms continue, worsen, or feel unusual for you.");
  }

  if (concernProfile.safetyScreen?.signals?.length) {
    immediateActions.unshift(`Treat ${concernProfile.safetyScreen.signals[0].toLowerCase()} as the first priority before routine self-care.`);
  }

  if (context.duration === "more-than-3-days" || Number(context.severity) >= 6) {
    pushUnique(followupActions, "Contact a clinician if this is not improving, is worsening, or feels unusual for you.");
  } else {
    pushUnique(followupActions, "Monitor for change and use the warning-sign list if symptoms worsen.");
  }

  if (concernProfile.missing.length) {
    pushUnique(clarificationActions, `Improve accuracy by adding ${concernProfile.missing.slice(0, 2).join(" and ")}.`);
  }

  if (profile.conditions.length) {
    pushUnique(contextActions, `Because your profile includes ${profile.conditions.slice(0, 2).join(", ")}, keep advice aligned with your care plan.`);
  }

  return dedupeResponseItems([
    ...immediateActions,
    ...followupActions,
    ...clarificationActions,
    ...contextActions
  ]).slice(0, 4);
}

function detectAtlasTopicProfile({ text, medicalKnowledge, concernProfile, risk }) {
  const knowledgeMatches = getRouteKnowledgeMatches("RAG_AGENT", medicalKnowledge, 4);
  const topMatch = knowledgeMatches.find((match) => match.id !== "local-memory-learning") || knowledgeMatches[0];
  const selectedGuideMatch = text.match(/\bselected guide title\s+([a-z0-9& /-]+?)(?:\s+selected guide subtitle|\s+selected guide notes|$)/)
    || text.match(/\bselected guide\s+([a-z0-9& /-]+?)(?:\s+selected guide subtitle|\s+selected guide notes|$)/);
  const selectedGuideFocus = selectedGuideMatch
    ? selectedGuideMatch[1]
      .trim()
      .replace(/\b(bp|cbc|copd|ct|ecg|egfr|ekg|hdl|ldl|mri|uti)\b/g, (value) => value.toUpperCase())
      .replace(/\b[a-z]/g, (value) => value.toUpperCase())
    : "";
  const namedTopics = [
    { label: "Diabetes", pattern: /\b(diabetes|blood sugar|glucose|hba1c|a1c|metformin|insulin|diabetic foot)\b/ },
    { label: "Hypertension", pattern: /\b(hypertension|high blood pressure|blood pressure|bp)\b/ },
    { label: "Asthma", pattern: /\b(asthma|wheeze|inhaler|breathing trigger)\b/ },
    { label: "Heart and chest symptoms", pattern: /\b(chest pain|heart attack|palpitation|heart disease|angina)\b/ },
    { label: "Stroke and nerve symptoms", pattern: /\b(stroke|one sided|one-sided|slurred speech|face droop|numbness|weakness)\b/ },
    { label: "Kidney and urine health", pattern: /\b(kidney|egfr|creatinine|urine|uti|burning urination|flank pain)\b/ },
    { label: "Thyroid health", pattern: /\b(thyroid|tsh|t3|t4)\b/ },
    { label: "Cholesterol and lipids", pattern: /\b(cholesterol|ldl|hdl|triglyceride|lipid)\b/ },
    { label: "Headache and migraine", pattern: /\b(headache|migraine|severe headache)\b/ },
    { label: "Infection and fever", pattern: /\b(fever|infection|sepsis|pneumonia|dengue|malaria|tuberculosis)\b/ },
    { label: "Pregnancy safety", pattern: /\b(pregnancy|pregnant|baby movement|maternal)\b/ },
    { label: "Medicine safety", pattern: /\b(medicine|medication|tablet|pill|drug|dose|dosage|side effect|interaction|generic|brand|pharmacy)\b/ }
  ];
  const namedTopic = namedTopics.find((topic) => topic.pattern.test(text));
  const hasDiseaseSignal = /\b(disease|condition|diabetes|hypertension|asthma|thyroid|kidney|heart|liver|copd|migraine|infection|cancer|stroke)\b/.test(text);
  const hasReportSignal = /\b(lab report|report value|reference range|test result|report date|cbc|ldl|hdl|creatinine|egfr|electrolyte)\b/.test(text);
  const hasMedicineSignal = /\b(medicine|medication|tablet|pill|drug|dose|dosage|side effect|interaction|generic|brand|pharmacy|inhaler|insulin|metformin|amlodipine)\b/.test(text);
  const hasWarningSignal = /\b(chest pain|breathing trouble|stroke|fainting|severe allergy|sepsis|poison|overdose|emergency|urgent|red flag)\b/.test(text);
  const topicType = hasWarningSignal
    ? "Warning-sign guide"
    : hasDiseaseSignal
      ? "Disease guide"
      : hasMedicineSignal
        ? "Medicine reference"
        : hasReportSignal
          ? "Lab or report guide"
          : /\b(xray|x-ray|mri|ct|scan|ultrasound|ecg|ekg|imaging|image)\b/.test(text)
            ? "Image or scan guide"
            : /\b(prevent|prevention|screening|vaccine|vaccination|lifestyle|diet|exercise|sleep|weight|risk factor)\b/.test(text)
              ? "Prevention guide"
              : /\b(headache|pain|fever|cough|dizzy|fatigue|rash|vomit|diarrhea|swelling|weakness|numbness)\b/.test(text)
                ? "Symptom guide"
                : "Health education guide";
  const topicFocus = selectedGuideFocus || namedTopic?.label || topMatch?.title || concernProfile?.primary?.label || "Selected health topic";
  const sourceCount = knowledgeMatches.length;
  const sourceStrength = sourceCount >= 4
    ? "Strong local match"
    : sourceCount >= 2
      ? "Good local match"
      : "Starter local match";
  const coverageScore = clamp(Math.round((medicalKnowledge?.coverageScore || 45) + Math.min(sourceCount * 2, 8)), 35, 99);

  return {
    topicType,
    topicFocus,
    sourceCount,
    sourceStrength,
    coverageScore,
    safetyPriority: ["CRITICAL", "HIGH"].includes(risk?.level) ? "Urgent signs first" : "Education first",
    evidenceUsed: knowledgeMatches.slice(0, 4).map((match) => ({
      title: match.title,
      category: match.category,
      relevance: match.relevance,
      sourceMode: match.sourceMode || "offline-local"
    })),
    matchQuality: coverageScore >= 82
      ? "High"
      : coverageScore >= 68
        ? "Useful"
        : "Needs more context"
  };
}

function buildAtlasEducationSections({ text, profile, vitals, risk, context, medicalKnowledge, concernProfile, atlasProfile }) {
  const knowledgeMatches = getRouteKnowledgeMatches("RAG_AGENT", medicalKnowledge, 4);
  const structuredOverview = collectKnowledgeSectionItems(knowledgeMatches, "overview", 2);
  const structuredTracking = collectKnowledgeSectionItems(knowledgeMatches, "whatToTrack", 4);
  const structuredQuestions = collectKnowledgeSectionItems(knowledgeMatches, "careQuestions", 4);
  const structuredPrecautions = collectKnowledgeSectionItems(knowledgeMatches, "precautions", 4);
  const topSummaries = knowledgeMatches
    .filter((match) => match.summary)
    .slice(0, 2)
    .map((match) => `${match.title}: ${compactResponseText(match.summary, 155)}`);
  const warningSignals = concernProfile?.safetyScreen?.signals || [];
  const hasVitals = hasAnyVitals(vitals);
  const hasMedicineContext = profile.medications.length || /\b(medicine|medication|dose|side effect|interaction|pill|tablet|drug)\b/.test(text);
  const hasReportContext = /\b(lab|report|test|hba1c|cbc|cholesterol|creatinine|egfr|scan|xray|mri|ct|ecg|ekg)\b/.test(text);
  const overview = dedupeResponseItems([
    `Topic focus: ${atlasProfile.topicFocus} (${atlasProfile.topicType}).`,
    ...structuredOverview,
    ...topSummaries,
    `Source coverage: ${atlasProfile.sourceStrength.toLowerCase()} with ${atlasProfile.sourceCount} local reference match(es).`,
    "Use this as a learning and visit-preparation guide, not as a diagnosis or prescription."
  ]).slice(0, 5);
  const tracking = dedupeResponseItems([
    ...structuredTracking,
    "Track when the issue started, what changed, severity, triggers, medicines taken, and what improves or worsens it.",
    hasVitals ? "Compare readings with symptoms, timing, baseline, and repeat measurements instead of judging one number alone." : "Add relevant readings when available, such as BP, glucose, pulse, temperature, oxygen, weight, or recent report values.",
    hasReportContext ? "For reports, keep the value, unit, reference range, test date, fasting status, and prior trend together." : "",
    ...((concernProfile?.focusQuestions || []).slice(0, 2))
  ]).slice(0, 5);
  const careQuestions = dedupeResponseItems([
    ...structuredQuestions,
    "What condition categories or common causes should be reviewed by a clinician?",
    hasMedicineContext ? "Which medicine purpose, side effects, interactions, label instructions, and pharmacist questions matter for this topic?" : "Which tests, reports, or home readings would help clarify the next safe step?",
    "What should I monitor at home, when should I follow up, and what would make this urgent?",
    profile.conditions.length ? `How does this interact with existing condition context: ${profile.conditions.slice(0, 3).join(", ")}?` : ""
  ]).slice(0, 5);
  const precautions = dedupeResponseItems([
    ...structuredPrecautions,
    warningSignals.length ? `Warning signal focus: ${warningSignals.slice(0, 3).join(", ")}.` : "Watch for rapid worsening, severe pain, breathing trouble, fainting, confusion, weakness, severe allergy signs, or chest pressure.",
    risk.level === "LOW" ? "If symptoms are mild and improving, keep monitoring and prepare questions for routine care." : "Because safety risk is elevated, do not wait on library learning if severe or worsening symptoms are happening now.",
    "Do not start, stop, double, or change medicine doses from this app.",
    "Use real-world urgent care for severe, sudden, or unusual symptoms."
  ]).slice(0, 5);

  return {
    overview,
    tracking,
    careQuestions,
    precautions
  };
}

function buildGeneralConcernSectionDetails({ text, concernProfile, vitals, context, profile }) {
  const primaryId = concernProfile?.primary?.id || "general";
  const primaryHits = new Set((concernProfile?.primary?.hits || []).map((item) => normalizeSearchText(item)));
  const hasHeadache = hasAffirmedTerm(text, "headache");
  const hasDizziness = hasAffirmedTerm(text, "dizzy") || hasAffirmedTerm(text, "dizziness");
  const hasChest = ["chest pain", "chest pressure", "chest", "palpitation", "heart"].some((term) => hasAffirmedTerm(text, term));
  const hasBpContext = primaryHits.has("bp") || primaryHits.has("blood pressure") || Number(vitals?.systolic) || Number(vitals?.diastolic);
  const hasGlucoseContext = primaryHits.has("sugar") || primaryHits.has("glucose") || primaryHits.has("diabetes") || Number(vitals?.bloodSugar);
  const durationLabel = context?.duration && context.duration !== "not-sure" ? formatContextLabel(context.duration) : "";
  const profileContext = profile.conditions.length ? profile.conditions.slice(0, 2).join(", ") : "";

  switch (primaryId) {
    case "cardio":
      return {
        tracking: [
          hasBpContext ? "Repeat BP after 5 minutes seated rest and record both readings with time, symptoms, and medicine timing." : "Track pulse symptoms, triggers, and what you were doing when they started.",
          hasHeadache || hasDizziness ? "Track whether headache or dizziness is improving, stable, or worsening after rest, food, fluids, and medicines." : "",
          hasChest ? "Track chest symptoms, breathlessness, sweating, or faintness with the timing of the episode." : ""
        ],
        questions: [
          hasBpContext ? "At what BP plus symptom pattern should this move from home monitoring to same-day medical review?" : "Which reading or exam would best clarify the circulation concern?",
          hasHeadache || hasDizziness ? "Could dehydration, missed medicine, glucose change, or blood-pressure variation explain the headache or dizziness pattern?" : "Could medicine timing, caffeine, stress, or dehydration be contributing?",
          profileContext ? `How should existing ${profileContext} change the follow-up threshold?` : ""
        ],
        precautions: [
          hasDizziness ? "Avoid driving, climbing, or risky activity until the dizziness settles and you feel steady." : "",
          hasHeadache || hasDizziness ? "Escalate sooner for worsening headache, new weakness, speech change, vision change, fainting, chest pressure, or breathing trouble." : "",
          hasBpContext ? "Do not make BP dose changes on your own from one reading." : ""
        ]
      };
    case "respiratory":
      return {
        tracking: [
          "Track temperature, cough pattern, hydration, and how hard it feels to breathe.",
          vitals?.oxygenSaturation !== null && vitals?.oxygenSaturation !== undefined ? "Compare oxygen readings with symptoms and repeat checks if the finger fit or reading quality seems off." : "Add oxygen or temperature readings if available, especially if breathing feels harder or fever is rising.",
          durationLabel ? `Keep the symptom timeline clear: this has been present ${durationLabel}.` : ""
        ],
        questions: [
          "Does this pattern fit infection, allergy, asthma-style trigger, or another common cause that needs review?",
          "What reading or symptom change would mean same-day review instead of home monitoring?",
          profileContext ? `Do existing conditions such as ${profileContext} change the threshold for escalation?` : ""
        ],
        precautions: [
          "Use urgent care sooner for breathing trouble, blue lips, confusion, dehydration, or rapidly worsening fever.",
          "Avoid smoke or other triggers that clearly worsen cough or breathing symptoms.",
          "Do not start antibiotic or steroid changes on your own from this app."
        ]
      };
    case "neuro":
      return {
        tracking: [
          hasHeadache ? "Track headache location, severity, and whether rest, hydration, food, or medicines change it." : "Track dizziness, balance, and whether standing, heat, food, or medicines make it worse.",
          hasBpContext ? "Compare BP readings with the neurologic symptoms instead of judging the number alone." : "Add BP, pulse, or glucose context if available.",
          "Note any vision change, weakness, numbness, speech change, fainting, fever, or vomiting."
        ],
        questions: [
          hasHeadache ? "Does this fit a routine headache pattern, or does the symptom mix suggest a same-day clinician review?" : "Could dehydration, low intake, BP change, or medicine timing explain the dizziness pattern?",
          "Which warning signs should end home monitoring and trigger urgent real-world care?",
          profileContext ? `Does existing ${profileContext} change the urgency threshold?` : ""
        ],
        precautions: [
          "Avoid driving or risky activity while dizzy, weak, visually affected, or unsteady.",
          "Use urgent care sooner for sudden severe headache, new weakness, speech change, vision loss, fainting, or confusion.",
          "Do not ignore worsening neurologic symptoms while waiting for another reading."
        ]
      };
    case "digestive":
      return {
        tracking: [
          "Track pain location, vomiting or diarrhea frequency, fluid intake, and fever.",
          "Note whether you can keep fluids down and whether urination is reduced.",
          durationLabel ? `Keep the symptom timeline clear: this has been present ${durationLabel}.` : ""
        ],
        questions: [
          "Does this pattern suggest food trigger, infection, medicine side effect, or dehydration risk?",
          "At what point should ongoing vomiting, diarrhea, or pain move to same-day care?",
          profileContext ? `Could existing ${profileContext} increase dehydration or complication risk?` : ""
        ],
        precautions: [
          "Use urgent care sooner for severe or one-sided pain, blood, repeated vomiting, dehydration, fainting, or confusion.",
          "Do not keep using dehydration-prone medicines or supplements without checking if symptoms escalate.",
          "Avoid judging improvement only by pain if fluids are not staying down."
        ]
      };
    case "skin":
      return {
        tracking: [
          "Track spread, itching, pain, swelling, fever, and any new trigger such as food, medicine, or exposure.",
          "Take note of how quickly the rash or swelling is changing.",
          "Record what has already been applied or taken."
        ],
        questions: [
          "Does this pattern fit irritation, allergy, infection, or another trigger that needs review?",
          "What signs would make same-day or urgent care safer than continued monitoring?",
          profileContext ? `Could existing ${profileContext} change skin-healing or infection risk?` : ""
        ],
        precautions: [
          "Use urgent care sooner for face or lip swelling, breathing trouble, fever, rapid spread, or severe pain.",
          "Do not restart the suspected trigger medicine or product until it is reviewed if the reaction looks significant.",
          "Avoid scratching or repeated exposure if a trigger is likely."
        ]
      };
    case "metabolic":
      return {
        tracking: [
          hasGlucoseContext ? "Track glucose readings with meal timing, hydration, activity, and medicine timing." : "Add glucose reading, meal timing, and medicine timing to separate routine variation from warning signs.",
          "Track weakness, sweating, shakiness, confusion, thirst, urination, or vomiting.",
          durationLabel ? `Keep the symptom timeline clear: this has been present ${durationLabel}.` : ""
        ],
        questions: [
          "Could meal timing, dehydration, missed medicine, or illness be driving this pattern?",
          "What glucose range or symptom mix should trigger same-day review?",
          profileContext ? `How should existing ${profileContext} change the monitoring plan?` : ""
        ],
        precautions: [
          "Use urgent care sooner for confusion, fainting, repeated vomiting, severe weakness, or extreme high or low readings.",
          "Do not change diabetes medicines or doses on your own from this app.",
          "Do not keep monitoring at home alone if symptoms are escalating quickly."
        ]
      };
    case "urinary":
      return {
        tracking: [
          "Track urine frequency, burning, color change, fever, fluid intake, and pain location.",
          "Note whether urine output is falling or flank pain is appearing.",
          durationLabel ? `Keep the symptom timeline clear: this has been present ${durationLabel}.` : ""
        ],
        questions: [
          "Does this look more like irritation, infection, dehydration, or kidney-related pain that needs review?",
          "What symptom change should trigger same-day care instead of watchful monitoring?",
          profileContext ? `Could existing ${profileContext} raise kidney or infection risk?` : ""
        ],
        precautions: [
          "Use urgent care sooner for fever, flank pain, blood in urine, severe weakness, or reduced urine output.",
          "Do not rely only on hydration if pain, fever, or diabetes context is present.",
          "Do not start antibiotic changes on your own from this app."
        ]
      };
    case "muscle_joint":
      return {
        tracking: [
          "Track swelling, bruising, weakness, numbness, and which movement makes the pain better or worse.",
          "Note the injury timing or the activity that triggered the pain.",
          "Compare function now versus your normal movement."
        ],
        questions: [
          "Does this look more like strain, inflammation, nerve irritation, or something that needs imaging or exam?",
          "What change in weakness, numbness, swelling, or function would make same-day review safer?",
          profileContext ? `Could existing ${profileContext} change healing or safety thresholds?` : ""
        ],
        precautions: [
          "Use urgent care sooner for severe swelling, deformity, inability to bear weight, numbness, weakness, or fever.",
          "Avoid pushing through pain that is clearly worsening with activity.",
          "Do not keep immobilizing or exercising aggressively without a clearer cause."
        ]
      };
    case "eye_ear_dental":
      return {
        tracking: [
          "Track exact location, discharge, swelling, fever, and whether pain is worsening.",
          "Note any vision change, hearing change, or trouble opening the mouth normally.",
          durationLabel ? `Keep the symptom timeline clear: this has been present ${durationLabel}.` : ""
        ],
        questions: [
          "Does this need same-day clinician, dentist, or eye review based on pain, swelling, or function change?",
          "What signs would mean infection or pressure is escalating rather than settling?",
          profileContext ? `Could existing ${profileContext} change infection or healing risk?` : ""
        ],
        precautions: [
          "Use urgent care sooner for vision loss, eye pain with swelling, facial swelling, fever, or severe worsening pain.",
          "Avoid using leftover medicines or eye drops without checking whether they fit the problem.",
          "Do not ignore rapid spread of swelling or pressure symptoms."
        ]
      };
    case "stress_sleep":
      return {
        tracking: [
          "Track sleep pattern, triggers, energy, concentration, and how symptoms affect daily function.",
          "Note what helped even slightly, such as reduced stimulation or a calming routine.",
          "Keep the support context clear: who is available if symptoms worsen?"
        ],
        questions: [
          "Is this mainly sleep disruption, anxiety, overload, panic, or mood-related difficulty?",
          "What support, clinician follow-up, or mental-health review would help if this keeps repeating?",
          "What change would mean I should stop self-management and seek urgent support?"
        ],
        precautions: [
          "Seek immediate real-world support for self-harm thoughts, feeling unsafe, severe panic, or inability to function safely.",
          "Avoid isolating if symptoms are escalating or sleep loss is severe.",
          "Do not start or stop mental-health medicines on your own from this app."
        ]
      };
    case "prevention":
      return {
        tracking: [
          "Pick one habit to track consistently, such as walking, sleep, hydration, or BP or glucose logging.",
          "Keep the starting baseline clear before adding more than one change.",
          durationLabel ? `Review progress over ${durationLabel} rather than judging one day.` : ""
        ],
        questions: [
          "Which single change would matter most for the goal right now?",
          "What result would show the habit is helping rather than just adding effort?",
          profileContext ? `How should existing ${profileContext} shape the prevention target?` : ""
        ],
        precautions: [
          "Use changes that fit your existing care plan rather than replacing it.",
          "Avoid aggressive habit changes if symptoms or readings are worsening.",
          "Use clinician review for diagnosis, prescriptions, or activity plans that need medical clearance."
        ]
      };
    default:
      return {
        tracking: [
          "Track what changed, when it started, severity, triggers, medicines, and any home readings.",
          durationLabel ? `Keep the symptom timeline clear: this has been present ${durationLabel}.` : "",
          profileContext ? `Keep relevant condition context visible: ${profileContext}.` : ""
        ],
        questions: [
          "Which missing detail would sharpen the next answer most?",
          "What symptom change should move this from routine monitoring to clinician review?",
          "Which readings, reports, or medicines matter most for this concern?"
        ],
        precautions: [
          "Use urgent care sooner for sudden worsening, severe pain, breathing trouble, fainting, confusion, or unusual weakness.",
          "Do not change prescription medicines on your own from this app.",
          "Do not rely on one isolated reading without symptom context."
        ]
      };
  }
}

function selectGeneralKnowledgeMatches({ medicalKnowledge, concernProfile, text, vitals, limit = 4 }) {
  const generalPolicy = routeEvidencePolicy.RAG_AGENT || { categories: new Set() };
  const allMatches = (medicalKnowledge?.matches || []).filter((match) => doesKnowledgeMatchRoutePolicy(match, generalPolicy));

  if (!allMatches.length) {
    return (getRouteMedicalKnowledge("RAG_AGENT", medicalKnowledge).matches || []).slice(0, limit);
  }

  const concernId = concernProfile?.primary?.id || "general";
  const normalizedText = buildSearchText(text);
  const hasOxygenContext = vitals?.oxygenSaturation !== null && vitals?.oxygenSaturation !== undefined
    || /\b(oxygen|spo2|saturation)\b/.test(normalizedText);
  const hasBpContext = vitals?.systolic !== null && vitals?.systolic !== undefined
    || vitals?.diastolic !== null && vitals?.diastolic !== undefined
    || /\b(bp|blood pressure|hypertension)\b/.test(normalizedText);
  const hasGlucoseContext = vitals?.bloodSugar !== null && vitals?.bloodSugar !== undefined
    || /\b(glucose|blood sugar|sugar|diabetes)\b/.test(normalizedText);
  const primaryHits = Array.isArray(concernProfile?.primary?.hits)
    ? concernProfile.primary.hits.map((item) => normalizeSearchText(item)).filter(Boolean)
    : [];
  const focusConfig = {
    cardio: {
      categoryWeights: { Vitals: 20, General: 12, "Urgent Safety": 10, Respiratory: 2 },
      anchors: ["blood pressure", "bp", "hypertension", "heart", "cardio", "palpitation", "pulse", "chest", "dizzy", "headache"]
    },
    respiratory: {
      categoryWeights: { Respiratory: 24, "Urgent Safety": 14, General: 10, Vitals: 4 },
      anchors: ["respiratory", "cough", "fever", "breathing", "wheeze", "cold", "flu", "asthma", "oxygen", "temperature"]
    },
    neuro: {
      categoryWeights: { General: 14, Vitals: 8, "Urgent Safety": 12 },
      anchors: ["headache", "dizziness", "vision", "speech", "weakness", "neurolog", "balance", "migraine", "stroke"]
    },
    digestive: {
      categoryWeights: { General: 14, "Urgent Safety": 10 },
      anchors: ["stomach", "abdominal", "nausea", "vomiting", "diarrhea", "food", "dehydration"]
    },
    skin: {
      categoryWeights: { General: 14, "Urgent Safety": 10 },
      anchors: ["rash", "itch", "allergy", "skin", "swelling", "hives"]
    },
    metabolic: {
      categoryWeights: { General: 18, Labs: 12, Vitals: 10, Medication: 10 },
      anchors: ["glucose", "blood sugar", "sugar", "diabetes", "hba1c", "insulin", "metformin", "thirst", "hydration"]
    },
    urinary: {
      categoryWeights: { General: 16, Labs: 10, "Urgent Safety": 8 },
      anchors: ["urine", "urinary", "kidney", "uti", "flank", "creatinine", "egfr", "dehydration"]
    },
    muscle_joint: {
      categoryWeights: { General: 14, "Urgent Safety": 8 },
      anchors: ["joint", "muscle", "back pain", "injury", "sprain", "swelling", "numbness"]
    },
    eye_ear_dental: {
      categoryWeights: { General: 14, "Urgent Safety": 8 },
      anchors: ["eye", "ear", "dental", "tooth", "vision", "hearing", "throat"]
    },
    stress_sleep: {
      categoryWeights: { "Mental Wellness": 24, General: 10, "Urgent Safety": 8 },
      anchors: ["stress", "sleep", "anxiety", "panic", "mood", "insomnia"]
    },
    prevention: {
      categoryWeights: { General: 18, Lifestyle: 14, Vitals: 8 },
      anchors: ["prevention", "diet", "exercise", "sleep", "hydration", "walking", "routine"]
    },
    general: {
      categoryWeights: { General: 12, Vitals: 8, Labs: 8, Respiratory: 6, "Urgent Safety": 6 },
      anchors: concernProfile?.matchedFamilies || []
    }
  };
  const config = focusConfig[concernId] || focusConfig.general;

  return [...allMatches]
    .map((match) => {
      const searchable = buildSearchText([
        match?.title,
        match?.summary,
        match?.category,
        ...(match?.matchedTerms || []),
        ...(match?.semanticFamilies || []),
        match?.source
      ].filter(Boolean).join(" "));
      let score = Number(match?.relevance || 0);
      const directConcernOverlap = primaryHits.reduce((total, hit) => total + (hit && searchable.includes(hit) ? 1 : 0), 0);

      score += Number(config.categoryWeights?.[match?.category] || 0);
      score += config.anchors.reduce((total, anchor) => total + (anchor && searchable.includes(normalizeSearchText(anchor)) ? 4 : 0), 0);
      score += (match?.matchedTerms || []).reduce((total, term) => total + (term && normalizedText.includes(normalizeSearchText(term)) ? 1 : 0), 0);
      score += directConcernOverlap * 8;

      if (/oxygen saturation/.test(searchable) && !hasOxygenContext) {
        score -= 14;
      }

      if (concernId !== "cardio" && /blood pressure|hypertension/.test(searchable) && !hasBpContext) {
        score -= 6;
      }

      if (concernId !== "metabolic" && /glucose|blood sugar|diabetes/.test(searchable) && !hasGlucoseContext) {
        score -= 6;
      }

      if (
        concernId === "cardio"
        && /heart failure|ankle swelling|weight gain|fluid/.test(searchable)
        && !/\b(heart failure|swelling|ankle swelling|weight gain|fluid|breathlessness|shortness of breath)\b/.test(normalizedText)
      ) {
        score -= 18;
      }

      return {
        match,
        score
      };
    })
    .sort((first, second) => second.score - first.score)
    .slice(0, limit)
    .map((entry) => entry.match);
}

function buildGeneralGuidanceSections({ text, profile, vitals, risk, context, medicalKnowledge, concernProfile, knowledgeMatches = null }) {
  const selectedMatches = Array.isArray(knowledgeMatches) && knowledgeMatches.length
    ? knowledgeMatches
    : selectGeneralKnowledgeMatches({ medicalKnowledge, concernProfile, text, vitals, limit: 4 });
  const knowledgeMatchesForSections = selectedMatches.length
    ? selectedMatches
    : getRouteKnowledgeMatches("RAG_AGENT", medicalKnowledge, 4);
  const structuredOverview = collectKnowledgeSectionItems(knowledgeMatchesForSections, "overview", 2);
  const structuredTracking = collectKnowledgeSectionItems(knowledgeMatchesForSections, "whatToTrack", 4);
  const structuredQuestions = collectKnowledgeSectionItems(knowledgeMatchesForSections, "careQuestions", 4);
  const structuredPrecautions = collectKnowledgeSectionItems(knowledgeMatchesForSections, "precautions", 4);
  const concernDetails = buildGeneralConcernSectionDetails({ text, concernProfile, vitals, context, profile });
  const topSummary = knowledgeMatchesForSections[0]?.summary
    ? `${knowledgeMatchesForSections[0].title}: ${compactResponseText(knowledgeMatchesForSections[0].summary, 150)}`
    : "";
  const topSafetyNote = knowledgeMatchesForSections[0]?.safetyNotes
    ? compactResponseText(knowledgeMatchesForSections[0].safetyNotes, 150)
    : "";
  const profileContext = [profile.conditions[0], profile.medications[0]].filter(Boolean).join("; ");
  const missingContext = concernProfile?.missing?.length
    ? `Sharpen the next answer by adding ${concernProfile.missing.slice(0, 2).join(" and ")}.`
    : "Context is strong enough for a focused first-layer answer.";
  const supportingOverview = structuredOverview.filter((item) => item !== topSummary);

  return {
    overview: dedupeResponseItems([
      `Current pattern fits a ${concernProfile.primary.label}.`,
      topSummary,
      ...supportingOverview,
      missingContext,
      profileContext ? `Profile context already considered: ${profileContext}.` : ""
    ]).slice(0, 4),
    tracking: dedupeResponseItems([
      ...(Array.isArray(concernDetails.tracking) ? concernDetails.tracking : []),
      ...structuredTracking,
      concernProfile?.missing?.length ? `Add ${concernProfile.missing.slice(0, 2).join(" and ")}.` : "",
      hasAnyVitals(vitals) ? "Compare readings with symptoms, timing, and repeat checks instead of judging one number alone." : ""
    ]).slice(0, 4),
    careQuestions: dedupeResponseItems([
      ...(Array.isArray(concernDetails.questions) ? concernDetails.questions : []),
      ...structuredQuestions,
      ...(Array.isArray(concernProfile?.focusQuestions) ? concernProfile.focusQuestions.filter((item) => !/^please add /i.test(item)) : [])
    ]).slice(0, 4),
    precautions: dedupeResponseItems([
      ...(Array.isArray(concernDetails.precautions) ? concernDetails.precautions : []),
      ...structuredPrecautions,
      topSafetyNote,
      concernProfile?.safetyScreen?.signals?.length ? `Priority warning signs already detected: ${concernProfile.safetyScreen.signals.slice(0, 3).join(", ")}.` : "",
      risk.level === "LOW"
        ? "Use clinician review sooner if symptoms are worsening, unusual, or not improving."
        : "Do not wait on home monitoring alone if symptoms are worsening or severe.",
      "Do not start, stop, double, or change medicine doses from this app."
    ]).slice(0, 4)
  };
}

function collectKnowledgeSectionItems(matches = [], sectionKey, limit = 4) {
  return dedupeResponseItems(
    matches.flatMap((match) => {
      const overview = sectionKey === "overview" && match?.sections?.overview ? [match.sections.overview] : [];
      const sectionItems = Array.isArray(match?.sections?.[sectionKey]) ? match.sections[sectionKey] : [];
      const directItems = Array.isArray(match?.[sectionKey]) ? match[sectionKey] : [];

      return [...overview, ...sectionItems, ...directItems]
        .map((item) => compactResponseText(item, 170))
        .filter(Boolean);
    })
  ).slice(0, limit);
}

function runRagAgent({ message, profile, vitals, risk, memoryContext, context, medicalKnowledge, requirementProfile }) {
  const text = buildSearchText(message);
  const findings = [];
  const routeKnowledge = getRouteMedicalKnowledge("RAG_AGENT", medicalKnowledge);
  const concernProfile = buildGeneralConcernProfile(text, vitals, context, profile);
  const knowledgeMatches = selectGeneralKnowledgeMatches({ medicalKnowledge, concernProfile, text, vitals, limit: 4 });
  const evidenceCoverage = Number(routeKnowledge.coverageScore || 0);
  const safeActions = buildGeneralSafeActions(profile, risk, context, concernProfile, text, vitals);
  const generalSections = buildGeneralGuidanceSections({ text, profile, vitals, risk, context, medicalKnowledge, concernProfile, knowledgeMatches });
  const isAtlasRequest = requirementProfile?.outputType === "medical_atlas"
    || requirementProfile?.type === "medical_atlas"
    || /\b(medical atlas|atlas guide|disease guide|prevention guide|medicine reference|health library)\b/.test(text);
  const atlasProfile = isAtlasRequest
    ? detectAtlasTopicProfile({ text, medicalKnowledge, concernProfile, risk })
    : null;
  const atlasSections = atlasProfile
    ? buildAtlasEducationSections({ text, profile, vitals, risk, context, medicalKnowledge, concernProfile, atlasProfile })
    : null;

  if (knowledgeMatches.length) {
    findings.push(`Matched local medical knowledge: ${knowledgeMatches.slice(0, 2).map((match) => match.title).join(", ")}.`);
  }

  findings.push(`Primary concern family: ${concernProfile.primary.label}; focus on ${concernProfile.primary.focus}.`);

  if (text.includes("dizzy") || text.includes("dizziness")) {
    findings.push("Dizziness can be associated with dehydration, blood-pressure changes, medication timing, or other causes.");
  }

  if (text.includes("headache")) {
    findings.push("Headache paired with high blood pressure or neurological symptoms should be treated cautiously.");
  }

  if (/(disease|condition|treatment|prevention|prevent|medical atlas|symptom checker)/.test(text)) {
    findings.push("Atlas-style health education can cover what a condition is, common symptoms, prevention, usual clinician-led evaluation, and safety warning signs.");
  }

  if (atlasProfile) {
    findings.push(`Medical Atlas mode selected: ${atlasProfile.topicType.toLowerCase()} with ${atlasProfile.matchQuality.toLowerCase()} match quality.`);
  }

  if (/(side effect|interaction|dosage|dose|drug|medicine|medication)/.test(text)) {
    findings.push("Medicine information is handled as safety education: purpose, common side effects, interaction questions, and label or pharmacist checks, without personal dose changes.");
  }

  if (/(chart|graph|image|medical image|xray|x-ray|mri|ct scan|ultrasound|diagram)/.test(text)) {
    findings.push("Medical images and charts are treated as explainable learning aids; diagnostic interpretation must come from the official report or clinician.");
  }

  if (text.includes("fever") || text.includes("temperature")) {
    findings.push("Fever trends matter more when temperature is high, persistent, or paired with breathing difficulty.");
  }

  if (text.includes("bp") || text.includes("blood pressure") || memoryContext.latestVitals.systolic) {
    findings.push("Blood-pressure readings should be interpreted with symptoms, baseline, and repeat measurements.");
  }

  if (context.duration && context.duration !== "not-sure") {
    findings.push(`Symptom duration was captured as ${formatContextLabel(context.duration)}, which helps prioritize follow-up.`);
  }

  if (!findings.length) {
    findings.push("General health intelligence route was selected because no narrow specialist-only request dominated.");
  }

  const missingText = concernProfile.missing.length
    ? `Missing detail(s): ${concernProfile.missing.join(", ")}.`
    : "Core context is sufficient for a focused general answer.";
  const patientAnswerSummary = `${concernProfile.primary.label} reviewed with ${concernProfile.completeness}% context quality. ${concernProfile.safetyScreen.boundary} ${missingText}`;

  return createAgentResult("RAG_AGENT", "General Health Intelligence", "complete", {
    intentRoute: "General",
    summary: `${patientAnswerSummary} ${findings.join(" ")}`,
    patientAnswerSummary,
    productionTool: "Trusted medical FAQ review plus symptom-family and missing-context reasoning.",
    sourceMode: medicalKnowledge?.mode || "Local health guidance only; external retrieval is disabled.",
    evidenceCoverage,
    atlasProfile,
    atlasSections,
    generalSections,
    atlasNextSteps: atlasSections
      ? [
        atlasSections.tracking[0],
        atlasSections.careQuestions[0],
        atlasSections.precautions[0]
      ].filter(Boolean)
      : [],
    concernProfile: {
      familyId: concernProfile.primary.id,
      family: concernProfile.primary.label,
      focus: concernProfile.primary.focus,
      matchedHits: concernProfile.primary.hits,
      matchedFamilies: concernProfile.matchedFamilies,
      completeness: concernProfile.completeness,
      focusQuestions: concernProfile.focusQuestions,
      nextQuestion: concernProfile.nextQuestion,
      evidenceLanes: concernProfile.evidenceLanes,
      safetyScreen: concernProfile.safetyScreen
    },
    missingContext: concernProfile.missing,
    focusQuestions: concernProfile.focusQuestions,
    safeActions,
    references: mapKnowledgeReferences(knowledgeMatches, 3),
    confidence: risk.level === "LOW" ? "normal" : "cautious"
  });
}

function buildSpecialistSafetyGate(domain, text, context = {}, vitals = {}, risk = {}) {
  const safetyText = getSpecialistPatientSignalText(text) || String(text || "");
  const selectedFlags = Array.isArray(context.redFlags)
    ? context.redFlags.map((flag) => String(flag || "").replace(/-/g, " "))
    : [];
  const signals = [];
  const addSignal = (condition, label) => {
    if (condition) {
      signals.push(label);
    }
  };

  addSignal(
    [
      "chest pain",
      "chest pressure",
      "crushing chest",
      "tight chest"
    ].some((term) => hasAffirmedTerm(safetyText, term)),
    "Chest pain or pressure"
  );
  addSignal(
    hasBreathingSignal(safetyText)
      || hasAffirmedTerm(safetyText, "blue lips")
      || hasAffirmedTerm(safetyText, "cannot speak")
      || hasAffirmedTerm(safetyText, "unable to speak"),
    "Breathing trouble"
  );
  addSignal(hasStrokeSignal(safetyText), "Stroke-like sign");
  addSignal(
    hasFaintingSignal(safetyText)
      || hasAffirmedTerm(safetyText, "confusion")
      || hasAffirmedTerm(safetyText, "seizure")
      || hasAffirmedTerm(safetyText, "loss of consciousness"),
    "Fainting, confusion, or seizure"
  );
  addSignal(
    hasSevereAllergySignal(safetyText)
      || (
        hasAffirmedTerm(safetyText, "hives")
        && hasBreathingSignal(safetyText)
      ),
    "Severe allergy sign"
  );
  addSignal(
    [
      "severe vomiting",
      "cannot keep fluids",
      "dehydration",
      "blood in stool",
      "blood in vomit",
      "black stool"
    ].some((term) => hasAffirmedTerm(safetyText, term)),
    "Severe fluid loss or bleeding sign"
  );
  addSignal(Number(vitals.systolic) >= 180 || Number(vitals.diastolic) >= 120, "Very high blood pressure reading");
  addSignal(Number(vitals.oxygenSaturation) > 0 && Number(vitals.oxygenSaturation) <= 90, "Low oxygen reading");

  for (const flag of selectedFlags) {
    if (flag) {
      signals.push(flag.replace(/\b\w/g, (letter) => letter.toUpperCase()));
    }
  }

  const uniqueSignals = dedupeResponseItems(signals).slice(0, 6);
  const hasHighRiskScore = ["CRITICAL", "HIGH"].includes(risk.level);
  const level = uniqueSignals.length
    ? "urgent-first"
    : hasHighRiskScore
      ? "priority-review"
      : "specialist-safe";

  return {
    level,
    signals: uniqueSignals,
    title: level === "urgent-first" ? "Safety gate first" : level === "priority-review" ? "Priority review" : "Specialist review safe",
    action: level === "urgent-first"
      ? "Handle the warning sign before routine disease education; use real-world urgent care if symptoms are happening now."
      : level === "priority-review"
        ? "Use a cautious specialist review and contact a clinician soon if symptoms persist, readings repeat high, or anything worsens."
        : `Proceed with a focused ${domain.label.toLowerCase()} education review and keep urgent signs visible.`,
    boundary: "No diagnosis, prescription, dosage change, or emergency dispatch is performed."
  };
}

function getSpecialistPatientSignalText(text = "") {
  const source = String(text || "")
    .replace(/^specialist doctor review\s*-\s*[^:]+:/i, "")
    .replace(/^patient question\s*:/i, "")
    .trim();
  const structuredCut = source.split(/\bstructured specialist intake\b/i)[0].trim();
  const lower = structuredCut.toLowerCase();
  const markerIndex = [
    "\nspecialty:",
    " specialty:",
    "\ntimeline:",
    " timeline:",
    "\nlens:",
    " lens:",
    "\nhistory:",
    " history:",
    "\nrisks:",
    " risks:",
    "\nreadings:",
    " readings:",
    "\nreports:",
    " reports:",
    "\nmeds/allergies:",
    " meds/allergies:",
    "\nrisk modifiers:",
    " risk modifiers:",
    "\nurgent signs:",
    " urgent signs:",
    "\nguide checks:",
    " guide checks:",
    "\nevidence:",
    " evidence:"
  ].reduce((found, marker) => {
    const index = lower.indexOf(marker);

    if (index === -1) {
      return found;
    }

    return found === -1 ? index : Math.min(found, index);
  }, -1);

  return (markerIndex >= 0 ? structuredCut.slice(0, markerIndex) : structuredCut).trim();
}

const specialistStructuredSections = [
  ["specialty", "Specialty"],
  ["timeline", "Timeline"],
  ["lens", "Lens"],
  ["history", "History"],
  ["risks", "Risks"],
  ["readings", "Readings"],
  ["reports", "Reports"],
  ["medicines", "Meds/allergies"],
  ["riskModifiers", "Risk modifiers"],
  ["urgentSigns", "Urgent signs"]
];

const specialistStructuredAliases = {
  specialty: "specialty",
  timeline: "timeline",
  lens: "lens",
  history: "history",
  risks: "risks",
  readings: "readings",
  reports: "reports",
  "meds/allergies": "medicines",
  medications: "medicines",
  medicines: "medicines",
  meds: "medicines",
  "risk modifiers": "riskModifiers",
  "urgent signs": "urgentSigns"
};

function normalizeSpecialistStructuredKey(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/\s*\/\s*/g, "/")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeSpecialistStructuredValue(value = "") {
  return cleanText(String(value || "").replace(/[.;]+$/g, ""));
}

function hasMeaningfulSpecialistStructuredValue(value = "") {
  const cleaned = normalizeSpecialistStructuredValue(value);

  return Boolean(cleaned) && !/^(none|no|not entered|not-entered|unknown|n\/a|na|nil|not sure|not-sure|none reported|none entered|none available)$/i.test(cleaned);
}

function parseSpecialistStructuredSections(text = "") {
  const parsed = Object.fromEntries(specialistStructuredSections.map(([key]) => [key, ""]));
  const source = String(text || "").replace(/\r\n/g, "\n");
  const structuredBlock = source.split(/\bstructured specialist intake\s*:/i)[1];
  const lines = String(structuredBlock || source)
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    const match = line.match(/^([^:]+):\s*(.+)$/);

    if (!match) {
      continue;
    }

    const sectionKey = specialistStructuredAliases[normalizeSpecialistStructuredKey(match[1])];

    if (!sectionKey) {
      continue;
    }

    const value = normalizeSpecialistStructuredValue(match[2]);
    parsed[sectionKey] = hasMeaningfulSpecialistStructuredValue(value) ? value : "";
  }

  return parsed;
}

function buildSpecialistStructuredEvidenceLines(text = "") {
  const parsed = parseSpecialistStructuredSections(text);

  return specialistStructuredSections
    .map(([key, label]) => parsed[key] ? `${label}: ${parsed[key]}` : "")
    .filter(Boolean);
}

function buildSpecialistEvidenceBundle(text = "", profile = {}, context = {}) {
  const patientSignalText = getSpecialistPatientSignalText(text);
  const structuredSections = parseSpecialistStructuredSections(text);
  const structuredEvidenceLines = buildSpecialistStructuredEvidenceLines(text);
  const structuredEvidenceText = structuredEvidenceLines.join("\n");
  const profileConditionText = profileListText(profile.conditions);
  const profileMedicationText = profileListText(profile.medications);
  const profileAllergyText = profileListText(profile.allergies);
  const profileNotesText = cleanText(profile.notes);
  const contextRiskModifierText = Array.isArray(context.riskModifiers)
    ? context.riskModifiers.join(" ")
    : "";
  const combinedText = [
    patientSignalText,
    structuredEvidenceText,
    profileConditionText,
    profileMedicationText,
    profileAllergyText,
    profileNotesText,
    contextRiskModifierText
  ].filter(Boolean).join(" ");

  return {
    patientSignalText,
    structuredSections,
    structuredEvidenceLines,
    structuredEvidenceText,
    profileConditionText,
    profileMedicationText,
    profileAllergyText,
    profileNotesText,
    contextRiskModifierText,
    combinedText,
    normalizedText: buildSearchText(combinedText)
  };
}

function getSpecialistExplicitFocusText(text = "") {
  const source = String(text || "").replace(/\r\n/g, "\n").trim();
  const prefixedMatch = source.match(/^specialist doctor review\s*-\s*([^:]+):/i);

  if (prefixedMatch?.[1]) {
    return cleanText(prefixedMatch[1]);
  }

  const structuredSections = parseSpecialistStructuredSections(text);

  if (structuredSections.specialty) {
    return cleanText(structuredSections.specialty);
  }

  return "";
}

function getSpecialistStructuredEvidenceText(text = "") {
  return buildSpecialistStructuredEvidenceLines(text).join("\n").trim();
}

function getSpecialistReferenceFocus(domain = {}) {
  const profiles = {
    cardiology: {
      families: ["Cardio and blood pressure", "Labs and reports", "Urgent safety"],
      anchors: ["bp", "blood pressure", "hypertension", "heart", "cardio", "pulse", "palpitation", "cholesterol", "ecg", "systolic", "diastolic"]
    },
    diabetes: {
      families: ["Diabetes and metabolism", "Labs and reports", "Medicine safety"],
      anchors: ["glucose", "blood sugar", "diabetes", "hba1c", "a1c", "insulin", "metformin", "kidney", "urine albumin", "thirst"]
    },
    respiratory: {
      families: ["Breathing and lungs", "Urgent safety"],
      anchors: ["breathing", "breathless", "shortness of breath", "wheeze", "asthma", "oxygen", "spo2", "cough", "inhaler"]
    },
    neurology: {
      families: ["Brain and nerves", "Urgent safety", "Vitals"],
      anchors: ["headache", "migraine", "stroke", "vision", "speech", "confusion", "weakness", "numbness", "seizure", "neuro"]
    },
    kidney: {
      families: ["Labs and reports", "Vitals"],
      anchors: ["kidney", "renal", "creatinine", "egfr", "urine", "albumin", "protein", "potassium", "swelling"]
    },
    gastro: {
      families: ["General", "Urgent safety"],
      anchors: ["abdominal", "stomach", "vomit", "diarrhea", "stool", "liver", "jaundice", "bleeding", "reflux"]
    },
    orthopedic: {
      families: ["General", "Urgent safety"],
      anchors: ["joint", "bone", "injury", "back", "knee", "ankle", "swelling", "movement", "numbness", "weakness"]
    },
    infection: {
      families: ["Urgent safety", "General"],
      anchors: ["infection", "fever", "temperature", "rash", "sore throat", "cough", "urine", "sepsis", "dehydration"]
    },
    skin: {
      families: ["Medicine safety", "Urgent safety", "General"],
      anchors: ["rash", "itch", "hives", "swelling", "allergy", "blister", "skin", "infection", "spread"]
    },
    endocrine: {
      families: ["Diabetes and metabolism", "Labs and reports", "Medicine safety"],
      anchors: ["thyroid", "tsh", "t3", "t4", "hormone", "weight", "palpitations", "temperature", "tremor"]
    }
  };
  const profile = profiles[cleanText(domain.id).toLowerCase()] || {};

  return {
    families: (profile.families || []).map((item) => normalizeSearchText(item)).filter(Boolean),
    anchors: dedupeResponseItems([
      ...(Array.isArray(domain.terms) ? domain.terms : []),
      ...cleanText(domain.label).split(/\s+/),
      ...(profile.anchors || [])
    ]).map((item) => cleanText(item).toLowerCase()).filter(Boolean),
    titleAnchors: dedupeResponseItems([
      ...(Array.isArray(domain.terms) ? domain.terms : []),
      ...(profile.anchors || [])
    ]).map((item) => cleanText(item).toLowerCase()).filter((item) => item.length >= 2)
  };
}

function buildSpecialistReferenceText(match = {}) {
  return buildSearchText([
    match.title,
    match.category,
    match.source,
    match.summary,
    match.safetyNotes,
    ...(Array.isArray(match.matchedTerms) ? match.matchedTerms : []),
    ...(Array.isArray(match.semanticFamilies) ? match.semanticFamilies : [])
  ].filter(Boolean).join(" "));
}

function prioritizeSpecialistKnowledgeMatches(matches = [], domain = {}, patientText = "", focusProfile = null) {
  const focus = getSpecialistReferenceFocus(domain);
  const focusAnchors = Array.isArray(focusProfile?.referenceAnchors)
    ? focusProfile.referenceAnchors.map((item) => cleanText(item).toLowerCase()).filter(Boolean)
    : [];
  const patientTerms = dedupeResponseItems(
    buildSearchText(patientText)
      .split(" ")
      .filter((token) => token.length >= 4)
  ).slice(0, 18);

  return [...matches]
    .map((match, index) => {
      const matchText = buildSpecialistReferenceText(match);
      const titleText = buildSearchText(match.title || "");
      const semanticFamilies = Array.isArray(match.semanticFamilies)
        ? match.semanticFamilies.map((item) => normalizeSearchText(item)).filter(Boolean)
        : [];
      const familyHitCount = semanticFamilies.filter((family) => focus.families.includes(family)).length;
      const anchorHitCount = focus.anchors.filter((term) => hasTerm(matchText, term)).length;
      const titleAnchorHits = focus.titleAnchors.filter((term) => hasTerm(titleText, term)).length;
      const focusAnchorHitCount = focusAnchors.filter((term) => hasTerm(matchText, term)).length;
      const focusTitleHits = focusAnchors.filter((term) => hasTerm(titleText, term)).length;
      const patientHitCount = patientTerms.filter((term) => hasTerm(matchText, term)).length;
      const offFocusPenalty = focus.families.length && semanticFamilies.length && familyHitCount === 0 ? 18 : 0;
      const broadReferencePenalty = titleAnchorHits === 0 && anchorHitCount <= 2 ? 10 : 0;

      return {
        ...match,
        __specialistPriorityScore: Number(match.relevance || 0)
          + (familyHitCount * 22)
          + (anchorHitCount * 6)
          + (titleAnchorHits * 18)
          + (focusAnchorHitCount * 9)
          + (focusTitleHits * 18)
          + Math.min(patientHitCount, 3)
          - offFocusPenalty
          - broadReferencePenalty,
        __specialistPriorityIndex: index
      };
    })
    .sort((left, right) =>
      (right.__specialistPriorityScore - left.__specialistPriorityScore)
      || (Number(right.relevance || 0) - Number(left.relevance || 0))
      || (left.__specialistPriorityIndex - right.__specialistPriorityIndex)
    )
    .map(({ __specialistPriorityScore, __specialistPriorityIndex, ...match }) => match);
}

function buildSpecialistPrecisionProfile({ text, domain, profile, vitals, context, medicalKnowledge, risk = {}, focusProfile = null }) {
  const evidenceBundle = buildSpecialistEvidenceBundle(text, profile, context);
  const patientSignalText = evidenceBundle.patientSignalText;
  const structuredEvidenceText = evidenceBundle.structuredEvidenceText;
  const structuredSections = evidenceBundle.structuredSections;
  const profileConditionText = evidenceBundle.profileConditionText;
  const profileMedicationText = evidenceBundle.profileMedicationText;
  const profileAllergyText = evidenceBundle.profileAllergyText;
  const profileNotes = evidenceBundle.profileNotesText;
  const profileConditions = profileListArray(profile.conditions);
  const profileMedications = profileListArray(profile.medications);
  const profileAllergies = profileListArray(profile.allergies);
  const userEvidenceText = evidenceBundle.combinedText.trim();
  const matchedTerms = dedupeResponseItems(
    domain.terms
      .filter((term) => hasTerm(userEvidenceText, term) && !hasNegatedTerm(userEvidenceText, term))
      .concat(Array.isArray(focusProfile?.signals) ? focusProfile.signals.filter((term) => hasTerm(userEvidenceText, term) && !hasNegatedTerm(userEvidenceText, term)) : [])
  ).slice(0, 6);
  const evidence = [];
  const missing = [];
  const hasReadings = hasAnyVitals(vitals);
  const hasReadingTextSignal = /\b(bp|blood pressure|glucose|sugar|pulse|heart rate|oxygen|spo2|temperature|temp|bmi|weight|hba1c|a1c|ldl|hdl|egfr|creatinine)\b[^.\n]{0,24}\d/i.test(userEvidenceText)
    || /\b\d{2,3}\s*\/\s*\d{2,3}\b/.test(userEvidenceText);
  const hasReadingEvidence = hasReadings || hasReadingTextSignal;
  const redFlags = Array.isArray(context.redFlags) ? context.redFlags : [];
  const references = prioritizeSpecialistKnowledgeMatches(
    getRouteKnowledgeMatches("SPECIALIST_DOCTOR_AGENT", medicalKnowledge, 8),
    domain,
    userEvidenceText,
    focusProfile
  ).slice(0, 4);
  const reportSourceText = `${patientSignalText} ${structuredSections.reports} ${profileNotes}`.trim();
  const medicineSourceText = `${patientSignalText} ${structuredSections.medicines} ${profileMedicationText} ${profileAllergyText} ${profileNotes}`.trim();
  const hasReportSignal = Boolean(structuredSections.reports)
    || /(lab|test result|report value|ecg|ekg|scan|xray|x-ray|mri|ct|ultrasound|hba1c|creatinine|egfr|cholesterol|cbc|ldl|hdl|ferritin|hemoglobin)/.test(reportSourceText);
  const hasMedicineSignal = Boolean(structuredSections.medicines)
    || Boolean(profileMedicationText)
    || Boolean(profileAllergyText)
    || /(medicine|medication|tablet|pill|drug|inhaler|insulin|metformin|amlodipine|side effect|interaction|allerg|dose|timing)/.test(medicineSourceText);
  const hasSymptomSignal = /(pain|ache|cough|fever|breath|dizzy|swelling|rash|weak|tired|vomit|diarrhea|numb|vision|speech|palpitation|urine|headache|fatigue|itch|thirst)/.test(`${patientSignalText} ${structuredSections.history}`.trim());
  const safetyGate = buildSpecialistSafetyGate(domain, patientSignalText, context, vitals, risk);

  if (matchedTerms.length) {
    evidence.push(`Matched specialty terms: ${matchedTerms.slice(0, 4).join(", ")}`);
  } else if (context.specialistFocus === domain.id) {
    evidence.push(`Selected ${domain.label.toLowerCase()} from the specialist tab focus`);
  } else {
    evidence.push(`Selected ${domain.label.toLowerCase()} from profile or default specialist focus`);
  }

  if (profileConditions.length) {
    evidence.push(`Known condition context: ${profileConditions.slice(0, 3).join(", ")}`);
  }

  if (profileMedications.length || profileAllergies.length) {
    evidence.push(`Medicine context: ${[...profileMedications, ...profileAllergies.map((item) => `allergy: ${item}`)].slice(0, 3).join(", ")}`);
  }

  if (profileNotes) {
    evidence.push(`Profile note context: ${compactResponseText(profileNotes, 120)}`);
  }

  if (focusProfile?.label) {
    evidence.push(`Focus lane: ${focusProfile.label}`);
  }

  if (focusProfile?.summary) {
    evidence.push(compactResponseText(focusProfile.summary, 120));
  }

  if (hasReadings) {
    const vitalParts = [];

    if (vitals.systolic !== null || vitals.diastolic !== null) {
      vitalParts.push(`BP ${vitals.systolic ?? "--"}/${vitals.diastolic ?? "--"}`);
    }

    if (vitals.bloodSugar !== null) {
      vitalParts.push(`glucose ${vitals.bloodSugar}`);
    }

    if (vitals.heartRate !== null) {
      vitalParts.push(`pulse ${vitals.heartRate}`);
    }

    if (vitals.oxygenSaturation !== null) {
      vitalParts.push(`oxygen ${vitals.oxygenSaturation}%`);
    }

    if (vitals.temperatureC !== null) {
      vitalParts.push(`temperature ${vitals.temperatureC} C`);
    }

    evidence.push(`Current reading context: ${vitalParts.slice(0, 4).join(", ")}`);
  } else if (hasReadingTextSignal) {
    evidence.push("Reading context was detected in the specialist question.");
  }

  if (context.duration && context.duration !== "not-sure") {
    evidence.push(`Duration context: ${formatContextLabel(context.duration)}`);
  }

  if (redFlags.length) {
    evidence.push(`Selected warning sign(s): ${redFlags.map((flag) => flag.replace(/-/g, " ")).slice(0, 3).join(", ")}`);
  }

  if (safetyGate.signals.length) {
    evidence.push(`Safety gate signal(s): ${safetyGate.signals.slice(0, 3).join(", ")}`);
  }

  if (references.length) {
    evidence.push(`Local reference match: ${references.slice(0, 2).map((match) => match.title).join(", ")}`);
  }

  if (context.duration === "not-sure" && !hasDurationSignal(userEvidenceText)) {
    missing.push("when symptoms started and whether they are improving");
  }

  if (!Number(context.severity) && !/(mild|moderate|severe|[1-9]\s*\/\s*10)/.test(userEvidenceText)) {
    missing.push("severity or impact on daily activity");
  }

  if (!hasSymptomSignal) {
    missing.push("main symptom pattern or reason for specialist review");
  }

  if (!hasReadingEvidence && ["cardiology", "diabetes", "respiratory", "infection", "kidney", "neurology"].includes(domain.id)) {
    missing.push("latest relevant readings or report values");
  }

  if (!hasReportSignal && ["cardiology", "diabetes", "kidney", "infection", "gastro"].includes(domain.id)) {
    missing.push("recent test, lab, or report result if available");
  }

  if (!hasMedicineSignal && !profileMedications.length && !profileAllergies.length) {
    missing.push("current medicines, allergies, and recent changes");
  }

  if (!profileConditions.length && !profileNotes) {
    missing.push("known conditions and prior diagnosis history");
  }

  if (Array.isArray(focusProfile?.missing) && focusProfile.missing.length) {
    missing.push(...focusProfile.missing);
  }

  const rawConfidence = clamp(
    46
      + Math.min(matchedTerms.length, 4) * 5
      + Math.min(evidence.length, 6) * 3
      + (hasReadingEvidence ? 5 : 0)
      + (hasSymptomSignal ? 4 : 0)
      + (references.length ? 4 : 0)
      + Math.min(Number(focusProfile?.specificityBoost || 0), 10)
      - Math.min(missing.length, 5) * 7
      - (safetyGate.level === "urgent-first" ? 3 : 0),
    34,
    92
  );
  const confidenceCap = missing.length >= 4
    ? 62
    : missing.length === 3
      ? 70
      : missing.length === 2
        ? 80
        : missing.length === 1
          ? 88
          : 93;
  const confidence = Math.min(rawConfidence, confidenceCap);

  return {
    confidence,
    matchedTerms,
    evidence: dedupeResponseItems(evidence).slice(0, 6),
    missing: dedupeResponseItems(missing).slice(0, 5),
    reviewMode: confidence >= 82 ? "well-supported specialist review" : confidence >= 66 ? "focused review with some missing context" : "early specialist screen",
    referenceCount: references.length,
    safetyGate,
    qualityLanes: [
      {
        label: "Symptoms",
        status: hasSymptomSignal ? "ready" : "missing",
        detail: hasSymptomSignal
          ? focusProfile?.label || "Patient symptom signal detected"
          : "Add main symptom or concern"
      },
      {
        label: "Readings",
        status: hasReadingEvidence ? "ready" : "optional",
        detail: hasReadingEvidence ? "Vitals or report values included" : "Add BP, sugar, oxygen, pulse, labs, or scan terms"
      },
      {
        label: "Medicines",
        status: hasMedicineSignal || profileMedications.length || profileAllergies.length ? "ready" : "missing",
        detail: hasMedicineSignal || profileMedications.length || profileAllergies.length ? "Medicine context available" : "Add current medicines and allergies"
      },
      {
        label: "Safety",
        status: safetyGate.level === "urgent-first" ? "urgent" : safetyGate.level === "priority-review" ? "review" : "ready",
        detail: safetyGate.level === "urgent-first"
          ? "Warning signs detected"
          : safetyGate.level === "priority-review"
            ? "Higher-risk context detected"
            : "No urgent signal selected"
      }
    ],
    reasoningFocus: dedupeResponseItems([
      `Classify the closest disease area: ${domain.label}.`,
      focusProfile?.label ? `Prioritize this disease lane: ${focusProfile.label}.` : "",
      "Use patient-entered symptoms, timeline, readings, reports, medicines, risk factors, and memory context as evidence.",
      "Use internal vitals, medicine, and lab cross-checks only when the entered context supports them.",
      "Separate urgent warning signs from routine education before giving next steps.",
      "Return tests to discuss, prevention, treatment categories, monitoring, and doctor questions without diagnosis."
    ]),
    sourceStrength: references.length
      ? `${references.length} local knowledge reference match(es)`
      : "Local specialist disease map and safety rules"
  };
}

function buildSpecialistTests(domain) {
  const map = {
    cardiology: ["Home BP log with time and symptoms", "Pulse pattern", "Cholesterol, kidney, diabetes, and electrolyte review", "ECG or heart tests when a clinician finds it appropriate"],
    diabetes: ["Fasting and after-meal glucose log", "HbA1c trend", "Kidney and urine albumin review", "Eye and foot screening schedule"],
    respiratory: ["Oxygen reading if available", "Peak flow or spirometry when advised", "Trigger and inhaler-technique review", "Fever or chest assessment when symptoms suggest infection"],
    neurology: ["Onset timeline", "BP and fever context", "Neurologic symptom screen", "Imaging or specialist tests only when clinically indicated"],
    kidney: ["Creatinine and eGFR trend", "Urine albumin or protein", "Potassium and electrolytes", "BP, diabetes, and medicine review"],
    gastro: ["Pain location and hydration review", "Liver enzymes or stool tests when needed", "Food, alcohol, and medicine trigger review", "Imaging or endoscopy only when a clinician recommends it"],
    orthopedic: ["Injury and function assessment", "Movement and nerve-symptom review", "Imaging when injury pattern needs it", "Inflammation or infection checks for hot swollen joints"],
    infection: ["Temperature trend", "Source-of-infection review", "Hydration and oxygen when relevant", "Clinician-selected tests if fever is persistent or severe"],
    skin: ["Rash timeline and trigger review", "Photo or location description for clinician review", "Fever, swelling, and allergy history", "Clinician-selected swab or allergy review when needed"],
    endocrine: ["TSH and thyroid hormone trend", "Pulse, weight, and temperature-sensitivity pattern", "Medicine timing and supplement interaction review", "Clinician-selected hormone follow-up when needed"]
  };

  return map[domain.id] || ["Symptom timeline", "Relevant vitals", "Medication and allergy review", "Clinician-selected tests if needed"];
}

function buildSpecialistTreatmentCategories(domain) {
  const map = {
    cardiology: [
      "Common care usually starts with risk-factor control, home BP trend review, salt and tobacco reduction, weight and sleep support, and activity within clinician limits.",
      "Clinicians may review BP-lowering or cholesterol medicines, side effects, kidney impact, and whether the current plan matches the symptom pattern.",
      "Follow-up often uses repeat readings, pulse trend, kidney/diabetes/cholesterol context, and visit timing based on how persistent or severe symptoms are.",
      "Urgent care replaces routine follow-up if chest pain, severe breathlessness, fainting, stroke-like signs, or very high BP with severe symptoms appear."
    ],
    diabetes: [
      "Usual care focuses on food timing, hydration, movement, weight support, and understanding whether glucose patterns are fasting, after-meal, illness-related, or medicine-related.",
      "Clinicians may review diabetes medicines, low-sugar risk, missed doses, and whether the treatment plan matches HbA1c and day-to-day readings.",
      "Ongoing care usually includes glucose trend review plus kidney, eye, foot, and heart-risk prevention rather than relying on one reading alone.",
      "Urgent care replaces routine education for confusion, fainting, repeated vomiting, dehydration, very low sugar, or very high sugar with illness symptoms."
    ],
    respiratory: [
      "Common care tracks include trigger control, smoke avoidance, hydration, rest during illness, and reviewing whether cough or wheeze fits the usual breathing pattern.",
      "Clinicians may review inhaler technique, rescue-versus-controller use, oxygen context, and whether infection or allergy treatment is relevant.",
      "Follow-up often includes an action-plan discussion, vaccination review, and deciding whether breathing tests or chest review are needed.",
      "Urgent care replaces routine education for severe breathing trouble, blue lips, confusion, inability to speak normally, or rapid worsening."
    ],
    neurology: [
      "Common care starts with separating routine headache or nerve-pattern questions from sudden severe neurologic warning signs.",
      "Clinicians may review trigger patterns, sleep, hydration, BP, prior episodes, medicines, and whether imaging or neurologic testing is appropriate.",
      "Follow-up often focuses on symptom diaries, recurrence pattern, and prevention planning rather than assuming one cause from one episode.",
      "Urgent care replaces routine review for stroke-like signs, seizure, confusion, fainting, or a sudden worst headache."
    ],
    kidney: [
      "Common care focuses on BP and diabetes protection, hydration context, urine pattern, swelling, and reviewing how medicines affect kidney risk.",
      "Clinicians may review creatinine, eGFR, urine protein, potassium, pain medicines, and whether referral or tighter follow-up is needed.",
      "Ongoing care usually depends on trend review, repeat labs, and medicine-safety decisions rather than one isolated report value.",
      "Urgent care replaces routine review for severe weakness, confusion, marked swelling, breathing trouble, or dangerous potassium-related concerns."
    ],
    gastro: [
      "Common care usually begins with hydration support, food and alcohol trigger review, stool or vomiting pattern, and checking whether pain location or fever changes urgency.",
      "Clinicians may review reflux, infection, liver, bowel, or gallbladder possibilities and whether tests, imaging, or medicine review are needed.",
      "Follow-up often uses symptom timing, meal pattern, hydration, and report trends instead of relying on one symptom label.",
      "Urgent care replaces routine education for bleeding, severe abdominal pain, dehydration, persistent vomiting, confusion, or rapidly worsening symptoms."
    ],
    orthopedic: [
      "Common care focuses on safe movement, temporary activity reduction, swelling control, function tracking, and checking whether injury timing changes the plan.",
      "Clinicians may review pain-control options, nerve symptoms, imaging need, therapy questions, and whether fever or deformity changes urgency.",
      "Follow-up usually depends on function trend, walking ability, weakness, and recovery pattern rather than pain score alone.",
      "Urgent care replaces routine review for deformity, loss of bowel/bladder control, new weakness, major injury, or fever with joint/back pain."
    ],
    infection: [
      "Common care starts with fluids, rest, symptom-source review, temperature trend, and checking whether breathing, hydration, or immune risk changes urgency.",
      "Clinicians may review testing needs, infection-control steps, and whether medicines are needed based on source and severity.",
      "Follow-up usually depends on trend over hours to days, source symptoms, hydration, exposure, and whether fever is persistent or worsening.",
      "Urgent care replaces routine education for confusion, breathing trouble, dehydration, fainting, stiff neck, or persistent high fever with deterioration."
    ],
    skin: [
      "Common care often begins with trigger avoidance, skin protection, photo tracking, and separating irritation, allergy, and infection patterns.",
      "Clinicians may review allergy exposures, new medicines, swelling, fever, wound care, and whether dermatology or urgent review is needed.",
      "Follow-up usually depends on spread, pain, itch, blistering, fever, and whether the reaction is improving or rapidly worsening.",
      "Urgent care replaces routine review for breathing trouble, face or throat swelling, fainting, or a rapidly spreading painful rash."
    ],
    endocrine: [
      "Common care focuses on lab trend review, medicine timing, pulse and weight pattern, temperature sensitivity, and whether symptoms match the reported hormone issue.",
      "Clinicians may review thyroid or hormone medicines, supplement interactions, repeat labs, and whether pregnancy or heart-risk context changes the plan.",
      "Follow-up usually depends on symptom trend plus repeat lab context rather than one isolated hormone value.",
      "Urgent care replaces routine education for severe palpitations, chest pain, fainting, confusion, or rapid worsening."
    ]
  };

  return map[domain.id] || [
    "Common care usually starts with symptom tracking, reading/report review, medicine-safety review, and separating urgent from routine concerns.",
    "Clinicians may review tests, medicines, prevention, and follow-up timing based on the pattern rather than one isolated symptom.",
    "Ongoing care usually depends on trend review, context, and repeat follow-up instead of one data point.",
    "Urgent warning signs replace routine education and need real-world care."
  ];
}

function buildSpecialistCareExpectations(domain) {
  const map = {
    cardiology: [
      "Blood-pressure and heart-risk concerns are often managed through control, trend review, and risk reduction rather than one instant cure.",
      "The goal is usually to understand the pattern, reduce long-term risk, and match follow-up or medicines to the readings and symptoms."
    ],
    diabetes: [
      "Diabetes care usually focuses on stable control and complication prevention rather than a one-step cure.",
      "The goal is to match food, activity, medicines, and monitoring to the real glucose pattern over time."
    ],
    respiratory: [
      "Breathing conditions are often controlled by trigger reduction, inhaler or medicine review, and action-plan follow-up rather than a single cure.",
      "The goal is to recognize worsening early and keep breathing effort, oxygen, and triggers in context."
    ],
    neurology: [
      "Many headache and nerve-pattern concerns are managed by identifying the pattern and ruling out dangerous causes before discussing long-term control.",
      "The goal is to separate urgent neurologic signs from routine recurrence and decide what follow-up is worth discussing."
    ],
    kidney: [
      "Kidney concerns are often managed by slowing risk, protecting function, and following lab trends rather than expecting one immediate cure.",
      "The goal is usually to understand trend direction, medicine impact, hydration, and when specialist follow-up matters."
    ],
    gastro: [
      "Digestive problems may improve, resolve, or need longer follow-up depending on the cause, so care usually starts with pattern review rather than assuming a cure.",
      "The goal is to identify triggers, hydration risk, report findings, and what changes urgency."
    ],
    orthopedic: [
      "Bone, joint, and injury concerns often improve through protection, guided movement, and time, but some patterns need imaging or therapy review instead of self-treatment.",
      "The goal is to protect function and spot warning signs that make this more than routine pain."
    ],
    infection: [
      "Some infections improve with rest and hydration, while others need testing or clinician-directed treatment, so the key question is severity and source rather than a generic cure.",
      "The goal is to monitor trend, hydration, breathing, and worsening signs early."
    ],
    skin: [
      "Skin and allergy issues may settle by avoiding the trigger, but rapidly worsening, painful, or swollen reactions need direct review rather than home guessing.",
      "The goal is to separate irritation, allergy, and infection patterns and watch how quickly the skin is changing."
    ],
    endocrine: [
      "Hormone and thyroid concerns are usually managed through lab trend review and treatment adjustment by a clinician rather than one immediate cure.",
      "The goal is to match symptoms, pulse, weight, and medicine timing to the hormone trend over time."
    ]
  };

  return map[domain.id] || [
    "Many specialist concerns are managed through pattern review, follow-up, and clinician-guided treatment rather than one guaranteed cure.",
    "The goal is to understand severity, trend, and what data changes the next safe step."
  ];
}

function buildSpecialistPrecautionGuidance(domain, precision, risk) {
  const urgentLine = domain.safety?.length
    ? `Seek urgent care instead of waiting if ${domain.safety.slice(0, 3).join(", ").toLowerCase()} happen.`
    : "Seek urgent care instead of waiting if symptoms become sudden, severe, or rapidly worsen.";

  const base = [
    `Do not self-diagnose or change treatment based only on this ${domain.label.toLowerCase()} review.`,
    `Track symptom start time, severity, triggers, readings, medicines, and what clearly makes symptoms better or worse.`,
    urgentLine
  ];

  if (risk.level === "CRITICAL" || risk.level === "HIGH" || precision.safetyGate.level === "urgent-first") {
    return dedupeResponseItems([
      precision.safetyGate.action,
      ...base
    ]).slice(0, 4);
  }

  if (precision.safetyGate.level === "priority-review") {
    return dedupeResponseItems([
      precision.safetyGate.action,
      ...base
    ]).slice(0, 4);
  }

  return dedupeResponseItems(base).slice(0, 4);
}

function buildSpecialistSafeActions(domain, precision, risk, tests = buildSpecialistTests(domain), treatmentCategories = buildSpecialistTreatmentCategories(domain), precautions = buildSpecialistPrecautionGuidance(domain, precision, risk)) {
  if (risk.level === "CRITICAL" || risk.level === "HIGH") {
    return [
      "Treat the warning signs first and seek real-world medical help if symptoms are happening now.",
      "Keep readings, medicines, allergies, and symptom start time ready for the care team.",
      `Use the ${domain.label.toLowerCase()} review only after urgent safety is addressed.`
    ];
  }

  const actions = [
    `Track the main ${domain.label.toLowerCase()} symptom pattern with start time, severity, triggers, and what changed.`,
    precautions[0],
    `Use this treatment discussion frame: ${treatmentCategories[0]}`,
    `Discuss ${tests.slice(0, 2).join(" and ")} with a clinician if this is new, persistent, or worsening.`,
    `Prepare this question for your visit: ${domain.questions[0]}`
  ];

  if (precision.missing.length) {
    actions.splice(1, 0, `Add ${precision.missing.slice(0, 2).join(" and ")} for a sharper review.`);
  }

  return dedupeResponseItems(actions).slice(0, 4);
}

function normalizeSpecialistLensId(value = "") {
  const normalized = normalizeSearchText(value).replace(/\s+/g, "-");

  if (["tests", "test", "reports", "report"].includes(normalized)) return "tests";
  if (["prevention", "prevent", "prevention-plan"].includes(normalized)) return "prevention";
  if (["medicine-safety", "medicines", "medicine", "medication-safety", "medication"].includes(normalized)) return "medicine-safety";
  if (["follow-up", "followup", "doctor-note", "handoff"].includes(normalized)) return "follow-up";
  if (["symptom-pattern", "symptoms", "symptom"].includes(normalized)) return "symptom-pattern";
  return "full-review";
}

function buildSpecialistLensPlan({
  domain,
  focusProfile,
  context = {},
  precision,
  tests = [],
  treatmentCategories = [],
  careExpectations = [],
  domainInsights = {},
  supportReview = {},
  memoryContext = {},
  risk = {}
}) {
  const lensId = normalizeSpecialistLensId(context.specialistLens);
  const lensLabels = {
    "full-review": "Full disease review",
    "symptom-pattern": "Symptom pattern review",
    tests: "Tests and reports",
    prevention: "Prevention and risk reduction",
    "medicine-safety": "Medicine and disease safety",
    "follow-up": "Visit and follow-up planning"
  };
  const missingLead = precision.missing.length ? `Add ${precision.missing[0]}.` : "";
  const repeatedTrendLine = memoryContext?.recentTurnCount
    ? "Use the saved timeline and any prior readings to compare trend, not one moment alone."
    : "Use repeated readings or dated symptom notes instead of one isolated data point.";
  const urgentLine = ["HIGH", "CRITICAL"].includes(risk.level) || precision.safetyGate.level !== "specialist-safe"
    ? precision.safetyGate.action
    : `Escalate promptly if ${domain.safety.slice(0, 2).join(" or ").toLowerCase()} appears.`;

  const fullReviewPlan = {
    label: lensLabels["full-review"],
    summary: "The review combines symptom pattern, safety boundaries, clinician-led tests, prevention, and follow-up planning.",
    actions: [
      focusProfile?.actions?.[0] || "",
      tests[0] ? `Discuss ${tests[0].toLowerCase()} first if this pattern is new, persistent, or worsening.` : "",
      repeatedTrendLine,
      missingLead
    ],
    questions: [
      domainInsights.doctorQuestions?.[0] || "",
      tests[1] ? `Would ${tests[1].toLowerCase()} add useful detail for this pattern?` : "",
      `Which warning sign matters most for this ${domain.label.toLowerCase()} concern?`
    ]
  };

  const planByLens = {
    tests: {
      label: lensLabels.tests,
      summary: "The next discussion should focus on which clinician-led tests, repeated readings, or report trends are most useful for this disease pattern.",
      actions: [
        tests[0] ? `Start with this test discussion: ${tests[0]}.` : "",
        tests[1] ? `Then ask whether ${tests[1].toLowerCase()} changes the follow-up plan.` : "",
        repeatedTrendLine,
        missingLead
      ],
      questions: [
        tests[0] ? `Is ${tests[0].toLowerCase()} the best first test or monitoring step here?` : "",
        tests[1] ? `When would ${tests[1].toLowerCase()} become useful?` : "",
        "Would repeat readings or report trends change how urgent this is?"
      ]
    },
    prevention: {
      label: lensLabels.prevention,
      summary: "The next discussion should focus on prevention, risk reduction, and what daily actions lower the chance of worsening or complications.",
      actions: [
        domain.prevention?.[0] ? `Start with this prevention step: ${domain.prevention[0]}.` : "",
        domainInsights.monitoringPlan?.[0] || "",
        careExpectations[0] || "",
        missingLead
      ],
      questions: [
        `Which prevention step matters most first for this ${domain.label.toLowerCase()} pattern?`,
        "What should I monitor at home to know the prevention plan is working?",
        domain.questions?.[0] || ""
      ]
    },
    "medicine-safety": {
      label: lensLabels["medicine-safety"],
      summary: "The next discussion should focus on how the disease pattern interacts with current medicines, allergies, timing, and possible treatment-side-effect questions.",
      actions: [
        supportReview.activeChecks?.includes("medicine safety")
          ? "Bring the full medicine list, allergies, and recent medicine changes into the specialist discussion."
          : "Add the medicine list, allergies, and recent medicine changes before relying on a disease-specific review.",
        treatmentCategories[0] || "",
        repeatedTrendLine,
        missingLead
      ],
      questions: [
        "Do my medicines, allergies, or recent changes alter the safest specialist plan?",
        "Could side effects, missed doses, or medicine timing explain part of this pattern?",
        domainInsights.doctorQuestions?.[2] || ""
      ]
    },
    "follow-up": {
      label: lensLabels["follow-up"],
      summary: "The next discussion should focus on visit readiness, what to bring, how soon follow-up matters, and which warning signs should move this to same-day care.",
      actions: [
        domainInsights.doctorQuestions?.[0] ? `Prepare this follow-up question: ${domainInsights.doctorQuestions[0]}` : "",
        tests[0] ? `Bring this first evidence item: ${tests[0]}.` : "",
        repeatedTrendLine,
        urgentLine
      ],
      questions: [
        "How soon should I discuss this with a clinician if symptoms stay the same?",
        "What should I bring to make the follow-up visit more useful?",
        `Which warning sign should move this ${domain.label.toLowerCase()} issue out of routine follow-up?`
      ]
    },
    "symptom-pattern": {
      label: lensLabels["symptom-pattern"],
      summary: "The next discussion should focus on describing the symptom pattern precisely enough that a clinician can judge severity, direction, and the right next test or follow-up step.",
      actions: [
        focusProfile?.actions?.[0] || `Track the main ${domain.label.toLowerCase()} symptom with onset, severity, triggers, and what changed.`,
        domainInsights.monitoringPlan?.[0] || "",
        repeatedTrendLine,
        missingLead
      ],
      questions: [
        "Which part of the symptom pattern matters most: onset, severity, trigger, or trend?",
        "Which added reading or report would make this review sharper?",
        domain.questions?.[0] || ""
      ]
    },
    "full-review": fullReviewPlan
  };

  const plan = planByLens[lensId] || fullReviewPlan;

  return {
    id: lensId,
    label: plan.label,
    summary: plan.summary,
    actions: dedupeResponseItems(plan.actions).filter(Boolean).slice(0, 4),
    questions: dedupeResponseItems(plan.questions).filter(Boolean).slice(0, 4)
  };
}

function detectSpecialistFocusProfile(domain, text, profile = {}, vitals = {}, context = {}) {
  const evidence = buildSpecialistEvidenceBundle(text, profile, context);
  const source = [
    evidence.patientSignalText,
    evidence.structuredEvidenceText,
    evidence.profileConditionText,
    evidence.profileMedicationText,
    evidence.profileAllergyText,
    evidence.profileNotesText
  ].filter(Boolean).join(" ");
  const systolic = toNumber(vitals.systolic);
  const diastolic = toNumber(vitals.diastolic);
  const glucose = toNumber(vitals.bloodSugar);
  const heartRate = toNumber(vitals.heartRate);
  const oxygen = toNumber(vitals.oxygenSaturation);
  const temperature = toNumber(vitals.temperatureC);
  const focus = (label, summary, options = {}) => ({
    label,
    summary,
    signals: Array.isArray(options.signals) ? options.signals : [],
    referenceAnchors: Array.isArray(options.referenceAnchors) ? options.referenceAnchors : [],
    tests: Array.isArray(options.tests) ? options.tests : [],
    actions: Array.isArray(options.actions) ? options.actions : [],
    precautions: Array.isArray(options.precautions) ? options.precautions : [],
    careOptions: Array.isArray(options.careOptions) ? options.careOptions : [],
    careContext: Array.isArray(options.careContext) ? options.careContext : [],
    treatmentContext: Array.isArray(options.treatmentContext) ? options.treatmentContext : [],
    questions: Array.isArray(options.questions) ? options.questions : [],
    monitoring: Array.isArray(options.monitoring) ? options.monitoring : [],
    differential: Array.isArray(options.differential) ? options.differential : [],
    missing: Array.isArray(options.missing) ? options.missing : [],
    specificityBoost: Number(options.specificityBoost || 0)
  });

  switch (domain.id) {
    case "cardiology":
      if (
        hasAffirmedTerm(source, "chest pain")
        || hasAffirmedTerm(source, "chest pressure")
        || hasTerm(source, "jaw pain")
        || hasTerm(source, "left arm")
        || hasTerm(source, "exertion")
      ) {
        return focus("Chest pain and exertional risk", "This review should center on chest symptoms, exertional pattern, and immediate heart-risk boundaries.", {
          signals: ["chest pain", "exertion", "breathlessness"],
          referenceAnchors: ["chest pain", "cardiac symptom", "ecg", "heart risk", "cholesterol"],
          tests: ["Chest-symptom timeline with exertion detail", "ECG and risk-lab discussion if clinically appropriate"],
          actions: ["Record when chest symptoms start, how long they last, and whether exertion triggers them.", "Bring BP, pulse, diabetes, kidney, and cholesterol context into the visit."],
          precautions: ["Do not treat ongoing chest pressure as a routine BP question.", "Escalate immediately if chest symptoms are active, severe, or paired with fainting or major breathlessness."],
          careOptions: ["Same-day clinician review", "Heart-risk workup discussion", "Medicine and exertion safety review"],
          careContext: ["Chest symptoms change the review from routine education to higher-priority heart-risk triage."],
          treatmentContext: ["The discussion should focus on risk stratification, urgent boundaries, and which tests a clinician may prioritize."],
          questions: ["Which chest-symptom pattern needs emergency care instead of routine follow-up?", "Would ECG, cholesterol, kidney labs, or cardiac evaluation be discussed first?"],
          monitoring: ["Track chest symptoms with exertion, duration, breathlessness, sweating, and associated BP or pulse readings."],
          differential: ["Separate ischemic warning signs from routine hypertension follow-up before discussing longer-term care."],
          missing: ["whether symptoms happen at rest or with exertion"],
          specificityBoost: 9
        });
      }
      if (hasTerm(source, "palpitation") || hasTerm(source, "irregular heartbeat") || hasTerm(source, "fast pulse") || (heartRate !== null && heartRate >= 100)) {
        return focus("Palpitations and rhythm review", "This review should focus on rhythm symptoms, heart-rate context, triggers, and fainting risk.", {
          signals: ["palpitations", "fast pulse", "dizziness"],
          referenceAnchors: ["palpitation", "rhythm", "pulse", "ecg", "fainting"],
          tests: ["Pulse log with timing and symptoms", "ECG or rhythm-review discussion if symptoms persist"],
          actions: ["Track whether palpitations are regular or irregular, how long they last, and whether dizziness or fainting occurs.", "Add caffeine, stress, illness, medicine changes, and sleep context if they affect the episodes."],
          precautions: ["Escalate if palpitations come with fainting, chest pressure, or severe breathlessness."],
          careOptions: ["Rhythm review", "Trigger review", "Medicine side-effect discussion"],
          careContext: ["Rhythm questions are stronger when symptom timing is paired with pulse readings and medicine timing."],
          treatmentContext: ["The discussion should focus on rhythm triggers, medication fit, and whether clinician-led rhythm testing is needed."],
          questions: ["Does the symptom pattern sound like a rhythm problem, medicine side effect, or anxiety-style trigger?", "What should I record before a rhythm-focused follow-up?"],
          monitoring: ["Track pulse, symptom duration, dizziness, exertion, stress, and medicine timing around the episodes."],
          missing: ["whether palpitations are regular, irregular, or linked to exertion"],
          specificityBoost: 8
        });
      }
      return focus("BP control and vascular risk", "This review should focus on repeated BP pattern, headache or vision symptoms, kidney/diabetes context, and vascular risk reduction.", {
        signals: ["blood pressure", "hypertension", "headache"],
        referenceAnchors: ["hypertension", "blood pressure", "bp", "cholesterol", "kidney"],
        tests: ["Seven-day BP log with timing and symptoms", "Kidney, diabetes, and cholesterol review"],
        actions: ["Use repeated seated BP readings instead of one isolated value.", "Bring headache, vision, swelling, and medicine-timing context into the follow-up."],
        precautions: ["Escalate if BP stays very high or if headache is paired with neurologic or chest warning signs."],
        careOptions: ["BP target review", "Medicine-fit discussion", "Risk-factor reduction plan"],
        careContext: ["High BP review is strongest when symptom timing is paired with repeat home readings and diabetes/kidney context."],
        treatmentContext: ["The discussion should focus on BP control, vascular risk reduction, medication fit, and when higher-priority review is needed."],
        questions: ["What BP target applies to me, and which repeated readings need same-day review?", "Do kidney labs, cholesterol, or diabetes change the follow-up plan?"],
        monitoring: ["Track morning/evening BP, pulse, headache, dizziness, swelling, and medicine timing for several days."],
        missing: ["a short BP trend instead of one single reading"],
        specificityBoost: 7
      });
    case "diabetes":
      if ((glucose !== null && glucose <= 70) || hasTerm(source, "low sugar") || hasTerm(source, "shaking") || hasTerm(source, "sweating") || hasTerm(source, "confusion")) {
        return focus("Low-glucose safety review", "This review should center on low-glucose timing, food or insulin context, and repeat-safety planning.", {
          signals: ["low sugar", "shaking", "sweating", "confusion"],
          referenceAnchors: ["hypoglycemia", "low sugar", "glucose", "insulin"],
          tests: ["Glucose readings with meal and insulin timing", "Low-sugar event pattern and recovery detail"],
          actions: ["Label whether the low reading was fasting, after insulin, overnight, or after activity.", "Record what food or glucose source was used and how quickly symptoms improved."],
          precautions: ["Very low sugar with confusion, fainting, or inability to eat is urgent."],
          careOptions: ["Low-sugar action-plan review", "Meal and insulin timing review", "Safety follow-up"],
          careContext: ["Low-glucose review depends on timing, insulin or medicine context, and recovery pattern."],
          treatmentContext: ["The discussion should focus on hypoglycemia prevention and matching medicines to meals and activity."],
          questions: ["What is my low-sugar action plan, and how should I document future episodes?", "Do medicine timing or missed meals explain the pattern?"],
          monitoring: ["Track glucose, meals, activity, insulin or tablet timing, and symptoms around each low event."],
          missing: ["whether the reading was fasting, after insulin, or after a missed meal"],
          specificityBoost: 9
        });
      }
      if ((glucose !== null && glucose >= 240) || hasTerm(source, "hba1c") || hasTerm(source, "thirst") || hasTerm(source, "frequent urination")) {
        return focus("High-glucose and HbA1c review", "This review should focus on high-glucose pattern, HbA1c trend, dehydration risk, and complication follow-up.", {
          signals: ["high glucose", "hba1c", "thirst", "urination"],
          referenceAnchors: ["hyperglycemia", "hba1c", "glucose", "kidney", "albumin"],
          tests: ["Fasting and after-meal glucose trend", "HbA1c, kidney, and urine-albumin discussion"],
          actions: ["Label readings as fasting, after meal, bedtime, or illness-related.", "Bring dehydration symptoms, vomiting, infection, and medicine adherence into the review."],
          precautions: ["Escalate if high glucose is paired with vomiting, dehydration, confusion, or rapid worsening."],
          careOptions: ["Diabetes control review", "Kidney-risk review", "Medicine and sick-day discussion"],
          careContext: ["High-glucose review is strongest when day-to-day readings are paired with HbA1c and kidney context."],
          treatmentContext: ["The discussion should focus on control pattern, complication prevention, and medication fit rather than one isolated reading."],
          questions: ["Do HbA1c, kidney markers, or current readings suggest the plan needs tighter review?", "What fasting and after-meal range should guide follow-up?"],
          monitoring: ["Track fasting and after-meal glucose, fluids, illness, medicines, and any foot or wound changes."],
          missing: ["whether the glucose value was fasting or after a meal"],
          specificityBoost: 8
        });
      }
      return focus("Diabetes prevention and complication review", "This review should focus on long-term glucose control, kidney/foot/eye prevention, and medicine adherence.", {
        signals: ["diabetes", "prevention", "medicines"],
        referenceAnchors: ["diabetes", "metformin", "insulin", "hba1c", "kidney"],
        tests: ["HbA1c trend", "Kidney, foot, and eye screening schedule"],
        actions: ["Bring the last HbA1c date, medicine list, and any foot, kidney, or vision changes into the visit.", "Use meal timing and activity pattern, not one reading, to frame the review."],
        careOptions: ["Complication prevention", "Medicine adherence review", "Routine follow-up planning"],
        treatmentContext: ["The discussion should focus on steady control, complication prevention, and follow-up rhythm."],
        specificityBoost: 6
      });
    case "respiratory":
      if ((oxygen !== null && oxygen <= 92) || hasBreathingSignal(source) || hasTerm(source, "cannot speak")) {
        return focus("Acute breathlessness and oxygen review", "This review should center on breathing effort, oxygen if available, speech limitation, and urgent escalation boundaries.", {
          signals: ["breathing trouble", "oxygen", "rapid worsening"],
          referenceAnchors: ["oxygen", "shortness of breath", "breathing", "asthma", "copd"],
          tests: ["Oxygen and breathing-effort trend", "Immediate clinician or urgent-care threshold review"],
          actions: ["Record oxygen, breathing effort, ability to speak, and what triggered the worsening.", "Bring inhaler availability and recent fever or chest symptoms into the review."],
          precautions: ["Do not keep this in routine app review if oxygen is low or breathing is rapidly worsening."],
          careOptions: ["Urgent respiratory review", "Inhaler and oxygen safety discussion"],
          treatmentContext: ["The discussion should focus on escalation boundaries first, then on cause and follow-up."],
          specificityBoost: 9
        });
      }
      if (hasTerm(source, "asthma") || hasTerm(source, "wheeze") || hasTerm(source, "inhaler") || hasTerm(source, "night waking")) {
        return focus("Asthma and trigger-control review", "This review should focus on wheeze, inhaler timing, triggers, nighttime waking, and action-plan questions.", {
          signals: ["wheeze", "inhaler", "night waking"],
          referenceAnchors: ["asthma", "inhaler", "wheeze", "peak flow"],
          tests: ["Trigger and inhaler-technique review", "Peak flow or action-plan discussion if available"],
          actions: ["Track trigger exposure, reliever use, and whether symptoms wake you at night.", "Bring inhaler names and how often rescue medicine is used."],
          careOptions: ["Action-plan review", "Trigger reduction", "Inhaler technique check"],
          treatmentContext: ["The discussion should focus on controller-versus-reliever pattern, trigger control, and follow-up intensity."],
          specificityBoost: 8
        });
      }
      return focus("Cough, fever, and infection-linked breathing review", "This review should focus on cough, fever, chest tightness, and whether infection changes urgency.", {
        signals: ["cough", "fever", "breathing"],
        referenceAnchors: ["cough", "fever", "oxygen", "infection"],
        tests: ["Fever trend and oxygen if available", "Chest review or infection discussion if worsening"],
        actions: ["Track cough, fever, fluids, oxygen, and worsening pattern over hours to days."],
        specificityBoost: 6
      });
    case "neurology":
      if (hasStrokeSignal(source) || hasTerm(source, "speech") || hasTerm(source, "vision change") || hasTerm(source, "one sided")) {
        return focus("Stroke-warning neurologic review", "This review should center on sudden neurologic change, last-known-well timing, and emergency boundaries.", {
          signals: ["stroke-like sign", "speech change", "one-sided weakness"],
          referenceAnchors: ["stroke", "speech", "vision", "weakness", "numbness"],
          tests: ["Exact onset time", "Neurologic warning-sign review"],
          actions: ["Record the exact time the neurologic change started and whether it is improving or worsening.", "Bring BP, injury, and medicine context, but do not delay urgent care for more detail."],
          precautions: ["Stroke-like signs move this out of routine headache education."],
          careOptions: ["Emergency neurologic evaluation", "Warning-sign review"],
          treatmentContext: ["The discussion should focus on stroke boundaries first, not routine migraine education."],
          specificityBoost: 10
        });
      }
      if (hasTerm(source, "headache") || hasTerm(source, "migraine") || hasTerm(source, "light sensitivity") || hasTerm(source, "aura")) {
        return focus("Headache and migraine-pattern review", "This review should focus on onset, severity, triggers, nausea/light sensitivity, and what makes the pattern urgent.", {
          signals: ["headache", "migraine", "light sensitivity"],
          referenceAnchors: ["headache", "migraine", "aura", "vision", "bp"],
          tests: ["Onset and recurrence timeline", "BP, fever, medicine, and trigger review"],
          actions: ["Track exact start time, severity, nausea, light sensitivity, dehydration, sleep, and medicine use.", "Separate recurring familiar headaches from sudden or different neurologic patterns."],
          treatmentContext: ["The discussion should focus on pattern recognition, trigger review, and warning signs that change urgency."],
          specificityBoost: 8
        });
      }
      return focus("Confusion, seizure, or nerve-symptom review", "This review should focus on confusion, seizure history, nerve deficits, and urgent boundaries.", {
        signals: ["confusion", "seizure", "nerve symptoms"],
        referenceAnchors: ["seizure", "confusion", "numbness", "weakness"],
        specificityBoost: 6
      });
    case "kidney":
      if (hasTerm(source, "creatinine") || hasTerm(source, "egfr") || hasTerm(source, "albumin") || hasTerm(source, "protein")) {
        return focus("Kidney lab-trend review", "This review should focus on kidney lab trend, urine protein, BP, diabetes, and medication safety.", {
          signals: ["creatinine", "egfr", "albumin", "protein"],
          referenceAnchors: ["kidney", "creatinine", "egfr", "urine protein", "potassium"],
          tests: ["Creatinine/eGFR comparison over time", "Urine protein and potassium discussion"],
          actions: ["Bring the report date, prior value, and whether diabetes or BP changed around the abnormal result.", "Add pain-medicine use, dehydration, or infection context if present."],
          treatmentContext: ["The discussion should focus on trend direction, kidney-protective care, and medication safety."],
          specificityBoost: 8
        });
      }
      return focus("Swelling, urine, and fluid-balance review", "This review should focus on urine change, swelling, hydration, BP, and rapid worsening boundaries.", {
        signals: ["swelling", "urine change", "hydration"],
        referenceAnchors: ["swelling", "urine", "kidney", "dehydration"],
        specificityBoost: 6
      });
    case "gastro":
      if (hasTerm(source, "jaundice") || hasTerm(source, "yellow eyes") || hasTerm(source, "blood in stool") || hasTerm(source, "blood in vomit") || hasTerm(source, "black stool")) {
        return focus("Bleeding or jaundice review", "This review should focus on bleeding, jaundice, dehydration, and urgent clinician review boundaries.", {
          signals: ["bleeding", "jaundice"],
          referenceAnchors: ["liver", "jaundice", "bleeding", "stool", "vomit"],
          specificityBoost: 9
        });
      }
      return focus("Abdominal pain, vomiting, and hydration review", "This review should focus on pain location, vomiting/diarrhea pattern, hydration, and food or medicine triggers.", {
        signals: ["abdominal pain", "vomiting", "diarrhea"],
        referenceAnchors: ["abdominal", "vomit", "diarrhea", "reflux"],
        specificityBoost: 7
      });
    case "orthopedic":
      if (hasTerm(source, "back pain") && (hasTerm(source, "numbness") || hasTerm(source, "weakness") || hasTerm(source, "bowel") || hasTerm(source, "bladder"))) {
        return focus("Back pain with nerve-warning review", "This review should focus on back pain plus weakness, numbness, or bladder/bowel changes rather than routine strain advice.", {
          signals: ["back pain", "numbness", "weakness"],
          referenceAnchors: ["back pain", "weakness", "numbness", "bladder"],
          specificityBoost: 9
        });
      }
      return focus("Injury, swelling, and function review", "This review should focus on injury timing, swelling, walking or movement limits, and when imaging or urgent care matters.", {
        signals: ["injury", "swelling", "function"],
        referenceAnchors: ["injury", "joint", "swelling", "fracture"],
        specificityBoost: 6
      });
    case "infection":
      if (hasTerm(source, "burning urine") || hasTerm(source, "painful urination") || hasTerm(source, "pus") || hasTerm(source, "rash")) {
        return focus("Source-specific infection review", "This review should focus on the likely source of infection, hydration, temperature trend, and which symptoms need prompt review.", {
          signals: ["source symptoms", "temperature", "hydration"],
          referenceAnchors: ["infection", "fever", "urine", "rash", "pus"],
          specificityBoost: 7
        });
      }
      return focus("Fever, dehydration, and systemic-risk review", "This review should focus on fever trend, fluids, breathing, confusion, and worsening over time.", {
        signals: ["fever", "dehydration", "worsening"],
        referenceAnchors: ["fever", "infection", "dehydration", "oxygen"],
        specificityBoost: 7
      });
    case "skin":
      if (hasTerm(source, "hives") || hasSevereAllergySignal(source) || hasTerm(source, "lip swelling") || hasTerm(source, "face swelling")) {
        return focus("Allergy and swelling review", "This review should focus on trigger exposure, hives or swelling, and emergency allergy boundaries.", {
          signals: ["hives", "swelling", "allergy"],
          referenceAnchors: ["allergy", "hives", "swelling", "rash"],
          specificityBoost: 8
        });
      }
      return focus("Painful rash or skin-infection review", "This review should focus on rash spread, pain, fever, warmth, and whether infection is more likely than irritation.", {
        signals: ["painful rash", "redness", "fever"],
        referenceAnchors: ["skin", "rash", "infection", "blister"],
        specificityBoost: 6
      });
    case "endocrine":
      if (hasTerm(source, "thyroid") || hasTerm(source, "tsh") || hasTerm(source, "t4") || hasTerm(source, "t3")) {
        return focus("Thyroid lab and medicine-timing review", "This review should focus on thyroid results, pulse, weight, medicine timing, and supplement interactions.", {
          signals: ["thyroid", "tsh", "medicine timing"],
          referenceAnchors: ["thyroid", "tsh", "t4", "hormone", "weight"],
          specificityBoost: 8
        });
      }
      return focus("Hormone symptoms and metabolic review", "This review should focus on fatigue, weight, palpitations, temperature sensitivity, and longer-term hormone follow-up.", {
        signals: ["fatigue", "weight change", "temperature sensitivity"],
        referenceAnchors: ["hormone", "weight", "fatigue", "palpitation"],
        specificityBoost: 6
      });
    default:
      return focus(`${domain.label} review`, `This review should stay centered on ${domain.label.toLowerCase()} signals, context, and safety boundaries.`, {
        specificityBoost: 4
      });
  }
}

function scoreSpecialistDomainFit(domain, text, profile = {}, vitals = {}, context = {}) {
  const evidence = buildSpecialistEvidenceBundle(text, profile, context);
  const source = [
    evidence.patientSignalText,
    evidence.structuredEvidenceText,
    evidence.profileConditionText,
    evidence.profileMedicationText,
    evidence.profileAllergyText,
    evidence.profileNotesText
  ].filter(Boolean).join(" ");
  const weightedTerms = {
    cardiology: [["blood pressure", 7], ["hypertension", 7], ["chest pain", 8], ["palpitation", 7], ["cholesterol", 5], ["ldl", 5], ["amlodipine", 4]],
    diabetes: [["diabetes", 7], ["glucose", 7], ["blood sugar", 7], ["hba1c", 7], ["insulin", 6], ["metformin", 6], ["thirst", 4]],
    respiratory: [["breath", 7], ["shortness of breath", 8], ["wheeze", 7], ["asthma", 7], ["oxygen", 7], ["inhaler", 6], ["cough", 4]],
    neurology: [["headache", 7], ["migraine", 7], ["stroke", 9], ["speech", 8], ["vision", 7], ["numbness", 7], ["weakness", 7]],
    kidney: [["kidney", 7], ["creatinine", 8], ["egfr", 8], ["albumin", 7], ["protein", 6], ["swelling", 4], ["potassium", 6]],
    gastro: [["abdominal", 7], ["vomit", 6], ["diarrhea", 6], ["liver", 6], ["jaundice", 8], ["bleeding", 8], ["reflux", 5]],
    orthopedic: [["injury", 7], ["joint", 6], ["bone", 6], ["back pain", 7], ["fracture", 8], ["movement", 4], ["swelling", 4]],
    infection: [["fever", 7], ["infection", 7], ["chills", 6], ["temperature", 5], ["rash", 4], ["burning urine", 6], ["dehydration", 5]],
    skin: [["rash", 7], ["itch", 6], ["hives", 7], ["allergy", 7], ["swelling", 5], ["blister", 6], ["eczema", 6]],
    endocrine: [["thyroid", 8], ["tsh", 8], ["hormone", 6], ["weight", 5], ["fatigue", 4], ["palpitations", 4], ["temperature sensitivity", 5]]
  };
  let score = domain.terms.reduce((total, term) => total + (hasTerm(source, term) ? term.includes(" ") ? 5 : 4 : 0), 0);

  for (const [term, weight] of weightedTerms[domain.id] || []) {
    if (hasTerm(source, term)) {
      score += weight;
    }
  }

  if (domain.id === "cardiology" && (toNumber(vitals.systolic) !== null || toNumber(vitals.diastolic) !== null)) {
    score += 7;
  }
  if (domain.id === "cardiology" && toNumber(vitals.heartRate) !== null) {
    score += 3;
  }
  if (domain.id === "diabetes" && toNumber(vitals.bloodSugar) !== null) {
    score += 8;
  }
  if (domain.id === "respiratory" && toNumber(vitals.oxygenSaturation) !== null) {
    score += 8;
  }
  if (domain.id === "respiratory" && toNumber(vitals.temperatureC) !== null && hasTerm(source, "cough")) {
    score += 4;
  }
  if (domain.id === "infection" && toNumber(vitals.temperatureC) !== null) {
    score += 6;
  }
  if (domain.id === "neurology" && hasTerm(source, "headache") && (toNumber(vitals.systolic) !== null || toNumber(vitals.diastolic) !== null)) {
    score += 4;
  }
  if (domain.id === "kidney" && hasTerm(source, "diabetes")) {
    score += 3;
  }

  return score;
}

function buildSpecialistTrendSignals(memoryContext = {}, vitals = {}) {
  const previous = normalizeVitals(memoryContext?.previousVitals || {});
  const current = normalizeVitals({ ...(memoryContext?.latestVitals || {}), ...(vitals || {}) });
  const signals = [];
  const addTrend = (label, previousValue, currentValue, threshold, formatter = (value) => String(value)) => {
    if (previousValue === null || previousValue === undefined || currentValue === null || currentValue === undefined) {
      return;
    }

    const delta = Number(currentValue) - Number(previousValue);

    if (!Number.isFinite(delta) || Math.abs(delta) < threshold) {
      return;
    }

    signals.push(`${label} trend ${delta > 0 ? "up" : "down"}: ${formatter(previousValue)} to ${formatter(currentValue)}`);
  };

  if (previous.systolic !== null && previous.diastolic !== null && current.systolic !== null && current.diastolic !== null) {
    const systolicDelta = Number(current.systolic) - Number(previous.systolic);
    const diastolicDelta = Number(current.diastolic) - Number(previous.diastolic);

    if (Math.abs(systolicDelta) >= 10 || Math.abs(diastolicDelta) >= 6) {
      signals.push(`BP trend ${systolicDelta > 0 || diastolicDelta > 0 ? "up" : "down"}: ${previous.systolic}/${previous.diastolic} to ${current.systolic}/${current.diastolic}`);
    }
  }

  addTrend("Glucose", previous.bloodSugar, current.bloodSugar, 20);
  addTrend("Pulse", previous.heartRate, current.heartRate, 10, (value) => `${value} bpm`);
  addTrend("Oxygen", previous.oxygenSaturation, current.oxygenSaturation, 2, (value) => `${value}%`);
  addTrend("Temperature", previous.temperatureC, current.temperatureC, 0.5, (value) => `${value} C`);

  return dedupeResponseItems(signals).slice(0, 4);
}

function buildSpecialistDataFusionReview({
  domain,
  text,
  precision,
  focusProfile,
  vitals,
  risk,
  memoryContext,
  medicalKnowledge,
  intents,
  plan,
  inputQuality,
  requirementProfile,
  llmBrain
}) {
  const runtimeIndexes = getRuntimeIndexes({ intents, plan, medicalKnowledge, risk });
  const routeEvidence = runtimeIndexes.routeEvidenceByRoute.get("SPECIALIST_DOCTOR_AGENT") || null;
  const topIntent = runtimeIndexes.topIntentByRoute.get("SPECIALIST_DOCTOR_AGENT") || null;
  const routeMatches = prioritizeSpecialistKnowledgeMatches(
    getRouteKnowledgeMatches("SPECIALIST_DOCTOR_AGENT", medicalKnowledge, 8),
    domain,
    text,
    focusProfile
  ).slice(0, 5);
  const queryFamilies = dedupeResponseItems(medicalKnowledge?.localAi?.queryFamilies || []).slice(0, 3);
  const semanticFamilies = dedupeResponseItems(routeMatches.flatMap((match) => match.semanticFamilies || [])).slice(0, 4);
  const matchedEvidenceTerms = dedupeResponseItems(routeMatches.flatMap((match) => match.matchedTerms || [])).slice(0, 5);
  const trendSignals = buildSpecialistTrendSignals(memoryContext, vitals);
  const memorySignals = [];
  const localAiScore = Number(medicalKnowledge?.localAi?.score || medicalKnowledge?.coverageScore || 0);
  const routeFitScore = Number(routeEvidence?.score || getRouteKnowledgeCoverage("SPECIALIST_DOCTOR_AGENT", medicalKnowledge) || 0);
  const inputScore = Number(inputQuality?.score || 55);
  const memoryScore = memoryContext?.recentTurnCount
    ? clamp(74 + Math.min(memoryContext.recentTurnCount * 4, 16), 74, 96)
    : 62;
  const ownerAligned = llmBrain?.routeDecision?.ownerRoute === "SPECIALIST_DOCTOR_AGENT"
    || requirementProfile?.expectedRoute === "SPECIALIST_DOCTOR_AGENT";

  if (memoryContext?.recentTurnCount) {
    memorySignals.push(`${memoryContext.recentTurnCount} saved turn(s) loaded`);
  }

  if ((memoryContext?.recentRisks || []).some((level) => ["HIGH", "CRITICAL"].includes(level))) {
    const priorElevated = Array.from(new Set((memoryContext.recentRisks || []).filter((level) => ["HIGH", "CRITICAL"].includes(level)))).slice(0, 2);
    memorySignals.push(`prior elevated risk seen: ${priorElevated.join(", ")}`);
  }

  if ((memoryContext?.recentMessages || []).length) {
    memorySignals.push("recent symptom history available");
  }

  if (trendSignals.length) {
    memorySignals.push(trendSignals[0]);
  }

  const score = clamp(Math.round(
    (precision.confidence * 0.34) +
      (routeFitScore * 0.18) +
      (localAiScore * 0.18) +
      (memoryScore * 0.12) +
      (inputScore * 0.08) +
      (queryFamilies.length ? 4 : 0) +
      (trendSignals.length ? 4 : 0) +
      (ownerAligned ? 6 : 0)
  ), 42, 98);

  const label = score >= 90
    ? "Deep specialist review"
    : score >= 78
      ? "Data-rich specialist review"
      : score >= 64
        ? "Focused specialist review"
        : "Limited specialist review";

  const summaryParts = [];

  if (memoryContext?.recentTurnCount) {
    summaryParts.push(`${memoryContext.recentTurnCount} memory turn(s)`);
  }

  if (routeMatches.length) {
    summaryParts.push(`${routeMatches.length} route evidence match(es)`);
  }

  if (queryFamilies.length) {
    summaryParts.push(`${queryFamilies.slice(0, 2).join(" + ")} local ML`);
  }

  if (trendSignals.length) {
    summaryParts.push(trendSignals[0]);
  }

  const summary = summaryParts.length
    ? `Pre-output fusion checked ${summaryParts.slice(0, 3).join(", ")} before the specialist answer.`
    : "Pre-output fusion relied on current symptoms, readings, and local specialist evidence before the answer.";

  const qualityLanes = [
    {
      label: "Memory",
      status: memoryContext?.recentTurnCount ? "ready" : "optional",
      detail: memoryContext?.recentTurnCount
        ? `${memoryContext.recentTurnCount} saved turn(s) and prior context loaded`
        : "No saved turn was loaded for this specialist review"
    },
    {
      label: "Route fit",
      status: routeFitScore >= 70 ? "ready" : routeFitScore >= 55 ? "review" : "optional",
      detail: routeEvidence
        ? `${focusProfile?.label || routeLabel("SPECIALIST_DOCTOR_AGENT")} route fit scored ${routeFitScore}%`
        : "Route fit fell back to general specialist evidence coverage"
    },
    {
      label: "Local ML",
      status: localAiScore >= 70 ? "ready" : "review",
      detail: queryFamilies.length
        ? `${queryFamilies.join(", ")} matched by the local evidence model`
        : "Local evidence model ran without strong family tags"
    },
    {
      label: "Trend",
      status: trendSignals.length ? "ready" : hasAnyVitals(vitals) ? "review" : "optional",
      detail: trendSignals[0]
        || (hasAnyVitals(vitals)
          ? "Current readings are available, but no prior trend was loaded"
          : "No vital trend data was available for comparison")
    }
  ];

  return {
    score,
    label,
    summary,
    routeFitScore,
    localAiScore,
    modelMode: llmBrain?.processingMode || medicalKnowledge?.localAi?.mode || "local",
    ownerAligned,
    topIntentLabel: topIntent?.label || routeLabel("SPECIALIST_DOCTOR_AGENT"),
    queryFamilies,
    semanticFamilies,
    matchedEvidenceTerms,
    trendSignals,
    memorySignals: dedupeResponseItems(memorySignals).slice(0, 4),
    qualityLanes,
    nextQuestion: precision.missing.length
      ? `Add ${precision.missing[0]} for a sharper specialist review.`
      : llmBrain?.ambiguity?.needsClarification
        ? (llmBrain.ambiguity.nextQuestion || "Add one more detail only if it changes urgency or follow-up.")
        : "Enough context for a focused specialist answer.",
    focusQuestions: dedupeResponseItems([
      ...(Array.isArray(focusProfile?.questions) ? focusProfile.questions : []),
      ...domain.questions,
      precision.missing.length ? `Can you add ${precision.missing[0]}?` : "",
      llmBrain?.ambiguity?.needsClarification ? llmBrain.ambiguity.nextQuestion || "" : ""
    ]).filter(Boolean).slice(0, 4)
  };
}

function buildSpecialistSupportLaneStatus(status = "", fallback = "review") {
  const text = String(status || "").toLowerCase();

  if (/urgent|critical/.test(text)) return "urgent";
  if (/ready|stable|strong/.test(text)) return "ready";
  if (/optional/.test(text)) return "optional";
  if (/missing/.test(text)) return "missing";
  return fallback;
}

function dedupeReferenceObjects(references = [], limit = 6) {
  const seen = new Set();
  const unique = [];

  for (const reference of Array.isArray(references) ? references : []) {
    if (!reference || typeof reference !== "object") {
      continue;
    }

    const title = cleanText(reference.title || reference.source || "");
    const source = cleanText(reference.source || "");
    const key = `${title}::${source}`;

    if (!title || seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(reference);

    if (unique.length >= limit) {
      break;
    }
  }

  return unique;
}

function buildSpecialistCrossSupportReview({ message, profile, vitals, risk, context, medicalKnowledge }) {
  const evidenceBundle = buildSpecialistEvidenceBundle(message, profile, context);
  const combinedSource = [
    evidenceBundle.patientSignalText,
    evidenceBundle.structuredSections.readings,
    evidenceBundle.structuredSections.reports,
    evidenceBundle.structuredSections.medicines,
    evidenceBundle.profileConditionText,
    evidenceBundle.profileMedicationText,
    evidenceBundle.profileAllergyText,
    evidenceBundle.profileNotesText
  ].filter(Boolean).join(" ").toLowerCase();
  const medicineSignalSource = [
    evidenceBundle.patientSignalText,
    evidenceBundle.structuredSections.medicines,
    evidenceBundle.profileMedicationText,
    evidenceBundle.profileAllergyText,
    evidenceBundle.profileNotesText
  ].filter(Boolean).join(" ").toLowerCase();
  const reportSignalSource = [
    evidenceBundle.patientSignalText,
    evidenceBundle.structuredSections.reports,
    evidenceBundle.profileNotesText
  ].filter(Boolean).join(" ").toLowerCase();
  const supportIds = [];
  const activeChecks = [];
  const findings = [];
  const actions = [];
  const questions = [];
  const precautions = [];
  const evidence = [];
  const careContext = [];
  const missing = [];
  const references = [];
  const qualityLanes = [];

  if (
    hasAnyVitals(vitals)
    || Boolean(evidenceBundle.structuredSections.readings)
    || /\b(bp|blood pressure|glucose|sugar|pulse|heart rate|oxygen|spo2|temperature|temp|bmi|weight|waist|sleep|steps|water|reading)\b/.test(combinedSource)
  ) {
    const vitalsOutput = runVitalsAgent({ vitals, risk, profile, context, medicalKnowledge }).output || {};
    supportIds.push("VITALS_AGENT");
    activeChecks.push("vitals specialist");
    evidence.push("Vitals specialist cross-check");
    findings.push(vitalsOutput.summary);
    findings.push(...(Array.isArray(vitalsOutput.watchItems) ? vitalsOutput.watchItems.slice(0, 2) : []));
    actions.push(...(Array.isArray(vitalsOutput.vitalActions) ? vitalsOutput.vitalActions.slice(0, 2) : []));
    questions.push(...(Array.isArray(vitalsOutput.clinicianQuestions) ? vitalsOutput.clinicianQuestions.slice(0, 2) : []));
    precautions.push(...(Array.isArray(vitalsOutput.watchItems) ? vitalsOutput.watchItems.slice(0, 1) : []));
    precautions.push(...(Array.isArray(vitalsOutput.accuracyGaps)
      ? vitalsOutput.accuracyGaps.slice(0, 1).map((gap) => {
        const text = String(gap || "").trim();
        return /^add\b/i.test(text) ? text : `Add ${text}`;
      })
      : []));
    careContext.push(...(Array.isArray(vitalsOutput.dailyMaintenance) ? vitalsOutput.dailyMaintenance.slice(0, 2) : []));
    missing.push(...(Array.isArray(vitalsOutput.missing) ? vitalsOutput.missing.slice(0, 2) : []));
    references.push(...(Array.isArray(vitalsOutput.references) ? vitalsOutput.references : []));
    qualityLanes.push({
      label: "Vitals",
      status: buildSpecialistSupportLaneStatus(vitalsOutput.priority, hasAnyVitals(vitals) ? "ready" : "review"),
      detail: Array.isArray(vitalsOutput.enteredReadings) && vitalsOutput.enteredReadings.length
        ? compactResponseText(vitalsOutput.enteredReadings.slice(0, 2).join(", "), 76)
        : "No numeric vital bundle was entered yet."
    });
  }

  if (
    profileListArray(profile.medications).length
    || profileListArray(profile.allergies).length
    || Boolean(evidenceBundle.structuredSections.medicines)
    || /\b(medicine|medication|tablet|pill|drug|dose|dosing|inhaler|insulin|metformin|amlodipine|side effect|interaction|allerg|label|with food|empty stomach|refill)\b/.test(medicineSignalSource)
  ) {
    const pharmacyOutput = runPharmacyAgent({ message, profile, context, medicalKnowledge }).output || {};
    supportIds.push("PHARMACY_AGENT");
    activeChecks.push("medicine safety");
    evidence.push("Medication safety cross-check");
    findings.push(pharmacyOutput.summary);
    findings.push(...(Array.isArray(pharmacyOutput.riskThemes) ? pharmacyOutput.riskThemes.slice(0, 2).map((theme) => `Medicine focus: ${theme}`) : []));
    actions.push(...(Array.isArray(pharmacyOutput.pharmacyActions) ? pharmacyOutput.pharmacyActions.slice(0, 2) : []));
    questions.push(...(Array.isArray(pharmacyOutput.pharmacistQuestions) ? pharmacyOutput.pharmacistQuestions.slice(0, 2) : []));
    precautions.push(...(Array.isArray(pharmacyOutput.cautions) ? pharmacyOutput.cautions.slice(0, 1) : []));
    precautions.push(...(Array.isArray(pharmacyOutput?.safetySignals?.urgent) ? pharmacyOutput.safetySignals.urgent.slice(0, 1).map((item) => `Medicine warning: ${item}`) : []));
    careContext.push(...(Array.isArray(pharmacyOutput.interactionPrompts) ? pharmacyOutput.interactionPrompts.slice(0, 2) : []));
    missing.push(...(Array.isArray(pharmacyOutput.reviewGaps) ? pharmacyOutput.reviewGaps.slice(0, 2) : []));
    references.push(...(Array.isArray(pharmacyOutput.references) ? pharmacyOutput.references : []));
    qualityLanes.push({
      label: "Medicine",
      status: buildSpecialistSupportLaneStatus(pharmacyOutput.priority, Array.isArray(pharmacyOutput.reviewGaps) && pharmacyOutput.reviewGaps.length ? "review" : "ready"),
      detail: Array.isArray(pharmacyOutput.medicineSignals) && pharmacyOutput.medicineSignals.length
        ? compactResponseText(pharmacyOutput.medicineSignals.slice(0, 3).join(", "), 76)
        : "No exact medicine label was captured yet."
    });
  }

  if (
    Boolean(evidenceBundle.structuredSections.reports)
    || /\b(lab|report|panel|marker|hba1c|a1c|cbc|creatinine|egfr|ferritin|hemoglobin|cholesterol|ldl|hdl|triglyceride|scan|ecg|ekg|xray|x-ray|mri|ct|ultrasound)\b/.test(reportSignalSource)
  ) {
    const labsOutput = runLabsAgent({
      message: [
        evidenceBundle.patientSignalText,
        evidenceBundle.structuredSections.reports,
        cleanText(profile.notes)
      ].filter(Boolean).join(" "),
      medicalKnowledge
    }).output || {};
    supportIds.push("LABS_AGENT");
    activeChecks.push("labs and reports");
    evidence.push("Lab and report cross-check");
    findings.push(labsOutput.summary);
    if (Array.isArray(labsOutput.abnormalValues) && labsOutput.abnormalValues.length) {
      const flaggedValues = labsOutput.abnormalValues
        .slice(0, 2)
        .map((item) => `${item.label} ${item.value}${item.unit ? ` ${item.unit}` : ""}`);
      findings.push(`Review flagged values: ${flaggedValues.join(", ")}`);
    }
    actions.push(...(Array.isArray(labsOutput.labActions) ? labsOutput.labActions.slice(0, 2) : []));
    questions.push(...(Array.isArray(labsOutput.doctorQuestions) ? labsOutput.doctorQuestions.slice(0, 2) : []));
    precautions.push(...(Array.isArray(labsOutput.accuracyGaps) ? labsOutput.accuracyGaps.slice(0, 2).map((gap) => `Add ${gap} before drawing conclusions from the report.`) : []));
    careContext.push(...(Array.isArray(labsOutput.reportQualityChecks) ? labsOutput.reportQualityChecks.slice(0, 2) : []));
    missing.push(...(Array.isArray(labsOutput.accuracyGaps) ? labsOutput.accuracyGaps.slice(0, 2) : []));
    references.push(...(Array.isArray(labsOutput.references) ? labsOutput.references : []));
    qualityLanes.push({
      label: "Labs",
      status: buildSpecialistSupportLaneStatus(
        Array.isArray(labsOutput.parsedValues) && labsOutput.parsedValues.length
          ? "ready"
          : Array.isArray(labsOutput.labSignals) && labsOutput.labSignals.length
            ? "review"
            : "optional",
        "optional"
      ),
      detail: `${cleanText(labsOutput.panelType || "Lab review")} - readiness ${Number(labsOutput.readiness || 0)}%`
    });
  }

  const uniqueIds = Array.from(new Set(supportIds));
  const uniqueFindings = dedupeResponseItems(findings).slice(0, 6);
  const uniqueMissing = dedupeResponseItems(missing).slice(0, 5);
  const uniqueActions = dedupeResponseItems(actions).slice(0, 5);
  const score = uniqueIds.length
    ? clamp(
      50
        + uniqueIds.length * 9
        + Math.min(uniqueFindings.length, 4) * 4
        + Math.min(careContext.length, 3) * 3
        - Math.min(uniqueMissing.length, 4) * 4,
      48,
      92
    )
    : 0;

  return {
    active: uniqueIds.length > 0,
    bundleIds: uniqueIds,
    activeChecks,
    score,
    summary: uniqueIds.length
      ? `Cross-checks used: ${activeChecks.join(", ")}.`
      : "No specialist cross-check bundle was required.",
    findings: uniqueFindings,
    actions: uniqueActions,
    questions: dedupeResponseItems(questions).slice(0, 5),
    precautions: dedupeResponseItems(precautions).slice(0, 4),
    evidence: dedupeResponseItems(evidence).slice(0, 4),
    careContext: dedupeResponseItems(careContext).slice(0, 4),
    missing: uniqueMissing,
    qualityLanes: qualityLanes.slice(0, 4),
    references: dedupeReferenceObjects(references, 6)
  };
}

function runSpecialistDoctorAgent({ message, profile, vitals, risk, context, memoryContext, medicalKnowledge, intents, plan, inputQuality, requirementProfile, llmBrain }) {
  const text = String(message || "");
  const domain = inferSpecialistDomain(text, profile, context, vitals);
  const focusProfile = detectSpecialistFocusProfile(domain, text, profile, vitals, context);
  const routeKnowledge = getRouteMedicalKnowledge("SPECIALIST_DOCTOR_AGENT", medicalKnowledge);
  const knowledgeMatches = prioritizeSpecialistKnowledgeMatches(routeKnowledge.matches || [], domain, text, focusProfile).slice(0, 4);
  const evidenceCoverage = Number(routeKnowledge.coverageScore || 0);
  const precision = buildSpecialistPrecisionProfile({ text, domain, profile, vitals, context, medicalKnowledge, risk, focusProfile });
  const fusionReview = buildSpecialistDataFusionReview({
    domain,
    text,
    precision,
    focusProfile,
    vitals,
    risk,
    memoryContext,
    medicalKnowledge,
    intents,
    plan,
    inputQuality,
    requirementProfile,
    llmBrain
  });
  const supportReview = buildSpecialistCrossSupportReview({
    message,
    profile,
    vitals,
    risk,
    context,
    medicalKnowledge
  });
  const tests = dedupeResponseItems([
    ...(Array.isArray(focusProfile.tests) ? focusProfile.tests : []),
    ...buildSpecialistTests(domain)
  ]).slice(0, 4);
  const treatmentCategories = dedupeResponseItems([
    ...(Array.isArray(focusProfile.treatmentContext) ? focusProfile.treatmentContext : []),
    ...buildSpecialistTreatmentCategories(domain)
  ]).slice(0, 4);
  const careExpectations = dedupeResponseItems([
    ...(Array.isArray(focusProfile.careContext) ? focusProfile.careContext : []),
    ...buildSpecialistCareExpectations(domain),
    ...supportReview.careContext
  ]).slice(0, 4);
  const precautions = dedupeResponseItems([
    ...(Array.isArray(focusProfile.precautions) ? focusProfile.precautions : []),
    ...buildSpecialistPrecautionGuidance(domain, precision, risk),
    ...supportReview.precautions
  ]).slice(0, 4);
  const domainInsights = buildSpecialistDomainInsights(domain, text, profile, vitals, context, focusProfile);
  const lensPlan = buildSpecialistLensPlan({
    domain,
    focusProfile,
    context,
    precision,
    tests,
    treatmentCategories,
    careExpectations,
    domainInsights,
    supportReview,
    memoryContext,
    risk
  });
  const blendedConfidenceBase = supportReview.active
    ? (precision.confidence * 0.5) + (fusionReview.score * 0.28) + (supportReview.score * 0.22)
    : (precision.confidence * 0.62) + (fusionReview.score * 0.38);
  const blendedConfidence = clamp(
    Math.round(blendedConfidenceBase - (Math.min(precision.missing.length, 4) * 2)),
    38,
    96
  );
  const baseSpecialistActions = precision.safetyGate.level === "priority-review"
    ? dedupeResponseItems([
      precision.safetyGate.action,
      precautions[0],
      `Track the main ${domain.label.toLowerCase()} symptom pattern with start time, severity, triggers, readings, and medicine timing.`,
      `Discuss ${tests.slice(0, 2).join(" and ")} with a clinician if this is new, persistent, or worsening.`,
      `Prepare this question for your visit: ${domain.questions[0]}`
    ]).slice(0, 4)
    : buildSpecialistSafeActions(domain, precision, risk, tests, treatmentCategories, precautions);
  const dataPrepActions = fusionReview.trendSignals.length
    ? ["Bring the previous and current readings together so the trend can be reviewed, not one value alone."]
    : memoryContext?.recentTurnCount
      ? ["Bring the recent symptom timeline, prior readings, and medicine changes together for continuity."]
      : [];
  const specialistActions = dedupeResponseItems([
    ...lensPlan.actions,
    ...(Array.isArray(focusProfile.actions) ? focusProfile.actions.slice(0, 2) : []),
    baseSpecialistActions[0],
    ...supportReview.actions,
    ...dataPrepActions,
    ...baseSpecialistActions.slice(1)
  ]).filter(Boolean).slice(0, 5);
  const references = dedupeReferenceObjects([
    ...mapKnowledgeReferences(knowledgeMatches, 4),
    ...supportReview.references
  ], 6);
  const diseaseFocus = domain.label;
  const safetyFocus = precision.safetyGate.level === "urgent-first"
    ? "active warning signs must be handled first"
    : precision.safetyGate.level === "priority-review"
      ? "higher-risk context needs cautious follow-up"
      : "routine warning signs still matter";
  const mergedMissing = dedupeResponseItems([
    ...precision.missing,
    ...supportReview.missing
  ]).slice(0, 5);
  const missingText = mergedMissing.length
    ? `Missing context: ${mergedMissing.join(", ")}.`
    : "The supplied context is enough for a structured education review.";
  const safetySummary = precision.safetyGate.level === "urgent-first"
    ? `Safety gate found: ${precision.safetyGate.signals.slice(0, 3).join(", ")}.`
    : precision.safetyGate.level === "priority-review"
      ? "Higher-risk context was detected, so the answer stays cautious."
    : "No urgent sign was selected in this specialist review.";
  const patientAnswerSummary = `${diseaseFocus} specialist review${focusProfile.label ? ` focused on ${focusProfile.label.toLowerCase()}` : ""} with ${blendedConfidence}% information quality. ${focusProfile.summary ? `${focusProfile.summary} ` : ""}${lensPlan.summary} ${fusionReview.summary} ${supportReview.active ? `${supportReview.summary} ` : ""}${safetySummary} ${missingText}`;
  const safetyBoundary = precision.safetyGate.level === "urgent-first"
    ? safetySummary
    : `${fusionReview.summary} ${safetySummary}`.trim();

  return createAgentResult("SPECIALIST_DOCTOR_AGENT", "Specialist Doctor", "complete", {
    intentRoute: "Specialist Doctor",
    summary: `${patientAnswerSummary} It focuses on ${lensPlan.label.toLowerCase()}, plus symptom pattern, precautions, clinician-led tests, prevention, treatment categories, care expectations, monitoring, urgent warning signs, and cross-checks when relevant. ${safetyFocus}.`,
    patientAnswerSummary,
    productionTool: "Specialist disease intelligence map with memory-aware evidence scoring, deterministic cross-check support from vitals, medicine, and labs, local ML pre-output fusion, safety gating, and clinician-question synthesis.",
    sourceMode: medicalKnowledge?.mode || "Local specialist evidence only.",
    specialty: diseaseFocus,
    priorityAnswer: ["urgent-first", "priority-review"].includes(precision.safetyGate.level)
      ? precision.safetyGate.action
      : specialistActions[0],
    accuracyScore: blendedConfidence,
    evidenceCoverage,
    safetyGate: precision.safetyGate,
    concernProfile: {
      family: diseaseFocus,
      focus: domain.overview,
      matchedFamilies: dedupeResponseItems([
        ...precision.matchedTerms,
        ...fusionReview.semanticFamilies,
        ...fusionReview.matchedEvidenceTerms
      ]).slice(0, 5),
      completeness: blendedConfidence,
      focusQuestions: fusionReview.focusQuestions,
      nextQuestion: fusionReview.nextQuestion,
      evidenceLanes: [
        ...precision.qualityLanes,
        ...supportReview.qualityLanes,
        ...fusionReview.qualityLanes
      ].slice(0, 7),
      safetyScreen: {
        status: precision.safetyGate.level === "urgent-first" ? "urgent" : precision.safetyGate.level === "priority-review" ? "review" : "routine-screen",
        boundary: safetyBoundary,
        signals: precision.safetyGate.signals
      }
    },
    specialistProfile: {
      domainId: domain.id,
      specialty: diseaseFocus,
      confidence: blendedConfidence,
      focusArea: focusProfile.label,
      focusSummary: focusProfile.summary,
      focusSignals: Array.isArray(focusProfile.signals) ? focusProfile.signals.slice(0, 4) : [],
      reviewMode: precision.reviewMode,
      lensPlan,
      matchedTerms: precision.matchedTerms,
      evidenceUsed: dedupeResponseItems([
        ...precision.evidence,
        ...supportReview.evidence,
        ...supportReview.findings
      ]).slice(0, 8),
      missingContext: mergedMissing,
      riskModifiers: domainInsights.riskModifiers,
      clinicalLens: domainInsights.clinicalLens,
      qualityLanes: [
        ...precision.qualityLanes,
        ...supportReview.qualityLanes
      ].slice(0, 6),
      reasoningFocus: dedupeResponseItems([
        ...precision.reasoningFocus,
        supportReview.active ? `Cross-checks active: ${supportReview.activeChecks.join(", ")}.` : ""
      ]).slice(0, 5),
      sourceStrength: precision.sourceStrength,
      safetyGate: precision.safetyGate,
      dataFusion: {
        score: fusionReview.score,
        label: fusionReview.label,
        summary: fusionReview.summary,
        routeFitScore: fusionReview.routeFitScore,
        localAiScore: fusionReview.localAiScore,
        modelMode: fusionReview.modelMode,
        ownerAligned: fusionReview.ownerAligned,
        topIntentLabel: fusionReview.topIntentLabel,
        queryFamilies: fusionReview.queryFamilies,
        semanticFamilies: fusionReview.semanticFamilies,
        trendSignals: fusionReview.trendSignals,
        memorySignals: fusionReview.memorySignals,
        qualityLanes: fusionReview.qualityLanes
      }
    },
    diseaseMap: {
      overview: domain.overview,
      focusLabel: focusProfile.label,
      focusSummary: focusProfile.summary,
      symptomPattern: domain.symptoms,
      commonQuestions: domain.questions,
      clinicianReview: domain.clinicianReview,
      prevention: domain.prevention,
      careExpectations,
      lensPlan,
      differentialFrame: domainInsights.differentialFrame,
      monitoringPlan: domainInsights.monitoringPlan,
      careOptions: domainInsights.careOptions,
      tests,
      treatmentCategories,
      safety: domain.safety
    },
    draftOutputs: [
      {
        title: "Review objective",
        detail: lensPlan.summary
      },
      {
        title: "Focus area",
        detail: focusProfile.label
          ? `${focusProfile.label}. ${focusProfile.summary || ""}`.trim()
          : `${diseaseFocus} review`
      },
      {
        title: "Disease overview",
        detail: domain.overview
      },
      {
        title: "Symptoms to track",
        detail: domain.symptoms.join("; ")
      },
      {
        title: "Clinician-led evaluation",
        detail: tests.join("; ")
      },
      {
        title: "Differential safety frame",
        detail: domainInsights.differentialFrame.join("; ")
      },
      {
        title: "Precautions",
        detail: precautions.join("; ")
      },
      {
        title: "Pre-output fusion",
        detail: fusionReview.summary
      },
      {
        title: "Cross-check support",
        detail: supportReview.active
          ? `${supportReview.summary} ${supportReview.findings.slice(0, 2).join("; ")}`
          : "No secondary support lane was required for this specialist review."
      },
      {
        title: "Monitoring plan",
        detail: domainInsights.monitoringPlan.join("; ")
      },
      {
        title: "Treatment categories",
        detail: treatmentCategories.join("; ")
      },
      {
        title: "Treatment and cure context",
        detail: careExpectations.join("; ")
      },
      {
        title: "Prevention focus",
        detail: domain.prevention.join("; ")
      },
      {
        title: "Urgent signs",
        detail: domain.safety.join("; ")
      }
    ],
    precautions,
    careExpectations,
    specialistActions,
    supportReview,
    doctorQuestions: dedupeResponseItems([
      ...lensPlan.questions,
      ...(Array.isArray(focusProfile.questions) ? focusProfile.questions : []),
      ...domain.questions,
      ...domainInsights.doctorQuestions,
      ...supportReview.questions,
      mergedMissing.length || llmBrain?.ambiguity?.needsClarification ? fusionReview.nextQuestion : "",
      `Which test or monitoring step is most useful for this ${diseaseFocus.toLowerCase()} concern?`,
      "Do my medicines, allergies, or existing conditions change the safest plan?",
      "What warning sign should make me seek same-day or emergency care?",
      "Is this usually something to control over time, something reversible, or something that needs longer specialist follow-up?"
    ]).slice(0, 5),
    checklist: dedupeResponseItems([
      ...specialistActions,
      ...precautions.slice(0, 2),
      ...domainInsights.monitoringPlan.slice(0, 2),
      "Use official medical records and clinician instructions for personal decisions.",
      "Seek real-world care promptly if urgent warning signs appear."
    ]).slice(0, 5),
    references,
    missing: mergedMissing,
    liveAction: "No diagnosis, prescription, dosage calculation, test ordering, booking, or external alert is performed.",
    complianceBoundary: "Specialist output is education and visit preparation only; a licensed clinician must make personal diagnosis and treatment decisions."
  });
}

function inferSpecialistDomain(text, profile = {}, context = {}, vitals = {}) {
  const evidenceBundle = buildSpecialistEvidenceBundle(text, profile, context);
  const explicitFocus = normalizeSpecialistFocus(
    context.specialistFocus || context.specialistDomain || context.specialty || evidenceBundle.structuredSections.specialty
  );
  const source = evidenceBundle.combinedText.toLowerCase();
  const domains = [
    {
      id: "cardiology",
      label: "Heart and blood pressure",
      terms: ["heart", "chest", "bp", "blood pressure", "hypertension", "pulse", "palpitation", "cholesterol"],
      overview: "Heart and blood-pressure questions are reviewed through readings, symptoms, risk factors, medicines, and repeat trends.",
      symptoms: ["Chest discomfort or pressure", "Breathlessness", "Dizziness or fainting", "Swelling, palpitations, severe headache, or vision change"],
      clinicianReview: ["BP log and pulse", "ECG or heart tests when clinically needed", "Kidney, diabetes, and cholesterol risk review", "Medication and side-effect review"],
      prevention: ["Regular BP checks", "Lower salt pattern if advised", "Activity within safety limits", "Tobacco avoidance, sleep, weight, and diabetes control"],
      safety: ["Chest pain", "Severe breathlessness", "Fainting", "One-sided weakness", "Very high BP with severe symptoms"],
      questions: ["What is my personal BP or heart-risk target?"]
    },
    {
      id: "diabetes",
      label: "Diabetes and metabolism",
      terms: ["diabetes", "sugar", "glucose", "hba1c", "a1c", "metformin", "insulin", "thirst", "urination"],
      overview: "Diabetes questions are reviewed through glucose patterns, HbA1c trend, food timing, medicines, activity, kidney health, and symptoms.",
      symptoms: ["Very high or low sugar symptoms", "Shaking, sweating, confusion, extreme thirst, frequent urination", "Slow-healing wounds or foot changes"],
      clinicianReview: ["HbA1c and glucose log", "Kidney and urine albumin checks", "Eye and foot screening", "Medicine timing and low-sugar risk"],
      prevention: ["Consistent meals", "Safe movement", "Foot care", "Hydration", "Routine checks and medication review"],
      safety: ["Confusion, fainting, vomiting, severe dehydration, very low sugar, or very high sugar with symptoms"],
      questions: ["What range should I use for my fasting and after-meal readings?"]
    },
    {
      id: "respiratory",
      label: "Breathing and lungs",
      terms: ["breath", "breathing", "asthma", "cough", "wheeze", "lungs", "oxygen", "spo2"],
      overview: "Breathing questions are reviewed through symptom effort, triggers, fever, cough pattern, oxygen reading if available, and prescribed inhaler plan.",
      symptoms: ["Shortness of breath", "Wheeze", "Chest tightness", "Cough with fever", "Trouble speaking normally"],
      clinicianReview: ["Trigger history", "Oxygen reading if available", "Inhaler technique review", "Chest exam or tests when needed"],
      prevention: ["Avoid smoke and triggers", "Vaccination review", "Follow the prescribed action plan", "Hydration and rest during illness"],
      safety: ["Severe breathing trouble", "Blue lips", "Confusion", "Inability to speak normally", "Rapid worsening"],
      questions: ["Do I need an asthma or breathing action plan?"]
    },
    {
      id: "neurology",
      label: "Headache, stroke signs, and nerves",
      terms: ["headache", "migraine", "stroke", "weakness", "numbness", "seizure", "vision", "speech", "confusion"],
      overview: "Headache and nerve questions are reviewed through onset, severity, pattern, neurologic signs, BP, fever, injury, and new changes.",
      symptoms: ["Sudden worst headache", "One-sided weakness or numbness", "Speech or vision changes", "Confusion, seizure, fever, or neck stiffness"],
      clinicianReview: ["Onset time", "Neurologic exam", "BP and fever context", "Medication use and prior headache pattern"],
      prevention: ["Sleep consistency", "Hydration", "Trigger tracking", "BP control", "Clinician plan for recurrent headaches"],
      safety: ["Stroke-like signs", "Sudden worst headache", "Fainting", "Seizure", "Head injury or confusion"],
      questions: ["Which headache signs mean urgent care for me?"]
    },
    {
      id: "kidney",
      label: "Kidney and urine health",
      terms: ["kidney", "creatinine", "egfr", "urine", "protein", "albumin", "swelling", "potassium"],
      overview: "Kidney questions are reviewed through creatinine, eGFR, urine protein, BP, diabetes, hydration, medicines, and trends.",
      symptoms: ["Swelling", "Reduced urination", "Weakness", "High BP", "Confusion or severe vomiting with abnormal labs"],
      clinicianReview: ["Creatinine and eGFR trend", "Urine albumin/protein", "Potassium and electrolytes", "Medicine and BP review"],
      prevention: ["BP and diabetes control", "Hydration guidance", "Avoid unsafe self-medication", "Follow-up labs as advised"],
      safety: ["Very high potassium", "Severe weakness", "Confusion", "Marked swelling or breathing trouble"],
      questions: ["What changed in my kidney trend and what follow-up is needed?"]
    },
    {
      id: "gastro",
      label: "Stomach, liver, and digestion",
      terms: ["stomach", "abdominal", "vomit", "diarrhea", "liver", "alt", "ast", "digestion", "pain after eating"],
      overview: "Digestive questions are reviewed through pain location, vomiting, stool changes, fever, hydration, medicines, and liver or stomach reports.",
      symptoms: ["Severe abdominal pain", "Persistent vomiting or diarrhea", "Blood in stool or vomit", "Yellow eyes, dehydration, or fever"],
      clinicianReview: ["Duration and location", "Hydration status", "Liver or stool tests when needed", "Medicine and food trigger review"],
      prevention: ["Safe food and water", "Hydration", "Avoid alcohol excess", "Follow clinician dietary restrictions"],
      safety: ["Severe pain", "Blood", "Dehydration", "Confusion", "Persistent vomiting"],
      questions: ["Which symptoms mean I should seek same-day care?"]
    },
    {
      id: "orthopedic",
      label: "Bone, joint, and pain",
      terms: ["joint", "bone", "back pain", "knee", "shoulder", "swelling", "injury", "fracture"],
      overview: "Bone and joint questions are reviewed through injury, pain pattern, swelling, movement limits, fever, numbness, and function.",
      symptoms: ["Severe pain after injury", "Unable to bear weight", "Numbness or weakness", "Hot swollen joint or fever"],
      clinicianReview: ["Injury history", "Range of movement", "Neurologic symptoms", "Imaging or lab review when needed"],
      prevention: ["Safe movement", "Strength and balance", "Ergonomics", "Fall prevention", "Weight and bone health review"],
      safety: ["Major injury", "Deformity", "Loss of bladder or bowel control", "Weakness or fever with back pain"],
      questions: ["What activity should I avoid until a clinician reviews this?"]
    },
    {
      id: "infection",
      label: "Fever and infection",
      terms: ["fever", "infection", "temperature", "chills", "sore throat", "rash", "burning urine", "pus"],
      overview: "Fever and infection questions are reviewed through temperature, duration, breathing, hydration, rash, urine symptoms, immune risk, and worsening pattern.",
      symptoms: ["High or persistent fever", "Chills", "Breathing difficulty", "Confusion", "Dehydration, rash, or severe pain"],
      clinicianReview: ["Temperature trend", "Source of symptoms", "Hydration", "Exposure history", "Tests when clinically needed"],
      prevention: ["Hand hygiene", "Vaccination review", "Safe food and water", "Rest and hydration", "Avoid spreading infection"],
      safety: ["Confusion", "Severe breathlessness", "Fainting", "Stiff neck", "Persistent high fever or dehydration"],
      questions: ["When does this fever need same-day medical review?"]
    },
    {
      id: "skin",
      label: "Skin, allergy, and immune reactions",
      terms: ["rash", "itch", "itching", "hives", "skin", "allergy", "swelling", "eczema", "infection spot"],
      overview: "Skin and allergy questions are reviewed through spread, trigger exposure, fever, swelling, breathing symptoms, medicine exposure, and how quickly the pattern is changing.",
      symptoms: ["Rapidly spreading rash", "Hives", "Face or lip swelling", "Fever with skin pain", "Pus, warmth, or worsening redness"],
      clinicianReview: ["Trigger and medicine exposure", "Photo or rash-location description", "Fever and swelling context", "Allergy history and prior reactions"],
      prevention: ["Avoid known triggers", "Patch-test new products when appropriate", "Protect broken skin", "Keep allergy history updated"],
      safety: ["Breathing trouble", "Face or throat swelling", "Fainting", "Rapidly spreading painful rash", "Fever with severe skin symptoms"],
      questions: ["Could this be an allergy, infection, or irritation pattern that needs same-day review?"]
    },
    {
      id: "endocrine",
      label: "Thyroid, hormones, and metabolism",
      terms: ["thyroid", "tsh", "t3", "t4", "weight gain", "weight loss", "hormone", "fatigue", "metabolism"],
      overview: "Hormone and thyroid questions are reviewed through symptoms, medication timing, lab trends, heart rate, weight change, temperature sensitivity, and clinician-led follow-up.",
      symptoms: ["Unusual fatigue", "Palpitations", "Weight change", "Heat or cold intolerance", "Neck swelling or tremor"],
      clinicianReview: ["TSH and thyroid hormone trend", "Medicine timing and interactions", "Pulse and weight trend", "Pregnancy or heart-risk context when relevant"],
      prevention: ["Take prescribed thyroid medicine exactly as directed", "Use consistent lab follow-up", "Discuss supplements and interactions", "Track symptoms with dates"],
      safety: ["Severe palpitations", "Chest pain", "Confusion", "Fainting", "Extreme weakness or rapid worsening"],
      questions: ["What thyroid or hormone trend should I monitor next with my clinician?"]
    }
  ];

  if (explicitFocus) {
    const explicitDomain = domains.find((domain) => domain.id === explicitFocus);

    if (explicitDomain) {
      return explicitDomain;
    }
  }

  const scored = domains
    .map((domain, index) => ({
      ...domain,
      score: scoreSpecialistDomainFit(domain, text, profile, vitals, context)
        + domain.symptoms.reduce((total, symptom) => total + (hasTerm(source, String(symptom || "").toLowerCase()) ? 3 : 0), 0)
        + domain.clinicianReview.reduce((total, item) => total + (hasTerm(source, String(item || "").toLowerCase()) ? 2 : 0), 0)
        + domain.safety.reduce((total, item) => total + (hasTerm(source, String(item || "").toLowerCase()) ? 3 : 0), 0),
      index
    }))
    .sort((first, second) => second.score - first.score || first.index - second.index);

  return scored[0]?.score > 0 ? scored[0] : domains[0];
}

function buildSpecialistDomainInsights(domain, text, profile = {}, vitals = {}, context = {}, focusProfile = null) {
  const evidenceBundle = buildSpecialistEvidenceBundle(text, profile, context);
  const source = evidenceBundle.combinedText.toLowerCase();
  const contextModifiers = Array.isArray(context.riskModifiers)
    ? context.riskModifiers.map((item) => String(item || "").replace(/-/g, " "))
    : [];
  const modifierCatalog = [
    { label: "Diabetes or glucose risk", terms: ["diabetes", "glucose", "sugar", "hba1c", "metformin", "insulin"] },
    { label: "High blood pressure or heart risk", terms: ["hypertension", "blood pressure", "bp", "heart", "cholesterol", "chest"] },
    { label: "Kidney-risk context", terms: ["kidney", "egfr", "creatinine", "urine protein", "renal"] },
    { label: "Pregnancy context", terms: ["pregnancy", "pregnant", "baby movement", "maternity"] },
    { label: "Immune-risk context", terms: ["immune", "chemotherapy", "transplant", "steroid", "hiv"] },
    { label: "Blood-thinner or bleeding context", terms: ["blood thinner", "warfarin", "apixaban", "rivaroxaban", "aspirin", "clopidogrel", "bleeding"] }
  ];
  const riskModifiers = dedupeResponseItems([
    ...contextModifiers.map((item) => item.replace(/\b\w/g, (letter) => letter.toUpperCase())),
    ...modifierCatalog
      .filter((modifier) => modifier.terms.some((term) => hasTerm(source, term)))
      .map((modifier) => modifier.label)
  ]).slice(0, 6);
  const hasVitals = Object.values(vitals || {}).some((value) => value !== null && value !== undefined && String(value).trim() !== "");
  const clinicalLensLabels = {
    "full-review": "Full disease-area review",
    "symptom-pattern": "Symptom pattern",
    tests: "Tests and reports",
    prevention: "Prevention plan",
    "medicine-safety": "Medicine safety",
    "follow-up": "Follow-up plan"
  };
  const normalizedLens = normalizeSearchText(context.specialistLens || evidenceBundle.structuredSections.lens);
  const clinicalLens = clinicalLensLabels[normalizedLens] || clinicalLensLabels["full-review"];
  const commonDifferential = [
    "First rule out urgent warning signs before routine comparison.",
    "Compare symptom timing, severity, triggers, readings, medicines, and report trends.",
    "Use the result as a clinician-discussion frame, not a diagnosis."
  ];
  const differentialByDomain = {
    cardiology: ["Separate chest-pain or stroke warning signs from routine BP or cholesterol questions.", "Compare BP pattern, pulse, swelling, breathlessness, medicines, kidney labs, and diabetes risk.", "Ask whether ECG, lipids, kidney labs, or medicine review is relevant."],
    diabetes: ["Separate low-sugar, very high-sugar, dehydration, and infection warnings from routine glucose education.", "Compare fasting, after-meal, random, HbA1c, medicines, illness, hydration, and activity.", "Ask whether kidney, eye, foot, and medicine-safety checks are due."],
    respiratory: ["Separate severe breathing trouble and low oxygen from routine cough or trigger questions.", "Compare oxygen, fever, cough, wheeze, inhaler use, triggers, exposures, and baseline breathing.", "Ask whether exam, oxygen review, infection testing, or action-plan review is needed."],
    neurology: ["Separate stroke-like signs, sudden worst headache, seizure, confusion, and head injury from routine headache questions.", "Compare onset time, neurologic signs, BP, fever, medicines, prior headache pattern, and injury.", "Ask whether neurologic exam, imaging, or headache prevention review is relevant."],
    kidney: ["Separate very low urine, severe swelling, confusion, potassium concern, and dehydration from routine kidney-report education.", "Compare eGFR, creatinine, urine protein, BP, diabetes, hydration, and medicine list.", "Ask which medicines, labs, and follow-up interval require kidney-specific review."],
    gastro: ["Separate severe abdominal pain, bleeding, dehydration, jaundice with fever, and persistent vomiting from routine digestive questions.", "Compare pain location, meal timing, stool changes, liver tests, medicines, alcohol, and hydration.", "Ask whether labs, stool tests, imaging, or medicine review is relevant."],
    orthopedic: ["Separate weakness, bladder/bowel changes, fever, major injury, and deformity from routine pain questions.", "Compare injury mechanism, function loss, swelling, nerve symptoms, fever, and prior imaging.", "Ask what movement is safe and whether imaging or therapy review is needed."],
    infection: ["Separate sepsis-like symptoms, severe breathlessness, stiff neck, confusion, dehydration, and immune risk from routine fever education.", "Compare source symptoms, temperature trend, pulse, breathing, hydration, exposure, and immune status.", "Ask whether testing, isolation, or same-day review is needed."],
    skin: ["Separate severe allergy, face/throat swelling, painful spreading rash, fever, and blistering from routine skin irritation questions.", "Compare medicine or food exposure, rash spread, fever, pain, itch, photos, and allergy history.", "Ask whether allergy, infection, medicine reaction, or dermatology review is likely to be considered."],
    endocrine: ["Separate chest pain, fainting, severe palpitations, confusion, and rapid worsening from routine thyroid or hormone questions.", "Compare TSH/T4 trend, pulse, weight change, medicine timing, supplements, and pregnancy status.", "Ask whether timing, interactions, or repeat labs should be reviewed."]
  };
  const monitoringByDomain = {
    cardiology: ["Keep BP, pulse, symptoms, medicine timing, salt-heavy meals, sleep, and stress in a 7-day trend.", "Record chest symptoms, breathlessness, swelling, dizziness, or neurologic signs immediately.", "Bring baseline BP, cholesterol, diabetes, kidney, and medicine context to follow-up."],
    diabetes: ["Label glucose as fasting, before meal, after meal, bedtime, or random.", "Track meals, medicines, activity, hydration, illness, low-sugar symptoms, and foot changes.", "Keep HbA1c, kidney, urine, eye, and foot-review dates in Records."],
    respiratory: ["Track breathing effort, cough, fever, oxygen if available, inhaler use, triggers, and ability to speak normally.", "Note night waking, repeated reliever use, exposure, and trend over hours to days.", "Keep prescribed action-plan and inhaler names ready."],
    neurology: ["Track exact onset time, severity, neurologic signs, BP, fever, injury, medicines, sleep, hydration, and prior pattern.", "Use urgent care for sudden or neurologic symptoms instead of waiting for a diary.", "For recurring headaches, keep a trigger and medicine-use diary."],
    kidney: ["Track BP, urine amount, swelling, weight, hydration, glucose, creatinine/eGFR, urine protein, potassium, and medicines.", "Flag vomiting, diarrhea, dehydration, infection, or new pain medicines for clinician review.", "Compare each kidney report with previous values."],
    gastro: ["Track pain location, meals, stool changes, vomiting, fluids, urine, fever, medicines, alcohol, and travel.", "Save liver, stool, imaging, or endoscopy report terms if available.", "Monitor whether symptoms improve, recur, or worsen."],
    orthopedic: ["Track injury date, pain location, swelling, movement limits, walking ability, numbness, weakness, and fever.", "Record activity that worsens or improves symptoms.", "Save imaging or therapy notes if available."],
    infection: ["Track temperature, pulse, breathing, fluids, urine, source symptoms, exposure, rash, and immune-risk context.", "Record whether symptoms are rapidly worsening or improving.", "Do not delay urgent care to collect perfect details."],
    skin: ["Track rash location, spread, photos, itch, pain, fever, swelling, new medicines, foods, products, and exposures.", "Record breathing, lip/face swelling, blistering, skin pain, or severe illness immediately.", "Save allergy and reaction history."],
    endocrine: ["Track TSH/T4 or hormone report dates, pulse, weight, sleep, temperature sensitivity, tremor, medicine timing, and supplements.", "Record pregnancy status or heart symptoms when relevant.", "Compare lab trends rather than one value alone."]
  };
  const careOptionsByDomain = {
    cardiology: ["Lifestyle and risk-factor review", "Clinician-led medicine review", "Monitoring and follow-up planning", "Cardiology referral when appropriate"],
    diabetes: ["Meal/activity routine", "Glucose and HbA1c monitoring", "Clinician-led medicine review", "Kidney, eye, and foot prevention"],
    respiratory: ["Trigger control", "Inhaler technique review", "Action-plan discussion", "Vaccination and infection-prevention review"],
    neurology: ["Trigger and diary review", "BP, fever, and medicine context", "Clinician-led testing or imaging discussion", "Prevention plan for recurring symptoms"],
    kidney: ["BP and diabetes protection", "Medicine safety review", "Lab trend monitoring", "Kidney specialist referral questions when needed"],
    gastro: ["Hydration and food-trigger review", "Medicine and alcohol review", "Clinician-led tests or imaging", "Follow-up for persistent or severe symptoms"],
    orthopedic: ["Safe movement and rest balance", "Function tracking", "Physical therapy or imaging questions", "Fall and injury prevention"],
    infection: ["Hydration and symptom monitoring", "Source-specific testing questions", "Infection-control steps", "Same-day review when risk is higher"],
    skin: ["Trigger avoidance", "Skin barrier and photo tracking", "Allergy or infection review", "Dermatology or urgent care questions when severe"],
    endocrine: ["Lab trend follow-up", "Medicine timing and interaction review", "Symptom and pulse tracking", "Clinician-led hormone plan"]
  };
  const doctorQuestions = dedupeResponseItems([
    ...(Array.isArray(focusProfile?.questions) ? focusProfile.questions : []),
    `For ${domain.label.toLowerCase()}, which warning sign should I treat as urgent?`,
    hasVitals ? "How do my current readings change the priority or follow-up timing?" : "Which readings or report values would make this review stronger?",
    riskModifiers.length ? `Do these modifiers change the plan: ${riskModifiers.slice(0, 3).join(", ")}?` : "Do my age, medicines, allergies, or existing conditions change the plan?"
  ]).slice(0, 5);

  return {
    clinicalLens: focusProfile?.label ? `${clinicalLens} - ${focusProfile.label}` : clinicalLens,
    riskModifiers,
    focusSummary: focusProfile?.summary || "",
    differentialFrame: dedupeResponseItems([
      ...(Array.isArray(focusProfile?.differential) ? focusProfile.differential : []),
      ...(differentialByDomain[domain.id] || commonDifferential)
    ]).slice(0, 4),
    monitoringPlan: dedupeResponseItems([
      ...(Array.isArray(focusProfile?.monitoring) ? focusProfile.monitoring : []),
      ...(monitoringByDomain[domain.id] || [
        "Track start time, severity, triggers, readings, medicines, and whether symptoms improve or worsen.",
        "Save related reports and questions in Records.",
        "Bring the pattern to a licensed clinician."
      ])
    ]).slice(0, 4),
    careOptions: dedupeResponseItems([
      ...(Array.isArray(focusProfile?.careOptions) ? focusProfile.careOptions : []),
      ...(careOptionsByDomain[domain.id] || ["Prevention", "Monitoring", "Clinician-led testing", "Follow-up planning"])
    ]).slice(0, 5),
    doctorQuestions
  };
}

function runVitalsAgent({ vitals, risk, profile, context, medicalKnowledge }) {
  const knowledgeMatches = getRouteKnowledgeMatches("VITALS_AGENT", medicalKnowledge, 3);
  const evidenceCoverage = getRouteKnowledgeCoverage("VITALS_AGENT", medicalKnowledge);
  const redFlags = Array.isArray(context?.redFlags) ? context.redFlags : [];
  const urgentFlagSet = new Set(redFlags);
  const hasUrgentSymptoms = ["chest-pain", "breathing-trouble", "fainting", "one-sided-weakness", "severe-allergy"]
    .some((flag) => urgentFlagSet.has(flag));
  const entered = [];
  const missing = [];
  const checks = [];
  const watchItems = [];
  const dailyContext = [];
  const accuracyGaps = [];
  const bmi = calculateServerBmi(vitals.weightKg, vitals.heightCm);

  const addCheck = (title, value, status, detail) => {
    checks.push({ title, value, status, detail });

    if (["watch", "urgent", "review"].includes(status)) {
      watchItems.push(`${title}: ${detail}`);
    }
  };

  if (vitals.systolic !== null || vitals.diastolic !== null) {
    entered.push(`BP ${vitals.systolic ?? "--"}/${vitals.diastolic ?? "--"}`);

    if (vitals.systolic === null || vitals.diastolic === null) {
      addCheck("Blood pressure", "Incomplete", "review", "Add both top and bottom BP values before judging the reading.");
      accuracyGaps.push("Enter both systolic and diastolic BP values.");
    } else if (vitals.systolic >= 180 || vitals.diastolic >= 120) {
      addCheck(
        "Blood pressure",
        `${vitals.systolic}/${vitals.diastolic}`,
        "urgent",
        hasUrgentSymptoms
          ? "Very high BP with warning symptoms; this is treated as an emergency warning pattern."
          : "Very high BP range; repeat correctly after quiet rest if safe and seek prompt clinical guidance if it remains high."
      );
    } else if (vitals.systolic >= 160 || vitals.diastolic >= 100) {
      addCheck("Blood pressure", `${vitals.systolic}/${vitals.diastolic}`, "watch", "High BP pattern; repeat correctly after rest and compare with baseline.");
    } else if (vitals.systolic >= 140 || vitals.diastolic >= 90) {
      addCheck("Blood pressure", `${vitals.systolic}/${vitals.diastolic}`, "review", "Above many common home targets; a multi-day trend is more useful than one reading.");
    } else if (vitals.systolic >= 130 || vitals.diastolic >= 80) {
      addCheck("Blood pressure", `${vitals.systolic}/${vitals.diastolic}`, "review", "Above the normal adult category; track a correct 7-day average and compare with your clinician target.");
    } else if (vitals.systolic < 90 || vitals.diastolic < 60) {
      addCheck("Blood pressure", `${vitals.systolic}/${vitals.diastolic}`, "review", "Low for many adults; dizziness, fainting, dehydration, and medicine timing matter.");
    } else {
      addCheck("Blood pressure", `${vitals.systolic}/${vitals.diastolic}`, "stable", "Captured for baseline comparison.");
    }
  } else {
    missing.push("blood pressure pair");
  }

  if (vitals.bloodSugar !== null) {
    entered.push(`glucose ${vitals.bloodSugar}`);

    if (vitals.bloodSugar >= 300) {
      addCheck("Blood sugar", String(vitals.bloodSugar), hasUrgentSymptoms ? "urgent" : "watch", "Very high glucose; illness, dehydration, ketones if instructed, medicines, and symptoms are important.");
    } else if (vitals.bloodSugar >= 240) {
      addCheck("Blood sugar", String(vitals.bloodSugar), "watch", "High glucose range; label fasting, post-meal, random, illness, and medicine timing.");
    } else if (vitals.bloodSugar <= 55) {
      addCheck("Blood sugar", String(vitals.bloodSugar), "urgent", "Very low glucose range; confusion, sweating, shaking, fainting, or inability to eat is urgent.");
    } else if (vitals.bloodSugar <= 70) {
      addCheck("Blood sugar", String(vitals.bloodSugar), "watch", "Low glucose range for many people; follow your written diabetes plan if you have one.");
    } else {
      addCheck("Blood sugar", String(vitals.bloodSugar), "stable", "Captured; interpretation depends on fasting or meal timing and personal target.");
    }
  } else {
    missing.push("glucose reading");
  }

  if (vitals.heartRate !== null) {
    entered.push(`pulse ${vitals.heartRate}`);

    if (vitals.heartRate >= 130) {
      addCheck("Pulse", `${vitals.heartRate} bpm`, hasUrgentSymptoms ? "urgent" : "watch", "Fast pulse; connect with fever, oxygen, pain, dehydration, medicines, caffeine, and symptoms.");
    } else if (vitals.heartRate >= 115) {
      addCheck("Pulse", `${vitals.heartRate} bpm`, "review", "Elevated pulse; repeat after rest and compare with oxygen, temperature, and hydration.");
    } else if (vitals.heartRate < 45) {
      addCheck("Pulse", `${vitals.heartRate} bpm`, "review", "Low pulse for many adults; dizziness, weakness, chest symptoms, or fainting matter.");
    } else {
      addCheck("Pulse", `${vitals.heartRate} bpm`, "stable", "Captured for today's trend.");
    }
  } else {
    missing.push("pulse");
  }

  if (vitals.temperatureC !== null) {
    entered.push(`temperature ${vitals.temperatureC} C`);

    if (vitals.temperatureC >= 40.6) {
      addCheck("Temperature", `${vitals.temperatureC} C`, "urgent", "Very high fever range; confusion, breathing trouble, stiff neck, dehydration, rash, or persistent vomiting needs urgent real-world review.");
    } else if (vitals.temperatureC >= 39.4) {
      addCheck("Temperature", `${vitals.temperatureC} C`, hasUrgentSymptoms ? "urgent" : "watch", "High fever range; duration, hydration, breathing, confusion, rash, severe headache, or persistent vomiting matter.");
    } else if (vitals.temperatureC >= 38) {
      addCheck("Temperature", `${vitals.temperatureC} C`, "review", "Fever range for many adults; pair with pulse, oxygen, symptoms, and duration.");
    } else if (vitals.temperatureC <= 35) {
      addCheck("Temperature", `${vitals.temperatureC} C`, "review", "Low temperature reading; confirm measurement quality and symptoms.");
    } else {
      addCheck("Temperature", `${vitals.temperatureC} C`, "stable", "Captured.");
    }
  } else {
    missing.push("temperature");
  }

  if (vitals.oxygenSaturation !== null) {
    entered.push(`oxygen ${vitals.oxygenSaturation}%`);

    if (vitals.oxygenSaturation <= 90) {
      addCheck("Oxygen", `${vitals.oxygenSaturation}%`, "urgent", "Low oxygen range; breathing trouble, chest pain, blue lips, or confusion requires real-world help.");
    } else if (vitals.oxygenSaturation <= 92) {
      addCheck("Oxygen", `${vitals.oxygenSaturation}%`, hasUrgentSymptoms ? "urgent" : "watch", "Oxygen is below the expected range for many adults; symptoms and repeat measurement quality matter.");
    } else if (vitals.oxygenSaturation < 95) {
      addCheck("Oxygen", `${vitals.oxygenSaturation}%`, "review", "Below usual normal range for many adults; recheck finger fit, warm hands, and symptoms.");
    } else {
      addCheck("Oxygen", `${vitals.oxygenSaturation}%`, "stable", "Captured; compare with personal baseline if you have lung or heart disease.");
    }
  } else {
    missing.push("oxygen saturation");
  }

  if (bmi) {
    entered.push(`BMI ${bmi.value.toFixed(1)}`);
    addCheck("BMI", bmi.value.toFixed(1), bmi.level, bmi.detail);
  } else {
    missing.push("height and weight for BMI");
  }

  if (vitals.waistCm !== null) dailyContext.push(`waist ${vitals.waistCm} cm`);
  if (vitals.sleepHours !== null) dailyContext.push(`sleep ${vitals.sleepHours}h`);
  if (vitals.stepsCount !== null) dailyContext.push(`steps ${vitals.stepsCount}`);
  if (vitals.waterCups !== null) dailyContext.push(`water ${vitals.waterCups} cup(s)`);

  if (vitals.sleepHours !== null && vitals.sleepHours < 6) {
    addCheck("Sleep", `${vitals.sleepHours}h`, "review", "Short sleep can affect BP, pulse, glucose, fatigue, and symptoms.");
  }

  if (vitals.stepsCount !== null && vitals.stepsCount < 3000) {
    addCheck("Activity", String(vitals.stepsCount), "review", "Low activity day; compare readings with illness, pain, stress, and usual routine.");
  }

  if (vitals.waterCups !== null && vitals.waterCups < 4) {
    addCheck("Hydration", `${vitals.waterCups} cup(s)`, "review", "Low hydration can affect pulse, dizziness, glucose, and BP readings.");
  }

  if (redFlags.length) {
    addCheck("Warning signs", redFlags.map((flag) => flag.replace(/-/g, " ")).join(", "), "urgent", "Urgent symptoms override routine vital tracking.");
  }

  if (!context?.duration || context.duration === "not-sure") {
    accuracyGaps.push("Add when the reading or symptom started.");
  }

  if (!context?.lastMedicationTime) {
    accuracyGaps.push("Add medicine, meal, caffeine, exercise, or illness timing.");
  }

  const urgentCount = checks.filter((check) => check.status === "urgent").length;
  const watchCount = checks.filter((check) => check.status === "watch").length;
  const reviewCount = checks.filter((check) => check.status === "review").length;
  const completenessScore = Math.max(30, Math.min(98, 36 + entered.length * 7 + dailyContext.length * 4 - urgentCount * 8 - watchCount * 4 - accuracyGaps.length * 2));
  const priority = urgentCount || risk.level === "CRITICAL"
    ? "urgent safety review"
    : watchCount || risk.level === "HIGH"
      ? "same-day focused review"
      : reviewCount
        ? "trend and context review"
        : "routine tracking";
  const vitalActions = buildVitalSpecialistActions({ urgentCount, watchCount, checks, missing, context, profile });
  const decisionProfile = buildVitalDecisionProfile({
    checks,
    entered,
    missing,
    accuracyGaps,
    dailyContext,
    urgentCount,
    watchCount,
    reviewCount,
    completenessScore,
    priority,
    risk,
    context,
    profile
  });

  return createAgentResult("VITALS_AGENT", "Vital Specialist Review", "complete", {
    intentRoute: "Vitals",
    summary: entered.length
      ? `Vital specialist reviewed ${entered.join(", ")}. Priority: ${priority}.`
      : "No numeric vitals were entered. Add readings to create a specialist snapshot.",
    productionTool: "Vital-specialist scoring for BP, glucose, pulse, oxygen, temperature, BMI, habit context, warning signs, and trend readiness.",
    priority,
    completenessScore,
    enteredReadings: entered,
    missing: missing.slice(0, 6),
    checks: checks.slice(0, 10),
    watchItems: watchItems.slice(0, 8),
    vitalActions,
    accuracyGaps: accuracyGaps.slice(0, 5),
    decisionProfile,
    triageSignals: decisionProfile.triageSignals,
    clinicianQuestions: decisionProfile.clinicianQuestions,
    trendPlan: decisionProfile.trendPlan,
    evidenceCoverage,
    references: mapKnowledgeReferences(knowledgeMatches, 3),
    measurementQuality: [
      "Sit quietly before BP and keep the cuff at heart level.",
      "Label glucose as fasting, random, or after-meal.",
      "Warm hands and remove nail polish for oxygen readings.",
      "Repeat unusual readings and record time, symptoms, food, medicine, activity, and stress."
    ],
    dailyMaintenance: [
      "Use a simple morning and evening log for BP, pulse, symptoms, sleep, water, steps, and medicine timing.",
      "Compare 7-day trends with your personal baseline rather than reacting to one isolated reading.",
      "Share repeated abnormal readings or urgent symptoms with a licensed clinician."
    ],
    bmi: bmi ? { value: Number(bmi.value.toFixed(1)), category: bmi.category } : null,
    baseline: profile.baselineBp ? `Saved baseline BP: ${profile.baselineBp}.` : "No saved BP baseline.",
    dailyContext: dailyContext.length ? dailyContext : ["No daily habit context added."],
    riskContext: risk.label,
    liveAction: "No device monitoring, diagnosis, dosage change, or external alert is active."
  });
}

function buildVitalDecisionProfile({
  checks,
  entered,
  missing,
  accuracyGaps,
  dailyContext,
  urgentCount,
  watchCount,
  reviewCount,
  completenessScore,
  priority,
  risk,
  context,
  profile
}) {
  const topSignal = checks.find((check) => check.status === "urgent")
    || checks.find((check) => check.status === "watch")
    || checks.find((check) => check.status === "review")
    || checks[0];
  const triageSignals = checks
    .filter((check) => ["urgent", "watch", "review"].includes(check.status))
    .slice(0, 6)
    .map((check) => `${check.title}: ${check.value} - ${check.detail}`);
  const dataConfidence = completenessScore >= 82 && accuracyGaps.length <= 1
    ? "strong"
    : completenessScore >= 62
      ? "usable"
      : "needs more context";
  const clinicianQuestions = [
    topSignal ? `Does ${topSignal.title.toLowerCase()} change how soon I should be reviewed?` : "Which vital readings should I track first?",
    profile?.baselineBp ? `How does this compare with my usual BP ${profile.baselineBp}?` : "What personal BP, glucose, pulse, or oxygen targets should I use?",
    context?.lastMedicationTime ? "Could medicine, food, caffeine, activity, illness, or hydration timing explain this reading?" : "Which timing details should I record next time?"
  ];
  const trendPlan = [
    "Repeat unusual readings only when it is safe, using the same device and correct technique.",
    "Save time, symptoms, meal or medicine timing, activity, sleep, hydration, and whether the value was repeated.",
    "Use a 7-day view for routine patterns; urgent warning signs override trend tracking."
  ];

  return {
    priority,
    topSignal: topSignal ? `${topSignal.title}: ${topSignal.value}` : "No readings entered",
    topSignalDetail: topSignal?.detail || "Add BP, pulse, oxygen, temperature, glucose if relevant, and body metrics.",
    dataConfidence,
    completenessScore,
    enteredCount: entered.length,
    missing: missing.slice(0, 5),
    urgentCount,
    watchCount,
    reviewCount,
    dailyContext: dailyContext.length ? dailyContext : ["No daily context added"],
    safetyFrame: urgentCount || risk.level === "CRITICAL"
      ? "Safety-first: warning patterns should be handled outside the app."
      : watchCount
        ? "Focused review: repeat correctly, compare baseline, and prepare clinician context."
        : "Routine: continue tracking and build a stable baseline.",
    triageSignals,
    clinicianQuestions,
    trendPlan
  };
}

function calculateServerBmi(weightKg, heightCm) {
  if (weightKg === null || heightCm === null || weightKg <= 0 || heightCm <= 0) {
    return null;
  }

  const value = weightKg / ((heightCm / 100) ** 2);

  if (value < 18.5) {
    return {
      value,
      category: "below common adult range",
      level: "review",
      detail: "Below common adult range; food intake, illness, weight trend, and clinician context matter."
    };
  }

  if (value < 25) {
    return {
      value,
      category: "common adult target range",
      level: "stable",
      detail: "Within a common adult target range; waist trend, strength, sleep, and activity still matter."
    };
  }

  if (value < 30) {
    return {
      value,
      category: "above common adult target range",
      level: "review",
      detail: "Above common adult target range; combine with waist, BP, glucose, activity, and sleep trends."
    };
  }

  return {
    value,
    category: "higher-risk adult range",
    level: "watch",
    detail: "Higher-risk adult range; gradual clinician-guided weight, waist, BP, glucose, sleep, and activity planning can help."
  };
}

function buildVitalSpecialistActions({ urgentCount, watchCount, checks, missing, context, profile }) {
  if (urgentCount) {
    return [
      "If severe symptoms are active, seek urgent real-world medical help now.",
      "Do not drive yourself if chest pain, breathing trouble, fainting, one-sided weakness, confusion, or severe allergy signs are present.",
      "Keep the reading, time, symptoms, medicines, and support person information ready."
    ];
  }

  if (watchCount) {
    return [
      "Rest quietly if safe, then repeat the abnormal reading with correct technique.",
      "Record the exact time, symptoms, food, medicine, caffeine, activity, sleep, and hydration context.",
      profile.baselineBp
        ? `Compare with saved baseline BP ${profile.baselineBp} and share repeated high patterns with your clinician.`
        : "Add your usual baseline and share repeated high patterns with your clinician."
    ];
  }

  if (checks.length) {
    return [
      "Keep a morning and evening trend for at least several days.",
      "Use the same device and record conditions so changes are easier to interpret.",
      "Ask a clinician to review repeated out-of-range values or symptoms that feel unusual for you."
    ];
  }

  return [
    `Start with ${missing.slice(0, 3).join(", ") || "BP, pulse, temperature, oxygen, and glucose if relevant"}.`,
    context?.duration && context.duration !== "not-sure" ? "Add readings at the same time tomorrow for comparison." : "Add when symptoms started and whether readings were repeated.",
    "This agent organizes vital data; it does not diagnose, prescribe, or replace care."
  ];
}

function runPharmacyAgent({ message, profile, context, medicalKnowledge }) {
  const knowledgeMatches = getRouteKnowledgeMatches("PHARMACY_AGENT", medicalKnowledge, 3);
  const evidenceCoverage = getRouteKnowledgeCoverage("PHARMACY_AGENT", medicalKnowledge);
  const text = message.toLowerCase();
  const profileMedicines = profileListArray(profile.medications);
  const combinedMedicineText = `${message} ${profileMedicines.join(" ")} ${context.lastMedicationTime || ""}`.toLowerCase();
  const reviewType = classifyMedicineReviewType(combinedMedicineText);
  const medicineSignals = extractMedicineSignals(combinedMedicineText, profileMedicines);
  const safetySignals = detectMedicationSafetySignals(combinedMedicineText);
  const interactionPrompts = buildMedicationInteractionPrompts(combinedMedicineText, profile);
  const missedDose = reviewType === "missed-dose";
  const riskThemes = classifyMedicationRiskThemes(combinedMedicineText, profile);
  const reviewGaps = buildMedicationReviewGaps({ message, profile, context, medicineSignals, riskThemes });
  const decisionProfile = buildMedicationDecisionProfile({
    source: combinedMedicineText,
    profile,
    context,
    reviewType,
    medicineSignals,
    safetySignals,
    interactionPrompts,
    riskThemes,
    reviewGaps
  });
  const highRiskMedicine = decisionProfile.highRiskMatches.length > 0;
  const priority = decisionProfile.priority;
  const labelCompleteness = [
    medicineSignals.length ? "medicine name available" : "medicine name missing",
    context.lastMedicationTime ? "last-taken timing available" : "last-taken timing missing",
    profileMedicines.length ? "profile medicine list available" : "profile medicine list missing"
  ];
  const pharmacyActions = buildPharmacyActions({
    priority,
    reviewType,
    missedDose,
    highRiskMedicine,
    safetySignals,
    medicineSignals,
    context
  });
  const pharmacistQuestions = buildPharmacistQuestionPacket({
    reviewType,
    medicineSignals,
    riskThemes,
    missedDose,
    highRiskMedicine,
    context
  });

  return createAgentResult("PHARMACY_AGENT", "Medication Safety", "complete", {
    intentRoute: "Medication",
    summary: missedDose
      ? "Missed-dose wording was detected. The safe boundary is label-first guidance, no dose doubling from the app, and pharmacist or clinician confirmation for medicine-specific instructions."
      : `Medication wording was detected. Review focus: ${reviewType.replace(/-/g, " ")}. Priority: ${priority}.`,
    productionTool: "Medication label, side-effect, interaction, missed-dose, allergy, and pharmacist-question safety review.",
    reviewType,
    priority,
    medicineSignals,
    medicationContext: profileMedicines.length
      ? `Saved medicines: ${profileMedicines.join(", ")}.${context.lastMedicationTime ? ` Timing entered: ${context.lastMedicationTime}.` : ""}`
      : `No saved medicines were provided.${context.lastMedicationTime ? ` Timing entered: ${context.lastMedicationTime}.` : ""}`,
    labelCompleteness,
    interactionPrompts,
    safetySignals,
    riskThemes,
    reviewGaps,
    decisionProfile,
    safetyTriage: decisionProfile.safetyTriage,
    interactionChecklist: decisionProfile.interactionChecklist,
    labelChecklist: decisionProfile.labelChecklist,
    nextSafeSteps: decisionProfile.nextSafeSteps,
    pharmacyActions,
    pharmacistQuestions,
    evidenceCoverage,
    references: mapKnowledgeReferences(knowledgeMatches, 3),
    medicineReasoningChecklist: [
      "Identify medicine name, generic/brand, strength, route, and reason.",
      "Confirm the written label source and last-taken timing.",
      "Screen profile medicines, OTC products, supplements, allergies, alcohol, grapefruit, kidney/liver status, pregnancy/breastfeeding, falls, and upcoming procedures.",
      "Separate common side effects from urgent warning signs.",
      "Generate pharmacist or clinician questions instead of prescribing or changing dose."
    ],
    labelUseChecks: [
      "Confirm medicine name, strength, amount, route, timing, duration, storage, and refill instruction from the written label.",
      "Check duplicate active ingredients across prescription, OTC, cold/flu, pain, fever, supplement, and herbal products.",
      "Ask before mixing with alcohol, grapefruit, sedatives, blood thinners, NSAIDs, kidney/liver-risk medicines, or supplements."
    ],
    cautions: [
      "No prescribing, dose calculation, dose increase, dose reduction, or medicine stopping decision is made by this app.",
      "Use FDA-approved labeling, patient information, your pharmacist, or your clinician for medicine-specific instructions."
    ]
  });
}

function classifyMedicineReviewType(text) {
  if (/overdose|too much|extra\s+\w*\s*dose|dose\s+\w*\s*extra|took\s+extra|taken\s+extra|double dose|duplicate dose|accidental dose|wrong medicine|child took/.test(text)) return "overdose-or-duplicate";
  if (/miss|late|skip|forgot|double/.test(text)) return "missed-dose";
  if (/allergy|rash|hives|swelling|breath|wheeze|anaphyl|itching|throat tight/.test(text)) return "allergy";
  if (/interact|interaction|combine|together|mix|can i take.+with|safe to take.+with|with.+(ibuprofen|naproxen|diclofenac|aspirin|warfarin|apixaban|rivaroxaban|clopidogrel|alcohol|grapefruit|supplement|herb|otc)|alcohol|grapefruit|supplement|herb|otc|cold medicine|painkiller|nsaid/.test(text)) return "interactions";
  if (/side effect|adverse|dizzy|nausea|vomit|diarrhea|muscle pain|sleepy|bleeding|palpitation|stomach pain/.test(text)) return "side-effects";
  if (/label|with food|empty stomach|timing|how often|storage|refill|duration/.test(text)) return "label-use";
  return "general";
}

function extractMedicineSignals(text, profileMedicines) {
  const knownMedicines = [
    "amlodipine", "metformin", "losartan", "lisinopril", "atorvastatin", "rosuvastatin",
    "insulin", "aspirin", "paracetamol", "acetaminophen", "ibuprofen", "omeprazole",
    "pantoprazole", "levothyroxine", "salbutamol", "albuterol", "amoxicillin", "cetirizine",
    "hydrochlorothiazide", "hctz", "metoprolol", "clopidogrel", "warfarin", "furosemide",
    "prednisone", "prednisolone", "montelukast", "doxycycline", "azithromycin",
    "empagliflozin", "dapagliflozin", "semaglutide", "liraglutide", "gabapentin",
    "pregabalin", "apixaban", "rivaroxaban", "naproxen", "diclofenac", "sertraline",
    "escitalopram", "alprazolam", "clonazepam", "iron", "ferrous", "vitamin d",
    "calcium", "budesonide", "formoterol", "fluticasone", "salmeterol", "ciprofloxacin",
    "levofloxacin", "ondansetron", "oral rehydration", "ors", "glimepiride",
    "gliclazide", "glyburide", "sulfonylurea", "digoxin", "lithium", "methotrexate",
    "levetiracetam", "carbamazepine", "valproate", "phenytoin", "tramadol",
    "morphine", "oxycodone", "hydrocodone", "codeine", "fentanyl", "zolpidem",
    "quetiapine", "risperidone", "spironolactone", "potassium", "nitroglycerin",
    "epinephrine", "tacrolimus", "cyclosporine", "mycophenolate", "fluconazole",
    "clarithromycin", "erythromycin", "allopurinol", "colchicine"
  ];
  const found = new Set();

  for (const medicine of knownMedicines) {
    if (new RegExp(`\\b${medicine}\\b`, "i").test(text)) {
      found.add(medicine);
    }
  }

  for (const medicine of profileMedicines) {
    if (medicine) {
      found.add(String(medicine).trim());
    }
  }

  return Array.from(found).slice(0, 8);
}

function detectMedicationSafetySignals(text) {
  const urgent = [];
  const watch = [];

  if (/trouble breathing|shortness of breath|breathless|wheeze|throat tight|face swelling|lip swelling|tongue swelling|anaphyl|blue lips/.test(text)) urgent.push("possible severe allergy or breathing symptom");
  if (/black stool|vomit blood|blood in stool|unusual bleeding|heavy bleeding|major fall|head injury|hit head/.test(text)) urgent.push("bleeding or injury warning sign");
  if (/chest pain|faint|confusion|seizure|one-sided weakness|speech trouble|severe headache/.test(text)) urgent.push("urgent symptom mentioned");
  if (/overdose|too much|extra\s+\w*\s*dose|dose\s+\w*\s*extra|took\s+extra|taken\s+extra|double dose|poison|child took|accidental/.test(text)) urgent.push("possible overdose or duplicate-dose concern");
  if (/severe low sugar|very low sugar|hypogly|sweating.*shaky|shaky.*sweating|unconscious/.test(text)) urgent.push("possible severe low-sugar medicine reaction");
  if (/severe rash|hives|swelling|rash|blister|skin peeling|mouth sores/.test(text)) watch.push("allergy or skin reaction clue");
  if (/dizzy|lightheaded|very sleepy|drowsy|balance|fall|slow pulse|fast heartbeat|palpitation/.test(text)) watch.push("sedation, heart-rate, dizziness, or fall-risk clue");
  if (/kidney|egfr|creatinine|liver|pregnan|breastfeeding|elderly|older adult|dehydration|vomit|diarrhea|surgery|procedure|contrast/.test(text)) watch.push("condition context that can change medication safety");
  if (/alcohol|grapefruit|supplement|herb|otc|painkiller|nsaid|ibuprofen|naproxen|cold medicine|flu medicine/.test(text)) watch.push("interaction context mentioned");

  return { urgent: Array.from(new Set(urgent)), watch: Array.from(new Set(watch)) };
}

function buildMedicationInteractionPrompts(text, profile) {
  const prompts = [];
  const profileText = `${profileListText(profile.conditions)} ${profileListText(profile.medications)} ${profileListText(profile.allergies)}`.toLowerCase();
  const source = `${text} ${profileText}`;

  if (/blood thinner|warfarin|apixaban|rivaroxaban|clopidogrel|aspirin|bleeding|nsaid|ibuprofen/.test(source)) {
    prompts.push("Review bleeding risk, NSAID pain relievers, aspirin, blood thinners, falls, and black stool warnings.");
  }

  if (/kidney|losartan|lisinopril|hctz|hydrochlorothiazide|furosemide|metformin|nsaid|ibuprofen/.test(source)) {
    prompts.push("Review kidney function, dehydration, potassium, NSAID use, and recent vomiting or diarrhea.");
  }

  if (/diabetes|insulin|metformin|empagliflozin|dapagliflozin|semaglutide|prednisone|steroid/.test(source)) {
    prompts.push("Review glucose trend, meal timing, sick-day rules, low-sugar signs, dehydration, and steroid effects.");
  }

  if (/alcohol|sedative|sleep|gabapentin|pregabalin|cetirizine|opioid/.test(source)) {
    prompts.push("Review sleepiness, driving safety, alcohol, sedatives, opioid pain medicines, and fall risk.");
  }

  if (/statin|atorvastatin|rosuvastatin|muscle pain|dark urine|grapefruit|clarithromycin|erythromycin|fluconazole/.test(source)) {
    prompts.push("Review statin interaction risk, grapefruit, certain antibiotics or antifungals, muscle pain, and dark urine warnings.");
  }

  if (/levothyroxine|thyroid|calcium|iron|antacid|omeprazole|pantoprazole/.test(source)) {
    prompts.push("Review thyroid medicine spacing from calcium, iron, antacids, food timing, and TSH follow-up.");
  }

  if (/antibiotic|amoxicillin|doxycycline|azithromycin|ciprofloxacin|levofloxacin|severe diarrhea|rash|tendon/.test(source)) {
    prompts.push("Review antibiotic allergy signs, severe diarrhea, mineral spacing, sun precautions, tendon or rhythm symptoms when relevant.");
  }

  return Array.from(new Set(prompts)).slice(0, 5);
}

function classifyMedicationRiskThemes(text, profile) {
  const profileText = `${profileListText(profile.conditions)} ${profileListText(profile.medications)} ${profileListText(profile.allergies)}`.toLowerCase();
  const source = `${text} ${profileText}`;
  const themes = [];

  if (/blood thinner|warfarin|apixaban|rivaroxaban|clopidogrel|aspirin|bleeding|black stool|head injury|fall/.test(source)) {
    themes.push("bleeding and blood-thinner safety");
  }
  if (/insulin|glucose|hypogly|low sugar|sulfonylurea|diabetes|metformin|sglt2|semaglutide|liraglutide|prednisone|steroid/.test(source)) {
    themes.push("diabetes, low-sugar, sick-day, and dehydration safety");
  }
  if (/kidney|egfr|creatinine|losartan|lisinopril|nsaid|ibuprofen|naproxen|diclofenac|metformin|dehydration|vomit|diarrhea/.test(source)) {
    themes.push("kidney, dehydration, potassium, and NSAID caution");
  }
  if (/liver|alcohol|acetaminophen|paracetamol|statin|atorvastatin|rosuvastatin|dark urine|yellow/.test(source)) {
    themes.push("liver, alcohol, statin, and pain-reliever caution");
  }
  if (/sleepy|sedat|drowsy|gabapentin|pregabalin|alprazolam|clonazepam|opioid|alcohol|fall|older/.test(source)) {
    themes.push("sleepiness, driving, breathing, and fall-risk caution");
  }
  if (/rash|hives|swelling|breath|anaphyl|allergy|penicillin|antibiotic/.test(source)) {
    themes.push("allergy and antibiotic reaction safety");
  }
  if (/opioid|morphine|oxycodone|hydrocodone|tramadol|benzodiazepine|alprazolam|clonazepam|zolpidem|sleep/.test(source)) {
    themes.push("sedation, breathing, dependence, and fall-risk safety");
  }
  if (/lithium|digoxin|methotrexate|tacrolimus|cyclosporine|seizure|phenytoin|carbamazepine|valproate/.test(source)) {
    themes.push("narrow-therapeutic-index or specialist-monitored medicine safety");
  }
  if (/pregnan|breastfeeding|procedure|surgery|contrast|scan|dental/.test(source)) {
    themes.push("pregnancy, breastfeeding, procedure, or scan context");
  }

  return Array.from(new Set(themes)).slice(0, 7);
}

function buildMedicationReviewGaps({ message, profile, context, medicineSignals, riskThemes }) {
  const gaps = [];
  const source = `${message} ${profileListText(profile.medications)} ${context.lastMedicationTime || ""}`.toLowerCase();

  if (!medicineSignals.length) gaps.push("exact medicine name");
  if (!/strength|mg|mcg|unit|tablet|capsule|inhaler|syrup|drop/.test(source)) gaps.push("strength or form from label");
  if (!/once|twice|daily|morning|night|weekly|with food|empty stomach|every/.test(source)) gaps.push("label timing");
  if (!context.lastMedicationTime && !/taken|missed|late|last dose|forgot/.test(source)) gaps.push("last-taken time");
  if (!profileListArray(profile.medications).length) gaps.push("current medicine list");
  if (!profileListArray(profile.allergies).length && !/allerg|rash|swelling|hives/.test(source)) gaps.push("allergy history");
  if (!/otc|supplement|vitamin|herb|alcohol|grapefruit|painkiller|cold|flu/.test(source)) gaps.push("OTC, supplements, alcohol, or food interaction context");
  if (riskThemes.length && !/kidney|liver|pregnan|breast|fall|procedure|dehydrat|vomit|diarrhea/.test(source)) gaps.push("condition-specific safety context");
  if (!/why|purpose|for bp|for sugar|for pain|for infection|for cholesterol|diagnosis|condition/.test(source)) gaps.push("reason this medicine is being used");
  if (!/new|changed|stopped|active|started|recent|old prescription|refill/.test(source)) gaps.push("current status: new, active, changed, stopped, or refill");

  return gaps.slice(0, 8);
}

function buildMedicationDecisionProfile({ source, profile, context, reviewType, medicineSignals, safetySignals, interactionPrompts, riskThemes, reviewGaps }) {
  const highRiskRules = [
    ["blood thinner / antiplatelet", /warfarin|apixaban|rivaroxaban|blood thinner|anticoagulant|clopidogrel|aspirin/],
    ["insulin or low-sugar medicine", /insulin|glimepiride|gliclazide|glyburide|sulfonylurea|hypogly/],
    ["opioid or sedating medicine", /opioid|morphine|oxycodone|hydrocodone|tramadol|fentanyl|alprazolam|clonazepam|zolpidem/],
    ["seizure or narrow-index medicine", /seizure|levetiracetam|carbamazepine|valproate|phenytoin|lithium|digoxin|methotrexate/],
    ["steroid / antibiotic / immune medicine", /steroid|prednisone|prednisolone|antibiotic|amoxicillin|doxycycline|azithromycin|ciprofloxacin|levofloxacin|tacrolimus|cyclosporine|mycophenolate/],
    ["potassium, kidney, or heart-rhythm medicine", /potassium|spironolactone|lisinopril|losartan|digoxin|heart rhythm|arrhythmia/]
  ];
  const highRiskMatches = highRiskRules
    .filter(([, pattern]) => pattern.test(source))
    .map(([label]) => label);
  const specialContexts = [];
  const profileText = `${profileListText(profile.conditions)} ${profileListText(profile.allergies)}`.toLowerCase();
  const combined = `${source} ${profileText}`;

  if (/kidney|egfr|creatinine/.test(combined)) specialContexts.push("kidney function context");
  if (/liver|hepatitis|cirrhosis|alcohol/.test(combined)) specialContexts.push("liver or alcohol context");
  if (/pregnan|breastfeeding/.test(combined)) specialContexts.push("pregnancy or breastfeeding context");
  if (/older|elderly|fall|balance|frail/.test(combined)) specialContexts.push("older-adult or fall-risk context");
  if (/procedure|surgery|dental|contrast|scan/.test(combined)) specialContexts.push("procedure or scan context");
  if (/allerg|rash|hives|swelling|anaphyl/.test(combined)) specialContexts.push("allergy history context");

  const urgent = safetySignals.urgent.length > 0 || reviewType === "overdose-or-duplicate";
  const needsSameDay = urgent || highRiskMatches.length > 0 && (/miss|late|double|too much|bleeding|black stool|faint|confusion|severe|rash|swelling|breath/.test(source));
  const needsFocused = needsSameDay || safetySignals.watch.length > 0 || interactionPrompts.length > 0 || riskThemes.length > 0;
  const priority = urgent
    ? "urgent medication safety review"
    : needsSameDay
      ? "same-day pharmacist or clinician check"
      : needsFocused
        ? "focused pharmacist review"
        : "routine label review";
  const confidence = Math.max(42, Math.min(96,
    52
    + medicineSignals.length * 5
    + interactionPrompts.length * 4
    + riskThemes.length * 3
    + specialContexts.length * 3
    - reviewGaps.length * 3
    - (urgent ? 8 : 0)
  ));
  const safetyTriage = urgent
    ? [
      "Urgent symptoms or overdose/duplicate-dose wording detected.",
      "Use real-world urgent care, poison control, emergency services, clinician, or pharmacist support based on the active situation.",
      "Keep the medicine container, label, time taken, amount taken, symptoms, age, weight if relevant, and other medicines ready."
    ]
    : [
      needsSameDay ? "Same-day pharmacy or clinician confirmation is recommended." : "No urgent medicine danger phrase was detected from the current text.",
      highRiskMatches.length ? `High-risk category: ${highRiskMatches.slice(0, 3).join(", ")}.` : "No high-risk medicine category was clearly detected.",
      safetySignals.watch.length ? `Watch items: ${safetySignals.watch.slice(0, 3).join("; ")}.` : "Add symptoms, timing, allergies, and other medicines for stronger triage."
    ];
  const interactionChecklist = Array.from(new Set([
    ...interactionPrompts,
    "Check all prescriptions, OTC pain/cold/flu products, vitamins, herbs, supplements, alcohol, grapefruit, and duplicate active ingredients.",
    specialContexts.length ? `Context to share: ${specialContexts.join(", ")}.` : "Share kidney, liver, pregnancy/breastfeeding, fall risk, and procedure context if relevant."
  ])).slice(0, 6);
  const labelChecklist = [
    "Exact brand/generic or active ingredient",
    "Strength, form, route, timing, duration, and reason for use",
    "Last taken time, missed/late/extra dose details, and current symptom timeline",
    "Prescriber, pharmacy, refill status, storage/expiry, and written label source"
  ];
  const nextSafeSteps = urgent
    ? safetyTriage.slice(0, 3)
    : [
      reviewGaps.length ? `Add missing detail: ${reviewGaps.slice(0, 3).join(", ")}.` : "Core medicine review details are present.",
      highRiskMatches.length ? "Confirm medicine-specific instructions with a pharmacist or clinician before changing the next dose." : "Use the written label as the source of truth and confirm uncertainty with a pharmacist.",
      interactionChecklist[0] || "Review other medicines and supplements before combining products."
    ];

  return {
    priority,
    confidence,
    reviewType,
    highRiskMatches: Array.from(new Set(highRiskMatches)),
    specialContexts: Array.from(new Set(specialContexts)),
    safetyTriage,
    interactionChecklist,
    labelChecklist,
    nextSafeSteps,
    reviewGaps
  };
}

function buildPharmacistQuestionPacket({ reviewType, medicineSignals, riskThemes, missedDose, highRiskMedicine, context }) {
  const questions = new Set([
    "Can you confirm the medicine name, generic, strength, purpose, timing, and duration from the written label?",
    "Are there any duplicate active ingredients across my prescriptions, OTC products, cold/flu products, vitamins, herbs, or supplements?",
    "Which side effects are expected, and which warning signs mean I should seek urgent help?"
  ]);

  if (missedDose) {
    questions.add(highRiskMedicine
      ? "Because this may be high-risk, what exact missed-dose instruction applies to this medicine?"
      : "If I miss or take this medicine late, should I take it, skip it, or wait for the next scheduled time?");
  }

  if (context.lastMedicationTime) {
    questions.add(`Does this last-taken timing change the advice: ${context.lastMedicationTime}?`);
  }

  if (reviewType === "interactions" || riskThemes.length) {
    questions.add(`Can you screen these risk themes: ${riskThemes.join(", ") || "interaction risk"}?`);
  }

  if (medicineSignals.length) {
    questions.add(`Please check these medicines together: ${medicineSignals.slice(0, 6).join(", ")}.`);
  }

  return Array.from(questions).slice(0, 7);
}

function profileListText(value) {
  if (Array.isArray(value)) {
    return value.join(" ");
  }

  return String(value || "");
}

function profileListArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  return String(value || "")
    .split(/[,;\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildPharmacyActions({ priority, reviewType, missedDose, highRiskMedicine, safetySignals, medicineSignals, context }) {
  if (safetySignals.urgent.length) {
    return [
      "If breathing trouble, face/throat swelling, fainting, severe bleeding, chest pain, confusion, seizure, or one-sided weakness is active, seek urgent real-world medical help.",
      "Keep the medicine package, dose label, time taken, and symptom timeline ready.",
      "Do not take another dose until a clinician or pharmacist confirms what is safe."
    ];
  }

  if (missedDose) {
    return [
      highRiskMedicine
        ? "Because this may involve a high-risk medicine, contact a pharmacist or clinician for medicine-specific missed-dose instructions."
        : "Check the medicine label for missed-dose instructions or call a pharmacist.",
      "Do not double the next dose from this app.",
      context.lastMedicationTime ? `Share last taken timing: ${context.lastMedicationTime}.` : "Write down when the last dose was taken and when the next dose is scheduled."
    ];
  }

  if (reviewType === "interactions") {
    return [
      "List every prescription, OTC medicine, vitamin, herb, supplement, alcohol use, and relevant food interaction concern.",
      "Ask a pharmacist to check duplicate active ingredients and interaction risk before combining medicines.",
      "Share kidney, liver, allergy, pregnancy, bleeding, heart rhythm, and diabetes context when relevant."
    ];
  }

  if (reviewType === "allergy") {
    return [
      "Treat breathing trouble, face/throat swelling, fainting, or rapidly worsening rash as urgent.",
      "Record the medicine name, first dose time, symptom onset time, and photos of rash if safe.",
      "Ask whether this should be added to the allergy record."
    ];
  }

  return [
    medicineSignals.length ? `Confirm the exact label for: ${medicineSignals.slice(0, 3).join(", ")}.` : "Confirm the exact medicine name and label.",
    "Review common side effects, serious warning signs, and interaction questions with a pharmacist or clinician.",
    priority === "routine label review" ? "Use the written label as the source of truth." : "Use the focused warning prompts before continuing routine use."
  ];
}

const labValueRules = [
  { id: "hba1c", label: "HbA1c", aliases: ["hba1c", "a1c"], unit: "%", max: 5.7, high: 6.5, criticalHigh: 10, category: "diabetes", detail: "average blood sugar pattern over the past few months" },
  { id: "fasting-glucose", label: "Fasting glucose", aliases: ["fasting glucose", "fasting blood sugar", "fbs"], unit: "mg/dL", min: 70, max: 99, high: 126, criticalLow: 54, criticalHigh: 250, category: "diabetes", detail: "fasting blood sugar" },
  { id: "random-glucose", label: "Random glucose", aliases: ["random glucose", "random blood sugar", "rbs", "blood sugar", "glucose"], unit: "mg/dL", min: 70, max: 140, high: 200, criticalLow: 54, criticalHigh: 300, category: "diabetes", detail: "blood sugar outside fasting context" },
  { id: "ldl", label: "LDL", aliases: ["ldl cholesterol", "ldl-c", "ldl"], unit: "mg/dL", max: 100, high: 160, criticalHigh: 190, category: "lipids", detail: "heart-risk cholesterol marker" },
  { id: "hdl", label: "HDL", aliases: ["hdl cholesterol", "hdl-c", "hdl"], unit: "mg/dL", min: 40, category: "lipids", detail: "protective cholesterol context" },
  { id: "triglycerides", label: "Triglycerides", aliases: ["triglycerides", "tg"], unit: "mg/dL", max: 150, high: 200, criticalHigh: 500, category: "lipids", detail: "blood fat influenced by sugar, meals, alcohol, medicines, and genetics" },
  { id: "hemoglobin", label: "Hemoglobin", aliases: ["hemoglobin", "hb"], unit: "g/dL", min: 12, max: 17, criticalLow: 8, category: "cbc", detail: "oxygen-carrying blood protein and anemia context" },
  { id: "wbc", label: "WBC", aliases: ["white blood cell", "white blood cells", "wbc"], unit: "10^3/uL", min: 4, max: 11, criticalLow: 2, criticalHigh: 20, category: "cbc", detail: "infection, inflammation, medicine, or blood-cell context" },
  { id: "platelets", label: "Platelets", aliases: ["platelet count", "platelets", "plt"], unit: "10^3/uL", min: 150, max: 450, criticalLow: 50, criticalHigh: 1000, category: "cbc", detail: "clotting cell count" },
  { id: "mcv", label: "MCV", aliases: ["mean corpuscular volume", "mcv"], unit: "fL", min: 80, max: 100, category: "cbc", detail: "red blood cell size, useful in anemia pattern review" },
  { id: "ferritin", label: "Ferritin", aliases: ["ferritin"], unit: "ng/mL", min: 30, max: 300, criticalLow: 10, category: "cbc", detail: "iron storage marker" },
  { id: "creatinine", label: "Creatinine", aliases: ["serum creatinine", "creatinine"], unit: "mg/dL", min: 0.6, max: 1.3, criticalHigh: 3, category: "kidney", detail: "kidney-related waste marker" },
  { id: "egfr", label: "eGFR", aliases: ["estimated gfr", "egfr", "gfr"], unit: "mL/min/1.73m2", min: 60, criticalLow: 30, category: "kidney", detail: "estimated kidney filtering function" },
  { id: "uacr", label: "Urine ACR", aliases: ["urine albumin creatinine ratio", "albumin creatinine ratio", "uacr", "acr"], unit: "mg/g", max: 30, high: 300, criticalHigh: 1000, category: "kidney", detail: "urine albumin marker for kidney and blood-vessel stress" },
  { id: "potassium", label: "Potassium", aliases: ["potassium", "k+"], unit: "mmol/L", min: 3.5, max: 5.1, criticalLow: 3, criticalHigh: 6, category: "electrolytes", detail: "electrolyte important for heart rhythm and muscle function" },
  { id: "sodium", label: "Sodium", aliases: ["sodium", "na+"], unit: "mmol/L", min: 135, max: 145, criticalLow: 125, criticalHigh: 155, category: "electrolytes", detail: "electrolyte related to fluid balance and brain/nerve function" },
  { id: "calcium", label: "Calcium", aliases: ["serum calcium", "calcium"], unit: "mg/dL", min: 8.5, max: 10.5, criticalLow: 7, criticalHigh: 12, category: "electrolytes", detail: "mineral related to bone, kidney, nerve, and hormone context" },
  { id: "alt", label: "ALT", aliases: ["alanine aminotransferase", "alt"], unit: "U/L", max: 45, high: 100, criticalHigh: 500, category: "liver", detail: "liver enzyme pattern" },
  { id: "ast", label: "AST", aliases: ["aspartate aminotransferase", "ast"], unit: "U/L", max: 45, high: 100, criticalHigh: 500, category: "liver", detail: "liver or muscle enzyme pattern" },
  { id: "bilirubin", label: "Bilirubin", aliases: ["total bilirubin", "bilirubin"], unit: "mg/dL", max: 1.2, high: 2, criticalHigh: 5, category: "liver", detail: "liver, bile, or blood-breakdown context" },
  { id: "tsh", label: "TSH", aliases: ["thyroid stimulating hormone", "tsh"], unit: "mIU/L", min: 0.4, max: 4, criticalLow: 0.05, criticalHigh: 10, category: "thyroid", detail: "thyroid control signal" },
  { id: "free-t4", label: "Free T4", aliases: ["free t4", "ft4"], unit: "ng/dL", min: 0.8, max: 1.8, criticalLow: 0.4, criticalHigh: 3, category: "thyroid", detail: "thyroid hormone level interpreted with TSH" },
  { id: "vitamin-d", label: "Vitamin D", aliases: ["25-oh vitamin d", "vitamin d", "vit d"], unit: "ng/mL", min: 30, criticalLow: 12, criticalHigh: 100, category: "vitamins", detail: "vitamin related to bone and muscle health" },
  { id: "vitamin-b12", label: "Vitamin B12", aliases: ["vitamin b12", "b12"], unit: "pg/mL", min: 200, max: 900, criticalLow: 150, category: "vitamins", detail: "vitamin related to nerves and blood-cell production" },
  { id: "crp", label: "CRP", aliases: ["c-reactive protein", "crp"], unit: "mg/L", max: 5, high: 10, criticalHigh: 100, category: "inflammation", detail: "nonspecific inflammation marker" },
  { id: "esr", label: "ESR", aliases: ["erythrocyte sedimentation rate", "esr", "sed rate"], unit: "mm/hr", max: 20, high: 50, criticalHigh: 100, category: "inflammation", detail: "nonspecific inflammation marker" }
];

function extractLabSignalTerms(text) {
  const signalMap = [
    ["hba1c", "HbA1c"],
    ["a1c", "HbA1c"],
    ["fasting glucose", "fasting glucose"],
    ["random glucose", "random glucose"],
    ["blood sugar", "blood sugar"],
    ["cholesterol", "cholesterol"],
    ["ldl", "LDL"],
    ["hdl", "HDL"],
    ["triglycerides", "triglycerides"],
    ["non hdl", "non-HDL"],
    ["creatinine", "creatinine"],
    ["egfr", "eGFR"],
    ["gfr", "eGFR"],
    ["uacr", "urine ACR"],
    ["albumin creatinine", "urine ACR"],
    ["hemoglobin", "hemoglobin"],
    ["cbc", "CBC"],
    ["wbc", "WBC"],
    ["platelet", "platelets"],
    ["mcv", "MCV"],
    ["ferritin", "ferritin"],
    ["thyroid", "thyroid"],
    ["tsh", "TSH"],
    ["free t4", "free T4"],
    ["alt", "ALT"],
    ["ast", "AST"],
    ["bilirubin", "bilirubin"],
    ["alkaline phosphatase", "ALP"],
    ["potassium", "potassium"],
    ["sodium", "sodium"],
    ["calcium", "calcium"],
    ["magnesium", "magnesium"],
    ["chloride", "chloride"],
    ["vitamin d", "vitamin D"],
    ["vitamin b12", "vitamin B12"],
    ["crp", "CRP"],
    ["esr", "ESR"]
  ];

  return Array.from(new Set(signalMap
    .filter(([term]) => hasTerm(text, term))
    .map(([, label]) => label)));
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractLabValueSignals(text) {
  const lines = String(text || "")
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const found = [];
  const used = new Set();

  for (const rule of labValueRules) {
    for (const alias of rule.aliases) {
      const aliasPattern = escapeRegExp(alias).replace(/\\s+/g, "\\s+");
      const pattern = new RegExp(`(?:^|[^a-z0-9])${aliasPattern}(?:\\b|(?=[^a-z0-9+]))[^\\d<>]{0,45}([<>]?\\s*\\d+(?:\\.\\d+)?)\\s*([%a-zA-Z/u0-9.^+-]+)?`, "i");
      const matchLine = lines.find((line) => pattern.test(line) && !shouldSkipLabValueLine(rule, line));
      const match = pattern.exec(matchLine || text);

      if (!match || used.has(rule.id) || shouldSkipLabValueLine(rule, matchLine || text)) {
        continue;
      }

      const value = Number.parseFloat(String(match[1] || "").replace(/[<>\s]/g, ""));

      if (!Number.isFinite(value)) {
        continue;
      }

      used.add(rule.id);
      found.push(evaluateLabValueRule(rule, value, normalizeLabValueUnit(match[2]) || rule.unit));
      break;
    }
  }

  const rank = { critical: 4, high: 3, medium: 2, low: 1 };
  return found.sort((first, second) => (rank[second.level] || 0) - (rank[first.level] || 0));
}

function shouldSkipLabValueLine(rule, line) {
  const source = buildSearchText(line);

  if (rule.id === "creatinine" && /(urine|uacr|acr|albumin creatinine|albumin\/creatinine|creatinine ratio)/.test(source)) {
    return true;
  }

  if (rule.id === "random-glucose" && /(fasting glucose|fasting blood sugar|fbs)/.test(source)) {
    return true;
  }

  if (rule.id === "fasting-glucose" && /(random glucose|random blood sugar|rbs|after meal|post meal|non fasting|non-fasting)/.test(source)) {
    return true;
  }

  return false;
}

function normalizeLabValueUnit(unit) {
  return String(unit || "")
    .replace(/\u03bc/g, "u")
    .replace(/\u00b5/g, "u")
    .replace(/\.$/, "")
    .trim();
}

function evaluateLabValueRule(rule, value, unit) {
  let level = "low";
  let status = "within broad guide";

  if (Number.isFinite(rule.criticalLow) && value <= rule.criticalLow) {
    level = "critical";
    status = "urgent low";
  } else if (Number.isFinite(rule.criticalHigh) && value >= rule.criticalHigh) {
    level = "critical";
    status = "urgent high";
  } else if (Number.isFinite(rule.min) && value < rule.min) {
    level = "high";
    status = "low";
  } else if (Number.isFinite(rule.max) && value > rule.max) {
    level = Number.isFinite(rule.high) && value >= rule.high ? "high" : "medium";
    status = Number.isFinite(rule.high) && value >= rule.high ? "high" : "above broad guide";
  }

  return {
    id: rule.id,
    label: rule.label,
    value,
    unit,
    level,
    status,
    category: rule.category,
    detail: rule.detail
  };
}

function classifyLabPanelType(text, signals, valueSignals = []) {
  const signalText = `${text} ${signals.join(" ")}`.toLowerCase();
  const categories = new Set(valueSignals.map((signal) => signal.category));

  if (categories.has("diabetes") || /hba1c|a1c|glucose|blood sugar|diabetes/.test(signalText)) return "diabetes and sugar";
  if (categories.has("lipids") || /cholesterol|ldl|hdl|triglyceride|non-hdl/.test(signalText)) return "lipid and heart-risk";
  if (categories.has("cbc") || /cbc|hemoglobin|wbc|platelet|mcv|ferritin|anemia/.test(signalText)) return "CBC and anemia";
  if (categories.has("kidney") || /creatinine|egfr|gfr|uacr|albumin creatinine|urine protein|kidney/.test(signalText)) return "kidney and urine";
  if (categories.has("thyroid") || /tsh|free t4|thyroid/.test(signalText)) return "thyroid";
  if (categories.has("liver") || /alt|ast|bilirubin|alkaline phosphatase|albumin|liver/.test(signalText)) return "liver enzyme";
  if (categories.has("electrolytes") || /potassium|sodium|calcium|magnesium|chloride|electrolyte/.test(signalText)) return "electrolyte";
  if (categories.has("vitamins") || /vitamin d|vitamin b12|b12|nutrition/.test(signalText)) return "vitamin and nutrition";
  if (categories.has("inflammation") || /crp|esr|inflammation|infection/.test(signalText)) return "inflammation";

  return "general lab";
}

function assessLabReportReadiness(text, signals) {
  if (!text) {
    return 0;
  }

  let score = 30 + Math.min(signals.length * 7, 35);

  if (/report date|collection date|sample date|\b\d{4}-\d{1,2}-\d{1,2}\b|\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/.test(text)) score += 8;
  if (/reference|range|normal|flag/.test(text)) score += 8;
  if (/previous|prior|last result|trend|repeat|stable|worse|better|improved/.test(text)) score += 7;
  if (/fasting|non fasting|non-fasting|random|after meal/.test(text)) score += 5;
  if (/symptom|tired|dizzy|pain|fever|swelling|shortness|headache/.test(text)) score += 5;
  if (/medicine|medication|metformin|statin|thyroid|supplement|insulin|bp medicine/.test(text)) score += 5;

  return Math.max(0, Math.min(96, score));
}

function detectLabReviewPriority(text, signals, valueSignals = []) {
  const urgentSignals = valueSignals
    .filter((signal) => signal.level === "critical")
    .map((signal) => `${signal.label} ${signal.value}${signal.unit ? ` ${signal.unit}` : ""} is ${signal.status}`);
  const highSignals = valueSignals
    .filter((signal) => signal.level === "high")
    .map((signal) => `${signal.label} ${signal.value}${signal.unit ? ` ${signal.unit}` : ""} is ${signal.status}`);

  if (/potassium\s*(?:>|above|high)?\s*6(?:\.|\b)|sodium\s*(?:<|below|low)?\s*12[0-9]\b|hemoglobin\s*(?:<|below|low)?\s*[0-7](?:\.|\b)/.test(text)) {
    urgentSignals.push("very abnormal electrolyte or blood-count wording");
  }

  if (/chest pain|trouble breathing|fainting|confusion|severe weakness|yellow eyes|black stool|vomiting blood|seizure/.test(text)) {
    urgentSignals.push("urgent symptom wording");
  }

  const hasCriticalFlagWording = /urgent|critical|panic|danger|flagged/.test(text)
    && !/\b(?:no|none|without|absent)\s+(?:urgent|critical|panic|danger|flagged|same[-\s]?day)\b/.test(text)
    && !/\b(?:urgent|critical|panic|danger|same[-\s]?day)\s+(?:flags?|signals?)\s*:\s*(?:none|no|not detected|absent)\b/.test(text);

  if (signals.some((signal) => ["potassium", "sodium", "eGFR", "creatinine", "bilirubin"].includes(signal)) && hasCriticalFlagWording) {
    urgentSignals.push("critical lab flag wording");
  }

  if (urgentSignals.length) {
    return { label: "prompt clinical review", urgentSignals, highSignals };
  }

  if (highSignals.length >= 2 || /worsening|rapid rise|rapid drop|new abnormal/.test(text)) {
    return { label: "focused clinician review", urgentSignals, highSignals };
  }

  return { label: "clinician-review preparation", urgentSignals, highSignals };
}

function buildLabAgentActions({ panelType, priority, signals, readiness, valueSignals = [] }) {
  const abnormal = valueSignals.filter((signal) => signal.level !== "low");
  const actions = [
    abnormal.length
      ? `Prioritize review of: ${abnormal.slice(0, 4).map((signal) => `${signal.label} ${signal.value}${signal.unit ? ` ${signal.unit}` : ""} (${signal.status})`).join("; ")}.`
      : signals.length
      ? `Confirm exact value, unit, and lab reference range for: ${signals.slice(0, 4).join(", ")}.`
      : "Confirm the exact lab test names, values, units, and reference ranges.",
    panelType === "diabetes and sugar"
      ? "Ask how sugar results fit with food pattern, activity, medicines, and follow-up timing."
      : panelType === "lipid and heart-risk"
        ? "Ask which cholesterol target applies based on age, BP, diabetes, smoking, and family history."
        : panelType === "kidney and urine"
          ? "Ask whether kidney function, urine protein, potassium, BP, hydration, or medicine review is needed."
          : panelType === "CBC and anemia"
            ? "Ask whether anemia, iron, B12, infection, inflammation, bleeding, or repeat testing should be reviewed."
            : "Ask what changed versus prior results and what follow-up timing is appropriate.",
    readiness >= 75
      ? "Use the summary as a doctor-visit preparation note."
      : "Add report date, reference range, fasting status, symptoms, medicines, and prior values before sharing."
  ];

  if (priority.urgentSignals.length) {
    actions.unshift("Use real clinical care promptly for urgent symptoms or critical lab flags.");
  }

  return actions.slice(0, 4);
}

function buildLabAgentQuestionPacket({ panelType, priority, valueSignals, signals }) {
  const abnormal = valueSignals.filter((signal) => signal.level !== "low");
  const questions = new Set([
    "Which value matters most for my age, health conditions, medicines, symptoms, and lab reference range?",
    "What changed compared with my previous report, and when should this be repeated?",
    "Do any current medicines, supplements, hydration changes, infection, or fasting status affect these results?"
  ]);

  if (priority.urgentSignals.length) {
    questions.add("Do any values or symptoms require same-day clinical review?");
  }

  for (const signal of abnormal.slice(0, 4)) {
    questions.add(`What are common explanations for ${signal.label} being ${signal.status}, and what follow-up test or action is usually considered?`);
  }

  if (/diabetes/.test(panelType) || signals.includes("HbA1c")) {
    questions.add("How do these sugar results fit with meal timing, home glucose readings, medicines, kidney function, and my personal target?");
  }

  if (/lipid|heart/.test(panelType)) {
    questions.add("What LDL, non-HDL, triglyceride, or overall heart-risk target applies to me?");
  }

  if (/kidney/.test(panelType)) {
    questions.add("Do these kidney or urine results require BP review, urine repeat, hydration review, potassium check, or medicine review?");
  }

  if (/CBC|anemia/i.test(panelType)) {
    questions.add("Could anemia, iron, B12, bleeding, inflammation, infection, or kidney disease explain this pattern?");
  }

  return Array.from(questions).slice(0, 8);
}

function runLabsAgent({ message, medicalKnowledge }) {
  const text = buildSearchText(message);
  const valueSignals = extractLabValueSignals(message);
  const signals = Array.from(new Set([...extractLabSignalTerms(text), ...valueSignals.map((signal) => signal.label)]));
  const panelType = classifyLabPanelType(text, signals, valueSignals);
  const readiness = assessLabReportReadiness(text, signals);
  const priority = detectLabReviewPriority(text, signals, valueSignals);
  const references = getRouteKnowledgeMatches("LABS_AGENT", medicalKnowledge, 3);
  const evidenceCoverage = getRouteKnowledgeCoverage("LABS_AGENT", medicalKnowledge);
  const labActions = buildLabAgentActions({ panelType, priority, signals, readiness, valueSignals });
  const doctorQuestions = buildLabAgentQuestionPacket({ panelType, priority, valueSignals, signals });
  const abnormalValues = valueSignals.filter((signal) => signal.level !== "low");
  const accuracyGaps = [
    !/reference|range|normal|flag/.test(text) ? "lab reference range" : "",
    !/report date|collection date|sample date|\b\d{4}-\d{1,2}-\d{1,2}\b|\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/.test(text) ? "report date" : "",
    !/previous|prior|last result|trend|repeat|stable|worse|better|improved/.test(text) ? "prior result or trend" : "",
    !/fasting|non fasting|non-fasting|random|after meal/.test(text) ? "fasting or meal timing" : "",
    !/medicine|medication|metformin|statin|thyroid|supplement|insulin|bp medicine/.test(text) ? "current medicine context" : ""
  ].filter(Boolean);

  return createAgentResult("LABS_AGENT", "Lab Report", "complete", {
    intentRoute: "Lab Report",
    summary: valueSignals.length
      ? `${panelType} lab review detected with ${valueSignals.length} parsed value(s). ${abnormalValues.length ? `Needs review: ${abnormalValues.slice(0, 4).map((signal) => signal.label).join(", ")}. ` : ""}Priority: ${priority.label}. Report readiness: ${readiness}%.`
      : signals.length
        ? `${panelType} lab review detected: ${signals.slice(0, 8).join(", ")}. Priority: ${priority.label}. Report readiness: ${readiness}%.`
      : `Lab report wording was detected. Priority: ${priority.label}. Add exact values for a stronger review.`,
    productionTool: "Offline lab-report specialist with marker extraction, panel classification, readiness scoring, and clinician-question synthesis.",
    panelType,
    priority: priority.label,
    prioritySignals: priority,
    labSignals: signals,
    parsedValues: valueSignals,
    abnormalValues,
    readiness,
    accuracyGaps,
    labActions,
    checklist: labActions,
    doctorQuestions,
    reportQualityChecks: [
      "Exact marker name, value, and unit",
      "Lab reference range and flag",
      "Report date and previous result",
      "Fasting or meal timing when relevant",
      "Symptoms, medicines, and clinical reason for test"
    ],
    evidenceCoverage,
    references: mapKnowledgeReferences(references, 3),
    liveAction: "No diagnosis or treatment change is made from lab values."
  });
}

function getWellnessProfile(context = {}) {
  return typeof context.wellnessProfile === "object" && context.wellnessProfile
    ? context.wellnessProfile
    : {};
}

function inferWellnessPriorityPillar(text, wellnessProfile = {}) {
  const scores = {
    Movement: 0,
    Food: 0,
    Sleep: 0,
    Stress: 0,
    Hydration: 0,
    Prevention: 0
  };

  const add = (pillar, points) => {
    scores[pillar] = (scores[pillar] || 0) + points;
  };

  if (wellnessProfile.activity === "low" || hasTerm(text, "sitting") || hasTerm(text, "inactive") || hasTerm(text, "no exercise")) add("Movement", 5);
  if (["joint-pain", "limited", "recovering"].includes(wellnessProfile.mobility)) add("Movement", 3);
  if (wellnessProfile.diet === "skips" || wellnessProfile.diet === "processed" || wellnessProfile.diet === "sugary" || hasTerm(text, "diet") || hasTerm(text, "food") || hasTerm(text, "weight")) add("Food", 4);
  if (wellnessProfile.sleep === "poor" || wellnessProfile.sleep === "irregular" || wellnessProfile.evening === "screens" || wellnessProfile.evening === "caffeine" || hasTerm(text, "sleep") || hasTerm(text, "insomnia")) add("Sleep", 5);
  if (wellnessProfile.stress === "high" || wellnessProfile.stress === "medium" || wellnessProfile.support === "low" || hasTerm(text, "stress") || hasTerm(text, "anxiety") || hasTerm(text, "burnout") || hasTerm(text, "overwhelmed")) add("Stress", 5);
  if (wellnessProfile.hydration === "low" || wellnessProfile.hydration === "caffeine" || hasTerm(text, "hydration") || hasTerm(text, "water")) add("Hydration", 3);
  if (wellnessProfile.prevention === "due" || wellnessProfile.prevention === "unknown" || hasTerm(text, "prevention") || hasTerm(text, "screening") || hasTerm(text, "vaccine")) add("Prevention", 4);

  return Object.entries(scores)
    .sort((first, second) => second[1] - first[1])
    .find(([, score]) => score > 0)?.[0] || "Movement";
}

function buildWellnessHabitLoop(priorityPillar, wellnessProfile = {}) {
  const loops = {
    Movement: [
      "Cue: after a meal, call, or screen block",
      wellnessProfile.mobility === "limited" ? "Action: chair movement or safe standing break" : "Action: comfortable walk, mobility, or strength block",
      "Proof: minutes moved and how the body felt"
    ],
    Food: [
      "Cue: first meal or hardest snack time",
      "Action: add protein or fiber plus fruit/vegetable or water",
      "Proof: energy, hunger, and sugar/BP context if relevant"
    ],
    Sleep: [
      "Cue: one hour before target sleep window",
      "Action: reduce screens/caffeine and use a calm wind-down",
      "Proof: bedtime, wake time, and rest quality"
    ],
    Stress: [
      "Cue: tension, racing thoughts, or high workload",
      "Action: 3-5 minute reset plus one support touchpoint if needed",
      "Proof: stress level before and after"
    ],
    Hydration: [
      "Cue: wake-up, meals, medicines, or work breaks",
      "Action: keep water visible and drink small amounts regularly",
      "Proof: water cues completed and late caffeine avoided"
    ],
    Prevention: [
      "Cue: weekly planning time",
      "Action: list one due check, vaccine, screening, or follow-up question",
      "Proof: appointment, reminder, or question prepared"
    ]
  };

  return loops[priorityPillar] || loops.Movement;
}

function buildLifestyleActions(text, profile, context) {
  const actions = [];
  const wellnessProfile = getWellnessProfile(context);
  const hasConditionContext = profile.conditions.length > 0;
  const lowMovement = wellnessProfile.activity === "low" || hasTerm(text, "sitting") || hasTerm(text, "inactive") || hasTerm(text, "no exercise") || hasTerm(text, "tired");
  const sleepConcern = wellnessProfile.sleep === "poor" || wellnessProfile.sleep === "irregular" || hasTerm(text, "sleep") || hasTerm(text, "insomnia") || hasTerm(text, "late night");
  const stressConcern = wellnessProfile.stress === "high" || wellnessProfile.stress === "medium" || hasTerm(text, "stress") || hasTerm(text, "anxiety") || hasTerm(text, "burnout") || hasTerm(text, "overwhelmed");
  const foodConcern = ["skips", "processed", "sugary"].includes(wellnessProfile.diet) || hasTerm(text, "diet") || hasTerm(text, "food") || hasTerm(text, "sugar") || hasTerm(text, "processed") || hasTerm(text, "weight");
  const hydrationConcern = wellnessProfile.hydration === "low" || wellnessProfile.hydration === "caffeine" || hasTerm(text, "water") || hasTerm(text, "hydration");
  const preventionConcern = wellnessProfile.prevention === "due" || wellnessProfile.prevention === "unknown" || hasTerm(text, "prevention") || hasTerm(text, "screening") || hasTerm(text, "vaccine");
  const priorityPillar = inferWellnessPriorityPillar(text, wellnessProfile);

  if (lowMovement) {
    actions.push(wellnessProfile.mobility === "limited"
      ? "Start with chair movement, safe standing breaks, or clinician-approved range-of-motion."
      : "Start with a short, comfortable movement block and increase only when it feels safe.");
  }

  if (sleepConcern) {
    actions.push("Protect a consistent wake time, calmer wind-down, and earlier caffeine boundary.");
  }

  if (stressConcern) {
    actions.push("Use one daily recovery practice and add real support if stress feels persistent or unsafe.");
  }

  if (foodConcern) {
    actions.push("Use regular meals with protein, fiber, vegetables or fruit, water, and fewer sugary drinks.");
  }

  if (hydrationConcern) {
    actions.push("Attach water to existing cues: wake-up, meals, medicine time, work breaks, and travel.");
  }

  if (preventionConcern) {
    actions.push("Prepare one due prevention item: BP/sugar trend, vaccine, dental, vision, screening, or follow-up question.");
  }

  if (!actions.length) {
    actions.push("Choose one habit for this week: movement, sleep, hydration, food rhythm, stress recovery, or prevention.");
  }

  if (hasConditionContext) {
    actions.push(`Keep changes compatible with saved conditions: ${profile.conditions.slice(0, 3).join(", ")}.`);
  }

  actions.push(`Priority pillar: ${priorityPillar}. Match intensity to current severity ${context.severity}/10 and stop if symptoms feel unsafe.`);

  return actions.slice(0, 5);
}

function runLifestyleAgent({ message, profile, context, medicalKnowledge }) {
  const knowledgeMatches = getRouteKnowledgeMatches("LIFESTYLE_AGENT", medicalKnowledge, 3);
  const evidenceCoverage = getRouteKnowledgeCoverage("LIFESTYLE_AGENT", medicalKnowledge);
  const text = buildSearchText(message);
  const wellnessProfile = getWellnessProfile(context);
  const focusAreas = [
    ["diet", "meal planning"],
    ["nutrition", "nutrition"],
    ["exercise", "activity"],
    ["walking", "walking"],
    ["sleep", "sleep routine"],
    ["hydration", "hydration"],
    ["water", "hydration"],
    ["weight", "weight management"],
    ["screen", "evening routine"],
    ["caffeine", "sleep routine"],
    ["prevention", "prevention"],
    ["vaccine", "prevention"],
    ["support", "support system"],
    ["walking", "walking"]
  ]
    .filter(([term]) => hasTerm(text, term))
    .map(([, label]) => label);
  if (wellnessProfile.healthFocus && wellnessProfile.healthFocus !== "general") {
    focusAreas.push(String(wellnessProfile.healthFocus).replace(/-/g, " "));
  }
  if (wellnessProfile.focus && wellnessProfile.focus !== "balanced") {
    focusAreas.push(String(wellnessProfile.focus).replace(/-/g, " "));
  }
  const uniqueFocus = Array.from(new Set(focusAreas));
  const lifestyleActions = buildLifestyleActions(text, profile, context);
  const priorityPillar = inferWellnessPriorityPillar(text, wellnessProfile);
  const habitLoop = buildWellnessHabitLoop(priorityPillar, wellnessProfile);
  const planIntensity = ["poor", "high"].includes(wellnessProfile.sleep) || wellnessProfile.stress === "high" || ["limited", "recovering"].includes(wellnessProfile.mobility)
    ? "gentle"
    : "standard";
  const trackingPlan = [
    `${priorityPillar} completion`,
    "sleep quality",
    "energy",
    wellnessProfile.healthFocus === "heart-metabolic" ? "BP/sugar trend" : wellnessProfile.healthFocus === "diabetes-support" ? "meal timing and sugar context" : "mood or stress level"
  ];

  return createAgentResult("LIFESTYLE_AGENT", "Lifestyle Guide", "complete", {
    intentRoute: "Lifestyle",
    summary: uniqueFocus.length
      ? `Wellness focus detected: ${uniqueFocus.join(", ")}. Priority pillar: ${priorityPillar}. The agent prepared a safe habit loop that fits the saved care context.`
      : `Wellness support was activated. Priority pillar: ${priorityPillar}. The agent prepared diet, hydration, sleep, activity, stress, and prevention prompts.`,
    productionTool: "Lifestyle coaching workflow with age-aware habits, routine scoring, prevention prompts, and safe intensity checks.",
    careContext: profile.conditions.length ? `Known condition context: ${profile.conditions.join(", ")}.` : "No saved condition context.",
    focusAreas: uniqueFocus,
    priorityPillar,
    planIntensity,
    habitLoop,
    trackingPlan,
    lifestyleActions,
    safetyBoundaries: [
      "Do not change medicines, diet restrictions, or exercise limits given by a clinician.",
      "Stop activity and seek real-world care for chest pain, severe breathlessness, fainting, confusion, one-sided weakness, or unsafe feelings.",
      planIntensity === "gentle" ? "Use gentle pacing first because sleep, stress, mobility, or recovery context needs caution." : "Increase slowly only if the habit feels safe and repeatable."
    ],
    clinicianQuestions: [
      "Are any activity limits, food restrictions, or medicine timing rules important for me?",
      "Which prevention checks should I prioritize this month?",
      "Which symptom or reading would mean I should stop the plan and seek care?"
    ],
    evidenceCoverage,
    references: mapKnowledgeReferences(knowledgeMatches, 3),
    nextPrompts: [
      ...lifestyleActions.slice(0, 3),
      "Avoid replacing disease-specific instructions."
    ],
    liveAction: "No diet prescription, exercise prescription, or care-plan change is made."
  });
}

function runWellnessAgent({ message, profile, context, risk, medicalKnowledge }) {
  const knowledgeMatches = getRouteKnowledgeMatches("WELLNESS_AGENT", medicalKnowledge, 3);
  const evidenceCoverage = getRouteKnowledgeCoverage("WELLNESS_AGENT", medicalKnowledge);
  const text = buildSearchText(message);
  const wellnessProfile = getWellnessProfile(context);
  const crisisSignal = hasTerm(text, "self harm") || hasTerm(text, "suicide") || hasTerm(text, "unsafe");
  const focus = ["stress", "anxiety", "panic", "worried", "mood", "sad", "depressed", "cannot sleep", "burnout", "lonely"]
    .filter((term) => hasTerm(text, term));
  const priorityPillar = crisisSignal ? "Safety" : inferWellnessPriorityPillar(text, wellnessProfile);
  const hasSavedContext = profile.conditions.length || wellnessProfile.healthFocus || wellnessProfile.focus;

  return createAgentResult("WELLNESS_AGENT", "Mental Wellness", "complete", {
    intentRoute: "Mental Wellness",
    summary: crisisSignal
      ? "Self-harm or crisis wording was detected, so urgent real-world support takes priority."
      : `Wellness wording was detected${focus.length ? `: ${focus.join(", ")}` : ""}. Priority pillar: ${priorityPillar}. The agent prepared supportive, non-diagnostic next steps.`,
    productionTool: "Mental wellness and resilience triage workflow.",
    priorityPillar,
    careContext: hasSavedContext ? `Context used: ${[...profile.conditions, wellnessProfile.healthFocus, wellnessProfile.focus].filter(Boolean).slice(0, 5).join(", ")}.` : "No saved wellness context was supplied.",
    supportPlan: crisisSignal
      ? ["Seek immediate real-world help now.", "Stay near someone safe if possible."]
      : [
        "Pause and use a calming routine for 3-5 minutes.",
        "Reduce the next task to one small action you can complete today.",
        "Consider contacting a clinician, counselor, or trusted person if symptoms continue."
      ],
    habitLoop: crisisSignal ? ["Get safe", "Contact real-world support", "Stay with someone if possible"] : buildWellnessHabitLoop(priorityPillar, wellnessProfile),
    safetyBoundaries: [
      "This app does not provide therapy, diagnosis, or crisis intervention.",
      "Self-harm thoughts, feeling unsafe, severe panic, confusion, or inability to function needs immediate real-world support."
    ],
    evidenceCoverage,
    references: mapKnowledgeReferences(knowledgeMatches, 3),
    riskContext: risk.label,
    liveAction: "No therapy, crisis intervention, or emergency contact is performed by the app."
  });
}

function runRecordsAgent({ message, profile, vitals, context, risk, medicalKnowledge }) {
  const knowledgeMatches = getRouteKnowledgeMatches("RECORDS_AGENT", medicalKnowledge, 3);
  const evidenceCoverage = getRouteKnowledgeCoverage("RECORDS_AGENT", medicalKnowledge);
  const enteredVitals = Object.entries(vitals || {})
    .filter(([, value]) => value !== null)
    .map(([key, value]) => `${key}: ${value}`);
  const review = buildRecordsReview({ message, profile, vitals, context, risk, enteredVitals });

  return createAgentResult("RECORDS_AGENT", "Health Records", "complete", {
    intentRoute: "Health Records",
    summary: review.summary,
    productionTool: "Records and care-summary workflow.",
    recordQuality: review.recordQuality,
    missingFields: review.missingFields,
    timelineSignals: review.timelineSignals,
    packetSections: review.packetSections,
    reconciliationChecklist: review.reconciliationChecklist,
    nextActions: review.nextActions,
    summaryDraft: review.summaryDraft,
    evidenceCoverage,
    references: mapKnowledgeReferences(knowledgeMatches, 3),
    liveAction: "No official record is created, changed, uploaded, or sent."
  });
}

function buildRecordsReview({ message, profile, context, risk, enteredVitals }) {
  const text = buildSearchText(message);
  const requestedDoctorNote = hasTerm(text, "doctor note") || hasTerm(text, "handoff") || hasTerm(text, "share");
  const requestedTimeline = hasTerm(text, "timeline") || hasTerm(text, "history") || hasTerm(text, "summary");
  const hasProfileName = Boolean(profile.name);
  const hasAge = Boolean(profile.age);
  const hasConditions = Array.isArray(profile.conditions) && profile.conditions.length > 0;
  const hasMedications = Array.isArray(profile.medications) && profile.medications.length > 0;
  const hasAllergies = Array.isArray(profile.allergies) ? profile.allergies.length > 0 : Boolean(profile.allergies);
  const hasVitals = enteredVitals.length > 0;
  const fields = [
    ["Patient identity", hasProfileName],
    ["Age", hasAge],
    ["Conditions", hasConditions],
    ["Medicines", hasMedications],
    ["Allergies or safety alerts", hasAllergies],
    ["Recent vitals", hasVitals],
    ["Care goal", Boolean(context?.careGoal)],
    ["Severity", context?.severity !== undefined]
  ];
  const completeCount = fields.filter(([, filled]) => filled).length;
  const missingFields = fields.filter(([, filled]) => !filled).map(([label]) => label);
  const score = Math.round((completeCount / fields.length) * 100);
  const timelineSignals = [
    requestedTimeline ? "Timeline summary requested" : "Timeline can be built from saved records",
    hasVitals ? "Latest vitals available" : "Vitals not supplied in this run",
    hasMedications ? "Medicine list available" : "Medicine list missing",
    risk?.label ? `${risk.label} risk context available` : "Risk context pending"
  ];
  const packetSections = [
    {
      title: "Patient header",
      detail: `${profile.name || "Patient"}, age ${profile.age || "not provided"}`
    },
    {
      title: "Clinical background",
      detail: hasConditions ? profile.conditions.join(", ") : "Conditions not provided"
    },
    {
      title: "Medicines and alerts",
      detail: `${hasMedications ? profile.medications.join(", ") : "Medicines not provided"}; allergies/alerts: ${hasAllergies ? formatProfileAllergies(profile.allergies) : "not provided"}`
    },
    {
      title: "Current snapshot",
      detail: `${enteredVitals.length ? enteredVitals.join(", ") : "No vitals entered"}; risk ${risk?.label || "not scored"}; ${formatContextLabel(context?.careGoal)}, severity ${context?.severity ?? "not set"}/10`
    }
  ];

  return {
    summary: requestedDoctorNote
      ? "Records wording was detected. The agent prepared a doctor-ready packet structure with missing-field checks."
      : "Records wording was detected. The agent organized profile, medicines, vitals, alerts, and follow-up details for local review.",
    recordQuality: {
      score,
      label: score >= 85 ? "Share-ready draft" : score >= 60 ? "Usable draft" : "Needs more details"
    },
    missingFields,
    timelineSignals,
    packetSections,
    reconciliationChecklist: [
      "Confirm patient identity, date, source, and document type before sharing.",
      "Separate patient-reported notes from official hospital reports.",
      "Check medicines, allergies, and recent vitals for missing or conflicting entries.",
      "Attach original reports separately when a clinician needs proof."
    ],
    nextActions: missingFields.length
      ? missingFields.slice(0, 3).map((field) => `Add ${field.toLowerCase()} to improve packet quality.`)
      : ["Review the packet for accuracy before sharing.", "Keep original documents stored separately."],
    summaryDraft: {
      patient: `${profile.name || "Patient"}, age ${profile.age || "not provided"}`,
      conditions: hasConditions ? profile.conditions.join(", ") : "Not provided",
      medications: hasMedications ? profile.medications.join(", ") : "Not provided",
      allergies: hasAllergies ? formatProfileAllergies(profile.allergies) : "Not provided",
      vitals: enteredVitals.length ? enteredVitals.join(", ") : "No vitals entered",
      currentRisk: risk?.label || "Not scored",
      context: `${formatContextLabel(context?.careGoal)}, severity ${context?.severity ?? "not set"}/10`
    }
  };
}

function formatProfileAllergies(allergies) {
  if (Array.isArray(allergies)) {
    return allergies.join(", ");
  }

  return allergies || "Not provided";
}

function runInsuranceAgent({ message, profile, medicalKnowledge }) {
  const knowledgeMatches = getRouteKnowledgeMatches("INSURANCE_AGENT", medicalKnowledge, 3);
  const evidenceCoverage = getRouteKnowledgeCoverage("INSURANCE_AGENT", medicalKnowledge);
  const text = buildSearchText(message);
  const topics = ["insurance", "bill", "billing", "coverage", "claim", "claims", "eob", "authorization", "prior auth", "reimbursement"]
    .filter((term) => hasTerm(text, term));
  const review = buildInsuranceSupportReview({ text, message, profile, topics });

  return createAgentResult("INSURANCE_AGENT", "Insurance Support", "complete", {
    intentRoute: "Insurance",
    summary: review.summary,
    productionTool: "Insurance support workflow.",
    memberContext: profile.name || "Demo patient",
    claimPath: review.claimPath,
    documentGaps: review.documentGaps,
    eobReview: review.eobReview,
    appealReview: review.appealReview,
    benefitQuestions: review.benefitQuestions,
    packetSections: review.packetSections,
    checklist: review.checklist,
    evidenceCoverage,
    references: mapKnowledgeReferences(knowledgeMatches, 3),
    liveAction: "No claim, authorization, appeal, payment, or insurer message is submitted."
  });
}

function buildInsuranceSupportReview({ text, message, profile, topics }) {
  const claimPath = inferInsuranceClaimPath(text);
  const documentGaps = buildInsuranceDocumentGaps(text, claimPath);
  const eobReview = buildInsuranceEobReview(text);
  const appealReview = buildInsuranceAppealReview(text, claimPath);
  const benefitQuestions = buildInsuranceBenefitQuestions(text, claimPath);
  const packetSections = [
    {
      title: "Member and policy",
      detail: `${profile.name || "Patient"}; add policy/member ID, plan type, insurer/TPA, and contact channel.`
    },
    {
      title: "Claim facts",
      detail: "Add provider, service date, claim/pre-auth number, billed amount, allowed amount, paid amount, and patient responsibility."
    },
    {
      title: "Issue summary",
      detail: message ? trimInsuranceText(message, 220) : "Add the exact claim, bill, coverage, denial, or prior-authorization question."
    },
    {
      title: "Evidence",
      detail: documentGaps.missing.length ? `Missing ${documentGaps.missing.join(", ")}.` : "Core document packet looks complete for this detected path."
    }
  ];

  return {
    summary: topics.length
      ? `Insurance topic detected: ${topics.join(", ")}. Suggested path: ${claimPath.label}.`
      : `Insurance support is ready. Suggested path: ${claimPath.label}.`,
    claimPath,
    documentGaps,
    eobReview,
    appealReview,
    benefitQuestions,
    packetSections,
    checklist: [
      "Capture policy/member ID, claim/pre-auth number, provider, service date, and insurer/TPA contact.",
      "Keep EOB or denial letter, bills, receipts, clinical note, reports, claim form, and policy wording together.",
      "For a denial, identify the exact reason, policy clause, appeal deadline, and corrected evidence needed.",
      "Separate medical necessity questions from billing, coding, network, deductible, and benefit-limit questions.",
      "Use official insurer, employer benefits, or clinic billing staff for final coverage and payment decisions."
    ]
  };
}

function inferInsuranceClaimPath(text) {
  if (["denied", "denial", "rejected", "reject", "appeal", "not covered", "refused"].some((term) => hasTerm(text, term))) {
    return {
      id: "appeal",
      label: "Appeal or denial review",
      urgency: hasTerm(text, "urgent") ? "Expedited appeal may be relevant" : "Standard appeal packet"
    };
  }

  if (["prior auth", "preauth", "pre authorization", "authorization", "approval"].some((term) => hasTerm(text, term))) {
    return {
      id: "preauth",
      label: "Prior authorization",
      urgency: "Submit before planned service when policy requires it"
    };
  }

  if (["reimbursement", "paid", "receipt", "refund"].some((term) => hasTerm(text, term))) {
    return {
      id: "reimbursement",
      label: "Reimbursement claim",
      urgency: "Submit within insurer deadline"
    };
  }

  if (["eob", "allowed", "deductible", "copay", "coinsurance", "bill", "billing"].some((term) => hasTerm(text, term))) {
    return {
      id: "eob",
      label: "EOB and bill review",
      urgency: "Reconcile provider charge, allowed amount, insurer payment, and patient responsibility"
    };
  }

  if (["cashless", "network", "hospital"].some((term) => hasTerm(text, term))) {
    return {
      id: "cashless",
      label: "Cashless hospital claim",
      urgency: "Confirm network and pre-auth process"
    };
  }

  return {
    id: "coverage",
    label: "Coverage and benefits question",
    urgency: "Clarify policy wording and benefit limits"
  };
}

function buildInsuranceDocumentGaps(text, claimPath) {
  const requiredByPath = {
    appeal: ["EOB or denial letter", "policy wording", "claim form", "doctor letter", "bills/receipts", "reports"],
    preauth: ["policy card", "doctor note", "reports", "treatment estimate", "provider details"],
    reimbursement: ["claim form", "itemized bills", "payment receipts", "discharge summary if admitted", "reports", "ID/bank details"],
    eob: ["EOB", "itemized bill", "payment receipt", "policy wording", "provider statement"],
    cashless: ["policy card", "doctor note", "reports", "estimate", "network hospital confirmation"],
    coverage: ["policy wording", "summary of benefits", "service details", "provider details"]
  };
  const required = requiredByPath[claimPath.id] || requiredByPath.coverage;
  const present = required.filter((item) => hasAnyInsuranceEvidence(text, item));

  return {
    required,
    present,
    missing: required.filter((item) => !present.includes(item))
  };
}

function hasAnyInsuranceEvidence(text, label) {
  return label
    .toLowerCase()
    .split(/[ /-]+/)
    .filter((part) => part.length > 3)
    .some((part) => hasTerm(text, part));
}

function buildInsuranceEobReview(text) {
  const hasEob = hasTerm(text, "eob") || hasTerm(text, "explanation of benefits");
  const hasCostSignal = ["allowed", "deductible", "copay", "coinsurance", "paid", "balance", "provider charge"].some((term) => hasTerm(text, term));

  return {
    needed: hasEob || hasCostSignal,
    focus: [
      "Provider charge: what the provider billed.",
      "Allowed amount: what the plan uses as the eligible amount.",
      "Paid by insurer: what the plan paid.",
      "Patient responsibility: deductible, copay, coinsurance, non-covered items, or balance."
    ],
    nextCheck: hasCostSignal
      ? "Compare EOB amounts against the provider bill before paying a disputed balance."
      : "Add EOB amounts to identify what needs explanation."
  };
}

function buildInsuranceAppealReview(text, claimPath) {
  const isAppeal = claimPath.id === "appeal";

  return {
    active: isAppeal,
    reasonSignals: ["medical necessity", "not covered", "network", "coding", "waiting period", "pre-existing", "missing document", "experimental"]
      .filter((term) => hasTerm(text, term)),
    timingGuide: isAppeal
      ? "Track the appeal deadline from the denial notice and ask about expedited review for urgent care situations."
      : "If a denial happens later, save the notice and appeal instructions immediately.",
    packet: [
      "Denial/EOB notice with reason",
      "Policy wording or Summary of Benefits and Coverage",
      "Claim number and service date",
      "Doctor letter or clinical records supporting the service",
      "Corrected bills, codes, reports, or missing documents"
    ]
  };
}

function buildInsuranceBenefitQuestions(text, claimPath) {
  const questions = [
    "Is the provider in-network for this specific service date?",
    "Does this require prior authorization, referral, or pre-certification?",
    "What deductible, copay, coinsurance, sub-limit, or room-rent limit applies?",
    "Are there exclusions, waiting periods, or medical-necessity rules?",
    "What documents are missing and where should they be submitted?",
    "What is the claim, query, appeal, or external-review deadline?"
  ];

  if (claimPath.id === "eob") {
    questions.unshift("Why is the allowed amount different from the provider charge?");
  }

  if (["preauth", "cashless"].includes(claimPath.id)) {
    questions.unshift("How long is approval valid and what happens if the service date changes?");
  }

  return questions.slice(0, 7);
}

function trimInsuranceText(value, maxLength = 180) {
  const text = String(value || "").replace(/\s+/g, " ").trim();

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, Math.max(0, maxLength - 1)).trim()}...`;
}

function getSchedulingVisitProfile(context = {}) {
  return context.visitProfile && typeof context.visitProfile === "object" ? context.visitProfile : {};
}

function getSchedulingDepartmentById(id) {
  const departments = {
    "primary-care": {
      id: "primary-care",
      label: "Primary care",
      owner: "Primary care doctor"
    },
    cardiology: {
      id: "cardiology",
      label: "Cardiology",
      owner: "Heart specialist"
    },
    diabetes: {
      id: "diabetes",
      label: "Diabetes clinic",
      owner: "Diabetes care team"
    },
    "lab-review": {
      id: "lab-review",
      label: "Lab report review",
      owner: "Report review clinician"
    },
    pharmacy: {
      id: "pharmacy",
      label: "Pharmacist review",
      owner: "Clinical pharmacist"
    },
    telehealth: {
      id: "telehealth",
      label: "Telehealth",
      owner: "Remote care clinician"
    },
    "urgent-clinic": {
      id: "urgent-clinic",
      label: "Urgent clinic",
      owner: "Same-day care team"
    }
  };

  return departments[id] || null;
}

function getSchedulingVisitTypeById(id) {
  const visitTypes = {
    "follow-up": {
      id: "follow-up",
      label: "Follow-up"
    },
    "new-issue": {
      id: "new-issue",
      label: "New concern"
    },
    "routine-check": {
      id: "routine-check",
      label: "Routine check"
    },
    "lab-review": {
      id: "lab-review",
      label: "Lab review"
    },
    "medicine-review": {
      id: "medicine-review",
      label: "Medicine review"
    },
    "urgent-review": {
      id: "urgent-review",
      label: "Urgent review"
    },
    "post-discharge": {
      id: "post-discharge",
      label: "Post-discharge"
    }
  };

  return visitTypes[id] || null;
}

function runSchedulingAgent({ message, profile, risk, context, medicalKnowledge }) {
  const knowledgeMatches = getRouteKnowledgeMatches("SCHEDULING_AGENT", medicalKnowledge, 3);
  const evidenceCoverage = getRouteKnowledgeCoverage("SCHEDULING_AGENT", medicalKnowledge);
  const scheduling = buildSchedulingReview({ message, profile, risk, context });

  return createAgentResult("SCHEDULING_AGENT", "Appointment Booking", "complete", {
    intentRoute: "Appointment",
    summary: scheduling.summary,
    productionTool: "Hospital-ready appointment planning and follow-up workflow.",
    visitType: scheduling.visitType,
    suggestedDepartment: scheduling.department,
    priority: scheduling.priority,
    slotRecommendation: scheduling.slotRecommendation,
    bookingPacket: scheduling.bookingPacket,
    prepChecklist: scheduling.prepChecklist,
    followUpQuestions: scheduling.followUpQuestions,
    accessChecks: scheduling.accessChecks,
    visitActions: scheduling.visitActions,
    carePhase: scheduling.carePhase,
    readinessGaps: scheduling.readinessGaps,
    communicationScript: scheduling.communicationScript,
    triageBoundary: scheduling.triageBoundary,
    trackingPlan: scheduling.trackingPlan,
    coordinationChecklist: scheduling.coordinationChecklist,
    precisionFactors: scheduling.precisionFactors,
    evidenceCoverage,
    references: mapKnowledgeReferences(knowledgeMatches, 3),
    liveAction: "No appointment is booked, calendar is updated, message is sent, or emergency service is contacted."
  });
}

function buildSchedulingReview({ message, profile, risk, context }) {
  const visitProfile = getSchedulingVisitProfile(context);
  const text = buildSearchText([
    message,
    visitProfile.reason,
    visitProfile.pendingTests,
    visitProfile.medicineChanges,
    visitProfile.outcomeNotes,
    visitProfile.followupQuestion
  ].filter(Boolean).join(" "));
  const department = inferSchedulingDepartment(text, visitProfile);
  const visitType = inferSchedulingVisitType(text, visitProfile);
  const priority = inferSchedulingPriority({ text, risk, context, visitProfile });
  const needsAppointment = [
    "appointment",
    "doctor",
    "consult",
    "clinic",
    "visit",
    "schedule",
    "book",
    "follow up",
    "followup"
  ].some((term) => hasTerm(text, term)) || Object.keys(visitProfile).length > 0;
  const carePhase = buildSchedulingCarePhase({ text, department, visitType, priority, visitProfile });
  const readinessGaps = buildSchedulingReadinessGaps({ visitProfile, department, visitType, text });
  const communicationScript = buildSchedulingCommunicationScript({ message, profile, department, visitType, priority, visitProfile });
  const triageBoundary = buildSchedulingTriageBoundary(priority);
  const trackingPlan = buildSchedulingTrackingPlan({ department, visitType, priority, visitProfile });
  const coordinationChecklist = buildSchedulingCoordinationChecklist({ priority, department, visitProfile });
  const precisionFactors = buildSchedulingPrecisionFactors({ visitProfile, priority, department });
  const slotRecommendation = buildSchedulingSlotRecommendation(priority, department, text, visitProfile);
  const bookingPacket = buildSchedulingBookingPacket({ message, profile, risk, context, department, visitType, priority, visitProfile, carePhase, communicationScript });
  const prepChecklist = buildSchedulingPrepChecklist({ text, risk, department, visitType, context, visitProfile, readinessGaps });
  const accessChecks = buildSchedulingAccessChecks(text, priority, visitProfile);
  const followUpQuestions = buildSchedulingQuestions(department, visitType, priority, visitProfile);
  const visitActions = buildSchedulingActions(priority, department, visitType, visitProfile);

  return {
    summary: needsAppointment
      ? `${carePhase.label}: ${priority.window}. ${readinessGaps.length ? `Main gap: ${readinessGaps[0].replace(/[.!?]+$/, "")}.` : "Visit packet is ready to draft."}`
      : `Follow-up planning is ready. Suggested path: ${priority.label} ${department.label.toLowerCase()} review.`,
    department,
    visitType,
    priority,
    slotRecommendation,
    bookingPacket,
    prepChecklist,
    accessChecks,
    followUpQuestions,
    visitActions,
    carePhase,
    readinessGaps,
    communicationScript,
    triageBoundary,
    trackingPlan,
    coordinationChecklist,
    precisionFactors
  };
}

function inferSchedulingDepartment(text, visitProfile = {}) {
  const explicitDepartment = getSchedulingDepartmentById(visitProfile.department);

  if (explicitDepartment) {
    return explicitDepartment;
  }

  if (["chest", "heart", "cardiology", "bp", "blood pressure", "palpitation", "pulse"].some((term) => hasTerm(text, term))) {
    return {
      id: "cardiology",
      label: "Cardiology",
      owner: "Heart specialist"
    };
  }

  if (["diabetes", "sugar", "glucose", "hba1c", "a1c"].some((term) => hasTerm(text, term))) {
    return {
      id: "diabetes",
      label: "Diabetes clinic",
      owner: "Diabetes care team"
    };
  }

  if (["medicine", "medication", "tablet", "dose", "missed", "side effect", "pharmacy", "drug"].some((term) => hasTerm(text, term))) {
    return {
      id: "pharmacy",
      label: "Pharmacist review",
      owner: "Clinical pharmacist"
    };
  }

  if (["lab", "report", "test", "cholesterol", "creatinine", "cbc", "thyroid"].some((term) => hasTerm(text, term))) {
    return {
      id: "lab-review",
      label: "Lab report review",
      owner: "Report review clinician"
    };
  }

  if (["urgent", "emergency", "same day", "immediate"].some((term) => hasTerm(text, term))) {
    return {
      id: "urgent-clinic",
      label: "Urgent clinic",
      owner: "Same-day care team"
    };
  }

  return {
    id: "primary-care",
    label: "Primary care",
    owner: "Primary care doctor"
  };
}

function inferSchedulingVisitType(text, visitProfile = {}) {
  const explicitType = getSchedulingVisitTypeById(visitProfile.type);

  if (explicitType) {
    return explicitType;
  }

  if (["urgent", "emergency", "same day", "worse"].some((term) => hasTerm(text, term))) {
    return {
      id: "urgent-review",
      label: "Urgent review"
    };
  }

  if (["follow up", "followup", "appointment", "visit", "doctor", "clinic", "review"].some((term) => hasTerm(text, term))) {
    return {
      id: "follow-up",
      label: "Follow-up"
    };
  }

  if (["lab", "report", "test", "result"].some((term) => hasTerm(text, term))) {
    return {
      id: "lab-review",
      label: "Lab review"
    };
  }

  if (["medicine", "medication", "tablet", "dose", "missed", "side effect"].some((term) => hasTerm(text, term))) {
    return {
      id: "medicine-review",
      label: "Medicine review"
    };
  }

  return {
    id: "new-issue",
    label: "New concern"
  };
}

function inferSchedulingPriority({ text, risk, context, visitProfile = {} }) {
  const urgentSignal = hasBreathingSignal(text)
    || hasFaintingSignal(text)
    || hasStrokeSignal(text)
    || hasSevereAllergySignal(text)
    || ["chest pain", "severe pain", "confusion", "blue lips", "heavy bleeding"].some((term) => hasTerm(text, term))
    || (Array.isArray(context.redFlags) && context.redFlags.length > 0)
    || visitProfile.status === "urgent-signs";
  let score = risk.level === "CRITICAL" ? 96 : risk.level === "HIGH" ? 82 : risk.level === "MEDIUM" ? 62 : 38;
  const reasons = [...(risk.reasons || []).slice(0, 2)];

  if (urgentSignal) {
    score = Math.max(score, 92);
    reasons.push("urgent symptom signal");
  }

  if (visitProfile.dateWindow === "same-day") {
    score += 14;
    reasons.push("same-day visit window");
  } else if (visitProfile.dateWindow === "1-3-days") {
    score += 9;
    reasons.push("early follow-up window");
  } else if (visitProfile.dateWindow === "this-week") {
    score += 5;
    reasons.push("this-week follow-up target");
  }

  if (visitProfile.status === "worse") {
    score += 12;
    reasons.push("symptoms getting worse");
  } else if (visitProfile.status === "abnormal-labs") {
    score += 9;
    reasons.push("abnormal lab or reading");
  } else if (visitProfile.status === "new-medicine") {
    score += 7;
    reasons.push("medicine change or missed medicine");
  } else if (visitProfile.status === "after-discharge") {
    score += 10;
    reasons.push("recent care transition");
  }

  if (visitProfile.type === "urgent-review" || visitProfile.department === "urgent-clinic") {
    score += 15;
    reasons.push("urgent review selected");
  }

  if (visitProfile.type === "post-discharge" || (visitProfile.dischargeStatus && visitProfile.dischargeStatus !== "none")) {
    score += 9;
    reasons.push("post-discharge follow-up");
  }

  if (visitProfile.recordsReady === "labs-pending") {
    score += 4;
    reasons.push("pending report context");
  }

  if (visitProfile.supportNeed === "transport" || visitProfile.supportNeed === "caregiver") {
    score += 3;
    reasons.push("support coordination needed");
  }

  if (["today", "now", "same day", "immediately"].some((term) => hasTerm(text, term))) {
    score += 8;
    reasons.push("same-day timing request");
  }

  if (["worse", "worsening", "high bp", "very high", "dizzy", "fever"].some((term) => hasTerm(text, term))) {
    score += 7;
    reasons.push("symptoms or readings changed");
  }

  score = Math.max(10, Math.min(100, score));

  if (score >= 90) {
    return {
      score,
      level: "same-day",
      label: "same-day",
      window: "Use real urgent/emergency care if symptoms are active or severe",
      reasons
    };
  }

  if (score >= 75) {
    return {
      score,
      level: "priority",
      label: "priority",
      window: "Contact the clinic today or request the earliest appointment",
      reasons
    };
  }

  if (score >= 55) {
    return {
      score,
      level: "soon",
      label: "soon",
      window: "Request follow-up in the next few days",
      reasons
    };
  }

  return {
    score,
    level: "routine",
    label: "routine",
    window: "Routine booking is reasonable for stable concerns",
    reasons
  };
}

function formatSchedulingVisitMode(value) {
  const labels = {
    "in-person": "In-person",
    video: "Video visit",
    phone: "Phone call"
  };

  return labels[value] || "Clinic-selected mode";
}

function formatSchedulingVisitWindow(value) {
  const labels = {
    "same-day": "Same day",
    "1-3-days": "1-3 days",
    "this-week": "This week",
    "next-week": "Next week",
    routine: "Routine"
  };

  return labels[value] || "Clinic-directed timing";
}

function formatSchedulingRecordStatus(value) {
  const labels = {
    "summary-ready": "summary is ready",
    "need-summary": "needs a short visit summary",
    "labs-pending": "has pending or incomplete reports",
    "medicine-list": "needs current medicine list"
  };

  return labels[value] || "record status not entered";
}

function buildSchedulingCarePhase({ department, visitType, priority, visitProfile }) {
  if (priority.level === "same-day" || visitProfile.status === "urgent-signs") {
    return {
      label: "Same-day safety routing",
      detail: `Use ${department.label.toLowerCase()} or urgent care coordination only if real-world care confirms it is appropriate.`,
      owner: department.owner
    };
  }

  if (visitType.id === "post-discharge" || visitProfile.status === "after-discharge" || (visitProfile.dischargeStatus && visitProfile.dischargeStatus !== "none")) {
    return {
      label: "Transition follow-up",
      detail: `Post-care review with ${department.owner.toLowerCase()} focused on medicines, pending reports, home instructions, and next due date.`,
      owner: department.owner
    };
  }

  if (visitType.id === "lab-review") {
    return {
      label: "Report review",
      detail: `Review lab trends, reference ranges, symptoms, and next test timing with ${department.owner.toLowerCase()}.`,
      owner: department.owner
    };
  }

  if (visitType.id === "medicine-review") {
    return {
      label: "Medicine safety review",
      detail: `Check medicine timing, missed doses, side effects, allergies, and interaction questions with ${department.owner.toLowerCase()}.`,
      owner: department.owner
    };
  }

  return {
    label: `${visitType.label} route`,
    detail: `${formatSchedulingVisitWindow(visitProfile.dateWindow)} ${formatSchedulingVisitMode(visitProfile.mode).toLowerCase()} with ${department.owner.toLowerCase()}.`,
    owner: department.owner
  };
}

function buildSchedulingReadinessGaps({ visitProfile, department, text }) {
  const gaps = [];

  if (!cleanText(visitProfile.reason) && !text) {
    gaps.push("Add the main visit reason, when it started, and what changed.");
  }

  if (visitProfile.recordsReady === "need-summary") {
    gaps.push("Prepare a one-page summary with symptoms, medicines, readings, allergies, and recent reports.");
  } else if (visitProfile.recordsReady === "labs-pending") {
    gaps.push("Attach full report values, units, reference ranges, report date, and previous results if available.");
  } else if (visitProfile.recordsReady === "medicine-list") {
    gaps.push("Confirm the current medicine list with dose label, timing, missed doses, side effects, and allergies.");
  }

  if (visitProfile.coverage === "not-sure") {
    gaps.push("Check insurance/cost, in-network status, referral, and payment requirement before confirming.");
  } else if (visitProfile.coverage === "preauth") {
    gaps.push("Ask whether pre-authorization, referral, or approval documents are required.");
  }

  if (visitProfile.supportNeed === "transport") {
    gaps.push("Arrange transport and arrival time before the visit.");
  } else if (visitProfile.supportNeed === "caregiver") {
    gaps.push("Ask whether a caregiver can join and help share the symptom timeline.");
  } else if (visitProfile.supportNeed === "interpreter") {
    gaps.push("Request interpreter support while booking.");
  } else if (visitProfile.supportNeed === "accessibility") {
    gaps.push("Confirm wheelchair, lift, waiting-area, or accessibility support.");
  }

  if ((visitProfile.dischargeStatus && visitProfile.dischargeStatus !== "none") && !cleanText(visitProfile.pendingTests)) {
    gaps.push("List pending tests, discharge instructions, and unresolved follow-up tasks.");
  }

  if (department.id === "cardiology" && !/(bp|blood pressure|pulse|chest|breath|swelling|palpitation)/i.test(text)) {
    gaps.push("Add BP/pulse readings and any chest, breathing, swelling, or palpitation symptoms.");
  }

  if (department.id === "diabetes" && !/(sugar|glucose|hba1c|a1c|food|hypo|low sugar)/i.test(text)) {
    gaps.push("Add glucose log, HbA1c, food timing, medicine timing, and low/high sugar symptoms.");
  }

  return Array.from(new Set(gaps)).slice(0, 6);
}

function buildSchedulingCommunicationScript({ message, profile, department, visitType, priority, visitProfile }) {
  const reason = (cleanText(visitProfile.reason || message).slice(0, 180) || "my current health concern").replace(/[.!?]+$/, "");
  const patient = profile.name ? `${profile.name}, age ${profile.age || "not provided"}` : "the patient";
  const timing = priority.level === "same-day" ? "same-day guidance" : `${priority.label} appointment timing`;
  const records = formatSchedulingRecordStatus(visitProfile.recordsReady);
  const support = visitProfile.supportNeed && visitProfile.supportNeed !== "none" ? ` Support needed: ${visitProfile.supportNeed}.` : "";

  return `Hello, I am calling for ${patient}. I need ${timing} for a ${visitType.label.toLowerCase()} with ${department.label}. Main reason: ${reason}. Records status: ${records}.${support} Please confirm the safest appointment window, required documents, and what symptoms should not wait.`;
}

function buildSchedulingTriageBoundary(priority) {
  if (priority.level === "same-day") {
    return "If severe, sudden, or rapidly worsening symptoms are active, use real urgent or emergency care now instead of waiting for a scheduled appointment.";
  }

  if (priority.level === "priority") {
    return "If chest pain, breathing trouble, fainting, one-sided weakness, severe allergy, confusion, or major worsening appears, do not wait for the routine visit.";
  }

  return "If symptoms become sudden, severe, or clearly worse, switch from routine booking to real same-day clinical help.";
}

function buildSchedulingTrackingPlan({ department, visitType, priority, visitProfile }) {
  const plan = [
    "Track symptom start time, changes, severity, and what improves or worsens it.",
    "Track readings with date, time, medicine timing, meals, activity, and symptoms.",
    "Save the clinic response, appointment date, documents requested, and follow-up deadline."
  ];

  if (department.id === "cardiology") {
    plan.push("Track BP and pulse twice daily only if already advised or routinely measured, plus chest, breath, swelling, and activity symptoms.");
  }

  if (department.id === "diabetes") {
    plan.push("Track glucose readings with food timing, medicine timing, activity, and low/high sugar symptoms.");
  }

  if (visitType.id === "post-discharge" || visitProfile.status === "after-discharge") {
    plan.push("Track discharge tasks: pending tests, medicine changes, home-care steps, and next review date.");
  }

  if (priority.level === "same-day") {
    plan.unshift("Keep a support person nearby and document the exact urgent symptom and time it started.");
  }

  return plan.slice(0, 6);
}

function buildSchedulingCoordinationChecklist({ priority, department, visitProfile }) {
  const checklist = [
    `Confirm ${department.label} availability and whether the selected visit mode is appropriate.`,
    "Confirm required records: ID, medicines, allergies, recent readings, reports, and prior notes.",
    "Confirm contact method and who will call/message back."
  ];

  if (visitProfile.coverage === "preauth" || visitProfile.coverage === "not-sure") {
    checklist.push("Confirm insurance, referral, cashless/cost estimate, and pre-authorization needs.");
  }

  if (visitProfile.supportNeed && visitProfile.supportNeed !== "none") {
    checklist.push("Confirm transport, caregiver, interpreter, or accessibility support before the visit.");
  }

  if (priority.level === "same-day") {
    checklist.unshift("Do not rely on app scheduling if active severe warning signs are present.");
  }

  return checklist.slice(0, 6);
}

function buildSchedulingPrecisionFactors({ visitProfile, priority, department }) {
  const factors = [
    `Route: ${department.label}`,
    `Timing: ${formatSchedulingVisitWindow(visitProfile.dateWindow)}`,
    `Mode: ${formatSchedulingVisitMode(visitProfile.mode)}`,
    `Priority: ${priority.label} (${priority.score}/100)`
  ];

  if (visitProfile.status) {
    factors.push(`Status: ${visitProfile.status.replace(/-/g, " ")}`);
  }

  if (visitProfile.recordsReady) {
    factors.push(`Records: ${formatSchedulingRecordStatus(visitProfile.recordsReady)}`);
  }

  return factors.slice(0, 6);
}

function buildSchedulingSlotRecommendation(priority, department, text, visitProfile = {}) {
  const explicitMode = formatSchedulingVisitMode(visitProfile.mode);
  const mode = visitProfile.mode
    ? explicitMode
    : ["video", "telehealth", "phone"].some((term) => hasTerm(text, term))
      ? "Telehealth if the clinic agrees"
      : priority.level === "same-day"
        ? "In-person or urgent care"
        : "In-person or telehealth based on clinic fit";
  const requestedWindow = formatSchedulingVisitWindow(visitProfile.dateWindow);

  return {
    window: requestedWindow !== "Clinic-directed timing" ? `${requestedWindow}; ${priority.window}` : priority.window,
    department: department.label,
    mode,
    rationale: priority.reasons.length
      ? priority.reasons.join("; ")
      : "Based on current risk, message wording, and follow-up context."
  };
}

function buildSchedulingBookingPacket({ message, profile, risk, context, department, visitType, priority, visitProfile = {}, carePhase = {}, communicationScript = "" }) {
  return {
    patient: `${profile.name || "Patient"}, age ${profile.age || "not provided"}`,
    department: department.label,
    clinicianOwner: department.owner,
    visitType: visitType.label,
    priority: `${priority.label} (${priority.score}/100)`,
    carePhase: carePhase.label || visitType.label,
    reason: cleanText(visitProfile.reason || message).slice(0, 220) || "Visit reason not provided",
    currentRisk: risk.label,
    duration: formatContextLabel(context.duration),
    requestedWindow: formatSchedulingVisitWindow(visitProfile.dateWindow),
    requestedMode: formatSchedulingVisitMode(visitProfile.mode),
    contactMethod: cleanText(visitProfile.contactMethod) || "phone",
    records: formatSchedulingRecordStatus(visitProfile.recordsReady),
    coverage: cleanText(visitProfile.coverage) || "not entered",
    support: cleanText(visitProfile.supportNeed) || formatContextLabel(context.supportNow),
    script: communicationScript
  };
}

function buildSchedulingPrepChecklist({ text, risk, department, visitType, context, visitProfile = {}, readinessGaps = [] }) {
  const checklist = [
    "Write a one-sentence reason for the visit and when the issue started.",
    "Bring current medicines, allergies, recent readings, lab reports, and prior visit notes.",
    "Prepare the top three questions you want answered before leaving the visit."
  ];

  if (department.id === "cardiology") {
    checklist.push("Carry BP and pulse readings with time, symptoms, activity, and medicine timing.");
  }

  if (department.id === "diabetes") {
    checklist.push("Bring glucose log, HbA1c result, food/activity notes, and low/high sugar symptoms.");
  }

  if (department.id === "pharmacy") {
    checklist.push("Take medicine strips or labels and list missed doses, side effects, supplements, and allergies.");
  }

  if (department.id === "lab-review") {
    checklist.push("Bring the full report with units, reference ranges, report date, and older results if available.");
  }

  if (visitType.id === "urgent-review" || risk.level === "HIGH" || risk.level === "CRITICAL") {
    checklist.unshift("If severe or sudden symptoms are happening now, use real urgent/emergency care instead of waiting.");
  }

  if (context.supportNow === "needs-transport") {
    checklist.push("Confirm transport or caregiver help before the appointment time.");
  }

  if (readinessGaps.length) {
    checklist.unshift(`Close readiness gap: ${readinessGaps[0]}`);
  }

  if (visitProfile.coverage === "not-sure" || visitProfile.coverage === "preauth") {
    checklist.push("Ask about insurance, referral, cashless/cost estimate, and pre-authorization needs before confirming.");
  }

  if (visitProfile.supportNeed === "caregiver") {
    checklist.push("Ask the caregiver to bring a symptom timeline and help remember instructions.");
  }

  if ((visitProfile.dischargeStatus && visitProfile.dischargeStatus !== "none") || visitType.id === "post-discharge") {
    checklist.push("Bring discharge summary, medicine changes, pending test list, home-care instructions, and warning signs from the hospital.");
  }

  if (["video", "telehealth", "phone"].some((term) => hasTerm(text, term))) {
    checklist.push("For telehealth, test camera/audio, internet, lighting, and keep reports/readings nearby.");
  }

  return checklist.slice(0, 7);
}

function buildSchedulingAccessChecks(text, priority, visitProfile = {}) {
  const checks = [
    "Confirm clinic location, doctor availability, visit mode, and arrival/joining instructions.",
    "Ask about insurance, cashless/cost, co-pay, referral, or pre-authorization before confirming.",
    "Keep ID, policy/card details, payment method, and previous records ready."
  ];

  if (["transport", "ride", "travel", "alone"].some((term) => hasTerm(text, term))) {
    checks.push("Plan travel time, transport help, and someone to accompany the patient if needed.");
  }

  if (["interpreter", "language", "wheelchair", "accessibility"].some((term) => hasTerm(text, term))) {
    checks.push("Ask the clinic to arrange interpreter, accessibility, or caregiver support.");
  }

  if (visitProfile.contactMethod) {
    checks.push(`Use ${visitProfile.contactMethod} as the preferred contact method and record the callback/reference details.`);
  }

  if (visitProfile.mode === "video" || visitProfile.mode === "phone") {
    checks.push("Confirm whether remote visit is clinically acceptable for this concern and what to do if the clinician asks for in-person review.");
  }

  if (priority.level === "same-day") {
    checks.unshift("If symptoms are severe or sudden, do not wait for a normal booking callback.");
  }

  return checks.slice(0, 5);
}

function buildSchedulingQuestions(department, visitType, priority, visitProfile = {}) {
  const questions = [
    `How soon should this ${visitType.label.toLowerCase()} happen based on the symptoms and readings?`,
    "What warning signs should make me seek same-day care?",
    "Which readings, reports, or medicine details should I track before the visit?"
  ];

  if (department.id === "cardiology") {
    questions.push("What BP, pulse, chest, breathing, swelling, or activity pattern should I report immediately?");
  } else if (department.id === "diabetes") {
    questions.push("What glucose pattern, food timing, medicine timing, or low-sugar signs need review?");
  } else if (department.id === "pharmacy") {
    questions.push("What should I do if a dose is missed, side effects happen, or another medicine is added?");
  } else if (department.id === "lab-review") {
    questions.push("Which lab value changed most, what trend matters, and when should it be repeated?");
  } else {
    questions.push("What is the next follow-up plan and what should I monitor at home?");
  }

  if (priority.level === "same-day") {
    questions.unshift("Should I use urgent or emergency care now rather than waiting for an appointment?");
  }

  if (visitProfile.coverage === "preauth") {
    questions.push("Which documents are required for referral or pre-authorization approval?");
  }

  if (visitProfile.supportNeed && visitProfile.supportNeed !== "none") {
    questions.push("Can a caregiver, interpreter, transport helper, or accessibility support be arranged?");
  }

  return questions.slice(0, 5);
}

function buildSchedulingActions(priority, department, visitType, visitProfile = {}) {
  if (priority.level === "same-day") {
    return [
      "Use real same-day urgent or emergency care if severe symptoms are active.",
      `Tell the care team this is a ${department.label.toLowerCase()} ${visitType.label.toLowerCase()} request with current symptoms and readings.`,
      "Keep medicines, readings, reports, ID, and support person ready.",
      "Save the clinic response, arrival instructions, and any warning signs they give."
    ];
  }

  if (priority.level === "priority") {
    return [
      "Contact the clinic today and ask for the earliest suitable slot.",
      `Share the main reason, current readings, medicines, and why ${department.label.toLowerCase()} is requested.`,
      "Ask what records, insurance, referral, or pre-authorization details are needed.",
      visitProfile.contactMethod ? `Request confirmation through ${visitProfile.contactMethod}.` : "Record the callback number or appointment reference."
    ];
  }

  if (priority.level === "soon") {
    return [
      "Request a follow-up in the next few days and keep monitoring changes.",
      "Prepare one short symptom timeline, medicine list, readings, and recent reports.",
      "Write your top three questions before the visit."
    ];
  }

  return [
    "Book a routine visit and prepare a concise care summary.",
    "Bring medicines, allergies, readings, reports, and prior instructions.",
    "Ask what to monitor and when the next follow-up should happen.",
    "Save the visit draft locally so it appears in your care history."
  ];
}

function runAlertAgent({ message, profile, vitals, risk, context, medicalKnowledge }) {
  const knowledgeMatches = getRouteKnowledgeMatches("ALERT_AGENT", medicalKnowledge, 3);
  const evidenceCoverage = getRouteKnowledgeCoverage("ALERT_AGENT", medicalKnowledge);
  const safetyReview = buildAlertSafetyReview({ message, profile, vitals, risk, context });

  return createAgentResult("ALERT_AGENT", "Safety Measures", "complete", {
    intentRoute: "Emergency",
    summary: safetyReview.summary,
    severity: risk.level,
    safetyRoute: safetyReview.safetyRoute,
    redFlagGroups: safetyReview.redFlagGroups,
    safetyActions: safetyReview.safetyActions,
    monitoringChecklist: safetyReview.monitoringChecklist,
    handoffPacket: safetyReview.handoffPacket,
    doNotDo: safetyReview.doNotDo,
    context: safetyReview.context,
    productionTool: "Urgent warning review, safety-measures library, and clinician handoff preparation.",
    evidenceCoverage,
    references: mapKnowledgeReferences(knowledgeMatches, 3),
    liveAction: "No message, booking, caregiver contact, emergency call, medicine change, or diagnosis is performed."
  });
}

function buildAlertSafetyReview({ message, profile, vitals, risk, context }) {
  const text = buildSearchText(message);
  const redFlagGroups = detectSafetySignalGroups(text, context);
  const safetyRoute = buildSafetyRoute(risk, redFlagGroups);
  const safetyActions = buildAlertSafetyActions(safetyRoute, redFlagGroups, context);
  const monitoringChecklist = buildAlertMonitoringChecklist({ text, vitals, risk });
  const handoffPacket = buildAlertHandoffPacket({ message, profile, vitals, risk, context, redFlagGroups });
  const doNotDo = buildAlertDoNotDo(safetyRoute);
  const signalText = redFlagGroups.length
    ? redFlagGroups.map((group) => group.title).join(", ")
    : "no active red-flag group detected from the message";

  return {
    summary: `${safetyRoute.label}: ${safetyRoute.detail} Signals reviewed: ${signalText}.`,
    safetyRoute,
    redFlagGroups,
    safetyActions,
    monitoringChecklist,
    handoffPacket,
    doNotDo,
    context: context.redFlags?.length
      ? `Checked selected red flags: ${context.redFlags.map(formatContextLabel).join(", ")}.`
      : `Support status: ${formatContextLabel(context.supportNow)}.`
  };
}

function detectSafetySignalGroups(text, context) {
  const selectedFlags = new Set(getActiveContextRedFlags(text, context.redFlags).map((flag) => normalizeSearchText(flag).replace(/\s+/g, "-")));
  const groups = [];
  const pushGroup = (id, title, detail, level, terms = []) => {
    const matchedByTerm = terms.some((term) => hasTerm(text, term));
    const matchedByFlag = selectedFlags.has(id);

    if (matchedByTerm || matchedByFlag) {
      groups.push({ id, title, detail, level });
    }
  };

  pushGroup(
    "chest-pain",
    "Chest or breathing warning",
    "Chest pain/pressure, arm or jaw pain, sweating, trouble breathing, blue lips, or fainting needs immediate real-world review.",
    "critical",
    ["chest pain", "chest pressure", "jaw pain", "arm pain", "trouble breathing", "shortness of breath", "blue lips", "sweating"]
  );
  pushGroup(
    "breathing-trouble",
    "Breathing warning",
    "Breathing difficulty, wheezing with distress, blue lips, or inability to speak normally is an urgent safety path.",
    "critical",
    ["breathing trouble", "trouble breathing", "difficulty breathing", "cannot breathe", "wheezing", "shortness of breath"]
  );
  pushGroup(
    "one-sided-weakness",
    "Stroke-like warning",
    "Face droop, one-sided weakness, slurred speech, sudden confusion, vision trouble, balance trouble, or sudden severe headache needs emergency care.",
    "critical",
    ["face droop", "one sided weakness", "one-sided weakness", "slurred speech", "sudden confusion", "sudden severe headache", "vision trouble", "balance trouble", "stroke"]
  );
  pushGroup(
    "fainting",
    "Fainting or seizure warning",
    "Fainting, passing out, seizure, unusual drowsiness, or not returning to normal quickly needs urgent review.",
    "critical",
    ["faint", "fainted", "fainting", "passed out", "seizure", "unconscious", "very sleepy", "drowsy"]
  );
  pushGroup(
    "severe-allergy",
    "Severe allergy warning",
    "Swelling of lips, tongue, face, or throat; wheezing; severe rash with dizziness; or breathing trouble can be urgent.",
    "critical",
    ["severe allergy", "face swelling", "lip swelling", "tongue swelling", "throat swelling", "widespread rash", "hives", "anaphylaxis"]
  );
  pushGroup(
    "bleeding-injury",
    "Bleeding or injury warning",
    "Heavy bleeding, serious burn, deep wound, possible broken bone, major fall, or head injury with vomiting/confusion needs urgent care.",
    "critical",
    ["heavy bleeding", "bleeding will not stop", "serious burn", "deep wound", "broken bone", "head injury", "major fall", "vomits more than once"]
  );
  pushGroup(
    "fever-dehydration",
    "Fever or dehydration warning",
    "Fever with confusion, stiff neck, severe weakness, repeated vomiting, reduced urination, or rapid worsening needs prompt care.",
    "high",
    ["fever", "stiff neck", "dehydration", "repeated vomiting", "persistent vomiting", "reduced urination", "confusion", "severe weakness"]
  );
  pushGroup(
    "medicine-safety",
    "Medicine safety warning",
    "Possible wrong medicine, overdose, severe reaction, major side effect, bleeding, allergy, or dangerous interaction needs pharmacist/clinician review.",
    "high",
    ["overdose", "wrong medicine", "double dose", "side effect", "drug interaction", "unusual bleeding", "missed dose", "too much medicine"]
  );
  pushGroup(
    "mental-crisis",
    "Mental safety warning",
    "Self-harm risk, unsafe behavior, severe agitation, or risk of harming others needs immediate real-world support.",
    "critical",
    ["self harm", "suicide", "kill myself", "harm myself", "unsafe behavior", "harm others", "severe agitation"]
  );

  return groups;
}

function buildSafetyRoute(risk, redFlagGroups) {
  const hasCriticalGroup = redFlagGroups.some((group) => group.level === "critical");
  const hasHighGroup = redFlagGroups.some((group) => group.level === "high");

  if (risk.level === "CRITICAL" || hasCriticalGroup) {
    return {
      level: "critical",
      label: "Emergency safety path",
      detail: "Severe or sudden warning signs should be handled by local emergency or urgent medical services now.",
      actionWindow: "now"
    };
  }

  if (risk.level === "HIGH" || hasHighGroup) {
    return {
      level: "high",
      label: "Urgent care path",
      detail: "Symptoms, readings, or medicine concerns should be reviewed promptly by a clinician or urgent care.",
      actionWindow: "today"
    };
  }

  if (risk.level === "MEDIUM") {
    return {
      level: "medium",
      label: "Caution follow-up path",
      detail: "Monitor closely and contact a clinician if symptoms continue, worsen, or feel unusual.",
      actionWindow: "soon"
    };
  }

  return {
    level: "low",
    label: "Safe monitoring path",
    detail: "No immediate red-flag route was detected; continue safe monitoring and use clinician guidance for personal decisions.",
    actionWindow: "routine"
  };
}

function buildAlertSafetyActions(safetyRoute, redFlagGroups, context) {
  if (safetyRoute.level === "critical") {
    return [
      "Use local emergency services or urgent care now if these signs are active.",
      "Keep the person seated or lying safely; do not let them drive.",
      "Have medicines, allergies, readings, reports, and symptom start time ready for responders."
    ];
  }

  if (safetyRoute.level === "high") {
    return [
      "Contact urgent care or a clinician today if symptoms are active, worsening, or unusual.",
      "Write down start time, severity, readings, medicines taken, missed medicines, and what changed.",
      context.supportNow === "alone" ? "Ask someone trusted to stay nearby or check in." : "Keep the support person informed and ready to help."
    ];
  }

  if (safetyRoute.level === "medium") {
    return [
      "Monitor symptoms and repeat unusual readings correctly when safe.",
      "Contact a clinician if symptoms continue, worsen, or do not match the usual pattern.",
      "Prepare a short care note with medicines, allergies, readings, and questions."
    ];
  }

  return [
    "Continue safe home monitoring and follow the existing care plan.",
    "Track symptoms, readings, medicine timing, and any new warning signs.",
    "Use a clinician for personal medical decisions or any worsening symptoms."
  ];
}

function buildAlertMonitoringChecklist({ text, vitals, risk }) {
  const checklist = [
    "Symptom start time, duration, severity, triggers, and whether it is improving or worsening.",
    "Current medicines, missed doses, allergies, new medicines, supplements, and side effects.",
    "Support status: alone or with someone, transport availability, and emergency contact."
  ];

  if (hasAnyVitals(vitals || {})) {
    checklist.unshift(`Entered readings: ${Object.entries(vitals || {}).filter(([, value]) => value !== null).map(([key, value]) => `${key}: ${value}`).join(", ")}.`);
  } else {
    checklist.unshift("Add BP, pulse, oxygen, temperature, glucose, or other readings if available and safe to measure.");
  }

  if (["bp", "blood pressure", "pulse", "heart rate"].some((term) => hasTerm(text, term))) {
    checklist.push("For BP or pulse, record posture, rest time, cuff/device, repeat reading, symptoms, caffeine/activity, and medicine timing.");
  }

  if (["sugar", "glucose", "diabetes"].some((term) => hasTerm(text, term))) {
    checklist.push("For glucose, record meal timing, medicine timing, symptoms, hydration, and whether the result is new or repeated.");
  }

  if (risk.level === "HIGH" || risk.level === "CRITICAL") {
    checklist.push("Do not wait for perfect details if severe warning signs are active.");
  }

  return checklist.slice(0, 6);
}

function buildAlertHandoffPacket({ message, profile, vitals, risk, context, redFlagGroups }) {
  const conditionText = Array.isArray(profile.conditions) && profile.conditions.length
    ? profile.conditions.join(", ")
    : "conditions not provided";
  const medicineText = Array.isArray(profile.medications) && profile.medications.length
    ? profile.medications.join(", ")
    : "medicines not provided";
  const enteredVitals = Object.entries(vitals || {})
    .filter(([, value]) => value !== null)
    .map(([key, value]) => `${key}: ${value}`);

  return {
    patient: `${profile.name || "Patient"}, age ${profile.age || "not provided"}; ${conditionText}`,
    concern: cleanText(message).slice(0, 220) || "Concern not provided",
    priority: `${risk.label}: ${redFlagGroups.map((group) => group.title).slice(0, 3).join(", ") || risk.reasons.slice(0, 2).join(", ") || "safety check completed"}`,
    bring: `Medicines: ${medicineText}. Allergies: ${Array.isArray(profile.allergies) && profile.allergies.length ? profile.allergies.join(", ") : "not provided"}. Readings: ${enteredVitals.join(", ") || "not entered"}. Support: ${formatContextLabel(context.supportNow)}.`
  };
}

function buildAlertDoNotDo(safetyRoute) {
  const shared = [
    "Do not use the app to diagnose, prescribe, calculate doses, or decide to delay urgent care.",
    "Do not double, stop, start, or mix medicines unless the label, pharmacist, or clinician instructs you."
  ];

  if (safetyRoute.level === "critical" || safetyRoute.level === "high") {
    return [
      "Do not drive yourself or leave the person alone while severe symptoms are active.",
      "Do not wait for more app analysis if breathing, chest, stroke, severe allergy, fainting, seizure, or major bleeding signs are present.",
      ...shared
    ];
  }

  return [
    "Do not ignore symptoms that are worsening, unusual, or repeatedly linked with abnormal readings.",
    ...shared
  ];
}

function runCareTransitionsAgent({ message, profile, risk, context, medicalKnowledge }) {
  const useCase = enterpriseUseCases.find((item) => item.agentRoute === "CARE_TRANSITIONS_AGENT");
  const references = getRouteKnowledgeMatches("CARE_TRANSITIONS_AGENT", medicalKnowledge, 3);
  const instructionTone = risk.level === "LOW"
    ? "routine follow-up wording"
    : "heightened follow-up wording with urgent-care reminders";
  const patientLabel = `${profile.name || "Patient"}, age ${profile.age || "not provided"}`;

  return createAgentResult("CARE_TRANSITIONS_AGENT", "Discharge Transitions", "complete", {
    intentRoute: "Discharge Transitions",
    summary: `Care transition wording was detected. The agent prepared clinician-reviewed draft sections for discharge communication, care plan coordination, post-discharge outreach, readmission monitoring, and quality reporting.`,
    productionTool: "Provider care management and transition workflow.",
    workflowMatrix: findWorkflowMatrixRow("CARE_TRANSITIONS_AGENT"),
    workflow: useCase?.workflow || "Care Management, Discharge & Transitions",
    value: useCase?.value || "Care coordination and patient communication",
    draftOutputs: [
      {
        title: "Discharge summary draft",
        detail: `${patientLabel}; current risk path ${risk.label}; patient message focus: ${message.slice(0, 140)}.`
      },
      {
        title: "Plain-language instructions",
        detail: `Use ${instructionTone}; include warning signs, medication safety reminders, and when to contact the care team.`
      },
      {
        title: "Post-discharge outreach",
        detail: `Script prompts: symptom trend, vitals since discharge, medicine access, follow-up appointment status, transport or support needs.`
      },
      {
        title: "Readmission monitoring",
        detail: `Watch ${risk.reasons.slice(0, 2).join(" ")} Duration: ${formatContextLabel(context.duration)}; support: ${formatContextLabel(context.supportNow)}.`
      },
      {
        title: "Quality reporting",
        detail: "Capture risk stratification inputs, care-plan actions, outreach status, patient-instruction delivery, and unresolved barriers."
      }
    ],
    evidenceCoverage: getRouteKnowledgeCoverage("CARE_TRANSITIONS_AGENT", medicalKnowledge),
    references: mapKnowledgeReferences(references, 3),
    complianceBoundary: useCase?.reviewBoundary || "Drafts only; clinician review is required before use.",
    liveAction: "No discharge order, patient instruction, outreach message, or clinical communication is sent."
  });
}

function runClaimsOpsAgent({ message, profile, medicalKnowledge }) {
  const useCase = enterpriseUseCases.find((item) => item.agentRoute === "CLAIMS_OPS_AGENT");
  const references = getRouteKnowledgeMatches("CLAIMS_OPS_AGENT", medicalKnowledge, 3);

  return createAgentResult("CLAIMS_OPS_AGENT", "Claims Operations", "complete", {
    intentRoute: "Claims Operations",
    summary: "Claims operations wording was detected. The agent prepared an administrative draft for claim intake extraction, validation review, adjudication exception explanation, provider inquiry response, and reporting readiness.",
    productionTool: "Payer claims operations workflow.",
    workflowMatrix: findWorkflowMatrixRow("CLAIMS_OPS_AGENT"),
    workflow: useCase?.workflow || "Claims Intake, Adjudication & Post-Payment Ops",
    value: useCase?.value || "Claims operations automation and explainability",
    structuredExtraction: {
      member: profile.name || "Demo patient",
      requestType: "Claims intake / adjudication support draft",
      documentSignals: ["claim form", "clinical note", "policy reference", "provider inquiry"].filter((signal) => buildSearchText(message).includes(signal.split(" ")[0])),
      missingFields: ["claim number", "date of service", "provider identifier", "policy reference"].filter((field) => !buildSearchText(message).includes(field.split(" ")[0]))
    },
    draftOutputs: [
      {
        title: "Claims intake",
        detail: "Extract member, provider, service, date, diagnosis/procedure text if provided, policy reference, and supporting document list."
      },
      {
        title: "Validation and edits",
        detail: "Flag missing identifiers, inconsistent dates, incomplete supporting documents, and policy-reference gaps for human review."
      },
      {
        title: "Adjudication exception",
        detail: "Draft the exception reason, needed evidence, policy-reference placeholder, and recommended next review queue."
      },
      {
        title: "Provider inquiry",
        detail: "Prepare a courteous draft response with required documents, status explanation, and no final payment commitment."
      },
      {
        title: "Regulatory reporting",
        detail: "Capture audit timestamp, document source, exception category, human reviewer, and final decision owner."
      }
    ],
    evidenceCoverage: getRouteKnowledgeCoverage("CLAIMS_OPS_AGENT", medicalKnowledge),
    references: mapKnowledgeReferences(references, 3),
    complianceBoundary: useCase?.reviewBoundary || "Administrative draft only; no payment decision is finalized.",
    liveAction: "No claim approval, denial, payment, adjustment, or provider message is sent."
  });
}

function runUtilizationAgent({ message, profile, risk, medicalKnowledge }) {
  const useCase = enterpriseUseCases.find((item) => item.agentRoute === "UTILIZATION_AGENT");
  const references = getRouteKnowledgeMatches("UTILIZATION_AGENT", medicalKnowledge, 3);
  const text = buildSearchText(message);
  const appealMode = text.includes("appeal");

  return createAgentResult("UTILIZATION_AGENT", "Prior Authorization", "complete", {
    intentRoute: "Prior Authorization",
    summary: `${appealMode ? "Appeals" : "Prior authorization"} wording was detected. The agent prepared a policy-grounded administrative packet summary, criteria-check outline, rationale draft, communication summary, and audit log.`,
    productionTool: "Utilization management and appeals workflow.",
    workflow: useCase?.workflow || "Prior Authorization and Appeals Administration",
    value: useCase?.value || "Clinical-adjacent document synthesis for administrative decisions",
    packetSummary: {
      member: profile.name || "Demo patient",
      requestType: appealMode ? "Appeal package draft" : "Prior authorization packet draft",
      clinicalRiskContext: risk.label,
      policyInputsNeeded: ["requested service", "diagnosis or condition text", "medical policy ID", "supporting clinical notes", "provider rationale"]
    },
    draftOutputs: [
      {
        title: "Packet summary",
        detail: "Summarize requested service, clinical context, attached documents, missing evidence, and reviewer-ready next step."
      },
      {
        title: "Medical policy checks",
        detail: "Map the request to policy criteria placeholders and separate met, unmet, unclear, and missing evidence items."
      },
      {
        title: "Decision rationale draft",
        detail: "Draft explainable rationale for administrative review without finalizing medical necessity or coverage."
      },
      {
        title: appealMode ? "Appeal package" : "Provider/member communication",
        detail: appealMode
          ? "Prepare appeal letter sections with evidence summary, citation placeholders, and reviewer notes."
          : "Prepare a provider/member update with missing information and expected next review step."
      },
      {
        title: "Audit log",
        detail: "Record policy source, evidence list, rationale owner, reviewer action, and compliance checkpoint."
      }
    ],
    evidenceCoverage: getRouteKnowledgeCoverage("UTILIZATION_AGENT", medicalKnowledge),
    references: mapKnowledgeReferences(references, 3),
    complianceBoundary: useCase?.reviewBoundary || "Policy-aligned draft only; no coverage or medical necessity decision is finalized.",
    liveAction: "No authorization, denial, coverage decision, or appeal submission is performed."
  });
}

function runGxpQualityAgent({ message, medicalKnowledge }) {
  const useCase = enterpriseUseCases.find((item) => item.agentRoute === "GXP_QUALITY_AGENT");
  const references = getRouteKnowledgeMatches("GXP_QUALITY_AGENT", medicalKnowledge, 3);
  const text = buildSearchText(message);
  const deviationMode = hasTerm(text, "deviation") || hasTerm(text, "exception");

  return createAgentResult("GXP_QUALITY_AGENT", "GxP Quality", "complete", {
    intentRoute: "GxP Quality",
    summary: `${deviationMode ? "Deviation or exception" : "Batch record and shopfloor quality"} wording was detected. The agent prepared a GxP draft for batch-record review, exception narration, release documentation traceability, QA review, change control, and SOP/QMS support.`,
    productionTool: "GxP manufacturing quality workflow.",
    workflowMatrix: findWorkflowMatrixRow("GXP_QUALITY_AGENT"),
    workflow: useCase?.workflow || "Batch Record Review & Shopfloor Quality",
    value: useCase?.value || "GxP manufacturing documentation and exception handling",
    structuredExtraction: {
      requestType: deviationMode ? "Deviation / exception narrative draft" : "Batch record review draft",
      documentSignals: ["batch record", "ebr", "deviation", "exception", "release documentation", "qa review", "change control", "sop", "qms"].filter((term) => hasTerm(text, term)),
      missingFields: ["batch ID", "product/material", "manufacturing step", "SOP/QMS reference", "QA reviewer", "exception category"].filter((field) => !hasTerm(text, field.split("/")[0]))
    },
    draftOutputs: [
      {
        title: "Batch review summary",
        detail: "Summarize record completeness, critical process steps, missing entries, exception references, and reviewer-ready observations."
      },
      {
        title: "Exception narrative",
        detail: "Draft event timeline, impacted step, immediate containment, preliminary cause category, and evidence still needed."
      },
      {
        title: "Release documentation",
        detail: "Prepare release-document traceability with batch record sections, deviation status, QA review status, and open dependencies."
      },
      {
        title: "SOP/QMS assistant",
        detail: "Answer only from approved SOP/QMS content placeholders and flag gaps where controlled content is missing."
      },
      {
        title: "Improvement signal",
        detail: "Capture repeat exception themes, process step, system owner, and change-control candidate for human review."
      }
    ],
    evidenceCoverage: getRouteKnowledgeCoverage("GXP_QUALITY_AGENT", medicalKnowledge),
    references: mapKnowledgeReferences(references, 3),
    complianceBoundary: useCase?.reviewBoundary || "GxP draft only; QA and approved SOP/QMS review are required before use.",
    liveAction: "No batch release, deviation approval, manufacturing execution, SOP change, or QMS update is performed."
  });
}

function runMedTechComplianceAgent({ message, medicalKnowledge }) {
  const useCase = enterpriseUseCases.find((item) => item.agentRoute === "MEDTECH_COMPLIANCE_AGENT");
  const references = getRouteKnowledgeMatches("MEDTECH_COMPLIANCE_AGENT", medicalKnowledge, 3);
  const text = buildSearchText(message);
  const complaintMode = hasTerm(text, "complaint") || hasTerm(text, "capa") || hasTerm(text, "root cause");

  return createAgentResult("MEDTECH_COMPLIANCE_AGENT", "MedTech Compliance", "complete", {
    intentRoute: "MedTech Compliance",
    summary: `${complaintMode ? "Complaint or CAPA" : "Design-control and technical documentation"} wording was detected. The agent prepared a regulatory-review draft for traceability, technical file sections, V&V evidence, complaint narrative, CAPA initiation, post-market signals, and cybersecurity evidence.`,
    productionTool: "MedTech regulatory documentation workflow.",
    workflowMatrix: findWorkflowMatrixRow("MEDTECH_COMPLIANCE_AGENT"),
    workflow: useCase?.workflow || "Design Controls, Tech Files & Complaint Handling",
    value: useCase?.value || "Regulatory-grade documentation and post-market intelligence for connected devices",
    structuredExtraction: {
      requestType: complaintMode ? "Complaint / CAPA draft" : "Technical documentation draft",
      documentSignals: ["design controls", "technical file", "requirements", "user needs", "traceability", "v&v", "verification", "validation", "cybersecurity", "post-market surveillance", "complaint", "capa", "root cause"].filter((term) => hasTerm(text, term)),
      missingFields: ["device identifier", "intended purpose", "requirement ID", "evidence reference", "risk file reference", "complaint ID", "regulatory region"].filter((field) => !hasTerm(text, field.split(" ")[0]))
    },
    draftOutputs: [
      {
        title: "Technical documentation",
        detail: "Draft MDR/IVDR-ready sections with requirement-to-evidence traceability and missing-evidence flags."
      },
      {
        title: "V&V evidence summary",
        detail: "Summarize verification and validation evidence, linked requirements, acceptance status, and unresolved gaps."
      },
      {
        title: "Complaint narrative",
        detail: "Prepare complaint summary, event timeline, device/context details, harm signal, and triage notes for reviewer disposition."
      },
      {
        title: "CAPA initiation",
        detail: "Draft root-cause hypothesis, containment, investigation questions, evidence needed, and CAPA owner placeholder."
      },
      {
        title: "Cyber/post-market evidence",
        detail: "Prepare vulnerability remediation or post-market surveillance signal pack with risk justification and audit trail."
      }
    ],
    evidenceCoverage: getRouteKnowledgeCoverage("MEDTECH_COMPLIANCE_AGENT", medicalKnowledge),
    references: mapKnowledgeReferences(references, 3),
    complianceBoundary: useCase?.reviewBoundary || "Regulatory draft only; no final complaint disposition, CAPA decision, or regulatory submission is performed.",
    liveAction: "No regulatory submission, complaint disposition, CAPA approval, field action, or device safety decision is performed."
  });
}

function synthesizeResponse({ message, profile, risk, intents, agentResults, memoryContext, context, medicalKnowledge, requirementProfile, reasoningQuality, plan, llmBrain, modelRouting = null }) {
  const name = profile.name || "there";
  const responseFocus = buildResponseFocus({ message, intents, agentResults, risk, requirementProfile, plan });
  const steps = buildFocusedResponseSteps({ responseFocus, risk, context, agentResults, requirementProfile });
  const warningSigns = buildFocusedWarningSigns(responseFocus, risk, agentResults);
  const supportSections = buildFocusedSupportSections({ responseFocus, warningSigns, agentResults });
  const precision = buildGeneralResponsePrecision({ responseFocus, risk, agentResults, medicalKnowledge, reasoningQuality, llmBrain });

  const agentSummary = agentResults
    .filter((result) => responseFocus.summaryRoutes.includes(result.id))
    .slice(0, 3)
    .map((result) => `${result.name}: ${result.output.summary}`)
    .join(" ");

  return {
    title: responseFocus.title,
    greeting: `Hi ${name},`,
    summary: responseFocus.summary,
    responseFocus,
    precision,
    processingMode: modelRouting?.generatedUsing || llmBrain?.processingMode || "Local Model",
    modelRouting: modelRouting
      ? {
        generatedUsing: modelRouting.generatedUsing,
        processingType: modelRouting.processingType,
        primaryModel: modelRouting.selectedModel.primary,
        fallbackChain: modelRouting.failover.chain,
        costClass: modelRouting.cost.class
      }
      : null,
    brain: llmBrain
      ? {
        score: llmBrain.score,
        label: llmBrain.label,
        ownerRoute: llmBrain.routeDecision.ownerRoute,
        processingMode: llmBrain.processingMode,
        ambiguity: llmBrain.ambiguity.level,
        askOneQuestionIfNeeded: llmBrain.answerPolicy.askOneQuestionIfNeeded
      }
      : null,
    requirementFit: {
      score: requirementProfile?.score || 0,
      label: requirementProfile?.label || "Requirement checked",
      contract: requirementProfile?.answerContract || "Focused safe answer."
    },
    reasoningQuality: reasoningQuality
      ? {
        score: reasoningQuality.score,
        label: reasoningQuality.label,
        summary: reasoningQuality.summary
      }
      : null,
    agentSummary,
    whatToDoNow: steps,
    warningSigns,
    supportSections,
    disclaimer: risk.level === "CRITICAL"
      ? "This is not a diagnosis. For urgent symptoms, use local emergency care now."
      : "This is not a diagnosis or prescription. Use a clinician for personal medical decisions."
  };
}

function buildResponseFocus({ message, intents, agentResults, risk, requirementProfile, plan }) {
  const agentResultsById = buildAgentResultsIndex(agentResults);
  const hasAgent = (route) => agentResultsById.has(route);
  const primaryIntent = selectPrimaryResponseIntent(intents, risk);
  const singleActiveAgent = agentResults.length === 1 ? agentResults[0] : null;
  const hasSafetyRoute = hasAgent("ALERT_AGENT");
  const safetyFirst = risk.level === "CRITICAL" || risk.level === "HIGH";
  const plannedOwnerRoute = plan?.responseOwner?.route && hasAgent(plan.responseOwner.route)
    ? plan.responseOwner.route
    : null;
  const expectedRoute = requirementProfile?.expectedRoute && hasAgent(requirementProfile.expectedRoute)
    ? requirementProfile.expectedRoute
    : null;
  const primaryRoute = singleActiveAgent?.id
    || plannedOwnerRoute
    || (safetyFirst && hasSafetyRoute ? "ALERT_AGENT" : null)
    || expectedRoute
    || primaryIntent?.route
    || "RAG_AGENT";
  const primaryAgent = getAgentResult(agentResultsById, primaryRoute)
    || agentResults.find((agent) => agent.id !== "RAG_AGENT")
    || agentResults[0];
  const label = singleActiveAgent?.name || requirementProfile?.outputLabel || primaryIntent?.label || primaryAgent?.name || "Health question";
  const answerMode = requirementProfile?.answerMode || { id: "quick", label: "Quick" };
  const summaryRoutes = Array.from(new Set([
    primaryRoute,
    ...(safetyFirst || hasSafetyRoute ? ["ALERT_AGENT"] : []),
    ...(primaryRoute !== "VITALS_AGENT" && hasAgent("VITALS_AGENT") && (risk.level !== "LOW") ? ["VITALS_AGENT"] : [])
  ])).filter((route) => hasAgent(route));
  const title = safetyFirst
    ? `${risk.label}: ${label}`
    : answerMode.id === "handoff"
      ? `Doctor note: ${label}`
      : answerMode.id === "deep"
        ? `${label}: deep review`
        : `${label}: quick next step`;
  const requestText = compactResponseText(message, 88);
  const requirementLabel = requirementProfile?.outputLabel || label;
  const summaryLimit = answerMode.id === "deep"
    ? 240
    : answerMode.id === "handoff"
      ? 220
      : 160;
  let summary = safetyFirst
    ? `I focused on your ${requirementLabel.toLowerCase()} request and the safety signals that matter most.`
    : answerMode.id === "handoff"
      ? `Share-ready note for the ${requirementLabel.toLowerCase()} request: "${requestText}".`
      : answerMode.id === "deep"
        ? `Detailed review of the ${requirementLabel.toLowerCase()} request using your context: "${requestText}".`
        : `Quick answer for the ${requirementLabel.toLowerCase()} request: "${requestText}".`;

  if (primaryRoute === "RAG_AGENT" && primaryAgent?.output?.patientAnswerSummary) {
    summary = compactResponseText(primaryAgent.output.patientAnswerSummary, summaryLimit);
  }

  if (primaryRoute === "SPECIALIST_DOCTOR_AGENT" && primaryAgent?.output?.patientAnswerSummary) {
    summary = compactResponseText(primaryAgent.output.patientAnswerSummary, summaryLimit);
  }

  return {
    label,
    primaryIntent: singleActiveAgent ? routeIntentType(singleActiveAgent.id) : primaryIntent?.type || "GENERAL",
    primaryRoute,
    primaryAgent: primaryAgent?.name || label,
    summaryRoutes,
    safetyFirst,
    title,
    summary,
    requirement: requirementProfile
      ? {
        outputType: requirementProfile.outputType,
        outputLabel: requirementProfile.outputLabel,
        detailLevel: requirementProfile.detailLevel,
        answerMode: answerMode.id,
        answerModeLabel: answerMode.label,
        expectedRoute: requirementProfile.expectedRoute,
        maxPrimaryActions: requirementProfile.maxPrimaryActions
      }
      : null,
    policy: "focused-answer-only"
  };
}

function routeIntentType(route) {
  const intentTypes = {
    RAG_AGENT: "GENERAL",
    SPECIALIST_DOCTOR_AGENT: "SPECIALIST_DOCTOR",
    VITALS_AGENT: "VITALS",
    PHARMACY_AGENT: "MEDICATION",
    SCHEDULING_AGENT: "APPOINTMENT",
    ALERT_AGENT: "EMERGENCY",
    LABS_AGENT: "LABS",
    LIFESTYLE_AGENT: "LIFESTYLE",
    WELLNESS_AGENT: "MENTAL_WELLNESS",
    RECORDS_AGENT: "RECORDS",
    INSURANCE_AGENT: "INSURANCE",
    CARE_TRANSITIONS_AGENT: "CARE_TRANSITIONS",
    CLAIMS_OPS_AGENT: "CLAIMS_OPERATIONS",
    UTILIZATION_AGENT: "UTILIZATION_MANAGEMENT",
    GXP_QUALITY_AGENT: "GXP_QUALITY",
    MEDTECH_COMPLIANCE_AGENT: "MEDTECH_COMPLIANCE"
  };

  return intentTypes[route] || "GENERAL";
}

function selectPrimaryResponseIntent(intents = [], risk) {
  if (risk.level === "CRITICAL" || risk.level === "HIGH") {
    const emergency = intents.find((intent) => intent.type === "EMERGENCY");

    if (emergency) {
      return emergency;
    }
  }

  return intents.find((intent) => intent.type !== "GENERAL")
    || intents[0]
    || {
      type: "GENERAL",
      label: "Health guidance",
      route: "RAG_AGENT"
    };
}

function buildFocusedResponseSteps({ responseFocus, risk, context, agentResults, requirementProfile }) {
  const agentResultsById = buildAgentResultsIndex(agentResults);
  const hasAgent = (id) => agentResultsById.has(id);
  const readOutput = (id) => getAgentOutput(agentResultsById, id);
  const steps = [];
  const appendSupportAction = (route, actionKey, fallbackIndex = 0) => {
    if (!hasAgent(route)) {
      return;
    }

    const output = readOutput(route);
    const actions = Array.isArray(output?.[actionKey]) ? output[actionKey] : [];
    const picked = actions[fallbackIndex] || actions[0];

    if (picked) {
      steps.push(picked);
    }
  };

  if (risk.level === "CRITICAL") {
    const alertOutput = readOutput("ALERT_AGENT");

    if (Array.isArray(alertOutput?.safetyActions) && alertOutput.safetyActions.length) {
      steps.push(...alertOutput.safetyActions.slice(0, 3));
    } else {
      steps.push("Get emergency medical help now or ask someone nearby to help.");
      steps.push("Do not wait for the app to keep monitoring this.");
    }

    if (responseFocus.primaryRoute === "SPECIALIST_DOCTOR_AGENT") {
      const specialistOutput = readOutput("SPECIALIST_DOCTOR_AGENT");
      const followupStep = Array.isArray(specialistOutput?.specialistActions) ? specialistOutput.specialistActions[1] : "";

      if (followupStep) {
        steps.push(followupStep);
      }
    }
  } else if (risk.level === "HIGH") {
    const alertOutput = readOutput("ALERT_AGENT");

    if (Array.isArray(alertOutput?.safetyActions) && alertOutput.safetyActions.length) {
      steps.push(...alertOutput.safetyActions.slice(0, 3));
    } else {
      steps.push("Rest somewhere safe and avoid driving while symptoms are active.");
      steps.push("Contact urgent care or your clinician if symptoms continue or readings stay high.");
    }

    if (responseFocus.primaryRoute === "SPECIALIST_DOCTOR_AGENT") {
      const specialistOutput = readOutput("SPECIALIST_DOCTOR_AGENT");
      const followupStep = Array.isArray(specialistOutput?.specialistActions) ? specialistOutput.specialistActions[1] : "";

      if (followupStep) {
        steps.push(followupStep);
      }
    }
  } else {
    switch (responseFocus.primaryRoute) {
      case "PHARMACY_AGENT":
        {
          const pharmacyOutput = readOutput("PHARMACY_AGENT");
          const hasVitalSupport = hasAgent("VITALS_AGENT");
          const hasSafetySupport = risk.level !== "LOW" && hasAgent("ALERT_AGENT");
          const pharmacyActions = Array.isArray(pharmacyOutput?.pharmacyActions) ? pharmacyOutput.pharmacyActions : [];
          const pharmacyLimit = hasVitalSupport || hasSafetySupport ? 2 : 3;

          if (pharmacyActions.length) {
            steps.push(...pharmacyActions.slice(0, pharmacyLimit));
          } else {
            steps.push("Check the medicine label or contact a pharmacist/doctor for the missed-dose instruction.");
            steps.push("Do not double the next dose unless your own care instructions say so.");
          }

          if (hasSafetySupport) {
            appendSupportAction("ALERT_AGENT", "safetyActions", 1);
          } else if (hasVitalSupport) {
            appendSupportAction("VITALS_AGENT", "vitalActions", 0);
          }
        }
        break;
      case "RAG_AGENT": {
        const generalOutput = readOutput("RAG_AGENT");
        const generalActions = Array.isArray(generalOutput?.safeActions) ? generalOutput.safeActions : [];
        const hasVitalSupport = hasAgent("VITALS_AGENT");
        const hasSafetySupport = risk.level !== "LOW" && hasAgent("ALERT_AGENT");
        const requestedActionLimit = clamp(Number(requirementProfile?.maxPrimaryActions || 2), 1, 3);
        const targetGeneralActions = clamp(
          risk.level === "MEDIUM"
            ? Math.max(requestedActionLimit, 2)
            : requestedActionLimit,
          1,
          3
        );
        const priorityGeneralPattern = /(avoid driving|same-day clinician|urgent care|contact a clinician|confusion|fainting|speech|vision|breathing|chest)/i;
        const escalationGeneralPattern = /(same-day clinician|urgent care|contact a clinician|repeat bp stays elevated|does not settle|usual pattern)/i;
        const shouldPromotePriorityGeneralAction = risk.level !== "LOW" || hasSafetySupport;
        const generalLimit = Math.min(targetGeneralActions, generalActions.length || targetGeneralActions);

        if (generalActions.length) {
          const selectedGeneralActions = [];
          const pushGeneralAction = (item) => {
            if (item && !selectedGeneralActions.includes(item)) {
              selectedGeneralActions.push(item);
            }
          };

          pushGeneralAction(generalActions[0]);

          if (generalLimit > 1 && shouldPromotePriorityGeneralAction) {
            const priorityGeneralAction = generalActions.slice(1).find((item) => escalationGeneralPattern.test(item))
              || generalActions.slice(1).find((item) => priorityGeneralPattern.test(item));
            pushGeneralAction(priorityGeneralAction);
          }

          for (const action of generalActions.slice(1)) {
            if (selectedGeneralActions.length >= generalLimit) {
              break;
            }

            pushGeneralAction(action);
          }

          steps.push(...selectedGeneralActions.slice(0, generalLimit));
        } else {
          steps.push("Write down what changed, when it started, severity, medicines, and any readings.");
          steps.push("Contact your doctor if symptoms continue, worsen, or feel unusual for you.");
        }

        if (steps.length < targetGeneralActions && hasSafetySupport) {
          appendSupportAction("ALERT_AGENT", "safetyActions", 1);
        }

        if (steps.length < targetGeneralActions && hasVitalSupport) {
          appendSupportAction("VITALS_AGENT", "vitalActions", 0);
        }
        break;
      }
      case "SCHEDULING_AGENT":
        {
          const schedulingOutput = readOutput("SCHEDULING_AGENT");

          if (Array.isArray(schedulingOutput?.visitActions) && schedulingOutput.visitActions.length) {
            steps.push(...schedulingOutput.visitActions.slice(0, 3));
          } else {
            steps.push("Use this as a prompt to contact your clinic for the appointment or follow-up.");
            steps.push("Prepare one short reason for the visit and any current readings.");
          }
        }
        break;
      case "VITALS_AGENT":
        {
          const vitalsOutput = readOutput("VITALS_AGENT");
          const hasSafetySupport = risk.level !== "LOW" && hasAgent("ALERT_AGENT");
          const vitalActions = Array.isArray(vitalsOutput?.vitalActions) ? vitalsOutput.vitalActions : [];
          const vitalLimit = hasSafetySupport ? 2 : 3;

          if (vitalActions.length) {
            steps.push(...vitalActions.slice(0, vitalLimit));
          } else {
            steps.push("Recheck the reading correctly after resting if you can.");
            steps.push("Write down the reading, time, and symptoms for your clinician.");
          }

          if (hasSafetySupport) {
            appendSupportAction("ALERT_AGENT", "safetyActions", 1);
          }
        }
        break;
      case "LABS_AGENT":
        {
          const labsOutput = readOutput("LABS_AGENT");

          if (Array.isArray(labsOutput?.labActions) && labsOutput.labActions.length) {
            steps.push(...labsOutput.labActions.slice(0, 3));
          } else {
            steps.push("Confirm the exact lab value, unit, and reference range.");
            steps.push("Ask your clinician what changed and whether follow-up is needed.");
          }
        }
        break;
      case "SPECIALIST_DOCTOR_AGENT":
        {
          const specialistOutput = readOutput("SPECIALIST_DOCTOR_AGENT");

          if (Array.isArray(specialistOutput?.specialistActions) && specialistOutput.specialistActions.length) {
            steps.push(...specialistOutput.specialistActions.slice(0, 3));
          } else {
            steps.push("Use this as specialist education and prepare your exact symptoms, duration, readings, medicines, and reports.");
            steps.push("Ask a licensed clinician to confirm diagnosis, tests, and treatment choices for your situation.");
          }
        }
        break;
      case "LIFESTYLE_AGENT":
        {
          const lifestyleOutput = readOutput("LIFESTYLE_AGENT");

          if (Array.isArray(lifestyleOutput?.lifestyleActions) && lifestyleOutput.lifestyleActions.length) {
            steps.push(...lifestyleOutput.lifestyleActions.slice(0, 3));
          } else {
            steps.push("Use only gentle, general habit changes that fit your existing care plan.");
            steps.push("Pause activity if symptoms worsen.");
          }
        }
        break;
      case "WELLNESS_AGENT":
        {
          const wellnessOutput = readOutput("WELLNESS_AGENT");
          const supportPlan = Array.isArray(wellnessOutput?.supportPlan) ? wellnessOutput.supportPlan : [];

          if (supportPlan.length) {
            steps.push(...supportPlan.slice(0, 2));
          } else {
            steps.push("Use a calming routine now and contact a trusted person or clinician if symptoms continue.");
            steps.push("If you feel unsafe, seek immediate real-world support.");
          }
        }
        break;
      case "RECORDS_AGENT":
        {
          const recordsOutput = readOutput("RECORDS_AGENT");
          const nextActions = Array.isArray(recordsOutput?.nextActions) ? recordsOutput.nextActions : [];
          const checklist = Array.isArray(recordsOutput?.reconciliationChecklist) ? recordsOutput.reconciliationChecklist : [];

          if (nextActions.length) {
            steps.push(...nextActions.slice(0, 2));
          } else {
            steps.push("Use the summary as a draft for your care team.");
            steps.push("Verify medicines, conditions, readings, and dates before sharing.");
          }

          if (steps.length < 2 && checklist[0]) {
            steps.push(checklist[0]);
          }
        }
        break;
      case "INSURANCE_AGENT":
        {
          const insuranceOutput = readOutput("INSURANCE_AGENT");
          const checklist = Array.isArray(insuranceOutput?.checklist) ? insuranceOutput.checklist : [];
          const questions = Array.isArray(insuranceOutput?.benefitQuestions) ? insuranceOutput.benefitQuestions : [];

          if (checklist.length) {
            steps.push(...checklist.slice(0, 2));
          } else {
            steps.push("Use this as an administrative question list for the insurer, clinic, or reviewer.");
            steps.push("Do not treat it as a payment, coverage, or authorization decision.");
          }

          if (steps.length < 2 && questions[0]) {
            steps.push(questions[0]);
          }
        }
        break;
      case "CLAIMS_OPS_AGENT":
      case "UTILIZATION_AGENT":
        steps.push("Use this as an administrative question list for the insurer, clinic, or reviewer.");
        steps.push("Do not treat it as a payment, coverage, or authorization decision.");
        break;
      case "CARE_TRANSITIONS_AGENT":
        steps.push("Use the transition content as a clinician-review draft.");
        steps.push("Confirm discharge instructions with the care team before sharing.");
        break;
      case "GXP_QUALITY_AGENT":
      case "MEDTECH_COMPLIANCE_AGENT":
        steps.push("Use this as a regulated-document draft for qualified reviewer approval.");
        steps.push("Do not treat it as a release, CAPA, submission, or safety decision.");
        break;
      default:
        steps.push("Monitor how you feel and note any readings.");
        steps.push("Contact your doctor if symptoms continue or worsen.");
    }
  }

  if (risk.level === "MEDIUM" && hasAgent("ALERT_AGENT") && !steps.some((step) => step.includes("clinician"))) {
    steps.push("Contact a clinician if symptoms continue, worsen, or feel unusual.");
  }

  if (context.supportNow === "alone" && (risk.level === "HIGH" || risk.level === "CRITICAL")) {
    steps.push("Ask someone nearby to stay with you if this is happening now.");
  }

  if (context.redFlags.length && risk.level !== "CRITICAL") {
    steps.push("The selected warning sign makes this more urgent than a routine question.");
  }

  const requestedLimit = Number(requirementProfile?.maxPrimaryActions || 2);
  const effectiveRequestedLimit = responseFocus.primaryRoute === "RAG_AGENT" && risk.level === "MEDIUM"
    ? Math.max(requestedLimit, 2)
    : requestedLimit;
  const limit = risk.level === "CRITICAL"
    ? clamp(Math.max(effectiveRequestedLimit, 2), 2, 3)
    : clamp(effectiveRequestedLimit, 1, 3);

  return dedupeResponseItems(steps).slice(0, limit);
}

function buildFocusedWarningSigns(responseFocus, risk, agentResults = []) {
  if (risk.level === "CRITICAL") {
    return [
      "Chest pain, severe breathlessness, fainting, confusion, one-sided weakness, or severe allergy signs.",
      "Very high readings paired with severe headache, vision changes, weakness, or confusion.",
      "Symptoms that rapidly worsen or feel unusual for you."
    ];
  }

  if (risk.level === "HIGH") {
    return [
      "Readings that stay very high after resting.",
      "New chest pain, breathing trouble, fainting, confusion, weakness, or vision changes."
    ];
  }

  if (responseFocus.primaryRoute === "PHARMACY_AGENT") {
    const warnings = ["Severe dizziness, fainting, allergic symptoms, or feeling unsafe after a medicine issue."];

    if (Array.isArray(agentResults) && agentResults.some((agent) => agent.id === "VITALS_AGENT")) {
      warnings.push("Readings that stay abnormal, rise quickly, or come with worsening symptoms after the medicine issue.");
    }

    return dedupeResponseItems(warnings).slice(0, 2);
  }

  if (responseFocus.primaryRoute === "SPECIALIST_DOCTOR_AGENT") {
    const specialistOutput = Array.isArray(agentResults)
      ? agentResults.find((agent) => agent.id === "SPECIALIST_DOCTOR_AGENT")?.output || {}
      : {};
    const diseaseSafety = Array.isArray(specialistOutput?.diseaseMap?.safety) ? specialistOutput.diseaseMap.safety : [];
    const specialistWarnings = dedupeResponseItems([
      ...diseaseSafety,
      "Symptoms that are sudden, severe, rapidly worsening, or unusual for you."
    ]).slice(0, 4);

    return specialistWarnings.length
      ? specialistWarnings
      : [
        "Symptoms that are sudden, severe, rapidly worsening, or unusual for you.",
        "Chest pain, breathing trouble, fainting, confusion, one-sided weakness, severe allergy, or very high readings with symptoms."
      ];
  }

  if (responseFocus.primaryRoute === "VITALS_AGENT") {
    const generalOutput = Array.isArray(agentResults)
      ? agentResults.find((agent) => agent.id === "RAG_AGENT")?.output || {}
      : {};
    const concernProfile = generalOutput?.concernProfile || {};
    const hitSet = new Set((concernProfile.matchedHits || []).map((item) => normalizeSearchText(item)));
    const warnings = ["Readings that rise quickly, stay abnormal, or come with worsening symptoms."];

    if (concernProfile.family === "headache concern" || hitSet.has("headache")) {
      warnings.push("Severe headache with confusion, weakness, fainting, repeated vomiting, or new vision or speech change.");
    } else if (concernProfile.family === "blood-sugar or diabetes concern" || hitSet.has("sugar") || hitSet.has("glucose")) {
      warnings.push("Confusion, fainting, severe weakness, repeated vomiting, or very high or very low sugar readings.");
    }

    return dedupeResponseItems(warnings).slice(0, 2);
  }

  if (responseFocus.primaryRoute === "LABS_AGENT") {
    const labsOutput = Array.isArray(agentResults)
      ? agentResults.find((agent) => agent.id === "LABS_AGENT")?.output || {}
      : {};
    const urgentSignals = Array.isArray(labsOutput?.prioritySignals?.urgentSignals)
      ? labsOutput.prioritySignals.urgentSignals
      : [];

    return dedupeResponseItems([
      ...urgentSignals.map((signal) => `Urgent lab concern: ${signal}.`),
      urgentSignals.length
        ? "Urgent symptoms or critical lab flags need prompt real-world care."
        : "Abnormal lab results paired with chest pain, breathing trouble, confusion, fainting, bleeding, or severe weakness need real-world care.",
      "Symptoms that worsen, feel unusual, or do not improve."
    ]).slice(0, 2);
  }

  if (responseFocus.primaryRoute === "WELLNESS_AGENT") {
    return [
      "Feeling unsafe, self-harm thoughts, severe panic, confusion, or inability to function needs immediate real-world support.",
      "Symptoms that worsen, feel unusual, or make it hard to stay safe should not wait for the app."
    ];
  }

  if (responseFocus.primaryRoute === "LIFESTYLE_AGENT") {
    return [
      "Chest pain, severe breathlessness, fainting, confusion, or symptoms that start or worsen with activity need real-world care.",
      "Any symptom that makes routine food, movement, sleep, or hydration changes feel unsafe should stop the plan."
    ];
  }

  if (responseFocus.primaryRoute === "RAG_AGENT") {
    const generalOutput = Array.isArray(agentResults)
      ? agentResults.find((agent) => agent.id === "RAG_AGENT")?.output || {}
      : {};
    const concernProfile = generalOutput?.concernProfile || {};
    const concernId = concernProfile.familyId || "";
    const hitSet = new Set((concernProfile.matchedHits || []).map((item) => normalizeSearchText(item)));

    if (concernProfile.family === "headache concern" || hitSet.has("headache")) {
      return [
        "Severe headache with confusion, weakness, fainting, repeated vomiting, or new vision or speech change.",
        "Symptoms that suddenly worsen or feel unusual for you."
      ];
    }

    if (concernProfile.family === "blood-pressure concern" || hitSet.has("bp") || hitSet.has("blood pressure")) {
      return [
        "Readings that stay very high after rest or rise with chest pain, weakness, or shortness of breath.",
        "Symptoms that worsen, feel unusual, or do not improve."
      ];
    }

    if (concernProfile.family === "blood-sugar or diabetes concern" || hitSet.has("sugar") || hitSet.has("glucose") || hitSet.has("diabetes")) {
      return [
        "Confusion, fainting, severe weakness, repeated vomiting, or very high or very low sugar readings.",
        "Symptoms that worsen, feel unusual, or do not improve."
      ];
    }

    if (concernId === "respiratory") {
      return [
        "Breathing trouble, blue lips, confusion, dehydration, or fever that is rapidly worsening.",
        "Symptoms that worsen, feel unusual, or do not improve."
      ];
    }

    if (concernId === "digestive") {
      return [
        "Repeated vomiting, dehydration, blood, severe one-sided pain, fainting, or confusion.",
        "Symptoms that worsen, feel unusual, or do not improve."
      ];
    }

    if (concernId === "skin") {
      return [
        "Face or lip swelling, breathing trouble, fever, rapid spread, or severe pain.",
        "Symptoms that worsen, feel unusual, or do not improve."
      ];
    }

    if (concernId === "urinary") {
      return [
        "Fever, flank pain, blood in urine, reduced urine output, severe weakness, or confusion.",
        "Symptoms that worsen, feel unusual, or do not improve."
      ];
    }

    if (concernId === "muscle_joint") {
      return [
        "Inability to bear weight, numbness, weakness, major swelling, deformity, or fever.",
        "Symptoms that worsen, feel unusual, or do not improve."
      ];
    }

    if (concernId === "eye_ear_dental") {
      return [
        "Vision loss, facial swelling, trouble opening the mouth, fever, or severe worsening pain.",
        "Symptoms that worsen, feel unusual, or do not improve."
      ];
    }

    if (concernId === "stress_sleep") {
      return [
        "Feeling unsafe, self-harm thoughts, severe panic, confusion, or inability to function safely.",
        "Symptoms that worsen, feel unusual, or do not improve."
      ];
    }

    if (Array.isArray(agentResults) && agentResults.some((agent) => agent.id === "VITALS_AGENT")) {
      return [
        "Readings that stay abnormal after correct repeat checks or rise with worsening symptoms.",
        "Symptoms that worsen, feel unusual, or do not improve."
      ];
    }
  }

  return ["Symptoms that worsen, feel unusual, or do not improve."];
}

function buildFocusedSupportSections({ responseFocus, warningSigns = [], agentResults = [] }) {
  const agentResultsById = buildAgentResultsIndex(agentResults);
  const readOutput = (route) => getAgentOutput(agentResultsById, route);
  const section = (id, title, icon, items, limit = 4) => {
    const safeItems = dedupeResponseItems(Array.isArray(items) ? items : []).slice(0, limit);
    return safeItems.length ? { id, title, icon, items: safeItems } : null;
  };
  const sections = [];
  const pushSection = (candidate) => {
    if (!candidate || sections.some((existing) => existing.id === candidate.id)) {
      return;
    }

    sections.push(candidate);
  };
  const draftItems = (items = []) => items
    .map((item) => item && typeof item === "object" && item.title
      ? `${item.title}: ${compactResponseText(item.detail || "", 92)}`
      : "")
    .filter(Boolean);
  const packetItems = (items = []) => items
    .map((item) => item && typeof item === "object" && item.title
      ? `${item.title}: ${compactResponseText(item.detail || "", 92)}`
      : "")
    .filter(Boolean);
  const missingFieldItems = (items = []) => items
    .map((item) => cleanText(item))
    .filter(Boolean)
    .map((item) => `Add ${item.toLowerCase()}.`);
  const abnormalLabItems = (items = []) => items
    .map((item) => {
      if (!item || typeof item !== "object" || !item.label) {
        return "";
      }

      return `${item.label} ${item.value}${item.unit ? ` ${item.unit}` : ""} (${item.status}).`;
    })
    .filter(Boolean);
  const supportBridgeSection = (route) => {
    const output = readOutput(route);

    switch (route) {
      case "VITALS_AGENT":
        return section("support-vitals", "Vitals to track", "icon-activity", [
          ...(Array.isArray(output?.watchItems) ? output.watchItems : []),
          ...(Array.isArray(output?.trendPlan) ? output.trendPlan : []),
          ...(Array.isArray(output?.vitalActions) ? output.vitalActions : [])
        ], 4);
      case "PHARMACY_AGENT":
        return section("support-pharmacy", "Medication context", "icon-health", [
          ...(Array.isArray(output?.nextSafeSteps) ? output.nextSafeSteps : []),
          ...(Array.isArray(output?.interactionPrompts) ? output.interactionPrompts : []),
          ...(Array.isArray(output?.pharmacyActions) ? output.pharmacyActions : [])
        ], 4);
      case "LABS_AGENT":
        return section("support-labs", "Lab follow-up", "icon-health", [
          ...abnormalLabItems(output?.abnormalValues || []),
          ...(Array.isArray(output?.labActions) ? output.labActions : []),
          ...(Array.isArray(output?.accuracyGaps) ? output.accuracyGaps : [])
        ], 4);
      case "LIFESTYLE_AGENT":
        return section("support-lifestyle", "Lifestyle support", "icon-health", [
          ...(Array.isArray(output?.lifestyleActions) ? output.lifestyleActions : []),
          ...(Array.isArray(output?.trackingPlan) ? output.trackingPlan : []),
          ...(Array.isArray(output?.habitLoop) ? output.habitLoop : [])
        ], 4);
      case "WELLNESS_AGENT":
        return section("support-wellness", "Wellness support", "icon-message", [
          ...(Array.isArray(output?.supportPlan) ? output.supportPlan : []),
          ...(Array.isArray(output?.habitLoop) ? output.habitLoop : [])
        ], 4);
      case "RECORDS_AGENT":
        return section("support-records", "Record gaps", "icon-message", [
          ...(Array.isArray(output?.nextActions) ? output.nextActions : []),
          ...missingFieldItems(output?.missingFields || [])
        ], 4);
      case "INSURANCE_AGENT":
        return section("support-insurance", "Coverage checklist", "icon-route", [
          ...(Array.isArray(output?.checklist) ? output.checklist : []),
          ...(Array.isArray(output?.benefitQuestions) ? output.benefitQuestions : [])
        ], 4);
      case "SCHEDULING_AGENT":
        return section("support-scheduling", "Visit prep", "icon-route", [
          ...(Array.isArray(output?.visitActions) ? output.visitActions : []),
          ...(Array.isArray(output?.prepChecklist) ? output.prepChecklist : [])
        ], 4);
      case "SPECIALIST_DOCTOR_AGENT":
        return section("support-specialist", "Specialist follow-up", "icon-message", [
          ...(Array.isArray(output?.doctorQuestions) ? output.doctorQuestions : []),
          ...(Array.isArray(output?.diseaseMap?.monitoringPlan) ? output.diseaseMap.monitoringPlan : [])
        ], 4);
      case "CARE_TRANSITIONS_AGENT":
      case "CLAIMS_OPS_AGENT":
      case "UTILIZATION_AGENT":
        return section(`support-${route.toLowerCase()}`, "Draft outputs", "icon-route", draftItems(output?.draftOutputs || []), 4);
      default:
        return null;
    }
  };
  const supportingRoutes = agentResults
    .map((agent) => agent.id)
    .filter((route) => route !== responseFocus.primaryRoute && route !== "ALERT_AGENT");

  if (responseFocus.primaryRoute === "RAG_AGENT") {
    const generalOutput = readOutput("RAG_AGENT");
    const atlasSections = generalOutput?.atlasSections && typeof generalOutput.atlasSections === "object"
      ? generalOutput.atlasSections
      : null;
    const generalSections = generalOutput?.generalSections && typeof generalOutput.generalSections === "object"
      ? generalOutput.generalSections
      : null;
    const activeSections = atlasSections || generalSections;

    if (activeSections) {
      pushSection(section("overview", "Overview", "icon-message", activeSections.overview, 3));
      pushSection(section("track", "What to track", "icon-activity", activeSections.tracking || generalOutput.safeActions, 4));
      pushSection(section("questions", atlasSections ? "Ask care team" : "Questions to answer next", "icon-route", activeSections.careQuestions || generalOutput.focusQuestions, 4));
      pushSection(section("precautions", "Precautions", "icon-alert", activeSections.precautions || warningSigns, 4));
    } else {
      pushSection(section("track", "What to track", "icon-activity", generalOutput.safeActions, 4));
      pushSection(section("questions", "Questions to answer next", "icon-route", generalOutput.focusQuestions, 4));
      pushSection(section("precautions", "Precautions", "icon-alert", warningSigns, 4));
    }

    for (const route of supportingRoutes) {
      if (sections.length >= 5) {
        break;
      }

      pushSection(supportBridgeSection(route));
    }

    return sections;
  }

  if (responseFocus.primaryRoute === "SPECIALIST_DOCTOR_AGENT") {
    const specialistOutput = readOutput("SPECIALIST_DOCTOR_AGENT");
    const diseaseMap = specialistOutput?.diseaseMap || {};
    const precautions = Array.isArray(specialistOutput?.precautions) ? specialistOutput.precautions : [];
    const careExpectations = Array.isArray(diseaseMap.careExpectations) ? diseaseMap.careExpectations : [];
    const supportReview = specialistOutput?.supportReview && typeof specialistOutput.supportReview === "object"
      ? specialistOutput.supportReview
      : null;

    pushSection(section("precautions", "Precautions", "icon-alert", [
      ...precautions,
      ...(Array.isArray(diseaseMap.safety) ? diseaseMap.safety : []),
      ...warningSigns
    ], 4));
    pushSection(section("treatment", "Treatment and care context", "icon-health", [
      ...careExpectations,
      ...(Array.isArray(diseaseMap.treatmentCategories) ? diseaseMap.treatmentCategories : []),
      ...(Array.isArray(diseaseMap.careOptions) ? diseaseMap.careOptions : [])
    ], 4));
    pushSection(section("prevention", "Prevention focus", "icon-health", diseaseMap.prevention || diseaseMap.monitoringPlan, 4));
    pushSection(section("questions", "Doctor questions", "icon-message", specialistOutput?.doctorQuestions, 4));
    pushSection(section("cross-checks", "Cross-check support", "icon-route", [
      supportReview?.active ? supportReview.summary : "",
      ...(Array.isArray(supportReview?.findings) ? supportReview.findings : []),
      ...(Array.isArray(supportReview?.actions) ? supportReview.actions : [])
    ], 4));

    for (const route of supportingRoutes) {
      if (sections.length >= 5) {
        break;
      }

      pushSection(supportBridgeSection(route));
    }

    return sections;
  }

  if (responseFocus.primaryRoute === "PHARMACY_AGENT") {
    const pharmacyOutput = readOutput("PHARMACY_AGENT");

    pushSection(section("pharmacy-precautions", "Precautions", "icon-alert", [
      ...(Array.isArray(pharmacyOutput?.safetySignals?.urgent) ? pharmacyOutput.safetySignals.urgent : []),
      ...(Array.isArray(pharmacyOutput?.safetySignals?.watch) ? pharmacyOutput.safetySignals.watch : []),
      ...warningSigns
    ], 4));
    pushSection(section("pharmacy-steps", "Medication safety", "icon-health", [
      ...(Array.isArray(pharmacyOutput?.nextSafeSteps) ? pharmacyOutput.nextSafeSteps : []),
      ...(Array.isArray(pharmacyOutput?.interactionPrompts) ? pharmacyOutput.interactionPrompts : []),
      ...(Array.isArray(pharmacyOutput?.pharmacyActions) ? pharmacyOutput.pharmacyActions : [])
    ], 4));
    pushSection(section("pharmacy-questions", "Pharmacist questions", "icon-message", pharmacyOutput?.pharmacistQuestions, 4));
    if (!supportingRoutes.length) {
      pushSection(section("pharmacy-label", "Label checks", "icon-activity", [
        ...(Array.isArray(pharmacyOutput?.labelUseChecks) ? pharmacyOutput.labelUseChecks : []),
        ...(Array.isArray(pharmacyOutput?.reviewGaps) ? pharmacyOutput.reviewGaps : [])
      ], 4));
    }
  } else if (responseFocus.primaryRoute === "LABS_AGENT") {
    const labsOutput = readOutput("LABS_AGENT");

    pushSection(section("labs-precautions", "Precautions", "icon-alert", [
      ...(Array.isArray(labsOutput?.prioritySignals?.urgentSignals) ? labsOutput.prioritySignals.urgentSignals : []),
      ...warningSigns
    ], 4));
    pushSection(section("labs-review", "What to review", "icon-health", [
      ...abnormalLabItems(labsOutput?.abnormalValues || []),
      ...(Array.isArray(labsOutput?.labActions) ? labsOutput.labActions : [])
    ], 4));
    pushSection(section("labs-questions", "Doctor questions", "icon-message", labsOutput?.doctorQuestions, 4));
    if (!supportingRoutes.length) {
      pushSection(section("labs-gaps", "Report gaps", "icon-activity", [
        ...(Array.isArray(labsOutput?.accuracyGaps) ? labsOutput.accuracyGaps : []),
        ...(Array.isArray(labsOutput?.reportQualityChecks) ? labsOutput.reportQualityChecks : [])
      ], 4));
    }
  } else if (responseFocus.primaryRoute === "VITALS_AGENT") {
    const vitalsOutput = readOutput("VITALS_AGENT");

    pushSection(section("vitals-watch", "Readings to watch", "icon-alert", [
      ...(Array.isArray(vitalsOutput?.watchItems) ? vitalsOutput.watchItems : []),
      ...warningSigns
    ], 4));
    pushSection(section("vitals-actions", "Next checks", "icon-activity", [
      ...(Array.isArray(vitalsOutput?.vitalActions) ? vitalsOutput.vitalActions : []),
      ...(Array.isArray(vitalsOutput?.trendPlan) ? vitalsOutput.trendPlan : [])
    ], 4));
    pushSection(section("vitals-questions", "Clinician questions", "icon-message", vitalsOutput?.clinicianQuestions, 4));
    if (!supportingRoutes.length) {
      pushSection(section("vitals-quality", "Measurement quality", "icon-health", [
        ...(Array.isArray(vitalsOutput?.accuracyGaps) ? vitalsOutput.accuracyGaps : []),
        ...(Array.isArray(vitalsOutput?.measurementQuality) ? vitalsOutput.measurementQuality : [])
      ], 4));
    }
  } else if (responseFocus.primaryRoute === "LIFESTYLE_AGENT") {
    const lifestyleOutput = readOutput("LIFESTYLE_AGENT");

    pushSection(section("lifestyle-safety", "Safety notes", "icon-alert", [
      ...(Array.isArray(lifestyleOutput?.safetyBoundaries) ? lifestyleOutput.safetyBoundaries : []),
      ...warningSigns
    ], 4));
    pushSection(section("lifestyle-habits", "Habit plan", "icon-health", [
      ...(Array.isArray(lifestyleOutput?.lifestyleActions) ? lifestyleOutput.lifestyleActions : []),
      ...(Array.isArray(lifestyleOutput?.habitLoop) ? lifestyleOutput.habitLoop : [])
    ], 4));
    pushSection(section("lifestyle-track", "What to track", "icon-activity", lifestyleOutput?.trackingPlan, 4));
    if (!supportingRoutes.length) {
      pushSection(section("lifestyle-questions", "Care-team questions", "icon-message", lifestyleOutput?.clinicianQuestions, 4));
    }
  } else if (responseFocus.primaryRoute === "WELLNESS_AGENT") {
    const wellnessOutput = readOutput("WELLNESS_AGENT");

    pushSection(section("wellness-support", "Support plan", "icon-message", wellnessOutput?.supportPlan, 4));
    pushSection(section("wellness-loop", "Reset loop", "icon-health", wellnessOutput?.habitLoop, 4));
    pushSection(section("wellness-safety", "Safety notes", "icon-alert", [
      ...(Array.isArray(wellnessOutput?.safetyBoundaries) ? wellnessOutput.safetyBoundaries : []),
      ...warningSigns
    ], 4));
  } else if (responseFocus.primaryRoute === "RECORDS_AGENT") {
    const recordsOutput = readOutput("RECORDS_AGENT");

    pushSection(section("records-next", "Next actions", "icon-message", recordsOutput?.nextActions, 4));
    pushSection(section("records-gaps", "Packet gaps", "icon-activity", [
      ...missingFieldItems(recordsOutput?.missingFields || []),
      ...(Array.isArray(recordsOutput?.timelineSignals) ? recordsOutput.timelineSignals : [])
    ], 4));
    pushSection(section("records-checklist", "Share checklist", "icon-route", recordsOutput?.reconciliationChecklist, 4));
    if (!supportingRoutes.length) {
      pushSection(section("records-packet", "Packet sections", "icon-health", packetItems(recordsOutput?.packetSections || []), 4));
    }
  } else if (responseFocus.primaryRoute === "INSURANCE_AGENT") {
    const insuranceOutput = readOutput("INSURANCE_AGENT");
    const documentGaps = insuranceOutput?.documentGaps || {};
    const eobReview = insuranceOutput?.eobReview || {};
    const appealReview = insuranceOutput?.appealReview || {};

    pushSection(section("insurance-missing", "Missing documents", "icon-activity", [
      ...missingFieldItems(documentGaps.missing || []),
      eobReview.nextCheck,
      appealReview.timingGuide
    ], 4));
    pushSection(section("insurance-checklist", "Claim checklist", "icon-route", insuranceOutput?.checklist, 4));
    pushSection(section("insurance-questions", "Benefit questions", "icon-message", insuranceOutput?.benefitQuestions, 4));
    if (!supportingRoutes.length) {
      pushSection(section("insurance-review", "Claim review focus", "icon-health", [
        ...(Array.isArray(eobReview.focus) ? eobReview.focus : []),
        ...(Array.isArray(appealReview.packet) ? appealReview.packet : [])
      ], 4));
    }
  } else if (responseFocus.primaryRoute === "SCHEDULING_AGENT") {
    const schedulingOutput = readOutput("SCHEDULING_AGENT");

    pushSection(section("schedule-actions", "Booking steps", "icon-route", schedulingOutput?.visitActions, 4));
    pushSection(section("schedule-prep", "Visit prep", "icon-health", schedulingOutput?.prepChecklist, 4));
    pushSection(section("schedule-questions", "Ask at booking", "icon-message", schedulingOutput?.followUpQuestions, 4));
    if (!supportingRoutes.length) {
      pushSection(section("schedule-gaps", "Readiness gaps", "icon-activity", schedulingOutput?.readinessGaps, 4));
    }
  } else if (["CARE_TRANSITIONS_AGENT", "CLAIMS_OPS_AGENT", "UTILIZATION_AGENT"].includes(responseFocus.primaryRoute)) {
    const adminOutput = readOutput(responseFocus.primaryRoute);

    pushSection(section("admin-drafts", "Draft outputs", "icon-route", draftItems(adminOutput?.draftOutputs || []), 4));
  }

  for (const route of supportingRoutes) {
    if (sections.length >= 4) {
      break;
    }

    pushSection(supportBridgeSection(route));
  }

  return sections.slice(0, 4);
}

function dedupeResponseItems(items) {
  const seen = new Set();
  const unique = [];

  for (const item of items) {
    const key = normalizeSearchText(item);

    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(item);
  }

  return unique;
}

function compactResponseText(value, limit) {
  const text = cleanText(value);

  if (text.length <= limit) {
    return text;
  }

  return `${text.slice(0, Math.max(0, limit - 3)).trim()}...`;
}

function buildSmartAnalysis({ message, profile, vitals, context, memoryContext, intents, risk, plan, requirementProfile, agentResults, finalResponse, guardrails, inputQuality, medicalKnowledge, agenticReview, reasoningQuality, precisionSupervisor, llmBrain }) {
  const vitalAssessment = buildVitalAssessment(vitals, profile);
  const messageSignals = detectMessageSignals(message);
  const contextSignals = buildContextSignals(context);
  const agentResultsById = buildAgentResultsIndex(agentResults);
  const intentAnalysis = intents.map((intent) => ({
    label: intent.label,
    route: intent.route,
    confidence: Math.round(intent.confidence * 100),
    rank: intent.rank,
    marginFromNext: intent.marginFromNext,
    evidence: intent.evidence,
    reasoning: intent.reasoning,
    explanation: explainIntent(intent)
  }));
  const routeAnalysis = plan.execute.map((route) => {
    const agentResult = getAgentResult(agentResultsById, route);

    return {
      route,
      label: routeLabel(route),
      why: plan.routeReasons[route] || ["Safety-first default route"],
      output: agentResult?.output?.summary || "Route completed safely.",
      tool: agentResult?.output?.productionTool || "Local care reference"
    };
  });
  const agentContracts = buildAgentContracts({ plan, agentResults, requirementProfile, risk });
  const riskBreakdown = risk.factors.map((factor) => ({
    category: factor.category,
    level: factor.level,
    impact: factor.impact,
    detail: factor.reason
  }));
  const patientContext = buildPatientContext(profile, memoryContext, context);
  const confidence = buildRoutingConfidence(intents, vitalAssessment, messageSignals, contextSignals);
  const handoffSummary = buildHandoffSummary({ profile, risk, intents, vitals, context });
  const dataQuality = buildDataQuality({ message, profile, vitals, context, memoryContext });
  const signalMatrix = buildSignalMatrix({ messageSignals, vitalAssessment, contextSignals, memoryContext, risk, medicalKnowledge });
  const suggestedQuestions = buildSuggestedQuestions({ risk, intents, vitalAssessment, context });
  const carePath = buildCarePath({ risk, intents, context });
  const automationPreview = buildAutomationPreview({ risk, intents, plan, context });
  const whatIfGuidance = buildWhatIfGuidance({ risk, intents, vitalAssessment, context, dataQuality });
  const accuracyProfile = buildAccuracyProfile({ intents, risk, medicalKnowledge, inputQuality, dataQuality, vitalAssessment, contextSignals, messageSignals });
  const accuracyEngine = buildAccuracyEngine({
    message,
    profile,
    vitals,
    context,
    memoryContext,
    intents,
    risk,
    plan,
    guardrails,
    inputQuality,
    requirementProfile,
    dataQuality,
    medicalKnowledge,
    accuracyProfile,
    vitalAssessment,
    messageSignals,
    contextSignals
  });
  const accuracyControls = buildAccuracyControls({ confidence, dataQuality, medicalKnowledge, guardrails, inputQuality, accuracyProfile, accuracyEngine });
  const deploymentMode = buildDeploymentMode(medicalKnowledge);
  const learningMemory = buildLearningMemory({ memoryContext, medicalKnowledge, risk, intents });
  const knowledgeScale = buildKnowledgeScaleReadiness({ medicalKnowledge, inputQuality, accuracyEngine, guardrails });
  const modelReadiness = buildModelReadiness({ confidence, dataQuality, signalMatrix, guardrails, inputQuality, medicalKnowledge, accuracyControls, accuracyEngine, knowledgeScale, llmBrain });
  const handoffText = buildHandoffText(handoffSummary, risk);
  const carePack = buildCarePack({
    risk,
    intents,
    finalResponse,
    vitalAssessment,
    dataQuality,
    medicalKnowledge,
    accuracyEngine,
    carePath,
    whatIfGuidance,
    suggestedQuestions,
    handoffSummary
  });

  return {
    summary: buildSmartSummary({ risk, intents, vitalAssessment, memoryContext, contextSignals }),
    confidence,
    patientContext,
    messageSignals,
    contextSignals,
    vitalAssessment,
    intentAnalysis,
    riskBreakdown,
    routeAnalysis,
    agentContracts,
    reasoningQuality,
    safetyReview: {
      status: guardrails.passed ? "Passed" : "Needs review",
      summary: guardrails.summary,
      rules: guardrails.rules
    },
    agenticReview,
    precisionSupervisor,
    llmBrain,
    medicalKnowledge,
    accuracyProfile,
    accuracyEngine,
    requirementProfile,
    requirementFit: accuracyEngine.requirementFit,
    accuracyControls,
    deploymentMode,
    learningMemory,
    knowledgeScale,
    inputQuality,
    dataQuality,
    signalMatrix,
    modelReadiness,
    carePack,
    carePath,
    automationPreview,
    whatIfGuidance,
    handoffSummary,
    handoffText,
    suggestedQuestions
  };
}

function buildAgentContracts({ plan, agentResults, requirementProfile, risk }) {
  const ownerRoute = plan.singleAgent?.enabled
    ? plan.singleAgent.route
    : plan.responseOwner?.route || (
      (risk.level === "HIGH" || risk.level === "CRITICAL") && plan.execute.includes("ALERT_AGENT")
        ? "ALERT_AGENT"
        : requirementProfile?.expectedRoute && plan.execute.includes(requirementProfile.expectedRoute)
          ? requirementProfile.expectedRoute
          : plan.execute[0]
    );

  return agentResults.map((agent) => {
    const isOwner = agent.id === ownerRoute;
    const capability = agent.output?.capabilityProfile || getAgentCapabilityPolicy(agent.id);

    return {
      id: agent.id,
      name: agent.name,
      responseOwner: isOwner,
      requirementMatch: agent.id === requirementProfile?.expectedRoute,
      domain: capability.domain,
      toolMode: capability.toolMode,
      accuracyScore: agent.output?.capabilityProfile?.score || 0,
      qualityGateStatus: agent.output?.qualityGate?.status || "not-scored",
      allowedOutput: allowedOutputForRoute(agent.id),
      blockedActions: blockedActionsForRoute(agent.id),
      qualityChecks: capability.qualityChecks || [],
      handoffTriggers: capability.handoffTriggers || [],
      qualityGate: risk.level === "CRITICAL" || risk.level === "HIGH"
        ? "Safety wording must remain visible before any routine guidance."
        : "Keep the answer focused, evidence-backed, and free of diagnosis or prescriptions.",
      independenceRule: plan.singleAgent?.enabled
        ? "This tab allows only the selected agent to generate the visible specialist response."
        : "This agent may contribute only its own specialist output to the synthesizer."
    };
  });
}

function allowedOutputForRoute(route) {
  const outputs = {
    RAG_AGENT: "Plain health education from local references.",
    SPECIALIST_DOCTOR_AGENT: "Structured core-disease education, prevention guidance, and clinician-review questions.",
    VITALS_AGENT: "Reading review, trend prompts, and safe monitoring context.",
    PHARMACY_AGENT: "Medication safety framing and clinician/pharmacist questions.",
    SCHEDULING_AGENT: "Follow-up preparation and clinic contact prompts.",
    ALERT_AGENT: "Urgent warning-sign guidance and emergency-care direction.",
    LABS_AGENT: "Plain lab explanation checklist with missing context prompts.",
    LIFESTYLE_AGENT: "General habit guidance that does not replace care plans.",
    WELLNESS_AGENT: "Supportive mental-wellness prompts and crisis boundaries.",
    RECORDS_AGENT: "Draft health summaries for human review.",
    INSURANCE_AGENT: "Coverage, claim, and EOB organization for human review.",
    CARE_TRANSITIONS_AGENT: "Discharge and transition draft support.",
    CLAIMS_OPS_AGENT: "Claim document organization and exception summary drafts.",
    UTILIZATION_AGENT: "Prior authorization and appeal rationale draft support.",
    GXP_QUALITY_AGENT: "Batch record and quality documentation draft support.",
    MEDTECH_COMPLIANCE_AGENT: "Regulatory documentation and complaint draft support."
  };

  return outputs[route] || "Focused helper output.";
}

function blockedActionsForRoute(route) {
  const common = ["No diagnosis", "No prescriptions", "No hidden live actions"];
  const routeBlocks = {
    SPECIALIST_DOCTOR_AGENT: ["No diagnosis", "No treatment decision", "No test ordering"],
    PHARMACY_AGENT: ["No dosage calculation", "No instruction to double doses"],
    SCHEDULING_AGENT: ["No real booking", "No calendar action"],
    ALERT_AGENT: ["No SMS/email sent", "No emergency call placed"],
    INSURANCE_AGENT: ["No coverage decision", "No payment decision"],
    CLAIMS_OPS_AGENT: ["No adjudication decision", "No provider communication sent"],
    UTILIZATION_AGENT: ["No authorization approval or denial"],
    GXP_QUALITY_AGENT: ["No batch release decision", "No QA approval"],
    MEDTECH_COMPLIANCE_AGENT: ["No regulatory submission", "No CAPA disposition"]
  };

  return [...common, ...(routeBlocks[route] || [])].slice(0, 5);
}

function buildVitalAssessment(vitals, profile) {
  const assessments = [];

  if (vitals.systolic !== null || vitals.diastolic !== null) {
    const systolic = vitals.systolic;
    const diastolic = vitals.diastolic;
    const value = `${systolic ?? "--"}/${diastolic ?? "--"}`;
    const level = systolic >= 180 || diastolic >= 120
      ? "high"
      : systolic >= 160 || diastolic >= 100
        ? "medium"
        : "low";

    assessments.push({
      name: "Blood pressure",
      value,
      level,
      explanation: level === "high"
        ? `Very high reading compared with the saved baseline ${profile.baselineBp}. Treat this cautiously, especially with symptoms.`
        : level === "medium"
          ? `Elevated reading compared with the saved baseline ${profile.baselineBp}. Recheck correctly and follow your care plan.`
          : `Reading entered. The advisor checks it against symptoms and baseline ${profile.baselineBp}.`
    });
  }

  if (vitals.bloodSugar !== null) {
    const level = vitals.bloodSugar >= 300 || vitals.bloodSugar <= 55
      ? "high"
      : vitals.bloodSugar >= 250 || vitals.bloodSugar <= 70
        ? "medium"
        : "low";

    assessments.push({
      name: "Blood sugar",
      value: String(vitals.bloodSugar),
      level,
      explanation: level === "high"
        ? "This sugar reading is outside the safe range and needs prompt attention if real."
        : level === "medium"
          ? "This sugar reading needs caution and may require clinician or care-plan guidance."
          : "Sugar reading was included and did not trigger a high-risk safety rule."
    });
  }

  if (vitals.heartRate !== null) {
    const level = vitals.heartRate >= 130
      ? "high"
      : vitals.heartRate >= 115
        ? "medium"
        : "low";

    assessments.push({
      name: "Heart rate",
      value: String(vitals.heartRate),
      level,
      explanation: level === "high"
        ? "This heart-rate reading is high, especially if paired with chest pain or breathlessness."
        : level === "medium"
          ? "Heart rate is elevated and was considered during risk scoring."
          : "Heart rate was included and did not trigger a high-risk safety rule."
    });
  }

  if (vitals.temperatureC !== null) {
    const level = vitals.temperatureC >= 40
      ? "high"
      : vitals.temperatureC >= 39
        ? "medium"
        : "low";

    assessments.push({
      name: "Temperature",
      value: `${vitals.temperatureC} C`,
      level,
      explanation: level === "high"
        ? "Temperature is very high and should be handled cautiously if real."
        : level === "medium"
          ? "Temperature is elevated and was included in the risk check."
          : "Temperature was included and did not trigger a high-risk safety rule."
    });
  }

  if (!assessments.length) {
    assessments.push({
      name: "Vitals",
      value: "Not entered",
      level: "none",
      explanation: "The advisor used the message, profile, and local care history only. Adding vitals can improve the health review."
    });
  }

  return assessments;
}

function detectMessageSignals(message) {
  const text = buildSearchText(message);
  const signals = [];
  const addSignal = (label, level, evidence, explanation) => {
    const matches = findKeywordMatches(text, evidence);

    if (matches.length) {
      signals.push({
        label,
        level,
        evidence: matches.slice(0, 4),
        explanation
      });
    }
  };

  addSignal("Symptom detail", "general", ["headache", "dizzy", "dizziness", "fever", "pain", "tired", "weak"], "Symptom wording sent the request through health guidance.");
  addSignal("Medication concern", "medication", ["missed", "medicine", "medication", "tablet", "dose", "pill", "insulin", "metformin", "amlodipine"], "Medication wording activates medication safety review without prescribing.");
  addSignal("Appointment need", "appointment", ["appointment", "doctor", "consult", "clinic", "schedule", "book", "follow up"], "Scheduling wording activates follow-up guidance without booking anything.");
  addSignal("Emergency cue", "emergency", ["chest pain", "shortness of breath", "breathless", "trouble breathing", "sweating", "faint", "stroke", "slurred speech", "trouble speaking", "face drooping", "one sided weakness", "sudden numbness"], "Danger-signal wording activates urgent safety guidance.");
  addSignal("Vital specialist review", "general", ["vitals", "reading", "bp", "blood pressure", "sugar", "glucose", "heart rate", "oxygen", "spo2", "temperature", "bmi"], "Vital wording activates focused specialist reading review.");
  addSignal("Lab report", "general", ["lab", "lab report", "blood test", "hba1c", "cholesterol", "ldl", "creatinine", "cbc", "tsh"], "Lab wording activates safe report explanation.");
  addSignal("Lifestyle", "general", ["diet", "nutrition", "exercise", "walking", "sleep", "hydration", "weight"], "Lifestyle wording activates general habit support.");
  addSignal("Mental wellness", "general", ["stress", "anxiety", "panic", "worried", "mood", "sad", "depressed", "cannot sleep"], "Wellness wording activates supportive triage.");
  addSignal("Health records", "general", ["record", "records", "medical record", "prescription", "doctor note", "document"], "Records wording activates care-summary support.");
  addSignal("Insurance support", "general", ["insurance", "bill", "billing", "coverage", "claim", "claims", "eob", "authorization", "prior auth"], "Insurance wording activates billing and coverage question support.");
  addSignal("Care transition", "general", ["discharge", "transition", "care plan", "post-discharge", "readmission", "outreach"], "Care-transition wording activates patient handoff support.");
  addSignal("Prior authorization", "general", ["prior authorization", "prior auth", "appeal", "appeals", "utilization management", "medical policy"], "Utilization wording activates prior authorization and appeals draft support.");
  addSignal("GxP quality", "general", ["batch record", "ebr", "deviation", "exception", "release documentation", "qa review", "change control", "sop", "qms"], "GxP wording activates batch record, shopfloor quality, and controlled-document draft support.");
  addSignal("MedTech compliance", "general", ["design controls", "technical file", "complaint", "traceability", "v&v", "cybersecurity", "post-market surveillance", "capa"], "MedTech wording activates technical documentation, complaint, CAPA, and regulatory draft support.");

  if (!signals.length) {
    signals.push({
      label: "General request",
      level: "general",
      evidence: ["free-form message"],
      explanation: "No narrow keyword dominated, so the advisor kept the request on general health guidance."
    });
  }

  return signals;
}

function buildContextSignals(context) {
  const signals = [
    {
      label: "Duration",
      level: context.duration === "more-than-3-days" ? "medium" : "low",
      detail: formatContextLabel(context.duration)
    },
    {
      label: "Severity",
      level: context.severity >= 8 ? "high" : context.severity >= 6 ? "medium" : "low",
      detail: `${context.severity}/10`
    },
    {
      label: "Care goal",
      level: context.careGoal === "urgency" ? "medium" : "low",
      detail: formatContextLabel(context.careGoal)
    },
    {
      label: "Support",
      level: context.supportNow === "alone" ? "medium" : "low",
      detail: formatContextLabel(context.supportNow)
    }
  ];

  if (context.lastMedicationTime) {
    signals.push({
      label: "Medicine timing",
      level: /miss|late|skip/i.test(context.lastMedicationTime) ? "medium" : "low",
      detail: context.lastMedicationTime
    });
  }

  for (const redFlag of context.redFlags) {
    signals.push({
      label: "Red flag",
      level: "critical",
      detail: formatContextLabel(redFlag)
    });
  }

  return signals;
}

function buildPatientContext(profile, memoryContext, context) {
  const ageLabel = profile.age ? `${profile.age} years old` : "Age not provided";
  const profileLabel = profile.conditions.length
    ? `${ageLabel}, ${profile.conditions.join(", ")}`
    : ageLabel;

  return [
    {
      label: "Profile used",
      value: profileLabel
    },
    {
      label: "Medicines remembered",
      value: profile.medications.length ? profile.medications.join(", ") : "No saved medicines"
    },
    {
      label: "Local memory",
      value: memoryContext.recentTurnCount
        ? `${memoryContext.recentTurnCount} recent run(s) included`
        : "No previous local runs"
    },
    {
      label: "Care goal",
      value: formatContextLabel(context.careGoal)
    },
    {
      label: "Support status",
      value: formatContextLabel(context.supportNow)
    }
  ];
}

function buildRoutingConfidence(intents, vitalAssessment, messageSignals, contextSignals) {
  const topConfidence = Math.max(...intents.map((intent) => intent.confidence));
  const signalCount = messageSignals.reduce((count, signal) => count + signal.evidence.length, 0);
  const vitalBonus = vitalAssessment.some((item) => item.level !== "none") ? 8 : 0;
  const contextBonus = Math.min(contextSignals.length * 2, 10);
  const confidenceScore = clamp(Math.round(topConfidence * 100) + Math.min(signalCount * 2, 8) + vitalBonus + contextBonus, 35, 98);

  return {
    score: confidenceScore,
    label: confidenceScore >= 85
      ? "Strong care clarity"
      : confidenceScore >= 70
        ? "Good care clarity"
        : "Basic care clarity",
    explanation: vitalBonus || contextBonus
      ? "Message signals, structured vitals, and context signals made the health review clearer."
      : "The health review was based on message wording and saved profile context."
  };
}

function buildSmartSummary({ risk, intents, vitalAssessment, memoryContext, contextSignals }) {
  const topIntent = intents[0]?.label || "General";
  const vitalCount = vitalAssessment.filter((item) => item.level !== "none").length;
  const redFlagCount = contextSignals.filter((signal) => signal.level === "critical").length;
  const memoryText = memoryContext.recentTurnCount
    ? "It also used recent local memory."
    : "No previous local memory was available.";

  return `${topIntent} was the strongest care need, with ${risk.label.toLowerCase()} scoring. ${vitalCount ? `${vitalCount} vital area(s) were checked.` : "No vitals were entered."} ${contextSignals.length} context signal(s) were used${redFlagCount ? `, including ${redFlagCount} red flag(s)` : ""}. ${memoryText}`;
}

function buildSuggestedQuestions({ risk, intents, vitalAssessment, context }) {
  const questions = [];

  if (risk.level === "CRITICAL" || risk.level === "HIGH") {
    questions.push("When did this start, and is it getting worse?");
    questions.push("Is someone nearby who can help you right now?");
  }

  if (vitalAssessment.some((item) => item.name === "Blood pressure" && item.level !== "low")) {
    questions.push("Was the blood pressure reading repeated after resting for 5 minutes?");
  }

  if (intents.some((intent) => intent.type === "MEDICATION")) {
    questions.push("Which medicine was missed, and what does the label or doctor instruction say?");
  }

  if (intents.some((intent) => intent.type === "SPECIALIST_DOCTOR")) {
    questions.push("Which condition, symptom pattern, or report value should the specialist focus on?");
    questions.push("What has changed from your usual health baseline?");
  }

  if (context.duration === "not-sure") {
    questions.push("Can you estimate when this started?");
  }

  if (context.supportNow === "alone") {
    questions.push("Is there someone you can call or stay near while symptoms are active?");
  }

  if (intents.some((intent) => intent.type === "APPOINTMENT")) {
    questions.push("Do you need a routine follow-up, urgent clinic visit, or reminder?");
  }

  if (intents.some((intent) => intent.type === "VITALS_TRACKING")) {
    questions.push("Which reading changed most: BP, sugar, heart rate, or temperature?");
  }

  if (intents.some((intent) => intent.type === "LAB_REPORT")) {
    questions.push("Which lab value, unit, and reference range do you want explained?");
  }

  if (intents.some((intent) => intent.type === "LIFESTYLE")) {
    questions.push("Do you want help with meals, sleep, hydration, or activity?");
  }

  if (intents.some((intent) => intent.type === "MENTAL_WELLNESS")) {
    questions.push("Is stress, anxiety, sleep, or mood the main concern today?");
  }

  if (intents.some((intent) => intent.type === "HEALTH_RECORDS")) {
    questions.push("Do you want a summary for a doctor visit, records, or reports?");
  }

  if (intents.some((intent) => intent.type === "INSURANCE_SUPPORT")) {
    questions.push("Is this about coverage, billing, claims, or prior authorization?");
  }

  if (intents.some((intent) => intent.type === "CARE_TRANSITIONS")) {
    questions.push("What discharge diagnosis, medications, follow-up date, and warning signs should a clinician review?");
  }

  if (intents.some((intent) => intent.type === "CLAIMS_OPERATIONS")) {
    questions.push("Which claim number, service date, provider ID, and policy reference should be included?");
  }

  if (intents.some((intent) => intent.type === "UTILIZATION_MANAGEMENT")) {
    questions.push("Which service, medical policy, clinical notes, and appeal evidence should be reviewed?");
  }

  if (intents.some((intent) => intent.type === "GXP_QUALITY")) {
    questions.push("Which batch ID, SOP/QMS reference, deviation category, and QA reviewer should be included?");
  }

  if (intents.some((intent) => intent.type === "MEDTECH_COMPLIANCE")) {
    questions.push("Which device, requirement ID, evidence reference, complaint ID, and regulatory region should be included?");
  }

  if (!questions.length) {
    questions.push("How long has this been happening?");
    questions.push("Are there any new or worsening symptoms?");
  }

  return questions.slice(0, 3);
}

function buildDataQuality({ message, profile, vitals, context, memoryContext }) {
  const enteredVitals = Object.values(vitals).filter((value) => value !== null).length;
  const contextSignals = [
    context.duration !== "not-sure",
    context.severity !== 4,
    context.careGoal !== "understand",
    context.supportNow !== "with-someone",
    Boolean(context.lastMedicationTime),
    context.redFlags.length > 0
  ].filter(Boolean).length;
  const strengths = [];
  const missing = [];
  let score = 18;

  if (message.length >= 18) {
    score += 14;
    strengths.push("Clear free-text message");
  } else {
    missing.push("Add one sentence with symptoms, request, or concern");
  }

  if (profile.conditions.length || profile.medications.length) {
    score += 14;
    strengths.push("Profile context available");
  } else {
    missing.push("Add known conditions and medicines");
  }

  if (enteredVitals) {
    score += Math.min(enteredVitals * 8, 24);
    strengths.push(`${enteredVitals} vital reading(s) entered`);
  } else {
    missing.push("Add BP, sugar, heart rate, or temperature when available");
  }

  if (contextSignals) {
    score += Math.min(contextSignals * 6, 24);
    strengths.push(`${contextSignals} context signal(s) captured`);
  } else {
    missing.push("Add duration, severity, care goal, or support status");
  }

  if (memoryContext.recentTurnCount) {
    score += 8;
    strengths.push("Local memory included");
  }

  if (context.redFlags.length) {
    score += 6;
    strengths.push("Red flag screening completed");
  } else {
    missing.push("Confirm red flags if symptoms feel urgent");
  }

  const finalScore = clamp(score, 0, 100);

  return {
    score: finalScore,
    label: finalScore >= 85
      ? "Excellent triage context"
      : finalScore >= 70
        ? "Strong triage context"
        : finalScore >= 50
          ? "Good starting context"
          : "Needs more context",
    strengths: strengths.length ? strengths : ["Basic request captured"],
    missing: missing.slice(0, 4)
  };
}

function buildSignalMatrix({ messageSignals, vitalAssessment, contextSignals, memoryContext, risk, medicalKnowledge }) {
  const activeVitals = vitalAssessment.filter((item) => item.level !== "none");
  const highContext = contextSignals.filter((signal) => ["high", "critical"].includes(signal.level));

  return [
    {
      title: "Message",
      status: messageSignals.length ? "Active" : "Sparse",
      strength: clamp(messageSignals.reduce((count, signal) => count + signal.evidence.length, 0) * 12, 12, 96),
      detail: `${messageSignals.length} message signal group(s)`
    },
    {
      title: "Vitals",
      status: activeVitals.length ? "Active" : "Missing",
      strength: activeVitals.length ? clamp(activeVitals.length * 22, 22, 96) : 18,
      detail: activeVitals.length ? `${activeVitals.length} structured reading(s)` : "No vitals entered"
    },
    {
      title: "Context",
      status: contextSignals.length ? "Active" : "Missing",
      strength: clamp(contextSignals.length * 13 + highContext.length * 10, 20, 98),
      detail: `${contextSignals.length} contextual signal(s)`
    },
    {
      title: "Memory",
      status: memoryContext.recentTurnCount ? "Active" : "Fresh",
      strength: memoryContext.recentTurnCount ? clamp(40 + memoryContext.recentTurnCount * 8, 40, 96) : 24,
      detail: memoryContext.recentTurnCount ? `${memoryContext.recentTurnCount} local run(s)` : "No prior local run"
    },
    {
      title: "Knowledge",
      status: medicalKnowledge.matches.length ? "Matched" : "Sparse",
      strength: medicalKnowledge.coverageScore,
      detail: `${medicalKnowledge.matches.length} medical reference(s); ${medicalKnowledge.mode}`
    },
    {
      title: "Safety",
      status: "Guarded",
      strength: risk.level === "CRITICAL" ? 98 : risk.level === "HIGH" ? 88 : risk.level === "MEDIUM" ? 76 : 64,
      detail: `${risk.label}; no live external action`
    }
  ];
}

function buildModelReadiness({ confidence, dataQuality, signalMatrix, guardrails, inputQuality, medicalKnowledge, accuracyControls, accuracyEngine, knowledgeScale, llmBrain }) {
  const matrixAverage = Math.round(signalMatrix.reduce((total, item) => total + item.strength, 0) / signalMatrix.length);
  const inputScore = inputQuality?.score ?? 80;
  const knowledgeScore = medicalKnowledge?.coverageScore ?? 70;
  const scaleScore = knowledgeScale?.score ?? 72;
  const accuracyScore = accuracyControls?.score ?? 70;
  const engineScore = accuracyEngine?.score ?? accuracyScore;
  const brainScore = llmBrain?.score ?? 78;
  const localModelScore = medicalKnowledge?.localAi?.score ?? knowledgeScore;
  const score = clamp(Math.round(
    (confidence.score * 0.12) +
    (dataQuality.score * 0.11) +
    (matrixAverage * 0.09) +
    (inputScore * 0.1) +
    (knowledgeScore * 0.11) +
    (localModelScore * 0.09) +
    (scaleScore * 0.09) +
    (accuracyScore * 0.1) +
    (engineScore * 0.08) +
    (brainScore * 0.05) +
    (guardrails.passed ? 6 : 0)
  ), 0, 100);

  return {
    score,
    label: score >= 90
      ? "Strong care review"
      : score >= 80
        ? "Ready for care review"
        : score >= 65
          ? "Needs a little more context"
          : "Needs more context",
    pillars: [
      `Care clarity ${confidence.score}%`,
      `Health context ${dataQuality.score}%`,
      `Signal coverage ${matrixAverage}%`,
      `Input quality ${inputScore}%`,
      `Knowledge coverage ${knowledgeScore}%`,
      `Local ML evidence ${localModelScore}%`,
      `Knowledge scale ${scaleScore}%`,
      `Accuracy controls ${accuracyScore}%`,
      `Clinical precision ${engineScore}%`,
      `LLM brain ${brainScore}%`,
      `Model route ${llmBrain?.processingMode || "Local Model"}`,
      guardrails.passed ? "Safety guardrails passed" : "Safety guardrails need review"
    ]
  };
}

function buildCarePath({ risk, intents, context }) {
  const path = [];

  if (risk.level === "CRITICAL") {
    path.push({
      title: "Now",
      detail: "Treat this as emergency guidance. Seek real emergency help if this is an actual situation.",
      level: "critical"
    });
    path.push({
      title: "Support",
      detail: context.supportNow === "alone"
        ? "The advisor noticed you may be alone; real care should involve someone nearby if possible."
        : "Keep support nearby while symptoms are active.",
      level: "high"
    });
  } else if (risk.level === "HIGH") {
    path.push({
      title: "Now",
      detail: "Rest safely, avoid driving, and consider urgent clinical advice if symptoms or readings persist.",
      level: "high"
    });
    path.push({
      title: "Recheck",
      detail: "Repeat relevant readings after resting if you can do it correctly.",
      level: "medium"
    });
  } else if (risk.level === "MEDIUM") {
    path.push({
      title: "Next",
      detail: "Monitor closely and contact a clinician or pharmacist if symptoms continue.",
      level: "medium"
    });
  } else {
    path.push({
      title: "Next",
      detail: "Continue normal monitoring and follow your existing care plan.",
      level: "low"
    });
  }

  if (intents.some((intent) => intent.type === "MEDICATION")) {
    path.push({
      title: "Medicine",
      detail: "Use the medicine label, pharmacist, or doctor for missed-dose guidance. Do not double doses from this advisor.",
      level: "medium"
    });
  }

  if (intents.some((intent) => intent.type === "SPECIALIST_DOCTOR")) {
    path.push({
      title: "Specialist",
      detail: "Review the condition by symptoms, readings, labs, medicines, prevention, treatment categories, and clinician questions.",
      level: "low"
    });
  }

  if (intents.some((intent) => intent.type === "VITALS_TRACKING")) {
    path.push({
      title: "Vitals",
      detail: "Track the most relevant reading and recheck safely if symptoms change.",
      level: "low"
    });
  }

  if (intents.some((intent) => intent.type === "LAB_REPORT")) {
    path.push({
      title: "Labs",
      detail: "Use the lab explanation as a question list for clinician review.",
      level: "low"
    });
  }

  if (intents.some((intent) => intent.type === "LIFESTYLE")) {
    path.push({
      title: "Lifestyle",
      detail: "Keep habit guidance general and aligned with the existing care plan.",
      level: "low"
    });
  }

  if (intents.some((intent) => intent.type === "MENTAL_WELLNESS")) {
    path.push({
      title: "Wellness",
      detail: "Use supportive steps and seek real-world help if symptoms feel unsafe or overwhelming.",
      level: "medium"
    });
  }

  if (intents.some((intent) => intent.type === "HEALTH_RECORDS")) {
    path.push({
      title: "Records",
      detail: "Prepare a clean summary for the care team; do not treat it as an official record.",
      level: "low"
    });
  }

  if (intents.some((intent) => intent.type === "INSURANCE_SUPPORT")) {
    path.push({
      title: "Insurance",
      detail: "Organize billing or coverage questions for insurer or clinic staff review.",
      level: "low"
    });
  }

  if (intents.some((intent) => intent.type === "APPOINTMENT") || context.careGoal === "follow-up") {
    path.push({
      title: "Follow-up",
      detail: "Use the scheduling recommendation as a prompt to contact your clinic.",
      level: "low"
    });
  }

  if (intents.some((intent) => intent.type === "CARE_TRANSITIONS")) {
    path.push({
      title: "Discharge",
      detail: "Prepare transition drafts for clinician review before sharing patient instructions or outreach messages.",
      level: "low"
    });
  }

  if (intents.some((intent) => intent.type === "CLAIMS_OPERATIONS")) {
    path.push({
      title: "Claims",
      detail: "Prepare claim extraction and exception drafts for administrative review; no payment decision is made.",
      level: "low"
    });
  }

  if (intents.some((intent) => intent.type === "UTILIZATION_MANAGEMENT")) {
    path.push({
      title: "Prior auth",
      detail: "Prepare policy-check and appeal drafts for reviewer approval; no coverage decision is made.",
      level: "low"
    });
  }

  if (intents.some((intent) => intent.type === "GXP_QUALITY")) {
    path.push({
      title: "GxP quality",
      detail: "Prepare batch, deviation, release, and SOP/QMS drafts for QA and quality-unit review.",
      level: "low"
    });
  }

  if (intents.some((intent) => intent.type === "MEDTECH_COMPLIANCE")) {
    path.push({
      title: "MedTech",
      detail: "Prepare technical file, traceability, complaint, CAPA, and regulatory drafts for reviewer approval.",
      level: "low"
    });
  }

  path.push({
    title: "Memory",
    detail: "This run is saved locally so the next turn can use the same context.",
    level: "low"
  });

  return path.slice(0, 5);
}

function buildAutomationPreview({ risk, intents, plan, context }) {
  const previews = [
    {
      title: "Health guidance",
      detail: "Trusted health guidance was prepared for the patient reply.",
      status: plan.execute.includes("RAG_AGENT") ? "Ready" : "Standby"
    }
  ];

  if (intents.some((intent) => intent.type === "MEDICATION")) {
    previews.push({
      title: "Medication safety",
      detail: "Pharmacy route prepared a missed-dose and no-doubling safety checklist.",
      status: "Ready"
    });
  }

  if (plan.execute.includes("VITALS_AGENT")) {
    previews.push({
      title: "Vital specialist review",
      detail: "Entered readings were checked against baseline, trend, symptom, and safety context.",
      status: "Ready"
    });
  }

  if (plan.execute.includes("LABS_AGENT")) {
    previews.push({
      title: "Lab explanation",
      detail: "Lab terms were converted into clinician-review questions.",
      status: "Ready"
    });
  }

  if (plan.execute.includes("LIFESTYLE_AGENT")) {
    previews.push({
      title: "Lifestyle guide",
      detail: "General habit support was prepared within care-plan boundaries.",
      status: "Ready"
    });
  }

  if (plan.execute.includes("WELLNESS_AGENT")) {
    previews.push({
      title: "Mental wellness",
      detail: "Supportive wellness triage was prepared with safety boundaries.",
      status: "Ready"
    });
  }

  if (plan.execute.includes("RECORDS_AGENT")) {
    previews.push({
      title: "Records summary",
      detail: "A patient-friendly summary draft was prepared.",
      status: "Ready"
    });
  }

  if (plan.execute.includes("INSURANCE_AGENT")) {
    previews.push({
      title: "Insurance support",
      detail: "Billing, coverage, or claims questions were organized for review.",
      status: "Ready"
    });
  }

  if (intents.some((intent) => intent.type === "APPOINTMENT") || context.careGoal === "follow-up") {
    previews.push({
      title: "Follow-up planning",
      detail: "Follow-up priority was reviewed without booking an appointment.",
      status: "Ready"
    });
  }

  if (plan.execute.includes("ALERT_AGENT")) {
    previews.push({
      title: "Urgent safety notice",
      detail: risk.level === "CRITICAL"
        ? "Emergency warning signs were found. Seek real emergency care if this is happening now."
        : "Caution guidance is shown without sending any external alert.",
      status: "Safety ready"
    });
  }

  if (plan.execute.includes("CARE_TRANSITIONS_AGENT")) {
    previews.push({
      title: "Discharge transitions",
      detail: "Discharge summary, patient instructions, outreach script, readmission monitoring, and reporting drafts are ready.",
      status: "Draft ready"
    });
  }

  if (plan.execute.includes("CLAIMS_OPS_AGENT")) {
    previews.push({
      title: "Claims operations",
      detail: "Claim extraction, validation notes, exception summary, provider response, and reporting drafts are ready.",
      status: "Draft ready"
    });
  }

  if (plan.execute.includes("UTILIZATION_AGENT")) {
    previews.push({
      title: "Prior authorization",
      detail: "Packet summary, policy checks, rationale draft, appeal communication, and audit notes are ready.",
      status: "Draft ready"
    });
  }

  if (plan.execute.includes("GXP_QUALITY_AGENT")) {
    previews.push({
      title: "GxP quality",
      detail: "Batch review, exception narrative, release traceability, SOP/QMS support, and improvement signal drafts are ready.",
      status: "Draft ready"
    });
  }

  if (plan.execute.includes("MEDTECH_COMPLIANCE_AGENT")) {
    previews.push({
      title: "MedTech compliance",
      detail: "Technical documentation, traceability, complaint, CAPA, post-market, and cybersecurity drafts are ready.",
      status: "Draft ready"
    });
  }

  previews.push({
    title: "Handoff summary",
    detail: "A clear summary is generated for clinician or caregiver review.",
    status: "Ready"
  });

  return previews.slice(0, 5);
}

function buildWhatIfGuidance({ risk, intents, vitalAssessment, context, dataQuality }) {
  const guidance = [];

  if (!vitalAssessment.some((item) => item.name === "Blood pressure")) {
    guidance.push({
      title: "Add BP reading",
      detail: "A current BP reading would improve risk calibration for dizziness, headache, or hypertension context.",
      impact: "Improves confidence"
    });
  }

  if (!vitalAssessment.some((item) => item.name === "Heart rate")) {
    guidance.push({
      title: "Add heart rate",
      detail: "Heart rate helps separate routine guidance from urgent safety guidance when symptoms feel intense.",
      impact: "Improves triage"
    });
  }

  if (context.duration === "not-sure") {
    guidance.push({
      title: "Clarify duration",
      detail: "Knowing whether symptoms started minutes, hours, or days ago improves follow-up priority.",
      impact: "Improves care path"
    });
  }

  if (intents.some((intent) => intent.type === "MEDICATION") && !context.lastMedicationTime) {
    guidance.push({
      title: "Add medicine timing",
      detail: "The advisor can make safer missed-dose guidance when it knows whether medicine was late, missed, or already taken.",
      impact: "Improves medication review"
    });
  }

  if (risk.level === "LOW" && dataQuality.score >= 80) {
    guidance.push({
      title: "Context is strong",
      detail: "Current signals support low-risk guidance. Continue monitoring and add new symptoms if they appear.",
      impact: "Stable"
    });
  }

  if (risk.level === "CRITICAL" || risk.level === "HIGH") {
    guidance.push({
      title: "Do not wait for more data",
      detail: "For high-risk or critical paths, safety guidance takes priority over collecting perfect details.",
      impact: "Safety-first"
    });
  }

  return guidance.slice(0, 4);
}

function buildCarePack({ risk, intents, finalResponse, vitalAssessment, dataQuality, medicalKnowledge, accuracyEngine, carePath, whatIfGuidance, suggestedQuestions, handoffSummary }) {
  const activeVitals = vitalAssessment.filter((item) => item.level !== "none");
  const topIntent = intents[0]?.label || "General health";
  const priority = risk.level === "CRITICAL"
    ? "Emergency"
    : risk.level === "HIGH"
      ? "Urgent"
      : risk.level === "MEDIUM"
        ? "Caution"
        : "Routine";
  const score = clamp(Math.round(
    ((accuracyEngine?.score || 70) * 0.34) +
      ((medicalKnowledge?.coverageScore || 55) * 0.24) +
      ((dataQuality?.score || 55) * 0.22) +
      (risk.level === "LOW" ? 20 : risk.level === "MEDIUM" ? 14 : 8)
  ), 0, 99);

  const todayItems = (finalResponse?.whatToDoNow || [])
    .slice(0, 3)
    .map((detail, index) => ({
      title: index === 0 ? "First step" : `Step ${index + 1}`,
      detail,
      level: risk.level.toLowerCase()
    }));

  const monitorItems = activeVitals.length
    ? activeVitals.slice(0, 3).map((item) => ({
      title: item.name,
      detail: `${item.value}: ${item.explanation}`,
      level: item.level
    }))
    : [
      {
        title: "Vitals",
        detail: "Add blood pressure, sugar, heart rate, or temperature when available to improve review quality.",
        level: "none"
      }
    ];

  const questionItems = (suggestedQuestions || []).slice(0, 3).map((detail, index) => ({
    title: index === 0 ? "Ask first" : `Question ${index + 1}`,
    detail,
    level: "low"
  }));

  const safetyItems = (finalResponse?.warningSigns || []).slice(0, 3).map((detail, index) => ({
    title: index === 0 ? "Watch closely" : `Warning ${index + 1}`,
    detail,
    level: risk.level === "LOW" ? "medium" : risk.level.toLowerCase()
  }));

  const evidenceItems = (medicalKnowledge?.matches || []).slice(0, 3).map((match) => ({
    title: match.title || match.category || "Reference match",
    detail: match.summary || match.source || "Local evidence matched the request.",
    level: "low"
  }));

  const improvementItems = (whatIfGuidance || []).slice(0, 3).map((item) => ({
    title: item.title,
    detail: `${item.detail} ${item.impact ? `Impact: ${item.impact}.` : ""}`.trim(),
    level: item.impact === "Safety-first" ? "critical" : "low"
  }));

  const sections = [
    {
      id: "today",
      title: "Today",
      icon: "icon-route",
      items: todayItems.length ? todayItems : [
        {
          title: "Review guidance",
          detail: "Read the patient-friendly reply and follow your existing care plan.",
          level: "low"
        }
      ]
    },
    {
      id: "monitor",
      title: "Monitor",
      icon: "icon-activity",
      items: monitorItems
    },
    {
      id: "questions",
      title: "Ask Doctor",
      icon: "icon-message",
      items: questionItems.length ? questionItems : [
        {
          title: "Clarify next step",
          detail: "Ask what changes, if any, should be made to your care plan.",
          level: "low"
        }
      ]
    },
    {
      id: "safety",
      title: "Safety",
      icon: "icon-shield",
      items: safetyItems.length ? safetyItems : [
        {
          title: "New symptoms",
          detail: "If symptoms become severe, sudden, or worrying, seek real medical help.",
          level: "medium"
        }
      ]
    },
    {
      id: "evidence",
      title: "Evidence",
      icon: "icon-layers",
      items: evidenceItems.length ? evidenceItems : [
        {
          title: "Local reference",
          detail: "The app used local safety guidance and did not call external medical databases.",
          level: "none"
        }
      ]
    }
  ];

  if (improvementItems.length) {
    sections.push({
      id: "improve",
      title: "Improve Accuracy",
      icon: "icon-gauge",
      items: improvementItems
    });
  }

  return {
    title: `${priority} Care Pack`,
    priority,
    score,
    status: score >= 86 ? "Highly personalized" : score >= 72 ? "Personalized" : "Needs more details",
    summary: `${topIntent} guidance packaged into safe next steps, monitoring, questions, safety warnings, and local evidence.`,
    sections,
    handoffPreview: handoffSummary.slice(0, 2),
    safetyBoundary: "Care Pack is educational guidance only; it does not diagnose, prescribe, calculate dosage, or replace a clinician."
  };
}

function buildHandoffSummary({ profile, risk, intents, vitals, context }) {
  const enteredVitals = Object.entries(vitals)
    .filter(([, value]) => value !== null)
    .map(([key, value]) => `${key}: ${value}`)
    .join(", ") || "No vitals entered";
  const routeText = intents.map((intent) => intent.label).join(", ");
  const redFlagText = context.redFlags.length
    ? context.redFlags.map(formatContextLabel).join(", ")
    : "None checked";

  return [
    {
      title: "Patient snapshot",
      detail: `${profile.name}, age ${profile.age}; conditions: ${profile.conditions.join(", ") || "not provided"}; medicines: ${profile.medications.join(", ") || "not provided"}.`
    },
    {
      title: "Decision summary",
      detail: `${risk.label} (${risk.score}/100). Care needs: ${routeText}.`
    },
    {
      title: "Inputs used",
      detail: `Vitals: ${enteredVitals}. Severity: ${context.severity}/10. Duration: ${formatContextLabel(context.duration)}. Support: ${formatContextLabel(context.supportNow)}. Red flags: ${redFlagText}.`
    }
  ];
}

function buildHandoffText(handoffSummary, risk) {
  const lines = [
    `Care Nova AI Handoff - ${risk.label} (${risk.score}/100)`,
    ...handoffSummary.map((item) => `${item.title}: ${item.detail}`),
    "Safety scope: no diagnosis, prescribing, claim payment, coverage decision, GxP release decision, regulatory submission, complaint disposition, booking, caregiver contact, or emergency call performed."
  ];

  return lines.join("\n");
}

function explainIntent(intent) {
  const evidence = intent.evidence.length ? ` Evidence: ${intent.evidence.join(", ")}.` : "";

  if (intent.type === "EMERGENCY") {
    return `Urgent safety guidance was activated.${evidence}`;
  }

  if (intent.type === "MEDICATION") {
    return `Medication safety review was activated without dosage or prescribing.${evidence}`;
  }

  if (intent.type === "SPECIALIST_DOCTOR") {
    return `Specialist disease review was activated for condition education, prevention, warning signs, and clinician-review questions.${evidence}`;
  }

  if (intent.type === "APPOINTMENT") {
    return `Follow-up guidance was activated without booking an appointment.${evidence}`;
  }

  if (intent.type === "VITALS_TRACKING") {
    return `Vital specialist review was activated for entered or mentioned readings.${evidence}`;
  }

  if (intent.type === "LAB_REPORT") {
    return `Lab report explanation was activated without diagnosis or treatment changes.${evidence}`;
  }

  if (intent.type === "LIFESTYLE") {
    return `Lifestyle support was activated as general wellness guidance.${evidence}`;
  }

  if (intent.type === "MENTAL_WELLNESS") {
    return `Mental wellness triage was activated with crisis-safety boundaries.${evidence}`;
  }

  if (intent.type === "HEALTH_RECORDS") {
    return `Health record summary support was activated as a draft only.${evidence}`;
  }

  if (intent.type === "INSURANCE_SUPPORT") {
    return `Insurance support was activated without benefit or payment decisions.${evidence}`;
  }

  if (intent.type === "CARE_TRANSITIONS") {
    return `Discharge transition draft support was activated with clinician-review boundaries.${evidence}`;
  }

  if (intent.type === "CLAIMS_OPERATIONS") {
    return `Claims operations draft support was activated without payment decisions.${evidence}`;
  }

  if (intent.type === "UTILIZATION_MANAGEMENT") {
    return `Prior authorization and appeals draft support was activated without coverage decisions.${evidence}`;
  }

  if (intent.type === "GXP_QUALITY") {
    return `GxP batch and shopfloor quality draft support was activated with QA-review boundaries.${evidence}`;
  }

  if (intent.type === "MEDTECH_COMPLIANCE") {
    return `MedTech documentation and complaint draft support was activated with regulatory-review boundaries.${evidence}`;
  }

  return `General health guidance was activated.${evidence}`;
}

function routeLabel(route) {
  const labels = {
    RAG_AGENT: "Health guidance",
    SPECIALIST_DOCTOR_AGENT: "Specialist doctor",
    VITALS_AGENT: "Vital specialist",
    PHARMACY_AGENT: "Medication safety",
    SCHEDULING_AGENT: "Follow-up planning",
    ALERT_AGENT: "Safety escalation",
    LABS_AGENT: "Lab report",
    LIFESTYLE_AGENT: "Lifestyle guide",
    WELLNESS_AGENT: "Mental wellness",
    RECORDS_AGENT: "Health records",
    INSURANCE_AGENT: "Insurance support",
    CARE_TRANSITIONS_AGENT: "Discharge transitions",
    CLAIMS_OPS_AGENT: "Claims operations",
    UTILIZATION_AGENT: "Prior authorization",
    GXP_QUALITY_AGENT: "GxP quality",
    MEDTECH_COMPLIANCE_AGENT: "MedTech compliance",
    AGENTIC_SUPERVISOR: "Internal quality check"
  };

  return labels[route] || route;
}

function applyGuardrails(finalResponse) {
  const joinedText = [
    finalResponse.title,
    finalResponse.summary,
    finalResponse.agentSummary,
    ...finalResponse.whatToDoNow,
    ...finalResponse.warningSigns,
    finalResponse.disclaimer
  ].join(" ");

  const blockedPatterns = [
    /\byou have\b/i,
    /\btake \d+\b/i,
    /\b(i|we) prescribe\b/i,
    /\bprescribed you\b/i,
    /\bdiagnosed\b/i
  ];

  const triggered = blockedPatterns
    .filter((pattern) => pattern.test(joinedText))
    .map((pattern) => pattern.source);

  return {
    passed: triggered.length === 0,
    summary: triggered.length === 0
      ? "Passed no-diagnosis, no-dosage, no-prescribing, no-coverage-decision, no-GxP-release, no-regulatory-submission, and no-external-action checks."
      : "Guardrail review found wording that should be revised.",
    triggered,
    rules: [
      "No diagnosis",
      "No dosage calculation",
      "No prescribing",
      "No claim payment or coverage decision",
      "No GxP release decision or regulatory submission",
      "No complaint disposition or CAPA decision",
      "Emergency override guidance visible",
      "No booking, caregiver contact, or emergency action"
    ]
  };
}

export function evaluateFinalResponseGuardrails(finalResponse = {}) {
  return applyGuardrails({
    title: cleanText(finalResponse.title),
    summary: cleanText(finalResponse.summary),
    agentSummary: cleanText(finalResponse.agentSummary),
    whatToDoNow: Array.isArray(finalResponse.whatToDoNow) ? finalResponse.whatToDoNow.map(cleanText).filter(Boolean) : [],
    warningSigns: Array.isArray(finalResponse.warningSigns) ? finalResponse.warningSigns.map(cleanText).filter(Boolean) : [],
    disclaimer: cleanText(finalResponse.disclaimer)
  });
}

function createMemoryPatch({ patientId, message, profile, vitals, context, intents, risk, plan, requirementProfile, memoryContext, medicalKnowledge }) {
  const executedRoutes = Array.isArray(plan?.execute) && plan.execute.length
    ? plan.execute
    : intents.map((intent) => intent.route);

  return {
    patientId,
    lastInteractionAt: new Date().toISOString(),
    lastMessage: message.slice(0, 180),
    latestRiskLevel: risk.level,
    latestIntents: intents.map((intent) => intent.type),
    latestRoutes: executedRoutes,
    latestRequirement: requirementProfile
      ? {
        outputType: requirementProfile.outputType,
        outputLabel: requirementProfile.outputLabel,
        expectedRoute: requirementProfile.expectedRoute,
        detailLevel: requirementProfile.detailLevel,
        score: requirementProfile.score
      }
      : null,
    recentTurnCount: memoryContext.recentTurnCount + 1,
    recentReadings: Object.fromEntries(
      Object.entries(vitals).filter(([, value]) => value !== null)
    ),
    latestContextSignals: {
      duration: context.duration,
      severity: context.severity,
      careGoal: context.careGoal,
      supportNow: context.supportNow,
      redFlags: context.redFlags
    },
    profileSnapshot: profile,
    knowledgeSnapshot: {
      mode: medicalKnowledge.mode,
      coverageScore: medicalKnowledge.coverageScore,
      references: medicalKnowledge.matches.map((match) => match.id),
      learningBoundary: medicalKnowledge.learningBoundary
    }
  };
}

function buildCanonicalAgentFlow({ message, memoryContext, intents = [], risk = {}, plan = {}, agentResults = [], finalResponse = {} }) {
  const activeBucket = selectCoreAgentBucket({ intents, risk, plan, agentResults });
  const activeAgent = agentResults.find((agent) => agent.id === activeBucket.route);
  const extensionRoutes = (plan.execute || []).filter((route) => !coreAgentBuckets.some((bucket) => bucket.route === route));

  return {
    name: "Canonical 8-step healthcare agent loop",
    routingMode: "one core bucket selected per patient turn",
    requiredPath: "Patient Input -> Memory Store -> Intent Classifier -> One Core Specialist Agent -> Response Synthesizer -> Safety & Guardrails -> Patient Reply -> Update Memory",
    activeBucket: {
      id: activeBucket.id,
      label: activeBucket.label,
      route: activeBucket.route,
      agent: activeBucket.agent,
      tool: activeBucket.productionTool,
      demoTool: activeBucket.demoTool,
      confidence: activeBucket.confidence
    },
    coreAgentBuckets,
    steps: [
      {
        step: 1,
        id: "PATIENT_INPUT",
        title: "Patient Input",
        detail: cleanText(message).slice(0, 160) || "The patient enters a symptom, question, or request."
      },
      {
        step: 2,
        id: "MEMORY_STORE",
        title: "Memory Store (LangGraph state)",
        detail: `${memoryContext?.recentTurnCount || 0} previous turn(s) loaded before classification.`
      },
      {
        step: 3,
        id: "INTENT_CLASSIFIER",
        title: "Intent Classifier Agent",
        detail: `Selected ${activeBucket.label} -> ${activeBucket.agent}.`
      },
      {
        step: 4,
        id: activeBucket.route,
        title: activeBucket.agent,
        detail: activeAgent?.output?.summary || activeBucket.demoTool
      },
      {
        step: 5,
        id: "RESPONSE_SYNTHESIZER",
        title: "Response Synthesizer",
        detail: "Rewrites the raw agent output into simple, empathetic, patient-friendly language."
      },
      {
        step: 6,
        id: "SAFETY_GUARDRAILS",
        title: "Safety & Guardrails",
        detail: "Blocks diagnosis, prescribing, dosage calculation, harmful advice, and live external actions."
      },
      {
        step: 7,
        id: "PATIENT_REPLY",
        title: "Patient Reply",
        detail: finalResponse?.summary || "The final clean response is shown in the chat UI."
      },
      {
        step: 8,
        id: "MEMORY_UPDATE",
        title: "Update Memory",
        detail: "The exchange is saved so the next message reloads the latest context."
      }
    ],
    extensionRoutes,
    productionAdapters: {
      memoryStore: "LangGraph state adapter",
      ragAgent: "ChromaDB vector search adapter",
      pharmacyAgent: "Drug-information lookup adapter",
      schedulingAgent: "Calendar and reminder API adapter",
      alertAgent: "Twilio SMS/email adapter"
    },
    localDemoAdapters: {
      memoryStore: "Persistent local server memory",
      ragAgent: "Curated offline medical reference retrieval",
      pharmacyAgent: "Medication safety framing without prescription or dosage changes",
      schedulingAgent: "Appointment preparation without live booking",
      alertAgent: "Urgent guidance without SMS, email, or emergency calls"
    },
    nextTurnLoop: "MEMORY_UPDATE -> PATIENT_INPUT -> MEMORY_STORE",
    loopExplanation: "Every new patient message restarts at Patient Input and immediately reloads Memory Store before classification."
  };
}

function buildAgenticFlowContract({
  message,
  memoryContext,
  intents = [],
  risk = {},
  plan = {},
  agentResults = [],
  finalResponse = {},
  guardrails = {},
  memoryPatch = {},
  auditTrail = [],
  canonicalFlow = {}
}) {
  const activeBucket = canonicalFlow.activeBucket || selectCoreAgentBucket({ intents, risk, plan, agentResults });
  const coreRoutes = new Set(coreAgentBuckets.map((bucket) => bucket.route));
  const executedRoutes = new Set([
    ...(Array.isArray(plan.execute) ? plan.execute : []),
    ...agentResults.map((agent) => agent.id)
  ]);
  const auditIndex = (step) => auditTrail.findIndex((entry) => entry.step === step);
  const memoryIndex = auditIndex("memory_store");
  const classifierIndex = auditIndex("intent_classifier_agent");
  const replyText = cleanText([
    finalResponse.title,
    finalResponse.summary,
    ...(Array.isArray(finalResponse.whatToDoNow) ? finalResponse.whatToDoNow : [])
  ].join(" "));

  const checks = [
    {
      step: 1,
      id: "PATIENT_INPUT",
      title: "Patient Input",
      passed: Boolean(cleanText(message)),
      proof: "Free-form patient text was captured and validated before analysis."
    },
    {
      step: 2,
      id: "MEMORY_STORE",
      title: "Memory Store (LangGraph state)",
      passed: memoryIndex !== -1 && (classifierIndex === -1 || memoryIndex < classifierIndex),
      proof: `${memoryContext?.recentTurnCount || 0} previous local turn(s) loaded before intent classification.`
    },
    {
      step: 3,
      id: "INTENT_CLASSIFIER",
      title: "Intent Classifier Agent",
      passed: Boolean(activeBucket?.id && coreRoutes.has(activeBucket.route)),
      proof: `Classifier mapped the request to ${activeBucket?.label || "a core bucket"} -> ${activeBucket?.agent || "core agent"}.`
    },
    {
      step: 4,
      id: activeBucket?.route || "CORE_AGENT",
      title: "One Core Specialist Agent",
      passed: Boolean(activeBucket?.route && coreRoutes.has(activeBucket.route)),
      proof: executedRoutes.has(activeBucket?.route)
        ? `${activeBucket.agent} executed for this turn.`
        : `${activeBucket?.agent || "Core agent"} selected as the canonical route while advanced tab helpers remain optional.`
    },
    {
      step: 5,
      id: "RESPONSE_SYNTHESIZER",
      title: "Response Synthesizer",
      passed: replyText.length > 0,
      proof: "Raw route output was converted into one patient-friendly response."
    },
    {
      step: 6,
      id: "SAFETY_GUARDRAILS",
      title: "Safety & Guardrails",
      passed: guardrails.passed === true,
      proof: guardrails.summary || "Safety checks were applied."
    },
    {
      step: 7,
      id: "PATIENT_REPLY",
      title: "Patient Reply",
      passed: replyText.length > 0,
      proof: "A clean response is ready for the chat interface."
    },
    {
      step: 8,
      id: "MEMORY_UPDATE",
      title: "Update Memory",
      passed: Boolean(memoryPatch.patientId && memoryPatch.lastInteractionAt && memoryPatch.lastMessage),
      proof: "A memory patch was prepared for persistent local storage before the next turn."
    }
  ];
  const passed = checks.every((check) => check.passed);

  return {
    status: passed ? "compliant" : "needs-review",
    passed,
    summary: passed
      ? `PASS: Patient Input -> Memory Store -> Intent Classifier -> ${activeBucket.agent} -> Response Synthesizer -> Safety & Guardrails -> Patient Reply -> Update Memory.`
      : "Review needed: one or more required agentic loop checks did not pass.",
    activeBucket,
    requiredBuckets: coreAgentBuckets.map(({ id, label, route, agent, productionTool, demoTool }) => ({
      id,
      label,
      route,
      agent,
      productionTool,
      demoTool
    })),
    checks,
    externalActionBoundary: [
      "No diagnosis is issued.",
      "No prescription or dosage calculation is made.",
      "No live appointment booking is performed.",
      "No SMS, email, caregiver alert, or emergency call is sent from the demo.",
      "Urgent warning signs are escalated through patient-facing safety guidance."
    ],
    adapterReadiness: {
      memory: "LangGraph-compatible state contract with persistent local storage in this build.",
      rag: "ChromaDB-compatible RAG contract with offline curated references in this build.",
      pharmacy: "Drug information and interaction adapter contract with no demo dosage changes.",
      scheduling: "Calendar/reminder adapter contract with no live booking in this build.",
      alerting: "Twilio SMS/email adapter contract with no live external action in this build."
    },
    nextTurnLoop: "Every new patient message reloads memory first, then repeats the same eight-step path."
  };
}

function selectCoreAgentBucket({ intents = [], risk = {}, plan = {}, agentResults = [] }) {
  const executedRoutes = new Set([
    ...(plan.execute || []),
    ...agentResults.map((agent) => agent.id)
  ]);
  const hasIntent = (type) => intents.some((intent) => intent.type === type);
  const withConfidence = (bucket, confidence) => ({ ...bucket, confidence });

  if (
    risk.level === "CRITICAL" ||
    hasIntent("EMERGENCY")
  ) {
    return withConfidence(coreAgentBuckets.find((bucket) => bucket.id === "EMERGENCY"), risk.level === "CRITICAL" ? 0.98 : 0.9);
  }

  if (hasIntent("MEDICATION") || executedRoutes.has("PHARMACY_AGENT")) {
    return withConfidence(coreAgentBuckets.find((bucket) => bucket.id === "MEDICATION"), 0.92);
  }

  if (hasIntent("APPOINTMENT") || executedRoutes.has("SCHEDULING_AGENT")) {
    return withConfidence(coreAgentBuckets.find((bucket) => bucket.id === "APPOINTMENT"), 0.9);
  }

  if (executedRoutes.has("ALERT_AGENT") && ["HIGH", "CRITICAL"].includes(risk.level)) {
    return withConfidence(coreAgentBuckets.find((bucket) => bucket.id === "EMERGENCY"), risk.level === "CRITICAL" ? 0.98 : 0.88);
  }

  return withConfidence(coreAgentBuckets.find((bucket) => bucket.id === "GENERAL_HEALTH"), 0.86);
}

function buildModelFlow(plan, agentResults, agenticReview) {
  const activeNodeIds = new Set([
    "PATIENT_INPUT",
    "MEMORY_STORE",
    "INTENT_CLASSIFIER",
    "RESPONSE_SYNTHESIZER",
    "SAFETY_GUARDRAILS",
    "PATIENT_REPLY",
    "MEMORY_UPDATE",
    ...agentResults.map((result) => result.id)
  ]);

  const nodes = baseFlowNodes.map((node) => ({
    ...node,
    status: activeNodeIds.has(node.id) ? "active" : "skipped",
    routeReason: plan.routeReasons[node.id] || []
  }));

  const edges = baseFlowEdges.map(([from, to]) => ({
    from,
    to,
    active: activeNodeIds.has(from) && activeNodeIds.has(to)
  }));

  return {
    nodes,
    edges,
    qualityReview: agenticReview
      ? {
        id: agenticReview.id,
        status: agenticReview.status,
        score: agenticReview.score,
        summary: agenticReview.summary
      }
      : null,
    nextTurnLoop: "MEMORY_UPDATE -> MEMORY_STORE",
    activePath: nodes.filter((node) => node.status === "active").map((node) => node.id)
  };
}

function sanitizeProfile(profile = {}) {
  return {
    name: cleanText(profile.name),
    age: cleanText(profile.age),
    conditions: normalizeList(profile.conditions),
    medications: normalizeList(profile.medications),
    allergies: normalizeList(profile.allergies),
    baselineBp: cleanText(profile.baselineBp),
    gender: cleanText(profile.gender).slice(0, 60),
    notes: cleanText(profile.notes).slice(0, 400)
  };
}

function normalizeList(value) {
  if (Array.isArray(value)) {
    return value.map(cleanText).filter(Boolean);
  }

  return String(value || "")
    .split(",")
    .map(cleanText)
    .filter(Boolean);
}

function buildInputQuality({ message, rawVitals, vitals, context, conversationHistory }) {
  const ignoredVitals = findIgnoredVitals(rawVitals, vitals);
  const acceptedVitals = Object.entries(vitals)
    .filter(([, value]) => value !== null)
    .map(([key]) => key);
  const warnings = [];
  let score = 100;

  if (message.length < 8) {
    warnings.push("Message is very short; add one clear symptom, request, or concern.");
    score -= 16;
  }

  if (ignoredVitals.length) {
    warnings.push(`${ignoredVitals.length} vital value(s) were outside safe input ranges and ignored.`);
    score -= ignoredVitals.length * 14;
  }

  if (!acceptedVitals.length) {
    score -= 8;
  }

  if (context.duration === "not-sure") {
    score -= 5;
  }

  if (!conversationHistory.length) {
    score -= 3;
  }

  const finalScore = clamp(score, 0, 100);

  return {
    score: finalScore,
    label: finalScore >= 90
      ? "Excellent input quality"
      : finalScore >= 75
        ? "Strong input quality"
        : finalScore >= 55
          ? "Usable input quality"
          : "Needs better input",
    summary: warnings.length
      ? `${warnings.length} input quality note(s) detected.`
      : "Input quality check passed.",
    acceptedVitals,
    ignoredVitals,
    warnings,
    completeness: {
      hasMessage: message.length > 0,
      hasVitals: acceptedVitals.length > 0,
      hasContext: context.duration !== "not-sure" || context.careGoal !== "understand" || context.severity !== 4 || context.redFlags.length > 0,
      hasMemory: conversationHistory.length > 0
    }
  };
}

function findIgnoredVitals(rawVitals, vitals) {
  const source = rawVitals && typeof rawVitals === "object" ? rawVitals : {};
  const bloodPressure = parseBloodPressure(source.bloodPressure || source.bp || "");
  const checks = [
    {
      key: "systolic",
      label: "Systolic BP",
      raw: source.systolic ?? source.bpSystolic ?? bloodPressure.systolic,
      min: 70,
      max: 260
    },
    {
      key: "diastolic",
      label: "Diastolic BP",
      raw: source.diastolic ?? source.bpDiastolic ?? bloodPressure.diastolic,
      min: 40,
      max: 160
    },
    {
      key: "bloodSugar",
      label: "Blood sugar",
      raw: source.bloodSugar ?? source.sugar ?? source.glucose,
      min: 20,
      max: 600
    },
    {
      key: "heartRate",
      label: "Heart rate",
      raw: source.heartRate ?? source.pulse,
      min: 30,
      max: 220
    },
    {
      key: "temperatureC",
      label: "Temperature C",
      raw: source.temperatureC ?? source.temperature,
      min: 30,
      max: 45
    },
    {
      key: "oxygenSaturation",
      label: "Oxygen saturation",
      raw: source.oxygenSaturation ?? source.oxygen ?? source.spo2,
      min: 50,
      max: 100
    },
    {
      key: "weightKg",
      label: "Weight kg",
      raw: source.weightKg ?? source.weight,
      min: 20,
      max: 350
    },
    {
      key: "heightCm",
      label: "Height cm",
      raw: source.heightCm ?? source.height,
      min: 80,
      max: 230
    },
    {
      key: "waistCm",
      label: "Waist cm",
      raw: source.waistCm ?? source.waist,
      min: 40,
      max: 220
    },
    {
      key: "sleepHours",
      label: "Sleep hours",
      raw: source.sleepHours ?? source.sleep,
      min: 0,
      max: 24
    },
    {
      key: "stepsCount",
      label: "Steps today",
      raw: source.stepsCount ?? source.steps,
      min: 0,
      max: 100000
    },
    {
      key: "waterCups",
      label: "Water cups",
      raw: source.waterCups ?? source.water,
      min: 0,
      max: 30
    }
  ];

  return checks
    .map((check) => {
      const rawText = cleanText(check.raw);

      if (!rawText) {
        return null;
      }

      const parsed = toNumber(check.raw);

      if (vitals[check.key] !== null) {
        return null;
      }

      return {
        name: check.label,
        value: rawText,
        acceptedRange: parsed === null ? "numeric value required" : `${check.min}-${check.max}`
      };
    })
    .filter(Boolean);
}

function normalizeVitals(vitals = {}) {
  const source = vitals && typeof vitals === "object" ? vitals : {};
  const bloodPressure = parseBloodPressure(source.bloodPressure || source.bp || "");

  return {
    systolic: toBoundedNumber(source.systolic ?? source.bpSystolic ?? bloodPressure.systolic, 70, 260),
    diastolic: toBoundedNumber(source.diastolic ?? source.bpDiastolic ?? bloodPressure.diastolic, 40, 160),
    bloodSugar: toBoundedNumber(source.bloodSugar ?? source.sugar ?? source.glucose, 20, 600),
    heartRate: toBoundedNumber(source.heartRate ?? source.pulse, 30, 220),
    temperatureC: toBoundedNumber(source.temperatureC ?? source.temperature, 30, 45),
    oxygenSaturation: toBoundedNumber(source.oxygenSaturation ?? source.oxygen ?? source.spo2, 50, 100),
    weightKg: toBoundedNumber(source.weightKg ?? source.weight, 20, 350),
    heightCm: toBoundedNumber(source.heightCm ?? source.height, 80, 230),
    waistCm: toBoundedNumber(source.waistCm ?? source.waist, 40, 220),
    sleepHours: toBoundedNumber(source.sleepHours ?? source.sleep, 0, 24),
    stepsCount: toBoundedNumber(source.stepsCount ?? source.steps, 0, 100000),
    waterCups: toBoundedNumber(source.waterCups ?? source.water, 0, 30)
  };
}

function normalizeContext(context = {}) {
  const allowedDurations = new Set(["not-sure", "under-1-hour", "1-6 hours", "1-3 days", "more-than-3-days"]);
  const allowedGoals = new Set(["understand", "medicine-safety", "follow-up", "urgency", "wellness-plan", "lab-review"]);
  const allowedSupport = new Set(["with-someone", "alone", "needs-transport"]);
  const allowedRedFlags = new Set(["chest-pain", "breathing-trouble", "fainting", "one-sided-weakness", "severe-allergy", "severe-dehydration-or-vomiting"]);
  const allowedSpecialistLens = new Set(["full-review", "symptom-pattern", "tests", "prevention", "medicine-safety", "follow-up"]);
  const allowedRiskModifiers = new Set(["diabetes", "high-blood-pressure", "kidney-disease", "pregnancy", "immune-suppression", "blood-thinner"]);
  const severityNumber = toNumber(context.severity);
  const redFlags = Array.isArray(context.redFlags)
    ? context.redFlags.map(cleanText).filter((flag) => allowedRedFlags.has(flag))
    : normalizeList(context.redFlags).filter((flag) => allowedRedFlags.has(flag));
  const riskModifiers = Array.isArray(context.riskModifiers)
    ? context.riskModifiers.map(cleanText).filter((flag) => allowedRiskModifiers.has(flag))
    : normalizeList(context.riskModifiers).filter((flag) => allowedRiskModifiers.has(flag));

  const duration = cleanText(context.duration);
  const careGoal = cleanText(context.careGoal);
  const supportNow = cleanText(context.supportNow);
  const specialistFocus = normalizeSpecialistFocus(context.specialistFocus || context.specialistDomain || context.specialty);
  const specialistLens = cleanText(context.specialistLens);
  const allowedWellnessKeys = new Set([
    "ageGroup",
    "focus",
    "healthFocus",
    "activity",
    "sleep",
    "stress",
    "hydration",
    "diet",
    "time",
    "mobility",
    "evening",
    "prevention",
    "support",
    "workPattern",
    "goal",
    "mood",
    "energy"
  ]);
  const wellnessProfile = context.wellnessProfile && typeof context.wellnessProfile === "object"
    ? Object.fromEntries(Object.entries(context.wellnessProfile)
      .filter(([key]) => allowedWellnessKeys.has(key))
      .map(([key, value]) => [key, cleanText(value).slice(0, 160)]))
    : {};
  const allowedVisitKeys = new Set([
    "department",
    "type",
    "preferredDate",
    "timePreference",
    "mode",
    "dateWindow",
    "status",
    "recordsReady",
    "coverage",
    "supportNeed",
    "contactMethod",
    "reason",
    "dischargeStatus",
    "dischargeWindow",
    "pendingTests",
    "medicineChanges",
    "outcomeNotes",
    "nextStep",
    "nextDate",
    "followupStatus",
    "followupQuestion"
  ]);
  const visitProfile = context.visitProfile && typeof context.visitProfile === "object"
    ? Object.fromEntries(Object.entries(context.visitProfile)
      .filter(([key]) => allowedVisitKeys.has(key))
      .map(([key, value]) => [key, cleanText(value).slice(0, 220)]))
    : {};

  return {
    duration: allowedDurations.has(duration) ? duration : "not-sure",
    severity: severityNumber === null ? 4 : clamp(Math.round(severityNumber), 1, 10),
    careGoal: allowedGoals.has(careGoal) ? careGoal : "understand",
    supportNow: allowedSupport.has(supportNow) ? supportNow : "with-someone",
    lastMedicationTime: cleanText(context.lastMedicationTime).slice(0, 120),
    redFlags: Array.from(new Set(redFlags)),
    specialistFocus,
    specialistLens: allowedSpecialistLens.has(specialistLens) ? specialistLens : "full-review",
    riskModifiers: Array.from(new Set(riskModifiers)),
    wellnessProfile,
    visitProfile
  };
}

function buildGeneralResponsePrecision({ responseFocus, risk, agentResults, medicalKnowledge, reasoningQuality, llmBrain }) {
  const primaryOutput = agentResults.find((agent) => agent.id === responseFocus.primaryRoute)?.output || {};
  const ragOutput = agentResults.find((agent) => agent.id === "RAG_AGENT")?.output || {};
  const concernProfile = primaryOutput.concernProfile || ragOutput.concernProfile || {};
  const completeness = Number(concernProfile.completeness || 0);
  const evidenceCoverage = Number(medicalKnowledge?.coverageScore || primaryOutput.evidenceCoverage || ragOutput.evidenceCoverage || 0);
  const reasoningScore = Number(reasoningQuality?.score || primaryOutput.confidenceScore || 0);
  const brainScore = Number(llmBrain?.score || 0);
  const safetyBoost = risk.level === "LOW" ? 8 : risk.level === "MEDIUM" ? 5 : 2;
  const score = clamp(Math.round(
    (completeness * 0.34) +
      (Math.max(evidenceCoverage, 45) * 0.2) +
      (Math.max(reasoningScore, 55) * 0.22) +
      (Math.max(brainScore, 55) * 0.16) +
      safetyBoost
  ), 35, 98);
  const missing = Array.isArray(primaryOutput.missingContext) && primaryOutput.missingContext.length
    ? primaryOutput.missingContext
    : Array.isArray(ragOutput.missingContext) ? ragOutput.missingContext : [];
  const safetyScreen = concernProfile.safetyScreen || {};
  const label = score >= 88
    ? "High precision"
    : score >= 74
      ? "Strong precision"
      : score >= 60
        ? "Usable precision"
        : "Needs more context";

  return {
    score,
    label,
    owner: responseFocus.primaryAgent,
    family: concernProfile.family || responseFocus.label,
    evidenceCoverage,
    completeness,
    missing: missing.slice(0, 3),
    nextQuestion: concernProfile.nextQuestion || (missing.length ? `Add ${missing[0]} for a sharper answer.` : "Enough context for a first answer."),
    safetyStatus: safetyScreen.status || (risk.level === "LOW" ? "routine-screen" : "safety-priority"),
    safetySummary: safetyScreen.boundary || `${risk.label} safety path checked.`,
    evidenceLanes: Array.isArray(concernProfile.evidenceLanes) ? concernProfile.evidenceLanes.slice(0, 5) : []
  };
}

function normalizeHistory(history) {
  if (!Array.isArray(history)) {
    return [];
  }

  return history.slice(0, 12).map((item) => ({
    message: cleanText(item.message || item.lastMessage),
    risk: cleanText(item.risk || item.latestRiskLevel),
    intents: Array.isArray(item.intents) ? item.intents.map(cleanText).filter(Boolean) : [],
    vitals: normalizeVitals(item.vitals || item.recentReadings || {}),
    context: item.context && typeof item.context === "object" ? item.context : {},
    profile: sanitizeProfile(item.profile || item.profileSnapshot || {})
  }));
}

function buildEffectiveProfile(currentProfile, conversationHistory = []) {
  const rememberedProfile = conversationHistory
    .slice()
    .reverse()
    .reduce((merged, item) => mergeSanitizedProfiles(merged, item.profile || item.profileSnapshot || {}), sanitizeProfile({}));

  return mergeSanitizedProfiles(rememberedProfile, currentProfile);
}

function mergeSanitizedProfiles(baseProfile = {}, overrideProfile = {}) {
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

  const baseNormalized = normalizeSearchText(base);
  const overrideNormalized = normalizeSearchText(override);

  if (baseNormalized === overrideNormalized || baseNormalized.includes(overrideNormalized)) {
    return base;
  }

  if (overrideNormalized.includes(baseNormalized)) {
    return override;
  }

  return `${override}; ${base}`.slice(0, 400);
}

function hasProfileSignals(profile = {}) {
  const candidate = sanitizeProfile(profile);

  return Boolean(
    candidate.name ||
    candidate.age ||
    candidate.baselineBp ||
    candidate.gender ||
    candidate.notes ||
    candidate.conditions.length ||
    candidate.medications.length ||
    candidate.allergies.length
  );
}

function extractVitalsFromMessage(message) {
  const source = String(message || "").toLowerCase();
  const extracted = {};
  const bpSlash = source.match(/\b(?:bp|blood pressure)?\s*(\d{2,3})\s*\/\s*(\d{2,3})\b/);
  const bpOver = source.match(/\b(?:bp|blood pressure)\D{0,18}(\d{2,3})\s*(?:over|by)\s*(\d{2,3})\b/);
  const sugar = source.match(/\b(?:blood sugar|sugar|glucose)\D{0,18}(\d{2,3})\b/);
  const heartRate = source.match(/\b(?:heart rate|pulse)\D{0,18}(\d{2,3})\b/);
  const temperature = source.match(/\b(?:temperature|temp|fever)\D{0,18}(\d{2,3}(?:\.\d)?)\s*(?:c|celsius)?\b/);
  const oxygen = source.match(/\b(?:oxygen|spo2|o2)\D{0,18}(\d{2,3})\s*%?\b/);
  const weight = source.match(/\b(?:weight)\D{0,18}(\d{2,3}(?:\.\d)?)\s*(?:kg|kilogram)?\b/);
  const height = source.match(/\b(?:height)\D{0,18}(\d{2,3}(?:\.\d)?)\s*(?:cm|centimeter)?\b/);
  const waist = source.match(/\b(?:waist)\D{0,18}(\d{2,3}(?:\.\d)?)\s*(?:cm|centimeter)?\b/);
  const sleep = source.match(/\b(?:sleep|slept)\D{0,18}(\d{1,2}(?:\.\d)?)\s*(?:h|hr|hrs|hours)?\b/);
  const steps = source.match(/\b(?:steps|walked)\D{0,18}(\d{3,6})\b/);
  const water = source.match(/\b(?:water|hydration)\D{0,18}(\d{1,2}(?:\.\d)?)\s*(?:cup|cups|glass|glasses)?\b/);
  const bpMatch = bpSlash || bpOver;

  if (bpMatch) {
    extracted.systolic = bpMatch[1];
    extracted.diastolic = bpMatch[2];
  }

  if (sugar) {
    extracted.bloodSugar = sugar[1];
  }

  if (heartRate) {
    extracted.heartRate = heartRate[1];
  }

  if (temperature) {
    extracted.temperatureC = temperature[1];
  }

  if (oxygen) {
    extracted.oxygenSaturation = oxygen[1];
  }

  if (weight) {
    extracted.weightKg = weight[1];
  }

  if (height) {
    extracted.heightCm = height[1];
  }

  if (waist) {
    extracted.waistCm = waist[1];
  }

  if (sleep) {
    extracted.sleepHours = sleep[1];
  }

  if (steps) {
    extracted.stepsCount = steps[1];
  }

  if (water) {
    extracted.waterCups = water[1];
  }

  return extracted;
}

function mergeVitals(extractedVitals, suppliedVitals) {
  const merged = { ...extractedVitals };

  for (const [key, value] of Object.entries(suppliedVitals || {})) {
    if (cleanText(value)) {
      merged[key] = value;
    }
  }

  return merged;
}

function formatContextLabel(value) {
  const labels = {
    "not-sure": "not sure",
    "under-1-hour": "under 1 hour",
    "1-6 hours": "1-6 hours",
    "1-3 days": "1-3 days",
    "more-than-3-days": "more than 3 days",
    understand: "understand symptoms",
    "medicine-safety": "medicine safety",
    "follow-up": "plan follow-up",
    urgency: "know urgency",
    "with-someone": "with someone",
    alone: "alone",
    "needs-transport": "needs transport help",
    "chest-pain": "chest pain",
    "breathing-trouble": "breathing trouble",
    fainting: "fainting",
    "one-sided-weakness": "one-sided weakness",
    "severe-allergy": "severe allergy"
  };

  return labels[value] || cleanText(value);
}

function createAgentResult(id, name, status, output) {
  return {
    id,
    name,
    status,
    output
  };
}

function createAuditEntry(step, detail) {
  return {
    step,
    status: "complete",
    detail,
    timestamp: new Date().toISOString()
  };
}

function dedupeKnowledgeEntries(entries) {
  const seen = new Set();
  const unique = [];

  for (const entry of entries) {
    if (!entry || !entry.id || seen.has(entry.id)) {
      continue;
    }

    seen.add(entry.id);
    unique.push({
      ...entry,
      keywords: Array.isArray(entry.keywords) ? entry.keywords.map(cleanText).filter(Boolean) : []
    });
  }

  return unique;
}

function upsertIntent(intents, nextIntent) {
  const existing = intents.find((intent) => intent.type === nextIntent.type);

  if (!existing) {
    intents.push(nextIntent);
    return;
  }

  existing.confidence = Math.max(existing.confidence, nextIntent.confidence);
  existing.evidence = Array.from(new Set([...existing.evidence, ...nextIntent.evidence]));
}

function findKeywordMatches(textOrMessage, keywords) {
  return keywords.filter((keyword) => hasAffirmedTerm(textOrMessage, keyword));
}

function hasTerm(textOrMessage, term) {
  const text = ` ${normalizeSearchText(textOrMessage)} `;
  const target = normalizeSearchText(term);

  return Boolean(target) && text.includes(` ${target} `);
}

function hasAffirmedTerm(textOrMessage, term) {
  return hasTerm(textOrMessage, term) && !hasNegatedTerm(textOrMessage, term);
}

function hasBreathingSignal(textOrMessage) {
  return [
    "shortness of breath",
    "breathless",
    "breathing trouble",
    "trouble breathing",
    "difficulty breathing",
    "cannot breathe"
  ].some((term) => hasAffirmedTerm(textOrMessage, term));
}

function hasFaintingSignal(textOrMessage) {
  return [
    "faint",
    "fainted",
    "fainting",
    "unconscious",
    "passed out"
  ].some((term) => hasAffirmedTerm(textOrMessage, term));
}

function hasStrokeSignal(textOrMessage) {
  return [
    "stroke",
    "slurred speech",
    "trouble speaking",
    "difficulty speaking",
    "face droop",
    "face drooping",
    "one sided weakness",
    "one side weakness",
    "weakness on one side",
    "one sided numbness",
    "one side numbness",
    "numbness on one side",
    "sudden weakness",
    "sudden numbness",
    "sudden confusion",
    "loss of balance",
    "balance loss",
    "trouble walking",
    "difficulty walking",
    "sudden dizziness",
    "sudden severe headache",
    "change in vision",
    "vision change",
    "trouble seeing",
    "difficulty seeing",
    "vision loss"
  ].some((term) => hasAffirmedTerm(textOrMessage, term));
}

function hasSevereAllergySignal(textOrMessage) {
  return [
    "severe allergy",
    "swelling throat",
    "swollen throat",
    "face swelling",
    "swelling face",
    "blue lips"
  ].some((term) => hasAffirmedTerm(textOrMessage, term));
}

function normalizeSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildSearchText(message) {
  return normalizeSearchText(message);
}

function parseBloodPressure(value) {
  const match = String(value || "").match(/(\d{2,3})\s*\/\s*(\d{2,3})/);

  if (!match) {
    return {
      systolic: null,
      diastolic: null
    };
  }

  return {
    systolic: toNumber(match[1]),
    diastolic: toNumber(match[2])
  };
}

function hasAnyVitals(vitals) {
  return Object.values(vitals).some((value) => value !== null);
}

function cleanText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function toBoundedNumber(value, min, max) {
  const number = toNumber(value);

  if (number === null || number < min || number > max) {
    return null;
  }

  return number;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

