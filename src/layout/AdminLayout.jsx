import React from "react";
import Topbar from "./Topbar";
import NavTabs from "./NavTabs";

function AdminLayout({
  admin,
  buildings,
  selectedBuildingId,
  onSelectBuilding,
  activeView,
  onChangeView,
  children,
}) {
  const currentBuilding =
    buildings.find((b) => b.id === selectedBuildingId) || buildings[0];

  return (
    <div className="admin-root">
      <div className="admin-shell">
        <Topbar
          admin={admin}
          buildings={buildings}
          selectedBuildingId={selectedBuildingId}
          onSelectBuilding={onSelectBuilding}
        />

        <div className="page-heading">
          <h1>{currentBuilding?.name || "Property"}</h1>
          <p>Manage visitors, amenity bookings, slideshows, and units.</p>
        </div>

        <NavTabs activeView={activeView} onChangeView={onChangeView} />

        <main className="admin-main single-column">{children}</main>
      </div>
    </div>
  );
}

export default AdminLayout;
