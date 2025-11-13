
import React from "react";
import { CheckCircle2, Clock } from "lucide-react";

function StatusPill({ status }) {
  const normalized = status || "pending";
  const label =
    normalized === "approved"
      ? "Approved"
      : normalized === "rejected"
      ? "Rejected"
      : "Pending";

  return (
    <span className={`status-pill status-${normalized}`}>
      {normalized === "approved" && <CheckCircle2 size={14} />}
      {normalized === "pending" && <Clock size={12} />}
      {normalized === "rejected" && <span>!</span>}
      <span>{label}</span>
    </span>
  );
}

export default StatusPill;