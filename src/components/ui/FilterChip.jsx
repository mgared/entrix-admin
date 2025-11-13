
import React from "react";

function FilterChip({ label, active, onClick }) {
  return (
    <button
      type="button"
      className={`chip ${active ? "chip-active" : ""}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

export default FilterChip;