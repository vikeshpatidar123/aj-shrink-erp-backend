"use client";
import React, { useState, useMemo } from "react";
import {
  BookMarked, Eye, Trash2, Clock, CheckCircle2,
  ShoppingCart, CheckCircle, AlertCircle, Lock, ArrowRight,
  RefreshCw, Save, Plus, X, Calculator, Layers, Check, Pencil,
  ChevronRight, Eye as EyeIcon, Factory, Send, Package, Palette, Wrench, Archive, Copy, Search, Printer,
} from "lucide-react";
import {
  gravureOrders, gravureWorkOrders as initWOs,
  GravureProductCatalog, GravureOrder, GravureWorkOrder,
  machines, processMasters, items, ledgers, GravureEstimationProcess,
  SecondaryLayer, PlyConsumableItem,
  CATEGORY_GROUP_SUBGROUP,
  tools as allTools, toolInventory,
  customers,
} from "@/data/dummyData";
import { useCategories } from "@/context/CategoriesContext";
import { useProductCatalog } from "@/context/ProductCatalogContext";
import { PlanViewer, PlanInput } from "@/components/gravure/PlanViewer";
import { DimensionDiagram, DimensionInputPanel, DimValues, CONTENT_TYPE_CONFIG } from "@/components/gravure/DimensionDiagram";
import { DataTable, Column } from "@/components/tables/DataTable";
import { statusBadge } from "@/components/ui/Badge";
import Button   from "@/components/ui/Button";
import Modal    from "@/components/ui/Modal";
import { Input, Select, Textarea } from "@/components/ui/Input";

// ─── Masters ──────────────────────────────────────────────────
const ROTO_PROCESSES    = processMasters.filter(p => p.module === "Rotogravure");
const PRINT_MACHINES    = machines.filter(m => m.department === "Printing");
const AVAILABLE_TOOL_IDS = new Set(toolInventory.filter(ti => ti.status === "Available").map(ti => ti.toolId));
const SLEEVE_TOOLS      = allTools.filter(t => t.toolType === "Sleeve"   && AVAILABLE_TOOL_IDS.has(t.id)).sort((a, b) => parseFloat(a.printWidth) - parseFloat(b.printWidth));
const CYLINDER_TOOLS    = allTools.filter(t => t.toolType === "Cylinder" && AVAILABLE_TOOL_IDS.has(t.id)).sort((a, b) => parseFloat(a.printWidth) - parseFloat(b.printWidth));
const FILM_ITEMS        = items.filter(i => i.group === "Film" && i.active);
const INK_ITEMS         = items.filter(i => i.group === "Ink" && i.active);
const VENDOR_LEDGERS    = ledgers.filter(l => (l.ledgerType === "Supplier" || l.ledgerType === "Vendor") && l.status === "Active");
const CYLINDER_TOOLS_ALL = allTools.filter(t => t.toolType === "Cylinder");
const FILM_SUBGROUPS = Array.from(
  new Map(FILM_ITEMS.filter(i => i.subGroup).map(i => [i.subGroup, { subGroup: i.subGroup, density: parseFloat(i.density) || 0, thicknesses: new Set<number>() }])).entries()
).map(([subGroup, data]) => {
  FILM_ITEMS.filter(i => i.subGroup === subGroup).forEach(i => { const t = parseFloat(i.thickness); if (!isNaN(t) && t > 0) data.thicknesses.add(t); });
  return { subGroup, density: data.density, thicknesses: Array.from(data.thicknesses).sort((a, b) => a - b) };
});

// ─── Section Header ───────────────────────────────────────────
const SH = ({ label }: { label: string }) => (
  <p className="text-xs font-bold text-purple-700 uppercase tracking-widest mb-2 pb-1.5 border-b border-purple-100">{label}</p>
);

const Pill = ({ label, value, cls = "bg-gray-50 text-gray-700 border-gray-200" }: { label: string; value: string; cls?: string }) => (
  <div className={`rounded-lg border px-3 py-2 ${cls}`}>
    <p className="text-[10px] font-semibold uppercase text-current opacity-50 mb-0.5">{label}</p>
    <p className="text-xs font-bold">{value || "—"}</p>
  </div>
);

