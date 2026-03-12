// ShiftLogUnitFilterModal.jsx
import React, { useEffect, useMemo, useState } from "react";

const FILTERS = [
  { key: "all", label: "All entries" },
  { key: "anyFlag", label: "Any flagged" },
  { key: "incident", label: "Incident" },
  { key: "moveInOut", label: "Move-in/out" },
  { key: "highlightPropertyManager", label: "PM highlight" },
  { key: "highlightMaintenance", label: "Maintenance highlight" },
  { key: "highlightConciergeTeam", label: "Concierge highlight" },
];

export default function ShiftLogUnitFilterModal({
  propertyId,
  shiftLogHelper,
  onClose,
  onApply,
}) {
  const [unitOrStreetNumber, setUnitOrStreetNumber] = useState("");
  const [streetOrBuildingName, setStreetOrBuildingName] = useState("");
  const [filterKey, setFilterKey] = useState("anyFlag");

  const buildingsAndStreets = useMemo(() => {
    const raw = shiftLogHelper?.buildingsAndStreets;
    const arr = Array.isArray(raw) ? raw : [];
    return Array.from(
      new Set(arr.map((s) => String(s || "").trim()).filter(Boolean))
    );
  }, [shiftLogHelper?.buildingsAndStreets]);

  const showStreetDropdown = buildingsAndStreets.length > 0;
  const streetOnlyOne = buildingsAndStreets.length === 1;

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

  const unitLabel = useMemo(() => {
    return [unitOrStreetNumber, streetOrBuildingName]
      .filter(Boolean)
      .join(" ")
      .trim();
  }, [unitOrStreetNumber, streetOrBuildingName]);

  const canApply = !!(unitOrStreetNumber.trim() && streetOrBuildingName.trim());

  return (
    <div className="modal-backdrop">
      <div className="modal-card shiftlog-filter-modal">
        <div className="modal-header-filter">
          <div>
            <div style={{ fontWeight: 800, fontSize: 18 }}>
              Filter by Unit + Flags
            </div>
            <div className="muted" style={{ marginTop: 4 }}>
              Searches unit entries index (fast).
            </div>
          </div>
          <button className="icon-button" onClick={onClose} title="Close">
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="field-row">
            <div>
              <div className="field-label">Unit / Street #</div>
              <input
                className="text-input"
                value={unitOrStreetNumber}
                onChange={(e) => setUnitOrStreetNumber(e.target.value)}
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
                  placeholder="e.g. Bartlett"
                />
              )}
            </div>
          </div>

          <div className="muted" style={{ marginTop: 10, padding: 0 }}>
            Unit label: <b>{unitLabel || "—"}</b>
          </div>

          <div className="chip-row">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                className={`chip ${filterKey === f.key ? "chip-active" : ""}`}
                onClick={() => setFilterKey(f.key)}
                disabled={!canApply}
                title={!canApply ? "Enter unit + street/building first" : ""}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="modal-actions">
            <button className="secondary-button" onClick={onClose}>
              Close
            </button>

            <button
              className="primary-line-btn"
              disabled={!canApply}
              onClick={() =>
                onApply?.({
                  propertyId,
                  unitLabel,
                  unitOrStreetNumber,
                  streetOrBuildingName,
                  filterKey,
                  selectedEntryId: "",
                  selectedShiftLogId: "",
                })
              }
            >
              Open results tab
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
