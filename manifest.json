const CACHE_NAME = "tasbih-cache-v2";
const STATIC_CACHE = "tasbih-static-v2";
const DYNAMIC_CACHE = "tasbih-dynamic-v2";
const API_CACHE = "tasbih-api-v2";

// For GitHub Pages subpath hosting (e.g., /tashbihcounter/), avoid leading slashes.
const STATIC_FILES = [
  "index.html",
  "manifest.json",
  "service-worker.js",
  "icon-192.svg",
  "icon-512.svg",
  "icon-72.svg",
  "icon-96.svg",
  "icon-128.svg",
  "icon-144.svg",
];

const API_ENDPOINTS = ["script.google.com"];

// Install event - cache static assets
self.addEventListener("install", (evt) => {
  console.log("Service Worker installing");
  evt.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE).then((cache) => {
        console.log("Caching static files");
        return cache.addAll(STATIC_FILES);
      }),
      caches.open(API_CACHE).then((cache) => {
        console.log("API cache ready");
      }),
    ])
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener("activate", (evt) => {
  console.log("Service Worker activating");
  evt.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (
            key !== STATIC_CACHE &&
            key !== DYNAMIC_CACHE &&
            key !== API_CACHE
          ) {
            console.log("Deleting old cache:", key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - smart caching strategy
self.addEventListener("fetch", (evt) => {
  const url = new URL(evt.request.url);

  // Handle API requests (Google Apps Script)
  if (
    url.hostname.includes("script.google.com") ||
    url.hostname.includes("googleusercontent.com")
  ) {
    evt.respondWith(
      fetch(evt.request)
        .then((response) => {
          // Cache successful API responses
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(API_CACHE).then((cache) => {
              cache.put(evt.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Return cached API response if available
          return caches.match(evt.request);
        })
    );
    return;
  }

  // Handle static assets
  // Normalize pathname for subdirectory hosting by trimming leading slash
  const normalizedPath = url.pathname.startsWith("/")
    ? url.pathname.slice(1)
    : url.pathname;

  if (STATIC_FILES.includes(normalizedPath)) {
    evt.respondWith(
      caches.match(evt.request).then((response) => {
        return response || fetch(evt.request);
      })
    );
    return;
  }

  // Handle other requests with network-first strategy
  evt.respondWith(
    fetch(evt.request)
      .then((response) => {
        // Cache successful responses
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(DYNAMIC_CACHE).then((cache) => {
            cache.put(evt.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Return cached version or fallback to index.html for navigation
        return caches.match(evt.request).then((response) => {
          return response || caches.match("index.html");
        });
      })
  );
});

// Background sync for offline data
self.addEventListener("sync", (event) => {
  console.log("Background sync triggered:", event.tag);

  if (event.tag === "background-sync-tasbih") {
    event.waitUntil(syncTasbihData());
  }
});

// Push notifications (for future use)
self.addEventListener("push", (event) => {
  console.log("Push message received:", event);

  const options = {
    body: event.data ? event.data.text() : "Time for your daily dhikr!",
    icon: "/icon-192.png",
    badge: "/icon-96.png",
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1,
    },
    actions: [
      {
        action: "open",
        title: "Open App",
        icon: "/icon-96.png",
      },
      {
        action: "dismiss",
        title: "Dismiss",
      },
    ],
  };

  event.waitUntil(
    self.registration.showNotification("📿 Tasbih Counter", options)
  );
});

// Handle notification clicks
self.addEventListener("notificationclick", (event) => {
  console.log("Notification click received:", event.action);

  event.notification.close();

  if (event.action === "open" || !event.action) {
    event.waitUntil(clients.openWindow("/"));
  }
});

// Background sync function
async function syncTasbihData() {
  try {
    const clients = await self.clients.matchAll();
    if (clients.length > 0) {
      // Send message to client to sync data
      clients.forEach((client) => {
        client.postMessage({
          type: "SYNC_DATA",
          message: "Background sync completed",
        });
      });
    }
  } catch (error) {
    console.error("Background sync failed:", error);
  }
}

// Message handling for communication with main thread
self.addEventListener("message", (event) => {
  console.log("Service Worker received message:", event.data);

  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }

  if (event.data && event.data.type === "GET_VERSION") {
    event.ports[0].postMessage({ version: "2.0.0" });
  }
});
