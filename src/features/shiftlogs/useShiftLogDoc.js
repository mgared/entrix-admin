// src/features/shiftlogs/useShiftLogDoc.js
import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";

export default function useShiftLogDoc(propertyId, shiftLogId) {
  const [row, setRow] = useState(null);
  const [loading, setLoading] = useState(!!propertyId && !!shiftLogId);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!propertyId || !shiftLogId) {
      setRow(null);
      setLoading(false);
      setError("");
      return;
    }

    setLoading(true);
    setError("");

    const ref = doc(db, "Properties", propertyId, "shiftLogs", shiftLogId);

    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setRow(null);
          setError("Shift log not found.");
          setLoading(false);
          return;
        }
        setRow({ id: snap.id, ...snap.data() });
        setLoading(false);
      },
      (e) => {
        console.error(e);
        setError("Failed to load shift log.");
        setLoading(false);
      }
    );

    return () => unsub();
  }, [propertyId, shiftLogId]);

  return { row, loading, error };
}
