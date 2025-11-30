// seedReasonMaps.cjs
const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

// Initialize Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

// Your property IDs
const propertyIds = ["mENmwUR64xvjo09Irrjj", "zAlDDf5xCYOwkgLQh1AG"];

// Shared "Using Amenity" options (resident + staff)
const amenityUseReasons = [
  "using cafe lounge",
  "getting coffee",
  "getting flavored water",
];

// --- MAPS ----------------------------------------------------------------

// Resident signing in as "resident"
const reasonsResidentsMap = {
  "Leasing office": [
    "meeting with property manager",
    "meeting with leasing agent",
    "booking amenity with leasing office",
  ],
  "Using amenity": amenityUseReasons,
  "Temporary parking": [
    "getting temporary parking pass",
    "renewing temporary parking pass",
  ],
  "Payments / accounts": [
    "paying rent",
    "discussing account balance",
    "setting up payment plan",
  ],
  "Booked office / workspace": [
    "using conference room 1",
    "using conference room 2",
    "using conference room 3",
  ],
  Packages: [
    "picking up package from office",
    "dropping off package at office",
  ],
};

// Guest of resident
const reasonsResidentGuestsMap = {
  "Social visit": [
    "visiting family",
    "visiting friends",
    "attending small gathering",
    "attending birthday or celebration",
  ],
  "Move / help": [
    "helping with move-in",
    "helping with move-out",
    "dropping off moving supplies",
  ],
  "Support / care": ["providing childcare", "providing elder care"],
  "Personal items": [
    "dropping off personal items",
    "picking up personal items",
  ],
};

// Guest of CHR / company
const reasonsCompanyGuestsMap = {
  "Leasing / tours": [
    "leasing appointment",
    "touring apartment",
    "application follow-up",
  ],
  "Business / meetings": [
    "business meeting",
    "training session",
    "interview with staff",
  ],
  "Events / community": [
    "attending resident event",
    "attending community meeting",
  ],
};

// Vendor (for residents)
const reasonsVendorsMap = {
  "Maintenance / repairs": [
    "scheduled maintenance work",
    "emergency repair",
    "plumbing work",
    "electrical work",
    "hvac service",
  ],
  "Property services": [
    "landscaping or snow removal",
    "cleaning / janitorial service",
    "pest control service",
  ],
  Deliveries: [
    "large item delivery",
    "furniture delivery",
    "appliance delivery",
    "materials delivery",
  ],
  Inspections: [
    "annual inspection",
    "city or state inspection",
    "insurance inspection",
  ],
};

// Vendor for CHR / company
const reasonsCompanyVendorsMap = {
  "Scheduled work": [
    "scheduled facility work",
    "capital project work",
    "project walk-through",
  ],
  "Building systems": [
    "fire alarm service",
    "elevator service",
    "security system service",
  ],
  "Professional services": [
    "consultant walk-through",
    "engineering walkthrough",
  ],
  Inspections: ["annual building inspection", "third-party inspection"],
};

// Future residents
const reasonsFutureResidentMap = {
  "Tours / appointments": [
    "touring apartment",
    "leasing appointment",
    "application follow-up",
  ],
  "Move-in prep": [
    "pre move-in inspection",
    "signing lease documents",
    "dropping off paperwork",
  ],
};

// CHR / property staff (role = "staff")
const reasonsStaffMap = {
  "Leasing / office": [
    "leasing office shift",
    "resident appointments",
    "paperwork and admin work",
  ],
  "Maintenance / field": [
    "maintenance shift",
    "responding to work orders",
    "inspecting building systems",
  ],
  Security: ["lobby or security shift", "patrols and rounds"],
  "Corporate / leadership": [
    "visiting property for meeting",
    "training or site visit",
  ],
  "Using amenity": amenityUseReasons, // same as residents
};

// For the CHR staff Department / Role dropdown
const staffDepartments = [
  "Leasing",
  "Property management",
  "Maintenance",
  "Security",
  "Housekeeping / cleaning",
  "Corporate / regional",
];

async function run() {
  try {
    console.log("Seeding reason maps for properties:", propertyIds.join(", "));

    const writes = propertyIds.map((id) =>
      db.collection("Properties").doc(id).set(
        {
          // Resident
          reasonsResident: reasonsResidentsMap,
          reasonsResidents: reasonsResidentsMap,

          // Resident guest
          reasonsResidentGuest: reasonsResidentGuestsMap,
          reasonsResidentGuests: reasonsResidentGuestsMap,

          // Company guest
          reasonsCompanyGuest: reasonsCompanyGuestsMap,
          reasonsCompanyGuests: reasonsCompanyGuestsMap,

          // Vendors (resident + company)
          reasonsVendor: reasonsVendorsMap,
          reasonsVendors: reasonsVendorsMap,

          reasonsCompanyVendor: reasonsCompanyVendorsMap,
          reasonsCompanyVendors: reasonsCompanyVendorsMap,

          // Future resident
          reasonsFutureResident: reasonsFutureResidentMap,

          // Staff
          reasonsStaff: reasonsStaffMap,

          // New: staff departments
          staffDepartments,

          // delete legacy fields if they exist
          reasonsResident: FieldValue.delete(),
          reasonsResidentGuest: FieldValue.delete(),
          reasonsCompanyGuest: FieldValue.delete(),
          reasonsVendor: FieldValue.delete(),
          reasonsCompanyVendor: FieldValue.delete(),
        },
        { merge: true }
      )
    );

    await Promise.all(writes);

    console.log("✅ Done! Reason maps + staffDepartments seeded.");
  } catch (err) {
    console.error("❌ Error seeding reasons:", err);
  } finally {
    process.exit();
  }
}

run();
