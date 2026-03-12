// src/features/shiftlogs/shiftLogApi.js
import { db } from "../../lib/firebase";
import {
  arrayRemove,
  arrayUnion,
  deleteDoc,
  deleteField,
  doc,
  serverTimestamp,
  writeBatch,
  increment,
  Timestamp, // ✅ add
} from "firebase/firestore";

/* -----------------------------
   Helpers
------------------------------ */

function unitDocId(unitLabel) {
  return encodeURIComponent(String(unitLabel || "").trim());
}

const FLAG_KEYS = [
  "incident",
  "moveInOut",
  "highlightPropertyManager",
  "highlightMaintenance",
  "highlightConciergeTeam",
];

function isFlaggedEntry(e) {
  return !!(
    e?.incident ||
    e?.moveInOut ||
    e?.highlightPropertyManager ||
    e?.highlightMaintenance ||
    e?.highlightConciergeTeam
  );
}

// Adds unit counts patches for flags.* and flags.anyFlag
function addFlagCountsPatch(patch, entry, delta) {
  patch.counts ??= {};
  patch.counts.flags ??= {};

  for (const k of FLAG_KEYS) {
    if (entry?.[k]) patch.counts.flags[k] = increment(delta);
  }

  if (isFlaggedEntry(entry)) {
    patch.counts.flags.anyFlag = increment(delta);
  }
}

// Unit label resolver used everywhere (index + counters).
// If unitLabel missing, try to build from resident fields.
function unitLabelForIndex(e) {
  const label = String(e?.unitLabel || "").trim();
  if (label) return label;

  const num = String(e?.unitOrStreetNumber || "").trim();
  const street = String(e?.streetOrBuildingName || "").trim();
  return [num, street].filter(Boolean).join(" ").trim();
}

/**
 * Counts apply ONLY when:
 * - roleId === "resident"
 * - countThisReason === true
 * - countKey exists
 * - unit label exists (resolved via unitLabelForIndex)
 */
function shouldCountReason(entry) {
  const unitLabel = unitLabelForIndex(entry);
  const countKey = String(entry?.countKey || "").trim();
  return (
    entry?.roleId === "resident" &&
    entry?.countThisReason === true &&
    !!countKey &&
    !!unitLabel
  );
}

// Identity used for counters: "unitLabel||countKey"
function countIdentity(entry) {
  if (!shouldCountReason(entry)) return null;
  return `${unitLabelForIndex(entry)}||${String(entry.countKey).trim()}`;
}

// Small helper: apply a flag delta to an array field (one update object)
function applyFlagDelta(patch, fieldName, entryId, prevVal, nextVal) {
  const was = !!prevVal;
  const now = !!nextVal;
  if (was === now) return;
  patch[fieldName] = now ? arrayUnion(entryId) : arrayRemove(entryId);
}

/* -----------------------------
   API
------------------------------ */

