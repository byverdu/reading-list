/** @type {import('./reading-list.d.ts').ReadingList} */
window.allArticles = [];
let searchQuery = '';

// ── Cache + fetch ──
const META_URL = 'lib/reading-list-meta.json';
const DATA_URL = 'lib/reading-list.json';
const HASH_KEY = 'reading-list-hash';
const DATA_KEY = 'reading-list-data';

const metaReady = fetch(META_URL).then((r) => r.json());

function sortByDateDesc(articles) {
	const toSortable = (date) => date.split('-').reverse().join('-');
	return [...articles].sort(
		(a, b) => new Date(toSortable(b.date)) - new Date(toSortable(a.date)),
	);
}

function readCache() {
	try {
		return {
			hash: localStorage.getItem(HASH_KEY),
			data: localStorage.getItem(DATA_KEY),
		};
	} catch {
		return { hash: null, data: null }; // private mode / disabled
	}
}

function writeCache(hash, articles) {
	try {
		localStorage.setItem(DATA_KEY, JSON.stringify(articles));
		if (hash) localStorage.setItem(HASH_KEY, hash);
	} catch {
		/* quota exceeded — caching is best-effort */
	}
}

async function loadArticles() {
	let meta = null;
	try {
		meta = await metaReady;
	} catch {
		/* meta fetch failed (offline) — fall back to cache below */
	}

	const cache = readCache();

	// hash unchanged and we have data → use cache, skip the large fetch
	if (meta?.hash && cache.hash === meta.hash && cache.data) {
		return sortByDateDesc(JSON.parse(cache.data));
	}

	// offline with no usable meta but we have cached data → use it
	if (!meta && cache.data) {
		return sortByDateDesc(JSON.parse(cache.data));
	}

	// hash changed / no cache → fetch fresh and update cache
	const res = await fetch(DATA_URL);
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	const articles = await res.json();
	writeCache(meta?.hash, articles);
	return sortByDateDesc(articles);
}

const articlesReady = loadArticles().then((a) => {
	window.allArticles = a;
	return a;
});

class Tags extends HTMLElement {
	static activeTags = new Set();

	async connectedCallback() {
		const template = document.getElementById('tag-list-template');
		if (template) {
			this.appendChild(template.content.cloneNode(true));
			window.allArticles = await articlesReady;
			this.render();
		}
	}

	get container() {
		return this.querySelector('#tag-list');
	}

	sortTags() {
		const counts = window.allArticles.reduce((acc, curr) => {
			(curr.tags || []).forEach((tag) => {
				acc[tag] = (acc[tag] || 0) + 1;
			});

			return acc;
		}, {});

		return Object.entries(counts)
			.sort((a, b) => b[1] - a[1])
			.map(([t]) => t);
	}

	render() {
		document.getElementById('tags-skeleton')?.remove();
		this.container.innerHTML = '';
		const sorted = this.sortTags();

		sorted.forEach((tag) => {
			const btn = document.createElement('button', { is: 'tag-item' });

			btn.setAttribute('data-tag', tag);
			this.container.appendChild(btn);
		});
	}
}

// biome-ignore lint/correctness/noUnusedVariables: <Will be used globally once the script is loaded in the html file>
class Tag extends HTMLButtonElement {
	#clickHandler = null;

