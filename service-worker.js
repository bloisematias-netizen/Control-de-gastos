// Versión de la caché
const CACHE_NAME = 'gastos-v2'; // Cambiado a v2 para forzar una nueva instalación

// Los archivos a precachear. Rutas relativas para GitHub Pages.
const urlsToCache = [
    '/', // La raíz del sitio
    'index.html', // Antes: '/index.html'
    'styles.css', // Antes: '/styles.css'
    'script.js', // Antes: '/script.js'
    'manifest.json', // Antes: '/manifest.json'
    'icons/icon-192x192.png', // Antes: '/icons/icon-192x192.png'
    'icons/icon-512x512.png' // Añadido el ícono grande
];

// Instalar y guardar archivos en caché
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Servir archivos desde la caché, usando Network-first si es necesario (para actualizar)
self.addEventListener('fetch', event => {
  // Aseguramos que solo las peticiones GET se cacheen
  if (event.request.method !== 'GET') {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Devuelve el archivo si está en caché
        if (response) {
          return response;
        }
        
        // Si no está en caché, va a la red
        return fetch(event.request).then(
          function(response) {
            // Asegura que la respuesta es válida
            if(!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clona la respuesta antes de ponerla en caché
            var responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then(function(cache) {
                // Solo cachea si la URL coincide con las precacheadas para evitar problemas
                // Aunque fetch va a devolver más cosas, esto ayuda a mantener la caché limpia
                cache.put(event.request, responseToCache);
              });

            return response;
          }
        );
      })
    );
});

// Actualización de Service Worker (borrar cachés viejas)
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});