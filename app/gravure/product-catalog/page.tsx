"use client";
import { useState, useMemo } from "react";
import {
  Plus, Eye, Pencil, Trash2, BookMarked, Search,
  CheckCircle2, Copy, ArrowRight, Layers, Package, RefreshCw, Clock,
} from "lucide-react";
import {
  customers, machines, processMasters, gravureOrders,
  GravureProductCatalog, GravureEstimation, SecondaryLayer, GravureEstimationProcess,
  CATEGORY_GROUP_SUBGROUP,
} from "@/data/dummyData";
import { useProductCatalog } from "@/context/ProductCatalogContext";
import { useCategories }     from "@/context/CategoriesContext";
import { PlanViewer, PlanInput } from "@/components/gravure/PlanViewer";
import { DataTable, Column } from "@/components/tables/DataTable";
import { statusBadge }       from "@/components/ui/Badge";
import Button    from "@/components/ui/Button";
import Modal     from "@/components/ui/Modal";
import { Input, Select, Textarea } from "@/components/ui/Input";

// ─── Section header helper ─────────────────────────────────────
const SH = ({ label }: { label: string }) => (
  <p className="text-xs font-bold text-purple-700 uppercase tracking-widest mb-3 pb-2 border-b border-purple-100">{label}</p>
);

const ROTO_PROCESSES = processMasters.filter(p => p.module === "Rotogravure");
const PRINT_MACHINES = machines.filter(m => m.department === "Printing");

const blank: Omit<GravureProductCatalog, "id" | "catalogNo"> = {
  createdDate: new Date().toISOString().slice(0, 10),
  productName: "",
  customerId: "", customerName: "",
  categoryId: "", categoryName: "", content: "",
  jobWidth: 0, jobHeight: 0,
  actualWidth: 0, actualHeight: 0,
  noOfColors: 6,
  printType: "Surface Print",
  substrate: "",
  secondaryLayers: [],
  processes: [],
  machineId: "", machineName: "",
  cylinderCostPerColor: 3500,
  overheadPct: 12, profitPct: 15,
  perMeterRate: 0,
  standardQty: 0, standardUnit: "Meter",
  sourceEstimationId: "", sourceEstimationNo: "",
  status: "Active",
  remarks: "",
};