	connectedCallback() {
		const tagName = this.dataset.tag;
		this.className = 'tag';
		this.textContent = tagName;
		this.setAttribute('aria-pressed', Tags.activeTags.has(tagName));
		this.setAttribute('aria-label', `Filter by ${tagName}`);
		this.#clickHandler = () => this.toggleTag(tagName);
		this.addEventListener('click', this.#clickHandler);
	}

	disconnectedCallback() {
		this.removeEventListener('click', this.#clickHandler);
	}

	toggleTag(tag) {
		if (Tags.activeTags.has(tag)) {
			Tags.activeTags.delete(tag);
		} else {
			Tags.activeTags.add(tag);
		}

		const isActive = Tags.activeTags.has(tag);
		document.querySelectorAll(`[data-tag="${tag}"]`).forEach((el) => {
			el.classList.toggle('active', isActive);
			el.setAttribute('aria-pressed', isActive);
		});

		render();
	}
}

// biome-ignore lint/correctness/noUnusedVariables: <Will be used globally once the script is loaded in the html file>
class ArticleItem extends HTMLLIElement {
	connectedCallback() {
		const template = document.getElementById('article-list-item-template');
		this.appendChild(template.content.cloneNode(true));
		this._render();
	}

	_render() {
		const id = this.dataset.id;
		const query = this.dataset.query || '';
		/** @type {import('./reading-list.d.ts').ReadingListEntry} */
		const article = window.allArticles.find((art) => art.id === id);

		if (!article) return;

		const { url, title, notes, date, tags } = article;

		const titleEl = this.querySelector('.article-title');
		titleEl.href = url;
		titleEl.innerHTML = highlight(title, query);
		const newTab = document.createElement('span');
		newTab.className = 'sr-only';
		newTab.textContent = ' (opens in new tab)';
		titleEl.appendChild(newTab);

		if (notes) {
			const p = document.createElement('p');
			p.className = 'article-notes';
			p.innerHTML = highlight(notes, query);
			const tagsEl = this.querySelector('.article-tags');
			this.querySelector('.article-main').insertBefore(p, tagsEl);
		}

		const tagsEl = this.querySelector('.article-tags');
		for (const tag of tags || []) {
			const btn = document.createElement('button', { is: 'tag-item' });
			btn.setAttribute('data-tag', tag);
			tagsEl.appendChild(btn);
			// connectedCallback sets className='tag' (sidebar style); override for article context
			const active = Tags.activeTags.has(tag);
			btn.className = active ? 'article-tag active' : 'article-tag';
			btn.setAttribute('aria-pressed', active);
		}

		const timeEl = this.querySelector('.article-date');
		timeEl.setAttribute('datetime', escHtml(date || ''));
		timeEl.textContent = fmtDate(date);

		this.className = 'article';
	}
}

// ── Filter ──
async function getFiltered() {
	const q = searchQuery.toLowerCase();
	return window.allArticles.filter((a) => {
		const matchesTag =
			Tags.activeTags.size === 0 ||
			(a.tags || []).some((t) => Tags.activeTags.has(t));
		if (!matchesTag) return false;
		if (!q) return true;
		return (
			a.title.toLowerCase().includes(q) ||
			(a.notes || '').toLowerCase().includes(q) ||
			(a.tags || []).some((t) => t.toLowerCase().includes(q))
		);
	});
}

// ── Highlight ──
function highlight(text, q) {
	if (!q) return escHtml(text);
	const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	return escHtml(text).replace(
		new RegExp(`(${escaped})`, 'gi'),
		'<mark>$1</mark>',
	);
}

function escHtml(s) {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

// ── Format date ──
function fmtDate(date) {
	if (!date) return '';
	const [d, m, y] = date.split('-');
	return `${d}·${m}·${y}`;
}

// ── Render ──
async function render() {
	const filtered = await getFiltered();
	const q = searchQuery.toLowerCase();

	const meta = document.getElementById('list-meta');
	meta.innerHTML = `<span>${filtered.length}</span> of <span>${window.allArticles.length}</span> articles`;

	const list = document.getElementById('articles');
	list.innerHTML = '';
	list.removeAttribute('aria-busy');

	if (filtered.length === 0) {
		list.innerHTML =
			'<li class="empty"><strong>No articles found.</strong>Try a different search or tag.</li>';
		return;
	}

	const frag = document.createDocumentFragment();
	for (const a of filtered) {
		const item = document.createElement('li', { is: 'article-item' });
		item.dataset.id = a.id;
		item.dataset.query = q;
		frag.appendChild(item);
	}
	list.appendChild(frag);
}

// ── Search ──
let searchTimer = null;
document.getElementById('search').addEventListener('input', (e) => {
	searchQuery = e.target.value.trim();
	clearTimeout(searchTimer);
	searchTimer = setTimeout(render, 150);
});

// ── Skeletons ──
function buildArticleSkeletons(total) {
	const SKELETON_ROW_HEIGHT = 90; // approx height of one article row in px

	// Only render enough rows to fill the viewport, capped at the real total
	const fit = Math.ceil(window.innerHeight / SKELETON_ROW_HEIGHT);
	const count = Math.min(fit, total);
	const widths = ['70%', '85%', '60%', '78%', '65%'];
	const list = document.getElementById('articles');
	list.innerHTML = Array.from(
		{ length: count },
		(_, i) => `
		<li class="article-skeleton" aria-hidden="true">
			<div class="article-main">
				<div class="skeleton skeleton-title" style="width:${widths[i % widths.length]}"></div>
				<div class="skeleton-tags-row">
					<div class="skeleton skeleton-tag" style="width:3rem"></div>
					<div class="skeleton skeleton-tag" style="width:4rem"></div>
				</div>
			</div>
			<div class="skeleton skeleton-date"></div>
		</li>
	`,
	).join('');
}

async function init() {
	const skeletonTimer = setTimeout(async () => {
		const tagsSkeleton = document.getElementById('tags-skeleton');

		if (tagsSkeleton) tagsSkeleton.style.display = 'flex';

		const { count } = await metaReady;
		buildArticleSkeletons(count);
		document.getElementById('list-meta').innerHTML =
			`<span class="skeleton skeleton-meta-count"></span> of <span>${count}</span> articles`;
	}, 150);

	try {
		window.allArticles = await articlesReady;
		clearTimeout(skeletonTimer);
		render();
	} catch (e) {
		clearTimeout(skeletonTimer);
		document.getElementById('articles').innerHTML =
			`<li class="empty"><strong>Could not load reading list.</strong><span class="error">${e}</span></li>`;
	}
}

(async () => {
	await init();
})();

// ── Offline banner ──
const offlineBanner = document.getElementById('offline-banner');
function updateOnlineStatus() {
	offlineBanner.hidden = navigator.onLine;
}
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
updateOnlineStatus();

// ── Service worker (offline support) ──
if ('serviceWorker' in navigator) {
	window.addEventListener('load', () => {
		navigator.serviceWorker.register('sw.js').catch(() => {
			/* SW registration failed — app still works online */
		});
	});
}
