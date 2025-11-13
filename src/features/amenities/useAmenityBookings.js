import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../../lib/firebase";

/**
 * Streams all bookings under Properties/{propertyId}/amenities/_/bookings
 * and returns a flat list. Each item includes amenityId + amenityName.
 */
export default function useAmenityBookings(propertyId) {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(!!propertyId);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!propertyId) {
      setBookings([]);
      setLoading(false);
      setError("");
      return;
    }
    setLoading(true);

    // 1) listen to amenities
    const amenityCol = collection(db, "Properties", propertyId, "amenities");
    const unsubs = [];
    const amenityUnsub = onSnapshot(
      amenityCol,
      (amenitySnap) => {
        // clear existing child listeners
        unsubs.forEach((fn) => fn());
        unsubs.length = 0;

        const next = [];
        const amenities = amenitySnap.docs.map((d) => ({
          id: d.id,
          name: d.data()?.name || "",
        }));

        // 2) attach a bookings listener per amenity
        amenities.forEach((a) => {
          const q = query(
            collection(
              db,
              "Properties",
              propertyId,
              "amenities",
              a.id,
              "bookings"
            ),
            orderBy("createdAt", "desc")
          );
          const u = onSnapshot(
            q,
            (bs) => {
              const rows = bs.docs.map((d) => {
                const data = d.data() || {};
                // normalize server timestamps to plain strings for your table
                const createdAt = data.createdAt?.toDate
                  ? data.createdAt.toDate()
                  : data.createdAt || null;
                return {
                  id: d.id,
                  amenityId: a.id,
                  amenity: a.name,
                  name: data.residentName || "", // map to your UI’s "Resident"
                  unitLabel: data.unitLabel || "",
                  bookedDate: data.bookedDate || "",
                  startAt: data.startAt || "",
                  endAt: data.endAt || "",
                  notes: data.reason || "", // your UI shows "Notes"
                  status: data.status || "pending",
                  createdAt,
                };
              });

              // merge/replace for this amenity
              setBookings((prev) => {
                // remove old rows for this amenity, add new rows, then sort
                const others = prev.filter((r) => r.amenityId !== a.id);
                return [...others, ...rows].sort((A, B) => {
                  const tA = +new Date(A.createdAt || 0);
                  const tB = +new Date(B.createdAt || 0);
                  return tB - tA;
                });
              });
              setLoading(false);
            },
            (e) => {
              setError(e.message || "Failed to load amenity bookings");
              setLoading(false);
            }
          );
          unsubs.push(u);
        });
      },
      (e) => {
        setError(e.message || "Failed to load amenities");
        setLoading(false);
      }
    );

    return () => {
      amenityUnsub();
      unsubs.forEach((fn) => fn());
    };
  }, [propertyId]);

  return { bookings, loading, error };
}
