import React from "react";

function EventsView({ building }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div className="panel-title-wrap">
          <h2>Events</h2>
        </div>
      </div>
      <div className="panel-body">
        <div className="muted">
          Events management for <strong>{building?.name}</strong> is
          coming soon.
        </div>
      </div>
    </section>
  );
}

export default EventsView;