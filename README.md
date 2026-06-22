# Claude → make.com wrapper

A single-page Claude chat UI that runs on **GitHub Pages** (no backend) and can push any
reply to a **make.com** webhook. It replicates a Claude.ai Project's instructions as a
system prompt, so every chat behaves like that project.

- 🗂 **Project instructions** — paste your Claude.ai Project's custom instructions once;
  they're sent as the system prompt on every message.
- 📎 **Knowledge files** — upload reference docs (text/markdown/CSV/code, **PDF**, **.docx**);
  their text is extracted in the browser and folded into the system prompt, cached so it's
  cheap to resend.
- 💬 **Multiple chats** — conversations are stored in your browser (`localStorage`).
- 📡 **Send to make.com** — each reply has a "Send to make.com" button.
- 🌍 **English / German** — switch the interface language in Settings (auto-detects your
  browser locale on first load).
- 📦 **Config bundle** — export everything (key, webhook, instructions, knowledge) to one
  `.zip`, or import a `.zip` to set up a browser in a single step — ideal for handing a
  ready-to-go setup to someone.
- 🔒 **No secrets in the repo** — the API key is entered in Settings and stored only in
  your browser, never committed.

> **Why no server?** GitHub Pages is static hosting. There's no public API to read a
> Claude.ai Project, so its instructions are copied in as a system prompt. The page calls
> the Anthropic API **directly from the browser** using the
> `anthropic-dangerous-direct-browser-access` header.

---

## 1. Deploy to GitHub Pages

1. Create a new GitHub repo and add `index.html` (and this `README.md`).
2. Push to the `main` branch.
3. Repo **Settings → Pages → Build and deployment → Source: Deploy from a branch**,
   pick `main` / `/ (root)`, Save.
4. After a minute your app is live at `https://<user>.github.io/<repo>/`.

Nothing else to build — it's one HTML file.

### ⚠️ Never hard-code your API key

Do **not** paste your `sk-ant-…` key into `index.html`. Anthropic scans public GitHub and
auto-revokes leaked keys within minutes. The app stores the key only in your browser's
`localStorage` via the Settings panel. Anyone who opens the page enters their own key.

For a private deployment, make the repo private and use **Cloudflare Pages** / **Netlify**
with access protection instead of public GitHub Pages.

---

## 2. Configure the app (Settings ⚙)

| Field | What to enter |
|---|---|
| **Language** | English or German (Deutsch). Defaults to your browser locale. |
| **Anthropic API key** | Your `sk-ant-…` key from <https://console.anthropic.com>. |
| **Project instructions** | The custom instructions text from your Claude.ai Project. |
| **Knowledge files** | Upload reference docs (see below). |
| **make.com webhook URL** | The Custom Webhook URL from your make.com scenario (step 3). |
| **Model** | Opus 4.8 (default), Sonnet 4.6, or Haiku 4.5. |
| **Max tokens** | Reply length cap (default 8192). |

> Getting your Project's instructions: open the Project on claude.ai → it has a custom
> instructions / "What are you working on" field → copy that text into the Settings box.
> (Claude.ai Projects have no API, so this manual copy is the only way.)

### Configuration bundle (.zip)

Under *Configuration bundle* in Settings:

- **⬇ Export bundle** downloads `claude-wrapper-config.zip` containing a `config.json`
  (API key, webhook, instructions, model, max tokens, language + the extracted knowledge
  text) plus human-readable `knowledge/*.txt` copies.
- **⬆ Import bundle** loads a `.zip` and applies everything in one step.

This is the easiest way to **hand off a ready-to-go setup**: configure one browser, export
the bundle, send the `.zip`, and the recipient just imports it.

You can also **hand-assemble** a bundle: a `config.json` (any subset of
`{apiKey, webhookUrl, systemPrompt, model, maxTokens, lang}`, optionally a `knowledge` array)
plus any raw `.pdf` / `.docx` / `.txt` files dropped in — on import, the raw files are text-
extracted and added as knowledge.

Notes:
- Import **adds to** existing knowledge (it doesn't wipe what's already there) — re-importing
  the same bundle will duplicate entries.
- ⚠ **The `.zip` contains the API key in plain text.** Treat the file like a password — send
  it over a secure channel and delete it after import.

### Knowledge files

Click **Choose files** under *Knowledge files* and pick one or more documents:

