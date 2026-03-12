// src/features/training/useTrainingTitles.js
import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../../lib/firebase";

export default function useTrainingTitles(titleSetId) {
  const [titles, setTitles] = useState([]);
  const [loading, setLoading] = useState(!!titleSetId);
  const [error, setError] = useState("");

  useEffect(() => {
    setTitles([]);
    setError("");
    setLoading(!!titleSetId);
  }, [titleSetId]);

  useEffect(() => {
    if (!titleSetId) return;

    setLoading(true);
    setError("");

    // ✅ index-safe: only one orderBy in the query
    const q = query(
      collection(db, "trainingTitleSets", titleSetId, "titles"),
      orderBy("day", "asc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = [];
        snap.forEach((d) => rows.push({ id: d.id, ...d.data() }));

        const active = rows.filter((t) => t.active !== false);

        // ✅ then sort in JS by (day, order, label)
        active.sort((a, b) => {
          const ad = Number(a.day || 1);
          const bd = Number(b.day || 1);
          if (ad !== bd) return ad - bd;

          const ao = Number.isFinite(Number(a.order)) ? Number(a.order) : 9999;
          const bo = Number.isFinite(Number(b.order)) ? Number(b.order) : 9999;
          if (ao !== bo) return ao - bo;

          return String(a.label || "").localeCompare(String(b.label || ""));
        });

        setTitles(active);
        setLoading(false);
      },
      (e) => {
        console.error(e);
        setError("Failed to load training titles.");
        setLoading(false);
      }
    );

    return () => unsub();
  }, [titleSetId]);

  return { titles, loading, error };
}
