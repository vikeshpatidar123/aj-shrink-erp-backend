"use client";
import { useState } from "react";
import { Plus, Pencil, Trash2, Save, Check, List, User, Building2 } from "lucide-react";
import { ledgers as initData, Ledger, LedgerType } from "@/data/dummyData";
import { DataTable, Column } from "@/components/tables/DataTable";
import Button from "@/components/ui/Button";

const LEDGER_TYPES: LedgerType[] = ["Employee", "Client", "Supplier", "Consignee", "Transporter", "Vendor", "Sales A/C"];

const blankLedger: Omit<Ledger, "id" | "code"> = {
  ledgerType: "Client",
  name: "", status: "Active",
  contactPerson: "", phone: "", email: "",
  address: "", city: "", state: "", pincode: "",
  department: "", designation: "", shift: "", dateOfJoining: "",
  gst: "", pan: "", creditLimit: "", paymentTerms: "",
  bankAccount: "", ifsc: "", bankName: "",
  hsn: "", taxRate: "", description: "",
};

// ─── Sub-components ─────────────────────────────────────────

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

const inputCls = "w-full px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white";

const Sel = ({ value, onChange, options, placeholder = "Select..." }: {
  value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; placeholder?: string;
}) => (
  <select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}>
    <option value="">{placeholder}</option>
    {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
  </select>
);

