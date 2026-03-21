"use client";
import { useState } from "react";
import { Plus, Pencil, Trash2, Save, Check, List } from "lucide-react";
import { processMasters as initData, ProcessMaster, ProcessModule, machines } from "@/data/dummyData";
import { DataTable, Column } from "@/components/tables/DataTable";
import Button from "@/components/ui/Button";
import { inputCls } from "@/lib/styles";

// ─── Departments by module ────────────────────────────────────

const ROTO_DEPTS = ["Pre-Press", "Printing", "Lamination", "Coating", "Slitting", "Pouch Making", "QC", "Packing"];
const EXT_DEPTS  = ["Blown Film Line", "Cast Film Line", "Co-Extrusion", "Corona Treatment", "Slitting (Extrusion)", "Packing (Extrusion)"];

const DEPTS_BY_MODULE: Record<ProcessModule, string[]> = {
  "Rotogravure": ROTO_DEPTS,
  "Extrusion":   EXT_DEPTS,
};

const CHARGE_TYPE_BY_DEPT: Record<string, string[]> = {
  // Rotogravure
  "Pre-Press":            ["Per Cylinder", "Per Job", "Per Hour"],
  "Printing":             ["Per m²", "Per m", "Per Hour"],
  "Lamination":           ["Per m²", "Per m", "Per Hour"],
  "Coating":              ["Per m²", "Per m", "Per Hour"],
  "Slitting":             ["Per m", "Per m²", "Per Hour"],
  "Pouch Making":         ["Per 1000 Pcs", "Per Pcs", "Per Hour"],
  "QC":                   ["Per m", "Per Job", "Per Hour"],
  "Packing":              ["Per Job", "Per Carton", "Per Hour"],
  // Extrusion
  "Blown Film Line":      ["Per Kg", "Per MT", "Per Hour"],
  "Cast Film Line":       ["Per Kg", "Per MT", "Per Hour"],
  "Co-Extrusion":         ["Per Kg", "Per MT", "Per Hour"],
  "Corona Treatment":     ["Per m", "Per Hour", "Per Kg"],
  "Slitting (Extrusion)": ["Per m", "Per m²", "Per Kg", "Per Hour"],
  "Packing (Extrusion)":  ["Per Job", "Per Carton", "Per Hour"],
};

const CHARGE_UNIT_BY_TYPE: Record<string, string> = {
  "Per m²": "m²", "Per m": "m", "Per Hour": "hr", "Per Cylinder": "Cylinder",
  "Per Job": "Job", "Per 1000 Pcs": "1000 Pcs", "Per Pcs": "Pcs",
  "Per Carton": "Carton", "Per Kg": "Kg", "Per MT": "MT",
};

const blank: Omit<ProcessMaster, "id"> = {
  code: "", name: "", displayName: "", module: "Rotogravure", department: "Printing",
  processCategory: "Main Process",
  chargeType: "Per m²", rate: "", chargeUnit: "m²",
  minimumCharges: "", minQtyToCharge: "",
  makeSetupCharges: false, setupChargeAmount: "",
  processWastePct: "", processWasteFlat: "",
  isOnlineProduction: true, displayInQuotation: true,
  machineIds: [], description: "", status: "Active",
};

// ─── Helpers ──────────────────────────────────────────────────

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

const Sel = ({ value, onChange, options, placeholder = "Select..." }: { value: string; onChange: (v: string) => void; options: string[]; placeholder?: string }) => (
  <select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}>
    <option value="">{placeholder}</option>
    {options.map(o => <option key={o} value={o}>{o}</option>)}
  </select>
);

const PrefixInput = ({ value, onChange, prefix, placeholder, type = "text" }: any) => (
  <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden bg-white focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
    <div className="bg-gray-50 px-3 py-2 text-xs text-gray-500 border-r border-gray-300 font-medium whitespace-nowrap">{prefix}</div>
    <input type={type} value={value} onChange={onChange} placeholder={placeholder} className="flex-1 px-3 py-2 text-sm text-gray-800 outline-none" />
  </div>
);

