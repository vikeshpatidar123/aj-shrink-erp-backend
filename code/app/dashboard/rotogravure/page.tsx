"use client";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import {
  Printer, ArrowLeft, TrendingUp, FileText, Palette,
  AlertCircle, Zap, Truck
} from "lucide-react";
import { statusBadge } from "@/components/ui/Badge";
import {
  dashboardStats, weeklyProductionData, orders, jobCards,
  machines, rotoJobs, processMasters, dispatches
} from "@/data/dummyData";

const rotoMachines = machines.filter(m => m.department === "Printing" || m.department === "Lamination" || m.department === "Slitting");
const rotoJobCards = jobCards.filter(j => j.rotoJobId);
const weeklyRoto   = weeklyProductionData.map(d => ({ day: d.day, production: d.roto }));

const processSummary = [
  { name: "Printing",    count: 2, color: "#7C3AED" },
  { name: "Lamination",  count: 1, color: "#2563EB" },
  { name: "Coating",     count: 1, color: "#0891B2" },
  { name: "Slitting",    count: 2, color: "#059669" },
];

const Stat = ({ label, value, sub, color, icon }: { label: string; value: string | number; sub?: string; color: string; icon: React.ReactNode }) => (
  <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
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

export default function RotogravureDashboard() {
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
            <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center">
              <Printer size={16} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-800">Rotogravure Unit</h1>
              <p className="text-xs text-gray-400">Printing, lamination & finishing operations</p>
            </div>
          </div>
        </div>
        <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-green-100 text-green-700 rounded-full border border-green-200">
          <Zap size={12} /> Live
        </span>
      </div>

      {/* ── KPI Row ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Today Output"    value={`${dashboardStats.rotoOutput.toLocaleString()} Kg`} sub="Roto only"         color="text-violet-700" icon={<TrendingUp size={20} />} />
        <Stat label="Presses Running" value="1 / 3"   sub="ROTO-01 active"           color="text-green-700"  icon={<Zap size={20} />} />
        <Stat label="Roto Jobs Open"  value={rotoJobs.filter(j => j.status !== "Completed").length} sub="Active + pending" color="text-amber-700"  icon={<FileText size={20} />} />
        <Stat label="Dispatched Today" value={dashboardStats.dispatchedToday} sub="Shipments out"   color="text-teal-700"   icon={<Truck size={20} />} />
      </div>

      {/* ── Charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Weekly roto output */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-700 mb-4">Weekly Roto Output (Kg)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={weeklyRoto} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => [`${Number(v).toLocaleString()} Kg`, "Output"]} />
              <Bar dataKey="production" fill="#7C3AED" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Press status + process summary */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-5">
          <div>
            <h3 className="text-sm font-bold text-gray-700 mb-3">Press Status</h3>
            <div className="space-y-2.5">
              {rotoMachines.map(m => (
                <div key={m.id}
                  className="flex items-center justify-between px-3.5 py-2.5 rounded-lg border"
                  style={{ borderColor: m.status === "Running" ? "#bbf7d0" : m.status === "Maintenance" ? "#fecaca" : "#e5e7eb",
                           backgroundColor: m.status === "Running" ? "#f0fdf4" : m.status === "Maintenance" ? "#fff1f2" : "#f9fafb" }}>
                  <div>
                    <p className="text-xs font-bold text-gray-700">{m.name}</p>
                    <p className="text-xs text-gray-400">{m.department} · Op: {m.operator}</p>
                  </div>
                  <span className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full
                    ${m.status === "Running" ? "text-green-700 bg-green-100" :
                      m.status === "Maintenance" ? "text-red-600 bg-red-100" : "text-gray-500 bg-gray-100"}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${m.status === "Running" ? "bg-green-500" : m.status === "Maintenance" ? "bg-red-500" : "bg-gray-400"}`} />
                    {m.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Active processes */}
          <div>
            <h3 className="text-sm font-bold text-gray-700 mb-2">Process Summary</h3>
            <div className="flex flex-wrap gap-2">
              {processSummary.map(p => (
                <span key={p.name}
                  className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border"
                  style={{ borderColor: p.color + "44", backgroundColor: p.color + "11", color: p.color }}>
                  <Palette size={10} /> {p.name} ({p.count})
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Roto Jobs + Job Cards ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Roto Jobs */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-700">Roto Jobs</h3>
            <Link href="/roto" className="text-xs text-violet-600 hover:underline font-medium">View all →</Link>
          </div>
          <div className="space-y-2.5">
            {rotoJobs.map(rj => (
              <div key={rj.id}
                className="px-3.5 py-3 bg-gray-50 rounded-xl border border-gray-100 hover:border-violet-200 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-700">{rj.rotoJobNo}</p>
                    <p className="text-xs text-gray-500 truncate">{rj.customerName}</p>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{rj.jobName}</p>
                  </div>
                  <div className="text-right shrink-0">
                    {statusBadge(rj.status)}
                    <p className="text-xs text-gray-400 mt-1">{rj.noOfColors} Colors</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {rj.processes.map(p => (
                    <span key={p.processId}
                      className="text-[10px] font-medium px-1.5 py-0.5 bg-violet-100 text-violet-700 rounded">
                      {p.processType}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Roto Job Cards + Dispatch */}
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-700">Roto Job Cards</h3>
              <Link href="/jobcard" className="text-xs text-violet-600 hover:underline font-medium">View all →</Link>
            </div>
            <div className="space-y-2">
              {rotoJobCards.length === 0
                ? <p className="text-xs text-gray-400 text-center py-4">No roto job cards</p>
                : rotoJobCards.map(jc => (
                  <div key={jc.id}
                    className="flex items-center justify-between px-3 py-2.5 bg-violet-50 rounded-lg border border-violet-100">
                    <div>
                      <p className="text-xs font-bold text-gray-700">{jc.jobCardNo}</p>
                      <p className="text-xs text-gray-400">{jc.machineName.split("–")[0].trim()} · {jc.targetQty.toLocaleString()} Kg</p>
                    </div>
                    {statusBadge(jc.status)}
                  </div>
                ))
              }
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-700">Recent Dispatches</h3>
              <Link href="/dispatch" className="text-xs text-violet-600 hover:underline font-medium">View all →</Link>
            </div>
            <div className="space-y-2">
              {dispatches.slice(0, 3).map(d => (
                <div key={d.id}
                  className="flex items-center justify-between px-3 py-2.5 bg-gray-50 rounded-lg border border-gray-100">
                  <div>
                    <p className="text-xs font-bold text-gray-700">{d.dispatchNo}</p>
                    <p className="text-xs text-gray-400">{d.customerName} · {d.quantity.toLocaleString()} Kg</p>
                  </div>
                  {statusBadge(d.status)}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
