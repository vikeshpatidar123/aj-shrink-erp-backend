"use client";
import { useState } from "react";
import { Plus, Pencil, Trash2, Save, List, Check } from "lucide-react";
import { departments as initData, Department, DeptType, DeptModule } from "@/data/dummyData";
import { DataTable, Column } from "@/components/tables/DataTable";
import Button from "@/components/ui/Button";

const DEPT_TYPES: DeptType[] = ["Pre-Press", "Production", "Post-Process", "Quality", "Packing & Dispatch", "Support"];
const MODULES: DeptModule[] = ["Rotogravure", "Extrusion", "Common"];

const deptTypeColor: Record<DeptType, string> = {
  "Pre-Press":          "bg-purple-100 text-purple-700",
  "Production":         "bg-blue-100 text-blue-700",
  "Post-Process":       "bg-amber-100 text-amber-700",
  "Quality":            "bg-emerald-100 text-emerald-700",
  "Packing & Dispatch": "bg-orange-100 text-orange-700",
  "Support":            "bg-gray-100 text-gray-600",
};

const moduleColor: Record<DeptModule, string> = {
  "Rotogravure": "bg-blue-100 text-blue-700",
  "Extrusion":   "bg-orange-100 text-orange-700",
  "Common":      "bg-slate-100 text-slate-600",
};

const blank: Omit<Department, "id"> = {
  code: "", name: "", deptType: "Production", module: "Rotogravure",
  hod: "", costCenter: "", description: "", status: "Active",
};

// ── Shared UI components (must be outside main component to avoid focus loss) ──
const SectionTitle = ({ title }: { title: string }) => (
  <h3 className="text-xs font-bold text-blue-700 uppercase tracking-widest mb-4 border-b border-gray-100 pb-2">{title}</h3>
);

