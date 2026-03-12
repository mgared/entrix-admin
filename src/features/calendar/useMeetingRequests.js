import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "../../lib/firebase";

function normalizeRequestedSlots(data) {
  if (Array.isArray(data?.requestedSlots)) {
    return data.requestedSlots
      .map((slot) => ({
        dateKey: slot?.dateKey || "",
        timeKey: slot?.timeKey || "",
      }))
      .filter((slot) => slot.dateKey && slot.timeKey);
  }

  if (data?.dateKey && data?.timeKey) {
    return [{ dateKey: data.dateKey, timeKey: data.timeKey }];
  }

  return [];
}

export default function useMeetingRequests(propertyId, adminId) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(!!propertyId && !!adminId);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!propertyId || !adminId) {
      setRequests([]);
      setLoading(false);
      setError("");
      return;
    }

    setLoading(true);
    setError("");

    const q = query(
      collection(
        db,
        "Properties",
        propertyId,
        "leasingAvailability",
        adminId,
        "requests"
      ),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        setRequests(
          snap.docs.map((docSnap) => {
            const data = docSnap.data() || {};
            return {
              id: docSnap.id,
              residentName: data.residentName || data.name || "",
              unitLabel: data.unitLabel || data.address || "",
              title: data.title || data.reason || data.meetingTitle || "",
              status: data.status || "pending",
              requestedSlots: normalizeRequestedSlots(data),
              createdAt: data.createdAt?.toDate
                ? data.createdAt.toDate()
                : data.createdAt || null,
            };
          })
        );
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setError(err?.message || "Failed to load meeting requests.");
        setLoading(false);
      }
    );

    return () => unsub();
  }, [propertyId, adminId]);

  return { requests, loading, error };
}
