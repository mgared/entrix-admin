import React, { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  Timestamp, // ✅ add
} from "firebase/firestore";
import { db } from "../../lib/firebase";

// --- add near the top (same file) ---
function esc(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ---- helpers for shift option parsing ----
function parseStartMinutes(optionStr) {
  // expects formats like "7AM - 3PM" or "7:00AM - 3:00PM"
  const left = (optionStr || "").split("-")[0]?.trim() || "";
  const m = left.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i);
  if (!m) return null;

  let h = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  const ap = (m[3] || "").toUpperCase();

  if (ap === "AM") {
    if (h === 12) h = 0;
  } else {
    if (h !== 12) h += 12;
  }

  return h * 60 + min; // 0..1439
}

function circularDiffMinutes(a, b) {
  const d = Math.abs(a - b);
  return Math.min(d, 1440 - d);
}

function pickShiftOption(shiftOptions, now = new Date()) {
  if (!Array.isArray(shiftOptions) || shiftOptions.length === 0) return "";
  if (shiftOptions.length === 1) return shiftOptions[0];

  const nowMins = now.getHours() * 60 + now.getMinutes();

  let best = shiftOptions[0];
  let bestDiff = Infinity;

  for (const opt of shiftOptions) {
    const start = parseStartMinutes(opt);
    if (start == null) continue;
    const diff = circularDiffMinutes(nowMins, start);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = opt;
    }
  }

  // chooses closest start time (good default)
  return best;
}

function formatShiftStartLabel(optionStr) {
  const mins = parseStartMinutes(optionStr);
  if (mins == null) {
    return new Date()
      .toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
      .toLowerCase();
  }

  let h24 = Math.floor(mins / 60);
  const m = mins % 60;

  const ampm = h24 >= 12 ? "pm" : "am";
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;

  const hh = String(h12).padStart(2, "0");
  const mm = String(m).padStart(2, "0");
  return `${hh}:${mm}${ampm}`; // e.g. 07:00am
}

function formatTimeCompact(date) {
  // "03:00pm"
  return date
    .toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
    .replace(" ", "")
    .toLowerCase();
}

function computeShiftStartDate(optionStr, now = new Date()) {
  const mins = parseStartMinutes(optionStr);
  if (mins == null) return now;

  const d = new Date(now);
  d.setHours(Math.floor(mins / 60), mins % 60, 0, 0);

  // Optional overnight shift fix:
  // If start time is "way in the future" relative to now, assume it was yesterday.
  // (Example: now is 1:00am, shift start is 11:00pm -> should be yesterday)
  const diffMs = d.getTime() - now.getTime();
  if (diffMs > 8 * 60 * 60 * 1000) {
    d.setDate(d.getDate() - 1);
  }

  return d;
}

