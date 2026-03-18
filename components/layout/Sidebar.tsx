"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, Package, FlaskConical, Settings2,
  Factory, UserCheck, ClipboardList, Calculator, ShoppingCart,
  FileText, PlayCircle, Truck, ChevronDown, ChevronRight, X,
  Layers, Printer, BookOpen, Barcode, Tag, Workflow, ScrollText, Wrench, Boxes, Building2,
  Warehouse, ShoppingBag, ReceiptText, PackageCheck, ArrowLeftRight, ClipboardCheck, PackageMinus, ArrowRightLeft,
  Palette
} from "lucide-react";
import { useState } from "react";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Extrusion", href: "/dashboard/extrusion", icon: Layers },
  { label: "Rotogravure", href: "/dashboard/rotogravure", icon: Printer },
  {
    label: "Masters", icon: Settings2, children: [
      { label: "Item Master", href: "/masters/items", icon: FlaskConical },
      { label: "Ledger Master", href: "/masters/employees", icon: UserCheck },
      { label: "Tool Master", href: "/masters/tools", icon: Wrench },
      { label: "Process Master", href: "/masters/processes", icon: Workflow },
      { label: "Machine Master", href: "/masters/machines", icon: Factory },
      { label: "Item Group Master", href: "/masters/item-groups", icon: Boxes },
      { label: "SubGroup Master", href: "/masters/subgroups", icon: Tag },
      { label: "Department Master", href: "/masters/departments", icon: Building2 },
      { label: "Recipe Master", href: "/masters/recipes", icon: BookOpen },
      { label: "HSN Master", href: "/masters/hsn", icon: Barcode },
      { label: "Unit Master", href: "/masters/units", icon: Factory },
    ],
  },
  {
    label: "Inventory", icon: Warehouse, children: [
      { label: "Purchase Requisition", href: "/inventory/purchase-requisition", icon: ShoppingBag },
      { label: "Purchase Order",       href: "/inventory/purchase-order",       icon: ReceiptText },
      { label: "Purchase GRN",         href: "/inventory/purchase-grn",         icon: PackageCheck },
      { label: "Item Issue",           href: "/inventory/item-issue",           icon: PackageMinus },
      { label: "Item Consumption",     href: "/inventory/item-consumption",     icon: ArrowRightLeft },
      { label: "Return to Stock",      href: "/inventory/return-to-stock",      icon: ArrowLeftRight },
      { label: "Stock Transfer",       href: "/inventory/stock-transfer",       icon: Truck },
      { label: "Physical Verification",href: "/inventory/physical-verification",icon: ClipboardCheck },
    ],
  },
  { label: "Enquiry", href: "/enquiry", icon: ClipboardList },
  { label: "Cost Estimation", href: "/cost-estimation", icon: Calculator },
  { label: "Orders", href: "/orders", icon: ShoppingCart },
  { label: "Roto Job", href: "/roto", icon: Printer },
  { label: "Job Card", href: "/jobcard", icon: FileText },
  { label: "Production", href: "/production", icon: PlayCircle },
  { label: "Dispatch", href: "/dispatch", icon: Truck },
  {
    label: "Gravure", icon: Palette, children: [
      { label: "Gravure Enquiry",    href: "/gravure/enquiry",    icon: ClipboardList },
      { label: "Gravure Estimation", href: "/gravure/estimation", icon: Calculator },
      { label: "Gravure Orders",     href: "/gravure/orders",     icon: ShoppingCart },
      { label: "Work Order",         href: "/gravure/workorder",  icon: FileText },
      { label: "Item Issue",         href: "/gravure/item-issue", icon: PackageMinus },
      { label: "Production Entry",   href: "/gravure/production", icon: PlayCircle },
      { label: "Dispatch",           href: "/gravure/dispatch",   icon: Truck },
    ],
  },
];

interface SidebarProps { open: boolean; onClose: () => void; }

export default function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState<string | null>("Masters");
  const toggle = (label: string) => setExpanded((p) => (p === label ? null : label));

  return (
    <>
      {open && <div className="fixed inset-0 z-20 bg-black/50 lg:hidden" onClick={onClose} />}
      <aside className={`fixed top-0 left-0 z-30 h-full w-64 bg-slate-900 text-white flex flex-col transition-transform duration-300
        ${open ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 lg:static lg:z-auto`}>

        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-widest">Flexible Packaging ERP</p>
            <h1 className="text-xl font-bold text-white">AJ Shrink</h1>
          </div>
          <button onClick={onClose} className="lg:hidden text-slate-400 hover:text-white"><X size={20} /></button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
          {navItems.map((item) => {
            if (item.children) {
              const isExpanded = expanded === item.label;
              const isActive = item.children.some((c) => pathname.startsWith(c.href));
              return (
                <div key={item.label}>
                  <button
                    onClick={() => toggle(item.label)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                      ${isActive ? "bg-slate-700 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"}`}
                  >
                    <span className="flex items-center gap-3"><item.icon size={18} />{item.label}</span>
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                  {isExpanded && (
                    <div className="mt-0.5 ml-4 pl-3 border-l border-slate-700 space-y-0.5">
                      {item.children.map((child) => {
                        const active = pathname === child.href;
                        return (
                          <Link key={child.href} href={child.href} onClick={onClose}
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-colors
                              ${active ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white"}`}>
                            <child.icon size={14} />{child.label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }
            const active = pathname === item.href;
            return (
              <Link key={item.href!} href={item.href!} onClick={onClose}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                  ${active ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"}`}>
                <item.icon size={18} />{item.label}
              </Link>
            );
          })}
        </nav>

        <div className="px-5 py-3 border-t border-slate-700 text-xs text-slate-500">
          v2.0 &copy; 2024 AJ Shrink ERP
        </div>
      </aside>
    </>
  );
}
