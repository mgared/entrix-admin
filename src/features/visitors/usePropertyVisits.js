// src/features/visitors/usePropertyVisits.js
import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  limit,
} from "firebase/firestore";
import { db } from "../../lib/firebase";

const INITIAL_LIMIT = 30;
const PAGE_SIZE = 10;

export default function usePropertyVisits(propertyId) {
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(!!propertyId);
  const [error, setError] = useState("");

  const [limitCount, setLimitCount] = useState(INITIAL_LIMIT);
  const [canLoadMore, setCanLoadMore] = useState(false);

  // reset when property changes
  useEffect(() => {
    setVisits([]);
    setError("");
    setLimitCount(INITIAL_LIMIT);
    setCanLoadMore(false);
    setLoading(!!propertyId);
  }, [propertyId]);

  useEffect(() => {
    if (!propertyId) return;

    setLoading(true);
    setError("");

    const q = query(
      collection(db, "Properties", propertyId, "visits"),
      orderBy("createdAt", "desc"),
      limit(limitCount)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = [];
        snap.forEach((d) => {
          const data = d.data() || {};

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
            vendorCompany: data.vendorCompany || "",
            visitee: data.visitee || "",
            contact: data.contact || "", // 👈 NEW: future resident contact
            createdAt,
            signedOutAt,
          });
        });

        setVisits(rows);
        setCanLoadMore(snap.size === limitCount);
        setLoading(false);
      },
      (e) => {
        console.error(e);
        setError("Failed to load visitors.");
        setLoading(false);
      }
    );

    return () => unsub();
  }, [propertyId, limitCount]);

  const loadMore = () => {
    setLimitCount((prev) => prev + PAGE_SIZE);
  };

  return { visits, loading, error, canLoadMore, loadMore };
}
