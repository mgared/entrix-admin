// src/features/units/UnitsView.jsx
import React from "react";
import { Home as HomeIcon } from "lucide-react";

function UnitsView({
  units,
  hasUnits, // NEW
  loading, // NEW
  error, // NEW
  onToggleActive,
  onOpenEdit,
  onOpenAdd,
}) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div className="panel-title-wrap">
          <HomeIcon size={18} />
          <h2>Units</h2>
        </div>
        <p className="muted small">
          Manage unit labels, residents, and active/vacant status.
        </p>
      </div>

      <div className="panel-body scroll">
        {loading ? (
          <div className="muted">Loading units…</div>
        ) : error ? (
          <div className="error-text">{error}</div>
        ) : hasUnits === false ? (
          <div className="muted">No units for this property.</div>
        ) : units.length === 0 ? (
          <div className="muted">No units added yet.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Unit</th>
                <th>Resident Names</th>
                <th>Status</th>
                <th>Notes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {[...units]
                .sort((a, b) =>
                  (a.unitLabel || "").localeCompare(b.unitLabel || "")
                )
                .map((u) => (
                  <tr key={u.id}>
                    <td>{u.unitLabel || "—"}</td>
                    <td>{u.residentNames || "—"}</td>
                    <td>
                      <span
                        className={
                          u.active
                            ? "unit-pill unit-active"
                            : "unit-pill unit-inactive"
                        }
                        onClick={() => onToggleActive(u)} // pass whole unit (id+active)
                      >
                        {u.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>{u.notes || "—"}</td>
                    <td>
                      <button
                        type="button"
                        className="mini-btn mini-reset"
                        onClick={() => onOpenEdit(u)}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="add-booking-bar">
        <button type="button" className="primary-line-btn" onClick={onOpenAdd}>
          + Add unit
        </button>
      </div>
    </section>
  );
}

export default UnitsView;
