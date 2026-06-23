// Deterministic parser for the fixed German newsletter shape the assistant emits.
// PURE string slicing — no LLM call, no rewording. Field content reaches Brevo
// byte-for-byte (only surrounding whitespace is trimmed). Used by the
// "Send to make.com" path to split the reply into named fields.
//
// Newsletter shape:
//   Betreff: <subject>
//   Preheader: <preheader>
//   Titel: <headline>
//   <blank line>
//   <Geschichte>        (paragraph 1)
//   <Analyse>           (paragraph 2)
//   <Spur>              (1-2 paragraphs)
//   <Conclusio>         (second-to-last paragraph)
//   <Markersatz>        (last paragraph; ends with the fixed phrase)
//
// Returns { ok: true, fields } or { ok: false, reason }.
(function (root) {
  "use strict";

  var MARKER_PHRASE = "lässt sich in einem ersten Gespräch";

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

    if (!subject)   return { ok: false, reason: "missing Betreff/Subject label" };
    if (!preheader) return { ok: false, reason: "missing Preheader/Vorschau label" };
    if (!headline)  return { ok: false, reason: "missing Titel/Headline/Überschrift label" };

    // body = everything after the headline line; split on blank lines (runs collapsed).
    var bodyText = lines.slice(headline.idx + 1).join("\n");
    var paras = bodyText
      .split(/\n[ \t]*\n+/)
      .map(function (p) { return p.trim(); })
      .filter(function (p) { return p.length > 0; });

    if (paras.length < 5) {
      return { ok: false, reason: "expected at least 5 body paragraphs, found " + paras.length };
    }

    var markersatz = paras[paras.length - 1];
    if (markersatz.indexOf(MARKER_PHRASE) === -1) {
      return { ok: false, reason: 'final paragraph missing the phrase "' + MARKER_PHRASE + '"' };
    }

    var spurParas = paras.slice(2, paras.length - 2);
    return {
      ok: true,
      fields: {
        subject: subject.value,
        preheader: preheader.value,
        headline: headline.value,
        story: paras[0],
        analyse: paras[1],
        spur: spurParas.join("\n\n"),
        spur_1: spurParas[0] || "",
        spur_2: spurParas[1] || "",
        pointe: paras[paras.length - 2],
        schluss: markersatz,
      },
    };
  }

  root.parseNewsletter = parseNewsletter;
  if (typeof module !== "undefined" && module.exports) module.exports = { parseNewsletter: parseNewsletter };
})(typeof window !== "undefined" ? window : globalThis);
