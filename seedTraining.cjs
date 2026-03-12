// seedTraining.cjs
const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

// ✅ Your real Property IDs
const HVCC_PROPERTY_ID = "mENmwUR64xvjo09Irrjj";
const FRANKLIN_PROPERTY_ID = "zAlDDf5xCYOwkgLQh1AG";

// ------------------------------
// Helpers
// ------------------------------
function slugifyId(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function lower(s) {
  return String(s || "")
    .trim()
    .toLowerCase();
}

// Firestore batch limit is 500 writes
async function commitInChunks(writeOps, chunkSize = 450) {
  for (let i = 0; i < writeOps.length; i += chunkSize) {
    const batch = db.batch();
    const chunk = writeOps.slice(i, i + chunkSize);
    chunk.forEach((op) => op(batch));
    await batch.commit();
  }
}

function titleDoc({ id, label, section, day, order, active = true }) {
  return {
    id,
    label,
    section: section || `day${day}`, // "day1", "day2", ...
    day: day || 1,
    order: order ?? 999,
    active: !!active,
    updatedAt: FieldValue.serverTimestamp(),
  };
}

// ------------------------------
// Training Title Sets (Templates)
// ------------------------------
// Collection: trainingTitleSets
// Docs: "company", HVCC_PROPERTY_ID, FRANKLIN_PROPERTY_ID
// Subcollection: titles
const TITLE_SETS = [
  // ------------------------------
  // COMPANY: Concierge Day 1 (Company-wide)
  // ------------------------------
  {
    setId: "company",
    meta: {
      scope: "company",
      label: "Concierge Training — Company (Day 1)",
      updatedAt: FieldValue.serverTimestamp(),
    },
    titles: [
      // Day 1 — Professional basics
      titleDoc({
        id: "c_d1_greeting_presence",
        label:
          "Greeting & presence: smile, eye contact, welcoming tone, professional body language",
        day: 1,
        order: 10,
      }),
      titleDoc({
        id: "c_d1_dress_code",
        label:
          "Dress code: suit/clean uniform, grooming, name tag, polished appearance",
        day: 1,
        order: 20,
      }),
      titleDoc({
        id: "c_d1_punctuality",
        label:
          "Punctuality: arrive early, ready at shift start, no late handoff",
        day: 1,
        order: 30,
      }),
      titleDoc({
        id: "c_d1_phone_etiquette",
        label:
          "Phone etiquette: answering script, hold/transfer, taking clear messages",
        day: 1,
        order: 40,
      }),
      titleDoc({
        id: "c_d1_confidentiality",
        label:
          "Confidentiality: resident privacy, no sharing personal info, discreet service",
        day: 1,
        order: 50,
      }),
      titleDoc({
        id: "c_d1_conflict_deescalation",
        label:
          "De-escalation basics: calm tone, empathy, boundary setting, escalate when needed",
        day: 1,
        order: 60,
      }),
      titleDoc({
        id: "c_d1_incident_reporting",
        label:
          "Incident reporting: write clear notes, facts only, timestamps, who was notified",
        day: 1,
        order: 70,
      }),
      titleDoc({
        id: "c_d1_safety_awareness",
        label:
          "Safety awareness: doors, unknown persons, suspicious activity, emergency basics",
        day: 1,
        order: 80,
      }),
    ],
  },

  // ------------------------------
  // HVCC: Property-specific titles
  // ------------------------------
  {
    setId: HVCC_PROPERTY_ID,
    meta: {
      scope: "property",
      propertyId: HVCC_PROPERTY_ID,
      label: "HVCC Concierge Training (Day 1–3)",
      updatedAt: FieldValue.serverTimestamp(),
    },
    titles: [
      // Day 1
      titleDoc({
        id: "hvcc_d1_retrieve_keys_process",
        label:
          "Retrieving keys: where stored, sign-out rules, ID check, logging, returns",
        day: 1,
        order: 10,
      }),
      titleDoc({
        id: "hvcc_d1_shiftlog_start_and_review",
        label:
          "Shiftlog start: open shift, review previous shiftlog, check unresolved items",
        day: 1,
        order: 20,
      }),
      titleDoc({
        id: "hvcc_d1_tablet_setup_check",
        label:
          "Tablet setup: power, Wi-Fi, kiosk/app open, test sign-in, ensure device is clean",
        day: 1,
        order: 30,
      }),
      titleDoc({
        id: "hvcc_d1_front_desk_cleanliness",
        label:
          "Desk & vestibule: daily cleaning checklist, trash, wipe surfaces, reset layout",
        day: 1,
        order: 40,
      }),
      titleDoc({
        id: "hvcc_d1_coffee_bevi_basic",
        label:
          "Coffee + Bevi basics: rinse, refill, sanitize area, restock cups/lids, check supplies",
        day: 1,
        order: 50,
      }),

      // Day 2
      titleDoc({
        id: "hvcc_d2_key_special_cases",
        label:
          "Keys: special cases (move-in/move-out, extra keys, guest suite keys, missing keys protocol)",
        day: 2,
        order: 10,
      }),
      titleDoc({
        id: "hvcc_d2_shiftlog_quality",
        label:
          "Shiftlog quality: clear writing, required details, using quick entries, copying logs when needed",
        day: 2,
        order: 20,
      }),
      titleDoc({
        id: "hvcc_d2_coffee_bevi_troubleshooting",
        label:
          "Coffee/Bevi troubleshooting: common issues, who to call, what to document",
        day: 2,
        order: 30,
      }),
      titleDoc({
        id: "hvcc_d2_open_close_routine",
        label:
          "Open/close routine: check front area, lights/music (if any), supplies, end-of-shift reset",
        day: 2,
        order: 40,
      }),

      // Day 3
      titleDoc({
        id: "hvcc_d3_visitor_guest_flow",
        label:
          "Visitor/guest flow: greeting, directing, visitor sign-in rules, escalation scenarios",
        day: 3,
        order: 10,
      }),
      titleDoc({
        id: "hvcc_d3_vendor_flow",
        label:
          "Vendor flow: sign-in, verifying purpose, CHR vendor vs resident vendor, where to send them",
        day: 3,
        order: 20,
      }),
      titleDoc({
        id: "hvcc_d3_tablet_maintenance",
        label:
          "Tablet maintenance: weekly checks, updates, cleaning, reporting device issues",
        day: 3,
        order: 30,
      }),
    ],
  },

  // ------------------------------
  // FRANKLIN: Property-specific titles
  // ------------------------------
  {
    setId: FRANKLIN_PROPERTY_ID,
    meta: {
      scope: "property",
      propertyId: FRANKLIN_PROPERTY_ID,
      label: "Franklin Concierge Training (Day 1–3)",
      updatedAt: FieldValue.serverTimestamp(),
    },
    titles: [
      // Day 1
      titleDoc({
        id: "frank_d1_vestibule_desk_cleaning",
        label:
          "Vestibule + desk cleaning: daily checklist, wipe down, keep lobby presentable",
        day: 1,
        order: 10,
      }),
      titleDoc({
        id: "frank_d1_package_handling_basics",
        label:
          "Package handling basics: receiving, where to place, logging, resident pickup process",
        day: 1,
        order: 20,
      }),
      titleDoc({
        id: "frank_d1_coffee_station_basic",
        label:
          "Coffee station basics: refill, cleanliness, restock supplies, end-of-day reset",
        day: 1,
        order: 30,
      }),
      titleDoc({
        id: "frank_d1_lobby_music_setup",
        label:
          "Lobby music: setting volume, selecting station/playlist, troubleshooting audio",
        day: 1,
        order: 40,
      }),

      // Day 2
      titleDoc({
        id: "frank_d2_package_locations",
        label:
          "Package locations: lockers/package room/mailroom/overflow—when to use each",
        day: 2,
        order: 10,
      }),
      titleDoc({
        id: "frank_d2_delivery_vendor_coordination",
        label:
          "Delivery/vendor coordination: directing couriers, large deliveries, resident/vendor rules",
        day: 2,
        order: 20,
      }),
      titleDoc({
        id: "frank_d2_resident_support",
        label:
          "Resident support: common questions, how to respond, when to escalate to management",
        day: 2,
        order: 30,
      }),

      // Day 3
      titleDoc({
        id: "frank_d3_lobby_presence_standards",
        label:
          "Lobby presence standards: proactive greeting, keeping area tidy, professionalism",
        day: 3,
        order: 10,
      }),
      titleDoc({
        id: "frank_d3_package_issue_protocol",
        label:
          "Package issues protocol: missing/damaged/misdelivered packages—what to document and who to notify",
        day: 3,
        order: 20,
      }),
      titleDoc({
        id: "frank_d3_music_and_events",
        label:
          "Music + events: adjusting music for events, quiet hours, handling resident complaints",
        day: 3,
        order: 30,
      }),
    ],
  },
];

// ------------------------------
// Trainees + Assignments (Progress)
// ------------------------------
// Collection: trainees
// Subcollection: assignments
const TRAINEES = [
  {
    traineeId: "misael-gared",
    doc: {
      name: "Misael Gared",
      nameLower: "misael gared",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    assignments: [
      {
        assignmentId: "company",
        data: {
          assignmentId: "company",
          titleSetId: "company",
          propertyId: null,
          status: "active",
          startedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          checkedTraining: {
            c_d1_greeting_presence: {
              trainerName: "Danielle",
              trainerUid: "seed-demo-uid",
              checkedAt: FieldValue.serverTimestamp(),
            },
            c_d1_dress_code: {
              trainerName: "Danielle",
              trainerUid: "seed-demo-uid",
              checkedAt: FieldValue.serverTimestamp(),
            },
          },
        },
      },
      {
        assignmentId: HVCC_PROPERTY_ID,
        data: {
          assignmentId: HVCC_PROPERTY_ID,
          titleSetId: HVCC_PROPERTY_ID,
          propertyId: HVCC_PROPERTY_ID,
          status: "active",
          startedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          checkedTraining: {
            hvcc_d1_shiftlog_start_and_review: {
              trainerName: "Jamie",
              trainerUid: "seed-demo-uid",
              checkedAt: FieldValue.serverTimestamp(),
            },
            hvcc_d1_tablet_setup_check: {
              trainerName: "Jamie",
              trainerUid: "seed-demo-uid",
              checkedAt: FieldValue.serverTimestamp(),
            },
          },
        },
      },
    ],
  },

  {
    traineeId: "sheena",
    doc: {
      name: "Sheena",
      nameLower: "sheena",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    assignments: [
      {
        assignmentId: "company",
        data: {
          assignmentId: "company",
          titleSetId: "company",
          propertyId: null,
          status: "completed",
          startedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          checkedTraining: {
            c_d1_greeting_presence: {
              trainerName: "Matt",
              trainerUid: "seed-demo-uid",
              checkedAt: FieldValue.serverTimestamp(),
            },
            c_d1_dress_code: {
              trainerName: "Matt",
              trainerUid: "seed-demo-uid",
              checkedAt: FieldValue.serverTimestamp(),
            },
            c_d1_punctuality: {
              trainerName: "Matt",
              trainerUid: "seed-demo-uid",
              checkedAt: FieldValue.serverTimestamp(),
            },
            c_d1_phone_etiquette: {
              trainerName: "Matt",
              trainerUid: "seed-demo-uid",
              checkedAt: FieldValue.serverTimestamp(),
            },
          },
        },
      },
      {
        assignmentId: FRANKLIN_PROPERTY_ID,
        data: {
          assignmentId: FRANKLIN_PROPERTY_ID,
          titleSetId: FRANKLIN_PROPERTY_ID,
          propertyId: FRANKLIN_PROPERTY_ID,
          status: "active",
          startedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          checkedTraining: {
            frank_d1_vestibule_desk_cleaning: {
              trainerName: "Kevin",
              trainerUid: "seed-demo-uid",
              checkedAt: FieldValue.serverTimestamp(),
            },
            frank_d1_lobby_music_setup: {
              trainerName: "Kevin",
              trainerUid: "seed-demo-uid",
              checkedAt: FieldValue.serverTimestamp(),
            },
          },
        },
      },
    ],
  },

  {
    traineeId: "khalif",
    doc: {
      name: "Khalif",
      nameLower: "khalif",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    assignments: [
      {
        assignmentId: HVCC_PROPERTY_ID,
        data: {
          assignmentId: HVCC_PROPERTY_ID,
          titleSetId: HVCC_PROPERTY_ID,
          propertyId: HVCC_PROPERTY_ID,
          status: "active",
          startedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          checkedTraining: {
            hvcc_d1_front_desk_cleanliness: {
              trainerName: "Danielle",
              trainerUid: "seed-demo-uid",
              checkedAt: FieldValue.serverTimestamp(),
            },
          },
        },
      },
    ],
  },
];

// ------------------------------
// Seed Functions
// ------------------------------
async function seedTitleSets() {
  const ops = [];

  for (const set of TITLE_SETS) {
    const setRef = db.collection("trainingTitleSets").doc(set.setId);

    // Upsert set meta
    ops.push((batch) => batch.set(setRef, set.meta, { merge: true }));

    // Upsert titles as docs with deterministic IDs
    for (const t of set.titles) {
      const titleRef = setRef.collection("titles").doc(t.id);
      ops.push((batch) => batch.set(titleRef, t, { merge: true }));
    }
  }

  await commitInChunks(ops);
  console.log("✅ Seeded trainingTitleSets + titles");
}

async function seedTrainees() {
  const ops = [];

  for (const tr of TRAINEES) {
    const traineeRef = db.collection("trainees").doc(tr.traineeId);

    ops.push((batch) =>
      batch.set(
        traineeRef,
        { ...tr.doc, updatedAt: FieldValue.serverTimestamp() },
        { merge: true }
      )
    );

    for (const a of tr.assignments || []) {
      const aRef = traineeRef.collection("assignments").doc(a.assignmentId);
      ops.push((batch) => batch.set(aRef, a.data, { merge: true }));
    }
  }

  await commitInChunks(ops);
  console.log("✅ Seeded trainees + assignments");
}

async function run() {
  try {
    console.log("Seeding training data...");
    await seedTitleSets();
    await seedTrainees();
    console.log("✅ Done!");
  } catch (err) {
    console.error("❌ Error seeding training data:", err);
  } finally {
    process.exit();
  }
}

run();
