// seedPropertyReasons.cjs
const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

// Initialize Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// Your property IDs
const propertyIds = ["mENmwUR64xvjo09Irrjj", "zAlDDf5xCYOwkgLQh1AG"];

// The 7 arrays you want (you can change text later in Firestore)
const payload = {
  reasonsResident: [
    "Visiting family",
    "Using amenities",
    "Picking up package",
    "Meeting property staff",
  ],
  reasonsResidentGuest: [
    "Visiting a resident",
    "Helping with move-in",
    "Attending small gathering",
  ],
  reasonsCompanyGuest: [
    "Corporate visitor",
    "Business meeting",
    "Training session",
  ],
  reasonsVendor: ["Maintenance work", "Delivery", "Inspection", "Repairs"],
  reasonsCompanyVendor: [
    "Contractor on-site",
    "Scheduled facility work",
    "Security vendor",
  ],
  reasonsFutureResident: [
    "Touring apartment",
    "Leasing appointment",
    "Application follow-up",
  ],
  reasonsStaff: [
    "Leasing team",
    "Property management",
    "Maintenance staff",
    "Security",
  ],
};

async function run() {
  try {
    console.log("Seeding reasons into Properties...");

    const writes = propertyIds.map((id) =>
      db.collection("Properties").doc(id).set(payload, { merge: true })
    );

    await Promise.all(writes);

    console.log("✅ Done! Reasons seeded for all properties.");
  } catch (err) {
    console.error("❌ Error seeding reasons:", err);
  } finally {
    process.exit();
  }
}

run();
