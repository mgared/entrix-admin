// src/hooks/usePropertySlides.js
import { useEffect, useState } from "react";
import { db } from "../../lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";

export default function usePropertySlides(propertyId) {
  const [slides, setSlides] = useState([]);
  const [loading, setLoading] = useState(!!propertyId);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!propertyId) {
      setSlides([]);
      setLoading(false);
      setError("");
      return;
    }
    setLoading(true);
    const ref = doc(db, "Properties", propertyId);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const urls = snap.data()?.slideShowImageUrls ?? [];
        // id=url is fine for a grid key when using URLs
        setSlides(urls.map((url) => ({ id: url, url })));
        setLoading(false);
      },
      (err) => {
        setError(err.message || "Failed to load slides");
        setLoading(false);
      }
    );
    return unsub;
  }, [propertyId]);

  return { slides, loading, error };
}
