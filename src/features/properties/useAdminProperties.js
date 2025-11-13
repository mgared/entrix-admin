// src/features/properties/useAdminProperties.js
import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  documentId,
} from "firebase/firestore";
import { db } from "../../lib/firebase";

const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

export default function useAdminProperties(uid) {
  const [properties, setProperties] = useState([]); // [{id, name}]
  const [loading, setLoading] = useState(!!uid);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!uid) return;
      setLoading(true);
      setError("");

      try {
        // 1) load user doc
        const userSnap = await getDoc(doc(db, "users", uid));
        const userData = userSnap.exists() ? userSnap.data() : null;
        const adminOf = Array.isArray(userData?.adminOf)
          ? userData.adminOf
          : [];

        if (!adminOf.length) {
          if (!cancelled) {
            setProperties([]);
            setLoading(false);
          }
          return;
        }

        // 2) load properties in chunks of 10 (Firestore 'in' limit)
        const chunks = chunk(adminOf, 10);
        const props = [];
        for (const ids of chunks) {
          const q = query(
            collection(db, "Properties"),
            where(documentId(), "in", ids)
          );
          const snap = await getDocs(q);
          snap.forEach((d) => {
            const data = d.data() || {};
            props.push({ id: d.id, name: data?.name || d.id });
          });
        }

        // Sort by name for a stable dropdown
        props.sort((a, b) => a.name.localeCompare(b.name));

        if (!cancelled) {
          setProperties(props);
          setLoading(false);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError("Failed to load properties.");
          setLoading(false);
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [uid]);

  return useMemo(
    () => ({ properties, loading, error }),
    [properties, loading, error]
  );
}
