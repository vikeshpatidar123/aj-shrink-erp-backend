"use client";
import { useState } from "react";
import { Plus, Eye, Pencil, Trash2, ArrowRight, ShoppingCart } from "lucide-react";
import { gravureOrders as initData, gravureEnquiries, gravureEstimations, customers, GravureOrder } from "@/data/dummyData";
import { DataTable, Column } from "@/components/tables/DataTable";
import { statusBadge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Input, Select } from "@/components/ui/Input";

const blank: Omit<GravureOrder, "id" | "orderNo"> = {
  date: new Date().toISOString().slice(0, 10),
  enquiryId: "", estimationId: "",
  customerId: "", customerName: "",
  jobName: "", substrate: "", structure: "",
  width: 0, noOfColors: 6,
  quantity: 0, unit: "Meter",
  deliveryDate: "", cylinderSet: "",
  totalAmount: 0, advancePaid: 0,
  status: "Confirmed",
};

const statusColors: Record<string, string> = {
  Confirmed:    "bg-blue-50 text-blue-700 border-blue-200",
  "In Production": "bg-yellow-50 text-yellow-700 border-yellow-200",
  Ready:        "bg-purple-50 text-purple-700 border-purple-200",
  Dispatched:   "bg-green-50 text-green-700 border-green-200",
};

