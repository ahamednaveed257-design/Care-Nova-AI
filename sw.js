const APP_VERSION = "5.0.343";
const CACHE_NAME = "care-nova-ai-v5.0.343";
const assetPath = (path) => new URL(path, self.location.href).href;
const APP_SHELL = [
  assetPath("./"),
  assetPath("styles.css?v=5.0.343"),
  assetPath("calm-theme.css?v=5.0.343"),
  assetPath("visual-polish.css?v=5.0.343"),
  assetPath("app.js?v=5.0.343"),
  assetPath("favicon.svg"),
  assetPath("app-icon.svg"),
  assetPath("media/care-nova-guide-poster.svg"),
  assetPath("version.json"),
  assetPath("site.webmanifest"),
  assetPath("robots.txt")
];
const CRITICAL_ASSET_PATTERN = /\.(?:html|css|js|json|webmanifest)$/i;
const STREAMING_ASSET_PATTERN = /\.(?:webm|m3u8|mpd|m4s|ts)$/i;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key !== CACHE_NAME)
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(request.url);

  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  if (requestUrl.pathname.startsWith("/api/")) {
    event.respondWith(apiNetworkOnly(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(navigationNetworkFirst(request));
    return;
  }

  if (STREAMING_ASSET_PATTERN.test(requestUrl.pathname)) {
    event.respondWith(mediaNetworkOnly(request));
    return;
  }

  if (isCriticalAssetRequest(requestUrl)) {
    event.respondWith(staticNetworkFirst(request));
    return;
  }

  event.respondWith(staticStaleWhileRevalidate(request));
});

function isLoopbackHostname(hostname = "") {
  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1" || hostname === "[::1]";
}

async function navigationNetworkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedShell = await cache.match(assetPath("./"));
  const requestUrl = new URL(request.url);
  const localRequest = isLoopbackHostname(requestUrl.hostname);

  if (!localRequest && self.navigator?.onLine === false && cachedShell) {
    return cachedShell;
  }

  try {
    const response = await fetch(createFreshRequest(request));

    if (response.ok) {
      cache.put(assetPath("./"), response.clone());
    }

    return response;
  } catch {
    return cachedShell || Response.error();
  }
}

function isCriticalAssetRequest(requestUrl) {
  return requestUrl.pathname === "/"
    || requestUrl.pathname.endsWith("/")
    || CRITICAL_ASSET_PATTERN.test(requestUrl.pathname);
}

function createFreshRequest(request) {
  return new Request(request, { cache: "reload" });
}

async function staticNetworkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  try {
    const response = await fetch(createFreshRequest(request));

    if (response.ok) {
      cache.put(request, response.clone());
    }

    return response;
  } catch {
    return cached || Response.error();
  }
}

async function staticStaleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const requestUrl = new URL(request.url);
  const localRequest = isLoopbackHostname(requestUrl.hostname);

  if (localRequest) {
    try {
      const response = await fetch(request);

      if (response.ok) {
        cache.put(request, response.clone());
      }

      return response;
    } catch {
      return cached || Response.error();
    }
  }

  if (self.navigator?.onLine === false && cached) {
    return cached;
  }

  const fresh = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }

      return response;
    })
    .catch(() => cached);

  return cached || fresh;
}

async function apiNetworkOnly(request) {
  const requestUrl = new URL(request.url);

  if (self.navigator?.onLine === false && !isLoopbackHostname(requestUrl.hostname)) {
    return createOfflineApiResponse();
  }

  try {
    return await fetch(request);
  } catch {
    return createOfflineApiResponse();
  }
}

function createOfflineApiResponse() {
  return new Response(JSON.stringify({
    ok: false,
    code: "OFFLINE_APP_SHELL",
    message: "Care Nova AI is installed and the app shell is available. The browser runtime can continue locally; start the local server for filesystem memory, OneDrive mirror, and full API storage."
  }), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Care-Nova-Offline": "true"
    }
  });
}

async function mediaNetworkOnly(request) {
  const requestUrl = new URL(request.url);

  if (self.navigator?.onLine === false && !isLoopbackHostname(requestUrl.hostname)) {
    return new Response("", {
      status: 204,
      statusText: "Media unavailable while offline"
    });
  }

  try {
    return await fetch(request);
  } catch {
    return new Response("", {
      status: 204,
      statusText: "Media unavailable while offline"
    });
  }
}
