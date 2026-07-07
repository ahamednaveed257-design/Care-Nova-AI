import { createServer } from "node:http";

const host = "127.0.0.1";
const port = Number.parseInt(process.env.MOCK_OLLAMA_PORT || "11434", 10);

const models = [
  {
    name: "qwen2.5:3b",
    model: "qwen2.5:3b"
  },
  {
    name: "llama3.2:3b",
    model: "llama3.2:3b"
  }
];

const reviewPayload = {
  summary_upgrade: "Local runtime review is active. Keep the answer focused on the current symptom, reuse the available vitals and profile context, and ask one targeted follow-up only if it changes the safe next step.",
  step_additions: [
    "Restate the main concern in one short line before giving the next step.",
    "Use the available vitals or medicine context before suggesting follow-up."
  ],
  warning_additions: [
    "Seek urgent in-person care for chest pain, severe breathing trouble, fainting, or new one-sided weakness."
  ],
  missing_question: "What changed most since this concern started?",
  evidence_focus: [
    "patient context",
    "latest vitals",
    "top offline evidence"
  ],
  confidence_label: "mock-local-runtime"
};

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${host}:${port}`);

  if (request.method === "GET" && (url.pathname === "/api/tags" || url.pathname === "/v1/models")) {
    const payload = url.pathname === "/api/tags"
      ? { models }
      : {
          data: models.map((item) => ({
            id: item.model,
            object: "model"
          }))
        };
    return sendJson(response, 200, payload);
  }

  if (request.method === "POST" && (url.pathname === "/api/chat" || url.pathname === "/v1/chat/completions")) {
    await readRequestBody(request);
    const payload = url.pathname === "/api/chat"
      ? {
          model: "qwen2.5:3b",
          done: true,
          message: {
            role: "assistant",
            content: JSON.stringify(reviewPayload)
          }
        }
      : {
          id: "mock-chatcmpl",
          object: "chat.completion",
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content: JSON.stringify(reviewPayload)
              },
              finish_reason: "stop"
            }
          ]
        };

    return sendJson(response, 200, payload);
  }

  return sendJson(response, 404, {
    ok: false,
    error: "Not found",
    path: url.pathname
  });
});

server.listen(port, host, () => {
  process.stdout.write(`mock-ollama-runtime listening on http://${host}:${port}\n`);
});

function sendJson(response, statusCode, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  response.end(body);
}

function readRequestBody(request) {
  return new Promise((resolve) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", () => resolve(""));
  });
}
