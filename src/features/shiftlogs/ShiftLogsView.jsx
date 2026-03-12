import React, { useEffect, useMemo, useState } from "react";
import { ScrollText } from "lucide-react";
import useActiveShiftLog from "./useActiveShiftLog";
import useClosedShiftLogs from "./useClosedShiftLogs";
import StartShiftLogModal from "./StartShiftLogModal";
import EntryForm from "./EntryForm";
import EntriesList from "./EntriesList";
import useShiftLogHelper from "./shiftLogHelper";

import { buildPreviewEmail } from "./shiftLogHelpers";
import { deleteShiftLogAndRollbackCounts } from "./shiftLogApi";
import { db } from "../../lib/firebase";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import ShiftLogUnitFilterModal from "./ShiftLogUnitFilterModal";
import ShiftLogFilteredResultsView from "./ShiftLogFilteredResultsView";

import { useToast } from "../../components/feedback/useToast";
import { useConfirm } from "../../components/feedback/useConfirm";

export default function ShiftLogsView({
  buildingId,
  buildingName,
  locationLabel,
  admin,
}) {
  const {
    rows: closed,
    loading: closedLoading,
    error: closedError,
  } = useClosedShiftLogs(buildingId);

  const roleNorm = String(admin?.role || "").toLowerCase();
  const canManageShiftLogs = roleNorm === "concierge" || roleNorm === "god";

  const {
    active,
    loading: activeLoading,
    error: activeError,
  } = useActiveShiftLog(canManageShiftLogs ? buildingId : null);

  const shiftLogHelper = useShiftLogHelper(buildingId);

  const toast = useToast();
  const confirmUI = useConfirm();

  // Safe wrappers (works even if your hook APIs differ a bit)
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
  };

  async function askConfirm(fallbackText, options) {
    // confirmUI might be:
    // 1) a function: confirmUI(...)
    // 2) an object: { confirm(...) } or { open(...) } or { ask(...) }

    const fn =
      typeof confirmUI === "function"
        ? confirmUI
        : confirmUI?.confirm ||
          confirmUI?.open ||
          confirmUI?.ask ||
          confirmUI?.show;

    if (typeof fn === "function") {
      try {
        // Prefer options object, but always include message
        const payload =
          typeof options === "object" && options
            ? { message: fallbackText, ...options }
            : { message: fallbackText };

        const res = await fn(payload);
        return !!res;
      } catch (e) {
        // ignore and fallback
      }
    }

    return window.confirm(fallbackText);
  }

  const [subTab, setSubTab] = useState("recent"); // "recent" | "active"
  const [showStart, setShowStart] = useState(false);
  const [selectedClosedId, setSelectedClosedId] = useState("");
  const [filterSession, setFilterSession] = useState(null);
  const [showFilter, setShowFilter] = useState(false);

  const hasActive = canManageShiftLogs && !!active;

  useEffect(() => {
    // only "active" needs concierge/god
    if (!canManageShiftLogs && subTab === "active") setSubTab("recent");
  }, [canManageShiftLogs, subTab]);

  useEffect(() => {
    if (subTab !== "recent" && showFilter) setShowFilter(false);
  }, [subTab, showFilter]);

  useEffect(() => {
    setSubTab("recent");
    setSelectedClosedId("");
    setFilterSession(null);
    setShowFilter(false);
  }, [buildingId]);

  useEffect(() => {
    if (subTab === "filter" && !filterSession) setSubTab("recent");
  }, [subTab, filterSession]);

  const tabs = useMemo(() => {
    const t = [{ key: "recent", label: "Recent Shift Logs" }];
    if (hasActive) t.push({ key: "active", label: "Active Shift Log" });
    if (filterSession) t.push({ key: "filter", label: "Filtered Results" });
    return t;
  }, [hasActive, filterSession]);

  // if active disappears (discarded/closed), kick back to recent
  useEffect(() => {
    if (subTab === "active" && !active) setSubTab("recent");
  }, [subTab, active]);

  const closeShift = async () => {
    if (!active?.id) return;

    const ok = await askConfirm("Close this shift log?", {
      title: "Close shift log?",
      message:
        "This will mark the shift log as closed and generate the preview email.",
      confirmText: "Close shift log",
      cancelText: "Cancel",
      tone: "danger",
    });
    if (!ok) return;

    try {
      const { subject, bodyText, bodyHtml } = buildPreviewEmail({
        shiftLog: active,
        buildingName,
        locationLabel,
      });

      const ref = doc(db, "Properties", buildingId, "shiftLogs", active.id);

      await updateDoc(ref, {
        status: "closed",
        shiftEnd: serverTimestamp(),
        closedAt: serverTimestamp(),
        previewEmail: {
          subject: subject || "",
          bodyText: bodyText || "",
          bodyHtml: bodyHtml || "",
          generatedAt: serverTimestamp(),
          generatedBy: admin?.id || admin?.name || "concierge",
        },
      });

      notify.success("Shift log closed.");
      setSubTab("recent");
    } catch (e) {
      console.error(e);
      notify.error(e?.message || "Failed to close shift log.");
    }
  };

  const discardShift = async () => {
    if (!active?.id) return;

    const ok = await askConfirm(
      "Discard this shift log? This will permanently delete it (and all entries).",
      {
        title: "Discard shift log?",
        message:
          "This will permanently delete the shift log and all entries. This cannot be undone.",
        confirmText: "Discard shift log",
        cancelText: "Cancel",
        tone: "danger",
      }
    );
    if (!ok) return;

    try {
      await deleteShiftLogAndRollbackCounts({
        propertyId: buildingId,
        shiftLogId: active.id,
        shiftLog: active,
      });

      notify.success("Shift log discarded.");
      setSubTab("recent");
    } catch (e) {
      console.error(e);
      notify.error(e?.message || "Failed to discard shift log.");
    }
  };

  return (
    <section className="panel">
      <div className="panel-header">
        <div className="panel-title-wrap">
          <ScrollText size={18} />
          <h2>Shift Logs</h2>

          <div className="nav-tabs" style={{ marginTop: 0, marginLeft: 12 }}>
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                className={`nav-tab ${
                  subTab === t.key ? "nav-tab-active" : ""
                }`}
                onClick={() => setSubTab(t.key)}
              >
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {subTab === "recent" && (
            <button
              className="secondary-button"
              onClick={() => setShowFilter(true)}
            >
              Filter
            </button>
          )}

          {canManageShiftLogs && !hasActive && (
            <button
              className="primary-button"
              disabled={!shiftLogHelper}
              onClick={() => setShowStart(true)}
            >
              Start Shift Log
            </button>
          )}
        </div>
      </div>

      <div className="panel-body">
        {subTab === "recent" && (
          <>
            <div className="muted" style={{ padding: 0, marginBottom: 10 }}>
              Recent closed shift logs for {buildingName}.
            </div>

            {closedLoading ? (
              <div className="muted">Loading shift logs…</div>
            ) : closedError ? (
              <div className="error-text">{closedError}</div>
            ) : closed.length === 0 ? (
              <div className="muted">No closed shift logs yet.</div>
            ) : (
              <RecentSplitView
                closed={closed}
                selectedId={selectedClosedId || closed[0]?.id}
                onSelect={setSelectedClosedId}
              />
            )}
          </>
        )}

        {subTab === "active" && canManageShiftLogs && (
          <>
            {activeLoading ? (
              <div className="muted">Loading active shift log…</div>
            ) : activeError ? (
              <div className="error-text">{activeError}</div>
            ) : !active ? (
              <div className="muted">No active shift log.</div>
            ) : (
              <>
                {/* ✅ only ONE EntryForm, and it gets shiftLogHelper */}
                <EntryForm
                  propertyId={buildingId}
                  shiftLog={active}
                  admin={admin}
                  shiftLogHelper={shiftLogHelper}
                />

                <div
                  style={{
                    marginTop: 12,
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: 10,
                  }}
                >
                  <button className="secondary-button" onClick={discardShift}>
                    Discard Shift Log
                  </button>

                  <button className="danger-button" onClick={closeShift}>
                    Close Shift Log
                  </button>
                </div>

                {/* ✅ this was wrong before (you had EntryForm again) */}

                <EntriesList
                  shiftLog={active}
                  propertyId={buildingId}
                  canEdit
                  shiftLogHelper={shiftLogHelper}
                  admin={admin}
                />
              </>
            )}
          </>
        )}
        {subTab === "filter" && filterSession && (
          <ShiftLogFilteredResultsView
            propertyId={buildingId}
            session={filterSession}
            shiftLogHelper={shiftLogHelper}
            closedShiftLogs={closed}
            onJumpToRecent={(sid) => {
              setSelectedClosedId(sid);
              setSubTab("recent");
            }}
            onCloseTab={() => {
              setFilterSession(null);
              setSubTab("recent");
            }}
          />
        )}
      </div>
      {showFilter && (
        <ShiftLogUnitFilterModal
          propertyId={buildingId}
          shiftLogHelper={shiftLogHelper} // ✅ add this
          onClose={() => setShowFilter(false)}
          onApply={(session) => {
            setFilterSession(session);
            setSubTab("filter");
            setShowFilter(false);
          }}
        />
      )}

      {showStart && canManageShiftLogs && (
        <StartShiftLogModal
          buildingId={buildingId}
          buildingName={buildingName}
          locationLabel={locationLabel}
          admin={admin}
          shiftLogHelper={shiftLogHelper}
          onClose={() => setShowStart(false)}
          onStarted={() => {
            setShowStart(false);
            setSubTab("active");
          }}
        />
      )}
    </section>
  );
}

