"use client";
import { useState } from "react";
import { Plus, Pencil, Trash2, Save, Check } from "lucide-react";
import { subGroups as initData, SubGroup, CATEGORY_GROUP_SUBGROUP } from "@/data/dummyData";
import { DataTable, Column } from "@/components/tables/DataTable";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";

const blank: Omit<SubGroup, "id"> = {
  name: "",
  category: "Raw Material (RM)",
  group: "Film",
  description: "",
};

export default function SubGroupPage() {
  const [data, setData] = useState<SubGroup[]>(initData);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SubGroup | null>(null);
  const [form, setForm] = useState<Omit<SubGroup, "id">>(blank);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("All");
  const [filterGroup, setFilterGroup] = useState<string>("All");

  const openAdd = () => {
    setEditing(null);
    setForm(blank);
    setModalOpen(true);
  };

  const openEdit = (row: SubGroup) => {
    setEditing(row);
    setForm({ name: row.name, category: row.category, group: row.group, description: row.description });
    setModalOpen(true);
  };

  const save = () => {
    if (!form.name || !form.category || !form.group) return;
    if (editing) {
      setData((d) => d.map((r) => r.id === editing.id ? { ...form, id: editing.id } : r));
    } else {
      const id = `SG${String(data.length + 1).padStart(3, "0")}`;
      setData((d) => [...d, { ...form, id }]);
    }
    setModalOpen(false);
  };

  const confirmDelete = () => {
    if (deleteId) setData((d) => d.filter((r) => r.id !== deleteId));
    setDeleteId(null);
  };

  const f = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const onCategoryChange = (cat: string) => {
    const firstGroup = Object.keys(CATEGORY_GROUP_SUBGROUP[cat] ?? {})[0] ?? "";
    setForm((p) => ({ ...p, category: cat, group: firstGroup }));
  };

  const groupOptions = Object.keys(CATEGORY_GROUP_SUBGROUP[form.category] ?? {});

  // Filter logic
  const filterCategories = ["All", "Raw Material (RM)", "Consumables", "Finished Goods (FG)"];
  const filterGroupOptions = filterCategory === "All"
    ? ["All"]
    : ["All", ...Object.keys(CATEGORY_GROUP_SUBGROUP[filterCategory] ?? {})];

  const filteredData = data.filter(r => {
    if (filterCategory !== "All" && r.category !== filterCategory) return false;
    if (filterGroup !== "All" && r.group !== filterGroup) return false;
    return true;
  });

  const onFilterCategoryChange = (cat: string) => {
    setFilterCategory(cat);
    setFilterGroup("All");
  };

  const columns: Column<SubGroup>[] = [
    { key: "id", header: "Code", sortable: true },
    { key: "name", header: "Sub Group Name", sortable: true },
    { key: "category", header: "Category", sortable: true },
    { key: "group", header: "Group", sortable: true },
    { key: "description", header: "Description" },
  ];

  const inputCls = "w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white";
  const labelCls = "text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Sub Group Master</h2>
          <p className="text-sm text-gray-500">{filteredData.length} of {data.length} sub groups</p>
        </div>
        <Button icon={<Plus size={16} />} onClick={openAdd}>Add Sub Group</Button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mr-1">Category</span>
          {filterCategories.map(cat => (
            <button
              key={cat}
              onClick={() => onFilterCategoryChange(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filterCategory === cat
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {cat === "All" ? "All Categories" : cat}
            </button>
          ))}
        </div>
        {filterCategory !== "All" && (
          <div className="flex items-center gap-2 flex-wrap border-t border-gray-100 pt-3">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mr-1">Group</span>
            {filterGroupOptions.map(grp => (
              <button
                key={grp}
                onClick={() => setFilterGroup(grp)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  filterGroup === grp
                    ? "bg-blue-50 text-blue-700 border-blue-300"
                    : "bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700"
                }`}
              >
                {grp === "All" ? "All Groups" : grp}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <DataTable
          data={filteredData} columns={columns}
          searchKeys={["name", "category", "group"]}
          actions={(row) => (
            <div className="flex items-center gap-2 justify-end">
              <Button variant="ghost" size="sm" icon={<Pencil size={13} />} onClick={() => openEdit(row)}>Edit</Button>
              <Button variant="danger" size="sm" icon={<Trash2 size={13} />} onClick={() => setDeleteId(row.id)}>Delete</Button>
            </div>
          )}
        />
      </div>

      {/* Add / Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Sub Group" : "Add Sub Group"} size="md">
        <div className="space-y-4">
          {/* Sub Group Name */}
          <div>
            <label className={labelCls}>Sub Group Name <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => f("name", e.target.value)}
              placeholder="e.g. PET Film (Plain / Treated)"
              className={inputCls}
            />
          </div>

          {/* Category + Group side by side */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Category <span className="text-red-500">*</span></label>
              <select value={form.category} onChange={(e) => onCategoryChange(e.target.value)} className={inputCls}>
                <option value="">Select Category...</option>
                <option value="Raw Material (RM)">Raw Material (RM)</option>
                <option value="Consumables">Consumables</option>
                <option value="Finished Goods (FG)">Finished Goods (FG)</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Group <span className="text-red-500">*</span></label>
              <select value={form.group} onChange={(e) => f("group", e.target.value)} className={inputCls}>
                <option value="">Select Group...</option>
                {groupOptions.map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className={labelCls}>Description</label>
            <textarea
              value={form.description}
              onChange={(e) => f("description", e.target.value)}
              placeholder="Optional description..."
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
          <Button icon={<Check size={15} />} onClick={save}>{editing ? "Update" : "Save"}</Button>
        </div>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Confirm Delete" size="sm">
        <p className="text-sm text-gray-600">Are you sure you want to delete this sub group?</p>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setDeleteId(null)}>Cancel</Button>
          <Button variant="danger" onClick={confirmDelete}>Delete</Button>
        </div>
      </Modal>
    </div>
  );
}
