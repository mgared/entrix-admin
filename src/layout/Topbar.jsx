// src/layout/Topbar.jsx
import React, { useRef, useState, useEffect } from "react";
import { MapPin, LogOut, MoreHorizontal, Upload } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";
import { db } from "../lib/firebase";
import {
  getStorage,
  ref as sref,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";
import { doc, updateDoc } from "firebase/firestore";

const THEME = "#3BB44A";

// tiny click-outside helper
function useClickAway(ref, onAway) {
  useEffect(() => {
    function onDocClick(e) {
      if (ref.current && !ref.current.contains(e.target)) onAway?.();
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [ref, onAway]);
}

function Topbar({ admin, buildings, selectedBuildingId, onSelectBuilding }) {
  const navigate = useNavigate();
  const { logout } = useAuth();

  // settings menu state
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  useClickAway(menuRef, () => setMenuOpen(false));

  // hidden file input and upload state
  const fileInputRef = useRef(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // make sure we target the correct bucket
  const storageForLogos = getStorage(
    undefined,
    "gs://entrix-30a48.appspot.com"
  );

  const handleLogout = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  // menu -> choose file
  const openLogoPicker = () => {
    setMenuOpen(false);
    fileInputRef.current?.click();
  };

  // actual upload -> write logoImageUrl
  const handleLogoChosen = async (e) => {
    try {
      const file = e.target.files?.[0];
      if (!file || !selectedBuildingId) return;

      setUploadingLogo(true);

      const ext = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
      const path = `properties/${selectedBuildingId}/logo/logo_${Date.now()}.${ext}`;
      const r = sref(storageForLogos, path);
      await uploadBytes(r, file);
      const url = await getDownloadURL(r);

      const propRef = doc(db, "Properties", selectedBuildingId);
      await updateDoc(propRef, { logoImageUrl: url });
      // optional toast
      // alert("Logo updated!");
    } catch (err) {
      console.error(err);
      alert(err?.message || "Failed to upload logo.");
    } finally {
      setUploadingLogo(false);
      if (e?.target) e.target.value = "";
    }
  };

  return (
    <header className="admin-topbar">
      <div className="topbar-left">
        <div className="logo-dot" style={{ backgroundColor: THEME }} />
        <div>
          <div className="topbar-title">Entrix Admin</div>
          <div className="topbar-sub">Signed in as {admin?.name || "—"}</div>
        </div>
      </div>

      <div className="topbar-right">
        <div className="building-select-wrap">
          <MapPin size={16} />
          <select
            className="building-select"
            value={selectedBuildingId}
            onChange={(e) => onSelectBuilding(e.target.value)}
          >
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        {/* SETTINGS / HAMBURGER MENU */}
        <div
          className="relative"
          ref={menuRef}
          style={{ position: "relative" }}
        >
          <button
            className="ghost-btn"
            type="button"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <MoreHorizontal size={18} />
            <span>{uploadingLogo ? "Uploading…" : "Settings"}</span>
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="menu-popover"
              style={{
                position: "absolute",
                right: 0,
                top: "calc(100% + 8px)",
                minWidth: 220,
                background: "#fff",
                border: "1px solid rgba(0,0,0,0.08)",
                borderRadius: 12,
                boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
                padding: 6,
                zIndex: 10,
              }}
            >
              <button
                role="menuitem"
                className="menu-item-btn"
                onClick={openLogoPicker}
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                }}
              >
                <Upload size={16} />
                <span>Change / Upload property logo</span>
              </button>
            </div>
          )}
        </div>

        <button className="ghost-btn" type="button" onClick={handleLogout}>
          <LogOut size={18} />
          <span>Logout</span>
        </button>

        {/* hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleLogoChosen}
        />
      </div>
    </header>
  );
}

export default Topbar;
