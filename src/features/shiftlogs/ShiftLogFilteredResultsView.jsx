// src/features/shiftlogs/ShiftLogFilteredResultsView.jsx
import React, { useEffect, useMemo, useState } from "react";
import useUnitEntriesFilter from "./useUnitEntriesFilter";
import useShiftLogDoc from "./useShiftLogDoc";
import useUnitDoc from "./useUnitDoc";

const FILTERS = [
  { key: "all", label: "All entries" },
  { key: "anyFlag", label: "Any flagged" },
  { key: "incident", label: "Incident" },
  { key: "moveInOut", label: "Move-in/out" },
  { key: "highlightPropertyManager", label: "PM highlight" },
  { key: "highlightMaintenance", label: "Maintenance highlight" },
  { key: "highlightConciergeTeam", label: "Concierge highlight" },
];

function getFlagCount(unitDoc, key) {
  const flags = unitDoc?.counts?.flags || {};
  if (key === "all") return null;
  if (key === "anyFlag") return Number(flags.anyFlag || 0);
  return Number(flags[key] || 0);
}

export default function ShiftLogFilteredResultsView({
  propertyId,
  session,
  closedShiftLogs,
  shiftLogHelper,
  onJumpToRecent,
  onCloseTab,
}) {
  const buildingsAndStreets = useMemo(() => {
    const raw = shiftLogHelper?.buildingsAndStreets;
    const arr = Array.isArray(raw) ? raw : [];
    return Array.from(
      new Set(arr.map((s) => String(s || "").trim()).filter(Boolean))
    );
  }, [shiftLogHelper?.buildingsAndStreets]);

  const showStreetDropdown = buildingsAndStreets.length > 0;
  const streetOnlyOne = buildingsAndStreets.length === 1;

  // Draft (typing) inputs
  const [unitOrStreetNumber, setUnitOrStreetNumber] = useState("");
  const [streetOrBuildingName, setStreetOrBuildingName] = useState("");

  // Applied (committed) query label used for fetching
  const [appliedUnitLabel, setAppliedUnitLabel] = useState("");

  // Filters / selection
  const [filterKey, setFilterKey] = useState(session?.filterKey || "anyFlag");
  const [selectedEntryId, setSelectedEntryId] = useState(
    session?.selectedEntryId || ""
  );
  const [selectedShiftLogId, setSelectedShiftLogId] = useState(
    session?.selectedShiftLogId || ""
  );

  // Draft label (recomputed on typing only)
  const draftUnitLabel = useMemo(() => {
    return [unitOrStreetNumber, streetOrBuildingName]
      .filter(Boolean)
      .join(" ")
      .trim();
  }, [unitOrStreetNumber, streetOrBuildingName]);

  const canApply = !!unitOrStreetNumber.trim() && !!streetOrBuildingName.trim();
  const canQuery = appliedUnitLabel.length > 0;

  const applySearch = () => {
    if (!canApply) return;
    setAppliedUnitLabel(draftUnitLabel);
    setSelectedEntryId("");
    setSelectedShiftLogId("");
  };

  const clearSearch = () => {
    setUnitOrStreetNumber("");
    setStreetOrBuildingName("");
    setAppliedUnitLabel("");
    setSelectedEntryId("");
    setSelectedShiftLogId("");
  };

  // Keep local inputs in sync if session changes (draft + applied)
  useEffect(() => {
    const u = session?.unitOrStreetNumber || "";
    const s = session?.streetOrBuildingName || "";

    // if your session stores these, use them:
    if (u || s) {
      setUnitOrStreetNumber(u);
      setStreetOrBuildingName(s);
      const combined = [u, s].filter(Boolean).join(" ").trim();
      setAppliedUnitLabel(combined);
      return;
    }

    // fallback if only unitLabel exists:
    const ul = String(session?.unitLabel || "").trim();
    if (ul) {
      const m = ul.match(/^(\S+)\s+(.+)$/);
      const uu = m?.[1] || "";
      const ss = m?.[2] || "";
      setUnitOrStreetNumber(uu);
      setStreetOrBuildingName(ss);
      setAppliedUnitLabel(ul);
      return;
    }

    // default: clear
    setUnitOrStreetNumber("");
    setStreetOrBuildingName("");
    setAppliedUnitLabel("");
  }, [session]);

  // Auto-select only street if there’s exactly one (draft)
  useEffect(() => {
    if (!showStreetDropdown) return;
    if (streetOnlyOne && !(streetOrBuildingName || "").trim()) {
      setStreetOrBuildingName(buildingsAndStreets[0]);
    }
  }, [
    showStreetDropdown,
    streetOnlyOne,
    buildingsAndStreets,
    streetOrBuildingName,
  ]);

  // Keep filter/selection in sync with session
  useEffect(() => {
    setFilterKey(session?.filterKey || "anyFlag");
    setSelectedEntryId(session?.selectedEntryId || "");
    setSelectedShiftLogId(session?.selectedShiftLogId || "");
  }, [session]);

  // Fetch unit doc only when applied label exists
  const unitDoc = useUnitDoc(propertyId, canQuery ? appliedUnitLabel : "");

  // Fetch rows only when applied label exists
  const { rows, loading, error, canLoadMore, loadMore } = useUnitEntriesFilter({
    propertyId,
    unitLabel: canQuery ? appliedUnitLabel : "",
    filterKey,
  });

  const closedIdSet = useMemo(
    () => new Set((closedShiftLogs || []).map((s) => s.id)),
    [closedShiftLogs]
  );

  const {
    row: selectedShiftLog,
    loading: shiftLoading,
    error: shiftError,
  } = useShiftLogDoc(propertyId, selectedShiftLogId);

  const selectedEntry = useMemo(() => {
    return rows.find((r) => (r.entryId || r.id) === selectedEntryId) || null;
  }, [rows, selectedEntryId]);

  const openInRecentIfAvailable = () => {
    const sid = selectedShiftLogId;
    if (!sid) return;
    if (closedIdSet.has(sid)) onJumpToRecent?.(sid);
  };

  // Auto-select first row when rows load after a search
  useEffect(() => {
    if (!selectedEntryId && rows.length > 0) {
      const first = rows[0];
      const rid = first.entryId || first.id || "";
      setSelectedEntryId(rid);
      setSelectedShiftLogId(first.shiftLogId || "");
    }
  }, [rows, selectedEntryId]);

  return (
    <div className="shiftlogs-split">
      {/* LEFT: results */}
      <div className="shiftlogs-list">
        <div
          style={{
            padding: 10,
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 10,
            }}
          >
            <div>
              <div style={{ fontWeight: 700 }}>Filtered Results</div>
              <div className="muted" style={{ marginTop: 4 }}>
                Unit entries index (fast)
              </div>
            </div>

            <button className="secondary-button" onClick={onCloseTab}>
              Close tab
            </button>
          </div>

          {/* Inputs */}
          <div className="shiftlog-filter-grid" style={{ marginTop: 10 }}>
            <div>
              <div className="field-label">Unit / Street #</div>
              <input
                className="text-input"
                value={unitOrStreetNumber}
                onChange={(e) => setUnitOrStreetNumber(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applySearch();
                }}
                placeholder="e.g. 777"
              />
            </div>

            <div>
              <div className="field-label">Street / Building</div>

              {showStreetDropdown ? (
                <select
                  className="text-input"
                  value={streetOrBuildingName}
                  onChange={(e) => setStreetOrBuildingName(e.target.value)}
                  disabled={streetOnlyOne}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") applySearch();
                  }}
                >
                  {!streetOnlyOne && <option value="">Select…</option>}
                  {buildingsAndStreets.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="text-input"
                  value={streetOrBuildingName}
                  onChange={(e) => setStreetOrBuildingName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") applySearch();
                  }}
                  placeholder="e.g. Bartlett"
                />
              )}
            </div>
          </div>

          {/* Apply / Clear */}
          <div
            style={{
              marginTop: 10,
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <button
              className="secondary-button"
              type="button"
              onClick={clearSearch}
            >
              Clear
            </button>

            <button
              className="primary-button"
              type="button"
              disabled={!canApply}
              onClick={applySearch}
              title={!canApply ? "Enter unit + street/building first" : ""}
            >
              Search
            </button>
          </div>

          {/* Applied label display */}
          <div className="muted" style={{ marginTop: 10, padding: 0 }}>
            Applied: <b>{appliedUnitLabel || "—"}</b>
            {draftUnitLabel && draftUnitLabel !== appliedUnitLabel ? (
              <span style={{ marginLeft: 8, color: "#6b7280" }}>
                (typed: {draftUnitLabel})
              </span>
            ) : null}
          </div>

          {/* Chips */}
          <div
            style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}
          >
            {FILTERS.map((f) => {
              const n = getFlagCount(unitDoc, f.key);

              return (
                <button
                  key={f.key}
                  type="button"
                  className={`chip ${filterKey === f.key ? "chip-active" : ""}`}
                  onClick={() => setFilterKey(f.key)}
                  disabled={!canQuery}
                  title={!canQuery ? "Search a unit label first" : ""}
                >
                  <span>{f.label}</span>

                  {canQuery && f.key !== "all" && unitDoc ? (
                    <span className="chip-count" style={{ marginLeft: 8 }}>
                      {n}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        {/* Results list */}
        <div className="list" style={{ padding: 10 }}>
          {!canQuery ? (
            <div className="muted">
              Type unit + street/building, then press Search.
            </div>
          ) : loading ? (
            <div className="muted">Loading…</div>
          ) : error ? (
            <div className="error-text">{error}</div>
          ) : rows.length === 0 ? (
            <div className="muted">No matches found.</div>
          ) : (
            rows.map((r) => {
              const rid = r.entryId || r.id;
              const isSelected = rid === selectedEntryId;

              return (
                <button
                  key={rid}
                  type="button"
                  className={`list-row ${
                    isSelected ? "shiftlogs-row-active" : ""
                  }`}
                  onClick={() => {
                    setSelectedEntryId(rid);
                    setSelectedShiftLogId(r.shiftLogId || "");
                  }}
                  style={{ textAlign: "left" }}
                >
                  <div className="list-title">
                    {r.sentenceText || "Entry"}
                    {r.isFlagged ? (
                      <span className="badge" style={{ marginLeft: 8 }}>
                        Flagged
                      </span>
                    ) : null}
                  </div>
                  <div className="list-sub muted">
                    ShiftLog: {r.shiftLogId || "—"}
                  </div>
                </button>
              );
            })
          )}

          {canQuery && canLoadMore && (
            <div
              style={{
                marginTop: 12,
                display: "flex",
                justifyContent: "flex-end",
              }}
            >
              <button className="secondary-button" onClick={loadMore}>
                Load more results
              </button>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: preview */}
      <div className="shiftlogs-preview">
        <div className="panel" style={{ margin: 0 }}>
          <div className="panel-header shiftlogs-preview-header">
            <div className="shiftlogs-title-row">
              <h2 className="shiftlogs-title">
                {selectedShiftLog?.previewEmail?.subject || "Shift Log Preview"}
              </h2>

              {selectedShiftLogId && closedIdSet.has(selectedShiftLogId) ? (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={openInRecentIfAvailable}
                  title="Jump to this shift log in Recent list"
                >
                  Open in Recent
                </button>
              ) : null}
            </div>

            {selectedEntry ? (
              <div className="muted" style={{ marginTop: 6 }}>
                Entry: {selectedEntry.sentenceText || "—"}
              </div>
            ) : null}
          </div>

          <div className="panel-body">
            {!selectedShiftLogId ? (
              <div className="muted">
                Select a result to preview its shift log.
              </div>
            ) : shiftLoading ? (
              <div className="muted">Loading shift log…</div>
            ) : shiftError ? (
              <div className="error-text">{shiftError}</div>
            ) : !selectedShiftLog ? (
              <div className="muted">Shift log not found.</div>
            ) : (
              <div
                className="shiftlogs-body"
                style={{
                  whiteSpace: "normal",
                  overflowWrap: "anywhere",
                  wordBreak: "break-word",
                }}
              >
                {selectedShiftLog.previewEmail?.bodyHtml ? (
                  <div
                    dangerouslySetInnerHTML={{
                      __html: selectedShiftLog.previewEmail.bodyHtml,
                    }}
                  />
                ) : (
                  <pre style={{ margin: 0 }}>
                    {selectedShiftLog.previewEmail?.bodyText ||
                      selectedShiftLog.previewEmail?.body ||
                      "No email preview saved on this shift log."}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
