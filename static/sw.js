/* Chorva AI service worker — oflayn ishlash va tez yuklanish uchun.
   versiya raqamini server (app.py) avtomatik qo‘yadi. */
const VERSION = "chorva-__VERSION__";
const IMG_CACHE = "chorva-photos-v1";
const SHELL = [
  "/",
  "/manifest.json",
  "/static/css/style.css?v=__VERSION__",
  "/static/js/config.js?v=__VERSION__",
  "/static/js/theme.js?v=__VERSION__",
  "/static/js/util.js?v=__VERSION__",
  "/static/js/db.js?v=__VERSION__",
  "/static/js/growth.js?v=__VERSION__",
  "/static/js/illus.js?v=__VERSION__",
  "/static/js/sheet.js?v=__VERSION__",
  "/static/js/camera.js?v=__VERSION__",
  "/static/js/catalog.js?v=__VERSION__",
  "/static/js/farm.js?v=__VERSION__",
  "/static/js/settings.js?v=__VERSION__",
  "/static/js/app.js?v=__VERSION__",
  "/static/vendor/chart.umd.min.js?v=__VERSION__",
  "/static/data/data.json",
  "/static/icons/icon-192.png",
  "/static/icons/icon-512.png",
  "/static/icons/apple-touch-icon.png"
];
const PHOTO_HOSTS = ["commons.wikimedia.org", "upload.wikimedia.org"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(VERSION)
      .then((cache) => Promise.allSettled(SHELL.map((url) => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== IMG_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function trimCache(name, max) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // API — har doim tarmoqdan (shaxsiy tahlil natijalari keshlanmaydi)
  if (url.origin === location.origin && url.pathname.startsWith("/api/")) return;

  // Sahifa navigatsiyasi: avval tarmoq, bo‘lmasa keshdagi ilova qobig‘i
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put("/", copy));
        return res;
      }).catch(() => caches.match("/"))
    );
    return;
  }

  // Wikimedia fotosuratlari: avval kesh (oflayn ham ko‘rinadi)
  if (PHOTO_HOSTS.includes(url.hostname)) {
    event.respondWith(
      caches.open(IMG_CACHE).then((cache) => cache.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res && (res.ok || res.type === "opaque")) {
          cache.put(req, res.clone());
          trimCache(IMG_CACHE, 120);
        }
        return res;
      })))
    );
    return;
  }

  // Statik fayllar: keshdan darhol, fonda yangilash
  if (url.origin === location.origin) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const net = fetch(req).then((res) => {
          if (res && res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
          return res;
        }).catch(() => cached);
        return cached || net;
      })
    );
  }
});
