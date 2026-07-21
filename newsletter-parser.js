// Deterministic parser for the tag-based German newsletter shape the assistant emits.
// PURE string slicing — no LLM call, no rewording. Field content reaches Brevo
// byte-for-byte (only surrounding whitespace is trimmed).
//
// Expected model output shape:
//   Betreff: <subject>
//   Preheader: <preheader>
//   Titel: <headline>
//   (blank line)
//   [HOOK]
//   <hook paragraph>
//   [GESCHICHTE]
//   <story paragraph>
//   [ANALYSE]
//   <analyse paragraph>
//   [SPUR]
//   <spur paragraph> (may contain two paragraphs separated by a blank line)
//   [CONCLUSIO]
//   <conclusio paragraph>
//   [MARKERSATZ]
//   <markersatz paragraph>
//   [SCHLUSSSATZ]
//   <schlusssatz paragraph — contains {{ contact.FIRSTNAME }} — preserve verbatim>
//
// Always returns { header, sections }. Missing/out-of-order tags → best-effort,
// logged to console only. No error is ever surfaced to the user.
(function (root) {
  "use strict";

  var NL_TAGS = ["HOOK", "GESCHICHTE", "ANALYSE", "SPUR", "CONCLUSIO", "MARKERSATZ", "SCHLUSSSATZ"];

  // Returns { header: { betreff, preheader, titel }, sections: { hook, geschichte, ... } }
  function parseNewsletter(raw) {
    var text = String(raw == null ? "" : raw);

    var header = {};
    function grab(label) {
      var m = text.match(new RegExp("^" + label + ":[ \\t]*(.*)$", "m"));
      return m ? m[1].trim() : "";
    }
    header.betreff   = grab("Betreff");
    header.preheader = grab("Preheader");
    header.titel     = grab("Titel");

    var sections = {};
    var tagRe = /^\[(HOOK|GESCHICHTE|ANALYSE|SPUR|CONCLUSIO|MARKERSATZ|SCHLUSSSATZ)\][ \t]*$/gim;
    var marks = [];
    var m;
    while ((m = tagRe.exec(text)) !== null) {
      marks.push({ tag: m[1].toUpperCase(), contentStart: tagRe.lastIndex, tagStart: m.index });
    }
    for (var i = 0; i < marks.length; i++) {
      var end = i + 1 < marks.length ? marks[i + 1].tagStart : text.length;
      var content = text.slice(marks[i].contentStart, end);
      // Trim only leading/trailing newlines, not internal blank lines (SPUR may have two paragraphs).
      content = content.replace(/^\n+/, "").replace(/\n+$/, "");
      sections[marks[i].tag.toLowerCase()] = content;
    }

    NL_TAGS.forEach(function (tag) {
      if (!sections[tag.toLowerCase()]) {
        console.log("[newsletter-parser] missing or empty tag: [" + tag + "]");
      }
    });

    return { header: header, sections: sections };
  }

  // Reader-facing body: removes [TAG] lines, collapses runs of 3+ newlines, trims.
  // Safe to call on any tab — the regex is a no-op if no tags are present.
  // Preserves {{ contact.FIRSTNAME }} verbatim.
  function stripTags(raw) {
    return String(raw == null ? "" : raw)
      .replace(/^\[(?:HOOK|GESCHICHTE|ANALYSE|SPUR|CONCLUSIO|MARKERSATZ|SCHLUSSSATZ)\][ \t]*\r?\n?/gim, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  root.parseNewsletter = parseNewsletter;
  root.stripTags = stripTags;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { parseNewsletter: parseNewsletter, stripTags: stripTags };
  }
})(typeof window !== "undefined" ? window : globalThis);
