import React, { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { clearStoredAccessToken } from "./outlookSync";
import useMeetingRequests from "./useMeetingRequests";

const DAY_ORDER = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

const DAY_LABELS = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

const STATUS_OPTS = [
  "open",
  "officeMeeting",
  "residentMeeting",
  "officeWork",
  "not-in",
];

const STATUS_LABELS = {
  open: "Open",
  officeMeeting: "Office Meeting",
  residentMeeting: "Resident Meeting",
  officeWork: "Office Work",
  "not-in": "Not In",
};

const STATUS_CLASS = {
  open: "open",
  officeMeeting: "officeMeeting",
  residentMeeting: "residentMeeting",
  officeWork: "officeWork",
  "not-in": "notIn",
};

function normalizeStatus(status) {
  if (status === "booked" || status === "meeting") return "officeMeeting";
  if (status === "office-meeting") return "officeMeeting";
  if (status === "resident-meeting") return "residentMeeting";
  return STATUS_OPTS.includes(status) ? status : "open";
}

function toMinutes(value) {
  const [h = "0", m = "0"] = String(value || "00:00").split(":");
  return Number(h) * 60 + Number(m);
}

function toTimeValue(minutes) {
  const hrs = String(Math.floor(minutes / 60)).padStart(2, "0");
  const mins = String(minutes % 60).padStart(2, "0");
  return `${hrs}:${mins}`;
}

function formatTimeLabel(value) {
  const minutes = toMinutes(value);
  const hours24 = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const suffix = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 || 12;
  return `${hours12}:${String(mins).padStart(2, "0")} ${suffix}`;
}

function buildTimeSlots(openTime, closeTime) {
  const openMinutes = toMinutes(openTime);
  const closeMinutes = toMinutes(closeTime);
  if (closeMinutes <= openMinutes) return [];

  const slots = [];
  for (let cursor = openMinutes; cursor < closeMinutes; cursor += 30) {
    slots.push({
      key: toTimeValue(cursor),
      label: formatTimeLabel(toTimeValue(cursor)),
    });
  }
  return slots;
}

function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const delta = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + delta);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekDates(weekOffset = 0) {
  const monday = getMonday(new Date());
  monday.setDate(monday.getDate() + weekOffset * 7);

  return DAY_ORDER.map((day, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return { dayKey: day, date };
  });
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isTodayDate(date) {
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function formatWeekLabel(weekDates, weekOffset) {
  if (weekOffset === 0) return "This Week";
  if (weekOffset === 1) return "Next Week";
  if (weekOffset === -1) return "Last Week";

  const first = weekDates[0]?.date;
  const last = weekDates[6]?.date;
  if (!first || !last) return "Week";

  return `${first.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })} — ${last.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })}`;
}

function formatRequestSlot(dateKey, timeKey) {
  if (!dateKey || !timeKey) return "";
  const date = new Date(`${dateKey}T00:00:00`);
  const dateLabel = Number.isNaN(date.getTime())
    ? dateKey
    : date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${dateLabel} · ${formatTimeLabel(timeKey)}`;
}

function createDefaultDay() {
  return {
    isOpen: true,
    openTime: "09:00",
    closeTime: "17:00",
    defaultSlots: {},
  };
}

function ensureDayConfig(dayConfig) {
  const base = { ...createDefaultDay(), ...(dayConfig || {}) };
  const legacySlots = base.slots || {};
  const sourceSlots = base.defaultSlots || legacySlots;
  const slotKeys = base.isOpen
    ? buildTimeSlots(base.openTime, base.closeTime).map((slot) => slot.key)
    : [];
  const nextDefaultSlots = {};

  slotKeys.forEach((slot) => {
    nextDefaultSlots[slot] = normalizeStatus(sourceSlots[slot] || "open");
  });

  return {
    ...base,
    defaultSlots: nextDefaultSlots,
  };
}

function getMergedSlotState({ defaultStatus, manualOverride, syncRecord }) {
  if (manualOverride?.status) {
    return {
      status: normalizeStatus(manualOverride.status),
      source: "manual",
      description: manualOverride.description || "",
    };
  }
  if (syncRecord?.status) {
    return {
      status: normalizeStatus(syncRecord.status),
      source: syncRecord.source || "outlook",
      description: syncRecord.description || syncRecord.title || "",
    };
  }
  if (defaultStatus && defaultStatus !== "open") {
    return { status: normalizeStatus(defaultStatus), source: "default" };
  }
  return { status: "open", source: "default" };
}

function getSlotStatusFromEvent(event) {
  const explicit = String(event?.status || "").trim();
  if (explicit && STATUS_OPTS.includes(explicit)) return explicit;

  const text = `${event?.status || ""} ${event?.showAs || ""} ${
    event?.title || ""
  } ${event?.subject || ""} ${event?.categories || ""}`.toLowerCase();

  if (text.includes("office") || text.includes("focus")) return "officeWork";
  if (text.includes("not-in") || text.includes("out of office")) return "not-in";
  if (text.includes("resident")) return "residentMeeting";
  if (text.includes("meeting")) return "officeMeeting";
  if (text.includes("booked") || text.includes("busy")) return "officeMeeting";
  return "officeMeeting";
}

function applyEventsToSlotSync({ events, existingSlotSync }) {
  const next = { ...(existingSlotSync || {}) };

  for (const event of events) {
    const start = new Date(event.start);
    const end = new Date(event.end);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;
    if (end <= start) continue;

    const slotStatus = getSlotStatusFromEvent(event);
    const title = event.title || event.subject || "";
    let cursor = new Date(start);

    while (cursor < end) {
      const slotDateKey = toDateKey(cursor);
      const slotTime = toTimeValue(cursor.getHours() * 60 + cursor.getMinutes());

      next[slotDateKey] = {
        ...(next[slotDateKey] || {}),
        [slotTime]: {
          status: slotStatus,
          source: "outlook",
          title,
          description: title,
          eventId: event.id || "",
          startsAt: event.start,
          endsAt: event.end,
          lastSyncedAt: new Date().toISOString(),
        },
      };

      cursor = new Date(cursor.getTime() + 30 * 60 * 1000);
    }
  }

  return next;
}

function createDefaultCalendarDoc(admin, propertyId) {
  const timezone =
    Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York";

  return {
    propertyId,
    createdBy: admin?.id || "",
    createdByName: admin?.name || admin?.email || "Admin",
    adminName: admin?.name || admin?.email || "Admin",
    adminEmail: admin?.email || "",
    role: admin?.role || "admin",
    timezone,
    dayConfigs: DAY_ORDER.reduce((acc, day) => {
      acc[day] = createDefaultDay();
      return acc;
    }, {}),
    slotOverrides: {},
    slotSync: {},
    outlookConnection: {
      enabled: false,
      calendarEmail: admin?.email || "",
      calendarId: "",
      icsUrl: "",
      status: "not_connected",
      connectedAt: null,
      lastSyncAt: null,
      lastSyncRangeStart: "",
      lastSyncRangeEnd: "",
    },
  };
}

function normalizeCalendarDoc(data, admin, propertyId) {
  const base = createDefaultCalendarDoc(admin, propertyId);
  const merged = {
    ...base,
    ...(data || {}),
    createdBy: data?.createdBy || data?.adminId || base.createdBy,
    createdByName: data?.createdByName || base.createdByName,
    outlookConnection: {
      ...base.outlookConnection,
      ...(data?.outlookConnection || {}),
    },
  };

  const normalizedDayConfigs = {};
  DAY_ORDER.forEach((day) => {
    normalizedDayConfigs[day] = ensureDayConfig(merged.dayConfigs?.[day]);
  });

  const normalizedOverrides = Object.fromEntries(
    Object.entries(merged.slotOverrides || {}).map(([dateKey, slots]) => [
      dateKey,
      Object.fromEntries(
        Object.entries(slots || {}).map(([timeKey, record]) => [
          timeKey,
          {
            ...record,
            status: normalizeStatus(record?.status),
            description: record?.description || "",
          },
        ])
      ),
    ])
  );

  const normalizedSync = Object.fromEntries(
    Object.entries(merged.slotSync || {}).map(([dateKey, slots]) => [
      dateKey,
      Object.fromEntries(
        Object.entries(slots || {}).map(([timeKey, record]) => [
          timeKey,
          {
            ...record,
            status: normalizeStatus(record?.status),
            description: record?.description || record?.title || "",
          },
        ])
      ),
    ])
  );

  return {
    ...merged,
    dayConfigs: normalizedDayConfigs,
    slotOverrides: normalizedOverrides,
    slotSync: normalizedSync,
  };
}

function SlotPicker({ x, y, onPick, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    function onDocDown(event) {
      if (ref.current && !ref.current.contains(event.target)) onClose();
    }
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="slot-picker"
      style={{
        left: Math.min(x, window.innerWidth - 170),
        top: Math.min(y, window.innerHeight - 320),
      }}
    >
      {STATUS_OPTS.map((status) => (
        <button
          key={status}
          type="button"
          className={`picker-opt ${STATUS_CLASS[status]}`}
          onClick={() => onPick(status)}
        >
          {STATUS_LABELS[status]}
        </button>
      ))}
      <button type="button" className="picker-opt" onClick={() => onPick(null)}>
        Clear Slot
      </button>
    </div>
  );
}

export default function AvailabilityCalendarView({
  propertyId,
  propertyName,
  admin,
  readOnly = false,
}) {
  const [availabilityAdmins, setAvailabilityAdmins] = useState([]);
  const [selectedCalendarId, setSelectedCalendarId] = useState("");
  const [showCalendarSetup, setShowCalendarSetup] = useState(false);
  const [calendarNameDraft, setCalendarNameDraft] = useState("");
  const [calendarDoc, setCalendarDoc] = useState(() =>
    normalizeCalendarDoc(null, admin, propertyId)
  );
  const [loading, setLoading] = useState(!!propertyId && !!admin?.id);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [activeBrush, setActiveBrush] = useState("open");
  const [picker, setPicker] = useState(null);
  const [syncMessage, setSyncMessage] = useState("");
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [pendingResidentAssignment, setPendingResidentAssignment] = useState(null);
  const effectiveCalendarId = selectedCalendarId;
  const effectiveAdminProfile =
    availabilityAdmins.find((entry) => entry.id === selectedCalendarId) || admin;
  const {
    requests: meetingRequests,
    loading: requestsLoading,
    error: requestsError,
  } = useMeetingRequests(propertyId, effectiveCalendarId);

  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset]);
  const weekLabel = useMemo(
    () => formatWeekLabel(weekDates, weekOffset),
    [weekDates, weekOffset]
  );

  useEffect(() => {
    if (!propertyId) {
      setAvailabilityAdmins([]);
      setSelectedCalendarId("");
      return;
    }

    const colRef = collection(db, "Properties", propertyId, "leasingAvailability");
    const unsub = onSnapshot(
      colRef,
      (snap) => {
        const rows = snap.docs
          .map((docSnap) => ({
            id: docSnap.id,
            createdBy: docSnap.data()?.createdBy || docSnap.data()?.adminId || "",
            adminName: docSnap.data()?.adminName || "Admin",
            adminEmail: docSnap.data()?.adminEmail || "",
          }))
          .filter((row) =>
            readOnly ? true : row.createdBy === admin?.id
          )
          .sort((a, b) => a.adminName.localeCompare(b.adminName));

        setAvailabilityAdmins(rows);
        setSelectedCalendarId((prev) => {
          if (prev && rows.some((row) => row.id === prev)) return prev;
          return rows[0]?.id || "";
        });
      },
      (err) => {
        console.error(err);
        setError("Failed to load available admin calendars.");
      }
    );

    return () => unsub();
  }, [propertyId, readOnly, admin?.id]);

  useEffect(() => {
    if (!propertyId || !admin?.id) {
      setCalendarDoc(normalizeCalendarDoc(null, admin, propertyId));
      setLoading(false);
      return;
    }

    if (!effectiveCalendarId) {
      setCalendarDoc(normalizeCalendarDoc(null, effectiveAdminProfile, propertyId));
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    const ref = doc(
      db,
      "Properties",
      propertyId,
      "leasingAvailability",
      effectiveCalendarId
    );
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setCalendarDoc(
          normalizeCalendarDoc(
            snap.exists() ? snap.data() : null,
            effectiveAdminProfile,
            propertyId
          )
        );
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setError("Failed to load availability calendar.");
        setLoading(false);
      }
    );

    return () => unsub();
  }, [
    propertyId,
    admin?.id,
    effectiveCalendarId,
    effectiveAdminProfile,
    readOnly,
  ]);

  const updateDayHours = (dayKey, field, value) => {
    setCalendarDoc((prev) => ({
      ...prev,
      dayConfigs: {
        ...prev.dayConfigs,
        [dayKey]: ensureDayConfig({
          ...prev.dayConfigs?.[dayKey],
          [field]: value,
        }),
      },
    }));
  };

  const setSlotOverride = ({ dateKey, timeKey, status, description = "" }) => {
    setCalendarDoc((prev) => {
      const nextOverrides = { ...(prev.slotOverrides || {}) };
      const currentDate = { ...(nextOverrides[dateKey] || {}) };

      if (status === null) {
        delete currentDate[timeKey];
      } else {
        currentDate[timeKey] = {
          status: normalizeStatus(status),
          description:
            normalizeStatus(status) === "residentMeeting" ? description.trim() : "",
          source: "manual",
          updatedAt: new Date().toISOString(),
          updatedBy: admin?.id || "",
        };
      }

      if (Object.keys(currentDate).length === 0) {
        delete nextOverrides[dateKey];
      } else {
        nextOverrides[dateKey] = currentDate;
      }

      return {
        ...prev,
        slotOverrides: nextOverrides,
      };
    });
  };

  const setDateOverrides = ({ dateKey, slotKeys, status, description = "" }) => {
    setCalendarDoc((prev) => {
      const nextOverrides = { ...(prev.slotOverrides || {}) };

      if (status === null) {
        delete nextOverrides[dateKey];
      } else {
        const nextDateOverrides = {};
        slotKeys.forEach((timeKey) => {
          nextDateOverrides[timeKey] = {
            status: normalizeStatus(status),
            description:
              normalizeStatus(status) === "residentMeeting"
                ? description.trim()
                : "",
            source: "manual",
            updatedAt: new Date().toISOString(),
            updatedBy: admin?.id || "",
          };
        });
        nextOverrides[dateKey] = nextDateOverrides;
      }

      return {
        ...prev,
        slotOverrides: nextOverrides,
      };
    });
  };

  const handleMeetingRequestStatusChange = async (request, nextStatus) => {
    if (readOnly) return;
    if (!propertyId || !admin?.id || !request?.id || !effectiveCalendarId) return;

    try {
      setError("");
      const requestRef = doc(
        db,
        "Properties",
        propertyId,
        "leasingAvailability",
        effectiveCalendarId,
        "requests",
        request.id
      );

      if (nextStatus === "approved") {
        const nextOverrides = { ...(calendarDoc.slotOverrides || {}) };
        const description = [request.title, request.unitLabel]
          .filter(Boolean)
          .join(" · ")
          .trim();

        (request.requestedSlots || []).forEach((slot) => {
          if (!slot?.dateKey || !slot?.timeKey) return;
          nextOverrides[slot.dateKey] = {
            ...(nextOverrides[slot.dateKey] || {}),
            [slot.timeKey]: {
              status: "residentMeeting",
              description,
              source: "manual",
              updatedAt: new Date().toISOString(),
              updatedBy: admin.id,
            },
          };
        });

        setCalendarDoc((prev) => ({
          ...prev,
          slotOverrides: nextOverrides,
        }));

        await setDoc(
          doc(db, "Properties", propertyId, "leasingAvailability", effectiveCalendarId),
          {
            slotOverrides: nextOverrides,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }

      await updateDoc(requestRef, {
        status: nextStatus,
        reviewedAt: serverTimestamp(),
        reviewedBy: admin.id,
      });

      setSyncMessage(
        nextStatus === "approved"
          ? "Meeting request approved and added to the calendar."
          : "Meeting request rejected."
      );
    } catch (err) {
      console.error(err);
      setError("Failed to update meeting request.");
    }
  };

  const handlePickerSelection = (status) => {
    if (readOnly) return;
    if (!picker) return;

    if (status === "residentMeeting") {
      setPendingResidentAssignment(picker);
      setDescriptionDraft("");
      setPicker(null);
      return;
    }

    if (picker.mode === "day") {
      setDateOverrides({
        dateKey: picker.dateKey,
        slotKeys: picker.slotKeys || [],
        status: status || null,
      });
    } else {
      setSlotOverride({
        dateKey: picker.dateKey,
        timeKey: picker.timeKey,
        status: status || null,
      });
    }

    if (status) setActiveBrush(status);
    setPicker(null);
  };

  const saveResidentMeeting = () => {
    if (readOnly) return;
    if (!pendingResidentAssignment) return;
    const description = descriptionDraft.trim();
    if (!description) {
      setError("Resident meeting requires a short description.");
      return;
    }

    setError("");
    if (pendingResidentAssignment.mode === "day") {
      setDateOverrides({
        dateKey: pendingResidentAssignment.dateKey,
        slotKeys: pendingResidentAssignment.slotKeys || [],
        status: "residentMeeting",
        description,
      });
    } else {
      setSlotOverride({
        dateKey: pendingResidentAssignment.dateKey,
        timeKey: pendingResidentAssignment.timeKey,
        status: "residentMeeting",
        description,
      });
    }
    setActiveBrush("residentMeeting");
    setPendingResidentAssignment(null);
    setDescriptionDraft("");
  };

  const createCalendar = async () => {
    const name = calendarNameDraft.trim();
    if (!propertyId || !admin?.id || !name) {
      setError("Enter a leasing staff name to set up a calendar.");
      return;
    }

    try {
      setError("");
      const newRef = doc(
        collection(db, "Properties", propertyId, "leasingAvailability")
      );
      const nextDoc = createDefaultCalendarDoc(
        { ...admin, name, email: admin?.email || "" },
        propertyId
      );

      await setDoc(newRef, {
        ...nextDoc,
        adminName: name,
        adminEmail: admin?.email || "",
        createdBy: admin.id,
        createdByName: admin?.name || admin?.email || "Admin",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setSelectedCalendarId(newRef.id);
      setShowCalendarSetup(false);
      setCalendarNameDraft("");
      setSyncMessage(`Calendar created for ${name}.`);
    } catch (err) {
      console.error(err);
      setError("Failed to create leasing staff calendar.");
    }
  };

  const saveCalendar = async () => {
    if (!propertyId || !admin?.id || !effectiveCalendarId) return;

    try {
      setSaving(true);
      setError("");

      const ref = doc(
        db,
        "Properties",
        propertyId,
        "leasingAvailability",
        effectiveCalendarId
      );
      await setDoc(
        ref,
        {
          ...calendarDoc,
          propertyId,
          createdBy: admin.id,
          createdByName: admin?.name || admin?.email || "Admin",
          adminName:
            calendarDoc.adminName || effectiveAdminProfile?.adminName || "Admin",
          adminEmail: admin?.email || "",
          role: admin?.role || "admin",
          dayConfigs: DAY_ORDER.reduce((acc, day) => {
            acc[day] = ensureDayConfig(calendarDoc.dayConfigs?.[day]);
            return acc;
          }, {}),
          slotOverrides: calendarDoc.slotOverrides || {},
          slotSync: calendarDoc.slotSync || {},
          updatedAt: serverTimestamp(),
          outlookConnection: {
            ...calendarDoc.outlookConnection,
            connectedAt: calendarDoc.outlookConnection?.enabled
              ? serverTimestamp()
              : null,
          },
        },
        { merge: true }
      );
      setSyncMessage("Availability saved to Firestore.");
    } catch (err) {
      console.error(err);
      setError("Failed to save availability calendar.");
    } finally {
      setSaving(false);
    }
  };

  const disconnectOutlook = () => {
    clearStoredAccessToken(`outlook:${propertyId || "none"}:${admin?.id || "none"}`);
    setCalendarDoc((prev) => ({
      ...prev,
      outlookConnection: {
        ...prev.outlookConnection,
        enabled: false,
        status: "not_connected",
      },
    }));
    setSyncMessage("Disconnected Outlook for this browser session.");
  };

  if (!propertyId) {
    return (
      <section className="panel">
        <div className="muted">Select a property first.</div>
      </section>
    );
  }

  if (!effectiveCalendarId && !loading) {
    return (
      <section className="panel availability-shell">
        <div className="availability-content">
          {readOnly ? (
            <div className="muted">
              No admin calendars found for this property yet.
            </div>
          ) : (
            <div className="availability-empty-setup">
              <div className="empty-title">No Leasing Staff Calendars Yet</div>
              <div className="empty-s">
                Set up the first leasing office staff calendar for this property.
              </div>
              <button
                type="button"
                className="availability-action-btn"
                onClick={() => setShowCalendarSetup(true)}
              >
                Set Up Calendar
              </button>
            </div>
          )}
        </div>
        {showCalendarSetup ? (
          <div
            className="availability-modal-overlay"
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                setShowCalendarSetup(false);
                setCalendarNameDraft("");
              }
            }}
          >
            <div className="availability-modal availability-description-modal">
              <button
                type="button"
                className="availability-modal-close"
                onClick={() => {
                  setShowCalendarSetup(false);
                  setCalendarNameDraft("");
                }}
              >
                ✕
              </button>
              <div className="availability-modal-title">Set Up Calendar</div>
              <div className="availability-modal-sub">
                Create a leasing office staff calendar for this property.
              </div>
              <input
                type="text"
                className="availability-sync-input availability-name-input"
                value={calendarNameDraft}
                onChange={(event) => setCalendarNameDraft(event.target.value)}
                placeholder="Enter leasing staff name"
              />
              <div className="availability-modal-actions">
                <button
                  type="button"
                  className="availability-ghost-btn"
                  onClick={() => {
                    setShowCalendarSetup(false);
                    setCalendarNameDraft("");
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="availability-action-btn availability-modal-save"
                  onClick={createCalendar}
                >
                  Create Calendar
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <section className="panel availability-shell">
      <div className="availability-header">
        <div>
          <div className="availability-brand">Pinnacle Hospitality</div>
          <div className="availability-brand-sub">Admin Management Portal</div>
        </div>
        <div className="availability-admin-badge">
          <span className="availability-admin-dot" />
          <span>{admin?.name || admin?.email || "Admin Access"}</span>
        </div>
      </div>

      <div className="availability-top-tabs">
        <button type="button" className="availability-top-tab">
          <CalendarDays size={12} />
          <span>Calendar</span>
        </button>
      </div>

      <div className="availability-content">
        <div className="availability-admin-strip">
          <div className="availability-small-note">
            {readOnly
              ? "View leasing calendars for this property"
              : "Manage leasing staff calendars for this property"}
          </div>
          <div className="availability-admin-list">
            {availabilityAdmins.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className={`availability-admin-chip ${
                  selectedCalendarId === entry.id ? "active" : ""
                }`}
                onClick={() => setSelectedCalendarId(entry.id)}
              >
                {entry.adminName}
              </button>
            ))}
            {!readOnly ? (
              <button
                type="button"
                className="availability-admin-chip availability-admin-chip-add"
                onClick={() => setShowCalendarSetup(true)}
              >
                + Set Up Calendar
              </button>
            ) : null}
          </div>
        </div>

        <div className="availability-hero">
          <div className="availability-title">
            Admin <em>Availability</em>
          </div>
          <div className="availability-hero-aside">
            <div className="availability-hero-label">Visible To</div>
            <div className="availability-hero-value">
              Tablet Kiosk & Visitors
            </div>
          </div>
        </div>

        <div className="availability-rule" />

        {error ? <div className="error-text">{error}</div> : null}
        {syncMessage ? (
          <div className="availability-sync-banner">
            <div className="availability-sync-text">{syncMessage}</div>
          </div>
        ) : null}

        {loading ? (
          <div className="empty-state">
            <div className="empty-icon">◈</div>
            <div className="empty-t">Loading availability</div>
            <div className="empty-s">
              Pulling weekly hours, manual overrides, and Outlook sync state.
            </div>
          </div>
        ) : (
          <div className="avail-layout">
            <div>
              <div className="week-nav">
                <div className="week-label">{weekLabel}</div>
                <div className="week-arrows">
                  <button
                    type="button"
                    className="availability-icon-btn"
                    onClick={() => setWeekOffset((prev) => prev - 1)}
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    className="availability-icon-btn availability-today-btn"
                    onClick={() => setWeekOffset(0)}
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    className="availability-icon-btn"
                    onClick={() => setWeekOffset((prev) => prev + 1)}
                  >
                    ›
                  </button>
                </div>
                {!readOnly ? (
                  <>
                    <button
                      type="button"
                      className="availability-icon-btn"
                      onClick={() => setShowSettings(true)}
                      title="Edit opening hours"
                    >
                      ⚙
                    </button>
                    <button
                      type="button"
                      className="availability-action-btn"
                      onClick={saveCalendar}
                      disabled={saving}
                    >
                      {saving ? "Saving…" : "Save Availability"}
                    </button>
                  </>
                ) : (
                  <div className="availability-readonly-note">
                    Viewing {effectiveAdminProfile?.adminName || "admin"} in
                    read-only mode
                  </div>
                )}
              </div>

              <div className="day-columns">
                {weekDates.map(({ dayKey, date }) => {
                  const dayConfig =
                    calendarDoc.dayConfigs?.[dayKey] || createDefaultDay();
                  const dayName = DAY_LABELS[dayKey];
                  const dateKey = toDateKey(date);
                  const slotOverrides = calendarDoc.slotOverrides?.[dateKey] || {};
                  const slotSync = calendarDoc.slotSync?.[dateKey] || {};
                  const slots = dayConfig.isOpen
                    ? buildTimeSlots(dayConfig.openTime, dayConfig.closeTime)
                    : [];

                  return (
                    <div key={dateKey}>
                      <button
                        type="button"
                        className="day-col-hdr day-col-hdr-button"
                        onClick={(event) => {
                          if (readOnly) return;
                          const rect =
                            event.currentTarget.getBoundingClientRect();
                          setPicker({
                            x: rect.right + 6,
                            y: rect.top,
                            dateKey,
                            slotKeys: slots.map((slot) => slot.key),
                            mode: "day",
                          });
                        }}
                        disabled={readOnly || !dayConfig.isOpen || slots.length === 0}
                      >
                        <div className="day-col-name">{dayName.slice(0, 3)}</div>
                        <div
                          className={`day-col-num ${
                            isTodayDate(date) ? "today" : ""
                          }`}
                        >
                          {date.getDate()}
                        </div>
                      </button>

                      {!dayConfig.isOpen ? (
                        <div className="availability-day-closed">Closed</div>
                      ) : (
                        slots.map((slot) => {
                          const merged = getMergedSlotState({
                            defaultStatus:
                              dayConfig.defaultSlots?.[slot.key] || "open",
                            manualOverride: slotOverrides[slot.key],
                            syncRecord: slotSync[slot.key],
                          });

                          return (
                            <button
                              key={slot.key}
                              type="button"
                              className={`slot ${
                                STATUS_CLASS[merged.status] || "open"
                              }`}
                              onClick={(event) => {
                                if (readOnly) return;
                                const rect =
                                  event.currentTarget.getBoundingClientRect();
                                setPicker({
                                  x: rect.right + 6,
                                  y: rect.top,
                                  dateKey,
                                  timeKey: slot.key,
                                  mode: "slot",
                                });
                              }}
                              disabled={readOnly}
                            >
                              <div className="slot-time">{slot.label}</div>
                              <div
                                className={`slot-status ${
                                  merged.status === "open" ? "is-empty" : ""
                                }`}
                              >
                                {merged.status === "open"
                                  ? "Available"
                                  : STATUS_LABELS[merged.status]}
                              </div>
                              {merged.status === "residentMeeting" &&
                              merged.description ? (
                                <div className="slot-note" title={merged.description}>
                                  {merged.description}
                                </div>
                              ) : null}
                            </button>
                          );
                        })
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="sidebar">
              <div className="legend-card">
                <div className="legend-title">Meeting Requests</div>
                <div className="availability-small-note">
                  Requests from the tablet app appear here for approval.
                </div>
                {requestsLoading ? (
                  <div className="muted">Loading requests…</div>
                ) : requestsError ? (
                  <div className="error-text">{requestsError}</div>
                ) : meetingRequests.filter((request) => request.status !== "approved")
                    .length === 0 ? (
                  <div className="muted">
                    No resident meeting requests for this admin yet.
                  </div>
                ) : (
                  <div className="meeting-request-list">
                    {meetingRequests
                      .filter((request) => request.status !== "approved")
                      .map((request) => (
                      <div key={request.id} className="meeting-request-card">
                        <div className="meeting-request-head">
                          <div className="meeting-request-name">
                            {request.residentName || "Resident"}
                          </div>
                          <div
                            className={`meeting-request-pill status-${request.status}`}
                          >
                            {request.status}
                          </div>
                        </div>
                        <div className="meeting-request-address">
                          {request.unitLabel || "No address provided"}
                        </div>
                        <div className="meeting-request-title">
                          {request.title || "No reason provided"}
                        </div>
                        <div className="meeting-request-slots">
                          {(request.requestedSlots || []).length ? (
                            request.requestedSlots.map((slot) => (
                              <div
                                key={`${request.id}:${slot.dateKey}:${slot.timeKey}`}
                                className="meeting-request-slot"
                              >
                                {formatRequestSlot(slot.dateKey, slot.timeKey)}
                              </div>
                            ))
                          ) : (
                            <div className="meeting-request-slot">
                              No slots attached
                            </div>
                          )}
                        </div>
                        <div className="meeting-request-actions">
                          {!readOnly && request.status !== "approved" ? (
                            <button
                              type="button"
                              className="mini-btn mini-approve"
                              onClick={() =>
                                handleMeetingRequestStatusChange(
                                  request,
                                  "approved"
                                )
                              }
                            >
                              Approve
                            </button>
                          ) : null}
                          {!readOnly && request.status !== "rejected" ? (
                            <button
                              type="button"
                              className="mini-btn mini-reject"
                              onClick={() =>
                                handleMeetingRequestStatusChange(
                                  request,
                                  "rejected"
                                )
                              }
                            >
                              Reject
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="outlook-card">
                <div className="outlook-title">Microsoft Outlook</div>
                <div className="outlook-status">
                  <span className="outlook-dot disconnected" />
                  <span className="outlook-status-text">Coming soon</span>
                </div>

                <div className="outlook-desc">
                  Outlook sync is paused for now. When permissions are ready,
                  this panel will import office meetings into Firestore so the
                  tablet kiosk can display live availability without login.
                </div>

                <button
                  type="button"
                  className="availability-action-btn availability-full-btn"
                  onClick={() =>
                    setSyncMessage("Outlook sync is coming soon.")
                  }
                >
                  Coming Soon
                </button>

                <div className="availability-status-line">
                  Last sync: unavailable
                </div>
              </div>

              <div className="availability-tablet-card">
                <div className="outlook-title">Tablet Kiosk View</div>
                <div className="outlook-desc">
                  The tablet app can fetch this same Firestore availability
                  document and show open slots to unauthenticated visitors for
                  scheduling requests.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {showSettings ? (
        <div
          className="availability-modal-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget) setShowSettings(false);
          }}
        >
          <div className="availability-modal availability-modal-wide">
            <button
              type="button"
              className="availability-modal-close"
              onClick={() => setShowSettings(false)}
            >
              ✕
            </button>
            <div className="availability-modal-title">Opening Hours</div>
            <div className="availability-modal-sub">
              Set recurring hours per day. These define which slots exist.
            </div>

            <div className="settings-grid">
              {DAY_ORDER.map((dayKey) => {
                const config = calendarDoc.dayConfigs?.[dayKey] || createDefaultDay();
                return (
                  <div key={dayKey} className="day-setting">
                    <div className="ds-day">{DAY_LABELS[dayKey]}</div>
                    <div className="ds-row">
                      <div className="ds-label">Opens</div>
                      <input
                        type="time"
                        step="1800"
                        className="ds-input"
                        value={config.openTime}
                        onChange={(event) =>
                          updateDayHours(dayKey, "openTime", event.target.value)
                        }
                        disabled={!config.isOpen}
                      />
                    </div>
                    <div className="ds-row">
                      <div className="ds-label">Closes</div>
                      <input
                        type="time"
                        step="1800"
                        className="ds-input"
                        value={config.closeTime}
                        onChange={(event) =>
                          updateDayHours(dayKey, "closeTime", event.target.value)
                        }
                        disabled={!config.isOpen}
                      />
                    </div>
                    <div className="ds-closed">
                      <button
                        type="button"
                        className={`toggle ${!config.isOpen ? "on" : ""}`}
                        onClick={() =>
                          updateDayHours(dayKey, "isOpen", !config.isOpen)
                        }
                      >
                        <span className="toggle-knob" />
                      </button>
                      <span className="availability-toggle-label">
                        {config.isOpen ? "Open" : "Closed"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="availability-modal-actions">
              <button
                type="button"
                className="availability-action-btn availability-modal-save"
                onClick={() => setShowSettings(false)}
              >
                Save Hours
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showCalendarSetup ? (
        <div
          className="availability-modal-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setShowCalendarSetup(false);
              setCalendarNameDraft("");
            }
          }}
        >
          <div className="availability-modal availability-description-modal">
            <button
              type="button"
              className="availability-modal-close"
              onClick={() => {
                setShowCalendarSetup(false);
                setCalendarNameDraft("");
              }}
            >
              ✕
            </button>
            <div className="availability-modal-title">Set Up Calendar</div>
            <div className="availability-modal-sub">
              Create a leasing office staff calendar for this property.
            </div>
            <input
              type="text"
              className="availability-sync-input availability-name-input"
              value={calendarNameDraft}
              onChange={(event) => setCalendarNameDraft(event.target.value)}
              placeholder="Enter leasing staff name"
            />
            <div className="availability-modal-actions">
              <button
                type="button"
                className="availability-ghost-btn"
                onClick={() => {
                  setShowCalendarSetup(false);
                  setCalendarNameDraft("");
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="availability-action-btn availability-modal-save"
                onClick={createCalendar}
              >
                Create Calendar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {picker ? (
        <SlotPicker
          x={picker.x}
          y={picker.y}
          onPick={handlePickerSelection}
          onClose={() => setPicker(null)}
        />
      ) : null}

      {pendingResidentAssignment ? (
        <div
          className="availability-modal-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setPendingResidentAssignment(null);
              setDescriptionDraft("");
            }
          }}
        >
          <div className="availability-modal availability-description-modal">
            <button
              type="button"
              className="availability-modal-close"
              onClick={() => {
                setPendingResidentAssignment(null);
                setDescriptionDraft("");
              }}
            >
              ✕
            </button>
            <div className="availability-modal-title">Resident Meeting</div>
            <div className="availability-modal-sub">
              Add a short description for this resident meeting.
            </div>
            <textarea
              className="availability-sync-input availability-description-input"
              rows={5}
              value={descriptionDraft}
              onChange={(event) => setDescriptionDraft(event.target.value)}
              placeholder="Example: Lease renewal with unit 504"
            />
            <div className="availability-modal-actions">
              <button
                type="button"
                className="availability-ghost-btn"
                onClick={() => {
                  setPendingResidentAssignment(null);
                  setDescriptionDraft("");
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="availability-action-btn availability-modal-save"
                onClick={saveResidentMeeting}
              >
                Save Meeting
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
