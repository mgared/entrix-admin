// src/features/shiftlogs/EntryForm.jsx
import React, { useEffect, useMemo, useState } from "react";
import { addShiftEntry, updateShiftEntry } from "./shiftLogApi";
import { Timestamp } from "firebase/firestore";
import { useToast } from "../../components/feedback/useToast";

function formatTimeLabel(date) {
  const d = date instanceof Date ? date : new Date();
  return d
    .toLocaleTimeString("en-US", {
      hour: "2-digit", // ✅ pad hour
      minute: "2-digit",
      hour12: true,
    })
    .replace(" ", "")
    .toLowerCase(); // "07:00pm"
}

// datetime-local helpers (local time, no timezone surprises)
function toLocalDateTimeInputValue(dt) {
  const d = dt instanceof Date ? dt : new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function parseLocalDateTimeInputValue(v) {
  // expects "YYYY-MM-DDTHH:MM"
  const s = String(v || "").trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!m) return null;

  const yyyy = Number(m[1]);
  const MM = Number(m[2]);
  const dd = Number(m[3]);
  const hh = Number(m[4]);
  const mi = Number(m[5]);

  if (
    !Number.isFinite(yyyy) ||
    !Number.isFinite(MM) ||
    !Number.isFinite(dd) ||
    !Number.isFinite(hh) ||
    !Number.isFinite(mi)
  )
    return null;

  return new Date(yyyy, MM - 1, dd, hh, mi, 0, 0);
}

function toDateMaybe(ts) {
  if (!ts) return null;
  if (ts instanceof Date) return ts;
  if (typeof ts?.toDate === "function") return ts.toDate(); // Firestore Timestamp
  if (typeof ts === "object" && ts?.seconds != null) {
    const ms =
      Number(ts.seconds) * 1000 + Math.floor(Number(ts.nanoseconds || 0) / 1e6);
    return Number.isFinite(ms) ? new Date(ms) : null;
  }
  const ms = new Date(ts).getTime();
  return Number.isFinite(ms) ? new Date(ms) : null;
}

