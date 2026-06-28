// Deterministic parser for the fixed German newsletter shape the assistant emits.
// PURE string slicing — no LLM call, no rewording. Field content reaches Brevo
// byte-for-byte (only surrounding whitespace is trimmed). Used by the
// "Send to make.com" path to split the reply into named fields.
//
// Always produces exactly 5 body fields: story, analyse, spur, pointe, schluss.
// Paragraph-count fallbacks (see mapParagraphs) handle structural variation
// silently — no error is ever surfaced to the user for body shape mismatches.
//
// Newsletter shape (canonical — 5 body paragraphs):
//   Betreff: <subject>
//   Preheader: <preheader>
//   Titel: <headline>
//   <blank line>
//   <Geschichte>   P1 → story
//   <Analyse>      P2 → analyse
//   <Spur>         P3 → spur
//   <Conclusio>    P4 → pointe
//   <Markersatz>   P5 → schluss
//
// Always returns { ok: true, fields }. Structural issues are logged to the console
// only — no error is ever surfaced to the user.
(function (root) {
  "use strict";

  var MARKER_PHRASE = "lässt sich in einem ersten Gespräch";
  var FIXED_SCHLUSS = "Ob das auf Ihre Situation zutrifft, lässt sich in einem ersten Gespräch herausfinden.";

  function mapParagraphs(paras) {
    var len = paras.length;

    // Canonical 5-paragraph shape.
    if (len === 5) {
      return {
        story:   paras[0],
        analyse: paras[1],
        spur:    paras[2],
        pointe:  paras[3],
        schluss: paras[4]
      };
    }

    // 6 paragraphs: merge P3 + P4 into spur.
    if (len === 6) {
      return {
        story:   paras[0],
        analyse: paras[1],
        spur:    paras[2] + "\n\n" + paras[3],
        pointe:  paras[4],
        schluss: paras[5]
      };
    }

    // 4 paragraphs: inject the fixed schluss formula.
    if (len === 4) {
      return {
        story:   paras[0],
        analyse: paras[1],
        spur:    paras[2],
        pointe:  paras[3],
        schluss: FIXED_SCHLUSS
      };
    }

    // Best-effort for any other count (3 or fewer, 7 or more).
    // Middle paragraphs (beyond P2 and before the last two) are appended to spur.
    console.log("[newsletter-parser] unexpected paragraph count: " + len);
    var spurEnd = Math.max(2, len - 2);
    return {
      story:   paras[0] || "",
      analyse: paras[1] || "",
      spur:    paras.slice(2, spurEnd).join("\n\n"),
      pointe:  paras[len - 2] || "",
      schluss: paras[len - 1] || ""
    };
  }

  function parseNewsletter(raw) {
    var text = String(raw == null ? "" : raw).replace(/\r\n?/g, "\n");
    var lines = text.split("\n");

    function findLabel(re) {
      for (var i = 0; i < lines.length; i++) {
        var m = lines[i].match(re);
        if (m) return { idx: i, value: m[1].trim() };
      }
      return null;
    }

    var subject   = findLabel(/^\s*(?:Betreff|Subject)\s*:\s*(.*)$/i);
    var preheader = findLabel(/^\s*(?:Preheader|Vorschau)\s*:\s*(.*)$/i);
    var headline  = findLabel(/^\s*(?:Titel|Headline|Überschrift)\s*:\s*(.*)$/i);

    if (!subject)   console.log("[newsletter-parser] missing Betreff/Subject label");
    if (!preheader) console.log("[newsletter-parser] missing Preheader/Vorschau label");
    if (!headline)  console.log("[newsletter-parser] missing Titel/Headline/Überschrift label");

    // body = everything after the headline line (or the full text if no headline found).
    var bodyStart = headline ? headline.idx + 1 : 0;
    var bodyText = lines.slice(bodyStart).join("\n");
    var paras = bodyText
      .split(/\n[ \t]*\n+/)
      .map(function (p) { return p.trim(); })
      .filter(function (p) { return p.length > 0; });

    var body = mapParagraphs(paras);

    if (body.schluss.indexOf(MARKER_PHRASE) === -1) {
      console.log("[newsletter-parser] schluss missing marker phrase — proceeding anyway");
    }

    return {
      ok: true,
      fields: {
        subject:  subject  ? subject.value  : "",
        preheader: preheader ? preheader.value : "",
        headline: headline ? headline.value : "",
        story:    body.story,
        analyse:  body.analyse,
        spur:     body.spur,
        pointe:   body.pointe,
        schluss:  body.schluss
      }
    };
  }

  root.parseNewsletter = parseNewsletter;
  if (typeof module !== "undefined" && module.exports) module.exports = { parseNewsletter: parseNewsletter };
})(typeof window !== "undefined" ? window : globalThis);
