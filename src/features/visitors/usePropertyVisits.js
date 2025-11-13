// Live reads Properties/{propertyId}/visits and returns a normalized array.
import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../../lib/firebase";

export default function usePropertyVisits(propertyId) {
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(!!propertyId);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!propertyId) return;
    setLoading(true);
    setError("");

    const q = query(
      collection(db, "Properties", propertyId, "visits"),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = [];
        snap.forEach((d) => {
          const data = d.data() || {};
          // Normalize Firestore Timestamps -> JS Date
          const createdAt = data.createdAt?.toDate
            ? data.createdAt.toDate()
            : data.createdAt || null;
          const signedOutAt = data.signedOutAt?.toDate
            ? data.signedOutAt.toDate()
            : data.signedOutAt || null;

          rows.push({
            id: d.id,
            fullName: data.fullName || "",
            role: data.role || "guest",
            unitLabel: data.unitLabel || "",
            reason: data.reason || "",
            staffDepartmentRole: data.staffDepartmentRole || "",
            staffPrimaryLocation: data.staffPrimaryLocation || "",
            vendorCompany: data.vendorCompany || "",
            vendorService: data.vendorService || "",
            createdAt,
            signedOutAt,
          });
        });
        setVisits(rows);
        setLoading(false);
      },
      (e) => {
        console.error(e);
        setError("Failed to load visitors.");
        setLoading(false);
      }
    );

    return () => unsub();
  }, [propertyId]);

  return { visits, loading, error };
}
