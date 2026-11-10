// OrgetX সার্ভিস ওয়ার্কার — একবার নেট দিয়ে খুললে পরে ডাটা বন্ধ রেখেও অ্যাপ খোলে ও খেলা চলে।
//  • অ্যাপের পেজ: নেট থাকলে সবসময় নতুন সংস্করণ আনে (সর্বোচ্চ ৪ সেকেন্ড অপেক্ষা), না পেলে ফোনে রাখা কপি দেখায়।
//  • ফন্ট ও Firebase লাইব্রেরি: একবার নামলে ফোনে রেখে দেয়, অফলাইনে সেখান থেকেই চলে।
//  • Firestore/Auth-এর ডাটা-অনুরোধে হাত দেয় না।
const VER = "orgetx-v3";
const SHELL = VER + "-shell";
const RT = VER + "-rt";
const PRECACHE = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"];
const FB = "https://www.gstatic.com/firebasejs/10.14.1/";
const FB_FILES = ["firebase-app.js", "firebase-auth.js", "firebase-firestore.js"].map((f) => FB + f);
const NET_WAIT = 4000;

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const shell = await caches.open(SHELL);
    await Promise.all(PRECACHE.map((u) => shell.add(u).catch(() => {})));
    const rt = await caches.open(RT);
    await Promise.all(FB_FILES.map((u) => fetch(u, { mode: "cors" }).then((r) => { if (r && r.ok) return rt.put(u, r); }).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== SHELL && k !== RT).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

const isPage = (req, url) => req.mode === "navigate" || url.pathname === "/" || url.pathname.endsWith("/index.html");

async function netFirst(req) {
  const cache = await caches.open(SHELL);
  const key = req.mode === "navigate" ? "./index.html" : req;
  const net = fetch(req).then((res) => {
    if (res && res.ok) cache.put(key, res.clone()).catch(() => {});
    return res;
  });
  try {
    return await Promise.race([net, new Promise((_, rej) => setTimeout(rej, NET_WAIT))]);
  } catch (_) {
    const hit = await cache.match(key, { ignoreSearch: true });
    if (hit) return hit;
    return net.catch(() => Response.error());
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req, { ignoreSearch: true });
  const net = fetch(req).then((res) => {
    if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone()).catch(() => {});
    return res;
  }).catch(() => null);
  return hit || (await net) || Response.error();
}

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone()).catch(() => {});
    return res;
  } catch (_) { return Response.error(); }
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    if (isPage(req, url)) e.respondWith(netFirst(req));
    else e.respondWith(staleWhileRevalidate(req, SHELL));
    return;
  }
  if (url.hostname === "fonts.googleapis.com") { e.respondWith(staleWhileRevalidate(req, RT)); return; }
  if (url.hostname === "fonts.gstatic.com") { e.respondWith(cacheFirst(req, RT)); return; }
  if (url.hostname === "www.gstatic.com" && url.pathname.startsWith("/firebasejs/")) { e.respondWith(cacheFirst(req, RT)); return; }
  // বাকি সব (Firestore, Auth, বিজ্ঞাপন) সরাসরি নেটে যায়
});
