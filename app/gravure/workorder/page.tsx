"use client";
import { useState } from "react";
import { Plus, Eye, Pencil, Trash2, Printer, CheckCircle2, ClipboardList } from "lucide-react";
import { gravureWorkOrders as initData, gravureOrders, machines, employees, customers, GravureWorkOrder } from "@/data/dummyData";
import { DataTable, Column } from "@/components/tables/DataTable";
import { statusBadge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Input, Select, Textarea } from "@/components/ui/Input";

const INK_COLORS = ["Cyan", "Magenta", "Yellow", "Black", "White", "Red", "Green", "Blue", "Orange", "Gold", "Silver", "Violet", "Brown", "Pink"];

const blank: Omit<GravureWorkOrder, "id" | "workOrderNo"> = {
  date: new Date().toISOString().slice(0, 10),
  orderId: "", orderNo: "",
  customerId: "", customerName: "",
  jobName: "", substrate: "",
  width: 0, noOfColors: 6,
  printType: "Surface Print",
  machineId: "", machineName: "",
  operatorId: "", operatorName: "",
  cylinderSet: "", inks: [],
  quantity: 0, unit: "Meter",
  plannedDate: "", specialInstructions: "",
  status: "Open",
};

const statusColors: Record<string, string> = {
  Open:         "bg-gray-50 text-gray-600 border-gray-200",
  "In Progress":"bg-yellow-50 text-yellow-700 border-yellow-200",
  Completed:    "bg-green-50 text-green-700 border-green-200",
  "On Hold":    "bg-red-50 text-red-700 border-red-200",
};

