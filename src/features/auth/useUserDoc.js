// src/features/auth/useUserDoc.js
import { useEffect, useState } from "react";
import { db } from "../../lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";

export default function useUserDoc(uid) {
  const [userDoc, setUserDoc] = useState(null);

  useEffect(() => {
    if (!uid) {
      setUserDoc(null);
      return;
    }
    const ref = doc(db, "users", uid);
    const unsub = onSnapshot(ref, (snap) => {
      setUserDoc(snap.exists() ? { id: snap.id, ...snap.data() } : null);
    });
    return unsub;
  }, [uid]);

  return userDoc;
}
