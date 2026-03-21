"use client";
import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { hsnMasters as initData, HSNMaster } from "@/data/dummyData";
import { DataTable, Column } from "@/components/tables/DataTable";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Input, Select } from "@/components/ui/Input";

const blank: Omit<HSNMaster, "id"> = {
  hsnCode: "", description: "", gstRate: 18, category: "Plastic Film",
};

export default function HSNPage() {
  const [data, setData] = useState<HSNMaster[]>(initData);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<HSNMaster | null>(null);
  const [form, setForm] = useState<Omit<HSNMaster, "id">>(blank);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const openAdd = () => { setEditing(null); setForm(blank); setModalOpen(true); };
  const openEdit = (row: HSNMaster) => { setEditing(row); setForm({ ...row }); setModalOpen(true); };

  const save = () => {
    if (!form.hsnCode) return;
    if (editing) {
      setData((d) => d.map((r) => r.id === editing.id ? { ...form, id: editing.id } : r));
    } else {
      const id = `HSN${String(data.length + 1).padStart(3, "0")}`;
      setData((d) => [...d, { ...form, id }]);
    }
    setModalOpen(false);
  };

  const confirmDelete = () => {
    if (deleteId) setData((d) => d.filter((r) => r.id !== deleteId));
    setDeleteId(null);
  };

  const f = (k: keyof typeof form, v: string | number) => setForm((p) => ({ ...p, [k]: v }));

  const columns: Column<HSNMaster>[] = [
    { key: "hsnCode", header: "HSN Code", sortable: true },
    { key: "description", header: "Description" },
    { key: "gstRate", header: "GST Rate (%)", sortable: true },
    { key: "category", header: "Category", sortable: true },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">HSN Master</h2>
          <p className="text-sm text-gray-500">{data.length} HSN codes registered</p>
        </div>
        <Button icon={<Plus size={16} />} onClick={openAdd}>Add HSN</Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <DataTable
          data={data} columns={columns}
          searchKeys={["hsnCode", "description", "category"]}
          actions={(row) => (
            <div className="flex items-center gap-2 justify-end">
              <Button variant="ghost" size="sm" icon={<Pencil size={13} />} onClick={() => openEdit(row)}>Edit</Button>
              <Button variant="danger" size="sm" icon={<Trash2 size={13} />} onClick={() => setDeleteId(row.id)}>Delete</Button>
            </div>
          )}
        />
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit HSN" : "Add HSN"} size="md">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Input label="HSN Code *" value={form.hsnCode} onChange={(e) => f("hsnCode", e.target.value)} placeholder="e.g. 3920" />
          <Input label="GST Rate (%)" type="number" value={String(form.gstRate)} onChange={(e) => f("gstRate", Number(e.target.value))} placeholder="e.g. 18" />
          <Select label="Category" value={form.category} onChange={(e) => f("category", e.target.value)}
            options={[
              { value: "Plastic Film", label: "Plastic Film" },
              { value: "Packaging", label: "Packaging" },
              { value: "Plastic Articles", label: "Plastic Articles" },
              { value: "Paper Products", label: "Paper Products" },
              { value: "Adhesive Films", label: "Adhesive Films" },
            ]} />
          <div className="sm:col-span-2">
            <Input label="Description" value={form.description} onChange={(e) => f("description", e.target.value)} placeholder="HSN description" />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
          <Button onClick={save}>{editing ? "Update" : "Save"}</Button>
        </div>
      </Modal>

      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Confirm Delete" size="sm">
        <p className="text-sm text-gray-600">Are you sure you want to delete this HSN code?</p>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setDeleteId(null)}>Cancel</Button>
          <Button variant="danger" onClick={confirmDelete}>Delete</Button>
        </div>
      </Modal>
    </div>
  );
}