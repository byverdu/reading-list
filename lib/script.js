/** @type {import('./reading-list.d.ts').ReadingList} */
window.allArticles = [];
let searchQuery = '';

class Tags extends HTMLElement {
	static activeTags = new Set();

	async connectedCallback() {
		const template = document.getElementById('tag-list-template');
		if (template) {
			this.appendChild(template.content.cloneNode(true));
			window.allArticles = await window.articlesReady;
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
		const sorted = this.sortTags();

		sorted.forEach((tag) => {
			const btn = document.createElement('button', { is: 'tag-item' });

			btn.setAttribute('data-tag', tag);
			this?.container.appendChild(btn);
		});
	}
}

// biome-ignore lint/correctness/noUnusedVariables: <Will be used globally once the script is loaded in the html file>
class Tag extends HTMLButtonElement {
	connectedCallback() {
		const tagName = this.dataset.tag;
		this.className = 'tag';
		this.textContent = tagName;
		this.addEventListener('click', () => this.toggleTag(tagName));
	}

	toggleTag(tag) {
		if (Tags.activeTags.has(tag)) {
			Tags.activeTags.delete(tag);
		} else {
			Tags.activeTags.add(tag);
		}

		document.querySelector(`[data-tag="${tag}"]`).classList.toggle('active');

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
		titleEl.href = escHtml(url);
		titleEl.innerHTML = highlight(title, query);

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
			if (Tags.activeTags.has(tag)) btn.classList.add('active');
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

	if (filtered.length === 0) {
		list.innerHTML =
			'<li class="empty"><strong>No articles found.</strong>Try a different search or tag.</li>';
		return;
	}

	for (const a of filtered) {
		const item = document.createElement('li', { is: 'article-item' });
		item.dataset.id = a.id;
		item.dataset.query = q;
		list.appendChild(item);
	}
}

// ── Search ──
document.getElementById('search').addEventListener('input', (e) => {
	searchQuery = e.target.value.trim();
	render();
});

async function init() {
	try {
		window.allArticles = await window.articlesReady;
		render();
	} catch (e) {
		console.log(e);
		document.getElementById('articles').innerHTML =
			`<li class="empty"><strong>Could not load reading list.</strong><span class="error">${e}</span></li>`;
	}
}

(async () => {
	await init();
})();
