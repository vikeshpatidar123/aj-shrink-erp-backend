"use client";
import { useState, useMemo } from "react";
import {
  ChevronRight, ChevronLeft, Plus, X, Save, FileText, Settings,
  Trash2, Edit, Search, Eye, Filter, Download, MoreHorizontal, Check,
  Calculator, Pencil, ArrowRight, BookMarked
} from "lucide-react";
import {
  gravureEstimations as initData, customers, items, machines, processMasters,
  GravureEstimation, GravureEstimationMaterial, GravureEstimationProcess,
  SecondaryLayer, DryWeightRow, CategoryPlyConsumable, PlyConsumableItem,
  CATEGORY_GROUP_SUBGROUP,
} from "@/data/dummyData";
import { useCategories }     from "@/context/CategoriesContext";
import { useEnquiries }      from "@/context/EnquiryContext";
import { useProductCatalog } from "@/context/ProductCatalogContext";
import { generateCode, UNIT_CODE, MODULE_CODE } from "@/lib/generateCode";
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

// ─── Blank form ───────────────────────────────────────────────
const blank: Omit<GravureEstimation, "id" | "estimationNo"> = {
  date: new Date().toISOString().slice(0, 10),
  categoryId: "", categoryName: "", content: "",
  enquiryId: "", enquiryNo: "",
  customerId: "", customerName: "",
  jobName: "",
  jobWidth: 0, jobHeight: 0, ups: 0,
  actualWidth: 0, actualHeight: 0,
  substrateItemId: "", substrateName: "",
  width: 0, noOfColors: 6,
  printType: "Surface Print",
  quantity: 0, quantities: [], unit: "Kg",
  machineId: "", machineName: "",
  cylinderCostPerColor: 3500,
  repeatLength: 0,
  wastagePct: 1,
  setupTime: 0,
  machineCostPerHour: 1350,
  minimumOrderValue: 0,
  sellingPrice: 0,
  materials: [],
  processes: [],
  overheadPct: 12, profitPct: 15,
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

  // 1. Material cost: film (from Item Master rate) + consumables (ink/solvent/adhesive/hardner)
  let plyMaterialCost = 0;
  form.secondaryLayers.forEach(l => {
    // Film substrate
    if (l.gsm > 0) {
      const filmRate = parseFloat(FILM_ITEMS.find(i => i.subGroup === l.itemSubGroup)?.estimationRate || "0");
      if (filmRate > 0) plyMaterialCost += (l.gsm * areaM2 / 1000) * filmRate;
    }
    // Consumable items (ink, solvent, adhesive, hardner)
    l.consumableItems.forEach(ci => {
      if (ci.gsm > 0 && ci.rate > 0)
        plyMaterialCost += (ci.gsm * areaM2 / 1000) * ci.rate;
    });
  });
  // Add any manually-entered extra materials
  const manualMatCost  = form.materials.reduce((s, m) => s + m.amount, 0);
  const materialCost   = parseFloat((plyMaterialCost + manualMatCost).toFixed(2));

  // 2. Process cost: rate × auto-qty (if qty=0, derive from chargeUnit) + setupCharge
  const processCost = parseFloat(
    form.processes.reduce((s, p) => {
      const qty = p.qty > 0 ? p.qty : autoProcessQty(p.chargeUnit, form.quantity, areaM2, form.noOfColors);
      return s + (p.rate * qty + p.setupCharge);
    }, 0).toFixed(2)
  );

  // 3. Cylinder
  const cylinderCost = form.cylinderCostPerColor * form.noOfColors;

  const sub         = materialCost + processCost + cylinderCost;
  const overheadAmt = parseFloat(((sub * form.overheadPct) / 100).toFixed(2));
  const profitBase  = sub + overheadAmt;
  const profitAmt   = parseFloat(((profitBase * form.profitPct) / 100).toFixed(2));
  const totalAmount = parseFloat((profitBase + profitAmt).toFixed(2));
  const perMeterRate = form.quantity > 0 ? parseFloat((totalAmount / form.quantity).toFixed(4)) : 0;
  const marginPct    = totalAmount > 0 ? parseFloat(((profitAmt / totalAmount) * 100).toFixed(1)) : 0;
  return { materialCost, processCost, cylinderCost, overheadAmt, profitAmt, totalAmount, perMeterRate, marginPct };
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
      const rate     = parseFloat(filmItem?.estimationRate || "0");
      const kg       = parseFloat((l.gsm * areaM2 / 1000).toFixed(3));
      matLines.push({ plyNo: idx + 1, plyType: l.plyType || "Film", name: l.itemSubGroup || "Film Substrate", group: "Film", gsm: l.gsm, kg, rate, amount: parseFloat((kg * rate).toFixed(2)) });
    }
    // Consumables
    l.consumableItems.forEach(ci => {
      const kg     = parseFloat((ci.gsm * areaM2 / 1000).toFixed(3));
      const amount = parseFloat((kg * ci.rate).toFixed(2));
      matLines.push({ plyNo: idx + 1, plyType: l.plyType || "", name: ci.itemName || ci.fieldDisplayName, group: ci.itemGroup, gsm: ci.gsm, kg, rate: ci.rate, amount });
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
  const { saveCatalogItem, catalog } = useProductCatalog();
  const gravureEnqList = allEnquiries.filter(e => e.businessUnit === "Gravure");
  const [data, setData]       = useState<GravureEstimation[]>(initData);
  const [modalOpen, setModal] = useState(false);
  const [viewRow, setViewRow] = useState<GravureEstimation | null>(null);
  const [editing, setEditing] = useState<GravureEstimation | null>(null);
  const [form, setForm]       = useState<typeof blank>({ ...blank });
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [showPlan, setShowPlan] = useState(false);

  // Tab navigation states
  const [activeTab, setActiveTab] = useState<number>(1);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [isPlanApplied, setIsPlanApplied] = useState(false);
  const [altQty1, setAltQty1] = useState<number>(0);
  const [altQty2, setAltQty2] = useState<number>(0);
  const [activeQtySlot, setActiveQtySlot] = useState<0 | 1 | 2>(0); // which card is "selected"

  // Derived costs (live)
  const costs     = useMemo(() => calcCosts(form), [form]);
  const costsAlt1 = useMemo(() => calcCosts({ ...form, quantity: altQty1 || form.quantity }), [form, altQty1]);
  const costsAlt2 = useMemo(() => calcCosts({ ...form, quantity: altQty2 || form.quantity }), [form, altQty2]);
  const breakdown = useMemo(() => getCostBreakdown(form), [form]);
  // Active-slot costs (drives Cost Summary at bottom)
  const activeCosts = activeQtySlot === 1 ? costsAlt1 : activeQtySlot === 2 ? costsAlt2 : costs;
  const activeQty   = activeQtySlot === 1 ? (altQty1 || form.quantity) : activeQtySlot === 2 ? (altQty2 || form.quantity) : form.quantity;

  const f = (k: keyof typeof blank, v: unknown) => setForm(p => ({ ...p, [k]: v }));

  const openAdd = () => { setEditing(null); setForm({ ...blank }); setActiveTab(1); setAltQty1(0); setAltQty2(0); setActiveQtySlot(0); setModal(true); };
  const openEdit = (row: GravureEstimation) => {
    setEditing(row);
    const { id, estimationNo, ...rest } = row;
    setForm(rest);
    setActiveTab(1); setAltQty1(0); setAltQty2(0); setActiveQtySlot(0);
    setModal(true);
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

  // ── Ply consumable helpers ────────────────────────────
  /** Returns category's consumable definitions for a given ply type */
  const getCategoryConsumables = (categoryId: string, plyType: string): CategoryPlyConsumable[] => {
    const cat = categories.find(c => c.id === categoryId);
    if (!cat?.plyConsumables || !plyType || plyType === "Film") return [];
    return cat.plyConsumables.filter(pc => pc.plyType === plyType);
  };

  /** When ply type changes: initialise consumableItems from category master */
  const onPlyTypeChange = (index: number, plyType: string) => {
    const consumables = getCategoryConsumables(form.categoryId || "", plyType);
    const consumableItems: PlyConsumableItem[] = consumables.map(pc => ({
      consumableId: pc.id,
      fieldDisplayName: pc.fieldDisplayName,
      itemGroup: pc.itemGroup,
      itemSubGroup: pc.itemSubGroup,
      itemId: "",
      itemName: "",
      gsm: pc.defaultValue,
      rate: 0,
    }));
    const layers = [...form.secondaryLayers];
    layers[index] = { ...layers[index], plyType, consumableItems };
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
    if (!form.categoryId) {
      alert("Please select an Estimation Category."); return;
    }
    if (!form.customerId || !form.jobName || !form.machineId) {
      alert("Please fill required Basic Info & Machine."); return;
    }
    if (form.secondaryLayers.length === 0) {
      alert("Please configure Ply Details Composition."); return;
    }
    const substrateName = form.secondaryLayers.map(l => l.itemSubGroup).join(" + ") || "Multiple Plys";

    if (editing) {
      // Update single record
      const record = { ...form, ...costs, substrateName };
      setData(d => d.map(r => r.id === editing.id ? { ...record, id: editing.id, estimationNo: editing.estimationNo } : r));
    } else {
      // Build one record per filled quantity slot
      const qtys: number[] = [form.quantity];
      if (altQty1 > 0) qtys.push(altQty1);
      if (altQty2 > 0) qtys.push(altQty2);

      setData(prev => {
        let updated = [...prev];
        qtys.forEach(qty => {
          const qCosts = calcCosts({ ...form, quantity: qty });
          const estimationNo = generateCode(UNIT_CODE.Gravure, MODULE_CODE.Estimation, updated.map(d => d.estimationNo));
          const id = `GVES${String(updated.length + 1).padStart(3, "0")}`;
          updated = [...updated, { ...form, quantity: qty, ...qCosts, substrateName, id, estimationNo }];
        });
        return updated;
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

  const columns: Column<GravureEstimation>[] = [
    { key: "estimationNo",  header: "Estimation No", sortable: true },
    { key: "date",          header: "Date",           sortable: true },
    { key: "customerName",  header: "Customer",       sortable: true },
    { key: "jobName",       header: "Job Name" },
    { key: "substrateName", header: "Substrate", render: r => <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full text-xs">{r.substrateName.split(" ").slice(0, 3).join(" ")}</span> },
    { key: "noOfColors",    header: "Colors", render: r => <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold">{r.noOfColors}C</span> },
    { key: "machineName",   header: "Machine", render: r => <span className="text-xs text-gray-600">{r.machineName}</span> },
    { key: "quantity",      header: "Qty", render: r => <span>{r.quantity.toLocaleString()} {r.unit}</span> },
    { key: "perMeterRate",  header: "₹/Meter", render: r => <span className="font-semibold">₹{r.perMeterRate}</span> },
    { key: "totalAmount",   header: "Total (₹)", render: r => <span className="font-bold text-gray-800">₹{r.totalAmount.toLocaleString()}</span> },
    { key: "marginPct",     header: "Margin", render: r => <span className={`font-semibold ${r.marginPct >= 15 ? "text-green-600" : r.marginPct >= 10 ? "text-yellow-600" : "text-red-500"}`}>{r.marginPct}%</span> },
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
          searchKeys={["estimationNo", "customerName", "jobName", "substrateName"]}
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
        <div className="flex bg-gray-100 p-1.5 rounded-xl mb-6 shadow-inner gap-1">
           <button onClick={() => setActiveTab(1)} className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${activeTab === 1 ? 'bg-white shadow text-purple-700' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'}`}>1. Basic Info</button>
           <button onClick={() => form.categoryId && setActiveTab(2)} className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${activeTab === 2 ? 'bg-white shadow text-purple-700' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'} ${!form.categoryId && 'opacity-50 cursor-not-allowed'}`}>2. View Plan (Production)</button>
           <button onClick={() => form.categoryId && setActiveTab(3)} className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${activeTab === 3 ? 'bg-white shadow text-purple-700' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'} ${!form.categoryId && 'opacity-50 cursor-not-allowed'}`}>3. Cost Estimation</button>
        </div>

        <div>
          {/* TAB 1: BASIC INFO */}
          {activeTab === 1 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* ── Category & Basic Info ─────────────────────────── */}
          <div>
             <SectionHeader label="Identification & Category" />
             <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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

                     // Build SecondaryLayers from enquiry plys
                     const secondaryLayers: SecondaryLayer[] = (enq.plys || []).map((ply, i) => {
                       const plyType = plyTypeMap[ply.itemQuality] || "Film";
                       const cat = categories.find(c => c.id === enq.categoryId);
                       const consumableDefs = (cat?.plyConsumables || []).filter(pc => pc.plyType === plyType);
                       const consumableItems: PlyConsumableItem[] = consumableDefs.map(pc => ({
                         consumableId: pc.id,
                         fieldDisplayName: pc.fieldDisplayName,
                         itemGroup: pc.itemGroup,
                         itemSubGroup: pc.itemSubGroup,
                         itemId: "",
                         itemName: "",
                         gsm: pc.defaultValue,
                         rate: 0,
                       }));
                       return {
                         id: Math.random().toString(),
                         layerNo: i + 1,
                         plyType,
                         itemSubGroup: "",
                         density: 0,
                         thickness: ply.thickness || 0,
                         gsm: ply.gsm || 0,
                         consumableItems,
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
                     const totalColors = (enq.planFColor || 0) + (enq.planBColor || 0) +
                       (enq.planSFColor || 0) + (enq.planSBColor || 0) || enq.noOfColors;

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
                       actualWidth: (enq.planWidth || enq.width || 0) + 1,
                       actualHeight: (enq.planHeight || 0) + 1,
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
                   label="Select Category *"
                   value={form.categoryId || ""}
                   onChange={e => {
                     const cat = categories.find(c => c.id === e.target.value);
                     // Auto-build ply rows from category's ply configuration
                     const plyOrder: string[] = ["Film", "Printing", "Lamination", "Coating"];
                     const usedTypes = new Set((cat?.plyConsumables || []).map(pc => pc.plyType));
                     // Always include Film as 1st ply; include others that have consumables defined
                     const autoTypes = plyOrder.filter(pt => pt === "Film" || usedTypes.has(pt));
                     const autoLayers: SecondaryLayer[] = autoTypes.map((plyType, i) => {
                       const consumableDefs = (cat?.plyConsumables || []).filter(pc => pc.plyType === plyType);
                       const consumableItems: PlyConsumableItem[] = consumableDefs.map(pc => ({
                         consumableId: pc.id, fieldDisplayName: pc.fieldDisplayName,
                         itemGroup: pc.itemGroup, itemSubGroup: pc.itemSubGroup,
                         itemId: "", itemName: "", gsm: pc.defaultValue, rate: 0,
                       }));
                       return { id: Math.random().toString(), layerNo: i + 1, plyType, itemSubGroup: "", density: 0, thickness: 0, gsm: 0, consumableItems };
                     });
                     setForm(p => ({ ...p, categoryId: e.target.value, categoryName: cat?.name || "", content: "", secondaryLayers: autoLayers }));
                   }}
                   options={[{ value: "", label: "-- Select Category --" }, ...categories.map(c => ({ value: c.id, label: c.name }))]}
                 />
                 <Select
                   label="Select Content *"
                   value={form.content || ""}
                   onChange={e => f("content", e.target.value)}
                   options={[...(!form.categoryId ? [] : [{ value: "", label: "-- Select Content --" }]), ...(categories.find(c => c.id === form.categoryId)?.contents || []).map(ctx => ({ value: ctx, label: ctx }))]}
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
             </div>
          </div>

          {form.categoryId && (
            <div>
              {/* ── Section 1: Planning Specification ─────────────────────────── */}
              <div>
                <SectionHeader label="Planning Specification" />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Input label="Date" type="date" value={form.date} onChange={e => f("date", e.target.value)} />
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

                  <Input label="Job Width (mm)" type="number" 
                    value={form.jobWidth || ""} 
                    onChange={e => { 
                      const v = Number(e.target.value);
                      setForm(p => ({ ...p, jobWidth: v, width: v, actualWidth: v + 1 }));
                    }} 
                  />
                  <Input label="Job Height (mm)" type="number" 
                    value={form.jobHeight || ""} 
                    onChange={e => { 
                      const v = Number(e.target.value);
                      setForm(p => ({ ...p, jobHeight: v, actualHeight: v + 1 }));
                    }} 
                  />
                  <Input label="Actual Width" type="number" value={form.actualWidth || ""} onChange={e => f("actualWidth", Number(e.target.value))} />
                  <Input label="Actual Height" type="number" value={form.actualHeight || ""} onChange={e => f("actualHeight", Number(e.target.value))} />
                  <Input label="No. of Colors" type="number" value={form.noOfColors} onChange={e => f("noOfColors", Number(e.target.value))} min={1} max={12} />

              <Select label="Print Type" value={form.printType} onChange={e => f("printType", e.target.value)}
                options={[
                  { value: "Surface Print", label: "Surface Print" },
                  { value: "Reverse Print", label: "Reverse Print" },
                  { value: "Combination",   label: "Combination" },
                ]} />
            </div>


            {/* ── Section: Ply Information ── */}
            {form.secondaryLayers.length > 0 && (
              <div className="mt-4 border-t border-purple-100 pt-4">
                <SectionHeader label="Ply Information" />
                <div className="space-y-3">
                  {form.secondaryLayers.map((l, index) => {
                    const thicknesses = FILM_SUBGROUPS.find(s => s.subGroup === l.itemSubGroup)?.thicknesses || [];
                    const consumableDefs = getCategoryConsumables(form.categoryId || "", l.plyType);

                    return (
                      <div key={l.id} className="bg-white border-2 border-purple-50 rounded-2xl shadow-sm relative overflow-hidden">
                        {/* Ply header */}
                        <div className="flex items-center justify-between bg-purple-50 px-4 py-2 border-b border-purple-100">
                          <span className="text-xs font-bold text-purple-700 uppercase tracking-wider">
                            {l.layerNo === 1 ? "1st" : l.layerNo === 2 ? "2nd" : l.layerNo === 3 ? "3rd" : `${l.layerNo}th`} Ply
                          </span>
                          {l.plyType && (
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                              l.plyType === "Printing"   ? "bg-blue-50 text-blue-700 border-blue-200" :
                              l.plyType === "Lamination" ? "bg-orange-50 text-orange-700 border-orange-200" :
                              l.plyType === "Coating"    ? "bg-green-50 text-green-700 border-green-200" :
                              "bg-indigo-50 text-indigo-700 border-indigo-200"
                            }`}>
                              {l.plyType === "Film" ? "1st Ply (Film)" : l.plyType === "Printing" ? "2nd Ply (Printing)" : l.plyType === "Lamination" ? "3rd Ply (Lamination)" : l.plyType === "Coating" ? "4th Ply (Coating)" : l.plyType}
                            </span>
                          )}
                        </div>

                        <div className="p-3 space-y-3">
                          {/* Ply Type select */}
                          <div>
                            <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Ply Type *</label>
                            <select
                              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-purple-400"
                              value={l.plyType}
                              onChange={e => onPlyTypeChange(index, e.target.value)}
                            >
                              <option value="">-- Select Ply Type --</option>
                              <option value="Film">1st Ply (Film / Substrate)</option>
                              <option value="Printing">2nd Ply (Printing)</option>
                              <option value="Lamination">3rd Ply (Lamination)</option>
                              <option value="Coating">4th Ply (Coating)</option>
                            </select>
                          </div>

                          {/* ── Film / Substrate section (always shown once ply type chosen) ── */}
                          {l.plyType && (
                            <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-3 space-y-3">
                              <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">
                                {l.plyType === "Film" ? "1st Ply — Film / Substrate" : l.plyType === "Lamination" ? "3rd Ply — Laminating Film" : "2nd Ply — Print Film"}
                              </p>
                              <div>
                                <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Film Sub Group</label>
                                <select
                                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-purple-400"
                                  value={l.itemSubGroup}
                                  onChange={e => {
                                    const subGroup = e.target.value;
                                    const sg = FILM_SUBGROUPS.find(s => s.subGroup === subGroup);
                                    const density = sg ? sg.density : 0;
                                    const layers = [...form.secondaryLayers];
                                    layers[index] = { ...l, itemSubGroup: subGroup, density, thickness: 0, gsm: 0 };
                                    f("secondaryLayers", layers);
                                  }}>
                                  <option value="">Select Film Sub Group</option>
                                  {FILM_SUBGROUPS.map(opt => <option key={opt.subGroup} value={opt.subGroup}>{opt.subGroup}</option>)}
                                </select>
                              </div>
                              <div className="grid grid-cols-3 gap-2">
                                <Input label="Density" type="number" value={l.density || ""} readOnly className="bg-gray-50 text-gray-400 text-xs" />
                                <div>
                                  <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Thickness (μ)</label>
                                  <select
                                    className="w-full text-xs border border-gray-200 rounded-xl px-2 py-2 bg-white outline-none focus:ring-2 focus:ring-purple-400"
                                    value={l.thickness}
                                    onChange={e => {
                                      const thickness = Number(e.target.value);
                                      const layers = [...form.secondaryLayers];
                                      layers[index] = { ...l, thickness, gsm: parseFloat((thickness * l.density).toFixed(3)) };
                                      f("secondaryLayers", layers);
                                    }}>
                                    <option value={0}>Select</option>
                                    {thicknesses.map(t => <option key={t} value={t}>{t}</option>)}
                                  </select>
                                </div>
                                <Input label="Film GSM" type="number" value={l.gsm || ""} readOnly className="font-bold bg-purple-50 text-purple-800 border-purple-200 text-xs" />
                              </div>
                            </div>
                          )}

                          {/* ── Consumable items (Printing / Lamination / Coating) ── */}
                          {consumableDefs.length > 0 && (
                            <div className="space-y-3">
                              {consumableDefs.map((pc, ciIdx) => {
                                const ci = l.consumableItems[ciIdx] ?? {
                                  consumableId: pc.id, fieldDisplayName: pc.fieldDisplayName,
                                  itemGroup: pc.itemGroup, itemSubGroup: pc.itemSubGroup,
                                  itemId: "", itemName: "", gsm: pc.defaultValue, rate: 0,
                                };
                                const subGroups = CATEGORY_GROUP_SUBGROUP["Raw Material (RM)"]?.[pc.itemGroup] ?? [];
                                // Filter items: by group, and also by selected subGroup for precise item list
                                const filteredItems = items.filter(i =>
                                  i.group === pc.itemGroup &&
                                  i.active &&
                                  (!ci.itemSubGroup || i.subGroup === ci.itemSubGroup)
                                );

                                return (
                                  <div key={pc.id} className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-[10px] font-bold text-gray-700 uppercase tracking-widest">{pc.fieldDisplayName}</span>
                                      <span className="text-[9px] px-1.5 py-0.5 bg-teal-100 text-teal-700 rounded font-semibold border border-teal-200">{pc.itemGroup}</span>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                      {/* Item Sub Group */}
                                      <div>
                                        <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Item Sub Group</label>
                                        <select
                                          className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white outline-none focus:ring-2 focus:ring-teal-400"
                                          value={ci.itemSubGroup}
                                          onChange={e => updatePlyConsumable(index, ciIdx, { itemSubGroup: e.target.value, itemId: "", itemName: "" })}
                                        >
                                          <option value="">-- Sub Group --</option>
                                          {subGroups.map(sg => <option key={sg} value={sg}>{sg}</option>)}
                                        </select>
                                      </div>
                                      {/* Item */}
                                      <div>
                                        <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Item (from Item Master)</label>
                                        <select
                                          className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white outline-none focus:ring-2 focus:ring-teal-400"
                                          value={ci.itemId}
                                          onChange={e => {
                                            const it = filteredItems.find(x => x.id === e.target.value);
                                            updatePlyConsumable(index, ciIdx, {
                                              itemId: it?.id ?? "",
                                              itemName: it?.name ?? "",
                                              rate: parseFloat(it?.estimationRate ?? "0") || 0,
                                            });
                                          }}
                                        >
                                          <option value="">-- Select Item --</option>
                                          {filteredItems.map(it => (
                                            <option key={it.id} value={it.id}>
                                              {it.name} {it.estimationRate ? `— ₹${it.estimationRate}/Kg` : ""}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                      {/* GSM */}
                                      <div>
                                        <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">GSM / Wet Wt.</label>
                                        <input
                                          type="number"
                                          className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white outline-none focus:ring-2 focus:ring-teal-400 font-mono"
                                          value={ci.gsm}
                                          step={0.1}
                                          min={pc.minValue}
                                          max={pc.maxValue}
                                          onChange={e => updatePlyConsumable(index, ciIdx, { gsm: Number(e.target.value) })}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* hint when no consumables defined for this ply type */}
                          {l.plyType && l.plyType !== "Film" && consumableDefs.length === 0 && (
                            <p className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                              No consumables defined for "{l.plyType}" ply in Category Master. Go to Category Master → Consumable's Wet Weight tab to add them.
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
               </div>
             </div>
           )}
          </div>
        )}

        {/* TAB 2: PRODUCTION PLAN */}
        {activeTab === 2 && form.categoryId && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* ── Section 2: Machine & Process ──────────────────── */}
            <div>
              <SectionHeader label="Machine & Process Selection" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                {/* Machine Master dropdown */}
                <Select
                label="Printing Machine * (Machine Master)"
                value={form.machineId}
                onChange={e => {
                  const m = PRINT_MACHINES.find(x => x.id === e.target.value);
                  f("machineId", e.target.value);
                  if (m) f("machineName", m.name);
                }}
                options={[
                  { value: "", label: "-- Select Machine --" },
                  ...PRINT_MACHINES.map(m => ({ value: m.id, label: `${m.name} (${m.status}) – ₹${m.costPerHour}/hr` })),
                ]}
              />
              <Input label="Cylinder Cost per Color (₹)" type="number" value={form.cylinderCostPerColor}
                onChange={e => f("cylinderCostPerColor", Number(e.target.value))} />
            </div>

            {/* Process Master selection table */}
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-600">Process List (from Process Master)</p>
              <button onClick={addProcess}
                className="flex items-center gap-1.5 text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg border border-purple-200 transition">
                <Plus size={12} /> Add Process
              </button>
            </div>

            {form.processes.length > 0 ? (
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-50 text-gray-500 uppercase">
                    <tr>
                      {["Process (Master)", "Charge Unit", "Rate (₹)", "Qty", "Setup (₹)", "Amount (₹)", ""].map(h => (
                        <th key={h} className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {form.processes.map((pr, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-3 py-2 min-w-[180px]">
                          <select
                            value={pr.processId}
                            onChange={e => selectProcess(i, e.target.value)}
                            className={cellInput}
                          >
                            <option value="">-- Select Process --</option>
                            {ROTO_PROCESSES.map(pm => (
                              <option key={pm.id} value={pm.id}>{pm.name} ({pm.department})</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2 w-24">
                          <span className="px-2 py-1 bg-gray-100 rounded text-gray-700 font-mono">{pr.chargeUnit || "—"}</span>
                        </td>
                        <td className="px-3 py-2 w-24">
                          <input type="number" value={pr.rate} onChange={e => updateProcess(i, { rate: Number(e.target.value) })}
                            className={`${cellInput} text-right`} step={0.01} />
                        </td>
                        <td className="px-3 py-2 w-28">
                          <input type="number" value={pr.qty} onChange={e => updateProcess(i, { qty: Number(e.target.value) })}
                            className={`${cellInput} text-right`} />
                        </td>
                        <td className="px-3 py-2 w-28">
                          <input type="number" value={pr.setupCharge} onChange={e => updateProcess(i, { setupCharge: Number(e.target.value) })}
                            className={`${cellInput} text-right`} />
                        </td>
                        <td className="px-3 py-2 w-32 text-right font-semibold text-gray-800">₹{pr.amount.toLocaleString()}</td>
                        <td className="px-3 py-2 w-8 text-center">
                          <button onClick={() => removeProcess(i)} className="text-red-400 hover:text-red-600"><X size={14} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-purple-50 border-t border-purple-200">
                    <tr>
                      <td colSpan={5} className="px-3 py-2.5 text-xs font-bold text-purple-700 uppercase">Process Cost</td>
                      <td className="px-3 py-2.5 text-sm font-bold text-purple-800 text-right">₹{costs.processCost.toLocaleString()}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="border-2 border-dashed border-purple-200 rounded-xl py-6 text-center text-xs text-gray-400">
                No advanced processes added. Print cost handles baseline printing.
              </div>
            )}

            {/* ── View Plan Action ── */}
            <div className="mt-6 flex justify-end">
               <Button onClick={() => setShowPlan(!showPlan)} variant="secondary" icon={<Eye size={14} />}>
                 {showPlan ? "Hide Production Plan" : "View Production Plan"}
               </Button>
            </div>
            
             {showPlan && form.machineId && !isPlanApplied && (
               <div className="bg-white border-2 border-indigo-100 rounded-2xl shadow-xl p-0 mt-6 overflow-hidden">
                 <div className="bg-gradient-to-r from-indigo-800 to-purple-800 p-4 flex items-center justify-between">
                    <div>
                      <h4 className="text-white font-bold text-sm tracking-wide uppercase">Production Plan Selection</h4>
                      <p className="text-indigo-200 text-[10px] mt-0.5">Select the most efficient plan for production</p>
                    </div>
                    <div className="flex gap-4">
                      {selectedPlanId && (
                        <Button onClick={() => setIsPlanApplied(true)} className="bg-green-500 hover:bg-green-600 border-none px-6">Apply Selected Plan</Button>
                      )}
                      <div className="bg-white/10 backdrop-blur px-3 py-1.5 rounded-lg border border-white/20">
                        <p className="text-[8px] text-white/60 font-bold uppercase tracking-widest">Machine</p>
                        <p className="text-xs font-bold text-white">{form.machineName}</p>
                      </div>
                    </div>
                 </div>

                 {/* Detailed Scrollable Grid */}
                 <div className="overflow-x-auto">
                    <table className="min-w-full text-[10px] whitespace-nowrap border-collapse">
                       <thead className="bg-slate-800 text-slate-300">
                          <tr>
                             <th className="p-2 border border-slate-700 text-center">Select</th>
                             <th className="p-2 border border-slate-700 text-left">Machine Name</th>
                             <th className="p-2 border border-slate-700 text-center">Cylinder Circumference</th>
                             <th className="p-2 border border-slate-700 text-left">Roll Name</th>
                             <th className="p-2 border border-slate-700 text-center">Roll Width</th>
                             <th className="p-2 border border-slate-700 text-center">Ac Ups</th>
                             <th className="p-2 border border-slate-700 text-center">Repeat UPS</th>
                             <th className="p-2 border border-slate-700 text-center">Total UPS</th>
                             <th className="p-2 border border-slate-700 text-center">Req. RMT</th>
                             <th className="p-2 border border-slate-700 text-center">Total RMT</th>
                             <th className="p-2 border border-slate-700 text-center">Total Wt (Kg)</th>
                             <th className="p-2 border border-slate-700 text-center">Total Time</th>
                             <th className="p-2 border border-slate-700 text-center">Plan Cost</th>
                             <th className="p-2 border border-slate-700 text-center">Grand Total</th>
                             <th className="p-2 border border-slate-700 text-center">Unit Price</th>
                          </tr>
                       </thead>
                       <tbody className="bg-white divide-y divide-gray-100">
                          {[1, 2, 3, 4, 5, 6, 7].map((row, i) => {
                             const planId = `PLAN-${form.machineId}-${i}`;
                             const repeat = form.jobHeight ? form.jobHeight + (i * 12) : 600 + (i * 12);
                             const upsCount = 10 + i;
                             const isSelected = selectedPlanId === planId;
                             
                             return (
                                <tr key={planId} 
                                    onClick={() => setSelectedPlanId(planId)}
                                    className={`cursor-pointer transition-colors ${isSelected ? 'bg-indigo-50 hover:bg-indigo-100' : 'hover:bg-gray-50'}`}>
                                   <td className="p-2 border border-gray-100 text-center">
                                      <div className={`w-4 h-4 rounded-full border-2 mx-auto flex items-center justify-center ${isSelected ? 'border-indigo-600 bg-indigo-600' : 'border-gray-300 bg-white'}`}>
                                         {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                      </div>
                                   </td>
                                   <td className="p-2 border border-gray-100 font-medium text-gray-700">{form.machineName}</td>
                                   <td className="p-2 border border-gray-100 text-center font-mono text-gray-600">{repeat}</td>
                                   <td className="p-2 border border-gray-100 text-gray-500 max-w-xs truncate">Quality={form.substrateName} & Width={form.jobWidth}...</td>
                                   <td className="p-2 border border-gray-100 text-center text-gray-600">{form.jobWidth}</td>
                                   <td className="p-2 border border-gray-100 text-center text-gray-600">10</td>
                                   <td className="p-2 border border-gray-100 text-center text-gray-600">{upsCount}</td>
                                   <td className="p-2 border border-gray-100 text-center font-bold text-gray-800">{10 * upsCount}</td>
                                   <td className="p-2 border border-gray-100 text-center text-gray-600">1</td>
                                   <td className="p-2 border border-gray-100 text-center text-gray-600">101</td>
                                   <td className="p-2 border border-gray-100 text-center font-semibold text-blue-600">0.07</td>
                                   <td className="p-2 border border-gray-100 text-center text-gray-600">1</td>
                                   <td className="p-2 border border-gray-100 text-center text-gray-600">3.85</td>
                                   <td className="p-2 border border-gray-100 text-center font-bold text-indigo-700">₹89.6</td>
                                   <td className="p-2 border border-gray-100 text-center text-indigo-600">0.09</td>
                                </tr>
                             )
                          })}
                       </tbody>
                    </table>
                 </div>

                 {selectedPlanId && (
                   <div className="bg-indigo-900 text-indigo-100 p-3 flex items-center justify-between text-[11px] font-medium px-5">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-green-400 flex items-center justify-center text-indigo-900">
                          <Check size={10} strokeWidth={4} />
                        </div>
                        <span>Plan <strong>{selectedPlanId}</strong> is selected. Click <strong className="text-white cursor-pointer hover:underline" onClick={() => setIsPlanApplied(true)}>Apply</strong> to confirm.</span>
                      </div>
                      <div className="bg-white/10 px-3 py-1 rounded-lg">
                        Grand Total: <span className="text-white font-bold ml-1">₹89.60</span>
                      </div>
                   </div>
                 )}
               </div>
             )}

             {isPlanApplied && (
               <div className="mt-8 space-y-4 animate-in zoom-in-95 duration-500">
                 <div className="flex items-center justify-between bg-white/50 backdrop-blur-sm p-3 rounded-2xl border border-indigo-100">
                    <div>
                      <h3 className="text-sm font-bold text-indigo-900">Ply / Layer Wise Calculation</h3>
                      <p className="text-[10px] text-indigo-500 uppercase tracking-widest font-bold">Process: {form.machineName} | Plan: {selectedPlanId}</p>
                    </div>
                    <Button onClick={() => setIsPlanApplied(false)} variant="secondary" className="scale-90 opacity-70 hover:opacity-100">Change Plan</Button>
                 </div>

                 <div className="bg-white border-2 border-indigo-50 rounded-2xl overflow-hidden shadow-lg">
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-[10px] border-collapse">
                        <thead className="bg-indigo-700 text-white uppercase tracking-wider font-extrabold">
                          <tr>
                            {["Layer", "Item Code", "Item Group", "Item Name", "Thick", "Dens", "GSM", "Size W", "Ratio", "Req.Mtr", "Req.SQM", "Req.Wt.", "Wast.Mtr", "Wast.SQM", "Wast.Wt", "Total Mtr", "Total SQM", "Total Wt"].map(h => (
                               <th key={h} className="p-2 border border-indigo-600/30 text-center whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 uppercase">
                          {form.secondaryLayers.map((l, idx) => (
                            <tr key={l.id} className="hover:bg-indigo-50/30 transition-colors">
                               <td className="p-2 border border-gray-100 text-center font-black text-indigo-900 bg-indigo-50/20">{idx + 1}</td>
                               <td className="p-2 border border-gray-100 text-gray-500">RR0000{idx + 2}</td>
                               <td className="p-2 border border-gray-100 text-gray-500">Gravure Roll</td>
                               <td className="p-2 border border-gray-100 font-medium text-gray-700 min-w-[200px] whitespace-normal line-clamp-2">{l.itemSubGroup || "Lamination Film Selection"}</td>
                               <td className="p-2 border border-gray-100 text-center font-mono">{l.thickness}</td>
                               <td className="p-2 border border-gray-100 text-center font-mono">{l.density}</td>
                               <td className="p-2 border border-gray-100 text-center font-bold text-indigo-700 bg-indigo-50/10">{l.gsm}</td>
                               <td className="p-2 border border-gray-100 text-center font-mono">{form.jobWidth}</td>
                               <td className="p-2 border border-gray-100 text-center text-gray-600">9.74</td>
                               <td className="p-2 border border-gray-100 text-center font-mono text-gray-800">1</td>
                               <td className="p-2 border border-gray-100 text-center text-gray-600">0.23</td>
                               <td className="p-2 border border-gray-100 text-center font-bold text-blue-600">0.001</td>
                               <td className="p-2 border border-gray-100 text-center text-gray-500">100</td>
                               <td className="p-2 border border-gray-100 text-center text-gray-500">23</td>
                               <td className="p-2 border border-gray-100 text-center text-gray-500">0.069</td>
                               <td className="p-2 border border-gray-100 text-center text-gray-600">101</td>
                               <td className="p-2 border border-gray-100 text-center text-gray-600">23.23</td>
                               <td className="p-2 border border-gray-100 text-center font-black text-gray-900 bg-gray-50">0.07</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-slate-50 border-t-2 border-indigo-200">
                           <tr className="font-bold">
                              <td colSpan={17} className="p-3 text-right text-indigo-900 uppercase">Calculation Total Weight (Kg)</td>
                              <td className="p-3 text-center bg-indigo-100 text-indigo-900 text-xs">{(form.secondaryLayers.length * 0.07).toFixed(3)}</td>
                           </tr>
                        </tfoot>
                      </table>
                    </div>
                 </div>
               </div>
             )}
          </div>
        </div>
        )}

        {/* TAB 3: COST ESTIMATION */}
          {activeTab === 3 && form.categoryId && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* ── Section 3: Multiple Quantity Costing ──────────────────── */}
              <div>
                 <SectionHeader label="Quantity Simulations" />
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {/* ── Qty Card helper ── */}
                    {([
                      { slot: 0 as const, label: "Base Quantity (Q1)", badge: "TARGET QTY", qty: form.quantity, c: costs,     isBase: true  },
                      { slot: 1 as const, label: "Simulate Quantity 2", badge: altQty1 > 0 ? "Q2" : "", qty: altQty1, c: costsAlt1, isBase: false },
                      { slot: 2 as const, label: "Simulate Quantity 3", badge: altQty2 > 0 ? "Q3" : "", qty: altQty2, c: costsAlt2, isBase: false },
                    ] as const).map(({ slot, label, badge, qty, c, isBase }) => {
                      const active = activeQtySlot === slot;
                      return (
                        <div
                          key={slot}
                          onClick={() => setActiveQtySlot(slot)}
                          className={`rounded-2xl p-5 shadow-sm relative overflow-hidden cursor-pointer transition-all duration-200 border-2
                            ${active
                              ? "border-purple-500 bg-purple-50 ring-2 ring-purple-300 shadow-md scale-[1.02]"
                              : "border-slate-200 bg-slate-50 hover:border-purple-300 hover:bg-purple-50/40"}`}
                        >
                          {/* Badge */}
                          {badge && (
                            <span className={`absolute top-0 right-0 text-[10px] font-bold px-2 py-1 rounded-bl-lg
                              ${active ? "bg-purple-500 text-white" : "bg-slate-200 text-slate-600"}`}>
                              {badge}
                            </span>
                          )}
                          {active && (
                            <span className="absolute top-0 left-0 text-[10px] font-bold px-2 py-1 rounded-br-lg bg-purple-600 text-white">
                              ✓ SELECTED
                            </span>
                          )}

                          {/* Input */}
                          <div className="mt-3 mb-4" onClick={e => e.stopPropagation()}>
                            {isBase ? (
                              <div className="flex gap-2 items-end">
                                <div className="flex-1">
                                  <Input label={label} type="number" value={form.quantity}
                                    onChange={e => f("quantity", Number(e.target.value))}
                                    className="bg-white border-purple-300" />
                                </div>
                                <div className="w-1/3">
                                  <Select label="Unit" value={form.unit} onChange={e => f("unit", e.target.value)}
                                    options={[{ value: "Kg", label: "Kg" }, { value: "Pieces", label: "Pieces" }]} />
                                </div>
                              </div>
                            ) : (
                              <Input label={label} type="number" value={qty || ""}
                                onChange={e => slot === 1 ? setAltQty1(Number(e.target.value)) : setAltQty2(Number(e.target.value))}
                                placeholder="Enter quantity to simulate" className="bg-white" />
                            )}
                          </div>

                          {/* Cost display */}
                          <div className={`pt-4 border-t ${active ? "border-purple-300" : "border-slate-200"}`}>
                            <p className={`text-[10px] font-bold mb-0.5 uppercase tracking-wide ${active ? "text-purple-500" : "text-slate-500"}`}>
                              Total Estimated Cost
                            </p>
                            <p className={`text-2xl font-black mb-3 ${active ? "text-purple-900" : "text-slate-700"}`}>
                              ₹{c.totalAmount.toLocaleString()}
                            </p>
                            <div className="flex items-center justify-between">
                              <div>
                                <p className={`text-[10px] font-bold mb-0.5 uppercase tracking-wide ${active ? "text-purple-500" : "text-slate-500"}`}>Rate / Unit</p>
                                <p className={`text-lg font-bold ${active ? "text-purple-800" : "text-indigo-700"}`}>₹{c.perMeterRate}</p>
                              </div>
                              <div className="text-right">
                                <p className={`text-[10px] font-bold mb-0.5 uppercase tracking-wide ${active ? "text-purple-500" : "text-slate-500"}`}>Margin</p>
                                <p className={`text-sm font-bold ${c.marginPct >= 12 ? "text-green-600" : "text-orange-500"}`}>{c.marginPct}%</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                 </div>
              </div>

          {/* ── Material Cost Breakdown ──────────────────────── */}
          <div>
            <SectionHeader label={`Material Cost Breakdown — Area: ${breakdown.areaM2.toLocaleString()} m²`} />
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <table className="min-w-full text-xs">
                <thead style={{ background: "var(--erp-primary)" }} className="text-white">
                  <tr>
                    {["Ply", "Type", "Material / Item", "Group", "GSM / Wet Wt.", "Qty (Kg)", "Rate (₹/Kg)", "Amount (₹)"].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {breakdown.matLines.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-6 text-center text-gray-400">No materials — select items in Ply Information (Tab 1)</td></tr>
                  ) : breakdown.matLines.map((m, i) => (
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
                      <td className="px-3 py-2 font-mono text-gray-700">{m.kg.toFixed(3)}</td>
                      <td className="px-3 py-2 font-mono text-gray-700">{m.rate > 0 ? `₹${m.rate}` : <span className="text-amber-600 font-semibold">—  select item</span>}</td>
                      <td className="px-3 py-2 font-bold text-gray-900">{m.amount > 0 ? `₹${m.amount.toLocaleString()}` : "₹0"}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-purple-50 border-t-2 border-purple-200">
                  <tr>
                    <td colSpan={7} className="px-3 py-2.5 text-xs font-bold text-purple-700 uppercase text-right">Total Material Cost</td>
                    <td className="px-3 py-2.5 text-sm font-black text-purple-800">₹{activeCosts.materialCost.toLocaleString()}</td>
                  </tr>
                </tfoot>
              </table>
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

          {/* ── Section 4: Overhead & Profit ──────────────────── */}
          <div>
            <SectionHeader label="Overhead & Profit" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Input label="Overhead (%)" type="number" value={form.overheadPct} onChange={e => f("overheadPct", Number(e.target.value))} />
              <Input label="Profit (%)" type="number" value={form.profitPct} onChange={e => f("profitPct", Number(e.target.value))} />
            </div>
          </div>

          {/* ── Section 5: Live Cost Summary ──────────────────── */}
          <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <SectionHeader label={`Cost Summary — ${activeQtySlot === 0 ? "Base Qty" : `Q${activeQtySlot + 1}`} (${activeQty.toLocaleString()} ${form.unit})`} />
              {activeQtySlot > 0 && (
                <span className="text-[10px] bg-purple-200 text-purple-800 font-bold px-2 py-0.5 rounded-full">
                  Simulated View
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              {[
                { label: "Process Cost",    val: `₹${activeCosts.processCost.toLocaleString()}`,   cls: "bg-purple-50 border-purple-200 text-purple-700" },
                { label: `Cylinder (${form.noOfColors}C × ₹${form.cylinderCostPerColor.toLocaleString()})`,
                                            val: `₹${activeCosts.cylinderCost.toLocaleString()}`,  cls: "bg-indigo-50 border-indigo-200 text-indigo-700" },
                { label: `Overhead (${form.overheadPct}%)`, val: `₹${activeCosts.overheadAmt.toLocaleString()}`, cls: "bg-yellow-50 border-yellow-200 text-yellow-700" },
              ].map(s => (
                <div key={s.label} className={`rounded-xl border p-3 ${s.cls}`}>
                  <p className="text-xs font-medium opacity-80">{s.label}</p>
                  <p className="text-base font-bold mt-0.5">{s.val}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="bg-green-50 border border-green-200 rounded-xl p-3 col-span-1">
                <p className="text-xs font-medium text-green-700 opacity-80">Profit ({form.profitPct}%)</p>
                <p className="text-base font-bold text-green-700">₹{activeCosts.profitAmt.toLocaleString()}</p>
              </div>
              <div className="bg-white border-2 border-purple-400 rounded-xl p-3">
                <p className="text-xs font-bold text-purple-700 uppercase tracking-wide">Total Amount</p>
                <p className="text-2xl font-black text-purple-800">₹{activeCosts.totalAmount.toLocaleString()}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                  <p className="text-xs text-gray-500">Rate / {form.unit}</p>
                  <p className="text-sm font-bold text-gray-800">₹{activeCosts.perMeterRate}</p>
                </div>
                <div className={`rounded-xl border p-3 ${activeCosts.marginPct >= 12 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
                  <p className="text-xs text-gray-500">Margin %</p>
                  <p className={`text-sm font-bold ${activeCosts.marginPct >= 12 ? "text-green-700" : "text-red-600"}`}>{activeCosts.marginPct}%</p>
                </div>
              </div>
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
            {activeTab < 3 && form.categoryId && form.content ? (
              <Button onClick={() => setActiveTab(activeTab + 1)}>Next</Button>
            ) : (
              <>
                {activeTab === 3 && !editing && (
                  <Button variant="secondary" icon={<BookMarked size={14} />} onClick={() => {
                    if (!form.categoryId) { alert("Please complete estimation first."); return; }
                    const n = catalog.length + 1;
                    saveCatalogItem({
                      id: `GPC${String(n).padStart(3, "0")}`,
                      catalogNo: `GRV-CAT-${String(n).padStart(3, "0")}`,
                      createdDate: form.date,
                      productName: form.jobName,
                      customerId: form.customerId, customerName: form.customerName || "",
                      categoryId: form.categoryId, categoryName: form.categoryName || "", content: form.content || "",
                      jobWidth: form.jobWidth, jobHeight: form.jobHeight,
                      actualWidth: form.actualWidth, actualHeight: form.actualHeight,
                      noOfColors: form.noOfColors, printType: form.printType,
                      substrate: form.secondaryLayers.map(l => l.itemSubGroup).filter(Boolean).join(" + "),
                      secondaryLayers: form.secondaryLayers,
                      processes: form.processes,
                      machineId: form.machineId, machineName: form.machineName || "",
                      cylinderCostPerColor: form.cylinderCostPerColor,
                      overheadPct: form.overheadPct, profitPct: form.profitPct,
                      perMeterRate: costs.perMeterRate,
                      standardQty: form.quantity, standardUnit: form.unit,
                      sourceEstimationId: editing ? (editing as typeof data[0]).id : "",
                      sourceEstimationNo: editing ? (editing as typeof data[0]).estimationNo : "",
                      status: "Active", remarks: form.remarks,
                    });
                    alert(`"${form.jobName}" saved to Product Catalog!`);
                  }}>Save to Catalog</Button>
                )}
                <Button icon={<Calculator size={14} />} onClick={save}>
                  {editing ? "Update Estimation" : !altQty1 && !altQty2 ? "Save Estimation" : `Save ${1 + (altQty1 > 0 ? 1 : 0) + (altQty2 > 0 ? 1 : 0)} Estimations`}
                </Button>
              </>
            )}
          </div>
        </div>
      </Modal>

      {/* ══ VIEW MODAL ════════════════════════════════════════════ */}
      {viewRow && (
        <Modal open={!!viewRow} onClose={() => setViewRow(null)} title={`Estimation – ${viewRow.estimationNo}`} size="xl">
          <div className="space-y-5 text-sm">

            {/* Basic Info */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {([
                ["Customer",    viewRow.customerName],
                ["Job Name",    viewRow.jobName],
                ["Substrate",   viewRow.substrateName],
                ["Print Width", `${viewRow.width} mm`],
                ["Colors",      `${viewRow.noOfColors} Colors`],
                ["Print Type",  viewRow.printType],
                ["Machine",     viewRow.machineName],
                ["Quantity",    `${viewRow.quantity.toLocaleString()} ${viewRow.unit}`],
                ["Date",        viewRow.date],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k}><p className="text-xs text-gray-500">{k}</p><p className="font-medium text-gray-900">{v}</p></div>
              ))}
            </div>



            {/* Processes */}
            {viewRow.processes.length > 0 && (
              <div>
                <p className="text-xs font-bold text-purple-700 uppercase tracking-wide mb-2">Processes Applied</p>
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Material Cost",  val: `₹${viewRow.materialCost.toLocaleString()}`,  cls: "bg-blue-50 border-blue-200" },
                { label: "Process Cost",   val: `₹${viewRow.processCost.toLocaleString()}`,   cls: "bg-purple-50 border-purple-200" },
                { label: "Cylinder Cost",  val: `₹${viewRow.cylinderCost.toLocaleString()}`,  cls: "bg-indigo-50 border-indigo-200" },
                { label: "Overhead",       val: `₹${viewRow.overheadAmt.toLocaleString()}`,   cls: "bg-yellow-50 border-yellow-200" },
                { label: "Profit",         val: `₹${viewRow.profitAmt.toLocaleString()}`,     cls: "bg-green-50 border-green-200" },
                { label: "Total Amount",   val: `₹${viewRow.totalAmount.toLocaleString()}`,   cls: "bg-white border-2 border-purple-400 font-extrabold" },
                { label: "Rate / Meter",   val: `₹${viewRow.perMeterRate}`,                   cls: "bg-gray-50 border-gray-200" },
                { label: "Margin %",       val: `${viewRow.marginPct}%`,                      cls: viewRow.marginPct >= 12 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200" },
              ].map(s => (
                <div key={s.label} className={`rounded-xl border p-3 ${s.cls}`}>
                  <p className="text-xs text-gray-500">{s.label}</p>
                  <p className="font-bold text-gray-900 mt-0.5">{s.val}</p>
                </div>
              ))}
            </div>

            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${STATUS_COLORS[viewRow.status]}`}>
              {viewRow.status}
            </div>
            {viewRow.remarks && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                <strong>Remarks:</strong> {viewRow.remarks}
              </div>
            )}
          </div>
          <div className="flex justify-between mt-6">
            <Button variant="secondary" onClick={() => setViewRow(null)}>Close</Button>
            {viewRow.status === "Approved" && (
              <Button icon={<ArrowRight size={14} />}>Convert to Order</Button>
            )}
          </div>
        </Modal>
      )}

      {/* Delete Confirm */}
      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Confirm Delete" size="sm">
        <p className="text-sm text-gray-600">Delete this estimation? This cannot be undone.</p>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setDeleteId(null)}>Cancel</Button>
          <Button variant="danger" onClick={() => { setData(d => d.filter(r => r.id !== deleteId)); setDeleteId(null); }}>Delete</Button>
        </div>
      </Modal>

    </div>
  );
}
