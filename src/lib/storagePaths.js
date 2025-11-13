// Builds canonical Storage paths for property assets.
export function slideshowPath(propertyId, filename) {
  // ensure unique—prefix the filename
  const stamp = Date.now();
  // Keep the original extension if any
  const ext = filename.includes(".") ? filename.split(".").pop() : "bin";
  return `properties/${propertyId}/slideshows/${stamp}_${Math.random()
    .toString(36)
    .slice(2)}.${ext}`;
}