- **Text-based** (`.txt`, `.md`, `.csv`, `.json`, `.py`, `.js`, `.html`, …) — read directly.
- **PDF** — text extracted via [pdf.js](https://mozilla.github.io/pdf.js/) (loaded from CDN on first PDF).
- **Word `.docx`** — text extracted via [mammoth.js](https://github.com/mwilliamson/mammoth.js) (loaded from CDN on first .docx).

Extracted text is stored in `localStorage` and wrapped in `<document name="…">` tags inside
the system prompt, so it's available as reference context in **every** chat. A `cache_control`
breakpoint is set on the system block, so after the first message the knowledge is served from
cache (~0.1× input cost) rather than re-billed in full each turn.

Notes:
- The status line shows an approximate **token count added per message** — keep an eye on it,
  since knowledge is sent with every request.
- **Scanned / image-only PDFs** yield no text (no OCR in-browser) — you'll get a warning.
- Knowledge counts toward the browser's ~5 MB `localStorage` budget; the app warns if a save
  would exceed it. For large corpora, trim to the essential reference text.
- Claude.ai Project *knowledge files themselves* can't be pulled via API — this re-uploads them
  here so the wrapper has the same context.

---

## 3. Set up the make.com scenario

1. In make.com, create a new scenario and add the **Webhooks → Custom webhook** trigger.
2. Click **Add**, name it, and **copy the generated URL** — paste it into the app's
   Settings → *make.com webhook URL*.
3. Back in make.com, click **Re-determine data structure**, then in the app send a
   message and click **→ Send to make.com** once. make.com captures the payload.
4. Add whatever you want downstream (Google Sheets, Email, Slack, etc.) and map the fields.

### Payload the app sends

The send handler parses the assistant's German newsletter (deterministically — pure string
slicing, no LLM, content unchanged) into named fields and POSTs them as **JSON**
(`Content-Type: application/json`):

| Field | Source |
|---|---|
| `subject` | text after `Betreff:` / `Subject:` |
| `preheader` | text after `Preheader:` / `Vorschau:` |
| `headline` | text after `Titel:` / `Headline:` / `Überschrift:` |
| `story` | body paragraph 1 (Geschichte) |
| `analyse` | body paragraph 2 (Analyse) |
| `spur` | paragraphs between Analyse and Conclusio, joined with a blank line |
| `pointe` | second-to-last paragraph (Conclusio) |
| `schluss` | last paragraph (Markersatz) |

**Validation — it will _not_ POST** if any label is missing, the body has fewer than 5
paragraphs, or the final paragraph doesn't contain
`lässt sich in einem ersten Gespräch`. Instead it shows
`Send aborted: newsletter structure not recognised — <reason>` so a broken layout never
ships to Brevo.

> **CORS note:** because the body is `application/json`, the browser sends this as a CORS
> request with a preflight `OPTIONS` (unlike the old form-encoded `no-cors` send). The app
> now reads the response and reports a real success/failure. If you ever see a
> "Failed to fetch" error on send, the make.com webhook isn't returning CORS headers for
> your setup — verify the run landed in make.com's execution history; if it consistently
> blocks, the webhook may need a CORS-allowing response or a thin proxy. The parser lives in
> [`newsletter-parser.js`](newsletter-parser.js); see *Tests* below.

---

## How it works

```
Browser (GitHub Pages)
   │  1. chat → Anthropic API directly (key from localStorage, system prompt = instructions)
   ▼
api.anthropic.com  ──stream──▶  reply rendered in UI
   │
   │  2. "Send to make.com"  (parse newsletter → JSON fields → POST)
   ▼
hook.make.com  ──▶  your scenario → Brevo (subject, preheader, headline, story, …)
```

## Tests

The newsletter parser ([`newsletter-parser.js`](newsletter-parser.js)) has unit tests
([`newsletter-parser.test.js`](newsletter-parser.test.js)) covering the 5- and 6-paragraph
body variants, blank-line collapsing, CRLF input, and each rejection case. Run them with:

```sh
node --test
```

## Limitations

- **API key is client-side.** On a public page anyone can read it from dev tools — use a
  rotatable key, or host privately.
- **Claude.ai Projects aren't accessed live.** Instructions and knowledge are a manual
  copy/upload — the API can't reach a Claude.ai Project. Re-upload the docs via *Knowledge
  files*. No in-browser OCR, so scanned/image-only PDFs won't yield text.
- **Chats live in one browser.** No cross-device sync; clearing site data erases them.
- **Needs a normal browser tab.** All config lives in `localStorage`. Embedded preview
  panels, sandboxed iframes, or private windows that block storage will show a
  "Browser storage is blocked" banner and won't persist settings — open the deployed URL
  in a regular tab.