const SuffixInput = ({ value, onChange, suffix, placeholder, type = "text" }: any) => (
  <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden bg-white focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
    <input type={type} value={value} onChange={onChange} placeholder={placeholder} className="flex-1 px-3 py-2 text-sm text-gray-800 outline-none" />
    <div className="bg-gray-50 px-3 py-2 text-xs text-gray-500 border-l border-gray-300 font-medium whitespace-nowrap">{suffix}</div>
  </div>
);

const Checkbox = ({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) => (
  <label className="flex items-center gap-2.5 cursor-pointer select-none">
    <div onClick={onChange} className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 cursor-pointer transition-colors ${checked ? "bg-blue-600 border-blue-600" : "border-gray-300 bg-white"}`}>
      {checked && <Check size={10} className="text-white" strokeWidth={3} />}
    </div>
    <span className="text-sm text-gray-700">{label}</span>
  </label>
);

const deptColor: Record<string, string> = {
  // Rotogravure
  "Pre-Press":            "bg-purple-100 text-purple-700",
  "Printing":             "bg-blue-100 text-blue-700",
  "Lamination":           "bg-amber-100 text-amber-700",
  "Coating":              "bg-cyan-100 text-cyan-700",
  "Slitting":             "bg-emerald-100 text-emerald-700",
  "Pouch Making":         "bg-rose-100 text-rose-700",
  "QC":                   "bg-gray-100 text-gray-700",
  "Packing":              "bg-orange-100 text-orange-700",
  // Extrusion
  "Blown Film Line":      "bg-sky-100 text-sky-700",
  "Cast Film Line":       "bg-indigo-100 text-indigo-700",
  "Co-Extrusion":         "bg-violet-100 text-violet-700",
  "Corona Treatment":     "bg-lime-100 text-lime-700",
  "Slitting (Extrusion)": "bg-green-100 text-green-700",
  "Packing (Extrusion)":  "bg-yellow-100 text-yellow-700",
};

// ─── Page ─────────────────────────────────────────────────────

export default function ProcessMasterPage() {
  const [view, setView] = useState<"list" | "form">("list");
  const [data, setData] = useState<ProcessMaster[]>(initData);
  const [editing, setEditing] = useState<ProcessMaster | null>(null);
  const [form, setForm] = useState<Omit<ProcessMaster, "id">>(blank);
  const [activeTab, setActiveTab] = useState<"detail" | "costing" | "machines">("detail");
  const [filterModule, setFilterModule] = useState<"All" | ProcessModule>("All");
  const [filterDept, setFilterDept] = useState("All");

  const f = (k: keyof typeof form, v: any) => setForm((p) => ({ ...p, [k]: v }));

  const onModuleChange = (mod: ProcessModule) => {
    const firstDept = DEPTS_BY_MODULE[mod][0];
    const firstCharge = (CHARGE_TYPE_BY_DEPT[firstDept] ?? ["Per Kg"])[0];
    setForm((p) => ({ ...p, module: mod, department: firstDept, chargeType: firstCharge, chargeUnit: CHARGE_UNIT_BY_TYPE[firstCharge] ?? "" }));
  };

  const onDeptChange = (dept: string) => {
    const firstCharge = (CHARGE_TYPE_BY_DEPT[dept] ?? ["Per m²"])[0];
    setForm((p) => ({ ...p, department: dept, chargeType: firstCharge, chargeUnit: CHARGE_UNIT_BY_TYPE[firstCharge] ?? "" }));
  };

  const onChargeTypeChange = (ct: string) => {
    setForm((p) => ({ ...p, chargeType: ct, chargeUnit: CHARGE_UNIT_BY_TYPE[ct] ?? "" }));
  };

  const onFilterModuleChange = (mod: "All" | ProcessModule) => {
    setFilterModule(mod);
    setFilterDept("All");
  };

  const openAdd = () => { setEditing(null); setForm(blank); setActiveTab("detail"); setView("form"); };
  const openEdit = (row: ProcessMaster) => {
    setEditing(row);
    const { id, ...rest } = row;
    setForm(rest);
    setActiveTab("detail");
    setView("form");
  };

  const save = () => {
    if (!form.code || !form.name) return;
    if (editing) {
      setData((d) => d.map((r) => r.id === editing.id ? { ...form, id: editing.id } : r));
    } else {
      const n = data.length + 1;
      setData((d) => [...d, { ...form, id: `PR${String(n).padStart(3, "0")}` }]);
    }
    setView("list");
  };

  const deleteRow = (id: string) => {
    if (confirm("Delete this process?")) setData((d) => d.filter((r) => r.id !== id));
  };

  const toggleMachine = (id: string) =>
    setForm((p) => ({ ...p, machineIds: p.machineIds.includes(id) ? p.machineIds.filter(m => m !== id) : [...p.machineIds, id] }));

  const deptMachines = machines.filter(m => m.department === form.department);

  // ── FORM VIEW ─────────────────────────────────────────────
  if (view === "form") {
    const chargeTypes = CHARGE_TYPE_BY_DEPT[form.department] ?? [];

    return (
      <div className="max-w-5xl mx-auto pb-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div>
            <p className="text-xs text-gray-400 font-medium tracking-wide uppercase">AJ Shrink Wrap Pvt Ltd</p>
            <h2 className="text-xl font-bold text-gray-800">Process Master</h2>
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
          <div className="px-6 pt-5 border-b border-gray-200 bg-gray-50/30">
            {form.code && <span className="inline-block px-3 py-1 mb-4 text-xs font-semibold text-blue-600 bg-blue-100 border border-blue-200 rounded-full">{form.code}</span>}
            <div className="flex gap-8">
              {(["detail", "costing", "machines"] as const).map((t) => (
                <button key={t} onClick={() => setActiveTab(t)}
                  className={`pb-3 text-sm font-medium transition-colors border-b-2 ${activeTab === t ? "text-blue-600 border-blue-600" : "text-gray-500 border-transparent hover:text-gray-700"}`}>
                  {{ detail: "Process Detail", costing: "Costing", machines: "Machine Allocation" }[t]}
                </button>
              ))}
            </div>
          </div>

          <div className="p-8">

            {/* ── PROCESS DETAIL ── */}
            {activeTab === "detail" && (
              <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-300">

                <div>
                  <SectionTitle title="Process Identity" />
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Field label="Process Code" required>
                      <input type="text" value={form.code} onChange={(e) => f("code", e.target.value)} placeholder="e.g. PR022" className={inputCls} />
                    </Field>
                    <Field label="Process Name" required>
                      <input type="text" value={form.name} onChange={(e) => f("name", e.target.value)} placeholder="e.g. 8-Color Roto Printing" className={inputCls} />
                    </Field>
                    <Field label="Display Name">
                      <input type="text" value={form.displayName} onChange={(e) => f("displayName", e.target.value)} placeholder="Short name" className={inputCls} />
                    </Field>
                  </div>
                </div>

                <div>
                  <SectionTitle title="Classification" />
                  <div className="space-y-4">
                    {/* Module toggle */}
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 block">Module <span className="text-red-500">*</span></label>
                      <div className="flex gap-3">
                        {(["Rotogravure", "Extrusion"] as ProcessModule[]).map((mod) => (
                          <button key={mod} onClick={() => onModuleChange(mod)}
                            className={`px-5 py-2 rounded-lg text-sm font-semibold border-2 transition-all ${form.module === mod
                              ? mod === "Rotogravure" ? "bg-blue-600 text-white border-blue-600 shadow-sm" : "bg-orange-500 text-white border-orange-500 shadow-sm"
                              : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"}`}>
                            {mod}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Department pills */}
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 block">Department <span className="text-red-500">*</span></label>
                      <div className="flex flex-wrap gap-2">
                        {DEPTS_BY_MODULE[form.module].map((d) => (
                          <button key={d} onClick={() => onDeptChange(d)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${form.department === d ? "bg-blue-600 text-white border-blue-600 shadow-sm" : "bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600"}`}>
                            {d}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <Field label="Process Category">
                        <Sel value={form.processCategory} onChange={(v) => f("processCategory", v)} options={["Main Process", "Sub Process"]} />
                      </Field>
                      <Field label="Status">
                        <Sel value={form.status} onChange={(v) => f("status", v)} options={["Active", "Inactive"]} />
                      </Field>
                    </div>
                  </div>
                </div>

                <div>
                  <SectionTitle title="Settings" />
                  <div className="flex flex-wrap gap-8">
                    <Checkbox checked={form.isOnlineProduction} onChange={() => f("isOnlineProduction", !form.isOnlineProduction)} label="Online Production Process" />
                    <Checkbox checked={form.displayInQuotation} onChange={() => f("displayInQuotation", !form.displayInQuotation)} label="Display in Quotation" />
                  </div>
                </div>

                <Field label="Description / Remarks">
                  <textarea value={form.description} onChange={(e) => f("description", e.target.value)} placeholder="Process notes..." rows={2} className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none" />
                </Field>

                <div className="flex items-center justify-between pt-6 border-t border-gray-200">
                  <button onClick={() => setForm(blank)} className="px-6 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">Clear</button>
                  <button onClick={() => setActiveTab("costing")} className="px-6 py-2.5 text-sm font-medium text-white bg-slate-800 rounded-lg hover:bg-slate-900 transition-colors shadow-sm">Costing →</button>
                </div>
              </div>
            )}

            {/* ── COSTING ── */}
            {activeTab === "costing" && (
              <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-300">

                {/* Dept badge */}
                <div className="flex gap-2 flex-wrap">
                  <span className={`px-3 py-1 text-xs font-semibold rounded-full ${form.module === "Rotogravure" ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"}`}>{form.module}</span>
                  <span className={`px-3 py-1 text-xs font-semibold rounded-full ${deptColor[form.department] ?? "bg-gray-100 text-gray-600"}`}>{form.department}</span>
                  <span className="px-3 py-1 text-xs font-semibold text-gray-500 bg-gray-100 rounded-full">{form.processCategory}</span>
                </div>

                <div>
                  <SectionTitle title="Rate Setup" />
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Field label="Type of Charges">
                      <Sel value={form.chargeType} onChange={onChargeTypeChange} options={chargeTypes} />
                    </Field>
                    <Field label={`Rate (₹ / ${form.chargeUnit || "unit"})`}>
                      <PrefixInput value={form.rate} onChange={(e: any) => f("rate", e.target.value)} prefix="₹" placeholder="0.00" type="number" />
                    </Field>
                    <Field label="Minimum Charges (₹)">
                      <PrefixInput value={form.minimumCharges} onChange={(e: any) => f("minimumCharges", e.target.value)} prefix="₹" placeholder="0.00" type="number" />
                    </Field>
                    <Field label="Min. Qty To Be Charged">
                      <SuffixInput value={form.minQtyToCharge} onChange={(e: any) => f("minQtyToCharge", e.target.value)} suffix={form.chargeUnit || "unit"} placeholder="e.g. 100" type="number" />
                    </Field>
                  </div>
                </div>

                <div>
                  <SectionTitle title="Waste" />
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Field label="Process Waste %">
                      <SuffixInput value={form.processWastePct} onChange={(e: any) => f("processWastePct", e.target.value)} suffix="%" placeholder="e.g. 3" type="number" />
                    </Field>
                    <Field label="Process Waste Flat (₹)">
                      <PrefixInput value={form.processWasteFlat} onChange={(e: any) => f("processWasteFlat", e.target.value)} prefix="₹" placeholder="0.00" type="number" />
                    </Field>
                  </div>
                </div>

                <div>
                  <SectionTitle title="Setup Charges" />
                  <div className="space-y-4">
                    <Checkbox checked={form.makeSetupCharges} onChange={() => f("makeSetupCharges", !form.makeSetupCharges)} label="Apply Setup / Make-Ready Charges" />
                    {form.makeSetupCharges && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                        <Field label="Setup Charge Amount (₹)">
                          <PrefixInput value={form.setupChargeAmount} onChange={(e: any) => f("setupChargeAmount", e.target.value)} prefix="₹" placeholder="0.00" type="number" />
                        </Field>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-6 border-t border-gray-200">
                  <button onClick={() => setForm(blank)} className="px-6 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">Clear</button>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setActiveTab("detail")} className="px-6 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">← Detail</button>
                    <button onClick={() => setActiveTab("machines")} className="px-6 py-2.5 text-sm font-medium text-white bg-slate-800 rounded-lg hover:bg-slate-900 transition-colors shadow-sm">Machines →</button>
                  </div>
                </div>
              </div>
            )}

            {/* ── MACHINE ALLOCATION ── */}
            {activeTab === "machines" && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div>
                  <SectionTitle title={`Machines – ${form.department}`} />
                  {deptMachines.length === 0 ? (
                    <div className="flex items-center justify-center py-12 text-sm text-gray-400 italic border-2 border-dashed border-gray-200 rounded-xl">
                      No machines registered under "{form.department}". Add machines in Machine Master first.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {deptMachines.map((m) => {
                        const selected = form.machineIds.includes(m.id);
                        return (
                          <div key={m.id} onClick={() => toggleMachine(m.id)}
                            className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${selected ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-white hover:border-gray-300"}`}>
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${selected ? "bg-blue-600 border-blue-600" : "border-gray-300 bg-white"}`}>
                              {selected && <Check size={11} className="text-white" strokeWidth={3} />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-800">{m.name}</p>
                              <p className="text-xs text-gray-500">{m.code} · {m.machineType}{m.maxWebWidth ? ` · Max ${m.maxWebWidth}mm` : ""}</p>
                            </div>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${m.status === "Running" ? "bg-green-100 text-green-700" : m.status === "Idle" ? "bg-gray-100 text-gray-500" : "bg-amber-100 text-amber-700"}`}>
                              {m.status}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {form.machineIds.length > 0 && (
                    <p className="text-xs text-blue-600 font-medium mt-4">{form.machineIds.length} machine{form.machineIds.length > 1 ? "s" : ""} selected</p>
                  )}
                </div>

                <div className="flex items-center justify-between pt-6 border-t border-gray-200">
                  <button onClick={() => setForm(blank)} className="px-6 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">Clear</button>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setActiveTab("costing")} className="px-6 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">← Costing</button>
                    <button onClick={save} className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
                      <Check size={16} /> Save Process
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── LIST VIEW ─────────────────────────────────────────────
  const deptListForFilter = filterModule === "All"
    ? [...ROTO_DEPTS, ...EXT_DEPTS]
    : DEPTS_BY_MODULE[filterModule];

  const filteredData = data.filter((r) => {
    if (filterModule !== "All" && r.module !== filterModule) return false;
    if (filterDept !== "All" && r.department !== filterDept) return false;
    return true;
  });

  const columns: Column<ProcessMaster>[] = [
    { key: "code", header: "Code", sortable: true },
    { key: "name", header: "Process Name", sortable: true },
    { key: "module", header: "Module", render: (r) => (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${r.module === "Rotogravure" ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"}`}>{r.module === "Rotogravure" ? "Roto" : "Extrusion"}</span>
    )},
    { key: "department", header: "Department", sortable: true, render: (r) => (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${deptColor[r.department] ?? "bg-gray-100 text-gray-600"}`}>{r.department}</span>
    )},
    { key: "chargeType", header: "Charge Type" },
    { key: "rate", header: "Rate", render: (r) => r.rate ? `₹ ${r.rate} / ${r.chargeUnit}` : "—" },
    { key: "processWastePct", header: "Waste %", render: (r) => r.processWastePct ? `${r.processWastePct}%` : "—" },
    { key: "status", header: "Status", sortable: true, render: (r) => (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${r.status === "Active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{r.status}</span>
    )},
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Process Master</h2>
          <p className="text-sm text-gray-500">{filteredData.length} of {data.length} processes</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
          <Plus size={16} /> Add Process
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4 space-y-3">
        {/* Module filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mr-1 w-10">Module</span>
          {(["All", "Rotogravure", "Extrusion"] as const).map((mod) => (
            <button key={mod} onClick={() => onFilterModuleChange(mod)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${filterModule === mod
                ? mod === "Rotogravure" ? "bg-blue-600 text-white shadow-sm"
                  : mod === "Extrusion" ? "bg-orange-500 text-white shadow-sm"
                  : "bg-blue-600 text-white shadow-sm"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {mod === "All" ? "All Modules" : mod}
            </button>
          ))}
        </div>
        {/* Dept filter */}
        <div className="flex items-center gap-2 flex-wrap border-t border-gray-100 pt-3">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mr-1 w-10">Dept</span>
          <button onClick={() => setFilterDept("All")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterDept === "All" ? "bg-blue-600 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
            All
          </button>
          {deptListForFilter.map((d) => (
            <button key={d} onClick={() => setFilterDept(d)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterDept === d ? "bg-blue-600 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {d}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <DataTable data={filteredData} columns={columns} searchKeys={["name", "code", "department"]}
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
