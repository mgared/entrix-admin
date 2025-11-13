import React from "react";
import { X } from "lucide-react";
import { formatTimeLabel } from "../../utils/time";

// ...imports unchanged
const DURATIONS = [
  { value: 30, label: "30 minutes" },
  { value: 60, label: "1 hour" },
  { value: 90, label: "1.5 hours" },
  { value: 120, label: "2 hours" },
  { value: 180, label: "3 hours" },
];

const START_TIMES = [
  "06:00",
  "07:00",
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00",
  "20:00",
];

function AddBookingModal({
  buildingName,
  amenities, // <-- NEW
  newBooking,
  onChangeField,
  onSubmit,
  onClear,
  onClose,
}) {
  return (
    <div className="add-booking-modal">
      <div className="add-booking-card admin-theme">
        {/* header unchanged */}
        <div className="add-booking-header">
          <div>
            <p className="add-booking-kicker">Manual amenity booking</p>
            <h2>New Booking for {buildingName}</h2>
          </div>
          <button className="add-close-btn" type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="add-booking-grid">
          {/* name + unit inputs unchanged */}
          <div className="form-field">
            <label className="field-label">Full Name</label>
            <input
              type="text"
              className="field-input modal-input"
              placeholder="Enter resident's full name"
              value={newBooking.name}
              onChange={(e) => onChangeField("name", e.target.value)}
            />
          </div>

          <div className="form-field">
            <label className="field-label">Address / Unit Number</label>
            <input
              type="text"
              className="field-input modal-input"
              placeholder="e.g. 123 Main St, Unit 304"
              value={newBooking.unitLabel}
              onChange={(e) => onChangeField("unitLabel", e.target.value)}
            />
          </div>

          {/* amenity from Firestore */}
          <div className="form-field">
            <label className="field-label">Select Amenity</label>
            <select
              className="field-input modal-input"
              value={newBooking.amenityId || ""}
              onChange={(e) => onChangeField("amenityId", e.target.value)}
            >
              <option value="">Choose an amenity</option>
              {(amenities || []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name || a.id}
                </option>
              ))}
            </select>
          </div>

          {/* date/time/duration unchanged */}
          <div className="form-field">
            <label className="field-label">Booking Date</label>
            <input
              type="date"
              className="field-input modal-input"
              value={newBooking.bookedDate}
              onChange={(e) => onChangeField("bookedDate", e.target.value)}
            />
          </div>

          <div className="form-field">
            <label className="field-label">Start Time</label>
            <select
              className="field-input modal-input"
              value={newBooking.startAt}
              onChange={(e) => onChangeField("startAt", e.target.value)}
            >
              <option value="">Select start time</option>
              {START_TIMES.map((t) => (
                <option key={t} value={t}>
                  {formatTimeLabel(t)}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label className="field-label">Duration</label>
            <select
              className="field-input modal-input"
              value={newBooking.duration}
              onChange={(e) => onChangeField("duration", e.target.value)}
            >
              <option value="">Select duration</option>
              {DURATIONS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* notes + actions unchanged */}
        <div className="form-field">
          <label className="field-label">Notes (optional)</label>
          <input
            type="text"
            className="field-input modal-input"
            placeholder="Add any details or internal notes..."
            value={newBooking.notes}
            onChange={(e) => onChangeField("notes", e.target.value)}
          />
        </div>

        <div className="add-booking-actions">
          <button
            type="button"
            className="submit-wide-btn admin"
            onClick={onSubmit}
          >
            Submit Booking
          </button>
          <button
            type="button"
            className="clear-light-btn admin"
            onClick={onClear}
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}

export default AddBookingModal;
