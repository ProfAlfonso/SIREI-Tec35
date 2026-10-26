// ============================================================
//  sw.js - Service Worker de SIREI
//  Objetivo: que la app ABRA SIEMPRE, incluso cuando la red bloquea
//  el dominio (por ejemplo, datos móviles de un operador que bloquea
//  GitHub Pages) o cuando no hay internet.
//
//  Estrategia: "caché primero + actualización en segundo plano".
//    - Sirve la app al instante desde la caché (no espera a la red).
//    - En paralelo intenta descargar la versión nueva y la guarda.
//    - POST (API de Apps Script) y otros orígenes: NO se tocan nunca.
//
//  IMPORTANTE: cuando actualices archivos de la app, sube el número
//  de CACHE (v1 -> v2). Así el navegador reemplaza la copia guardada.
// ============================================================

const CACHE = 'sirei-shell-v6';

const SHELL = [
  './',
  'index.html',
  'admin.html',
  'coordinador.html',
  'docente.html',
  'prefecto.html',
  'manifest.json',
  'css/admin.css',
  'css/stylesindex.css',
  'js/config.js',
  'js/sirei.js',
  'js/authindex.js',
  'js/admin.js',
  'js/init.js',
  'js/export.js',
  'js/coordinador.js',
  'js/pages/datos.js',
  'js/pages/asignaturas.js',
  'js/pages/docentes.js',
  'js/pages/alumnos.js',
  'js/pages/areas.js',
  'js/pages/actitudinal.js',
  'js/pages/usuarios.js',
  'js/pages/grupos.js',
  'js/pages/periodos.js',
  'js/pages/calificaciones_finales.js',
  'js/pages/docente.js',
  'js/pages/academico_docente.js',
  'js/pages/actitudes_docente.js',
  'js/pages/calificaciones_docente.js',
  'js/pages/resultados_docente.js',
  'js/pages/prefecto.js',
  'icon-192.png',
  'icon-512.png',
  'icon-512-maskable.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Tolerante: si algún archivo no existe, no rompe la instalación
    await Promise.allSettled(SHELL.map((url) => cache.add(new Request(url, { cache: 'reload' }))));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const claves = await caches.keys();
    await Promise.all(
      claves
        .filter((k) => k.indexOf('sirei-shell-') === 0 && k !== CACHE)
        .map((k) => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Nunca interceptar POST/PUT/DELETE (ahí van las escrituras a Apps Script)
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Nunca interceptar otros orígenes (script.google.com, unpkg, fonts, etc.)
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const guardado = await cache.match(req, { ignoreSearch: true });

    // Actualización en segundo plano (no bloquea la respuesta)
    const descarga = fetch(req).then((res) => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    }).catch(() => null);

    // Si ya está en caché, se responde al instante (clave cuando la red bloquea el dominio)
    if (guardado) return guardado;

    const res = await descarga;
    if (res) return res;

    if (req.mode === 'navigate') {
      const inicio = await cache.match('index.html');
      if (inicio) return inicio;
    }
    return new Response('Sin conexión', { status: 503, statusText: 'Sin conexión' });
  })());
});
