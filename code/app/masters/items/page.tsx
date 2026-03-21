"use client";
import { useState } from "react";
import { Plus, Pencil, Trash2, ArrowLeft, Save, List, Check } from "lucide-react";
import { items as initData, Item, hsnMasters, units, subGroups, CATEGORY_GROUP_SUBGROUP } from "@/data/dummyData";
import { DataTable, Column } from "@/components/tables/DataTable";
import Button from "@/components/ui/Button";

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

const SuffixInput = ({ value, onChange, placeholder, suffix, type = "text" }: any) => (
  <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden bg-white focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all">
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="flex-1 w-full px-4 py-2 text-sm text-gray-800 outline-none"
    />
    <div className="bg-gray-50 px-4 py-2 text-sm text-gray-500 border-l border-gray-300 font-medium">
      {suffix}
    </div>
  </div>
);

const PrefixInput = ({ value, onChange, placeholder, prefix, type = "text" }: any) => (
  <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden bg-white focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all">
    <div className="bg-gray-50 px-4 py-2 text-sm text-gray-500 border-r border-gray-300 font-medium">
      {prefix}
    </div>
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="flex-1 w-full px-4 py-2 text-sm text-gray-800 outline-none"
    />
  </div>
);

const SelectField = ({ value, onChange, options }: any) => (
  <select
    value={value}
    onChange={onChange}
    className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
  >
    <option value="">Select...</option>
    {options.map((o: any) => (
      <option key={o.value} value={o.value}>{o.label}</option>
    ))}
  </select>
);