export default function GravureOrdersPage() {
  const [data, setData]         = useState<GravureOrder[]>(initData);
  const [modalOpen, setModal]   = useState(false);
  const [viewRow, setViewRow]   = useState<GravureOrder | null>(null);
  const [editing, setEditing]   = useState<GravureOrder | null>(null);
  const [form, setForm]         = useState<Omit<GravureOrder, "id" | "orderNo">>(blank);

  const f = (k: keyof typeof form, v: string | number) => setForm(p => ({ ...p, [k]: v }));

  const openAdd  = () => { setEditing(null); setForm(blank); setModal(true); };
  const openEdit = (row: GravureOrder) => { setEditing(row); setForm({ ...row }); setModal(true); };

  const save = () => {
    if (!form.customerId || !form.jobName) return;
    if (editing) {
      setData(d => d.map(r => r.id === editing.id ? { ...form, id: editing.id, orderNo: editing.orderNo } : r));
    } else {
      const n = data.length + 1;
      setData(d => [...d, { ...form, id: `GO${String(n + 4).padStart(3, "0")}`, orderNo: `GRV-ORD-2024-${String(n + 4).padStart(3, "0")}` }]);
    }
    setModal(false);
  };

  const pending = Math.max(0, form.totalAmount - form.advancePaid);

  const totalRevenue = data.reduce((s, o) => s + o.totalAmount, 0);

  const columns: Column<GravureOrder>[] = [
    { key: "orderNo",      header: "Order No",   sortable: true },
    { key: "date",         header: "Date",        sortable: true },
    { key: "customerName", header: "Customer",    sortable: true },
    { key: "jobName",      header: "Job Name" },
    { key: "substrate",    header: "Substrate", render: r => <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full text-xs">{r.substrate}</span> },
    { key: "noOfColors",   header: "Colors",   render: r => <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold">{r.noOfColors}C</span> },
    { key: "quantity",     header: "Qty",      render: r => <span>{r.quantity.toLocaleString()} {r.unit}</span> },
    { key: "deliveryDate", header: "Delivery Date" },
    { key: "totalAmount",  header: "Amount (₹)", render: r => <span className="font-semibold">₹{r.totalAmount.toLocaleString()}</span> },
    { key: "status",       header: "Status", render: r => statusBadge(r.status), sortable: true },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <ShoppingCart size={18} className="text-purple-600" />
            <h2 className="text-lg font-semibold text-gray-800">Gravure Order Booking</h2>
          </div>
          <p className="text-sm text-gray-500">{data.length} orders · ₹{totalRevenue.toLocaleString()} total revenue</p>
        </div>
        <Button icon={<Plus size={16} />} onClick={openAdd}>New Order</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {(["Confirmed", "In Production", "Ready", "Dispatched"] as const).map(s => (
          <div key={s} className={`rounded-xl border p-4 ${statusColors[s]}`}>
            <p className="text-xs font-medium">{s}</p>
            <p className="text-2xl font-bold mt-1">{data.filter(o => o.status === s).length}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <DataTable
          data={data}
          columns={columns}
          searchKeys={["orderNo", "customerName", "jobName", "substrate"]}
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
      <Modal open={modalOpen} onClose={() => setModal(false)} title={editing ? "Edit Order" : "New Gravure Order"} size="xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Order Date" type="date" value={form.date} onChange={e => f("date", e.target.value)} />
          <Select
            label="From Enquiry"
            value={form.enquiryId}
            onChange={e => {
              const enq = gravureEnquiries.find(x => x.id === e.target.value);
              if (enq) {
                f("enquiryId", enq.id); f("customerId", enq.customerId);
                f("customerName", enq.customerName); f("jobName", enq.jobName);
                f("substrate", enq.substrate); f("width", enq.width);
                f("noOfColors", enq.noOfColors); f("quantity", enq.quantity); f("unit", enq.unit);
              }
            }}
            options={[{ value: "", label: "-- Direct Order --" }, ...gravureEnquiries.filter(e => e.status !== "Rejected").map(e => ({ value: e.id, label: `${e.enquiryNo} – ${e.customerName}` }))]}
          />
          <Select
            label="From Estimation"
            value={form.estimationId}
            onChange={e => {
              const est = gravureEstimations.find(x => x.id === e.target.value);
              if (est) {
                f("estimationId", est.id); f("customerId", est.customerId);
                f("customerName", est.customerName); f("jobName", est.jobName);
                f("substrate", est.substrateName); f("width", est.width);
                f("noOfColors", est.noOfColors); f("quantity", est.quantity); f("unit", est.unit);
                f("totalAmount", est.totalAmount);
              }
            }}
            options={[{ value: "", label: "-- No Estimation --" }, ...gravureEstimations.filter(e => e.status === "Approved" || e.status === "Accepted").map(e => ({ value: e.id, label: `${e.estimationNo} – ${e.customerName}` }))]}
          />
          <Select
            label="Customer *"
            value={form.customerId}
            onChange={e => { const c = customers.find(x => x.id === e.target.value); f("customerId", e.target.value); if (c) f("customerName", c.name); }}
            options={customers.filter(c => c.status === "Active").map(c => ({ value: c.id, label: c.name }))}
          />
          <Input label="Job Name *" value={form.jobName} onChange={e => f("jobName", e.target.value)} placeholder="e.g. Parle-G Biscuit 100g Wrap" />
          <Input label="Substrate" value={form.substrate} onChange={e => f("substrate", e.target.value)} placeholder="e.g. BOPP 20μ" />
          <Input label="Lamination Structure" value={form.structure} onChange={e => f("structure", e.target.value)} placeholder="e.g. BOPP 20μ + Dry Lam + CPP 30μ" />
          <Input label="Print Width (mm)" type="number" value={form.width} onChange={e => f("width", Number(e.target.value))} />
          <Input label="No. of Colors" type="number" value={form.noOfColors} onChange={e => f("noOfColors", Number(e.target.value))} />
          <Input label="Quantity" type="number" value={form.quantity} onChange={e => f("quantity", Number(e.target.value))} />
          <Select label="Unit" value={form.unit} onChange={e => f("unit", e.target.value)} options={[{ value: "Meter", label: "Meter" }, { value: "Kg", label: "Kg" }]} />
          <Input label="Delivery Date" type="date" value={form.deliveryDate} onChange={e => f("deliveryDate", e.target.value)} />
          <Input label="Cylinder Set" value={form.cylinderSet} onChange={e => f("cylinderSet", e.target.value)} placeholder="e.g. CYL-P001" />
          <Select label="Status" value={form.status} onChange={e => f("status", e.target.value)}
            options={[
              { value: "Confirmed",     label: "Confirmed" },
              { value: "In Production", label: "In Production" },
              { value: "Ready",         label: "Ready for Dispatch" },
              { value: "Dispatched",    label: "Dispatched" },
            ]} />
          <Input label="Total Amount (₹)" type="number" value={form.totalAmount} onChange={e => f("totalAmount", Number(e.target.value))} />
          <Input label="Advance Paid (₹)" type="number" value={form.advancePaid} onChange={e => f("advancePaid", Number(e.target.value))} />
        </div>

        {form.totalAmount > 0 && (
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="bg-gray-50 border rounded-xl p-3">
              <p className="text-xs text-gray-500">Total Amount</p>
              <p className="font-bold text-gray-800">₹{form.totalAmount.toLocaleString()}</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-xl p-3">
              <p className="text-xs text-gray-500">Advance Paid</p>
              <p className="font-bold text-green-700">₹{form.advancePaid.toLocaleString()}</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <p className="text-xs text-gray-500">Balance Pending</p>
              <p className="font-bold text-red-600">₹{pending.toLocaleString()}</p>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
          <Button onClick={save}>{editing ? "Update" : "Book Order"}</Button>
        </div>
      </Modal>

      {/* View Modal */}
      {viewRow && (
        <Modal open={!!viewRow} onClose={() => setViewRow(null)} title={`Order – ${viewRow.orderNo}`} size="lg">
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-4">
              {([
                ["Customer",      viewRow.customerName],
                ["Job Name",      viewRow.jobName],
                ["Substrate",     viewRow.substrate],
                ["Structure",     viewRow.structure || "—"],
                ["Width",         `${viewRow.width} mm`],
                ["No. of Colors", `${viewRow.noOfColors} Colors`],
                ["Quantity",      `${viewRow.quantity.toLocaleString()} ${viewRow.unit}`],
                ["Delivery Date", viewRow.deliveryDate || "—"],
                ["Cylinder Set",  viewRow.cylinderSet || "—"],
                ["Status",        viewRow.status],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k}><p className="text-xs text-gray-500">{k}</p><p className="font-medium text-gray-900">{v}</p></div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gray-50 border rounded-xl p-3">
                <p className="text-xs text-gray-500">Total Amount</p>
                <p className="font-bold">₹{viewRow.totalAmount.toLocaleString()}</p>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                <p className="text-xs text-gray-500">Advance Paid</p>
                <p className="font-bold text-green-700">₹{viewRow.advancePaid.toLocaleString()}</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                <p className="text-xs text-gray-500">Balance</p>
                <p className="font-bold text-red-600">₹{(viewRow.totalAmount - viewRow.advancePaid).toLocaleString()}</p>
              </div>
            </div>
          </div>
          <div className="flex justify-between mt-6">
            <Button variant="secondary" onClick={() => setViewRow(null)}>Close</Button>
            <Button icon={<ArrowRight size={14} />}>Create Work Order</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
