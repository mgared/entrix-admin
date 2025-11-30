// Live events for one property: Properties/{propertyId}/events
import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../../lib/firebase";

export default function usePropertyEvents(propertyId) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(!!propertyId);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!propertyId) return;
    setLoading(true);
    setError("");

    const q = query(
      collection(db, "Properties", propertyId, "events"),
      // you can switch "startAt" to "createdAt" if you prefer
      orderBy("startAt", "asc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data() || {};

          const startAt = data.startAt?.toDate
            ? data.startAt.toDate()
            : data.startAt || null;

          const createdAt = data.createdAt?.toDate
            ? data.createdAt.toDate()
            : data.createdAt || null;

          rows.push({
            id: docSnap.id,
            ...data,
            startAt,
            createdAt,
          });
        });

        setEvents(rows);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setError("Failed to load events.");
        setLoading(false);
      }
    );

    return () => unsub();
  }, [propertyId]);

  return { events, loading, error };
}
