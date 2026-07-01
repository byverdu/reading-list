# Background & Architecture Notes

This document captures the *why* behind the non-obvious areas of the app:
accessibility, caching, render performance, and offline support. The code is
small; the reasoning is the part worth keeping.

## Table of Contents

- [1. Accessibility](#1-accessibility)
- [2. Caching (localStorage + content hash)](#2-caching-localstorage--content-hash)
- [3. Render performance](#3-render-performance)
- [4. Service worker (offline)](#4-service-worker-offline)

---

## 1. Accessibility

The goal: the app should be fully usable with a keyboard and a screen reader, and
state changes (filtering, loading) should be announced — not just shown.

### Visually-hidden labels (`.sr-only`)

A standard utility that hides content visually but keeps it in the accessibility
tree (do **not** use `display:none` — that removes it from screen readers too):

```css
.sr-only {
  position: absolute;
  width: 1px; height: 1px;
  padding: 0; margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

Used for:

- The search input's `<label for="search" class="sr-only">` — the input is
  visually identified by an icon, but a label is required for screen readers.
- The `(opens in new tab)` span appended to each article title link, so the
  visible text stays clean while the warning is still announced.

### `<search>` landmark

The controls container is a native `<search>` element with
`aria-label="Filter articles"`, giving screen-reader users a jump target.

- MDN: <https://developer.mozilla.org/en-US/docs/Web/HTML/Element/search>

### Live region for results (`#list-meta`)

```html
<p id="list-meta" aria-live="polite" aria-atomic="true"></p>
```

When the result count changes (search/tag filter), `aria-live="polite"` makes the
screen reader announce the new "*N* of *total* articles" text without the user
having to navigate to it. `aria-atomic="true"` re-reads the whole
sentence rather than just the changed number.

- MDN: <https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/ARIA_Live_Regions>

### `aria-controls` on search

The search input has `aria-controls="articles"`, declaring that it filters the
`#articles` list.

### Toggle state on tags (`aria-pressed`)

Tag buttons are toggle buttons, so they expose `aria-pressed`. Critically it
is set in **two** places:

- `Tag.connectedCallback` — sets the initial value so the very first render is
  correct, plus `aria-label="Filter by <tag>"` for context.
- `Tag.toggleTag` — updates it (and the inline article tags) on every click.

```js
el.classList.toggle('active', isActive);
el.setAttribute('aria-pressed', isActive);
```

- MDN: <https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-pressed>

### Loading state (`aria-busy`)

`#articles` starts with `aria-busy="true"`; `render()` removes it once real content
is in place, signalling "content is loading" during the fetch window.

### Hiding the `↗` glyph from screen readers

The external-link arrow is decorative. CSS generated content supports an
**alt-text** syntax — text after the `/` is what assistive tech reads (here, empty):

```css
.article-title::after {
  content: " ↗" / "";
}
```

So sighted users see `↗`, screen readers hear nothing extra.

- MDN: <https://developer.mozilla.org/en-US/docs/Web/CSS/content>

---

## 2. Caching (localStorage + content hash)

### Problem

Every page load re-fetched the full `lib/reading-list.json` (hundreds of KB). We
want to skip that when the data hasn't changed.

### Flow

1. Always fetch the tiny `lib/reading-list-meta.json` first — it carries a `hash`.
2. Compare that hash with the one in `localStorage`.
3. **Unchanged** → parse articles from `localStorage`, skip the big fetch.
4. **Changed / no cache** → fetch `reading-list.json`, overwrite both keys.

Two keys (see `lib/script.js`): `reading-list-hash` and `reading-list-data`.

```js
if (meta?.hash && cache.hash === meta.hash && cache.data) {
  return sortByDateDesc(JSON.parse(cache.data)); // cache hit — no large fetch
}
```

### Why a content hash, not the article `count`

A `count` only changes on add/remove. If you **edit** an article (fix a title,
change tags) or swap one article for another, the count is identical but the
content differs — a count-keyed cache would serve stale data forever. A hash of
the file contents changes on *any* edit, so it is a correct validator.

### Why it can't drift: auto-generation

`scripts/gen-meta.js` computes `{ count, hash }` (sha256 of the file) and writes
`reading-list-meta.json`. It runs in the lefthook **pre-commit** hook whenever
`reading-list.json` is staged, so the hash is always in sync with the data — never
hand-maintained.

### ETag — the HTTP-level equivalent

**ETag = "Entity Tag"**, a response header holding a fingerprint of a file's
content. On the next request the browser sends `If-None-Match: <etag>`; the server
replies `304 Not Modified` (empty body) if unchanged, or `200` + fresh body if not.
It's content-addressed, so it never misses an edit.

We still built a JS-level cache because **GitHub Pages forces
`Cache-Control: max-age=600`** and doesn't let you customise headers — so for
up to 10 minutes the browser won't even revalidate. The `meta.json` + hash
approach is the only way to get instant, correct cache decisions on that host.

- MDN ETag: <https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/ETag>
- MDN Cache-Control: <https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control>

### Why localStorage (not a Map, not IndexedDB)

- **In-memory `Map`** — wiped on every reload, so it can't cache across visits.
  `window.allArticles` already is the in-session copy; persistence needs disk.
- **localStorage** — survives reloads; needs `JSON.stringify`/`parse`, but at this
  scale that's sub-millisecond. Wrapped in `try/catch` for private mode / quota.
- **IndexedDB** — stores structured objects without manual serialization, but is
  async and more complex. Worth it only at thousands of items / multi-MB; overkill
  here.

- MDN localStorage: <https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage>
- MDN IndexedDB: <https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API>

---

## 3. Render performance

All articles live in memory (search and tag counts need the full set), so
pagination/lazy-fetching is out — it would break search. The remaining cost is
**rendering** ~384 rows. Two low-effort changes address it.

### `DocumentFragment` — batch the insertion

Appending each `<li>` straight into the live list gives the browser repeated
chances to reflow, and forcing a layout read inside such a loop causes
"layout thrashing". Building off-DOM and inserting once avoids that:

```js
// before — 384 insertions into the live tree
for (const a of filtered) list.appendChild(makeItem(a));

// after — one insertion
const frag = document.createDocumentFragment();
for (const a of filtered) frag.appendChild(makeItem(a)); // off-DOM, no layout cost
list.appendChild(frag); // fragment dissolves; only its children are inserted
```

Custom-element `connectedCallback` still fires exactly once — when the element
enters the document on `list.appendChild(frag)`.

- MDN: <https://developer.mozilla.org/en-US/docs/Web/API/DocumentFragment>

### `content-visibility: auto` — skip off-screen work

Even once rows are in the DOM, the browser computes style/layout/paint for all of
them, including the ~370 below the fold. `content-visibility: auto` tells it to
skip rendering work for an element until it scrolls near the viewport — native
virtualization with zero JS, and the nodes stay real (Ctrl-F, a11y, search all work).

```css
.article {
  content-visibility: auto;
  contain-intrinsic-size: auto 90px;
}
```

`contain-intrinsic-size` is **mandatory** here: a skipped row has no computed
height, so without it the row collapses to 0px, breaking scrollbar size and
position. `auto 90px` provides a placeholder height (matching the
`SKELETON_ROW_HEIGHT = 90` constant in `lib/script.js`); the `auto` keyword lets
the browser remember each row's real size once rendered.

- MDN content-visibility: <https://developer.mozilla.org/en-US/docs/Web/CSS/content-visibility>
- MDN contain-intrinsic-size: <https://developer.mozilla.org/en-US/docs/Web/CSS/contain-intrinsic-size>
- web.dev (visuals + benchmark): <https://web.dev/articles/content-visibility>

#### How to test it out

> The best way to see it yourself: open DevTools → Performance tab,
record a tag-toggle, and compare "Layout" / "Paint" durations with and
without the content-visibility line.
There's also a Rendering panel checkbox for off-screen content.
Guide: [https://developer.chrome.com/docs/devtools/performance](https://developer.chrome.com/docs/devtools/performance)

### Why not pagination or JS virtualization

- **Pagination / split files** — breaks client-side search and tag counts, which
  need every article in memory. Also adds round-trips that 3G latency makes slower,
  not faster, at this payload size.
- **IntersectionObserver virtualization** — real benefit only at ~1,000+ rows. At
  384 it's complexity users wouldn't notice; `content-visibility` recovers
  most of the gain for one line of CSS.

---

## 4. Service worker (offline)

### Goal

Make the **app itself** (shell + article list) load and stay searchable with no
connection — the "browsing on the tube" scenario. External article links can't work
offline (different origin); reloading those tabs once back online is accepted.

Requires **one online visit** first, so the worker can install and precache. A
service worker cannot prefetch before its page has ever run.

### What `sw.js` does

- **Precache on `install`** — the shell (`index.html`, `styles.css`, `script.js`,
  favicon) plus the data files, so the first offline load works.
- **Clean up on `activate`** — delete any cache whose name isn't the current
  `CACHE` constant.
- **`fetch` routing** — see the strategy split below. Cross-origin requests
  (external articles) are ignored so they hit the network normally.

### Caching strategies (and which we use)

The five standard service-worker strategies:

<!-- markdownlint-disable MD013 -->

| Strategy | Speed | Freshness | Offline | Good for |
| --- | --- | --- | --- | --- |
| **Cache First** | instant | can be stale | yes | immutable/versioned assets (fonts, hashed files) |
| **Stale-While-Revalidate** | instant | one load behind | yes | app shell — fast, self-healing |
| **Network First** | round-trip | fresh | yes (fallback) | frequently-changing data |
| **Network Only** | round-trip | fresh | no | analytics, POST, auth |
| **Cache Only** | instant | frozen | yes | strict precached shell |

<!-- markdownlint-enable MD013 -->

This app uses a **split**:

- **Shell** (HTML/CSS/JS/favicon) → **stale-while-revalidate**: instant load, and
  edits to existing files land on the *next* reload automatically.
- **Data** (`reading-list.json`, `reading-list-meta.json`) → **network-first**:
  fresh when online, cached copy only as an offline fallback.

### Why data must be network-first (the lesson we learned the hard way)

`meta.json` carries the content `hash` that the localStorage cache (section 2) uses
to decide whether to refetch. If the service worker serves `meta.json`
**stale-while-revalidate**, it hands back the *old* hash first — which still matches
the localStorage hash — so the app trusts stale data and **updates don't appear
for several reloads**. The two caching layers fight.

Serving the data files **network-first** keeps the freshness signal current: the
hash check always sees the latest value, so the localStorage cache busts correctly
on the first reload. The SW still provides the cached copy when genuinely offline.

**Rule:** a service worker sitting in front of a hash/ETag-based freshness
mechanism must not stale-serve the freshness signal.

### When to bump the `CACHE` version

Most edits don't need a bump — stale-while-revalidate refreshes existing shell files
on the next load. Bump `CACHE` (e.g. `reading-list-v3` → `-v4`) when you:

- **add or rename** a precached file (the `install` precache only re-runs when
  `sw.js` changes),
- **remove** a file you want purged from users' caches,
- ship a **breaking change** that must apply atomically rather than one reload late,
- change the `fetch` strategy in `sw.js` itself.

### Gotcha during development

Because the *currently-controlling* worker serves the page that fetches the new
`sw.js`, changes can take an extra reload to take effect, and old cached data can
mask edits. To reset cleanly: DevTools → Application → **Clear site data**
(unregisters the SW + wipes Cache Storage + localStorage), then reload.

### Links

- MDN Service Worker API:
  <https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API>
- MDN `Cache`: <https://developer.mozilla.org/en-US/docs/Web/API/Cache>
- Google Offline Cookbook (catalogs every strategy):
  <https://web.dev/articles/offline-cookbook>
