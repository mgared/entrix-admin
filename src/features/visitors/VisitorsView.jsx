// src/features/visitors/VisitorsView.jsx
import React from "react";
import { Users, ClipboardCopy } from "lucide-react"; // ⬅️ added ClipboardCopy
import FilterChip from "../../components/ui/FilterChip";
import { formatDateTime, formatSignedOut } from "../../utils/time";
import { formatRole } from "../../utils/formatters";
import { getFilteredVisitors } from "../../utils/filters";
import { demoVisitorsByBuilding } from "../../data/demoVisitors";

// --- helpers -------------------------------------------------------------

const displayFullName = (fullName) => {
  if (!fullName || typeof fullName !== "string") return "—";
  return fullName.replace(/%/g, " ");
};

const formatVisitTime = (createdAt) => {
  if (!createdAt) return "";
  try {
    let d;
    if (createdAt.toDate) {
      d = createdAt.toDate();
    } else if (createdAt instanceof Date) {
      d = createdAt;
    } else {
      d = new Date(createdAt);
    }
    return d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
};

const buildVisitLogSentence = (v) => {
  const time = formatVisitTime(v.createdAt) || "";
  const roleRaw = v.role || "";
  const roleLabel = formatRole(roleRaw);
  const name = displayFullName(v.fullName);
  const unit = v.unitLabel || "";
  const reason = (v.reason || "").trim();
  const vendorCompany = (v.vendorCompany || "").trim();
  const vendorService = (v.vendorService || "").trim();
  const staffDept = (v.staffDepartmentRole || "").trim();
  const staffLocation = (v.staffPrimaryLocation || "").trim();

  const cleanReason = reason.replace(/^CHR:\s*/i, "").trim();

  // little helper to avoid "—" as a name
  const hasName = name && name !== "—";
  const namePart = hasName ? ` ${name}` : "";

  switch (roleRaw) {
    case "resident":
      if (unit && cleanReason) {
        return `${time} - Resident from ${unit} arrived to ${cleanReason}.`;
      }
      if (unit) {
        return `${time} - Resident from ${unit} arrived.`;
      }
      if (cleanReason) {
        return `${time} - Resident${namePart} arrived to ${cleanReason}.`;
      }
      return `${time} - Resident${namePart} arrived.`;

    case "guest":
      if (unit && cleanReason) {
        return `${time} - Guest of ${unit} arrived to ${cleanReason}.`;
      }
      if (unit) {
        return `${time} - Guest of ${unit} arrived.`;
      }
      if (cleanReason) {
        return `${time} - Guest${namePart} arrived for ${cleanReason}.`;
      }
      return `${time} - Guest${namePart} arrived.`;

    case "futureResident":
      if (cleanReason) {
        return `${time} - Future resident${namePart} arrived to ${cleanReason}.`;
      }
      return `${time} - Future resident${namePart} arrived.`;

    case "vendor": {
      const who = vendorCompany ? `Vendor (${vendorCompany})` : "Vendor";
      const where = unit || cleanReason || "the property";
      if (vendorService) {
        return `${time} - ${who} at ${where} arrived for ${vendorService}.`;
      }
      if (cleanReason) {
        return `${time} - ${who} at ${where} arrived for ${cleanReason}.`;
      }
      return `${time} - ${who} at ${where} arrived.`;
    }

    case "staff": {
      const dlParts = [];
      if (staffDept) dlParts.push(staffDept);
      if (staffLocation) dlParts.push(staffLocation);
      const dl = dlParts.length ? ` (${dlParts.join(" - ")})` : "";
      return `${time} - Staff${namePart}${dl} signed in.`;
    }

    default: {
      // generic fallback
      const baseRole = roleLabel || "Visitor";
      if (cleanReason) {
        return `${time} - ${baseRole}${namePart} arrived - ${cleanReason}.`;
      }
      return `${time} - ${baseRole}${namePart} arrived.`;
    }
  }
};

// --- component -----------------------------------------------------------

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

  const handleCopyLog = async (visit) => {
    const sentence = buildVisitLogSentence(visit);
    if (!sentence) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(sentence);
      } else {
        // very old browsers – degrade gracefully
        throw new Error("Clipboard API not available");
      }
      // you can swap this for a toast later
      console.log("Copied:", sentence);
    } catch (err) {
      console.error("Failed to copy visit log line", err);
      alert(
        "Could not copy to clipboard automatically. You can copy this text manually:\n\n" +
          sentence
      );
    }
  };

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

      <div className="panel-body">
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
                <th>Log</th>
              </tr>
            </thead>
            <tbody>
              {visitors.map((v) => (
                <tr key={v.id}>
                  <td>{displayFullName(v.fullName)}</td>
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

                  {/* copy-to-clipboard button */}
                  <td>
                    <button
                      type="button"
                      className="icon-button"
                      title="Copy log line"
                      onClick={() => handleCopyLog(v)}
                    >
                      <ClipboardCopy size={16} />
                    </button>
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
