// src/layout/NavTabs.jsx
import React from "react";
import {
  Users,
  Calendar,
  CalendarDays,
  Image as ImageIcon,
  Home as HomeIcon,
  ScrollText,
  FileText,
  GraduationCap, // ✅ NEW icon for Training
} from "lucide-react";

function NavTabs({
  activeView,
  onChangeView,
  canSeePropertyInfo,
  canSeeTraining, // ✅ NEW
  canSeeCalendar,
}) {
  const mk = (key, label, Icon) => (
    <button
      key={key}
      className={`nav-tab ${activeView === key ? "nav-tab-active" : ""}`}
      type="button"
      onClick={() => onChangeView(key)}
    >
      <Icon size={14} />
      <span>{label}</span>
    </button>
  );

  return (
    <div className="nav-tabs">
      {mk("shiftlogs", "Shift Logs", ScrollText)}

      {/* ✅ NEW TAB (role-gated) */}
      {canSeeTraining && mk("training", "Training", GraduationCap)}

      {/* ✅ Existing role-gated tab */}
      {canSeePropertyInfo && mk("propertyInfo", "Property Info", FileText)}
      {canSeeCalendar && mk("calendar", "Calendar", CalendarDays)}

      {mk("visitors", "Visitors", Users)}
      {mk("amenities", "Amenity Requests", Calendar)}
      {mk("slideshows", "Slideshows", ImageIcon)}
      {mk("units", "Units", HomeIcon)}
      {mk("events", "Events", Calendar)}
    </div>
  );
}

export default NavTabs;
