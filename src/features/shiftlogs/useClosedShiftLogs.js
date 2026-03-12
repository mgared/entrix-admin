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

export default function useClosedShiftLogs(propertyId, pageLimit = 25) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(!!propertyId);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!propertyId) {
      setRows([]); // ✅ reset list
      setLoading(false); // ✅ stop loading
      setError(""); // ✅ clear error
      return;
    }

    setLoading(true);
    setError("");

    const q = query(
      collection(db, "Properties", propertyId, "shiftLogs"),
      where("status", "==", "closed"),
      orderBy("closedAt", "desc"),
      limit(pageLimit)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (e) => {
        console.error(e);
        setError("Failed to load shift logs.");
        setLoading(false);
      }
    );

    return () => unsub();
  }, [propertyId, pageLimit]);

  return { rows, loading, error };
}