const Field = ({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
      {label}{required && <span className="text-red-500 ml-1">*</span>}
    </label>
    {children}
  </div>
);

const inputCls = "w-full px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white";

export default function DepartmentMasterPage() {
  const [view, setView] = useState<"list" | "form">("list");
  const [data, setData] = useState<Department[]>(initData);
  const [editing, setEditing] = useState<Department | null>(null);
  const [form, setForm] = useState<Omit<Department, "id">>(blank);
  const [filterModule, setFilterModule] = useState<"All" | DeptModule>("All");
  const [filterType, setFilterType] = useState<"All" | DeptType>("All");

  const f = (k: keyof typeof form, v: any) => setForm((p) => ({ ...p, [k]: v }));

  const openAdd = () => { setEditing(null); setForm(blank); setView("form"); };
  const openEdit = (row: Department) => {
    setEditing(row);
    const { id, ...rest } = row;
    setForm(rest);
    setView("form");
  };

  const save = () => {
    if (!form.name || !form.code) return;
    if (editing) {
      setData((d) => d.map((r) => r.id === editing.id ? { ...form, id: editing.id } : r));
    } else {
      const id = `D${String(data.length + 1).padStart(3, "0")}`;
      setData((d) => [...d, { ...form, id }]);
    }
    setView("list");
  };

  const deleteRow = (id: string) => {
    if (confirm("Delete this department?")) setData((d) => d.filter((r) => r.id !== id));
  };

  // ── FORM VIEW ──────────────────────────────────────────────
  if (view === "form") {
    return (
      <div className="max-w-4xl mx-auto pb-10">
        {/* Header Ribbon */}
        <div className="flex items-center justify-between mb-6 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div>
            <p className="text-xs text-gray-400 font-medium tracking-wide uppercase">AJ Shrink Wrap Pvt Ltd</p>
            <h2 className="text-xl font-bold text-gray-800">Department Master</h2>
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

        {/* Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Card top — Module + Type selectors */}
          <div className="px-6 pt-5 pb-5 border-b border-gray-200 bg-gray-50/30 space-y-4">
            {editing && (
              <span className="inline-block px-3 py-1 text-xs font-semibold text-blue-600 bg-blue-100 border border-blue-200 rounded-full">
                Editing: {editing.name}
              </span>
            )}

            {/* Module pills */}
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Module <span className="text-red-500">*</span></label>
              <div className="flex gap-2 flex-wrap">
                {MODULES.map((mod) => (
                  <button key={mod} onClick={() => f("module", mod)}
                    className={`px-4 py-1.5 rounded-lg text-sm font-semibold border-2 transition-all ${form.module === mod
                      ? mod === "Rotogravure" ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                        : mod === "Extrusion" ? "bg-orange-500 text-white border-orange-500 shadow-sm"
                        : "bg-slate-600 text-white border-slate-600 shadow-sm"
                      : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"}`}>
                    {mod}
                  </button>
                ))}
              </div>
            </div>

            {/* Dept Type pills */}
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Department Type <span className="text-red-500">*</span></label>
              <div className="flex gap-2 flex-wrap">
                {DEPT_TYPES.map((dt) => (
                  <button key={dt} onClick={() => f("deptType", dt)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${form.deptType === dt
                      ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                      : "bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600"}`}>
                    {dt}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="p-8 space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">

            {/* Section 1 – Identity */}
            <div>
              <SectionTitle title="Department Identity" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Field label="Department Code" required>
                  <input type="text" value={form.code} onChange={(e) => f("code", e.target.value)} placeholder="e.g. DEPT-PRT" className={inputCls} />
                </Field>
                <div className="md:col-span-2">
                  <Field label="Department Name" required>
                    <input type="text" value={form.name} onChange={(e) => f("name", e.target.value)} placeholder="e.g. Printing, Lamination, Pre-Press..." className={inputCls} />
                  </Field>
                </div>
              </div>
            </div>

            {/* Section 2 – Administration */}
            <div>
              <SectionTitle title="Administration" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Field label="Head of Department (HOD)">
                  <input type="text" value={form.hod} onChange={(e) => f("hod", e.target.value)} placeholder="e.g. Rajesh Kumar" className={inputCls} />
                </Field>
                <Field label="Cost Center Code">
                  <input type="text" value={form.costCenter} onChange={(e) => f("costCenter", e.target.value)} placeholder="e.g. CC-101" className={inputCls} />
                </Field>
              </div>
            </div>

            {/* Description */}
            <div>
              <SectionTitle title="Description" />
              <textarea
                value={form.description}
                onChange={(e) => f("description", e.target.value)}
                placeholder="What processes or activities does this department handle..."
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              />
            </div>

            {/* Status Toggle */}
            <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
              <button
                onClick={() => f("status", form.status === "Active" ? "Inactive" : "Active")}
                className={`w-12 h-6 rounded-full transition-colors relative ${form.status === "Active" ? "bg-blue-600" : "bg-gray-300"}`}
              >
                <div className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${form.status === "Active" ? "left-7" : "left-1"}`} />
              </button>
              <span className="text-sm font-medium text-gray-700">Active Department</span>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-6 border-t border-gray-200">
              <button onClick={() => setForm(blank)} className="px-6 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                Clear
              </button>
              <button onClick={save} className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
                <Check size={16} /> Save Department
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── LIST VIEW ──────────────────────────────────────────────
  const onFilterModuleChange = (mod: "All" | DeptModule) => { setFilterModule(mod); setFilterType("All"); };

  const filteredData = data.filter((r) => {
    if (filterModule !== "All" && r.module !== filterModule) return false;
    if (filterType !== "All" && r.deptType !== filterType) return false;
    return true;
  });

  const columns: Column<Department>[] = [
    { key: "code", header: "Code", sortable: true },
    { key: "name", header: "Department Name", sortable: true },
    { key: "module", header: "Module", render: (r) => (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${moduleColor[r.module]}`}>{r.module}</span>
    )},
    { key: "deptType", header: "Type", render: (r) => (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${deptTypeColor[r.deptType]}`}>{r.deptType}</span>
    )},
    { key: "hod", header: "HOD", render: (r) => <span className="text-gray-600 text-xs">{r.hod || "—"}</span> },
    { key: "costCenter", header: "Cost Center", render: (r) => <span className="text-gray-500 text-xs font-mono">{r.costCenter || "—"}</span> },
    { key: "status", header: "Status", render: (r) => (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${r.status === "Active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{r.status}</span>
    )},
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Department Master</h2>
          <p className="text-sm text-gray-500">{filteredData.length} of {data.length} departments</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
          <Plus size={16} /> Add Department
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4 space-y-3">
        {/* Module filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider w-12">Module</span>
          {(["All", "Rotogravure", "Extrusion", "Common"] as const).map((mod) => (
            <button key={mod} onClick={() => onFilterModuleChange(mod)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${filterModule === mod
                ? mod === "Rotogravure" ? "bg-blue-600 text-white shadow-sm"
                  : mod === "Extrusion" ? "bg-orange-500 text-white shadow-sm"
                  : mod === "Common" ? "bg-slate-600 text-white shadow-sm"
                  : "bg-blue-600 text-white shadow-sm"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {mod === "All" ? "All Modules" : mod}
            </button>
          ))}
        </div>

        {/* Type filter */}
        <div className="flex items-center gap-2 flex-wrap border-t border-gray-100 pt-3">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider w-12">Type</span>
          <button onClick={() => setFilterType("All")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterType === "All" ? "bg-blue-600 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
            All
          </button>
          {DEPT_TYPES.map((dt) => (
            <button key={dt} onClick={() => setFilterType(dt)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterType === dt ? "bg-blue-600 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {dt}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <DataTable data={filteredData} columns={columns} searchKeys={["name", "code", "hod", "costCenter"]}
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
