"use client";
import { useState } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { usePathname } from "next/navigation";

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/masters/customers": "Customer Master",
  "/masters/products": "Product Master",
  "/masters/items": "Item Master",
  "/masters/rolls": "Roll Master",
  "/masters/recipes": "Recipe Master",
  "/masters/processes": "Process Master",
  "/masters/hsn": "HSN Master",
  "/masters/subgroups": "SubGroup Master",
  "/masters/machines": "Machine Master",
  "/masters/units": "Unit Master",
  "/masters/employees": "Employee Master",
  "/enquiry": "Enquiry Management",
  "/cost-estimation": "Cost Estimation & Planning",
  "/orders": "Order Booking",
  "/roto": "Rotogravure (Roto) Jobs",
  "/jobcard": "Job Card",
  "/production": "Production Entry",
  "/dispatch": "Dispatch",
};

const AUTH_PATHS = ["/login", "/login/user"];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const title = pageTitles[pathname] || "AJ Shrink ERP";

  if (AUTH_PATHS.includes(pathname)) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar onMenuClick={() => setSidebarOpen(true)} title={title} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
