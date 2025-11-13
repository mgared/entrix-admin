// src/features/units/usePropertyUnits.js
import { useEffect, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "../../lib/firebase";

export default function usePropertyUnits(propertyId) {
  const [units, setUnits] = useState([]);
  const [hasUnits, setHasUnits] = useState(null); // null = unknown, true/false = known
  const [loading, setLoading] = useState(!!propertyId);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!propertyId) {
      setUnits([]);
      setHasUnits(null);
      setLoading(false);
      setError("");
      return;
    }
    setLoading(true);
    setError("");

    const propRef = doc(db, "Properties", propertyId);

    let unsubUnits = () => {};
    const unsubProp = onSnapshot(
      propRef,
      (snap) => {
        const flag = !!snap.data()?.haveUnits;
        setHasUnits(flag);

        // stop any prior units listener
        unsubUnits();

        if (!flag) {
          setUnits([]);
          setLoading(false);
          return;
        }

        const q = query(
          collection(db, "Properties", propertyId, "units"),
          orderBy("unitLabel")
        );
        unsubUnits = onSnapshot(
          q,
          (qs) => {
            setUnits(qs.docs.map((d) => ({ id: d.id, ...d.data() })));
            setLoading(false);
          },
          (e) => {
            setError(e.message || "Failed to load units");
            setLoading(false);
          }
        );
      },
      (e) => {
        setError(e.message || "Failed to load property");
        setLoading(false);
      }
    );

    return () => {
      unsubProp();
      unsubUnits();
    };
  }, [propertyId]);

  return { units, hasUnits, loading, error };
}
