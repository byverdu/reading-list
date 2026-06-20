# Reading List

Personal reading list hosted on GitHub Pages. Add an article → push → it's live.

**Live site:** `https://byverdu.github.io/reading-list`

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

| Field   | Required | Description                                      |
|---------|----------|--------------------------------------------------|
| `id`    | ✓        | Unique string (use a number or slug)             |
| `title` | ✓        | Article title                                    |
| `url`   | ✓        | Full URL                                         |
| `tags`  | ✓        | Array of lowercase strings                       |
| `date`  | ✓        | ISO date `YYYY-MM-DD`                            |
| `notes` | –        | Optional personal note (shown under the title)  |

---

## Setup (first time)

1. **Create the repo** on GitHub (public or private)
2. Push this folder as the initial commit
3. Go to **Settings → Pages → Source** → select **GitHub Actions**
4. Push any change to `main` to trigger the first deploy

That's it. No npm, no build step.

---

## Tag conventions (optional)

Suggested tag vocabulary — use whatever works for you:

| Tag             | Use for                                  |
|-----------------|------------------------------------------|
| `frontend`      | CSS, JS, browser APIs                    |
| `architecture`  | System design, patterns                  |
| `performance`   | Web perf, core web vitals                |
| `accessibility` | a11y                                     |
| `design`        | Visual design, UX                        |
| `essay`         | Opinion pieces, long reads               |
| `reference`     | Docs, cheatsheets, guides                |
| `tooling`       | DX, build tools, editors                 |
| `career`        | Soft skills, engineering culture         |
