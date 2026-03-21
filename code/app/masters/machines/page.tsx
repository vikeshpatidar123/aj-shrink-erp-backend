"use client";
import { useState } from "react";
import { Plus, Pencil, Trash2, Save, Check, List } from "lucide-react";
import { machines as initData, Machine } from "@/data/dummyData";
import { DataTable, Column } from "@/components/tables/DataTable";
import Button from "@/components/ui/Button";
import { inputCls } from "@/lib/styles";

// ─── Roto plant departments & machine types ───────────────────

const DEPARTMENTS = ["Pre-Press", "Printing", "Lamination", "Slitting", "Pouch Making", "QC"] as const;

const MACHINE_TYPES: Record<string, string[]> = {
  "Pre-Press":    ["Electromechanical Engraver", "Laser Engraver", "Chrome Plating", "Cylinder Grinder", "Proof Press"],
  "Printing":     ["Rotogravure Press"],
  "Lamination":   ["Dry Bond", "Solventless", "Wet Bond", "Extrusion Lamination"],
  "Slitting":     ["Duplex Slitter", "Triplex Slitter", "Simplex Rewinder"],
  "Pouch Making": ["3-Side Seal", "4-Side Seal", "Back Seal / Center Seal", "Stand-up Pouch", "Zip Lock", "Shrink Sleeve Seamer"],
  "QC":           ["Vision Inspection", "Rewinder", "Tensile Tester", "Seal Strength Tester"],
};

