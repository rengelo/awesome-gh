// Tests for the deterministic newsletter parser used by the "Send to make.com" path.
// Run:  node --test
const test = require("node:test");
const assert = require("node:assert/strict");
const { parseNewsletter } = require("./newsletter-parser.js");

const MARKER = "Das lässt sich in einem ersten Gespräch herausfinden.";

// Paragraphs are separated by a BLANK line (the assistant's fixed shape).
function build(header, bodyParas) {
  return header.join("\n") + "\n\n" + bodyParas.join("\n\n");
}

// 5-paragraph body: Geschichte, Analyse, Spur (1), Conclusio, Markersatz.
const FIVE = build(
  ["Betreff: Wenn Stille teurer wird als Streit",
   "Preheader: Warum Schweigen selten spart",
   "Titel: Die Kosten des Nichtgesagten"],
  ["Ein Paar sitzt am Küchentisch und sagt nichts.",
   "Schweigen wirkt wie Sparen, kostet aber Zinsen.",
   "Wer früh spricht, zahlt weniger Aufschlag.",
   "Am Ende bleibt die Frage, was Nähe wirklich wert ist.",
   MARKER]
);

// 6-paragraph body: Spur spans TWO paragraphs. Also exercises EN labels.
const SIX = build(
  ["Subject: Zweites Beispiel",
   "Vorschau: Mit längerer Spur",
   "Überschrift: Sechs Absätze"],
  ["Geschichte-Absatz.",
   "Analyse-Absatz.",
   "Spur-Absatz eins.",
   "Spur-Absatz zwei.",
   "Conclusio-Satz.",
   MARKER]
);

test("5-paragraph newsletter maps every field", () => {
  const r = parseNewsletter(FIVE);
  assert.equal(r.ok, true);
  const f = r.fields;
  assert.equal(f.subject, "Wenn Stille teurer wird als Streit");
  assert.equal(f.preheader, "Warum Schweigen selten spart");
  assert.equal(f.headline, "Die Kosten des Nichtgesagten");
  assert.equal(f.story, "Ein Paar sitzt am Küchentisch und sagt nichts.");
  assert.equal(f.analyse, "Schweigen wirkt wie Sparen, kostet aber Zinsen.");
  assert.equal(f.spur, "Wer früh spricht, zahlt weniger Aufschlag.");
  assert.equal(f.spur_1, "Wer früh spricht, zahlt weniger Aufschlag.");
  assert.equal(f.spur_2, "");
  assert.equal(f.conclusio, "Am Ende bleibt die Frage, was Nähe wirklich wert ist.");
  assert.equal(f.schluss, MARKER);
});

test("6-paragraph newsletter joins the two Spur paragraphs with a blank line", () => {
  const r = parseNewsletter(SIX);
  assert.equal(r.ok, true);
  const f = r.fields;
  assert.equal(f.subject, "Zweites Beispiel");
  assert.equal(f.preheader, "Mit längerer Spur");
  assert.equal(f.headline, "Sechs Absätze");
  assert.equal(f.story, "Geschichte-Absatz.");
  assert.equal(f.analyse, "Analyse-Absatz.");
  assert.equal(f.spur, "Spur-Absatz eins.\n\nSpur-Absatz zwei.");
  assert.equal(f.spur_1, "Spur-Absatz eins.");
  assert.equal(f.spur_2, "Spur-Absatz zwei.");
  assert.equal(f.conclusio, "Conclusio-Satz.");
  assert.equal(f.schluss, MARKER);
});

test("runs of blank lines between paragraphs are collapsed", () => {
  const messy = FIVE.replace(/\n\n/g, "\n\n\n"); // widen every gap to two blank lines
  const r = parseNewsletter(messy);
  assert.equal(r.ok, true);
  assert.equal(r.fields.story, "Ein Paar sitzt am Küchentisch und sagt nichts.");
  assert.equal(r.fields.spur, "Wer früh spricht, zahlt weniger Aufschlag.");
  assert.equal(r.fields.schluss, MARKER);
});

test("CRLF line endings are handled", () => {
  const r = parseNewsletter(FIVE.replace(/\n/g, "\r\n"));
  assert.equal(r.ok, true);
  assert.equal(r.fields.schluss, MARKER);
});

test("rejects when a label is missing", () => {
  const noTitle = FIVE.split("\n").filter(l => !l.startsWith("Titel:")).join("\n");
  const r = parseNewsletter(noTitle);
  assert.equal(r.ok, false);
  assert.match(r.reason, /Titel|Headline|Überschrift/);
});

test("rejects when there are fewer than 5 body paragraphs", () => {
  const short = build(
    ["Betreff: zu kurz", "Preheader: x", "Titel: y"],
    ["Eins.", "Zwei.", "Drei.", MARKER] // 4 body paragraphs
  );
  const r = parseNewsletter(short);
  assert.equal(r.ok, false);
  assert.match(r.reason, /at least 5 body paragraphs/);
});

test("rejects when the final paragraph lacks the marker phrase", () => {
  const noMarker = FIVE.replace(MARKER, "Ein gewöhnlicher Schlusssatz ohne Marker.");
  const r = parseNewsletter(noMarker);
  assert.equal(r.ok, false);
  assert.match(r.reason, /final paragraph/);
});
