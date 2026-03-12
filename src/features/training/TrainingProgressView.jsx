// src/features/training/TrainingProgressView.jsx
import React, { useMemo, useState } from "react";
import useTrainees from "./useTrainees";
import useTrainingTitles from "./useTrainingTitles";
import useTraineeAssignment from "./useTraineeAssignment";
import {
  ensureAssignment,
  registerTrainee,
  setTrainingCheck,
  makeTraineeIdFromName,
} from "./trainingApi";
import TrainEmployeeModal from "./TrainEmployeeModal";

function groupByDay(titles) {
  const days = {};
  for (const t of titles || []) {
    const d = Number(t.day || 1);
    if (!days[d]) days[d] = [];
    days[d].push(t);
  }
  // ensure stable day ordering
  const ordered = {};
  Object.keys(days)
    .map(Number)
    .sort((a, b) => a - b)
    .forEach((k) => (ordered[k] = days[k]));
  return ordered;
}

function niceDayLabel(day) {
  return `Day ${day}`;
}

function getProgress(checkedTraining, titles) {
  const done = Object.keys(checkedTraining || {}).length;
  const total = titles.length;
  return { done, total, percent: total ? (done / total) * 100 : 0 };
}

export default function TrainingProgressView({
  admin,
  buildings,
  defaultPropertyId,
}) {
  const {
    trainees,
    loading: traineesLoading,
    error: traineesError,
  } = useTrainees();

  const [showModal, setShowModal] = useState(false);
  const [tab, setTab] = useState("overview");
  const [trainerName, setTrainerName] = useState(
    admin?.name || admin?.email || ""
  );

  const [active, setActive] = useState(null);
  // active = { traineeId, traineeName, propertyId, titleSetMode: "company"|"property" }

  const titleSetId = useMemo(() => {
    if (!active) return null;
    return active.titleSetMode === "company" ? "company" : active.propertyId;
  }, [active]);

  const assignmentId = useMemo(() => {
    if (!active) return null;
    return active.titleSetMode === "company" ? "company" : active.propertyId;
  }, [active]);

  const {
    titles,
    loading: titlesLoading,
    error: titlesError,
  } = useTrainingTitles(titleSetId);

  const {
    titles: companyTitles,
    loading: companyTitlesLoading,
    error: companyTitlesError,
  } = useTrainingTitles("company");

  const {
    titles: propertyPreviewTitles,
    loading: propertyPreviewLoading,
    error: propertyPreviewError,
  } = useTrainingTitles(defaultPropertyId || null);

  const {
    assignment,
    loading: assignLoading,
    error: assignError,
  } = useTraineeAssignment(active?.traineeId, assignmentId);

  const checkedTraining = assignment?.checkedTraining || {};
  const grouped = useMemo(() => groupByDay(titles), [titles]);
  const groupedCompanyTitles = useMemo(
    () => groupByDay(companyTitles),
    [companyTitles]
  );
  const groupedPropertyTitles = useMemo(
    () => groupByDay(propertyPreviewTitles),
    [propertyPreviewTitles]
  );

  const [savingId, setSavingId] = useState(""); // titleId being saved

  const openTrainer = () => setShowModal(true);

  const handleRegisterNewTrainee = async ({ traineeName }) => {
    const traineeId = makeTraineeIdFromName(traineeName);
    await registerTrainee({ traineeId, name: traineeName });
  };

  const handleStart = async ({
    traineeId,
    traineeName,
    propertyId,
    titleSetMode,
  }) => {
    const setId = titleSetMode === "company" ? "company" : propertyId;
    const aId = titleSetMode === "company" ? "company" : propertyId;

    await ensureAssignment({
      traineeId,
      assignmentId: aId,
      titleSetId: setId,
      propertyId: titleSetMode === "company" ? null : propertyId,
    });

    setActive({ traineeId, traineeName, propertyId, titleSetMode });
    setShowModal(false);
  };

  const toggleCheck = async (titleId, nextChecked) => {
    if (!active?.traineeId || !assignmentId || !titleSetId) return;
    if (savingId) return; // prevent rapid double updates

    try {
      setSavingId(titleId);

      await ensureAssignment({
        traineeId: active.traineeId,
        assignmentId,
        titleSetId,
        propertyId:
          active.titleSetMode === "company" ? null : active.propertyId,
      });

      await setTrainingCheck({
        traineeId: active.traineeId,
        assignmentId,
        titleId,
        checked: nextChecked,
        trainerName: (trainerName || admin?.name || admin?.email || "").trim(),
        trainerUid: admin?.id || null,
      });
    } catch (e) {
      console.error(e);
      alert(e?.message || "Failed to update training progress.");
    } finally {
      setSavingId("");
    }
  };

  const titleCount = titles.length;
  const checkedCount = Object.keys(checkedTraining || {}).length;
  const progress = getProgress(checkedTraining, titles);

  const activeSetLabel =
    active?.titleSetMode === "company"
      ? "Company (Concierge Day 1)"
      : buildings?.find((b) => b.id === active?.propertyId)?.name ||
        active?.propertyId ||
        "—";

  const previewPropertyLabel =
    buildings?.find((b) => b.id === defaultPropertyId)?.name ||
    defaultPropertyId ||
    "Current property";

  const renderPreview = (groupedTitles, loading, error, emptyLabel) => {
    if (loading) return <div className="muted">Loading training set…</div>;
    if (error) return <div className="error-text">{error}</div>;

    const entries = Object.entries(groupedTitles);
    if (!entries.length) {
      return <div className="muted">{emptyLabel}</div>;
    }

    return (
      <div>
        {entries.map(([dayStr, list]) => (
          <div key={dayStr} className="day-group">
            <div className="day-header">
              <div className="day-label">{niceDayLabel(Number(dayStr))}</div>
              <div className="day-line" />
            </div>
            <div className="card">
              <div className="card-corner" />
              <div className="training-preview-list">
                {list.map((item) => (
                  <div key={item.id} className="training-preview-row">
                    <span className="training-preview-dot" />
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <section className="panel training-shell">
      {active ? (
        <div className="fade-in">
          <div className="training-hero training-hero-session">
            <div>
              <button
                className="back-btn"
                onClick={() => setActive(null)}
                type="button"
              >
                ← Return to overview
              </button>
              <div className="page-title">
                Training
                <br />
                <span>Session</span>
              </div>
            </div>
          </div>

          <div className="divider" />

          <div className="trainee-banner">
            <div className="trainee-info">
              <div className="trainee-name-label">Active Trainee</div>
              <div className="trainee-name">
                {active.traineeName || active.traineeId}
              </div>
            </div>
            <div className="trainee-meta">
              <div className="meta-chip">
                <div className="meta-chip-label">Trainer</div>
                <div className="meta-chip-val">
                  {(trainerName || admin?.name || admin?.email || "—").trim()}
                </div>
              </div>
              <div className="meta-chip">
                <div className="meta-chip-label">Training Set</div>
                <div className="meta-chip-val training-set-chip">
                  {activeSetLabel}
                </div>
              </div>
            </div>
          </div>

          <div className="progress-section">
            <div className="progress-header">
              <div className="progress-label">Training Progress</div>
              <div className="progress-count">
                {checkedCount} <span>/ {titleCount} completed</span>
              </div>
            </div>
            <div className="progress-track">
              <div
                className="progress-fill"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
          </div>

          {titlesLoading || assignLoading ? (
            <div className="muted">Loading checklist…</div>
          ) : titlesError ? (
            <div className="error-text">{titlesError}</div>
          ) : assignError ? (
            <div className="error-text">{assignError}</div>
          ) : titleCount === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">◈</div>
              <div className="empty-title">No titles found</div>
              <div className="empty-sub">
                This training set does not have any active checklist items yet.
              </div>
            </div>
          ) : (
            Object.entries(grouped).map(([dayStr, list]) => {
              const day = Number(dayStr);
              if (!list?.length) return null;

              return (
                <div key={day} className="day-group">
                  <div className="day-header">
                    <div className="day-label">{niceDayLabel(day)}</div>
                    <div className="day-line" />
                  </div>

                  {list.map((t) => {
                    const info = checkedTraining?.[t.id];
                    const isChecked = !!info;
                    const isSaving = savingId === t.id;

                    return (
                      <button
                        key={t.id}
                        type="button"
                        className={`check-item ${isChecked ? "checked" : ""}`}
                        onClick={() => toggleCheck(t.id, !isChecked)}
                        disabled={isSaving}
                      >
                        <span className="check-box">
                          <span className="check-icon">✓</span>
                        </span>
                        <span className="check-content">
                          <span className="check-title">{t.label}</span>
                          <span
                            className={`check-status ${
                              isChecked ? "done" : "pending"
                            }`}
                          >
                            <span
                              className={`status-dot ${
                                isChecked ? "done" : "pending"
                              }`}
                            />
                            {isChecked
                              ? `Checked by ${info.trainerName || "—"}`
                              : "Not trained yet"}
                          </span>
                          {isSaving ? (
                            <span className="check-timestamp">Saving…</span>
                          ) : info?.checkedAt ? (
                            <span className="check-timestamp">
                              Recorded in training log
                            </span>
                          ) : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}

          <div className="section-note">
            Changes are saved automatically. Trainer attribution stays attached
            to each completed item.
          </div>
        </div>
      ) : (
        <div className="fade-in">
          <div className="training-hero">
            <div>
              <div className="page-title">
                Employee
                <br />
                <span>Training</span>
              </div>
            </div>

            <div className="page-meta">
              <div className="page-meta-label">Registered Trainees</div>
              <div className="page-meta-value">
                {traineesLoading ? "…" : trainees.length}
              </div>
            </div>
          </div>

          <div className="divider" />

          <div className="tabs">
            <button
              type="button"
              className={`tab-btn${tab === "overview" ? " active" : ""}`}
              onClick={() => setTab("overview")}
            >
              Overview
            </button>
            <button
              type="button"
              className={`tab-btn${tab === "company" ? " active" : ""}`}
              onClick={() => setTab("company")}
            >
              Company Training
            </button>
            <button
              type="button"
              className={`tab-btn${tab === "property" ? " active" : ""}`}
              onClick={() => setTab("property")}
            >
              Property Training
            </button>
          </div>

          <div className="training-toolbar">
            <div className="training-toolbar-copy">
              {tab === "overview" && "All trainees and active training paths"}
              {tab === "company" && "Company onboarding curriculum preview"}
              {tab === "property" &&
                `${previewPropertyLabel} training curriculum preview`}
            </div>
            <button className="btn-primary" onClick={openTrainer} type="button">
              <span>✦</span>
              <span>Train Employee</span>
            </button>
          </div>

          {traineesError ? (
            <div className="error-text">{traineesError}</div>
          ) : tab === "overview" ? (
            trainees.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">◈</div>
                <div className="empty-title">No trainees registered</div>
                <div className="empty-sub">
                  Begin by creating a trainee and opening a training session.
                </div>
              </div>
            ) : (
              <div className="trainee-grid">
                {trainees.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className="trainee-card"
                    onClick={openTrainer}
                  >
                    <div className="tc-name">{t.name || t.id}</div>
                    <div className="tc-mini-bar">
                      <div className="tc-mini-fill" style={{ width: "100%" }} />
                    </div>
                    <div className="tc-stats">
                      <div>
                        <div className="tc-stat-label">Status</div>
                        <div className="tc-stat-val">Registered</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div className="tc-stat-label">Action</div>
                        <div className="tc-stat-val">Start session</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )
          ) : tab === "company" ? (
            renderPreview(
              groupedCompanyTitles,
              companyTitlesLoading,
              companyTitlesError,
              "No company training titles found."
            )
          ) : (
            renderPreview(
              groupedPropertyTitles,
              propertyPreviewLoading,
              propertyPreviewError,
              "No property-specific training titles found for this property."
            )
          )}
        </div>
      )}

      {showModal && (
        <TrainEmployeeModal
          admin={admin}
          buildings={buildings}
          defaultPropertyId={defaultPropertyId}
          trainees={trainees}
          trainerName={trainerName}
          onChangeTrainerName={setTrainerName}
          onRegisterNewTrainee={handleRegisterNewTrainee}
          onStart={handleStart}
          onClose={() => setShowModal(false)}
        />
      )}
    </section>
  );
}
