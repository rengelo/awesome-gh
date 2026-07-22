// stripTags — safety net for any legacy stored messages that still carry [TAG] markers.
// Safe to call on any text; is a no-op if no tags are present.
// Preserves {{ contact.FIRSTNAME }} verbatim.
(function (root) {
  "use strict";

  function stripTags(raw) {
    return String(raw == null ? "" : raw)
      .replace(/^\[(?:HOOK|GESCHICHTE|ANALYSE|SPUR|CONCLUSIO|MARKERSATZ|SCHLUSSSATZ)\][ \t]*\r?\n?/gim, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  root.stripTags = stripTags;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { stripTags: stripTags };
  }
})(typeof window !== "undefined" ? window : globalThis);
