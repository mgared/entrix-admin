// Streams Properties/{propertyId}/amenities (active or all).
import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../../lib/firebase";

export default function usePropertyAmenities(propertyId) {
  const [amenities, setAmenities] = useState([]);
  const [loading, setLoading] = useState(!!propertyId);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!propertyId) {
      setAmenities([]);
      setLoading(false);
      setError("");
      return;
    }
    setLoading(true);
    const q = query(
      collection(db, "Properties", propertyId, "amenities"),
      orderBy("name", "asc")
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setAmenities(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (e) => {
        setError(e.message || "Failed to load amenities");
        setLoading(false);
      }
    );
    return unsub;
  }, [propertyId]);

  return { amenities, loading, error };
}
