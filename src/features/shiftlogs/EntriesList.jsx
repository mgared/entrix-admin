// src/features/shiftlogs/EntriesList.jsx
import React, { useMemo, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { deleteShiftEntry } from "./shiftLogApi";
import EntryForm from "./EntryForm";

import { useToast } from "../../components/feedback/useToast";
import { useConfirm } from "../../components/feedback/useConfirm";

function toMillis(t) {
  if (!t) return null;

  // Firestore Timestamp
  if (typeof t.toMillis === "function") return t.toMillis();

  // plain object {seconds, nanoseconds}
  if (typeof t === "object" && t?.seconds != null) {
    const ms =
      Number(t.seconds) * 1000 + Math.floor(Number(t.nanoseconds || 0) / 1e6);
    return Number.isFinite(ms) ? ms : null;
  }

  if (t instanceof Date) return t.getTime();

  const ms = new Date(t).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function occurredMillis(entry) {
  const ms = toMillis(entry?.occurredAt) ?? toMillis(entry?.createdAt);
  // ✅ missing timestamps should go LAST, not FIRST
  return ms == null ? Number.POSITIVE_INFINITY : ms;
}

function chip(label, value) {
  if (!value && value !== false) return null;

  const text =
    value === true
      ? `${label}: Yes`
      : value === false
      ? `${label}: No`
      : `${label}: ${value}`;

  return (
    <span
      key={`${label}-${String(value)}`}
      style={{
        fontSize: 12,
        padding: "2px 8px",
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,0.10)",
        background: "rgba(255,255,255,0.04)",
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </span>
  );
}

export default function EntriesList({
  propertyId,
  shiftLog,
  canEdit,
  shiftLogHelper,
  admin,
}) {
  const entries = useMemo(() => {
    const map = shiftLog?.entries || {};
    const arr = Object.entries(map)
      .map(([id, entry]) => (entry ? { id, ...entry } : null))
      .filter(Boolean);

    // ✅ oldest on top
    return arr.sort((a, b) => {
      const ao = occurredMillis(a);
      const bo = occurredMillis(b);
      if (ao !== bo) return ao - bo;

      // tie-breakers for stable sort
      const ac = toMillis(a?.createdAt) ?? Number.POSITIVE_INFINITY;
      const bc = toMillis(b?.createdAt) ?? Number.POSITIVE_INFINITY;
      if (ac !== bc) return ac - bc;

      return String(a.id).localeCompare(String(b.id));
    });
  }, [shiftLog]);

  const [editing, setEditing] = useState(null);
  const [deletingId, setDeletingId] = useState("");

  const toast = useToast();
  const confirm = useConfirm();

  const onDelete = async (entry) => {
    if (!canEdit) return;

    const entryId = entry?.id;
    if (!entryId) {
      toast.error("Missing entryId (cannot delete).");
      return;
    }

    const ok = await confirm({
      title: "Delete log entry?",
      message: "This will permanently remove this entry from the shift log.",
      confirmText: "Delete",
      cancelText: "Cancel",
      tone: "danger",
    });

    if (!ok) return;

    try {
      setDeletingId(entryId);
      await deleteShiftEntry({
        propertyId,
        shiftLogId: shiftLog.id,
        entryId,
        entry,
      });
      toast.success("Entry deleted.");
    } catch (err) {
      console.error(err);
      toast.error(err?.message || "Failed to delete entry.");
    } finally {
      setDeletingId("");
    }
  };

  if (!entries.length) {
    return (
      <div className="muted" style={{ marginTop: 12 }}>
        No entries yet.
      </div>
    );
  }

  return (
    <div style={{ marginTop: 12 }}>
      <div className="list">
        {entries.map((e) => {
          const details = [
            chip("Incident", e.incident),
            chip("Move-in/out", e.moveInOut),
            chip("Highlight PM", e.highlightPropertyManager),
            chip("Highlight Maint.", e.highlightMaintenance),
            chip("Highlight Concierge", e.highlightConciergeTeam),
          ].filter(Boolean);

          const html = e.sentenceHtml;
          const text = e.sentenceText || e.sentence || "—";

          return (
            <div
              key={e.id}
              className="list-row"
              style={{ display: "flex", gap: 10, alignItems: "flex-start" }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ wordBreak: "break-word", whiteSpace: "normal" }}>
                  {html ? (
                    <div
                      dangerouslySetInnerHTML={{ __html: html }}
                      style={{ display: "inline" }}
                    />
                  ) : (
                    text
                  )}
                </div>

                {details.length > 0 && (
                  <div
                    style={{
                      marginTop: 6,
                      display: "flex",
                      gap: 6,
                      flexWrap: "wrap",
                      opacity: 0.95,
                    }}
                  >
                    {details}
                  </div>
                )}
              </div>

              {canEdit && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    className="icon-button"
                    title="Edit"
                    onClick={() => setEditing({ entryId: e.id, entry: e })}
                  >
                    <Pencil size={16} />
                  </button>

                  <button
                    type="button"
                    className="icon-button"
                    title="Delete"
                    disabled={deletingId === e.id}
                    onClick={() => onDelete(e)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {editing && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 9999,
          }}
          onMouseDown={(evt) => {
            if (evt.target === evt.currentTarget) setEditing(null);
          }}
        >
          <div
            className="panel"
            style={{
              width: "min(980px, 100%)",
              maxHeight: "90vh",
              overflow: "auto",
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div
              className="panel-header"
              style={{ display: "flex", justifyContent: "space-between" }}
            >
              <h2 style={{ margin: 0 }}>Edit Entry</h2>
              <button
                className="icon-button"
                type="button"
                onClick={() => setEditing(null)}
              >
                ✕
              </button>
            </div>

            <div className="panel-body">
              <EntryForm
                mode="edit"
                entryId={editing.entryId}
                initialEntry={editing.entry}
                propertyId={propertyId}
                shiftLog={shiftLog}
                admin={admin}
                shiftLogHelper={shiftLogHelper}
                onCancel={() => setEditing(null)}
                onSaved={() => setEditing(null)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
