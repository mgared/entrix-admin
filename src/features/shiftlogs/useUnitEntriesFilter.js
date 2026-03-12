// src/features/shiftlogs/useUnitEntriesFilter.js
import { useEffect, useMemo, useState } from "react";
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "../../lib/firebase";

const INITIAL_LIMIT = 30;
const PAGE_SIZE = 20;

function unitDocId(unitLabel) {
  return encodeURIComponent(String(unitLabel || "").trim());
}

/**
 * filterKey:
 * - "all"
 * - "anyFlag"   -> where("isFlagged","==",true)
 * - "incident"  -> where("flags.incident","==",true)
 * - "moveInOut"
 * - "highlightPropertyManager"
 * - "highlightMaintenance"
 * - "highlightConciergeTeam"
 */
export default function useUnitEntriesFilter({
  propertyId,
  unitLabel,
  filterKey = "all",
}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(!!propertyId);
  const [error, setError] = useState("");

  const [limitCount, setLimitCount] = useState(INITIAL_LIMIT);
  const [canLoadMore, setCanLoadMore] = useState(false);

  const normUnit = String(unitLabel || "").trim();

  // reset when property/unit/filter changes
  useEffect(() => {
    setRows([]);
    setError("");
    setLimitCount(INITIAL_LIMIT);
    setCanLoadMore(false);
    setLoading(!!propertyId && !!normUnit);
  }, [propertyId, normUnit, filterKey]);

  const constraints = useMemo(() => {
    if (!propertyId || !normUnit) return null;

    const colRef = collection(
      db,
      "Properties",
      propertyId,
      "units",
      unitDocId(normUnit),
      "entries"
    );

    // base order
    const base = [orderBy("updatedAt", "desc"), limit(limitCount + 1)];

    if (filterKey === "all") {
      return query(colRef, ...base);
    }

    if (filterKey === "anyFlag") {
      return query(colRef, where("isFlagged", "==", true), ...base);
    }

    // specific flags.*
    return query(colRef, where(`flags.${filterKey}`, "==", true), ...base);
  }, [propertyId, normUnit, filterKey, limitCount]);

  useEffect(() => {
    if (!constraints) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    const unsub = onSnapshot(
      constraints,
      (snap) => {
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setCanLoadMore(docs.length > limitCount);
        setRows(docs.slice(0, limitCount));
        setLoading(false);
      },
      (e) => {
        console.error(e);
        setError("Failed to load unit entries.");
        setLoading(false);
      }
    );

    return () => unsub();
  }, [constraints, limitCount]);

  const loadMore = () => setLimitCount((p) => p + PAGE_SIZE);

  return { rows, loading, error, canLoadMore, loadMore };
}