export default function GravureWorkOrderPage() {
  const [data, setData]         = useState<GravureWorkOrder[]>(initData);
  const [modalOpen, setModal]   = useState(false);
  const [viewRow, setViewRow]   = useState<GravureWorkOrder | null>(null);
  const [editing, setEditing]   = useState<GravureWorkOrder | null>(null);
  const [form, setForm]         = useState<Omit<GravureWorkOrder, "id" | "workOrderNo">>(blank);

  const f = (k: keyof typeof form, v: string | number) => setForm(p => ({ ...p, [k]: v }));

  const toggleInk = (color: string) =>
    setForm(p => ({
      ...p,
      inks: p.inks.includes(color) ? p.inks.filter(c => c !== color) : [...p.inks, color],
    }));

  const openAdd  = () => { setEditing(null); setForm(blank); setModal(true); };
  const openEdit = (row: GravureWorkOrder) => { setEditing(row); setForm({ ...row }); setModal(true); };

  const save = () => {
    if (!form.customerId || !form.machineId) return;
    if (editing) {
      setData(d => d.map(r => r.id === editing.id ? { ...form, id: editing.id, workOrderNo: editing.workOrderNo } : r));
    } else {
      const n = data.length + 1;
      setData(d => [...d, { ...form, id: `GWO${String(n + 3).padStart(3, "0")}`, workOrderNo: `GRV-WO-2024-${String(n + 3).padStart(3, "0")}` }]);
    }
    setModal(false);
  };

  const rotoMachines = machines.filter(m => m.department === "Printing");

  const columns: Column<GravureWorkOrder>[] = [
    { key: "workOrderNo",  header: "Work Order No", sortable: true },
    { key: "date",         header: "Date",           sortable: true },
    { key: "customerName", header: "Customer",       sortable: true },
    { key: "jobName",      header: "Job Name" },
    { key: "substrate",    header: "Substrate", render: r => <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full text-xs">{r.substrate}</span> },
    { key: "noOfColors",   header: "Colors",    render: r => <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold">{r.noOfColors}C</span> },
    { key: "machineName",  header: "Machine" },
    { key: "operatorName", header: "Operator" },
    { key: "plannedDate",  header: "Planned Date" },
    { key: "cylinderSet",  header: "Cylinder Set", render: r => <span className="font-mono text-xs">{r.cylinderSet || "—"}</span> },
    { key: "status",       header: "Status", render: r => statusBadge(r.status), sortable: true },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <ClipboardList size={18} className="text-purple-600" />
            <h2 className="text-lg font-semibold text-gray-800">Gravure Production Work Order</h2>
          </div>
          <p className="text-sm text-gray-500">{data.length} work orders · {data.filter(w => w.status === "In Progress").length} in progress</p>
        </div>
        <Button icon={<Plus size={16} />} onClick={openAdd}>New Work Order</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {(["Open", "In Progress", "Completed", "On Hold"] as const).map(s => (
          <div key={s} className={`rounded-xl border p-4 ${statusColors[s]}`}>
            <p className="text-xs font-medium">{s}</p>
            <p className="text-2xl font-bold mt-1">{data.filter(w => w.status === s).length}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <DataTable
          data={data}
          columns={columns}
          searchKeys={["workOrderNo", "customerName", "jobName", "machineName"]}
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
      <Modal open={modalOpen} onClose={() => setModal(false)} title={editing ? `Edit – ${editing.workOrderNo}` : "New Production Work Order"} size="xl">
        <div className="space-y-5">
          {/* Basic Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Date" type="date" value={form.date} onChange={e => f("date", e.target.value)} />
            <Select
              label="Order"
              value={form.orderId}
              onChange={e => {
                const o = gravureOrders.find(x => x.id === e.target.value);
                if (o) {
                  f("orderId", o.id); f("orderNo", o.orderNo);
                  f("customerId", o.customerId); f("customerName", o.customerName);
                  f("jobName", o.jobName); f("substrate", o.substrate);
                  f("width", o.width); f("noOfColors", o.noOfColors);
                  f("quantity", o.quantity); f("unit", o.unit);
                  f("cylinderSet", o.cylinderSet);
                }
              }}
              options={[{ value: "", label: "-- Select Order --" }, ...gravureOrders.filter(o => o.status !== "Dispatched").map(o => ({ value: o.id, label: `${o.orderNo} – ${o.customerName}` }))]}
            />
            <Input label="Customer" value={form.customerName} readOnly className="bg-gray-50" />
            <Input label="Job Name" value={form.jobName} onChange={e => f("jobName", e.target.value)} placeholder="Job name" />
            <Input label="Substrate" value={form.substrate} onChange={e => f("substrate", e.target.value)} placeholder="e.g. BOPP 20μ" />
            <Input label="Print Width (mm)" type="number" value={form.width} onChange={e => f("width", Number(e.target.value))} />
            <Input label="No. of Colors" type="number" value={form.noOfColors} onChange={e => f("noOfColors", Number(e.target.value))} min={1} max={12} />
            <Select label="Print Type" value={form.printType} onChange={e => f("printType", e.target.value)}
              options={[
                { value: "Surface Print", label: "Surface Print" },
                { value: "Reverse Print", label: "Reverse Print" },
                { value: "Combination",   label: "Combination" },
              ]} />
          </div>

          {/* Machine & Operator */}
          <div>
            <p className="text-xs font-bold text-purple-700 uppercase tracking-widest mb-3 border-b border-gray-100 pb-2">Machine & Operator Assignment</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Machine *"
                value={form.machineId}
                onChange={e => {
                  const m = rotoMachines.find(x => x.id === e.target.value);
                  if (m) { f("machineId", m.id); f("machineName", m.name); }
                }}
                options={rotoMachines.map(m => ({ value: m.id, label: `${m.name} (${m.status})` }))}
              />
              <Select
                label="Operator *"
                value={form.operatorId}
                onChange={e => {
                  const emp = employees.find(x => x.id === e.target.value);
                  if (emp) { f("operatorId", emp.id); f("operatorName", emp.name); }
                }}
                options={employees.filter(e => e.status === "Active").map(e => ({ value: e.id, label: `${e.name} (${e.department})` }))}
              />
              <Input label="Cylinder Set Code" value={form.cylinderSet} onChange={e => f("cylinderSet", e.target.value)} placeholder="e.g. CYL-P001" />
              <Input label="Planned Date" type="date" value={form.plannedDate} onChange={e => f("plannedDate", e.target.value)} />
              <Input label="Quantity" type="number" value={form.quantity} onChange={e => f("quantity", Number(e.target.value))} />
              <Select label="Status" value={form.status} onChange={e => f("status", e.target.value)}
                options={[
                  { value: "Open",         label: "Open" },
                  { value: "In Progress",  label: "In Progress" },
                  { value: "Completed",    label: "Completed" },
                  { value: "On Hold",      label: "On Hold" },
                ]} />
            </div>
          </div>

          {/* Ink Selection */}
          <div>
            <p className="text-xs font-bold text-purple-700 uppercase tracking-widest mb-3 border-b border-gray-100 pb-2">
              Ink Colors Selection ({form.inks.length}/{form.noOfColors})
            </p>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {INK_COLORS.map(color => {
                const selected = form.inks.includes(color);
                return (
                  <button
                    key={color}
                    onClick={() => toggleInk(color)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-all ${selected ? "border-purple-500 bg-purple-50 text-purple-800" : "border-gray-200 hover:border-gray-300 text-gray-600"}`}
                  >
                    {selected && <CheckCircle2 size={12} className="text-purple-600" />}
                    {color}
                  </button>
                );
              })}
            </div>
            {form.inks.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {form.inks.map(c => (
                  <span key={c} className="px-2.5 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium border border-purple-200">{c}</span>
                ))}
              </div>
            )}
          </div>

          <Textarea label="Special Instructions" value={form.specialInstructions} onChange={e => f("specialInstructions", e.target.value)} placeholder="Color matching, proofing instructions, approval notes..." />
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
          <Button icon={<Printer size={14} />} onClick={save}>{editing ? "Update" : "Create Work Order"}</Button>
        </div>
      </Modal>

      {/* View Modal */}
      {viewRow && (
        <Modal open={!!viewRow} onClose={() => setViewRow(null)} title={`Work Order – ${viewRow.workOrderNo}`} size="lg">
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-4">
              {([
                ["Customer",      viewRow.customerName],
                ["Job Name",      viewRow.jobName],
                ["Substrate",     viewRow.substrate],
                ["Width",         `${viewRow.width} mm`],
                ["No. of Colors", `${viewRow.noOfColors} Colors`],
                ["Print Type",    viewRow.printType],
                ["Machine",       viewRow.machineName],
                ["Operator",      viewRow.operatorName],
                ["Cylinder Set",  viewRow.cylinderSet || "—"],
                ["Planned Date",  viewRow.plannedDate || "—"],
                ["Quantity",      `${viewRow.quantity.toLocaleString()} ${viewRow.unit}`],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k}><p className="text-xs text-gray-500">{k}</p><p className="font-medium text-gray-900">{v}</p></div>
              ))}
            </div>

            {viewRow.inks.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-2">Ink Colors</p>
                <div className="flex flex-wrap gap-1.5">
                  {viewRow.inks.map(c => (
                    <span key={c} className="px-2.5 py-1 bg-purple-50 text-purple-700 rounded-full text-xs font-medium border border-purple-200">{c}</span>
                  ))}
                </div>
              </div>
            )}

            {viewRow.specialInstructions && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
                <strong>Special Instructions:</strong> {viewRow.specialInstructions}
              </div>
            )}

            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${statusColors[viewRow.status]}`}>
              {viewRow.status}
            </div>
          </div>
          <div className="flex justify-end mt-6">
            <Button variant="secondary" onClick={() => setViewRow(null)}>Close</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
