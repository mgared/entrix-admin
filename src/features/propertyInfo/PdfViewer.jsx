import React, { useEffect, useMemo, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { ref, getBlob } from "firebase/storage";
import { storage } from "../../lib/firebase";

import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

export default function PdfViewer({ storagePath, theme = "dim" }) {
  const [numPages, setNumPages] = useState(null);
  const [containerWidth, setContainerWidth] = useState(900);

  const [blob, setBlob] = useState(null);
  const [blobErr, setBlobErr] = useState("");

  // Download PDF as Blob using Firebase SDK (avoids CORS issues)
  useEffect(() => {
    let alive = true;

    async function load() {
      if (!storagePath) return;
      setBlob(null);
      setBlobErr("");
      setNumPages(null);

      try {
        const b = await getBlob(ref(storage, storagePath));
        if (!alive) return;
        setBlob(b);
      } catch (e) {
        console.error(e);
        if (!alive) return;
        setBlobErr(e?.message || "Failed to download PDF.");
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [storagePath]);

  useEffect(() => {
    const el = document.getElementById("pdf-viewer-wrap");
    if (!el) return;

    const ro = new ResizeObserver(() => setContainerWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pageWidth = useMemo(
    () => Math.max(320, containerWidth - 24),
    [containerWidth]
  );

  if (!storagePath) return null;

  if (blobErr) {
    return <div className="pi-error">Failed to load PDF: {blobErr}</div>;
  }

  if (!blob) {
    return <div className="pi-muted">Loading PDF…</div>;
  }

  return (
    <div
      id="pdf-viewer-wrap"
      className={`pdf-wrap pdf-${theme}`}
      style={{ width: "100%", height: "100%", overflow: "auto" }}
    >
      <Document
        file={blob}
        onLoadSuccess={({ numPages }) => setNumPages(numPages)}
        loading={<div className="pi-muted">Loading PDF…</div>}
        error={<div className="pi-error">Failed to render PDF.</div>}
        renderMode="canvas"
      >
        {Array.from(new Array(numPages || 0), (_, idx) => (
          <div key={idx} style={{ marginBottom: 14 }}>
            <Page
              pageNumber={idx + 1}
              width={pageWidth}
              renderAnnotationLayer={false}
              renderTextLayer={true}
            />
          </div>
        ))}
      </Document>
    </div>
  );
}
