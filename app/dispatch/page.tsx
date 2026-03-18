"use client";
import { useState } from "react";
import { Plus, Eye, Pencil, Trash2, Truck } from "lucide-react";
import { dispatches as initData, orders, customers, Dispatch } from "@/data/dummyData";
import { DataTable, Column } from "@/components/tables/DataTable";
import { statusBadge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Input, Select } from "@/components/ui/Input";

const blank: Omit<Dispatch, "id" | "dispatchNo"> = {
  date: new Date().toISOString().slice(0, 10),
  orderId: "", orderNo: "", customerId: "", customerName: "",
  productName: "", quantity: 0, unit: "Kg",
  vehicleNo: "", driverName: "", status: "Pending",
};

export default function DispatchPage() {
  const [data, setData] = useState<Dispatch[]>(initData);
  const [modalOpen, setModalOpen] = useState(false);
  const [viewRow, setViewRow] = useState<Dispatch | null>(null);
  const [editing, setEditing] = useState<Dispatch | null>(null);
  const [form, setForm] = useState<Omit<Dispatch, "id" | "dispatchNo">>(blank);

  const f = (k: keyof typeof form, v: string | number) => setForm((p) => ({ ...p, [k]: v }));

  const openAdd = () => { setEditing(null); setForm(blank); setModalOpen(true); };
  const openEdit = (row: Dispatch) => { setEditing(row); setForm({ ...row }); setModalOpen(true); };

  const save = () => {
    if (!form.orderId) return;
    if (editing) {
      setData((d) => d.map((r) => r.id === editing.id ? { ...form, id: editing.id, dispatchNo: editing.dispatchNo } : r));
    } else {
      const n = data.length + 1;
      setData((d) => [...d, { ...form, id: `DSP${String(n).padStart(3, "0")}`, dispatchNo: `DSP-2024-${String(n).padStart(3, "0")}` }]);
    }
    setModalOpen(false);
  };

  const totalDispatched = data.reduce((s, d) => s + d.quantity, 0);
  const delivered = data.filter(d => d.status === "Delivered").length;

  const columns: Column<Dispatch>[] = [
    { key: "dispatchNo", header: "Dispatch No", sortable: true },
    { key: "date", header: "Date", sortable: true },
    { key: "orderNo", header: "Order No" },
    { key: "customerName", header: "Customer", sortable: true },
    { key: "productName", header: "Product" },
    { key: "quantity", header: "Qty", render: (r) => <span>{r.quantity.toLocaleString()} {r.unit}</span> },
    { key: "vehicleNo", header: "Vehicle No" },
    { key: "driverName", header: "Driver" },
    { key: "status", header: "Status", render: (r) => statusBadge(r.status), sortable: true },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Dispatch Management</h2>
          <p className="text-sm text-gray-500">{data.length} dispatches · {totalDispatched.toLocaleString()} Kg total</p>
        </div>
        <Button icon={<Plus size={16} />} onClick={openAdd}>New Dispatch</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Dispatches", val: data.length, cls: "bg-blue-50 text-blue-700 border-blue-200" },
          { label: "In Transit", val: data.filter(d => d.status === "In Transit").length, cls: "bg-yellow-50 text-yellow-700 border-yellow-200" },
          { label: "Delivered", val: delivered, cls: "bg-green-50 text-green-700 border-green-200" },
          { label: "Total Qty (Kg)", val: totalDispatched.toLocaleString(), cls: "bg-purple-50 text-purple-700 border-purple-200" },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl border p-4 ${s.cls}`}>
            <p className="text-xs font-medium">{s.label}</p>
            <p className="text-2xl font-bold mt-1">{s.val}</p>
          </div>
        ))}
      </div>

      {/* Customer-wise dispatch history */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Customer Dispatch Summary</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                {["Customer", "Total Dispatches", "Total Qty", "Last Dispatch"].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {Array.from(new Set(data.map(d => d.customerName))).map((customer) => {
                const customerDispatches = data.filter(d => d.customerName === customer);
                const totalQty = customerDispatches.reduce((s, d) => s + d.quantity, 0);
                const lastDate = customerDispatches.sort((a, b) => b.date.localeCompare(a.date))[0]?.date;
                return (
                  <tr key={customer} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{customer}</td>
                    <td className="px-4 py-3 text-gray-800">{customerDispatches.length}</td>
                    <td className="px-4 py-3 text-gray-800">{totalQty.toLocaleString()} Kg</td>
                    <td className="px-4 py-3 text-gray-800">{lastDate}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">All Dispatch Records</h3>
        <DataTable
          data={data}
          columns={columns}
          searchKeys={["dispatchNo", "customerName", "orderNo", "vehicleNo"]}
          actions={(row) => (
            <div className="flex items-center gap-1.5 justify-end">
              <Button variant="ghost" size="sm" icon={<Eye size={13} />} onClick={() => setViewRow(row)}>View</Button>
              <Button variant="ghost" size="sm" icon={<Pencil size={13} />} onClick={() => openEdit(row)}>Edit</Button>
              <Button variant="danger" size="sm" icon={<Trash2 size={13} />}
                onClick={() => setData((d) => d.filter(r => r.id !== row.id))}>Delete</Button>
            </div>
          )}
        />
      </div>

      {/* Form Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Dispatch" : "New Dispatch"} size="xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Date" type="date" value={form.date} onChange={(e) => f("date", e.target.value)} />
          <Select
            label="Order *"
            value={form.orderId}
            onChange={(e) => {
              const o = orders.find(x => x.id === e.target.value);
              if (o) { f("orderId", o.id); f("orderNo", o.orderNo); f("customerId", o.customerId); f("customerName", o.customerName); f("productName", o.productName); }
            }}
            options={orders.filter(o => o.status !== "Dispatched").map(o => ({ value: o.id, label: `${o.orderNo} – ${o.customerName}` }))}
          />
          <Input label="Customer" value={form.customerName} readOnly className="bg-gray-50" />
          <Input label="Product" value={form.productName} readOnly className="bg-gray-50" />
          <Input label="Quantity" type="number" value={form.quantity} onChange={(e) => f("quantity", Number(e.target.value))} />
          <Select label="Unit" value={form.unit} onChange={(e) => f("unit", e.target.value)}
            options={[{ value: "Kg", label: "Kg" }, { value: "Meter", label: "Meter" }, { value: "Roll", label: "Roll" }]} />
          <Input label="Vehicle No" value={form.vehicleNo} onChange={(e) => f("vehicleNo", e.target.value)} placeholder="e.g. MH-01-AB-1234" />
          <Input label="Driver Name" value={form.driverName} onChange={(e) => f("driverName", e.target.value)} />
          <Select label="Status" value={form.status} onChange={(e) => f("status", e.target.value)}
            options={[
              { value: "Pending", label: "Pending" },
              { value: "In Transit", label: "In Transit" },
              { value: "Delivered", label: "Delivered" },
            ]} />
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
          <Button icon={<Truck size={14} />} onClick={save}>{editing ? "Update" : "Dispatch"}</Button>
        </div>
      </Modal>

      {/* View Modal */}
      {viewRow && (
        <Modal open={!!viewRow} onClose={() => setViewRow(null)} title={`Dispatch – ${viewRow.dispatchNo}`} size="lg">
          <div className="grid grid-cols-2 gap-4 text-sm">
            {[
              ["Date", viewRow.date],
              ["Order No", viewRow.orderNo],
              ["Customer", viewRow.customerName],
              ["Product", viewRow.productName],
              ["Quantity", `${viewRow.quantity.toLocaleString()} ${viewRow.unit}`],
              ["Vehicle No", viewRow.vehicleNo],
              ["Driver", viewRow.driverName],
              ["Status", viewRow.status],
            ].map(([k, v]) => (
              <div key={k}>
                <p className="text-xs text-gray-500">{k}</p>
                <p className="font-medium text-gray-900">{v}</p>
              </div>
            ))}
          </div>
          <div className="flex justify-end mt-6">
            <Button variant="secondary" onClick={() => setViewRow(null)}>Close</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
