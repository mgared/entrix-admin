import React from "react";
import {
  Users,
  Calendar,
  Image as ImageIcon,
  Home as HomeIcon,
} from "lucide-react";

function NavTabs({ activeView, onChangeView }) {
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
      {mk("visitors", "Visitors", Users)}
      {mk("amenities", "Amenity Requests", Calendar)}
      {mk("slideshows", "Slideshows", ImageIcon)}
      {mk("units", "Units", HomeIcon)}
      {mk("events", "Events", Calendar)} {/* Coming soon view */}
    </div>
  );
}

export default NavTabs;
