
export function getFilteredVisitors(list, filterKey) {
  if (!list || list.length === 0) return [];
  if (filterKey === "all") return list;

  const now = new Date();
  let start = new Date(now);

  if (filterKey === "today") {
    start.setHours(0, 0, 0, 0);
  } else if (filterKey === "7d") {
    start.setDate(start.getDate() - 7);
  } else if (filterKey === "30d") {
    start.setDate(start.getDate() - 30);
  }

  return list.filter((v) => {
    if (!v.createdAt) return false;
    const t = new Date(v.createdAt);
    return t >= start && t <= now;
  });
}

export function getFilteredAmenityRequests(list, statusFilter) {
  if (!list || list.length === 0) return [];
  if (statusFilter === "all") return list;
  return list.filter((r) => (r.status || "pending") === statusFilter);
}