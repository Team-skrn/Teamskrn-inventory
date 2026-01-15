// self.addEventListener("install", (event) => {
//     self.skipWaiting(); // Forces new service worker to take control immediately
// });

// self.addEventListener("activate", (event) => {
//     event.waitUntil(
//         caches.keys().then((cacheNames) => {
//             return Promise.all(
//                 cacheNames.map((cache) => {
//                     return caches.delete(cache); // Clear old cache to fetch new files
//                 })
//             );
//         })
//     );
// });

// self.addEventListener("fetch", (event) => {
//     event.respondWith(
//         fetch(event.request).catch(() => caches.match(event.request)) // Try network first, then fallback to cache
//     );
// });


self.addEventListener("install", (event) => {
    self.skipWaiting(); // Forces immediate activation
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => caches.delete(cache))
            );
        }).then(() => self.clients.claim()) // Forces new version to load
    );
});
