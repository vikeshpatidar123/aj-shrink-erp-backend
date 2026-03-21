"use client";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend
} from "recharts";
import {
  Layers, ArrowLeft, TrendingUp, Package, ClipboardList,
  AlertCircle, CheckCircle2, Clock, Zap
} from "lucide-react";
import { statusBadge } from "@/components/ui/Badge";
import {
  dashboardStats, weeklyProductionData, orders, jobCards,
  machines, productionEntries, recipes, rawMaterials
} from "@/data/dummyData";

const extMachines  = machines.filter(m => m.department?.toLowerCase().includes("extru") || m.machineType?.toLowerCase().includes("extru"));
const extJobCards  = jobCards.filter(j => !j.rotoJobId);
const extOrders    = orders.filter(o => ["Confirmed", "In Production"].includes(o.status));
const extProds     = productionEntries.filter(p => p.machineName.toLowerCase().includes("extru"));

// Weekly data for extrusion only
const weeklyExt = weeklyProductionData.map(d => ({ day: d.day, production: d.extrusion }));

// Per-machine today production (dummy)
const machinePerf = [
  { name: "EXT-01 (3L)", target: 2400, actual: 2100, pct: 88 },
  { name: "EXT-02 (5L)", target: 2000, actual: 0,    pct: 0  },
  { name: "EXT-03 (2L)", target: 2800, actual: 2600, pct: 93 },
];

const Stat = ({ label, value, sub, color, icon }: { label: string; value: string | number; sub?: string; color: string; icon: React.ReactNode }) => (
  <div className={`bg-white rounded-xl border border-gray-200 shadow-sm p-5`}>
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
        <p className={`text-2xl font-bold ${color}`}>{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
      <div className={`p-2.5 rounded-xl ${color.replace("text-", "bg-").replace("700", "100")}`}>
        <span className={color}>{icon}</span>
      </div>
    </div>
  </div>
);

export default function ExtrusionDashboard() {
  return (
    <div className="space-y-4">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard"
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 font-medium transition-colors">
            <ArrowLeft size={16} /> Dashboards
          </Link>
          <span className="text-gray-300">/</span>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <Layers size={16} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-800">Extrusion Unit</h1>
              <p className="text-xs text-gray-400">Film production & recipe management</p>
            </div>
          </div>
        </div>
        <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-green-100 text-green-700 rounded-full border border-green-200">
          <Zap size={12} /> Live
        </span>
      </div>

      {/* ── KPI Row ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Today Output"   value={`${dashboardStats.extrusionOutput.toLocaleString()} Kg`} sub="Extrusion only"     color="text-blue-700"  icon={<TrendingUp size={20} />} />
        <Stat label="Lines Running"  value="2 / 3"   sub="EXT-01, EXT-03 active"  color="text-green-700" icon={<Zap size={20} />} />
        <Stat label="Active Jobs"    value={extJobCards.filter(j => j.status === "In Progress").length} sub="In production"   color="text-amber-700" icon={<ClipboardList size={20} />} />
        <Stat label="Open Orders"    value={extOrders.length}  sub="Awaiting production"  color="text-violet-700" icon={<Package size={20} />} />
      </div>

      {/* ── Charts row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Weekly production */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-700 mb-4">Weekly Production (Kg)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={weeklyExt} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => [`${Number(v).toLocaleString()} Kg`, "Production"]} />
              <Bar dataKey="production" fill="#2563EB" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Machine performance */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-700 mb-4">Machine Performance — Today</h3>
          <div className="space-y-4">
            {machinePerf.map(m => (
              <div key={m.name}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-gray-600">{m.name}</span>
                  <span className={`text-xs font-bold ${m.pct >= 85 ? "text-green-600" : m.pct > 0 ? "text-amber-500" : "text-gray-400"}`}>
                    {m.actual.toLocaleString()} / {m.target.toLocaleString()} Kg &nbsp; {m.pct}%
                  </span>
                </div>
                <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${m.pct >= 85 ? "bg-green-500" : m.pct > 0 ? "bg-amber-400" : "bg-gray-300"}`}
                    style={{ width: `${m.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Machine status pills */}
          <div className="mt-5 flex flex-wrap gap-2">
            {extMachines.map(m => (
              <span key={m.id}
                className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border
                  ${m.status === "Running"     ? "bg-green-50 text-green-700 border-green-200" :
                    m.status === "Idle"        ? "bg-gray-50 text-gray-500 border-gray-200" :
                                                 "bg-red-50 text-red-600 border-red-200"}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${m.status === "Running" ? "bg-green-500" : m.status === "Idle" ? "bg-gray-400" : "bg-red-500"}`} />
                {m.code} — {m.status}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Job Cards + Raw Material Stock ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Active Job Cards */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-700">Job Cards</h3>
            <Link href="/jobcard" className="text-xs text-blue-600 hover:underline font-medium">View all →</Link>
          </div>
          <div className="space-y-2.5">
            {extJobCards.slice(0, 4).map(jc => (
              <div key={jc.id}
                className="flex items-center justify-between px-3 py-2.5 bg-gray-50 rounded-lg border border-gray-100">
                <div>
                  <p className="text-xs font-bold text-gray-700">{jc.jobCardNo}</p>
                  <p className="text-xs text-gray-400">{jc.customerName} · {jc.targetQty.toLocaleString()} Kg</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">{jc.machineName.split("(")[0].trim()}</span>
                  {statusBadge(jc.status)}
                </div>
              </div>
            ))}
            {extJobCards.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-6">No extrusion job cards</p>
            )}
          </div>
        </div>

        {/* Raw material stock alert */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-700">Raw Material Stock</h3>
            <Link href="/masters/items" className="text-xs text-blue-600 hover:underline font-medium">Item Master →</Link>
          </div>
          <div className="space-y-2.5">
            {rawMaterials.slice(0, 5).map(rm => {
              const pct = Math.round((rm.currentStock / (rm.reorderLevel * 4)) * 100);
              const low = rm.currentStock <= rm.reorderLevel * 1.5;
              return (
                <div key={rm.id} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-semibold text-gray-700 truncate">{rm.name}</p>
                      <span className={`text-xs font-bold ml-2 shrink-0 ${low ? "text-red-500" : "text-green-600"}`}>
                        {rm.currentStock.toLocaleString()} {rm.stockUnit}
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${low ? "bg-red-400" : "bg-green-400"}`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  </div>
                  {low && <AlertCircle size={13} className="text-red-400 shrink-0" />}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Recent Recipes ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-gray-700">Active Recipes</h3>
          <Link href="/masters/recipes" className="text-xs text-blue-600 hover:underline font-medium">Recipe Master →</Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {recipes.filter(r => r.status === "Active").map(recipe => (
            <div key={recipe.id}
              className="p-4 bg-blue-50 rounded-xl border border-blue-100 hover:border-blue-300 transition-colors cursor-pointer">
              <p className="text-xs text-blue-500 font-semibold mb-0.5">{recipe.code}</p>
              <p className="text-sm font-bold text-gray-800">{recipe.name}</p>
              <p className="text-xs text-gray-500 mt-1">{recipe.description} · {recipe.layers.length} layers</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
