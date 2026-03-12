// src/features/training/TrainEmployeeModal.jsx
import React, { useMemo, useState } from "react";
import { makeTraineeIdFromName } from "./trainingApi";

export default function TrainEmployeeModal({
  admin,
  buildings,
  defaultPropertyId,
  trainees,
  trainerName,
  onChangeTrainerName,
  onStart,
  onRegisterNewTrainee,
  onClose,
}) {
  const [selectedTraineeId, setSelectedTraineeId] = useState("");
  const [propertyId, setPropertyId] = useState(defaultPropertyId || "");
  const [mode, setMode] = useState("property"); // "property" | "company"
  const [newTraineeName, setNewTraineeName] = useState("");
  const [showRegister, setShowRegister] = useState(false);
  const [busy, setBusy] = useState(false);

  const traineeOptions = useMemo(() => trainees || [], [trainees]);
  const selectedTrainee = traineeOptions.find(
    (t) => t.id === selectedTraineeId
  );

  const canStart =
    (selectedTraineeId || newTraineeName.trim()) &&
    (mode === "company" || !!propertyId) &&
    (trainerName || "").trim() &&
    !busy;

  const handleRegister = async () => {
    const name = newTraineeName.trim();
    if (!name) return;

    try {
      setBusy(true);
      await onRegisterNewTrainee({ traineeName: name });

      const newId = makeTraineeIdFromName(name);
      setSelectedTraineeId(newId);
      setShowRegister(false);
      setNewTraineeName("");
    } catch (e) {
      console.error(e);
      alert(e?.message || "Failed to register trainee.");
    } finally {
      setBusy(false);
    }
  };

  const handleStart = () => {
    const name = selectedTrainee?.name || newTraineeName.trim();
    const traineeId = selectedTraineeId || makeTraineeIdFromName(name);

    onStart({
      traineeId,
      traineeName: name,
      propertyId: mode === "company" ? null : propertyId,
      titleSetMode: mode,
    });
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal training-modal">
        <button className="modal-close" onClick={onClose} type="button">
          ✕
        </button>

        <div className="modal-title">Begin Training</div>
        <div className="modal-sub">Configure your training session</div>

        <div className="training-modal-grid">
          <div className="form-group">
            <label className="form-label">Trainer Name</label>
            <input
              className="form-input"
              value={trainerName}
              onChange={(e) => onChangeTrainerName(e.target.value)}
              placeholder={admin?.name || admin?.email || "Trainer name"}
              disabled={busy}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Trainee</label>
            {!showRegister ? (
              <select
                className="form-select"
                value={selectedTraineeId}
                onChange={(e) => setSelectedTraineeId(e.target.value)}
                disabled={busy}
              >
                <option value="">— Select trainee —</option>
                {traineeOptions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name || t.id}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="form-input"
                value={newTraineeName}
                onChange={(e) => setNewTraineeName(e.target.value)}
                placeholder="New trainee full name"
                disabled={busy}
              />
            )}

            <button
              type="button"
              className="btn-ghost training-toggle-btn"
              onClick={() => {
                setShowRegister((v) => !v);
                setSelectedTraineeId("");
                setNewTraineeName("");
              }}
              disabled={busy}
            >
              {showRegister ? "← Select existing trainee" : "+ Register new trainee"}
            </button>

            {showRegister && (
              <div className="form-actions">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleRegister}
                  disabled={!newTraineeName.trim() || busy}
                >
                  Save trainee
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => {
                    setShowRegister(false);
                    setNewTraineeName("");
                  }}
                  disabled={busy}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          <div className="form-group full">
            <label className="form-label">Training Set</label>
            <div className="radio-group">
              <button
                type="button"
                className={`radio-item ${mode === "company" ? "active" : ""}`}
                onClick={() => setMode("company")}
                disabled={busy}
              >
                <span className="radio-dot">
                  <span className="radio-dot-inner" />
                </span>
                <div>
                  <div className="radio-text">Company Training</div>
                  <div className="radio-sub">Concierge Day 1</div>
                </div>
              </button>

              <button
                type="button"
                className={`radio-item ${mode === "property" ? "active" : ""}`}
                onClick={() => setMode("property")}
                disabled={busy}
              >
                <span className="radio-dot">
                  <span className="radio-dot-inner" />
                </span>
                <div>
                  <div className="radio-text">Property Training</div>
                  <div className="radio-sub">Location-specific</div>
                </div>
              </button>
            </div>
          </div>

          {mode === "property" && (
            <div className="form-group full">
              <label className="form-label">Select Property</label>
              <select
                className="form-select"
                value={propertyId || ""}
                onChange={(e) => setPropertyId(e.target.value)}
                disabled={busy}
              >
                <option value="">— Select property —</option>
                {buildings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name || b.id}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="form-actions training-modal-actions">
          <button
            className="btn-ghost"
            onClick={onClose}
            disabled={busy}
            type="button"
          >
            Close
          </button>
          <button
            className="btn-primary"
            onClick={handleStart}
            disabled={!canStart}
            type="button"
          >
            Start training session
          </button>
        </div>

        <div className="section-note">
          Trainer attribution is saved automatically for every completed item.
        </div>
      </div>
    </div>
  );
}
