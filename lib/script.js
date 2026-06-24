let allArticles = [];
let activeTags = new Set();
let searchQuery = "";

// ── Build tag bar ──
function buildTagBar() {
  const counts = {};
  allArticles.forEach((a) =>
    (a.tags || []).forEach((t) => (counts[t] = (counts[t] || 0) + 1)),
  );
  const sorted = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([t]) => t);

  const container = document.getElementById("tag-list");
  container.style.display = "flex";
  container.style.flexWrap = "wrap";
  container.style.gap = "0.4rem";

  sorted.forEach((tag) => {
    const btn = document.createElement("button");
    btn.className = "tag";
    btn.textContent = tag;
    btn.dataset.tag = tag;
    btn.addEventListener("click", () => toggleTag(tag));
    container.appendChild(btn);
  });
}

function toggleTag(tag) {
  if (activeTags.has(tag)) activeTags.delete(tag);
  else activeTags.add(tag);
  document.querySelectorAll(".tag[data-tag]").forEach((b) => {
    b.classList.toggle("active", activeTags.has(b.dataset.tag));
  });
  render();
}

// ── Filter ──
function getFiltered() {
  const q = searchQuery.toLowerCase();
  return allArticles.filter((a) => {
    const matchesTag =
      activeTags.size === 0 || (a.tags || []).some((t) => activeTags.has(t));
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
function render() {
  const filtered = getFiltered();
  const q = searchQuery.toLowerCase();

  const meta = document.getElementById("list-meta");
  meta.innerHTML = `<span>${filtered.length}</span> of <span>${allArticles.length}</span> articles`;

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
          <button class="article-tag ${activeTags.has(t) ? "active" : ""}" data-tag="${escHtml(t)}">${escHtml(t)}</button>
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
  list.querySelectorAll(".article-tag").forEach((btn) => {
    btn.addEventListener("click", () => toggleTag(btn.dataset.tag));
  });
}

// ── Search ──
document.getElementById("search").addEventListener("input", (e) => {
  searchQuery = e.target.value.trim();
  render();
});

async function init() {
  try {
    const res = await fetch("lib/reading-list.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    allArticles = await res.json();
    allArticles.sort((a, b) => new Date(b.date) - new Date(a.date));
    buildTagBar();
    render();
  } catch (e) {
    document.getElementById("articles").innerHTML =
      `<li class="empty"><strong>Could not load reading list.</strong>${e.message}</li>`;
  }
}

(async () => {
  await init();
})();
