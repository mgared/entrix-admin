
import React from "react";
import { UploadCloud } from "lucide-react";

function SlideshowUploadBar({
  fileInputRef,
  onTriggerUpload,
  onFilesSelected,
  selectedBuildingId,
}) {
  return (
    <div className="slideshow-upload-bar">
      <input
        type="file"
        accept="image/*"
        multiple
        ref={fileInputRef}
        onChange={onFilesSelected}
        style={{ display: "none" }}
      />
      <button
        type="button"
        className="primary-line-btn"
        onClick={onTriggerUpload}
      >
        <UploadCloud size={14} />
        <span>Upload image</span>
      </button>
      <span className="muted tiny">
        (Demo only: previews are in-memory. In production upload to
        <code> /properties/{selectedBuildingId}/slideshowImages</code>.)
      </span>
    </div>
  );
}

export default SlideshowUploadBar;