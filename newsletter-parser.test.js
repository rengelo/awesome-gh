// Tests for the tag-based newsletter parser.
// Run:  node --test
const test = require("node:test");
const assert = require("node:assert/strict");
const { parseNewsletter, stripTags } = require("./newsletter-parser.js");

// Spec fixture (placeholder content, not a real newsletter).
const FIXTURE = `Betreff: Test
Preheader: Test
Titel: Test

[HOOK]
Hook-Satz eins. Hook-Satz zwei.
[GESCHICHTE]
Geschichte-Absatz.
[ANALYSE]
Analyse-Absatz.
[SPUR]
Spur-Absatz eins.

Spur-Absatz zwei.
[CONCLUSIO]
Conclusio-Satz.
[MARKERSATZ]
Markersatz.
[SCHLUSSSATZ]
{{ contact.FIRSTNAME }}, ob das auf Ihre Situation zutrifft, lässt sich in einem ersten Gespräch herausfinden.`;

test("header fields are parsed correctly", () => {
  const { header } = parseNewsletter(FIXTURE);
  assert.equal(header.betreff,   "Test");
  assert.equal(header.preheader, "Test");
  assert.equal(header.titel,     "Test");
});

test("all seven body sections are parsed", () => {
  const { sections } = parseNewsletter(FIXTURE);
  assert.equal(sections.hook,        "Hook-Satz eins. Hook-Satz zwei.");
  assert.equal(sections.geschichte,  "Geschichte-Absatz.");
  assert.equal(sections.analyse,     "Analyse-Absatz.");
  assert.equal(sections.conclusio,   "Conclusio-Satz.");
  assert.equal(sections.markersatz,  "Markersatz.");
});

test("spur preserves internal blank line between two paragraphs", () => {
  const { sections } = parseNewsletter(FIXTURE);
  assert.equal(sections.spur, "Spur-Absatz eins.\n\nSpur-Absatz zwei.");
});

test("schlusssatz preserves {{ contact.FIRSTNAME }} verbatim", () => {
  const { sections } = parseNewsletter(FIXTURE);
  assert.ok(sections.schlusssatz.includes("{{ contact.FIRSTNAME }}"),
    "schlusssatz must contain {{ contact.FIRSTNAME }}");
});

test("schluss payload field joins markersatz + schlusssatz with blank line, token intact", () => {
  const { sections } = parseNewsletter(FIXTURE);
  const schluss = [sections.markersatz, sections.schlusssatz].filter(Boolean).join("\n\n");
  assert.equal(schluss, "Markersatz.\n\n{{ contact.FIRSTNAME }}, ob das auf Ihre Situation zutrifft, lässt sich in einem ersten Gespräch herausfinden.");
  assert.ok(schluss.includes("{{ contact.FIRSTNAME }}"), "token must survive join");
});

test("stripTags: output contains no [ character and no tag names", () => {
  const stripped = stripTags(FIXTURE);
  assert.ok(!stripped.includes("["), "no [ bracket in stripped output");
  assert.ok(!stripped.includes("HOOK"),       "no HOOK in stripped output");
  assert.ok(!stripped.includes("GESCHICHTE"), "no GESCHICHTE in stripped output");
  assert.ok(!stripped.includes("SCHLUSSSATZ"),"no SCHLUSSSATZ in stripped output");
});

test("stripTags: preserves {{ contact.FIRSTNAME }} verbatim", () => {
  const stripped = stripTags(FIXTURE);
  assert.ok(stripped.includes("{{ contact.FIRSTNAME }}"), "token must survive stripTags");
});

test("stripTags: prose content is intact", () => {
  const stripped = stripTags(FIXTURE);
  assert.ok(stripped.includes("Hook-Satz eins."));
  assert.ok(stripped.includes("Geschichte-Absatz."));
  assert.ok(stripped.includes("Spur-Absatz eins."));
  assert.ok(stripped.includes("Spur-Absatz zwei."));
});

test("missing tag: logs silently, section is absent, send still returns ok structure", () => {
  const noHook = FIXTURE.replace("[HOOK]\nHook-Satz eins. Hook-Satz zwei.\n", "");
  const { sections } = parseNewsletter(noHook);
  // hook key should be absent or empty — no throw
  assert.ok(!sections.hook, "hook should be missing/empty");
  // other sections unaffected
  assert.equal(sections.geschichte, "Geschichte-Absatz.");
});

test("CRLF line endings are handled", () => {
  const crlf = FIXTURE.replace(/\n/g, "\r\n");
  const { header, sections } = parseNewsletter(crlf);
  assert.equal(header.betreff, "Test");
  assert.ok(sections.schlusssatz.includes("{{ contact.FIRSTNAME }}"));
  const stripped = stripTags(crlf);
  assert.ok(!stripped.includes("["));
});
