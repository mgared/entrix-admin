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
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  // doc,
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

// import { demoAdmin } from "../../data/demoAdmin";
// REMOVE: import { demoBuildings } from "../../data/demoBuildings";
//

import "./page.css";
import { computeEndTime } from "../../utils/time";

import { useAuth } from "../../features/auth/AuthContext";
import useAdminProperties from "../../features/properties/useAdminProperties";

function getEmptyNewBooking() {
  /* unchanged */ return {
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
  /* unchanged */ return {
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
          // fallback: at least show email
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

  const [visitorFilter, setVisitorFilter] = useState("today");
  const [amenityStatusFilter, setAmenityStatusFilter] = useState("all");

  const { amenities } = usePropertyAmenities(selectedBuildingId);
  const {
    bookings: liveAmenityBookings,
    loading: bookingsLoading,
    error: bookingsError,
  } = useAmenityBookings(selectedBuildingId);

  // const [amenityRequestsByBuilding, setAmenityRequestsByBuilding] = useState(
  //   initialAmenityRequestsByBuilding
  // );
  // const [slideshowsByBuilding, setSlideshowsByBuilding] = useState(
  //   initialSlideshowsByBuilding
  // );
  // const [unitsByBuilding, setUnitsByBuilding] = useState(
  //   initialUnitsByBuilding
  // );

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

  // --- (the rest of your handlers remain exactly as-is) ---

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
        unitId: "", // optional if you have it
        bookedDate, // "YYYY-MM-DD"
        startAt, // "HH:mm"
        endAt, // computed
        reason: notes || "",
        guestCount: 1, // or collect from UI later
        status: "pending", // default
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

  // Trigger the hidden <input type="file" />
  // Open the hidden <input type="file" />
  const triggerUpload = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  // Upload, cap to MAX_SLIDES, store URLs in property doc (array)
  const handleSlidesUpload = async (e) => {
    try {
      const files = Array.from(e.target.files || []);
      if (!selectedBuildingId || files.length === 0) return;

      const propRef = doc(db, "Properties", selectedBuildingId);
      const snap = await getDoc(propRef);

      if (!snap.exists()) {
        // ensure doc exists so writes won’t 404
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
      // reset the <input> so the same file can be reselected later if needed
      if (e?.target) e.target.value = "";
    }
  };

  // Delete a slide: remove storage object and URL from array
  const handleDeleteSlide = async (slideOrId) => {
    try {
      const url = typeof slideOrId === "string" ? slideOrId : slideOrId?.url;
      if (!url || !selectedBuildingId) return;

      // delete from storage using the URL
      await deleteObject(sref(storage, url));

      // remove from property array
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

  const handleSaveUnit = () => {
    /* unchanged */
    const { id, unitLabel, residentNames, notes, active } = editingUnit;
    if (!unitLabel) {
      alert("Unit label is required.");
      return;
    }
    setUnitsByBuilding((prev) => {
      const next = { ...prev };
      const list = [...(next[selectedBuildingId] || [])];
      if (id) {
        const idx = list.findIndex((u) => u.id === id);
        if (idx !== -1) {
          list[idx] = {
            ...list[idx],
            unitLabel,
            residentNames: residentNames || "",
            notes: notes || "",
            active: !!active,
          };
        }
      } else {
        const newId = `unit-${Date.now()}`;
        list.push({
          id: newId,
          unitLabel,
          residentNames: residentNames || "",
          notes: notes || "",
          active: active !== false,
        });
      }
      next[selectedBuildingId] = list;
      return next;
    });
    setShowUnitModal(false);
    setEditingUnit(getEmptyUnit());
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
      >
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
      </AdminLayout>

      {showAddBooking && (
        <AddBookingModal
          buildingName={selectedBuilding?.name}
          amenities={amenities} // <-- so the select is real
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
