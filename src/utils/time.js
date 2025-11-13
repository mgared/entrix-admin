export function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatShortDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function formatSignedOut(value) {
  if (!value) return "—";
  return formatDateTime(value);
}

export function formatTimeLabel(time24) {
  if (!time24) return "";
  const [hStr, mStr] = time24.split(":");
  let h = parseInt(hStr, 10);
  const m = mStr || "00";
  const ampm = h >= 12 ? "PM" : "AM";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${m} ${ampm}`;
}

export function computeEndTime(startTime, durationMinutes) {
  // returns end time as HH:MM (24-hour) string
  if (!startTime || durationMinutes == null) return "";
  const [hStr, mStr] = startTime.split(":");
  const h = parseInt(hStr, 10) || 0;
  const m = parseInt(mStr || "0", 10) || 0;
  const base = new Date();
  base.setHours(h, m, 0, 0);
  const end = new Date(base.getTime() + durationMinutes * 60000);
  const hh = String(end.getHours()).padStart(2, "0");
  const mm = String(end.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}