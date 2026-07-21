'use client';

import React, { useState } from 'react';
import { DemoProvider, useDemo } from '@/context/DemoContext';
import { 
  LayoutDashboard, 
  FileText, 
  Briefcase, 
  Download, 
  User, 
  Sparkles,
  Zap,
  LogOut,
  ChevronRight
} from 'lucide-react';
import Link from 'next/link';

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const { activeUser, switchRole, usersList } = useDemo();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'expenses' | 'projects' | 'exports'>('dashboard');

  const navItems = [
    { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard },
    { id: 'expenses', name: 'Expenses', icon: FileText },
    { id: 'projects', name: 'Projects', icon: Briefcase },
    { id: 'exports', name: 'Tally Exports', icon: Download },
  ] as const;

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-zinc-900/60 border-r border-zinc-800 flex flex-col backdrop-blur-md">
        {/* Brand Logo */}
        <div className="h-16 flex items-center px-6 border-b border-zinc-800 gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Zap className="h-5 w-5 animate-pulse" />
          </div>
          <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
            ApexExpense AI
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  // Dispatch simple custom event for pages to pick up active tab if needed
                  window.dispatchEvent(new CustomEvent('nav-tab-change', { detail: item.id }));
                }}
                className={`w-full flex items-center px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 gap-3 group ${
                  isActive
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_15px_-3px_rgba(16,185,129,0.1)]'
                    : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200 border border-transparent'
                }`}
              >
                <Icon className={`h-4 w-4 transition-transform duration-200 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
                <span>{item.name}</span>
                {isActive && <ChevronRight className="h-3.5 w-3.5 ml-auto text-emerald-400" />}
              </button>
            );
          })}
        </nav>

        {/* User Card */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-950/40">
          <div className="flex items-center gap-3 p-2 rounded-xl bg-zinc-800/20 border border-zinc-800/40">
            <div className="h-9 w-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-semibold text-sm">
              {activeUser.name.split(' ').map(n => n[0]).join('')}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-zinc-200 truncate">{activeUser.name}</p>
              <p className="text-[10px] text-zinc-500 truncate capitalize">{activeUser.role}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Body */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-16 border-b border-zinc-800 px-8 flex items-center justify-between bg-zinc-900/40 backdrop-blur-md z-10">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-emerald-400" />
            <span className="text-xs font-semibold tracking-wider text-zinc-400 uppercase">
              B2B Expense Workspace
            </span>
          </div>

          {/* Sandbox Role Switcher */}
          <div className="flex items-center gap-2 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
            <span className="text-[10px] font-semibold text-zinc-500 px-2.5 uppercase tracking-wider">
              Role:
            </span>
            {usersList.map((user) => {
              const isActive = activeUser.role === user.role;
              return (
                <button
                  key={user.id}
                  onClick={() => switchRole(user.role)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 capitalize ${
                    isActive
                      ? 'bg-emerald-500 text-zinc-950 font-bold shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                  }`}
                >
                  {user.role}
                </button>
              );
            })}
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-zinc-950">
          {/* Global Alert Bar for Demo Mode */}
          <div className="px-8 pt-4">
            <div className="bg-gradient-to-r from-emerald-500/10 via-cyan-500/10 to-transparent border border-emerald-500/20 rounded-xl p-3.5 flex items-center justify-between shadow-[0_0_15px_-5px_rgba(16,185,129,0.05)]">
              <div className="flex items-center gap-2.5">
                <div className="p-1 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                </div>
                <p className="text-xs text-zinc-300 leading-normal">
                  <span className="font-semibold text-emerald-400">Sandbox Sandbox Mode Active.</span> Switch personas above to test workflows: **Employee** submits receipts, **Manager** reviews/approves, and **Admin** exports to Tally.
                </p>
              </div>
            </div>
          </div>

          <div className="p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <DemoProvider>
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </DemoProvider>
  );
}
