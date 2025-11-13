import React from "react";
import { Image as ImageIcon } from "lucide-react";
import SlideshowGrid from "../../components/slideshows/SlideshowGrid";
import SlideshowUploadBar from "../../components/slideshows/SlideshowUploadBar";

function SlideshowsView({
  buildingId,
  slides,
  fileInputRef,
  onDeleteSlide,
  onTriggerUpload,
  onSlidesSelected,
}) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div className="panel-title-wrap">
          <ImageIcon size={18} />
          <h2>Slideshows</h2>
        </div>
        <p className="muted small">
          Images displayed on the tablet home screen for this property.
        </p>
      </div>

      <div className="panel-body">
        <SlideshowGrid slides={slides} onDelete={onDeleteSlide} />
      </div>

      <SlideshowUploadBar
        fileInputRef={fileInputRef}
        onTriggerUpload={onTriggerUpload}
        onFilesSelected={onSlidesSelected}
        selectedBuildingId={buildingId}
      />
    </section>
  );
}

export default SlideshowsView;