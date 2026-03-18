"use client";
import { useState } from "react";
import { Plus, Pencil, Trash2, ArrowRight, Eye } from "lucide-react";
import { enquiries as initData, customers, products, Enquiry } from "@/data/dummyData";
import { DataTable, Column } from "@/components/tables/DataTable";
import { statusBadge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Input, Select, Textarea } from "@/components/ui/Input";

const blank: Omit<Enquiry, "id" | "enquiryNo"> = {
  date: new Date().toISOString().slice(0, 10),
  customerId: "", customerName: "",
  productId: "", productName: "",
  quantity: 0, unit: "Kg",
  width: 0, thickness: 0,
  printingRequired: false, printingColors: 0,
  remarks: "", status: "Pending",
};

export default function EnquiryPage() {
  const [data, setData] = useState<Enquiry[]>(initData);
  const [modalOpen, setModalOpen] = useState(false);
  const [viewRow, setViewRow] = useState<Enquiry | null>(null);
  const [editing, setEditing] = useState<Enquiry | null>(null);
  const [form, setForm] = useState<Omit<Enquiry, "id" | "enquiryNo">>(blank);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const f = (k: keyof typeof form, v: string | number | boolean) =>
    setForm((p) => ({ ...p, [k]: v }));

  const openAdd = () => { setEditing(null); setForm(blank); setModalOpen(true); };
  const openEdit = (row: Enquiry) => { setEditing(row); setForm({ ...row }); setModalOpen(true); };

  const save = () => {
    if (!form.customerId || !form.productId || !form.quantity) return;
    if (editing) {
      setData((d) => d.map((r) => r.id === editing.id ? { ...form, id: editing.id, enquiryNo: editing.enquiryNo } : r));
    } else {
      const n = data.length + 1;
      const id = `ENQ${String(n).padStart(3, "0")}`;
      const enquiryNo = `ENQ-2024-${String(n).padStart(3, "0")}`;
      setData((d) => [...d, { ...form, id, enquiryNo }]);
    }
    setModalOpen(false);
  };

  const columns: Column<Enquiry>[] = [
    { key: "enquiryNo", header: "Enquiry No", sortable: true },
    { key: "date", header: "Date", sortable: true },
    { key: "customerName", header: "Customer", sortable: true },
    { key: "productName", header: "Product" },
    { key: "quantity", header: "Qty", render: (r) => <span>{r.quantity} {r.unit}</span> },
    { key: "printingRequired", header: "Printing", render: (r) => r.printingRequired ? <span className="text-green-600 font-medium">{r.printingColors} Colors</span> : <span className="text-gray-500">No</span>},
    { key: "status", header: "Status", render: (r) => statusBadge(r.status), sortable: true },
  ];

  const stats = {
    total: data.length,
    pending: data.filter(e => e.status === "Pending").length,
    estimated: data.filter(e => e.status === "Estimated").length,
    converted: data.filter(e => e.status === "Converted").length,
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Enquiry Management</h2>
          <p className="text-sm text-gray-500">{stats.total} total · {stats.pending} pending</p>
        </div>
        <Button icon={<Plus size={16} />} onClick={openAdd}>New Enquiry</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total", val: stats.total, cls: "bg-blue-50 text-blue-700 border-blue-200" },
          { label: "Pending", val: stats.pending, cls: "bg-yellow-50 text-yellow-700 border-yellow-200" },
          { label: "Estimated", val: stats.estimated, cls: "bg-purple-50 text-purple-700 border-purple-200" },
          { label: "Converted", val: stats.converted, cls: "bg-green-50 text-green-700 border-green-200" },
        ].map((s) => (
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
          searchKeys={["enquiryNo", "customerName", "productName"]}
          actions={(row) => (
            <div className="flex items-center gap-1.5 justify-end">
              <Button variant="ghost" size="sm" icon={<Eye size={13} />} onClick={() => setViewRow(row)}>View</Button>
              <Button variant="ghost" size="sm" icon={<Pencil size={13} />} onClick={() => openEdit(row)}>Edit</Button>
              <Button variant="danger" size="sm" icon={<Trash2 size={13} />} onClick={() => setDeleteId(row.id)}>Delete</Button>
            </div>
          )}
        />
      </div>

      {/* Add/Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Enquiry" : "New Enquiry"} size="xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Date" type="date" value={form.date} onChange={(e) => f("date", e.target.value)} />
          <Select
            label="Customer *"
            value={form.customerId}
            onChange={(e) => {
              const c = customers.find(x => x.id === e.target.value);
              f("customerId", e.target.value);
              if (c) f("customerName", c.name);
            }}
            options={customers.filter(c => c.status === "Active").map(c => ({ value: c.id, label: c.name }))}
          />
          <Select
            label="Product *"
            value={form.productId}
            onChange={(e) => {
              const p = products.find(x => x.id === e.target.value);
              f("productId", e.target.value);
              if (p) { f("productName", p.name); f("width", p.width); f("thickness", p.thickness); }
            }}
            options={products.filter(p => p.status === "Active").map(p => ({ value: p.id, label: p.name }))}
          />
          <Input label="Quantity *" type="number" value={form.quantity} onChange={(e) => f("quantity", Number(e.target.value))} />
          <Select
            label="Unit"
            value={form.unit}
            onChange={(e) => f("unit", e.target.value)}
            options={[{ value: "Kg", label: "Kg" }, { value: "Meter", label: "Meter" }, { value: "Roll", label: "Roll" }]}
          />
          <Input label="Width (mm)" type="number" value={form.width} onChange={(e) => f("width", Number(e.target.value))} />
          <Input label="Thickness (μ)" type="number" value={form.thickness} onChange={(e) => f("thickness", Number(e.target.value))} />

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Printing Required</label>
            <div className="flex items-center gap-4 mt-2">
              {[true, false].map((v) => (
                <label key={String(v)} className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="radio"
                    name="printing"
                    checked={form.printingRequired === v}
                    onChange={() => f("printingRequired", v)}
                    className="accent-blue-600"
                  />
                  {v ? "Yes" : "No"}
                </label>
              ))}
            </div>
          </div>

          {form.printingRequired && (
            <Input
              label="Number of Colors"
              type="number"
              value={form.printingColors}
              onChange={(e) => f("printingColors", Number(e.target.value))}
              min={1} max={12}
            />
          )}

          <Select
            label="Status"
            value={form.status}
            onChange={(e) => f("status", e.target.value)}
            options={[
              { value: "Pending", label: "Pending" },
              { value: "Estimated", label: "Estimated" },
              { value: "Converted", label: "Converted" },
              { value: "Rejected", label: "Rejected" },
            ]}
          />
        </div>
        <div className="mt-4">
          <Textarea label="Remarks" value={form.remarks} onChange={(e) => f("remarks", e.target.value)} placeholder="Additional notes..." />
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
          <Button onClick={save}>{editing ? "Update" : "Save"}</Button>
        </div>
      </Modal>

      {/* View Modal */}
      {viewRow && (
        <Modal open={!!viewRow} onClose={() => setViewRow(null)} title={`Enquiry – ${viewRow.enquiryNo}`} size="lg">
          <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
            {[
              ["Date", viewRow.date],
              ["Customer", viewRow.customerName],
              ["Product", viewRow.productName],
              ["Quantity", `${viewRow.quantity} ${viewRow.unit}`],
              ["Width", `${viewRow.width} mm`],
              ["Thickness", `${viewRow.thickness} μ`],
              ["Printing Required", viewRow.printingRequired ? `Yes – ${viewRow.printingColors} colors` : "No"],
              ["Status", viewRow.status],
            ].map(([k, v]) => (
              <div key={k}>
                <p className="text-xs text-gray-500 font-medium">{k}</p>
                <p className="text-gray-800 font-medium">{v}</p>
              </div>
            ))}
          </div>
          {viewRow.remarks && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
              <p className="text-xs font-medium text-gray-500 mb-1">Remarks</p>
              {viewRow.remarks}
            </div>
          )}
          <div className="flex justify-between mt-6">
            <Button variant="secondary" onClick={() => setViewRow(null)}>Close</Button>
            {viewRow.status === "Estimated" && (
              <Button icon={<ArrowRight size={14} />}>Convert to Order</Button>
            )}
          </div>
        </Modal>
      )}

      {/* Delete Modal */}
      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Confirm Delete" size="sm">
        <p className="text-sm text-gray-600">Delete this enquiry?</p>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setDeleteId(null)}>Cancel</Button>
          <Button variant="danger" onClick={() => { setData((d) => d.filter((r) => r.id !== deleteId)); setDeleteId(null); }}>Delete</Button>
        </div>
      </Modal>
    </div>
  );
}