const Checkbox = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) => (
  <label className="flex items-center gap-2.5 cursor-pointer select-none">
    <div
      onClick={onChange}
      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${checked ? "bg-blue-600 border-blue-600" : "border-gray-300 bg-white"}`}
    >
      {checked && <Check size={12} className="text-white" strokeWidth={3} />}
    </div>
    <span className="text-sm font-medium text-gray-700">{label}</span>
  </label>
);

const blank: Omit<Item, "id"> = {
  category: "Raw Material (RM)",
  group: "Film",
  subGroup: "PET Film (Plain / Treated)",
  code: "",
  name: "",
  hsnCode: "",
  gstRate: "18%",
  stockUom: "Kg",
  active: true,
  // Procurement
  supplier: "",
  supplierRef: "",
  purchaseUnit: "Kg",
  estimationUnit: "Kg",
  // Stock Management
  reOrderQty: "",
  minStockQty: "",
  shelfLife: "",
  leadTime: "",
  stockType: "Moving",
  isStandardItem: false,
  isRegularItem: false,
  stockRefCode: "",
  refItemCode: "",
  tallyCode: "",
  // Specifications
  substrate: "BOPP",
  webWidth: "",
  thickness: "",
  density: "",
  shrinkage: "0",
  purchaseRate: "0.00",
  estimationRate: "0.00",
  colour: "",
  pantoneNo: "",
  remarks: ""
};

export default function ItemMasterPage() {
  const [view, setView] = useState<"list" | "form">("list");
  const [data, setData] = useState<Item[]>(initData);
  const [editing, setEditing] = useState<Item | null>(null);
  const [form, setForm] = useState<Omit<Item, "id">>(blank);
  const [activeTab, setActiveTab] = useState<"basic" | "specs">("basic");
  const [filterCategory, setFilterCategory] = useState<string>("All");
  const [filterGroup, setFilterGroup] = useState<string>("All");

  const openAdd = () => {
    setEditing(null);
    setForm(blank);
    setActiveTab("basic");
    setView("form");
  };

  const openEdit = (row: Item) => {
    setEditing(row);
    setForm({ ...row });
    setActiveTab("basic");
    setView("form");
  };

  const save = () => {
    if (!form.code || !form.name) return;
    if (editing) {
      setData((d) => d.map((r) => r.id === editing.id ? { ...form, id: editing.id } : r));
    } else {
      const id = `ITM${String(data.length + 1).padStart(3, "0")}`;
      setData((d) => [...d, { ...form, id }]);
    }
    setView("list");
  };

  const deleteRow = (id: string) => {
    if (confirm("Are you sure you want to delete this item?")) {
      setData((d) => d.filter(r => r.id !== id));
    }
  };

  const f = (k: keyof typeof form, v: any) => setForm((p) => ({ ...p, [k]: v }));

  const onCategoryChange = (cat: string) => {
    const groups = Object.keys(CATEGORY_GROUP_SUBGROUP[cat] ?? {});
    const firstGroup = groups[0] ?? "";
    const firstSub = (CATEGORY_GROUP_SUBGROUP[cat]?.[firstGroup] ?? [])[0] ?? "";
    setForm((p) => ({ ...p, category: cat, group: firstGroup, subGroup: firstSub }));
  };

  const onGroupChange = (grp: string) => {
    const firstSub = (CATEGORY_GROUP_SUBGROUP[form.category]?.[grp] ?? [])[0] ?? "";
    setForm((p) => ({ ...p, group: grp, subGroup: firstSub }));
  };

  const groupOptions = Object.keys(CATEGORY_GROUP_SUBGROUP[form.category] ?? {});
  const subGroupOptions = CATEGORY_GROUP_SUBGROUP[form.category]?.[form.group] ?? [];

  // Specs tab visibility rules
  const isRM = form.category === "Raw Material (RM)";
  const isFG = form.category === "Finished Goods (FG)";
  const isFilmGroup = isRM && form.group === "Film";
  const isInkGroup = isRM && form.group === "Ink";
  const isFGWithDimensions = isFG && ["Printed Roll", "Laminated Roll", "Shrink Film", "Shrink Sleeve", "Wrap Around Label", "Pouch"].includes(form.group);
  const showDimensions = isFilmGroup || isFGWithDimensions;
  const showSubstrate = isFilmGroup;
  const showShrinkage = isFilmGroup || (isFG && ["Shrink Film", "Shrink Sleeve"].includes(form.group));
  const showFilmSection = showDimensions || showSubstrate || isFilmGroup;
  const showPurchaseRate = !isFG;
  const showInkFields = isInkGroup;

  const columns: Column<Item>[] = [
    { key: "code", header: "Item Code", sortable: true },
    { key: "name", header: "Item Name", sortable: true },
    { key: "category", header: "Category", sortable: true },
    { key: "hsnCode", header: "HSN Code" },
    { key: "stockUom", header: "UOM" },
    {
      key: "active", header: "Status", render: (r) => (
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${r.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}>
          {r.active ? "Active" : "Inactive"}
        </span>
      )
    },
  ];

  if (view === "form") {
    return (
      <div className="max-w-5xl mx-auto pb-10">
        {/* Header Ribbon */}
        <div className="flex items-center justify-between mb-6 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div>
            <p className="text-xs text-gray-400 font-medium tracking-wide uppercase">AJ Shrink Wrap Pvt Ltd</p>
            <h2 className="text-xl font-bold text-gray-800">Item Master</h2>
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

        {/* Main Content Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          
          {/* Badge & Tabs Header */}
          <div className="px-6 pt-5 border-b border-gray-200 bg-gray-50/30">
            {form.code && (
              <span className="inline-block px-3 py-1 mb-4 text-xs font-semibold text-blue-600 bg-blue-100 border border-blue-200 rounded-full">
                {form.code}
              </span>
            )}
            <div className="flex gap-8">
              <button
                onClick={() => setActiveTab("basic")}
                className={`pb-3 text-sm font-medium transition-colors border-b-2 ${activeTab === "basic" ? "text-blue-600 border-blue-600" : "text-gray-500 border-transparent hover:text-gray-700"}`}
              >
                Basic Details
              </button>
              <button
                onClick={() => setActiveTab("specs")}
                className={`pb-3 text-sm font-medium transition-colors border-b-2 ${activeTab === "specs" ? "text-blue-600 border-blue-600" : "text-gray-500 border-transparent hover:text-gray-700"}`}
              >
                Specifications
              </button>
            </div>
          </div>

          <div className="p-8">
            {/* --- BASIC DETAILS TAB --- */}
            {activeTab === "basic" && (
              <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-300">
                {/* Section 1 */}
                <div>
                  <SectionTitle title="Classification" />
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Field label="Item Category" required>
                      <SelectField value={form.category} onChange={(e: any) => onCategoryChange(e.target.value)} options={[
                        { value: "Raw Material (RM)", label: "Raw Material (RM)" },
                        { value: "Finished Goods (FG)", label: "Finished Goods (FG)" },
                        { value: "Consumables", label: "Consumables" }
                      ]} />
                    </Field>
                    <Field label="Item Group" required>
                      <SelectField value={form.group} onChange={(e: any) => onGroupChange(e.target.value)} options={
                        groupOptions.map(g => ({ value: g, label: g }))
                      } />
                    </Field>
                    <Field label="Item Sub Group" required>
                      <SelectField value={form.subGroup} onChange={(e: any) => f("subGroup", e.target.value)} options={
                        subGroupOptions.map(s => ({ value: s, label: s }))
                      } />
                    </Field>
                  </div>
                </div>

                {/* Section 2 */}
                <div>
                  <SectionTitle title="Item Identity" />
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Field label="Item Code" required>
                      <input type="text" value={form.code} onChange={e => f("code", e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
                    </Field>
                    <div className="md:col-span-2">
                      <Field label="Item Name" required>
                        <input type="text" value={form.name} onChange={e => f("name", e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
                      </Field>
                    </div>
                  </div>
                </div>

                {/* Section 3 */}
                <div>
                  <SectionTitle title="Tax & UOM" />
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Field label="HSN Code" required>
                      <SelectField value={form.hsnCode} onChange={(e: any) => f("hsnCode", e.target.value)} options={
                        hsnMasters.map(h => ({ value: h.hsnCode, label: h.hsnCode }))
                      } />
                    </Field>
                    <Field label="GST Rate" required>
                      <SelectField value={form.gstRate} onChange={(e: any) => f("gstRate", e.target.value)} options={[
                        { value: "0%", label: "0%" }, { value: "5%", label: "5%" }, { value: "12%", label: "12%" }, { value: "18%", label: "18%" }, { value: "28%", label: "28%" }
                      ]} />
                    </Field>
                    <Field label="Stock UOM" required>
                      <SelectField value={form.stockUom} onChange={(e: any) => f("stockUom", e.target.value)} options={
                        units.map(u => ({ value: u.name, label: u.name }))
                      } />
                    </Field>
                  </div>
                </div>

                {/* Section 4 – Procurement */}
                <div>
                  <SectionTitle title="Procurement" />
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Field label="Supplier">
                      <input type="text" value={form.supplier} onChange={e => f("supplier", e.target.value)} placeholder="Supplier name" className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
                    </Field>
                    <Field label="Supplier Reference">
                      <input type="text" value={form.supplierRef} onChange={e => f("supplierRef", e.target.value)} placeholder="Supplier part/ref code" className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
                    </Field>
                    <Field label="Purchase Unit">
                      <SelectField value={form.purchaseUnit} onChange={(e: any) => f("purchaseUnit", e.target.value)} options={
                        units.map(u => ({ value: u.name, label: u.name }))
                      } />
                    </Field>
                    <Field label="Estimation Unit">
                      <SelectField value={form.estimationUnit} onChange={(e: any) => f("estimationUnit", e.target.value)} options={
                        units.map(u => ({ value: u.name, label: u.name }))
                      } />
                    </Field>
                    <Field label="Lead Time (Days)">
                      <SuffixInput value={form.leadTime} onChange={(e: any) => f("leadTime", e.target.value)} placeholder="0" suffix="Days" type="number" />
                    </Field>
                    {!isFG && (
                      <Field label="Shelf Life (Days)">
                        <SuffixInput value={form.shelfLife} onChange={(e: any) => f("shelfLife", e.target.value)} placeholder="0" suffix="Days" type="number" />
                      </Field>
                    )}
                  </div>
                </div>

                {/* Section 5 – Stock Management */}
                <div>
                  <SectionTitle title="Stock Management" />
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-5">
                    <Field label="Stock Type">
                      <SelectField value={form.stockType} onChange={(e: any) => f("stockType", e.target.value)} options={[
                        { value: "Moving", label: "Moving" },
                        { value: "Slow Moving", label: "Slow Moving" },
                        { value: "Non-Moving", label: "Non-Moving" },
                        { value: "Dead Stock", label: "Dead Stock" },
                      ]} />
                    </Field>
                    <Field label="Re-Order Qty">
                      <SuffixInput value={form.reOrderQty} onChange={(e: any) => f("reOrderQty", e.target.value)} placeholder="0" suffix={form.stockUom} type="number" />
                    </Field>
                    <Field label="Min Stock Qty">
                      <SuffixInput value={form.minStockQty} onChange={(e: any) => f("minStockQty", e.target.value)} placeholder="0" suffix={form.stockUom} type="number" />
                    </Field>
                    <Field label="Stock Ref Code">
                      <input type="text" value={form.stockRefCode} onChange={e => f("stockRefCode", e.target.value)} placeholder="Internal ref code" className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
                    </Field>
                    <Field label="Ref Item Code">
                      <input type="text" value={form.refItemCode} onChange={e => f("refItemCode", e.target.value)} placeholder="Cross-reference code" className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
                    </Field>
                    <Field label="Tally Code">
                      <input type="text" value={form.tallyCode} onChange={e => f("tallyCode", e.target.value)} placeholder="Tally item code" className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
                    </Field>
                  </div>
                  <div className="flex items-center gap-8">
                    <Checkbox label="Standard Item" checked={form.isStandardItem} onChange={() => f("isStandardItem", !form.isStandardItem)} />
                    <Checkbox label="Regular Item" checked={form.isRegularItem} onChange={() => f("isRegularItem", !form.isRegularItem)} />
                  </div>
                </div>

                {/* Toggle */}
                <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                  <button
                    onClick={() => f("active", !form.active)}
                    className={`w-12 h-6 rounded-full transition-colors relative ${form.active ? "bg-blue-500" : "bg-gray-300"}`}
                  >
                    <div className={`absolute top-1 max-w-4 h-4 rounded-full bg-white transition-all ${form.active ? "left-7 w-4" : "left-1 w-4"}`} />
                  </button>
                  <span className="text-sm font-medium text-gray-700">Active Item</span>
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-between pt-6 border-t border-gray-200">
                  <button onClick={() => setForm(blank)} className="px-6 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                    Clear
                  </button>
                  <button onClick={() => setActiveTab("specs")} className="px-6 py-2.5 text-sm font-medium text-white bg-slate-800 rounded-lg hover:bg-slate-900 transition-colors shadow-sm">
                    Specs →
                  </button>
                </div>
              </div>
            )}

            {/* --- SPECS TAB --- */}
            {activeTab === "specs" && (
              <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-300">
                {/* Section 1 – Film / Roll Dimensions (only for Film RM or FG rolls) */}
                {showFilmSection && (
                  <div>
                    <SectionTitle title={isFG ? "Product Parameters" : "Film Parameters"} />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {showSubstrate && (
                        <Field label="Substrate / Base Material">
                          <SelectField value={form.substrate} onChange={(e: any) => f("substrate", e.target.value)} options={[
                            { value: "BOPP", label: "BOPP" }, { value: "PET", label: "PET" }, { value: "PE", label: "PE" },
                            { value: "CPP", label: "CPP" }, { value: "PVC", label: "PVC" }, { value: "OPS", label: "OPS" },
                          ]} />
                        </Field>
                      )}
                      {showDimensions && (
                        <>
                          <Field label="Web Width">
                            <SuffixInput value={form.webWidth} onChange={(e: any) => f("webWidth", e.target.value)} placeholder="e.g. 330" suffix="mm" type="number" />
                          </Field>
                          <Field label="Thickness / Gauge">
                            <SuffixInput value={form.thickness} onChange={(e: any) => f("thickness", e.target.value)} placeholder="e.g. 50" suffix="μ" type="number" />
                          </Field>
                        </>
                      )}
                      {isFilmGroup && (
                        <Field label="Density">
                          <SuffixInput value={form.density} onChange={(e: any) => f("density", e.target.value)} placeholder="e.g. 0.91" suffix="g/cc" type="number" />
                        </Field>
                      )}
                    </div>
                  </div>
                )}

                {/* Ink-specific fields */}
                {showInkFields && (
                  <div>
                    <SectionTitle title="Ink Properties" />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <Field label="Colour">
                        <input type="text" value={form.colour} onChange={e => f("colour", e.target.value)} placeholder="e.g. Yellow, Cyan, Magenta" className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
                      </Field>
                      <Field label="Pantone No.">
                        <input type="text" value={form.pantoneNo} onChange={e => f("pantoneNo", e.target.value)} placeholder="e.g. Pantone 485 C" className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
                      </Field>
                    </div>
                  </div>
                )}

                {/* Section 2 – Shrinkage (only for shrink products) */}
                {showShrinkage && (
                  <div>
                    <SectionTitle title="Shrink Parameters" />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <Field label="Shrinkage % (TD)">
                        <SuffixInput value={form.shrinkage} onChange={(e: any) => f("shrinkage", e.target.value)} placeholder="0" suffix="%" type="number" />
                      </Field>
                    </div>
                  </div>
                )}

                {/* Section 3 – Rates & Remarks */}
                <div>
                  <SectionTitle title="Rates & Remarks" />
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    {showPurchaseRate && (
                      <Field label="Purchase Rate (₹)">
                        <PrefixInput value={form.purchaseRate} onChange={(e: any) => f("purchaseRate", e.target.value)} placeholder="0.00" prefix="₹" type="number" />
                      </Field>
                    )}
                    <Field label={isFG ? "Selling Rate (₹)" : "Estimation Rate (₹)"}>
                      <PrefixInput value={form.estimationRate} onChange={(e: any) => f("estimationRate", e.target.value)} placeholder="0.00" prefix="₹" type="number" />
                    </Field>
                  </div>
                  <Field label="Remarks / Description">
                    <textarea
                      value={form.remarks}
                      onChange={(e) => f("remarks", e.target.value)}
                      placeholder="Any additional notes..."
                      rows={3}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                    />
                  </Field>
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-between pt-6 border-t border-gray-200">
                  <button onClick={() => setForm(blank)} className="px-6 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                    Clear
                  </button>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setActiveTab("basic")} className="px-6 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                      ← Basic
                    </button>
                    <button onClick={save} className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
                      <Check size={16} /> Save Item
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

  // --- List View ---
  const categories = ["All", "Raw Material (RM)", "Consumables", "Finished Goods (FG)"];
  const groupsForFilter = filterCategory === "All"
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

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Item Master</h2>
          <p className="text-sm text-gray-500">{filteredData.length} of {data.length} items</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
          <Plus size={16} /> Add Item
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4 space-y-3">
        {/* Category Tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mr-1">Category</span>
          {categories.map(cat => (
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

        {/* Group Pills – only when a category is selected */}
        {filterCategory !== "All" && (
          <div className="flex items-center gap-2 flex-wrap border-t border-gray-100 pt-3">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mr-1">Group</span>
            {groupsForFilter.map(grp => (
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
          searchKeys={["name", "code", "category", "hsnCode"]}
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