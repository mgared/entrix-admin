import React from "react";
import { Calendar } from "lucide-react";
import FilterChip from "../../components/ui/FilterChip";
import StatusPill from "../../components/ui/StatusPill";
import { getFilteredAmenityRequests } from "../../utils/filters";

function AmenityRequestsView({
  buildingId,
  amenityRequestsByBuilding,
  amenityStatusFilter,
  onChangeStatusFilter,
  onChangeRequestStatus,
  onOpenAddBooking,
  dataOverride, // <-- NEW
  loadingOverride, // <-- NEW
  errorOverride, // <-- NEW
}) {
  const all = Array.isArray(dataOverride)
    ? dataOverride
    : amenityRequestsByBuilding[buildingId] || [];

  const amenityRequests = getFilteredAmenityRequests(all, amenityStatusFilter);

  return (
    <section className="panel">
      <div className="panel-header">
        <div className="panel-title-wrap">
          <Calendar size={18} />
          <h2>Amenity Booking Requests</h2>
        </div>
        <div className="chip-row">
          {/* chips unchanged */}
          <FilterChip
            label="All"
            active={amenityStatusFilter === "all"}
            onClick={() => onChangeStatusFilter("all")}
          />
          <FilterChip
            label="Pending"
            active={amenityStatusFilter === "pending"}
            onClick={() => onChangeStatusFilter("pending")}
          />
          <FilterChip
            label="Approved"
            active={amenityStatusFilter === "approved"}
            onClick={() => onChangeStatusFilter("approved")}
          />
          <FilterChip
            label="Rejected"
            active={amenityStatusFilter === "rejected"}
            onClick={() => onChangeStatusFilter("rejected")}
          />
        </div>
      </div>

      <div className="panel-body scroll">
        {loadingOverride ? (
          <div className="muted">Loading bookings…</div>
        ) : errorOverride ? (
          <div className="error-text">{errorOverride}</div>
        ) : amenityRequests.length === 0 ? (
          <div className="muted">No amenity requests matching this filter.</div>
        ) : (
          /* table body unchanged */
          <table className="data-table">
            <thead>
              <tr>
                <th>Resident</th>
                <th>Unit</th>
                <th>Amenity</th>
                <th>Date</th>
                <th>From - To</th>
                <th>Notes</th>
                <th>Status</th>
                <th>Quick Action</th>
              </tr>
            </thead>
            <tbody>
              {amenityRequests.map((r) => (
                <tr key={`${r.amenityId}_${r.id}`}>
                  <td>{r.name || "—"}</td>
                  <td>{r.unitLabel || "—"}</td>
                  <td>{r.amenity || "—"}</td>
                  <td>{r.bookedDate || "—"}</td>
                  <td>
                    {r.startAt && r.endAt ? `${r.startAt} - ${r.endAt}` : "—"}
                  </td>
                  <td>{r.notes || "—"}</td>
                  <td>
                    <StatusPill status={r.status} />
                  </td>
                  <td>
                    <div className="actions-inline">
                      {r.status !== "approved" && (
                        <button
                          className="mini-btn mini-approve"
                          type="button"
                          onClick={() =>
                            onChangeRequestStatus(r.amenityId, r.id, "approved")
                          }
                        >
                          Approve
                        </button>
                      )}
                      {r.status !== "rejected" && (
                        <button
                          className="mini-btn mini-reject"
                          type="button"
                          onClick={() =>
                            onChangeRequestStatus(r.amenityId, r.id, "rejected")
                          }
                        >
                          Reject
                        </button>
                      )}
                      {r.status !== "pending" && (
                        <button
                          className="mini-btn mini-reset"
                          type="button"
                          onClick={() =>
                            onChangeRequestStatus(r.amenityId, r.id, "pending")
                          }
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="add-booking-bar">
        <button
          type="button"
          className="primary-line-btn"
          onClick={onOpenAddBooking}
        >
          + Add booking
        </button>
      </div>
    </section>
  );
}

export default AmenityRequestsView;
