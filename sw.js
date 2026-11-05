// OrgetX সার্ভিস ওয়ার্কার — একবার খুললে পরে ইন্টারনেট ছাড়াও পেজ খুলবে।
// নেট থাকলে সবসময় নতুন সংস্করণ আনে, না থাকলে ফোনে রাখা কপি দেখায়।
const CACHE = "orgetx-v1";
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["./", "./index.html"]).catch(() => {})).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Firebase ইত্যাদি বাইরের অনুরোধে হাত দেয় না
  e.respondWith(
    fetch(req).then((res) => {
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {}); }
      return res;
    }).catch(() => caches.match(req).then((m) => m || (req.mode === "navigate" ? caches.match("./index.html").then((x) => x || caches.match("./")) : undefined)))
  );
});
