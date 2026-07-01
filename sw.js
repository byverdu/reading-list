const CACHE = 'reading-list-v1'; // bump to invalidate all cached assets on deploy

// Data files drive freshness (hash check) — never serve them stale.
const NETWORK_FIRST = ['/lib/reading-list.json', '/lib/reading-list-meta.json'];
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
	const { pathname } = new URL(request.url);
	const networkFirst = NETWORK_FIRST.some((path) => pathname.endsWith(path));

	event.respondWith(
		caches.open(CACHE).then(async (cache) => {
			const cached = await cache.match(request);
			const network = fetch(request)
				.then((response) => {
					if (response.ok) cache.put(request, response.clone());
					return response;
				})
				.catch(() => cached || cache.match('./index.html')); // offline fallback

			// Data files: fresh when online, cached only when offline (network
			// already falls back to `cached` on failure via its .catch above).
			// Shell: stale-while-revalidate (cached instantly, refreshed in bg).
			return networkFirst ? network : cached || network;
		}),
	);
});
