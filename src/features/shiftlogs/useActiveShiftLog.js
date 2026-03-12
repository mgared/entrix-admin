// src/features/shiftlogs/useActiveShiftLog.js
import { useEffect, useState } from "react";
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "../../lib/firebase";

export default function useActiveShiftLog(propertyId) {
  const [active, setActive] = useState(null);
  const [loading, setLoading] = useState(!!propertyId);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!propertyId) {
      setActive(null);
      setLoading(false);
      setError("");
      return;
    }

    setLoading(true);
    setError("");

    const q = query(
      collection(db, "Properties", propertyId, "shiftLogs"),
      where("status", "==", "open"),
      orderBy("shiftStart", "desc"),
      limit(1)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const docu = snap.docs[0];
        setActive(docu ? { id: docu.id, ...docu.data() } : null);
        setLoading(false);
      },
      (e) => {
        console.error(e);
        setError("Failed to load active shift log.");
        setLoading(false);
      }
    );

    return () => unsub();
  }, [propertyId]);

  return { active, loading, error };
}
