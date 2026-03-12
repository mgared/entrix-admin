// src/features/shiftlogs/shiftLogHelpers.js
function toMillis(t) {
  if (!t) return 0;
  if (typeof t.toMillis === "function") return t.toMillis();
  if (t instanceof Date) return t.getTime();
  return new Date(t).getTime();
}

function esc(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function hourOfEntry(e) {
  const ms = toMillis(e?.createdAt);
  if (ms) return new Date(ms).getHours();
  return null;
}

function pickText(e) {
  return e?.sentenceText || e?.sentence || "—";
}
function pickHtml(e) {
  return e?.sentenceHtml || esc(pickText(e));
}

function addSection({ title, ids, entriesById, textOut, htmlOut }) {
  textOut.push(title);
  htmlOut.push(`<b>${esc(title)}</b>`);

  const cleanIds = (ids || []).filter(Boolean);

  if (!cleanIds.length) {
    textOut.push("- N/A", "");
    htmlOut.push("- N/A", "<br/>");
    return;
  }

  for (const id of cleanIds) {
    const e = entriesById[id];
    if (!e) continue;

    const lineText = pickText(e);
    const lineHtml = pickHtml(e);

    const note = (e.additionalNote || "").trim();

    textOut.push(`- ${lineText}`);
    textOut.push(`- ${note ? note : "N/A"}`);

    htmlOut.push(`- ${lineHtml}`);
    htmlOut.push(`- ${note ? esc(note) : "N/A"}`);
  }

  // blank line after section
  textOut.push("");
  htmlOut.push("<br/>");
}

export function buildPreviewEmail({ shiftLog, buildingName, locationLabel }) {
  const entriesMap = shiftLog.entries || {};

  // preserve ids + ordering
  const entryPairs = Object.entries(entriesMap)
    .map(([id, e]) => (e ? [id, e] : null))
    .filter(Boolean);

  const sortedPairs = entryPairs.sort(
    (a, b) => toMillis(a[1].createdAt) - toMillis(b[1].createdAt)
  );

  const entriesById = {};
  for (const [id, e] of sortedPairs) entriesById[id] = e;

  // ---- main body with hour-gap spacing ----
  const linesText = [];
  const linesHtml = [];
  let prevHour = null;

  for (const [, e] of sortedPairs) {
    const h = hourOfEntry(e);
    if (prevHour !== null && h !== null && h !== prevHour) {
      linesText.push("");
      linesHtml.push("");
    }
    linesText.push(pickText(e));
    linesHtml.push(pickHtml(e));
    if (h !== null) prevHour = h;
  }

  // ---- flag summary section at bottom ----
  const summaryText = [];
  const summaryHtml = [];

  summaryText.push("", ""); // spacing before summary
  summaryHtml.push("<br/>", "<br/>");

  addSection({
    title: "Concierge Passes of Important Log and notes",
    ids: shiftLog.highlightConciergeTeamEntryIds || [],
    entriesById,
    textOut: summaryText,
    htmlOut: summaryHtml,
  });

  addSection({
    title: "Move in Move Outs",
    ids: shiftLog.moveInOutEntryIds || [],
    entriesById,
    textOut: summaryText,
    htmlOut: summaryHtml,
  });

  addSection({
    title: "Property Managers: highlight logs and notes",
    ids: shiftLog.highlightPropertyManagerEntryIds || [],
    entriesById,
    textOut: summaryText,
    htmlOut: summaryHtml,
  });

  addSection({
    title: "Maintenance: Notes and highlight logs",
    ids: shiftLog.highlightMaintenanceEntryIds || [],
    entriesById,
    textOut: summaryText,
    htmlOut: summaryHtml,
  });

  addSection({
    title: "Incident reports",
    ids: shiftLog.incidentEntryIds || [],
    entriesById,
    textOut: summaryText,
    htmlOut: summaryHtml,
  });

  const bodyText = [...linesText, ...summaryText].join("\n");
  const bodyHtml = [...linesHtml, ...summaryHtml].join("<br/>");

  const conciergeName = shiftLog.conciergeName || "Concierge";
  const loc =
    shiftLog.propertyLabel ||
    shiftLog.locationLabel ||
    locationLabel ||
    buildingName ||
    "Front Desk";

  const shiftTime =
    shiftLog.shiftTimeLabel || shiftLog.shiftLabel || shiftLog.shiftTime || "—";

  const date = shiftLog.shiftStart
    ? new Date(toMillis(shiftLog.shiftStart)).toLocaleDateString("en-US")
    : new Date().toLocaleDateString("en-US");

  const subject = `${loc} | ${shiftTime} | ${date} | ${conciergeName}`;

  return { subject, bodyText, bodyHtml };
}
