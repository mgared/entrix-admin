// src/pages/admin/page.jsx
import React, { useEffect, useRef, useState } from "react";
import AdminLayout from "../../layout/AdminLayout";

import VisitorsView from "../../features/visitors/VisitorsView";
import usePropertyVisits from "../../features/visitors/usePropertyVisits";
import AmenityRequestsView from "../../features/amenities/AmenityRequestsView";
import AddBookingModal from "../../features/amenities/AddBookingModal";
import SlideshowsView from "../../features/slideshows/SlideshowsView";
import UnitsView from "../../features/units/UnitsView";
import UnitModal from "../../features/units/UnitModal";
import EventsView from "../../features/events/EventsView";
import usePropertyUnits from "../../features/units/usePropertyUnits";
import usePropertyAmenities from "../../features/amenities/usePropertyAmenities";
import useAmenityBookings from "../../features/amenities/useAmenityBookings";
import { db, storage } from "../../lib/firebase";
import ShiftLogsView from "../../features/shiftlogs/ShiftLogsView";
import PropertyInfoView from "../../features/propertyInfo/PropertyInfoView";
import AvailabilityCalendarView from "../../features/calendar/AvailabilityCalendarView";

// ✅ NEW
import TrainingProgressView from "../../features/training/TrainingProgressView";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  getDoc,
  updateDoc,
  setDoc,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import {
  ref as sref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import usePropertySlides from "../../features/slideshows/usePropertySlides";
import { slideshowPath } from "../../lib/storagePaths";

import "./page.css";
import { computeEndTime } from "../../utils/time";

import { useAuth } from "../../features/auth/AuthContext";
import useAdminProperties from "../../features/properties/useAdminProperties";

function getEmptyNewBooking() {
  return {
    name: "",
    unitLabel: "",
    amenity: "",
    bookedDate: "",
    startAt: "",
    duration: "",
    notes: "",
  };
}
function getEmptyUnit() {
  return {
    id: "",
    unitLabel: "",
    residentNames: "",
    notes: "",
    active: true,
  };
}

export default function AdminPage() {
  const { user } = useAuth();
  const MAX_SLIDES = 15;

  const [adminProfile, setAdminProfile] = useState(null);

  const {
    properties,
    loading: propsLoading,
    error: propsError,
  } = useAdminProperties(user?.uid);

  const [activeView, setActiveView] = useState("visitors");
  const [selectedBuildingId, setSelectedBuildingId] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("code") && params.get("state")) {
      setActiveView("calendar");
    }
  }, []);

  const {
    slides: liveSlides,
    loading: slidesLoading,
    error: slidesError,
  } = usePropertySlides(selectedBuildingId);

  const {
    visits,
    loading: visitsLoading,
    error: visitsError,
    canLoadMore: visitsCanLoadMore,
    loadMore: loadMoreVisits,
  } = usePropertyVisits(selectedBuildingId);

  const {
    units: liveUnits,
    hasUnits,
    loading: unitsLoading,
    error: unitsError,
  } = usePropertyUnits(selectedBuildingId);

  useEffect(() => {
    async function loadAdmin() {
      if (!user?.uid) return;

      try {
        const ref = doc(db, "users", user.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          setAdminProfile({ id: snap.id, ...snap.data() });
        } else {
          setAdminProfile({ id: user.uid, name: user.email || "Admin" });
        }
      } catch (err) {
        console.error("Failed to load admin profile:", err);
        setAdminProfile({ id: user.uid, name: user.email || "Admin" });
      }
    }

    loadAdmin();
  }, [user?.uid]);

  // when properties arrive, default to first one
  useEffect(() => {
    if (properties.length && !selectedBuildingId) {
      setSelectedBuildingId(properties[0].id);
    }
  }, [properties, selectedBuildingId]);

  const role = adminProfile?.role || "concierge";
  const canManageContent = role === "God" || role === "admin";

  // Property Info visibility (concierge + God ONLY)
  const canSeePropertyInfo = role === "concierge" || role === "God";

  // ✅ NEW: Training tab visibility
  const canSeeTraining = role === "concierge" || role === "God";
  const canSeeCalendar =
    role === "admin" || role === "God" || role === "concierge";

  const [visitorFilter, setVisitorFilter] = useState("today");
  const [amenityStatusFilter, setAmenityStatusFilter] = useState("all");

  const { amenities } = usePropertyAmenities(selectedBuildingId);
  const {
    bookings: liveAmenityBookings,
    loading: bookingsLoading,
    error: bookingsError,
  } = useAmenityBookings(selectedBuildingId);

  const [amenityRequestsByBuilding, setAmenityRequestsByBuilding] = useState(
    {}
  );
  const [slideshowsByBuilding, setSlideshowsByBuilding] = useState({});
  const [unitsByBuilding, setUnitsByBuilding] = useState({});

  const [showAddBooking, setShowAddBooking] = useState(false);
  const [newBooking, setNewBooking] = useState(getEmptyNewBooking());

  const [showUnitModal, setShowUnitModal] = useState(false);
  const [editingUnit, setEditingUnit] = useState(getEmptyUnit());

  const openAddUnit = () => {
    setEditingUnit({
      id: "",
      unitLabel: "",
      residentNames: "",
      active: true,
      notes: "",
    });
    setShowUnitModal(true);
  };

  const openEditUnit = (u) => {
    setEditingUnit({
      id: u.id,
      unitLabel: u.unitLabel || "",
      residentNames: u.residentNames || "",
      active: !!u.active,
      notes: u.notes || "",
    });
    setShowUnitModal(true);
  };

  const changeUnitField = (key, val) =>
    setEditingUnit((p) => ({ ...p, [key]: val }));

  const saveUnit = async () => {
    if (!selectedBuildingId) return;
    const colRef = collection(db, "Properties", selectedBuildingId, "units");
    const payload = {
      unitLabel: (editingUnit.unitLabel || "").trim(),
      residentNames: (editingUnit.residentNames || "").trim(),
      active: !!editingUnit.active,
      notes: (editingUnit.notes || "").trim(),
    };
    if (editingUnit.id) {
      await updateDoc(doc(colRef, editingUnit.id), payload);
    } else {
      await addDoc(colRef, payload);
    }
    setShowUnitModal(false);
  };

  const toggleUnitActive = async (u) => {
    if (!selectedBuildingId || !u?.id) return;
    const unitRef = doc(db, "Properties", selectedBuildingId, "units", u.id);
    await updateDoc(unitRef, { active: !u.active });
  };

  const fileInputRef = useRef(null);

  // map to the structure AdminLayout expects: [{id, name}]
  const buildings = properties;

  const selectedBuilding =
    buildings.find((b) => b.id === selectedBuildingId) || buildings[0];

  const slides = slideshowsByBuilding[selectedBuildingId] || [];
  const units = unitsByBuilding[selectedBuildingId] || [];

  // --- early UI states for property access ---
  if (propsLoading) {
    return (
      <div className="admin-root">
        <div className="admin-shell">
          <div className="muted">Loading properties…</div>
        </div>
      </div>
    );
  }

  if (propsError) {
    return (
      <div className="admin-root">
        <div className="admin-shell">
          <div className="error-text">{propsError}</div>
        </div>
      </div>
    );
  }

  if (!buildings.length) {
    return (
      <div className="admin-root">
        <div className="admin-shell">
          <div className="muted">
            Your account has no assigned properties yet. Ask an admin to add
            them to your <code>adminOf</code> list.
          </div>
        </div>
      </div>
    );
  }

  const handleAmenityStatusChange = async (amenityId, bookingId, newStatus) => {
    try {
      if (!selectedBuildingId || !amenityId || !bookingId) return;
      const ref = doc(
        db,
        "Properties",
        selectedBuildingId,
        "amenities",
        amenityId,
        "bookings",
        bookingId
      );
      await updateDoc(ref, { status: newStatus });
    } catch (e) {
      console.error(e);
      alert(e?.message || "Failed to update status.");
    }
  };

  const openAddBooking = () => {
    setNewBooking(getEmptyNewBooking());
    setShowAddBooking(true);
  };

  const handleNewBookingChange = (field, value) =>
    setNewBooking((p) => ({ ...p, [field]: value }));

  const handleAddBookingSubmit = async () => {
    try {
      const {
        name,
        unitLabel,
        amenityId,
        bookedDate,
        startAt,
        duration,
        notes,
      } = newBooking;

      if (
        !selectedBuildingId ||
        !name ||
        !unitLabel ||
        !amenityId ||
        !bookedDate ||
        !startAt ||
        !duration
      ) {
        alert("Please complete all required fields.");
        return;
      }

      const durationMinutes = parseInt(duration, 10) || 0;
      const endAt = computeEndTime(startAt, durationMinutes);

      const colRef = collection(
        db,
        "Properties",
        selectedBuildingId,
        "amenities",
        amenityId,
        "bookings"
      );

      await addDoc(colRef, {
        residentName: name,
        unitLabel,
        unitId: "",
        bookedDate,
        startAt,
        endAt,
        reason: notes || "",
        guestCount: 1,
        status: "pending",
        createdAt: serverTimestamp(),
        createdBy: user?.uid || null,
      });

      setShowAddBooking(false);
      setNewBooking(getEmptyNewBooking());
    } catch (e) {
      console.error(e);
      alert(e?.message || "Failed to create booking.");
    }
  };

  const handleAddBookingClear = () => setNewBooking(getEmptyNewBooking());
  const handleAddBookingClose = () => {
    setShowAddBooking(false);
    setNewBooking(getEmptyNewBooking());
  };

  const triggerUpload = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleSlidesUpload = async (e) => {
    try {
      const files = Array.from(e.target.files || []);
      if (!selectedBuildingId || files.length === 0) return;

      const propRef = doc(db, "Properties", selectedBuildingId);
      const snap = await getDoc(propRef);

      if (!snap.exists()) {
        await setDoc(propRef, { slideShowImageUrls: [] }, { merge: true });
      }

      const existing = snap.data()?.slideShowImageUrls ?? [];
      const remaining = MAX_SLIDES - existing.length;

      if (remaining <= 0) {
        alert(
          `This property already has ${MAX_SLIDES} slideshow images. Please delete one before uploading.`
        );
        e.target.value = "";
        return;
      }

      const toUpload = files.slice(0, remaining);
      if (toUpload.length < files.length) {
        alert(
          `Only ${remaining} more image(s) allowed. Extra file(s) were skipped.`
        );
      }

      const newUrls = [];
      for (const file of toUpload) {
        const path = slideshowPath(selectedBuildingId, file.name);
        const r = sref(storage, path);
        await uploadBytes(r, file);
        const url = await getDownloadURL(r);
        newUrls.push(url);
      }

      if (newUrls.length) {
        await setDoc(
          propRef,
          { slideShowImageUrls: arrayUnion(...newUrls) },
          { merge: true }
        );
      }
    } catch (err) {
      console.error("Upload failed:", err);
      alert(err?.message || "Upload failed");
    } finally {
      if (e?.target) e.target.value = "";
    }
  };

  const handleDeleteSlide = async (slideOrId) => {
    try {
      const url = typeof slideOrId === "string" ? slideOrId : slideOrId?.url;
      if (!url || !selectedBuildingId) return;

      await deleteObject(sref(storage, url));

      const propRef = doc(db, "Properties", selectedBuildingId);
      await setDoc(
        propRef,
        { slideShowImageUrls: arrayRemove(url) },
        { merge: true }
      );
    } catch (err) {
      console.error("Delete failed:", err);
      alert(err?.message || "Delete failed");
    }
  };

  const handleUnitClear = () => setEditingUnit(getEmptyUnit());
  const handleUnitClose = () => {
    setShowUnitModal(false);
    setEditingUnit(getEmptyUnit());
  };

  return (
    <>
      <AdminLayout
        admin={adminProfile}
        buildings={buildings}
        selectedBuildingId={selectedBuildingId}
        onSelectBuilding={setSelectedBuildingId}
        activeView={activeView}
        onChangeView={setActiveView}
        canSeePropertyInfo={canSeePropertyInfo}
        canSeeTraining={canSeeTraining} // ✅ NEW
        canSeeCalendar={canSeeCalendar}
      >
        {activeView === "calendar" &&
          (canSeeCalendar ? (
            <AvailabilityCalendarView
              propertyId={selectedBuildingId}
              propertyName={selectedBuilding?.name || ""}
              admin={adminProfile}
              readOnly={role === "concierge"}
            />
          ) : (
            <div className="muted">You don’t have access to Calendar.</div>
          ))}

        {activeView === "training" &&
          (canSeeTraining ? (
            <TrainingProgressView
              admin={adminProfile}
              buildings={buildings}
              defaultPropertyId={selectedBuildingId}
            />
          ) : (
            <div className="muted">You don’t have access to Training.</div>
          ))}

        {activeView === "visitors" && (
          <VisitorsView
            buildingId={selectedBuildingId}
            visitorFilter={visitorFilter}
            onChangeVisitorFilter={setVisitorFilter}
            dataOverride={visits}
            loadingOverride={visitsLoading}
            errorOverride={visitsError}
            canLoadMore={visitsCanLoadMore}
            onLoadMore={loadMoreVisits}
          />
        )}

        {activeView === "amenities" && (
          <AmenityRequestsView
            buildingId={selectedBuildingId}
            amenityRequestsByBuilding={amenityRequestsByBuilding}
            amenityStatusFilter={amenityStatusFilter}
            onChangeStatusFilter={setAmenityStatusFilter}
            onChangeRequestStatus={
              canManageContent ? handleAmenityStatusChange : undefined
            }
            onOpenAddBooking={canManageContent ? openAddBooking : undefined}
            dataOverride={liveAmenityBookings}
            loadingOverride={bookingsLoading}
            errorOverride={bookingsError}
            canEdit={canManageContent}
          />
        )}

        {activeView === "slideshows" && (
          <SlideshowsView
            buildingId={selectedBuildingId}
            fileInputRef={fileInputRef}
            slides={liveSlides}
            onDeleteSlide={canManageContent ? handleDeleteSlide : undefined}
            onTriggerUpload={canManageContent ? triggerUpload : undefined}
            onSlidesSelected={canManageContent ? handleSlidesUpload : undefined}
            canEdit={canManageContent}
            loadingOverride={slidesLoading}
            errorOverride={slidesError}
          />
        )}

        {activeView === "units" && (
          <UnitsView
            units={liveUnits}
            hasUnits={hasUnits}
            loading={unitsLoading}
            error={unitsError}
            onToggleActive={canManageContent ? toggleUnitActive : undefined}
            onOpenEdit={canManageContent ? openEditUnit : undefined}
            onOpenAdd={canManageContent ? openAddUnit : undefined}
            canEdit={canManageContent}
          />
        )}

        {activeView === "events" && (
          <EventsView
            building={selectedBuilding}
            canManageEvents={canManageContent}
          />
        )}

        {activeView === "shiftlogs" && (
          <ShiftLogsView
            buildingId={selectedBuildingId}
            buildingName={selectedBuilding?.name || ""}
            locationLabel="HVCC Front Desk"
            admin={adminProfile}
          />
        )}

        {activeView === "propertyInfo" &&
          (canSeePropertyInfo ? (
            <PropertyInfoView
              buildingId={selectedBuildingId}
              buildingName={selectedBuilding?.name || ""}
            />
          ) : (
            <div className="muted">You don’t have access to Property Info.</div>
          ))}
      </AdminLayout>

      {showAddBooking && (
        <AddBookingModal
          buildingName={selectedBuilding?.name}
          amenities={amenities}
          newBooking={newBooking}
          onChangeField={handleNewBookingChange}
          onSubmit={handleAddBookingSubmit}
          onClear={handleAddBookingClear}
          onClose={handleAddBookingClose}
        />
      )}

      {showUnitModal && (
        <UnitModal
          buildingName={selectedBuilding?.name || ""}
          unit={editingUnit}
          onChangeField={changeUnitField}
          onSave={saveUnit}
          onClear={() =>
            setEditingUnit({
              id: "",
              unitLabel: "",
              residentNames: "",
              active: true,
              notes: "",
            })
          }
          onClose={() => setShowUnitModal(false)}
        />
      )}
    </>
  );
}
