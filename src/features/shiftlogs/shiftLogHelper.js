// src/features/shiftlogs/shiftLogHelper.js
import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";

export default function useShiftLogHelper(propertyId) {
  const [helper, setHelper] = useState(null);

  useEffect(() => {
    if (!propertyId) {
      setHelper(null);
      return;
    }

    const ref = doc(db, "Properties", propertyId);

    const unsub = onSnapshot(ref, (snap) => {
      const data = snap.data() || {};
      const h = data.shiftLogHelper || null;

      if (!h) {
        setHelper(null);
        return;
      }

      // ✅ this is where buildingsAndStreets actually lives
      const buildingsAndStreets = Array.isArray(data.buildingsAndStreets)
        ? data.buildingsAndStreets
        : [];

      setHelper({
        ...h,
        buildingsAndStreets,
      });
    });

    return () => unsub();
  }, [propertyId]);

  return helper;
}
