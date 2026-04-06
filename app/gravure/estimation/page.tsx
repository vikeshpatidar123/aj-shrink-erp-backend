"use client";
import { useState, useMemo } from "react";
import {
  ChevronRight, ChevronLeft, Plus, X, Save, FileText, Settings,
  Trash2, Edit, Search, Eye, Filter, Download, MoreHorizontal, Check,
  Calculator, Pencil, ArrowRight, RefreshCw, Wrench
} from "lucide-react";
import {
  gravureEstimations as initData, customers, items, machines, processMasters,
  GravureEstimation, GravureEstimationMaterial, GravureEstimationProcess,
  SecondaryLayer, DryWeightRow, PlyConsumableItem,
  CATEGORY_GROUP_SUBGROUP,
  tools as allTools, toolInventory,
} from "@/data/dummyData";
import { useCategories }     from "@/context/CategoriesContext";
import { useEnquiries }      from "@/context/EnquiryContext";
import { useProductCatalog } from "@/context/ProductCatalogContext";
import { generateCode, UNIT_CODE, MODULE_CODE } from "@/lib/generateCode";
import { DimensionDiagram, DimensionInputPanel, DimValues, CONTENT_TYPE_CONFIG } from "@/components/gravure/DimensionDiagram";
import { DataTable, Column } from "@/components/tables/DataTable";
import { statusBadge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Input, Select, Textarea } from "@/components/ui/Input";

// ─── Master-filtered lists ────────────────────────────────────
const FILM_ITEMS     = items.filter(i => i.group === "Film"     && i.active);
const INK_ITEMS      = items.filter(i => i.group === "Ink"      && i.active);
const SOLVENT_ITEMS  = items.filter(i => i.group === "Solvent"  && i.active);
const ADHESIVE_ITEMS = items.filter(i => i.group === "Adhesive" && i.active);
const HARDNER_ITEMS  = items.filter(i => i.group === "Hardner"  && i.active);
const ALL_MAT_ITEMS  = [...FILM_ITEMS, ...INK_ITEMS, ...SOLVENT_ITEMS, ...ADHESIVE_ITEMS, ...HARDNER_ITEMS];

const PRINT_MACHINES  = machines.filter(m => m.department === "Printing");

const ROTO_PROCESSES  = processMasters.filter(p => p.module === "Rotogravure");

// ─── Tool inventory helpers ────────────────────────────────
const AVAILABLE_TOOL_IDS = new Set(
  toolInventory.filter(ti => ti.status === "Available").map(ti => ti.toolId)
);
const SLEEVE_TOOLS = allTools
  .filter(t => t.toolType === "Sleeve" && AVAILABLE_TOOL_IDS.has(t.id))
  .sort((a, b) => parseFloat(a.printWidth) - parseFloat(b.printWidth));
const CYLINDER_TOOLS = allTools
  .filter(t => t.toolType === "Cylinder" && AVAILABLE_TOOL_IDS.has(t.id))
  .sort((a, b) => parseFloat(a.printWidth) - parseFloat(b.printWidth));

// ─── Blank form ───────────────────────────────────────────────
const blank: Omit<GravureEstimation, "id" | "estimationNo"> = {
  date: new Date().toISOString().slice(0, 10),
  categoryId: "", categoryName: "", content: "",
  enquiryId: "", enquiryNo: "",
  customerId: "", customerName: "",
  jobName: "",
  jobWidth: 0, jobHeight: 0, ups: 0,
  trimmingSize: 0, widthShrinkage: 0,
  actualWidth: 0, actualHeight: 0,
  substrateItemId: "", substrateName: "",
  width: 0, noOfColors: 6, frontColors: 4, backColors: 2,
  printType: "Surface Print",
  quantity: 0, quantities: [], unit: "Kg",
  machineId: "", machineName: "",
  cylinderCostPerColor: 3500,
  cylinderRatePerSqInch: 2.5,
  sleeveWidth: 0,
  repeatLength: 0,
  wastagePct: 1,
  setupTime: 0,
  machineCostPerHour: 1350,
  minimumOrderValue: 0,
  sellingPrice: 0,
  materials: [],
  processes: [],
  overheadPct: 12, profitPct: 15,
  labourCost: 0, transportationCost: 0, interestCost: 0,
  materialCost: 0, processCost: 0, cylinderCost: 0,
  setupCost: 0,
  overheadAmt: 0, profitAmt: 0,
  totalAmount: 0, perMeterRate: 0, marginPct: 0,
  contribution: 0, breakEvenQty: 0,
  secondaryLayers: [],
  dryWeightRows: [],
  dryWeightTotal: 0,
  status: "Draft",
  remarks: "",
  salesPerson: "",
  salesType: "Local",
  concernPerson: "",
};

const STATUS_COLORS: Record<string, string> = {
  Draft:    "bg-gray-100 text-gray-600 border-gray-200",
  Approved: "bg-green-50 text-green-700 border-green-200",
  Sent:     "bg-blue-50 text-blue-700 border-blue-200",
  Accepted: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Rejected: "bg-red-50 text-red-600 border-red-200",
};

const GROUP_COLORS: Record<string, string> = {
  Film:     "bg-indigo-50 text-indigo-700 border-indigo-200",
  Ink:      "bg-blue-50  text-blue-700  border-blue-200",
  Adhesive: "bg-orange-50 text-orange-700 border-orange-200",
  Solvent:  "bg-purple-50 text-purple-700 border-purple-200",
  Hardner:  "bg-pink-50  text-pink-700  border-pink-200",
};

// ─── Auto qty for a process based on its chargeUnit ──────────
function autoProcessQty(chargeUnit: string, quantity: number, areaM2: number, noOfColors: number) {
  if (chargeUnit === "m²")       return areaM2;
  if (chargeUnit === "m")        return quantity;
  if (chargeUnit === "Cylinder") return noOfColors;
  if (chargeUnit === "1000 Pcs") return quantity / 1000;
  if (chargeUnit === "Job")      return 1;
  return 0;
}

// ─── Cost calculator ──────────────────────────────────────────
function calcCosts(form: typeof blank) {
  const areaM2 = form.quantity * (form.jobWidth / 1000);

  // 1. Material cost: film + consumables (with ink coverage logic)
  let plyMaterialCost = 0;
  form.secondaryLayers.forEach(l => {
    // Film substrate
    if (l.gsm > 0) {
      const filmRate = l.filmRate ?? parseFloat(FILM_ITEMS.find(i => i.subGroup === l.itemSubGroup)?.estimationRate || "0");
      if (filmRate > 0) plyMaterialCost += (l.gsm * areaM2 / 1000) * filmRate;
    }
    // Consumable items — apply coverage % for all consumables
    l.consumableItems.forEach(ci => {
      if (ci.gsm > 0 && ci.rate > 0) {
        const effectiveGsm = (ci.coveragePct ?? 100) < 100
          ? ci.gsm * ((ci.coveragePct ?? 100) / 100)
          : ci.gsm;
        plyMaterialCost += (effectiveGsm * areaM2 / 1000) * ci.rate;
      }
    });
  });
  const manualMatCost = form.materials.reduce((s, m) => s + m.amount, 0);
  const materialCost  = parseFloat((plyMaterialCost + manualMatCost).toFixed(2));

  // 2. Process cost: rate × qty + setupCharge
  const processCost = parseFloat(
    form.processes.reduce((s, p) => {
      const qty = p.qty > 0 ? p.qty : autoProcessQty(p.chargeUnit, form.quantity, areaM2, form.noOfColors);
      return s + (p.rate * qty + p.setupCharge);
    }, 0).toFixed(2)
  );

  // 3. Cylinder — always full cost (quotation assumes fresh production)
  const cylinderCost = form.cylinderCostPerColor * form.noOfColors;

  // 4. Machine setup cost
  const setupCost = form.setupTime > 0 && form.machineCostPerHour > 0
    ? parseFloat(((form.setupTime / 60) * form.machineCostPerHour).toFixed(2))
    : 0;

  const labourCost       = form.labourCost       || 0;
  const transportationCost = form.transportationCost || 0;
  const interestCost     = form.interestCost     || 0;

  const sub         = materialCost + processCost + cylinderCost + setupCost + labourCost + transportationCost + interestCost;
  const overheadAmt = parseFloat(((sub * form.overheadPct) / 100).toFixed(2));
  const profitBase  = sub + overheadAmt;
  const profitAmt   = parseFloat(((profitBase * form.profitPct) / 100).toFixed(2));
  let   totalAmount = parseFloat((profitBase + profitAmt).toFixed(2));

  // 5. Minimum order value floor
  if (form.minimumOrderValue > 0 && totalAmount < form.minimumOrderValue)
    totalAmount = form.minimumOrderValue;

  const perMeterRate = form.quantity > 0 ? parseFloat((totalAmount / form.quantity).toFixed(4)) : 0;
  const marginPct    = totalAmount > 0 ? parseFloat(((profitAmt / totalAmount) * 100).toFixed(1)) : 0;

  // 6. Contribution & break-even
  const variableCost   = form.quantity > 0 ? parseFloat(((materialCost + processCost) / form.quantity).toFixed(4)) : 0;
  const sellingPriceEff = form.sellingPrice > 0 ? form.sellingPrice : perMeterRate;
  const contribution   = parseFloat((sellingPriceEff - variableCost).toFixed(4));
  const fixedCost      = cylinderCost + setupCost + overheadAmt + labourCost + transportationCost + interestCost;
  const breakEvenQty   = contribution > 0 ? Math.ceil(fixedCost / contribution) : 0;

  return { materialCost, processCost, cylinderCost, setupCost, labourCost, transportationCost, interestCost, overheadAmt, profitAmt, totalAmount, perMeterRate, marginPct, contribution, breakEvenQty };
}

// ─── Detailed breakdown (for Tab 3 display) ──────────────────
type MatLine  = { plyNo: number; plyType: string; name: string; group: string; gsm: number; kg: number; rate: number; amount: number };
type ProcLine = { name: string; chargeUnit: string; qty: number; rate: number; setupCharge: number; amount: number };

function getCostBreakdown(form: typeof blank): { matLines: MatLine[]; procLines: ProcLine[]; areaM2: number } {
  const areaM2   = parseFloat((form.quantity * (form.jobWidth / 1000)).toFixed(2));
  const matLines: MatLine[]   = [];
  const procLines: ProcLine[] = [];

  form.secondaryLayers.forEach((l, idx) => {
    // Film
    if (l.gsm > 0) {
      const filmItem = FILM_ITEMS.find(i => i.subGroup === l.itemSubGroup);
      const rate = l.filmRate ?? parseFloat(filmItem?.estimationRate || "0");
      const kg       = parseFloat((l.gsm * areaM2 / 1000).toFixed(3));
      matLines.push({ plyNo: idx + 1, plyType: l.plyType || "Film", name: l.itemSubGroup || "Film Substrate", group: "Film", gsm: l.gsm, kg, rate, amount: parseFloat((kg * rate).toFixed(2)) });
    }
    // Consumables — apply coverage % for all consumables
    l.consumableItems.forEach(ci => {
      const effectiveGsm = (ci.coveragePct ?? 100) < 100
        ? parseFloat((ci.gsm * ((ci.coveragePct ?? 100) / 100)).toFixed(3))
        : ci.gsm;
      const kg     = parseFloat((effectiveGsm * areaM2 / 1000).toFixed(3));
      const amount = parseFloat((kg * ci.rate).toFixed(2));
      const label  = (ci.coveragePct ?? 100) < 100
        ? `${ci.itemName || ci.fieldDisplayName} (${ci.coveragePct}% cov.)`
        : (ci.itemName || ci.fieldDisplayName);
      matLines.push({ plyNo: idx + 1, plyType: l.plyType || "", name: label, group: ci.itemGroup, gsm: effectiveGsm, kg, rate: ci.rate, amount });
    });
  });

  // Manual extra materials
  form.materials.forEach(m => {
    matLines.push({ plyNo: 0, plyType: "Extra", name: m.itemName, group: m.group, gsm: 0, kg: m.qty, rate: m.rate, amount: m.amount });
  });

  // Processes
  form.processes.forEach(p => {
    const qty    = p.qty > 0 ? p.qty : parseFloat(autoProcessQty(p.chargeUnit, form.quantity, areaM2, form.noOfColors).toFixed(2));
    const amount = parseFloat((p.rate * qty + p.setupCharge).toFixed(2));
    procLines.push({ name: p.processName || "—", chargeUnit: p.chargeUnit, qty, rate: p.rate, setupCharge: p.setupCharge, amount });
  });

  return { matLines, procLines, areaM2 };
}

// ─── Section header ───────────────────────────────────────────
function SectionHeader({ label }: { label: string }) {
  return (
    <p className="text-xs font-bold text-purple-700 uppercase tracking-widest border-b border-gray-100 pb-2 mb-3">{label}</p>
  );
}

// Find distinct subGroups from FILM_ITEMS along with their density and available thicknesses
const FILM_SUBGROUPS = Array.from(
  new Map(
    FILM_ITEMS.filter(i => i.subGroup).map(i => [i.subGroup, { 
      subGroup: i.subGroup,
      density: parseFloat(i.density) || 0,
      thicknesses: new Set<number>() 
    }])
  ).entries()
).map(([subGroup, data]) => {
  FILM_ITEMS.filter(i => i.subGroup === subGroup).forEach(i => {
    const t = parseFloat(i.thickness);
    if (!isNaN(t) && t > 0) data.thicknesses.add(t);
  });
  return { subGroup, density: data.density, thicknesses: Array.from(data.thicknesses).sort((a,b)=>a-b) };
});


