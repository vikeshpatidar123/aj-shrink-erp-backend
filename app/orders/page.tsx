"use client";
import { useState } from "react";
import { Plus, Eye, Pencil, ArrowRight, Trash2 } from "lucide-react";
import { orders as initData, enquiries, customers, recipes, rollMasters, Order } from "@/data/dummyData";
import { DataTable, Column } from "@/components/tables/DataTable";
import { statusBadge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Input, Select } from "@/components/ui/Input";

const blank: Omit<Order, "id" | "orderNo"> = {
  date: new Date().toISOString().slice(0, 10),
  enquiryId: "", estimationId: "", customerId: "", customerName: "",
  jobName: "", productName: "",
  recipeId: "", recipeName: "", rollMasterId: "", rollName: "",
  quantity: 0, unit: "Kg",
  deliveryDate: "", totalAmount: 0, advancePaid: 0, status: "Confirmed",
};

export default function OrdersPage() {
  const [data, setData] = useState<Order[]>(initData);
  const [modalOpen, setModalOpen] = useState(false);
  const [viewRow, setViewRow] = useState<Order | null>(null);
  const [editing, setEditing] = useState<Order | null>(null);
  const [form, setForm] = useState<Omit<Order, "id" | "orderNo">>(blank);

  const f = (k: keyof typeof form, v: string | number) => setForm(p => ({ ...p, [k]: v }));

  const openAdd = () => { setEditing(null); setForm(blank); setModalOpen(true); };
  const openEdit = (row: Order) => { setEditing(row); setForm({ ...row }); setModalOpen(true); };

  const save = () => {
    if (!form.customerName) return;
    if (editing) {
      setData(d => d.map(r => r.id === editing.id ? { ...form, id: editing.id, orderNo: editing.orderNo } : r));
    } else {
      const n = data.length + 1;
      setData(d => [...d, { ...form, id: `ORD${String(n).padStart(3, "0")}`, orderNo: `ORD-2024-${String(n).padStart(3, "0")}` }]);
    }
    setModalOpen(false);
  };

  const pending = form.totalAmount - form.advancePaid;

  const columns: Column<Order>[] = [
    { key: "orderNo", header: "Order No", sortable: true },
    { key: "date", header: "Date", sortable: true },
    { key: "customerName", header: "Customer", sortable: true },
    { key: "jobName", header: "Job Name" },
    { key: "recipeName", header: "Recipe" },
    { key: "rollName", header: "Roll" },
    { key: "quantity", header: "Qty", render: r => <span>{r.quantity.toLocaleString()} {r.unit}</span> },
    { key: "deliveryDate", header: "Delivery Date" },
    { key: "totalAmount", header: "Amount (₹)", render: r => <span className="font-semibold">₹{r.totalAmount.toLocaleString()}</span> },
    { key: "status", header: "Status", render: r => statusBadge(r.status), sortable: true },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Order Booking</h2>
          <p className="text-sm text-gray-500">{data.length} orders · ₹{data.reduce((s, o) => s + o.totalAmount, 0).toLocaleString()} total</p>
        </div>
        <Button icon={<Plus size={16} />} onClick={openAdd}>New Order</Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {["Confirmed", "In Production", "Ready", "Dispatched"].map((s) => {
          const colors: Record<string, string> = {
            Confirmed: "bg-blue-50 text-blue-700 border-blue-200",
            "In Production": "bg-yellow-50 text-yellow-700 border-yellow-200",
            Ready: "bg-purple-50 text-purple-700 border-purple-200",
            Dispatched: "bg-green-50 text-green-700 border-green-200",
          };
          return (
            <div key={s} className={`rounded-xl border p-4 ${colors[s]}`}>
              <p className="text-xs font-medium">{s}</p>
              <p className="text-2xl font-bold mt-1">{data.filter(o => o.status === s).length}</p>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <DataTable
          data={data}
          columns={columns}
          searchKeys={["orderNo", "customerName", "jobName", "recipeName"]}
          actions={(row) => (
            <div className="flex items-center gap-1.5 justify-end">
              <Button variant="ghost" size="sm" icon={<Eye size={13} />} onClick={() => setViewRow(row)}>View</Button>
              <Button variant="ghost" size="sm" icon={<Pencil size={13} />} onClick={() => openEdit(row)}>Edit</Button>
              <Button variant="danger" size="sm" icon={<Trash2 size={13} />} onClick={() => setData(d => d.filter(r => r.id !== row.id))}>Delete</Button>
            </div>
          )}
        />
      </div>

      {/* Form Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Order" : "New Order"} size="xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Order Date" type="date" value={form.date} onChange={(e) => f("date", e.target.value)} />
          <Select
            label="From Enquiry"
            value={form.enquiryId}
            onChange={(e) => {
              const enq = enquiries.find(x => x.id === e.target.value);
              if (enq) { f("enquiryId", enq.id); f("customerId", enq.customerId); f("customerName", enq.customerName); f("productName", enq.productName); f("quantity", enq.quantity); f("unit", enq.unit); }
            }}
            options={[{ value: "", label: "-- Direct Order --" }, ...enquiries.filter(e => e.status !== "Rejected").map(e => ({ value: e.id, label: `${e.enquiryNo} – ${e.customerName}` }))]}
          />
          <Select
            label="Customer *"
            value={form.customerId}
            onChange={(e) => { const c = customers.find(x => x.id === e.target.value); f("customerId", e.target.value); if (c) f("customerName", c.name); }}
            options={customers.filter(c => c.status === "Active").map(c => ({ value: c.id, label: c.name }))}
          />
          <Input label="Job Name *" value={form.jobName} onChange={(e) => f("jobName", e.target.value)} placeholder="e.g. Parle Shrink Wrap Batch-1" />
          <Select
            label="Recipe"
            value={form.recipeId}
            onChange={(e) => { const r = recipes.find(x => x.id === e.target.value); f("recipeId", e.target.value); if (r) f("recipeName", r.name); }}
            options={recipes.filter(r => r.status === "Active").map(r => ({ value: r.id, label: r.name }))}
          />
          <Select
            label="Roll Master"
            value={form.rollMasterId}
            onChange={(e) => { const r = rollMasters.find(x => x.id === e.target.value); f("rollMasterId", e.target.value); if (r) f("rollName", r.name); }}
            options={rollMasters.filter(r => r.status === "Active").map(r => ({ value: r.id, label: `${r.name} – ${r.width}mm/${r.micron}μ` }))}
          />
          <Input label="Quantity" type="number" value={form.quantity} onChange={(e) => f("quantity", Number(e.target.value))} />
          <Select label="Unit" value={form.unit} onChange={(e) => f("unit", e.target.value)}
            options={[{ value: "Kg", label: "Kg" }, { value: "Meter", label: "Meter" }, { value: "Roll", label: "Roll" }]} />
          <Input label="Delivery Date" type="date" value={form.deliveryDate} onChange={(e) => f("deliveryDate", e.target.value)} />
          <Select label="Status" value={form.status} onChange={(e) => f("status", e.target.value)}
            options={[{ value: "Confirmed", label: "Confirmed" }, { value: "In Production", label: "In Production" }, { value: "Ready", label: "Ready" }, { value: "Dispatched", label: "Dispatched" }]} />
          <Input label="Total Amount (₹)" type="number" value={form.totalAmount} onChange={(e) => f("totalAmount", Number(e.target.value))} />
          <Input label="Advance Paid (₹)" type="number" value={form.advancePaid} onChange={(e) => f("advancePaid", Number(e.target.value))} />
        </div>

        {form.totalAmount > 0 && (
          <div className="mt-4 flex gap-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex-1">
              <p className="text-xs text-gray-500">Advance Paid</p>
              <p className="font-bold text-green-700">₹{form.advancePaid.toLocaleString()}</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex-1">
              <p className="text-xs text-gray-500">Balance Pending</p>
              <p className="font-bold text-red-600">₹{Math.max(0, pending).toLocaleString()}</p>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
          <Button onClick={save}>{editing ? "Update" : "Save"}</Button>
        </div>
      </Modal>

      {/* View Modal */}
      {viewRow && (
        <Modal open={!!viewRow} onClose={() => setViewRow(null)} title={`Order – ${viewRow.orderNo}`} size="lg">
          <div className="grid grid-cols-2 gap-4 text-sm">
            {[
              ["Customer", viewRow.customerName],
              ["Job Name", viewRow.jobName],
              ["Recipe", viewRow.recipeName],
              ["Roll", viewRow.rollName],
              ["Quantity", `${viewRow.quantity.toLocaleString()} ${viewRow.unit}`],
              ["Delivery Date", viewRow.deliveryDate],
              ["Status", viewRow.status],
            ].map(([k, v]) => (
              <div key={k}><p className="text-xs text-gray-500">{k}</p><p className="font-medium text-gray-900">{v}</p></div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="bg-gray-50 rounded-lg p-3 border"><p className="text-xs text-gray-500">Total Amount</p><p className="font-bold">₹{viewRow.totalAmount.toLocaleString()}</p></div>
            <div className="bg-green-50 rounded-lg p-3 border border-green-200"><p className="text-xs text-gray-500">Advance Paid</p><p className="font-bold text-green-700">₹{viewRow.advancePaid.toLocaleString()}</p></div>
            <div className="bg-red-50 rounded-lg p-3 border border-red-200"><p className="text-xs text-gray-500">Balance</p><p className="font-bold text-red-600">₹{(viewRow.totalAmount - viewRow.advancePaid).toLocaleString()}</p></div>
          </div>
          <div className="flex justify-between mt-6">
            <Button variant="secondary" onClick={() => setViewRow(null)}>Close</Button>
            <Button icon={<ArrowRight size={14} />}>Generate Job Card</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
