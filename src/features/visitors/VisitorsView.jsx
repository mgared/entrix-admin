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
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
};

const RED = "#ff4d4f";

function esc(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const truncate = (text, max = 40) => {
  if (!text) return "";
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + "…";
};

const buildVisitLogContent = (v) => {
  const time = formatVisitTime(v.createdAt) || "";
  const roleRaw = v.role || "";
  const roleLabel = formatRole(roleRaw) || "Visitor";

  const name = displayFullName(v.fullName);
  const hasName = name && name !== "—";
  const nameText = hasName ? name : "";

  const unit = (v.unitLabel || "").trim();
  const reason = (v.reason || "").trim();
  const cleanReason = reason.replace(/^CHR:\s*/i, "").trim();

  const vendorCompany = (v.vendorCompany || "").trim();
  const staffDept = (v.staffDepartmentRole || "").trim();
  const contact = (v.contact || "").trim();
  const notes = (v.notes || "").trim();

  const visiteeRaw = (v.visitee || "").trim();

  // Parse visitee: "Resident: Semhal Hagos" or "CHR: Josh"
  let visiteeLabel = "";
  let visiteeTarget = "";
  if (visiteeRaw) {
    const [label, ...rest] = visiteeRaw.split(":");
    visiteeLabel = (label || "").trim();
    visiteeTarget = rest.join(":").trim();
  }

  // We’ll show "Visiting: X" in the tail (like your other builder)
  const visitingValue = (() => {
    if (!visiteeRaw) return "";
    if (visiteeLabel && visiteeTarget) {
      // prefer target only (cleaner)
      return visiteeTarget;
    }
    return visiteeRaw;
  })();

  // Company/descriptor after name (like your other builder)
  // vendor -> vendorCompany, staff -> staffDept
  const company =
    roleRaw === "vendor" ? vendorCompany : roleRaw === "staff" ? staffDept : "";

  // HEAD (Text)
  let whoText = roleLabel;
  if (nameText) whoText += ` ${nameText}`;
  if (company) whoText += ` (${company})`;

  const addressText = unit ? ` from ${unit}` : "";
  const headText = `${time} - ${whoText}${addressText}`.trim();

  // HEAD (HTML)
  const timeHtml = `<b>${esc(time)}</b>`;
  const roleHtml = esc(roleLabel);
  const nameHtml = nameText ? ` <b>${esc(nameText)}</b>` : "";
  const companyHtml = company ? ` (${esc(company)})` : "";

  const addressHtml = unit
    ? ` from (<span style="color:${RED}"><b>${esc(unit)}</b></span>)`
    : "";

  const headHtml =
    `${timeHtml} - ${roleHtml}${nameHtml}${companyHtml}${addressHtml}`.trim();

  // TAIL parts (like your other builder: “— a; b; c.”)
  const partsText = [];
  const partsHtml = [];

  if (cleanReason) {
    partsText.push(cleanReason);
    partsHtml.push(esc(cleanReason));
  }

  if (visitingValue && (roleRaw === "guest" || roleRaw === "vendor")) {
    partsText.push(`Visiting: ${visitingValue}`);
    partsHtml.push(
      `Visiting: <span style="color:${RED}"><b>${esc(visitingValue)}</b></span>`
    );
  }

  if (contact && roleRaw === "futureResident") {
    partsText.push(`Contact: ${contact}`);
    partsHtml.push(`Contact: <b>${esc(contact)}</b>`);
  }

  if (notes) {
    partsText.push(`(${notes})`);
    partsHtml.push(`(${esc(notes)})`);
  }

  const tailText = partsText.length ? ` — ${partsText.join("; ")}.` : ".";
  const tailHtml = partsHtml.length ? ` — ${partsHtml.join("; ")}.` : ".";

  return {
    sentenceText: headText + tailText,
    sentenceHtml: headHtml + tailHtml,
  };
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
    const { sentenceText, sentenceHtml } = buildVisitLogContent(visit);
    if (!sentenceText) return;

    try {
      // ✅ Rich copy (HTML + plain text) when supported
      if (navigator.clipboard?.write && window.ClipboardItem) {
        const item = new ClipboardItem({
          "text/plain": new Blob([sentenceText], { type: "text/plain" }),
          "text/html": new Blob([sentenceHtml], { type: "text/html" }),
        });
        await navigator.clipboard.write([item]);
      } else if (navigator.clipboard?.writeText) {
        // fallback: plain text only
        await navigator.clipboard.writeText(sentenceText);
      } else {
        throw new Error("Clipboard API not available");
      }

      console.log("Copied (text):", sentenceText);
      console.log("Copied (html):", sentenceHtml);
    } catch (err) {
      console.error("Failed to copy visit log line", err);
      alert(
        "Could not copy to clipboard automatically. You can copy this text manually:\n\n" +
          sentenceText
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
