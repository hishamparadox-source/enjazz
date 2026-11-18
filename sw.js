/* Service Worker بسيط — يوميّاتي
   - يخزّن ملفات التطبيق الأساسية عند التثبيت
   - يستخدم استراتيجية "الشبكة أولاً" لصفحة التطبيق (لتصلك التحديثات)
   - يستخدم "الكاش أولاً مع التحديث بالخلفية" لبقية الموارد (Tailwind, الخطوط, html2pdf)
   عند تعديل ملفات التطبيق غيّر رقم VERSION ليُحدَّث الكاش. */

const VERSION = 'v1';
const CORE = 'yawmiyati-core-' + VERSION;
const RUNTIME = 'yawmiyati-runtime-' + VERSION;
const CORE_ASSETS = ['./', './index.html', './manifest.json', './icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CORE).then((c) => c.addAll(CORE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CORE && k !== RUNTIME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (!url.protocol.startsWith('http')) return;

  // صفحة التطبيق: الشبكة أولاً ثم الكاش عند انقطاع الاتصال
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CORE).then((c) => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html').then((r) => r || caches.match('./')))
    );
    return;
  }

  // بقية الموارد: من الكاش فوراً مع تحديثه بالخلفية
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && (res.ok || res.type === 'opaque')) {
            const copy = res.clone();
            caches.open(RUNTIME).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
