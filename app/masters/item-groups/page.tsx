"use client";
import { useState } from "react";
import { Plus, Pencil, Trash2, Save, List, Check } from "lucide-react";
import { itemGroups as initData, ItemGroup } from "@/data/dummyData";
import { DataTable, Column } from "@/components/tables/DataTable";
import Button from "@/components/ui/Button";

const CATEGORIES = ["Raw Material (RM)", "Consumables", "Finished Goods (FG)"];

// ── Shared UI components (must be outside main component to avoid focus loss) ──
const SectionTitle = ({ title }: { title: string }) => (
  <h3 className="text-xs font-bold text-blue-700 uppercase tracking-widest mb-4 border-b border-gray-100 pb-2">
    {title}
  </h3>
);

const Field = ({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {children}
  </div>
);

const blank: Omit<ItemGroup, "id"> = {
  category: "Raw Material (RM)",
  name: "",
  description: "",
  status: "Active",
};

export default function ItemGroupPage() {
  const [view, setView] = useState<"list" | "form">("list");
  const [data, setData] = useState<ItemGroup[]>(initData);
  const [editing, setEditing] = useState<ItemGroup | null>(null);
  const [form, setForm] = useState<Omit<ItemGroup, "id">>(blank);
  const [filterCategory, setFilterCategory] = useState<string>("All");

  const openAdd = () => {
    setEditing(null);
    setForm(blank);
    setView("form");
  };

  const openEdit = (row: ItemGroup) => {
    setEditing(row);
    setForm({ category: row.category, name: row.name, description: row.description, status: row.status });
    setView("form");
  };

  const save = () => {
    if (!form.name || !form.category) return;
    if (editing) {
      setData((d) => d.map((r) => r.id === editing.id ? { ...form, id: editing.id } : r));
    } else {
      const id = `IG${String(data.length + 1).padStart(3, "0")}`;
      setData((d) => [...d, { ...form, id }]);
    }
    setView("list");
  };

  const deleteRow = (id: string) => {
    if (confirm("Delete this item group?")) setData((d) => d.filter((r) => r.id !== id));
  };

  const f = (k: keyof typeof form, v: any) => setForm((p) => ({ ...p, [k]: v }));

  const columns: Column<ItemGroup>[] = [
    { key: "name", header: "Group Name", sortable: true },
    { key: "category", header: "Category", sortable: true, render: (r) => (
      <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
        r.category === "Raw Material (RM)" ? "bg-blue-50 text-blue-700" :
        r.category === "Consumables" ? "bg-amber-50 text-amber-700" :
        "bg-emerald-50 text-emerald-700"
      }`}>{r.category}</span>
    )},
    { key: "description", header: "Description", render: (r) => (
      <span className="text-gray-500 text-xs">{r.description || "—"}</span>
    )},
    { key: "status", header: "Status", render: (r) => (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${r.status === "Active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
        {r.status}
      </span>
    )},
  ];

  // ── FORM VIEW ─────────────────────────────────────────────
  if (view === "form") {
    return (
      <div className="max-w-3xl mx-auto pb-10">
        {/* Header Ribbon */}
        <div className="flex items-center justify-between mb-6 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div>
            <p className="text-xs text-gray-400 font-medium tracking-wide uppercase">AJ Shrink Wrap Pvt Ltd</p>
            <h2 className="text-xl font-bold text-gray-800">Item Group Master</h2>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setView("list")} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              <List size={16} /> List ({data.length})
            </button>
            <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors">
              <Plus size={16} /> New
            </button>
            <button onClick={save} className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
              <Save size={16} /> Save
            </button>
          </div>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Card Header */}
          <div className="px-6 pt-5 pb-4 border-b border-gray-200 bg-gray-50/30">
            {editing && (
              <span className="inline-block px-3 py-1 mb-3 text-xs font-semibold text-blue-600 bg-blue-100 border border-blue-200 rounded-full">
                Editing: {editing.name}
              </span>
            )}
            {/* Category Pills */}
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => f("category", cat)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    form.category === cat
                      ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                      : "bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="p-8 space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Group Details */}
            <div>
              <SectionTitle title="Group Details" />
              <div className="grid grid-cols-1 gap-6">
                <Field label="Group Name" required>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => f("name", e.target.value)}
                    placeholder="e.g. Film, Ink, Adhesive, Pouch..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </Field>
                <Field label="Description">
                  <textarea
                    value={form.description}
                    onChange={(e) => f("description", e.target.value)}
                    placeholder="What type of items belong to this group..."
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                  />
                </Field>
              </div>
            </div>

            {/* Status Toggle */}
            <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
              <button
                onClick={() => f("status", form.status === "Active" ? "Inactive" : "Active")}
                className={`w-12 h-6 rounded-full transition-colors relative ${form.status === "Active" ? "bg-blue-500" : "bg-gray-300"}`}
              >
                <div className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${form.status === "Active" ? "left-7" : "left-1"}`} />
              </button>
              <span className="text-sm font-medium text-gray-700">Active Group</span>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-6 border-t border-gray-200">
              <button onClick={() => setForm(blank)} className="px-6 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                Clear
              </button>
              <button onClick={save} className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
                <Check size={16} /> Save Group
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── LIST VIEW ─────────────────────────────────────────────
  const filterCategories = ["All", ...CATEGORIES];
  const filteredData = filterCategory === "All" ? data : data.filter((r) => r.category === filterCategory);

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Item Group Master</h2>
          <p className="text-sm text-gray-500">{filteredData.length} of {data.length} groups</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
          <Plus size={16} /> Add Group
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mr-1">Category</span>
          {filterCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
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
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <DataTable
          data={filteredData}
          columns={columns}
          searchKeys={["name", "category", "description"]}
          actions={(row) => (
            <div className="flex items-center gap-2 justify-end">
              <Button variant="ghost" size="sm" icon={<Pencil size={13} />} onClick={() => openEdit(row)}>Edit</Button>
              <Button variant="danger" size="sm" icon={<Trash2 size={13} />} onClick={() => deleteRow(row.id)}>Delete</Button>
            </div>
          )}
        />
      </div>
    </div>
  );
}