export default function ProductCatalogPage() {
  const { catalog, saveCatalogItem, deleteCatalogItem } = useProductCatalog();
  const { categories } = useCategories();

  const [catalogTab, setCatalogTab] = useState<"all" | "pending" | "processed">("all");
  const [modalOpen, setModal]    = useState(false);
  const [viewRow,   setViewRow]  = useState<GravureProductCatalog | null>(null);
  const [viewPlanRow, setViewPlanRow] = useState<GravureProductCatalog | null>(null);
  const [editing,   setEditing] = useState<GravureProductCatalog | null>(null);
  const [form,      setForm]    = useState<Omit<GravureProductCatalog, "id" | "catalogNo">>(blank);
  const [deleteId,  setDeleteId] = useState<string | null>(null);
  const [search,    setSearch]  = useState("");

  // ── Which catalog items have been used in orders ──────────
  const usedCatalogIds = useMemo(() => {
    const ids = new Set<string>();
    gravureOrders.forEach(o => {
      if (o.catalogId) ids.add(o.catalogId);
      o.orderLines?.forEach(l => { if (l.catalogId) ids.add(l.catalogId); });
    });
    return ids;
  }, []);

  const f = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm(p => ({ ...p, [k]: v }));

  const openAdd  = () => { setEditing(null); setForm(blank); setModal(true); };
  const openEdit = (row: GravureProductCatalog) => {
    setEditing(row);
    setForm({ ...row });
    setModal(true);
  };

  // ── Load from estimation ────────────────────────────────────
  const loadFromEstimation = (est: GravureEstimation) => {
    setForm(p => ({
      ...p,
      productName:    est.jobName,
      customerId:     est.customerId,
      customerName:   est.customerName,
      categoryId:     est.categoryId  || "",
      categoryName:   est.categoryName || "",
      content:        est.content     || "",
      jobWidth:       est.jobWidth,
      jobHeight:      est.jobHeight,
      actualWidth:    est.actualWidth,
      actualHeight:   est.actualHeight,
      noOfColors:     est.noOfColors,
      printType:      est.printType,
      substrate:      est.substrateName || est.secondaryLayers.map(l => l.itemSubGroup).filter(Boolean).join(" + "),
      secondaryLayers: est.secondaryLayers,
      processes:       est.processes,
      machineId:       est.machineId,
      machineName:     est.machineName,
      cylinderCostPerColor: est.cylinderCostPerColor,
      overheadPct:     est.overheadPct,
      profitPct:       est.profitPct,
      perMeterRate:    est.perMeterRate,
      standardQty:     est.quantity,
      standardUnit:    est.unit,
      sourceEstimationId:  est.id,
      sourceEstimationNo:  est.estimationNo,
    }));
  };

  // ── Save ────────────────────────────────────────────────────
  const save = () => {
    if (!form.productName || !form.customerId) {
      alert("Product Name and Customer are required."); return;
    }
    if (editing) {
      saveCatalogItem({ ...form, id: editing.id, catalogNo: editing.catalogNo });
    } else {
      const n = catalog.length + 1;
      const id = `GPC${String(n).padStart(3, "0")}`;
      const catalogNo = `GRV-CAT-${String(n).padStart(3, "0")}`;
      saveCatalogItem({ ...form, id, catalogNo });
    }
    setModal(false);
  };

  const tabFiltered = useMemo(() => {
    if (catalogTab === "pending")   return catalog.filter(c => !usedCatalogIds.has(c.id) && c.status === "Active");
    if (catalogTab === "processed") return catalog.filter(c => usedCatalogIds.has(c.id));
    return catalog;
  }, [catalog, catalogTab, usedCatalogIds]);

  const filtered = tabFiltered.filter(c =>
    c.productName.toLowerCase().includes(search.toLowerCase()) ||
    c.customerName.toLowerCase().includes(search.toLowerCase()) ||
    c.catalogNo.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total:     catalog.length,
    active:    catalog.filter(c => c.status === "Active").length,
    inactive:  catalog.filter(c => c.status === "Inactive").length,
    pending:   catalog.filter(c => !usedCatalogIds.has(c.id) && c.status === "Active").length,
    processed: catalog.filter(c => usedCatalogIds.has(c.id)).length,
  };

  const columns: Column<GravureProductCatalog>[] = [
    { key: "catalogNo",     header: "Catalog No",   sortable: true },
    { key: "productName",   header: "Product Name", sortable: true },
    { key: "customerName",  header: "Customer",     sortable: true },
    { key: "categoryName",  header: "Category",     render: r => <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full text-xs">{r.categoryName || "—"}</span> },
    { key: "substrate",     header: "Substrate",    render: r => <span className="text-xs text-gray-600">{r.substrate || "—"}</span> },
    { key: "noOfColors",    header: "Colors",       render: r => <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold">{r.noOfColors}C</span> },
    { key: "jobWidth",      header: "Size (W×H)",   render: r => <span className="text-xs font-mono">{r.jobWidth}×{r.jobHeight}</span> },
    { key: "perMeterRate",  header: "₹/Meter",      render: r => <span className="font-semibold">₹{r.perMeterRate.toFixed(2)}</span> },
    { key: "status",        header: "Status",       render: r => (
      <div className="flex items-center gap-1.5">
        {statusBadge(r.status)}
        {usedCatalogIds.has(r.id) && <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-xs font-semibold">Ordered</span>}
      </div>
    ), sortable: true },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <BookMarked size={18} className="text-purple-600" />
            <h2 className="text-lg font-semibold text-gray-800">Product Catalog</h2>
          </div>
          <p className="text-sm text-gray-500">{stats.total} products · {stats.active} active</p>
        </div>
        <Button icon={<Plus size={16} />} onClick={openAdd}>Add to Catalog</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Products",  val: stats.total,     cls: "bg-purple-50 text-purple-700 border-purple-200" },
          { label: "Active",          val: stats.active,    cls: "bg-green-50 text-green-700 border-green-200" },
          { label: "Pending (unused)",val: stats.pending,   cls: "bg-amber-50 text-amber-700 border-amber-200" },
          { label: "Processed (ordered)", val: stats.processed, cls: "bg-blue-50 text-blue-700 border-blue-200" },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border p-4 ${s.cls}`}>
            <p className="text-xs font-medium">{s.label}</p>
            <p className="text-2xl font-bold mt-1">{s.val}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-100 p-1 rounded-xl gap-1 w-fit">
        {([
          { key: "all",       label: "All Products",  count: stats.total },
          { key: "pending",   label: "Pending",       count: stats.pending },
          { key: "processed", label: "Processed",     count: stats.processed },
        ] as { key: "all" | "pending" | "processed"; label: string; count: number }[]).map(t => (
          <button key={t.key} onClick={() => setCatalogTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition-all ${catalogTab === t.key ? "bg-white shadow text-purple-700" : "text-gray-500 hover:text-gray-700"}`}>
            {t.key === "pending" && <Clock size={13} />}
            {t.key === "processed" && <CheckCircle2 size={13} />}
            {t.label}
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${catalogTab === t.key ? "bg-purple-100 text-purple-700" : "bg-gray-200 text-gray-600"}`}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* Search + Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-300"
              placeholder="Search by product, customer, catalog no…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
        <DataTable
          data={filtered}
          columns={columns}
          searchKeys={["catalogNo", "productName", "customerName"]}
          actions={row => (
            <div className="flex items-center gap-1.5 justify-end flex-wrap">
              <Button variant="ghost" size="sm" icon={<Eye size={13} />} onClick={() => setViewRow(row)}>View</Button>
              <Button variant="ghost" size="sm" icon={<Layers size={13} />} onClick={() => setViewPlanRow(row)}>View Plan</Button>
              {usedCatalogIds.has(row.id) && (
                <Button variant="ghost" size="sm" icon={<RefreshCw size={13} />} onClick={() => openEdit(row)}>Replan</Button>
              )}
              <Button variant="ghost" size="sm" icon={<Pencil size={13} />} onClick={() => openEdit(row)}>Edit</Button>
              <Button variant="danger" size="sm" icon={<Trash2 size={13} />} onClick={() => setDeleteId(row.id)}>Delete</Button>
            </div>
          )}
        />
      </div>

      {/* ══ ADD / EDIT MODAL ══════════════════════════════════════ */}
      <Modal open={modalOpen} onClose={() => setModal(false)}
        title={editing ? `Edit — ${editing.catalogNo}` : "Add Product to Catalog"} size="xl">
        <div className="space-y-4">

          {/* ── Quick Load from Estimation ── */}
          {!editing && (
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
              <p className="text-xs font-bold text-purple-700 uppercase tracking-widest mb-2">Quick Load from Estimation</p>
              <Select
                label="Pick an Approved Estimation"
                value={form.sourceEstimationId}
                onChange={e => {
                  // We import gravureEstimations from dummyData; in real app use context
                  import("@/data/dummyData").then(({ gravureEstimations }) => {
                    const est = gravureEstimations.find(x => x.id === e.target.value);
                    if (est) loadFromEstimation(est);
                  });
                }}
                options={[
                  { value: "", label: "— Select estimation to auto-fill —" },
                  // populated via dynamic import; rendered with static placeholder
                ]}
              />
              <p className="text-[11px] text-purple-500 mt-1.5">Selecting an estimation will auto-fill all fields below. You can still edit them.</p>
            </div>
          )}

          {/* ── Identity ── */}
          <div>
            <SH label="Product Identity" />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Input label="Product Name *" value={form.productName} onChange={e => f("productName", e.target.value)} placeholder="e.g. Parle-G 100g Wrap" />
              <Select
                label="Customer *"
                value={form.customerId}
                onChange={e => {
                  const c = customers.find(x => x.id === e.target.value);
                  f("customerId", e.target.value);
                  if (c) f("customerName", c.name);
                }}
                options={[{ value: "", label: "-- Select Customer --" }, ...customers.filter(c => c.status === "Active").map(c => ({ value: c.id, label: c.name }))]}
              />
              <Select
                label="Category"
                value={form.categoryId}
                onChange={e => {
                  const cat = categories.find(c => c.id === e.target.value);
                  f("categoryId", e.target.value);
                  f("categoryName", cat?.name || "");
                  f("content", "");
                }}
                options={[{ value: "", label: "-- Select Category --" }, ...categories.map(c => ({ value: c.id, label: c.name }))]}
              />
              <Select
                label="Content"
                value={form.content}
                onChange={e => f("content", e.target.value)}
                disabled={!form.categoryId}
                options={[{ value: "", label: "-- Select Content --" }, ...(categories.find(c => c.id === form.categoryId)?.contents || []).map(ct => ({ value: ct, label: ct }))]}
              />
              <Input label="Substrate / Structure" value={form.substrate} onChange={e => f("substrate", e.target.value)} placeholder="e.g. BOPP 20μ + Dry Lam + CPP 30μ" />
              <Select
                label="Status"
                value={form.status}
                onChange={e => f("status", e.target.value as "Active" | "Inactive")}
                options={[{ value: "Active", label: "Active" }, { value: "Inactive", label: "Inactive" }]}
              />
            </div>
          </div>

          {/* ── Specifications ── */}
          <div>
            <SH label="Print Specifications" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Input label="Job Width (mm)"  type="number" value={form.jobWidth    || ""} onChange={e => { const v = Number(e.target.value); f("jobWidth", v); f("actualWidth", v + 1); }} />
              <Input label="Job Height (mm)" type="number" value={form.jobHeight   || ""} onChange={e => { const v = Number(e.target.value); f("jobHeight", v); f("actualHeight", v + 1); }} />
              <Input label="Actual Width"    type="number" value={form.actualWidth  || ""} onChange={e => f("actualWidth",  Number(e.target.value))} />
              <Input label="Actual Height"   type="number" value={form.actualHeight || ""} onChange={e => f("actualHeight", Number(e.target.value))} />
              <Input label="No. of Colors"   type="number" value={form.noOfColors} onChange={e => f("noOfColors", Number(e.target.value))} min={1} max={12} />
              <Select label="Print Type" value={form.printType} onChange={e => f("printType", e.target.value as typeof form.printType)}
                options={[
                  { value: "Surface Print", label: "Surface Print" },
                  { value: "Reverse Print", label: "Reverse Print" },
                  { value: "Combination",   label: "Combination" },
                ]} />
              <Input label="Standard Qty"  type="number" value={form.standardQty  || ""} onChange={e => f("standardQty",  Number(e.target.value))} />
              <Select label="Unit" value={form.standardUnit} onChange={e => f("standardUnit", e.target.value)}
                options={[{ value: "Meter", label: "Meter" }, { value: "Kg", label: "Kg" }]} />
            </div>
          </div>

          {/* ── Machine & Cost ── */}
          <div>
            <SH label="Machine & Cost Reference" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Select label="Printing Machine"
                value={form.machineId}
                onChange={e => { const m = PRINT_MACHINES.find(x => x.id === e.target.value); f("machineId", e.target.value); if (m) f("machineName", m.name); }}
                options={[{ value: "", label: "-- Select Machine --" }, ...PRINT_MACHINES.map(m => ({ value: m.id, label: m.name }))]}
              />
              <Input label="₹/Meter Rate" type="number" value={form.perMeterRate || ""} onChange={e => f("perMeterRate", Number(e.target.value))} />
              <Input label="Cylinder Cost/Color (₹)" type="number" value={form.cylinderCostPerColor} onChange={e => f("cylinderCostPerColor", Number(e.target.value))} />
              <Input label="Overhead %" type="number" value={form.overheadPct} onChange={e => f("overheadPct", Number(e.target.value))} />
              <Input label="Profit %" type="number" value={form.profitPct} onChange={e => f("profitPct", Number(e.target.value))} />
              {form.sourceEstimationNo && (
                <div className="col-span-2 sm:col-span-3 flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                  <CheckCircle2 size={14} className="text-green-600" />
                  <span className="text-xs text-green-700">Loaded from estimation: <strong>{form.sourceEstimationNo}</strong></span>
                </div>
              )}
            </div>
          </div>

          {/* ── Processes ── */}
          {form.processes.length > 0 && (
            <div>
              <SH label={`Processes (${form.processes.length})`} />
              <div className="flex flex-wrap gap-2">
                {form.processes.map((p, i) => (
                  <span key={i} className="px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-medium flex items-center gap-1.5">
                    <Layers size={10} />
                    {p.processName}
                    <span className="text-indigo-400">₹{p.rate}/{p.chargeUnit}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Add Process */}
          <div>
            <SH label="Add / Manage Processes" />
            <div className="flex flex-wrap gap-2">
              {ROTO_PROCESSES.map(pm => {
                const selected = form.processes.some(p => p.processId === pm.id);
                return (
                  <button
                    key={pm.id}
                    onClick={() => {
                      if (selected) {
                        f("processes", form.processes.filter(p => p.processId !== pm.id));
                      } else {
                        f("processes", [...form.processes, {
                          processId: pm.id, processName: pm.name,
                          chargeUnit: pm.chargeUnit,
                          rate: parseFloat(pm.rate) || 0,
                          qty: 0, setupCharge: pm.makeSetupCharges ? parseFloat(pm.setupChargeAmount) || 0 : 0,
                          amount: 0,
                        } as GravureEstimationProcess]);
                      }
                    }}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${selected
                      ? "bg-purple-600 text-white border-purple-600"
                      : "bg-white text-gray-600 border-gray-200 hover:border-purple-300 hover:text-purple-700"
                    }`}
                  >
                    {selected && <CheckCircle2 size={10} className="inline mr-1" />}
                    {pm.name}
                  </button>
                );
              })}
            </div>
          </div>

          <Textarea label="Remarks" value={form.remarks} onChange={e => f("remarks", e.target.value)} placeholder="Special notes, color matching requirements…" />
        </div>

        <div className="flex justify-end gap-3 mt-5">
          <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
          <Button icon={<BookMarked size={14} />} onClick={save}>{editing ? "Update Catalog" : "Save to Catalog"}</Button>
        </div>
      </Modal>

      {/* ══ VIEW MODAL ══════════════════════════════════════════════ */}
      {viewRow && (
        <Modal open={!!viewRow} onClose={() => setViewRow(null)} title={`${viewRow.catalogNo} — ${viewRow.productName}`} size="lg">
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {([
                ["Customer",     viewRow.customerName],
                ["Category",     viewRow.categoryName || "—"],
                ["Content",      viewRow.content || "—"],
                ["Substrate",    viewRow.substrate || "—"],
                ["Size (W×H)",   `${viewRow.jobWidth} × ${viewRow.jobHeight} mm`],
                ["Colors",       `${viewRow.noOfColors}C`],
                ["Print Type",   viewRow.printType],
                ["Machine",      viewRow.machineName || "—"],
                ["₹/Meter",      `₹${viewRow.perMeterRate.toFixed(2)}`],
                ["Std Qty",      `${viewRow.standardQty.toLocaleString()} ${viewRow.standardUnit}`],
                ["From Est.",    viewRow.sourceEstimationNo || "Direct"],
                ["Status",       viewRow.status],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k}>
                  <p className="text-[10px] text-gray-400 uppercase font-semibold">{k}</p>
                  <p className="font-medium text-gray-800">{v}</p>
                </div>
              ))}
            </div>

            {viewRow.processes.length > 0 && (
              <div>
                <p className="text-[10px] text-gray-400 uppercase font-semibold mb-2">Processes</p>
                <div className="flex flex-wrap gap-2">
                  {viewRow.processes.map((p, i) => (
                    <span key={i} className="px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-lg text-xs">{p.processName}</span>
                  ))}
                </div>
              </div>
            )}

            {viewRow.remarks && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
                <strong>Remarks:</strong> {viewRow.remarks}
              </div>
            )}
          </div>
          <div className="flex justify-between mt-5">
            <Button variant="secondary" onClick={() => setViewRow(null)}>Close</Button>
            <div className="flex gap-2">
              <Button variant="secondary" icon={<Layers size={14} />} onClick={() => { setViewPlanRow(viewRow); setViewRow(null); }}>View Plan</Button>
              <Button icon={<ArrowRight size={14} />} onClick={() => {
                setViewRow(null);
                window.location.href = `/gravure/orders?catalog=${viewRow.id}`;
              }}>Book Order from Catalog</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ══ VIEW PLAN MODAL ══════════════════════════════════════════ */}
      {viewPlanRow && (
        <Modal open={!!viewPlanRow} onClose={() => setViewPlanRow(null)}
          title={`Planning Template — ${viewPlanRow.catalogNo}`} size="xl">
          <div className="mb-3 flex flex-wrap gap-2 text-xs">
            <span className="px-3 py-1 bg-purple-50 border border-purple-200 text-purple-700 rounded-full font-semibold">Product Catalog</span>
            <span className="px-3 py-1 bg-gray-50 border border-gray-200 text-gray-600 rounded-full">{viewPlanRow.customerName}</span>
            <span className="px-3 py-1 bg-gray-50 border border-gray-200 text-gray-600 rounded-full">{viewPlanRow.productName}</span>
            <span className="px-3 py-1 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-full font-semibold">{viewPlanRow.noOfColors}C · {viewPlanRow.printType}</span>
            {viewPlanRow.machineName && <span className="px-3 py-1 bg-blue-50 border border-blue-200 text-blue-700 rounded-full">{viewPlanRow.machineName}</span>}
          </div>
          <div className="max-h-[70vh] overflow-y-auto pr-1">
            <PlanViewer plan={{
              title:   "Product Catalog",
              refNo:   viewPlanRow.catalogNo,
              jobWidth:   viewPlanRow.jobWidth,
              jobHeight:  viewPlanRow.jobHeight,
              quantity:   viewPlanRow.standardQty || 1000,
              unit:       viewPlanRow.standardUnit,
              noOfColors: viewPlanRow.noOfColors,
              secondaryLayers:      viewPlanRow.secondaryLayers,
              processes:            viewPlanRow.processes,
              cylinderCostPerColor: viewPlanRow.cylinderCostPerColor,
              overheadPct: viewPlanRow.overheadPct,
              profitPct:   viewPlanRow.profitPct,
            } satisfies PlanInput} />
          </div>
          <div className="flex justify-between mt-4">
            <Button variant="secondary" onClick={() => setViewPlanRow(null)}>Close</Button>
            <Button icon={<ArrowRight size={14} />} onClick={() => {
              setViewPlanRow(null);
              window.location.href = `/gravure/orders?catalog=${viewPlanRow.id}`;
            }}>Book Order from Catalog</Button>
          </div>
        </Modal>
      )}

      {/* ══ DELETE CONFIRM ══ */}
      {deleteId && (
        <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Catalog Item" size="sm">
          <p className="text-sm text-gray-600 mb-5">This product will be removed from the catalog. Orders already created will not be affected.</p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="danger" onClick={() => { deleteCatalogItem(deleteId); setDeleteId(null); }}>Delete</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
