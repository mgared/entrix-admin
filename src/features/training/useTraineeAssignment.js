// src/features/training/useTraineeAssignment.js
import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";

export default function useTraineeAssignment(traineeId, assignmentId) {
  const [assignment, setAssignment] = useState(null);
  const [loading, setLoading] = useState(!!traineeId && !!assignmentId);
  const [error, setError] = useState("");

  useEffect(() => {
    setAssignment(null);
    setError("");
    setLoading(!!traineeId && !!assignmentId);
  }, [traineeId, assignmentId]);

  useEffect(() => {
    if (!traineeId || !assignmentId) return;

    setLoading(true);
    setError("");

    const ref = doc(db, "trainees", traineeId, "assignments", assignmentId);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setAssignment(snap.exists() ? { id: snap.id, ...snap.data() } : null);
        setLoading(false);
      },
      (e) => {
        console.error(e);
        setError("Failed to load trainee progress.");
        setLoading(false);
      }
    );

    return () => unsub();
  }, [traineeId, assignmentId]);

  return { assignment, loading, error };
}
