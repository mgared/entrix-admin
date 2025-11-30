// src/features/visitors/VisitorsView.jsx
import React from "react";
import { Users, ClipboardCopy } from "lucide-react";
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

const truncate = (text, max = 40) => {
  if (!text) return "";
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + "…";
};

const buildVisitLogSentence = (v) => {
  const time = formatVisitTime(v.createdAt) || "";
  const roleRaw = v.role || "";
  const roleLabel = formatRole(roleRaw);
  const name = displayFullName(v.fullName);
  const unit = v.unitLabel || "";
  const reason = (v.reason || "").trim();
  const vendorCompany = (v.vendorCompany || "").trim();
  const staffDept = (v.staffDepartmentRole || "").trim();
  const visiteeRaw = (v.visitee || "").trim();
  const contact = (v.contact || "").trim(); // 👈 future resident contact

  const cleanReason = reason.replace(/^CHR:\s*/i, "").trim();

  const hasName = name && name !== "—";
  const namePart = hasName ? ` ${name}` : "";

  // Parse visitee: "Resident: Semhal Hagos" or "CHR: Josh"
  let visiteeLabel = "";
  let visiteeTarget = "";
  if (visiteeRaw) {
    const [label, ...rest] = visiteeRaw.split(":");
    visiteeLabel = (label || "").trim(); // e.g. "Resident", "CHR"
    visiteeTarget = rest.join(":").trim(); // e.g. "Semhal Hagos", "Josh"
  }

  const visitingPhrase = (() => {
    if (!visiteeLabel || !visiteeTarget) return "";
    if (visiteeLabel.toLowerCase() === "resident") {
      return `resident ${visiteeTarget}`;
    }
    return `${visiteeLabel} (${visiteeTarget})`;
  })();

  switch (roleRaw) {
    case "resident": {
      if (unit && cleanReason) {
        return `${time} - Resident${namePart} from ${unit} arrived for ${cleanReason}.`;
      }
      if (unit) {
        return `${time} - Resident${namePart} from ${unit} arrived.`;
      }
      if (cleanReason) {
        return `${time} - Resident${namePart} arrived for ${cleanReason}.`;
      }
      return `${time} - Resident${namePart} arrived.`;
    }

    case "guest": {
      const visiting = visitingPhrase || (unit ? `unit ${unit}` : "");
      const base = `${time} - Guest${namePart}`;
      if (visiting && cleanReason) {
        return `${base} visiting ${visiting} for ${cleanReason}.`;
      }
      if (visiting) {
        return `${base} visiting ${visiting}.`;
      }
      if (cleanReason) {
        return `${base} arrived for ${cleanReason}.`;
      }
      return `${base} arrived.`;
    }

    case "futureResident": {
      const contactPart = contact ? ` (${contact})` : "";
      if (cleanReason) {
        return `${time} - Future resident${namePart}${contactPart} arrived for ${cleanReason}.`;
      }
      return `${time} - Future resident${namePart}${contactPart} arrived.`;
    }

    case "vendor": {
      const who = vendorCompany
        ? `Vendor (${vendorCompany}${hasName ? ` -${namePart}` : ""})`
        : `Vendor${namePart}`;
      const visiting =
        visitingPhrase || (unit ? `unit ${unit}` : "the property");

      if (cleanReason) {
        return `${time} - ${who} visiting ${visiting} for ${cleanReason}.`;
      }
      return `${time} - ${who} visiting ${visiting}.`;
    }

    case "staff": {
      const dlParts = [];
      if (staffDept) dlParts.push(staffDept);
      const dl = dlParts.length ? ` (${dlParts.join(" - ")})` : "";
      if (cleanReason) {
        return `${time} - Staff${namePart}${dl} signed in for ${cleanReason}.`;
      }
      return `${time} - Staff${namePart}${dl} signed in.`;
    }

    default: {
      const baseRole = roleLabel || "Visitor";
      if (cleanReason) {
        return `${time} - ${baseRole}${namePart} arrived for ${cleanReason}.`;
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
  dataOverride,
  loadingOverride,
  errorOverride,
  canLoadMore,
  onLoadMore,
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
        throw new Error("Clipboard API not available");
      }
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
                <th>Visiting</th>
                <th>Reason</th>
                <th>Signed In</th>
                <th>Vendor Company</th>
                <th>Staff Dept</th>
                <th>Future Res. Contact</th> {/* 👈 new column label */}
                <th>Signed Out</th>
                <th>Log</th>
              </tr>
            </thead>
            <tbody>
              {visitors.map((v) => (
                <tr key={v.id}>
                  <td>{displayFullName(v.fullName)}</td>
                  <td>{formatRole(v.role)}</td>
                  <td>{v.unitLabel || "—"}</td>

                  {/* visitee column (guests + vendors) */}
                  <td
                    className={
                      v.role === "vendor" || v.role === "guest"
                        ? ""
                        : "muted-cell"
                    }
                  >
                    {v.role === "vendor" || v.role === "guest"
                      ? v.visitee || "—"
                      : "—"}
                  </td>

                  <td title={v.reason || ""}>
                    {truncate(v.reason, 40) || "—"}
                  </td>

                  <td>{formatDateTime(v.createdAt)}</td>

                  <td className={v.role === "vendor" ? "" : "muted-cell"}>
                    {v.role === "vendor" ? v.vendorCompany || "—" : "—"}
                  </td>

                  <td className={v.role === "staff" ? "" : "muted-cell"}>
                    {v.role === "staff" ? v.staffDepartmentRole || "—" : "—"}
                  </td>

                  {/* future resident contact column */}
                  <td
                    className={v.role === "futureResident" ? "" : "muted-cell"}
                  >
                    {v.role === "futureResident" ? v.contact || "—" : "—"}
                  </td>

                  <td>{formatSignedOut(v.signedOutAt)}</td>

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
        {canLoadMore && onLoadMore && (
          <div className="load-more-row">
            <button
              type="button"
              className="secondary-button"
              onClick={onLoadMore}
            >
              Load older visitors
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

export default VisitorsView;
