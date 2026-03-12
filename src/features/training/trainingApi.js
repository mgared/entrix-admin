// src/features/training/trainingApi.js
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  deleteField,
} from "firebase/firestore";
import { db } from "../../lib/firebase";

export async function registerTrainee({ traineeId, name }) {
  const traineeRef = doc(db, "trainees", traineeId);
  const snap = await getDoc(traineeRef);

  const cleanName = String(name || "").trim();
  const nameLower = cleanName.toLowerCase();

  if (!snap.exists()) {
    await setDoc(traineeRef, {
      name: cleanName,
      nameLower,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } else {
    await updateDoc(traineeRef, {
      name: cleanName,
      nameLower,
      updatedAt: serverTimestamp(),
    });
  }

  return traineeRef;
}

export async function ensureAssignment({
  traineeId,
  assignmentId, // "company" or propertyId
  titleSetId, // "company" or propertyId
  propertyId, // null for company
}) {
  const aRef = doc(db, "trainees", traineeId, "assignments", assignmentId);
  const snap = await getDoc(aRef);

  if (!snap.exists()) {
    await setDoc(aRef, {
      assignmentId,
      titleSetId,
      propertyId: propertyId || null,
      status: "active",
      startedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      checkedTraining: {},
    });
  } else {
    // keep structure consistent and touch updatedAt
    await updateDoc(aRef, {
      titleSetId,
      propertyId: propertyId || null,
      updatedAt: serverTimestamp(),
    });
  }

  return aRef;
}

export async function setTrainingCheck({
  traineeId,
  assignmentId,
  titleId,
  checked,
  trainerName,
  trainerUid,
}) {
  const aRef = doc(db, "trainees", traineeId, "assignments", assignmentId);

  if (checked) {
    await setDoc(
      aRef,
      {
        updatedAt: serverTimestamp(),
        checkedTraining: {
          [titleId]: {
            trainerName: (trainerName || "").trim() || "Trainer",
            trainerUid: trainerUid || null,
            checkedAt: serverTimestamp(),
          },
        },
      },
      { merge: true }
    );
  } else {
    await updateDoc(aRef, {
      [`checkedTraining.${titleId}`]: deleteField(),
      updatedAt: serverTimestamp(),
    });
  }
}

export function makeTraineeIdFromName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
