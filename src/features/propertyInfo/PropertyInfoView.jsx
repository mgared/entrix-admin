import React, { useEffect, useMemo, useState } from "react";
import { ref, listAll } from "firebase/storage";

import { storage } from "../../lib/firebase";
import "./propertyInfo.css";
import PdfViewer from "./PdfViewer";

function sortAlpha(a, b) {
  return String(a).localeCompare(String(b), undefined, { numeric: true });
}

export default function PropertyInfoView({ buildingId, buildingName }) {
  const basePath = useMemo(() => {
    if (!buildingId) return null;
    return `properties/${buildingId}/propertyInfo`;
  }, [buildingId]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [folders, setFolders] = useState([]); // ["Usernames & Passwords", ...]
  const [rootFiles, setRootFiles] = useState([]); // files stored directly under propertyInfo/{id}

  const [openFolder, setOpenFolder] = useState(""); // currently expanded folder
  const [folderFiles, setFolderFiles] = useState({}); // { folderName: [{name, fullPath}] }

  const [selectedFile, setSelectedFile] = useState(null); // {name, fullPath}
  //   const [fileUrl, setFileUrl] = useState("");

  // Load folder list (and root files) when building changes
  useEffect(() => {
    let alive = true;

    async function loadTree() {
      if (!basePath) return;
      setLoading(true);
      setError("");
      setFolders([]);
      setRootFiles([]);
      setOpenFolder("");
      setFolderFiles({});
      setSelectedFile(null);
      //   setFileUrl("");

      try {
        const res = await listAll(ref(storage, basePath));

        const folderNames = res.prefixes.map((p) => p.name).sort(sortAlpha);
        const root = res.items
          .map((it) => ({ name: it.name, fullPath: it.fullPath }))
          .sort((a, b) => sortAlpha(a.name, b.name));

        if (!alive) return;

        setFolders(folderNames);
        setRootFiles(root);

        // Auto-open first folder if exists, else auto-select first root file
        if (folderNames.length) {
          setOpenFolder(folderNames[0]);
        } else if (root.length) {
          setSelectedFile(root[0]);
        }
      } catch (e) {
        if (!alive) return;
        console.error(e);
        setError(e?.message || "Failed to load property info.");
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadTree();
    return () => {
      alive = false;
    };
  }, [basePath]);

  // Load files for the open folder (lazy load)
  useEffect(() => {
    let alive = true;

    async function loadFolderFiles(folderName) {
      if (!basePath || !folderName) return;
      if (folderFiles[folderName]) return; // cached

      try {
        const res = await listAll(ref(storage, `${basePath}/${folderName}`));
        const files = res.items
          .map((it) => ({ name: it.name, fullPath: it.fullPath }))
          .sort((a, b) => sortAlpha(a.name, b.name));

        if (!alive) return;

        setFolderFiles((prev) => ({ ...prev, [folderName]: files }));

        // Auto-select first file when opening a folder (if none selected yet)
        if (!selectedFile && files.length) {
          setSelectedFile(files[0]);
        }
      } catch (e) {
        if (!alive) return;
        console.error(e);
        setError(e?.message || "Failed to load folder files.");
      }
    }

    loadFolderFiles(openFolder);
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openFolder, basePath]);

  // Load URL when a file is selected
  //   useEffect(() => {
  //     let alive = true;

  //     async function loadUrl() {
  //       if (!selectedFile?.fullPath) {
  //         setFileUrl("");
  //         return;
  //       }
  //       try {
  //         const url = await getDownloadURL(ref(storage, selectedFile.fullPath));
  //         if (!alive) return;
  //         setFileUrl(url);
  //       } catch (e) {
  //         if (!alive) return;
  //         console.error(e);
  //         setError(e?.message || "Failed to load PDF.");
  //       }
  //     }

  //     loadUrl();
  //     return () => {
  //       alive = false;
  //     };
  //   }, [selectedFile]);

  const openFolderFilesList = folderFiles[openFolder] || [];

  return (
    <div className="pi-root">
      <div className="pi-header">
        <div>
          <div className="pi-title">Property Info</div>
          <div className="pi-subtitle">
            {buildingName ? `${buildingName} · ` : ""}
            Read-only internal guides & PDFs
          </div>
        </div>
      </div>

      {loading && <div className="pi-muted">Loading property info…</div>}
      {error && <div className="pi-error">{error}</div>}

      {!loading && !error && (
        <div className="pi-grid">
          {/* Left sidebar */}
          <div className="pi-sidebar">
            {folders.length === 0 && rootFiles.length === 0 && (
              <div className="pi-muted">
                No PDFs found for this property yet.
                <br />
                Upload files to <code>{basePath}/</code>
              </div>
            )}

            {/* Folders */}
            {folders.map((fname) => {
              const isOpen = openFolder === fname;
              const files = folderFiles[fname] || [];
              return (
                <div key={fname} className="pi-folder">
                  <button
                    className={`pi-folder-btn ${isOpen ? "open" : ""}`}
                    onClick={() => setOpenFolder(isOpen ? "" : fname)}
                    type="button"
                  >
                    <span className="pi-caret">{isOpen ? "▾" : "▸"}</span>
                    <span className="pi-folder-name">{fname}</span>
                  </button>

                  {isOpen && (
                    <div className="pi-files">
                      {!files.length ? (
                        <div className="pi-muted small">No files</div>
                      ) : (
                        files.map((f) => (
                          <button
                            key={f.fullPath}
                            className={`pi-file-btn ${
                              selectedFile?.fullPath === f.fullPath
                                ? "active"
                                : ""
                            }`}
                            onClick={() => setSelectedFile(f)}
                            type="button"
                          >
                            {f.name}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Root-level files */}
            {rootFiles.length > 0 && (
              <div className="pi-folder">
                <div className="pi-section-label">General</div>
                <div className="pi-files">
                  {rootFiles.map((f) => (
                    <button
                      key={f.fullPath}
                      className={`pi-file-btn ${
                        selectedFile?.fullPath === f.fullPath ? "active" : ""
                      }`}
                      onClick={() => setSelectedFile(f)}
                      type="button"
                    >
                      {f.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Main viewer */}
          <div className="pi-viewer">
            {!selectedFile && (
              <div className="pi-muted">
                Select a document from the left to view it.
              </div>
            )}

            {selectedFile && (
              <>
                <div className="pi-viewer-top">
                  <div className="pi-doc-title">{selectedFile.name}</div>
                  {/* {fileUrl && (
                    <a
                      className="pi-open-link"
                      href={fileUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open in new tab
                    </a>
                  )} */}
                </div>

                <div className="pi-pdfjs">
                  <PdfViewer storagePath={selectedFile.fullPath} theme="dim" />
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
