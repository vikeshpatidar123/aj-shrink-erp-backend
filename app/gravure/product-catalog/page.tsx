"use client";
import React, { useState, useMemo, useEffect } from "react";
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
const CYLINDER_TOOLS_ALL  = allTools.filter(t => t.toolType === "Cylinder");
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
  type CylinderAlloc   = { colorNo: number; colorName: string; cylinderNo: string; circumference: string; printWidth: string; repeatUPS: number; cylinderType: "New" | "Existing" | "Rechromed" | "Repeat"; status: "Pending" | "Available" | "In Use" | "Under Chrome" | "Ordered"; remarks: string; createdInMaster?: boolean; repeatUse?: boolean; };
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

  // ── Derive structureType from content sub-type ───────────
  // Sleeve: cylinder circ = layflat × 2, repeatUPS = 1
  // Pouch: standard planning, film width = pouch width as entered
  // Label/Roll Form/Laminate Roll: standard label planning
  const getStructureType = (content: string): "Label" | "Sleeve" | "Pouch" => {
    const c = content.toLowerCase();
    if (c.includes("sleeve")) return "Sleeve";
    if (
      c.includes("pouch") ||
      c.includes("standup") ||
      c === "zipper pouch"
    ) return "Pouch";
    return "Label";
  };

  const rf = <K extends keyof GravureProductCatalog>(k: K, v: GravureProductCatalog[K]) => {
    setReplanForm(p => {
      if (!p) return p;
      const next = { ...p, [k]: v };
      if (k === "frontColors" || k === "backColors") {
        next.noOfColors = ((k === "frontColors" ? v : p.frontColors) as number || 0) + ((k === "backColors" ? v : p.backColors) as number || 0);
      }
      // Auto-set structureType when content changes
      if (k === "content") {
        (next as any).structureType = getStructureType(v as string);
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
    const clone: PlyConsumableItem = { ...source, consumableId: Math.random().toString(), isClone: true };
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
    const sType  = (replanForm as any).structureType || "Label";
    // Material film width:
    //   Sleeve → film is the flat tube = jobWidth (layflat). Material area = qty × layflat.
    //   Pouch  → film width = jobWidth as entered (user enters the full film/pouch width).
    //   Label  → use actualWidth (trimming-corrected width).
    const filmWidthMm = sType === "Label" ? (replanForm.actualWidth || replanForm.jobWidth || 0) : (replanForm.jobWidth || 0);
    const widthM = filmWidthMm / 1000;
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
    const sTypeCheck = (replanForm as any)?.structureType || "Label";
    // For Sleeve, planWidth = layflat (jobWidth). For Label/Pouch, use actualWidth.
    const planWidth = sTypeCheck === "Sleeve"
      ? (replanForm?.jobWidth || 0)
      : (replanForm?.actualWidth || replanForm?.jobWidth || 0);
    if (!replanForm?.machineId || planWidth <= 0) return [];
    const machine = PRINT_MACHINES.find(m => m.id === replanForm.machineId);
    if (!machine) return [];

    const machineMaxFilm = parseFloat((machine as any).maxWebWidth) || 1300;
    const machineMinFilm = parseFloat((machine as any).minWebWidth) || 0;
    const machineMinCirc = parseFloat((machine as any).repeatLengthMin) || 0;
    const machineMaxCirc = parseFloat((machine as any).repeatLengthMax) || 9999;
    const shrink    = replanForm.widthShrinkage || 0;
    const trim      = replanForm.trimmingSize || 0;
    const sType     = (replanForm as any).structureType || "Label";
    const content   = (replanForm as any).content || "";
    const gusset    = (replanForm as any).gusset || 0;
    const topSeal   = (replanForm as any).topSeal    || 0;
    const bottomSeal= (replanForm as any).bottomSeal || 0;
    const sideSeal  = (replanForm as any).sideSeal   || 0;
    const ctrSeal   = (replanForm as any).centerSealWidth || 0;
    const sideGusset= (replanForm as any).sideGusset || 0;
    const jobW      = replanForm.jobWidth  || 0;
    const jobH      = replanForm.jobHeight || 0;

    // ── Lane width (film width per UPS lane) ──
    //    Sleeve            → layflat×2 + transparentArea + seamingArea
    //    3-Side Seal       → W + 2×sideSeal
    //    Center Seal       → W×2 + centerSealWidth  (W = half-width)
    //    Standup / Zipper  → W + 2×sideSeal
    //    Both Side Gusset  → W + 2×sideGusset
    //    3D / Flat Bottom  → W + 2×sideGusset
    //    Label / other     → actualWidth as-is
    const sleeveTransp = sType === "Sleeve" ? ((replanForm as any).transparentArea || 0) : 0;
    const sleeveSeam   = sType === "Sleeve" ? ((replanForm as any).seamingArea   || 0) : 0;
    let laneWidth: number;
    if (sType === "Sleeve") {
      laneWidth = jobW * 2 + sleeveTransp + sleeveSeam;
    } else if (content === "Pouch — 3 Side Seal" || content === "Standup Pouch" || content === "Zipper Pouch") {
      laneWidth = jobW + 2 * sideSeal;
    } else if (content === "Pouch — Center Seal") {
      laneWidth = jobW * 2 + ctrSeal;
    } else if (content === "Both Side Gusset Pouch" || content === "3D Pouch / Flat Bottom") {
      laneWidth = jobW + 2 * sideGusset;
    } else {
      laneWidth = planWidth;
    }
    if (laneWidth <= 0) laneWidth = planWidth > 0 ? planWidth : 1;

    // ── Effective repeat (cylinder circumference per repeat) ──
    //    Sleeve            → cuttingLength = jobHeight + shrink  (length direction)
    //    3-Side Seal       → H + topSeal + bottomSeal
    //    Center Seal       → H + topSeal + bottomSeal
    //    Standup / Zipper  → H + topSeal + gusset/2
    //    Both Side Gusset  → H + topSeal + bottomSeal
    //    3D / Flat Bottom  → H + topSeal + gusset/2
    //    Label             → jobHeight + shrink
    const designCirc      = jobW * 2 + sleeveSeam + sleeveTransp;  // Sleeve width direction only
    const sleeveCutLength = sType === "Sleeve" ? jobH + shrink : 0;
    let effectiveRepeat: number;
    if (sType === "Sleeve") {
      effectiveRepeat = sleeveCutLength;
    } else if (content === "Pouch — 3 Side Seal" || content === "Pouch — Center Seal" || content === "Both Side Gusset Pouch") {
      effectiveRepeat = jobH + topSeal + bottomSeal + shrink;
    } else if (content === "Standup Pouch" || content === "Zipper Pouch" || content === "3D Pouch / Flat Bottom") {
      effectiveRepeat = jobH + topSeal + (gusset > 0 ? gusset / 2 : 0) + shrink;
    } else {
      // Label / roll form / other
      effectiveRepeat = jobH + shrink;
    }

    // per-cylinder: UPS around = cylCirc / effectiveRepeat
    const calcRepeatUPS = (cylRepeatLength: number) => {
      if (effectiveRepeat <= 0) return 1;
      return Math.round(cylRepeatLength / effectiveRepeat);
    };

    // isValidCircumference:
    //   Sleeve → cylCirc must be exact multiple of designCirc (N×designCirc, N=1,2,3...)
    //            because multi-repeat is allowed (same sleeve image N times per revolution)
    //   Label / Pouch → exact multiple of effectiveRepeat (±0.5mm)
    const isValidCircumference = (cylCirc: number) => {
      if (cylCirc < machineMinCirc || cylCirc > machineMaxCirc) return false;
      if (sType === "Sleeve") {
        if (sleeveCutLength <= 0) return false;
        const rem = cylCirc % sleeveCutLength;
        return rem < 1 || (sleeveCutLength - rem) < 1; // exact multiple of cuttingLength ±1mm
      }
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
        // Special Order cylinders:
        //   Sleeve → only ONE valid circ = layflat × 2. No multiples.
        //   Label/Pouch → generate all valid multiples of effectiveRepeat.
        const specialCylinders = (() => {
          if (sType === "Sleeve") {
            // effectiveRepeat already = (jobWidth×2) + shrink
            if (effectiveRepeat < machineMinCirc || effectiveRepeat > machineMaxCirc) return [];
            return [{ id: "SPECIAL-CYL-SLEEVE", code: "SPL", name: `Special Order Sleeve Cyl (${effectiveRepeat}mm)`, printWidth: String(Math.ceil(minCyl)), repeatLength: String(effectiveRepeat), isSpecial: true, isSpecialSleeve: false }];
          }
          if (effectiveRepeat <= 0) return [{ id: "SPECIAL-CYL-1", code: "SPL", name: "Special Order", printWidth: String(Math.ceil(minCyl)), repeatLength: "450", isSpecial: true, isSpecialSleeve: false }];
          const results = [];
          for (let mult = 1; mult * effectiveRepeat <= machineMaxCirc; mult++) {
            const circ = mult * effectiveRepeat;
            if (circ < machineMinCirc) continue;
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
          const cylWidthV = parseFloat(cylinder.printWidth);
          // Cylinder must be at least sleeve + 100mm (50mm each side minimum)
          if (cylWidthV < sleeveWidthVal + 100) return [];
          // Cylinder width must be within machine width limits
          if (cylWidthV < machineMinFilm || cylWidthV > machineMaxFilm) return [];
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
            cylinderWidthVal: cylWidthV,
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
      // Cylinder width must be within machine width limits
      if (cylWidthVal < machineMinFilm || cylWidthVal > machineMaxFilm) return [];
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

    // ── LOOP S: SLEEVE products — no print sleeve needed, direct cylinder planning ──
    // Gravure shrink/stretch sleeves are printed flat. Film = layflat width.
    // designCirc = LF×2 + widthShrinkage  (circumferential shrinkage ONLY)
    // Sleeve cylinder circ = cuttingLength × N (N = 1, 2, 3...) — LENGTH direction
    //   cuttingLength = jobHeight + lengthShrinkage
    //   Must be within machine min/max circumference
    // UPS across = floor((machineMaxFilm - 2×trim) / laneWidth)
    const loopS = sType === "Sleeve" ? (() => {
      if (sleeveCutLength <= 0) return [];
      const maxAcUps = Math.floor((machineMaxFilm - 2 * trim) / laneWidth);
      if (maxAcUps === 0) return [];
      // Max repeat count: how many times cuttingLength fits inside machineMaxCirc
      const maxRepeatCount = Math.floor(machineMaxCirc / sleeveCutLength);
      if (maxRepeatCount === 0) return [];

      const plans: any[] = [];

      for (let repeatCount = 1; repeatCount <= maxRepeatCount; repeatCount++) {
        const cylinderCirc = sleeveCutLength * repeatCount;
        if (cylinderCirc < machineMinCirc) continue;  // below machine minimum — try next multiple
        if (cylinderCirc > machineMaxCirc) break;

        // Find real cylinders with circ ≈ cylinderCirc (±1mm)
        const realCyls = CYLINDER_TOOLS_ALL.filter(t => {
          const circ = parseFloat(t.repeatLength || "0") || 0;
          return Math.abs(circ - cylinderCirc) < 1;
        }).map(c => ({ id: c.id, code: c.code, name: c.name, printWidth: c.printWidth, repeatLength: c.repeatLength || String(cylinderCirc), isSpecial: false }));

        // Special order if no stock cylinder matches
        const specialCyl = { id: `SPECIAL-CYL-SLEEVE-R${repeatCount}`, code: "SPL", name: `Special Order (${cylinderCirc}mm = ${sleeveCutLength}×${repeatCount})`, printWidth: "1500", repeatLength: String(cylinderCirc), isSpecial: true };
        const cylList = realCyls.length > 0 ? realCyls : [specialCyl];

        for (let acUps = 1; acUps <= maxAcUps; acUps++) {
          const printingWidth = acUps * laneWidth;
          const filmWidth = printingWidth + 2 * trim; // trim both sides of film
          if (filmWidth > machineMaxFilm) break;
          if (filmWidth < machineMinFilm) continue;
          const deadMargin = parseFloat((machineMaxFilm - filmWidth).toFixed(1));

          for (const cyl of cylList) {
            const reqRMT  = replanForm.standardQty > 0 ? Math.ceil(replanForm.standardQty / (acUps * repeatCount)) : 1;
            const totalRMT = Math.ceil(reqRMT * 1.01);
            plans.push({
              planId: `SLEEVE-${machine.id}-R${repeatCount}-${acUps}UPS-${cyl.id}`,
              machineName: machine.name,
              filmSize: filmWidth, acUps, printingWidth,
              sleeveCode: "—", sleeveName: "No Print Sleeve Required", sleeveWidthVal: filmWidth,
              cylinderCode: cyl.code, cylinderName: cyl.name,
              cylinderWidthVal: parseFloat(cyl.printWidth) || 0,
              sideWaste: 0, deadMargin, totalWaste: deadMargin,
              cylCirc: cylinderCirc, repeatUPS: repeatCount, totalUPS: acUps * repeatCount,
              reqRMT, totalRMT, wastage: deadMargin,
              isSpecial: cyl.isSpecial, isSpecialSleeve: false, isBest: false,
              designCirc, sleeveCutLength, repeatCount,   // carry for UI display
            });
          }
        }
      }
      return plans;
    })() : [];

    // For Sleeve: only use loopS. For Label/Pouch: use loopA + loopB.
    const rawPlans = sType === "Sleeve" ? loopS : [...loopA, ...loopB];

    if (rawPlans.length === 0) return rawPlans;
    const sorted = [...rawPlans].sort((a, b) =>
      a.totalWaste  !== b.totalWaste  ? a.totalWaste  - b.totalWaste  :
      a.deadMargin  !== b.deadMargin  ? a.deadMargin  - b.deadMargin  :
      a.sideWaste   !== b.sideWaste   ? a.sideWaste   - b.sideWaste   :
      b.acUps       !== a.acUps       ? b.acUps        - a.acUps       : 0
    );
    return sorted.map((p, idx) => ({ ...p, isBest: !p.isSpecial && idx === 0 }));
  }, [replanForm?.machineId, replanForm?.actualWidth, replanForm?.jobWidth, replanForm?.jobHeight, replanForm?.trimmingSize, replanForm?.widthShrinkage, replanForm?.standardQty, (replanForm as any)?.structureType, (replanForm as any)?.content, (replanForm as any)?.gusset, (replanForm as any)?.sealSize, (replanForm as any)?.seamingArea, (replanForm as any)?.transparentArea, (replanForm as any)?.topSeal, (replanForm as any)?.bottomSeal, (replanForm as any)?.sideSeal, (replanForm as any)?.centerSealWidth, (replanForm as any)?.sideGusset]); // eslint-disable-line react-hooks/exhaustive-deps

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

    // Standard LAB lookup by colour name
    const COLOR_LAB: Record<string, { l: string; a: string; b: string }> = {
      "Red":     { l: "41.0",  a: "54.2",  b: "38.1"  },
      "Yellow":  { l: "89.3",  a: "-6.1",  b: "80.4"  },
      "Blue":    { l: "25.1",  a: "23.4",  b: "-52.8" },
      "Black":   { l: "16.0",  a: "0.1",   b: "0.0"   },
      "White":   { l: "95.2",  a: "-1.0",  b: "2.3"   },
      "Green":   { l: "46.3",  a: "-50.2", b: "30.1"  },
      "Cyan":    { l: "60.1",  a: "-38.2", b: "-31.4" },
      "Magenta": { l: "48.2",  a: "72.1",  b: "-10.3" },
      "Orange":  { l: "65.4",  a: "43.1",  b: "65.2"  },
      "Violet":  { l: "30.2",  a: "40.1",  b: "-42.3" },
    };

    // Collect all ink consumable items from all plies (in order, deduplicated by itemId)
    const seen = new Set<string>();
    const plyInks: { itemId: string; itemName: string; colour: string; pantoneNo: string }[] = [];
    (rf.secondaryLayers || []).forEach(l => {
      l.consumableItems.filter(ci => ci.itemGroup === "Ink").forEach(ci => {
        if (!seen.has(ci.itemId)) {
          seen.add(ci.itemId);
          const master = items.find(it => it.id === ci.itemId);
          plyInks.push({
            itemId:    ci.itemId,
            itemName:  ci.itemName || master?.name || "",
            colour:    master?.colour || "",
            pantoneNo: master?.pantoneNo || "",
          });
        }
      });
    });

    setCatalogColorShades(Array.from({ length: n }, (_, i) => {
      const ink    = plyInks[i];
      const lab    = ink ? (COLOR_LAB[ink.colour] ?? { l: "", a: "", b: "" }) : { l: "", a: "", b: "" };
      const PROCESS_COLOURS = new Set(["Cyan","Magenta","Yellow","Black"]);
      const autoType: "Spot" | "Process" | "Special" = ink?.colour && PROCESS_COLOURS.has(ink.colour) ? "Process" : "Spot";
      return {
        colorNo:      i + 1,
        colorName:    ink ? (ink.colour || ink.itemName || `Color ${i + 1}`) : `Color ${i + 1}`,
        inkType:      ink ? autoType : "Spot" as const,
        pantoneRef:   ink?.pantoneNo ?? "",
        labL: lab.l,  labA: lab.a,  labB: lab.b,
        actualL: "", actualA: "", actualB: "",
        deltaE: "1.0",
        shadeCardRef: "",
        status: "Pending" as const,
        remarks: "",
        ...(ink ? { inkItemId: ink.itemId } : {}),
      } as any;
    }));
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
    const planCirc      = replanSelectedPlan ? String(replanSelectedPlan.cylCirc)  : "";
    const planRepeatUPS = replanSelectedPlan ? (replanSelectedPlan.repeatUPS as number) : 1;
    const planCylCode   = replanSelectedPlan ? ((replanSelectedPlan as any).cylinderCode ?? "") : "";
    const planCylWidth  = replanSelectedPlan ? String((replanSelectedPlan as any).cylinderWidthVal ?? "") : "";
    const isSpecialPlan = replanSelectedPlan ? !!(replanSelectedPlan as any).isSpecial : false;
    setCatalogCylAllocs(Array.from({ length: n }, (_, i) => ({
      colorNo: i + 1,
      colorName: `Color ${i + 1}`,
      cylinderNo: isSpecialPlan ? `SPL-C${String(i + 1).padStart(2, "0")}` : planCylCode ? `${planCylCode}-C${String(i + 1).padStart(2, "0")}` : "",
      circumference: planCirc,
      printWidth: planCylWidth,
      repeatUPS: planRepeatUPS,
      cylinderType: (isSpecialPlan ? "New" : "Existing") as CylinderAlloc["cylinderType"],
      status: "Pending" as const,
      remarks: "",
      createdInMaster: false,
    })));
  };

  // ── Auto-sync Color Shade + Cylinder rows whenever inks change in consumables ──
  useEffect(() => {
    if (!replanOpen || !replanForm) return;

    const COLOR_LAB: Record<string, { l: string; a: string; b: string }> = {
      "Red":     { l: "41.0",  a: "54.2",  b: "38.1"  },
      "Yellow":  { l: "89.3",  a: "-6.1",  b: "80.4"  },
      "Blue":    { l: "25.1",  a: "23.4",  b: "-52.8" },
      "Black":   { l: "16.0",  a: "0.1",   b: "0.0"   },
      "White":   { l: "95.2",  a: "-1.0",  b: "2.3"   },
      "Green":   { l: "46.3",  a: "-50.2", b: "30.1"  },
      "Cyan":    { l: "60.1",  a: "-38.2", b: "-31.4" },
      "Magenta": { l: "48.2",  a: "72.1",  b: "-10.3" },
      "Orange":  { l: "65.4",  a: "43.1",  b: "65.2"  },
      "Violet":  { l: "30.2",  a: "40.1",  b: "-42.3" },
    };
    const PROCESS_COLOURS = new Set(["Cyan", "Magenta", "Yellow", "Black"]);

    // Build ordered ink list from all plies (consumableId = stable key)
    const inkList = replanForm.secondaryLayers.flatMap(l =>
      l.consumableItems
        .filter(ci => ci.itemGroup === "Ink")
        .map(ci => {
          const master = items.find(it => it.id === ci.itemId);
          return {
            consumableId: ci.consumableId,
            inkItemId: ci.itemId ?? "",
            inkName: ci.itemName || master?.name || "",
            colour: (master as any)?.colour || "",
            pantoneNo: (master as any)?.pantoneNo || "",
          };
        })
    );

    // Sync Color Shades — preserve user-entered LAB/remarks for existing rows
    setCatalogColorShades(prev => inkList.map((ink, i) => {
      const existing = prev.find(c => (c as any).consumableId === ink.consumableId);
      if (existing) return { ...existing, colorNo: i + 1 };
      const lab = ink.colour ? (COLOR_LAB[ink.colour] ?? { l: "", a: "", b: "" }) : { l: "", a: "", b: "" };
      const autoType: "Spot" | "Process" | "Special" = ink.colour && PROCESS_COLOURS.has(ink.colour) ? "Process" : "Spot";
      return {
        colorNo: i + 1,
        colorName: ink.colour || ink.inkName || `Color ${i + 1}`,
        inkType: autoType,
        pantoneRef: ink.pantoneNo,
        labL: lab.l, labA: lab.a, labB: lab.b,
        actualL: "", actualA: "", actualB: "",
        deltaE: "1.0", shadeCardRef: "", status: "Pending" as const, remarks: "",
        consumableId: ink.consumableId, inkItemId: ink.inkItemId,
      } as any;
    }));

    // Sync Cylinder Allocs — preserve user-entered data for existing rows
    const planCirc      = replanSelectedPlan ? String(replanSelectedPlan.cylCirc) : "";
    const planCylCode   = replanSelectedPlan ? ((replanSelectedPlan as any).cylinderCode ?? "") : "";
    const planCylWidth  = replanSelectedPlan ? String((replanSelectedPlan as any).cylinderWidthVal ?? "") : "";
    const planRepeatUPS = replanSelectedPlan ? (replanSelectedPlan.repeatUPS as number) : 1;
    const isSpecialPlan = replanSelectedPlan ? !!(replanSelectedPlan as any).isSpecial : false;

    setCatalogCylAllocs(prev => inkList.map((ink, i) => {
      const existing = prev.find(c => (c as any).consumableId === ink.consumableId);
      if (existing) return { ...existing, colorNo: i + 1, colorName: ink.colour || ink.inkName || existing.colorName };
      return {
        colorNo: i + 1,
        colorName: ink.colour || ink.inkName || `Color ${i + 1}`,
        cylinderNo: isSpecialPlan
          ? `SPL-C${String(i + 1).padStart(2, "0")}`
          : planCylCode ? `${planCylCode}-C${String(i + 1).padStart(2, "0")}` : "",
        circumference: planCirc, printWidth: planCylWidth, repeatUPS: planRepeatUPS,
        cylinderType: (isSpecialPlan ? "New" : "Existing") as CylinderAlloc["cylinderType"],
        status: "Pending" as const, remarks: "", createdInMaster: false,
        consumableId: ink.consumableId,
      } as any;
    }));

    // Keep noOfColors in sync with actual ink count
    if (inkList.length !== replanForm.noOfColors) {
      setReplanForm(p => p ? { ...p, noOfColors: inkList.length } : p);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replanForm?.secondaryLayers, replanOpen, replanSelectedPlan]);

  const openReplan = (row: GravureProductCatalog) => {
    setIsNewCatalog(false);
    setReplanForm({ ...row });
    setReplanTab("info");
    setCatalogFilmReqs([]); setCatalogColorShades([]); setCatalogMatAllocs([]); setCatalogCylAllocs([]); setCatalogPrepTab("shade");
    setReplanSelPlanId(""); setReplanShowPlan(false); setReplanIsPlanApplied(false); setReplanPlanSearch(""); setReplanPlanSort({ key: "", dir: "asc" }); setReplanAttachments([]);
    setReplanOpen(true);
  };

  // ── Open Cylinder Master — passes data via localStorage then navigates ──
  const openCylinderMaster = () => {
    if (!replanForm) return;
    const _cn = replanForm.catalogNo || replanForm.id || "";
    const _m  = _cn.match(/(\d+)$/);
    const _pCode = _m ? `P${_m[1].padStart(4, "0")}` : _cn;
    const _sp = replanSelectedPlan as any;
    const prefillData = {
      productCode:    _pCode,
      productName:    replanForm.productName,
      customerName:   replanForm.customerName,
      noOfColors:     replanForm.noOfColors,
      circumference:  _sp ? String(_sp.cylCirc ?? "") : String(replanForm.jobHeight || ""),
      printWidth:     _sp ? String(_sp.cylinderWidthVal ?? "") : String(replanForm.jobWidth || ""),
      repeatUPS:      _sp ? (_sp.repeatUPS as number) : 1,
      // full plan details
      totalUPS:       _sp ? (_sp.totalUPS as number) : undefined,
      filmSize:       _sp ? String(_sp.filmSize ?? "") : undefined,
      totalWaste:     _sp ? String(_sp.totalWaste ?? "") : undefined,
      sleeveCode:     _sp ? String(_sp.sleeveCode ?? "") : undefined,
      sleeveWidth:    _sp ? String(_sp.sleeveWidthVal ?? "") : undefined,
      acUps:          _sp ? (_sp.acUps as number) : undefined,
      printingWidth:  _sp ? String(_sp.printingWidth ?? _sp.cylinderWidthVal ?? "") : undefined,
      isSpecial:      _sp ? !!_sp.isSpecial : undefined,
      categoryName:   replanForm.categoryName || "",
      jobWidth:       String(replanForm.jobWidth || ""),
      jobHeight:      String(replanForm.jobHeight || ""),
      colors:        catalogCylAllocs
                       .filter(c => !c.repeatUse)
                       .map((c, i) => {
                         const origIdx = catalogCylAllocs.indexOf(c);
                         return catalogColorShades[origIdx]?.colorName || c.colorName || `Color ${origIdx + 1}`;
                       }),
    };
    if (prefillData.colors.length === 0) {
      alert("All colors are marked as Repeat Use — nothing to create in master.");
      return;
    }
    prefillData.noOfColors = prefillData.colors.length;
    localStorage.setItem("ajsw_cylinder_prefill", JSON.stringify(prefillData));
    window.open("/masters/tools/create-cylinders", "_blank");
  };

  // ── Refresh cylinder codes/status from what was saved in Cylinder Master ──
  const refreshFromCylinderMaster = () => {
    if (!replanForm) return;
    const _rcn = replanForm.catalogNo || replanForm.id || "";
    const _rm  = _rcn.match(/(\d+)$/);
    const productCode = _rm ? `P${_rm[1].padStart(4, "0")}` : _rcn;
    try {
      const created: any[] = JSON.parse(localStorage.getItem("ajsw_cylinders_created") || "[]");
      const matching = created.filter(c => c.productCode === productCode);
      if (matching.length === 0) return;
      setCatalogCylAllocs(p => p.map((alloc) => {
        const match = matching.find((m: any) => m.colorNo === alloc.colorNo);
        if (!match) return alloc;
        return {
          ...alloc,
          cylinderNo:    match.cylinderCode || alloc.cylinderNo,
          status:        (match.status === "Available" ? "Available"
                          : match.status === "Ordered" ? "Ordered"
                          : alloc.status) as typeof alloc.status,
          createdInMaster: true,
        };
      }));
    } catch { /* ignore */ }
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
      ...(replanSelPlanId && { savedPlanId: replanSelPlanId }),
      ...(catalogColorShades.length > 0 && { savedColorShades: catalogColorShades }),
      ...(catalogCylAllocs.length > 0 && { savedCylAllocs: catalogCylAllocs }),
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
            <div>
              <p className={`text-[10px] uppercase font-semibold ${isNewCatalog ? "text-teal-500" : "text-purple-500"}`}>Product</p>
              <p className={`font-bold ${isNewCatalog ? "text-teal-800" : "text-purple-800"}`}>{replanForm.productName || "—"}</p>
              {(() => {
                const _hcn = replanForm.catalogNo || "";
                const _hm  = _hcn.match(/(\d+)$/);
                const _hpc = _hm ? `P${_hm[1].padStart(4, "0")}` : "";
                return _hpc ? (
                  <span className="inline-block mt-0.5 px-2 py-0.5 bg-teal-600 text-white text-[10px] font-mono font-bold rounded-full tracking-wide">
                    {_hpc}
                  </span>
                ) : null;
              })()}
            </div>
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
                        <select className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-orange-400"
                          value={(replanForm as any).packSize ?? ""}
                          onChange={e => rf("packSize" as any, e.target.value)}>
                          <option value="">-- Select --</option>
                          {((customers.find(c => c.id === replanForm.customerId) as any)?.packSizes ?? []).map((ps: string) => (
                            <option key={ps} value={ps}>{ps}</option>
                          ))}
                          {(replanForm as any).packSize && !((customers.find(c => c.id === replanForm.customerId) as any)?.packSizes ?? []).includes((replanForm as any).packSize) && (
                            <option value={(replanForm as any).packSize}>{(replanForm as any).packSize}</option>
                          )}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-gray-400 uppercase block mb-1">Brand Name</label>
                        <select className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-orange-400"
                          value={(replanForm as any).brandName ?? ""}
                          onChange={e => rf("brandName" as any, e.target.value)}>
                          <option value="">-- Select --</option>
                          {((customers.find(c => c.id === replanForm.customerId) as any)?.brandNames ?? []).map((bn: string) => (
                            <option key={bn} value={bn}>{bn}</option>
                          ))}
                          {(replanForm as any).brandName && !((customers.find(c => c.id === replanForm.customerId) as any)?.brandNames ?? []).includes((replanForm as any).brandName) && (
                            <option value={(replanForm as any).brandName}>{(replanForm as any).brandName}</option>
                          )}
                        </select>
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
                        <select className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-orange-400"
                          value={(replanForm as any).skuType ?? ""}
                          onChange={e => rf("skuType" as any, e.target.value)}>
                          <option value="">-- Select --</option>
                          {((customers.find(c => c.id === replanForm.customerId) as any)?.skuTypes ?? []).map((sk: string) => (
                            <option key={sk} value={sk}>{sk}</option>
                          ))}
                          {(replanForm as any).skuType && !((customers.find(c => c.id === replanForm.customerId) as any)?.skuTypes ?? []).includes((replanForm as any).skuType) && (
                            <option value={(replanForm as any).skuType}>{(replanForm as any).skuType}</option>
                          )}
                        </select>
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
                          <option value="QR Code">QR Code</option>
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

                      {/* ── Final Roll OD ── */}
                      <div>
                        <label className="text-[10px] font-semibold text-teal-600 uppercase block mb-1">Final Roll OD (mm)</label>
                        <input
                          type="number" min={0} placeholder="e.g. 200"
                          className="w-full text-sm border border-teal-200 rounded-xl px-3 py-2 bg-teal-50 focus:bg-white outline-none focus:ring-2 focus:ring-teal-400 font-mono"
                          value={(replanForm as any).finalRollOD ?? ""}
                          onChange={e => rf("finalRollOD" as any, Number(e.target.value) || undefined)}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-teal-600 uppercase block mb-1">Roll Qty Unit</label>
                        <div className="flex gap-2 mt-0.5">
                          {(["Meter", "KG"] as const).map(u => (
                            <button key={u} type="button"
                              onClick={() => rf("rollUnit" as any, u)}
                              className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-all ${
                                ((replanForm as any).rollUnit ?? "Meter") === u
                                  ? "bg-teal-600 text-white border-teal-600 shadow-sm"
                                  : "bg-white text-gray-600 border-gray-200 hover:border-teal-400 hover:text-teal-700"
                              }`}>
                              {u}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-gray-400 uppercase block mb-1">Print Type</label>
                        <select className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-purple-400"
                          value={replanForm.printType}
                          onChange={e => rf("printType", e.target.value as GravureProductCatalog["printType"])}>
                          <option value="Surface Print">Surface Print</option>
                          <option value="Reverse Print">Reverse Print</option>
                          <option value="Combination">Combination</option>
                        </select>
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
                                    + Name
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

                </div>

                {/* ── Dimension Input + Live Diagram — appears only after Content Type is selected ── */}
                {replanForm.content && CONTENT_TYPE_CONFIG[replanForm.content] && (
                  <div className="border border-indigo-200 rounded-2xl overflow-hidden">
                    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2.5 flex items-center gap-2">
                      <Calculator size={14} className="text-white" />
                      <p className="text-xs font-bold text-white uppercase tracking-widest">Dimension Setup — {replanForm.content}</p>
                    </div>

                    {/* ── Sleeve / Pouch extra fields — auto-shown by content type ── */}
                    {(() => {
                      const sType = (replanForm as any).structureType || getStructureType(replanForm.content);
                      if (sType === "Label") return null;
                      return (
                        <div className="px-4 pt-3 pb-0">
                          {sType === "Pouch" && (
                            <div className="flex flex-wrap items-center gap-3 p-3 bg-orange-50 border border-orange-200 rounded-xl text-[10px]">
                              <div className="flex items-center gap-1.5 text-orange-700 font-bold uppercase tracking-wide">
                                <Package size={12} /> Pouch Specs
                              </div>
                              {/* Planning info */}
                              <div className="ml-auto flex gap-2 flex-wrap">
                                <div className="px-3 py-1.5 bg-white border border-orange-200 rounded-lg font-bold text-orange-700">
                                  Lane = {replanForm.jobWidth} mm
                                </div>
                                <div className="px-3 py-1.5 bg-white border border-orange-200 rounded-lg text-orange-600">
                                  Repeat = {replanForm.jobHeight} mm
                                </div>
                              </div>
                            </div>
                          )}
                          {sType === "Sleeve" && (
                            <div className="flex flex-wrap items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl text-[10px]">
                              <div className="flex items-center gap-1.5 text-blue-700 font-bold uppercase tracking-wide">
                                <Layers size={12} /> Sleeve Planning
                              </div>
                              <div className="px-3 py-1.5 bg-white border border-blue-200 rounded-lg font-bold text-blue-700">
                                Layflat = {replanForm.jobWidth} mm
                              </div>
                              {(() => {
                                const lf = replanForm.jobWidth || 0;
                                const sh = replanForm.widthShrinkage || 0;
                                const sa = (replanForm as any).seamingArea     || 0;
                                const ta = (replanForm as any).transparentArea || 0;
                                const dc = lf * 2 + sa + ta; // width direction only
                                const parts: string[] = [`${lf}×2`];
                                if (ta > 0) parts.push(`+${ta}`);
                                if (sa > 0) parts.push(`+${sa}`);
                                return (
                                  <>
                                    <div className="flex flex-col px-3 py-1.5 bg-blue-600 text-white rounded-lg font-bold text-[10px] leading-tight">
                                      <span>Design Circ (per sleeve)</span>
                                      <span className="text-xs font-black">{parts.join("")} = {dc} mm</span>
                                    </div>
                                    <div className="px-3 py-1.5 bg-white border border-blue-200 rounded-lg text-blue-600">
                                      Cutting Length = {replanForm.jobHeight} mm
                                    </div>
                                    <div className="flex flex-col px-3 py-1.5 bg-amber-50 border border-amber-300 rounded-lg text-amber-700 font-bold ml-auto text-[10px] leading-tight">
                                      <span>Cylinder Circ</span>
                                      <span>{sh > 0 ? `(${replanForm.jobHeight}+${sh})` : `${replanForm.jobHeight}`}mm × N (N=1,2,3…)</span>
                                      <span className="font-normal text-amber-600">Shrink applied per sleeve</span>
                                    </div>
                                  </>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Left: inputs */}
                      <div className="space-y-4">
                        <div>
                          <p className="text-[10px] font-semibold text-indigo-500 uppercase tracking-widest mb-2">Packaging Dimensions</p>
                          <DimensionInputPanel
                            contentType={replanForm.content}
                            dims={dimValues}
                            colClasses={
                              replanForm.content === "Sleeve — Shrink" || replanForm.content === "Sleeve — Stretch"
                                ? "grid-cols-2"
                                : undefined
                            }
                            onChange={patch => {
                              patchDim(patch);
                              if ("width"        in patch && patch.width        !== undefined) { rf("jobWidth",  patch.width); rf("actualWidth", patch.width); }
                              if ("layflatWidth"  in patch && patch.layflatWidth !== undefined) { rf("jobWidth",  patch.layflatWidth); rf("actualWidth", patch.layflatWidth); }
                              if ("height"       in patch && patch.height       !== undefined) rf("jobHeight", patch.height);
                              if ("cutHeight"    in patch && patch.cutHeight    !== undefined) rf("jobHeight", patch.cutHeight);
                              // Sync gusset, sealWidth, seamingArea, transparentArea into replanForm
                              if ("gusset"          in patch && patch.gusset          !== undefined) rf("gusset"          as any, patch.gusset);
                              if ("sealWidth"       in patch && patch.sealWidth       !== undefined) rf("sealSize"        as any, patch.sealWidth);
                              if ("seamingArea"     in patch && patch.seamingArea     !== undefined) rf("seamingArea"     as any, patch.seamingArea);
                              if ("transparentArea" in patch && patch.transparentArea !== undefined) rf("transparentArea" as any, patch.transparentArea);
                              if ("topSeal"         in patch && patch.topSeal         !== undefined) rf("topSeal"         as any, patch.topSeal);
                              if ("bottomSeal"      in patch && patch.bottomSeal      !== undefined) rf("bottomSeal"      as any, patch.bottomSeal);
                              if ("sideSeal"        in patch && patch.sideSeal        !== undefined) rf("sideSeal"        as any, patch.sideSeal);
                              if ("centerSealWidth" in patch && patch.centerSealWidth !== undefined) rf("centerSealWidth" as any, patch.centerSealWidth);
                              if ("sideGusset"      in patch && patch.sideGusset      !== undefined) rf("sideGusset"      as any, patch.sideGusset);
                            }}
                          />
                        </div>
                        {/* Shrinkage — label differs by structure type */}
                        <div>
                          {(() => {
                            const st = (replanForm as any).structureType || getStructureType(replanForm.content);
                            return (
                              <>
                                <label className="text-[10px] font-semibold text-rose-500 uppercase block mb-1">
                                  {st === "Sleeve"
                                    ? <>Length Shrinkage (mm) <span className="normal-case text-gray-400 font-normal">— applied to cutting length per sleeve</span></>
                                    : <>Repeat Length Shrinkage (mm) <span className="normal-case text-gray-400 font-normal">— optional</span></>}
                                </label>
                                <input
                                  type="number" min={0} max={st === "Sleeve" ? 10 : 1.5} step={0.1}
                                  placeholder={st === "Sleeve" ? "e.g. 3" : "e.g. 1"}
                                  value={dimValues.widthShrinkage ?? replanForm.widthShrinkage ?? ""}
                                  onChange={e => { const v = Math.min(st === "Sleeve" ? 10 : 1.5, Math.max(0, Number(e.target.value) || 0)); patchDim({ widthShrinkage: v }); rf("widthShrinkage", v || undefined); }}
                                  className="w-full text-sm border border-rose-200 rounded-xl px-3 py-2 bg-rose-50 focus:bg-white outline-none focus:ring-2 focus:ring-rose-400 font-mono"
                                />
                                {st === "Sleeve" && (replanForm.jobWidth || 0) > 0 && (
                                  <p className="text-[10px] text-rose-600 mt-1 font-semibold">
                                    {(() => {
                                      const lf = replanForm.jobWidth || 0;
                                      const sh = replanForm.widthShrinkage || 0;
                                      const sa = (replanForm as any).seamingArea     || 0;
                                      const ta = (replanForm as any).transparentArea || 0;
                                      const dc = lf * 2 + sa + ta; // width direction only
                                      const parts: string[] = [`${lf}×2`];
                                      if (ta > 0) parts.push(`+${ta}`);
                                      if (sa > 0) parts.push(`+${sa}`);
                                      const shrinkNote = sh > 0 ? ` | Length shrinkage +${sh}mm` : "";
                                      return `Design Circ = ${parts.join("")} = ${dc}mm (per sleeve)${shrinkNote}`;
                                    })()}
                                  </p>
                                )}
                              </>
                            );
                          })()}
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
                        {/* ── Unwind Direction (Pifa) — AJSW Printing & Winding Design Chart ── */}
                        <div className="border-t border-indigo-100 pt-3">
                          <div className="flex items-center gap-2 mb-3">
                            <p className="text-[10px] font-semibold text-orange-500 uppercase tracking-widest">Unwind Direction (Pifa)</p>
                            <span className="text-[9px] text-gray-400">As per AJSW Printing &amp; Winding Chart</span>
                          </div>
                          {/* ── All 8 directions in 4+4 grid ── */}
                          <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Printed ACROSS the Roll</p>
                          <div className="grid grid-cols-4 gap-2 mb-3">
                            {([
                              { n: 1, label: "Outside · Across\nTop off first",
                                svg: (
                                  <svg width="84" height="72" viewBox="0 0 84 72">
                                    {/* paper label - flat, coming off roll on right */}
                                    <path d="M4,10 Q10,8 16,10 Q22,12 28,10 Q34,8 40,10 L40,52 L4,52 Z" fill="white" stroke="#111" strokeWidth="1.2"/>
                                    {/* bottom line = underline */}
                                    <line x1="4" y1="50" x2="40" y2="50" stroke="#444" strokeWidth="0.8"/>
                                    {/* normal text */}
                                    <text x="22" y="23" textAnchor="middle" fontFamily="serif" fontSize="7.5" fontStyle="italic" fontWeight="bold" fill="#111">PRINTING</text>
                                    <text x="22" y="33" textAnchor="middle" fontFamily="serif" fontSize="6.5" fontStyle="italic" fill="#222">READS</text>
                                    <text x="22" y="42" textAnchor="middle" fontFamily="serif" fontSize="6.5" fontStyle="italic" fill="#222">This Way</text>
                                    {/* roll circle - side view, on right */}
                                    <circle cx="64" cy="34" r="16" fill="#d8d8d8" stroke="#111" strokeWidth="1.3"/>
                                    <circle cx="64" cy="34" r="5" fill="#aaa" stroke="#555" strokeWidth="1"/>
                                    {/* paper tangent lines connecting to roll */}
                                    <line x1="40" y1="10" x2="49" y2="19" stroke="#111" strokeWidth="1.1"/>
                                    <line x1="40" y1="52" x2="49" y2="50" stroke="#111" strokeWidth="1.1"/>
                                    {/* TOP off first — bold arrow UP-RIGHT */}
                                    <line x1="22" y1="10" x2="32" y2="2" stroke="#111" strokeWidth="2.2"/>
                                    <polygon points="34,0 26,4 30,12" fill="#111"/>
                                  </svg>
                                )},
                              { n: 2, label: "Inside · Across\nTop off first",
                                svg: (
                                  <svg width="84" height="72" viewBox="0 0 84 72">
                                    {/* Inside: roll on RIGHT, text UPSIDE DOWN */}
                                    <path d="M4,10 Q10,8 16,10 Q22,12 28,10 Q34,8 40,10 L40,52 L4,52 Z" fill="white" stroke="#111" strokeWidth="1.2"/>
                                    <line x1="4" y1="50" x2="40" y2="50" stroke="#444" strokeWidth="0.8"/>
                                    <text x="22" y="23" textAnchor="middle" fontFamily="serif" fontSize="7.5" fontStyle="italic" fontWeight="bold" fill="#111" transform="rotate(180,22,23)">PRINTING</text>
                                    <text x="22" y="33" textAnchor="middle" fontFamily="serif" fontSize="6.5" fontStyle="italic" fill="#222" transform="rotate(180,22,33)">READS</text>
                                    <text x="22" y="42" textAnchor="middle" fontFamily="serif" fontSize="6.5" fontStyle="italic" fill="#222" transform="rotate(180,22,42)">This Way</text>
                                    {/* roll circle on right */}
                                    <circle cx="64" cy="34" r="16" fill="#d8d8d8" stroke="#111" strokeWidth="1.3"/>
                                    <circle cx="64" cy="34" r="5" fill="#aaa" stroke="#555" strokeWidth="1"/>
                                    <line x1="40" y1="10" x2="49" y2="19" stroke="#111" strokeWidth="1.1"/>
                                    <line x1="40" y1="52" x2="49" y2="50" stroke="#111" strokeWidth="1.1"/>
                                    {/* TOP off first — arrow UP-RIGHT */}
                                    <line x1="22" y1="10" x2="32" y2="2" stroke="#111" strokeWidth="2.2"/>
                                    <polygon points="34,0 26,4 30,12" fill="#111"/>
                                  </svg>
                                )},
                              { n: 3, label: "Outside · Across\nBottom off first",
                                svg: (
                                  <svg width="84" height="72" viewBox="0 0 84 72">
                                    {/* Outside, text normal, BOTTOM arrow, roll on right */}
                                    <path d="M4,10 Q10,8 16,10 Q22,12 28,10 Q34,8 40,10 L40,52 L4,52 Z" fill="white" stroke="#111" strokeWidth="1.2"/>
                                    <line x1="4" y1="50" x2="40" y2="50" stroke="#444" strokeWidth="0.8"/>
                                    <text x="22" y="23" textAnchor="middle" fontFamily="serif" fontSize="7.5" fontStyle="italic" fontWeight="bold" fill="#111">PRINTING</text>
                                    <text x="22" y="33" textAnchor="middle" fontFamily="serif" fontSize="6.5" fontStyle="italic" fill="#222">READS</text>
                                    <text x="22" y="42" textAnchor="middle" fontFamily="serif" fontSize="6.5" fontStyle="italic" fill="#222">This Way</text>
                                    <circle cx="64" cy="34" r="16" fill="#d8d8d8" stroke="#111" strokeWidth="1.3"/>
                                    <circle cx="64" cy="34" r="5" fill="#aaa" stroke="#555" strokeWidth="1"/>
                                    <line x1="40" y1="10" x2="49" y2="19" stroke="#111" strokeWidth="1.1"/>
                                    <line x1="40" y1="52" x2="49" y2="50" stroke="#111" strokeWidth="1.1"/>
                                    {/* BOTTOM off first — arrow DOWN-RIGHT */}
                                    <line x1="22" y1="52" x2="32" y2="62" stroke="#111" strokeWidth="2.2"/>
                                    <polygon points="34,64 24,60 30,52" fill="#111"/>
                                  </svg>
                                )},
                              { n: 4, label: "Inside · Across\nBottom off first",
                                svg: (
                                  <svg width="84" height="72" viewBox="0 0 84 72">
                                    {/* Inside, text UPSIDE DOWN, BOTTOM arrow, roll on right */}
                                    <path d="M4,10 Q10,8 16,10 Q22,12 28,10 Q34,8 40,10 L40,52 L4,52 Z" fill="white" stroke="#111" strokeWidth="1.2"/>
                                    <line x1="4" y1="50" x2="40" y2="50" stroke="#444" strokeWidth="0.8"/>
                                    <text x="22" y="23" textAnchor="middle" fontFamily="serif" fontSize="7.5" fontStyle="italic" fontWeight="bold" fill="#111" transform="rotate(180,22,23)">PRINTING</text>
                                    <text x="22" y="33" textAnchor="middle" fontFamily="serif" fontSize="6.5" fontStyle="italic" fill="#222" transform="rotate(180,22,33)">READS</text>
                                    <text x="22" y="42" textAnchor="middle" fontFamily="serif" fontSize="6.5" fontStyle="italic" fill="#222" transform="rotate(180,22,42)">This Way</text>
                                    <circle cx="64" cy="34" r="16" fill="#d8d8d8" stroke="#111" strokeWidth="1.3"/>
                                    <circle cx="64" cy="34" r="5" fill="#aaa" stroke="#555" strokeWidth="1"/>
                                    <line x1="40" y1="10" x2="49" y2="19" stroke="#111" strokeWidth="1.1"/>
                                    <line x1="40" y1="52" x2="49" y2="50" stroke="#111" strokeWidth="1.1"/>
                                    {/* BOTTOM off first — arrow DOWN-RIGHT */}
                                    <line x1="22" y1="52" x2="32" y2="62" stroke="#111" strokeWidth="2.2"/>
                                    <polygon points="34,64 24,60 30,52" fill="#111"/>
                                  </svg>
                                )},
                            ] as { n: number; label: string; svg: React.ReactNode }[]).map(({ n, label, svg }) => {
                              const sel = ((replanForm as any).unwindDirection ?? 0) === n;
                              return (
                                <button key={n} onClick={() => rf("unwindDirection" as any, n)}
                                  title={label.replace("\n", " ")}
                                  className={`flex flex-col items-center gap-1 p-1.5 rounded-xl border-2 transition-all ${sel ? "border-orange-500 bg-orange-50 shadow-sm" : "border-gray-200 bg-white hover:border-orange-300 hover:bg-orange-50/40"}`}>
                                  {svg}
                                  <span className={`text-[11px] font-black leading-none ${sel ? "text-orange-600" : "text-gray-700"}`}>#{n}</span>
                                  <span className={`text-[7.5px] font-medium text-center leading-tight whitespace-pre-line ${sel ? "text-orange-500" : "text-gray-400"}`}>{label}</span>
                                </button>
                              );
                            })}
                          </div>
                          <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 mt-1">Printed WITH the Roll</p>
                          <div className="grid grid-cols-4 gap-2">
                            {([
                              { n: 5, label: "Outside · With Roll\nRight off first",
                                svg: (
                                  <svg width="84" height="80" viewBox="0 0 84 80">
                                    {/* Vertical paper coming off roll at bottom-right. Outside: text -90° (reads bottom→top, right side off first) */}
                                    <path d="M10,4 L52,4 L52,56 Q50,62 48,56 Q46,50 44,56 Q42,62 40,56 L10,56 Z" fill="white" stroke="#111" strokeWidth="1.2"/>
                                    <line x1="10" y1="4" x2="10" y2="56" stroke="#444" strokeWidth="0.8"/>
                                    <text x="31" y="30" textAnchor="middle" fontFamily="serif" fontSize="7.5" fontStyle="italic" fontWeight="bold" fill="#111" transform="rotate(-90,31,30)">PRINTING</text>
                                    <text x="31" y="41" textAnchor="middle" fontFamily="serif" fontSize="6" fontStyle="italic" fill="#222" transform="rotate(-90,31,41)">READS This Way</text>
                                    {/* roll circle at bottom-right */}
                                    <circle cx="67" cy="63" r="14" fill="#d8d8d8" stroke="#111" strokeWidth="1.3"/>
                                    <circle cx="67" cy="63" r="4.5" fill="#aaa" stroke="#555" strokeWidth="1"/>
                                    <line x1="52" y1="56" x2="54" y2="50" stroke="#111" strokeWidth="1.1"/>
                                    <line x1="52" y1="4" x2="53" y2="50" stroke="#111" strokeWidth="1.1"/>
                                    {/* RIGHT off first — bold arrow pointing RIGHT */}
                                    <line x1="52" y1="30" x2="64" y2="22" stroke="#111" strokeWidth="2.2"/>
                                    <polygon points="66,20 56,20 60,28" fill="#111"/>
                                  </svg>
                                )},
                              { n: 6, label: "Inside · With Roll\nRight off first",
                                svg: (
                                  <svg width="84" height="80" viewBox="0 0 84 80">
                                    {/* Inside: text +90° (upside-down, reads top→bottom), right side off first */}
                                    <path d="M10,4 L52,4 L52,56 Q50,62 48,56 Q46,50 44,56 Q42,62 40,56 L10,56 Z" fill="white" stroke="#111" strokeWidth="1.2"/>
                                    <line x1="10" y1="4" x2="10" y2="56" stroke="#444" strokeWidth="0.8"/>
                                    <text x="31" y="30" textAnchor="middle" fontFamily="serif" fontSize="7.5" fontStyle="italic" fontWeight="bold" fill="#111" transform="rotate(90,31,30)">PRINTING</text>
                                    <text x="31" y="41" textAnchor="middle" fontFamily="serif" fontSize="6" fontStyle="italic" fill="#222" transform="rotate(90,31,41)">READS This Way</text>
                                    <circle cx="67" cy="63" r="14" fill="#d8d8d8" stroke="#111" strokeWidth="1.3"/>
                                    <circle cx="67" cy="63" r="4.5" fill="#aaa" stroke="#555" strokeWidth="1"/>
                                    <line x1="52" y1="56" x2="54" y2="50" stroke="#111" strokeWidth="1.1"/>
                                    <line x1="52" y1="4" x2="53" y2="50" stroke="#111" strokeWidth="1.1"/>
                                    {/* RIGHT off first arrow */}
                                    <line x1="52" y1="30" x2="64" y2="22" stroke="#111" strokeWidth="2.2"/>
                                    <polygon points="66,20 56,20 60,28" fill="#111"/>
                                  </svg>
                                )},
                              { n: 7, label: "Outside · With Roll\nLeft off first",
                                svg: (
                                  <svg width="84" height="80" viewBox="0 0 84 80">
                                    {/* Outside: text +90°, LEFT side off first, roll at bottom-right */}
                                    <path d="M10,4 L52,4 L52,56 Q50,62 48,56 Q46,50 44,56 Q42,62 40,56 L10,56 Z" fill="white" stroke="#111" strokeWidth="1.2"/>
                                    <line x1="10" y1="4" x2="10" y2="56" stroke="#444" strokeWidth="0.8"/>
                                    <text x="31" y="30" textAnchor="middle" fontFamily="serif" fontSize="7.5" fontStyle="italic" fontWeight="bold" fill="#111" transform="rotate(90,31,30)">PRINTING</text>
                                    <text x="31" y="41" textAnchor="middle" fontFamily="serif" fontSize="6" fontStyle="italic" fill="#222" transform="rotate(90,31,41)">READS This Way</text>
                                    <circle cx="67" cy="63" r="14" fill="#d8d8d8" stroke="#111" strokeWidth="1.3"/>
                                    <circle cx="67" cy="63" r="4.5" fill="#aaa" stroke="#555" strokeWidth="1"/>
                                    <line x1="52" y1="56" x2="54" y2="50" stroke="#111" strokeWidth="1.1"/>
                                    <line x1="52" y1="4" x2="53" y2="50" stroke="#111" strokeWidth="1.1"/>
                                    {/* LEFT off first — arrow pointing LEFT */}
                                    <line x1="10" y1="30" x2="0" y2="22" stroke="#111" strokeWidth="2.2"/>
                                    <polygon points="0,20 10,18 8,28" fill="#111"/>
                                  </svg>
                                )},
                              { n: 8, label: "Inside · With Roll\nLeft off first",
                                svg: (
                                  <svg width="84" height="80" viewBox="0 0 84 80">
                                    {/* Inside: text -90° (upside-down), LEFT side off first */}
                                    <path d="M10,4 L52,4 L52,56 Q50,62 48,56 Q46,50 44,56 Q42,62 40,56 L10,56 Z" fill="white" stroke="#111" strokeWidth="1.2"/>
                                    <line x1="10" y1="4" x2="10" y2="56" stroke="#444" strokeWidth="0.8"/>
                                    <text x="31" y="30" textAnchor="middle" fontFamily="serif" fontSize="7.5" fontStyle="italic" fontWeight="bold" fill="#111" transform="rotate(-90,31,30)">PRINTING</text>
                                    <text x="31" y="41" textAnchor="middle" fontFamily="serif" fontSize="6" fontStyle="italic" fill="#222" transform="rotate(-90,31,41)">READS This Way</text>
                                    <circle cx="67" cy="63" r="14" fill="#d8d8d8" stroke="#111" strokeWidth="1.3"/>
                                    <circle cx="67" cy="63" r="4.5" fill="#aaa" stroke="#555" strokeWidth="1"/>
                                    <line x1="52" y1="56" x2="54" y2="50" stroke="#111" strokeWidth="1.1"/>
                                    <line x1="52" y1="4" x2="53" y2="50" stroke="#111" strokeWidth="1.1"/>
                                    {/* LEFT off first — arrow pointing LEFT */}
                                    <line x1="10" y1="30" x2="0" y2="22" stroke="#111" strokeWidth="2.2"/>
                                    <polygon points="0,20 10,18 8,28" fill="#111"/>
                                  </svg>
                                )},
                            ] as { n: number; label: string; svg: React.ReactNode }[]).map(({ n, label, svg }) => {
                              const sel = ((replanForm as any).unwindDirection ?? 0) === n;
                              return (
                                <button key={n} onClick={() => rf("unwindDirection" as any, n)}
                                  title={label.replace("\n", " ")}
                                  className={`flex flex-col items-center gap-1 p-1.5 rounded-xl border-2 transition-all ${sel ? "border-orange-500 bg-orange-50 shadow-sm" : "border-gray-200 bg-white hover:border-orange-300 hover:bg-orange-50/40"}`}>
                                  {svg}
                                  <span className={`text-[11px] font-black leading-none ${sel ? "text-orange-600" : "text-gray-700"}`}>#{n}</span>
                                  <span className={`text-[7.5px] font-medium text-center leading-tight whitespace-pre-line ${sel ? "text-orange-500" : "text-gray-400"}`}>{label}</span>
                                </button>
                              );
                            })}
                          </div>
                          {(replanForm as any).unwindDirection > 0 && (
                            <p className="mt-1.5 text-[10px] text-orange-600 font-semibold flex items-center gap-1">
                              <Check size={10}/> Direction #{(replanForm as any).unwindDirection} selected — {[
                                "#1 Outside · Across · Top off first",
                                "#2 Inside · Across · Top off first",
                                "#3 Outside · Across · Bottom off first",
                                "#4 Inside · Across · Bottom off first",
                                "#5 Outside · With Roll · Right off first",
                                "#6 Inside · With Roll · Right off first",
                                "#7 Outside · With Roll · Left off first",
                                "#8 Inside · With Roll · Left off first",
                              ][((replanForm as any).unwindDirection ?? 1) - 1]}
                            </p>
                          )}
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
                          {minW > 0 && <span className="px-2 py-0.5 rounded-full bg-orange-100 border border-orange-300 text-orange-800">Min Width: <strong>{minW} mm</strong></span>}
                          {maxW > 0 && <span className="px-2 py-0.5 rounded-full bg-orange-100 border border-orange-300 text-orange-800">Max Width: <strong>{maxW} mm</strong></span>}
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
                            {["#", "Process (Master)", ""].map(h => (
                              <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {replanForm.processes.map((pr, i) => (
                            <tr key={i} className="hover:bg-gray-50">
                              <td className="px-3 py-2 w-8 text-center">
                                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold">{i + 1}</span>
                              </td>
                              <td className="px-3 py-2 min-w-[200px]">
                                <select value={pr.processId} onChange={e => selectReplanProcess(i, e.target.value)} className={cellInput}>
                                  <option value="">-- Select Process --</option>
                                  {ROTO_PROCESSES.map(pm => <option key={pm.id} value={pm.id}>{pm.name} ({pm.department})</option>)}
                                </select>
                              </td>
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
                    <div className="flex items-center gap-2">
                      {/* Bulk add input */}
                      {(() => {
                        const bulkRef = { val: 1 };
                        const addBulk = (inputEl: HTMLInputElement | null) => {
                          const n = Math.min(10, Math.max(1, parseInt(inputEl?.value ?? "1") || 1));
                          const layers = [...replanForm.secondaryLayers];
                          for (let k = 0; k < n; k++) {
                            layers.push({ id: Math.random().toString(), layerNo: layers.length + 1, plyType: "", itemSubGroup: "", density: 0, thickness: 0, gsm: 0, consumableItems: [] });
                          }
                          rf("secondaryLayers", layers);
                          if (inputEl) inputEl.value = "";
                        };
                        let inputRef: HTMLInputElement | null = null;
                        return (
                          <div className="flex items-center gap-0 border border-purple-300 rounded-lg overflow-hidden bg-white">
                            <span className="text-[10px] font-semibold text-purple-600 px-2 bg-purple-50 whitespace-nowrap border-r border-purple-200 h-full flex items-center py-1.5">Add</span>
                            <input
                              type="number" min={1} max={10} placeholder="1"
                              ref={el => { inputRef = el; }}
                              className="w-12 text-xs font-mono text-center border-none outline-none px-1 py-1.5 bg-white focus:ring-0"
                              onKeyDown={e => { if (e.key === "Enter") addBulk(e.target as HTMLInputElement); }}
                            />
                            <button
                              onClick={() => addBulk(inputRef)}
                              className="text-[10px] font-bold text-white bg-purple-600 hover:bg-purple-700 px-2 py-1.5 whitespace-nowrap transition">
                              + Plys
                            </button>
                          </div>
                        );
                      })()}
                      <button onClick={() => {
                        const layers = [...replanForm.secondaryLayers];
                        layers.push({ id: Math.random().toString(), layerNo: layers.length + 1, plyType: "", itemSubGroup: "", density: 0, thickness: 0, gsm: 0, consumableItems: [] });
                        rf("secondaryLayers", layers);
                      }} className="flex items-center gap-1.5 text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg border border-purple-200">
                        <Plus size={12} /> Add Ply
                      </button>
                    </div>
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

                                  {(() => {
                                    // Pre-compute per-group serial numbers (all items, including clones)
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
                                    const filteredItems = items.filter(it =>
                                      it.group === ci.itemGroup && it.active &&
                                      (!ci.itemSubGroup || it.subGroup === ci.itemSubGroup)
                                    );
                                    const ciLabel = ci.itemGroup || "Consumable";
                                    const ciSerial = groupSerials[ciIdx] ?? 1;
                                    return (
                                      <div key={ci.consumableId} className="bg-teal-50/40 border border-teal-100 rounded-xl p-3">
                                        <div className="flex items-center justify-between mb-2">
                                          <span className="text-[10px] font-bold text-teal-700 uppercase">
                                            {`${ciLabel} ${ciSerial}`}
                                          </span>
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
                                  });
                                  })()}

                                  {l.consumableItems.length === 0 && (
                                    <p className="text-[10px] text-gray-400 italic text-center py-2">Click "+ Add Consumable" to add ink, solvent, adhesive, etc.</p>
                                  )}
                                </div>
                              )}

                              {/* ── Ply Summary Strip ── */}
                              {l.consumableItems.length > 0 && (() => {
                                const groupCount: Record<string, number> = {};
                                l.consumableItems.forEach(ci => {
                                  const g = ci.itemGroup || "Other";
                                  groupCount[g] = (groupCount[g] || 0) + 1;
                                });
                                const inks = l.consumableItems.filter(ci => ci.itemGroup === "Ink");
                                const totalDryGSM = inks.reduce((sum, ci) => sum + (parseFloat(String(ci.gsm)) || 0), 0);
                                const avgSolid = inks.length > 0
                                  ? inks.reduce((sum, ci) => {
                                      const itm = items.find(x => x.id === ci.itemId);
                                      return sum + ((itm as any)?.solidPct ?? 35);
                                    }, 0) / inks.length
                                  : 0;
                                const GROUP_COLOR: Record<string, string> = {
                                  Ink:      "bg-blue-100 text-blue-700 border-blue-200",
                                  Solvent:  "bg-teal-100 text-teal-700 border-teal-200",
                                  Adhesive: "bg-violet-100 text-violet-700 border-violet-200",
                                  Hardener: "bg-orange-100 text-orange-700 border-orange-200",
                                  Other:    "bg-gray-100 text-gray-600 border-gray-200",
                                };
                                return (
                                  <div className="flex flex-wrap items-center gap-2 px-4 py-2 bg-slate-50 border-t border-slate-100 rounded-b-2xl">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Ply Summary:</span>
                                    {Object.entries(groupCount).map(([g, cnt]) => (
                                      <span key={g} className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${GROUP_COLOR[g] ?? GROUP_COLOR.Other}`}>
                                        {g}: <strong>{cnt}</strong>
                                      </span>
                                    ))}
                                    {inks.length > 0 && (
                                      <>
                                        <span className="w-px h-3 bg-slate-300 mx-1" />
                                        <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                                          Total Dry GSM: <strong>{totalDryGSM.toFixed(1)}</strong>
                                        </span>
                                        <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                                          Avg Solid: <strong>{avgSolid.toFixed(1)}%</strong>
                                        </span>
                                      </>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Trimming — placed here so plan can use it */}
                <div className="border border-amber-200 rounded-2xl p-4 bg-amber-50/40">
                  <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-widest mb-2">Trimming</p>
                  <div className="flex items-center gap-4">
                    <div style={{ maxWidth: 220 }}>
                      <label className="text-[10px] font-semibold text-amber-500 uppercase block mb-1">Trimming Both Side (mm)</label>
                      <input
                        type="number" min={0} step={0.5} placeholder="e.g. 5"
                        value={dimValues.trimming ?? replanForm.trimmingSize ?? ""}
                        onChange={e => { const v = Number(e.target.value) || 0; patchDim({ trimming: v }); rf("trimmingSize", v); }}
                        className="w-full text-sm border border-amber-300 rounded-xl px-3 py-2 bg-white focus:bg-white outline-none focus:ring-2 focus:ring-amber-400 font-mono"
                      />
                    </div>
                    {(replanForm.trimmingSize || 0) > 0 && (
                      <div className="text-xs text-amber-700 bg-amber-100 border border-amber-200 rounded-xl px-3 py-2 font-semibold">
                        Both sides: {replanForm.trimmingSize}+{replanForm.trimmingSize} mm &nbsp;·&nbsp; Total trim: {(replanForm.trimmingSize || 0) * 2} mm
                      </div>
                    )}
                  </div>
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
                        Plan applied — UPS: <strong>{replanSelectedPlan.totalUPS}</strong> · Sleeve: {(replanSelectedPlan as any).sleeveCode} {(replanSelectedPlan as any).sleeveWidthVal}mm · Cylinder: {(replanSelectedPlan as any).cylinderCode} · Film: {replanSelectedPlan.filmSize}mm · Total Waste: {replanSelectedPlan.totalWaste}mm
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
                                  { key: "cylExtra",         label: "Cyl Extra (mm)" },
                                  { key: "cylCirc",          label: "Cyl. Circ (mm)" },
                                  { key: "repeatUPS",        label: "Repeat UPS" },
                                  { key: "totalUPS",         label: "Total Pieces" },
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
                                    className={`cursor-pointer transition-colors ${p.isDoctorBlade ? "bg-teal-50 hover:bg-teal-100 ring-1 ring-inset ring-teal-300" : p.isSpecialSleeve ? "bg-rose-50 hover:bg-rose-100" : p.isSpecial ? "bg-amber-50 hover:bg-amber-100" : p.isBest ? "ring-2 ring-inset ring-green-400 bg-green-50" : isSelected ? "bg-indigo-50" : "hover:bg-gray-50"}`}>
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
                                    <td className="p-2 border border-gray-100 font-medium text-gray-700">
                                      {plan.machineName}
                                      {p.isBest && <span className="ml-1.5 px-1.5 py-0.5 bg-green-500 text-white text-[9px] font-bold rounded-full">BEST</span>}
                                      {p.isDoctorBlade && <span className="ml-1.5 px-1.5 py-0.5 bg-teal-600 text-white text-[9px] font-bold rounded-full">🔧 DB: {p.doctorBladeWidth}mm</span>}
                                      {p.isSpecial && !p.isSpecialSleeve && !p.isDoctorBlade && <span className="ml-1.5 px-1.5 py-0.5 bg-amber-500 text-white text-[9px] font-bold rounded-full">SPECIAL CYL</span>}
                                      {p.isSpecialSleeve && <span className="ml-1.5 px-1.5 py-0.5 bg-rose-500 text-white text-[9px] font-bold rounded-full">SPECIAL SLV</span>}
                                    </td>
                                    <td className="p-2 border border-gray-100 text-center font-bold text-indigo-700">{plan.acUps}</td>
                                    <td className="p-2 border border-gray-100 text-center font-mono">{p.printingWidth}</td>
                                    <td className="p-2 border border-gray-100">
                                      <span className={`font-semibold ${p.isSpecialSleeve ? "text-rose-600" : "text-blue-600"}`}>{p.sleeveCode}</span>
                                      <br/>
                                      <span className={`text-[9px] ${p.isSpecialSleeve ? "text-rose-500" : "text-gray-400"}`}>{p.sleeveName}</span>
                                    </td>
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
                                    <td className="p-2 border border-gray-100 text-center font-bold">
                                      {(() => {
                                        const extra = Math.round((p.cylinderWidthVal || 0) - (p.sleeveWidthVal || 0) - 100);
                                        return extra > 0
                                          ? <span className="text-orange-600">+{extra}</span>
                                          : <span className="text-gray-400">0</span>;
                                      })()}
                                    </td>
                                    <td className="p-2 border border-gray-100 text-center font-bold text-emerald-700">{p.cylCirc}</td>
                                    <td className="p-2 border border-gray-100 text-center font-bold text-teal-700">{p.repeatUPS}</td>
                                    <td className="p-2 border border-gray-100 text-center font-bold">{plan.totalUPS}</td>
                                  </tr>
                                );
                              })}
                              {replanVisiblePlans.length === 0 && (() => {
                                const sT = (replanForm as any).structureType || "Label";
                                const machine = PRINT_MACHINES.find(m => m.id === replanForm.machineId);
                                const minC = parseFloat((machine as any)?.repeatLengthMin) || 0;
                                const maxC = parseFloat((machine as any)?.repeatLengthMax) || 9999;
                                const maxF = parseFloat((machine as any)?.maxWebWidth) || 0;
                                const minF = parseFloat((machine as any)?.minWebWidth) || 0;
                                const sh   = replanForm.widthShrinkage || 0;
                                const jW   = replanForm.jobWidth || 0;
                                const jH   = replanForm.jobHeight || 0;

                                let reason = "";
                                let tip = "";
                                if (sT === "Sleeve") {
                                  const dc = jW * 2 + sh;
                                  const maxN = dc > 0 ? Math.floor(maxC / dc) : 0;
                                  const minN = dc > 0 ? Math.ceil(minC / dc) : 0;
                                  if (dc <= 0) reason = "Enter Layflat Width to generate plans.";
                                  else if (dc * maxN < minC) reason = `Design Circ = ${dc}mm. Even ${maxN}× repeat = ${dc*maxN}mm is below machine min ${minC}mm. Use a larger Layflat.`;
                                  else if (jW > maxF) reason = `Layflat ${jW}mm exceeds machine max film width ${maxF}mm.`;
                                  else if (jW < minF) reason = `Film width (${jW}mm) is below machine minimum ${minF}mm.`;
                                  else reason = "No plans generated. Check machine selection and limits.";
                                  if (dc > 0 && minN >= 1 && minN <= maxN)
                                    tip = `Machine min circ = ${minC}mm → min repeat count = ${minN}× (cylinder = ${dc}×${minN} = ${dc*minN}mm). Plans with ${minN}× to ${maxN}× repeat should appear.`;
                                } else {
                                  const gus = (replanForm as any).gusset || 0;
                                  const seal = (replanForm as any).sealSize || 0;
                                  const effRep = jH + seal + (gus > 0 ? gus / 2 : 0) + sh;
                                  if (effRep > 0 && effRep < minC) reason = `Effective Repeat = ${effRep}mm (H${jH}${seal > 0 ? `+Seal${seal}` : ""}${gus > 0 ? `+Gusset/2=${gus/2}` : ""}${sh > 0 ? `+Shrink${sh}` : ""}) is below machine minimum ${minC}mm.`;
                                  else if (effRep > maxC) reason = `Effective Repeat = ${effRep}mm exceeds machine maximum ${maxC}mm.`;
                                  else if ((replanForm.actualWidth || jW) > maxF) reason = `Job width exceeds machine max film width ${maxF}mm.`;
                                  else reason = "No sleeve/cylinder in stock fits this job. Only special orders should appear — check if filters are active.";
                                }
                                return (
                                  <tr>
                                    <td colSpan={17} className="p-5">
                                      <div className="flex flex-col items-center gap-2 text-center">
                                        <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 font-bold text-lg">!</div>
                                        <p className="text-sm font-bold text-gray-700">No Plans Generated</p>
                                        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 max-w-lg">{reason}</p>
                                        {tip && (
                                          <p className="text-[10px] text-blue-600 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 max-w-lg">{tip}</p>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })()}
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
                        {(() => {
                          // per-piece area (m²) = jobW(m) × jobH(m)
                          const pieceArea = (replanForm.jobWidth / 1000) * ((replanForm.jobHeight || 0) / 1000);
                          const fmt = (v: number) => v > 0 ? v.toFixed(4) : "—";
                          return (
                          <>
                        <p className="text-xs font-bold text-indigo-900">
                          Ply / Layer Calculation &nbsp;·&nbsp; Job: {replanForm.jobWidth}mm × {replanForm.jobHeight || 0}mm &nbsp;·&nbsp; Area/Piece: {pieceArea.toFixed(4)} m²
                        </p>
                        <div className="border-2 border-indigo-50 rounded-2xl overflow-hidden shadow-lg">
                          <div className="overflow-x-auto">
                            <table className="min-w-full text-[10px] border-collapse">
                              <thead className="bg-indigo-700 text-white uppercase tracking-wider font-bold">
                                <tr>
                                  {["Ply","Type","Item / Material","GSM / Ratio","Info","Coverage %","Dry Wt/Piece (g)","Liq Wt/Piece (g)","Total Wt/Piece (g)"].map(h => (
                                    <th key={h} className="p-2 border border-indigo-600/30 text-center whitespace-nowrap">{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {replanForm.secondaryLayers.flatMap((l, idx) => {
                                  // film weight per piece (g)
                                  const filmDryG  = l.gsm > 0 ? parseFloat((l.gsm * pieceArea).toFixed(4)) : 0;

                                  // total liquid ink weight per piece (g) in this ply — for solvent ratio
                                  const totalLiqInkG = l.consumableItems
                                    .filter(ci => ci.itemGroup === "Ink")
                                    .reduce((s, ci) => {
                                      const solid  = ci.solidPct ?? 40;
                                      const dryG   = (ci.gsm || 0) * pieceArea;
                                      return s + (solid > 0 ? dryG / (solid / 100) : 0);
                                    }, 0);

                                  const adhItem = l.consumableItems.find(ci => ci.itemGroup === "Adhesive");

                                  const plyBadgeCls = l.plyType === "Printing"
                                    ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                                    : l.plyType === "Lamination"
                                    ? "bg-teal-50 text-teal-700 border-teal-200"
                                    : l.plyType === "Coating"
                                    ? "bg-amber-50 text-amber-700 border-amber-200"
                                    : "bg-blue-50 text-blue-700 border-blue-200";

                                  const groupBadgeCls: Record<string,string> = {
                                    "Ink":      "bg-rose-50 text-rose-700 border-rose-200",
                                    "Solvent":  "bg-cyan-50 text-cyan-700 border-cyan-200",
                                    "Adhesive": "bg-amber-50 text-amber-700 border-amber-200",
                                    "Hardner":  "bg-purple-50 text-purple-700 border-purple-200",
                                  };

                                  // ── Film row ──
                                  const filmRow = (
                                    <tr key={`film-${l.id}`} className="hover:bg-indigo-50/30">
                                      <td className="p-2 border border-gray-200 text-center font-black text-indigo-900 bg-indigo-50/50 align-middle"
                                        rowSpan={1 + l.consumableItems.length}>
                                        {idx + 1}
                                      </td>
                                      <td className="p-2 border border-gray-100 text-center">
                                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold border ${plyBadgeCls}`}>{l.plyType || "Film"}</span>
                                      </td>
                                      <td className="p-2 border border-gray-100 font-semibold text-gray-700 min-w-[130px]">{l.itemSubGroup || "—"}</td>
                                      <td className="p-2 border border-gray-100 text-center font-bold text-indigo-700">{l.gsm > 0 ? `${l.gsm} GSM` : "—"}</td>
                                      <td className="p-2 border border-gray-100 text-center text-gray-500">{l.thickness ? `${l.thickness} μ` : "—"}</td>
                                      <td className="p-2 border border-gray-100 text-center text-gray-300">—</td>
                                      <td className="p-2 border border-gray-100 text-center font-bold text-blue-600">{fmt(filmDryG)}</td>
                                      <td className="p-2 border border-gray-100 text-center text-gray-300">—</td>
                                      <td className="p-2 border border-gray-100 text-center font-black text-gray-900 bg-gray-50">{fmt(filmDryG)}</td>
                                    </tr>
                                  );

                                  // ── Consumable sub-rows ──
                                  const ciRows = l.consumableItems.map((ci, ciIdx) => {
                                    let gsmRatio = "—", infoCell = "—";
                                    let dryG = 0, liqG: number | null = null;

                                    if (ci.itemGroup === "Ink") {
                                      const dryGSM = ci.gsm || 0;
                                      const solid  = ci.solidPct ?? 40;
                                      const liqGSM = solid > 0 ? dryGSM / (solid / 100) : 0;
                                      const covFactor = (ci.coveragePct ?? 100) / 100;
                                      gsmRatio = `${dryGSM} GSM`;
                                      infoCell = `${solid}% Solid`;
                                      dryG = parseFloat((dryGSM * pieceArea * covFactor).toFixed(4));
                                      liqG = parseFloat((liqGSM * pieceArea * covFactor).toFixed(4));
                                    } else if (ci.itemGroup === "Solvent") {
                                      const ratio = ci.gsm || 0;
                                      gsmRatio = `${ratio} %`;
                                      infoCell = "of Liq. Ink";
                                      dryG = parseFloat((totalLiqInkG * ratio / 100).toFixed(4));
                                    } else if (ci.itemGroup === "Adhesive") {
                                      gsmRatio = `${ci.gsm || 0} GSM`;
                                      infoCell = `OH ${ci.ohPct ?? 0}%`;
                                      dryG = parseFloat(((ci.gsm || 0) * pieceArea).toFixed(4));
                                    } else if (ci.itemGroup === "Hardner") {
                                      const adhGSM = adhItem?.gsm ?? 0;
                                      const ohPct  = adhItem?.ohPct ?? 0;
                                      const ncoPct = ci.ncoPct ?? 0;
                                      const autoGSM = ncoPct > 0 ? parseFloat(((adhGSM * ohPct) / ncoPct).toFixed(3)) : 0;
                                      gsmRatio = `${autoGSM} GSM`;
                                      infoCell = `NCO ${ncoPct}%`;
                                      dryG = parseFloat((autoGSM * pieceArea).toFixed(4));
                                    }

                                    return (
                                      <tr key={`ci-${l.id}-${ciIdx}`} className="bg-slate-50/60 hover:bg-slate-100/60">
                                        <td className="p-2 border border-gray-100 text-center">
                                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold border ${groupBadgeCls[ci.itemGroup] || "bg-gray-100 text-gray-600 border-gray-300"}`}>{ci.itemGroup}</span>
                                        </td>
                                        <td className="p-2 border border-gray-100 text-gray-500 italic pl-4">{ci.itemName || ci.itemSubGroup || ci.fieldDisplayName || "—"}</td>
                                        <td className="p-2 border border-gray-100 text-center font-bold text-indigo-600">{gsmRatio}</td>
                                        <td className="p-2 border border-gray-100 text-center text-[9px] text-gray-500">{infoCell}</td>
                                        <td className="p-2 border border-gray-100 text-center font-mono text-violet-600">
                                          {ci.itemGroup === "Ink" ? `${ci.coveragePct ?? 100}%` : "—"}
                                        </td>
                                        <td className="p-2 border border-gray-100 text-center font-bold text-blue-600">{fmt(dryG)}</td>
                                        <td className="p-2 border border-gray-100 text-center font-mono text-teal-600">{liqG != null ? fmt(liqG) : "—"}</td>
                                        <td className="p-2 border border-gray-100 text-center font-black text-gray-800 bg-gray-50">{fmt(dryG)}</td>
                                      </tr>
                                    );
                                  });

                                  return [filmRow, ...ciRows];
                                })}
                              </tbody>
                              <tfoot className="bg-slate-50 border-t-2 border-indigo-200">
                                {/* Row 1 — Total Ink GSM (All Plies) — unchanged */}
                                <tr className="bg-rose-50/60">
                                  <td colSpan={8} className="p-2 text-right text-rose-700 uppercase text-[10px] font-bold tracking-wider">Total Ink GSM (all plies)</td>
                                  <td className="p-2 text-center bg-rose-100 text-rose-800 text-xs font-black">
                                    {replanForm.secondaryLayers.reduce((sum, l) =>
                                      sum + l.consumableItems.filter(ci2 => ci2.itemGroup === "Ink").reduce((s, ci2) => s + (ci2.gsm || 0), 0)
                                    , 0).toFixed(2)} GSM
                                  </td>
                                </tr>
                                {/* Row 2 — Total Consumables GSM (Ink + Adhesive + Solvent + Hardner etc.) */}
                                {(() => {
                                  const adhMap: Record<string, { gsm: number; ohPct: number }> = {};
                                  replanForm.secondaryLayers.forEach(l => {
                                    const adh = l.consumableItems.find(ci2 => ci2.itemGroup === "Adhesive");
                                    if (adh) adhMap[l.id] = { gsm: adh.gsm || 0, ohPct: adh.ohPct ?? 0 };
                                  });
                                  const totalLiqInkByLayer: Record<string, number> = {};
                                  replanForm.secondaryLayers.forEach(l => {
                                    totalLiqInkByLayer[l.id] = l.consumableItems
                                      .filter(ci2 => ci2.itemGroup === "Ink")
                                      .reduce((s, ci2) => {
                                        const solid = ci2.solidPct ?? 40;
                                        const dryGSM = (ci2.gsm || 0) * ((ci2.coveragePct ?? 100) / 100);
                                        return s + (solid > 0 ? dryGSM / (solid / 100) : 0);
                                      }, 0);
                                  });
                                  const totalConsumablesGSM = replanForm.secondaryLayers.reduce((sum, l) =>
                                    sum + l.consumableItems.reduce((s, ci2) => {
                                      if (ci2.itemGroup === "Ink")      return s + (ci2.gsm || 0) * ((ci2.coveragePct ?? 100) / 100);
                                      if (ci2.itemGroup === "Solvent")  return s + totalLiqInkByLayer[l.id] * (ci2.gsm || 0) / 100;
                                      if (ci2.itemGroup === "Adhesive") return s + (ci2.gsm || 0);
                                      if (ci2.itemGroup === "Hardner") {
                                        const aGSM = adhMap[l.id]?.gsm ?? 0;
                                        const ohP  = adhMap[l.id]?.ohPct ?? 0;
                                        const nco  = ci2.ncoPct ?? 0;
                                        return s + (nco > 0 ? (aGSM * ohP) / nco : 0);
                                      }
                                      return s + (ci2.gsm || 0);
                                    }, 0)
                                  , 0);
                                  const totalFilmGSM = replanForm.secondaryLayers.reduce((sum, l) => sum + (l.gsm > 0 ? l.gsm : 0), 0);
                                  return (
                                    <>
                                      <tr className="bg-violet-50/60">
                                        <td colSpan={8} className="p-2 text-right text-violet-700 uppercase text-[10px] font-bold tracking-wider">Total Consumables GSM</td>
                                        <td className="p-2 text-center bg-violet-100 text-violet-800 text-xs font-black">
                                          {totalConsumablesGSM.toFixed(2)} GSM
                                        </td>
                                      </tr>
                                      {/* Row 3 — Total Film GSM */}
                                      <tr className="bg-blue-50/60">
                                        <td colSpan={8} className="p-2 text-right text-blue-700 uppercase text-[10px] font-bold tracking-wider">Total Film GSM</td>
                                        <td className="p-2 text-center bg-blue-100 text-blue-800 text-xs font-black">
                                          {totalFilmGSM.toFixed(2)} GSM
                                        </td>
                                      </tr>
                                      {/* Row 4 — Total Per Piece GSM = Film + Consumables */}
                                      <tr className="bg-indigo-50">
                                        <td colSpan={8} className="p-3 text-right text-indigo-900 uppercase text-[10px] font-black tracking-wider">Total Per Piece GSM</td>
                                        <td className="p-3 text-center bg-indigo-200 text-indigo-900 text-xs font-black">
                                          {(totalFilmGSM + totalConsumablesGSM).toFixed(2)} GSM
                                        </td>
                                      </tr>
                                    </>
                                  );
                                })()}
                              </tfoot>
                            </table>
                          </div>
                        </div>
                          </>
                          );
                        })()}
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
                    { key: "tool",     label: "Cylinder Master"     },
                  ] as const).map(t => (
                    <button key={t.key} onClick={() => {
                      setCatalogPrepTab(t.key);
                      if (t.key === "tool" && replanSelectedPlan) {
                        const planCirc  = String(replanSelectedPlan.cylCirc);
                        const planWidth = String((replanSelectedPlan as any).cylinderWidthVal ?? "");
                        const planRUPS  = replanSelectedPlan.repeatUPS as number;
                        const isSpecial = !!(replanSelectedPlan as any).isSpecial;
                        setCatalogCylAllocs(p => p.map((c, ci) => ({
                          ...c,
                          circumference: planCirc,
                          printWidth:    planWidth,
                          repeatUPS:     planRUPS,
                          cylinderNo:    c.cylinderNo || (isSpecial ? `SPL-C${String(ci + 1).padStart(2, "0")}` : `${(replanSelectedPlan as any).cylinderCode || "CYL"}-C${String(ci + 1).padStart(2, "0")}`),
                          cylinderType:  c.cylinderType === "Existing" && isSpecial ? "New" : c.cylinderType,
                        })));
                      }
                    }}
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
                            <th className="px-2 py-2 border border-purple-600/30 text-center whitespace-nowrap font-semibold">Remarks</th>
                          </tr>
                          <tr className="bg-purple-800 text-purple-200 text-[9px]">
                            {["", "", "", "", ""].map((_, i) => <th key={i} className="border border-purple-700/30" />)}
                            {["L*", "A*", "B*"].map(h => <th key={`s-${h}`} className="px-2 py-1 border border-purple-700/30 text-center bg-indigo-800/60">{h}</th>)}
                            <th className="border border-purple-700/30" />
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
                                    const COLOR_LAB: Record<string, { l: string; a: string; b: string }> = {
                                      "Red":     { l: "41.0",  a: "54.2",  b: "38.1"  },
                                      "Yellow":  { l: "89.3",  a: "-6.1",  b: "80.4"  },
                                      "Blue":    { l: "25.1",  a: "23.4",  b: "-52.8" },
                                      "Black":   { l: "16.0",  a: "0.1",   b: "0.0"   },
                                      "White":   { l: "95.2",  a: "-1.0",  b: "2.3"   },
                                      "Green":   { l: "46.3",  a: "-50.2", b: "30.1"  },
                                      "Cyan":    { l: "60.1",  a: "-38.2", b: "-31.4" },
                                      "Magenta": { l: "48.2",  a: "72.1",  b: "-10.3" },
                                      "Orange":  { l: "65.4",  a: "43.1",  b: "65.2"  },
                                      "Violet":  { l: "30.2",  a: "40.1",  b: "-42.3" },
                                    };
                                    const lab = ink?.colour ? (COLOR_LAB[ink.colour] ?? null) : null;
                                    const PROCESS_COLOURS = new Set(["Cyan","Magenta","Yellow","Black"]);
                                    const autoType: ColorShade["inkType"] = ink?.colour && PROCESS_COLOURS.has(ink.colour) ? "Process" : "Spot";
                                    setCatalogColorShades(p => p.map((c, ci) => ci === i ? {
                                      ...c,
                                      inkItemId:  ink?.id ?? "",
                                      colorName:  ink?.colour || ink?.name || c.colorName,
                                      pantoneRef: ink?.pantoneNo || c.pantoneRef,
                                      inkType:    ink ? autoType : c.inkType,
                                      ...(lab ? { labL: lab.l, labA: lab.a, labB: lab.b } : {}),
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
                              <td className="px-2 py-1.5 bg-indigo-50/40"><input type="number" step={0.01} placeholder="L*" className="w-24 text-xs border border-indigo-200 rounded-lg px-2 py-1 font-mono outline-none focus:ring-2 focus:ring-indigo-400 bg-white" value={cs.labL} onChange={e => setCatalogColorShades(p => p.map((c, ci) => ci === i ? { ...c, labL: e.target.value } : c))} /></td>
                              <td className="px-2 py-1.5 bg-indigo-50/40"><input type="number" step={0.01} placeholder="a*" className="w-24 text-xs border border-indigo-200 rounded-lg px-2 py-1 font-mono outline-none focus:ring-2 focus:ring-indigo-400 bg-white" value={cs.labA} onChange={e => setCatalogColorShades(p => p.map((c, ci) => ci === i ? { ...c, labA: e.target.value } : c))} /></td>
                              <td className="px-2 py-1.5 bg-indigo-50/40"><input type="number" step={0.01} placeholder="b*" className="w-24 text-xs border border-indigo-200 rounded-lg px-2 py-1 font-mono outline-none focus:ring-2 focus:ring-indigo-400 bg-white" value={cs.labB} onChange={e => setCatalogColorShades(p => p.map((c, ci) => ci === i ? { ...c, labB: e.target.value } : c))} /></td>
                              <td className="px-2 py-1.5"><input placeholder="Notes…" className="w-36 text-xs border border-gray-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-purple-400" value={cs.remarks} onChange={e => setCatalogColorShades(p => p.map((c, ci) => ci === i ? { ...c, remarks: e.target.value } : c))} /></td>
                            </tr>
                            );
                          })}
                          {catalogColorShades.length === 0 && <tr><td colSpan={9} className="p-6 text-center text-gray-400 text-xs">No colors. Set No. of Colors in Basic Info tab first.</td></tr>}
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

                    {/* Plan info banner */}
                    {replanSelectedPlan && (
                      <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 flex flex-wrap gap-4 items-center">
                        <div className="flex items-center gap-1.5 text-xs"><span className="text-indigo-500 font-semibold uppercase text-[10px]">Plan Cylinder</span><span className="font-bold text-indigo-800">{(replanSelectedPlan as any).cylinderCode}</span></div>
                        <div className="flex items-center gap-1.5 text-xs"><span className="text-indigo-500 font-semibold uppercase text-[10px]">Circumference</span><span className="font-bold text-indigo-800">{replanSelectedPlan.cylCirc} mm</span></div>
                        <div className="flex items-center gap-1.5 text-xs"><span className="text-indigo-500 font-semibold uppercase text-[10px]">Repeat UPS</span><span className="font-bold text-indigo-800">{replanSelectedPlan.repeatUPS}×</span></div>
                        <div className="flex items-center gap-1.5 text-xs"><span className="text-indigo-500 font-semibold uppercase text-[10px]">Print Width</span><span className="font-bold text-indigo-800">{(replanSelectedPlan as any).cylinderWidthVal ?? "—"} mm</span></div>
                        {(replanSelectedPlan as any).isSpecial && (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-700 border border-amber-300 rounded-full text-[10px] font-bold">Special Order Cylinder</span>
                        )}
                        <div className="ml-auto flex items-center gap-2">
                          <button
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-300 text-[11px] font-bold rounded-lg transition"
                            onClick={refreshFromCylinderMaster}>
                            <RefreshCw size={11} /> Refresh from Master
                          </button>
                          <button
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-[11px] font-bold rounded-lg transition"
                            onClick={openCylinderMaster}>
                            <Check size={11} /> Create Cylinder in Master
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 flex items-start gap-2">
                      <Wrench size={13} className="text-blue-600 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-blue-800">
                        All colors share <strong>same cylinder</strong> — same Circ, Print Width & Repeat UPS. Only artwork (color code) changes per color.
                        Editing Circ or Print Width in row 1 auto-applies to all rows.
                        Click <strong>Create Cylinder in Master</strong> (top right) — only <strong>1 cylinder</strong> will be registered (all colors share it).
                      </p>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
                      <table className="min-w-full text-[11px] border-collapse">
                        <thead className="bg-amber-700 text-white uppercase tracking-wider">
                          <tr>{["#", "Repeat?", "Product Code", "Color Name", "Cylinder Code", "Cylinder Width (mm)", "Circ. (mm)", "Repeat UPS", "Type", "Status", "Remarks", "Action"].map(h => (
                            <th key={h} className="px-2 py-2 border border-amber-600/30 text-center whitespace-nowrap font-semibold">{h}</th>
                          ))}</tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {catalogCylAllocs.map((ca, i) => {
                            const cn = replanForm?.catalogNo || "";
                            const m  = cn.match(/(\d+)$/);
                            const pCode = m ? `P${m[1].padStart(4, "0")}` : cn || "—";
                            return (
                            <tr key={i} className={`hover:bg-amber-50/20 ${ca.repeatUse ? "bg-gray-50 opacity-60" : ca.createdInMaster ? "bg-green-50/30" : ""}`}>
                              <td className="px-2 py-1.5 text-center font-black text-amber-700">{ca.colorNo}</td>
                              {/* Repeat Use checkbox */}
                              <td className="px-2 py-1.5 text-center">
                                <label className="flex flex-col items-center gap-0.5 cursor-pointer select-none">
                                  <input
                                    type="checkbox"
                                    checked={!!ca.repeatUse}
                                    onChange={e => setCatalogCylAllocs(p => p.map((c, ci) => ci === i ? { ...c, repeatUse: e.target.checked } : c))}
                                    className="w-4 h-4 accent-orange-500 cursor-pointer"
                                  />
                                  {ca.repeatUse && <span className="text-[9px] text-orange-600 font-bold leading-none">Skip</span>}
                                </label>
                              </td>
                              {/* Product Code */}
                              <td className="px-2 py-1.5 text-center">
                                <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-[10px] font-bold font-mono whitespace-nowrap">{pCode}</span>
                              </td>
                              <td className="px-2 py-1.5">
                                <div className="px-2 py-1 text-xs font-semibold text-gray-700 bg-gray-50 border border-gray-200 rounded-lg min-w-[80px] flex items-center gap-1.5">
                                  {catalogColorShades[i]?.colorName || ca.colorName}
                                </div>
                              </td>
                              {/* Cylinder Code */}
                              <td className="px-2 py-1.5">
                                <input className="w-28 text-xs border border-gray-200 rounded-lg px-2 py-1 font-mono outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                                  placeholder="e.g. CYL-001"
                                  value={ca.cylinderNo}
                                  onChange={e => setCatalogCylAllocs(p => p.map((c, ci) => ci === i ? { ...c, cylinderNo: e.target.value } : c))} />
                              </td>
                              {/* Cylinder Width (Print Width) — edit propagates to all rows */}
                              <td className="px-2 py-1.5">
                                <input type="number" className="w-20 text-xs border border-gray-200 rounded-lg px-2 py-1 font-mono outline-none focus:ring-2 focus:ring-amber-400 text-center"
                                  value={ca.printWidth}
                                  onChange={e => setCatalogCylAllocs(p => p.map(c => ({ ...c, printWidth: e.target.value })))} />
                              </td>
                              {/* Circumference — edit propagates to all rows */}
                              <td className="px-2 py-1.5">
                                <input type="number" className="w-20 text-xs border border-indigo-200 rounded-lg px-2 py-1 font-mono outline-none focus:ring-2 focus:ring-indigo-400 text-center bg-indigo-50/40"
                                  value={ca.circumference}
                                  onChange={e => setCatalogCylAllocs(p => p.map(c => ({ ...c, circumference: e.target.value })))} />
                              </td>
                              {/* Repeat UPS */}
                              <td className="px-2 py-1.5 text-center">
                                <span className="px-2 py-0.5 bg-teal-50 text-teal-700 border border-teal-200 rounded-full text-[10px] font-bold">{ca.repeatUPS}×</span>
                              </td>
                              {/* Type */}
                              <td className="px-2 py-1.5">
                                <select className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white outline-none focus:ring-2 focus:ring-amber-400"
                                  value={ca.cylinderType}
                                  onChange={e => setCatalogCylAllocs(p => p.map((c, ci) => ci === i ? { ...c, cylinderType: e.target.value as CylinderAlloc["cylinderType"] } : c))}>
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
                                  onChange={e => setCatalogCylAllocs(p => p.map((c, ci) => ci === i ? { ...c, status: e.target.value as CylinderAlloc["status"] } : c))}>
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
                                  onChange={e => setCatalogCylAllocs(p => p.map((c, ci) => ci === i ? { ...c, remarks: e.target.value } : c))} />
                              </td>
                              {/* Create in Master — single cylinder shared by all colors */}
                              <td className="px-2 py-1.5 text-center">
                                {catalogCylAllocs[0]?.createdInMaster
                                  ? <span className="flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 border border-green-300 rounded-full text-[10px] font-bold whitespace-nowrap"><Check size={10}/> Created</span>
                                  : <button
                                      onClick={openCylinderMaster}
                                      className="px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold rounded-lg transition whitespace-nowrap">
                                      + Create
                                    </button>
                                }
                              </td>
                            </tr>
                          );
                          })}
                          {catalogCylAllocs.length === 0 && (
                            <tr><td colSpan={12} className="p-6 text-center text-gray-400 text-xs">No cylinders. Set No. of Colors in Basic Info tab first.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {catalogCylAllocs.length > 0 && (
                      <div className="flex gap-2 flex-wrap items-center">
                        <span className="text-[10px] text-gray-400 uppercase font-semibold">Status:</span>
                        {(["Pending", "Ordered", "Available", "In Use", "Under Chrome"] as const).map(s => {
                          const cnt = catalogCylAllocs.filter(c => c.status === s).length;
                          return cnt > 0 ? <span key={s} className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${s === "Available" ? "bg-green-50 text-green-700 border-green-200" : s === "In Use" ? "bg-blue-50 text-blue-700 border-blue-200" : s === "Under Chrome" ? "bg-orange-50 text-orange-700 border-orange-200" : s === "Ordered" ? "bg-purple-50 text-purple-700 border-purple-200" : "bg-gray-50 text-gray-500 border-gray-200"}`}>{cnt} {s}</span> : null;
                        })}
                        <span className="ml-auto text-[10px] text-green-700 font-semibold">
                          {catalogCylAllocs[0]?.createdInMaster ? "✓ 1 cylinder created in master" : "1 cylinder — not yet created"}
                        </span>
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

      {/* ══ PRODUCT MASTER SHEET PRINT MODAL ════════════════════ */}
      {printRow && (() => {
        const r = printRow;
        const trim     = r.trimmingSize || 0;
        const cylWidth = r.actualWidth || r.jobWidth || 0;
        const today    = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

        // Use saved plan data from the row
        const savedPlan    = replanAllPlans.find(p => p.planId === r.savedPlanId) || null;
        const colorShades  = (r.savedColorShades as any[]) || [];
        const cylAllocs    = (r.savedCylAllocs   as any[]) || [];

        // Derive plan values
        const planFilmW    = savedPlan ? (savedPlan.filmSize ?? cylWidth) : cylWidth;
        const planCylCirc  = savedPlan ? (savedPlan.cylCirc ?? r.jobHeight ?? 0) : (r.jobHeight ?? 0);
        const planAcUPS    = savedPlan ? (savedPlan.totalUPS ?? "—") : "—";
        const planRepUPS   = savedPlan ? ((savedPlan as any).repeatUPS ?? "—") : "—";
        const planPieces   = savedPlan ? (savedPlan.totalUPS ?? "—") : "—";
        const planSQM      = savedPlan ? (savedPlan.totalRMT * (r.jobWidth / 1000)).toFixed(2) : "—";
        const planWastage  = savedPlan ? (savedPlan.wastage ?? 0) : 0;

        const handlePrint = () => {
          const el = document.getElementById("pms-print-area");
          if (!el) return;
          const w = window.open("", "_blank", "width=960,height=750");
          if (!w) return;
          w.document.write(`<!DOCTYPE html><html><head><title>Product Master Sheet — ${r.catalogNo}</title>
            <style>
              *{margin:0;padding:0;box-sizing:border-box;font-family:Arial,sans-serif;font-size:9.5px;}
              body{padding:10px;color:#000;background:#fff;}
              table{width:100%;border-collapse:collapse;margin-bottom:5px;}
              td,th{border:1px solid #333;padding:3px 5px;vertical-align:middle;}
              th{background:#dce6f1;font-weight:bold;text-align:left;white-space:nowrap;}
              .sec{font-size:10px;font-weight:bold;background:#1e3a5f;color:#fff;padding:3px 6px;margin:7px 0 3px;letter-spacing:.5px;}
              .center{text-align:center;}
              .bold{font-weight:bold;}
              .sign-box{text-align:center;min-width:110px;}
              .sign-line{border-bottom:1px solid #000;height:28px;margin-bottom:3px;}
              @media print{body{padding:5px;} @page{margin:8mm;}}
            </style></head><body>${el.innerHTML}</body></html>`);
          w.document.close();
          w.focus();
          setTimeout(() => { w.print(); }, 400);
        };

        return (
          <Modal open onClose={() => setPrintRow(null)} title={`Product Master Sheet — ${r.catalogNo}`} size="xl">
            <div className="flex justify-end mb-3">
              <button onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-700 hover:bg-indigo-800 text-white text-sm font-bold rounded-xl shadow transition">
                <Printer size={15} /> Print / Save PDF
              </button>
            </div>

            <div id="pms-print-area" className="bg-white text-black text-[10px] p-4 border border-gray-300 rounded-xl font-sans">

              {/* ── Header ── */}
              <div className="flex justify-between items-start border-b-2 border-black pb-2 mb-1">
                <div>
                  <div className="text-[20px] font-black tracking-widest" style={{ color: "#1e3a5f" }}>AJ SHRINK</div>
                  <div className="text-[8px] text-gray-500 font-semibold tracking-wide">FLEXIBLE PACKAGING · GRAVURE PRINTING</div>
                </div>
                <div className="text-center px-4">
                  <div className="text-[16px] font-black tracking-widest uppercase" style={{ color: "#1e3a5f" }}>Product Master Sheet</div>
                  <div className="text-[8px] text-gray-500 mt-0.5">AJSW / PC / PMS / R0</div>
                </div>
                <div className="text-right text-[8.5px] leading-snug">
                  <div><span className="font-bold">Doc No:</span> {r.catalogNo}</div>
                  <div><span className="font-bold">Date:</span> {today}</div>
                  <div><span className="font-bold">Status:</span> {r.status}</div>
                  <div><span className="font-bold">Created:</span> {r.createdDate}</div>
                </div>
              </div>

              {/* ── A. Product Details ── */}
              <div className="text-[9px] font-black uppercase px-2 py-0.5 mb-1 mt-2" style={{ background: "#1e3a5f", color: "#fff", letterSpacing: "0.5px" }}>A. Product Details</div>
              <table className="mb-1">
                <tbody>
                  <tr>
                    <th style={{ width: "16%" }}>Product Name</th>
                    <td colSpan={3} className="font-bold text-[11px]">{r.productName || "—"}</td>
                  </tr>
                  <tr>
                    <th>Customer</th>
                    <td style={{ width: "28%" }}>{r.customerName || "—"}</td>
                    <th style={{ width: "16%" }}>Brand Name</th>
                    <td>{r.brandName || "—"}</td>
                  </tr>
                  <tr>
                    <th>Size (W × H)</th>
                    <td>{r.jobWidth} mm × {r.jobHeight} mm</td>
                    <th>Artwork Name</th>
                    <td>{r.artworkName || "—"}</td>
                  </tr>
                  <tr>
                    <th>Substrate</th>
                    <td>{r.substrate || r.content || "—"}</td>
                    <th>Category</th>
                    <td>{r.categoryName || "—"}</td>
                  </tr>
                  <tr>
                    <th>Pack Size</th>
                    <td>{r.packSize || "—"}</td>
                    <th>SKU Type</th>
                    <td>{r.skuType || "—"}</td>
                  </tr>
                  <tr>
                    <th>Address Type</th>
                    <td>{r.addressType || "—"}</td>
                    <th>Print Type</th>
                    <td>{r.printType || "—"}</td>
                  </tr>
                  <tr>
                    <th>No. of Colors</th>
                    <td>{r.noOfColors} colours ({r.frontColors ?? "—"} F + {r.backColors ?? "—"} B)</td>
                    <th>Trimming</th>
                    <td>{trim > 0 ? `${trim}+${trim} mm` : "—"}</td>
                  </tr>
                  {r.specialSpecs && (
                    <tr><th>Special Specs</th><td colSpan={3}>{r.specialSpecs}</td></tr>
                  )}
                  {r.remarks && (
                    <tr><th>Remarks</th><td colSpan={3}>{r.remarks}</td></tr>
                  )}
                </tbody>
              </table>

              {/* ── B. Production Planning ── */}
              <div className="text-[9px] font-black uppercase px-2 py-0.5 mb-1 mt-2" style={{ background: "#1e3a5f", color: "#fff", letterSpacing: "0.5px" }}>B. Production Planning</div>
              <table className="mb-1">
                <thead>
                  <tr>
                    <th className="text-center">Film Width (mm)</th>
                    <th className="text-center">Cyl. Circumference (mm)</th>
                    <th className="text-center">AC UPS</th>
                    <th className="text-center">Repeat UPS</th>
                    <th className="text-center">Total Pieces</th>
                    <th className="text-center">Total SQM</th>
                    <th className="text-center">Wastage (mm)</th>
                    <th className="text-center">Machine</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="text-center font-bold">{planFilmW}</td>
                    <td className="text-center font-bold">{planCylCirc}</td>
                    <td className="text-center">{planAcUPS}</td>
                    <td className="text-center">{planRepUPS}</td>
                    <td className="text-center">{planPieces}</td>
                    <td className="text-center font-bold">{planSQM}</td>
                    <td className="text-center">{planWastage || "—"}</td>
                    <td className="text-center">{r.machineName || "—"}</td>
                  </tr>
                </tbody>
              </table>

              {/* ── C. Cylinder Allocation ── */}
              <div className="text-[9px] font-black uppercase px-2 py-0.5 mb-1 mt-2" style={{ background: "#1e3a5f", color: "#fff", letterSpacing: "0.5px" }}>C. Cylinder Allocation</div>
              {cylAllocs.length > 0 ? (
                <table className="mb-1">
                  <thead>
                    <tr>
                      <th className="text-center" style={{ width: "4%" }}>#</th>
                      <th style={{ width: "18%" }}>Color Name</th>
                      <th style={{ width: "16%" }}>Cylinder No.</th>
                      <th className="text-center" style={{ width: "12%" }}>Circumference</th>
                      <th className="text-center" style={{ width: "12%" }}>Print Width</th>
                      <th className="text-center" style={{ width: "8%" }}>Rpt UPS</th>
                      <th style={{ width: "12%" }}>Cyl. Type</th>
                      <th style={{ width: "12%" }}>Status</th>
                      <th>Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cylAllocs.map((ca: any, i: number) => (
                      <tr key={i}>
                        <td className="text-center">{i + 1}</td>
                        <td className="font-bold">{ca.colorName || "—"}</td>
                        <td>{ca.cylinderNo || "—"}</td>
                        <td className="text-center">{ca.circumference ? `${ca.circumference} mm` : "—"}</td>
                        <td className="text-center">{ca.printWidth ? `${ca.printWidth} mm` : "—"}</td>
                        <td className="text-center">{ca.repeatUPS ?? "—"}</td>
                        <td>{ca.cylinderType || "—"}</td>
                        <td>{ca.status || "—"}</td>
                        <td>{ca.remarks || ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="mb-1">
                  <thead>
                    <tr>
                      <th className="text-center" style={{ width: "4%" }}>#</th>
                      <th style={{ width: "20%" }}>Color Name</th>
                      <th style={{ width: "18%" }}>Cylinder No.</th>
                      <th className="text-center">Circumference</th>
                      <th className="text-center">Print Width</th>
                      <th className="text-center">Rpt UPS</th>
                      <th>Type</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: r.noOfColors || 4 }, (_, i) => (
                      <tr key={i}>
                        <td className="text-center">{i + 1}</td>
                        <td></td><td></td><td></td><td></td><td></td><td></td><td></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* ── D. Color Shade & LAB ── */}
              <div className="text-[9px] font-black uppercase px-2 py-0.5 mb-1 mt-2" style={{ background: "#1e3a5f", color: "#fff", letterSpacing: "0.5px" }}>D. Color Shade &amp; LAB Standards</div>
              {colorShades.length > 0 ? (
                <table className="mb-1">
                  <thead>
                    <tr>
                      <th className="text-center" style={{ width: "4%" }}>#</th>
                      <th style={{ width: "22%" }}>Ink Item</th>
                      <th style={{ width: "14%" }}>Color Name</th>
                      <th style={{ width: "10%" }}>Type</th>
                      <th style={{ width: "12%" }}>Pantone Ref</th>
                      <th className="text-center" style={{ width: "6%" }}>L*</th>
                      <th className="text-center" style={{ width: "6%" }}>A*</th>
                      <th className="text-center" style={{ width: "6%" }}>B*</th>
                      <th>Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {colorShades.map((cs: any, i: number) => {
                      const inkItem = items.find((x: any) => x.id === cs.inkItemId);
                      return (
                        <tr key={i}>
                          <td className="text-center">{i + 1}</td>
                          <td>{inkItem?.name || cs.inkItemId || "—"}</td>
                          <td className="font-bold">{cs.colorName || "—"}</td>
                          <td>{cs.inkType || "—"}</td>
                          <td>{cs.pantoneRef || "—"}</td>
                          <td className="text-center">{cs.labL || "—"}</td>
                          <td className="text-center">{cs.labA || "—"}</td>
                          <td className="text-center">{cs.labB || "—"}</td>
                          <td>{cs.remarks || ""}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <table className="mb-1">
                  <thead>
                    <tr>
                      <th className="text-center" style={{ width: "4%" }}>#</th>
                      <th style={{ width: "22%" }}>Ink Item</th>
                      <th style={{ width: "14%" }}>Color Name</th>
                      <th style={{ width: "10%" }}>Type</th>
                      <th style={{ width: "12%" }}>Pantone Ref</th>
                      <th className="text-center">L*</th>
                      <th className="text-center">A*</th>
                      <th className="text-center">B*</th>
                      <th>Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: r.noOfColors || 4 }, (_, i) => (
                      <tr key={i}>
                        <td className="text-center">{i + 1}</td>
                        <td></td><td></td><td></td><td></td>
                        <td></td><td></td><td></td><td></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* ── E. Ply / Structure ── */}
              {r.secondaryLayers && r.secondaryLayers.length > 0 && (
                <>
                  <div className="text-[9px] font-black uppercase px-2 py-0.5 mb-1 mt-2" style={{ background: "#1e3a5f", color: "#fff", letterSpacing: "0.5px" }}>E. Ply / Structure Details</div>
                  <table className="mb-1">
                    <thead>
                      <tr>
                        <th style={{ width: "4%" }}>#</th>
                        <th style={{ width: "12%" }}>Ply Type</th>
                        <th style={{ width: "22%" }}>Film / Material</th>
                        <th className="text-center" style={{ width: "8%" }}>GSM</th>
                        <th>Consumables</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.secondaryLayers.map((l, li) => {
                        const consumablesSummary = l.consumableItems
                          .filter((ci: any) => ci.itemName || ci.itemSubGroup)
                          .map((ci: any) => `${ci.itemName || ci.itemSubGroup} (${ci.gsm ?? 0} ${ci.itemGroup === "Ink" ? "GSM" : ci.itemGroup === "Solvent" ? "%" : "GSM"})`)
                          .join(" · ");
                        return (
                          <tr key={li}>
                            <td className="text-center">{li + 1}</td>
                            <td className="font-bold">{l.plyType || "—"}</td>
                            <td>{l.itemSubGroup || l.plyType || "—"}</td>
                            <td className="text-center">{l.gsm || "—"}</td>
                            <td className="text-[8.5px]">{consumablesSummary || "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </>
              )}

              {/* ── F. Slitting & Packing ── */}
              <div className="text-[9px] font-black uppercase px-2 py-0.5 mb-1 mt-2" style={{ background: "#1e3a5f", color: "#fff", letterSpacing: "0.5px" }}>F. Slitting &amp; Packing</div>
              <div className="grid grid-cols-2 gap-2 mb-1">
                <table>
                  <tbody>
                    <tr><th style={{ width: "50%" }}>Slitting Width</th><td>{cylWidth} mm</td></tr>
                    <tr><th>Trimming</th><td>{trim > 0 ? `${trim}+${trim} mm` : "—"}</td></tr>
                    <tr><th>Core Type</th><td>3&quot; Paper Core</td></tr>
                    <tr><th>Order Ref</th><td>{r.sourceOrderNo || "—"}</td></tr>
                  </tbody>
                </table>
                <table>
                  <tbody>
                    <tr><th style={{ width: "50%" }}>Pack Size</th><td>{r.packSize || "—"}</td></tr>
                    <tr><th>SKU Type</th><td>{r.skuType || "—"}</td></tr>
                    <tr><th>Address Type</th><td>{r.addressType || "—"}</td></tr>
                    <tr><th>Standard Qty</th><td>{(r.standardQty || 0).toLocaleString()} {r.standardUnit}</td></tr>
                  </tbody>
                </table>
              </div>

              {/* ── Signatures ── */}
              <div className="flex justify-between mt-4 pt-3 border-t-2 border-black">
                {["Prepared by", "Reviewed by", "Approved by", "Customer Sign"].map(label => (
                  <div key={label} className="text-center" style={{ minWidth: 100 }}>
                    <div className="border-b border-black mb-1" style={{ height: 30 }}></div>
                    <div className="text-[8px] font-bold">{label}</div>
                  </div>
                ))}
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
        const sTypeGuide = (replanForm as any).structureType || "Label";
        const jobH    = replanForm.jobHeight || 0;
        const jobW    = sTypeGuide === "Sleeve" ? (replanForm.jobWidth || 0) : (replanForm.actualWidth || replanForm.jobWidth || 0);
        const shrink  = replanForm.widthShrinkage || 0;
        const trim    = replanForm.trimmingSize   || 0;
        // For Sleeve: shrink is circumferential — does NOT affect lane width
        // For Label/Pouch: shrink is on repeat length — does NOT affect lane width either
        const laneW   = jobW;
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
                  { l: "Trimming",    v: trim > 0 ? `${trim}+${trim} mm` : "—", cls: "bg-orange-50 text-orange-700 border-orange-200" },
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
        const plan      = upsPreviewPlan as any;
        const sTypePrev = (replanForm as any).structureType || "Label";
        const isSleeve  = sTypePrev === "Sleeve";
        const jobW      = isSleeve ? (replanForm.jobWidth || 0) : (replanForm.actualWidth || replanForm.jobWidth || 0);
        const shrink    = replanForm.widthShrinkage || 0;
        const slvTransp = isSleeve ? ((replanForm as any).transparentArea || 0) : 0;
        const slvSeam   = isSleeve ? ((replanForm as any).seamingArea   || 0) : 0;
        // Sleeve on film: 1 AC UPS = layflat×2 + transparentArea + seamingArea
        const sleeveFilmWidth = isSleeve ? (jobW * 2 + slvTransp + slvSeam) : 0;
        // Trim applies to both sleeve and label/pouch
        const trim      = replanForm.trimmingSize || 0;
        const filmW      = plan.filmSize as number;
        // Always trust plan.acUps — planning engine already uses correct laneWidth
        const acUps      = plan.acUps as number;
        const contentPrev   = (replanForm as any).content || "";
        const gussetPrev    = (replanForm as any).gusset      || 0;
        const topSealPrev   = (replanForm as any).topSeal     || 0;
        const btmSealPrev   = (replanForm as any).bottomSeal  || 0;
        const sideSealPrev  = (replanForm as any).sideSeal    || 0;
        const ctrSealPrev   = (replanForm as any).centerSealWidth || 0;
        const sideGussetPrev= (replanForm as any).sideGusset  || 0;
        // effRepeat = one row height in diagram
        // Sleeve → cutting length per repeat = cylCirc / repeatUPS (from selected plan)
        // Pouches → per-type formula (same as planning engine)
        let effRepeat: number;
        if (isSleeve) {
          effRepeat = (plan.cylCirc as number) / (plan.repeatUPS as number);
        } else if (contentPrev === "Pouch — 3 Side Seal" || contentPrev === "Pouch — Center Seal" || contentPrev === "Both Side Gusset Pouch") {
          effRepeat = (replanForm.jobHeight || 0) + topSealPrev + btmSealPrev + shrink;
        } else if (contentPrev === "Standup Pouch" || contentPrev === "Zipper Pouch" || contentPrev === "3D Pouch / Flat Bottom") {
          effRepeat = (replanForm.jobHeight || 0) + topSealPrev + (gussetPrev > 0 ? gussetPrev / 2 : 0) + shrink;
        } else {
          effRepeat = (replanForm.jobHeight || 0) + shrink;
        }
        // Lane width shown in diagram
        let diagLaneW: number;
        if (isSleeve) {
          diagLaneW = jobW * 2 + slvTransp + slvSeam;
        } else if (contentPrev === "Pouch — 3 Side Seal" || contentPrev === "Standup Pouch" || contentPrev === "Zipper Pouch") {
          diagLaneW = jobW + 2 * sideSealPrev;
        } else if (contentPrev === "Pouch — Center Seal") {
          diagLaneW = jobW * 2 + ctrSealPrev;
        } else if (contentPrev === "Both Side Gusset Pouch" || contentPrev === "3D Pouch / Flat Bottom") {
          diagLaneW = jobW + 2 * sideGussetPrev;
        } else {
          diagLaneW = jobW;
        }
        // pixel scaling: fit into ~640px canvas
        const CANVAS = 640;
        const scale  = filmW > 0 ? CANVAS / filmW : 1;
        const toW    = (mm: number) => Math.max(mm * scale, mm > 0 ? 2 : 0);
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
                {(() => {
                  const dc = (replanForm.jobWidth * 2) + slvSeam + slvTransp; // design circ = width only
                  const baseStats = [
                    { l: "Film Width",   v: `${filmW} mm`,         cls: "bg-indigo-50 text-indigo-700 border-indigo-200" },
                    { l: "AC UPS",       v: String(acUps),          cls: "bg-purple-50 text-purple-700 border-purple-200" },
                    { l: "Layflat",      v: `${jobW} mm`,           cls: "bg-blue-50 text-blue-700 border-blue-200" },
                  ];
                  const cutLen   = replanForm.jobHeight || 0;
                  const cutWithShrink = cutLen + shrink;
                  const sleeveStats = isSleeve ? [
                    { l: "Design Circ",   v: (() => { const p=[`${jobW}×2`]; if(slvTransp>0)p.push(`+${slvTransp}`); if(slvSeam>0)p.push(`+${slvSeam}`); return `${p.join("")} = ${dc} mm`; })(), cls: "bg-blue-100 text-blue-800 border-blue-300" },
                    { l: "Cut Length",    v: shrink > 0 ? `${cutLen}+${shrink} = ${cutWithShrink} mm` : `${cutLen} mm`, cls: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200" },
                    { l: "Repeat Count",  v: `${plan.repeatUPS}×`,                                    cls: "bg-teal-50 text-teal-700 border-teal-200" },
                    { l: "Cyl. Circ",     v: `${cutWithShrink}×${plan.repeatUPS} = ${plan.cylCirc} mm`, cls: "bg-emerald-50 text-emerald-800 border-emerald-300" },
                  ] : [
                    { l: "Repeat Shrink", v: shrink > 0 ? `+${shrink} mm` : "—",           cls: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200" },
                    { l: "Trimming",      v: trim > 0 ? `${trim}+${trim} mm` : "—",         cls: "bg-orange-50 text-orange-700 border-orange-200" },
                    { l: "Repeat UPS",    v: String(plan.repeatUPS),                         cls: "bg-teal-50 text-teal-700 border-teal-200" },
                    { l: "Cyl. Circ",     v: `${plan.cylCirc} mm`,                          cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
                  ];
                  return [...baseStats, ...sleeveStats,
                    { l: "Total Pieces", v: String(plan.totalUPS),  cls: "bg-green-50 text-green-700 border-green-200" },
                    { l: "Cylinder",     v: plan.cylinderCode,      cls: "bg-violet-50 text-violet-700 border-violet-200" },
                  ];
                })().map(s => (
                  <div key={s.l} className={`px-2.5 py-1.5 rounded-lg border font-medium ${s.cls}`}>
                    <span className="opacity-60 text-[10px] uppercase tracking-wider block leading-none mb-0.5">{s.l}</span>
                    <span className="font-bold">{s.v}</span>
                  </div>
                ))}
              </div>

              {/* ── Combined 2D Layout Diagram ── */}
              {(() => {
                const repeatUPS = plan.repeatUPS as number;
                const cylCirc   = plan.cylCirc   as number;
                const jobH      = sTypePrev === "Sleeve" ? (replanForm.jobWidth * 2) : (replanForm.jobHeight || 0);

                // SVG canvas
                const SVG_W = 730;   // extra 70px right for height arrow
                const SVG_H = 430;   // extra top space for double arrows in sleeve
                const RULER_LEFT  = isSleeve ? 50 : 36;  // sleeve needs more top space for 2 arrow rows
                const RULER_BTM   = 22;
                const drawW = 660 - RULER_LEFT;
                const drawH = 360 - RULER_BTM;

                // diagramAcUps = plan.acUps (trusted). diagramFilmW = plan.filmSize (trusted).
                const diagramAcUps = acUps;
                const diagramFilmW = filmW;

                // scale to fit filmW exactly in drawW
                const sx = (mm: number) => mm * (drawW / filmW);
                const sy = (mm: number) => mm * (drawH / cylCirc);

                // column x positions
                const trimPx   = sx(trim);
                // Lane pixel width: Sleeve = layflat×2+T+S, Pouch = diagLaneW (includes seals/gussets), Label = jobW
                const lanePx   = isSleeve ? sx(sleeveFilmWidth) : sx(diagLaneW);
                const transpPx = sx(slvTransp);
                const lfPx     = sx(jobW);          // one side (front or back)
                const seamPx   = sx(slvSeam);

                // repeat row heights
                const repPx  = sy(effRepeat);

                // colours
                const C_TRIM  = "#fed7aa";
                const C_LANE  = ["#dbeafe", "#bfdbfe"]; // alternating lane blues
                const C_DASH  = "#6366f1";
                const C_LABEL = "#1e40af";

                return (
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3">
                      Full Layout — {acUps} AC UPS × {repeatUPS} Repeat = {plan.totalUPS} Total Pieces &nbsp;|&nbsp;
                      Film {filmW}mm × Cyl. Circ {cylCirc}mm
                      {isSleeve && ` (Cut Length ${effRepeat}mm × ${repeatUPS} = ${cylCirc}mm)`}
                    </p>

                    <svg width={SVG_W} height={SVG_H} className="w-full" viewBox={`0 0 ${SVG_W} ${SVG_H}`}>
                      <defs>
                        <pattern id="hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                          <line x1="0" y1="0" x2="0" y2="5" stroke="#f97316" strokeWidth="1.5" opacity="0.4"/>
                        </pattern>
                        {/* Arrowhead markers for dimension lines */}
                        <marker id="dim-end" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
                          <path d="M0,0.5 L6,3.5 L0,6.5 Z" fill="#374151"/>
                        </marker>
                        <marker id="dim-start" markerWidth="7" markerHeight="7" refX="1" refY="3.5" orient="auto-start-reverse">
                          <path d="M0,0.5 L6,3.5 L0,6.5 Z" fill="#374151"/>
                        </marker>
                      </defs>

                      {/* ── Draw each repeat row ── */}
                      {Array.from({ length: repeatUPS }, (_, ri) => {
                        const ry = RULER_LEFT + ri * repPx;
                        let cx = 0;
                        const cells = [];

                        // left trim
                        if (trim > 0) {
                          cells.push(<rect key={`lt-${ri}`} x={cx} y={ry} width={trimPx} height={repPx} fill={C_TRIM} stroke="#f97316" strokeWidth={0.5} />);
                        }
                        cx += trimPx;

                        // job lanes (sleeve uses diagramAcUps to prevent overflow)
                        for (let li = 0; li < diagramAcUps; li++) {
                          const laneStartX = cx;

                          if (isSleeve) {
                            // ── SLEEVE CELL: flat film layout ──
                            // 1 AC UPS on film = [TRANSPARENT | FRONT(lf) | BACK(lf) | SEAM]
                            // total lane = transpPx + lfPx + lfPx + seamPx = lanePx
                            const lx        = laneStartX;
                            const frontX    = lx + transpPx;
                            const foldX     = frontX + lfPx;
                            const seamX     = foldX + lfPx;
                            const C_FRONT   = "#dbeafe";
                            const C_BACK    = "#bfdbfe";
                            const C_TRANSP  = "#f0f9ff";   // light cyan for transparent area
                            const C_SEAM    = "#fef3c7";   // light amber for seaming area

                            cells.push(
                              <g key={`l-${ri}-${li}`}>
                                {/* cut line LEFT edge (outer boundary) */}
                                <line x1={lx} y1={ry} x2={lx} y2={ry + repPx}
                                  stroke="#ef4444" strokeWidth={1.5} strokeDasharray="4 2" />

                                {/* TRANSPARENT zone */}
                                {transpPx > 0 && (
                                  <rect x={lx} y={ry} width={transpPx} height={repPx}
                                    fill={C_TRANSP} stroke="#0ea5e9" strokeWidth={0.4} strokeDasharray="3 2" />
                                )}
                                {transpPx > 8 && repPx > 16 && (
                                  <text x={lx + transpPx / 2} y={ry + repPx / 2 + 3}
                                    textAnchor="middle" fontSize={Math.min(6, transpPx / 3)} fill="#0369a1" fontWeight="700" opacity={0.8}>
                                    {transpPx > 14 ? "T" : ""}
                                  </text>
                                )}

                                {/* FRONT lane */}
                                <rect x={frontX} y={ry} width={lfPx} height={repPx}
                                  fill={C_FRONT} stroke="none" />
                                {lfPx > 10 && repPx > 16 && (
                                  <text x={frontX + lfPx / 2} y={ry + repPx / 2 + 3}
                                    textAnchor="middle" fontSize={Math.min(7, lfPx / 4)} fill="#1d4ed8" fontWeight="700" opacity={0.8}>
                                    {lfPx > 20 ? "FRONT" : "F"}
                                  </text>
                                )}

                                {/* FOLD line (tube seam) */}
                                <line x1={foldX} y1={ry} x2={foldX} y2={ry + repPx}
                                  stroke="#7c3aed" strokeWidth={1.2} strokeDasharray="5 2" />

                                {/* BACK lane */}
                                <rect x={foldX} y={ry} width={lfPx} height={repPx}
                                  fill={C_BACK} stroke="none" />
                                {lfPx > 10 && repPx > 16 && (
                                  <text x={foldX + lfPx / 2} y={ry + repPx / 2 + 3}
                                    textAnchor="middle" fontSize={Math.min(7, lfPx / 4)} fill="#1e40af" fontWeight="700" opacity={0.8}>
                                    {lfPx > 20 ? "BACK" : "B"}
                                  </text>
                                )}

                                {/* SEAMING zone */}
                                {seamPx > 0 && (
                                  <rect x={seamX} y={ry} width={seamPx} height={repPx}
                                    fill={C_SEAM} stroke="#d97706" strokeWidth={0.4} strokeDasharray="3 2" />
                                )}
                                {seamPx > 8 && repPx > 16 && (
                                  <text x={seamX + seamPx / 2} y={ry + repPx / 2 + 3}
                                    textAnchor="middle" fontSize={Math.min(6, seamPx / 3)} fill="#92400e" fontWeight="700" opacity={0.8}>
                                    {seamPx > 14 ? "S" : ""}
                                  </text>
                                )}

                                {/* cut line RIGHT edge */}
                                <line x1={lx + lanePx} y1={ry} x2={lx + lanePx} y2={ry + repPx}
                                  stroke="#ef4444" strokeWidth={1.5} strokeDasharray="4 2" />
                                {/* outer border */}
                                <rect x={lx} y={ry} width={lanePx} height={repPx}
                                  fill="none" stroke="#3b82f6" strokeWidth={0.5} />

                                {/* Dimension arrows — first row only */}
                                {ri === 0 && lanePx > 16 && (() => {
                                  const ay1 = ry - 8;   // full lane arrow
                                  const ay2 = ry - 18;  // FRONT/BACK sub-arrows
                                  return (
                                    <g>
                                      {/* Full lane arrow — sleeveFilmWidth */}
                                      <line x1={lx + 2} y1={ay1} x2={lx + lanePx - 2} y2={ay1}
                                        stroke="#1e3a8a" strokeWidth="1.4"
                                        markerStart="url(#dim-start)" markerEnd="url(#dim-end)" />
                                      <rect x={lx + lanePx / 2 - 22} y={ay1 - 6} width={44} height={10}
                                        fill="rgba(255,255,255,0.95)" rx={2} />
                                      <text x={lx + lanePx / 2} y={ay1 + 2}
                                        textAnchor="middle" fontSize={7} fill="#1e3a8a" fontWeight="800">
                                        {sleeveFilmWidth}mm
                                      </text>
                                      {/* FRONT sub-arrow */}
                                      {lfPx > 16 && (
                                        <>
                                          <line x1={frontX + 1} y1={ay2} x2={frontX + lfPx - 1} y2={ay2}
                                            stroke="#1d4ed8" strokeWidth="0.9"
                                            markerStart="url(#dim-start)" markerEnd="url(#dim-end)" />
                                          <rect x={frontX + lfPx / 2 - 14} y={ay2 - 5} width={28} height={9}
                                            fill="rgba(255,255,255,0.9)" rx={2} />
                                          <text x={frontX + lfPx / 2} y={ay2 + 2}
                                            textAnchor="middle" fontSize={6} fill="#1d4ed8" fontWeight="700">
                                            {jobW}mm
                                          </text>
                                        </>
                                      )}
                                      {/* BACK sub-arrow */}
                                      {lfPx > 16 && (
                                        <>
                                          <line x1={foldX + 1} y1={ay2} x2={foldX + lfPx - 1} y2={ay2}
                                            stroke="#1e40af" strokeWidth="0.9"
                                            markerStart="url(#dim-start)" markerEnd="url(#dim-end)" />
                                          <rect x={foldX + lfPx / 2 - 14} y={ay2 - 5} width={28} height={9}
                                            fill="rgba(255,255,255,0.9)" rx={2} />
                                          <text x={foldX + lfPx / 2} y={ay2 + 2}
                                            textAnchor="middle" fontSize={6} fill="#1e40af" fontWeight="700">
                                            {jobW}mm
                                          </text>
                                        </>
                                      )}
                                    </g>
                                  );
                                })()}
                              </g>
                            );
                            cx += lanePx; // 1 AC UPS = layflat×2 + transparent + seam on film
                          } else {
                            // ── LABEL / POUCH CELL ──
                            const bg = C_LANE[li % 2];
                            cells.push(
                              <g key={`l-${ri}-${li}`}>
                                <rect x={cx} y={ry} width={lanePx} height={repPx} fill={bg} stroke="#6366f1" strokeWidth={0.4} />
                                {lanePx > 30 && repPx > 18 && (() => {
                                  const ax1 = laneStartX + 5;
                                  const ax2 = laneStartX + lanePx - 5;
                                  const ay  = ry + repPx / 2;
                                  return (
                                    <g>
                                      <line x1={ax1} y1={ay} x2={ax2} y2={ay}
                                        stroke="#1e40af" strokeWidth="1.3"
                                        markerStart="url(#dim-start)" markerEnd="url(#dim-end)" />
                                      <rect x={laneStartX + lanePx / 2 - 22} y={ay - 8} width={44} height={12} fill="rgba(255,255,255,0.85)" rx={2} />
                                      <text x={laneStartX + lanePx / 2} y={ay + 3} textAnchor="middle" fontSize={8} fill="#1e40af" fontWeight="700">
                                        {diagLaneW} mm
                                      </text>
                                    </g>
                                  );
                                })()}
                              </g>
                            );
                          }
                          if (!isSleeve) cx += lanePx; // Sleeve cx already incremented above (lanePx×2)
                        }

                        // right trim
                        if (trim > 0) {
                          cells.push(<rect key={`rt-${ri}`} x={cx} y={ry} width={trimPx} height={repPx} fill={C_TRIM} stroke="#f97316" strokeWidth={0.5} />);
                          cx += trimPx;
                        }

                        // repeat boundary dashed line
                        const dashLine = ri < repeatUPS - 1
                          ? <line key={`dh-${ri}`} x1={0} y1={ry + repPx} x2={cx} y2={ry + repPx} stroke={C_DASH} strokeWidth={1} strokeDasharray="4 3" />
                          : null;

                        // Left ruler — height = Design Circ per sleeve
                        const rulerLabel = repPx > 20 ? (
                          <g key={`rl-${ri}`}>
                            <line x1={15} y1={ry + 4} x2={15} y2={ry + repPx - 4}
                              stroke={isSleeve ? "#1d4ed8" : "#374151"} strokeWidth="1.3"
                              markerStart="url(#dim-start)" markerEnd="url(#dim-end)" />
                            <rect x={1} y={ry + repPx / 2 - 30} width={14} height={60} fill="white" />
                            <text x={15} y={ry + repPx / 2} textAnchor="middle"
                              fontSize={7} fill={isSleeve ? "#1d4ed8" : "#111827"} fontWeight="700"
                              transform={`rotate(-90, 15, ${ry + repPx / 2})`}>
                              {isSleeve ? `Cut ${effRepeat}mm` : `${effRepeat}mm`}
                            </text>
                          </g>
                        ) : null;

                        return [rulerLabel, ...cells, dashLine];
                      })}

                      {/* bottom ruler last tick — intentionally blank (arrows carry the labels) */}

                      {/* ── Bottom ruler (width) ── */}
                      {(() => {
                        const ry = RULER_LEFT + repeatUPS * repPx + 4;
                        let cx = 0;
                        const ticks = [];
                        // 0
                        ticks.push(<text key="t0" x={cx} y={ry + 8} fontSize={7} fill="#9ca3af">0</text>);
                        if (trim > 0) {
                          cx += trimPx;
                          ticks.push(<text key="tt" x={cx} y={ry + 8} fontSize={7} fill="#f97316" textAnchor="middle">{trim}</text>);
                        }
                        for (let li = 0; li <= diagramAcUps; li++) {
                          const xmm = trim + li * (isSleeve ? sleeveFilmWidth : diagLaneW);
                          const xpx = sx(xmm);
                          ticks.push(
                            <g key={`bt-${li}`}>
                              <line x1={xpx} y1={ry - 2} x2={xpx} y2={ry + 2} stroke="#9ca3af" strokeWidth={0.8} />
                              {(li === 0 || li === diagramAcUps || li === Math.floor(diagramAcUps / 2)) && (
                                <text x={xpx} y={ry + 9} fontSize={7} fill="#6b7280" textAnchor="middle">{xmm}</text>
                              )}
                            </g>
                          );
                        }
                        ticks.push(<text key="total" x={sx(diagramFilmW)} y={ry + 9} fontSize={7} fill="#6b7280" textAnchor="end">{diagramFilmW}mm</text>);
                        return ticks;
                      })()}

                      {/* ── Bottom horizontal dimension arrow — Total Film Width ── */}
                      {(() => {
                        const arrowY = RULER_LEFT + repeatUPS * repPx + RULER_BTM + 14;
                        const midX   = drawW / 2;
                        return (
                          <g>
                            <line x1={0} y1={arrowY} x2={drawW} y2={arrowY}
                              stroke="#374151" strokeWidth="1.4"
                              markerStart="url(#dim-start)" markerEnd="url(#dim-end)" />
                            {/* end tick lines */}
                            <line x1={0} y1={arrowY - 6} x2={0} y2={arrowY + 6} stroke="#374151" strokeWidth="1" />
                            <line x1={drawW} y1={arrowY - 6} x2={drawW} y2={arrowY + 6} stroke="#374151" strokeWidth="1" />
                            <rect x={midX - 42} y={arrowY - 7} width={84} height={13} fill="white" />
                            <text x={midX} y={arrowY + 4} textAnchor="middle" fontSize={10} fill="#111827" fontWeight="700">
                              Total Film Width: {diagramFilmW} mm
                            </text>
                          </g>
                        );
                      })()}

                      {/* ── Right vertical dimension arrow — Cylinder Circumference ── */}
                      {(() => {
                        const arrX = drawW + 34;
                        const y1   = RULER_LEFT;
                        const y2   = RULER_LEFT + repeatUPS * repPx;
                        const midY = (y1 + y2) / 2;
                        return (
                          <g>
                            <line x1={arrX} y1={y1} x2={arrX} y2={y2}
                              stroke="#374151" strokeWidth="1.4"
                              markerStart="url(#dim-start)" markerEnd="url(#dim-end)" />
                            {/* end tick lines */}
                            <line x1={arrX - 6} y1={y1} x2={arrX + 6} y2={y1} stroke="#374151" strokeWidth="1" />
                            <line x1={arrX - 6} y1={y2} x2={arrX + 6} y2={y2} stroke="#374151" strokeWidth="1" />
                            <rect x={arrX - 6} y={midY - 38} width={12} height={76} fill="white" />
                            <text x={arrX} y={midY} textAnchor="middle" fontSize={10} fill="#111827" fontWeight="700"
                              transform={`rotate(-90, ${arrX}, ${midY})`}>
                              Cyl. Circ: {cylCirc} mm
                            </text>
                          </g>
                        );
                      })()}
                    </svg>

                    {/* Legend */}
                    <div className="flex flex-wrap gap-3 mt-3 pt-2 border-t border-gray-200">
                      {[
                        ...(isSleeve ? [
                          ...(trim > 0 ? [{ color: "#fed7aa", border: "#f97316", label: `Trim both sides — ${trim}mm each` }] : []),
                          ...(slvTransp > 0 ? [{ color: "#f0f9ff", border: "#0ea5e9", label: `Transparent area — ${slvTransp}mm (left edge of sleeve)` }] : []),
                          { color: "#dbeafe", border: "#3b82f6", label: `FRONT face — ${jobW}mm (Layflat = single side width)` },
                          { color: "#bfdbfe", border: "#3b82f6", label: `BACK face — ${jobW}mm. Total per sleeve = ${jobW}+${jobW} = ${jobW*2}mm (Design Circ without shrink)` },
                          ...(slvSeam > 0 ? [{ color: "#fef3c7", border: "#d97706", label: `Seaming area — ${slvSeam}mm (right edge of sleeve)` }] : []),
                          { color: "white",   border: "#ef4444", label: `Cut line — vertical, at sleeve outer edges` },
                          { color: "white",   border: "#7c3aed", label: `Fold line — vertical centre between FRONT & BACK (tube seam, width dir)` },
                        ] : [
                          { color: "#dbeafe", border: "#6366f1", label: `Job cell — ${diagLaneW}mm wide × ${effRepeat}mm repeat length` },
                          ...(trim > 0 ? [{ color: C_TRIM, border: "#f97316", label: `Trim both sides (${trim}mm each)` }] : []),
                        ]),
                        ...(shrink > 0 ? [{ color: "#fae8ff", border: "#a21caf", label: isSleeve
                            ? `Length Shrinkage +${shrink}mm per sleeve (cutting length direction)`
                            : `Shrinkage +${shrink}mm on repeat length` }] : []),
                      ].map(l => (
                        <div key={l.label} className="flex items-center gap-1.5">
                          <div className="w-4 h-4 rounded border-2 flex-shrink-0" style={{ background: l.color, borderColor: l.border }} />
                          <span className="text-[11px] text-gray-600">{l.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Width (Film) Lane-by-Lane breakdown */}
              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">UPS-by-UPS Breakdown — Width Direction</p>
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
                          <td className="px-3 py-1.5 text-gray-500">
                            {i + 1} UPS
                            {isSleeve && <span className="ml-1 text-[10px] text-gray-400">(LF×2+T+S)</span>}
                          </td>
                          <td className="px-3 py-1.5">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ background: "#e0e7ff", color: "#4338ca" }}>
                              {isSleeve ? "Sleeve Lane (LF×2+T+S)" : diagLaneW !== jobW ? `Pouch Lane (W+seals/gusset)` : "Job Width"}
                            </span>
                          </td>
                          <td className="px-3 py-1.5 font-mono font-bold text-indigo-600">
                            {isSleeve ? sleeveFilmWidth : diagLaneW}
                          </td>
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
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                  {sTypePrev === "Sleeve" ? "Repeat UPS Breakdown — Circumference Direction" : "Repeat UPS Breakdown — Repeat Length Direction"}
                </p>
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
                      {sTypePrev === "Sleeve" ? (() => {
                        const cutLen   = replanForm.jobHeight || 0;
                        const slvCutWithShrink = cutLen + shrink;
                        const rCount   = plan.repeatUPS as number;
                        const cylC     = plan.cylCirc as number;
                        return (
                        <>
                          <tr>
                            <td className="px-3 py-1.5 text-gray-600">Cutting Length</td>
                            <td className="px-3 py-1.5 font-mono font-bold text-indigo-700">{cutLen} mm</td>
                            <td className="px-3 py-1.5 text-gray-400 text-[10px]">As entered — sleeve height after cutting</td>
                          </tr>
                          {shrink > 0 && (
                            <tr>
                              <td className="px-3 py-1.5 text-gray-600">+ Length Shrinkage</td>
                              <td className="px-3 py-1.5 font-mono font-bold text-fuchsia-600">+{shrink} mm</td>
                              <td className="px-3 py-1.5 text-gray-400 text-[10px]">Added to cutting length before cylinder sizing</td>
                            </tr>
                          )}
                          <tr className="bg-blue-50">
                            <td className="px-3 py-1.5 font-bold text-blue-800">= Cylinder Repeat (per sleeve)</td>
                            <td className="px-3 py-1.5 font-mono font-bold text-blue-700">{slvCutWithShrink} mm</td>
                            <td className="px-3 py-1.5 text-blue-600 text-[10px]">{cutLen}{shrink > 0 ? `+${shrink}` : ""} = {slvCutWithShrink}mm per sleeve length</td>
                          </tr>
                          <tr>
                            <td className="px-3 py-1.5 text-gray-600">× Repeat Count (N)</td>
                            <td className="px-3 py-1.5 font-mono font-bold text-purple-700">× {rCount}</td>
                            <td className="px-3 py-1.5 text-gray-400 text-[10px]">{rCount === 1 ? "1 sleeve per revolution" : `${rCount} sleeves per revolution`}</td>
                          </tr>
                          <tr className="bg-teal-50 border-t-2 border-teal-200">
                            <td className="px-3 py-1.5 font-bold text-teal-800">= Cylinder Circumference</td>
                            <td className="px-3 py-1.5 font-mono font-bold text-teal-700">{cylC} mm</td>
                            <td className="px-3 py-1.5 text-teal-600 text-[10px]">{slvCutWithShrink}mm × {rCount} = {cylC}mm — {cylC} % {slvCutWithShrink} = {cylC % slvCutWithShrink === 0 ? "0 ✓" : `${cylC % slvCutWithShrink} ✗`}</td>
                          </tr>
                        </>
                        );
                      })() : (
                        <>
                          <tr>
                            <td className="px-3 py-1.5 text-gray-600">Pouch / Repeat Height</td>
                            <td className="px-3 py-1.5 font-mono font-bold text-indigo-700">{replanForm.jobHeight || 0} mm</td>
                            <td className="px-3 py-1.5 text-gray-400 text-[10px]">As entered</td>
                          </tr>
                          {topSealPrev > 0 && (
                            <tr>
                              <td className="px-3 py-1.5 text-gray-600">+ Top Seal</td>
                              <td className="px-3 py-1.5 font-mono font-bold text-orange-600">+{topSealPrev} mm</td>
                              <td className="px-3 py-1.5 text-gray-400 text-[10px]">Top seal added to repeat</td>
                            </tr>
                          )}
                          {btmSealPrev > 0 && (contentPrev === "Pouch — 3 Side Seal" || contentPrev === "Pouch — Center Seal" || contentPrev === "Both Side Gusset Pouch") && (
                            <tr>
                              <td className="px-3 py-1.5 text-gray-600">+ Bottom Seal</td>
                              <td className="px-3 py-1.5 font-mono font-bold text-orange-600">+{btmSealPrev} mm</td>
                              <td className="px-3 py-1.5 text-gray-400 text-[10px]">Bottom seal added to repeat</td>
                            </tr>
                          )}
                          {gussetPrev > 0 && (contentPrev === "Standup Pouch" || contentPrev === "Zipper Pouch" || contentPrev === "3D Pouch / Flat Bottom") && (
                            <tr>
                              <td className="px-3 py-1.5 text-gray-600">+ Bottom Gusset / 2</td>
                              <td className="px-3 py-1.5 font-mono font-bold text-orange-600">+{gussetPrev / 2} mm</td>
                              <td className="px-3 py-1.5 text-gray-400 text-[10px]">Bottom gusset folds into repeat (half depth)</td>
                            </tr>
                          )}
                          {shrink > 0 && (
                            <tr>
                              <td className="px-3 py-1.5 text-gray-600">+ Shrinkage</td>
                              <td className="px-3 py-1.5 font-mono font-bold text-fuchsia-600">+{shrink} mm</td>
                              <td className="px-3 py-1.5 text-gray-400 text-[10px]">Applied to repeat length</td>
                            </tr>
                          )}
                          <tr className="bg-teal-50">
                            <td className="px-3 py-1.5 font-bold text-teal-800">= Effective Repeat</td>
                            <td className="px-3 py-1.5 font-mono font-bold text-teal-700">{effRepeat} mm</td>
                            <td className="px-3 py-1.5 text-teal-600 text-[10px]">Used for cylinder circumference matching</td>
                          </tr>
                        </>
                      )}
                      <tr>
                        <td className="px-3 py-1.5 text-gray-600">Cylinder Circumference</td>
                        <td className="px-3 py-1.5 font-mono font-bold text-emerald-700">{plan.cylCirc} mm</td>
                        <td className="px-3 py-1.5 text-gray-400 text-[10px]">{plan.cylinderCode} — {plan.cylinderName}</td>
                      </tr>
                      <tr className="bg-green-50 border-t-2 border-green-200">
                        <td className="px-3 py-2 font-bold text-green-800">÷ Repeat UPS</td>
                        <td className="px-3 py-2 font-mono font-bold text-green-700 text-sm">{plan.repeatUPS}×</td>
                        <td className="px-3 py-2 text-green-600 text-[10px]">{plan.cylCirc} ÷ {effRepeat} = {plan.repeatUPS} {sTypePrev === "Sleeve" ? "images" : "repeats"} per revolution</td>
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
