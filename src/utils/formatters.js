export function formatRole(role) {
  if (!role) return "—";
  switch (role) {
    case "resident":
      return "Resident";
    case "guest":
      return "Guest";
    case "vendor":
      return "Vendor";
    case "staff":
      return "Staff";
    default:
      return role;
  }
}