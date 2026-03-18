"use client";
import { Menu, Bell, Search, User } from "lucide-react";

interface TopbarProps {
  onMenuClick: () => void;
  title: string;
}

export default function Topbar({ onMenuClick, title }: TopbarProps) {
  return (
    <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100"
        >
          <Menu size={20} />
        </button>
        <h2 className="text-base font-semibold text-gray-800 truncate max-w-[160px] sm:max-w-xs md:max-w-none">{title}</h2>
      </div>

      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="hidden md:flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2">
          <Search size={16} className="text-gray-400" />
          <input
            type="text"
            placeholder="Search..."
            className="bg-transparent text-sm text-gray-600 outline-none w-40 placeholder-gray-400"
          />
        </div>

        {/* Notifications */}
        <button className="relative p-2 rounded-lg text-gray-500 hover:bg-gray-100">
          <Bell size={18} />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
        </button>

        {/* User */}
        <div className="flex items-center gap-2 cursor-pointer">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
            <User size={16} className="text-white" />
          </div>
          <div className="hidden sm:block">
            <p className="text-xs font-semibold text-gray-700 leading-tight">Admin</p>
            <p className="text-xs text-gray-400">AJ Shrink</p>
          </div>
        </div>
      </div>
    </header>
  );
}
