"use client";
import { useState, useMemo } from "react";
import { Plus, Eye, Pencil, Trash2, ArrowRight, Calculator, X } from "lucide-react";
import {
  gravureEstimations as initData, gravureEnquiries, customers, items, machines, processMasters,
  GravureEstimation, GravureEstimationMaterial, GravureEstimationProcess,
} from "@/data/dummyData";
import { DataTable, Column } from "@/components/tables/DataTable";
import { statusBadge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Input, Select, Textarea } from "@/components/ui/Input";

// ─── Master-filtered lists ────────────────────────────────────
const FILM_ITEMS    = items.filter(i => i.group === "Film"     && i.active);
const INK_ITEMS     = items.filter(i => i.group === "Ink"      && i.active);
const SOLVENT_ITEMS = items.filter(i => i.group === "Solvent"  && i.active);
const ADHESIVE_ITEMS= items.filter(i => i.group === "Adhesive" && i.active);
const HARDNER_ITEMS = items.filter(i => i.group === "Hardner"  && i.active);
const ALL_MAT_ITEMS = [...FILM_ITEMS, ...INK_ITEMS, ...ADHESIVE_ITEMS, ...SOLVENT_ITEMS, ...HARDNER_ITEMS];

const PRINT_MACHINES  = machines.filter(m => m.department === "Printing");

const ROTO_PROCESSES  = processMasters.filter(p => p.module === "Rotogravure");

