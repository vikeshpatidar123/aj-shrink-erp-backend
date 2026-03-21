// ─── Unit prefixes (2 letters) ────────────────────────────────────────────────
export const UNIT_CODE = {
  Extrusion: "EX",
  Gravure:   "GV",
  Common:    "CM",   // for inventory / shared modules
} as const;

// ─── Module codes (2 letters) ─────────────────────────────────────────────────
export const MODULE_CODE = {
  // Workflow
  Enquiry:              "EQ",
  Estimation:           "ES",
  Order:                "OB",
  JobCard:              "JC",
  WorkOrder:            "WO",
  Production:           "PN",
  Dispatch:             "DS",
  // Inventory
  PurchaseRequisition:  "RQ",
  PurchaseOrder:        "PO",
  PurchaseGRN:          "GN",
  ItemIssue:            "II",
  ItemConsumption:      "IC",
  ReturnToStock:        "RS",
  StockTransfer:        "TR",
  PhysicalVerification: "PV",
} as const;

/**
 * Generates the next code in format: UNIT-MODULE-001/MM/YYYY
 *
 * @param unitCode   e.g. "EX", "GV", "CM"
 * @param moduleCode e.g. "EQ", "OB"
 * @param existing   array of existing codes to determine next series number
 */
export function generateCode(
  unitCode: string,
  moduleCode: string,
  existing: string[]
): string {
  const now    = new Date();
  const month  = String(now.getMonth() + 1).padStart(2, "0");
  const year   = String(now.getFullYear());
  const prefix = `${unitCode}-${moduleCode}-`;
  const suffix = `/${month}/${year}`;

  // Find highest series number already used for this unit+module+month+year
  const maxSeries = existing
    .filter(c => c.startsWith(prefix) && c.endsWith(suffix))
    .reduce((max, c) => {
      const n = parseInt(c.replace(prefix, "").replace(suffix, ""), 10);
      return isNaN(n) ? max : Math.max(max, n);
    }, 0);

  return `${prefix}${String(maxSeries + 1).padStart(3, "0")}${suffix}`;
}