export default function GravureEstimationPage() {
  const { categories } = useCategories();   // ← live from Category Master
  const { enquiries: allEnquiries } = useEnquiries();  // ← live from Enquiry page
  const { catalog: productCatalog } = useProductCatalog();
  const gravureEnqList = allEnquiries.filter(e => e.businessUnit === "Gravure");
  const activeCatalog  = productCatalog.filter(c => c.status === "Active");
  const [data, setData]       = useState<GravureEstimation[]>(initData);
  const [modalOpen, setModal] = useState(false);
  const [viewRow, setViewRow] = useState<GravureEstimation | null>(null);
  const [editing, setEditing] = useState<GravureEstimation | null>(null);
  const [form, setForm]       = useState<typeof blank>({ ...blank });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [catalogPickerOpen, setCatalogPickerOpen] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [loadedFromCatalog, setLoadedFromCatalog] = useState<string>("");   // catalogNo
  const [upsPreviewPlan, setUpsPreviewPlan] = useState<any>(null);
  const [dimValues, setDimValues] = useState<DimValues>({});
  const patchDim = (patch: DimValues) => setDimValues(p => ({ ...p, ...patch }));

  const [showPlan, setShowPlan] = useState(false);
  const [pendingCategoryId, setPendingCategoryId] = useState<string | null>(null);
  const [previewCode, setPreviewCode] = useState<string>("");

  // ── Cylinder Alloc state ─────────────────────────────────
  type EstCylAlloc = {
    colorNo:      number;
    colorName:    string;
    cylinderNo:   string;
    circumference:string;
    printWidth:   string;
    repeatUPS:    number;
    cylinderType: "New" | "Existing" | "Rechromed" | "Repeat";
    status:       "Pending" | "Available" | "In Use" | "Under Chrome" | "Ordered";
    remarks:      string;
    createdInMaster?: boolean;
    repeatUse?:   boolean;
  };
  const [cylAllocs, setCylAllocs] = useState<EstCylAlloc[]>([]);

  // Tab navigation states
  const [activeTab, setActiveTab] = useState<number>(1);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [isPlanApplied, setIsPlanApplied] = useState(false);
  const [planSearch, setPlanSearch] = useState("");
  const [planSort, setPlanSort] = useState<{ key: string; dir: "asc" | "desc" }>({ key: "", dir: "asc" });
  const [extraQtys, setExtraQtys] = useState<number[]>([]);
  const [activeQtyIdx, setActiveQtyIdx] = useState<number>(0); // 0 = base qty
  const [qtyOverrides, setQtyOverrides] = useState<Array<{
    labourCost?: number; transportationCost?: number; interestCost?: number;
    overheadPct?: number; profitPct?: number;
  }>>([]);
  const setQtyOverride = (qi: number, field: string, val: number) => {
    setQtyOverrides(prev => {
      const next = [...prev];
      next[qi] = { ...(next[qi] ?? {}), [field]: val };
      return next;
    });
  };

  // Derived costs (live)
  const costs     = useMemo(() => calcCosts(form), [form]);
  const allQtys   = useMemo(() => [form.quantity, ...extraQtys.filter(q => q > 0)], [form.quantity, extraQtys]);
  const allCosts      = useMemo(() => allQtys.map((qty, qi) => {
    const ov = qtyOverrides[qi] ?? {};
    return calcCosts({
      ...form, quantity: qty,
      labourCost:         ov.labourCost         ?? form.labourCost,
      transportationCost: ov.transportationCost ?? form.transportationCost,
      interestCost:       ov.interestCost       ?? form.interestCost,
      overheadPct:        ov.overheadPct        ?? form.overheadPct,
      profitPct:          ov.profitPct          ?? form.profitPct,
    });
  }), [form, allQtys, qtyOverrides]);
  const allBreakdowns = useMemo(() => allQtys.map(qty => getCostBreakdown({ ...form, quantity: qty })), [form, allQtys]);
  const safeIdx     = Math.min(activeQtyIdx, allCosts.length - 1);
  const activeCosts = allCosts[safeIdx] ?? costs;
  const activeQty   = allQtys[safeIdx] ?? form.quantity;
  // breakdown always reflects the ACTIVE quantity row (Q1/Q2/Q3)
  const breakdown = useMemo(() => getCostBreakdown({ ...form, quantity: activeQty }), [form, activeQty]);

  // ── Production plan rows (Tab 2) ────────────────────────
  const totalPlyGSM = useMemo(() =>
    form.secondaryLayers.reduce((s, l) => s + l.gsm + l.consumableItems.reduce((cs, ci) => cs + (ci.gsm || 0), 0), 0),
    [form.secondaryLayers]);

  const allPlans = useMemo(() => {
    if (!form.actualWidth || form.actualWidth <= 0) return [];
    const machinesToPlan = form.machineId
      ? PRINT_MACHINES.filter(m => m.id === form.machineId)
      : PRINT_MACHINES;

    const rawPlans = machinesToPlan.flatMap(machine => {
      const machineMaxFilm = parseFloat((machine as any).maxWebWidth) || 1300;
      const machineMinFilm = parseFloat((machine as any).minWebWidth) || 0;
      const machineMinCirc = parseFloat((machine as any).repeatLengthMin) || 0;
      const machineMaxCirc = parseFloat((machine as any).repeatLengthMax) || 9999;
      const laneWidth   = form.actualWidth;
      const trim        = form.trimmingSize || 0;
      const shrink      = form.widthShrinkage || 0;
      const effectiveRepeat = (form.jobHeight || 0) + shrink;
      const costPerHour = parseFloat((machine as any).costPerHour) || 1350;
      const speed       = parseFloat((machine as any).speedMax) || 150;

      const calcRepeatUPS = (cylCirc: number) => {
        if (effectiveRepeat <= 0) return 1;
        return Math.round(cylCirc / effectiveRepeat);
      };
      const isValidCircumference = (cylCirc: number) => {
        if (cylCirc < machineMinCirc || cylCirc > machineMaxCirc) return false;
        if (effectiveRepeat <= 0) return true;
        const rem = cylCirc % effectiveRepeat;
        return rem < 0.5 || (effectiveRepeat - rem) < 0.5;
      };

      // ── LOOP A: Sleeve in stock → cylinder (or SPECIAL CYL for all valid circ multiples) ──
      const loopA = SLEEVE_TOOLS.flatMap(sleeve => {
        const sleeveWidthVal = parseFloat(sleeve.printWidth);
        if (sleeveWidthVal > machineMaxFilm) return [];
        const maxAcUps = Math.floor(sleeveWidthVal / laneWidth);
        if (maxAcUps === 0) return [];
        return Array.from({ length: maxAcUps }, (_, i) => {
          const acUps         = i + 1;
          const printingWidth = acUps * laneWidth;
          const filmWidth     = printingWidth + 2 * trim;
          if (filmWidth > sleeveWidthVal) return [];
          if (filmWidth < machineMinFilm) return [];
          const req    = filmWidth + 100;
          const minCyl = req < sleeveWidthVal ? req : sleeveWidthVal + 100;
          const validCylinders = CYLINDER_TOOLS.filter(t => {
            const cw = parseFloat(t.printWidth);
            if (cw < minCyl || cw < machineMinFilm || cw > machineMaxFilm) return false;
            return isValidCircumference(parseFloat(t.repeatLength || "450") || 450);
          });
          const specialCylinders = (() => {
            if (effectiveRepeat <= 0) return [{ id: "SPECIAL-CYL-1", code: "SPL", name: "Special Order", printWidth: String(Math.ceil(minCyl)), repeatLength: "450", isSpecial: true }];
            const res = [];
            for (let mult = 1; mult * effectiveRepeat <= machineMaxCirc; mult++) {
              const circ = mult * effectiveRepeat;
              if (circ < machineMinCirc) continue;
              const cw = Math.ceil(minCyl);
              if (cw < machineMinFilm || cw > machineMaxFilm) continue;
              res.push({ id: `SPECIAL-CYL-${mult}`, code: "SPL", name: `Special Order (${mult}×${effectiveRepeat}mm)`, printWidth: String(cw), repeatLength: String(circ), isSpecial: true });
            }
            return res.length > 0 ? res : [];
          })();
          const cylList = validCylinders.length > 0
            ? validCylinders.map(c => ({ id: c.id, code: c.code, name: c.name, printWidth: c.printWidth, repeatLength: c.repeatLength || "450", isSpecial: false }))
            : specialCylinders;
          const sideWaste  = parseFloat((2 * trim).toFixed(1));
          const deadMargin = parseFloat((sleeveWidthVal - filmWidth).toFixed(1));
          const totalWaste = parseFloat((sideWaste + deadMargin).toFixed(1));
          return cylList.flatMap(cylinder => {
            const cylWidthV = parseFloat(cylinder.printWidth);
            if (cylWidthV < sleeveWidthVal + 100) return [];
            if (cylWidthV < machineMinFilm || cylWidthV > machineMaxFilm) return [];
            const cylCirc    = parseFloat(cylinder.repeatLength) || 450;
            const repeatUPS  = calcRepeatUPS(cylCirc);
            const totalUPS   = acUps * repeatUPS;
            const reqRMT     = form.quantity > 0 ? Math.ceil(form.quantity / totalUPS) : 1;
            const totalRMT   = Math.ceil(reqRMT * 1.01);
            const totalWt    = parseFloat((totalRMT * (form.actualWidth / 1000) * totalPlyGSM / 1000).toFixed(3));
            const totalTime  = parseFloat((totalRMT / (speed * 60)).toFixed(2));
            const planCost   = parseFloat((totalTime * costPerHour).toFixed(2));
            const cylAreaSqMm   = cylWidthV * cylCirc;
            const cylAreaSqInch = parseFloat((cylAreaSqMm / 645.16).toFixed(2));
            const rate          = form.cylinderRatePerSqInch ?? 0;
            const cylCostByArea = parseFloat((cylAreaSqInch * rate * form.noOfColors).toFixed(2));
            const cylCost       = rate > 0 ? cylCostByArea : form.noOfColors * form.cylinderCostPerColor;
            const grandTotal    = parseFloat((planCost + costs.processCost + cylCost).toFixed(2));
            const unitPrice     = form.quantity > 0 ? parseFloat((grandTotal / form.quantity).toFixed(4)) : 0;
            return [{
              planId: `PLAN-${machine.id}-${sleeve.id}-UPS${acUps}-${cylinder.id}`,
              machineId: machine.id, machineName: machine.name,
              filmSize: filmWidth, acUps, printingWidth,
              sleeveId: sleeve.id, sleeveName: sleeve.name, sleeveCode: sleeve.code, sleeveWidthVal,
              cylinderId: cylinder.id, cylinderName: cylinder.name, cylinderCode: cylinder.code,
              cylinderWidthVal: cylWidthV, cylRepeatLength: cylCirc, cylAreaSqMm, cylAreaSqInch, cylCostByArea,
              usedWidth: printingWidth, sideWaste, deadMargin, totalWaste,
              cylCirc, repeatUPS, totalUPS,
              reqRMT, totalRMT, totalWt, totalTime, planCost, grandTotal, unitPrice,
              isSpecial: cylinder.isSpecial, isSpecialSleeve: false, isDoctorBlade: false, isBest: false,
            }];
          }).flat();
        }).flat();
      });

      // ── LOOP B: Cylinder in stock → SPECIAL SLEEVE ──
      const loopB = CYLINDER_TOOLS.flatMap(cylinder => {
        const cylWidthVal = parseFloat(cylinder.printWidth);
        if (cylWidthVal < machineMinFilm || cylWidthVal > machineMaxFilm) return [];
        const maxAcUps = Math.floor(cylWidthVal / laneWidth);
        if (maxAcUps === 0) return [];
        return Array.from({ length: maxAcUps }, (_, i) => {
          const acUps         = i + 1;
          const printingWidth = acUps * laneWidth;
          const filmWidth     = printingWidth + 2 * trim;
          if (filmWidth > machineMaxFilm) return [];
          if (filmWidth < machineMinFilm) return [];
          const realSleeveExists = SLEEVE_TOOLS.some(s => {
            const sw = parseFloat(s.printWidth);
            if (sw < filmWidth || sw > machineMaxFilm) return false;
            const req = filmWidth + 100;
            const minCyl = req < sw ? req : sw + 100;
            return cylWidthVal >= minCyl;
          });
          if (realSleeveExists) return [];
          if (cylWidthVal < filmWidth + 100) return [];
          const cylCirc = parseFloat(cylinder.repeatLength || "450") || 450;
          if (!isValidCircumference(cylCirc)) return [];
          const sideWaste  = parseFloat((2 * trim).toFixed(1));
          const totalWaste = sideWaste;
          const repeatUPS  = calcRepeatUPS(cylCirc);
          const totalUPS   = acUps * repeatUPS;
          const reqRMT     = form.quantity > 0 ? Math.ceil(form.quantity / totalUPS) : 1;
          const totalRMT   = Math.ceil(reqRMT * 1.01);
          const totalWt    = parseFloat((totalRMT * (form.actualWidth / 1000) * totalPlyGSM / 1000).toFixed(3));
          const totalTime  = parseFloat((totalRMT / (speed * 60)).toFixed(2));
          const planCost   = parseFloat((totalTime * costPerHour).toFixed(2));
          const cylAreaSqMm   = cylWidthVal * cylCirc;
          const cylAreaSqInch = parseFloat((cylAreaSqMm / 645.16).toFixed(2));
          const rate          = form.cylinderRatePerSqInch ?? 0;
          const cylCostByArea = parseFloat((cylAreaSqInch * rate * form.noOfColors).toFixed(2));
          const cylCost       = rate > 0 ? cylCostByArea : form.noOfColors * form.cylinderCostPerColor;
          const grandTotal    = parseFloat((planCost + costs.processCost + cylCost).toFixed(2));
          const unitPrice     = form.quantity > 0 ? parseFloat((grandTotal / form.quantity).toFixed(4)) : 0;
          return [{
            planId: `PLAN-${machine.id}-SPLSLV-UPS${acUps}-${cylinder.id}`,
            machineId: machine.id, machineName: machine.name,
            filmSize: filmWidth, acUps, printingWidth,
            sleeveId: "SPECIAL-SLV", sleeveName: "Special Order", sleeveCode: "SPL-S", sleeveWidthVal: filmWidth,
            cylinderId: cylinder.id, cylinderName: cylinder.name, cylinderCode: cylinder.code,
            cylinderWidthVal: cylWidthVal, cylRepeatLength: cylCirc, cylAreaSqMm, cylAreaSqInch, cylCostByArea,
            usedWidth: printingWidth, sideWaste, deadMargin: 0, totalWaste,
            cylCirc, repeatUPS, totalUPS,
            reqRMT, totalRMT, totalWt, totalTime, planCost, grandTotal, unitPrice,
            isSpecial: true, isSpecialSleeve: true, isDoctorBlade: false, isBest: false,
          }];
        }).flat();
      });

      return [...loopA, ...loopB];
    });

    if (rawPlans.length === 0) return rawPlans;
    const sorted = [...rawPlans].sort((a, b) =>
      a.totalWaste  !== b.totalWaste  ? a.totalWaste  - b.totalWaste  :
      a.deadMargin  !== b.deadMargin  ? a.deadMargin  - b.deadMargin  :
      a.sideWaste   !== b.sideWaste   ? a.sideWaste   - b.sideWaste   :
      b.acUps       !== a.acUps       ? b.acUps        - a.acUps       : 0
    );
    return sorted.map((p, idx) => ({ ...p, isBest: !p.isSpecial && idx === 0 }));
  }, [form.machineId, form.jobHeight, form.actualWidth, form.trimmingSize, form.widthShrinkage, form.quantity, form.noOfColors, form.cylinderCostPerColor, form.cylinderRatePerSqInch, totalPlyGSM, costs.processCost]);

  const selectedPlan = useMemo(() => allPlans.find(p => p.planId === selectedPlanId), [allPlans, selectedPlanId]);

  const visiblePlans = useMemo(() => {
    let rows = allPlans;
    if (planSearch.trim()) {
      const q = planSearch.toLowerCase();
      rows = rows.filter(p =>
        p.machineName.toLowerCase().includes(q) ||
        p.sleeveName.toLowerCase().includes(q) ||
        p.cylinderName.toLowerCase().includes(q) ||
        String(p.acUps).includes(q) ||
        String(p.totalUPS).includes(q) ||
        String(p.sleeveWidthVal).includes(q) ||
        String(p.cylinderWidthVal).includes(q)
      );
    }
    if (planSort.key) {
      rows = [...rows].sort((a, b) => {
        const av = (a as Record<string, unknown>)[planSort.key] as number;
        const bv = (b as Record<string, unknown>)[planSort.key] as number;
        return planSort.dir === "asc" ? av - bv : bv - av;
      });
    }
    return rows;
  }, [allPlans, planSearch, planSort]);

  const togglePlanSort = (key: string) =>
    setPlanSort(s => s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" });

  const f = (k: keyof typeof blank, v: unknown) => setForm(p => ({ ...p, [k]: v }));

  const openAdd = () => {
    setEditing(null);
    setForm({ ...blank });
    setActiveTab(1); setExtraQtys([]); setActiveQtyIdx(0);
    setLoadedFromCatalog("");
    setCylAllocs([]);
    setSelectedPlanId(null); setIsPlanApplied(false);
    setPreviewCode(generateCode(UNIT_CODE.Gravure, MODULE_CODE.Estimation, data.map(d => d.estimationNo)));
    setModal(true);
  };
  const openEdit = (row: GravureEstimation) => {
    setEditing(row);
    const { id, estimationNo, ...rest } = row;
    setForm(rest);
    setActiveTab(1); setExtraQtys([]); setActiveQtyIdx(0);
    setLoadedFromCatalog("");
    setCylAllocs([]);
    setSelectedPlanId(null); setIsPlanApplied(false);
    setModal(true);
  };

  // ── Load from Product Catalog ─────────────────────────────
  const loadFromCatalog = (cat: (typeof productCatalog)[0]) => {
    setForm(p => ({
      ...p,
      // Customer & Job
      customerId:   cat.customerId,
      customerName: cat.customerName,
      jobName:      cat.productName,
      // Category & Content
      categoryId:   cat.categoryId,
      categoryName: cat.categoryName,
      content:      cat.content,
      // Dimensions
      jobWidth:     cat.jobWidth,
      jobHeight:    cat.jobHeight,
      actualWidth:  cat.actualWidth || cat.jobWidth,
      actualHeight: cat.actualHeight || cat.jobHeight,
      width:        cat.jobWidth,
      trimmingSize: cat.trimmingSize || 0,
      widthShrinkage: (cat as any).widthShrinkage || 0,
      // Print
      noOfColors:   cat.noOfColors,
      frontColors:  cat.frontColors ?? cat.noOfColors,
      backColors:   cat.backColors ?? 0,
      printType:    cat.printType,
      // Machine & Cost
      machineId:    cat.machineId,
      machineName:  cat.machineName,
      cylinderCostPerColor: cat.cylinderCostPerColor,
      overheadPct:  cat.overheadPct,
      profitPct:    cat.profitPct,
      // Ply & Processes — copy directly
      secondaryLayers: cat.secondaryLayers.map((l, i) => ({
        ...l,
        id: Math.random().toString(),
        layerNo: i + 1,
      })),
      processes: (cat.processes || []).map(pr => ({ ...pr })),
      // ── Product Identity fields from catalog ──
      packSize:      (cat as any).packSize      ?? undefined,
      brandName:     (cat as any).brandName     ?? undefined,
      productType:   (cat as any).productType   ?? undefined,
      skuType:       (cat as any).skuType       ?? undefined,
      bottleType:    (cat as any).bottleType    ?? undefined,
      addressType:   (cat as any).addressType   ?? undefined,
      artworkName:   (cat as any).artworkName   ?? undefined,
      specialSpecs:  (cat as any).specialSpecs  ?? undefined,
      finalRollOD:   (cat as any).finalRollOD   ?? undefined,
      rollUnit:      (cat as any).rollUnit      ?? undefined,
      unwindDirection: (cat as any).unwindDirection ?? undefined,
    }));
    // Populate dimension inputs so the dimension box shows with values
    const cfg = CONTENT_TYPE_CONFIG[cat.content];
    if (cfg) {
      const dims: DimValues = {};
      if (cfg.fields.includes("layflatWidth")) dims.layflatWidth = cat.jobWidth;
      else dims.width = cat.jobWidth;
      if (cfg.fields.includes("cutHeight")) dims.cutHeight = cat.jobHeight;
      else dims.height = cat.jobHeight;
      if (cfg.fields.includes("gusset")) dims.gusset = (cat as any).gusset || 0;
      dims.trimming = cat.trimmingSize || 0;
      dims.widthShrinkage = (cat as any).widthShrinkage || 0;
      setDimValues(dims);
    }
    setLoadedFromCatalog(cat.catalogNo);
    setCatalogPickerOpen(false);
    setCatalogSearch("");
    // ── Load cylinder allocs from catalog if saved ──
    const savedCylAllocs = (cat as any).savedCylAllocs as EstCylAlloc[] | undefined;
    if (savedCylAllocs && savedCylAllocs.length > 0) {
      setCylAllocs(savedCylAllocs.map(c => ({ ...c, createdInMaster: c.createdInMaster ?? false, repeatUse: c.repeatUse ?? false })));
    } else {
      // Build blank allocs from noOfColors
      const n = cat.noOfColors || 0;
      setCylAllocs(Array.from({ length: n }, (_, i) => ({
        colorNo:      i + 1,
        colorName:    `Color ${i + 1}`,
        cylinderNo:   "",
        circumference: String(cat.jobHeight || ""),
        printWidth:   String(cat.actualWidth || cat.jobWidth || ""),
        repeatUPS:    1,
        cylinderType: "New" as const,
        status:       "Pending" as const,
        remarks:      "",
        createdInMaster: false,
        repeatUse:    false,
      })));
    }
  };

  // ── Open Cylinder Master from Estimation ─────────────────
  const openEstCylinderMaster = (plan?: typeof selectedPlan) => {
    const n = form.noOfColors || 0;
    if (n === 0) { alert("Set No. of Colors in Basic Info first."); return; }
    const _cn = loadedFromCatalog || "";
    const _m  = _cn.match(/(\d+)$/);
    const _pCode = _m ? `P${_m[1].padStart(4, "0")}` : `EST-${Date.now()}`;
    const _sp = plan as any;
    const nonRepeat = cylAllocs.filter(c => !c.repeatUse);
    if (nonRepeat.length === 0) { alert("All colors are marked as Repeat Use — nothing to create."); return; }
    const prefillData = {
      productCode:   _pCode,
      productName:   form.jobName || form.jobName || "—",
      customerName:  form.customerName,
      noOfColors:    nonRepeat.length,
      circumference: _sp ? String(_sp.cylCirc ?? "") : String(form.jobHeight || ""),
      printWidth:    _sp ? String(_sp.cylinderWidthVal ?? _sp.printingWidth ?? "") : String(form.actualWidth || form.jobWidth || ""),
      repeatUPS:     _sp ? (_sp.repeatUPS as number) : 1,
      totalUPS:      _sp?.totalUPS,
      filmSize:      _sp ? String(_sp.filmSize ?? "") : undefined,
      totalWaste:    _sp ? String(_sp.totalWaste ?? "") : undefined,
      sleeveCode:    _sp ? String(_sp.sleeveCode ?? "") : undefined,
      sleeveWidth:   _sp ? String(_sp.sleeveWidthVal ?? "") : undefined,
      acUps:         _sp?.acUps,
      printingWidth: _sp ? String(_sp.printingWidth ?? "") : undefined,
      isSpecial:     _sp ? !!_sp.isSpecial : undefined,
      categoryName:  form.categoryName || "",
      jobWidth:      String(form.jobWidth || ""),
      jobHeight:     String(form.jobHeight || ""),
      colors:        nonRepeat.map((c, i) => c.colorName || `Color ${i + 1}`),
    };
    localStorage.setItem("ajsw_cylinder_prefill", JSON.stringify(prefillData));
    window.open("/masters/tools/create-cylinders", "_blank");
  };

  // ── Refresh cylinder codes from master ───────────────────
  const refreshEstFromCylinderMaster = () => {
    const _cn = loadedFromCatalog || "";
    const _m  = _cn.match(/(\d+)$/);
    const productCode = _m ? `P${_m[1].padStart(4, "0")}` : "";
    if (!productCode) return;
    try {
      const created: any[] = JSON.parse(localStorage.getItem("ajsw_cylinders_created") || "[]");
      const matching = created.filter(c => c.productCode === productCode);
      if (matching.length === 0) return;
      setCylAllocs(p => p.map(alloc => {
        const match = matching.find((m: any) => m.colorNo === alloc.colorNo);
        if (!match) return alloc;
        return { ...alloc, cylinderNo: match.cylinderCode || alloc.cylinderNo, createdInMaster: true, status: match.status || alloc.status };
      }));
    } catch { /* ignore */ }
  };

  // ── Material row handlers ─────────────────────────────────
  const addMaterial = () =>
    setForm(p => ({
      ...p,
      materials: [...p.materials, { itemId: "", itemCode: "", itemName: "", group: "", unit: "Kg", rate: 0, qty: 0, amount: 0 }],
    }));

  const removeMaterial = (i: number) =>
    setForm(p => ({ ...p, materials: p.materials.filter((_, idx) => idx !== i) }));

  const updateMaterial = (i: number, patch: Partial<GravureEstimationMaterial>) =>
    setForm(p => ({
      ...p,
      materials: p.materials.map((m, idx) => {
        if (idx !== i) return m;
        const updated = { ...m, ...patch };
        updated.amount = parseFloat((updated.rate * updated.qty).toFixed(2));
        return updated;
      }),
    }));

  const selectMaterialItem = (i: number, itemId: string) => {
    const it = ALL_MAT_ITEMS.find(x => x.id === itemId);
    if (!it) return;
    updateMaterial(i, {
      itemId: it.id, itemCode: it.code, itemName: it.name,
      group: it.group, unit: it.stockUom,
      rate: parseFloat(it.estimationRate) || 0,
    });
  };

  // ── Process row handlers ──────────────────────────────────
  const addProcess = () =>
    setForm(p => ({
      ...p,
      processes: [...p.processes, { processId: "", processName: "", chargeUnit: "", rate: 0, qty: 0, setupCharge: 0, amount: 0 }],
    }));

  const removeProcess = (i: number) =>
    setForm(p => ({ ...p, processes: p.processes.filter((_, idx) => idx !== i) }));

  const updateProcess = (i: number, patch: Partial<GravureEstimationProcess>) =>
    setForm(p => ({
      ...p,
      processes: p.processes.map((pr, idx) => {
        if (idx !== i) return pr;
        const updated = { ...pr, ...patch };
        updated.amount = parseFloat((updated.rate * updated.qty + updated.setupCharge).toFixed(2));
        return updated;
      }),
    }));

  const selectProcess = (i: number, processId: string) => {
    const pm = ROTO_PROCESSES.find(x => x.id === processId);
    if (!pm) return;
    updateProcess(i, {
      processId: pm.id, processName: pm.name,
      chargeUnit: pm.chargeUnit, rate: parseFloat(pm.rate) || 0,
      setupCharge: pm.makeSetupCharges ? parseFloat(pm.setupChargeAmount) || 0 : 0,
    });
  };

  // ── Category auto-load ────────────────────────────────
  /** Apply a category: auto-build ply rows from its plyConsumables definition */
  const applyCategory = (categoryId: string) => {
    const cat = categories.find(c => c.id === categoryId);
    const plyOrder = ["Film", "Printing", "Lamination", "Coating"];
    const usedTypes = new Set((cat?.plyConsumables || []).map(pc => pc.plyType));
    const autoTypes = plyOrder.filter(pt => pt === "Film" || usedTypes.has(pt));
    const autoLayers: SecondaryLayer[] = autoTypes.map((plyType, i) => {
      const consumableItems: PlyConsumableItem[] = (cat?.plyConsumables || [])
        .filter(pc => pc.plyType === plyType)
        .map(pc => ({
          consumableId: pc.id,
          fieldDisplayName: pc.fieldDisplayName,
          itemGroup: pc.itemGroup,
          itemSubGroup: pc.itemSubGroup,
          itemId: "", itemName: "",
          gsm: pc.defaultValue,
          rate: 0,
        }));
      return { id: Math.random().toString(), layerNo: i + 1, plyType, itemSubGroup: "", density: 0, thickness: 0, gsm: 0, consumableItems };
    });
    setForm(p => ({ ...p, categoryId, categoryName: cat?.name || "", content: "", secondaryLayers: autoLayers }));
  };

  // ── Ply helpers ───────────────────────────────────────
  /** When ply type changes: keep existing consumableItems, just update plyType */
  const onPlyTypeChange = (index: number, plyType: string) => {
    const layers = [...form.secondaryLayers];
    layers[index] = { ...layers[index], plyType };
    f("secondaryLayers", layers);
  };

  /** Add a blank consumable row to a ply (fully manual — no category dependency) */
  const addPlyConsumable = (layerIdx: number) => {
    const layers = [...form.secondaryLayers];
    const layer = { ...layers[layerIdx] };
    layer.consumableItems = [...layer.consumableItems, {
      consumableId: Math.random().toString(),
      fieldDisplayName: "",
      itemGroup: "",
      itemSubGroup: "",
      itemId: "",
      itemName: "",
      gsm: 0,
      rate: 0,
    } as PlyConsumableItem];
    layers[layerIdx] = layer;
    f("secondaryLayers", layers);
  };

  /** Remove a consumable row from a ply */
  const removePlyConsumable = (layerIdx: number, ciIdx: number) => {
    const layers = [...form.secondaryLayers];
    const layer = { ...layers[layerIdx] };
    layer.consumableItems = layer.consumableItems.filter((_, i) => i !== ciIdx);
    layers[layerIdx] = layer;
    f("secondaryLayers", layers);
  };

  /** Update a single field of one consumable item inside a ply */
  const updatePlyConsumable = (layerIdx: number, ciIdx: number, patch: Partial<PlyConsumableItem>) => {
    const layers = [...form.secondaryLayers];
    const layer = { ...layers[layerIdx] };
    const ci = [...layer.consumableItems];
    ci[ciIdx] = { ...ci[ciIdx], ...patch };
    layer.consumableItems = ci;
    layers[layerIdx] = layer;
    f("secondaryLayers", layers);
  };

  // ── Save ─────────────────────────────────────────────────
  const save = () => {
    if (!form.customerId || !form.jobName || !form.machineId) {
      alert("Please fill required Basic Info & Machine."); return;
    }
    if (form.secondaryLayers.length === 0) {
      alert("Please configure Ply Details Composition."); return;
    }
    const substrateName = form.secondaryLayers.map(l => l.itemSubGroup).join(" + ") || "Multiple Plys";

    if (editing) {
      // Update single record — preserve quantities array
      const quantities: number[] = [form.quantity, ...extraQtys.filter(q => q > 0)];
      const record = { ...form, ...costs, substrateName, quantities };
      setData(d => d.map(r => r.id === editing.id ? { ...record, id: editing.id, estimationNo: editing.estimationNo } : r));
    } else {
      // Save single record with all quantities stored inside
      const quantities: number[] = [form.quantity, ...extraQtys.filter(q => q > 0)];
      setData(prev => {
        const estimationNo = generateCode(UNIT_CODE.Gravure, MODULE_CODE.Estimation, prev.map(d => d.estimationNo));
        const id = `GVES${String(prev.length + 1).padStart(3, "0")}`;
        return [...prev, { ...form, ...costs, substrateName, quantities, id, estimationNo }];
      });
    }
    setModal(false);
    setShowPlan(false);
  };

  // ── Stats ────────────────────────────────────────────────
  const stats = {
    total:    data.length,
    draft:    data.filter(e => e.status === "Draft").length,
    approved: data.filter(e => e.status === "Approved").length,
    sent:     data.filter(e => e.status === "Sent" || e.status === "Accepted").length,
    totalAmt: data.reduce((s, e) => s + e.totalAmount, 0),
  };

  const PLY_BADGE_CLS: Record<string, string> = {
    Film:       "bg-sky-100 text-sky-700 border-sky-200",
    Printing:   "bg-indigo-100 text-indigo-700 border-indigo-200",
    Lamination: "bg-orange-100 text-orange-700 border-orange-200",
    Coating:    "bg-green-100 text-green-700 border-green-200",
  };

  const columns: Column<GravureEstimation>[] = [
    { key: "estimationNo",  header: "Estimation No", sortable: true },
    { key: "date",          header: "Date",           sortable: true },
    { key: "customerName",  header: "Customer",       sortable: true },
    { key: "jobName",       header: "Job Name" },
    {
      key: "secondaryLayers", header: "Ply Structure",
      render: r => r.secondaryLayers.length === 0
        ? <span className="text-gray-300 text-xs">—</span>
        : (
          <div className="space-y-1 min-w-[200px]">
            {r.secondaryLayers.map((l, i) => (
              <div key={i} className="flex items-center gap-1 flex-wrap">
                <span className="px-1.5 py-0.5 bg-purple-600 text-white rounded text-[9px] font-black">P{l.layerNo}</span>
                <span className={`px-1.5 py-0.5 rounded border text-[9px] font-semibold ${PLY_BADGE_CLS[l.plyType] ?? "bg-gray-100 text-gray-600 border-gray-200"}`}>
                  {l.plyType || "—"}
                </span>
                {l.itemSubGroup && (
                  <span className="text-[9px] text-gray-700 font-medium">{l.itemSubGroup}</span>
                )}
                {l.thickness > 0 && (
                  <span className="text-[9px] text-gray-400 font-mono">{l.thickness}μ</span>
                )}
                {l.gsm > 0 && (
                  <span className="text-[9px] font-bold text-indigo-600 font-mono">{l.gsm}g</span>
                )}
              </div>
            ))}
          </div>
        ),
    },
    { key: "noOfColors",    header: "Colors", render: r => <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold">{r.noOfColors}C</span> },
    { key: "machineName",   header: "Machine", render: r => <span className="text-xs text-gray-600">{r.machineName}</span> },
    { key: "quantity",      header: "Qty", render: r => <span>{r.quantity.toLocaleString()} {r.unit}</span> },
    { key: "perMeterRate",  header: "₹/Kg", render: r => <span className="font-semibold">₹{r.perMeterRate}</span> },
    { key: "totalAmount",   header: "Total (₹)", render: r => <span className="font-bold text-gray-800">₹{r.totalAmount.toLocaleString()}</span> },
    { key: "status",        header: "Status", render: r => statusBadge(r.status), sortable: true },
  ];

  // ── Inline table cell style ───────────────────────────────
  const cellInput = "w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-purple-400 bg-white";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <Calculator size={18} className="text-purple-600" />
            <h2 className="text-lg font-semibold text-gray-800">Gravure Estimation</h2>
          </div>
          <p className="text-sm text-gray-500">{stats.total} estimations · ₹{stats.totalAmt.toLocaleString()} total value</p>
        </div>
        <Button icon={<Plus size={16} />} onClick={openAdd}>New Estimation</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total",          val: stats.total,    cls: "bg-blue-50 text-blue-700 border-blue-200" },
          { label: "Draft",          val: stats.draft,    cls: "bg-gray-50 text-gray-600 border-gray-200" },
          { label: "Approved",       val: stats.approved, cls: "bg-green-50 text-green-700 border-green-200" },
          { label: "Sent/Accepted",  val: stats.sent,     cls: "bg-purple-50 text-purple-700 border-purple-200" },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border p-4 ${s.cls}`}>
            <p className="text-xs font-medium">{s.label}</p>
            <p className="text-2xl font-bold mt-1">{s.val}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <DataTable
          data={data}
          columns={columns}
          searchKeys={["estimationNo", "customerName", "jobName"]}
          actions={row => (
            <div className="flex items-center gap-1.5 justify-end">
              <Button variant="ghost" size="sm" icon={<Eye size={13} />} onClick={() => setViewRow(row)}>View</Button>
              <Button variant="ghost" size="sm" icon={<Pencil size={13} />} onClick={() => openEdit(row)}>Edit</Button>
              <Button variant="danger" size="sm" icon={<Trash2 size={13} />} onClick={() => setDeleteId(row.id)}>Delete</Button>
            </div>
          )}
        />
      </div>

      {/* ══ ADD / EDIT MODAL ══════════════════════════════════════ */}
      <Modal open={modalOpen} onClose={() => setModal(false)} title={editing ? "Edit Estimation" : "New Gravure Estimation"} size="xl">
        <div className="flex bg-gray-100 p-1.5 rounded-xl mb-4 sm:mb-6 shadow-inner gap-1 overflow-x-auto">
           <button onClick={() => setActiveTab(1)} className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all whitespace-nowrap flex-shrink-0 ${activeTab === 1 ? 'bg-white shadow text-purple-700' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'}`}><span className="hidden sm:inline">1. Basic Info</span><span className="sm:hidden">① Info</span></button>
           <button onClick={() => setActiveTab(2)} className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all whitespace-nowrap flex-shrink-0 ${activeTab === 2 ? 'bg-white shadow text-purple-700' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'}`}><span className="hidden sm:inline">2. View Plan (Production)</span><span className="sm:hidden">② Plan</span></button>
           <button onClick={() => setActiveTab(3)} className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all whitespace-nowrap flex-shrink-0 ${activeTab === 3 ? 'bg-white shadow text-purple-700' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'}`}><span className="hidden sm:inline">3. Cost Estimation</span><span className="sm:hidden">③ Cost</span></button>
        </div>

        <div>
          {/* TAB 1: BASIC INFO */}
          {activeTab === 1 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* ── Category & Basic Info ─────────────────────────── */}
          <div>
             <SectionHeader label="Identification & Category" />

             {/* Auto-generated Estimation No + Date — always shown, non-editable */}
             <div className="mb-3 flex items-end gap-4 flex-wrap">
               <div>
                 <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest block mb-1">Estimation No</label>
                 <div className="flex items-center gap-2 px-4 py-2.5 bg-purple-50 border border-purple-200 rounded-xl w-fit">
                   <span className="text-xs font-mono font-bold text-purple-700 tracking-widest">
                     {editing ? editing.estimationNo : previewCode}
                   </span>
                   <span className="text-[9px] px-1.5 py-0.5 bg-purple-200 text-purple-700 rounded font-semibold">
                     {editing ? "EDITING" : "AUTO"}
                   </span>
                 </div>
               </div>
               <div>
                 <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest block mb-1">Estimation Date</label>
                 <div className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 select-none">
                   {new Date(form.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                 </div>
               </div>
             </div>

             {/* Load from Product Catalog */}
             <div className="flex items-center gap-3 mb-3 p-3 bg-teal-50 border border-teal-200 rounded-xl">
               <div className="flex-1">
                 <p className="text-[10px] font-bold text-teal-700 uppercase tracking-wider">Load from Product Catalog</p>
                 {loadedFromCatalog
                   ? <p className="text-xs text-teal-600 mt-0.5">Loaded: <strong>{loadedFromCatalog}</strong> — dimensions, plys, processes pre-filled</p>
                   : <p className="text-xs text-teal-500 mt-0.5">Select an existing product to auto-fill all details</p>
                 }
               </div>
               <button
                 onClick={() => { setCatalogSearch(""); setCatalogPickerOpen(true); }}
                 className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition shadow-sm whitespace-nowrap">
                 <FileText size={13} /> {loadedFromCatalog ? "Change Catalog" : "Pick from Catalog"}
               </button>
               {loadedFromCatalog && (
                 <button onClick={() => setLoadedFromCatalog("")}
                   className="text-teal-400 hover:text-teal-600 p-1 rounded-lg hover:bg-teal-100 transition">
                   <X size={14} />
                 </button>
               )}
             </div>

             <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                 <Select
                   label="From Enquiry (optional)"
                   value={form.enquiryId}
                   onChange={e => {
                     const enq = gravureEnqList.find(x => x.id === e.target.value);
                     if (!enq) { f("enquiryId", ""); return; }

                     // ── Category & consumables helper (needs categories from context) ──
                     const plyTypeMap: Record<string, string> = {
                       film: "Film", ink: "Printing", adhesive: "Lamination",
                     };

                     // Build SecondaryLayers from enquiry plys (empty consumableItems — user adds manually)
                     const secondaryLayers: SecondaryLayer[] = (enq.plys || []).map((ply, i) => {
                       const plyType = plyTypeMap[ply.itemQuality] || "Film";
                       return {
                         id: Math.random().toString(),
                         layerNo: i + 1,
                         plyType,
                         itemSubGroup: "",
                         density: 0,
                         thickness: ply.thickness || 0,
                         gsm: ply.gsm || 0,
                         consumableItems: [],
                       };
                     });

                     // Build process rows from enquiry process names
                     const processRows: GravureEstimationProcess[] = (enq.processes || [])
                       .map(name => {
                         const pm = ROTO_PROCESSES.find(p => p.name === name);
                         if (!pm) return null;
                         return {
                           processId: pm.id,
                           processName: pm.name,
                           chargeUnit: pm.chargeUnit,
                           rate: parseFloat(pm.rate) || 0,
                           qty: 0,
                           setupCharge: pm.makeSetupCharges ? parseFloat(pm.setupChargeAmount) || 0 : 0,
                           amount: 0,
                         } as GravureEstimationProcess;
                       })
                       .filter((x): x is GravureEstimationProcess => x !== null);

                     // Total colors from plan window (fallback to noOfColors)
                     const totalColors = (enq.frontColors || 0) + (enq.backColors || 0) || enq.noOfColors;

                     const cat = categories.find(c => c.id === enq.categoryId);

                     setForm(p => ({
                       ...p,
                       enquiryId: enq.id,
                       enquiryNo: enq.enquiryNo,
                       customerId: enq.customerId,
                       customerName: enq.customerName,
                       jobName: enq.jobName,
                       // Category & Content
                       categoryId: enq.categoryId,
                       categoryName: enq.categoryName || cat?.name || "",
                       content: enq.selectedContent || "",
                       // Dimensions
                       jobWidth: enq.planWidth || enq.width || 0,
                       jobHeight: enq.planHeight || 0,
                       width: enq.planWidth || enq.width || 0,
                       actualWidth: (enq.planWidth || enq.width || 0),
                       actualHeight: (enq.planHeight || 0),
                       // Print info
                       noOfColors: totalColors,
                       printType: (["Surface Print", "Reverse Print", "Combination"].includes(enq.printType) ? enq.printType : "Surface Print") as "Surface Print" | "Reverse Print" | "Combination",
                       // Quantity
                       quantity: enq.quantity,
                       unit: enq.uom,
                       // Sales info
                       salesPerson: enq.salesPersonName || "",
                       salesType: enq.salesType === "Domestic" ? "Local" : enq.salesType === "Exporter" ? "Export" : enq.salesType || "Local",
                       concernPerson: enq.concernPerson || "",
                       // Allocation
                       secondaryLayers,
                       processes: processRows,
                     }));
                   }}
                   options={[{ value: "", label: "-- Direct Estimation --" }, ...gravureEnqList.map(e => ({ value: e.id, label: `${e.enquiryNo} – ${e.customerName}` }))]}
                 />
                 <Select
                   label="Customer *"
                   value={form.customerId}
                   onChange={e => {
                     const c = customers.find(x => x.id === e.target.value);
                     f("customerId", e.target.value);
                     if (c) f("customerName", c.name);
                   }}
                   options={[{ value: "", label: "-- Select Customer --" }, ...customers.filter(c => c.status === "Active").map(c => ({ value: c.id, label: c.name }))]}
                 />
                 <Input label="Job Name *" value={form.jobName} onChange={e => f("jobName", e.target.value)} placeholder="Job / carton description" />
                 <Select
                   label="Select Category"
                   value={form.categoryId || ""}
                   onChange={e => {
                     const hasPlys = form.secondaryLayers.some(l => l.plyType || l.consumableItems.length > 0);
                     if (hasPlys && e.target.value) {
                       setPendingCategoryId(e.target.value);
                     } else {
                       applyCategory(e.target.value);
                     }
                   }}
                   options={[{ value: "", label: "-- Select Category --" }, ...categories.map(c => ({ value: c.id, label: c.name }))]}
                 />
                 <Select
                   label="Select Product Type *"
                   value={form.content || ""}
                   onChange={e => f("content", e.target.value)}
                   options={[...(!form.categoryId ? [] : [{ value: "", label: "-- Select Product Type --" }]), ...(categories.find(c => c.id === form.categoryId)?.contents || []).map(ctx => ({ value: ctx, label: ctx }))]}
                   disabled={!form.categoryId || !(categories.find(c => c.id === form.categoryId)?.contents?.length)}
                 />
                  <Select
                    label="Sales Person *"
                    value={form.salesPerson}
                    onChange={e => f("salesPerson", e.target.value)}
                    options={[
                      { value: "", label: "-- Select Sales Person --" },
                      { value: "Rajesh Sharma", label: "Rajesh Sharma" },
                      { value: "Sanjay Gupta",  label: "Sanjay Gupta" },
                      { value: "Anita Desai",   label: "Anita Desai" },
                    ]}
                  />
                  <Select
                    label="Sales Type *"
                    value={form.salesType}
                    onChange={e => f("salesType", e.target.value)}
                    options={[
                      { value: "Local",      label: "Local" },
                      { value: "Inter-State", label: "Inter-State" },
                      { value: "Export",      label: "Export" },
                    ]}
                  />
                  <Input label="Concern Person" value={form.concernPerson} onChange={e => f("concernPerson", e.target.value)} placeholder="Name of concern person" />

                  {/* ── Extra Product Identity Fields ── */}
                  <div className="sm:col-span-2 lg:col-span-3 mt-1">
                    <p className="text-[10px] font-bold text-orange-500 uppercase tracking-widest mb-2 pb-1 border-b border-orange-100">Product Identity</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                      <div>
                        <label className="text-[10px] font-semibold text-gray-400 uppercase block mb-1">Pack Size</label>
                        <select className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-orange-400"
                          value={(form as any).packSize ?? ""}
                          onChange={e => f("packSize" as any, e.target.value)}>
                          <option value="">-- Select --</option>
                          {((customers.find(c => c.id === form.customerId) as any)?.packSizes ?? []).map((ps: string) => (
                            <option key={ps} value={ps}>{ps}</option>
                          ))}
                          {(form as any).packSize && !((customers.find(c => c.id === form.customerId) as any)?.packSizes ?? []).includes((form as any).packSize) && (
                            <option value={(form as any).packSize}>{(form as any).packSize}</option>
                          )}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-gray-400 uppercase block mb-1">Brand Name</label>
                        <select className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-orange-400"
                          value={(form as any).brandName ?? ""}
                          onChange={e => f("brandName" as any, e.target.value)}>
                          <option value="">-- Select --</option>
                          {((customers.find(c => c.id === form.customerId) as any)?.brandNames ?? []).map((bn: string) => (
                            <option key={bn} value={bn}>{bn}</option>
                          ))}
                          {(form as any).brandName && !((customers.find(c => c.id === form.customerId) as any)?.brandNames ?? []).includes((form as any).brandName) && (
                            <option value={(form as any).brandName}>{(form as any).brandName}</option>
                          )}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-gray-400 uppercase block mb-1">Product Type</label>
                        <select className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-orange-400"
                          value={(form as any).productType ?? ""}
                          onChange={e => f("productType" as any, e.target.value)}>
                          <option value="">-- Select --</option>
                          {["CSD", "Water", "Juice", "Sleeve", "Label", "Pouch", "Roll Form", "Other"].map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-gray-400 uppercase block mb-1">SKU Type</label>
                        <select className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-orange-400"
                          value={(form as any).skuType ?? ""}
                          onChange={e => f("skuType" as any, e.target.value)}>
                          <option value="">-- Select --</option>
                          {((customers.find(c => c.id === form.customerId) as any)?.skuTypes ?? []).map((sk: string) => (
                            <option key={sk} value={sk}>{sk}</option>
                          ))}
                          {(form as any).skuType && !((customers.find(c => c.id === form.customerId) as any)?.skuTypes ?? []).includes((form as any).skuType) && (
                            <option value={(form as any).skuType}>{(form as any).skuType}</option>
                          )}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-gray-400 uppercase block mb-1">Bottle Type</label>
                        <select className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-orange-400"
                          value={(form as any).bottleType ?? ""}
                          onChange={e => f("bottleType" as any, e.target.value)}>
                          <option value="">-- Select --</option>
                          {["RPET", "VPET", "Glass", "Tin", "Pouch", "Carton", "N/A"].map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-gray-400 uppercase block mb-1">Address Type</label>
                        <select className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-orange-400"
                          value={(form as any).addressType ?? ""}
                          onChange={e => f("addressType" as any, e.target.value)}>
                          <option value="">-- Select --</option>
                          <option value="Single">Single</option>
                          <option value="Multi">Multi</option>
                          <option value="QR Code">QR Code</option>
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="text-[10px] font-semibold text-gray-400 uppercase block mb-1">Artwork Name</label>
                        <input className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-orange-400"
                          placeholder="e.g. Parle-G 100g Front Artwork v3"
                          value={(form as any).artworkName ?? ""}
                          onChange={e => f("artworkName" as any, e.target.value)} />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="text-[10px] font-semibold text-gray-400 uppercase block mb-1">Special Specifications</label>
                        <input className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-orange-400"
                          placeholder="e.g. @20 Rs, Free, Promo, Export"
                          value={(form as any).specialSpecs ?? ""}
                          onChange={e => f("specialSpecs" as any, e.target.value)} />
                      </div>
                    </div>
                  </div>
             </div>
          </div>

          <div>
              {/* ── Section 1: Planning Specification ─────────────────────────── */}
              <div>
                <SectionHeader label="Planning Specification" />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                  <Input label="No. of Plys *" type="number"
                    value={form.secondaryLayers.length || ""}
                    onChange={e => {
                      const n = Math.max(0, parseInt(e.target.value) || 0);
                      let layers = [...form.secondaryLayers];
                      if (n > layers.length) {
                        while(layers.length < n) {
                          layers.push({ id: Math.random().toString(), layerNo: layers.length + 1, plyType: "", itemSubGroup: "", density: 0, thickness: 0, gsm: 0, consumableItems: [] });
                        }
                      } else if (n < layers.length) {
                        layers = layers.slice(0, n);
                      }
                      f("secondaryLayers", layers);
                    }}
                  />
                  <Input
                    label="Quantity (Q1) *"
                    type="number"
                    value={form.quantity || ""}
                    onChange={e => { f("quantity", Number(e.target.value)); setActiveQtyIdx(0); }}
                    placeholder="e.g. 200000"
                  />
                  <Select
                    label="Unit"
                    value={form.unit}
                    onChange={e => f("unit", e.target.value)}
                    options={[
                      { value: "Pcs", label: "Pcs" },
                      { value: "Kg",    label: "Kg" },
                    ]}
                  />
                </div>

                {/* ── Dimension Setup block (with live diagram) ── */}
                {form.content && CONTENT_TYPE_CONFIG[form.content] ? (
                  <div className="border border-indigo-200 rounded-2xl overflow-hidden">
                    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2.5 flex items-center gap-2">
                      <Calculator size={14} className="text-white" />
                      <p className="text-xs font-bold text-white uppercase tracking-widest">Dimension Setup — {form.content}</p>
                    </div>
                    <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Left: inputs */}
                      <div className="space-y-4">
                        <div>
                          <p className="text-[10px] font-semibold text-indigo-500 uppercase tracking-widest mb-2">Packaging Dimensions</p>
                          <DimensionInputPanel
                            contentType={form.content}
                            dims={dimValues}
                            onChange={patch => {
                              patchDim(patch);
                              if ("width"       in patch && patch.width       !== undefined) setForm(p => ({ ...p, jobWidth:  patch.width!,       width: patch.width!,       actualWidth:  patch.width! }));
                              if ("layflatWidth" in patch && patch.layflatWidth !== undefined) setForm(p => ({ ...p, jobWidth:  patch.layflatWidth!, width: patch.layflatWidth!, actualWidth:  patch.layflatWidth! }));
                              if ("height"      in patch && patch.height      !== undefined) setForm(p => ({ ...p, jobHeight: patch.height!,      actualHeight: patch.height! }));
                              if ("cutHeight"   in patch && patch.cutHeight   !== undefined) setForm(p => ({ ...p, jobHeight: patch.cutHeight!,   actualHeight: patch.cutHeight! }));
                            }}
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-rose-500 uppercase block mb-1">
                            Repeat Length Shrinkage (mm) <span className="normal-case text-gray-400 font-normal">— optional</span>
                          </label>
                          <input
                            type="number" min={0} max={1.5} step={0.1} placeholder="e.g. 1"
                            value={(form as any).widthShrinkage || ""}
                            onChange={e => { const v = Math.min(1.5, Math.max(0, Number(e.target.value) || 0)); patchDim({ widthShrinkage: v }); f("widthShrinkage" as any, v || undefined); }}
                            className="w-full text-sm border border-rose-200 rounded-xl px-3 py-2 bg-rose-50 focus:bg-white outline-none focus:ring-2 focus:ring-rose-400 font-mono"
                          />
                        </div>
                        {/* Colors inside Dimension Setup */}
                        <div className="border-t border-indigo-100 pt-3">
                          <p className="text-[10px] font-semibold text-purple-500 uppercase tracking-widest mb-2">Colors &amp; Print</p>
                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <label className="text-[10px] font-semibold text-gray-400 uppercase block mb-1">Front Colors</label>
                              <input type="number" min={0} max={12} placeholder="0"
                                value={form.frontColors || ""}
                                onChange={e => { const fc = Number(e.target.value) || 0; setForm(p => ({ ...p, frontColors: fc, noOfColors: fc + (p.backColors ?? 0) })); }}
                                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-purple-400 font-mono" />
                            </div>
                            <div>
                              <label className="text-[10px] font-semibold text-gray-400 uppercase block mb-1">Back Colors</label>
                              <input type="number" min={0} max={12} placeholder="0"
                                value={form.backColors || ""}
                                onChange={e => { const bc = Number(e.target.value) || 0; setForm(p => ({ ...p, backColors: bc, noOfColors: (p.frontColors ?? 0) + bc })); }}
                                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-purple-400 font-mono" />
                            </div>
                            <div>
                              <label className="text-[10px] font-semibold text-gray-400 uppercase block mb-1">Total Colors (Auto)</label>
                              <div className="px-3 py-2 bg-purple-50 border border-purple-200 rounded-xl text-sm font-bold text-purple-700 text-center">{form.noOfColors} Colors</div>
                            </div>
                          </div>
                        </div>

                        {/* ── Final Roll OD + Roll Unit + Print Type ── */}
                        <div className="border-t border-indigo-100 pt-3">
                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <label className="text-[10px] font-semibold text-teal-600 uppercase block mb-1">Final Roll OD (mm)</label>
                              <input type="number" min={0} placeholder="e.g. 200"
                                className="w-full text-sm border border-teal-200 rounded-xl px-3 py-2 bg-teal-50 focus:bg-white outline-none focus:ring-2 focus:ring-teal-400 font-mono"
                                value={(form as any).finalRollOD ?? ""}
                                onChange={e => f("finalRollOD" as any, Number(e.target.value) || undefined)} />
                            </div>
                            <div>
                              <label className="text-[10px] font-semibold text-teal-600 uppercase block mb-1">Roll Qty Unit</label>
                              <div className="flex gap-2 mt-0.5">
                                {(["Meter", "KG"] as const).map(u => (
                                  <button key={u} type="button"
                                    onClick={() => f("rollUnit" as any, u)}
                                    className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-all ${
                                      ((form as any).rollUnit ?? "Meter") === u
                                        ? "bg-teal-600 text-white border-teal-600 shadow-sm"
                                        : "bg-white text-gray-600 border-gray-200 hover:border-teal-400 hover:text-teal-700"
                                    }`}>{u}</button>
                                ))}
                              </div>
                            </div>
                            <div>
                              <label className="text-[10px] font-semibold text-gray-400 uppercase block mb-1">Print Type</label>
                              <select className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-purple-400"
                                value={form.printType}
                                onChange={e => f("printType", e.target.value)}>
                                <option value="Surface Print">Surface Print</option>
                                <option value="Reverse Print">Reverse Print</option>
                                <option value="Combination">Combination</option>
                              </select>
                            </div>
                          </div>
                        </div>

                        {/* ── Unwind Direction (Pifa 1–8) ── */}
                        <div className="border-t border-indigo-100 pt-3">
                          <p className="text-[10px] font-semibold text-orange-500 uppercase tracking-widest mb-2">Unwind Direction</p>
                          <div className="grid grid-cols-4 gap-2">
                            {([
                              { n: 1, label: "Outside · Across\nTop off first", svg: (<svg width="70" height="60" viewBox="0 0 70 60"><rect x="6" y="14" width="38" height="32" rx="2" fill="#dbeafe" stroke="#3b82f6" strokeWidth="1.2"/><text x="25" y="30" textAnchor="middle" dominantBaseline="middle" fontSize="6" fontWeight="700" fill="#1d4ed8">PRINT</text><text x="25" y="38" textAnchor="middle" dominantBaseline="middle" fontSize="5" fill="#3b82f6">READS</text><line x1="6" y1="14" x2="44" y2="14" stroke="#f97316" strokeWidth="1.5" strokeDasharray="3,2"/><polygon points="25,6 21,14 29,14" fill="#f97316"/><ellipse cx="53" cy="30" rx="7" ry="16" fill="#94a3b8" stroke="#475569" strokeWidth="1.2"/><ellipse cx="53" cy="30" rx="3" ry="7" fill="#cbd5e1" stroke="#475569" strokeWidth="0.8"/><line x1="44" y1="14" x2="47" y2="14" stroke="#475569" strokeWidth="1"/><line x1="44" y1="46" x2="47" y2="46" stroke="#475569" strokeWidth="1"/><text x="25" y="55" textAnchor="middle" fontSize="5" fill="#6b7280">OUTSIDE</text></svg>) },
                              { n: 2, label: "Outside · Across\nBottom off first", svg: (<svg width="70" height="60" viewBox="0 0 70 60"><rect x="6" y="14" width="38" height="32" rx="2" fill="#dbeafe" stroke="#3b82f6" strokeWidth="1.2"/><text x="25" y="30" textAnchor="middle" dominantBaseline="middle" fontSize="6" fontWeight="700" fill="#1d4ed8" transform="rotate(180,25,30)">PRINT</text><text x="25" y="38" textAnchor="middle" dominantBaseline="middle" fontSize="5" fill="#3b82f6" transform="rotate(180,25,38)">READS</text><line x1="6" y1="46" x2="44" y2="46" stroke="#f97316" strokeWidth="1.5" strokeDasharray="3,2"/><polygon points="25,54 21,46 29,46" fill="#f97316"/><ellipse cx="53" cy="30" rx="7" ry="16" fill="#94a3b8" stroke="#475569" strokeWidth="1.2"/><ellipse cx="53" cy="30" rx="3" ry="7" fill="#cbd5e1" stroke="#475569" strokeWidth="0.8"/><line x1="44" y1="14" x2="47" y2="14" stroke="#475569" strokeWidth="1"/><line x1="44" y1="46" x2="47" y2="46" stroke="#475569" strokeWidth="1"/><text x="25" y="8" textAnchor="middle" fontSize="5" fill="#6b7280">OUTSIDE</text></svg>) },
                              { n: 3, label: "Outside · With Roll\nRight off first", svg: (<svg width="70" height="60" viewBox="0 0 70 60"><rect x="19" y="6" width="32" height="38" rx="2" fill="#dbeafe" stroke="#3b82f6" strokeWidth="1.2"/><text x="35" y="25" textAnchor="middle" dominantBaseline="middle" fontSize="6" fontWeight="700" fill="#1d4ed8" transform="rotate(-90,35,25)">PRINT</text><text x="35" y="33" textAnchor="middle" dominantBaseline="middle" fontSize="5" fill="#3b82f6" transform="rotate(-90,35,33)">READS</text><line x1="51" y1="6" x2="51" y2="44" stroke="#f97316" strokeWidth="1.5" strokeDasharray="3,2"/><polygon points="59,25 51,21 51,29" fill="#f97316"/><ellipse cx="35" cy="51" rx="16" ry="6" fill="#94a3b8" stroke="#475569" strokeWidth="1.2"/><ellipse cx="35" cy="51" rx="7" ry="3" fill="#cbd5e1" stroke="#475569" strokeWidth="0.8"/><line x1="19" y1="44" x2="19" y2="47" stroke="#475569" strokeWidth="1"/><line x1="51" y1="44" x2="51" y2="47" stroke="#475569" strokeWidth="1"/><text x="8" y="25" textAnchor="middle" fontSize="5" fill="#6b7280" transform="rotate(-90,8,25)">OUTSIDE</text></svg>) },
                              { n: 4, label: "Outside · With Roll\nLeft off first", svg: (<svg width="70" height="60" viewBox="0 0 70 60"><rect x="19" y="6" width="32" height="38" rx="2" fill="#dbeafe" stroke="#3b82f6" strokeWidth="1.2"/><text x="35" y="25" textAnchor="middle" dominantBaseline="middle" fontSize="6" fontWeight="700" fill="#1d4ed8" transform="rotate(90,35,25)">PRINT</text><text x="35" y="33" textAnchor="middle" dominantBaseline="middle" fontSize="5" fill="#3b82f6" transform="rotate(90,35,33)">READS</text><line x1="19" y1="6" x2="19" y2="44" stroke="#f97316" strokeWidth="1.5" strokeDasharray="3,2"/><polygon points="11,25 19,21 19,29" fill="#f97316"/><ellipse cx="35" cy="51" rx="16" ry="6" fill="#94a3b8" stroke="#475569" strokeWidth="1.2"/><ellipse cx="35" cy="51" rx="7" ry="3" fill="#cbd5e1" stroke="#475569" strokeWidth="0.8"/><line x1="19" y1="44" x2="19" y2="47" stroke="#475569" strokeWidth="1"/><line x1="51" y1="44" x2="51" y2="47" stroke="#475569" strokeWidth="1"/><text x="62" y="25" textAnchor="middle" fontSize="5" fill="#6b7280" transform="rotate(90,62,25)">OUTSIDE</text></svg>) },
                              { n: 5, label: "Inside · Across\nTop off first", svg: (<svg width="70" height="60" viewBox="0 0 70 60"><rect x="26" y="14" width="38" height="32" rx="2" fill="#dcfce7" stroke="#16a34a" strokeWidth="1.2"/><text x="45" y="30" textAnchor="middle" dominantBaseline="middle" fontSize="6" fontWeight="700" fill="#15803d">PRINT</text><text x="45" y="38" textAnchor="middle" dominantBaseline="middle" fontSize="5" fill="#16a34a">READS</text><line x1="26" y1="14" x2="64" y2="14" stroke="#f97316" strokeWidth="1.5" strokeDasharray="3,2"/><polygon points="45,6 41,14 49,14" fill="#f97316"/><ellipse cx="17" cy="30" rx="7" ry="16" fill="#94a3b8" stroke="#475569" strokeWidth="1.2"/><ellipse cx="17" cy="30" rx="3" ry="7" fill="#cbd5e1" stroke="#475569" strokeWidth="0.8"/><line x1="26" y1="14" x2="23" y2="14" stroke="#475569" strokeWidth="1"/><line x1="26" y1="46" x2="23" y2="46" stroke="#475569" strokeWidth="1"/><text x="45" y="55" textAnchor="middle" fontSize="5" fill="#6b7280">INSIDE</text></svg>) },
                              { n: 6, label: "Inside · Across\nBottom off first", svg: (<svg width="70" height="60" viewBox="0 0 70 60"><rect x="26" y="14" width="38" height="32" rx="2" fill="#dcfce7" stroke="#16a34a" strokeWidth="1.2"/><text x="45" y="30" textAnchor="middle" dominantBaseline="middle" fontSize="6" fontWeight="700" fill="#15803d" transform="rotate(180,45,30)">PRINT</text><text x="45" y="38" textAnchor="middle" dominantBaseline="middle" fontSize="5" fill="#16a34a" transform="rotate(180,45,38)">READS</text><line x1="26" y1="46" x2="64" y2="46" stroke="#f97316" strokeWidth="1.5" strokeDasharray="3,2"/><polygon points="45,54 41,46 49,46" fill="#f97316"/><ellipse cx="17" cy="30" rx="7" ry="16" fill="#94a3b8" stroke="#475569" strokeWidth="1.2"/><ellipse cx="17" cy="30" rx="3" ry="7" fill="#cbd5e1" stroke="#475569" strokeWidth="0.8"/><line x1="26" y1="14" x2="23" y2="14" stroke="#475569" strokeWidth="1"/><line x1="26" y1="46" x2="23" y2="46" stroke="#475569" strokeWidth="1"/><text x="45" y="8" textAnchor="middle" fontSize="5" fill="#6b7280">INSIDE</text></svg>) },
                              { n: 7, label: "Inside · With Roll\nRight off first", svg: (<svg width="70" height="60" viewBox="0 0 70 60"><rect x="19" y="16" width="32" height="38" rx="2" fill="#dcfce7" stroke="#16a34a" strokeWidth="1.2"/><text x="35" y="35" textAnchor="middle" dominantBaseline="middle" fontSize="6" fontWeight="700" fill="#15803d" transform="rotate(-90,35,35)">PRINT</text><text x="35" y="43" textAnchor="middle" dominantBaseline="middle" fontSize="5" fill="#16a34a" transform="rotate(-90,35,43)">READS</text><line x1="51" y1="16" x2="51" y2="54" stroke="#f97316" strokeWidth="1.5" strokeDasharray="3,2"/><polygon points="59,35 51,31 51,39" fill="#f97316"/><ellipse cx="35" cy="9" rx="16" ry="6" fill="#94a3b8" stroke="#475569" strokeWidth="1.2"/><ellipse cx="35" cy="9" rx="7" ry="3" fill="#cbd5e1" stroke="#475569" strokeWidth="0.8"/><line x1="19" y1="16" x2="19" y2="13" stroke="#475569" strokeWidth="1"/><line x1="51" y1="16" x2="51" y2="13" stroke="#475569" strokeWidth="1"/><text x="8" y="35" textAnchor="middle" fontSize="5" fill="#6b7280" transform="rotate(-90,8,35)">INSIDE</text></svg>) },
                              { n: 8, label: "Inside · With Roll\nLeft off first", svg: (<svg width="70" height="60" viewBox="0 0 70 60"><rect x="19" y="16" width="32" height="38" rx="2" fill="#dcfce7" stroke="#16a34a" strokeWidth="1.2"/><text x="35" y="35" textAnchor="middle" dominantBaseline="middle" fontSize="6" fontWeight="700" fill="#15803d" transform="rotate(90,35,35)">PRINT</text><text x="35" y="43" textAnchor="middle" dominantBaseline="middle" fontSize="5" fill="#16a34a" transform="rotate(90,35,43)">READS</text><line x1="19" y1="16" x2="19" y2="54" stroke="#f97316" strokeWidth="1.5" strokeDasharray="3,2"/><polygon points="11,35 19,31 19,39" fill="#f97316"/><ellipse cx="35" cy="9" rx="16" ry="6" fill="#94a3b8" stroke="#475569" strokeWidth="1.2"/><ellipse cx="35" cy="9" rx="7" ry="3" fill="#cbd5e1" stroke="#475569" strokeWidth="0.8"/><line x1="19" y1="16" x2="19" y2="13" stroke="#475569" strokeWidth="1"/><line x1="51" y1="16" x2="51" y2="13" stroke="#475569" strokeWidth="1"/><text x="62" y="35" textAnchor="middle" fontSize="5" fill="#6b7280" transform="rotate(90,62,35)">INSIDE</text></svg>) },
                            ] as { n: number; label: string; svg: React.ReactNode }[]).map(({ n, label, svg }) => {
                              const sel = ((form as any).unwindDirection ?? 0) === n;
                              return (
                                <button key={n} type="button" onClick={() => f("unwindDirection" as any, n)}
                                  title={label.replace("\n", " ")}
                                  className={`flex flex-col items-center gap-1 p-1.5 rounded-xl border-2 transition-all ${sel ? "border-orange-500 bg-orange-50 shadow-sm" : "border-gray-200 bg-white hover:border-orange-300 hover:bg-orange-50/40"}`}>
                                  {svg}
                                  <span className={`text-[11px] font-black leading-none ${sel ? "text-orange-600" : "text-gray-600"}`}>Pifa {n}</span>
                                  <span className={`text-[7.5px] font-medium text-center leading-tight whitespace-pre-line ${sel ? "text-orange-500" : "text-gray-400"}`}>{label}</span>
                                </button>
                              );
                            })}
                          </div>
                          {(form as any).unwindDirection > 0 && (
                            <p className="mt-1.5 text-[10px] text-orange-600 font-semibold flex items-center gap-1">
                              <Check size={10}/> Pifa {(form as any).unwindDirection} selected
                            </p>
                          )}
                        </div>
                      </div>
                      {/* Right: live diagram */}
                      <DimensionDiagram contentType={form.content} dims={dimValues} />
                    </div>
                  </div>
                ) : (
                  /* Fallback simple inputs when no content type selected */
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <Input label="Job Width (mm)" type="number"
                      value={form.jobWidth || ""}
                      onChange={e => { const v = Number(e.target.value); setForm(p => ({ ...p, jobWidth: v, width: v, actualWidth: v })); }}
                    />
                    <Input label="Job Height (mm)" type="number"
                      value={form.jobHeight || ""}
                      onChange={e => { const v = Number(e.target.value); setForm(p => ({ ...p, jobHeight: v, actualHeight: v })); }}
                    />
                    <Input label="Trimming Size (mm)" type="number"
                      value={form.trimmingSize || ""}
                      onChange={e => f("trimmingSize", parseFloat(e.target.value) || 0)}
                      placeholder="e.g. 118"
                    />
                    <Input label="Actual Width" type="number" value={form.actualWidth || ""} onChange={e => f("actualWidth", Number(e.target.value))} />
                    <Input label="Actual Height" type="number" value={form.actualHeight || ""} onChange={e => f("actualHeight", Number(e.target.value))} />
                    <Input label="Front Colors" type="number"
                      value={form.frontColors ?? ""}
                      onChange={e => { const fc = Number(e.target.value) || 0; setForm(p => ({ ...p, frontColors: fc, noOfColors: fc + (p.backColors ?? 0) })); }}
                      min={0} max={12}
                    />
                    <Input label="Back Colors" type="number"
                      value={form.backColors ?? ""}
                      onChange={e => { const bc = Number(e.target.value) || 0; setForm(p => ({ ...p, backColors: bc, noOfColors: (p.frontColors ?? 0) + bc })); }}
                      min={0} max={12}
                    />
                  </div>
                )}

            {/* ── Section: Ply Configuration ── */}
            <div className="mt-4 border-t border-purple-100 pt-4">
              <div className="flex items-center justify-between mb-2">
                <SectionHeader label={`Ply Configuration (${form.secondaryLayers.length} plys)`} />
                <div className="flex items-center gap-2">
                  {/* Bulk add */}
                  {(() => {
                    let inputRef: HTMLInputElement | null = null;
                    const addBulk = (el: HTMLInputElement | null) => {
                      const n = Math.min(10, Math.max(1, parseInt(el?.value ?? "1") || 1));
                      const layers = [...form.secondaryLayers];
                      for (let k = 0; k < n; k++) layers.push({ id: Math.random().toString(), layerNo: layers.length + 1, plyType: "", itemSubGroup: "", density: 0, thickness: 0, gsm: 0, consumableItems: [] });
                      f("secondaryLayers", layers);
                      if (el) el.value = "";
                    };
                    return (
                      <div className="flex items-center gap-0 border border-purple-300 rounded-lg overflow-hidden bg-white">
                        <span className="text-[10px] font-semibold text-purple-600 px-2 bg-purple-50 whitespace-nowrap border-r border-purple-200 py-1.5">Add</span>
                        <input type="number" min={1} max={10} placeholder="1" ref={el => { inputRef = el; }}
                          className="w-12 text-xs font-mono text-center border-none outline-none px-1 py-1.5 bg-white"
                          onKeyDown={e => { if (e.key === "Enter") addBulk(e.target as HTMLInputElement); }} />
                        <button onClick={() => addBulk(inputRef)}
                          className="text-[10px] font-bold text-white bg-purple-600 hover:bg-purple-700 px-2 py-1.5 whitespace-nowrap transition">+ Plys</button>
                      </div>
                    );
                  })()}
                  <button onClick={() => {
                    const layers = [...form.secondaryLayers];
                    layers.push({ id: Math.random().toString(), layerNo: layers.length + 1, plyType: "", itemSubGroup: "", density: 0, thickness: 0, gsm: 0, consumableItems: [] });
                    f("secondaryLayers", layers);
                  }} className="flex items-center gap-1.5 text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg border border-purple-200">
                    <Plus size={12} /> Add Ply
                  </button>
                </div>
              </div>

              {form.secondaryLayers.length > 0 && (
                <div className="space-y-3">
                  {form.secondaryLayers.map((l, index) => {
                    const thicknesses = FILM_SUBGROUPS.find(s => s.subGroup === l.itemSubGroup)?.thicknesses || [];
                    return (
                      <div key={l.id} className="bg-white border-2 border-purple-50 rounded-2xl shadow-sm relative overflow-hidden">
                        {/* Ply header */}
                        <div className="flex items-center justify-between bg-purple-50 px-4 py-2 border-b border-purple-100">
                          <span className="text-xs font-bold text-purple-700 uppercase tracking-wider">
                            {l.layerNo === 1 ? "1st" : l.layerNo === 2 ? "2nd" : l.layerNo === 3 ? "3rd" : `${l.layerNo}th`} Ply
                          </span>
                          <button onClick={() => f("secondaryLayers", form.secondaryLayers.filter((_, i) => i !== index))}
                            className="text-red-400 hover:text-red-600"><X size={14} /></button>
                        </div>

                        <div className="p-3 space-y-3">
                          {/* Ply Type */}
                          <div>
                            <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Ply Type *</label>
                            <select className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-purple-400"
                              value={l.plyType} onChange={e => onPlyTypeChange(index, e.target.value)}>
                              <option value="">-- Select Ply Type --</option>
                              <option value="Film">Ply 1</option>
                              <option value="Printing">Ply 2</option>
                              <option value="Lamination">Ply 3</option>
                              <option value="Coating">Ply 4</option>
                            </select>
                          </div>

                          {/* Film substrate */}
                          {l.plyType && (
                            <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-3 space-y-3">
                              <div>
                                <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Film Type</label>
                                <select className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-purple-400"
                                  value={l.itemSubGroup}
                                  onChange={e => {
                                    const sg = FILM_SUBGROUPS.find(s => s.subGroup === e.target.value);
                                    const layers = [...form.secondaryLayers];
                                    layers[index] = { ...l, itemSubGroup: e.target.value, density: sg?.density ?? 0, thickness: 0, gsm: 0, filmRate: parseFloat(FILM_ITEMS.find(fi => fi.subGroup === e.target.value)?.estimationRate || "0") };
                                    f("secondaryLayers", layers);
                                  }}>
                                  <option value="">Select Film Type</option>
                                  {FILM_SUBGROUPS.map(opt => <option key={opt.subGroup} value={opt.subGroup}>{opt.subGroup}</option>)}
                                </select>
                              </div>
                              <div className="grid grid-cols-4 gap-2">
                                <Input label="Density" type="number" value={l.density || ""} readOnly className="bg-gray-50 text-gray-400 text-xs" />
                                <div>
                                  <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Thickness (μ)</label>
                                  <select className="w-full text-xs border border-gray-200 rounded-xl px-2 py-2 bg-white outline-none focus:ring-2 focus:ring-purple-400"
                                    value={l.thickness}
                                    onChange={e => {
                                      const t = Number(e.target.value);
                                      const layers = [...form.secondaryLayers];
                                      layers[index] = { ...l, thickness: t, gsm: parseFloat((t * l.density).toFixed(3)) };
                                      f("secondaryLayers", layers);
                                    }}>
                                    <option value={0}>Select</option>
                                    {thicknesses.map(t => <option key={t} value={t}>{t}</option>)}
                                  </select>
                                </div>
                                <Input label="Film GSM" type="number" value={l.gsm || ""} readOnly className="font-bold bg-purple-50 text-purple-800 border-purple-200 text-xs" />
                                <div>
                                  <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Film Rate (₹/Kg)</label>
                                  <input type="number" step={0.01} min={0} placeholder="₹/Kg"
                                    className="w-full text-xs border border-orange-200 bg-orange-50 rounded-xl px-2 py-2 font-mono outline-none focus:ring-2 focus:ring-orange-400"
                                    value={l.filmRate !== undefined ? l.filmRate : (parseFloat(FILM_ITEMS.find(fi => fi.subGroup === l.itemSubGroup)?.estimationRate || "0") || "")}
                                    onChange={e => { const layers = [...form.secondaryLayers]; layers[index] = { ...l, filmRate: Number(e.target.value) }; f("secondaryLayers", layers); }} />
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Consumable Items */}
                          {l.plyType && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-teal-700 uppercase tracking-widest">Consumable Items ({l.consumableItems.length})</span>
                                <button onClick={() => addPlyConsumable(index)}
                                  className="flex items-center gap-1 text-[10px] font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 px-2.5 py-1 rounded-lg border border-teal-200 transition">
                                  <Plus size={10} /> Add Consumable
                                </button>
                              </div>

                              {(() => {
                                // per-group serial numbers
                                const groupSerials: number[] = [];
                                const groupCounter: Record<string, number> = {};
                                l.consumableItems.forEach(ci => {
                                  const g = ci.itemGroup || "Consumable";
                                  groupCounter[g] = (groupCounter[g] || 0) + 1;
                                  groupSerials.push(groupCounter[g]);
                                });
                                return l.consumableItems.map((ci, ciIdx) => {
                                  const CONSUMABLE_GROUPS = ["Ink", "Solvent", "Adhesive", "Hardner"];
                                  const subGroups = ci.itemGroup ? (CATEGORY_GROUP_SUBGROUP["Raw Material (RM)"]?.[ci.itemGroup] ?? []) : [];
                                  const filteredItems = items.filter(it => it.group === ci.itemGroup && it.active && (!ci.itemSubGroup || it.subGroup === ci.itemSubGroup));
                                  const ciLabel = ci.itemGroup || "Consumable";
                                  const ciSerial = groupSerials[ciIdx] ?? 1;

                                  // Ink-specific calculations
                                  const dryGSM   = ci.itemGroup === "Ink" ? (ci.gsm || 0) : 0;
                                  const solid    = ci.itemGroup === "Ink" ? ((items.find(x => x.id === ci.itemId) as any)?.solidPct ?? 40) : 40;
                                  const liquidGSM = dryGSM > 0 && solid > 0 ? parseFloat((dryGSM / (solid / 100)).toFixed(2)) : 0;

                                  // Adhesive OH%
                                  const adhGSM  = ci.itemGroup === "Adhesive" ? (ci.gsm || 0) : 0;
                                  const ohPct   = ci.itemGroup === "Adhesive" ? (ci.ohPct ?? 50) : 0;

                                  // Hardener NCO%
                                  const ncoPct  = ci.itemGroup === "Hardner" ? (ci.ncoPct ?? 12) : 0;

                                  return (
                                    <div key={ci.consumableId} className="bg-teal-50/40 border border-teal-100 rounded-xl p-3">
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="text-[10px] font-bold text-teal-700 uppercase">{ciLabel} {ciSerial}</span>
                                        <div className="flex items-center gap-1">
                                          <button onClick={() => {
                                            const layers = [...form.secondaryLayers];
                                            const layer = { ...layers[index] };
                                            const clone = { ...layer.consumableItems[ciIdx], consumableId: Math.random().toString(), isClone: true };
                                            layer.consumableItems = [...layer.consumableItems.slice(0, ciIdx + 1), clone, ...layer.consumableItems.slice(ciIdx + 1)];
                                            layers[index] = layer;
                                            f("secondaryLayers", layers);
                                          }} className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition">
                                            Clone
                                          </button>
                                          <button onClick={() => removePlyConsumable(index, ciIdx)}
                                            className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"><X size={12} /></button>
                                        </div>
                                      </div>

                                      {/* Row 1: Group / SubGroup / Item / Rate */}
                                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                                        <div>
                                          <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Item Group</label>
                                          <select className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white outline-none focus:ring-2 focus:ring-teal-400"
                                            value={ci.itemGroup}
                                            onChange={e => updatePlyConsumable(index, ciIdx, { itemGroup: e.target.value, itemSubGroup: "", itemId: "", itemName: "", gsm: 0, coveragePct: undefined, ohPct: undefined, ncoPct: undefined })}>
                                            <option value="">-- Group --</option>
                                            {CONSUMABLE_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                                          </select>
                                        </div>
                                        <div>
                                          <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Sub Group</label>
                                          <select className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white outline-none focus:ring-2 focus:ring-teal-400"
                                            value={ci.itemSubGroup}
                                            onChange={e => updatePlyConsumable(index, ciIdx, { itemSubGroup: e.target.value, itemId: "", itemName: "" })}
                                            disabled={!ci.itemGroup}>
                                            <option value="">-- Sub Group --</option>
                                            {subGroups.map(sg => <option key={sg} value={sg}>{sg}</option>)}
                                          </select>
                                        </div>
                                        <div>
                                          <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Item (Master)</label>
                                          <select className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white outline-none focus:ring-2 focus:ring-teal-400"
                                            value={ci.itemId}
                                            onChange={e => {
                                              const it = filteredItems.find(x => x.id === e.target.value);
                                              updatePlyConsumable(index, ciIdx, { itemId: it?.id ?? "", itemName: it?.name ?? "", rate: parseFloat(it?.estimationRate ?? "0") || 0 });
                                            }}
                                            disabled={!ci.itemGroup}>
                                            <option value="">-- Select Item --</option>
                                            {filteredItems.map(it => <option key={it.id} value={it.id}>{it.name}{it.estimationRate ? ` — ₹${it.estimationRate}/Kg` : ""}</option>)}
                                          </select>
                                        </div>
                                        <div>
                                          <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Rate (₹/Kg)</label>
                                          <input type="number" step={0.01} min={0} placeholder="₹/Kg"
                                            className="w-full text-xs border border-orange-200 bg-orange-50 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-orange-400 font-mono"
                                            value={ci.rate || ""}
                                            onChange={e => updatePlyConsumable(index, ciIdx, { rate: Number(e.target.value) })} />
                                        </div>
                                      </div>

                                      {/* Row 2: Group-specific fields */}
                                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                                        {ci.itemGroup === "Ink" && (<>
                                          <div>
                                            <label className="text-[10px] font-semibold text-blue-600 uppercase block mb-1">Dry Ink GSM</label>
                                            <input type="number" step={0.1} min={0} placeholder="GSM"
                                              className="w-full text-xs border border-blue-200 bg-blue-50 rounded-lg px-2 py-1.5 font-mono outline-none focus:ring-2 focus:ring-blue-400"
                                              value={ci.gsm || ""}
                                              onChange={e => updatePlyConsumable(index, ciIdx, { gsm: Number(e.target.value) })} />
                                          </div>
                                          <div>
                                            <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">% Solid</label>
                                            <input type="number" readOnly value={solid}
                                              className="w-full text-xs border border-gray-200 bg-gray-50 rounded-lg px-2 py-1.5 font-mono text-gray-500" />
                                          </div>
                                          <div>
                                            <label className="text-[10px] font-semibold text-indigo-600 uppercase block mb-1">Liquid GSM</label>
                                            <input type="number" readOnly value={liquidGSM || ""}
                                              className="w-full text-xs border border-indigo-200 bg-indigo-50 rounded-lg px-2 py-1.5 font-mono font-bold text-indigo-700" />
                                          </div>
                                          <div>
                                            <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Coverage %</label>
                                            <input type="number" step={1} min={1} max={100} placeholder="100"
                                              className="w-full text-xs border border-blue-200 rounded-lg px-2 py-1.5 bg-blue-50 outline-none focus:ring-2 focus:ring-blue-400 font-mono"
                                              value={ci.coveragePct ?? 100}
                                              onChange={e => updatePlyConsumable(index, ciIdx, { coveragePct: Math.min(100, Math.max(1, Number(e.target.value))) })} />
                                          </div>
                                        </>)}

                                        {ci.itemGroup === "Solvent" && (<>
                                          <div>
                                            <label className="text-[10px] font-semibold text-teal-600 uppercase block mb-1">Ratio (%)</label>
                                            <input type="number" step={0.1} min={0} max={100} placeholder="%"
                                              className="w-full text-xs border border-teal-200 bg-teal-50 rounded-lg px-2 py-1.5 font-mono outline-none focus:ring-2 focus:ring-teal-400"
                                              value={ci.gsm || ""}
                                              onChange={e => updatePlyConsumable(index, ciIdx, { gsm: Number(e.target.value) })} />
                                          </div>
                                        </>)}

                                        {ci.itemGroup === "Adhesive" && (<>
                                          <div>
                                            <label className="text-[10px] font-semibold text-violet-600 uppercase block mb-1">GSM</label>
                                            <input type="number" step={0.1} min={0} placeholder="GSM"
                                              className="w-full text-xs border border-violet-200 bg-violet-50 rounded-lg px-2 py-1.5 font-mono outline-none focus:ring-2 focus:ring-violet-400"
                                              value={ci.gsm || ""}
                                              onChange={e => updatePlyConsumable(index, ciIdx, { gsm: Number(e.target.value) })} />
                                          </div>
                                          <div>
                                            <label className="text-[10px] font-semibold text-orange-500 uppercase block mb-1">OH %</label>
                                            <input type="number" step={0.1} min={0} max={100} placeholder="OH%"
                                              className="w-full text-xs border border-orange-200 bg-orange-50 rounded-lg px-2 py-1.5 font-mono outline-none focus:ring-2 focus:ring-orange-400"
                                              value={ci.ohPct ?? ""}
                                              onChange={e => updatePlyConsumable(index, ciIdx, { ohPct: Number(e.target.value) })} />
                                          </div>
                                        </>)}

                                        {ci.itemGroup === "Hardner" && (<>
                                          <div>
                                            <label className="text-[10px] font-semibold text-pink-600 uppercase block mb-1">NCO %</label>
                                            <input type="number" step={0.1} min={0} max={100} placeholder="NCO%"
                                              className="w-full text-xs border border-pink-200 bg-pink-50 rounded-lg px-2 py-1.5 font-mono outline-none focus:ring-2 focus:ring-pink-400"
                                              value={ci.ncoPct ?? ""}
                                              onChange={e => updatePlyConsumable(index, ciIdx, { ncoPct: Number(e.target.value) })} />
                                          </div>
                                        </>)}

                                        {!["Ink","Solvent","Adhesive","Hardner"].includes(ci.itemGroup) && (
                                          <div>
                                            <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">GSM / Wt.</label>
                                            <input type="number" step={0.1} min={0}
                                              className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white outline-none focus:ring-2 focus:ring-teal-400 font-mono"
                                              value={ci.gsm || ""}
                                              onChange={e => updatePlyConsumable(index, ciIdx, { gsm: Number(e.target.value) })} />
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                });
                              })()}

                              {l.consumableItems.length === 0 && (
                                <p className="text-[10px] text-gray-400 italic text-center py-2">Click "+ Add Consumable" to add ink, solvent, adhesive, etc.</p>
                              )}

                              {/* Ply Summary Strip */}
                              {l.consumableItems.length > 0 && (() => {
                                const groupCount: Record<string, number> = {};
                                l.consumableItems.forEach(ci => { const g = ci.itemGroup || "Other"; groupCount[g] = (groupCount[g] || 0) + 1; });
                                const inks = l.consumableItems.filter(ci => ci.itemGroup === "Ink");
                                const totalDryGSM = inks.reduce((s, ci) => s + (parseFloat(String(ci.gsm)) || 0), 0);
                                const avgSolid = inks.length > 0 ? inks.reduce((s, ci) => { const it = items.find(x => x.id === ci.itemId); return s + ((it as any)?.solidPct ?? 35); }, 0) / inks.length : 0;
                                const GROUP_COLOR: Record<string, string> = { Ink: "bg-blue-100 text-blue-700 border-blue-200", Solvent: "bg-teal-100 text-teal-700 border-teal-200", Adhesive: "bg-violet-100 text-violet-700 border-violet-200", Hardner: "bg-orange-100 text-orange-700 border-orange-200", Other: "bg-gray-100 text-gray-600 border-gray-200" };
                                return (
                                  <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl mt-2">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Ply Summary:</span>
                                    {Object.entries(groupCount).map(([g, cnt]) => (
                                      <span key={g} className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${GROUP_COLOR[g] ?? GROUP_COLOR.Other}`}>{g}: <strong>{cnt}</strong></span>
                                    ))}
                                    {inks.length > 0 && (<>
                                      <span className="w-px h-3 bg-slate-300 mx-1" />
                                      <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">Total Dry GSM: <strong>{totalDryGSM.toFixed(1)}</strong></span>
                                      <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">Avg Solid: <strong>{avgSolid.toFixed(1)}%</strong></span>
                                    </>)}
                                  </div>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Trimming ── */}
            <div className="border border-amber-200 rounded-2xl p-4 bg-amber-50/40">
              <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-widest mb-2">Trimming</p>
              <div className="flex items-center gap-4">
                <div style={{ maxWidth: 220 }}>
                  <label className="text-[10px] font-semibold text-amber-500 uppercase block mb-1">Trimming Both Side (mm)</label>
                  <input type="number" min={0} step={0.5} placeholder="e.g. 5"
                    className="w-full text-sm border border-amber-300 rounded-xl px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-amber-400 font-mono"
                    value={form.trimmingSize || ""}
                    onChange={e => f("trimmingSize", parseFloat(e.target.value) || 0)} />
                </div>
                {(form.trimmingSize || 0) > 0 && (
                  <div className="text-xs text-amber-700 bg-amber-100 border border-amber-200 rounded-xl px-3 py-2 font-semibold">
                    Both sides: {form.trimmingSize}+{form.trimmingSize} mm &nbsp;·&nbsp; Total trim: {(form.trimmingSize || 0) * 2} mm
                  </div>
                )}
              </div>
            </div>
               </div>
             </div>
          </div>
        )}

        {/* TAB 2: PRODUCTION PLAN */}
        {activeTab === 2 && (
          <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">

            {/* ── Machine & Cylinder Cost ── */}
            <div>
              <SectionHeader label="Machine & Process Selection" />
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mb-3">
                <div className="sm:col-span-2">
                  <Select label="Printing Machine (Machine Master)"
                    value={form.machineId}
                    onChange={e => {
                      const m = PRINT_MACHINES.find(x => x.id === e.target.value);
                      setForm(p => ({
                        ...p,
                        machineId: e.target.value,
                        machineName: m?.name || "",
                        machineCostPerHour: parseFloat(m?.costPerHour as string) || p.machineCostPerHour,
                      }));
                    }}
                    options={[{ value: "", label: "-- All Machines --" }, ...PRINT_MACHINES.map(m => ({ value: m.id, label: `${m.name} (${m.status}) – ₹${m.costPerHour}/hr` }))]}
                  />
                </div>
                <Input label="Machine Cost / Hr (₹)" type="number" value={form.machineCostPerHour}
                  onChange={e => f("machineCostPerHour", Number(e.target.value))} />
              </div>

              {/* Machine Specs bar */}
              {form.machineId && (() => {
                const selMachine = PRINT_MACHINES.find(m => m.id === form.machineId);
                if (!selMachine) return null;
                const minW    = parseFloat((selMachine as any).minWebWidth)    || 0;
                const maxW    = parseFloat((selMachine as any).maxWebWidth)    || 0;
                const minCirc = parseFloat((selMachine as any).repeatLengthMin) || 0;
                const maxCirc = parseFloat((selMachine as any).repeatLengthMax) || 0;
                const colors  = (selMachine as any).noOfColors || "";
                const speed   = (selMachine as any).speedMax   || "";
                return (
                  <div className="flex flex-wrap items-center gap-2 mb-3 px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl text-[11px]">
                    <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">Machine Specs:</span>
                    <span className="flex flex-wrap items-center gap-1 text-[11px] font-semibold text-blue-800">
                      {minCirc > 0 && <span className="px-2 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-amber-800">Min Circ: <strong>{minCirc} mm</strong></span>}
                      {maxCirc > 0 && <span className="px-2 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-amber-800">Max Circ: <strong>{maxCirc} mm</strong></span>}
                      {minW > 0 && <span className="px-2 py-0.5 rounded-full bg-orange-100 border border-orange-300 text-orange-800">Min Width: <strong>{minW} mm</strong></span>}
                      {maxW > 0 && <span className="px-2 py-0.5 rounded-full bg-orange-100 border border-orange-300 text-orange-800">Max Width: <strong>{maxW} mm</strong></span>}
                      {colors && <span className="px-2 py-0.5 rounded-full bg-indigo-100 border border-indigo-300 text-indigo-700">Colors: <strong>{colors}</strong></span>}
                      {speed  && <span className="px-2 py-0.5 rounded-full bg-green-100 border border-green-300 text-green-700">Speed: <strong>{speed} m/min</strong></span>}
                    </span>
                  </div>
                );
              })()}

              {/* Cylinder cost fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                <Input label="Cylinder Cost / Color (₹)" type="number"
                  value={form.cylinderCostPerColor}
                  onChange={e => f("cylinderCostPerColor", Number(e.target.value))} />
                <Input label="Cylinder Rate (₹/sq.inch)" type="number"
                  value={form.cylinderRatePerSqInch ?? ""}
                  onChange={e => f("cylinderRatePerSqInch", Number(e.target.value))}
                  placeholder="e.g. 2.5" />
              </div>

              {/* Summary badges */}
              <div className="flex flex-wrap gap-2 mb-3">
                {(form.cylinderRatePerSqInch ?? 0) > 0 ? (
                  <span className="text-xs px-3 py-1 bg-violet-50 text-violet-700 border border-violet-200 rounded-full font-semibold">
                    Cylinder costing: area × ₹{form.cylinderRatePerSqInch}/sq.in × {form.noOfColors} colors — shown per plan row
                  </span>
                ) : (
                  <span className="text-xs px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full font-semibold">
                    Cylinder Cost (per color): ₹{(form.cylinderCostPerColor * form.noOfColors).toLocaleString()} ({form.noOfColors}C × ₹{form.cylinderCostPerColor})
                  </span>
                )}
                {form.setupTime > 0 && (
                  <span className="text-xs px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full font-semibold">
                    Setup Cost: ₹{((form.setupTime / 60) * form.machineCostPerHour).toFixed(0)} ({form.setupTime} min × ₹{form.machineCostPerHour}/hr)
                  </span>
                )}
              </div>

              {!form.machineId && (
                <p className="text-[10px] text-blue-600 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                  No machine selected — plans will be shown for all {PRINT_MACHINES.length} gravure machines.
                </p>
              )}

            </div>

            {/* ── Process List ── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-600">Process List (from Process Master)</p>
                <button onClick={addProcess} className="flex items-center gap-1.5 text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg border border-purple-200 transition">
                  <Plus size={12} /> Add Process
                </button>
              </div>
              {form.processes.length > 0 ? (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                  <table className="min-w-full text-xs">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        {["Process (Master)", "Charge Unit", "Rate (₹)", "Qty", "Setup (₹)", "Amount (₹)", ""].map(h => (
                          <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {form.processes.map((pr, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-3 py-2 min-w-[200px]">
                            <select value={pr.processId} onChange={e => selectProcess(i, e.target.value)} className={cellInput}>
                              <option value="">-- Select Process --</option>
                              {ROTO_PROCESSES.map(pm => <option key={pm.id} value={pm.id}>{pm.name} ({pm.department})</option>)}
                            </select>
                          </td>
                          <td className="px-3 py-2"><span className="px-2 py-1 bg-gray-100 rounded-lg text-gray-600 font-mono text-[10px]">{pr.chargeUnit || "—"}</span></td>
                          <td className="px-3 py-2 w-24"><input type="number" value={pr.rate} onChange={e => updateProcess(i, { rate: Number(e.target.value) })} className={`${cellInput} text-right`} step={0.01} /></td>
                          <td className="px-3 py-2 w-24"><input type="number" value={pr.qty} onChange={e => updateProcess(i, { qty: Number(e.target.value) })} className={`${cellInput} text-right`} /></td>
                          <td className="px-3 py-2 w-28"><input type="number" value={pr.setupCharge} onChange={e => updateProcess(i, { setupCharge: Number(e.target.value) })} className={`${cellInput} text-right`} /></td>
                          <td className="px-3 py-2 w-32 text-right font-semibold text-gray-800">₹{pr.amount.toLocaleString()}</td>
                          <td className="px-3 py-2 w-8 text-center"><button onClick={() => removeProcess(i)} className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50"><X size={13} /></button></td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-purple-50 border-t border-purple-200">
                      <tr>
                        <td colSpan={5} className="px-3 py-2.5 text-xs font-bold text-purple-700 uppercase">Process Cost</td>
                        <td className="px-3 py-2.5 text-sm font-bold text-purple-800 text-right">₹{costs.processCost.toLocaleString()}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <div className="border-2 border-dashed border-gray-200 rounded-xl py-5 text-center text-xs text-gray-400">
                  No processes added yet. Click "+ Add Process" to add.
                </div>
              )}
            </div>

            {/* ── Production Plan Toggle ── */}
            <div className="flex justify-end">
              <Button onClick={() => setShowPlan(p => !p)} variant="secondary" icon={<Eye size={14} />}>
                {showPlan ? "Hide Production Plan" : "View Production Plan"}
              </Button>
            </div>

            {/* ── Applied Plan Summary (shown when plan is applied and panel is open) ── */}
            {showPlan && isPlanApplied && selectedPlan && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-600 text-white text-[10px] font-bold rounded-full"><Check size={10} /> Plan Applied</span>
                    <span className="text-xs font-bold text-green-800">{selectedPlan.machineName}</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div><p className="text-gray-400 text-[10px]">UPS Across</p><p className="font-bold text-gray-800">{selectedPlan.acUps}</p></div>
                    <div><p className="text-gray-400 text-[10px]">Printing W</p><p className="font-bold text-gray-800">{selectedPlan.printingWidth} mm</p></div>
                    <div><p className="text-gray-400 text-[10px]">Cylinder Circ</p><p className="font-bold text-gray-800">{selectedPlan.cylCirc} mm</p></div>
                    <div><p className="text-gray-400 text-[10px]">Film Size</p><p className="font-bold text-gray-800">{selectedPlan.filmSize} mm</p></div>
                    <div><p className="text-gray-400 text-[10px]">Sleeve W</p><p className="font-bold text-blue-700">{selectedPlan.sleeveWidthVal} mm ({selectedPlan.sleeveName})</p></div>
                    <div><p className="text-gray-400 text-[10px]">Side Waste</p><p className="font-bold text-orange-600">{selectedPlan.sideWaste} mm</p></div>
                    <div><p className="text-gray-400 text-[10px]">Total Waste</p><p className="font-bold text-orange-600">{selectedPlan.totalWaste} mm</p></div>
                    <div><p className="text-gray-400 text-[10px]">Grand Total</p><p className="font-bold text-green-700">₹{selectedPlan.grandTotal.toLocaleString()}</p></div>
                  </div>
                </div>
                <button
                  onClick={() => { setIsPlanApplied(false); setSelectedPlanId(null); }}
                  className="flex-shrink-0 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 px-3 py-1.5 rounded-lg transition">
                  Change Plan
                </button>
              </div>
            )}

            {/* ── Production Plan Selection Table ── */}
            {showPlan && !isPlanApplied && (
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-gray-800">Production Plan Selection</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">{form.machineId ? `Machine: ${form.machineName}` : `Showing all ${PRINT_MACHINES.length} gravure machines`} · {visiblePlans.length}/{allPlans.length} plans</p>
                    </div>
                    {selectedPlanId && (
                      <Button onClick={() => setIsPlanApplied(true)} icon={<Check size={13} />}>Apply Selected Plan</Button>
                    )}
                  </div>
                  <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-1.5">
                    <Search size={13} className="text-gray-400 shrink-0" />
                    <input
                      type="text"
                      placeholder="Search machine, UPS, circ..."
                      value={planSearch}
                      onChange={e => setPlanSearch(e.target.value)}
                      className="flex-1 text-xs outline-none placeholder-gray-400 bg-transparent"
                    />
                    {planSearch && <button onClick={() => setPlanSearch("")} className="text-gray-400 hover:text-gray-600"><X size={12} /></button>}
                  </div>
                </div>

                {/* Desktop table */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="min-w-full text-xs whitespace-nowrap">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-3 py-2.5 w-8" />
                        {([
                          { label: "Machine",           key: "" },
                          { label: "AC UPS",            key: "acUps" },
                          { label: "Printing W (mm)",   key: "printingWidth" },
                          { label: "Sleeve",            key: "" },
                          { label: "Sleeve W (mm)",     key: "sleeveWidthVal",   waste: true },
                          { label: "Side Waste (mm)",   key: "sideWaste",        waste: true },
                          { label: "Film Size (mm)",    key: "filmSize" },
                          { label: "Dead Margin (mm)",  key: "deadMargin",       waste: true },
                          { label: "Total Waste (mm)",  key: "totalWaste",       waste: true },
                          { label: "Cylinder",          key: "" },
                          { label: "Cylinder W (mm)",   key: "cylinderWidthVal" },
                          { label: "Cyl Extra (mm)",    key: "cylExtra" },
                          { label: "Cyl Circ (mm)",     key: "cylRepeatLength" },
                          { label: "Cyl Area (sq.in)",  key: "cylAreaSqInch" },
                          { label: "Rate (₹/sq.in)",    key: "" },
                          { label: "Cyl Cost (₹)",      key: "cylCostByArea" },
                          { label: "Repeat UPS",        key: "repeatUPS" },
                          { label: "Total UPS",         key: "totalUPS" },
                          { label: "Req. RMT",          key: "reqRMT" },
                          { label: "Total RMT",         key: "totalRMT" },
                          { label: "Total Wt (Kg)",     key: "totalWt" },
                          { label: "Total Time",        key: "totalTime" },
                          { label: "Plan Cost",         key: "planCost" },
                          { label: "Grand Total",       key: "grandTotal" },
                          { label: "Unit Price",        key: "unitPrice" },
                        ] as { label: string; key: string; waste?: boolean }[]).map(col => (
                          <th
                            key={col.label}
                            onClick={() => col.key && togglePlanSort(col.key)}
                            className={`px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider select-none ${col.waste && (form.sleeveWidth ?? 0) > 0 ? "text-orange-600 bg-orange-50" : "text-gray-500"} ${col.key ? "cursor-pointer hover:text-gray-800" : ""}`}
                          >
                            <span className="inline-flex items-center gap-1">
                              {col.label}
                              {col.key && (
                                <span className="text-[9px] text-gray-400">
                                  {planSort.key === col.key ? (planSort.dir === "asc" ? "▲" : "▼") : "⇅"}
                                </span>
                              )}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {visiblePlans.map(plan => {
                        const isSel = selectedPlanId === plan.planId;
                        return (
                          <tr key={plan.planId} onClick={() => setSelectedPlanId(plan.planId)}
                            className={`cursor-pointer transition-colors ${(plan as any).isSpecialSleeve ? "bg-rose-50 hover:bg-rose-100" : (plan as any).isSpecial ? "bg-amber-50 hover:bg-amber-100" : plan.isBest ? "ring-2 ring-inset ring-green-400 bg-green-50" : isSel ? "bg-purple-50 hover:bg-purple-100" : "hover:bg-gray-50"}`}>
                            <td className="px-3 py-2.5 w-8">
                              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${isSel ? "border-purple-600 bg-purple-600" : "border-gray-300"}`}>
                                {isSel && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                              </div>
                            </td>
                            <td className="px-2 py-2.5 w-8">
                              <button
                                onClick={e => { e.stopPropagation(); setUpsPreviewPlan(plan); }}
                                className="p-1 text-indigo-400 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition"
                                title="View UPS Layout">
                                <Eye size={13} />
                              </button>
                            </td>
                            <td className="px-3 py-2.5 font-medium text-gray-800 whitespace-nowrap">
                              {plan.machineName}
                              {plan.isBest && <span className="ml-1.5 px-1.5 py-0.5 bg-green-500 text-white text-[9px] font-bold rounded-full">BEST</span>}
                              {(plan as any).isSpecial && !(plan as any).isSpecialSleeve && <span className="ml-1.5 px-1.5 py-0.5 bg-amber-500 text-white text-[9px] font-bold rounded-full">SPECIAL CYL</span>}
                              {(plan as any).isSpecialSleeve && <span className="ml-1.5 px-1.5 py-0.5 bg-rose-500 text-white text-[9px] font-bold rounded-full">SPECIAL SLV</span>}
                            </td>
                            <td className="px-3 py-2.5 text-center font-bold text-indigo-700">{plan.acUps}</td>
                            <td className="px-3 py-2.5 text-center text-gray-600 font-mono">{plan.printingWidth}</td>
                            {/* Sleeve */}
                            <td className="px-3 py-2.5 whitespace-nowrap">
                              <div className="flex flex-col">
                                <span className={`text-[10px] font-semibold ${(plan as any).isSpecialSleeve ? "text-rose-600" : "text-sky-700"}`}>{plan.sleeveCode}</span>
                                <span className={`text-[9px] truncate max-w-[140px] ${(plan as any).isSpecialSleeve ? "text-rose-500 font-semibold" : "text-gray-500"}`} title={plan.sleeveName}>{plan.sleeveName}</span>
                              </div>
                            </td>
                            <td className={`px-3 py-2.5 text-center font-mono font-semibold ${(plan as any).isSpecialSleeve ? "text-rose-600" : "text-sky-700"}`}>{plan.sleeveWidthVal}</td>
                            <td className={`px-3 py-2.5 text-center font-mono font-semibold ${plan.sideWaste > 30 ? "text-orange-600" : "text-green-600"}`}>{plan.sideWaste}</td>
                            <td className="px-3 py-2.5 text-center text-gray-500 font-mono">{plan.filmSize}</td>
                            <td className={`px-3 py-2.5 text-center font-mono font-semibold ${plan.deadMargin > 100 ? "text-orange-600" : "text-amber-600"}`}>{plan.deadMargin}</td>
                            <td className={`px-3 py-2.5 text-center font-bold ${plan.isBest ? "text-green-700" : plan.totalWaste > 300 ? "text-red-600" : "text-amber-600"}`}>{plan.totalWaste}</td>
                            {/* Cylinder */}
                            <td className="px-3 py-2.5 whitespace-nowrap">
                              <div className="flex flex-col">
                                <span className={`text-[10px] font-semibold ${(plan as any).isSpecial ? "text-amber-600" : "text-violet-700"}`}>{plan.cylinderCode}</span>
                                <span className={`text-[9px] truncate max-w-[140px] ${(plan as any).isSpecial ? "text-amber-500 font-semibold" : "text-gray-500"}`} title={plan.cylinderName}>{plan.cylinderName}</span>
                              </div>
                            </td>
                            <td className={`px-3 py-2.5 text-center font-mono font-semibold ${(plan as any).isSpecial ? "text-amber-600" : "text-violet-700"}`}>{plan.cylinderWidthVal}</td>
                            <td className="px-3 py-2.5 text-center font-bold">
                              {(() => {
                                const extra = Math.round(plan.cylinderWidthVal - plan.sleeveWidthVal - 100);
                                return extra > 0
                                  ? <span className="text-orange-600">+{extra}</span>
                                  : <span className="text-gray-400">0</span>;
                              })()}
                            </td>
                            <td className="px-3 py-2.5 text-center font-mono text-gray-500">{plan.cylRepeatLength}</td>
                            <td className="px-3 py-2.5 text-center font-mono text-indigo-600 font-semibold">{plan.cylAreaSqInch}</td>
                            <td className="px-3 py-2.5 text-center text-gray-400 text-[10px]">₹{form.cylinderRatePerSqInch ?? 0}</td>
                            <td className={`px-3 py-2.5 text-center font-bold ${plan.isBest ? "text-green-700" : "text-violet-800"}`}>₹{plan.cylCostByArea.toLocaleString()}</td>
                            <td className="px-3 py-2.5 text-center text-gray-600">{plan.repeatUPS}</td>
                            <td className="px-3 py-2.5 text-center font-bold text-gray-800">{plan.totalUPS}</td>
                            <td className="px-3 py-2.5 text-center text-gray-600">{plan.reqRMT}</td>
                            <td className="px-3 py-2.5 text-center text-gray-600">{plan.totalRMT}</td>
                            <td className="px-3 py-2.5 text-center font-semibold text-blue-600">{plan.totalWt}</td>
                            <td className="px-3 py-2.5 text-center text-gray-600">{plan.totalTime} hr</td>
                            <td className="px-3 py-2.5 text-center text-gray-600">₹{plan.planCost.toLocaleString()}</td>
                            <td className="px-3 py-2.5 text-center font-bold text-purple-700">₹{plan.grandTotal.toLocaleString()}</td>
                            <td className="px-3 py-2.5 text-center text-gray-600">₹{plan.unitPrice}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile / Tablet cards */}
                <div className="sm:hidden divide-y divide-gray-100">
                  {visiblePlans.map(plan => {
                    const isSel = selectedPlanId === plan.planId;
                    return (
                      <div key={plan.planId} onClick={() => setSelectedPlanId(plan.planId)}
                        className={`p-3 cursor-pointer transition-colors ${(plan as any).isSpecial ? "bg-amber-50 hover:bg-amber-100" : isSel ? "bg-purple-50" : "hover:bg-gray-50"}`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${isSel ? "border-purple-600 bg-purple-600" : "border-gray-300"}`}>
                              {isSel && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                            </div>
                            <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-gray-800">{plan.machineName}</span>
                            {plan.isBest && <span className="px-1.5 py-0.5 bg-green-500 text-white text-[9px] font-bold rounded-full">BEST</span>}
                            {(plan as any).isSpecial && <span className="px-1.5 py-0.5 bg-amber-500 text-white text-[9px] font-bold rounded-full">SPECIAL</span>}
                          </div>
                          </div>
                          <span className={`text-xs font-bold ${isSel ? "text-purple-700" : "text-gray-500"}`}>₹{plan.unitPrice}/m</span>
                        </div>
                        <div className="mb-1.5 text-[10px] flex flex-wrap gap-1">
                          <span className="px-1.5 py-0.5 bg-sky-50 text-sky-700 rounded border border-sky-200">{plan.sleeveCode} ({plan.sleeveWidthVal}mm)</span>
                          <span className={`px-1.5 py-0.5 rounded border ${(plan as any).isSpecial ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-violet-50 text-violet-700 border-violet-200"}`}>{plan.cylinderCode} ({plan.cylinderWidthVal}×{plan.cylRepeatLength}mm)</span>
                          <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded border border-indigo-200">{plan.cylAreaSqInch} in² · ₹{plan.cylCostByArea.toLocaleString()}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-1 text-[10px] text-gray-500">
                          <span>AC UPS: <b className="text-indigo-700">{plan.acUps}</b></span>
                          <span>Total UPS: <b className="text-gray-700">{plan.totalUPS}</b></span>
                          <span>RMT: <b className="text-gray-700">{plan.totalRMT}</b></span>
                          <span>Side Waste: <b className="text-orange-600">{plan.sideWaste}mm</b></span>
                          <span>Dead Margin: <b className="text-orange-600">{plan.deadMargin}mm</b></span>
                          <span>Total Waste: <b className={plan.isBest ? "text-green-700" : "text-red-600"}>{plan.totalWaste}mm</b></span>
                          <span>Wt: <b className="text-blue-600">{plan.totalWt} Kg</b></span>
                          <span>Time: <b className="text-gray-700">{plan.totalTime} hr</b></span>
                          <span>Total: <b className="text-purple-700">₹{plan.grandTotal.toLocaleString()}</b></span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {selectedPlanId && (
                  <div className="border-t border-purple-200 bg-purple-50 px-4 py-2.5 flex items-center justify-between text-xs">
                    <span className="text-purple-700 font-medium flex items-center gap-1.5"><Check size={12} className="text-green-600" /> Plan selected — Grand Total: <strong className="text-purple-900">₹{selectedPlan?.grandTotal.toLocaleString()}</strong></span>
                    <Button onClick={() => {
                      setIsPlanApplied(true);
                      // auto-build cylAllocs from selected plan
                      const sp = selectedPlan as any;
                      const n  = form.noOfColors || 0;
                      if (n > 0) {
                        setCylAllocs(prev => {
                          const base = prev.length === n ? prev : Array.from({ length: n }, (_, i) => ({
                            colorNo: i + 1, colorName: prev[i]?.colorName || `Color ${i + 1}`,
                            cylinderNo: "", circumference: "", printWidth: "",
                            repeatUPS: 1, cylinderType: "New" as const, status: "Pending" as const,
                            remarks: "", createdInMaster: false, repeatUse: false,
                          }));
                          return base.map(c => ({
                            ...c,
                            circumference: sp ? String(sp.cylCirc ?? "") : c.circumference,
                            printWidth:    sp ? String(sp.cylinderWidthVal ?? sp.printingWidth ?? "") : c.printWidth,
                            repeatUPS:     sp ? (sp.repeatUPS as number) : c.repeatUPS,
                            cylinderType:  sp?.isSpecial ? "New" : c.cylinderType,
                          }));
                        });
                      }
                    }} icon={<Check size={13} />}>Apply Plan</Button>
                  </div>
                )}
              </div>
            )}

            {/* ── Cylinder Planning Section ─────────────────────────────── */}
            {(() => {
              const sp = selectedPlan as any;
              const pCode = (() => {
                const _m = loadedFromCatalog.match(/(\d+)$/);
                return _m ? `P${_m[1].padStart(4, "0")}` : "";
              })();
              const statusCounts = cylAllocs.reduce((acc, c) => {
                acc[c.status] = (acc[c.status] || 0) + 1;
                return acc;
              }, {} as Record<string, number>);
              const createdCount = cylAllocs.filter(c => c.createdInMaster).length;
              return (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <SectionHeader label="Cylinder Planning" />
                  {cylAllocs.length > 0 && (
                    <div className="flex items-center gap-2">
                      <button
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-300 text-[11px] font-bold rounded-lg transition"
                        onClick={refreshEstFromCylinderMaster}>
                        <RefreshCw size={11} /> Refresh from Master
                      </button>
                      <button
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold rounded-lg transition"
                        onClick={() => openEstCylinderMaster(selectedPlan)}>
                        <Wrench size={11} /> Create Cylinder in Master
                      </button>
                    </div>
                  )}
                </div>

                {/* Init button if no allocs yet */}
                {cylAllocs.length === 0 && form.noOfColors > 0 && (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs">
                    <span className="text-amber-700">
                      {loadedFromCatalog
                        ? "No cylinder data from catalog. Initialize to plan cylinders."
                        : "Plan cylinders for this estimation (direct entry)."}
                    </span>
                    <button
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold rounded-lg transition"
                      onClick={() => {
                        const n = form.noOfColors || 0;
                        setCylAllocs(Array.from({ length: n }, (_, i) => ({
                          colorNo:       i + 1,
                          colorName:     `Color ${i + 1}`,
                          cylinderNo:    "",
                          circumference: sp ? String(sp.cylCirc ?? form.jobHeight ?? "") : String(form.jobHeight || ""),
                          printWidth:    sp ? String(sp.cylinderWidthVal ?? sp.printingWidth ?? "") : String(form.actualWidth || form.jobWidth || ""),
                          repeatUPS:     sp ? (sp.repeatUPS as number) : 1,
                          cylinderType:  "New" as const,
                          status:        "Pending" as const,
                          remarks:       "",
                          createdInMaster: false,
                          repeatUse:     false,
                        })));
                      }}>
                      + Initialize {form.noOfColors} Color Cylinders
                    </button>
                  </div>
                )}

                {cylAllocs.length > 0 && (
                  <>
                    {/* Info banner */}
                    <div className="mb-2 flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 text-[11px] text-blue-800">
                      <Wrench size={12} className="text-blue-500 mt-0.5 flex-shrink-0" />
                      <span>
                        All colors share <strong>same cylinder</strong> — same Circ, Width & Repeat UPS.
                        Check <strong>Repeat?</strong> for colors that reuse an existing cylinder — they won't be sent to master.
                        {loadedFromCatalog && <> Loaded from catalog: <strong className="text-teal-700">{loadedFromCatalog}</strong>{pCode && <> · <span className="font-mono text-indigo-700">{pCode}</span></>}.</>}
                      </span>
                    </div>

                    {/* Status summary */}
                    <div className="flex items-center gap-2 mb-2 flex-wrap text-[11px]">
                      <span className="font-semibold text-gray-500 uppercase text-[10px]">Status:</span>
                      {Object.entries(statusCounts).map(([st, cnt]) => (
                        <span key={st} className={`px-2 py-0.5 rounded-full border font-bold ${
                          st === "Available" ? "bg-green-50 text-green-700 border-green-200"
                          : st === "Ordered"  ? "bg-purple-50 text-purple-700 border-purple-200"
                          : "bg-gray-100 text-gray-600 border-gray-200"}`}>
                          {cnt} {st}
                        </span>
                      ))}
                      {createdCount > 0 && (
                        <span className="ml-auto text-green-600 font-bold text-[10px]">✓ {createdCount} cylinder{createdCount > 1 ? "s" : ""} created in master</span>
                      )}
                    </div>

                    {/* Grid */}
                    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
                      <table className="min-w-full text-[11px] border-collapse">
                        <thead className="bg-amber-700 text-white uppercase tracking-wider">
                          <tr>{["#", "Repeat?", "Product Code", "Color Name", "Cylinder Code", "Width (mm)", "Circ. (mm)", "Repeat UPS", "Type", "Status", "Remarks", "Action"].map(h => (
                            <th key={h} className="px-2 py-2 border border-amber-600/30 text-center whitespace-nowrap font-semibold">{h}</th>
                          ))}</tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {cylAllocs.map((ca, i) => (
                            <tr key={i} className={`hover:bg-amber-50/20 ${ca.repeatUse ? "bg-gray-50 opacity-60" : ca.createdInMaster ? "bg-green-50/30" : ""}`}>
                              <td className="px-2 py-1.5 text-center font-black text-amber-700">{ca.colorNo}</td>
                              {/* Repeat? */}
                              <td className="px-2 py-1.5 text-center">
                                <label className="flex flex-col items-center gap-0.5 cursor-pointer select-none">
                                  <input type="checkbox" checked={!!ca.repeatUse}
                                    onChange={e => setCylAllocs(p => p.map((c, ci) => ci === i ? { ...c, repeatUse: e.target.checked } : c))}
                                    className="w-4 h-4 accent-orange-500 cursor-pointer" />
                                  {ca.repeatUse && <span className="text-[9px] text-orange-600 font-bold leading-none">Skip</span>}
                                </label>
                              </td>
                              {/* Product Code */}
                              <td className="px-2 py-1.5 text-center">
                                {pCode
                                  ? <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-[10px] font-bold font-mono whitespace-nowrap">{pCode}</span>
                                  : <span className="text-gray-400 text-[10px]">Direct</span>}
                              </td>
                              {/* Color Name */}
                              <td className="px-2 py-1.5">
                                <input className="w-24 text-xs border border-gray-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-amber-400 bg-gray-50"
                                  value={ca.colorName}
                                  onChange={e => setCylAllocs(p => p.map((c, ci) => ci === i ? { ...c, colorName: e.target.value } : c))} />
                              </td>
                              {/* Cylinder Code */}
                              <td className="px-2 py-1.5">
                                <input className="w-28 text-xs border border-gray-200 rounded-lg px-2 py-1 font-mono outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                                  placeholder="e.g. CUC-001"
                                  value={ca.cylinderNo}
                                  onChange={e => setCylAllocs(p => p.map((c, ci) => ci === i ? { ...c, cylinderNo: e.target.value } : c))} />
                              </td>
                              {/* Width */}
                              <td className="px-2 py-1.5">
                                <input type="number" className="w-20 text-xs border border-gray-200 rounded-lg px-2 py-1 font-mono outline-none focus:ring-2 focus:ring-amber-400 text-center"
                                  value={ca.printWidth}
                                  onChange={e => setCylAllocs(p => p.map(c => ({ ...c, printWidth: e.target.value })))} />
                              </td>
                              {/* Circumference */}
                              <td className="px-2 py-1.5">
                                <input type="number" className="w-20 text-xs border border-indigo-200 rounded-lg px-2 py-1 font-mono outline-none focus:ring-2 focus:ring-indigo-400 text-center bg-indigo-50/40"
                                  value={ca.circumference}
                                  onChange={e => setCylAllocs(p => p.map(c => ({ ...c, circumference: e.target.value })))} />
                              </td>
                              {/* Repeat UPS */}
                              <td className="px-2 py-1.5 text-center">
                                <span className="px-2 py-0.5 bg-teal-50 text-teal-700 border border-teal-200 rounded-full text-[10px] font-bold">{ca.repeatUPS}×</span>
                              </td>
                              {/* Type */}
                              <td className="px-2 py-1.5">
                                <select className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white outline-none focus:ring-2 focus:ring-amber-400"
                                  value={ca.cylinderType}
                                  onChange={e => setCylAllocs(p => p.map((c, ci) => ci === i ? { ...c, cylinderType: e.target.value as EstCylAlloc["cylinderType"] } : c))}>
                                  <option value="New">New</option>
                                  <option value="Existing">Existing</option>
                                  <option value="Repeat">Repeat Cylinder</option>
                                  <option value="Rechromed">Rechromed</option>
                                </select>
                              </td>
                              {/* Status */}
                              <td className="px-2 py-1.5">
                                <select className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white outline-none focus:ring-2 focus:ring-amber-400"
                                  value={ca.status}
                                  onChange={e => setCylAllocs(p => p.map((c, ci) => ci === i ? { ...c, status: e.target.value as EstCylAlloc["status"] } : c))}>
                                  <option value="Pending">Pending</option>
                                  <option value="Ordered">Ordered</option>
                                  <option value="Available">Available</option>
                                  <option value="In Use">In Use</option>
                                  <option value="Under Chrome">Under Chrome</option>
                                </select>
                              </td>
                              {/* Remarks */}
                              <td className="px-2 py-1.5">
                                <input placeholder="Notes…" className="w-28 text-xs border border-gray-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-amber-400"
                                  value={ca.remarks}
                                  onChange={e => setCylAllocs(p => p.map((c, ci) => ci === i ? { ...c, remarks: e.target.value } : c))} />
                              </td>
                              {/* Action */}
                              <td className="px-2 py-1.5 text-center">
                                {ca.createdInMaster
                                  ? <span className="flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 border border-green-300 rounded-full text-[10px] font-bold whitespace-nowrap"><Check size={10}/> Created</span>
                                  : <button onClick={() => openEstCylinderMaster(selectedPlan)}
                                      className="px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold rounded-lg transition whitespace-nowrap">
                                      + Create
                                    </button>}
                              </td>
                            </tr>
                          ))}
                          {cylAllocs.length === 0 && (
                            <tr><td colSpan={12} className="p-6 text-center text-gray-400 text-xs">No cylinders configured yet.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
              );
            })()}

          </div>
        )}

        {/* TAB 3: COST ESTIMATION */}
          {activeTab === 3 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* ── Section 3: Multiple Quantity Costing ──────────────────── */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-xs font-bold text-gray-700">Quantity Planning</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">Add multiple quantities — each saves as a separate estimation record with its own plan</p>
                  </div>
                  <button
                    onClick={() => setExtraQtys(p => [...p, 0])}
                    className="flex items-center gap-1.5 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 px-3 py-2 rounded-xl border border-purple-200 transition">
                    <Plus size={12} /> Add Quantity
                  </button>
                </div>

                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <table className="min-w-full text-xs">
                    <thead className="bg-gray-50 text-gray-500 uppercase">
                      <tr>
                        {["#", `Quantity (${form.unit})`, "Total Cost", "Rate/Mtr", ""].map(h => (
                          <th key={h} className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {/* Base quantity row */}
                      <tr
                        onClick={() => setActiveQtyIdx(0)}
                        className={`cursor-pointer transition-colors ${activeQtyIdx === 0 ? "bg-purple-50 ring-1 ring-inset ring-purple-300" : "hover:bg-gray-50"}`}>
                        <td className="px-3 py-2.5">
                          <span className="px-1.5 py-0.5 bg-purple-600 text-white rounded text-[10px] font-bold">Q1</span>
                        </td>
                        <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                          <input
                            type="number"
                            className="w-28 text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-purple-400 bg-white font-mono"
                            value={form.quantity || ""}
                            onChange={e => { f("quantity", Number(e.target.value)); setActiveQtyIdx(0); }}
                            placeholder="Quantity"
                          />
                        </td>
                        <td className="px-3 py-2.5 font-bold text-gray-900">₹{allCosts[0]?.totalAmount.toLocaleString() ?? "—"}</td>
                        <td className="px-3 py-2.5 font-semibold text-blue-700">₹{allCosts[0]?.perMeterRate ?? "—"}</td>
                        <td className="px-3 py-2.5 text-[10px] text-purple-600 font-semibold">{activeQtyIdx === 0 ? "● Active" : ""}</td>
                      </tr>

                      {/* Extra quantity rows */}
                      {extraQtys.map((qty, i) => {
                        const c = allCosts[i + 1];
                        const isActive = activeQtyIdx === i + 1;
                        return (
                          <tr key={i}
                            onClick={() => setActiveQtyIdx(i + 1)}
                            className={`cursor-pointer transition-colors ${isActive ? "bg-purple-50 ring-1 ring-inset ring-purple-300" : "hover:bg-gray-50"}`}>
                            <td className="px-3 py-2.5">
                              <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[10px] font-bold">Q{i + 2}</span>
                            </td>
                            <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                              <input
                                type="number"
                                className="w-28 text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-purple-400 bg-white font-mono"
                                value={qty || ""}
                                onChange={e => {
                                  const v = Number(e.target.value);
                                  setExtraQtys(p => p.map((q, idx) => idx === i ? v : q));
                                  setActiveQtyIdx(i + 1);
                                }}
                                placeholder="Enter quantity"
                              />
                            </td>
                            <td className="px-3 py-2.5 font-bold text-gray-900">{qty > 0 ? `₹${c?.totalAmount.toLocaleString() ?? "—"}` : "—"}</td>
                            <td className="px-3 py-2.5 font-semibold text-blue-700">{qty > 0 ? `₹${c?.perMeterRate ?? "—"}` : "—"}</td>
                            <td className="px-3 py-2.5 flex items-center gap-2">
                              {isActive && <span className="text-[10px] text-purple-600 font-semibold">● Active</span>}
                              <button onClick={e => { e.stopPropagation(); setExtraQtys(p => p.filter((_, idx) => idx !== i)); if (isActive) setActiveQtyIdx(0); }}
                                className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
                                <X size={12} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-gray-50 border-t border-gray-200">
                      <tr>
                        <td colSpan={5} className="px-3 py-2 text-[10px] text-gray-500">
                          {extraQtys.filter(q => q > 0).length === 0
                            ? "Add quantities above to compare costs at different volumes"
                            : `${1 + extraQtys.filter(q => q > 0).length} quantities — click a row to view its cost breakdown below`}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

          {/* ── Material Cost Breakdown ──────────────────────── */}
          <div>
            <SectionHeader label={`Material Cost Breakdown — Area: ${(activeQty * (form.jobWidth / 1000)).toLocaleString()} m² · Qty: ${activeQty.toLocaleString()} ${form.unit}`} />
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
              <table className="min-w-full text-xs whitespace-nowrap">
                <thead style={{ background: "var(--erp-primary)" }} className="text-white">
                  <tr>
                    {["Ply", "Type", "Material / Item", "Group", "GSM / Wet Wt.", "Req. Mtr", "Req. SQM", "Req. Wt (Kg)", "Waste Mtr", "Waste SQM", "Waste Wt (Kg)", "Total Mtr", "Total SQM", "Total Wt (Kg)", "Rate (₹/Kg)", "Amount (₹)"].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {breakdown.matLines.length === 0 ? (
                    <tr><td colSpan={16} className="px-4 py-6 text-center text-gray-400">No materials — select items in Ply Information (Tab 1)</td></tr>
                  ) : breakdown.matLines.map((m, i) => {
                    const sizeW = form.jobWidth || 340;
                    // Running meter: plan RMT scaled to activeQty, or activeQty directly
                    const basePlanRMT = isPlanApplied && selectedPlan
                      ? parseFloat((selectedPlan.totalRMT * (activeQty / (form.quantity || 1))).toFixed(2))
                      : activeQty;
                    const reqMtr   = m.plyNo > 0 ? parseFloat(basePlanRMT.toFixed(2)) : 0;
                    const reqSQM   = m.plyNo > 0 ? parseFloat((reqMtr * sizeW / 1000).toFixed(3)) : 0;
                    const reqWt    = m.plyNo > 0 && m.gsm > 0 ? parseFloat((reqSQM * m.gsm / 1000).toFixed(4)) : 0;
                    const wasteFrac = (form.wastagePct || 1) / 100;
                    const wasteMtr = m.plyNo > 0 ? parseFloat((reqMtr * wasteFrac).toFixed(2)) : 0;
                    const wasteSQM = m.plyNo > 0 ? parseFloat((wasteMtr * sizeW / 1000).toFixed(3)) : 0;
                    const wasteWt  = m.plyNo > 0 && m.gsm > 0 ? parseFloat((wasteSQM * m.gsm / 1000).toFixed(4)) : 0;
                    const totalMtr = m.plyNo > 0 ? parseFloat((reqMtr + wasteMtr).toFixed(2)) : 0;
                    const totalSQM = m.plyNo > 0 ? parseFloat((reqSQM + wasteSQM).toFixed(3)) : 0;
                    const totalWt  = m.plyNo > 0 ? parseFloat((reqWt + wasteWt).toFixed(4)) : 0;
                    const isExtra  = m.plyNo === 0;

                    return (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-semibold text-purple-700">{m.plyNo > 0 ? `P${m.plyNo}` : "—"}</td>
                      <td className="px-3 py-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                          m.plyType === "Printing" ? "bg-blue-50 text-blue-700 border-blue-200" :
                          m.plyType === "Lamination" ? "bg-orange-50 text-orange-700 border-orange-200" :
                          m.plyType === "Extra" ? "bg-gray-100 text-gray-600 border-gray-300" :
                          "bg-indigo-50 text-indigo-700 border-indigo-200"}`}>{m.plyType}</span>
                      </td>
                      <td className="px-3 py-2 font-medium text-gray-800">{m.name}</td>
                      <td className="px-3 py-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${GROUP_COLORS[m.group] || "bg-gray-100 text-gray-600"}`}>{m.group}</span>
                      </td>
                      <td className="px-3 py-2 font-mono text-gray-700">{m.gsm > 0 ? `${m.gsm} g/m²` : "—"}</td>
                      {/* Running Meter columns — only for ply materials, not Extra */}
                      <td className="px-3 py-2 font-mono text-gray-700">{isExtra ? "—" : reqMtr.toLocaleString()}</td>
                      <td className="px-3 py-2 font-mono text-gray-700">{isExtra ? "—" : reqSQM.toLocaleString()}</td>
                      <td className="px-3 py-2 font-semibold text-blue-700">{isExtra ? m.kg.toFixed(3) : reqWt.toFixed(4)}</td>
                      <td className="px-3 py-2 font-mono text-amber-600">{isExtra ? "—" : wasteMtr.toLocaleString()}</td>
                      <td className="px-3 py-2 font-mono text-amber-600">{isExtra ? "—" : wasteSQM.toLocaleString()}</td>
                      <td className="px-3 py-2 font-mono text-amber-600">{isExtra ? "—" : wasteWt.toFixed(4)}</td>
                      <td className="px-3 py-2 font-bold text-gray-800">{isExtra ? "—" : totalMtr.toLocaleString()}</td>
                      <td className="px-3 py-2 font-bold text-gray-800">{isExtra ? "—" : totalSQM.toLocaleString()}</td>
                      <td className="px-3 py-2 font-bold text-purple-700 bg-purple-50/40">{isExtra ? m.kg.toFixed(3) : totalWt.toFixed(4)}</td>
                      <td className="px-3 py-2 font-mono text-gray-700">{m.rate > 0 ? `₹${m.rate}` : <span className="text-amber-600 font-semibold">— select item</span>}</td>
                      <td className="px-3 py-2 font-bold text-gray-900">{m.amount > 0 ? `₹${m.amount.toLocaleString()}` : "₹0"}</td>
                    </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-purple-50 border-t-2 border-purple-200">
                  <tr>
                    <td colSpan={15} className="px-3 py-2.5 text-xs font-bold text-purple-700 uppercase text-right">Total Material Cost</td>
                    <td className="px-3 py-2.5 text-sm font-black text-purple-800">₹{activeCosts.materialCost.toLocaleString()}</td>
                  </tr>
                </tfoot>
              </table>
              </div>
            </div>
          </div>

          {/* ── Process Cost Breakdown ────────────────────────── */}
          {breakdown.procLines.length > 0 && (
          <div>
            <SectionHeader label="Process Cost Breakdown (from Process Master)" />
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <table className="min-w-full text-xs">
                <thead style={{ background: "var(--erp-primary)" }} className="text-white">
                  <tr>
                    {["Process Name", "Charge Unit", "Qty", "Rate (₹)", "Setup (₹)", "Amount (₹)"].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {breakdown.procLines.map((p, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium text-gray-800">{p.name}</td>
                      <td className="px-3 py-2"><span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded font-mono text-[10px]">{p.chargeUnit}</span></td>
                      <td className="px-3 py-2 font-mono text-gray-700">{p.qty.toLocaleString()}</td>
                      <td className="px-3 py-2 font-mono text-gray-700">₹{p.rate}</td>
                      <td className="px-3 py-2 font-mono text-gray-500">{p.setupCharge > 0 ? `₹${p.setupCharge}` : "—"}</td>
                      <td className="px-3 py-2 font-bold text-gray-900">₹{p.amount.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-indigo-50 border-t-2 border-indigo-200">
                  <tr>
                    <td colSpan={5} className="px-3 py-2.5 text-xs font-bold text-indigo-700 uppercase text-right">Total Process Cost</td>
                    <td className="px-3 py-2.5 text-sm font-black text-indigo-800">₹{activeCosts.processCost.toLocaleString()}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
          )}

          {/* ── Section 4: Overhead, Profit & Advanced ────────── */}
          <div>
            <SectionHeader label="Overhead, Profit & Pricing" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Input label="Overhead (%)" type="number" value={form.overheadPct} onChange={e => f("overheadPct", Number(e.target.value))} />
              <Input label="Profit (%)" type="number" value={form.profitPct} onChange={e => f("profitPct", Number(e.target.value))} />
              <Input label="Wastage %" type="number" step={0.1} value={form.wastagePct}
                onChange={e => f("wastagePct", Number(e.target.value))}
                placeholder="Default 1%" />
              <Input label="Min. Order Value (₹)" type="number" value={form.minimumOrderValue || ""}
                onChange={e => f("minimumOrderValue", Number(e.target.value))}
                placeholder="Floor price" />
            </div>
            {/* Selling price for contribution / break-even */}
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 border-t border-gray-100 pt-3">
              <Input label="Selling Price (₹/Kg)" type="number" step={0.01} value={form.sellingPrice || ""}
                onChange={e => f("sellingPrice", Number(e.target.value))}
                placeholder="Optional — for break-even" />
            </div>
          </div>

          {/* ── Section 5: Cost Summary — Comparison Table ──── */}
          <div>
            <SectionHeader label="Cost Summary — All Quantities" />
            <div className="mt-2 overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
              <table className="w-auto text-xs border-separate border-spacing-0">
                {/* HEADER */}
                <thead>
                  <tr>
                    <th className="sticky left-0 z-20 bg-gray-100 border-b-2 border-r-2 border-gray-300 px-3 py-2.5 text-left text-[10px] font-bold text-gray-600 uppercase tracking-wide w-[150px] min-w-[150px]">
                      Cost Item
                    </th>
                    {allQtys.map((qty, qi) => qty > 0 ? (
                      <th key={qi} className={`border-b-2 border-r border-gray-200 px-3 py-2 text-center w-[180px] min-w-[180px] ${qi === 0 ? "bg-purple-100" : "bg-blue-100"}`}>
                        <div className={`text-[10px] font-black uppercase tracking-wide ${qi === 0 ? "text-purple-700" : "text-blue-700"}`}>
                          {qi === 0 ? "Q1 — Base" : `Q${qi + 1}`}
                          {qi === 0 && <span className="ml-1.5 text-[9px] bg-purple-300 text-purple-900 rounded-full px-1.5 py-0.5 normal-case">BASE</span>}
                        </div>
                        <div className="text-xs font-semibold text-gray-700 mt-0.5 normal-case">{qty.toLocaleString()} {form.unit}</div>
                      </th>
                    ) : null)}
                  </tr>
                </thead>
                <tbody>
                  {/* ── MATERIAL ROWS ── */}
                  {(allBreakdowns[0]?.matLines ?? []).map((m, mi) => (
                    <tr key={`mat-${mi}`} className="hover:bg-blue-50/40">
                      <td className="sticky left-0 z-10 bg-white border-b border-r-2 border-gray-200 px-3 py-1.5">
                        <p className="font-semibold text-gray-800 truncate max-w-[140px]" title={m.name}>{m.name}</p>
                        {m.plyType && <p className="text-[9px] text-gray-400">{m.plyType}</p>}
                      </td>
                      {allQtys.map((qty, qi) => qty > 0 ? (
                        <td key={qi} className="border-b border-r border-gray-100 px-3 py-1.5 text-right text-blue-700 font-semibold">
                          ₹{(allBreakdowns[qi]?.matLines[mi]?.amount ?? 0).toLocaleString()}
                        </td>
                      ) : null)}
                    </tr>
                  ))}

                  {/* Total Material */}
                  <tr className="bg-blue-50">
                    <td className="sticky left-0 z-10 bg-blue-50 border-b-2 border-r-2 border-blue-200 px-3 py-2 text-[10px] font-black text-blue-700 uppercase tracking-wide">
                      Total Material
                    </td>
                    {allQtys.map((qty, qi) => qty > 0 ? (
                      <td key={qi} className="border-b-2 border-r border-blue-100 px-3 py-2 text-right font-black text-blue-700">
                        ₹{(allCosts[qi]?.materialCost ?? 0).toLocaleString()}
                      </td>
                    ) : null)}
                  </tr>

                  {/* Process Cost */}
                  <tr className="hover:bg-purple-50/30">
                    <td className="sticky left-0 z-10 bg-white border-b border-r-2 border-gray-200 px-3 py-1.5 font-medium text-gray-700">Process Cost</td>
                    {allQtys.map((qty, qi) => qty > 0 ? (
                      <td key={qi} className="border-b border-r border-gray-100 px-3 py-1.5 text-right text-purple-700 font-semibold">
                        ₹{(allCosts[qi]?.processCost ?? 0).toLocaleString()}
                      </td>
                    ) : null)}
                  </tr>

                  {/* Cylinder Cost */}
                  <tr className="hover:bg-indigo-50/30">
                    <td className="sticky left-0 z-10 bg-white border-b border-r-2 border-gray-200 px-3 py-1.5 font-medium text-gray-700">Cylinder ({form.noOfColors}C)</td>
                    {allQtys.map((qty, qi) => qty > 0 ? (
                      <td key={qi} className="border-b border-r border-gray-100 px-3 py-1.5 text-right text-indigo-700 font-semibold">
                        ₹{(allCosts[qi]?.cylinderCost ?? 0).toLocaleString()}
                      </td>
                    ) : null)}
                  </tr>

                  {/* Setup Cost */}
                  <tr className="hover:bg-amber-50/30">
                    <td className="sticky left-0 z-10 bg-white border-b border-r-2 border-gray-200 px-3 py-1.5 font-medium text-gray-700">Setup Cost</td>
                    {allQtys.map((qty, qi) => qty > 0 ? (
                      <td key={qi} className="border-b border-r border-gray-100 px-3 py-1.5 text-right text-amber-700 font-semibold">
                        ₹{(allCosts[qi]?.setupCost ?? 0).toLocaleString()}
                      </td>
                    ) : null)}
                  </tr>

                  {/* Labour Cost — editable per qty */}
                  <tr className="bg-lime-50/50">
                    <td className="sticky left-0 z-10 bg-lime-50 border-b border-r-2 border-gray-200 px-3 py-1.5 font-medium text-lime-800">Labour Cost (₹)</td>
                    {allQtys.map((qty, qi) => qty > 0 ? (
                      <td key={qi} className="border-b border-r border-gray-100 px-2 py-1">
                        <input
                          type="number" min={0} step={1} placeholder="0"
                          className="w-full text-right text-xs font-semibold text-lime-800 bg-white border border-lime-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-lime-400"
                          value={(qtyOverrides[qi]?.labourCost ?? form.labourCost) || ""}
                          onChange={e => setQtyOverride(qi, "labourCost", Number(e.target.value))}
                        />
                      </td>
                    ) : null)}
                  </tr>

                  {/* Transportation Cost — editable per qty */}
                  <tr className="bg-cyan-50/50">
                    <td className="sticky left-0 z-10 bg-cyan-50 border-b border-r-2 border-gray-200 px-3 py-1.5 font-medium text-cyan-800">Transport Cost (₹)</td>
                    {allQtys.map((qty, qi) => qty > 0 ? (
                      <td key={qi} className="border-b border-r border-gray-100 px-2 py-1">
                        <input
                          type="number" min={0} step={1} placeholder="0"
                          className="w-full text-right text-xs font-semibold text-cyan-800 bg-white border border-cyan-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                          value={(qtyOverrides[qi]?.transportationCost ?? form.transportationCost) || ""}
                          onChange={e => setQtyOverride(qi, "transportationCost", Number(e.target.value))}
                        />
                      </td>
                    ) : null)}
                  </tr>

                  {/* Interest Cost — editable per qty */}
                  <tr className="bg-rose-50/50">
                    <td className="sticky left-0 z-10 bg-rose-50 border-b border-r-2 border-gray-200 px-3 py-1.5 font-medium text-rose-800">Interest Cost (₹)</td>
                    {allQtys.map((qty, qi) => qty > 0 ? (
                      <td key={qi} className="border-b border-r border-gray-100 px-2 py-1">
                        <input
                          type="number" min={0} step={1} placeholder="0"
                          className="w-full text-right text-xs font-semibold text-rose-800 bg-white border border-rose-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-rose-400"
                          value={(qtyOverrides[qi]?.interestCost ?? form.interestCost) || ""}
                          onChange={e => setQtyOverride(qi, "interestCost", Number(e.target.value))}
                        />
                      </td>
                    ) : null)}
                  </tr>

                  {/* Overhead % — editable per qty */}
                  <tr className="bg-yellow-50/50">
                    <td className="sticky left-0 z-10 bg-yellow-50 border-b border-r-2 border-gray-200 px-3 py-1.5 font-medium text-yellow-800">Overhead %</td>
                    {allQtys.map((qty, qi) => qty > 0 ? (
                      <td key={qi} className="border-b border-r border-gray-100 px-2 py-1">
                        <div className="flex items-center gap-1">
                          <input
                            type="number" min={0} step={0.5}
                            className="w-full text-right text-xs font-semibold text-yellow-800 bg-white border border-yellow-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-yellow-400"
                            value={qtyOverrides[qi]?.overheadPct ?? form.overheadPct}
                            onChange={e => setQtyOverride(qi, "overheadPct", Number(e.target.value))}
                          />
                          <span className="text-[10px] text-yellow-700 font-bold flex-shrink-0">%</span>
                        </div>
                      </td>
                    ) : null)}
                  </tr>

                  {/* Overhead Amount */}
                  <tr className="bg-yellow-50">
                    <td className="sticky left-0 z-10 bg-yellow-50 border-b border-r-2 border-gray-200 px-3 py-1.5 font-semibold text-yellow-800 pl-5 text-[11px]">↳ Overhead Amt</td>
                    {allQtys.map((qty, qi) => qty > 0 ? (
                      <td key={qi} className="border-b border-r border-yellow-100 px-3 py-1.5 text-right text-yellow-700 font-bold">
                        ₹{(allCosts[qi]?.overheadAmt ?? 0).toLocaleString()}
                      </td>
                    ) : null)}
                  </tr>

                  {/* Profit % — editable per qty */}
                  <tr className="bg-green-50/50">
                    <td className="sticky left-0 z-10 bg-green-50 border-b border-r-2 border-gray-200 px-3 py-1.5 font-medium text-green-800">Profit %</td>
                    {allQtys.map((qty, qi) => qty > 0 ? (
                      <td key={qi} className="border-b border-r border-gray-100 px-2 py-1">
                        <div className="flex items-center gap-1">
                          <input
                            type="number" min={0} step={0.5}
                            className="w-full text-right text-xs font-semibold text-green-800 bg-white border border-green-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-green-400"
                            value={qtyOverrides[qi]?.profitPct ?? form.profitPct}
                            onChange={e => setQtyOverride(qi, "profitPct", Number(e.target.value))}
                          />
                          <span className="text-[10px] text-green-700 font-bold flex-shrink-0">%</span>
                        </div>
                      </td>
                    ) : null)}
                  </tr>

                  {/* Profit Amount */}
                  <tr className="bg-green-50">
                    <td className="sticky left-0 z-10 bg-green-50 border-b-2 border-r-2 border-gray-200 px-3 py-1.5 font-semibold text-green-800 pl-5 text-[11px]">↳ Profit Amt</td>
                    {allQtys.map((qty, qi) => qty > 0 ? (
                      <td key={qi} className="border-b-2 border-r border-green-100 px-3 py-1.5 text-right text-green-700 font-bold">
                        ₹{(allCosts[qi]?.profitAmt ?? 0).toLocaleString()}
                      </td>
                    ) : null)}
                  </tr>

                  {/* TOTAL AMOUNT */}
                  <tr className="bg-purple-100">
                    <td className="sticky left-0 z-10 bg-purple-100 border-b-2 border-r-2 border-purple-300 px-3 py-2.5 font-black text-purple-800 uppercase text-[11px] tracking-wide">
                      Total Amount
                    </td>
                    {allQtys.map((qty, qi) => qty > 0 ? (
                      <td key={qi} className={`border-b-2 border-r border-purple-200 px-3 py-2.5 text-right font-black text-lg ${qi === 0 ? "text-purple-800" : "text-blue-800"}`}>
                        ₹{(allCosts[qi]?.totalAmount ?? 0).toLocaleString()}
                        {form.minimumOrderValue > 0 && (allCosts[qi]?.totalAmount ?? 0) <= form.minimumOrderValue && (
                          <span className="block text-[9px] text-amber-700 font-bold">MOV</span>
                        )}
                      </td>
                    ) : null)}
                  </tr>

                  {/* Rate / Unit */}
                  <tr className="hover:bg-gray-50">
                    <td className="sticky left-0 z-10 bg-white border-b border-r-2 border-gray-200 px-3 py-1.5 font-medium text-gray-700">Rate / Kg</td>
                    {allQtys.map((qty, qi) => qty > 0 ? (
                      <td key={qi} className="border-b border-r border-gray-100 px-3 py-1.5 text-right text-gray-800 font-bold">
                        ₹{allCosts[qi]?.perMeterRate ?? "—"}
                      </td>
                    ) : null)}
                  </tr>

                  {/* Contribution */}
                  <tr className="hover:bg-teal-50/30">
                    <td className="sticky left-0 z-10 bg-white border-b border-r-2 border-gray-200 px-3 py-1.5 font-medium text-teal-700">Contribution</td>
                    {allQtys.map((qty, qi) => qty > 0 ? (
                      <td key={qi} className="border-b border-r border-gray-100 px-3 py-1.5 text-right text-teal-700 font-semibold">
                        {(allCosts[qi]?.contribution ?? 0) > 0 ? `₹${allCosts[qi]?.contribution}` : "—"}
                      </td>
                    ) : null)}
                  </tr>

                  {/* Break-even */}
                  <tr className="hover:bg-orange-50/30">
                    <td className="sticky left-0 z-10 bg-white border-b border-r-2 border-gray-200 px-3 py-1.5 font-medium text-orange-700">Break-even Qty</td>
                    {allQtys.map((qty, qi) => qty > 0 ? (
                      <td key={qi} className="border-b border-r border-gray-100 px-3 py-1.5 text-right text-orange-700 font-semibold">
                        {(allCosts[qi]?.breakEvenQty ?? 0) > 0 ? `${allCosts[qi]?.breakEvenQty?.toLocaleString()} ${form.unit}` : "—"}
                      </td>
                    ) : null)}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

              <Textarea label="Remarks / Notes" value={form.remarks} onChange={e => f("remarks", e.target.value)} placeholder="Price validity, special terms, notes..." />
            </div>
          )}

        </div>

        <div className="flex justify-between items-center mt-6 pt-6 border-t border-gray-200">
          <div>
            {activeTab > 1 && <Button variant="secondary" onClick={() => setActiveTab(activeTab - 1)}>Back</Button>}
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
            {activeTab < 3 ? (
              <Button onClick={() => setActiveTab(activeTab + 1)}>Next</Button>
            ) : (
              <>
                <Button icon={<Calculator size={14} />} onClick={save}>
                  {editing ? "Update Estimation" : "Save Estimation"}
                </Button>
              </>
            )}
          </div>
        </div>
      </Modal>

      {/* ══ VIEW MODAL ════════════════════════════════════════════ */}
      {viewRow && (
        <Modal open={!!viewRow} onClose={() => setViewRow(null)} title={`${viewRow.estimationNo} — ${viewRow.jobName}`} size="xl">
          <div className="space-y-5 text-sm">

            {/* Header status + date */}
            <div className="flex items-center justify-between">
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${STATUS_COLORS[viewRow.status]}`}>{viewRow.status}</div>
              <span className="text-xs text-gray-400">{viewRow.date}</span>
            </div>

            {/* Basic Info */}
            <div>
              <p className="text-[10px] font-bold text-purple-700 uppercase tracking-widest mb-2">Basic Information</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {([
                  ["Estimation No",   viewRow.estimationNo],
                  ["Customer",        viewRow.customerName],
                  ["Job Name",        viewRow.jobName],
                  ["Category",        viewRow.categoryName || "—"],
                  ["Job Size",         viewRow.content || "—"],
                  ["Sales Person",    viewRow.salesPerson || "—"],
                  ["Sales Type",      viewRow.salesType || "—"],
                  ["Concern Person",  viewRow.concernPerson || "—"],
                  ["Enquiry No",      viewRow.enquiryNo || "—"],
                  ["Repeat Length",   viewRow.repeatLength ? `${viewRow.repeatLength} mm` : "—"],
                  ["Wastage %",       `${viewRow.wastagePct ?? 1}%`],
                ] as [string,string][]).map(([k,v]) => (
                  <div key={k} className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
                    <p className="text-[10px] text-gray-400 uppercase font-semibold">{k}</p>
                    <p className="font-semibold text-gray-800 mt-0.5 text-xs">{v}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Planning Specification */}
            <div>
              <p className="text-[10px] font-bold text-purple-700 uppercase tracking-widest mb-2">Planning Specification</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {([
                  ["Job Width",       `${viewRow.jobWidth} mm`],
                  ["Job Height",      `${viewRow.jobHeight} mm`],
                  ["Trimming Size",   viewRow.trimmingSize ? `${viewRow.trimmingSize} mm` : "—"],
                  ["Act. Width",      `${viewRow.actualWidth} mm`],
                  ["Act. Height",     `${viewRow.actualHeight} mm`],
                  ["Front Colors",    `${viewRow.frontColors ?? "—"} C`],
                  ["Back Colors",     `${viewRow.backColors ?? "—"} C`],
                  ["Total Colors",    `${viewRow.noOfColors} C`],
                  ["Print Type",     viewRow.printType],
                  ["Repeat Length",  viewRow.repeatLength ? `${viewRow.repeatLength} mm` : "—"],
                  ["Machine",        viewRow.machineName],
                  ["Quantity",       `${viewRow.quantity.toLocaleString()} ${viewRow.unit}`],
                  ["Wastage %",      `${viewRow.wastagePct ?? 1}%`],
                  ["Cyl Cost/Color", `₹${viewRow.cylinderCostPerColor}`],
                  ["No. of Plys",    `${viewRow.secondaryLayers.length} ply`],
                ] as [string,string][]).map(([k,v]) => (
                  <div key={k} className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2">
                    <p className="text-[10px] text-gray-400 uppercase font-semibold">{k}</p>
                    <p className="font-semibold text-gray-800 mt-0.5 text-xs">{v}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Ply Information */}
            {viewRow.secondaryLayers.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-purple-700 uppercase tracking-widest mb-2">Ply Information</p>
                <div className="space-y-2">
                  {viewRow.secondaryLayers.map((l, i) => (
                    <div key={l.id} className="border border-purple-100 rounded-xl overflow-hidden">
                      <div className="flex items-center gap-3 bg-purple-50 px-3 py-2 border-b border-purple-100">
                        <span className="text-xs font-bold text-purple-700">Ply {l.layerNo}</span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                          l.plyType === "Film" ? "bg-indigo-50 text-indigo-700 border-indigo-200" :
                          l.plyType === "Printing" ? "bg-blue-50 text-blue-700 border-blue-200" :
                          l.plyType === "Lamination" ? "bg-orange-50 text-orange-700 border-orange-200" :
                          "bg-green-50 text-green-700 border-green-200"}`}>{l.plyType}</span>
                        <span className="text-xs text-gray-500">{l.itemSubGroup}</span>
                        {l.thickness > 0 && <span className="text-xs text-gray-500">{l.thickness}μ</span>}
                        {l.gsm > 0 && <span className="text-xs font-bold text-purple-700">{l.gsm} GSM</span>}
                      </div>
                      {l.consumableItems.length > 0 && (
                        <div className="px-3 py-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                          {l.consumableItems.map((ci, ci_i) => (
                            <div key={ci_i} className="bg-teal-50 border border-teal-100 rounded-lg px-2 py-1.5">
                              <p className="text-[10px] text-gray-400 font-semibold">{ci.itemGroup}</p>
                              <p className="text-xs font-semibold text-gray-800">{ci.itemName || ci.itemSubGroup || "—"}</p>
                              <p className="text-[10px] text-teal-700 font-bold">{ci.gsm} GSM · ₹{ci.rate}/Kg</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Processes */}
            {viewRow.processes.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-purple-700 uppercase tracking-widest mb-2">Process List</p>
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <table className="min-w-full text-xs">
                    <thead className="bg-gray-50 text-gray-500 uppercase">
                      <tr>{["Process", "Unit", "Rate", "Qty", "Setup", "Amount"].map(h => <th key={h} className="px-3 py-2.5 text-left font-semibold">{h}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {viewRow.processes.map((pr, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-3 py-2.5 font-medium text-gray-800">{pr.processName}</td>
                          <td className="px-3 py-2.5 font-mono text-gray-600">{pr.chargeUnit}</td>
                          <td className="px-3 py-2.5 text-gray-700">₹{pr.rate}</td>
                          <td className="px-3 py-2.5 text-gray-700">{pr.qty.toLocaleString()}</td>
                          <td className="px-3 py-2.5 text-gray-700">{pr.setupCharge > 0 ? `₹${pr.setupCharge}` : "—"}</td>
                          <td className="px-3 py-2.5 font-semibold text-gray-900">₹{pr.amount.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-purple-50 border-t border-purple-200">
                      <tr><td colSpan={5} className="px-3 py-2 text-xs font-bold text-purple-700">Process Total</td><td className="px-3 py-2 font-bold text-purple-800">₹{viewRow.processCost.toLocaleString()}</td></tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* Cost Summary */}
            <div>
              <p className="text-[10px] font-bold text-purple-700 uppercase tracking-widest mb-2">Cost Summary</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { label: "Material Cost",   val: `₹${viewRow.materialCost.toLocaleString()}`,  cls: "bg-blue-50 border-blue-200" },
                  { label: "Process Cost",    val: `₹${viewRow.processCost.toLocaleString()}`,   cls: "bg-purple-50 border-purple-200" },
                  { label: `Cylinder (${viewRow.noOfColors}C × ₹${viewRow.cylinderCostPerColor})`, val: `₹${viewRow.cylinderCost.toLocaleString()}`, cls: "bg-indigo-50 border-indigo-200" },
                  { label: "Setup Cost",      val: `₹${(viewRow.setupCost || 0).toLocaleString()}`, cls: "bg-amber-50 border-amber-200" },
                  { label: `Overhead (${viewRow.overheadPct}%)`, val: `₹${viewRow.overheadAmt.toLocaleString()}`, cls: "bg-yellow-50 border-yellow-200" },
                  { label: `Profit (${viewRow.profitPct}%)`, val: `₹${viewRow.profitAmt.toLocaleString()}`, cls: "bg-green-50 border-green-200" },
                  { label: "Total Amount",    val: `₹${viewRow.totalAmount.toLocaleString()}`,   cls: "bg-white border-2 border-purple-400" },
                  { label: "Rate / Kg",        val: `₹${viewRow.perMeterRate}`,                   cls: "bg-gray-50 border-gray-200" },
                  { label: "Break-even Qty",  val: viewRow.breakEvenQty > 0 ? `${viewRow.breakEvenQty.toLocaleString()} ${viewRow.unit}` : "—", cls: "bg-orange-50 border-orange-200" },
                ].map(s => (
                  <div key={s.label} className={`rounded-xl border p-3 ${s.cls}`}>
                    <p className="text-[10px] text-gray-400 uppercase font-semibold">{s.label}</p>
                    <p className="font-bold text-gray-900 mt-0.5">{s.val}</p>
                  </div>
                ))}
              </div>
            </div>

            {viewRow.remarks && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                <strong>Remarks:</strong> {viewRow.remarks}
              </div>
            )}
          </div>

          <div className="flex justify-between mt-6">
            <Button variant="secondary" onClick={() => setViewRow(null)}>Close</Button>
            <div className="flex gap-2">
              <Button variant="secondary" icon={<Pencil size={14} />} onClick={() => { setViewRow(null); openEdit(viewRow); }}>Edit</Button>
              {viewRow.status === "Approved" && <Button icon={<ArrowRight size={14} />}>Convert to Order</Button>}
            </div>
          </div>
        </Modal>
      )}

      {/* Category Replace Warning */}
      <Modal open={!!pendingCategoryId} onClose={() => setPendingCategoryId(null)} title="Replace Ply Configuration?" size="sm">
        <div className="space-y-3">
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
            You have already added ply details. Selecting a category will<br/>
            <strong>reset your current ply configuration.</strong>
          </div>
          <p className="text-sm text-gray-600">Do you want to replace the ply details with the selected category?</p>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="secondary" onClick={() => setPendingCategoryId(null)}>No — Keep My Plys</Button>
            <Button onClick={() => {
              applyCategory(pendingCategoryId!);
              setPendingCategoryId(null);
            }}>Yes — Reset Plys</Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Confirm Delete" size="sm">
        <p className="text-sm text-gray-600">Delete this estimation? This cannot be undone.</p>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setDeleteId(null)}>Cancel</Button>
          <Button variant="danger" onClick={() => { setData(d => d.filter(r => r.id !== deleteId)); setDeleteId(null); }}>Delete</Button>
        </div>
      </Modal>

      {/* ══ UPS LAYOUT PREVIEW MODAL ════════════════════════════ */}
      {upsPreviewPlan && (() => {
        const plan   = upsPreviewPlan as any;
        const jobW   = form.actualWidth || form.jobWidth || 0;
        const shrink = (form as any).widthShrinkage || 0;
        const trim   = form.trimmingSize || 0;
        const acUps  = plan.acUps as number;
        const filmW  = plan.filmSize as number;

        const effRepeat = (form.jobHeight || 0) + shrink;
        const repeatUPS = plan.repeatUPS as number;
        const cylCirc   = plan.cylCirc   as number;
        const jobH      = form.jobHeight || 0;

        const SVG_W = 730;
        const SVG_H = 415;
        const RULER_LEFT = 36;
        const RULER_BTM  = 22;
        const drawW = 660 - RULER_LEFT;
        const drawH = 360 - RULER_BTM;
        const sx = (mm: number) => mm * (drawW / (filmW || 1));
        const sy = (mm: number) => mm * (drawH / (cylCirc || 1));
        const trimPx = sx(trim);
        const lanePx = sx(jobW);
        const repPx  = sy(effRepeat);
        const C_TRIM  = "#fed7aa";
        const C_LANE  = ["#dbeafe", "#bfdbfe"];
        const C_DASH  = "#6366f1";
        const C_LABEL = "#1e40af";

        return (
          <Modal open onClose={() => setUpsPreviewPlan(null)} title="UPS Layout Design" size="xl">
            <div className="space-y-4">
              {/* Stats row */}
              <div className="flex flex-wrap gap-2 text-xs">
                {[
                  { l: "Film Width",    v: `${filmW} mm`,              cls: "bg-indigo-50 text-indigo-700 border-indigo-200" },
                  { l: "AC UPS",        v: String(acUps),              cls: "bg-purple-50 text-purple-700 border-purple-200" },
                  { l: "Job Width",     v: `${jobW} mm`,               cls: "bg-blue-50 text-blue-700 border-blue-200" },
                  { l: "Repeat Shrink", v: shrink > 0 ? `+${shrink} mm (on repeat length)` : "—", cls: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200" },
                  { l: "Trimming",      v: trim > 0 ? `${trim}+${trim} mm` : "—", cls: "bg-orange-50 text-orange-700 border-orange-200" },
                  { l: "Repeat UPS",    v: String(plan.repeatUPS),     cls: "bg-teal-50 text-teal-700 border-teal-200" },
                  { l: "Total Pieces",  v: String(plan.totalUPS),      cls: "bg-green-50 text-green-700 border-green-200" },
                  { l: "Cylinder",      v: plan.cylinderCode,          cls: "bg-violet-50 text-violet-700 border-violet-200" },
                  { l: "Cyl. Circ",     v: `${plan.cylCirc} mm`,       cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
                  { l: "Machine",       v: plan.machineName,           cls: "bg-gray-50 text-gray-700 border-gray-200" },
                ].map(s => (
                  <div key={s.l} className={`px-2.5 py-1.5 rounded-lg border font-medium ${s.cls}`}>
                    <span className="opacity-60 text-[10px] uppercase tracking-wider block leading-none mb-0.5">{s.l}</span>
                    <span className="font-bold">{s.v}</span>
                  </div>
                ))}
              </div>

              {/* 2D Layout SVG */}
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3">
                  Full Layout — {acUps} AC UPS × {repeatUPS} Repeat UPS = {plan.totalUPS} Total Pieces &nbsp;|&nbsp;
                  Film {filmW}mm × Cyl. Circ {cylCirc}mm
                </p>
                <svg width={SVG_W} height={SVG_H} className="w-full" viewBox={`0 0 ${SVG_W} ${SVG_H}`}>
                  <defs>
                    <pattern id="hatch2" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                      <line x1="0" y1="0" x2="0" y2="5" stroke="#f97316" strokeWidth="1.5" opacity="0.4"/>
                    </pattern>
                    <marker id="dim-end2" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
                      <path d="M0,0.5 L6,3.5 L0,6.5 Z" fill="#374151"/>
                    </marker>
                    <marker id="dim-start2" markerWidth="7" markerHeight="7" refX="1" refY="3.5" orient="auto-start-reverse">
                      <path d="M0,0.5 L6,3.5 L0,6.5 Z" fill="#374151"/>
                    </marker>
                  </defs>

                  {Array.from({ length: repeatUPS }, (_, ri) => {
                    const ry = RULER_LEFT + ri * repPx;
                    let cx = 0;
                    const cells = [];
                    if (trim > 0) cells.push(<rect key={`lt-${ri}`} x={cx} y={ry} width={trimPx} height={repPx} fill={C_TRIM} stroke="#f97316" strokeWidth={0.5} />);
                    cx += trimPx;
                    for (let li = 0; li < acUps; li++) {
                      const bg = C_LANE[li % 2];
                      const laneStartX = cx;
                      cells.push(
                        <g key={`l-${ri}-${li}`}>
                          <rect x={cx} y={ry} width={lanePx} height={repPx} fill={bg} stroke="#6366f1" strokeWidth={0.4} />
                          {/* Width arrow in every cell */}
                          {lanePx > 30 && repPx > 18 && (() => {
                            const ax1 = laneStartX + 5;
                            const ax2 = laneStartX + lanePx - 5;
                            const ay  = ry + repPx / 2;
                            return (
                              <g key="w-arrow2">
                                <line x1={ax1} y1={ay} x2={ax2} y2={ay}
                                  stroke="#1e40af" strokeWidth="1.3"
                                  markerStart="url(#dim-start2)" markerEnd="url(#dim-end2)" />
                                <rect x={laneStartX + lanePx / 2 - 22} y={ay - 8} width={44} height={12} fill="rgba(255,255,255,0.85)" rx={2} />
                                <text x={laneStartX + lanePx / 2} y={ay + 3} textAnchor="middle" fontSize={8} fill="#1e40af" fontWeight="700">
                                  {jobW} mm
                                </text>
                              </g>
                            );
                          })()}
                        </g>
                      );
                      cx += lanePx;
                    }
                    if (trim > 0) { cells.push(<rect key={`rt-${ri}`} x={cx} y={ry} width={trimPx} height={repPx} fill={C_TRIM} stroke="#f97316" strokeWidth={0.5} />); cx += trimPx; }
                    const dashLine = ri < repeatUPS - 1 ? <line key={`dh-${ri}`} x1={0} y1={ry+repPx} x2={cx} y2={ry+repPx} stroke={C_DASH} strokeWidth={1} strokeDasharray="4 3" /> : null;
                    const rulerLabel = repPx > 20 ? (
                      <g key={`rl-${ri}`}>
                        <line x1={15} y1={ry + 4} x2={15} y2={ry + repPx - 4}
                          stroke="#374151" strokeWidth="1.3"
                          markerStart="url(#dim-start2)" markerEnd="url(#dim-end2)" />
                        <rect x={2} y={ry + repPx / 2 - 22} width={14} height={44} fill="white" />
                        <text x={15} y={ry + repPx / 2} textAnchor="middle" fontSize={8} fill="#111827" fontWeight="700"
                          transform={`rotate(-90, 15, ${ry + repPx / 2})`}>
                          {effRepeat} mm
                        </text>
                      </g>
                    ) : null;
                    return [rulerLabel, ...cells, dashLine];
                  })}

                  {/* last tick intentionally blank — arrows carry labels */}

                  {/* Bottom ruler */}
                  {(() => {
                    const ry = RULER_LEFT + repeatUPS * repPx + 4;
                    let cx = 0;
                    const ticks = [];
                    ticks.push(<text key="t0" x={cx} y={ry+8} fontSize={7} fill="#9ca3af">0</text>);
                    if (trim > 0) { cx += trimPx; ticks.push(<text key="tt" x={cx} y={ry+8} fontSize={7} fill="#f97316" textAnchor="middle">{trim}</text>); }
                    for (let li = 0; li <= acUps; li++) {
                      const xmm = trim + li * jobW;
                      const xpx = sx(xmm);
                      ticks.push(<g key={`bt-${li}`}><line x1={xpx} y1={ry-2} x2={xpx} y2={ry+2} stroke="#9ca3af" strokeWidth={0.8} />{(li===0||li===acUps||li===Math.floor(acUps/2))&&<text x={xpx} y={ry+9} fontSize={7} fill="#6b7280" textAnchor="middle">{xmm}</text>}</g>);
                    }
                    ticks.push(<text key="total" x={sx(filmW)} y={ry+9} fontSize={7} fill="#6b7280" textAnchor="end">{filmW}mm</text>);
                    return ticks;
                  })()}

                  {/* Bottom dim arrow — Total Film Width */}
                  {(() => {
                    const arrowY = RULER_LEFT + repeatUPS*repPx + RULER_BTM + 14;
                    const midX = drawW / 2;
                    return (
                      <g>
                        <line x1={0} y1={arrowY} x2={drawW} y2={arrowY} stroke="#374151" strokeWidth="1.4" markerStart="url(#dim-start2)" markerEnd="url(#dim-end2)" />
                        <line x1={0} y1={arrowY-6} x2={0} y2={arrowY+6} stroke="#374151" strokeWidth="1" />
                        <line x1={drawW} y1={arrowY-6} x2={drawW} y2={arrowY+6} stroke="#374151" strokeWidth="1" />
                        <rect x={midX-42} y={arrowY-7} width={84} height={13} fill="white" />
                        <text x={midX} y={arrowY+4} textAnchor="middle" fontSize={10} fill="#111827" fontWeight="700">Total Film Width: {filmW} mm</text>
                      </g>
                    );
                  })()}

                  {/* Right dim arrow — Cyl Circ */}
                  {(() => {
                    const arrX = drawW + 34;
                    const y1 = RULER_LEFT;
                    const y2 = RULER_LEFT + repeatUPS * repPx;
                    const midY = (y1 + y2) / 2;
                    return (
                      <g>
                        <line x1={arrX} y1={y1} x2={arrX} y2={y2} stroke="#374151" strokeWidth="1.4" markerStart="url(#dim-start2)" markerEnd="url(#dim-end2)" />
                        <line x1={arrX-6} y1={y1} x2={arrX+6} y2={y1} stroke="#374151" strokeWidth="1" />
                        <line x1={arrX-6} y1={y2} x2={arrX+6} y2={y2} stroke="#374151" strokeWidth="1" />
                        <rect x={arrX-6} y={midY-38} width={12} height={76} fill="white" />
                        <text x={arrX} y={midY} textAnchor="middle" fontSize={10} fill="#111827" fontWeight="700" transform={`rotate(-90, ${arrX}, ${midY})`}>Cyl. Circ: {cylCirc} mm</text>
                      </g>
                    );
                  })()}
                </svg>

                {/* Legend */}
                <div className="flex flex-wrap gap-3 mt-3 pt-2 border-t border-gray-200">
                  {[
                    { color: "#dbeafe", border: "#6366f1", label: `Job cell — ${jobW}mm wide × ${effRepeat}mm repeat length` },
                    ...(trim > 0 ? [{ color: C_TRIM, border: "#f97316", label: `Trim both sides (${trim}mm each)` }] : []),
                    ...(shrink > 0 ? [{ color: "#fae8ff", border: "#a21caf", label: `Shrinkage +${shrink}mm on repeat length` }] : []),
                  ].map(l => (
                    <div key={l.label} className="flex items-center gap-1.5">
                      <div className="w-4 h-4 rounded border-2 flex-shrink-0" style={{ background: l.color, borderColor: l.border }} />
                      <span className="text-[11px] text-gray-600">{l.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* UPS-by-UPS Width breakdown */}
              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">UPS-by-UPS Breakdown — Width Direction</p>
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                  <table className="min-w-full text-xs">
                    <thead className="bg-gray-100">
                      <tr>{["Position","Type","Width (mm)","Color"].map(h=><th key={h} className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{h}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {trim>0&&<tr><td className="px-3 py-1.5 text-gray-500">Left Bleed</td><td className="px-3 py-1.5"><span className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{background:"#fff7ed",color:"#c2410c"}}>Trim</span></td><td className="px-3 py-1.5 font-mono font-bold text-orange-600">{trim}</td><td className="px-3 py-1.5"><div className="w-5 h-3 rounded" style={{background:"#fed7aa",border:"1px solid #c2410c"}}/></td></tr>}
                      {Array.from({length:acUps},(_,i)=>(
                        <tr key={i}><td className="px-3 py-1.5 text-gray-500">{i+1} UPS</td><td className="px-3 py-1.5"><span className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{background:"#e0e7ff",color:"#4338ca"}}>Job Width</span></td><td className="px-3 py-1.5 font-mono font-bold text-indigo-600">{jobW}</td><td className="px-3 py-1.5"><div className="w-5 h-3 rounded" style={{background:"#e0e7ff",border:"1px solid #6366f1"}}/></td></tr>
                      ))}
                      {trim>0&&<tr><td className="px-3 py-1.5 text-gray-500">Right Bleed</td><td className="px-3 py-1.5"><span className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{background:"#fff7ed",color:"#c2410c"}}>Trim</span></td><td className="px-3 py-1.5 font-mono font-bold text-orange-600">{trim}</td><td className="px-3 py-1.5"><div className="w-5 h-3 rounded" style={{background:"#fed7aa",border:"1px solid #c2410c"}}/></td></tr>}
                      {plan.deadMargin>0&&<tr><td className="px-3 py-1.5 text-gray-400 italic">Dead Margin</td><td className="px-3 py-1.5"><span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-500">Waste</span></td><td className="px-3 py-1.5 font-mono text-gray-400">{plan.deadMargin}</td><td className="px-3 py-1.5"><div className="w-5 h-3 rounded bg-gray-200 border border-gray-400"/></td></tr>}
                      <tr className="bg-indigo-50 font-bold border-t-2 border-indigo-200"><td className="px-3 py-2 text-indigo-800" colSpan={2}>Total Film Width</td><td className="px-3 py-2 font-mono text-indigo-700">{filmW} mm</td><td/></tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Repeat Height breakdown */}
              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Repeat UPS Breakdown — Repeat Length Direction</p>
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                  <table className="min-w-full text-xs">
                    <thead className="bg-gray-100">
                      <tr>{["Component","Value","Note"].map(h=><th key={h} className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{h}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      <tr><td className="px-3 py-1.5 text-gray-600">Repeat Length</td><td className="px-3 py-1.5 font-mono font-bold text-indigo-700">{jobH} mm</td><td className="px-3 py-1.5 text-gray-400 text-[10px]">As entered in Basic Info</td></tr>
                      {shrink>0&&<tr><td className="px-3 py-1.5 text-gray-600">+ Shrinkage</td><td className="px-3 py-1.5 font-mono font-bold text-fuchsia-600">+{shrink} mm</td><td className="px-3 py-1.5 text-gray-400 text-[10px]">Applied to repeat length only</td></tr>}
                      <tr className="bg-teal-50"><td className="px-3 py-1.5 font-bold text-teal-800">= Effective Repeat</td><td className="px-3 py-1.5 font-mono font-bold text-teal-700">{jobH+shrink} mm</td><td className="px-3 py-1.5 text-teal-600 text-[10px]">Repeat Length + Shrinkage</td></tr>
                      <tr><td className="px-3 py-1.5 text-gray-600">Cylinder Circumference</td><td className="px-3 py-1.5 font-mono font-bold text-emerald-700">{plan.cylCirc} mm</td><td className="px-3 py-1.5 text-gray-400 text-[10px]">{plan.cylinderCode} — {plan.cylinderName}</td></tr>
                      <tr className="bg-green-50 border-t-2 border-green-200"><td className="px-3 py-2 font-bold text-green-800">÷ Repeat UPS</td><td className="px-3 py-2 font-mono font-bold text-green-700 text-sm">{plan.repeatUPS}×</td><td className="px-3 py-2 text-green-600 text-[10px]">{plan.cylCirc} ÷ {jobH+shrink} = {plan.repeatUPS} repeats per revolution</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </Modal>
        );
      })()}

      {/* ══ CATALOG PICKER MODAL ════════════════════════════════ */}
      <Modal open={catalogPickerOpen} onClose={() => setCatalogPickerOpen(false)} title="Pick from Product Catalog" size="xl">
        <div className="mb-3">
          <div className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-xl bg-gray-50">
            <Search size={14} className="text-gray-400" />
            <input
              autoFocus
              value={catalogSearch}
              onChange={e => setCatalogSearch(e.target.value)}
              placeholder="Search by product name, catalog no, customer…"
              className="flex-1 text-sm bg-transparent outline-none text-gray-700 placeholder-gray-400"
            />
            {catalogSearch && <button onClick={() => setCatalogSearch("")}><X size={13} className="text-gray-400" /></button>}
          </div>
        </div>

        <div className="overflow-auto max-h-[60vh]">
          <table className="min-w-full text-xs">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                {["Catalog No", "Product Name", "Customer", "Size (W×H)", "Colors", "Substrate", "Std Qty", ""].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap border-b border-gray-200">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {activeCatalog
                .filter(c => {
                  if (!catalogSearch.trim()) return true;
                  const q = catalogSearch.toLowerCase();
                  return (
                    c.catalogNo.toLowerCase().includes(q) ||
                    c.productName.toLowerCase().includes(q) ||
                    c.customerName.toLowerCase().includes(q) ||
                    (c.substrate || "").toLowerCase().includes(q)
                  );
                })
                .map(cat => (
                  <tr key={cat.id} className="hover:bg-teal-50 cursor-pointer transition" onClick={() => loadFromCatalog(cat)}>
                    <td className="px-3 py-2.5">
                      <span className="font-mono font-bold text-teal-700 text-[11px]">{cat.catalogNo}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-semibold text-gray-800">{cat.productName}</div>
                      {cat.brandName && <div className="text-[10px] text-gray-400">{cat.brandName}</div>}
                    </td>
                    <td className="px-3 py-2.5 text-gray-600">{cat.customerName}</td>
                    <td className="px-3 py-2.5 font-mono text-gray-700">{cat.jobWidth}×{cat.jobHeight} mm</td>
                    <td className="px-3 py-2.5">
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full font-semibold">{cat.noOfColors}C</span>
                    </td>
                    <td className="px-3 py-2.5 text-gray-500">{cat.substrate || cat.content || "—"}</td>
                    <td className="px-3 py-2.5 font-mono">{(cat.standardQty || 0).toLocaleString()} {cat.standardUnit}</td>
                    <td className="px-3 py-2.5">
                      <button
                        onClick={e => { e.stopPropagation(); loadFromCatalog(cat); }}
                        className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition whitespace-nowrap">
                        <ArrowRight size={11} /> Load
                      </button>
                    </td>
                  </tr>
                ))}
              {activeCatalog.length === 0 && (
                <tr><td colSpan={8} className="px-3 py-10 text-center text-gray-400 text-xs">No active products in catalog.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center">
          <span className="text-xs text-gray-400">{activeCatalog.length} active products in catalog</span>
          <Button variant="secondary" onClick={() => setCatalogPickerOpen(false)}>Cancel</Button>
        </div>
      </Modal>

    </div>
  );
}
