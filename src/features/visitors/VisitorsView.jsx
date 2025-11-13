// src/features/visitors/VisitorsView.jsx
import React from "react";
import { Users } from "lucide-react";
import FilterChip from "../../components/ui/FilterChip";
import { formatDateTime, formatSignedOut } from "../../utils/time";
import { formatRole } from "../../utils/formatters";
import { getFilteredVisitors } from "../../utils/filters";
import { demoVisitorsByBuilding } from "../../data/demoVisitors";

function VisitorsView({
  buildingId,
  visitorFilter,
  onChangeVisitorFilter,
  dataOverride, // optional: live data from Firestore hook
  loadingOverride, // optional: loading flag from hook
  errorOverride, // optional: error string from hook
}) {
  const all = Array.isArray(dataOverride)
    ? dataOverride
    : demoVisitorsByBuilding[buildingId] || [];

  const visitors = getFilteredVisitors(all, visitorFilter);

  return (
    <section className="panel">
      <div className="panel-header">
        <div className="panel-title-wrap">
          <Users size={18} />
          <h2>Visitors</h2>
        </div>

        <div className="chip-row">
          <FilterChip
            label="Today"
            active={visitorFilter === "today"}
            onClick={() => onChangeVisitorFilter("today")}
          />
          <FilterChip
            label="Last 7 days"
            active={visitorFilter === "7d"}
            onClick={() => onChangeVisitorFilter("7d")}
          />
          <FilterChip
            label="Last 30 days"
            active={visitorFilter === "30d"}
            onClick={() => onChangeVisitorFilter("30d")}
          />
          <FilterChip
            label="All"
            active={visitorFilter === "all"}
            onClick={() => onChangeVisitorFilter("all")}
          />
        </div>
      </div>

      <div className="panel-body scroll">
        {loadingOverride ? (
          <div className="muted">Loading visitors…</div>
        ) : errorOverride ? (
          <div className="error-text">{errorOverride}</div>
        ) : visitors.length === 0 ? (
          <div className="muted">
            No visitors in this range for this building.
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Unit / Address</th>
                <th>Reason</th>
                <th>Signed In</th>
                <th>Signed Out</th>
                <th>Staff Dept</th>
                <th>Staff Location</th>
                <th>Vendor Company</th>
                <th>Vendor Service</th>
              </tr>
            </thead>
            <tbody>
              {visitors.map((v) => (
                <tr key={v.id}>
                  <td>{v.fullName || "—"}</td>
                  <td>{formatRole(v.role)}</td>
                  <td>{v.unitLabel || "—"}</td>
                  <td>{v.reason || "—"}</td>
                  <td>{formatDateTime(v.createdAt)}</td>
                  <td>{formatSignedOut(v.signedOutAt)}</td>

                  <td className={v.role === "staff" ? "" : "muted-cell"}>
                    {v.role === "staff" ? v.staffDepartmentRole || "—" : "—"}
                  </td>
                  <td className={v.role === "staff" ? "" : "muted-cell"}>
                    {v.role === "staff" ? v.staffPrimaryLocation || "—" : "—"}
                  </td>

                  <td className={v.role === "vendor" ? "" : "muted-cell"}>
                    {v.role === "vendor" ? v.vendorCompany || "—" : "—"}
                  </td>
                  <td className={v.role === "vendor" ? "" : "muted-cell"}>
                    {v.role === "vendor" ? v.vendorService || "—" : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

export default VisitorsView;