function toLocalTimeInputValue(dt) {
  const d = dt instanceof Date ? dt : new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`; // "22:08"
}

function applyTimeToDate(baseDate, hhmm) {
  const d = baseDate instanceof Date ? new Date(baseDate) : new Date();
  const s = String(hhmm || "").trim();
  const m = s.match(/^(\d{2}):(\d{2})$/);
  if (!m) return d;
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return d;
}

const RED = "#ff4d4f";

function esc(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function residentStarter(contactMethod) {
  return contactMethod === "calledIn" ? "Called in" : "Came to the front desk";
}

function buildSentence({
  form,
  roleLabel,
  reasonLabel,
  reasonDef,
  occurredDate,
  unitOnlyMode = false,
}) {
  const time = formatTimeLabel(occurredDate || new Date());

  const fullName = [form.firstName, form.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  const nameText = fullName || "";

  const company = (form.companyName || "").trim();

  const unit = (form.unitOrStreetNumber || "").trim();
  const building = (form.streetOrBuildingName || "").trim();

  const isResident = form.roleId === "resident";

  let addressText = "";
  let addressHtml = "";

  if (isResident && unitOnlyMode) {
    if (unit) {
      addressText = `in unit ${unit}`;
      addressHtml = ` in unit (<span style="color:${RED}"><b>${esc(
        unit
      )}</b></span>)`;
    }
  } else {
    const address = [unit, building].filter(Boolean).join(" ").trim();
    if (address) {
      addressText = `from ${address}`;
      addressHtml = ` from (<span style="color:${RED}"><b>${esc(
        address
      )}</b></span>)`;
    }
  }

  const finalReason =
    form.reasonText && !form.reasonId
      ? (form.reasonText || "").trim()
      : form.reasonId === "other"
      ? (form.customReason || "").trim()
      : (reasonLabel || "").trim();

  const note = (form.note || "").trim();
  const extraFields = reasonDef?.extraFields || [];

  const partsText = [];
  const partsHtml = [];

  // ✅ prospect/broker scheduling descriptor (comes BEFORE reason)
  const isSchedRole = form.roleId === "prospect" || form.roleId === "broker";
  if (isSchedRole) {
    if (form.scheduled) {
      const sw = (form.scheduledWith || "").trim();
      const t = sw ? `Scheduled with: ${sw}` : "Scheduled";
      partsText.push(t);
      partsHtml.push(esc(t));
    } else {
      partsText.push("Walk-in");
      partsHtml.push("Walk-in");
    }
  }

  // ✅ NEW: RESIDENT template + starter logic (replaces old "Reason" block)
  const starter =
    form.roleId === "resident" ? residentStarter(form.contactMethod) : "";

  const template = reasonDef?.template || finalReason; // fallback
  const templateStr = String(template || "");

  // ---------- TEXT TOKENS ----------
  function tokenText(name) {
    if (name === "desc") return (form.desc || "").trim();
    if (name === "desc2") return (form.desc2 || "").trim();
    if (name === "placedAt") return (form.placedAt || "").trim();
    if (name === "requestedStaff") return (form.requestedStaff || "").trim();
    if (name === "regarding") return (form.regarding || "").trim(); // ✅ ADD THIS
    if (name === "assistedStaff") return (form.assistedStaff || "").trim();
    if (name === "copyMadeText")
      return form.copyMade ? "Copy made and Signed" : "No copy Needed";
    return "";
  }

  function fillTemplateText(tpl) {
    return String(tpl || "").replace(
      /\{(\w+)\}/g,
      (_, key) => tokenText(key) || ""
    );
  }

  // ---------- HTML TOKENS ----------
  function tokenHtml(name) {
    const t = tokenText(name);
    if (!t) return "";

    // assistedStaff should be red (NOT bold)
    if (name === "assistedStaff") {
      return `<span style="color:${RED}"><b>${esc(t)}</b></span>`;
    }

    // requestedStaff should be bold
    if (name === "requestedStaff") {
      return `<b>${esc(t)}</b>`;
    }

    // these should be bold
    if (
      name === "desc" ||
      name === "desc2" ||
      name === "placedAt" ||
      name === "copyMadeText"
    ) {
      return `<b>${esc(t)}</b>`;
    }

    // default escaped
    return esc(t);
  }

  function fillTemplateHtml(tpl) {
    return String(tpl || "").replace(
      /\{(\w+)\}/g,
      (_, key) => tokenHtml(key) || ""
    );
  }

  // Build reason strings
  let reasonTextBuilt = template ? fillTemplateText(template).trim() : "";
  let reasonHtmlBuilt = template ? fillTemplateHtml(template).trim() : "";

  // Optional: if complaint desc is blank, auto-build from checkboxes
  if (form.reasonId === "complain" && !tokenText("desc")) {
    const tags = [];
    if (form.cSmell) tags.push("smell");
    if (form.cNoise) tags.push("noise");
    if (form.cDamage) tags.push("damage");
    if (form.cService) tags.push("service");
    if (tags.length) {
      reasonTextBuilt = `to complain about ${tags.join(", ")}.`;
      reasonHtmlBuilt = esc(reasonTextBuilt);
    }
  }

  // Push combined starter + reason
  if (reasonTextBuilt) {
    const combinedText =
      form.roleId === "resident" && starter
        ? `${starter} ${reasonTextBuilt}`
        : reasonTextBuilt;

    const combinedHtml =
      form.roleId === "resident" && starter
        ? `${esc(starter)} ${reasonHtmlBuilt || esc(reasonTextBuilt)}`
        : reasonHtmlBuilt || esc(reasonTextBuilt);

    partsText.push(combinedText);
    partsHtml.push(combinedHtml);
  }

  // ✅ residentsName in sentence (for residentGuest now, visitor later)
  const rn = (form.residentsName || "").trim();
  if (rn && (form.roleId === "residentGuest" || form.roleId === "visitor")) {
    partsText.push(`Visiting: ${rn}`);
    partsHtml.push(`Visiting: ${esc(rn)}`);
  }

  if (
    (form.requestedStaff || "").trim() &&
    !templateStr.includes("{requestedStaff}")
  ) {
    const v = (form.requestedStaff || "").trim();
    partsText.push(`Specifically Requested: ${v}`);
    partsHtml.push(`Specifically Requested: <b>${esc(v)}</b>`);
  }

  // if (extraFields.includes("copyMade")) {
  //   const t = form.copyMade ? "Copy made and Signed" : "No copy Needed";
  //   partsText.push(t);
  //   partsHtml.push(`<b>${esc(t)}</b>`);
  // }

  // const templateStr = String(template || "");

  // Only append Copy made / No copy Needed if NOT already used in the template
  if (
    extraFields.includes("copyMade") &&
    !templateStr.includes("{copyMadeText}")
  ) {
    const t = form.copyMade ? "Copy made and Signed" : "No copy Needed";
    partsText.push(t);
    partsHtml.push(`<b>${esc(t)}</b>`);
  }

  if (
    extraFields.includes("placedAt") &&
    (form.placedAt || "").trim() &&
    !templateStr.includes("{placedAt}")
  ) {
    const v = (form.placedAt || "").trim();
    partsText.push(`Placed at: ${v}`);
    partsHtml.push(`<b>Placed at:</b> <b>${esc(v)}</b>`);
  }

  if (
    extraFields.includes("regarding") &&
    (form.regarding || "").trim() &&
    !templateStr.includes("{regarding}")
  ) {
    const v = (form.regarding || "").trim();
    partsText.push(`Regarding: ${v}`);
    partsHtml.push(`Regarding: <b>${esc(v)}</b>`);
  }

  if (note) {
    partsText.push(`(${note})`);
    partsHtml.push(`(${esc(note)})`);
  }

  if (
    (form.assistedStaff || "").trim() &&
    !templateStr.includes("{assistedStaff}")
  ) {
    const v = (form.assistedStaff || "").trim();
    partsText.push(`(${v} was able to assist.)`);
    partsHtml.push(
      `(<span style="color:${RED}"><b>${esc(v)}</b></span> was able to assist)`
    );
  }

  const silentRoleIds = new Set(["other"]);
  const showRole = !silentRoleIds.has(form.roleId);
  const role = showRole ? roleLabel || "Visitor" : "";

  const timeHtml = `<b>${esc(time)}</b>`;
  const nameHtml = nameText ? ` <b>${esc(nameText)}</b>` : "";
  const companyHtml = company ? ` (${esc(company)})` : "";

  const roleText = role ? `${role}` : "";
  const roleHtml = role ? esc(role) : "";

  // ✅ companyName included in head (after name if present, otherwise after role)
  // Text
  let whoText = "";
  if (roleText) whoText += roleText;
  if (nameText) whoText += (whoText ? " " : "") + nameText;
  if (company) {
    whoText += (whoText ? " " : "") + `(${company})`;
    whoText = whoText.replace(/\s+\(/, " (");
  }

  const headText = `${time} -${whoText ? ` ${whoText}` : ""}${
    addressText ? ` ${addressText}` : ""
  }`.trim();

  // HTML
  let whoHtml = "";
  if (roleHtml) whoHtml += roleHtml;
  if (nameText) whoHtml += (whoHtml ? " " : "") + nameHtml.trimStart();
  if (company) whoHtml += (whoHtml ? " " : "") + companyHtml;

  const headHtml = `${timeHtml} -${
    whoHtml ? ` ${whoHtml}` : ""
  }${addressHtml}`.trim();

  // ✅ Important: your resident templates already end with "." in many cases.
  // If you keep templates ending with ".", then DON'T add another "." here.
  // We'll keep your original behavior but avoid ".." by trimming.
  const tailText = partsText.length ? ` — ${partsText.join("; ")}` : "";
  const tailHtml = partsHtml.length ? ` — ${partsHtml.join("; ")}` : "";

  const sentenceText = (headText + tailText).trim();
  const sentenceHtml = (headHtml + tailHtml).trim();

  // Ensure single period at end
  const fixEndPeriod = (s) => {
    const t = String(s || "").trim();
    if (!t) return t;
    return /[.!?]$/.test(t) ? t : `${t}.`;
  };

  return {
    sentenceText: fixEndPeriod(sentenceText),
    sentenceHtml: fixEndPeriod(sentenceHtml),
  };
}

export default function EntryForm({
  propertyId,
  shiftLog,
  admin,
  shiftLogHelper,
  mode = "create",
  initialEntry = null,
  entryId = null,
  onCancel,
  onSaved,
}) {
  const roles = shiftLogHelper?.roles || [];
  const fieldDefs = shiftLogHelper?.fieldDefs || {};
  const leasingOffice = shiftLogHelper?.leasingOffice || {};
  const isHVCC = (shiftLogHelper?.propertyLabel || "").toUpperCase() === "HVCC";

  const defaultRoleId =
    shiftLogHelper?.defaultRoleId || roles[0]?.id || "resident";

  const [saving, setSaving] = useState(false);

  const toast = useToast();

  const notify = {
    success: (msg) => {
      if (toast?.success) return toast.success(msg);
      if (toast?.show) return toast.show({ type: "success", message: msg });
      console.log(msg);
    },
    error: (msg) => {
      if (toast?.error) return toast.error(msg);
      if (toast?.show) return toast.show({ type: "error", message: msg });
      alert(msg);
    },
    info: (msg) => {
      if (toast?.info) return toast.info(msg);
      if (toast?.show) return toast.show({ type: "info", message: msg });
      console.log(msg);
    },
    warn: (msg) => {
      // some toast libs call it "warning" or just use show()
      if (toast?.warn) return toast.warn(msg);
      if (toast?.warning) return toast.warning(msg);
      if (toast?.show) return toast.show({ type: "warning", message: msg });
      if (toast?.info) return toast.info(msg); // fallback
      alert(msg);
    },
  };

  // ✅ occurredAt input (local datetime string)
  const [occurredAtLocal, setOccurredAtLocal] = useState(() =>
    toLocalTimeInputValue(new Date())
  );

  // ✅ tracks whether user manually edited Occurred at
  const [occurredAtDirty, setOccurredAtDirty] = useState(false);

  const [form, setForm] = useState({
    roleId: defaultRoleId,

    firstName: "",
    lastName: "",
    unitOrStreetNumber: "",
    streetOrBuildingName: "",
    residentsName: "",
    companyName: "",

    reasonId: "",
    reasonText: "",
    customReason: "",

    note: "",

    additionalNote: "",

    contactMethod: "frontDesk", // "calledIn" | "frontDesk"

    desc: "",
    desc2: "",

    // complaint checkboxes
    cSmell: false,
    cNoise: false,
    cDamage: false,
    cService: false,

    copyMade: false,
    placedAt: "",

    requestedStaff: "",
    assistedStaff: "",
    regarding: "",
    scheduled: false,
    scheduledWith: "",
    isChrVendor: false,

    incident: false,
    moveInOut: false,

    highlightPropertyManager: false,
    highlightMaintenance: false,
    highlightConciergeTeam: false,
  });

  useEffect(() => {
    if (mode !== "edit" || !initialEntry) return;

    setForm({
      roleId: initialEntry.roleId || defaultRoleId,
      firstName: initialEntry.firstName || "",
      lastName: initialEntry.lastName || "",
      unitOrStreetNumber: initialEntry.unitOrStreetNumber || "",
      streetOrBuildingName: initialEntry.streetOrBuildingName || "",
      residentsName: initialEntry.residentsName || "",
      companyName: initialEntry.companyName || "",
      reasonId: initialEntry.reasonId || "",
      reasonText: initialEntry.reasonText || "",
      customReason: initialEntry.customReason || "",
      note: initialEntry.note || "",
      additionalNote: initialEntry.additionalNote || "",
      copyMade: !!initialEntry.copyMade,
      placedAt: initialEntry.placedAt || "",
      requestedStaff: initialEntry.requestedStaff || "",
      assistedStaff: initialEntry.assistedStaff || "",
      regarding: initialEntry.regarding || "",
      scheduled: !!initialEntry.scheduled,
      scheduledWith: initialEntry.scheduledWith || "",
      isChrVendor: !!initialEntry.isChrVendor,
      incident: !!initialEntry.incident,
      moveInOut: !!initialEntry.moveInOut,
      highlightPropertyManager: !!initialEntry.highlightPropertyManager,
      highlightMaintenance: !!initialEntry.highlightMaintenance,
      highlightConciergeTeam: !!initialEntry.highlightConciergeTeam,
      contactMethod: initialEntry.contactMethod || "frontDesk",
      desc: initialEntry.desc || "",
      desc2: initialEntry.desc2 || "",
      cSmell: !!initialEntry.cSmell,
      cNoise: !!initialEntry.cNoise,
      cDamage: !!initialEntry.cDamage,
      cService: !!initialEntry.cService,
    });

    // ✅ initialize occurredAtLocal from entry.occurredAt (fallback to createdAt)
    const d =
      toDateMaybe(initialEntry.occurredAt) ||
      toDateMaybe(initialEntry.createdAt) ||
      new Date();
    setOccurredAtLocal(toLocalTimeInputValue(d));

    setOccurredAtDirty(true);
  }, [mode, initialEntry, defaultRoleId]);

  const buildingsAndStreets = useMemo(() => {
    const raw = shiftLogHelper?.buildingsAndStreets;
    const arr = Array.isArray(raw) ? raw : [];
    return Array.from(
      new Set(arr.map((s) => String(s || "").trim()).filter(Boolean))
    );
  }, [shiftLogHelper?.buildingsAndStreets]);

  const showStreetDropdown = buildingsAndStreets.length > 0;
  const streetOnlyOne = buildingsAndStreets.length === 1;

  const setField = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!roles.length) return;
    setForm((p) => {
      const stillValid = roles.some((r) => r.id === p.roleId);
      return stillValid ? p : { ...p, roleId: defaultRoleId };
    });
  }, [roles, defaultRoleId]);

  useEffect(() => {
    if (!showStreetDropdown) return;
    if (streetOnlyOne && !(form.streetOrBuildingName || "").trim()) {
      setField("streetOrBuildingName", buildingsAndStreets[0]);
    }
  }, [
    showStreetDropdown,
    streetOnlyOne,
    buildingsAndStreets,
    form.streetOrBuildingName,
  ]);

  const roleDef = useMemo(
    () => roles.find((r) => r.id === form.roleId) || roles[0] || null,
    [roles, form.roleId]
  );

  const reasons = roleDef?.reasons || [];

  const reasonDef = useMemo(
    () => reasons.find((r) => r.id === form.reasonId) || null,
    [reasons, form.reasonId]
  );

  const anyFlagged =
    !!form.incident ||
    !!form.moveInOut ||
    !!form.highlightPropertyManager ||
    !!form.highlightMaintenance ||
    !!form.highlightConciergeTeam;

  const visible = useMemo(() => {
    const base = roleDef?.fields || [];
    const extra = reasonDef?.extraFields || [];
    const set = new Set([...base, ...extra, "roleId"]);

    if (!form.scheduled) set.delete("scheduledWith");

    if (isHVCC) set.add("assistedStaff");

    if (anyFlagged) set.add("additionalNote");
    else set.delete("additionalNote");

    if (form.roleId === "resident") {
      set.add("unitOrStreetNumber");
      set.add("streetOrBuildingName");
      set.add("contactMethod");
    }

    return set;
  }, [roleDef, reasonDef, form.scheduled, isHVCC, anyFlagged, form.roleId]);

  useEffect(() => {
    if (mode === "edit") return;
    setForm((p) => ({ ...p, reasonId: "", reasonText: "", customReason: "" }));
  }, [form.roleId, mode]);

  useEffect(() => {
    if (mode === "edit") return;

    setForm((p) => ({
      ...p,
      copyMade: visible.has("copyMade") ? p.copyMade : false,
      placedAt: visible.has("placedAt") ? p.placedAt : "",
      customReason: visible.has("customReason") ? p.customReason : "",
      requestedStaff: visible.has("requestedStaff") ? p.requestedStaff : "",
      assistedStaff: visible.has("assistedStaff") ? p.assistedStaff : "",
      regarding: visible.has("regarding") ? p.regarding : "",
      scheduled: visible.has("scheduled") ? p.scheduled : false,
      scheduledWith: visible.has("scheduledWith") ? p.scheduledWith : "",
      isChrVendor: visible.has("isChrVendor") ? p.isChrVendor : false,
      additionalNote: visible.has("additionalNote") ? p.additionalNote : "",
    }));
  }, [visible, mode]);

  const roleLabel = roleDef?.label || "Visitor";
  const reasonLabel = reasonDef?.label || "";

  const occurredDate = useMemo(() => {
    const d = parseLocalDateTimeInputValue(occurredAtLocal);
    return d || new Date();
  }, [occurredAtLocal]);

  const unitOnlyMode = showStreetDropdown && streetOnlyOne;

  const { sentenceText, sentenceHtml } = useMemo(
    () =>
      buildSentence({
        form,
        roleLabel,
        reasonLabel,
        reasonDef,
        occurredDate,
        unitOnlyMode, // ✅ NEW
      }),
    [form, roleLabel, reasonLabel, reasonDef, occurredDate, unitOnlyMode]
  );

  const getOptions = (optionsFrom) => {
    if (!optionsFrom) return [];
    const parts = optionsFrom.split(".");
    let cur = shiftLogHelper;
    for (const p of parts) cur = cur?.[p];
    return Array.isArray(cur) ? cur : [];
  };

  const quickEntries = useMemo(() => {
    const raw = shiftLogHelper?.quickEntries;
    const arr = Array.isArray(raw) ? raw : [];
    // keep only valid ones
    return arr
      .map((q) => ({
        id: String(q?.id || "").trim(),
        buttonLabel: String(q?.buttonLabel || "").trim(),
        baseText: String(q?.baseText || "").trim(),
      }))
      .filter((q) => q.id && q.buttonLabel && q.baseText);
  }, [shiftLogHelper?.quickEntries]);

  function makeQuickEntrySentence({ baseText, note, occurredDate }) {
    const t = (baseText || "").trim();
    const n = (note || "").trim();
    const time = formatTimeLabel(occurredDate || new Date());
    const tail = n ? ` — Note: ${n}.` : " — nothing to report.";
    return `${time} - ${t}${tail}`;
  }

  function makeQuickEntrySentenceHtml({ baseText, note, occurredDate }) {
    const t = esc((baseText || "").trim());
    const n = (note || "").trim();

    const time = formatTimeLabel(occurredDate || new Date());
    const timeHtml = `<b>${esc(time)}</b>`;

    const base = `${timeHtml} - ${t}`;

    if (!n) {
      return `${base} — <span style="opacity:.9">nothing to report</span>.`;
    }
    return `${base} — Note: ${esc(n)}.`;
  }

  const addQuickEntry = async (task) => {
    if (!propertyId || !shiftLog?.id) return;
    if (!task?.baseText) return;

    const note = (form.note || "").trim();

    const sentenceText = makeQuickEntrySentence({
      baseText: task.baseText,
      note,
      occurredDate,
    });

    const sentenceHtml = makeQuickEntrySentenceHtml({
      baseText: task.baseText,
      note,
      occurredDate,
    });

    const entry = {
      roleId: "system",
      roleLabel: "System",
      reasonId: null,
      reasonLabel: null,
      reasonText: null,

      countThisReason: false,
      countKey: null,

      note: note || null,
      additionalNote: null,

      requestedStaff: null,
      assistedStaff: null,
      regarding: null,
      scheduled: null,
      scheduledWith: null,
      isChrVendor: null,

      copyMade: null,
      placedAt: null,

      incident: false,
      moveInOut: false,
      highlightPropertyManager: false,
      highlightMaintenance: false,
      highlightConciergeTeam: false,

      sentenceText,
      sentenceHtml,

      occurredAt: Timestamp.fromDate(occurredDate),

      createdBy: admin?.id || admin?.name || null,
      system: true,

      // optional: store the quickEntry id for analytics/filtering later
      quickEntryId: task.id,
    };

    try {
      setSaving(true);
      await addShiftEntry({ propertyId, shiftLogId: shiftLog.id, entry });
      setForm((p) => ({ ...p, note: "" }));
    } catch (err) {
      console.error(err);
      notify.error(err?.message || "Failed to add quick entry.");
    } finally {
      setSaving(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!propertyId || !shiftLog?.id) return;

    if (mode === "edit" && !entryId) {
      notify.error("Missing entryId (cannot save edit).");
      return;
    }

    const addressOk =
      (form.unitOrStreetNumber || "").trim() &&
      (form.streetOrBuildingName || "").trim();

    if (form.roleId === "resident" && !addressOk) {
      notify.warn(
        "Please enter the resident address: Unit/Street # and Street/Building."
      );
      return;
    }

    const hasName =
      (form.firstName || "").trim() || (form.lastName || "").trim();
    const hasCompany = (form.companyName || "").trim();
    const hasReason =
      reasons.length > 0 ? !!form.reasonId : !!(form.reasonText || "").trim();

    if (!hasName && !hasCompany && !hasReason && form.roleId !== "resident") {
      notify.warn("Please enter at least a name, company, or choose a reason.");
      return;
    }

    const finalReasonText =
      reasons.length > 0
        ? form.reasonId === "other"
          ? (form.customReason || "").trim()
          : (reasonLabel || "").trim()
        : (form.reasonText || "").trim();

    const countThisReason = !!(reasons.length && reasonDef?.countThis);
    const countKey = countThisReason
      ? String(reasonDef?.countKey || "").trim() || null
      : null;

    // ✅ occurredAt from the editable datetime-local
    // ✅ occurredAt: auto-refresh to "now" on click (create mode only) unless user edited it
    // occurredAtLocal is now "HH:MM"
    let finalOccurredDate = applyTimeToDate(new Date(), occurredAtLocal);

    if (mode !== "edit" && !occurredAtDirty) {
      finalOccurredDate = new Date();
      setOccurredAtLocal(toLocalTimeInputValue(finalOccurredDate)); // keep UI synced
    }

    const occurredAtTs = Timestamp.fromDate(finalOccurredDate);

    // ✅ rebuild sentence using the final occurred time (don’t rely on memo here)
    const built = buildSentence({
      form,
      roleLabel,
      reasonLabel,
      reasonDef,
      occurredDate: finalOccurredDate,
      unitOnlyMode,
    });

    const entry = {
      roleId: form.roleId,
      roleLabel,

      unitLabel: [form.unitOrStreetNumber, form.streetOrBuildingName]
        .filter(Boolean)
        .join(" ")
        .trim(),

      unitOrStreetNumber: (form.unitOrStreetNumber || "").trim(),
      streetOrBuildingName: (form.streetOrBuildingName || "").trim(),
      firstName: (form.firstName || "").trim(),
      lastName: (form.lastName || "").trim(),
      residentsName: (form.residentsName || "").trim(),
      companyName: (form.companyName || "").trim(),
      customReason: (form.customReason || "").trim(),

      visiting: (form.residentsName || form.companyName || "").trim(),

      reasonId: reasons.length ? form.reasonId : null,
      reasonLabel: reasons.length ? reasonLabel : null,
      reasonText: finalReasonText,

      countThisReason,
      countKey,
      contactMethod: form.contactMethod || null,
      desc: (form.desc || "").trim() || null,
      desc2: (form.desc2 || "").trim() || null,
      cSmell: !!form.cSmell,
      cNoise: !!form.cNoise,
      cDamage: !!form.cDamage,
      cService: !!form.cService,

      note: (form.note || "").trim(),

      additionalNote: visible.has("additionalNote")
        ? (form.additionalNote || "").trim()
        : null,

      requestedStaff: visible.has("requestedStaff")
        ? (form.requestedStaff || "").trim()
        : null,
      assistedStaff: visible.has("assistedStaff")
        ? (form.assistedStaff || "").trim()
        : null,
      regarding: visible.has("regarding")
        ? (form.regarding || "").trim()
        : null,
      scheduled: visible.has("scheduled") ? !!form.scheduled : null,
      scheduledWith: visible.has("scheduledWith")
        ? (form.scheduledWith || "").trim()
        : null,
      isChrVendor: visible.has("isChrVendor") ? !!form.isChrVendor : null,

      copyMade: visible.has("copyMade") ? !!form.copyMade : null,
      placedAt: visible.has("placedAt") ? (form.placedAt || "").trim() : null,

      incident: !!form.incident,
      moveInOut: !!form.moveInOut,

      highlightPropertyManager: !!form.highlightPropertyManager,
      highlightMaintenance: !!form.highlightMaintenance,
      highlightConciergeTeam: !!form.highlightConciergeTeam,

      // ✅ sentence is built using occurredAt time
      sentenceText: built.sentenceText,
      sentenceHtml: built.sentenceHtml,
      occurredAt: occurredAtTs,

      createdBy: admin?.id || admin?.name || null,
    };

    try {
      setSaving(true);

      if (mode === "edit") {
        await updateShiftEntry({
          propertyId,
          shiftLogId: shiftLog.id,
          entryId,
          nextEntry: entry,
          prevEntry: initialEntry,
        });
        onSaved?.();
        return;
      }

      await addShiftEntry({ propertyId, shiftLogId: shiftLog.id, entry });

      // reset
      setForm((p) => ({
        ...p,
        firstName: "",
        lastName: "",
        unitOrStreetNumber: "",
        streetOrBuildingName: "",
        residentsName: "",
        companyName: "",
        reasonId: "",
        reasonText: "",
        customReason: "",
        note: "",
        additionalNote: "",

        // ✅ add these
        contactMethod: "frontDesk",
        desc: "",
        desc2: "",
        cSmell: false,
        cNoise: false,
        cDamage: false,
        cService: false,

        copyMade: false,
        placedAt: "",

        requestedStaff: "",
        assistedStaff: "",
        regarding: "",
        scheduled: false,
        scheduledWith: "",
        isChrVendor: false,

        incident: false,
        moveInOut: false,

        highlightPropertyManager: false,
        highlightMaintenance: false,
        highlightConciergeTeam: false,
      }));

      // default occurredAt to “now” after submit
      setOccurredAtLocal(toLocalTimeInputValue(new Date()));

      setOccurredAtDirty(false);
    } catch (err) {
      console.error(err);
      notify.error(err?.message || "Failed to add entry.");
    } finally {
      setSaving(false);
    }
  };

  const reasonFieldKey = reasons.length ? "reasonId" : "reasonText";

  const hideBuilding = showStreetDropdown && streetOnlyOne;

  const topRowKeys = useMemo(() => {
    const keys = [
      "occurredAt",
      "roleId",
      "unitOrStreetNumber",
      ...(hideBuilding ? [] : ["streetOrBuildingName"]),
      "firstName",
      "lastName",
      "contactMethod",
    ];
    return keys.filter((k) => k === "occurredAt" || visible.has(k));
  }, [visible, hideBuilding]);

  const bottomRowKeys = useMemo(() => {
    const extrasOrder = [
      "desc",
      "desc2",
      "cSmell",
      "cNoise",
      "cDamage",
      "cService",
      "requestedStaff",

      "copyMade",
      "placedAt",
      "regarding",
      "customReason",
      "assistedStaff",
    ];

    const extras = extrasOrder.filter((k) => visible.has(k));

    // Reason first, then extras, then note(s)
    const keys = [reasonFieldKey, ...extras, "note"];

    if (visible.has("additionalNote")) keys.push("additionalNote");

    return keys;
  }, [visible, reasonFieldKey]);

  const renderField = (key) => {
    // ✅ NEW: occurredAt editor
    if (key === "occurredAt") {
      return (
        // <div key={key} style={{ gridColumn: "1 / -1" }}>
        <div key={key}>
          <div className="field-label">Occurred at</div>
          <input
            className="field-input"
            type="time"
            value={occurredAtLocal}
            onChange={(e) => {
              setOccurredAtLocal(e.target.value);
              setOccurredAtDirty(true);
            }}
          />
          {/* <div className="muted" style={{ padding: 0, marginTop: 6 }}>
            This controls the time shown in the sentence + ordering. CreatedAt
            stays unchanged.
          </div> */}
        </div>
      );
    }

    if (key === "roleId") {
      return (
        <div key={key}>
          <div className="field-label">Role</div>
          <select
            className="field-input"
            value={form.roleId}
            onChange={(e) => setField("roleId", e.target.value)}
          >
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
      );
    }

    if (key === "reasonText") {
      return (
        <div key={key}>
          <div className="field-label">Reason</div>
          <input
            className="field-input"
            value={form.reasonText}
            onChange={(e) => setField("reasonText", e.target.value)}
            placeholder="meeting / package / maintenance..."
          />
        </div>
      );
    }

    if (key === "additionalNote") {
      return (
        <div key={key} style={{ gridColumn: "1 / -1" }}>
          <div className="field-label">Additional note</div>
          <input
            className="field-input"
            value={form.additionalNote}
            onChange={(e) => setField("additionalNote", e.target.value)}
            placeholder="Extra details for flagged item (shows in summary)…"
          />
        </div>
      );
    }

    if (key === "contactMethod") {
      return (
        <div key={key}>
          <div className="field-label">Contact</div>
          <select
            className="field-input"
            value={form.contactMethod}
            onChange={(e) => setField("contactMethod", e.target.value)}
          >
            <option value="calledIn">Called in</option>
            <option value="frontDesk">Came to front desk</option>
          </select>
        </div>
      );
    }

    if (key === "streetOrBuildingName" && showStreetDropdown) {
      return (
        <div key={key}>
          <div className="field-label">
            {fieldDefs?.[key]?.label || "Street / Building"}
          </div>

          <select
            className="field-input"
            value={form.streetOrBuildingName || ""}
            onChange={(e) => setField("streetOrBuildingName", e.target.value)}
            disabled={streetOnlyOne}
          >
            {!streetOnlyOne && <option value="">Select…</option>}
            {buildingsAndStreets.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      );
    }

    const def = fieldDefs?.[key];
    if (!def) return null;

    const fullWidth = key === "note";
    const wrapperStyle = fullWidth ? { gridColumn: "1 / -1" } : undefined;

    if (def.type === "boolean") {
      return (
        <label
          key={key}
          style={{ display: "flex", gap: 8, alignItems: "center" }}
        >
          <input
            type="checkbox"
            checked={!!form[key]}
            onChange={(e) => setField(key, e.target.checked)}
          />
          <span className="muted" style={{ padding: 0 }}>
            {def.label}
          </span>
        </label>
      );
    }

    if (def.type === "select") {
      if (key === "reasonId") {
        return (
          <div key={key}>
            <div className="field-label">{def.label || "Reason"}</div>
            <select
              className="field-input"
              value={form.reasonId}
              onChange={(e) => setField("reasonId", e.target.value)}
            >
              <option value="">Select…</option>
              {reasons.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        );
      }

      if (
        key === "placedAt" &&
        Array.isArray(leasingOffice.staff) &&
        leasingOffice.staff.length
      ) {
        return (
          <div key={key}>
            <div className="field-label">{def.label || "Placed at"}</div>
            <select
              className="field-input"
              value={form.placedAt || ""}
              onChange={(e) => setField("placedAt", e.target.value)}
            >
              <option value="">Select…</option>
              {leasingOffice.staff.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        );
      }

      const opts = Array.isArray(def.options)
        ? def.options
        : getOptions(def.optionsFrom);

      return (
        <div key={key}>
          <div className="field-label">{def.label}</div>
          <select
            className="field-input"
            value={form[key] || ""}
            onChange={(e) => setField(key, e.target.value)}
          >
            <option value="">Select…</option>
            {opts.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
      );
    }

    return (
      <div key={key} style={wrapperStyle}>
        <div className="field-label">{def.label}</div>
        <input
          className="field-input"
          value={form[key] || ""}
          onChange={(e) => setField(key, e.target.value)}
          placeholder={def.placeholder || ""}
        />
      </div>
    );
  };

  return (
    <div className="panel">
      <form onSubmit={submit}>
        {/* <div className="add-booking-grid">{gridKeys.map(renderField)}</div> */}
        {/* Top row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, minmax(140px, 1fr))",
            gap: 12,
            alignItems: "end",
          }}
        >
          {topRowKeys.map(renderField)}
        </div>

        {/* Bottom row */}
        <div
          style={{
            marginTop: 12,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
            alignItems: "end",
          }}
        >
          {bottomRowKeys.map(renderField)}
        </div>

        <div
          style={{ marginTop: 10, display: "flex", gap: 12, flexWrap: "wrap" }}
        >
          {[
            ["incident", "Incident"],
            ["moveInOut", "Move-in/out"],
            ["highlightPropertyManager", "Highlight PM"],
            ["highlightMaintenance", "Highlight Maintenance"],
            ["highlightConciergeTeam", "Highlight Concierge"],
          ].map(([k, label]) => (
            <label
              key={k}
              style={{ display: "flex", gap: 8, alignItems: "center" }}
            >
              <input
                type="checkbox"
                checked={!!form[k]}
                onChange={(e) => setField(k, e.target.checked)}
              />
              <span className="muted" style={{ padding: 0 }}>
                {label}
              </span>
            </label>
          ))}
        </div>

        <div style={{ marginTop: 10 }}>
          <div className="muted" style={{ padding: 0, marginBottom: 6 }}>
            Sentence preview (styled)
          </div>

          <div
            className="list-row"
            style={{ whiteSpace: "normal", overflowWrap: "anywhere" }}
            dangerouslySetInnerHTML={{ __html: sentenceHtml }}
          />
        </div>

        <div
          className="add-booking-bar"
          style={{
            marginTop: 10,
            display: "flex",
            gap: 10,
            justifyContent: "flex-end",
            flexWrap: "wrap",
          }}
        >
          {mode !== "edit" && quickEntries.length > 0 && (
            <>
              {quickEntries.map((q) => (
                <button
                  key={q.id}
                  className="secondary-button"
                  type="button"
                  disabled={saving}
                  onClick={() => addQuickEntry(q)}
                  title={q.baseText}
                >
                  {q.buttonLabel}
                </button>
              ))}
            </>
          )}

          {mode === "edit" && (
            <button
              type="button"
              className="secondary-button"
              onClick={onCancel}
            >
              Cancel
            </button>
          )}

          <button className="primary-line-btn" type="submit" disabled={saving}>
            {saving
              ? mode === "edit"
                ? "Saving…"
                : "Adding…"
              : mode === "edit"
              ? "Save changes"
              : "Add log entry"}
          </button>
        </div>
      </form>
    </div>
  );
}
