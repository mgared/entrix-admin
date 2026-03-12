// useUnitDoc.js
import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";

function unitDocId(unitLabel) {
  return encodeURIComponent(String(unitLabel || "").trim());
}

export default function useUnitDoc(propertyId, unitLabel) {
  const [unit, setUnit] = useState(null);

  useEffect(() => {
    const u = String(unitLabel || "").trim();
    if (!propertyId || !u) {
      setUnit(null);
      return;
    }

    const ref = doc(db, "Properties", propertyId, "units", unitDocId(u));
    return onSnapshot(ref, (snap) =>
      setUnit(snap.exists() ? snap.data() : null)
    );
  }, [propertyId, unitLabel]);

  return unit;
}