export async function addShiftEntry({ propertyId, shiftLogId, entry }) {
  const entryId =
    (globalThis.crypto?.randomUUID && globalThis.crypto.randomUUID()) ||
    `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const shiftRef = doc(db, "Properties", propertyId, "shiftLogs", shiftLogId);
  const batch = writeBatch(db);

  // ✅ occurredAt should exist immediately (no serverTimestamp null issue)
  const occurredAt =
    entry?.occurredAt && typeof entry.occurredAt === "object"
      ? entry.occurredAt
      : Timestamp.now();

  // 1) Add entry into shift log (map) + flag arrays
  const payload = {
    [`entries.${entryId}`]: {
      ...entry,
      id: entryId,
      createdAt: serverTimestamp(),
      occurredAt, // ✅ NEW (used for ordering + later editing)
    },
  };

  if (entry?.incident) payload.incidentEntryIds = arrayUnion(entryId);
  if (entry?.moveInOut) payload.moveInOutEntryIds = arrayUnion(entryId);
  if (entry?.highlightPropertyManager)
    payload.highlightPropertyManagerEntryIds = arrayUnion(entryId);
  if (entry?.highlightMaintenance)
    payload.highlightMaintenanceEntryIds = arrayUnion(entryId);
  if (entry?.highlightConciergeTeam)
    payload.highlightConciergeTeamEntryIds = arrayUnion(entryId);

  batch.update(shiftRef, payload);

  // 2) Unit index doc + optional counting (ONE unit write)
  const unitLabel = unitLabelForIndex(entry);
  const countKey = String(entry?.countKey || "").trim();

  const shouldCount =
    entry?.roleId === "resident" &&
    entry?.countThisReason === true &&
    !!countKey &&
    !!unitLabel;

  if (unitLabel) {
    const uId = unitDocId(unitLabel);

    const unitRef = doc(db, "Properties", propertyId, "units", uId);
    const unitEntryRef = doc(
      db,
      "Properties",
      propertyId,
      "units",
      uId,
      "entries",
      entryId
    );

    const unitPatch = {
      unitLabel,
      updatedAt: serverTimestamp(),
    };

    if (shouldCount) {
      unitPatch.counts ??= {};
      unitPatch.counts[countKey] = increment(1);
    }

    addFlagCountsPatch(unitPatch, entry, +1);
    batch.set(unitRef, unitPatch, { merge: true });

    batch.set(
      unitEntryRef,
      {
        entryId,
        shiftLogId: shiftLogId || null,
        unitLabel,
        sentenceText: entry.sentenceText || entry.sentence || "",
        sentenceHtml: entry.sentenceHtml || null,
        additionalNote: entry.additionalNote || null,
        flags: {
          incident: !!entry.incident,
          moveInOut: !!entry.moveInOut,
          highlightPropertyManager: !!entry.highlightPropertyManager,
          highlightMaintenance: !!entry.highlightMaintenance,
          highlightConciergeTeam: !!entry.highlightConciergeTeam,
        },
        isFlagged: isFlaggedEntry(entry),

        occurredAt, // ✅ store same value
        updatedAt: serverTimestamp(),
        createdBy: entry.createdBy || null,

        countThisReason: !!entry.countThisReason,
        countKey: entry.countKey || null,
        roleId: entry.roleId || null,
      },
      { merge: true }
    );
  }

  await batch.commit();
  return entryId;
}

export async function deleteShiftEntry({
  propertyId,
  shiftLogId,
  entryId,
  entry,
}) {
  const shiftRef = doc(db, "Properties", propertyId, "shiftLogs", shiftLogId);
  const batch = writeBatch(db);

  // 1) delete entry + remove from all flag arrays
  batch.update(shiftRef, {
    [`entries.${entryId}`]: deleteField(),

    incidentEntryIds: arrayRemove(entryId),
    moveInOutEntryIds: arrayRemove(entryId),

    highlightPropertyManagerEntryIds: arrayRemove(entryId),
    highlightMaintenanceEntryIds: arrayRemove(entryId),
    highlightConciergeTeamEntryIds: arrayRemove(entryId),
  });

  // 2) delete unit index doc + decrement counters (ONE unit write)
  const unitLabel = unitLabelForIndex(entry);
  const countKey = String(entry?.countKey || "").trim();

  const shouldDecrement =
    entry?.roleId === "resident" &&
    entry?.countThisReason === true &&
    !!countKey &&
    !!unitLabel;

  if (unitLabel) {
    const uId = unitDocId(unitLabel);

    // delete unit->entries index doc
    batch.delete(
      doc(db, "Properties", propertyId, "units", uId, "entries", entryId)
    );

    // ✅ one unit patch (reason decrement if applicable + flag decrements always)
    const unitPatch = {
      unitLabel,
      updatedAt: serverTimestamp(),
    };

    if (shouldDecrement) {
      unitPatch.counts ??= {};
      unitPatch.counts[countKey] = increment(-1);
    }

    addFlagCountsPatch(unitPatch, entry, -1);
    batch.set(doc(db, "Properties", propertyId, "units", uId), unitPatch, {
      merge: true,
    });
  }

  await batch.commit();
}

function mergeUnitPatch(base, add) {
  const out = { ...(base || {}), ...(add || {}) };

  if (base?.counts || add?.counts) {
    out.counts = { ...(base?.counts || {}), ...(add?.counts || {}) };

    if (base?.counts?.flags || add?.counts?.flags) {
      out.counts.flags = {
        ...(base?.counts?.flags || {}),
        ...(add?.counts?.flags || {}),
      };
    }
  }
  return out;
}

/**
 * ✅ FIXED:
 * - Only ONE write to shiftRef per batch (Firestore requirement).
 * - Flag arrays updated using deltas between prevEntry and nextEntry.
 * - Reason counters changed ONLY if identity changes.
 * - Unit flag counters updated:
 *    - Same unit => apply per-flag deltas
 *    - Unit changed => remove prev flags from prev unit, add next flags to next unit
 * - Unit index doc moved if unit label changes.
 *
 * ✅ NEW:
 * - occurredAt is preserved unless changed in nextEntry
 * - createdAt is preserved always
 * - index doc stores occurredAt too
 */
export async function updateShiftEntry({
  propertyId,
  shiftLogId,
  entryId,
  nextEntry,
  prevEntry,
}) {
  const shiftRef = doc(db, "Properties", propertyId, "shiftLogs", shiftLogId);
  const batch = writeBatch(db);

  // ✅ preserve createdAt forever, but allow occurredAt to change
  const occurredAtToSave =
    nextEntry?.occurredAt ||
    prevEntry?.occurredAt ||
    prevEntry?.createdAt ||
    null;

  // --- 1) Single patch for shift log doc (ONE update call) ---
  const shiftPatch = {
    [`entries.${entryId}`]: {
      ...nextEntry,
      id: entryId,
      createdAt: prevEntry?.createdAt || nextEntry?.createdAt || null,
      occurredAt: occurredAtToSave,
      updatedAt: serverTimestamp(),
    },
  };

  // --- 2) Flag array deltas (no multiple batch.update on shiftRef) ---
  applyFlagDelta(
    shiftPatch,
    "incidentEntryIds",
    entryId,
    prevEntry?.incident,
    nextEntry?.incident
  );
  applyFlagDelta(
    shiftPatch,
    "moveInOutEntryIds",
    entryId,
    prevEntry?.moveInOut,
    nextEntry?.moveInOut
  );
  applyFlagDelta(
    shiftPatch,
    "highlightPropertyManagerEntryIds",
    entryId,
    prevEntry?.highlightPropertyManager,
    nextEntry?.highlightPropertyManager
  );
  applyFlagDelta(
    shiftPatch,
    "highlightMaintenanceEntryIds",
    entryId,
    prevEntry?.highlightMaintenance,
    nextEntry?.highlightMaintenance
  );
  applyFlagDelta(
    shiftPatch,
    "highlightConciergeTeamEntryIds",
    entryId,
    prevEntry?.highlightConciergeTeam,
    nextEntry?.highlightConciergeTeam
  );

  batch.update(shiftRef, shiftPatch);

  // --- 3) Reason counters: only if identity changed ---
  const prevId = countIdentity(prevEntry);
  const nextId = countIdentity(nextEntry);

  const unitPatches = new Map(); // unitLabel -> patchObject

  const addUnitPatch = (unitLabel, patch) => {
    if (!unitLabel) return;
    const cur = unitPatches.get(unitLabel) || {};
    unitPatches.set(unitLabel, mergeUnitPatch(cur, patch));
  };

  if (prevId && prevId !== nextId) {
    const [u, k] = prevId.split("||");
    const p = { unitLabel: u, updatedAt: serverTimestamp(), counts: {} };
    p.counts[k] = increment(-1);
    addUnitPatch(u, p);
  }

  if (nextId && prevId !== nextId) {
    const [u, k] = nextId.split("||");
    const p = { unitLabel: u, updatedAt: serverTimestamp(), counts: {} };
    p.counts[k] = increment(1);
    addUnitPatch(u, p);
  }

  // --- 4) Unit flag counters + index doc move/update ---
  const prevUnitLabel = unitLabelForIndex(prevEntry);
  const nextUnitLabel = unitLabelForIndex(nextEntry);

  const addFlagDeltasSameUnit = (unitLabel, prevE, nextE) => {
    if (!unitLabel) return;

    const patch = {
      unitLabel,
      updatedAt: serverTimestamp(),
      counts: { flags: {} },
    };

    for (const k of FLAG_KEYS) {
      const was = !!prevE?.[k];
      const now = !!nextE?.[k];
      if (was === now) continue;

      patch.counts.flags[k] = increment(now ? +1 : -1);
    }

    const wasAny = isFlaggedEntry(prevE);
    const nowAny = isFlaggedEntry(nextE);
    if (wasAny !== nowAny) {
      patch.counts.flags.anyFlag = increment(nowAny ? +1 : -1);
    }

    addUnitPatch(unitLabel, patch);
  };

  if (prevUnitLabel && prevUnitLabel !== nextUnitLabel) {
    // delete old index doc
    batch.delete(
      doc(
        db,
        "Properties",
        propertyId,
        "units",
        unitDocId(prevUnitLabel),
        "entries",
        entryId
      )
    );

    // remove prev flags from prev unit
    const prevFlagsPatch = {
      unitLabel: prevUnitLabel,
      updatedAt: serverTimestamp(),
    };
    addFlagCountsPatch(prevFlagsPatch, prevEntry, -1);
    addUnitPatch(prevUnitLabel, prevFlagsPatch);
  }

  if (nextUnitLabel) {
    const nextUid = unitDocId(nextUnitLabel);

    // ensure unit doc exists + updatedAt
    addUnitPatch(nextUnitLabel, {
      unitLabel: nextUnitLabel,
      updatedAt: serverTimestamp(),
    });

    // ✅ write/update index doc (and include occurredAt!)
    batch.set(
      doc(db, "Properties", propertyId, "units", nextUid, "entries", entryId),
      {
        entryId,
        shiftLogId: shiftLogId || null,
        unitLabel: nextUnitLabel,
        sentenceText: nextEntry.sentenceText || nextEntry.sentence || "",
        sentenceHtml: nextEntry.sentenceHtml || null,
        additionalNote: nextEntry.additionalNote || null,
        flags: {
          incident: !!nextEntry.incident,
          moveInOut: !!nextEntry.moveInOut,
          highlightPropertyManager: !!nextEntry.highlightPropertyManager,
          highlightMaintenance: !!nextEntry.highlightMaintenance,
          highlightConciergeTeam: !!nextEntry.highlightConciergeTeam,
        },
        isFlagged: isFlaggedEntry(nextEntry),

        // ✅ NEW
        occurredAt: occurredAtToSave,

        updatedAt: serverTimestamp(),
        createdBy: nextEntry.createdBy || null,

        countThisReason: !!nextEntry.countThisReason,
        countKey: nextEntry.countKey || null,
        roleId: nextEntry.roleId || null,
      },
      { merge: true }
    );
  }

  if (prevUnitLabel && prevUnitLabel === nextUnitLabel) {
    addFlagDeltasSameUnit(nextUnitLabel, prevEntry, nextEntry);
  } else {
    if (nextUnitLabel) {
      const nextFlagsPatch = {
        unitLabel: nextUnitLabel,
        updatedAt: serverTimestamp(),
      };
      addFlagCountsPatch(nextFlagsPatch, nextEntry, +1);
      addUnitPatch(nextUnitLabel, nextFlagsPatch);
    }
  }

  // --- 5) Apply unit patches (max 1 write per unit doc) ---
  for (const [uLabel, patch] of unitPatches.entries()) {
    batch.set(
      doc(db, "Properties", propertyId, "units", unitDocId(uLabel)),
      patch,
      { merge: true }
    );
  }

  await batch.commit();
}

export async function deleteShiftLogAndRollbackCounts({
  propertyId,
  shiftLogId,
  shiftLog,
}) {
  const shiftRef = doc(db, "Properties", propertyId, "shiftLogs", shiftLogId);
  const entries = shiftLog?.entries || {};
  const entryPairs = Object.entries(entries); // [entryId, entry]

  // -----------------------------
  // 1) Aggregate decrements per unit for:
  //    - counts.<reasonKey>
  //    - counts.flags.*
  // -----------------------------
  // perUnitAgg: unitLabel -> { reasons: Map, flags: Map, anyFlag: n }
  const perUnitAgg = new Map();

  const ensureAgg = (unitLabel) => {
    if (!perUnitAgg.has(unitLabel)) {
      perUnitAgg.set(unitLabel, {
        reasons: new Map(),
        flags: new Map(),
        anyFlag: 0,
      });
    }
    return perUnitAgg.get(unitLabel);
  };

  for (const e of Object.values(entries)) {
    const unitLabel = unitLabelForIndex(e);
    if (!unitLabel) continue;

    const agg = ensureAgg(unitLabel);

    // reason counts (only when shouldCountReason true)
    const id = countIdentity(e); // "unitLabel||countKey" or null
    if (id) {
      const [, countKey] = id.split("||");
      if (countKey)
        agg.reasons.set(countKey, (agg.reasons.get(countKey) || 0) + 1);
    }

    // flags counts (always when flagged fields are true)
    for (const k of FLAG_KEYS) {
      if (e?.[k]) agg.flags.set(k, (agg.flags.get(k) || 0) + 1);
    }
    if (isFlaggedEntry(e)) agg.anyFlag += 1;
  }

  // unitPatches: unitLabel -> patchObject (counts.* increments accumulated)
  const unitPatches = new Map();
  for (const [unitLabel, agg] of perUnitAgg.entries()) {
    const patch = {
      unitLabel,
      updatedAt: serverTimestamp(),
      counts: { flags: {} },
    };

    // reasons
    for (const [countKey, n] of agg.reasons.entries()) {
      patch.counts[countKey] = increment(-n);
    }

    // flags
    for (const [flagKey, n] of agg.flags.entries()) {
      patch.counts.flags[flagKey] = increment(-n);
    }

    if (agg.anyFlag) {
      patch.counts.flags.anyFlag = increment(-agg.anyFlag);
    }

    unitPatches.set(unitLabel, patch);
  }

  // -----------------------------
  // 2) Helpers for chunk deletes
  // -----------------------------
  const deleteIndexDocsInChunks = async () => {
    const CHUNK = 450;
    for (let i = 0; i < entryPairs.length; i += CHUNK) {
      const batch = writeBatch(db);
      const slice = entryPairs.slice(i, i + CHUNK);

      for (const [entryId, e] of slice) {
        const unitLabel = unitLabelForIndex(e);
        if (!unitLabel) continue;

        batch.delete(
          doc(
            db,
            "Properties",
            propertyId,
            "units",
            unitDocId(unitLabel),
            "entries",
            entryId
          )
        );
      }

      await batch.commit();
    }
  };

  const applyUnitPatchesInChunks = async () => {
    const unitPatchArr = Array.from(unitPatches.entries()); // [unitLabel, patch]
    const CHUNK = 450;

    for (let i = 0; i < unitPatchArr.length; i += CHUNK) {
      const batch = writeBatch(db);
      const slice = unitPatchArr.slice(i, i + CHUNK);

      for (const [unitLabel, patch] of slice) {
        batch.set(
          doc(db, "Properties", propertyId, "units", unitDocId(unitLabel)),
          patch,
          { merge: true }
        );
      }

      await batch.commit();
    }
  };

  // -----------------------------
  // 3) Attempt atomic path (single batch) if under 450 ops
  // -----------------------------
  const ops = 1 + entryPairs.length + unitPatches.size;

  if (ops <= 450) {
    const batch = writeBatch(db);

    // unit doc patches (ONE write per unit doc)
    for (const [unitLabel, patch] of unitPatches.entries()) {
      batch.set(
        doc(db, "Properties", propertyId, "units", unitDocId(unitLabel)),
        patch,
        { merge: true }
      );
    }

    // index deletes
    for (const [entryId, e] of entryPairs) {
      const unitLabel = unitLabelForIndex(e);
      if (!unitLabel) continue;

      batch.delete(
        doc(
          db,
          "Properties",
          propertyId,
          "units",
          unitDocId(unitLabel),
          "entries",
          entryId
        )
      );
    }

    // delete shift log
    batch.delete(shiftRef);

    await batch.commit();
    return;
  }

  // -----------------------------
  // 4) Large path: do it in steps
  // -----------------------------
  await deleteDoc(shiftRef);

  // delete index docs
  await deleteIndexDocsInChunks();

  // apply count decrements (per unit, per key)
  await applyUnitPatchesInChunks();
}
