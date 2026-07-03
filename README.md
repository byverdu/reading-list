# Reading List

Personal reading list hosted on GitHub Pages. Add an article → push → it's live.

## Why don't use a bookmark system?

In the pursue of happiness to find the perfect browser, I came across [Helium](https://helium.computer/).
A browser based in chromium which is ultra minimal but guess what?
They don't have things like `Sync Accounts` or even a `Password manager`...

Things that I can perfectly live without them in the pursue of happiness :)

I find it more centralised to have the reading list all contained in a single
JSON file, rather than scattered across multiple bookmarks
and folders in different browsers.

**Live site:** [`https://byverdu.github.io/reading-list`](https://byverdu.github.io/reading-list)

---

## Adding an article

Edit [`reading-list.json`](./reading-list.json) and add an entry:

```json
{
  "id": "unique-id",
  "title": "Article Title",
  "url": "https://example.com/article",
  "tags": ["tag1", "tag2"],
  "date": "2025-06-16",
  "notes": "Optional note about why this is worth reading."
}
```

Push to `main` — GitHub Actions deploys automatically in ~30 seconds.

### Field reference

| Field   | Required | Description                                    |
| ------- | -------- | ---------------------------------------------- |
| `id`    | ✓        | Unique string (use a number or slug)           |
| `title` | ✓        | Article title                                  |
| `url`   | ✓        | Full URL                                       |
| `tags`  | ✓        | Array of lowercase strings                     |
| `date`  | ✓        | ISO date `DD-MM-YYYY`                          |
| `notes` | –        | Optional personal note (shown under the title) |

---

## Setup (first time)

1. **Create the repo** on GitHub (public or private)
2. Push this folder as the initial commit
3. Go to **Settings → Pages → Source** → select **GitHub Actions**
4. Push any change to `main` to trigger the first deploy

That's it. No npm, no build step.

---

## Tag conventions (optional)

Tags currently in use — use whatever works for you:

| Tag          | Use for                                |
| ------------ | -------------------------------------- |
| `Tools`      | DX, libraries, editors, utilities      |
| `Frontend`   | CSS, JS, browser APIs, UI              |
| `AI`         | AI models, LLMs, AI-assisted tooling   |
| `CSS`        | Styling, layout, animations            |
| `Javascript` | Language features, runtime, APIs       |
| `Backend`    | Server-side, infrastructure            |
| `Database`   | Databases, data clients                |
| `HTML`       | Markup, semantics                      |
| `Node`       | Node.js runtime and tooling            |
| `Learning`   | What to learn next                     |
| `Life`       | Opinion pieces                         |
| `Design`     | Design and UX                          |
