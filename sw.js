const CACHE_NAME = 'ai-textbook-editor-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/app.js',
  '/js/editor.js',
  '/js/fileSystem.js',
  '/js/indexedDB.js',
  '/js/state.js',
  '/js/ui.js',
  '/js/aiChat.js',
  '/js/config.js',
  '/js/outlineTree.js',
  '/js/outlineTreeSimple.js',
  '/js/kaiProfile.js',
  'https://cdn.tailwindcss.com',
  'https://uicdn.toast.com/editor/latest/toastui-editor.min.css',
  'https://cdn.jsdelivr.net/npm/jquery.fancytree@2.38/dist/skin-win8/ui.fancytree.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
  'https://code.jquery.com/jquery-3.6.0.min.js',
  'https://code.jquery.com/ui/1.13.2/jquery-ui.min.js',
  'https://cdn.jsdelivr.net/npm/jquery.fancytree@2.38/dist/jquery.fancytree-all-deps.min.js',
  'https://uicdn.toast.com/editor/latest/toastui-editor-all.min.js'
];

// Install event - cache resources
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Fetch event - serve from cache if available
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached version or fetch from network
        return response || fetch(event.request);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
}); 