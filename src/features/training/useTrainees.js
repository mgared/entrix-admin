// src/features/training/useTrainees.js
import { useEffect, useState } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "../../lib/firebase";

export default function useTrainees() {
  const [trainees, setTrainees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const q = query(collection(db, "trainees"), orderBy("nameLower", "asc"));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = [];
        snap.forEach((d) => rows.push({ id: d.id, ...d.data() }));
        setTrainees(rows);
        setLoading(false);
      },
      (e) => {
        console.error(e);
        setError("Failed to load trainees.");
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  return { trainees, loading, error };
}
