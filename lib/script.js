/** @type {import('./reading-list.d.ts').ReadingList} */
window.allArticles = [];
let searchQuery = "";

class Tags extends HTMLElement {
	static activeTags = new Set();

	async connectedCallback() {
		const template = document.getElementById("tag-list-template");
		if (template) {
			this.appendChild(template.content.cloneNode(true));
			window.allArticles = await window.articlesReady;
			this.render();
		}
	}

	get container() {
		return this.querySelector("#tag-list");
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
			const btn = document.createElement("button", { is: "tag-item" });

			btn.setAttribute("data-tag", tag);
			this?.container.appendChild(btn);
		});
	}
}

// biome-ignore lint/correctness/noUnusedVariables: <Will be used globally once the script is loaded in the html file>
class Tag extends HTMLButtonElement {
	static observedAttributes = ["data-tag"];

	connectedCallback() {
		this.className = "tag";
	}

	attributeChangedCallback(_, __, newVal) {
		this.textContent = newVal;
		this.addEventListener("click", () => this.toggleTag(newVal));
	}

	toggleTag(tag) {
		if (Tags.activeTags.has(tag)) Tags.activeTags.delete(tag);
		else Tags.activeTags.add(tag);
		document.querySelectorAll(".tag[data-tag]").forEach((b) => {
			b.classList.toggle("active", Tags.activeTags.has(b.dataset.tag));
		});

		render();
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
			(a.notes || "").toLowerCase().includes(q) ||
			(a.tags || []).some((t) => t.toLowerCase().includes(q))
		);
	});
}

// ── Highlight ──
function highlight(text, q) {
	if (!q) return escHtml(text);
	const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	return escHtml(text).replace(
		new RegExp(`(${escaped})`, "gi"),
		"<mark>$1</mark>",
	);
}

function escHtml(s) {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

// ── Format date ──
function fmtDate(date) {
	if (!date) return "";
	const [d, m, y] = date.split("-");
	return `${d}·${m}·${y}`;
}

// ── Render ──
async function render() {
	const filtered = await getFiltered();
	const q = searchQuery.toLowerCase();

	const meta = document.getElementById("list-meta");
	meta.innerHTML = `<span>${filtered.length}</span> of <span>${window.allArticles.length}</span> articles`;

	const list = document.getElementById("articles");
	if (filtered.length === 0) {
		list.innerHTML =
			'<li class="empty"><strong>No articles found.</strong>Try a different search or tag.</li>';
		return;
	}

	list.innerHTML = filtered
		.map((a) => {
			const tags = (a.tags || [])
				.map(
					(t) => `
          <button class="article-tag ${Tags.activeTags.has(t) ? "active" : ""}" data-tag="${escHtml(t)}">${escHtml(t)}</button>
        `,
				)
				.join("");

			const notes = a.notes
				? `<p class="article-notes">${highlight(a.notes, q)}</p>`
				: "";

			return `
          <li class="article" data-id="${a.id}">
            <div class="article-main">
              <a class="article-title" href="${escHtml(a.url)}" target="_blank" rel="noopener">
                ${highlight(a.title, q)}
              </a>
              ${notes}
              <div class="article-tags">${tags}</div>
            </div>
            <time class="article-date" datetime="${escHtml(a.date || "")}">${fmtDate(a.date)}</time>
          </li>
        `;
		})
		.join("");

	// Wire up inline tag buttons
	// list.querySelectorAll(".article-tag").forEach((btn) => {
	//   btn.addEventListener("click", () => toggleTag(btn.dataset.tag));
	// });
}

// ── Search ──
document.getElementById("search").addEventListener("input", (e) => {
	searchQuery = e.target.value.trim();
	render();
});

async function init() {
	try {
		window.allArticles = await window.articlesReady;
		render();
	} catch (e) {
		console.log(e);
		document.getElementById("articles").innerHTML =
			`<li class="empty"><strong>Could not load reading list.</strong><span class="error">${e}</span></li>`;
	}
}

(async () => {
	await init();
})();
