const CACHE = 'reading-list-v1'; // bump to invalidate all cached assets on deploy
const ASSETS = [
	'./',
	'./index.html',
	'./lib/styles.css',
	'./lib/script.js',
	'./lib/reading-list.json',
	'./lib/reading-list-meta.json',
	'./assets/favicon.png',
];

self.addEventListener('install', (e) => {
	e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
	self.skipWaiting();
});

self.addEventListener('activate', (e) => {
	e.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(
					keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
				),
			),
	);
	self.clients.claim();
});

self.addEventListener('fetch', (e) => {
	const { request } = e;
	if (
		request.method !== 'GET' ||
		new URL(request.url).origin !== location.origin
	) {
		return; // let the browser handle it (e.g. external articles)
	}
	e.respondWith(
		caches.open(CACHE).then(async (cache) => {
			const cached = await cache.match(request);
			const network = fetch(request)
				.then((res) => {
					if (res.ok) cache.put(request, res.clone());
					return res;
				})
				.catch(() => cached || cache.match('./index.html')); // offline nav fallback
			return cached || network;
		}),
	);
});