export default function StartShiftLogModal({
  buildingId,
  buildingName,
  locationLabel,
  admin,
  onClose,
  onStarted,
}) {
  // account name fallback
  const accountName =
    admin?.name || admin?.fullName || admin?.displayName || admin?.email || "";

  const storageKey = useMemo(
    () => `shiftlog:lastConciergeName:${buildingId || "unknown"}`,
    [buildingId]
  );

  const [saving, setSaving] = useState(false);

  // pulled from Properties/{id}.shiftLogHelper
  const [propertyLabel, setPropertyLabel] = useState("");
  const [shiftOptions, setShiftOptions] = useState([]);
  const [shiftTimeLabel, setShiftTimeLabel] = useState("");

  // ✅ NEW: concierge name is editable
  const [conciergeName, setConciergeName] = useState("");
  const [touchedName, setTouchedName] = useState(false);

  // load helper from property doc
  useEffect(() => {
    let cancelled = false;

    async function loadHelper() {
      if (!buildingId) return;

      try {
        const ref = doc(db, "Properties", buildingId);
        const snap = await getDoc(ref);

        const helper = snap.exists() ? snap.data()?.shiftLogHelper : null;
        const pl = (helper?.propertyLabel || "").trim();
        const opts = Array.isArray(helper?.shiftOptions)
          ? helper.shiftOptions
          : [];

        if (cancelled) return;

        setPropertyLabel(pl);
        setShiftOptions(opts);

        const auto = pickShiftOption(opts, new Date());
        setShiftTimeLabel(auto || "");
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setPropertyLabel("");
          setShiftOptions([]);
          setShiftTimeLabel("");
        }
      }
    }

    loadHelper();
    return () => {
      cancelled = true;
    };
  }, [buildingId]);

  // ✅ NEW: autofill conciergeName from localStorage or accountName
  useEffect(() => {
    if (!buildingId) return;
    if (touchedName) return;

    let last = "";
    try {
      last = localStorage.getItem(storageKey) || "";
    } catch {}

    setConciergeName((last || accountName || "").trim());
  }, [buildingId, storageKey, accountName, touchedName]);

  const loc = propertyLabel || locationLabel || buildingName || "Front Desk";

  const canStart = useMemo(() => {
    if (!buildingId) return false;
    if (!(conciergeName || "").trim()) return false;

    // if you have shiftOptions configured, require a selection
    if (shiftOptions.length > 0 && !shiftTimeLabel) return false;

    return true;
  }, [buildingId, conciergeName, shiftOptions.length, shiftTimeLabel]);

  const startShift = async () => {
    if (!canStart) return;

    const nameToSave = (conciergeName || "").trim();
    if (!nameToSave) {
      alert("Please enter a concierge name.");
      return;
    }

    try {
      setSaving(true);

      // ✅ remember last used name for this building
      try {
        localStorage.setItem(storageKey, nameToSave);
      } catch {}

      const colRef = collection(db, "Properties", buildingId, "shiftLogs");

      // Create first entry now (inside the doc creation)
      const entryId = crypto.randomUUID();
      const shiftStartDate = computeShiftStartDate(shiftTimeLabel, new Date());
      const timeLabel = formatTimeCompact(shiftStartDate);
      const firstOccurredAt = Timestamp.fromDate(shiftStartDate); // ✅ matches label

      // ✅ use conciergeName (not account name)
      // ✅ store both text + html (and keep legacy sentence for older code)
      const firstSentenceText = `${timeLabel} - ${nameToSave} on site. Retrieved concierge keys.`;
      const firstSentenceHtml = `<b>${esc(timeLabel)}</b> - <b>${esc(
        nameToSave
      )}</b> on site. Retrieved concierge keys.`;

      await addDoc(colRef, {
        conciergeName: nameToSave,
        conciergeId: admin?.id || null,

        propertyId: buildingId,
        locationLabel: loc,
        propertyLabel: propertyLabel || "",

        // shift option chosen from helper
        shiftTimeLabel: shiftTimeLabel || "",

        shiftStart: serverTimestamp(),
        status: "open",
        createdAt: serverTimestamp(),

        entries: {
          [entryId]: {
            id: entryId,
            sentenceText: firstSentenceText,
            sentenceHtml: firstSentenceHtml,
            sentence: firstSentenceText,
            // ✅ NEW

            createdAt: serverTimestamp(),
            occurredAt: firstOccurredAt, // ✅ consistent
            createdBy: admin?.id || admin?.name || null,
            system: true,
          },
        },

        incidentEntryIds: [],
        moveInOutEntryIds: [],
        highlightPropertyManagerEntryIds: [],
        highlightMaintenanceEntryIds: [],
        highlightConciergeTeamEntryIds: [],
      });

      onStarted?.();
    } catch (e) {
      console.error(e);
      alert(e?.message || "Failed to start shift log.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="add-booking-modal" role="dialog" aria-modal="true">
      <div className="add-booking-card admin-theme">
        <div className="add-booking-header">
          <div>
            <p className="add-booking-kicker">SHIFT LOG</p>
            <h2>Start Shift Log</h2>
            <p className="muted" style={{ padding: 0 }}>
              {buildingName} • {loc}
            </p>
          </div>

          <button className="add-close-btn" type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="add-booking-grid">
          <div>
            <div className="field-label">Shift log label</div>
            <input className="field-input modal-input" value={loc} disabled />
          </div>

          <div>
            <div className="field-label">Shift</div>

            {shiftOptions.length === 0 ? (
              <input
                className="field-input modal-input"
                value={shiftTimeLabel || ""}
                onChange={(e) => setShiftTimeLabel(e.target.value)}
                placeholder="Set shiftLogHelper.shiftOptions to enable dropdown"
              />
            ) : (
              <select
                className="field-input modal-input"
                value={shiftTimeLabel}
                onChange={(e) => setShiftTimeLabel(e.target.value)}
              >
                <option value="" disabled>
                  Select shift…
                </option>
                {shiftOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* ✅ NEW UI: concierge name (full width) */}
          <div style={{ gridColumn: "1 / -1" }}>
            <div className="field-label">Concierge name</div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <input
                className="field-input modal-input"
                value={conciergeName}
                onChange={(e) => {
                  setTouchedName(true);
                  setConciergeName(e.target.value);
                }}
                placeholder="Type concierge name…"
              />

              <button
                className="clear-light-btn admin"
                type="button"
                onClick={() => {
                  setTouchedName(true);
                  setConciergeName("");
                }}
                disabled={saving}
              >
                Clear
              </button>

              <button
                className="clear-light-btn admin"
                type="button"
                onClick={() => {
                  setTouchedName(true);
                  setConciergeName((accountName || "").trim());
                }}
                disabled={saving}
              >
                Use account name
              </button>
            </div>

            <p className="muted" style={{ padding: 0, marginTop: 6 }}>
              Saved on this shift log (useful when multiple concierges share one
              login).
            </p>
          </div>
        </div>

        <div className="add-booking-actions">
          <button
            className="submit-wide-btn admin"
            type="button"
            disabled={!canStart || saving}
            onClick={startShift}
          >
            {saving ? "Starting…" : "Start"}
          </button>

          <button
            className="clear-light-btn admin"
            type="button"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
