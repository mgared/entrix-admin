// src/features/events/EventsView.jsx
import React, { useState } from "react";
import usePropertyEvents from "./usePropertyEvents";
import { db, storage } from "../../lib/firebase";
import { useAuth } from "../auth/AuthContext";
import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import {
  ref as sref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { Calendar, Clock, MapPin, Edit2, Trash2 } from "lucide-react";

function formatEventDate(date) {
  if (!date) return "—";
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatEventTime(date) {
  if (!date) return "—";
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

// Convert Date -> value for <input type="datetime-local">
function toLocalInputValue(date) {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  const pad = (n) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const min = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function EventsView({ building, canManageEvents }) {
  const propertyId = building?.id || null;
  const { user } = useAuth();
  const { events, loading, error } = usePropertyEvents(propertyId);

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [editingEvent, setEditingEvent] = useState(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("upcoming");
  const [startAt, setStartAt] = useState(""); // datetime-local string
  const [signUpLink, setSignUpLink] = useState("");
  const [location, setLocation] = useState("");
  const [imageFile, setImageFile] = useState(null);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setStatus("upcoming");
    setStartAt("");
    setSignUpLink("");
    setLocation("");
    setImageFile(null);
    setFormError("");
    setEditingEvent(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!propertyId) return;

    if (!title || !startAt) {
      setFormError("Title and start time are required.");
      return;
    }

    try {
      setSaving(true);
      setFormError("");

      const colRef = collection(db, "Properties", propertyId, "events");

      // keep existing image if editing and no new file chosen
      let imageUrl = editingEvent?.imageUrl || "";
      if (imageFile) {
        const safeName = imageFile.name.replace(/\s+/g, "_");
        const path = `properties/${propertyId}/events/${Date.now()}_${safeName}`;
        const r = sref(storage, path);
        await uploadBytes(r, imageFile);
        imageUrl = await getDownloadURL(r);
      }

      const startDate = new Date(startAt);

      const payload = {
        title,
        description,
        status,
        startAt: startDate,
        signUpLink,
        location,
        imageUrl,
      };

      if (editingEvent) {
        // update existing
        const docRef = doc(colRef, editingEvent.id);
        await updateDoc(docRef, payload);
      } else {
        // create new
        await addDoc(colRef, {
          ...payload,
          createdAt: serverTimestamp(),
          createdByStaffId: user?.uid || null,
        });
      }

      resetForm();
      setShowForm(false);
    } catch (err) {
      console.error(err);
      setFormError("Failed to create event. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleEditClick = (ev) => {
    setEditingEvent(ev);
    setTitle(ev.title || "");
    setDescription(ev.description || "");
    setStatus(ev.status || "upcoming");
    setStartAt(toLocalInputValue(ev.startAt));
    setSignUpLink(ev.signUpLink || "");
    setLocation(ev.location || "");
    setImageFile(null);
    setFormError("");
    setShowForm(true);
  };

  const handleDeleteClick = async (ev) => {
    if (!propertyId) return;
    const ok = window.confirm("Delete this event? This cannot be undone.");
    if (!ok) return;

    try {
      const colRef = collection(db, "Properties", propertyId, "events");
      await deleteDoc(doc(colRef, ev.id));

      if (ev.imageUrl) {
        try {
          await deleteObject(sref(storage, ev.imageUrl));
        } catch (imgErr) {
          console.error("Failed to delete event image:", imgErr);
        }
      }
    } catch (err) {
      console.error(err);
      alert("Failed to delete event.");
    }
  };

  return (
    <section className="panel">
      <div className="panel-header">
        <div className="panel-title-wrap">
          <h2>Events</h2>
        </div>
        {canManageEvents && (
          <button
            type="button"
            className="primary-button"
            onClick={() => {
              if (showForm) {
                resetForm();
                setShowForm(false);
              } else {
                setShowForm(true);
              }
            }}
            disabled={!building?.id}
          >
            {showForm ? "Cancel" : "Add event"}
          </button>
        )}
      </div>

      <div className="panel-body">
        {showForm && (
          <form className="event-form" onSubmit={handleSubmit}>
            {formError && <div className="error-text">{formError}</div>}

            <div className="form-grid">
              <label className="form-field">
                <span className="field-label">Title</span>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </label>

              <label className="form-field">
                <span className="field-label">Start at</span>
                <input
                  type="datetime-local"
                  value={startAt}
                  onChange={(e) => setStartAt(e.target.value)}
                  required
                />
              </label>

              <label className="form-field">
                <span className="field-label">Status</span>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="upcoming">Upcoming</option>
                  <option value="active">Active</option>
                  <option value="past">Past</option>
                  <option value="draft">Draft</option>
                </select>
              </label>

              <label className="form-field">
                <span className="field-label">Location</span>
                <input
                  type="text"
                  placeholder="Pool Deck, Community Center, etc."
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </label>

              <label className="form-field">
                <span className="field-label">Sign-up link (optional)</span>
                <input
                  type="url"
                  placeholder="https://..."
                  value={signUpLink}
                  onChange={(e) => setSignUpLink(e.target.value)}
                />
              </label>

              <label className="form-field">
                <span className="field-label">Image</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                />
              </label>
            </div>

            <label className="form-field">
              <span className="field-label">Description</span>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>

            <div className="form-actions">
              <button
                type="submit"
                className="primary-button"
                disabled={saving}
              >
                {saving
                  ? editingEvent
                    ? "Saving changes…"
                    : "Saving…"
                  : editingEvent
                  ? "Save changes"
                  : "Save event"}
              </button>
            </div>
          </form>
        )}

        {!showForm && loading && !error && events.length === 0 && (
          <div className="muted">Loading events…</div>
        )}

        {error && <div className="error-text">{error}</div>}

        {!showForm && !loading && events.length === 0 && !error && (
          <div className="muted">
            No events yet for <strong>{building?.name}</strong>.
          </div>
        )}

        {events.length > 0 && (
          <div className="events-grid">
            {events.map((ev) => (
              <article key={ev.id} className="event-card">
                {ev.imageUrl && (
                  <div className="event-card-image">
                    <img src={ev.imageUrl} alt={ev.title} />
                  </div>
                )}
                <div className="event-card-body">
                  <div className="event-card-header">
                    <div className="event-card-header-left">
                      <h3 className="event-title">{ev.title}</h3>
                      <span
                        className={`status-pill status-${
                          ev.status || "upcoming"
                        }`}
                      >
                        {ev.status || "upcoming"}
                      </span>
                    </div>
                    {canManageEvents && (
                      <div className="event-actions">
                        <button
                          type="button"
                          className="icon-button"
                          title="Edit event"
                          onClick={() => handleEditClick(ev)}
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          type="button"
                          className="icon-button"
                          title="Delete event"
                          onClick={() => handleDeleteClick(ev)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="event-meta-lines">
                    <div className="event-meta-line">
                      <Calendar size={14} />
                      <span>{formatEventDate(ev.startAt)}</span>
                    </div>
                    <div className="event-meta-line">
                      <Clock size={14} />
                      <span>{formatEventTime(ev.startAt)}</span>
                    </div>
                    {ev.location && (
                      <div className="event-meta-line">
                        <MapPin size={14} />
                        <span>{ev.location}</span>
                      </div>
                    )}
                  </div>

                  {ev.description && (
                    <p className="event-description">{ev.description}</p>
                  )}

                  {ev.signUpLink && (
                    <div className="event-card-footer">
                      <a
                        href={ev.signUpLink}
                        target="_blank"
                        rel="noreferrer"
                        className="event-link"
                      >
                        RSVP Now
                      </a>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default EventsView;
