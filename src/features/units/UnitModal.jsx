import React from "react";
import { X } from "lucide-react";

export default function UnitModal({
  buildingName,
  unit,
  onChangeField,
  onSave,
  onClear,
  onClose,
}) {
  return (
    <div className="add-booking-modal">
      <div className="add-booking-card admin-theme">
        <div className="add-booking-header">
          <div>
            <p className="add-booking-kicker">
              {unit.id ? "Edit unit" : "Add unit"}
            </p>
            <h2>
              {unit.id
                ? `Unit ${unit.unitLabel || ""}`
                : `New Unit for ${buildingName}`}
            </h2>
          </div>
          <button
            className="add-close-btn"
            type="button"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        <div className="add-booking-grid">
          <div className="form-field">
            <label className="field-label">Unit Label</label>
            <input
              type="text"
              className="field-input modal-input"
              placeholder="e.g. 225, 12B"
              value={unit.unitLabel}
              onChange={(e) =>
                onChangeField("unitLabel", e.target.value)
              }
            />
          </div>

          <div className="form-field">
            <label className="field-label">Resident Names</label>
            <input
              type="text"
              className="field-input modal-input"
              placeholder="e.g. John Doe, Jane Doe"
              value={unit.residentNames}
              onChange={(e) =>
                onChangeField("residentNames", e.target.value)
              }
            />
          </div>

          <div className="form-field">
            <label className="field-label">Status</label>
            <select
              className="field-input modal-input"
              value={unit.active ? "active" : "inactive"}
              onChange={(e) =>
                onChangeField("active", e.target.value === "active")
              }
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive / Vacant</option>
            </select>
          </div>

          <div className="form-field">
            <label className="field-label">Notes</label>
            <input
              type="text"
              className="field-input modal-input"
              placeholder="Internal notes about this unit"
              value={unit.notes}
              onChange={(e) => onChangeField("notes", e.target.value)}
            />
          </div>
        </div>

        <div className="add-booking-actions">
          <button
            type="button"
            className="submit-wide-btn admin"
            onClick={onSave}
          >
            Save Unit
          </button>
          <button
            type="button"
            className="clear-light-btn admin"
            onClick={onClear}
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}