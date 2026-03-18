"use client";
import { useState } from "react";
import { Plus, Eye, Pencil, Trash2, PlayCircle } from "lucide-react";
import { gravureProductionEntries as initData, gravureWorkOrders, machines, GravureProductionEntry } from "@/data/dummyData";
import { DataTable, Column } from "@/components/tables/DataTable";
import { statusBadge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Input, Select, Textarea } from "@/components/ui/Input";

const blank: Omit<GravureProductionEntry, "id" | "entryNo" | "netQty"> = {
  date: new Date().toISOString().slice(0, 10),
  workOrderId: "", workOrderNo: "",
  machineId: "", machineName: "",
  shift: "A", rollNo: "", substrate: "",
  printedQty: 0, wastageQty: 0,
  speed: 0, inkConsumption: 0, machineRuntime: 8,
  printQuality: "Good", remarks: "",
};

const qualityColors: Record<string, string> = {
  Good:     "bg-green-50 text-green-700 border-green-200",
  Rework:   "bg-yellow-50 text-yellow-700 border-yellow-200",
  Rejected: "bg-red-50 text-red-600 border-red-200",
};

export default function GravureProductionPage() {
  const [data, setData]         = useState<GravureProductionEntry[]>(initData);
  const [modalOpen, setModal]   = useState(false);
  const [viewRow, setViewRow]   = useState<GravureProductionEntry | null>(null);
  const [editing, setEditing]   = useState<GravureProductionEntry | null>(null);
  const [form, setForm]         = useState<Omit<GravureProductionEntry, "id" | "entryNo" | "netQty">>(blank);

  const f = (k: keyof typeof form, v: string | number) => setForm(p => ({ ...p, [k]: v }));

  const netQty    = form.printedQty - form.wastageQty;
  const wastePct  = form.printedQty > 0 ? ((form.wastageQty / form.printedQty) * 100).toFixed(1) : "0";
  const efficiency = form.machineRuntime > 0 && form.speed > 0
    ? ((form.netQty ?? netQty) / (form.machineRuntime * 60 * form.speed) * 100).toFixed(1)
    : "—";

  const openAdd  = () => { setEditing(null); setForm(blank); setModal(true); };
  const openEdit = (row: GravureProductionEntry) => {
    setEditing(row);
    const { id, entryNo, netQty: nq, ...rest } = row;
    setForm(rest);
    setModal(true);
  };

  const save = () => {
    if (!form.workOrderId || !form.rollNo) return;
    const record = { ...form, netQty };
    if (editing) {
      setData(d => d.map(r => r.id === editing.id ? { ...record, id: editing.id, entryNo: editing.entryNo } : r));
    } else {
      const n = data.length + 1;
      setData(d => [...d, { ...record, id: `GPE${String(n + 4).padStart(3, "0")}`, entryNo: `GRV-PROD-2024-${String(n + 4).padStart(3, "0")}` }]);
    }
    setModal(false);
  };

  const totalPrinted = data.reduce((s, d) => s + d.printedQty, 0);
  const totalWastage = data.reduce((s, d) => s + d.wastageQty, 0);
  const totalNet     = data.reduce((s, d) => s + d.netQty, 0);
  const avgWastePct  = totalPrinted > 0 ? ((totalWastage / totalPrinted) * 100).toFixed(1) : "0";

  const columns: Column<GravureProductionEntry>[] = [
    { key: "entryNo",      header: "Entry No",     sortable: true },
    { key: "date",         header: "Date",          sortable: true },
    { key: "workOrderNo",  header: "Work Order" },
    { key: "machineName",  header: "Machine" },
    { key: "shift",        header: "Shift",    render: r => statusBadge(r.shift) },
    { key: "rollNo",       header: "Roll No", render: r => <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{r.rollNo}</span> },
    { key: "printedQty",   header: "Printed (m)",  render: r => <span>{r.printedQty.toLocaleString()}</span> },
    { key: "wastageQty",   header: "Wastage (m)",  render: r => <span className="text-red-500 font-medium">{r.wastageQty.toLocaleString()}</span> },
    { key: "netQty",       header: "Net (m)",      render: r => <span className="font-semibold text-green-700">{r.netQty.toLocaleString()}</span> },
    { key: "speed",        header: "Speed", render: r => <span className="text-xs">{r.speed} m/min</span> },
    { key: "printQuality", header: "Quality", render: r => (
      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${qualityColors[r.printQuality]}`}>{r.printQuality}</span>
    )},
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <PlayCircle size={18} className="text-purple-600" />
            <h2 className="text-lg font-semibold text-gray-800">Gravure Production Entry</h2>
          </div>
          <p className="text-sm text-gray-500">{data.length} entries · {totalNet.toLocaleString()}m net printed</p>
        </div>
        <Button icon={<Plus size={16} />} onClick={openAdd}>New Entry</Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Printed",  val: `${totalPrinted.toLocaleString()} m`, cls: "bg-blue-50 text-blue-700 border-blue-200" },
          { label: "Total Wastage",  val: `${totalWastage.toLocaleString()} m`, cls: "bg-red-50 text-red-700 border-red-200" },
          { label: "Net Production", val: `${totalNet.toLocaleString()} m`,     cls: "bg-green-50 text-green-700 border-green-200" },
          { label: "Avg Wastage %",  val: `${avgWastePct}%`,                   cls: "bg-yellow-50 text-yellow-700 border-yellow-200" },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border p-4 ${s.cls}`}>
            <p className="text-xs font-medium">{s.label}</p>
            <p className="text-xl font-bold mt-1">{s.val}</p>
          </div>
        ))}
      </div>

      {/* Quality Breakdown */}
      <div className="grid grid-cols-3 gap-4">
        {(["Good", "Rework", "Rejected"] as const).map(q => (
          <div key={q} className={`rounded-xl border p-4 ${qualityColors[q]}`}>
            <p className="text-xs font-medium">Print Quality: {q}</p>
            <p className="text-2xl font-bold mt-1">{data.filter(d => d.printQuality === q).length} rolls</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <DataTable
          data={data}
          columns={columns}
          searchKeys={["entryNo", "workOrderNo", "machineName", "rollNo"]}
          actions={row => (
            <div className="flex items-center gap-1.5 justify-end">
              <Button variant="ghost" size="sm" icon={<Eye size={13} />} onClick={() => setViewRow(row)}>View</Button>
              <Button variant="ghost" size="sm" icon={<Pencil size={13} />} onClick={() => openEdit(row)}>Edit</Button>
              <Button variant="danger" size="sm" icon={<Trash2 size={13} />} onClick={() => setData(d => d.filter(r => r.id !== row.id))}>Delete</Button>
            </div>
          )}
        />
      </div>

      {/* Form Modal */}
      <Modal open={modalOpen} onClose={() => setModal(false)} title={editing ? "Edit Production Entry" : "New Gravure Production Entry"} size="xl">
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Date" type="date" value={form.date} onChange={e => f("date", e.target.value)} />
            <Select
              label="Work Order *"
              value={form.workOrderId}
              onChange={e => {
                const wo = gravureWorkOrders.find(x => x.id === e.target.value);
                if (wo) {
                  f("workOrderId", wo.id); f("workOrderNo", wo.workOrderNo);
                  f("machineId", wo.machineId); f("machineName", wo.machineName);
                  f("substrate", wo.substrate);
                }
              }}
              options={[{ value: "", label: "-- Select Work Order --" }, ...gravureWorkOrders.filter(w => w.status === "In Progress" || w.status === "Open").map(w => ({ value: w.id, label: `${w.workOrderNo} – ${w.customerName}` }))]}
            />
            <Input label="Machine" value={form.machineName} readOnly className="bg-gray-50" />
            <Select
              label="Shift"
              value={form.shift}
              onChange={e => f("shift", e.target.value)}
              options={[{ value: "A", label: "Shift A" }, { value: "B", label: "Shift B" }, { value: "C", label: "Shift C" }]}
            />
            <Input label="Roll No *" value={form.rollNo} onChange={e => f("rollNo", e.target.value)} placeholder="e.g. GRV-ROLL-005" />
            <Input label="Substrate" value={form.substrate} onChange={e => f("substrate", e.target.value)} placeholder="e.g. BOPP 20μ" />
            <Input label="Machine Runtime (hr)" type="number" value={form.machineRuntime} onChange={e => f("machineRuntime", Number(e.target.value))} step={0.5} />
            <Input label="Machine Speed (m/min)" type="number" value={form.speed} onChange={e => f("speed", Number(e.target.value))} />
            <Input label="Printed Qty (m)" type="number" value={form.printedQty} onChange={e => f("printedQty", Number(e.target.value))} />
            <Input label="Wastage Qty (m)" type="number" value={form.wastageQty} onChange={e => f("wastageQty", Number(e.target.value))} />
            <Input label="Ink Consumption (Kg)" type="number" value={form.inkConsumption} onChange={e => f("inkConsumption", Number(e.target.value))} step={0.1} />
            <Select
              label="Print Quality"
              value={form.printQuality}
              onChange={e => f("printQuality", e.target.value)}
              options={[
                { value: "Good",     label: "Good – Approved" },
                { value: "Rework",   label: "Rework Required" },
                { value: "Rejected", label: "Rejected" },
              ]}
            />
          </div>

          {/* Live Calculation */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-green-50 border border-green-200 rounded-xl p-3">
              <p className="text-xs text-gray-500">Net Printed</p>
              <p className="text-lg font-bold text-green-700">{netQty.toLocaleString()} m</p>
            </div>
            <div className={`rounded-xl border p-3 ${Number(wastePct) > 4 ? "bg-red-50 border-red-200" : "bg-yellow-50 border-yellow-200"}`}>
              <p className="text-xs text-gray-500">Wastage %</p>
              <p className={`text-lg font-bold ${Number(wastePct) > 4 ? "text-red-600" : "text-yellow-700"}`}>{wastePct}%</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
              <p className="text-xs text-gray-500">Runtime</p>
              <p className="text-lg font-bold text-blue-700">{form.machineRuntime} hr</p>
            </div>
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3">
              <p className="text-xs text-gray-500">Ink Used</p>
              <p className="text-lg font-bold text-indigo-700">{form.inkConsumption} Kg</p>
            </div>
          </div>

          <Textarea label="Remarks / Observations" value={form.remarks} onChange={e => f("remarks", e.target.value)} placeholder="Color issues, machine stoppages, quality notes..." />
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
          <Button onClick={save}>{editing ? "Update" : "Save Entry"}</Button>
        </div>
      </Modal>

      {/* View Modal */}
      {viewRow && (
        <Modal open={!!viewRow} onClose={() => setViewRow(null)} title={`Production Entry – ${viewRow.entryNo}`} size="lg">
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-4">
              {([
                ["Date",       viewRow.date],
                ["Work Order", viewRow.workOrderNo],
                ["Machine",    viewRow.machineName],
                ["Shift",      `Shift ${viewRow.shift}`],
                ["Roll No",    viewRow.rollNo],
                ["Substrate",  viewRow.substrate],
                ["Speed",      `${viewRow.speed} m/min`],
                ["Runtime",    `${viewRow.machineRuntime} hr`],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k}><p className="text-xs text-gray-500">{k}</p><p className="font-medium text-gray-900">{v}</p></div>
              ))}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                <p className="text-xs text-gray-500">Printed</p>
                <p className="font-bold text-blue-700">{viewRow.printedQty.toLocaleString()} m</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                <p className="text-xs text-gray-500">Wastage</p>
                <p className="font-bold text-red-600">{viewRow.wastageQty.toLocaleString()} m</p>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                <p className="text-xs text-gray-500">Net Qty</p>
                <p className="font-bold text-green-700">{viewRow.netQty.toLocaleString()} m</p>
              </div>
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3">
                <p className="text-xs text-gray-500">Ink Used</p>
                <p className="font-bold text-indigo-700">{viewRow.inkConsumption} Kg</p>
              </div>
            </div>

            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${qualityColors[viewRow.printQuality]}`}>
              Print Quality: {viewRow.printQuality}
            </div>

            {viewRow.remarks && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
                <strong>Remarks:</strong> {viewRow.remarks}
              </div>
            )}
          </div>
          <div className="flex justify-end mt-6">
            <Button variant="secondary" onClick={() => setViewRow(null)}>Close</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