const blank: Omit<Machine, "id"> = {
  code: "", name: "", displayName: "", department: "Printing", machineType: "Rotogravure Press",
  operator: "", branch: "Main Plant", status: "Idle", isPlanningMachine: false,
  maxWebWidth: "", minWebWidth: "", speedMax: "", speedUnit: "m/min",
  electricConsumption: "", costPerHour: "",
  noOfColors: "", repeatLengthMin: "", repeatLengthMax: "",
  gripper: "", printingMargin: "", makeReadyWastage: "", makeReadyCharges: "",
  makeReadyTime: "", makeReadyTimeMode: "Per Color", makeReadyChargesPerHr: "", jobChangeOverTime: "",
  minPrintingImpr: "", basicPrintingCharged: "", roundImpWith: "",
  noOfUnwinds: "", adhesiveCoverage: "",
  noOfSlitters: "",
  minPouchSize: "", maxPouchSize: "",
  maxCylinderWidth: "", maxCircumference: "",
  chargeType: "Per Hour", wasteType: "", wasteCalcOn: "",
  perHourCostingParam: "Speed Based", refMachineCode: "",
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

const SuffixInput = ({ value, onChange, suffix, placeholder, type = "text" }: any) => (
  <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden bg-white focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
    <input type={type} value={value} onChange={onChange} placeholder={placeholder} className="flex-1 px-3 py-2 text-sm text-gray-800 outline-none" />
    <div className="bg-gray-50 px-3 py-2 text-xs text-gray-500 border-l border-gray-300 font-medium whitespace-nowrap">{suffix}</div>
  </div>
);

const PrefixInput = ({ value, onChange, prefix, placeholder, type = "text" }: any) => (
  <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden bg-white focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
    <div className="bg-gray-50 px-3 py-2 text-xs text-gray-500 border-r border-gray-300 font-medium whitespace-nowrap">{prefix}</div>
    <input type={type} value={value} onChange={onChange} placeholder={placeholder} className="flex-1 px-3 py-2 text-sm text-gray-800 outline-none" />
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
  "Pre-Press":    "bg-purple-100 text-purple-700",
  "Printing":     "bg-blue-100 text-blue-700",
  "Lamination":   "bg-amber-100 text-amber-700",
  "Slitting":     "bg-emerald-100 text-emerald-700",
  "Pouch Making": "bg-rose-100 text-rose-700",
  "QC":           "bg-gray-100 text-gray-700",
};

// ─── Department-specific spec components ─────────────────────

function PrePressSpecs({ form, f }: { form: any; f: any }) {
  return (
    <div>
      <SectionTitle title="Cylinder / Engraving Parameters" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <Field label="Max Cylinder Width">
          <SuffixInput value={form.maxCylinderWidth} onChange={(e: any) => f("maxCylinderWidth", e.target.value)} suffix="mm" placeholder="e.g. 1600" type="number" />
        </Field>
        <Field label="Max Circumference">
          <SuffixInput value={form.maxCircumference} onChange={(e: any) => f("maxCircumference", e.target.value)} suffix="mm" placeholder="e.g. 1200" type="number" />
        </Field>
        <Field label="Speed Max">
          <SuffixInput value={form.speedMax} onChange={(e: any) => f("speedMax", e.target.value)} suffix="cyl/hr" placeholder="e.g. 4" type="number" />
        </Field>
        <Field label="Electric Consumption">
          <SuffixInput value={form.electricConsumption} onChange={(e: any) => f("electricConsumption", e.target.value)} suffix="kW" placeholder="e.g. 15" type="number" />
        </Field>
      </div>
    </div>
  );
}

function PrintingSpecs({ form, f }: { form: any; f: any }) {
  return (
    <div className="space-y-8">
      <div>
        <SectionTitle title="Press Parameters" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <Field label="No. of Colors">
            <Sel value={form.noOfColors} onChange={(v) => f("noOfColors", v)} options={["4","5","6","7","8","9","10","11","12"]} />
          </Field>
          <Field label="Min Web Width">
            <SuffixInput value={form.minWebWidth} onChange={(e: any) => f("minWebWidth", e.target.value)} suffix="mm" placeholder="e.g. 150" type="number" />
          </Field>
          <Field label="Max Web Width">
            <SuffixInput value={form.maxWebWidth} onChange={(e: any) => f("maxWebWidth", e.target.value)} suffix="mm" placeholder="e.g. 1600" type="number" />
          </Field>
          <Field label="Max Speed">
            <SuffixInput value={form.speedMax} onChange={(e: any) => f("speedMax", e.target.value)} suffix="m/min" placeholder="e.g. 150" type="number" />
          </Field>
          <Field label="Repeat Length Min">
            <SuffixInput value={form.repeatLengthMin} onChange={(e: any) => f("repeatLengthMin", e.target.value)} suffix="mm" placeholder="e.g. 300" type="number" />
          </Field>
          <Field label="Repeat Length Max">
            <SuffixInput value={form.repeatLengthMax} onChange={(e: any) => f("repeatLengthMax", e.target.value)} suffix="mm" placeholder="e.g. 1500" type="number" />
          </Field>
          <Field label="Gripper">
            <SuffixInput value={form.gripper} onChange={(e: any) => f("gripper", e.target.value)} suffix="mm" placeholder="e.g. 10" type="number" />
          </Field>
          <Field label="Printing Margin">
            <SuffixInput value={form.printingMargin} onChange={(e: any) => f("printingMargin", e.target.value)} suffix="mm" placeholder="e.g. 15" type="number" />
          </Field>
        </div>
      </div>
      <div>
        <SectionTitle title="Make Ready" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <Field label="Make Ready Wastage">
            <SuffixInput value={form.makeReadyWastage} onChange={(e: any) => f("makeReadyWastage", e.target.value)} suffix="m / run" placeholder="e.g. 50" type="number" />
          </Field>
          <Field label="Make Ready Charges">
            <PrefixInput value={form.makeReadyCharges} onChange={(e: any) => f("makeReadyCharges", e.target.value)} prefix="₹" placeholder="e.g. 1500" type="number" />
          </Field>
          <Field label="Make Ready Time">
            <SuffixInput value={form.makeReadyTime} onChange={(e: any) => f("makeReadyTime", e.target.value)} suffix="min/color" placeholder="e.g. 20" type="number" />
          </Field>
          <Field label="Make Ready Time Mode">
            <Sel value={form.makeReadyTimeMode} onChange={(v) => f("makeReadyTimeMode", v)} options={["Per Color", "Per Job", "Fixed"]} />
          </Field>
          <Field label="Make Ready Charges / Hr">
            <PrefixInput value={form.makeReadyChargesPerHr} onChange={(e: any) => f("makeReadyChargesPerHr", e.target.value)} prefix="₹" placeholder="0.00" type="number" />
          </Field>
          <Field label="Job Change Over Time">
            <SuffixInput value={form.jobChangeOverTime} onChange={(e: any) => f("jobChangeOverTime", e.target.value)} suffix="min" placeholder="e.g. 30" type="number" />
          </Field>
          <Field label="Min Printing Impr. To Charge">
            <input type="number" value={form.minPrintingImpr} onChange={(e) => f("minPrintingImpr", e.target.value)} placeholder="e.g. 500" className={inputCls} />
          </Field>
          <Field label="Basic Printing Charged">
            <PrefixInput value={form.basicPrintingCharged} onChange={(e: any) => f("basicPrintingCharged", e.target.value)} prefix="₹" placeholder="0.00" type="number" />
          </Field>
          <Field label="Round Impressions With">
            <input type="number" value={form.roundImpWith} onChange={(e) => f("roundImpWith", e.target.value)} placeholder="e.g. 100" className={inputCls} />
          </Field>
        </div>
      </div>
    </div>
  );
}

function LaminationSpecs({ form, f }: { form: any; f: any }) {
  return (
    <div>
      <SectionTitle title="Lamination Parameters" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <Field label="Min Web Width">
          <SuffixInput value={form.minWebWidth} onChange={(e: any) => f("minWebWidth", e.target.value)} suffix="mm" placeholder="e.g. 150" type="number" />
        </Field>
        <Field label="Max Web Width">
          <SuffixInput value={form.maxWebWidth} onChange={(e: any) => f("maxWebWidth", e.target.value)} suffix="mm" placeholder="e.g. 1450" type="number" />
        </Field>
        <Field label="Max Speed">
          <SuffixInput value={form.speedMax} onChange={(e: any) => f("speedMax", e.target.value)} suffix="m/min" placeholder="e.g. 200" type="number" />
        </Field>
        <Field label="No. of Unwinds">
          <Sel value={form.noOfUnwinds} onChange={(v) => f("noOfUnwinds", v)} options={["2", "3"]} />
        </Field>
        <Field label="Adhesive Coverage Range">
          <SuffixInput value={form.adhesiveCoverage} onChange={(e: any) => f("adhesiveCoverage", e.target.value)} suffix="g/m²" placeholder="e.g. 2.5–4.5" />
        </Field>
        <Field label="Electric Consumption">
          <SuffixInput value={form.electricConsumption} onChange={(e: any) => f("electricConsumption", e.target.value)} suffix="kW" placeholder="e.g. 55" type="number" />
        </Field>
      </div>
    </div>
  );
}

function SlittingSpecs({ form, f }: { form: any; f: any }) {
  return (
    <div>
      <SectionTitle title="Slitter Parameters" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <Field label="Max Input Width">
          <SuffixInput value={form.maxWebWidth} onChange={(e: any) => f("maxWebWidth", e.target.value)} suffix="mm" placeholder="e.g. 1600" type="number" />
        </Field>
        <Field label="Min Slit Width">
          <SuffixInput value={form.minWebWidth} onChange={(e: any) => f("minWebWidth", e.target.value)} suffix="mm" placeholder="e.g. 30" type="number" />
        </Field>
        <Field label="Max Speed">
          <SuffixInput value={form.speedMax} onChange={(e: any) => f("speedMax", e.target.value)} suffix="m/min" placeholder="e.g. 450" type="number" />
        </Field>
        <Field label="No. of Slitters (Knives)">
          <input type="number" value={form.noOfSlitters} onChange={(e) => f("noOfSlitters", e.target.value)} placeholder="e.g. 18" className={inputCls} />
        </Field>
        <Field label="Electric Consumption">
          <SuffixInput value={form.electricConsumption} onChange={(e: any) => f("electricConsumption", e.target.value)} suffix="kW" placeholder="e.g. 20" type="number" />
        </Field>
      </div>
    </div>
  );
}

function PouchSpecs({ form, f }: { form: any; f: any }) {
  return (
    <div>
      <SectionTitle title="Pouch Machine Parameters" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <Field label="Max Web Width">
          <SuffixInput value={form.maxWebWidth} onChange={(e: any) => f("maxWebWidth", e.target.value)} suffix="mm" placeholder="e.g. 800" type="number" />
        </Field>
        <Field label="Min Web Width">
          <SuffixInput value={form.minWebWidth} onChange={(e: any) => f("minWebWidth", e.target.value)} suffix="mm" placeholder="e.g. 60" type="number" />
        </Field>
        <Field label="Speed Max">
          <SuffixInput value={form.speedMax} onChange={(e: any) => f("speedMax", e.target.value)} suffix="pcs/min" placeholder="e.g. 80" type="number" />
        </Field>
        <Field label="Min Pouch Size (W×H)">
          <input type="text" value={form.minPouchSize} onChange={(e) => f("minPouchSize", e.target.value)} placeholder="e.g. 80×60 mm" className={inputCls} />
        </Field>
        <Field label="Max Pouch Size (W×H)">
          <input type="text" value={form.maxPouchSize} onChange={(e) => f("maxPouchSize", e.target.value)} placeholder="e.g. 400×500 mm" className={inputCls} />
        </Field>
        <Field label="Electric Consumption">
          <SuffixInput value={form.electricConsumption} onChange={(e: any) => f("electricConsumption", e.target.value)} suffix="kW" placeholder="e.g. 12" type="number" />
        </Field>
      </div>
    </div>
  );
}

function QCSpecs({ form, f }: { form: any; f: any }) {
  return (
    <div>
      <SectionTitle title="Inspection Parameters" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <Field label="Max Web Width">
          <SuffixInput value={form.maxWebWidth} onChange={(e: any) => f("maxWebWidth", e.target.value)} suffix="mm" placeholder="e.g. 1600" type="number" />
        </Field>
        <Field label="Max Speed">
          <SuffixInput value={form.speedMax} onChange={(e: any) => f("speedMax", e.target.value)} suffix="m/min" placeholder="e.g. 200" type="number" />
        </Field>
        <Field label="Electric Consumption">
          <SuffixInput value={form.electricConsumption} onChange={(e: any) => f("electricConsumption", e.target.value)} suffix="kW" placeholder="e.g. 8" type="number" />
        </Field>
      </div>
    </div>
  );
}

function DeptSpecs({ form, f }: { form: any; f: any }) {
  switch (form.department) {
    case "Pre-Press":    return <PrePressSpecs form={form} f={f} />;
    case "Printing":     return <PrintingSpecs form={form} f={f} />;
    case "Lamination":   return <LaminationSpecs form={form} f={f} />;
    case "Slitting":     return <SlittingSpecs form={form} f={f} />;
    case "Pouch Making": return <PouchSpecs form={form} f={f} />;
    case "QC":           return <QCSpecs form={form} f={f} />;
    default: return (
      <div className="flex items-center justify-center py-12 text-sm text-gray-400 italic border-2 border-dashed border-gray-200 rounded-xl">
        Select a department to view specification fields.
      </div>
    );
  }
}

// ─── Page ─────────────────────────────────────────────────────

export default function MachineMasterPage() {
  const [view, setView] = useState<"list" | "form">("list");
  const [data, setData] = useState<Machine[]>(initData);
  const [editing, setEditing] = useState<Machine | null>(null);
  const [form, setForm] = useState<Omit<Machine, "id">>(blank);
  const [activeTab, setActiveTab] = useState<"detail" | "specs" | "costing">("detail");
  const [filterDept, setFilterDept] = useState("All");

  const f = (k: keyof typeof form, v: any) => setForm((p) => ({ ...p, [k]: v }));

  const onDeptChange = (dept: string) => {
    const firstType = (MACHINE_TYPES[dept] ?? [])[0] ?? "";
    const speedUnit = dept === "Pouch Making" ? "pcs/min" : "m/min";
    setForm((p) => ({ ...p, department: dept, machineType: firstType, speedUnit }));
  };

  const openAdd = () => { setEditing(null); setForm(blank); setActiveTab("detail"); setView("form"); };
  const openEdit = (row: Machine) => {
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
      setData((d) => [...d, { ...form, id: `M${String(n).padStart(3, "0")}` }]);
    }
    setView("list");
  };

  const deleteRow = (id: string) => {
    if (confirm("Delete this machine?")) setData((d) => d.filter((r) => r.id !== id));
  };

  // ── FORM VIEW ─────────────────────────────────────────────
  if (view === "form") {
    const machineTypes = MACHINE_TYPES[form.department] ?? [];

    return (
      <div className="max-w-5xl mx-auto pb-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div>
            <p className="text-xs text-gray-400 font-medium tracking-wide uppercase">AJ Shrink Wrap Pvt Ltd</p>
            <h2 className="text-xl font-bold text-gray-800">Machine Master</h2>
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
              {(["detail", "specs", "costing"] as const).map((t) => (
                <button key={t} onClick={() => setActiveTab(t)}
                  className={`pb-3 text-sm font-medium transition-colors border-b-2 ${activeTab === t ? "text-blue-600 border-blue-600" : "text-gray-500 border-transparent hover:text-gray-700"}`}>
                  {{ detail: "Machine Details", specs: "Specifications", costing: "Costing" }[t]}
                </button>
              ))}
            </div>
          </div>

          <div className="p-8">

            {/* ── MACHINE DETAILS ── */}
            {activeTab === "detail" && (
              <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-300">

                <div>
                  <SectionTitle title="Machine Identity" />
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Field label="Machine Code" required>
                      <input type="text" value={form.code} onChange={(e) => f("code", e.target.value)} placeholder="e.g. ROTO-05" className={inputCls} />
                    </Field>
                    <Field label="Machine Name" required>
                      <input type="text" value={form.name} onChange={(e) => f("name", e.target.value)} placeholder="e.g. Roto Press 5 – 8 Color" className={inputCls} />
                    </Field>
                    <Field label="Display Name">
                      <input type="text" value={form.displayName} onChange={(e) => f("displayName", e.target.value)} placeholder="Short name" className={inputCls} />
                    </Field>
                  </div>
                </div>

                <div>
                  <SectionTitle title="Department & Type" />
                  {/* Dept pills */}
                  <div className="mb-5">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 block">Under Department <span className="text-red-500">*</span></label>
                    <div className="flex flex-wrap gap-2">
                      {DEPARTMENTS.map((d) => (
                        <button key={d} onClick={() => onDeptChange(d)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${form.department === d ? "bg-blue-600 text-white border-blue-600 shadow-sm" : "bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600"}`}>
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Field label="Machine Type">
                      <Sel value={form.machineType} onChange={(v) => f("machineType", v)} options={machineTypes} />
                    </Field>
                    <Field label="Branch / Location">
                      <input type="text" value={form.branch} onChange={(e) => f("branch", e.target.value)} placeholder="e.g. Main Plant" className={inputCls} />
                    </Field>
                    <Field label="Operator">
                      <input type="text" value={form.operator} onChange={(e) => f("operator", e.target.value)} placeholder="Operator name" className={inputCls} />
                    </Field>
                    <Field label="Status">
                      <Sel value={form.status} onChange={(v) => f("status", v)} options={["Running", "Idle", "Maintenance"]} />
                    </Field>
                  </div>
                </div>

                <div>
                  <SectionTitle title="Settings" />
                  <Checkbox checked={form.isPlanningMachine} onChange={() => f("isPlanningMachine", !form.isPlanningMachine)} label="Is Planning Machine" />
                </div>

                <div className="flex items-center justify-between pt-6 border-t border-gray-200">
                  <button onClick={() => setForm(blank)} className="px-6 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">Clear</button>
                  <button onClick={() => setActiveTab("specs")} className="px-6 py-2.5 text-sm font-medium text-white bg-slate-800 rounded-lg hover:bg-slate-900 transition-colors shadow-sm">Specifications →</button>
                </div>
              </div>
            )}

            {/* ── SPECIFICATIONS ── */}
            {activeTab === "specs" && (
              <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-300">

                {/* Dept + Type badges */}
                <div className="flex gap-2">
                  <span className={`px-3 py-1 text-xs font-semibold rounded-full ${deptColor[form.department] ?? "bg-gray-100 text-gray-600"}`}>{form.department}</span>
                  {form.machineType && <span className="px-3 py-1 text-xs font-semibold text-gray-600 bg-gray-100 rounded-full">{form.machineType}</span>}
                </div>

                <DeptSpecs form={form} f={f} />

                <div className="flex items-center justify-between pt-6 border-t border-gray-200">
                  <button onClick={() => setForm(blank)} className="px-6 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">Clear</button>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setActiveTab("detail")} className="px-6 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">← Details</button>
                    <button onClick={() => setActiveTab("costing")} className="px-6 py-2.5 text-sm font-medium text-white bg-slate-800 rounded-lg hover:bg-slate-900 transition-colors shadow-sm">Costing →</button>
                  </div>
                </div>
              </div>
            )}

            {/* ── COSTING ── */}
            {activeTab === "costing" && (
              <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-300">

                <div>
                  <SectionTitle title="Cost Parameters" />
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Field label="Cost Per Hour">
                      <PrefixInput value={form.costPerHour} onChange={(e: any) => f("costPerHour", e.target.value)} prefix="₹" placeholder="0.00" type="number" />
                    </Field>
                    <Field label="Type of Charges">
                      <Sel value={form.chargeType} onChange={(v) => f("chargeType", v)} options={["Per Hour", "Per Meter", "Per m²", "Per 1000 Pcs", "Per Job", "Fixed"]} />
                    </Field>
                    <Field label="Per Hour Costing Parameter">
                      <Sel value={form.perHourCostingParam} onChange={(v) => f("perHourCostingParam", v)} options={["Speed Based", "Output Based"]} />
                    </Field>
                  </div>
                </div>

                <div>
                  <SectionTitle title="Wastage" />
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Field label="Wastage Type">
                      <Sel value={form.wasteType} onChange={(v) => f("wasteType", v)} options={["Percentage", "Flat Meter", "Fixed Weight"]} placeholder="Select..." />
                    </Field>
                    <Field label="Wastage Calculation On">
                      <Sel value={form.wasteCalcOn} onChange={(v) => f("wasteCalcOn", v)} options={["Input", "Output", "Both"]} placeholder="Select..." />
                    </Field>
                    <Field label="Ref Machine Code">
                      <input type="text" value={form.refMachineCode} onChange={(e) => f("refMachineCode", e.target.value)} placeholder="Reference machine" className={inputCls} />
                    </Field>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-6 border-t border-gray-200">
                  <button onClick={() => setForm(blank)} className="px-6 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">Clear</button>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setActiveTab("specs")} className="px-6 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">← Specs</button>
                    <button onClick={save} className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
                      <Check size={16} /> Save Machine
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
  const filteredData = filterDept === "All" ? data : data.filter((r) => r.department === filterDept);

  const statusColor: Record<string, string> = {
    Running: "bg-green-100 text-green-700",
    Idle: "bg-gray-100 text-gray-500",
    Maintenance: "bg-amber-100 text-amber-700",
  };

  const columns: Column<Machine>[] = [
    { key: "code", header: "Code", sortable: true },
    { key: "name", header: "Machine Name", sortable: true },
    { key: "department", header: "Department", sortable: true, render: (r) => (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${deptColor[r.department] ?? "bg-gray-100 text-gray-600"}`}>{r.department}</span>
    )},
    { key: "machineType", header: "Type" },
    { key: "maxWebWidth", header: "Max Width", render: (r) => r.maxWebWidth ? `${r.maxWebWidth} mm` : "—" },
    { key: "noOfColors", header: "Colors", render: (r) => r.noOfColors || "—" },
    { key: "costPerHour", header: "Cost/Hr", render: (r) => r.costPerHour ? `₹ ${r.costPerHour}` : "—" },
    { key: "operator", header: "Operator" },
    { key: "status", header: "Status", sortable: true, render: (r) => (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusColor[r.status]}`}>{r.status}</span>
    )},
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Machine Master</h2>
          <p className="text-sm text-gray-500">{filteredData.length} of {data.length} machines</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
          <Plus size={16} /> Add Machine
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mr-1">Dept</span>
          {["All", ...DEPARTMENTS].map((d) => (
            <button key={d} onClick={() => setFilterDept(d)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterDept === d ? "bg-blue-600 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {d === "All" ? "All" : d}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <DataTable data={filteredData} columns={columns} searchKeys={["name", "code", "department", "machineType", "operator"]}
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
