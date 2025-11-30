import React from "react";
import { Trash2 } from "lucide-react";

/**
 * slides: array of { id, url, ... }
 * onDelete: function(slideOrId)
 */
export default function SlideshowGrid({
  slides = [],
  onDelete,
  canEdit = false,
}) {
  if (!slides.length) {
    return (
      <div className="muted small">
        No slideshow images yet. Upload one above.
      </div>
    );
  }

  return (
    <div className="slideshow-grid">
      {slides.map((slide) => (
        <div className="slideshow-card" key={slide.id}>
          <div className="slideshow-thumb-wrap">
            <img
              className="slideshow-thumb"
              src={slide.url}
              alt="Slideshow"
              loading="lazy"
            />
            {/* Only show delete button if user can edit AND handler exists */}
            {canEdit && onDelete && (
              <button
                type="button"
                className="slideshow-delete-btn"
                onClick={() => onDelete(slide)} // pass full object
                title="Delete image"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>

          <div className="slideshow-meta">
            <span className="slideshow-label">
              {new Date(
                slide.uploadedAt?.toDate?.() ?? slide.uploadedAt ?? Date.now()
              ).toLocaleString()}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