function RecentSplitView({ closed, selectedId, onSelect }) {
  const toast = useToast();

  const notify = {
    success: (msg) => (toast?.success ? toast.success(msg) : console.log(msg)),
    error: (msg) => (toast?.error ? toast.error(msg) : alert(msg)),
  };
  const selected = closed.find((s) => s.id === selectedId) || closed[0] || null;

  return (
    <div className="shiftlogs-split">
      <div className="shiftlogs-list">
        <div className="list">
          {closed.map((s) => {
            const isSelected = s.id === selected?.id;

            return (
              <button
                key={s.id}
                type="button"
                className={`list-row ${
                  isSelected ? "shiftlogs-row-active" : ""
                }`}
                onClick={() => onSelect?.(s.id)}
              >
                <div className="list-title">
                  {s.previewEmail?.subject || "Shift Log"}
                </div>
                <div className="list-sub muted">{s.conciergeName || "—"}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="shiftlogs-preview">
        {!selected ? (
          <div className="muted">Select a shift log to preview.</div>
        ) : (
          <div className="panel" style={{ margin: 0 }}>
            <div className="panel-header shiftlogs-preview-header">
              <div className="shiftlogs-title-row">
                <h2 className="shiftlogs-title">
                  {selected.previewEmail?.subject || "Shift Log"}
                </h2>

                <button
                  type="button"
                  className="icon-button"
                  title="Copy email subject"
                  onClick={async () => {
                    try {
                      await navigator.clipboard?.writeText(
                        selected.previewEmail?.subject || ""
                      );
                      notify.success("Copied subject.");
                    } catch (e) {
                      notify.error("Failed to copy subject.");
                    }
                  }}
                >
                  ⧉
                </button>
              </div>

              <button
                type="button"
                className="primary-line-btn"
                title="Copy full email body"
                onClick={async () => {
                  try {
                    await copyRichText({
                      html: selected.previewEmail?.bodyHtml || "",
                      text:
                        selected.previewEmail?.bodyText ||
                        selected.previewEmail?.body ||
                        "",
                    });
                    notify.success("Copied email body.");
                  } catch (e) {
                    notify.error("Failed to copy email body.");
                  }
                }}
              >
                Copy body
              </button>
            </div>

            <div className="panel-body">
              <div className="muted" style={{ padding: 0, marginBottom: 8 }}>
                Concierge: {selected.conciergeName || "—"}
              </div>

              <div
                className="shiftlogs-body"
                style={{
                  whiteSpace: "normal",
                  overflowWrap: "anywhere",
                  wordBreak: "break-word",
                }}
              >
                {selected.previewEmail?.bodyHtml ? (
                  <div
                    dangerouslySetInnerHTML={{
                      __html: selected.previewEmail.bodyHtml,
                    }}
                  />
                ) : (
                  <pre style={{ margin: 0 }}>
                    {selected.previewEmail?.bodyText ||
                      selected.previewEmail?.body ||
                      "No email preview saved on this shift log."}
                  </pre>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

async function copyRichText({ html, text }) {
  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([text], { type: "text/plain" }),
      }),
    ]);
  } catch (e) {
    // fallback
    await navigator.clipboard.writeText(text || "");
  }
}
