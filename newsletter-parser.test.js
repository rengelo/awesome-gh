// Tests for the deterministic newsletter parser used by the "Send to make.com" path.
// Run:  node --test
const test = require("node:test");
const assert = require("node:assert/strict");
const { parseNewsletter } = require("./newsletter-parser.js");

const MARKER = "Das lässt sich in einem ersten Gespräch herausfinden.";
const FIXED_SCHLUSS = "Ob das auf Ihre Situation zutrifft, lässt sich in einem ersten Gespräch herausfinden.";

// Paragraphs are separated by a BLANK line (the assistant's fixed shape).
function build(header, bodyParas) {
  return header.join("\n") + "\n\n" + bodyParas.join("\n\n");
}

// 6-paragraph body: canonical shape (hook + story + analyse + spur + pointe + schluss).
const SIX = build(
  ["Betreff: Wenn Stille teurer wird als Streit",
   "Preheader: Warum Schweigen selten spart",
   "Titel: Die Kosten des Nichtgesagten"],
  ["Was kostet Schweigen wirklich?",
   "Ein Paar sitzt am Küchentisch und sagt nichts.",
   "Schweigen wirkt wie Sparen, kostet aber Zinsen.",
   "Wer früh spricht, zahlt weniger Aufschlag.",
   "Am Ende bleibt die Frage, was Nähe wirklich wert ist.",
   MARKER]
);

// 7-paragraph body: spur spans two paragraphs.
const SEVEN = build(
  ["Subject: Zweites Beispiel",
   "Vorschau: Mit längerer Spur",
   "Überschrift: Sieben Absätze"],
  ["Hook-Satz.",
   "Geschichte-Absatz.",
   "Analyse-Absatz.",
   "Spur-Absatz eins.",
   "Spur-Absatz zwei.",
   "Conclusio-Satz.",
   MARKER]
);

// 5-paragraph body: schluss missing → inject fixed formula.
const FIVE = build(
  ["Betreff: Fünf Absätze", "Preheader: Kurz", "Titel: Kompakt"],
  ["Hook-Satz.",
   "Geschichte-Satz.",
   "Analyse-Satz.",
   "Spur-Satz.",
   "Conclusio-Satz."]
);

// 4-paragraph body: old shape (no hook, no schluss) → hook="", inject fixed formula.
const FOUR = build(
  ["Betreff: Vier Absätze", "Preheader: Alt", "Titel: Ohne Hook"],
  ["Geschichte-Satz.",
   "Analyse-Satz.",
   "Spur-Satz.",
   "Conclusio-Satz."]
);

test("6-paragraph canonical mapping", () => {
  const r = parseNewsletter(SIX);
  assert.equal(r.ok, true);
  const f = r.fields;
  assert.equal(f.subject,   "Wenn Stille teurer wird als Streit");
  assert.equal(f.preheader, "Warum Schweigen selten spart");
  assert.equal(f.headline,  "Die Kosten des Nichtgesagten");
  assert.equal(f.hook,      "Was kostet Schweigen wirklich?");
  assert.equal(f.story,     "Ein Paar sitzt am Küchentisch und sagt nichts.");
  assert.equal(f.analyse,   "Schweigen wirkt wie Sparen, kostet aber Zinsen.");
  assert.equal(f.spur,      "Wer früh spricht, zahlt weniger Aufschlag.");
  assert.equal(f.pointe,    "Am Ende bleibt die Frage, was Nähe wirklich wert ist.");
  assert.equal(f.schluss,   MARKER);
});

test("7-paragraph fallback: joins two Spur paragraphs", () => {
  const r = parseNewsletter(SEVEN);
  assert.equal(r.ok, true);
  const f = r.fields;
  assert.equal(f.hook,    "Hook-Satz.");
  assert.equal(f.story,   "Geschichte-Absatz.");
  assert.equal(f.analyse, "Analyse-Absatz.");
  assert.equal(f.spur,    "Spur-Absatz eins.\n\nSpur-Absatz zwei.");
  assert.equal(f.pointe,  "Conclusio-Satz.");
  assert.equal(f.schluss, MARKER);
});

test("5-paragraph fallback: injects fixed schluss formula", () => {
  const r = parseNewsletter(FIVE);
  assert.equal(r.ok, true);
  const f = r.fields;
  assert.equal(f.hook,    "Hook-Satz.");
  assert.equal(f.story,   "Geschichte-Satz.");
  assert.equal(f.analyse, "Analyse-Satz.");
  assert.equal(f.spur,    "Spur-Satz.");
  assert.equal(f.pointe,  "Conclusio-Satz.");
  assert.equal(f.schluss, FIXED_SCHLUSS);
});

test("4-paragraph fallback: no hook (old shape), injects fixed schluss", () => {
  const r = parseNewsletter(FOUR);
  assert.equal(r.ok, true);
  const f = r.fields;
  assert.equal(f.hook,    "");
  assert.equal(f.story,   "Geschichte-Satz.");
  assert.equal(f.analyse, "Analyse-Satz.");
  assert.equal(f.spur,    "Spur-Satz.");
  assert.equal(f.pointe,  "Conclusio-Satz.");
  assert.equal(f.schluss, FIXED_SCHLUSS);
});

test("runs of blank lines between paragraphs are collapsed", () => {
  const messy = SIX.replace(/\n\n/g, "\n\n\n");
  const r = parseNewsletter(messy);
  assert.equal(r.ok, true);
  assert.equal(r.fields.hook,    "Was kostet Schweigen wirklich?");
  assert.equal(r.fields.story,   "Ein Paar sitzt am Küchentisch und sagt nichts.");
  assert.equal(r.fields.schluss, MARKER);
});

test("CRLF line endings are handled", () => {
  const r = parseNewsletter(SIX.replace(/\n/g, "\r\n"));
  assert.equal(r.ok, true);
  assert.equal(r.fields.hook,    "Was kostet Schweigen wirklich?");
  assert.equal(r.fields.schluss, MARKER);
});

test("missing label: logs silently, headline field is empty string", () => {
  const noTitle = SIX.split("\n").filter(l => !l.startsWith("Titel:")).join("\n");
  const r = parseNewsletter(noTitle);
  assert.equal(r.ok, true);
  assert.equal(r.fields.headline, "");
});

test("missing marker phrase: logs silently and send proceeds", () => {
  const noMarker = SIX.replace(MARKER, "Ein gewöhnlicher Schlusssatz ohne Marker.");
  const r = parseNewsletter(noMarker);
  assert.equal(r.ok, true);
  assert.equal(r.fields.schluss, "Ein gewöhnlicher Schlusssatz ohne Marker.");
});