// ─── Main Page ────────────────────────────────────────────────
export default function ProductCatalogPage() {
  const { categories } = useCategories();
  const { catalog, saveCatalogItem, deleteCatalogItem } = useProductCatalog();
  const [workOrders] = useState<GravureWorkOrder[]>(initWOs);

  const [catalogTab, setCatalogTab] = useState<"pending" | "processed">("pending");
  const [viewPlanRow, setViewPlanRow] = useState<GravureProductCatalog | null>(null);
  const [deleteId,    setDeleteId]   = useState<string | null>(null);

  // ── Create Catalog state ──────────────────────────────────
  const [createOpen,  setCreateOpen]  = useState(false);
  const [sourceOrder, setSourceOrder] = useState<GravureOrder | null>(null);
  const [sourceWO,    setSourceWO]    = useState<GravureWorkOrder | null>(null);
  const [editName,   setEditName]   = useState("");
  const [editRate,   setEditRate]   = useState(0);
  const [editRemark, setEditRemark] = useState("");

  // ── Dimension diagram state ───────────────────────────────
  const [dimValues, setDimValues] = useState<DimValues>({});
  const patchDim = (patch: DimValues) => setDimValues(p => ({ ...p, ...patch }));

  // ── Replan / Edit state ───────────────────────────────────
  const [replanOpen,    setReplanOpen]    = useState(false);
  const [replanForm,    setReplanForm]    = useState<GravureProductCatalog | null>(null);
  const [replanTab,     setReplanTab]     = useState<"info" | "planning" | "material">("info");
  const [isNewCatalog,  setIsNewCatalog]  = useState(false);

  type FilmRequisition = { source: "Extrusion" | "Purchase" | ""; status: "Pending" | "Requested" | "Available"; requiredDate?: string; spec?: string; priority?: string; vendor?: string; expectedRate?: number; remarks?: string; };
  type ColorShade      = { colorNo: number; colorName: string; inkType: "Spot" | "Process" | "Special"; pantoneRef: string; labL: string; labA: string; labB: string; actualL: string; actualA: string; actualB: string; deltaE: string; shadeCardRef: string; status: "Pending" | "Standard Received" | "Approved" | "Rejected"; remarks: string; };
  type MaterialAlloc   = { id: string; plyNo?: number; materialType: string; materialName: string; requiredQty: number; unit: string; allocatedQty: number; lotNo: string; location: string; status: "Pending" | "Partial" | "Allocated"; };
  type CylinderAlloc   = { colorNo: number; colorName: string; cylinderNo: string; circumference: string; cylinderType: "New" | "Existing" | "Rechromed"; status: "Pending" | "Available" | "In Use" | "Under Chrome" | "Ordered"; remarks: string; };
  const [catalogFilmReqs,   setCatalogFilmReqs]   = useState<FilmRequisition[]>([]);
  const [catalogColorShades,setCatalogColorShades] = useState<ColorShade[]>([]);
  const [catalogMatAllocs,  setCatalogMatAllocs]   = useState<MaterialAlloc[]>([]);
  const [catalogCylAllocs,  setCatalogCylAllocs]   = useState<CylinderAlloc[]>([]);
  const [catalogPrepTab,    setCatalogPrepTab]     = useState<"shade" | "tool">("shade");
  const [replanShowPlan,      setReplanShowPlan]      = useState(false);
  const [replanIsPlanApplied, setReplanIsPlanApplied] = useState(false);
  const [replanPlanSearch,    setReplanPlanSearch]    = useState("");
  const [replanPlanSort,      setReplanPlanSort]      = useState<{ key: string; dir: "asc" | "desc" }>({ key: "", dir: "asc" });
  const [replanSelPlanId,     setReplanSelPlanId]     = useState("");
  const [upsPreviewPlan,      setUpsPreviewPlan]      = useState<any>(null);
  const [cylGuideOpen,        setCylGuideOpen]        = useState(false);
  const [previewAttachment,   setPreviewAttachment]   = useState<{ name: string; url: string; mimeType: string } | null>(null);
  const [printRow,            setPrintRow]            = useState<GravureProductCatalog | null>(null);

  // ── Plan grid column filters (Excel-style) ────────────────
  const [planColFilters,   setPlanColFilters]   = useState<Record<string, Set<string>>>({});
  const [planFilterOpen,   setPlanFilterOpen]   = useState<string | null>(null);
  const [planFilterSearch, setPlanFilterSearch] = useState<Record<string, string>>({});
  const [planFilterDraft,  setPlanFilterDraft]  = useState<Record<string, Set<string>>>({});

  const openPlanFilter = (key: string) => {
    setPlanFilterDraft(d => ({ ...d, [key]: new Set(planColFilters[key] ?? []) }));
    setPlanFilterSearch(s => ({ ...s, [key]: "" }));
    setPlanFilterOpen(key);
  };
  const applyPlanFilter = (key: string) => {
    const draft = planFilterDraft[key];
    if (!draft || draft.size === 0) {
      setPlanColFilters(p => { const n = { ...p }; delete n[key]; return n; });
    } else {
      setPlanColFilters(p => ({ ...p, [key]: draft }));
    }
    setPlanFilterOpen(null);
  };
  const clearPlanFilter = (key: string) => {
    setPlanColFilters(p => { const n = { ...p }; delete n[key]; return n; });
    setPlanFilterOpen(null);
  };
  const togglePlanFilterVal = (key: string, val: string) => {
    setPlanFilterDraft(d => {
      const s = new Set(d[key] ?? []);
      s.has(val) ? s.delete(val) : s.add(val);
      return { ...d, [key]: s };
    });
  };
  const togglePlanFilterAll = (key: string, allVals: string[]) => {
    setPlanFilterDraft(d => {
      const s = d[key] ?? new Set<string>();
      const newS = s.size === allVals.length ? new Set<string>() : new Set(allVals);
      return { ...d, [key]: newS };
    });
  };

  type CatalogAttachment = { id: string; name: string; size: number; mimeType: string; url: string; label?: string };
  const [replanAttachments, setReplanAttachments] = useState<CatalogAttachment[]>([]);
  const [editingAttachLabel, setEditingAttachLabel] = useState<string | null>(null); // att.id being edited

  const addAttachments = (files: FileList | null) => {
    if (!files) return;
    const newItems: CatalogAttachment[] = Array.from(files).map((f, i) => ({
      id: Math.random().toString(36).slice(2),
      name: f.name, size: f.size, mimeType: f.type,
      url: URL.createObjectURL(f),
      label: replanAttachments.length === 0 && i === 0 ? "Master File" : undefined,
    }));
    setReplanAttachments(p => [...p, ...newItems]);
  };
  const removeAttachment = (id: string) => {
    setReplanAttachments(p => { const item = p.find(x => x.id === id); if (item) URL.revokeObjectURL(item.url); return p.filter(x => x.id !== id); });
  };

  const rf = <K extends keyof GravureProductCatalog>(k: K, v: GravureProductCatalog[K]) => {
    setReplanForm(p => {
      if (!p) return p;
      const next = { ...p, [k]: v };
      if (k === "frontColors" || k === "backColors") {
        next.noOfColors = ((k === "frontColors" ? v : p.frontColors) as number || 0) + ((k === "backColors" ? v : p.backColors) as number || 0);
      }
      return next;
    });
  };

  // ── Ply helpers ───────────────────────────────────────────
  const onPlyTypeChange = (index: number, plyType: string) => {
    if (!replanForm) return;
    const layers = [...replanForm.secondaryLayers];
    layers[index] = { ...layers[index], plyType, consumableItems: [] };
    rf("secondaryLayers", layers);
  };

  const updatePlyConsumable = (layerIdx: number, ciIdx: number, patch: Partial<PlyConsumableItem>) => {
    if (!replanForm) return;
    const layers = [...replanForm.secondaryLayers];
    const layer = { ...layers[layerIdx] };
    const ci = [...layer.consumableItems];
    ci[ciIdx] = { ...ci[ciIdx], ...patch };
    layer.consumableItems = ci;
    layers[layerIdx] = layer;
    rf("secondaryLayers", layers);
  };

  const addPlyConsumable = (layerIdx: number) => {
    if (!replanForm) return;
    const layers = [...replanForm.secondaryLayers];
    const layer = { ...layers[layerIdx] };
    layer.consumableItems = [...layer.consumableItems, {
      consumableId: Math.random().toString(),
      fieldDisplayName: "", itemGroup: "", itemSubGroup: "",
      itemId: "", itemName: "", gsm: 0, rate: 0,
    } as PlyConsumableItem];
    layers[layerIdx] = layer;
    rf("secondaryLayers", layers);
  };

  const removePlyConsumable = (layerIdx: number, ciIdx: number) => {
    if (!replanForm) return;
    const layers = [...replanForm.secondaryLayers];
    const layer = { ...layers[layerIdx] };
    layer.consumableItems = layer.consumableItems.filter((_, i) => i !== ciIdx);
    layers[layerIdx] = layer;
    rf("secondaryLayers", layers);
  };

  const clonePlyConsumable = (layerIdx: number, ciIdx: number) => {
    if (!replanForm) return;
    const layers = [...replanForm.secondaryLayers];
    const layer = { ...layers[layerIdx] };
    const source = layer.consumableItems[ciIdx];
    const clone: PlyConsumableItem = { ...source, consumableId: Math.random().toString() };
    layer.consumableItems = [
      ...layer.consumableItems.slice(0, ciIdx + 1),
      clone,
      ...layer.consumableItems.slice(ciIdx + 1),
    ];
    layers[layerIdx] = layer;
    rf("secondaryLayers", layers);
  };

  const addReplanProcess = () => {
    if (!replanForm) return;
    rf("processes", [...replanForm.processes, { processId: "", processName: "", chargeUnit: "", rate: 0, qty: 0, setupCharge: 0, amount: 0 }]);
  };

  const removeReplanProcess = (i: number) => {
    if (!replanForm) return;
    rf("processes", replanForm.processes.filter((_, idx) => idx !== i));
  };

  const updateReplanProcess = (i: number, patch: Partial<GravureEstimationProcess>) => {
    if (!replanForm) return;
    rf("processes", replanForm.processes.map((pr, idx) => {
      if (idx !== i) return pr;
      const updated = { ...pr, ...patch };
      updated.amount = parseFloat((updated.rate * updated.qty + updated.setupCharge).toFixed(2));
      return updated;
    }));
  };

  const selectReplanProcess = (i: number, processId: string) => {
    const pm = ROTO_PROCESSES.find(x => x.id === processId);
    if (!pm) return;
    updateReplanProcess(i, { processId: pm.id, processName: pm.name, chargeUnit: pm.chargeUnit, rate: parseFloat(pm.rate) || 0, setupCharge: pm.makeSetupCharges ? parseFloat(pm.setupChargeAmount) || 0 : 0 });
  };

  const cellInput = "w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-purple-400 bg-white";

  // ── Live cost for replan ──────────────────────────────────
  type CatalogMatRow = { plyNo: number; plyType: string; itemName: string; group: string; gsm: number; reqMtr: number; reqSQM: number; reqWt: number; wasteMtr: number; wasteSQM: number; wasteWt: number; totalMtr: number; totalSQM: number; totalWt: number; rate: number; amount: number; };

  const replanCost = useMemo(() => {
    if (!replanForm) return null;
    const qty    = replanForm.standardQty || 0;
    const widthM = (replanForm.jobWidth || 0) / 1000;
    const areaM2 = qty * widthM;
    const WASTE  = 0.03;
    let filmCost = 0, consumableCost = 0;
    const materialRows: CatalogMatRow[] = [];

    replanForm.secondaryLayers.forEach(l => {
      const reqMtr = qty; const reqSQM = areaM2;
      if (l.itemSubGroup && l.gsm > 0) {
        const fi   = FILM_ITEMS.find(x => x.subGroup === l.itemSubGroup);
        const rate = l.filmRate !== undefined ? l.filmRate : (parseFloat(fi?.estimationRate || "0") || 0);
        const reqWt = (l.gsm / 1000) * reqSQM;
        const wasteMtr = reqMtr * WASTE; const wasteSQM = reqSQM * WASTE; const wasteWt = reqWt * WASTE;
        const totalWt = reqWt + wasteWt;
        filmCost += totalWt * rate;
        materialRows.push({ plyNo: l.layerNo, plyType: l.plyType || "Film", itemName: l.itemSubGroup, group: "Film", gsm: l.gsm, reqMtr, reqSQM, reqWt, wasteMtr, wasteSQM, wasteWt, totalMtr: reqMtr + wasteMtr, totalSQM: reqSQM + wasteSQM, totalWt, rate, amount: totalWt * rate });
      }
      (l.consumableItems || []).forEach(ci => {
        if (!ci.gsm && ci.gsm !== 0) return;
        const effGsm = (ci.coveragePct ?? 100) < 100 ? ci.gsm * ((ci.coveragePct ?? 100) / 100) : ci.gsm;
        const reqWt = (effGsm / 1000) * reqSQM;
        const wasteMtr = reqMtr * WASTE; const wasteSQM = reqSQM * WASTE; const wasteWt = reqWt * WASTE;
        const totalWt = reqWt + wasteWt; const amount = totalWt * (ci.rate || 0);
        consumableCost += amount;
        materialRows.push({ plyNo: l.layerNo, plyType: l.plyType || "", itemName: ci.itemName || ci.fieldDisplayName || ci.itemSubGroup, group: ci.itemGroup, gsm: ci.gsm || 0, reqMtr, reqSQM, reqWt, wasteMtr, wasteSQM, wasteWt, totalMtr: reqMtr + wasteMtr, totalSQM: reqSQM + wasteSQM, totalWt, rate: ci.rate || 0, amount });
      });
    });

    let processCost = 0;
    replanForm.processes.forEach(p => {
      const pQty = p.chargeUnit === "SQM" ? areaM2 : p.chargeUnit === "Meter" ? qty : p.chargeUnit === "Color" ? replanForm.noOfColors : 1;
      processCost += pQty * (p.rate || 0);
    });

    const cylinderCost = (replanForm.noOfColors || 0) * (replanForm.cylinderCostPerColor || 0);
    const materialCost = filmCost + consumableCost;
    const subtotal     = materialCost + processCost + cylinderCost;
    const overhead     = subtotal * ((replanForm.overheadPct || 0) / 100);
    const profit       = (subtotal + overhead) * ((replanForm.profitPct || 0) / 100);
    const total        = subtotal + overhead + profit;
    const perMeter     = qty > 0 ? total / qty : 0;
    return { filmCost, consumableCost, materialCost, processCost, cylinderCost, overhead, profit, total, perMeter, materialRows };
  }, [replanForm]);

  // ── Production Plan for Catalog (Sleeve × Cylinder based) ──
  const replanAllPlans = useMemo(() => {
    const planWidth = replanForm?.actualWidth || replanForm?.jobWidth || 0;
    if (!replanForm?.machineId || planWidth <= 0) return [];
    const machine = PRINT_MACHINES.find(m => m.id === replanForm.machineId);
    if (!machine) return [];

    const machineMaxFilm = parseFloat((machine as any).maxWebWidth) || 1300;
    const machineMinFilm = parseFloat((machine as any).minWebWidth) || 0;
    const machineMinCirc = parseFloat((machine as any).repeatLengthMin) || 0;
    const machineMaxCirc = parseFloat((machine as any).repeatLengthMax) || 9999;
    const shrink    = replanForm.widthShrinkage || 0;
    const jobH      = replanForm.jobHeight || 0;
    const effectiveRepeat = jobH + shrink; // shrinkage adds to repeat length, not width
    const laneWidth = planWidth; // width is not affected by shrinkage
    const trim      = replanForm.trimmingSize || 0;

    // per-cylinder: UPS around = cylCirc / effectiveRepeat — must be an EXACT multiple (within 0.5mm tolerance)
    const calcRepeatUPS = (cylRepeatLength: number) => {
      if (effectiveRepeat <= 0) return 1;
      const ups = cylRepeatLength / effectiveRepeat;
      const rounded = Math.round(ups);
      return rounded;
    };
    // returns true only if cylCirc is within machine circ range AND exact multiple of effectiveRepeat (±0.5mm)
    const isValidCircumference = (cylCirc: number) => {
      if (cylCirc < machineMinCirc || cylCirc > machineMaxCirc) return false;
      if (effectiveRepeat <= 0) return true;
      const remainder = cylCirc % effectiveRepeat;
      return remainder < 0.5 || (effectiveRepeat - remainder) < 0.5;
    };

    // ── LOOP A: Sleeve in stock → cylinder (or SPECIAL CYL) ──
    const loopA = SLEEVE_TOOLS.flatMap(sleeve => {
      const sleeveWidthVal = parseFloat(sleeve.printWidth);
      if (sleeveWidthVal > machineMaxFilm) return [];
      const maxAcUps = Math.floor(sleeveWidthVal / laneWidth);
      if (maxAcUps === 0) return [];
      return Array.from({ length: maxAcUps }, (_, i) => {
        const acUps = i + 1;
        const printingWidth = acUps * laneWidth;
        const filmWidth = printingWidth + 2 * trim;
        if (filmWidth > sleeveWidthVal) return [];
        if (filmWidth < machineMinFilm) return [];
        const req    = filmWidth + 100;
        const minCyl = req < sleeveWidthVal ? req : sleeveWidthVal + 100;
        // Only keep real cylinders whose circumference is an exact multiple of effectiveRepeat
        const validCylinders = CYLINDER_TOOLS.filter(t => {
          if (parseFloat(t.printWidth) < minCyl) return false;
          const circ = parseFloat(t.repeatLength || "450") || 450;
          return isValidCircumference(circ);
        });
        // If no real cylinder matches → generate Special Order entries for each valid multiple
        // of effectiveRepeat (from smallest above 200mm up to 1100mm)
        const specialCylinders = (() => {
          if (effectiveRepeat <= 0) return [{ id: "SPECIAL-CYL-1", code: "SPL", name: "Special Order", printWidth: String(Math.ceil(minCyl)), repeatLength: "450", isSpecial: true, isSpecialSleeve: false }];
          const results = [];
          for (let mult = 1; mult * effectiveRepeat <= machineMaxCirc; mult++) {
            const circ = mult * effectiveRepeat;
            if (circ < machineMinCirc) continue; // below machine min circumference
            results.push({ id: `SPECIAL-CYL-${mult}`, code: "SPL", name: `Special Order (${mult}×${effectiveRepeat}mm)`, printWidth: String(Math.ceil(minCyl)), repeatLength: String(circ), isSpecial: true, isSpecialSleeve: false });
          }
          return results.length > 0 ? results : [];
        })();
        const cylList = validCylinders.length > 0
          ? validCylinders.map(c => ({ id: c.id, code: c.code, name: c.name, printWidth: c.printWidth, repeatLength: c.repeatLength || "450", isSpecial: false, isSpecialSleeve: false }))
          : specialCylinders;
        const sideWaste  = parseFloat((2 * trim).toFixed(1));
        const deadMargin = parseFloat((sleeveWidthVal - filmWidth).toFixed(1));
        const totalWaste = parseFloat((sideWaste + deadMargin).toFixed(1));
        return cylList.flatMap(cylinder => {
          const cylCirc   = parseFloat(cylinder.repeatLength) || 450;
          const repeatUPS = calcRepeatUPS(cylCirc);
          const totalUPS  = acUps * repeatUPS;
          const reqRMT    = replanForm.standardQty > 0 ? Math.ceil(replanForm.standardQty / totalUPS) : 1;
          const totalRMT  = Math.ceil(reqRMT * 1.01);
          return [{
            planId: `CP-${machine.id}-${sleeve.id}-UPS${acUps}-${cylinder.id}`,
            machineName: machine.name,
            filmSize: filmWidth, acUps, printingWidth,
            sleeveCode: sleeve.code, sleeveName: sleeve.name, sleeveWidthVal,
            cylinderCode: cylinder.code, cylinderName: cylinder.name,
            cylinderWidthVal: parseFloat(cylinder.printWidth),
            sideWaste, deadMargin, totalWaste,
            cylCirc, repeatUPS, totalUPS,
            reqRMT, totalRMT, wastage: totalWaste,
            isSpecial: cylinder.isSpecial, isSpecialSleeve: false, isBest: false,
          }];
        }).flat();
      }).flat();
    });

    // ── LOOP B: Cylinder in stock → no sleeve available → SPECIAL SLEEVE ──
    const loopB = CYLINDER_TOOLS.flatMap(cylinder => {
      const cylWidthVal = parseFloat(cylinder.printWidth);
      const maxAcUps    = Math.floor(cylWidthVal / laneWidth);
      if (maxAcUps === 0) return [];
      return Array.from({ length: maxAcUps }, (_, i) => {
        const acUps = i + 1;
        const printingWidth = acUps * laneWidth;
        const filmWidth = printingWidth + 2 * trim;
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
        const sideWaste  = parseFloat((2 * trim).toFixed(1));
        const deadMargin = 0;
        const totalWaste = sideWaste;
        const cylCirc    = parseFloat(cylinder.repeatLength || "450") || 450;
        if (!isValidCircumference(cylCirc)) return [];
        const repeatUPS  = calcRepeatUPS(cylCirc);
        const totalUPS   = acUps * repeatUPS;
        const reqRMT     = replanForm.standardQty > 0 ? Math.ceil(replanForm.standardQty / totalUPS) : 1;
        const totalRMT   = Math.ceil(reqRMT * 1.01);
        return [{
          planId: `CP-${machine.id}-SPLSLV-UPS${acUps}-${cylinder.id}`,
          machineName: machine.name,
          filmSize: filmWidth, acUps, printingWidth,
          sleeveCode: "SPL-S", sleeveName: "Special Order", sleeveWidthVal: filmWidth,
          cylinderCode: cylinder.code, cylinderName: cylinder.name,
          cylinderWidthVal: cylWidthVal,
          sideWaste, deadMargin, totalWaste,
          cylCirc, repeatUPS, totalUPS,
          reqRMT, totalRMT, wastage: totalWaste,
          isSpecial: true, isSpecialSleeve: true, isBest: false,
        }];
      }).flat();
    });

    const rawPlans = [...loopA, ...loopB];

    if (rawPlans.length === 0) return rawPlans;
    const sorted = [...rawPlans].sort((a, b) =>
      a.totalWaste  !== b.totalWaste  ? a.totalWaste  - b.totalWaste  :
      a.deadMargin  !== b.deadMargin  ? a.deadMargin  - b.deadMargin  :
      a.sideWaste   !== b.sideWaste   ? a.sideWaste   - b.sideWaste   :
      b.acUps       !== a.acUps       ? b.acUps        - a.acUps       : 0
    );
    return sorted.map((p, idx) => ({ ...p, isBest: !p.isSpecial && idx === 0 }));
  }, [replanForm?.machineId, replanForm?.actualWidth, replanForm?.jobWidth, replanForm?.jobHeight, replanForm?.trimmingSize, replanForm?.widthShrinkage, replanForm?.standardQty]); // eslint-disable-line react-hooks/exhaustive-deps

  const replanVisiblePlans = useMemo(() => {
    let rows = replanAllPlans;
    const q = replanPlanSearch.trim().toLowerCase();
    if (q) rows = rows.filter(r => r.machineName.toLowerCase().includes(q) || String(r.cylCirc).includes(q) || String(r.totalUPS).includes(q));
    // per-column filters
    Object.entries(planColFilters).forEach(([key, vals]) => {
      if (!vals || vals.size === 0) return;
      rows = rows.filter(r => vals.has(String((r as any)[key] ?? "")));
    });
    if (replanPlanSort.key) {
      rows = [...rows].sort((a, b) => {
        const av = (a as any)[replanPlanSort.key] ?? 0; const bv = (b as any)[replanPlanSort.key] ?? 0;
        const diff = typeof av === "number" ? av - bv : String(av).localeCompare(String(bv));
        return replanPlanSort.dir === "asc" ? diff : -diff;
      });
    }
    return rows;
  }, [replanAllPlans, replanPlanSearch, replanPlanSort, planColFilters]);

  const replanTogglePlanSort = (key: string) =>
    setReplanPlanSort(s => s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" });

  const replanSelectedPlan = useMemo(() =>
    replanAllPlans.find(p => p.planId === replanSelPlanId) || null,
    [replanAllPlans, replanSelPlanId]
  );

  // ── Auto-build plys from category (same as Estimation) ──────
  const [pendingReplanCategoryId, setPendingReplanCategoryId] = useState<string | null>(null);
  const applyReplanCategory = (categoryId: string) => {
    const cat = categories.find(c => c.id === categoryId);
    const plyOrder = ["Film", "Printing", "Lamination", "Coating"];
    const usedTypes = new Set((cat?.plyConsumables || []).map(pc => pc.plyType));
    const autoTypes = plyOrder.filter(pt => pt === "Film" || usedTypes.has(pt));
    const autoLayers: SecondaryLayer[] = autoTypes.map((plyType, i) => {
      const consumableItems: PlyConsumableItem[] = (cat?.plyConsumables || [])
        .filter(pc => pc.plyType === plyType)
        .map(pc => ({
          consumableId: pc.id, fieldDisplayName: pc.fieldDisplayName,
          itemGroup: pc.itemGroup, itemSubGroup: pc.itemSubGroup,
          itemId: "", itemName: "", gsm: pc.defaultValue, rate: 0,
        }));
      return { id: Math.random().toString(), layerNo: i + 1, plyType, itemSubGroup: "", density: 0, thickness: 0, gsm: 0, consumableItems };
    });
    setReplanForm(p => p ? { ...p, categoryId, categoryName: cat?.name || "", secondaryLayers: autoLayers, content: "" } : p);
  };

  const initCatalogPrepData = (rf: GravureProductCatalog) => {
    const n = rf.noOfColors || 0;
    setCatalogColorShades(Array.from({ length: n }, (_, i) => ({
      colorNo: i + 1, colorName: `Color ${i + 1}`, inkType: "Spot" as const,
      pantoneRef: "", labL: "", labA: "", labB: "", actualL: "", actualA: "", actualB: "", deltaE: "1.0",
      shadeCardRef: "", status: "Pending" as const, remarks: "",
    })));
    const reqSQM = (rf.standardQty || 0) * ((rf.jobWidth || 0) / 1000);
    const allocs: MaterialAlloc[] = [];
    rf.secondaryLayers.forEach((l, i) => {
      if (l.itemSubGroup) {
        const reqWt = l.gsm > 0 ? parseFloat(((l.gsm / 1000) * reqSQM * 1.03).toFixed(3)) : 0;
        allocs.push({ id: `film-${i}`, plyNo: l.layerNo, materialType: "Film", materialName: l.itemSubGroup, requiredQty: reqWt, unit: "Kg", allocatedQty: 0, lotNo: "", location: "", status: "Pending" });
      }
      (l.consumableItems || []).forEach((ci, j) => {
        const reqWt = ci.gsm > 0 ? parseFloat(((ci.gsm / 1000) * reqSQM * 1.03).toFixed(3)) : 0;
        allocs.push({ id: `con-${i}-${j}`, plyNo: l.layerNo, materialType: ci.itemGroup, materialName: ci.itemName || ci.fieldDisplayName, requiredQty: reqWt, unit: "Kg", allocatedQty: 0, lotNo: "", location: "", status: "Pending" });
      });
    });
    setCatalogMatAllocs(allocs);
    setCatalogCylAllocs(Array.from({ length: n }, (_, i) => ({
      colorNo: i + 1, colorName: `Color ${i + 1}`, cylinderNo: "",
      circumference: "", cylinderType: "Existing" as const, status: "Pending" as const, remarks: "",
    })));
  };

  const openReplan = (row: GravureProductCatalog) => {
    setIsNewCatalog(false);
    setReplanForm({ ...row });
    setReplanTab("info");
    setCatalogFilmReqs([]); setCatalogColorShades([]); setCatalogMatAllocs([]); setCatalogCylAllocs([]); setCatalogPrepTab("shade");
    setReplanSelPlanId(""); setReplanShowPlan(false); setReplanIsPlanApplied(false); setReplanPlanSearch(""); setReplanPlanSort({ key: "", dir: "asc" }); setReplanAttachments([]);
    setReplanOpen(true);
  };

  const saveReplan = () => {
    if (!replanForm) return;
    const n = catalog.length + 1;
    const updated: GravureProductCatalog = {
      ...replanForm,
      perMeterRate: replanCost?.perMeter ?? replanForm.perMeterRate,
      ...(isNewCatalog && {
        id:        `GPC${String(n).padStart(3, "0")}`,
        catalogNo: `GRV-CAT-${String(n).padStart(3, "0")}`,
      }),
    };
    saveCatalogItem(updated);
    setReplanOpen(false);
    setReplanForm(null);
    if (isNewCatalog) { setIsNewCatalog(false); setCatalogTab("processed"); }
  };

  // ── Derived lists ─────────────────────────────────────────
  const catalogedOrderIds = useMemo(() => {
    const ids = new Set<string>();
    catalog.forEach(c => { if (c.sourceOrderId) ids.add(c.sourceOrderId); });
    return ids;
  }, [catalog]);

  const pendingOrders = useMemo(() =>
    gravureOrders.filter(o => !catalogedOrderIds.has(o.id)),
    [catalogedOrderIds]
  );

  const processedCatalog = useMemo(() => catalog, [catalog]);

  // ── Open Create — opens full 3-tab modal directly ─────────
  const openCreate = (order: GravureOrder) => {
    const wo   = workOrders.find(w => w.orderId === order.id) || null;
    const line = order.orderLines?.[0];
    const n    = catalog.length + 1;
    const draft: GravureProductCatalog = {
      id:          `GPC${String(n).padStart(3, "0")}-DRAFT`,
      catalogNo:   `GRV-CAT-${String(n).padStart(3, "0")}`,
      createdDate: new Date().toISOString().slice(0, 10),
      productName:  wo?.jobName || line?.productName || order.jobName || "",
      customerId:   order.customerId,
      customerName: order.customerName,
      categoryId: "", categoryName: "", content: "",
      jobWidth:    wo?.jobWidth  || line?.jobWidth  || order.jobWidth  || 0,
      jobHeight:   wo?.jobHeight || line?.jobHeight || order.jobHeight || 0,
      actualWidth:  wo?.actualWidth  || 0,
      actualHeight: wo?.actualHeight || 0,
      noOfColors:  wo?.noOfColors  || line?.noOfColors  || order.noOfColors  || 0,
      printType:   (wo?.printType  || line?.printType  || order.printType   || "Surface Print") as GravureProductCatalog["printType"],
      substrate:   wo?.substrate   || line?.substrate  || order.substrate   || "",
      secondaryLayers: [...(wo?.secondaryLayers || order.secondaryLayers || [])],
      processes:       [...(wo?.processes       || order.processes       || [])],
      machineId:   wo?.machineId   || "",
      machineName: wo?.machineName || "",
      cylinderCostPerColor: wo?.cylinderCostPerColor || 3500,
      overheadPct: wo?.overheadPct || 12,
      profitPct:   wo?.profitPct   || 15,
      perMeterRate: wo?.perMeterRate || line?.rate || order.perMeterRate || 0,
      standardQty:  wo?.quantity   || line?.orderQty || order.quantity || 0,
      standardUnit: wo?.unit       || line?.unit     || order.unit     || "Meter",
      sourceEstimationId: "", sourceEstimationNo: "",
      sourceOrderId:   order.id,
      sourceOrderNo:   order.orderNo,
      sourceWorkOrderId:  wo?.id         || "",
      sourceWorkOrderNo:  wo?.workOrderNo || "",
      trimmingSize: wo?.trimmingSize,
      frontColors:  wo?.frontColors,
      backColors:   wo?.backColors,
      status: "Active",
      remarks: wo?.specialInstructions || "",
    };
    setIsNewCatalog(true);
    setReplanForm(draft);
    setReplanTab("info");
    setCatalogFilmReqs([]); setCatalogColorShades([]); setCatalogMatAllocs([]); setCatalogCylAllocs([]); setCatalogPrepTab("shade");
    setReplanSelPlanId(""); setReplanShowPlan(false); setReplanIsPlanApplied(false); setReplanPlanSearch(""); setReplanPlanSort({ key: "", dir: "asc" }); setReplanAttachments([]);
    setReplanOpen(true);
  };

  // ── Open Direct Create — blank catalog without an order ──
  const openDirectCreate = () => {
    const n = catalog.length + 1;
    const draft: GravureProductCatalog = {
      id:          `GPC${String(n).padStart(3, "0")}-DRAFT`,
      catalogNo:   `GRV-CAT-${String(n).padStart(3, "0")}`,
      createdDate: new Date().toISOString().slice(0, 10),
      productName:  "",
      customerId:   "", customerName: "",
      categoryId:   "", categoryName: "", content: "",
      jobWidth: 0, jobHeight: 0,
      actualWidth: 0, actualHeight: 0,
      noOfColors: 0,
      printType: "Surface Print",
      substrate: "",
      secondaryLayers: [],
      processes: [],
      machineId: "", machineName: "",
      cylinderCostPerColor: 3500,
      overheadPct: 12, profitPct: 15,
      perMeterRate: 0,
      standardQty: 0, standardUnit: "Meter",
      sourceEstimationId: "", sourceEstimationNo: "",
      sourceOrderId: "", sourceOrderNo: "",
      sourceWorkOrderId: "", sourceWorkOrderNo: "",
      status: "Active",
      remarks: "",
    };
    setIsNewCatalog(true);
    setReplanForm(draft);
    setReplanTab("info");
    setCatalogFilmReqs([]); setCatalogColorShades([]); setCatalogMatAllocs([]); setCatalogCylAllocs([]); setCatalogPrepTab("shade");
    setReplanSelPlanId(""); setReplanShowPlan(false); setReplanIsPlanApplied(false); setReplanPlanSearch(""); setReplanPlanSort({ key: "", dir: "asc" }); setReplanAttachments([]);
    setReplanOpen(true);
  };

  // ── Save Catalog ──────────────────────────────────────────
  const saveCatalog = () => {
    if (!sourceOrder || !editName.trim()) return;
    const wo   = sourceWO;
    const line = sourceOrder.orderLines?.[0];
    const n    = catalog.length + 1;
    const item: GravureProductCatalog = {
      id:          `GPC${String(n).padStart(3, "0")}`,
      catalogNo:   `GRV-CAT-${String(n).padStart(3, "0")}`,
      createdDate: new Date().toISOString().slice(0, 10),
      productName:  editName,
      customerId:   sourceOrder.customerId,
      customerName: sourceOrder.customerName,
      categoryId: "", categoryName: "", content: "",
      jobWidth:    wo?.jobWidth  || line?.jobWidth  || sourceOrder.jobWidth  || 0,
      jobHeight:   wo?.jobHeight || line?.jobHeight || sourceOrder.jobHeight || 0,
      actualWidth:  wo?.actualWidth  || 0,
      actualHeight: wo?.actualHeight || 0,
      noOfColors:  wo?.noOfColors  || line?.noOfColors  || sourceOrder.noOfColors  || 0,
      printType:   (wo?.printType  || line?.printType  || sourceOrder.printType   || "Surface Print") as GravureProductCatalog["printType"],
      substrate:   wo?.substrate   || line?.substrate  || sourceOrder.substrate   || "",
      secondaryLayers:      [...(wo?.secondaryLayers      || sourceOrder.secondaryLayers      || [])],
      processes:            [...(wo?.processes            || sourceOrder.processes            || [])],
      machineId:   wo?.machineId   || "",
      machineName: wo?.machineName || "",
      cylinderCostPerColor: wo?.cylinderCostPerColor || 3500,
      overheadPct: wo?.overheadPct || 12,
      profitPct:   wo?.profitPct   || 15,
      perMeterRate: editRate,
      standardQty:  wo?.quantity   || line?.orderQty || sourceOrder.quantity || 0,
      standardUnit: wo?.unit       || line?.unit     || sourceOrder.unit     || "Meter",
      sourceEstimationId: "", sourceEstimationNo: "",
      sourceOrderId:   sourceOrder.id,
      sourceOrderNo:   sourceOrder.orderNo,
      sourceWorkOrderId:  wo?.id         || "",
      sourceWorkOrderNo:  wo?.workOrderNo || "",
      trimmingSize: wo?.trimmingSize,
      frontColors:  wo?.frontColors,
      backColors:   wo?.backColors,
      status: "Active",
      remarks: editRemark,
    };
    saveCatalogItem(item);
    setCreateOpen(false);
    setCatalogTab("processed");
  };

  // ── Processed table columns ───────────────────────────────
  const processedCols: Column<GravureProductCatalog>[] = [
    { key: "catalogNo",    header: "Catalog No",   sortable: true },
    { key: "productName",  header: "Product Name", sortable: true },
    { key: "customerName", header: "Customer",     sortable: true },
    { key: "sourceOrderNo", header: "Order Ref",
      render: r => <span className="text-xs font-mono text-gray-500">{r.sourceOrderNo || "—"}</span> },
    { key: "sourceWorkOrderNo", header: "WO Ref",
      render: r => r.sourceWorkOrderNo
        ? <span className="px-2 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded-full text-xs font-semibold">{r.sourceWorkOrderNo}</span>
        : <span className="text-xs text-gray-400">—</span> },
    { key: "noOfColors", header: "Colors",
      render: r => <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold">{r.noOfColors}C</span> },
    { key: "status", header: "Status", render: r => statusBadge(r.status), sortable: true },
  ];

  const stats = { pending: pendingOrders.length, processed: processedCatalog.length };

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <BookMarked size={18} className="text-purple-600" />
            <h2 className="text-lg font-semibold text-gray-800">Product Catalog</h2>
          </div>
          <p className="text-sm text-gray-500">
            {stats.pending} orders pending · {stats.processed} in catalog
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button icon={<Plus size={14} />} onClick={openDirectCreate}
            className="bg-purple-600 text-white hover:bg-purple-700 border-0">
            Create Direct Catalog
          </Button>
        </div>
      </div>

      {/* ── Catalog Numbers Strip ── */}
      {processedCatalog.length > 0 && (
        <div className="rounded-xl border border-purple-100 bg-purple-50/60 px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <BookMarked size={12} className="text-purple-500" />
            <span className="text-[10px] font-bold text-purple-600 uppercase tracking-widest">
              Catalog Numbers ({processedCatalog.length})
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {processedCatalog.map(c => (
              <button
                key={c.id}
                onClick={() => { setViewPlanRow(c); }}
                title={`${c.productName} — ${c.customerName}`}
                className="group flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all
                  bg-white border-purple-200 text-purple-700 hover:bg-purple-600 hover:text-white hover:border-purple-600 hover:shadow-md">
                <span className="font-mono">{c.catalogNo}</span>
                <span className="text-[9px] font-medium opacity-60 group-hover:opacity-90 max-w-[80px] truncate hidden sm:block">
                  {c.productName}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border p-4 bg-amber-50 text-amber-700 border-amber-200">
          <p className="text-xs font-medium">Pending (Orders)</p>
          <p className="text-2xl font-bold mt-1">{stats.pending}</p>
        </div>
        <div className="rounded-xl border p-4 bg-green-50 text-green-700 border-green-200">
          <p className="text-xs font-medium">Processed (Catalog)</p>
          <p className="text-2xl font-bold mt-1">{stats.processed}</p>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex bg-gray-100 p-1 rounded-xl gap-1 w-fit">
        {([
          { key: "pending",   label: "Pending",   Icon: Clock,        count: stats.pending   },
          { key: "processed", label: "Processed", Icon: CheckCircle2, count: stats.processed },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setCatalogTab(t.key)}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-lg transition-all
              ${catalogTab === t.key ? "bg-white shadow text-purple-700" : "text-gray-500 hover:text-gray-700"}`}>
            <t.Icon size={14} />
            {t.label}
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold
              ${catalogTab === t.key ? "bg-purple-100 text-purple-700" : "bg-gray-200 text-gray-600"}`}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* ══ PENDING TAB ═══════════════════════════════════════════ */}
      {catalogTab === "pending" && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          {pendingOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <CheckCircle2 size={40} className="text-green-400 mb-3" />
              <p className="font-semibold text-gray-600">All orders have catalog entries!</p>
              <p className="text-sm mt-1">Every order has been converted to a product catalog.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {pendingOrders.map(order => {
                const wo   = workOrders.find(w => w.orderId === order.id);
                const line = order.orderLines?.[0];
                return (
                  <div key={order.id}
                    className="flex items-start gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                    <div className="flex-shrink-0 mt-0.5">
                      <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center">
                        <ShoppingCart size={18} className="text-teal-600" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-gray-800 text-sm truncate">
                          {line?.productName || order.jobName || "—"}
                        </p>
                        <span className="text-xs text-gray-400 font-mono flex-shrink-0">{order.orderNo}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                        <span className="font-medium text-gray-700">{order.customerName}</span>
                        {(line?.substrate || order.substrate) && (
                          <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded">
                            {line?.substrate || order.substrate}
                          </span>
                        )}
                        <span>{line?.noOfColors || order.noOfColors || 0}C · {line?.printType || order.printType || "—"}</span>
                        <span>{(line?.orderQty || order.quantity || 0).toLocaleString()} {line?.unit || order.unit || "Meter"}</span>
                        <span className="text-gray-400">{order.date}</span>
                      </div>
                      <div className="mt-1.5">
                        {wo ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded-full text-xs font-semibold">
                            <CheckCircle2 size={10} />Work Order: {wo.workOrderNo} — Planning ready
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs">
                            <AlertCircle size={10} />No Work Order — basic catalog from order data
                          </span>
                        )}
                      </div>
                    </div>
                    {order.totalAmount > 0 && (
                      <div className="flex-shrink-0 text-right">
                        <p className="text-[10px] text-gray-400">Order Total</p>
                        <p className="font-bold text-gray-800 text-sm">₹{order.totalAmount.toLocaleString()}</p>
                      </div>
                    )}
                    <div className="flex-shrink-0">
                      <Button icon={<BookMarked size={14} />} onClick={() => openCreate(order)}>
                        Create Catalog
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══ PROCESSED TAB ═════════════════════════════════════════ */}
      {catalogTab === "processed" && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          {processedCatalog.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <BookMarked size={40} className="text-gray-300 mb-3" />
              <p className="font-semibold text-gray-600">No catalog entries yet</p>
              <p className="text-sm mt-1">Go to Pending and click Create Catalog on any order.</p>
            </div>
          ) : (
            <DataTable
              data={processedCatalog}
              columns={processedCols}
              searchKeys={["catalogNo", "productName", "customerName", "sourceOrderNo"]}
              actions={row => (
                <div className="flex items-center gap-1.5 justify-end flex-wrap">
                  <Button variant="ghost" size="sm" icon={<Eye size={13} />}
                    onClick={() => setViewPlanRow(row)}>View</Button>
                  <Button variant="ghost" size="sm" icon={<Printer size={13} />}
                    onClick={() => setPrintRow(row)}
                    className="text-gray-700 hover:text-gray-900 hover:bg-gray-100">
                    Print
                  </Button>
                  <Button variant="ghost" size="sm" icon={<RefreshCw size={13} />}
                    onClick={() => openReplan(row)}
                    className="text-indigo-700 hover:text-indigo-800 hover:bg-indigo-50">
                    Replan
                  </Button>
                  <Button variant="ghost" size="sm" icon={<ArrowRight size={13} />}
                    onClick={() => window.location.href = "/gravure/orders"}
                    className="text-green-700 hover:text-green-800 hover:bg-green-50">
                    Use in Order
                  </Button>
                  <Button variant="danger" size="sm" icon={<Trash2 size={13} />}
                    onClick={() => setDeleteId(row.id)}>Delete</Button>
                </div>
              )}
            />
          )}
        </div>
      )}

      {/* ══ CREATE CATALOG MODAL ══════════════════════════════════ */}
      {createOpen && sourceOrder && (
        <Modal open={createOpen} onClose={() => setCreateOpen(false)}
          title="Create Product Catalog" size="xl">
          <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 mb-4 flex flex-wrap gap-4 text-xs">
            <div><p className="text-[10px] text-teal-500 uppercase font-semibold">From Order</p>
              <p className="font-bold text-teal-800">{sourceOrder.orderNo}</p></div>
            <div><p className="text-[10px] text-teal-500 uppercase font-semibold">Customer</p>
              <p className="font-bold text-teal-800">{sourceOrder.customerName}</p></div>
            <div><p className="text-[10px] text-teal-500 uppercase font-semibold">Date</p>
              <p className="font-bold text-teal-800">{sourceOrder.date}</p></div>
            <div className="ml-auto">
              {sourceWO ? (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg">
                  <CheckCircle size={13} className="text-green-600" />
                  <span className="text-green-700 font-semibold">Planning from WO: {sourceWO.workOrderNo}</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
                  <AlertCircle size={13} className="text-amber-600" />
                  <span className="text-amber-700 font-semibold">No Work Order — catalog from order data</span>
                </div>
              )}
            </div>
          </div>

          <div className="max-h-[70vh] overflow-y-auto pr-1 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <Input label="Product Name *" value={editName} onChange={e => setEditName(e.target.value)} placeholder="e.g. Parle-G Biscuit 100g Wrap" />
              </div>
            </div>
            <Textarea label="Remarks / Notes" value={editRemark} onChange={e => setEditRemark(e.target.value)} placeholder="Special notes for this catalog template…" />

            <div>
              <div className="flex items-center gap-2 mb-3">
                <p className="text-xs font-bold text-purple-700 uppercase tracking-widest">Planning Snapshot from Work Order</p>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-500 border border-gray-200 rounded-full text-[10px] font-semibold">
                  <Lock size={9} />READ ONLY
                </span>
              </div>
              {sourceWO ? (
                <PlanViewer plan={{
                  title: "Work Order", refNo: sourceWO.workOrderNo,
                  jobWidth: sourceWO.jobWidth, jobHeight: sourceWO.jobHeight,
                  quantity: sourceWO.quantity, unit: sourceWO.unit,
                  noOfColors: sourceWO.noOfColors,
                  secondaryLayers: sourceWO.secondaryLayers,
                  processes: sourceWO.processes,
                  cylinderCostPerColor: sourceWO.cylinderCostPerColor,
                  overheadPct: sourceWO.overheadPct, profitPct: sourceWO.profitPct,
                  trimmingSize: sourceWO.trimmingSize, frontColors: sourceWO.frontColors, backColors: sourceWO.backColors,
                } satisfies PlanInput} />
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <Pill label="Substrate"  value={sourceOrder.orderLines?.[0]?.substrate || sourceOrder.substrate || "—"} cls="bg-indigo-50 text-indigo-700 border-indigo-200" />
                    <Pill label="Print Type" value={sourceOrder.orderLines?.[0]?.printType || sourceOrder.printType || "—"} cls="bg-purple-50 text-purple-700 border-purple-200" />
                    <Pill label="Colors"     value={`${sourceOrder.noOfColors || 0} Colors`} cls="bg-blue-50 text-blue-700 border-blue-200" />
                    <Pill label="Job Width"  value={`${sourceOrder.jobWidth || 0} mm`} />
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
                    No Work Order found — catalog will use basic order data. You can Replan after saving.
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-5 pt-4 border-t border-gray-100">
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button icon={<BookMarked size={14} />} onClick={saveCatalog}
              className={!editName.trim() ? "opacity-50 cursor-not-allowed" : ""}>
              Save to Catalog
            </Button>
          </div>
        </Modal>
      )}

      {/* ══ REPLAN / CREATE CATALOG MODAL ═════════════════════════ */}
      {replanOpen && replanForm && (
        <Modal open={replanOpen} onClose={() => { setReplanOpen(false); setReplanForm(null); setIsNewCatalog(false); }}
          title={isNewCatalog ? (replanForm.sourceOrderNo ? `Create Catalog — ${replanForm.sourceOrderNo}` : "Create Direct Catalog") : `Replan — ${replanForm.catalogNo}`} size="xl">

          {/* Header info */}
          <div className={`border rounded-xl p-3 mb-4 flex flex-wrap gap-4 text-xs ${isNewCatalog ? "bg-teal-50 border-teal-200" : "bg-purple-50 border-purple-200"}`}>
            <div><p className={`text-[10px] uppercase font-semibold ${isNewCatalog ? "text-teal-500" : "text-purple-500"}`}>Product</p>
              <p className={`font-bold ${isNewCatalog ? "text-teal-800" : "text-purple-800"}`}>{replanForm.productName || "—"}</p></div>
            <div><p className={`text-[10px] uppercase font-semibold ${isNewCatalog ? "text-teal-500" : "text-purple-500"}`}>Customer</p>
              <p className={`font-bold ${isNewCatalog ? "text-teal-800" : "text-purple-800"}`}>{replanForm.customerName}</p></div>
            <div><p className={`text-[10px] uppercase font-semibold ${isNewCatalog ? "text-teal-500" : "text-purple-500"}`}>{isNewCatalog ? (replanForm.sourceOrderNo ? "From Order" : "Direct Entry") : "Catalog No"}</p>
              <p className={`font-bold ${isNewCatalog ? "text-teal-800" : "text-purple-800"}`}>{isNewCatalog ? (replanForm.sourceOrderNo || "—") : replanForm.catalogNo}</p></div>
            {isNewCatalog && replanForm.sourceWorkOrderNo && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-50 border border-green-200 rounded-lg self-center">
                <CheckCircle size={12} className="text-green-600" />
                <span className="text-green-700 font-semibold text-[11px]">WO: {replanForm.sourceWorkOrderNo}</span>
              </div>
            )}
          </div>

          {/* Modal Tabs */}
          <div className="flex overflow-x-auto bg-gray-100 p-1 rounded-xl gap-1 mb-4">
            {([
              { key: "info",     label: "① Basic Info"        },
              { key: "planning", label: "② Planning"          },
              { key: "material", label: "③ Production Prep"   },
            ] as const).map(t => (
              <button key={t.key} onClick={() => setReplanTab(t.key)}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${replanTab === t.key ? "bg-white shadow text-purple-700" : "text-gray-500 hover:text-gray-700"}`}>
                {t.label}
              </button>
            ))}
          </div>

          <div className="max-h-[65vh] overflow-y-auto pr-1">

            {/* ── Tab 1: Basic Info ── */}
            {replanTab === "info" && (
              <div className="space-y-4">
                <SH label="Product Details" />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div className="sm:col-span-2 lg:col-span-3">
                    <Input label="Product Name *" value={replanForm.productName}
                      onChange={e => rf("productName", e.target.value)} />
                  </div>
                  {/* Customer — dropdown for direct catalog; readonly if from order */}
                  <div className="sm:col-span-2 lg:col-span-3">
                    <label className="text-[10px] font-semibold text-gray-400 uppercase block mb-1">
                      Customer / Client Name *
                    </label>
                    {replanForm.sourceOrderId ? (
                      <div className="px-3 py-2 bg-gray-100 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 flex items-center gap-2">
                        <Lock size={12} className="text-gray-400" /> {replanForm.customerName || "—"}
                        <span className="ml-auto text-[10px] text-gray-400 font-normal">From Order</span>
                      </div>
                    ) : (
                      <>
                        <select
                          className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-purple-400"
                          value={replanForm.customerId || ""}
                          onChange={e => {
                            const c = customers.find(x => x.id === e.target.value);
                            rf("customerId", c?.id ?? "");
                            rf("customerName", c?.name ?? "");
                          }}>
                          <option value="">-- Select Customer --</option>
                          {customers.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                        {replanForm.customerName && (
                          <p className="text-[10px] text-teal-600 mt-1 flex items-center gap-1">
                            <Check size={10} /> {replanForm.customerName}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                  {/* ── Product Details (merged master) ── */}
                  <div className="sm:col-span-2 lg:col-span-3">
                    <p className="text-[10px] font-bold text-orange-500 uppercase tracking-widest mb-2 pb-1 border-b border-orange-100">Product Details</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                      {/* Type of Product (was Category) */}
                      <div>
                        <label className="text-[10px] font-semibold text-gray-400 uppercase block mb-1">Type of Product</label>
                        <select
                          className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-purple-400"
                          value={replanForm.categoryId || ""}
                          onChange={e => {
                            if (!e.target.value) { setReplanForm(p => p ? { ...p, categoryId: "", categoryName: "", content: "" } : p); return; }
                            const hasPlys = replanForm.secondaryLayers.some(l => l.plyType || l.consumableItems.length > 0);
                            if (hasPlys) { setPendingReplanCategoryId(e.target.value); }
                            else { applyReplanCategory(e.target.value); }
                          }}>
                          <option value="">-- Select Type --</option>
                          {categories.filter(c => c.status === "Active").map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                        {replanForm.categoryName && (
                          <p className="text-[10px] text-purple-600 mt-1 flex items-center gap-1">
                            <Check size={10} /> {replanForm.categoryName} — {replanForm.secondaryLayers.length} plys auto-loaded
                          </p>
                        )}
                      </div>
                      {/* Sub Type (was Content Type) */}
                      {replanForm.categoryId && (() => {
                        const selCat = categories.find(c => c.id === replanForm.categoryId);
                        const contentOptions = selCat?.contents ?? [];
                        if (contentOptions.length === 0) return null;
                        return (
                          <div>
                            <label className="text-[10px] font-semibold text-gray-400 uppercase block mb-1">Sub Type</label>
                            <select
                              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-purple-400"
                              value={replanForm.content || ""}
                              onChange={e => { rf("content", e.target.value); setDimValues({}); }}>
                              <option value="">-- Select Sub Type --</option>
                              {contentOptions.map(ct => (
                                <option key={ct} value={ct}>{ct}</option>
                              ))}
                            </select>
                            {replanForm.content && (
                              <p className="text-[10px] text-teal-600 mt-1 flex items-center gap-1">
                                <Check size={10} /> {replanForm.content}
                              </p>
                            )}
                          </div>
                        );
                      })()}
                      <div>
                        <label className="text-[10px] font-semibold text-gray-400 uppercase block mb-1">Pack Size</label>
                        <input placeholder="e.g. 250ml, 1L" className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-orange-400"
                          value={(replanForm as any).packSize ?? ""}
                          onChange={e => rf("packSize" as any, e.target.value)} />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-gray-400 uppercase block mb-1">Brand Name</label>
                        <input placeholder="e.g. ThumsUp, Amul" className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-orange-400"
                          value={(replanForm as any).brandName ?? ""}
                          onChange={e => rf("brandName" as any, e.target.value)} />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-gray-400 uppercase block mb-1">Product Type</label>
                        <select className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-orange-400"
                          value={(replanForm as any).productType ?? ""}
                          onChange={e => rf("productType" as any, e.target.value)}>
                          <option value="">-- Select --</option>
                          {["CSD", "Water", "Juice", "Sleeve", "Label", "Pouch", "Roll Form", "Other"].map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-gray-400 uppercase block mb-1">SKU Type</label>
                        <input placeholder="e.g. ThumsUp, Fanta" className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-orange-400"
                          value={(replanForm as any).skuType ?? ""}
                          onChange={e => rf("skuType" as any, e.target.value)} />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-gray-400 uppercase block mb-1">Bottle Type</label>
                        <select className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-orange-400"
                          value={(replanForm as any).bottleType ?? ""}
                          onChange={e => rf("bottleType" as any, e.target.value)}>
                          <option value="">-- Select --</option>
                          {["RPET", "VPET", "Glass", "Tin", "Pouch", "Carton", "N/A"].map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-gray-400 uppercase block mb-1">Address Type</label>
                        <select className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-orange-400"
                          value={(replanForm as any).addressType ?? ""}
                          onChange={e => rf("addressType" as any, e.target.value)}>
                          <option value="">-- Select --</option>
                          <option value="Single">Single</option>
                          <option value="Multi">Multi</option>
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="text-[10px] font-semibold text-gray-400 uppercase block mb-1">Artwork Name</label>
                        <input placeholder="e.g. Parle-G 100g Front Artwork v3" className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-orange-400"
                          value={(replanForm as any).artworkName ?? ""}
                          onChange={e => rf("artworkName" as any, e.target.value)} />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="text-[10px] font-semibold text-gray-400 uppercase block mb-1">Special Specifications</label>
                        <input placeholder="e.g. @20 Rs, Free, Promo, Export" className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-orange-400"
                          value={(replanForm as any).specialSpecs ?? ""}
                          onChange={e => rf("specialSpecs" as any, e.target.value)} />
                      </div>
                    </div>

                    {/* ── Attachments ── */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-orange-600 uppercase tracking-widest">
                          Attachments {replanAttachments.length > 0 && `(${replanAttachments.length})`}
                        </span>
                        <label className="flex items-center gap-1.5 text-[11px] font-semibold text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 px-2.5 py-1 rounded-lg cursor-pointer transition">
                          <Plus size={11} /> Add Files
                          <input type="file" multiple accept="*" className="hidden"
                            onChange={e => addAttachments(e.target.files)} />
                        </label>
                      </div>

                      {/* Drop zone (shown only when no files yet) */}
                      {replanAttachments.length === 0 && (
                        <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-orange-200 rounded-xl py-6 cursor-pointer bg-orange-50/40 hover:bg-orange-50 transition"
                          onDragOver={e => e.preventDefault()}
                          onDrop={e => { e.preventDefault(); addAttachments(e.dataTransfer.files); }}>
                          <Archive size={22} className="text-orange-300" />
                          <span className="text-xs text-orange-400 font-medium">Drag & drop any file — JPG, PDF, AI, PSD, PNG, etc.</span>
                          <span className="text-[10px] text-orange-300">or click <strong>Add Files</strong> above</span>
                          <input type="file" multiple accept="*" className="hidden"
                            onChange={e => addAttachments(e.target.files)} />
                        </label>
                      )}

                      {/* File list */}
                      {replanAttachments.length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2"
                          onDragOver={e => e.preventDefault()}
                          onDrop={e => { e.preventDefault(); addAttachments(e.dataTransfer.files); }}>
                          {replanAttachments.map((att, attIdx) => {
                            const isImg  = att.mimeType.startsWith("image/");
                            const ext    = att.name.split(".").pop()?.toUpperCase() ?? "FILE";
                            const sizeKb = (att.size / 1024).toFixed(0);
                            const isMaster = attIdx === 0;
                            const label  = att.label ?? (isMaster ? "Master File" : "");
                            const badgeColor = isMaster
                              ? "bg-amber-400 text-white border-amber-500"
                              : "bg-indigo-100 text-indigo-700 border-indigo-300";
                            const isEditingLabel = editingAttachLabel === att.id;
                            return (
                              <div key={att.id} className={`relative group rounded-xl overflow-hidden bg-white shadow-sm ${isMaster ? "border-2 border-amber-400 ring-1 ring-amber-300" : label ? "border-2 border-indigo-300" : "border border-gray-200"}`}>
                                {/* Badge — click to edit */}
                                {isEditingLabel ? (
                                  <div className="absolute top-1.5 left-1.5 z-20 flex items-center gap-1">
                                    <input
                                      autoFocus
                                      className="text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border border-indigo-400 bg-white text-indigo-700 outline-none w-28 shadow"
                                      defaultValue={label}
                                      onBlur={e => {
                                        const v = e.target.value.trim();
                                        setReplanAttachments(p => p.map(a => a.id === att.id ? { ...a, label: v || undefined } : a));
                                        setEditingAttachLabel(null);
                                      }}
                                      onKeyDown={e => {
                                        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                                        if (e.key === "Escape") setEditingAttachLabel(null);
                                      }}
                                    />
                                  </div>
                                ) : label ? (
                                  <button
                                    onClick={() => setEditingAttachLabel(att.id)}
                                    title="Click to rename"
                                    className={`absolute top-1.5 left-1.5 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide border shadow hover:opacity-80 transition ${badgeColor}`}>
                                    {isMaster && "★ "}{label}
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => setEditingAttachLabel(att.id)}
                                    title="Add label"
                                    className="absolute top-1.5 left-1.5 z-10 opacity-0 group-hover:opacity-100 flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold border border-dashed border-gray-400 text-gray-500 bg-white/90 shadow transition">
                                    + Label
                                  </button>
                                )}
                                {/* Thumbnail or icon */}
                                {isImg ? (
                                  <img src={att.url} alt={att.name} className="w-full h-20 object-cover" />
                                ) : (
                                  <div className="w-full h-20 flex flex-col items-center justify-center bg-gray-50 gap-1">
                                    <span className="text-2xl font-black text-gray-300">{ext}</span>
                                  </div>
                                )}
                                {/* File info */}
                                <div className="px-2 py-1.5 border-t border-gray-100">
                                  <p className="text-[10px] font-semibold text-gray-700 truncate" title={att.name}>{att.name}</p>
                                  <p className="text-[9px] text-gray-400">{sizeKb} KB</p>
                                </div>
                                {/* Actions */}
                                <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button onClick={() => setPreviewAttachment({ name: att.name, url: att.url, mimeType: att.mimeType })}
                                    className="p-1 rounded-md bg-white/90 text-indigo-600 hover:bg-indigo-50 shadow" title="Preview">
                                    <EyeIcon size={11} />
                                  </button>
                                  <a href={att.url} download={att.name} target="_blank" rel="noreferrer"
                                    className="p-1 rounded-md bg-white/90 text-blue-600 hover:bg-blue-50 shadow text-[10px]" title="Download">↓</a>
                                  <button onClick={() => removeAttachment(att.id)}
                                    className="p-1 rounded-md bg-white/90 text-red-500 hover:bg-red-50 shadow" title="Remove">
                                    <X size={10} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                          {/* Add more tile */}
                          <label className="flex flex-col items-center justify-center gap-1 border-2 border-dashed border-gray-200 rounded-xl h-full min-h-[80px] cursor-pointer hover:border-orange-300 hover:bg-orange-50/30 transition">
                            <Plus size={16} className="text-gray-300" />
                            <span className="text-[10px] text-gray-300">Add more</span>
                            <input type="file" multiple accept="*" className="hidden"
                              onChange={e => addAttachments(e.target.files)} />
                          </label>
                        </div>
                      )}
                    </div>
                  </div>

                  <Select label="Print Type" value={replanForm.printType}
                    onChange={e => rf("printType", e.target.value as GravureProductCatalog["printType"])}
                    options={[{ value: "Surface Print", label: "Surface Print" }, { value: "Reverse Print", label: "Reverse Print" }, { value: "Combination", label: "Combination" }]} />
                </div>

                {/* ── Dimension Input + Live Diagram — appears only after Content Type is selected ── */}
                {replanForm.content && CONTENT_TYPE_CONFIG[replanForm.content] && (
                  <div className="border border-indigo-200 rounded-2xl overflow-hidden">
                    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2.5 flex items-center gap-2">
                      <Calculator size={14} className="text-white" />
                      <p className="text-xs font-bold text-white uppercase tracking-widest">Dimension Setup — {replanForm.content}</p>
                    </div>
                    <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Left: inputs */}
                      <div className="space-y-4">
                        <div>
                          <p className="text-[10px] font-semibold text-indigo-500 uppercase tracking-widest mb-2">Packaging Dimensions</p>
                          <DimensionInputPanel
                            contentType={replanForm.content}
                            dims={dimValues}
                            onChange={patch => {
                              patchDim(patch);
                              if ("width"        in patch && patch.width        !== undefined) rf("jobWidth",  patch.width);
                              if ("layflatWidth"  in patch && patch.layflatWidth !== undefined) rf("jobWidth",  patch.layflatWidth);
                              if ("height"       in patch && patch.height       !== undefined) rf("jobHeight", patch.height);
                              if ("cutHeight"    in patch && patch.cutHeight    !== undefined) rf("jobHeight", patch.cutHeight);
                            }}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] font-semibold text-amber-500 uppercase block mb-1">Trimming Both Side (mm)</label>
                            <input
                              type="number" min={0} step={0.5} placeholder="e.g. 5"
                              value={dimValues.trimming ?? replanForm.trimmingSize ?? ""}
                              onChange={e => { const v = Number(e.target.value) || 0; patchDim({ trimming: v }); rf("trimmingSize", v); }}
                              className="w-full text-sm border border-amber-200 rounded-xl px-3 py-2 bg-amber-50 focus:bg-white outline-none focus:ring-2 focus:ring-amber-400 font-mono"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold text-rose-500 uppercase block mb-1">
                              Width Shrinkage (mm) <span className="normal-case text-gray-400 font-normal">— optional</span>
                            </label>
                            <input
                              type="number" min={0} max={20} step={0.5} placeholder="e.g. 2"
                              value={dimValues.widthShrinkage ?? replanForm.widthShrinkage ?? ""}
                              onChange={e => { const v = Number(e.target.value) || 0; patchDim({ widthShrinkage: v }); rf("widthShrinkage", v || undefined); }}
                              className="w-full text-sm border border-rose-200 rounded-xl px-3 py-2 bg-rose-50 focus:bg-white outline-none focus:ring-2 focus:ring-rose-400 font-mono"
                            />
                          </div>
                        </div>
                        {/* ── Colors inside Dimension Setup ── */}
                        <div className="border-t border-indigo-100 pt-3">
                          <p className="text-[10px] font-semibold text-purple-500 uppercase tracking-widest mb-2">Colors & Print</p>
                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <label className="text-[10px] font-semibold text-gray-400 uppercase block mb-1">Front Colors</label>
                              <input type="number" min={0} max={12} placeholder="0"
                                value={replanForm.frontColors || ""}
                                onChange={e => rf("frontColors", Number(e.target.value))}
                                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-purple-400 font-mono" />
                            </div>
                            <div>
                              <label className="text-[10px] font-semibold text-gray-400 uppercase block mb-1">Back Colors</label>
                              <input type="number" min={0} max={12} placeholder="0"
                                value={replanForm.backColors || ""}
                                onChange={e => rf("backColors", Number(e.target.value))}
                                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-purple-400 font-mono" />
                            </div>
                            <div>
                              <label className="text-[10px] font-semibold text-gray-400 uppercase block mb-1">Total Colors (Auto)</label>
                              <div className="px-3 py-2 bg-purple-50 border border-purple-200 rounded-xl text-sm font-bold text-purple-700 text-center">{replanForm.noOfColors} Colors</div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <DimensionDiagram contentType={replanForm.content} dims={dimValues} />
                    </div>
                  </div>
                )}

                <Textarea label="Remarks" value={replanForm.remarks}
                  onChange={e => rf("remarks", e.target.value)} placeholder="Special notes…" />
                <div className="flex justify-end">
                  <Button onClick={() => setReplanTab("planning")}>Next: Planning <ChevronRight size={14} className="ml-1" /></Button>
                </div>
              </div>
            )}

            {/* ── Tab 2: Planning ── */}
            {replanTab === "planning" && (
              <div className="space-y-4">
                {/* Machine */}
                <div>
                  <SH label="Machine" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Select label="Printing Machine" value={replanForm.machineId}
                      onChange={e => { const m = PRINT_MACHINES.find(x => x.id === e.target.value); if (m) { rf("machineId", m.id); rf("machineName", m.name); } }}
                      options={[{ value: "", label: "-- Select Machine --" }, ...PRINT_MACHINES.map(m => ({ value: m.id, label: `${m.name} (${m.status})` }))]} />
                  </div>
                  {(() => {
                    const selMachine = replanForm.machineId ? PRINT_MACHINES.find(m => m.id === replanForm.machineId) : null;
                    if (!selMachine) return null;
                    const minW = parseFloat((selMachine as any).minWebWidth) || 0;
                    const maxW    = parseFloat((selMachine as any).maxWebWidth) || 0;
                    const minCirc = parseFloat((selMachine as any).repeatLengthMin) || 0;
                    const maxCirc = parseFloat((selMachine as any).repeatLengthMax) || 0;
                    const colors  = (selMachine as any).noOfColors || "";
                    const speed   = (selMachine as any).speedMax   || "";
                    return (
                      <div className="flex flex-wrap items-center gap-2 mt-2 p-2.5 rounded-xl border border-blue-200 bg-blue-50">
                        <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">Machine Specs:</span>
                        <span className="flex flex-wrap items-center gap-1 text-[11px] font-semibold text-blue-800">
                          {minCirc > 0 && <span className="px-2 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-amber-800">Min Circ: <strong>{minCirc} mm</strong></span>}
                          {maxCirc > 0 && <span className="px-2 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-amber-800">Max Circ: <strong>{maxCirc} mm</strong></span>}
                          {colors && <span className="px-2 py-0.5 rounded-full bg-indigo-100 border border-indigo-300 text-indigo-700">Colors: <strong>{colors}</strong></span>}
                          {speed  && <span className="px-2 py-0.5 rounded-full bg-green-100 border border-green-300 text-green-700">Speed: <strong>{speed} m/min</strong></span>}
                        </span>
                      </div>
                    );
                  })()}
                </div>

                {/* Process Planning */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <SH label="Process List (from Process Master)" />
                    <button onClick={addReplanProcess} className="flex items-center gap-1.5 text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg border border-purple-200 transition">
                      <Plus size={12} /> Add Process
                    </button>
                  </div>
                  {replanForm.processes.length > 0 ? (
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                      <table className="min-w-full text-xs">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            {["Process (Master)", "Charge Unit", ""].map(h => (
                              <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {replanForm.processes.map((pr, i) => (
                            <tr key={i} className="hover:bg-gray-50">
                              <td className="px-3 py-2 min-w-[200px]">
                                <select value={pr.processId} onChange={e => selectReplanProcess(i, e.target.value)} className={cellInput}>
                                  <option value="">-- Select Process --</option>
                                  {ROTO_PROCESSES.map(pm => <option key={pm.id} value={pm.id}>{pm.name} ({pm.department})</option>)}
                                </select>
                              </td>
                              <td className="px-3 py-2"><span className="px-2 py-1 bg-gray-100 rounded-lg text-gray-600 font-mono text-[10px]">{pr.chargeUnit || "—"}</span></td>
                              <td className="px-3 py-2 w-8 text-center"><button onClick={() => removeReplanProcess(i)} className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50"><X size={13} /></button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-gray-200 rounded-xl py-5 text-center text-xs text-gray-400">
                      No processes added yet. Click "+ Add Process" to add.
                    </div>
                  )}
                </div>

                {/* Ply Configuration */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <SH label={`Ply Configuration (${replanForm.secondaryLayers.length} plys)`} />
                    <button onClick={() => {
                      const layers = [...replanForm.secondaryLayers];
                      layers.push({ id: Math.random().toString(), layerNo: layers.length + 1, plyType: "", itemSubGroup: "", density: 0, thickness: 0, gsm: 0, consumableItems: [] });
                      rf("secondaryLayers", layers);
                    }} className="flex items-center gap-1.5 text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg border border-purple-200">
                      <Plus size={12} /> Add Ply
                    </button>
                  </div>

                  {replanForm.secondaryLayers.length > 0 && (
                    <div className="space-y-3">
                      {replanForm.secondaryLayers.map((l, index) => {
                        const thicknesses = FILM_SUBGROUPS.find(s => s.subGroup === l.itemSubGroup)?.thicknesses || [];
                        return (
                          <div key={l.id} className="bg-white border-2 border-purple-50 rounded-2xl shadow-sm relative overflow-hidden">
                            <div className="flex items-center justify-between bg-purple-50 px-4 py-2 border-b border-purple-100">
                              <span className="text-xs font-bold text-purple-700 uppercase tracking-wider">
                                {l.layerNo === 1 ? "1st" : l.layerNo === 2 ? "2nd" : l.layerNo === 3 ? "3rd" : `${l.layerNo}th`} Ply
                              </span>
                              <div className="flex items-center gap-2">
                                <button onClick={() => rf("secondaryLayers", replanForm.secondaryLayers.filter((_, i) => i !== index))} className="text-red-400 hover:text-red-600"><X size={14} /></button>
                              </div>
                            </div>
                            <div className="p-3 space-y-3">
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
                              {l.plyType && (
                                <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-3 space-y-3">
                                  <div>
                                    <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Film Type</label>
                                    <select className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-purple-400"
                                      value={l.itemSubGroup}
                                      onChange={e => {
                                        const subGroup = e.target.value;
                                        const sg = FILM_SUBGROUPS.find(s => s.subGroup === subGroup);
                                        const density = sg ? sg.density : 0;
                                        const layers = [...replanForm.secondaryLayers];
                                        const masterRate = parseFloat(FILM_ITEMS.find(fi => fi.subGroup === subGroup)?.estimationRate || "0");
                                        layers[index] = { ...l, itemSubGroup: subGroup, density, thickness: 0, gsm: 0, filmRate: masterRate };
                                        rf("secondaryLayers", layers);
                                      }}>
                                      <option value="">Select Film Type</option>
                                      {FILM_SUBGROUPS.map(opt => <option key={opt.subGroup} value={opt.subGroup}>{opt.subGroup}</option>)}
                                    </select>
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                                    <Input label="Density" type="number" value={l.density || ""} readOnly className="bg-gray-50 text-gray-400 text-xs" />
                                    <div>
                                      <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Thickness (μ)</label>
                                      <select className="w-full text-xs border border-gray-200 rounded-xl px-2 py-2 bg-white outline-none focus:ring-2 focus:ring-purple-400"
                                        value={l.thickness}
                                        onChange={e => {
                                          const thickness = Number(e.target.value);
                                          const layers = [...replanForm.secondaryLayers];
                                          layers[index] = { ...l, thickness, gsm: parseFloat((thickness * l.density).toFixed(3)) };
                                          rf("secondaryLayers", layers);
                                        }}>
                                        <option value={0}>Select</option>
                                        {thicknesses.map(t => <option key={t} value={t}>{t}</option>)}
                                      </select>
                                    </div>
                                    <Input label="Film GSM" type="number" value={l.gsm || ""} readOnly className="font-bold bg-purple-50 text-purple-800 border-purple-200 text-xs" />
                                  </div>
                                </div>
                              )}
                              {l.plyType && (
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-teal-700 uppercase tracking-widest">Consumable Items ({l.consumableItems.length})</span>
                                    <button
                                      onClick={() => addPlyConsumable(index)}
                                      className="flex items-center gap-1 text-[10px] font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 px-2.5 py-1 rounded-lg border border-teal-200 transition">
                                      <Plus size={10} /> Add Consumable
                                    </button>
                                  </div>

                                  {l.consumableItems.map((ci, ciIdx) => {
                                    const CONSUMABLE_GROUPS = ["Ink", "Solvent", "Adhesive", "Hardner"];
                                    const subGroups = ci.itemGroup ? (CATEGORY_GROUP_SUBGROUP["Raw Material (RM)"]?.[ci.itemGroup] ?? []) : [];
                                    const filteredItems = items.filter(it =>
                                      it.group === ci.itemGroup && it.active &&
                                      (!ci.itemSubGroup || it.subGroup === ci.itemSubGroup)
                                    );
                                    return (
                                      <div key={ci.consumableId} className="bg-teal-50/40 border border-teal-100 rounded-xl p-3">
                                        <div className="flex items-center justify-between mb-2">
                                          <span className="text-[10px] font-bold text-teal-700 uppercase">Consumable 1</span>
                                          <div className="flex items-center gap-1">
                                            <button
                                              onClick={() => clonePlyConsumable(index, ciIdx)}
                                              title="Clone this consumable"
                                              className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition">
                                              <Copy size={11} /> Clone
                                            </button>
                                            <button onClick={() => removePlyConsumable(index, ciIdx)}
                                              className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
                                              <X size={12} />
                                            </button>
                                          </div>
                                        </div>
                                        {(() => {
                                          // find adhesive in same ply for hardener calc
                                          const adhesiveCI = l.consumableItems.find(x => x.itemGroup === "Adhesive");
                                          const adhesiveGSM = adhesiveCI?.gsm ?? 0;
                                          const adhesiveOH  = adhesiveCI?.ohPct ?? 0;
                                          const hardenerGSM = ci.itemGroup === "Hardner" && (ci.ncoPct ?? 0) > 0
                                            ? parseFloat(((adhesiveGSM * adhesiveOH) / (ci.ncoPct!)).toFixed(3))
                                            : null;

                                          const colCount =
                                            ci.itemGroup === "Ink"     ? 6 :
                                            ci.itemGroup === "Adhesive"? 5 :
                                            ci.itemGroup === "Hardner" ? 5 : 4;

                                          return (
                                          <div className={`grid grid-cols-2 gap-2 sm:grid-cols-${colCount}`}>
                                            {/* Item Group */}
                                            <div>
                                              <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Item Group</label>
                                              <select
                                                className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white outline-none focus:ring-2 focus:ring-teal-400"
                                                value={ci.itemGroup}
                                                onChange={e => updatePlyConsumable(index, ciIdx, { itemGroup: e.target.value, itemSubGroup: "", itemId: "", itemName: "", gsm: 0, ohPct: undefined, ncoPct: undefined })}>
                                                <option value="">-- Group --</option>
                                                {CONSUMABLE_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                                              </select>
                                            </div>
                                            {/* Sub Group */}
                                            <div>
                                              <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Sub Group</label>
                                              <select
                                                className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white outline-none focus:ring-2 focus:ring-teal-400"
                                                value={ci.itemSubGroup}
                                                onChange={e => updatePlyConsumable(index, ciIdx, { itemSubGroup: e.target.value, itemId: "", itemName: "" })}
                                                disabled={!ci.itemGroup}>
                                                <option value="">-- Sub Group --</option>
                                                {subGroups.map(sg => <option key={sg} value={sg}>{sg}</option>)}
                                              </select>
                                            </div>
                                            {/* Item Master */}
                                            <div>
                                              <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Item (Master)</label>
                                              <select
                                                className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white outline-none focus:ring-2 focus:ring-teal-400"
                                                value={ci.itemId}
                                                onChange={e => {
                                                  const it = filteredItems.find(x => x.id === e.target.value);
                                                  updatePlyConsumable(index, ciIdx, { itemId: it?.id ?? "", itemName: it?.name ?? "" });
                                                }}
                                                disabled={!ci.itemGroup}>
                                                <option value="">-- Select Item --</option>
                                                {filteredItems.map(it => (
                                                  <option key={it.id} value={it.id}>{it.name}</option>
                                                ))}
                                              </select>
                                            </div>

                                            {/* ── INK ── */}
                                            {ci.itemGroup === "Ink" && (<>
                                              <div>
                                                <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Dry Ink GSM</label>
                                                <input type="number" step={0.1} min={0}
                                                  className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white outline-none focus:ring-2 focus:ring-teal-400 font-mono"
                                                  value={ci.gsm || ""}
                                                  onChange={e => updatePlyConsumable(index, ciIdx, { gsm: Number(e.target.value) })} />
                                              </div>
                                              <div>
                                                <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">% Solid</label>
                                                <input type="number" step={1} min={1} max={100}
                                                  className="w-full text-xs border border-indigo-200 rounded-lg px-2 py-1.5 bg-indigo-50 outline-none focus:ring-2 focus:ring-indigo-400 font-mono"
                                                  value={ci.solidPct ?? 40}
                                                  onChange={e => updatePlyConsumable(index, ciIdx, { solidPct: Number(e.target.value) || 40 })}
                                                  placeholder="40" />
                                              </div>
                                              <div>
                                                <label className="text-[10px] font-semibold text-purple-600 uppercase block mb-1">Liquid GSM</label>
                                                <div className="w-full text-xs border border-purple-200 rounded-lg px-2 py-1.5 bg-purple-50 font-mono font-bold text-purple-700 min-h-[30px]">
                                                  {ci.gsm > 0 ? (ci.gsm / ((ci.solidPct ?? 40) / 100)).toFixed(2) : "—"}
                                                </div>
                                              </div>
                                            </>)}

                                            {/* ── SOLVENT ── */}
                                            {ci.itemGroup === "Solvent" && (
                                              <div>
                                                <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Ratio (%)</label>
                                                <input type="number" step={0.1} min={0} max={100}
                                                  className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white outline-none focus:ring-2 focus:ring-teal-400 font-mono"
                                                  value={ci.gsm || ""}
                                                  onChange={e => updatePlyConsumable(index, ciIdx, { gsm: Number(e.target.value) })}
                                                  placeholder="e.g. 30" />
                                              </div>
                                            )}

                                            {/* ── ADHESIVE ── */}
                                            {ci.itemGroup === "Adhesive" && (<>
                                              <div>
                                                <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Adhesive GSM</label>
                                                <input type="number" step={0.1} min={0}
                                                  className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white outline-none focus:ring-2 focus:ring-teal-400 font-mono"
                                                  value={ci.gsm || ""}
                                                  onChange={e => updatePlyConsumable(index, ciIdx, { gsm: Number(e.target.value) })}
                                                  placeholder="e.g. 4.5" />
                                              </div>
                                              <div>
                                                <label className="text-[10px] font-semibold text-orange-600 uppercase block mb-1">OH %</label>
                                                <input type="number" step={0.1} min={0}
                                                  className="w-full text-xs border border-orange-200 rounded-lg px-2 py-1.5 bg-orange-50 outline-none focus:ring-2 focus:ring-orange-400 font-mono"
                                                  value={ci.ohPct ?? ""}
                                                  onChange={e => updatePlyConsumable(index, ciIdx, { ohPct: Number(e.target.value) })}
                                                  placeholder="e.g. 2.5" />
                                              </div>
                                            </>)}

                                            {/* ── HARDNER ── */}
                                            {ci.itemGroup === "Hardner" && (<>
                                              <div>
                                                <label className="text-[10px] font-semibold text-rose-600 uppercase block mb-1">NCO %</label>
                                                <input type="number" step={0.1} min={0}
                                                  className="w-full text-xs border border-rose-200 rounded-lg px-2 py-1.5 bg-rose-50 outline-none focus:ring-2 focus:ring-rose-400 font-mono"
                                                  value={ci.ncoPct ?? ""}
                                                  onChange={e => updatePlyConsumable(index, ciIdx, { ncoPct: Number(e.target.value) })}
                                                  placeholder="e.g. 12.5" />
                                              </div>
                                              <div>
                                                <label className="text-[10px] font-semibold text-teal-600 uppercase block mb-1">Hardener GSM (Auto)</label>
                                                <div className="w-full text-xs border border-teal-200 rounded-lg px-2 py-1.5 bg-teal-50 font-mono font-bold text-teal-700 min-h-[30px]">
                                                  {hardenerGSM !== null ? hardenerGSM : <span className="text-gray-400 font-normal">Set Adhesive GSM + OH% + NCO%</span>}
                                                </div>
                                              </div>
                                            </>)}

                                            {/* ── OTHER (no group or unrecognised) ── */}
                                            {!["Ink","Solvent","Adhesive","Hardner"].includes(ci.itemGroup) && (
                                              <div>
                                                <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">GSM</label>
                                                <input type="number" step={0.1} min={0}
                                                  className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white outline-none focus:ring-2 focus:ring-teal-400 font-mono"
                                                  value={ci.gsm || ""}
                                                  onChange={e => updatePlyConsumable(index, ciIdx, { gsm: Number(e.target.value) })} />
                                              </div>
                                            )}
                                          </div>
                                          );
                                        })()}
                                      </div>
                                    );
                                  })}

                                  {l.consumableItems.length === 0 && (
                                    <p className="text-[10px] text-gray-400 italic text-center py-2">Click "+ Add Consumable" to add ink, solvent, adhesive, etc.</p>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Production Plan Selection */}
                {replanForm.machineId && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <SH label="Production Plan Selection" />
                      <div className="flex items-center gap-2">
                        {replanIsPlanApplied && (
                          <button onClick={() => { setReplanIsPlanApplied(false); setReplanShowPlan(true); }} className="flex items-center gap-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg border border-gray-200">
                            <RefreshCw size={11} /> Change Plan
                          </button>
                        )}
                        {(replanForm.jobHeight || 0) > 0 && (
                          <button onClick={() => setCylGuideOpen(true)}
                            className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg border border-emerald-200">
                            <Calculator size={12} /> Cyl. Circ Guide
                          </button>
                        )}
                        <button onClick={() => setReplanShowPlan(!replanShowPlan)}
                          className="flex items-center gap-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg border border-indigo-200">
                          <Eye size={12} /> {replanShowPlan ? "Hide Plan" : "Select Plan"}
                        </button>
                      </div>
                    </div>

                    {replanIsPlanApplied && replanSelectedPlan && !replanShowPlan && (
                      <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 flex items-center gap-2 text-xs text-green-700">
                        <CheckCircle2 size={14} className="text-green-600" />
                        Plan applied — UPS: <strong>{replanSelectedPlan.totalUPS}</strong> · Sleeve: {(replanSelectedPlan as any).sleeveCode} {(replanSelectedPlan as any).sleeveWidthVal}mm · Cylinder: {(replanSelectedPlan as any).cylinderCode} · Film: {replanSelectedPlan.filmSize}mm · Total Waste: {replanSelectedPlan.totalWaste}mm · RMT: {replanSelectedPlan.totalRMT}
                      </div>
                    )}

                    {replanShowPlan && !replanIsPlanApplied && (
                      <div className="border-2 border-indigo-100 rounded-2xl overflow-hidden shadow-lg">
                        <div className="bg-gradient-to-r from-indigo-800 to-purple-800 p-3 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-white font-bold text-xs uppercase tracking-wide">Select Production Plan</p>
                            <p className="text-indigo-200 text-[10px] mt-0.5">
                            {replanForm.machineName} · {replanVisiblePlans.length}/{replanAllPlans.length} plans
                            {Object.keys(planColFilters).length > 0 && (
                              <button onClick={() => setPlanColFilters({})}
                                className="ml-2 px-1.5 py-0.5 bg-yellow-400 text-yellow-900 text-[9px] font-bold rounded-full hover:bg-yellow-300">
                                ✕ {Object.keys(planColFilters).length} filter{Object.keys(planColFilters).length > 1 ? "s" : ""} active
                              </button>
                            )}
                          </p>
                          </div>
                          <input value={replanPlanSearch} onChange={e => setReplanPlanSearch(e.target.value)} placeholder="Search plans..."
                            className="bg-indigo-700 text-white placeholder-indigo-300 text-xs rounded-lg px-3 py-1.5 border border-indigo-500 outline-none focus:ring-2 focus:ring-indigo-400 w-36" />
                          {replanSelPlanId && (
                            <button onClick={() => { setReplanIsPlanApplied(true); setReplanShowPlan(false); }} className="bg-green-500 hover:bg-green-600 text-white text-xs font-bold px-4 py-1.5 rounded-lg flex-shrink-0">Apply Plan</button>
                          )}
                        </div>
                        <div className="overflow-x-auto" onClick={() => planFilterOpen && setPlanFilterOpen(null)}>
                          <table className="min-w-full text-[10px] whitespace-nowrap border-collapse">
                            <thead className="bg-slate-800 text-slate-300">
                              <tr>
                                <th className="p-2 border border-slate-700 text-center">Select</th>
                                <th className="p-2 border border-slate-700 text-center">Layout</th>
                                {[
                                  { key: "machineName",      label: "Machine" },
                                  { key: "acUps",            label: "AC UPS" },
                                  { key: "printingWidth",    label: "Printing W (mm)" },
                                  { key: "sleeveCode",       label: "Sleeve" },
                                  { key: "sleeveWidthVal",   label: "Sleeve W (mm)" },
                                  { key: "sideWaste",        label: "Side Waste (mm)" },
                                  { key: "filmSize",         label: "Film Size (mm)" },
                                  { key: "deadMargin",       label: "Dead Margin (mm)" },
                                  { key: "totalWaste",       label: "Total Waste (mm)" },
                                  { key: "cylinderCode",     label: "Cylinder" },
                                  { key: "cylinderWidthVal", label: "Cyl W (mm)" },
                                  { key: "cylCirc",          label: "Cyl. Circ (mm)" },
                                  { key: "repeatUPS",        label: "Repeat UPS" },
                                  { key: "totalUPS",         label: "Total UPS" },
                                  { key: "totalRMT",         label: "Total RMT" },
                                ].map(col => {
                                  const isFiltered = !!(planColFilters[col.key]?.size);
                                  const isOpen     = planFilterOpen === col.key;
                                  const uniqueVals = Array.from(new Set(replanAllPlans.map(r => String((r as any)[col.key] ?? "")))).sort((a, b) => isNaN(+a) ? a.localeCompare(b) : +a - +b);
                                  const fSearch    = planFilterSearch[col.key] ?? "";
                                  const visVals    = fSearch ? uniqueVals.filter(v => v.toLowerCase().includes(fSearch.toLowerCase())) : uniqueVals;
                                  const draft      = planFilterDraft[col.key] ?? new Set<string>();
                                  return (
                                    <th key={col.key} className="p-0 border border-slate-700 text-center relative">
                                      {/* Header row: sort + filter icon */}
                                      <div className="flex items-center justify-between px-2 py-2 gap-1 cursor-pointer hover:bg-slate-700 select-none"
                                        onClick={() => replanTogglePlanSort(col.key)}>
                                        <span className="text-[10px]">{col.label}{replanPlanSort.key === col.key ? (replanPlanSort.dir === "asc" ? " ▲" : " ▼") : ""}</span>
                                        <button
                                          onClick={e => { e.stopPropagation(); isOpen ? setPlanFilterOpen(null) : openPlanFilter(col.key); }}
                                          className={`flex-shrink-0 p-0.5 rounded transition-colors ${isFiltered ? "text-yellow-300" : "text-slate-400 hover:text-white"}`}
                                          title="Filter">
                                          ▼
                                        </button>
                                      </div>
                                      {/* Filter dropdown */}
                                      {isOpen && (
                                        <div className="absolute top-full left-0 z-50 bg-white border border-gray-300 rounded-xl shadow-2xl min-w-[200px] text-gray-800"
                                          onClick={e => e.stopPropagation()}>
                                          {/* Search */}
                                          <div className="p-2 border-b border-gray-100">
                                            <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1">
                                              <Search size={11} className="text-gray-400 flex-shrink-0" />
                                              <input autoFocus value={fSearch}
                                                onChange={e => setPlanFilterSearch(s => ({ ...s, [col.key]: e.target.value }))}
                                                placeholder="Search…"
                                                className="text-xs bg-transparent outline-none w-full text-gray-700" />
                                              {fSearch && <button onClick={() => setPlanFilterSearch(s => ({ ...s, [col.key]: "" }))} className="text-gray-400"><X size={10} /></button>}
                                            </div>
                                          </div>
                                          {/* Select All */}
                                          <div className="px-3 py-1.5 border-b border-gray-100 hover:bg-gray-50 cursor-pointer flex items-center gap-2"
                                            onClick={() => togglePlanFilterAll(col.key, visVals)}>
                                            <input type="checkbox" readOnly
                                              checked={draft.size === visVals.length && visVals.length > 0}
                                              className="accent-indigo-600 cursor-pointer" />
                                            <span className="text-xs font-semibold text-gray-600">Select All</span>
                                          </div>
                                          {/* Values list */}
                                          <div className="max-h-48 overflow-y-auto">
                                            {visVals.map(v => (
                                              <div key={v} className="px-3 py-1.5 hover:bg-indigo-50 cursor-pointer flex items-center gap-2"
                                                onClick={() => togglePlanFilterVal(col.key, v)}>
                                                <input type="checkbox" readOnly checked={draft.has(v)} className="accent-indigo-600 cursor-pointer" />
                                                <span className="text-xs text-gray-700">{v || "(blank)"}</span>
                                              </div>
                                            ))}
                                            {visVals.length === 0 && <div className="px-3 py-2 text-xs text-gray-400">No matches</div>}
                                          </div>
                                          {/* OK / Cancel */}
                                          <div className="flex gap-2 p-2 border-t border-gray-100">
                                            <button onClick={() => applyPlanFilter(col.key)}
                                              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-1.5 rounded-lg">OK</button>
                                            <button onClick={() => clearPlanFilter(col.key)}
                                              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium py-1.5 rounded-lg">Clear</button>
                                          </div>
                                        </div>
                                      )}
                                    </th>
                                  );
                                })}
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-100">
                              {replanVisiblePlans.map(plan => {
                                const isSelected = replanSelPlanId === plan.planId;
                                const p = plan as any;
                                return (
                                  <tr key={plan.planId} onClick={() => setReplanSelPlanId(plan.planId)}
                                    className={`cursor-pointer transition-colors ${p.isSpecialSleeve ? "bg-rose-50 hover:bg-rose-100" : p.isSpecial ? "bg-amber-50 hover:bg-amber-100" : p.isBest ? "ring-2 ring-inset ring-green-400 bg-green-50" : isSelected ? "bg-indigo-50" : "hover:bg-gray-50"}`}>
                                    <td className="p-2 border border-gray-100 text-center">
                                      <div className={`w-4 h-4 rounded-full border-2 mx-auto flex items-center justify-center ${isSelected ? "border-indigo-600 bg-indigo-600" : "border-gray-300 bg-white"}`}>
                                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                      </div>
                                    </td>
                                    <td className="p-2 border border-gray-100 text-center">
                                      <button
                                        onClick={e => { e.stopPropagation(); setUpsPreviewPlan(plan); }}
                                        className="p-1 rounded-md hover:bg-indigo-100 text-indigo-500 hover:text-indigo-700 transition-colors"
                                        title="View UPS Layout">
                                        <EyeIcon size={13} />
                                      </button>
                                    </td>
                                    <td className="p-2 border border-gray-100 font-medium text-gray-700">{plan.machineName}{p.isBest && <span className="ml-1.5 px-1.5 py-0.5 bg-green-500 text-white text-[9px] font-bold rounded-full">BEST</span>}{p.isSpecial && !p.isSpecialSleeve && <span className="ml-1.5 px-1.5 py-0.5 bg-amber-500 text-white text-[9px] font-bold rounded-full">SPECIAL CYL</span>}{p.isSpecialSleeve && <span className="ml-1.5 px-1.5 py-0.5 bg-rose-500 text-white text-[9px] font-bold rounded-full">SPECIAL SLV</span>}</td>
                                    <td className="p-2 border border-gray-100 text-center font-bold text-indigo-700">{plan.acUps}</td>
                                    <td className="p-2 border border-gray-100 text-center font-mono">{p.printingWidth}</td>
                                    <td className="p-2 border border-gray-100"><span className={`font-semibold ${p.isSpecialSleeve ? "text-rose-600" : "text-blue-600"}`}>{p.sleeveCode}</span><br/><span className={`text-[9px] ${p.isSpecialSleeve ? "text-rose-500" : "text-gray-400"}`}>{p.sleeveName}</span></td>
                                    <td className={`p-2 border border-gray-100 text-center font-bold ${p.isSpecialSleeve ? "text-rose-600" : "text-blue-700"}`}>{p.sleeveWidthVal}</td>
                                    <td className={`p-2 border border-gray-100 text-center font-bold ${p.sideWaste > 100 ? "text-red-600" : "text-amber-600"}`}>{p.sideWaste}</td>
                                    <td className="p-2 border border-gray-100 text-center">
                                      <div className="font-bold text-indigo-700 text-xs">{plan.filmSize}</div>
                                      {(() => {
                                        const jobW = replanForm?.actualWidth || replanForm?.jobWidth || 0;
                                        const trim = replanForm?.trimmingSize || 0;
                                        if (!trim) return null;
                                        return (
                                          <div className="flex items-center justify-center flex-wrap gap-0.5 mt-1">
                                            <span className="text-[8px] text-indigo-500 font-semibold leading-none">{plan.acUps}×{jobW}</span>
                                            <span className="text-[8px] font-bold leading-none px-1 py-0.5 rounded"
                                              style={{ background: "#fff7ed", color: "#c2410c" }}>
                                              +{2 * trim}T
                                            </span>
                                          </div>
                                        );
                                      })()}
                                    </td>
                                    <td className={`p-2 border border-gray-100 text-center font-bold ${p.deadMargin < 0 ? "text-red-600" : "text-orange-600"}`}>{p.deadMargin}</td>
                                    <td className={`p-2 border border-gray-100 text-center font-bold ${p.isBest ? "text-green-700" : p.totalWaste > 300 ? "text-red-600" : "text-amber-600"}`}>{p.totalWaste}</td>
                                    <td className="p-2 border border-gray-100"><span className={`font-semibold ${p.isSpecial ? "text-amber-600" : "text-violet-600"}`}>{p.cylinderCode}</span><br/><span className={`text-[9px] ${p.isSpecial ? "text-amber-500" : "text-gray-400"}`}>{p.cylinderName}</span></td>
                                    <td className={`p-2 border border-gray-100 text-center font-bold ${p.isSpecial ? "text-amber-600" : "text-violet-700"}`}>{p.cylinderWidthVal}</td>
                                    <td className="p-2 border border-gray-100 text-center font-bold text-emerald-700">{p.cylCirc}</td>
                                    <td className="p-2 border border-gray-100 text-center font-bold text-teal-700">{p.repeatUPS}</td>
                                    <td className="p-2 border border-gray-100 text-center font-bold">{plan.totalUPS}</td>
                                    <td className="p-2 border border-gray-100 text-center text-blue-600 font-semibold">{plan.totalRMT}</td>
                                  </tr>
                                );
                              })}
                              {replanVisiblePlans.length === 0 && (
                                <tr><td colSpan={17} className="p-4 text-center text-gray-400 text-xs">No plans match your search</td></tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                        {replanSelPlanId && (
                          <div className="bg-indigo-900 text-indigo-100 px-4 py-2.5 flex items-center justify-between text-[11px]">
                            <span className="flex items-center gap-2"><Check size={12} className="text-green-400" /> Plan selected — UPS: {replanSelectedPlan?.totalUPS}</span>
                            <button onClick={() => { setReplanIsPlanApplied(true); setReplanShowPlan(false); }} className="bg-green-500 hover:bg-green-600 text-white text-xs font-bold px-3 py-1 rounded-lg">Apply</button>
                          </div>
                        )}
                      </div>
                    )}

                    {replanIsPlanApplied && replanSelectedPlan && replanForm.secondaryLayers.length > 0 && (
                      <div className="space-y-3">
                        <p className="text-xs font-bold text-indigo-900">Ply / Layer Calculation — UPS: {replanSelectedPlan.totalUPS} · Film: {replanSelectedPlan.filmSize}mm · Wastage: {replanSelectedPlan.wastage}mm · RMT: {replanSelectedPlan.totalRMT}</p>
                        <div className="border-2 border-indigo-50 rounded-2xl overflow-hidden shadow-lg">
                          <div className="overflow-x-auto">
                            <table className="min-w-full text-[10px] border-collapse">
                              <thead className="bg-indigo-700 text-white uppercase tracking-wider font-bold">
                                <tr>
                                  {["Layer","Type","Film / Material","Thick (μ)","Density","GSM","Width (mm)","Req.Mtr","Req.SQM","Req.Wt (Kg)","Waste Mtr","Waste Wt","Total Mtr","Total Wt (Kg)"].map(h => (
                                    <th key={h} className="p-2 border border-indigo-600/30 text-center whitespace-nowrap">{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {replanForm.secondaryLayers.map((l, idx) => {
                                  const WASTE_PCT = 0.03;
                                  const rmt = replanSelectedPlan.totalRMT;
                                  const widthM = replanForm.jobWidth / 1000;
                                  const reqSQM = parseFloat((rmt * widthM).toFixed(3));
                                  const reqWt  = l.gsm > 0 ? parseFloat((l.gsm * reqSQM / 1000).toFixed(4)) : 0;
                                  const wasteMtr = parseFloat((rmt * WASTE_PCT).toFixed(2));
                                  const wasteWt  = parseFloat((reqWt * WASTE_PCT).toFixed(4));
                                  const totalMtr = parseFloat((rmt + wasteMtr).toFixed(2));
                                  const totalWt  = parseFloat((reqWt + wasteWt).toFixed(4));
                                  return (
                                    <tr key={l.id} className="hover:bg-indigo-50/30">
                                      <td className="p-2 border border-gray-100 text-center font-black text-indigo-900 bg-indigo-50/20">{idx + 1}</td>
                                      <td className="p-2 border border-gray-100 text-center">
                                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold border ${l.plyType === "Printing" ? "bg-indigo-50 text-indigo-700 border-indigo-200" : l.plyType === "Lamination" ? "bg-teal-50 text-teal-700 border-teal-200" : l.plyType === "Coating" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-blue-50 text-blue-700 border-blue-200"}`}>{l.plyType || "Film"}</span>
                                      </td>
                                      <td className="p-2 border border-gray-100 font-medium text-gray-700 min-w-[140px] whitespace-normal">{l.itemSubGroup || "—"}</td>
                                      <td className="p-2 border border-gray-100 text-center font-mono">{l.thickness || "—"}</td>
                                      <td className="p-2 border border-gray-100 text-center font-mono">{l.density || "—"}</td>
                                      <td className="p-2 border border-gray-100 text-center font-bold text-indigo-700">{l.gsm || "—"}</td>
                                      <td className="p-2 border border-gray-100 text-center font-mono">{replanForm.jobWidth}</td>
                                      <td className="p-2 border border-gray-100 text-center font-mono">{rmt}</td>
                                      <td className="p-2 border border-gray-100 text-center font-mono">{reqSQM}</td>
                                      <td className="p-2 border border-gray-100 text-center font-bold text-blue-600">{reqWt}</td>
                                      <td className="p-2 border border-gray-100 text-center font-mono text-orange-600">{wasteMtr}</td>
                                      <td className="p-2 border border-gray-100 text-center font-mono text-orange-600">{wasteWt}</td>
                                      <td className="p-2 border border-gray-100 text-center font-mono text-gray-700">{totalMtr}</td>
                                      <td className="p-2 border border-gray-100 text-center font-black text-gray-900 bg-gray-50">{totalWt}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                              <tfoot className="bg-slate-50 border-t-2 border-indigo-200">
                                <tr className="font-bold">
                                  <td colSpan={13} className="p-3 text-right text-indigo-900 uppercase text-[10px]">Total Weight (Kg)</td>
                                  <td className="p-3 text-center bg-indigo-100 text-indigo-900 text-xs">
                                    {replanForm.secondaryLayers.reduce((sum, l) => {
                                      const rmt = replanSelectedPlan.totalRMT;
                                      const reqSQM = rmt * replanForm.jobWidth / 1000;
                                      const reqWt = l.gsm > 0 ? l.gsm * reqSQM / 1000 : 0;
                                      return sum + parseFloat((reqWt * 1.03).toFixed(4));
                                    }, 0).toFixed(3)}
                                  </td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}


                <div className="flex justify-between">
                  <Button variant="secondary" onClick={() => setReplanTab("info")}>← Back</Button>
                  <Button onClick={() => { if (catalogColorShades.length === 0 && replanForm) initCatalogPrepData(replanForm); setCatalogPrepTab("shade"); setReplanTab("material"); }}>Next: Production Prep <ChevronRight size={14} className="ml-1" /></Button>
                </div>
              </div>
            )}

            {/* ── Tab 3: Production Preparation ── */}
            {replanTab === "material" && replanForm && (
              <div className="space-y-3">
                {/* Sub-tab bar */}
                <div className="flex overflow-x-auto bg-gray-100 p-1 rounded-xl gap-1">
                  {([
                    { key: "shade",    label: "Color Shade & LAB"   },
                    { key: "tool",     label: "Tool / Cylinder"     },
                  ] as const).map(t => (
                    <button key={t.key} onClick={() => setCatalogPrepTab(t.key)}
                      className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all whitespace-nowrap ${catalogPrepTab === t.key ? "bg-white shadow text-purple-700" : "text-gray-500 hover:text-gray-700"}`}>
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* ─── Color Shade & LAB ─── */}
                {catalogPrepTab === "shade" && (
                  <div className="space-y-3">
                    <div className="bg-purple-50 border border-purple-200 rounded-xl px-4 py-3 flex items-start gap-2">
                      <Palette size={14} className="text-purple-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-purple-800">Color Shade & LAB Standard</p>
                        <p className="text-xs text-purple-700 mt-0.5">Enter client-approved color standards with CIE LAB values for production color matching.</p>
                      </div>
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
                      <table className="min-w-full text-[11px] border-collapse">
                        <thead className="bg-purple-700 text-white uppercase tracking-wider">
                          <tr>
                            {["#", "Ink Item (Master)", "Color Name", "Type", "Pantone Ref"].map(h => (
                              <th key={h} className="px-2 py-2 border border-purple-600/30 text-center whitespace-nowrap font-semibold">{h}</th>
                            ))}
                            <th colSpan={3} className="px-2 py-2 border border-purple-600/30 text-center whitespace-nowrap font-semibold bg-indigo-700">Standard L* A* B*</th>
                            <th colSpan={3} className="px-2 py-2 border border-purple-600/30 text-center whitespace-nowrap font-semibold bg-teal-700">Actual L* A* B*</th>
                            {["ΔE Tol.", "ΔE Calc.", "Result", "Shade Card Ref", "Status", "Remarks"].map(h => (
                              <th key={h} className="px-2 py-2 border border-purple-600/30 text-center whitespace-nowrap font-semibold">{h}</th>
                            ))}
                          </tr>
                          <tr className="bg-purple-800 text-purple-200 text-[9px]">
                            {["", "", "", "", ""].map((_, i) => <th key={i} className="border border-purple-700/30" />)}
                            {["L*", "A*", "B*"].map(h => <th key={`s-${h}`} className="px-2 py-1 border border-purple-700/30 text-center bg-indigo-800/60">{h}</th>)}
                            {["L*", "A*", "B*"].map(h => <th key={`a-${h}`} className="px-2 py-1 border border-purple-700/30 text-center bg-teal-800/60">{h}</th>)}
                            {["", "", "", "", "", ""].map((_, i) => <th key={`e-${i}`} className="border border-purple-700/30" />)}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {catalogColorShades.map((cs, i) => {
                            // ── ΔE CIE76 calculation ──
                            const sL = parseFloat(cs.labL); const sA = parseFloat(cs.labA); const sB = parseFloat(cs.labB);
                            const aL = parseFloat(cs.actualL); const aA = parseFloat(cs.actualA); const aB = parseFloat(cs.actualB);
                            const hasStd    = !isNaN(sL) && !isNaN(sA) && !isNaN(sB);
                            const hasActual = !isNaN(aL) && !isNaN(aA) && !isNaN(aB);
                            const calcDE    = hasStd && hasActual
                              ? parseFloat(Math.sqrt((sL - aL) ** 2 + (sA - aA) ** 2 + (sB - aB) ** 2).toFixed(2))
                              : null;
                            const tol    = parseFloat(cs.deltaE) || 1.0;
                            const pass   = calcDE !== null ? calcDE <= tol : null;
                            return (
                            <tr key={i} className={`hover:bg-purple-50/20 ${pass === false ? "bg-red-50/30" : pass === true ? "bg-green-50/20" : ""}`}>
                              <td className="px-2 py-1.5 text-center font-black text-purple-700">{cs.colorNo}</td>
                              <td className="px-2 py-1.5 min-w-[160px]">
                                <select className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white outline-none focus:ring-2 focus:ring-purple-400"
                                  value={(cs as any).inkItemId ?? ""}
                                  onChange={e => {
                                    const ink = INK_ITEMS.find(x => x.id === e.target.value);
                                    setCatalogColorShades(p => p.map((c, ci) => ci === i ? {
                                      ...c,
                                      inkItemId: ink?.id ?? "",
                                      colorName: ink?.colour || ink?.name || c.colorName,
                                      pantoneRef: ink?.pantoneNo || c.pantoneRef,
                                    } as any : c));
                                  }}>
                                  <option value="">-- Select Ink --</option>
                                  {INK_ITEMS.map(ink => <option key={ink.id} value={ink.id}>{ink.name}{ink.colour ? ` (${ink.colour})` : ""}</option>)}
                                </select>
                              </td>
                              <td className="px-2 py-1.5"><input className="w-24 text-xs border border-gray-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-purple-400" value={cs.colorName} onChange={e => setCatalogColorShades(p => p.map((c, ci) => ci === i ? { ...c, colorName: e.target.value } : c))} /></td>
                              <td className="px-2 py-1.5"><select className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white outline-none focus:ring-2 focus:ring-purple-400" value={cs.inkType} onChange={e => setCatalogColorShades(p => p.map((c, ci) => ci === i ? { ...c, inkType: e.target.value as ColorShade["inkType"] } : c))}><option value="Spot">Spot</option><option value="Process">Process</option><option value="Special">Special</option></select></td>
                              <td className="px-2 py-1.5"><input placeholder="PMS 485 C" className="w-24 text-xs border border-gray-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-purple-400" value={cs.pantoneRef} onChange={e => setCatalogColorShades(p => p.map((c, ci) => ci === i ? { ...c, pantoneRef: e.target.value } : c))} /></td>
                              {/* Standard LAB */}
                              <td className="px-2 py-1.5 bg-indigo-50/40"><input type="number" step={0.01} placeholder="L*" className="w-14 text-xs border border-indigo-200 rounded-lg px-2 py-1 font-mono outline-none focus:ring-2 focus:ring-indigo-400 bg-white" value={cs.labL} onChange={e => setCatalogColorShades(p => p.map((c, ci) => ci === i ? { ...c, labL: e.target.value } : c))} /></td>
                              <td className="px-2 py-1.5 bg-indigo-50/40"><input type="number" step={0.01} placeholder="a*" className="w-14 text-xs border border-indigo-200 rounded-lg px-2 py-1 font-mono outline-none focus:ring-2 focus:ring-indigo-400 bg-white" value={cs.labA} onChange={e => setCatalogColorShades(p => p.map((c, ci) => ci === i ? { ...c, labA: e.target.value } : c))} /></td>
                              <td className="px-2 py-1.5 bg-indigo-50/40"><input type="number" step={0.01} placeholder="b*" className="w-14 text-xs border border-indigo-200 rounded-lg px-2 py-1 font-mono outline-none focus:ring-2 focus:ring-indigo-400 bg-white" value={cs.labB} onChange={e => setCatalogColorShades(p => p.map((c, ci) => ci === i ? { ...c, labB: e.target.value } : c))} /></td>
                              {/* Actual LAB */}
                              <td className="px-2 py-1.5 bg-teal-50/40"><input type="number" step={0.01} placeholder="L*" className="w-14 text-xs border border-teal-200 rounded-lg px-2 py-1 font-mono outline-none focus:ring-2 focus:ring-teal-400 bg-white" value={cs.actualL} onChange={e => setCatalogColorShades(p => p.map((c, ci) => ci === i ? { ...c, actualL: e.target.value } : c))} /></td>
                              <td className="px-2 py-1.5 bg-teal-50/40"><input type="number" step={0.01} placeholder="a*" className="w-14 text-xs border border-teal-200 rounded-lg px-2 py-1 font-mono outline-none focus:ring-2 focus:ring-teal-400 bg-white" value={cs.actualA} onChange={e => setCatalogColorShades(p => p.map((c, ci) => ci === i ? { ...c, actualA: e.target.value } : c))} /></td>
                              <td className="px-2 py-1.5 bg-teal-50/40"><input type="number" step={0.01} placeholder="b*" className="w-14 text-xs border border-teal-200 rounded-lg px-2 py-1 font-mono outline-none focus:ring-2 focus:ring-teal-400 bg-white" value={cs.actualB} onChange={e => setCatalogColorShades(p => p.map((c, ci) => ci === i ? { ...c, actualB: e.target.value } : c))} /></td>
                              {/* ΔE Tol */}
                              <td className="px-2 py-1.5"><input type="number" step={0.1} placeholder="1.0" className="w-14 text-xs border border-gray-200 rounded-lg px-2 py-1 font-mono outline-none focus:ring-2 focus:ring-purple-400" value={cs.deltaE} onChange={e => setCatalogColorShades(p => p.map((c, ci) => ci === i ? { ...c, deltaE: e.target.value } : c))} /></td>
                              {/* ΔE Calculated */}
                              <td className="px-2 py-1.5 text-center">
                                {calcDE !== null
                                  ? <span className={`font-bold font-mono text-xs ${pass ? "text-green-700" : "text-red-600"}`}>{calcDE}</span>
                                  : <span className="text-gray-300 text-xs">—</span>}
                              </td>
                              {/* Result Pass/Fail */}
                              <td className="px-2 py-1.5 text-center">
                                {pass === true && <span className="px-2 py-0.5 bg-green-100 text-green-700 border border-green-300 rounded-full text-[10px] font-bold">PASS</span>}
                                {pass === false && <span className="px-2 py-0.5 bg-red-100 text-red-700 border border-red-300 rounded-full text-[10px] font-bold">FAIL</span>}
                                {pass === null && <span className="text-gray-300 text-xs">—</span>}
                              </td>
                              <td className="px-2 py-1.5"><input placeholder="SC-001" className="w-20 text-xs border border-gray-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-purple-400" value={cs.shadeCardRef} onChange={e => setCatalogColorShades(p => p.map((c, ci) => ci === i ? { ...c, shadeCardRef: e.target.value } : c))} /></td>
                              <td className="px-2 py-1.5"><select className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white outline-none focus:ring-2 focus:ring-purple-400" value={cs.status} onChange={e => setCatalogColorShades(p => p.map((c, ci) => ci === i ? { ...c, status: e.target.value as ColorShade["status"] } : c))}><option value="Pending">Pending</option><option value="Standard Received">Std. Received</option><option value="Approved">Approved</option><option value="Rejected">Rejected</option></select></td>
                              <td className="px-2 py-1.5"><input placeholder="Notes…" className="w-28 text-xs border border-gray-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-purple-400" value={cs.remarks} onChange={e => setCatalogColorShades(p => p.map((c, ci) => ci === i ? { ...c, remarks: e.target.value } : c))} /></td>
                            </tr>
                            );
                          })}
                          {catalogColorShades.length === 0 && <tr><td colSpan={17} className="p-6 text-center text-gray-400 text-xs">No colors. Set No. of Colors in Basic Info tab first.</td></tr>}
                        </tbody>
                      </table>
                    </div>
                    {catalogColorShades.length > 0 && (
                      <div className="flex gap-2 flex-wrap">
                        {(["Pending", "Standard Received", "Approved", "Rejected"] as const).map(s => {
                          const cnt = catalogColorShades.filter(c => c.status === s).length;
                          return cnt > 0 ? <span key={s} className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${s === "Approved" ? "bg-green-50 text-green-700 border-green-200" : s === "Standard Received" ? "bg-blue-50 text-blue-700 border-blue-200" : s === "Rejected" ? "bg-red-50 text-red-700 border-red-200" : "bg-gray-50 text-gray-500 border-gray-200"}`}>{cnt} {s}</span> : null;
                        })}
                      </div>
                    )}
                  </div>
                )}



                {/* ─── Tool / Cylinder Allocation ─── */}
                {catalogPrepTab === "tool" && (
                  <div className="space-y-3">
                    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2">
                      <Wrench size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-amber-800">Tool & Cylinder Allocation</p>
                        <p className="text-xs text-amber-700 mt-0.5">Assign print cylinders to each color. Track cylinder status, type, and circumference.</p>
                      </div>
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
                      <table className="min-w-full text-[11px] border-collapse">
                        <thead className="bg-amber-700 text-white uppercase tracking-wider">
                          <tr>{["Color #", "Color Name", "Cylinder No.", "Circumference (mm)", "Type", "Status", "Remarks"].map(h => (
                            <th key={h} className="px-2 py-2 border border-amber-600/30 text-center whitespace-nowrap font-semibold">{h}</th>
                          ))}</tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {catalogCylAllocs.map((ca, i) => (
                            <tr key={i} className="hover:bg-amber-50/20">
                              <td className="px-2 py-1.5 text-center font-black text-amber-700">{ca.colorNo}</td>
                              <td className="px-2 py-1.5">
                                <div className="px-2 py-1 text-xs font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-lg min-w-[100px]">
                                  {catalogColorShades[i]?.colorName || ca.colorName}
                                </div>
                              </td>
                              <td className="px-2 py-1.5 min-w-[200px]">
                                <select className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white outline-none focus:ring-2 focus:ring-amber-400"
                                  value={(ca as any).toolId ?? ""}
                                  onChange={e => {
                                    const tool = CYLINDER_TOOLS_ALL.find(t => t.id === e.target.value);
                                    setCatalogCylAllocs(p => p.map((c, ci) => ci === i ? {
                                      ...c,
                                      toolId: tool?.id ?? "",
                                      cylinderNo: tool?.code ?? c.cylinderNo,
                                      circumference: replanSelectedPlan ? String(replanSelectedPlan.cylCirc) : c.circumference,
                                    } as any : c));
                                  }}>
                                  <option value="">{ca.cylinderNo || "-- Select Cylinder --"}</option>
                                  {CYLINDER_TOOLS_ALL.map(t => <option key={t.id} value={t.id}>{t.code} — {t.name} ({t.printWidth}mm)</option>)}
                                </select>
                              </td>
                              <td className="px-2 py-1.5"><input type="number" className="w-20 text-xs border border-gray-200 rounded-lg px-2 py-1 font-mono outline-none focus:ring-2 focus:ring-amber-400 text-center" value={ca.circumference} onChange={e => setCatalogCylAllocs(p => p.map((c, ci) => ci === i ? { ...c, circumference: e.target.value } : c))} /></td>
                              <td className="px-2 py-1.5"><select className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white outline-none focus:ring-2 focus:ring-amber-400" value={ca.cylinderType} onChange={e => setCatalogCylAllocs(p => p.map((c, ci) => ci === i ? { ...c, cylinderType: e.target.value as CylinderAlloc["cylinderType"] } : c))}><option value="Existing">Existing</option><option value="New">New</option><option value="Rechromed">Rechromed</option></select></td>
                              <td className="px-2 py-1.5"><select className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white outline-none focus:ring-2 focus:ring-amber-400" value={ca.status} onChange={e => setCatalogCylAllocs(p => p.map((c, ci) => ci === i ? { ...c, status: e.target.value as CylinderAlloc["status"] } : c))}><option value="Pending">Pending</option><option value="Available">Available</option><option value="In Use">In Use</option><option value="Under Chrome">Under Chrome</option><option value="Ordered">Ordered</option></select></td>
                              <td className="px-2 py-1.5"><input placeholder="Notes…" className="w-32 text-xs border border-gray-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-amber-400" value={ca.remarks} onChange={e => setCatalogCylAllocs(p => p.map((c, ci) => ci === i ? { ...c, remarks: e.target.value } : c))} /></td>
                            </tr>
                          ))}
                          {catalogCylAllocs.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-gray-400 text-xs">No cylinders. Set No. of Colors in Basic Info tab first.</td></tr>}
                        </tbody>
                      </table>
                    </div>
                    {catalogCylAllocs.length > 0 && (
                      <div className="flex gap-2 flex-wrap">
                        {(["Pending", "Available", "In Use", "Under Chrome", "Ordered"] as const).map(s => {
                          const cnt = catalogCylAllocs.filter(c => c.status === s).length;
                          return cnt > 0 ? <span key={s} className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${s === "Available" ? "bg-green-50 text-green-700 border-green-200" : s === "In Use" ? "bg-blue-50 text-blue-700 border-blue-200" : s === "Under Chrome" ? "bg-orange-50 text-orange-700 border-orange-200" : s === "Ordered" ? "bg-purple-50 text-purple-700 border-purple-200" : "bg-gray-50 text-gray-500 border-gray-200"}`}>{cnt} {s}</span> : null;
                        })}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-between pt-2">
                  <Button variant="secondary" onClick={() => setReplanTab("planning")}>← Back</Button>
                  <Button icon={<BookMarked size={14} />} onClick={saveReplan}>{isNewCatalog ? "Save to Catalog" : "Save Changes"}</Button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ══ JOB SPEC SHEET PRINT MODAL ═══════════════════════════ */}
      {printRow && (() => {
        const r = printRow;
        const machine = PRINT_MACHINES.find(m => m.id === r.machineId);
        const trim    = r.trimmingSize || 0;
        const cylMargin = machine ? parseFloat((machine as any).printingMargin || "15") : 15;
        const cylLen    = machine ? parseFloat((machine as any).repeatLengthMax || "900") : 900;
        const cylCirc   = r.jobHeight || 0;
        const cylWidth  = r.actualWidth || r.jobWidth || 0;
        const slittingTrim = trim * 2;
        const printingWidth = cylWidth;
        const today   = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
        const colorRows = r.secondaryLayers?.flatMap(l => l.consumableItems?.filter(ci => ci.itemGroup === "Ink").map(ci => ({ name: ci.itemName || ci.itemSubGroup || "", grade: "" })) ?? []) ?? [];

        const handlePrint = () => {
          const el = document.getElementById("job-spec-print-area");
          if (!el) return;
          const w = window.open("", "_blank", "width=900,height=700");
          if (!w) return;
          w.document.write(`<!DOCTYPE html><html><head><title>Job Spec — ${r.catalogNo}</title>
            <style>
              *{margin:0;padding:0;box-sizing:border-box;font-family:Arial,sans-serif;font-size:10px;}
              body{padding:12px;color:#000;}
              .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #000;padding-bottom:6px;margin-bottom:6px;}
              .title{font-size:16px;font-weight:bold;text-align:center;letter-spacing:1px;margin:4px 0 8px;}
              table{width:100%;border-collapse:collapse;margin-bottom:6px;}
              td,th{border:1px solid #000;padding:3px 5px;vertical-align:top;}
              th{background:#e8e8e8;font-weight:bold;text-align:left;}
              .section-title{font-weight:bold;text-decoration:underline;margin:6px 0 3px;}
              .two-col{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
              .swatch{width:60px;height:14px;display:inline-block;border:1px solid #999;}
              .sign-row{display:flex;justify-content:space-between;margin-top:16px;border-top:1px solid #000;padding-top:8px;}
              .no-border td{border:none;}
              @media print{body{padding:6px;}}
            </style></head><body>${el.innerHTML}</body></html>`);
          w.document.close();
          w.focus();
          setTimeout(() => { w.print(); }, 400);
        };

        const swatchColors = ["#1565C0","#2E7D32","#C62828","#B71C1C","#4527A0","#F57F17","#212121","#6A1B9A","#00695C"];

        return (
          <Modal open onClose={() => setPrintRow(null)} title={`Job Specification Sheet — ${r.catalogNo}`} size="xl">
            <div className="flex justify-end mb-3">
              <button onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-700 hover:bg-indigo-800 text-white text-sm font-bold rounded-xl shadow transition">
                <Printer size={15} /> Print / Save PDF
              </button>
            </div>

            <div id="job-spec-print-area" className="bg-white text-black text-[11px] p-4 border border-gray-300 rounded-xl font-sans">
              {/* Header */}
              <div className="flex justify-between items-start border-b-2 border-black pb-2 mb-2">
                <div>
                  <div className="text-[18px] font-black tracking-widest text-blue-900">AJ SHRINK</div>
                  <div className="text-[9px] text-gray-600 font-semibold">Flexible Packaging ERP</div>
                </div>
                <div className="text-right text-[9px] leading-tight">
                  <div className="font-bold">AJSW/QC/CAT/R0</div>
                  <div>D.O.E — {today}</div>
                  <div className="mt-1"><strong>Job Code:</strong> {r.catalogNo}</div>
                  <div><strong>Type:</strong> {r.substrate || r.content || "—"}</div>
                </div>
              </div>

              <div className="text-center text-[15px] font-black tracking-widest uppercase border-b border-black pb-1 mb-3">Job Specification Sheet</div>

              {/* Top info */}
              <table className="mb-2">
                <tbody>
                  <tr>
                    <th style={{ width: "20%" }}>Job Name</th>
                    <td colSpan={3} className="font-bold">{r.productName}</td>
                  </tr>
                  <tr>
                    <th>Customer</th>
                    <td>{r.customerName}</td>
                    <th style={{ width: "18%" }}>Order Ref</th>
                    <td>{r.sourceOrderNo || "—"}</td>
                  </tr>
                  <tr>
                    <th>Specification</th>
                    <td>{cylWidth} mm × {r.jobHeight || "—"} mm{r.substrate ? `, ${r.substrate}` : ""}</td>
                    <th>Print Type</th>
                    <td>{r.printType}</td>
                  </tr>
                  <tr>
                    <th>Artwork Name</th>
                    <td>{(r as any).artworkName || "—"}</td>
                    <th>Brand Name</th>
                    <td>{(r as any).brandName || "—"}</td>
                  </tr>
                  {(r as any).specialSpecs && (
                    <tr><th>Special Specs</th><td colSpan={3}>{(r as any).specialSpecs}</td></tr>
                  )}
                </tbody>
              </table>

              <div className="grid grid-cols-2 gap-3 mb-2">
                {/* Cylinder Details */}
                <div>
                  <div className="font-bold underline mb-1">Cylinder Details</div>
                  <table>
                    <tbody>
                      <tr><th>Repeat (Height)</th><td>{r.jobHeight || "—"} mm{(r.widthShrinkage || 0) > 0 ? ` + ${r.widthShrinkage}mm shrink` : ""}</td></tr>
                      <tr><th>Width</th><td>{cylWidth} mm</td></tr>
                      <tr><th>No. of Colours</th><td>{r.noOfColors} colours</td></tr>
                      <tr><th>Cylinder Circ.</th><td>{r.jobHeight || "—"} mm</td></tr>
                      <tr><th>Machine</th><td>{r.machineName || "—"}</td></tr>
                    </tbody>
                  </table>
                  <div className="mt-2">
                    <table>
                      <thead><tr><th>Printing Width</th><th>Slitting Trim</th><th>Cylinder Margin</th></tr></thead>
                      <tbody>
                        <tr>
                          <td className="text-center font-bold">{printingWidth} mm</td>
                          <td className="text-center">{slittingTrim} mm</td>
                          <td className="text-center">{cylMargin} mm</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Printing Details */}
                <div>
                  <div className="font-bold underline mb-1">Printing Details</div>
                  <table>
                    <tbody>
                      <tr><th>Printing Type</th><td>{r.printType}</td></tr>
                      <tr><th>No. of Colors</th><td>{r.noOfColors}</td></tr>
                      <tr><th>Front Colors</th><td>{r.frontColors || "—"}</td></tr>
                      <tr><th>Back Colors</th><td>{r.backColors || "—"}</td></tr>
                      <tr><th>Standard Qty</th><td>{(r.standardQty || 0).toLocaleString()} {r.standardUnit}</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Ink / Color table */}
              <div className="font-bold underline mb-1">Ink Details</div>
              <table className="mb-2">
                <thead>
                  <tr>
                    <th style={{ width: "5%" }}>No.</th>
                    <th style={{ width: "20%" }}>Ink Name</th>
                    <th style={{ width: "35%" }}>Ink Code / Grade</th>
                    <th style={{ width: "25%" }}>Ink Viscosity</th>
                    <th style={{ width: "15%" }}>Drawdown Sample</th>
                  </tr>
                </thead>
                <tbody>
                  {colorRows.length > 0 ? colorRows.map((c, i) => (
                    <tr key={i}>
                      <td className="text-center">{i + 1}</td>
                      <td>{c.name || "—"}</td>
                      <td>{c.grade || "—"}</td>
                      <td></td>
                      <td><div style={{ width: 60, height: 14, background: swatchColors[i] ?? "#ccc", border: "1px solid #999" }} /></td>
                    </tr>
                  )) : Array.from({ length: r.noOfColors || 4 }, (_, i) => (
                    <tr key={i}>
                      <td className="text-center">{i + 1}</td>
                      <td></td><td></td><td></td>
                      <td><div style={{ width: 60, height: 14, background: swatchColors[i] ?? "#eee", border: "1px solid #999" }} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Slitting + Packing */}
              <div className="grid grid-cols-2 gap-3 mb-2">
                <div>
                  <div className="font-bold underline mb-1">Slitting Details</div>
                  <table>
                    <tbody>
                      <tr><th>Slitting Width</th><td>{cylWidth} mm</td></tr>
                      <tr><th>Trimming Both Side</th><td>{trim} mm</td></tr>
                      <tr><th>Core Type</th><td>3" Paper Core</td></tr>
                    </tbody>
                  </table>
                </div>
                <div>
                  <div className="font-bold underline mb-1">Packing Details</div>
                  <table>
                    <tbody>
                      <tr><th>Pack Size</th><td>{(r as any).packSize || "—"}</td></tr>
                      <tr><th>SKU Type</th><td>{(r as any).skuType || "—"}</td></tr>
                      <tr><th>Address Type</th><td>{(r as any).addressType || "—"}</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Remarks */}
              {r.remarks && (
                <table className="mb-2">
                  <tbody><tr><th style={{ width: "15%" }}>Remarks</th><td>{r.remarks}</td></tr></tbody>
                </table>
              )}

              {/* Signatures */}
              <div className="flex justify-between mt-4 border-t border-black pt-3">
                <div className="text-center" style={{ minWidth: 120 }}>
                  <div className="border-b border-black mb-1" style={{ height: 28 }}></div>
                  <div className="text-[9px] font-bold">Prepared by</div>
                </div>
                <div className="text-center" style={{ minWidth: 120 }}>
                  <div className="border-b border-black mb-1" style={{ height: 28 }}></div>
                  <div className="text-[9px] font-bold">Checked by</div>
                </div>
                <div className="text-center" style={{ minWidth: 120 }}>
                  <div className="border-b border-black mb-1" style={{ height: 28 }}></div>
                  <div className="text-[9px] font-bold">Approved by</div>
                </div>
              </div>
            </div>
          </Modal>
        );
      })()}

      {/* ══ ATTACHMENT PREVIEW MODAL ═════════════════════════════ */}
      {previewAttachment && (
        <Modal open onClose={() => setPreviewAttachment(null)} title={previewAttachment.name} size="xl">
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
            {previewAttachment.mimeType.startsWith("image/") ? (
              <img src={previewAttachment.url} alt={previewAttachment.name}
                className="max-w-full max-h-[70vh] object-contain rounded-xl shadow-lg" />
            ) : previewAttachment.mimeType === "application/pdf" ? (
              <iframe src={previewAttachment.url} title={previewAttachment.name}
                className="w-full rounded-xl border border-gray-200 shadow" style={{ height: "70vh" }} />
            ) : (
              <div className="flex flex-col items-center gap-4 py-16 text-center">
                <div className="w-20 h-20 rounded-2xl bg-gray-100 flex items-center justify-center">
                  <span className="text-2xl font-black text-gray-400">
                    {previewAttachment.name.split(".").pop()?.toUpperCase() ?? "FILE"}
                  </span>
                </div>
                <p className="text-sm text-gray-500 max-w-xs">
                  Preview is not available for this file type.<br />Use the download button to open it.
                </p>
                <a href={previewAttachment.url} download={previewAttachment.name}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition">
                  ↓ Download {previewAttachment.name}
                </a>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ══ CYLINDER CIRCUMFERENCE GUIDE MODAL ══════════════════ */}
      {cylGuideOpen && replanForm && (() => {
        const jobH    = replanForm.jobHeight || 0;
        const jobW    = replanForm.actualWidth || replanForm.jobWidth || 0;
        const shrink  = replanForm.widthShrinkage || 0;
        const trim    = replanForm.trimmingSize   || 0;
        const laneW   = jobW + shrink;
        // Available sleeves from stock
        const stockSleeves = SLEEVE_TOOLS.map(s => parseFloat(s.printWidth)).filter(w => w > 0).sort((a, b) => a - b);
        // Circumference options: 1× to 8× jobHeight (practical range)
        const maxRepeat = 8;
        const rows = Array.from({ length: maxRepeat }, (_, i) => {
          const repeatUPS = i + 1;
          const circ = repeatUPS * jobH;
          // For each sleeve, what AC UPS can this sleeve support?
          const sleeveResults = stockSleeves.map(sw => {
            const acUps = laneW > 0 ? Math.floor(sw / laneW) : 0;
            const filmW = acUps * laneW + 2 * trim;
            if (acUps === 0 || filmW > sw) return null;
            return { sw, acUps, filmW, totalUPS: acUps * repeatUPS };
          }).filter(Boolean) as { sw: number; acUps: number; filmW: number; totalUPS: number }[];
          return { repeatUPS, circ, sleeveResults };
        });
        return (
          <Modal open onClose={() => setCylGuideOpen(false)} title="Cylinder Circumference Guide" size="xl">
            <div className="space-y-4">
              {/* Input summary */}
              <div className="flex flex-wrap gap-2 text-xs">
                {[
                  { l: "Job Height",  v: `${jobH} mm`,    cls: "bg-indigo-50 text-indigo-700 border-indigo-200" },
                  { l: "Job Width",   v: `${jobW} mm`,    cls: "bg-blue-50 text-blue-700 border-blue-200" },
                  { l: "Lane Width",  v: `${laneW} mm`,   cls: "bg-purple-50 text-purple-700 border-purple-200" },
                  { l: "Trimming",    v: trim > 0 ? `${trim} mm` : "—", cls: "bg-orange-50 text-orange-700 border-orange-200" },
                ].map(s => (
                  <div key={s.l} className={`px-2.5 py-1.5 rounded-lg border font-medium ${s.cls}`}>
                    <span className="opacity-60 text-[10px] uppercase tracking-wider block leading-none mb-0.5">{s.l}</span>
                    <span className="font-bold">{s.v}</span>
                  </div>
                ))}
              </div>

              <p className="text-xs text-gray-500 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <strong className="text-amber-700">How to use:</strong> Choose the <em>Repeat UPS</em> (impressions per cylinder revolution) you need → the <strong>Circumference</strong> column tells you what circumference to order for your 1100mm cylinder. Cross-check the sleeve columns to see your AC UPS and Total UPS for each sleeve size.
              </p>

              <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
                <table className="min-w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-indigo-700 text-white">
                      <th className="px-3 py-2.5 text-left whitespace-nowrap">Repeat UPS<br/><span className="text-indigo-300 font-normal text-[10px]">(around cylinder)</span></th>
                      <th className="px-3 py-2.5 text-center whitespace-nowrap">Circumference<br/><span className="text-indigo-300 font-normal text-[10px]">= Repeat × {jobH}mm</span></th>
                      {stockSleeves.map(sw => (
                        <th key={sw} className="px-3 py-2.5 text-center whitespace-nowrap border-l border-indigo-600">
                          Sleeve {sw}mm<br/>
                          <span className="text-indigo-300 font-normal text-[10px]">AC UPS · Film · Total UPS</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {rows.map(row => (
                      <tr key={row.repeatUPS} className={row.repeatUPS % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                        <td className="px-3 py-2.5 font-bold text-indigo-700 text-sm">{row.repeatUPS}×</td>
                        <td className="px-3 py-2.5 text-center">
                          <span className="inline-block px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-sm border border-emerald-300">
                            {row.circ} mm
                          </span>
                        </td>
                        {row.sleeveResults.map((res, si) => (
                          <td key={si} className="px-3 py-2.5 text-center border-l border-gray-100">
                            {res ? (
                              <div className="space-y-0.5">
                                <div className="text-[10px] text-gray-500">{res.acUps} AC UPS · {res.filmW}mm film</div>
                                <div className="inline-block px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-bold text-[11px]">
                                  {res.totalUPS} total UPS
                                </div>
                              </div>
                            ) : (
                              <span className="text-gray-300 text-[10px]">—</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="text-[10px] text-gray-400">
                * AC UPS = how many lanes fit across the sleeve width. Total UPS = AC UPS × Repeat UPS. Cylinder print width must be ≥ film width + 100mm.
              </p>
            </div>
          </Modal>
        );
      })()}

      {/* ══ UPS LAYOUT PREVIEW MODAL ═════════════════════════════ */}
      {upsPreviewPlan && replanForm && (() => {
        const plan   = upsPreviewPlan as any;
        const jobW   = replanForm.actualWidth || replanForm.jobWidth || 0;
        const shrink = replanForm.widthShrinkage || 0;
        const trim   = replanForm.trimmingSize   || 0;
        const acUps  = plan.acUps as number;
        const filmW  = plan.filmSize as number;
        // pixel scaling: fit into ~640px canvas
        const CANVAS = 640;
        const scale  = filmW > 0 ? CANVAS / filmW : 1;
        const toW    = (mm: number) => Math.max(mm * scale, mm > 0 ? 2 : 0);
        // sections list for drawing — shrinkage is on repeat length (height), not width
        const sections: { label: string; mm: number; color: string; text: string }[] = [];
        if (trim > 0) sections.push({ label: `${trim}mm`, mm: trim, color: "#fed7aa", text: "#c2410c" });
        for (let i = 0; i < acUps; i++) {
          sections.push({ label: `${jobW}mm`, mm: jobW, color: "#e0e7ff", text: "#4338ca" });
        }
        if (trim > 0) sections.push({ label: `${trim}mm`, mm: trim, color: "#fed7aa", text: "#c2410c" });
        return (
          <Modal open onClose={() => setUpsPreviewPlan(null)} title="UPS Layout Design" size="xl">
            <div className="space-y-4">
              {/* Stats row */}
              <div className="flex flex-wrap gap-2 text-xs">
                {[
                  { l: "Film Width",  v: `${filmW} mm`,  cls: "bg-indigo-50 text-indigo-700 border-indigo-200" },
                  { l: "AC UPS",      v: String(acUps),   cls: "bg-purple-50 text-purple-700 border-purple-200" },
                  { l: "Job Width",   v: `${jobW} mm`,    cls: "bg-blue-50 text-blue-700 border-blue-200" },
                  { l: "Repeat Shrink", v: shrink > 0 ? `+${shrink} mm (on height)` : "—", cls: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200" },
                  { l: "Trimming",    v: trim > 0 ? `${trim} mm` : "—",      cls: "bg-orange-50 text-orange-700 border-orange-200" },
                  { l: "Repeat UPS",  v: String(plan.repeatUPS), cls: "bg-teal-50 text-teal-700 border-teal-200" },
                  { l: "Total UPS",   v: String(plan.totalUPS),  cls: "bg-green-50 text-green-700 border-green-200" },
                  { l: "Cylinder",    v: plan.cylinderCode,       cls: "bg-violet-50 text-violet-700 border-violet-200" },
                  { l: "Cyl. Circ",   v: `${plan.cylCirc} mm`,   cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
                ].map(s => (
                  <div key={s.l} className={`px-2.5 py-1.5 rounded-lg border font-medium ${s.cls}`}>
                    <span className="opacity-60 text-[10px] uppercase tracking-wider block leading-none mb-0.5">{s.l}</span>
                    <span className="font-bold">{s.v}</span>
                  </div>
                ))}
              </div>

              {/* Visual strip */}
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3">Film Web Cross-Section View (top view, not to scale)</p>
                <div className="flex items-stretch rounded-md overflow-hidden border border-gray-300 shadow" style={{ height: 56 }}>
                  {sections.map((sec, i) => (
                    <div key={i}
                      style={{ width: toW(sec.mm), background: sec.color, borderRight: i < sections.length - 1 ? "1px solid rgba(0,0,0,0.10)" : "none", flexShrink: 0 }}
                      className="flex flex-col items-center justify-center overflow-hidden relative group"
                      title={`${sec.label}`}>
                      {toW(sec.mm) > 18 && (
                        <span className="text-[8px] font-bold leading-none" style={{ color: sec.text, writingMode: "horizontal-tb" }}>{sec.label}</span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Bottom ruler */}
                <div className="flex mt-1" style={{ width: CANVAS }}>
                  <span className="text-[9px] text-gray-400">0</span>
                  <span className="flex-1 text-center text-[9px] text-gray-400">{Math.round(filmW / 2)} mm</span>
                  <span className="text-[9px] text-gray-400">{filmW} mm</span>
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-3 mt-3">
                  {[
                    { color: "#e0e7ff", border: "#6366f1", label: `Job Width (${jobW}mm × ${acUps} lanes)` },
                    ...(shrink > 0 ? [{ color: "#fae8ff", border: "#a21caf", label: `Repeat Shrinkage (+${shrink}mm on repeat length — does not affect film width)` }] : []),
                    ...(trim > 0   ? [{ color: "#fed7aa", border: "#c2410c", label: `Trimming (left ${trim}mm + right ${trim}mm = ${2 * trim}mm total)` }] : []),
                  ].map(l => (
                    <div key={l.label} className="flex items-center gap-1.5">
                      <div className="w-4 h-4 rounded border-2 flex-shrink-0" style={{ background: l.color, borderColor: l.border }} />
                      <span className="text-[11px] text-gray-600">{l.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Width (Film) Lane-by-Lane breakdown */}
              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Lane-by-Lane Breakdown — Width Direction</p>
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                  <table className="min-w-full text-xs">
                    <thead className="bg-gray-100">
                      <tr>
                        {["Position", "Type", "Width (mm)", "Color"].map(h => (
                          <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {trim > 0 && (
                        <tr><td className="px-3 py-1.5 text-gray-500">Left Bleed</td><td className="px-3 py-1.5"><span className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ background: "#fff7ed", color: "#c2410c" }}>Trim</span></td><td className="px-3 py-1.5 font-mono font-bold text-orange-600">{trim}</td><td className="px-3 py-1.5"><div className="w-5 h-3 rounded" style={{ background: "#fed7aa", border: "1px solid #c2410c" }} /></td></tr>
                      )}
                      {Array.from({ length: acUps }, (_, i) => (
                        <tr key={`lane-${i}`}>
                          <td className="px-3 py-1.5 text-gray-500">Lane {i + 1}</td>
                          <td className="px-3 py-1.5"><span className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ background: "#e0e7ff", color: "#4338ca" }}>Job Width</span></td>
                          <td className="px-3 py-1.5 font-mono font-bold text-indigo-600">{jobW}</td>
                          <td className="px-3 py-1.5"><div className="w-5 h-3 rounded" style={{ background: "#e0e7ff", border: "1px solid #6366f1" }} /></td>
                        </tr>
                      ))}
                      {trim > 0 && (
                        <tr><td className="px-3 py-1.5 text-gray-500">Right Bleed</td><td className="px-3 py-1.5"><span className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ background: "#fff7ed", color: "#c2410c" }}>Trim</span></td><td className="px-3 py-1.5 font-mono font-bold text-orange-600">{trim}</td><td className="px-3 py-1.5"><div className="w-5 h-3 rounded" style={{ background: "#fed7aa", border: "1px solid #c2410c" }} /></td></tr>
                      )}
                      {plan.deadMargin > 0 && (
                        <tr><td className="px-3 py-1.5 text-gray-400 italic">Dead Margin (Sleeve edge)</td><td className="px-3 py-1.5"><span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-500">Waste</span></td><td className="px-3 py-1.5 font-mono text-gray-400">{plan.deadMargin}</td><td className="px-3 py-1.5"><div className="w-5 h-3 rounded bg-gray-200 border border-gray-400" /></td></tr>
                      )}
                      <tr className="bg-indigo-50 font-bold border-t-2 border-indigo-200">
                        <td className="px-3 py-2 text-indigo-800" colSpan={2}>Total Film Width</td>
                        <td className="px-3 py-2 font-mono text-indigo-700">{filmW} mm</td>
                        <td />
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Repeat (Height) direction breakdown */}
              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Repeat UPS Breakdown — Height Direction</p>
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                  <table className="min-w-full text-xs">
                    <thead className="bg-gray-100">
                      <tr>
                        {["Component", "Value", "Note"].map(h => (
                          <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      <tr>
                        <td className="px-3 py-1.5 text-gray-600">Repeat Length</td>
                        <td className="px-3 py-1.5 font-mono font-bold text-indigo-700">{replanForm.jobHeight || 0} mm</td>
                        <td className="px-3 py-1.5 text-gray-400 text-[10px]">As entered in Basic Info</td>
                      </tr>
                      {shrink > 0 && (
                        <tr>
                          <td className="px-3 py-1.5 text-gray-600">+ Shrinkage (on height)</td>
                          <td className="px-3 py-1.5 font-mono font-bold text-fuchsia-600">+{shrink} mm</td>
                          <td className="px-3 py-1.5 text-gray-400 text-[10px]">Applied to repeat length only</td>
                        </tr>
                      )}
                      <tr className="bg-teal-50">
                        <td className="px-3 py-1.5 font-bold text-teal-800">= Effective Repeat</td>
                        <td className="px-3 py-1.5 font-mono font-bold text-teal-700">{(replanForm.jobHeight || 0) + shrink} mm</td>
                        <td className="px-3 py-1.5 text-teal-600 text-[10px]">Repeat Length + Shrinkage</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-1.5 text-gray-600">Cylinder Circumference</td>
                        <td className="px-3 py-1.5 font-mono font-bold text-emerald-700">{plan.cylCirc} mm</td>
                        <td className="px-3 py-1.5 text-gray-400 text-[10px]">{plan.cylinderCode} — {plan.cylinderName}</td>
                      </tr>
                      <tr className="bg-green-50 border-t-2 border-green-200">
                        <td className="px-3 py-2 font-bold text-green-800">÷ Repeat UPS</td>
                        <td className="px-3 py-2 font-mono font-bold text-green-700 text-sm">{plan.repeatUPS}×</td>
                        <td className="px-3 py-2 text-green-600 text-[10px]">{plan.cylCirc} ÷ {(replanForm.jobHeight || 0) + shrink} = {plan.repeatUPS} repeats per revolution</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </Modal>
        );
      })()}

      {/* ══ VIEW MODAL ════════════════════════════════════════════ */}
      {viewPlanRow && (
        <Modal open={!!viewPlanRow} onClose={() => setViewPlanRow(null)}
          title={`Planning Template — ${viewPlanRow.catalogNo}`} size="xl">
          <div className="mb-3 flex flex-wrap gap-2 text-xs">
            <span className="px-3 py-1 bg-purple-50 border border-purple-200 text-purple-700 rounded-full font-semibold flex items-center gap-1">
              <Lock size={10} />Locked Template
            </span>
            <span className="px-3 py-1 bg-gray-50 border border-gray-200 text-gray-600 rounded-full">{viewPlanRow.customerName}</span>
            <span className="px-3 py-1 bg-gray-50 border border-gray-200 text-gray-700 rounded-full font-medium">{viewPlanRow.productName}</span>
            <span className="px-3 py-1 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-full font-semibold">{viewPlanRow.noOfColors}C · {viewPlanRow.printType}</span>
            {viewPlanRow.machineName && (
              <span className="px-3 py-1 bg-blue-50 border border-blue-200 text-blue-700 rounded-full">{viewPlanRow.machineName}</span>
            )}
            {viewPlanRow.sourceOrderNo && (
              <span className="px-3 py-1 bg-teal-50 border border-teal-200 text-teal-700 rounded-full">Order: {viewPlanRow.sourceOrderNo}</span>
            )}
            {viewPlanRow.sourceWorkOrderNo && (
              <span className="px-3 py-1 bg-green-50 border border-green-200 text-green-700 rounded-full font-semibold">WO: {viewPlanRow.sourceWorkOrderNo}</span>
            )}
            {(viewPlanRow as any).packSize && <span className="px-3 py-1 bg-orange-50 border border-orange-200 text-orange-700 rounded-full">📦 {(viewPlanRow as any).packSize}</span>}
            {(viewPlanRow as any).brandName && <span className="px-3 py-1 bg-orange-50 border border-orange-200 text-orange-800 rounded-full font-semibold">{(viewPlanRow as any).brandName}</span>}
            {(viewPlanRow as any).productType && <span className="px-3 py-1 bg-amber-50 border border-amber-200 text-amber-700 rounded-full">{(viewPlanRow as any).productType}</span>}
            {(viewPlanRow as any).skuType && <span className="px-3 py-1 bg-amber-50 border border-amber-200 text-amber-800 rounded-full">{(viewPlanRow as any).skuType}</span>}
            {(viewPlanRow as any).bottleType && <span className="px-3 py-1 bg-sky-50 border border-sky-200 text-sky-700 rounded-full">{(viewPlanRow as any).bottleType}</span>}
            {(viewPlanRow as any).addressType && <span className="px-3 py-1 bg-sky-50 border border-sky-200 text-sky-700 rounded-full">{(viewPlanRow as any).addressType} Address</span>}
            {(viewPlanRow as any).artworkName  && <span className="px-3 py-1 bg-violet-50 border border-violet-200 text-violet-700 rounded-full font-semibold">🎨 {(viewPlanRow as any).artworkName}</span>}
            {(viewPlanRow as any).specialSpecs && <span className="px-3 py-1 bg-rose-50 border border-rose-200 text-rose-700 rounded-full font-semibold">★ {(viewPlanRow as any).specialSpecs}</span>}
          </div>

          {viewPlanRow.remarks && (
            <div className="mb-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-xs text-amber-800">
              <strong>Remarks:</strong> {viewPlanRow.remarks}
            </div>
          )}

          <div className="max-h-[65vh] overflow-y-auto pr-1">
            {viewPlanRow.secondaryLayers?.length > 0 || viewPlanRow.processes?.length > 0 ? (
              <PlanViewer plan={{
                title: "Product Catalog", refNo: viewPlanRow.catalogNo,
                jobWidth:    viewPlanRow.jobWidth,
                jobHeight:   viewPlanRow.jobHeight,
                quantity:    viewPlanRow.standardQty || 1000,
                unit:        viewPlanRow.standardUnit,
                noOfColors:  viewPlanRow.noOfColors,
                secondaryLayers:      viewPlanRow.secondaryLayers,
                processes:            viewPlanRow.processes,
                cylinderCostPerColor: viewPlanRow.cylinderCostPerColor,
                overheadPct: viewPlanRow.overheadPct,
                profitPct:   viewPlanRow.profitPct,
                trimmingSize: viewPlanRow.trimmingSize,
                frontColors:  viewPlanRow.frontColors,
                backColors:   viewPlanRow.backColors,
              } satisfies PlanInput} />
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Pill label="Substrate"   value={viewPlanRow.substrate || "—"}    cls="bg-indigo-50 text-indigo-700 border-indigo-200" />
                  <Pill label="Print Type"  value={viewPlanRow.printType || "—"}    cls="bg-purple-50 text-purple-700 border-purple-200" />
                  <Pill label="Colors"      value={`${viewPlanRow.noOfColors}C`}    cls="bg-blue-50 text-blue-700 border-blue-200" />
                  <Pill label="Machine"     value={viewPlanRow.machineName || "—"}  cls="bg-teal-50 text-teal-700 border-teal-200" />
                  <Pill label="Job Width"   value={`${viewPlanRow.jobWidth} mm`} />
                  <Pill label="Job Height"  value={`${viewPlanRow.jobHeight} mm`} />
                  <Pill label="Std Qty"     value={`${viewPlanRow.standardQty.toLocaleString()} ${viewPlanRow.standardUnit}`} />
                </div>
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-xs text-gray-500 text-center">
                  No ply / process detail available. Use Replan to add full planning.
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 mt-4">
            <Button icon={<RefreshCw size={14} />} variant="secondary"
              onClick={() => { setViewPlanRow(null); openReplan(viewPlanRow); }}>
              Replan
            </Button>
            <Button icon={<ArrowRight size={14} />} variant="secondary"
              onClick={() => window.location.href = "/gravure/orders"}>
              Use in Order
            </Button>
            <Button variant="secondary" onClick={() => setViewPlanRow(null)}>Close</Button>
          </div>
        </Modal>
      )}

      {/* ══ CATEGORY CHANGE CONFIRM ═══════════════════════════════ */}
      {pendingReplanCategoryId && (
        <Modal open={!!pendingReplanCategoryId} onClose={() => setPendingReplanCategoryId(null)} title="Replace Ply Configuration?" size="sm">
          <div className="space-y-3">
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
              Ply details already added. Selecting a new category will <strong>reset your current ply configuration</strong> with the new category&apos;s default plys.
            </div>
            <p className="text-sm text-gray-600">Do you want to replace the ply details with the selected category?</p>
            <div className="flex justify-end gap-3 mt-4">
              <Button variant="secondary" onClick={() => setPendingReplanCategoryId(null)}>No — Keep My Plys</Button>
              <Button onClick={() => { applyReplanCategory(pendingReplanCategoryId!); setPendingReplanCategoryId(null); }}>Yes — Reset Plys</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ══ DELETE CONFIRM ════════════════════════════════════════ */}
      {deleteId && (
        <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Catalog Item" size="sm">
          <p className="text-sm text-gray-600 mb-5">
            This catalog entry will be permanently deleted. The source order will move back to Pending.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="danger" onClick={() => { deleteCatalogItem(deleteId); setDeleteId(null); }}>Delete</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