const typeBadge = (type: LedgerType) => {
  const colors: Record<LedgerType, string> = {
    Employee: "bg-blue-100 text-blue-700",
    Client: "bg-emerald-100 text-emerald-700",
    Supplier: "bg-amber-100 text-amber-700",
    Consignee: "bg-purple-100 text-purple-700",
    Transporter: "bg-cyan-100 text-cyan-700",
    Vendor: "bg-orange-100 text-orange-700",
    "Sales A/C": "bg-rose-100 text-rose-700",
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors[type]}`}>{type}</span>;
};

// ─── Page ───────────────────────────────────────────────────

export default function LedgerMasterPage() {
  const [view, setView] = useState<"list" | "form">("list");
  const [data, setData] = useState<Ledger[]>(initData);
  const [editing, setEditing] = useState<Ledger | null>(null);
  const [form, setForm] = useState<Omit<Ledger, "id" | "code">>(blankLedger);
  const [activeTab, setActiveTab] = useState<"basic" | "specs">("basic");
  const [filterType, setFilterType] = useState<"All" | LedgerType>("All");

  const f = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const openAdd = () => {
    setEditing(null);
    setForm(blankLedger);
    setActiveTab("basic");
    setView("form");
  };

  const openEdit = (row: Ledger) => {
    setEditing(row);
    const { id, code, ...rest } = row;
    setForm(rest);
    setActiveTab("basic");
    setView("form");
  };

  const save = () => {
    if (!form.name) return;
    if (editing) {
      setData((d) => d.map((r) => r.id === editing.id ? { ...form, id: editing.id, code: editing.code } : r));
    } else {
      const n = data.length + 1;
      setData((d) => [...d, { ...form, id: `L${String(n).padStart(3, "0")}`, code: `LED${String(n).padStart(3, "0")}` }]);
    }
    setView("list");
  };

  const deleteRow = (id: string) => {
    if (confirm("Delete this ledger?")) setData((d) => d.filter((r) => r.id !== id));
  };

  const isEmployee = form.ledgerType === "Employee";
  const isSalesAC = form.ledgerType === "Sales A/C";
  const isCompany = !isEmployee && !isSalesAC;

  // ── FORM VIEW ──────────────────────────────────────────────
  if (view === "form") {
    return (
      <div className="max-w-5xl mx-auto pb-10">
        {/* Header Ribbon */}
        <div className="flex items-center justify-between mb-6 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div>
            <p className="text-xs text-gray-400 font-medium tracking-wide uppercase">AJ Shrink Wrap Pvt Ltd</p>
            <h2 className="text-xl font-bold text-gray-800">Ledger Master</h2>
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

        {/* Main Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">

          {/* Ledger Type Selector + Tabs */}
          <div className="px-6 pt-5 pb-0 border-b border-gray-200 bg-gray-50/30">
            {/* Type pills */}
            <div className="flex flex-wrap gap-2 mb-5">
              {LEDGER_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => f("ledgerType", t)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    form.ledgerType === t
                      ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                      : "bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600"
                  }`}
                >
                  {t === "Employee" ? <User size={12} /> : <Building2 size={12} />}
                  {t}
                </button>
              ))}
            </div>

            {/* Tabs */}
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

            {/* ── BASIC DETAILS TAB ── */}
            {activeTab === "basic" && (
              <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-300">

                {/* Section 1: Identity */}
                <div>
                  <SectionTitle title={isEmployee ? "Personal Details" : isSalesAC ? "Account Details" : "Party Details"} />
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2">
                      <Field label={isEmployee ? "Employee Name" : isSalesAC ? "Account Name" : "Company / Party Name"} required>
                        <input
                          type="text"
                          value={form.name}
                          onChange={(e) => f("name", e.target.value)}
                          placeholder={isEmployee ? "e.g. Rajesh Kumar" : isSalesAC ? "e.g. Domestic Sales – Shrink Film" : "e.g. Parle Products Pvt Ltd"}
                          className={inputCls}
                        />
                      </Field>
                    </div>

                    <Field label="Status">
                      <Sel value={form.status} onChange={(v) => f("status", v)} options={[
                        { value: "Active", label: "Active" },
                        { value: "Inactive", label: "Inactive" },
                      ]} />
                    </Field>
                  </div>
                </div>

                {/* Section 2: Employee-specific */}
                {isEmployee && (
                  <div>
                    <SectionTitle title="Employment Info" />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <Field label="Department">
                        <Sel value={form.department} onChange={(v) => f("department", v)} options={
                          ["Extrusion","Rotogravure","Quality","Dispatch","Stores","Maintenance","Admin"].map(d => ({ value: d, label: d }))
                        } />
                      </Field>
                      <Field label="Designation">
                        <input type="text" value={form.designation} onChange={(e) => f("designation", e.target.value)} placeholder="e.g. Machine Operator" className={inputCls} />
                      </Field>
                      <Field label="Shift">
                        <Sel value={form.shift} onChange={(v) => f("shift", v)} options={[
                          { value: "A", label: "Shift A" }, { value: "B", label: "Shift B" },
                          { value: "C", label: "Shift C" }, { value: "General", label: "General" },
                        ]} />
                      </Field>
                      <Field label="Date of Joining">
                        <input type="date" value={form.dateOfJoining} onChange={(e) => f("dateOfJoining", e.target.value)} className={inputCls} />
                      </Field>
                      <Field label="Phone">
                        <input type="text" value={form.phone} onChange={(e) => f("phone", e.target.value)} placeholder="10-digit mobile" className={inputCls} />
                      </Field>
                      <Field label="Email">
                        <input type="email" value={form.email} onChange={(e) => f("email", e.target.value)} placeholder="email@company.com" className={inputCls} />
                      </Field>
                    </div>
                  </div>
                )}

                {/* Section 2: Company / Party contact */}
                {isCompany && (
                  <div>
                    <SectionTitle title="Contact Details" />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <Field label="Contact Person">
                        <input type="text" value={form.contactPerson} onChange={(e) => f("contactPerson", e.target.value)} placeholder="e.g. Vivek Mehta" className={inputCls} />
                      </Field>
                      <Field label="Phone">
                        <input type="text" value={form.phone} onChange={(e) => f("phone", e.target.value)} placeholder="10-digit mobile" className={inputCls} />
                      </Field>
                      <Field label="Email">
                        <input type="email" value={form.email} onChange={(e) => f("email", e.target.value)} placeholder="email@company.com" className={inputCls} />
                      </Field>
                    </div>
                  </div>
                )}

                {/* Section 3: Address (company types) */}
                {isCompany && (
                  <div>
                    <SectionTitle title="Address" />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <Field label="City">
                        <input type="text" value={form.city} onChange={(e) => f("city", e.target.value)} placeholder="e.g. Mumbai" className={inputCls} />
                      </Field>
                      <Field label="State">
                        <input type="text" value={form.state} onChange={(e) => f("state", e.target.value)} placeholder="e.g. Maharashtra" className={inputCls} />
                      </Field>
                      {form.ledgerType === "Consignee" && (
                        <Field label="Pincode">
                          <input type="text" value={form.pincode} onChange={(e) => f("pincode", e.target.value)} placeholder="e.g. 400001" className={inputCls} />
                        </Field>
                      )}
                      <div className="md:col-span-3">
                        <Field label={form.ledgerType === "Consignee" ? "Delivery Address" : "Address"}>
                          <textarea value={form.address} onChange={(e) => f("address", e.target.value)} placeholder="Full address..." rows={2} className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none" />
                        </Field>
                      </div>
                    </div>
                  </div>
                )}

                {/* Section: Sales A/C */}
                {isSalesAC && (
                  <div>
                    <SectionTitle title="Account Details" />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <Field label="HSN Code">
                        <input type="text" value={form.hsn} onChange={(e) => f("hsn", e.target.value)} placeholder="e.g. 39201019" className={inputCls} />
                      </Field>
                      <Field label="GST Rate (%)">
                        <Sel value={form.taxRate} onChange={(v) => f("taxRate", v)} options={["0","5","12","18","28"].map(r => ({ value: r, label: `${r}%` }))} placeholder="Select GST %" />
                      </Field>
                      <div className="md:col-span-3">
                        <Field label="Description">
                          <textarea value={form.description} onChange={(e) => f("description", e.target.value)} placeholder="Account description..." rows={2} className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none" />
                        </Field>
                      </div>
                    </div>
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-6 border-t border-gray-200">
                  <button onClick={() => setForm({ ...blankLedger, ledgerType: form.ledgerType })} className="px-6 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                    Clear
                  </button>
                  {!isSalesAC && (
                    <button onClick={() => setActiveTab("specs")} className="px-6 py-2.5 text-sm font-medium text-white bg-slate-800 rounded-lg hover:bg-slate-900 transition-colors shadow-sm">
                      Specs →
                    </button>
                  )}
                  {isSalesAC && (
                    <button onClick={save} className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
                      <Check size={16} /> Save Ledger
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ── SPECIFICATIONS TAB ── */}
            {activeTab === "specs" && (
              <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-300">

                {/* Employee Specs */}
                {isEmployee && (
                  <div>
                    <SectionTitle title="Bank & Tax Details" />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <Field label="PAN Number">
                        <input type="text" value={form.pan} onChange={(e) => f("pan", e.target.value)} placeholder="e.g. ABCDE1234F" className={inputCls} />
                      </Field>
                      <Field label="Bank Name">
                        <input type="text" value={form.bankName} onChange={(e) => f("bankName", e.target.value)} placeholder="e.g. SBI" className={inputCls} />
                      </Field>
                      <Field label="Bank Account No">
                        <input type="text" value={form.bankAccount} onChange={(e) => f("bankAccount", e.target.value)} placeholder="Account number" className={inputCls} />
                      </Field>
                      <Field label="IFSC Code">
                        <input type="text" value={form.ifsc} onChange={(e) => f("ifsc", e.target.value)} placeholder="e.g. SBIN0001234" className={inputCls} />
                      </Field>
                    </div>
                  </div>
                )}

                {/* Client Specs */}
                {form.ledgerType === "Client" && (
                  <div>
                    <SectionTitle title="Tax & Payment Terms" />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <Field label="GST Number">
                        <input type="text" value={form.gst} onChange={(e) => f("gst", e.target.value)} placeholder="15-character GSTIN" className={inputCls} />
                      </Field>
                      <Field label="PAN Number">
                        <input type="text" value={form.pan} onChange={(e) => f("pan", e.target.value)} placeholder="e.g. ABCDE1234F" className={inputCls} />
                      </Field>
                      <Field label="Credit Limit (₹)">
                        <input type="number" value={form.creditLimit} onChange={(e) => f("creditLimit", e.target.value)} placeholder="e.g. 500000" className={inputCls} />
                      </Field>
                      <Field label="Payment Terms">
                        <Sel value={form.paymentTerms} onChange={(v) => f("paymentTerms", v)} options={["Advance","7 Days","15 Days","30 Days","45 Days","60 Days","90 Days"].map(t => ({ value: t, label: t }))} />
                      </Field>
                    </div>
                  </div>
                )}

                {/* Supplier Specs */}
                {form.ledgerType === "Supplier" && (
                  <>
                    <div>
                      <SectionTitle title="Tax Details" />
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Field label="GST Number">
                          <input type="text" value={form.gst} onChange={(e) => f("gst", e.target.value)} placeholder="15-character GSTIN" className={inputCls} />
                        </Field>
                        <Field label="PAN Number">
                          <input type="text" value={form.pan} onChange={(e) => f("pan", e.target.value)} placeholder="e.g. ABCDE1234F" className={inputCls} />
                        </Field>
                        <Field label="Payment Terms">
                          <Sel value={form.paymentTerms} onChange={(v) => f("paymentTerms", v)} options={["Advance","7 Days","15 Days","30 Days","45 Days","60 Days","90 Days"].map(t => ({ value: t, label: t }))} />
                        </Field>
                      </div>
                    </div>
                    <div>
                      <SectionTitle title="Bank Details" />
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Field label="Bank Name">
                          <input type="text" value={form.bankName} onChange={(e) => f("bankName", e.target.value)} placeholder="e.g. HDFC Bank" className={inputCls} />
                        </Field>
                        <Field label="Bank Account No">
                          <input type="text" value={form.bankAccount} onChange={(e) => f("bankAccount", e.target.value)} placeholder="Account number" className={inputCls} />
                        </Field>
                        <Field label="IFSC Code">
                          <input type="text" value={form.ifsc} onChange={(e) => f("ifsc", e.target.value)} placeholder="e.g. HDFC0001234" className={inputCls} />
                        </Field>
                      </div>
                    </div>
                  </>
                )}

                {/* Consignee Specs */}
                {form.ledgerType === "Consignee" && (
                  <div>
                    <SectionTitle title="Tax Details" />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <Field label="GST Number">
                        <input type="text" value={form.gst} onChange={(e) => f("gst", e.target.value)} placeholder="15-character GSTIN" className={inputCls} />
                      </Field>
                    </div>
                  </div>
                )}

                {/* Transporter Specs */}
                {form.ledgerType === "Transporter" && (
                  <div>
                    <SectionTitle title="Tax & Info" />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <Field label="GST Number">
                        <input type="text" value={form.gst} onChange={(e) => f("gst", e.target.value)} placeholder="15-character GSTIN" className={inputCls} />
                      </Field>
                      <Field label="PAN Number">
                        <input type="text" value={form.pan} onChange={(e) => f("pan", e.target.value)} placeholder="e.g. ABCDE1234F" className={inputCls} />
                      </Field>
                      <div className="md:col-span-3">
                        <Field label="Vehicle Types / Service Area">
                          <textarea value={form.description} onChange={(e) => f("description", e.target.value)} placeholder="e.g. Full Truck Load, Mini Truck – covers Rajasthan, Gujarat, Maharashtra" rows={2} className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none" />
                        </Field>
                      </div>
                    </div>
                  </div>
                )}

                {/* Vendor Specs */}
                {form.ledgerType === "Vendor" && (
                  <div>
                    <SectionTitle title="Tax & Payment" />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <Field label="GST Number">
                        <input type="text" value={form.gst} onChange={(e) => f("gst", e.target.value)} placeholder="15-character GSTIN" className={inputCls} />
                      </Field>
                      <Field label="PAN Number">
                        <input type="text" value={form.pan} onChange={(e) => f("pan", e.target.value)} placeholder="e.g. ABCDE1234F" className={inputCls} />
                      </Field>
                      <Field label="Payment Terms">
                        <Sel value={form.paymentTerms} onChange={(v) => f("paymentTerms", v)} options={["Advance","7 Days","15 Days","30 Days","45 Days","60 Days"].map(t => ({ value: t, label: t }))} />
                      </Field>
                      <Field label="Bank Name">
                        <input type="text" value={form.bankName} onChange={(e) => f("bankName", e.target.value)} placeholder="e.g. Axis Bank" className={inputCls} />
                      </Field>
                      <Field label="Bank Account No">
                        <input type="text" value={form.bankAccount} onChange={(e) => f("bankAccount", e.target.value)} placeholder="Account number" className={inputCls} />
                      </Field>
                      <Field label="IFSC Code">
                        <input type="text" value={form.ifsc} onChange={(e) => f("ifsc", e.target.value)} placeholder="e.g. SBIN0001234" className={inputCls} />
                      </Field>
                    </div>
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-6 border-t border-gray-200">
                  <button onClick={() => setForm({ ...blankLedger, ledgerType: form.ledgerType })} className="px-6 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                    Clear
                  </button>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setActiveTab("basic")} className="px-6 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                      ← Basic
                    </button>
                    <button onClick={save} className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
                      <Check size={16} /> Save Ledger
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

  // ── LIST VIEW ──────────────────────────────────────────────
  const filteredData = filterType === "All" ? data : data.filter((r) => r.ledgerType === filterType);

  const columns: Column<Ledger>[] = [
    { key: "code", header: "Code", sortable: true },
    { key: "name", header: "Name", sortable: true },
    { key: "ledgerType", header: "Type", sortable: true, render: (r) => typeBadge(r.ledgerType) },
    { key: "contactPerson", header: "Contact Person" },
    { key: "phone", header: "Phone" },
    { key: "city", header: "City", sortable: true },
    {
      key: "status", header: "Status", sortable: true, render: (r) => (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${r.status === "Active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
          {r.status}
        </span>
      )
    },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Ledger Master</h2>
          <p className="text-sm text-gray-500">{filteredData.length} of {data.length} ledgers</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
          <Plus size={16} /> Add Ledger
        </button>
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mr-1">Type</span>
          {(["All", ...LEDGER_TYPES] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterType === t ? "bg-blue-600 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
            >
              {t === "All" ? "All Types" : t}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <DataTable
          data={filteredData}
          columns={columns}
          searchKeys={["name", "code", "contactPerson", "city", "gst"]}
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
