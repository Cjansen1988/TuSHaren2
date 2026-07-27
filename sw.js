// Service Worker für TuS Haren 2 – Spielvorbereitung
// Sorgt dafür, dass die App (inkl. React/Firebase/Tailwind aus dem Internet)
// nach einmaligem Laden mit Internet auch komplett ohne Verbindung funktioniert.

const CACHE_NAME = "tush2-cache-v1";

// Hosts, deren Dateien wir grundsätzlich zwischenspeichern dürfen
// (das sind die externen Bausteine, die die App lädt: React, Firebase, Tailwind, Babel, Fonts).
const CACHEABLE_HOSTS = [
  "cdn.tailwindcss.com",
  "fonts.googleapis.com",
  "fonts.gstatic.com",
  "esm.sh",
  "www.gstatic.com",
  "unpkg.com",
];

self.addEventListener("install", (event) => {
  // Sofort aktiv werden, nicht auf das Schließen alter Tabs warten
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Die App-Seite selbst (index.html / Navigation): zuerst versuchen,
  // die neueste Version aus dem Internet zu holen; klappt das nicht
  // (kein Netz), wird die zuletzt gespeicherte Version angezeigt.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() =>
          caches.match(req).then((cached) => cached || caches.match("./index.html"))
        )
    );
    return;
  }

  // Externe Bausteine (React, Firebase, Tailwind, Babel, Schriften):
  // Wenn schon gespeichert, sofort aus dem Speicher liefern (schnell + offline-fähig).
  // Wenn noch nicht gespeichert, aus dem Internet laden und dabei speichern.
  if (CACHEABLE_HOSTS.includes(url.hostname)) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req)
          .then((res) => {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
            return res;
          })
          .catch(() => cached);
      })
    );
    return;
  }

  // Alles andere (z.B. Firestore-/Login-Anfragen an Google) fassen wir nicht an –
  // dafür sorgt Firestores eigener Offline-Speicher (siehe firebaseConfig im Code).
});