// ─── Blank form ───────────────────────────────────────────────
const blank: Omit<GravureEstimation, "id" | "estimationNo"> = {
  date: new Date().toISOString().slice(0, 10),
  enquiryId: "", enquiryNo: "",
  customerId: "", customerName: "",
  jobName: "",
  substrateItemId: "", substrateName: "",
  width: 0, noOfColors: 6,
  printType: "Surface Print",
  quantity: 0, unit: "Meter",
  machineId: "", machineName: "",
  cylinderCostPerColor: 3500,
  materials: [],
  processes: [],
  overheadPct: 12, profitPct: 15,
  materialCost: 0, processCost: 0, cylinderCost: 0,
  overheadAmt: 0, profitAmt: 0,
  totalAmount: 0, perMeterRate: 0, marginPct: 0,
  status: "Draft",
  remarks: "",
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

// ─── Cost calculator ──────────────────────────────────────────
function calcCosts(form: typeof blank) {
  const materialCost = form.materials.reduce((s, m) => s + m.amount, 0);
  const processCost  = form.processes.reduce((s, p) => s + p.amount, 0);
  const cylinderCost = form.cylinderCostPerColor * form.noOfColors;
  const sub          = materialCost + processCost + cylinderCost;
  const overheadAmt  = parseFloat(((sub * form.overheadPct) / 100).toFixed(2));
  const profitBase   = sub + overheadAmt;
  const profitAmt    = parseFloat(((profitBase * form.profitPct) / 100).toFixed(2));
  const totalAmount  = parseFloat((profitBase + profitAmt).toFixed(2));
  const perMeterRate = form.quantity > 0 ? parseFloat((totalAmount / form.quantity).toFixed(4)) : 0;
  const marginPct    = totalAmount > 0 ? parseFloat(((profitAmt / totalAmount) * 100).toFixed(1)) : 0;
  return { materialCost, processCost, cylinderCost, overheadAmt, profitAmt, totalAmount, perMeterRate, marginPct };
}

// ─── Section header ───────────────────────────────────────────
function SectionHeader({ label }: { label: string }) {
  return (
    <p className="text-xs font-bold text-purple-700 uppercase tracking-widest border-b border-gray-100 pb-2 mb-3">{label}</p>
  );
}

export default function GravureEstimationPage() {
  const [data, setData]       = useState<GravureEstimation[]>(initData);
  const [modalOpen, setModal] = useState(false);
  const [viewRow, setViewRow] = useState<GravureEstimation | null>(null);
  const [editing, setEditing] = useState<GravureEstimation | null>(null);
  const [form, setForm]       = useState<typeof blank>({ ...blank });
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Derived costs (live)
  const costs = useMemo(() => calcCosts(form), [form]);

  const f = (k: keyof typeof blank, v: unknown) => setForm(p => ({ ...p, [k]: v }));

  const openAdd = () => { setEditing(null); setForm({ ...blank }); setModal(true); };
  const openEdit = (row: GravureEstimation) => {
    setEditing(row);
    const { id, estimationNo, ...rest } = row;
    setForm(rest);
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

  // ── Save ─────────────────────────────────────────────────
  const save = () => {
    if (!form.customerId || !form.jobName || !form.substrateItemId || !form.machineId) return;
    const record = { ...form, ...costs };
    if (editing) {
      setData(d => d.map(r => r.id === editing.id ? { ...record, id: editing.id, estimationNo: editing.estimationNo } : r));
    } else {
      const n = data.length + 1;
      setData(d => [...d, { ...record, id: `GEST${String(n + 3).padStart(3, "0")}`, estimationNo: `GRV-EST-2024-${String(n + 3).padStart(3, "0")}` }]);
    }
    setModal(false);
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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
        <div className="space-y-6">

          {/* ── Section 1: Basic Info ─────────────────────────── */}
          <div>
            <SectionHeader label="Basic Info" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Date" type="date" value={form.date} onChange={e => f("date", e.target.value)} />

              {/* From Enquiry – auto-fills fields */}
              <Select
                label="From Enquiry (optional)"
                value={form.enquiryId}
                onChange={e => {
                  const enq = gravureEnquiries.find(x => x.id === e.target.value);
                  if (!enq) { f("enquiryId", ""); return; }
                  setForm(p => ({
                    ...p,
                    enquiryId: enq.id, enquiryNo: enq.enquiryNo,
                    customerId: enq.customerId, customerName: enq.customerName,
                    jobName: enq.jobName,
                    width: enq.width, noOfColors: enq.noOfColors,
                    printType: enq.printType,
                    quantity: enq.quantity, unit: enq.unit,
                  }));
                }}
                options={[{ value: "", label: "-- Direct Estimation --" }, ...gravureEnquiries.map(e => ({ value: e.id, label: `${e.enquiryNo} – ${e.customerName}` }))]}
              />

              {/* Customer Master dropdown */}
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

              {/* Substrate from Item Master (Film group) */}
              <Select
                label="Substrate Film * (Item Master)"
                value={form.substrateItemId}
                onChange={e => {
                  const it = FILM_ITEMS.find(x => x.id === e.target.value);
                  f("substrateItemId", e.target.value);
                  if (it) f("substrateName", it.name);
                }}
                options={[{ value: "", label: "-- Select Substrate --" }, ...FILM_ITEMS.map(i => ({ value: i.id, label: `${i.name} (${i.subGroup})` }))]}
              />

              <Input label="Print Width (mm)" type="number" value={form.width} onChange={e => f("width", Number(e.target.value))} />
              <Input label="No. of Colors" type="number" value={form.noOfColors} onChange={e => f("noOfColors", Number(e.target.value))} min={1} max={12} />

              <Select label="Print Type" value={form.printType} onChange={e => f("printType", e.target.value)}
                options={[
                  { value: "Surface Print", label: "Surface Print" },
                  { value: "Reverse Print", label: "Reverse Print" },
                  { value: "Combination",   label: "Combination" },
                ]} />

              <Input label="Quantity" type="number" value={form.quantity} onChange={e => f("quantity", Number(e.target.value))} />
              <Select label="Unit" value={form.unit} onChange={e => f("unit", e.target.value)}
                options={[{ value: "Meter", label: "Meter" }, { value: "Kg", label: "Kg" }]} />
            </div>
          </div>

          {/* ── Section 2: Machine & Process ──────────────────── */}
          <div>
            <SectionHeader label="Machine & Process Selection" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
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
                No processes added. Click "Add Process" to select from Process Master.
              </div>
            )}
          </div>

          {/* ── Section 3: Material Allocation ────────────────── */}
          <div>
            <SectionHeader label="Material Allocation (Item Master)" />
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-500">Select items from Item Master — no manual entry</p>
              <button onClick={addMaterial}
                className="flex items-center gap-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg border border-blue-200 transition">
                <Plus size={12} /> Add Material
              </button>
            </div>

            {form.materials.length > 0 ? (
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-50 text-gray-500 uppercase">
                    <tr>
                      {["Item (Master)", "Group", "Unit", "Rate (₹)", "Qty", "Amount (₹)", ""].map(h => (
                        <th key={h} className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {form.materials.map((mat, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-3 py-2 min-w-[220px]">
                          <select
                            value={mat.itemId}
                            onChange={e => selectMaterialItem(i, e.target.value)}
                            className={cellInput}
                          >
                            <option value="">-- Select Item --</option>
                            <optgroup label="Film / Substrate">
                              {FILM_ITEMS.map(it => <option key={it.id} value={it.id}>{it.name}</option>)}
                            </optgroup>
                            <optgroup label="Ink">
                              {INK_ITEMS.map(it => <option key={it.id} value={it.id}>{it.name}</option>)}
                            </optgroup>
                            <optgroup label="Adhesive">
                              {ADHESIVE_ITEMS.map(it => <option key={it.id} value={it.id}>{it.name}</option>)}
                            </optgroup>
                            <optgroup label="Solvent">
                              {SOLVENT_ITEMS.map(it => <option key={it.id} value={it.id}>{it.name}</option>)}
                            </optgroup>
                            <optgroup label="Hardner">
                              {HARDNER_ITEMS.map(it => <option key={it.id} value={it.id}>{it.name}</option>)}
                            </optgroup>
                          </select>
                        </td>
                        <td className="px-3 py-2 w-24">
                          {mat.group ? (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${GROUP_COLORS[mat.group] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}>
                              {mat.group}
                            </span>
                          ) : "—"}
                        </td>
                        <td className="px-3 py-2 w-20">
                          <span className="font-mono text-gray-600">{mat.unit || "—"}</span>
                        </td>
                        <td className="px-3 py-2 w-28">
                          <input type="number" value={mat.rate} onChange={e => updateMaterial(i, { rate: Number(e.target.value) })}
                            className={`${cellInput} text-right`} step={0.01} />
                        </td>
                        <td className="px-3 py-2 w-28">
                          <input type="number" value={mat.qty} onChange={e => updateMaterial(i, { qty: Number(e.target.value) })}
                            className={`${cellInput} text-right`} />
                        </td>
                        <td className="px-3 py-2 w-32 text-right font-semibold text-gray-800">₹{mat.amount.toLocaleString()}</td>
                        <td className="px-3 py-2 w-8 text-center">
                          <button onClick={() => removeMaterial(i)} className="text-red-400 hover:text-red-600"><X size={14} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-blue-50 border-t border-blue-200">
                    <tr>
                      <td colSpan={5} className="px-3 py-2.5 text-xs font-bold text-blue-700 uppercase">Material Cost</td>
                      <td className="px-3 py-2.5 text-sm font-bold text-blue-800 text-right">₹{costs.materialCost.toLocaleString()}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="border-2 border-dashed border-blue-200 rounded-xl py-6 text-center text-xs text-gray-400">
                No materials added. Click "Add Material" to select from Item Master.
              </div>
            )}
          </div>

          {/* ── Section 4: Overhead & Profit ──────────────────── */}
          <div>
            <SectionHeader label="Overhead & Profit" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Input label="Overhead (%)" type="number" value={form.overheadPct} onChange={e => f("overheadPct", Number(e.target.value))} />
              <Input label="Profit (%)" type="number" value={form.profitPct} onChange={e => f("profitPct", Number(e.target.value))} />
              <Select label="Status" value={form.status} onChange={e => f("status", e.target.value)}
                options={[
                  { value: "Draft",    label: "Draft" },
                  { value: "Approved", label: "Approved" },
                  { value: "Sent",     label: "Sent to Customer" },
                  { value: "Accepted", label: "Accepted" },
                  { value: "Rejected", label: "Rejected" },
                ]} />
            </div>
          </div>

          {/* ── Section 5: Live Cost Summary ──────────────────── */}
          <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-5">
            <SectionHeader label="Cost Summary (Auto-Calculated)" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              {[
                { label: "Material Cost",   val: `₹${costs.materialCost.toLocaleString()}`,  cls: "bg-blue-50 border-blue-200 text-blue-700" },
                { label: "Process Cost",    val: `₹${costs.processCost.toLocaleString()}`,   cls: "bg-purple-50 border-purple-200 text-purple-700" },
                { label: `Cylinder (${form.noOfColors}C × ₹${form.cylinderCostPerColor.toLocaleString()})`,
                                            val: `₹${costs.cylinderCost.toLocaleString()}`,  cls: "bg-indigo-50 border-indigo-200 text-indigo-700" },
                { label: `Overhead (${form.overheadPct}%)`, val: `₹${costs.overheadAmt.toLocaleString()}`, cls: "bg-yellow-50 border-yellow-200 text-yellow-700" },
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
                <p className="text-base font-bold text-green-700">₹{costs.profitAmt.toLocaleString()}</p>
              </div>
              <div className="bg-white border-2 border-purple-400 rounded-xl p-3">
                <p className="text-xs font-bold text-purple-700 uppercase tracking-wide">Total Amount</p>
                <p className="text-2xl font-black text-purple-800">₹{costs.totalAmount.toLocaleString()}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                  <p className="text-xs text-gray-500">Rate / Meter</p>
                  <p className="text-sm font-bold text-gray-800">₹{costs.perMeterRate}</p>
                </div>
                <div className={`rounded-xl border p-3 ${costs.marginPct >= 12 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
                  <p className="text-xs text-gray-500">Margin %</p>
                  <p className={`text-sm font-bold ${costs.marginPct >= 12 ? "text-green-700" : "text-red-600"}`}>{costs.marginPct}%</p>
                </div>
              </div>
            </div>
          </div>

          <Textarea label="Remarks / Notes" value={form.remarks} onChange={e => f("remarks", e.target.value)} placeholder="Price validity, special terms, notes..." />
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
          <Button icon={<Calculator size={14} />} onClick={save}>{editing ? "Update Estimation" : "Save Estimation"}</Button>
        </div>
      </Modal>

      {/* ══ VIEW MODAL ════════════════════════════════════════════ */}
      {viewRow && (
        <Modal open={!!viewRow} onClose={() => setViewRow(null)} title={`Estimation – ${viewRow.estimationNo}`} size="xl">
          <div className="space-y-5 text-sm">

            {/* Basic Info */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
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

            {/* Materials */}
            {viewRow.materials.length > 0 && (
              <div>
                <p className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-2">Materials Used</p>
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <table className="min-w-full text-xs">
                    <thead className="bg-gray-50 text-gray-500 uppercase">
                      <tr>{["Item", "Group", "Rate", "Qty", "Unit", "Amount"].map(h => <th key={h} className="px-3 py-2.5 text-left font-semibold">{h}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {viewRow.materials.map((m, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-3 py-2.5 font-medium text-gray-800">{m.itemName}</td>
                          <td className="px-3 py-2.5">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${GROUP_COLORS[m.group] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}>{m.group}</span>
                          </td>
                          <td className="px-3 py-2.5 text-gray-700">₹{m.rate}</td>
                          <td className="px-3 py-2.5 text-gray-700">{m.qty.toLocaleString()}</td>
                          <td className="px-3 py-2.5 text-gray-700">{m.unit}</td>
                          <td className="px-3 py-2.5 font-semibold text-gray-900">₹{m.amount.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-blue-50 border-t border-blue-200">
                      <tr><td colSpan={5} className="px-3 py-2 text-xs font-bold text-blue-700">Material Total</td><td className="px-3 py-2 font-bold text-blue-800">₹{viewRow.materialCost.toLocaleString()}</td></tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

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
