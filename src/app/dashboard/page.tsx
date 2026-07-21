'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useDemo } from '@/context/DemoContext';
import { 
  Upload, 
  TrendingUp, 
  CheckCircle, 
  XCircle, 
  Plus, 
  FileText, 
  Sparkles, 
  Download, 
  Briefcase, 
  Users, 
  Clock, 
  AlertCircle, 
  ArrowRight,
  Eye,
  Check,
  X,
  FileSpreadsheet
} from 'lucide-react';
import Image from 'next/image';

interface Expense {
  id: string;
  userId: string;
  projectId: string;
  merchantName: string;
  date: string;
  amount: string;
  category: string;
  gstRate: string;
  cgst: string;
  sgst: string;
  igst: string;
  merchantGstin: string | null;
  receiptUrl: string | null;
  status: 'pending' | 'approved' | 'rejected';
  notes: string | null;
  reviewerId: string | null;
  rejectionReason: string | null;
  createdAt: string;
}

interface Project {
  id: string;
  name: string;
  budget: string;
  spent: string;
  organizationId: string;
  createdAt: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: 'employee' | 'manager' | 'admin';
}

export default function DashboardPage() {
  const { activeUser } = useDemo();
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'expenses' | 'projects' | 'exports'>('dashboard');

  // Database lists
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form & Receipt States
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [showConfirmForm, setShowConfirmForm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form Fields
  const [formMerchant, setFormMerchant] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formCategory, setFormCategory] = useState('Food/Beverages');
  const [formProject, setFormProject] = useState('');
  const [formGstRate, setFormGstRate] = useState('18');
  const [formCgst, setFormCgst] = useState('0');
  const [formSgst, setFormSgst] = useState('0');
  const [formIgst, setFormIgst] = useState('0');
  const [formGstin, setFormGstin] = useState('');
  const [formNotes, setFormNotes] = useState('');

  // Review states
  const [selectedReviewExpense, setSelectedReviewExpense] = useState<Expense | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  // Fetch Dashboard Data
  const fetchData = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/expenses');
      if (res.ok) {
        const data = await res.json();
        setExpenses(data.expenses || []);
        setProjects(data.projects || []);
        setUsers(data.users || []);
        if (data.projects && data.projects.length > 0 && !formProject) {
          setFormProject(data.projects[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Listen to sidebar tab change events
    const handleTabChange = (e: Event) => {
      setCurrentTab((e as CustomEvent).detail);
    };
    window.addEventListener('nav-tab-change', handleTabChange);
    return () => {
      window.removeEventListener('nav-tab-change', handleTabChange);
    };
  }, []);

  // Recalculate CGST/SGST/IGST splits if base amount or GST rate changes manually
  const handleAmountGstRecalculate = (amtStr: string, rateStr: string) => {
    const amount = parseFloat(amtStr) || 0;
    const rate = parseFloat(rateStr) || 0;
    if (amount <= 0 || rate <= 0) {
      setFormCgst('0.00');
      setFormSgst('0.00');
      setFormIgst('0.00');
      return;
    }
    
    // Back-calculate
    const baseAmount = amount / (1 + rate / 100);
    const totalGst = amount - baseAmount;
    
    // For local demo, default to Delhi intra-state split (CGST + SGST)
    const splitGst = (totalGst / 2).toFixed(2);
    setFormCgst(splitGst);
    setFormSgst(splitGst);
    setFormIgst('0.00');
  };

  // Receipt File Selection & OCR API Call
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    setSelectedFile(file);
    
    // Local preview URL
    const localUrl = URL.createObjectURL(file);
    setPreviewUrl(localUrl);

    // Call OCR endpoint
    setOcrLoading(true);
    setShowConfirmForm(false);

    try {
      // Simulate file upload or send mock url
      // For local demo, we bypass complex S3 uploads and directly send a simulated image URL
      // If client has supabase config, they can replace with standard storage upload.
      
      const payloadUrl = `https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?w=500&auto=format&fit=crop&q=60`; // Standard fallback receipt representation
      
      const response = await fetch('/api/receipts/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: payloadUrl }),
      });

      if (!response.ok) {
        throw new Error('OCR Parsing failed');
      }

      const parsedData = await response.json();
      
      // Auto-populate form
      setFormMerchant(parsedData.merchantName || '');
      setFormDate(parsedData.date || '');
      setFormAmount(parsedData.amount || '');
      setFormCategory(parsedData.category || 'Food/Beverages');
      setFormGstRate(parsedData.gstRate || '18');
      setFormCgst(parsedData.cgst || '0');
      setFormSgst(parsedData.sgst || '0');
      setFormIgst(parsedData.igst || '0');
      setFormGstin(parsedData.merchantGstin || '');
      setFormNotes(parsedData.notes || '');

      setShowConfirmForm(true);
    } catch (err) {
      console.error('OCR Extraction error:', err);
      alert('Failed to parse receipt. Please fill details manually.');
      // Open form anyway for manual entry
      setShowConfirmForm(true);
    } finally {
      setOcrLoading(false);
    }
  };

  // Submit Expense
  const handleExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: activeUser.id,
          projectId: formProject,
          merchantName: formMerchant,
          date: formDate,
          amount: parseFloat(formAmount),
          category: formCategory,
          gstRate: parseFloat(formGstRate),
          cgst: parseFloat(formCgst),
          sgst: parseFloat(formSgst),
          igst: parseFloat(formIgst),
          merchantGstin: formGstin || null,
          receiptUrl: previewUrl || 'https://placehold.co/600x400/png?text=Receipt+Image',
          notes: formNotes || null,
        }),
      });

      if (response.ok) {
        // Reset states
        setSelectedFile(null);
        setPreviewUrl(null);
        setShowConfirmForm(false);
        fetchData(); // Refresh list
      } else {
        const errorData = await response.json();
        alert(`Error: ${errorData.error}`);
      }
    } catch (err) {
      console.error('Submit expense error:', err);
    }
  };

  // Review (Approve/Reject) Actions
  const handleReviewAction = async (status: 'approved' | 'rejected') => {
    if (!selectedReviewExpense) return;

    if (status === 'rejected' && !rejectionReason) {
      setShowRejectInput(true);
      return;
    }

    try {
      const response = await fetch('/api/expenses', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedReviewExpense.id,
          status,
          reviewerId: activeUser.id,
          rejectionReason: status === 'rejected' ? rejectionReason : null,
        }),
      });

      if (response.ok) {
        setSelectedReviewExpense(null);
        setRejectionReason('');
        setShowRejectInput(false);
        fetchData();
      } else {
        alert('Failed to update status');
      }
    } catch (err) {
      console.error('Review update error:', err);
    }
  };

  // Stats Calculations
  const totalApprovedAmount = expenses
    .filter((e) => e.status === 'approved')
    .reduce((sum, e) => sum + parseFloat(e.amount), 0);

  const totalPendingAmount = expenses
    .filter((e) => e.status === 'pending')
    .reduce((sum, e) => sum + parseFloat(e.amount), 0);

  const totalCgstCredit = expenses
    .filter((e) => e.status === 'approved')
    .reduce((sum, e) => sum + parseFloat(e.cgst), 0);

  const totalSgstCredit = expenses
    .filter((e) => e.status === 'approved')
    .reduce((sum, e) => sum + parseFloat(e.sgst), 0);

  const totalIgstCredit = expenses
    .filter((e) => e.status === 'approved')
    .reduce((sum, e) => sum + parseFloat(e.igst), 0);

  const totalGstCredit = totalCgstCredit + totalSgstCredit + totalIgstCredit;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-emerald-500 border-r-2 border-transparent"></div>
        <p className="text-zinc-400 text-sm">Loading workspace data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* -------------------- 1. DASHBOARD HUB -------------------- */}
      {currentTab === 'dashboard' && (
        <div className="space-y-8 animate-fade-in">
          {/* Top KPI Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-6 relative overflow-hidden group hover:border-emerald-500/20 transition-all duration-200">
              <div className="absolute top-0 right-0 p-8 opacity-[0.03] text-emerald-400">
                <CheckCircle className="h-24 w-24" />
              </div>
              <p className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">Approved Reclaims</p>
              <h2 className="text-3xl font-bold text-zinc-100 mt-2 font-mono">₹{totalApprovedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h2>
              <div className="flex items-center gap-2 mt-4 text-emerald-400 text-xs font-semibold">
                <TrendingUp className="h-4 w-4" />
                <span>GST Tax Credit Ready</span>
              </div>
            </div>

            <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-6 relative overflow-hidden group hover:border-amber-500/20 transition-all duration-200">
              <div className="absolute top-0 right-0 p-8 opacity-[0.03] text-amber-400">
                <Clock className="h-24 w-24" />
              </div>
              <p className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">Pending Approvals</p>
              <h2 className="text-3xl font-bold text-zinc-100 mt-2 font-mono">₹{totalPendingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h2>
              <div className="flex items-center gap-2 mt-4 text-amber-400 text-xs font-semibold">
                <Clock className="h-4 w-4" />
                <span>{expenses.filter(e => e.status === 'pending').length} claims awaiting review</span>
              </div>
            </div>

            <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-6 relative overflow-hidden group hover:border-cyan-500/20 transition-all duration-200">
              <div className="absolute top-0 right-0 p-8 opacity-[0.03] text-cyan-400">
                <Sparkles className="h-24 w-24" />
              </div>
              <p className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">GST Input Credits</p>
              <h2 className="text-3xl font-bold text-zinc-100 mt-2 font-mono">₹{totalGstCredit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h2>
              <div className="flex items-center gap-2 mt-4 text-cyan-400 text-xs font-semibold">
                <FileSpreadsheet className="h-4 w-4" />
                <span>CGST + SGST + IGST saved</span>
              </div>
            </div>
          </div>

          {/* MAIN COLUMN WORKSPACE */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* LEFT / CENTER TWO-THIRDS PANEL */}
            <div className="lg:col-span-2 space-y-8">
              {/* EMPLOYEE SECTION: AI Upload Form */}
              {activeUser.role === 'employee' && (
                <div className="bg-zinc-900/30 border border-zinc-800/60 rounded-2xl p-6 backdrop-blur-sm space-y-6">
                  <div>
                    <h3 className="text-md font-semibold text-zinc-200 flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-emerald-400" />
                      Snap and Submit Expense Receipt
                    </h3>
                    <p className="text-zinc-500 text-xs mt-1">Upload an image. Claude AI will read the bill, parse amount, and break down GST details instantly.</p>
                  </div>

                  {!previewUrl && !ocrLoading && (
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="border border-dashed border-zinc-800 hover:border-emerald-500/40 bg-zinc-950/40 hover:bg-zinc-900/30 transition-all duration-300 rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer group"
                    >
                      <div className="p-3.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 group-hover:scale-110 transition-transform duration-200">
                        <Upload className="h-6 w-6" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-semibold text-zinc-300">Choose image or use mobile camera</p>
                        <p className="text-xs text-zinc-500 mt-1">Supports PNG, JPG, WebP</p>
                      </div>
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileChange} 
                        accept="image/*" 
                        capture="environment" // Forces PWA camera direct capture on mobile
                        className="hidden" 
                      />
                    </div>
                  )}

                  {/* OCR Running Spinner */}
                  {ocrLoading && (
                    <div className="border border-zinc-800 bg-zinc-950/20 rounded-xl p-12 flex flex-col items-center justify-center gap-4">
                      <div className="relative h-12 w-12">
                        <div className="absolute inset-0 rounded-full border-t-2 border-r-2 border-emerald-400 animate-spin"></div>
                        <div className="absolute inset-2 rounded-full border-b-2 border-l-2 border-cyan-400 animate-spin duration-1000"></div>
                      </div>
                      <div className="text-center space-y-1">
                        <p className="text-sm font-semibold text-zinc-200">Claude AI is reading receipt...</p>
                        <p className="text-xs text-zinc-500 animate-pulse">Extracting Indian GST splits, date, and vendor details</p>
                      </div>
                    </div>
                  )}

                  {/* Edit Form after parsing */}
                  {showConfirmForm && previewUrl && (
                    <form onSubmit={handleExpenseSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
                      <div className="md:col-span-2 p-3 rounded-lg bg-zinc-800/20 border border-zinc-800/80 flex items-center justify-between">
                        <span className="text-xs text-zinc-400 font-semibold">Image Uploaded Successfully</span>
                        <button 
                          type="button" 
                          onClick={() => { setSelectedFile(null); setPreviewUrl(null); setShowConfirmForm(false); }}
                          className="text-xs text-rose-400 hover:text-rose-300 underline font-semibold"
                        >
                          Clear & Reset
                        </button>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-zinc-400">Merchant Name</label>
                        <input 
                          type="text" 
                          value={formMerchant}
                          onChange={(e) => setFormMerchant(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-sm text-zinc-100 outline-none"
                          required 
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-zinc-400">Date</label>
                        <input 
                          type="date" 
                          value={formDate}
                          onChange={(e) => setFormDate(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-sm text-zinc-100 outline-none"
                          required 
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-zinc-400">Total Amount (₹)</label>
                        <input 
                          type="number" 
                          step="0.01"
                          value={formAmount}
                          onChange={(e) => {
                            setFormAmount(e.target.value);
                            handleAmountGstRecalculate(e.target.value, formGstRate);
                          }}
                          className="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-sm text-zinc-100 font-mono outline-none"
                          required 
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-zinc-400">Project Budget</label>
                        <select 
                          value={formProject}
                          onChange={(e) => setFormProject(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-sm text-zinc-100 outline-none"
                        >
                          {projects.map((proj) => (
                            <option key={proj.id} value={proj.id}>{proj.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-zinc-400">Expense Category</label>
                        <select 
                          value={formCategory}
                          onChange={(e) => setFormCategory(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-sm text-zinc-100 outline-none"
                        >
                          <option value="Food/Beverages">Food & Beverages</option>
                          <option value="Travel">Travel & Conveyance</option>
                          <option value="Fuel">Fuel / Vehicles</option>
                          <option value="Software/SaaS">Software / Cloud Subscriptions</option>
                          <option value="Supplies">Office Supplies / Printing</option>
                          <option value="Services">Professional Services</option>
                          <option value="Others">Others</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-zinc-400">Merchant GSTIN</label>
                        <input 
                          type="text" 
                          value={formGstin}
                          onChange={(e) => setFormGstin(e.target.value)}
                          placeholder="e.g. 07AAAAA1111A1Z1"
                          maxLength={15}
                          className="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-sm text-zinc-100 font-mono outline-none placeholder:text-zinc-700"
                        />
                      </div>

                      <div className="border-t border-zinc-800/80 md:col-span-2 pt-4 mt-2">
                        <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">GST Breakdown (Indian Slabs)</span>
                        <div className="grid grid-cols-4 gap-3 mt-3">
                          <div className="space-y-1">
                            <label className="text-[10px] font-semibold text-zinc-500">GST Rate (%)</label>
                            <select 
                              value={formGstRate}
                              onChange={(e) => {
                                setFormGstRate(e.target.value);
                                handleAmountGstRecalculate(formAmount, e.target.value);
                              }}
                              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-zinc-100 outline-none"
                            >
                              <option value="0">0% Exempt</option>
                              <option value="5">5% Standard</option>
                              <option value="12">12% standard</option>
                              <option value="18">18% Standard</option>
                              <option value="28">28% Premium</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-semibold text-zinc-500">CGST (₹)</label>
                            <input 
                              type="text" 
                              value={formCgst}
                              onChange={(e) => setFormCgst(e.target.value)}
                              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-zinc-100 font-mono outline-none"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-semibold text-zinc-500">SGST (₹)</label>
                            <input 
                              type="text" 
                              value={formSgst}
                              onChange={(e) => setFormSgst(e.target.value)}
                              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-zinc-100 font-mono outline-none"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-semibold text-zinc-500">IGST (₹)</label>
                            <input 
                              type="text" 
                              value={formIgst}
                              onChange={(e) => setFormIgst(e.target.value)}
                              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-zinc-100 font-mono outline-none"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="md:col-span-2 space-y-1.5">
                        <label className="text-xs font-semibold text-zinc-400">Notes / Purpose</label>
                        <textarea 
                          rows={2}
                          value={formNotes}
                          onChange={(e) => setFormNotes(e.target.value)}
                          placeholder="e.g. Travel tickets for Delhi pitch meeting with Client"
                          className="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-sm text-zinc-100 outline-none"
                        />
                      </div>

                      <div className="md:col-span-2 pt-2">
                        <button 
                          type="submit"
                          className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold py-3 rounded-xl transition-all duration-200 text-sm shadow-[0_0_15px_rgba(16,185,129,0.3)] cursor-pointer"
                        >
                          <Check className="h-4 w-4" />
                          Confirm & Submit Reclaim
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {/* MANAGER VIEW: Review Claims Queue */}
              {activeUser.role === 'manager' && (
                <div className="bg-zinc-900/30 border border-zinc-800/60 rounded-2xl p-6 space-y-6">
                  <div>
                    <h3 className="text-md font-semibold text-zinc-200 flex items-center gap-2">
                      <Clock className="h-4 w-4 text-amber-400 animate-pulse" />
                      Pending Claims Approvals Queue
                    </h3>
                    <p className="text-zinc-500 text-xs mt-1">Review team expense claims, check GST splits, and approve or reject submissions.</p>
                  </div>

                  {expenses.filter(e => e.status === 'pending').length === 0 ? (
                    <div className="border border-zinc-850 bg-zinc-950/10 rounded-xl p-8 flex flex-col items-center justify-center gap-2">
                      <CheckCircle className="h-8 w-8 text-emerald-400/60" />
                      <p className="text-zinc-400 text-sm font-semibold">Queue is all cleared!</p>
                      <p className="text-zinc-600 text-xs">No pending expense requests requiring review.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-zinc-850 border border-zinc-850/80 bg-zinc-950/20 rounded-xl overflow-hidden">
                      {expenses.filter(e => e.status === 'pending').map((exp) => {
                        const submitter = users.find(u => u.id === exp.userId);
                        const proj = projects.find(p => p.id === exp.projectId);
                        return (
                          <div key={exp.id} className="p-4 hover:bg-zinc-900/20 transition-all flex items-center justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-zinc-200">{exp.merchantName}</span>
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-800 text-zinc-400 uppercase tracking-wider">{exp.category}</span>
                              </div>
                              <div className="flex items-center gap-3 text-xs text-zinc-500 mt-1.5 flex-wrap">
                                <span>By: <strong className="text-zinc-400">{submitter?.name || 'Rahul Verma'}</strong></span>
                                <span>•</span>
                                <span>Project: <strong className="text-zinc-400">{proj?.name || 'Unknown'}</strong></span>
                                <span>•</span>
                                <span>Date: {exp.date}</span>
                              </div>
                              {exp.merchantGstin && (
                                <p className="text-[10px] font-mono text-emerald-400/80 mt-1">Merchant GSTIN: {exp.merchantGstin}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0">
                              <span className="text-md font-bold font-mono text-zinc-200 pr-2">₹{parseFloat(exp.amount).toFixed(2)}</span>
                              <button 
                                onClick={() => {
                                  setSelectedReviewExpense(exp);
                                  setShowRejectInput(false);
                                }}
                                className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-850 text-emerald-400 border border-zinc-800 hover:border-emerald-500/20 transition-all cursor-pointer"
                                title="Open Review Panel"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ADMIN VIEW: GST Audit Summary */}
              {activeUser.role === 'admin' && (
                <div className="bg-zinc-900/30 border border-zinc-800/60 rounded-2xl p-6 space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-md font-semibold text-zinc-200 flex items-center gap-2">
                        <FileSpreadsheet className="h-4 w-4 text-cyan-400" />
                        GST Credit Audit Ledger
                      </h3>
                      <p className="text-zinc-500 text-xs mt-1">Audit table showing CGST, SGST, and IGST breakdowns for approved reclaims.</p>
                    </div>
                    <button 
                      onClick={() => window.open('/api/expenses/export')}
                      className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-[0_0_10px_rgba(16,185,129,0.2)] cursor-pointer"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Tally Export (CSV)
                    </button>
                  </div>

                  {expenses.filter(e => e.status === 'approved').length === 0 ? (
                    <div className="border border-zinc-850 bg-zinc-950/10 rounded-xl p-8 text-center text-zinc-500 text-xs">
                      No approved expenses found. Audit trail is empty.
                    </div>
                  ) : (
                    <div className="border border-zinc-850/80 rounded-xl overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-zinc-900/60 border-b border-zinc-850 text-zinc-400 font-semibold uppercase tracking-wider">
                            <th className="p-3">Merchant</th>
                            <th className="p-3">GSTIN</th>
                            <th className="p-3 text-right">Taxable Amt</th>
                            <th className="p-3 text-right">CGST</th>
                            <th className="p-3 text-right">SGST</th>
                            <th className="p-3 text-right">IGST</th>
                            <th className="p-3 text-right font-bold">Total Claim</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-850 font-mono">
                          {expenses.filter(e => e.status === 'approved').map((exp) => {
                            const total = parseFloat(exp.amount);
                            const cgst = parseFloat(exp.cgst) || 0;
                            const sgst = parseFloat(exp.sgst) || 0;
                            const igst = parseFloat(exp.igst) || 0;
                            const base = (total - cgst - sgst - igst).toFixed(2);
                            return (
                              <tr key={exp.id} className="hover:bg-zinc-900/10 text-zinc-300">
                                <td className="p-3 font-sans font-medium">{exp.merchantName}</td>
                                <td className="p-3 text-zinc-500">{exp.merchantGstin || 'Unspecified'}</td>
                                <td className="p-3 text-right">₹{base}</td>
                                <td className="p-3 text-right text-cyan-400/90">{cgst > 0 ? `₹${cgst.toFixed(2)}` : '-'}</td>
                                <td className="p-3 text-right text-cyan-400/90">{sgst > 0 ? `₹${sgst.toFixed(2)}` : '-'}</td>
                                <td className="p-3 text-right text-indigo-400/90">{igst > 0 ? `₹${igst.toFixed(2)}` : '-'}</td>
                                <td className="p-3 text-right text-zinc-100 font-bold">₹{total.toFixed(2)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* SHARED TRANSACTIONS HISTORY TABLE */}
              <div className="bg-zinc-900/30 border border-zinc-800/60 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-md font-semibold text-zinc-200 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-emerald-400" />
                    Reclaim Claims History
                  </h3>
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider">All Submissions</span>
                </div>

                <div className="divide-y divide-zinc-900 border border-zinc-900 bg-zinc-950/20 rounded-xl overflow-hidden">
                  {expenses.map((exp) => {
                    const submitter = users.find(u => u.id === exp.userId);
                    return (
                      <div key={exp.id} className="p-4 hover:bg-zinc-900/10 flex items-center justify-between gap-4 text-sm transition-all">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-zinc-300">{exp.merchantName}</span>
                            <span className={`px-2 py-0.5 rounded-[5px] text-[10px] font-semibold border ${
                              exp.status === 'approved' 
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                                : exp.status === 'rejected' 
                                ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' 
                                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            }`}>
                              {exp.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-zinc-500 mt-1">
                            <span>{exp.date}</span>
                            <span>•</span>
                            <span>By: {submitter?.name || 'Rahul Verma'}</span>
                            {exp.rejectionReason && (
                              <>
                                <span>•</span>
                                <span className="text-rose-400">Reason: {exp.rejectionReason}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <span className="font-mono font-bold text-zinc-300">₹{parseFloat(exp.amount).toFixed(2)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* RIGHT SIDEBAR PANEL: Project Budgets / Company profile */}
            <div className="space-y-8">
              {/* Project Budgets Burn Meter */}
              <div className="bg-zinc-900/30 border border-zinc-800/60 rounded-2xl p-6 space-y-6">
                <div>
                  <h3 className="text-md font-semibold text-zinc-200 flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-emerald-400" />
                    Project Budget Meters
                  </h3>
                  <p className="text-zinc-500 text-xs mt-1">Real-time budget consumption based on approved claims.</p>
                </div>

                <div className="space-y-5">
                  {projects.map((proj) => {
                    const budget = parseFloat(proj.budget);
                    const spent = parseFloat(proj.spent);
                    const percent = Math.min(Math.round((spent / budget) * 100), 100);
                    const isOverBudget = spent > budget;
                    const isWarning = spent >= budget * 0.8 && spent <= budget;

                    return (
                      <div key={proj.id} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-zinc-300">{proj.name}</span>
                          <span className="font-mono text-zinc-400">
                            ₹{spent.toLocaleString('en-IN')} / ₹{budget.toLocaleString('en-IN')}
                          </span>
                        </div>
                        <div className="h-2 w-full bg-zinc-900 rounded-full overflow-hidden border border-zinc-800/40">
                          <div 
                            style={{ width: `${percent}%` }}
                            className={`h-full rounded-full transition-all duration-500 ${
                              isOverBudget 
                                ? 'bg-gradient-to-r from-rose-500 to-red-600 shadow-[0_0_8px_rgba(239,68,68,0.4)]' 
                                : isWarning 
                                ? 'bg-gradient-to-r from-amber-400 to-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]' 
                                : 'bg-gradient-to-r from-emerald-400 to-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]'
                            }`}
                          ></div>
                        </div>
                        <div className="flex justify-between text-[10px]">
                          <span className="text-zinc-500 font-mono">{percent}% utilized</span>
                          {isOverBudget ? (
                            <span className="text-rose-400 font-bold flex items-center gap-0.5">
                              <AlertCircle className="h-3 w-3" /> Budget Overrun
                            </span>
                          ) : isWarning ? (
                            <span className="text-amber-400 font-bold">Approaching Limit</span>
                          ) : (
                            <span className="text-emerald-400 font-semibold">Budget Safe</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Company Info Dashboard */}
              <div className="bg-zinc-900/30 border border-zinc-800/60 rounded-2xl p-6 space-y-4">
                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Company Profile Details</h3>
                <div className="space-y-3 text-xs">
                  <div className="flex justify-between py-2 border-b border-zinc-900/60">
                    <span className="text-zinc-500">Legal Entity</span>
                    <span className="font-semibold text-zinc-300">Apex Tech Solutions</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-zinc-900/60">
                    <span className="text-zinc-500">Corporate GSTIN</span>
                    <span className="font-mono font-semibold text-emerald-400">07AAAAA1111A1Z1</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-zinc-900/60">
                    <span className="text-zinc-500">Base State</span>
                    <span className="font-semibold text-zinc-300">Delhi (DL)</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-zinc-500">Active Staff</span>
                    <span className="font-semibold text-zinc-300">{users.length} Active Personas</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* MANAGER MODAL VIEW: Side-by-side Review Panel */}
          {selectedReviewExpense && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col md:flex-row">
                
                {/* Receipt Image Side */}
                <div className="md:w-1/2 bg-zinc-950 p-6 border-b md:border-b-0 md:border-r border-zinc-800 flex flex-col items-center justify-center min-h-[300px]">
                  <div className="w-full flex items-center justify-between mb-4">
                    <span className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Submitted Receipt Photo</span>
                    <span className="text-xs font-mono text-zinc-600">ID: {selectedReviewExpense.id.slice(0, 8)}</span>
                  </div>
                  <div className="relative w-full aspect-square md:h-80 border border-zinc-850 rounded-xl overflow-hidden bg-zinc-900 flex items-center justify-center">
                    {/* Simulated Receipt Preview */}
                    <div className="p-6 text-center space-y-3">
                      <FileText className="h-16 w-16 text-zinc-700 mx-auto" />
                      <div className="font-mono text-xs text-zinc-400 space-y-1">
                        <p className="font-bold text-sm text-zinc-200">{selectedReviewExpense.merchantName}</p>
                        <p>Date: {selectedReviewExpense.date}</p>
                        <p className="text-emerald-400 font-bold text-lg mt-2">₹{parseFloat(selectedReviewExpense.amount).toFixed(2)}</p>
                        {selectedReviewExpense.merchantGstin && <p className="text-[10px] text-zinc-500">GSTIN: {selectedReviewExpense.merchantGstin}</p>}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Claim Edit Details Side */}
                <div className="md:w-1/2 p-6 flex flex-col justify-between overflow-y-auto">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-md font-bold text-zinc-200">Reclaim Claim Form Verification</h4>
                      <button 
                        onClick={() => setSelectedReviewExpense(null)}
                        className="text-zinc-500 hover:text-zinc-300"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>

                    <div className="space-y-3 text-xs">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <span className="text-zinc-500">Merchant Name</span>
                          <p className="font-bold text-zinc-200">{selectedReviewExpense.merchantName}</p>
                        </div>
                        <div className="space-y-1">
                          <span className="text-zinc-500">Category</span>
                          <p className="font-bold text-zinc-200 capitalize">{selectedReviewExpense.category}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <span className="text-zinc-500">Transaction Date</span>
                          <p className="font-bold text-zinc-200">{selectedReviewExpense.date}</p>
                        </div>
                        <div className="space-y-1">
                          <span className="text-zinc-500">Total Claim Amount</span>
                          <p className="font-bold text-emerald-400 font-mono">₹{parseFloat(selectedReviewExpense.amount).toFixed(2)}</p>
                        </div>
                      </div>

                      <div className="p-3 bg-zinc-950/60 rounded-xl border border-zinc-850/80 space-y-2 font-mono text-[11px]">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">GST Tax Breakdown</span>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <span className="text-zinc-500 block">CGST</span>
                            <span className="text-zinc-300 font-bold">₹{parseFloat(selectedReviewExpense.cgst).toFixed(2)}</span>
                          </div>
                          <div>
                            <span className="text-zinc-500 block">SGST</span>
                            <span className="text-zinc-300 font-bold">₹{parseFloat(selectedReviewExpense.sgst).toFixed(2)}</span>
                          </div>
                          <div>
                            <span className="text-zinc-500 block">IGST</span>
                            <span className="text-zinc-300 font-bold">₹{parseFloat(selectedReviewExpense.igst).toFixed(2)}</span>
                          </div>
                        </div>
                        {selectedReviewExpense.merchantGstin && (
                          <div className="pt-2 border-t border-zinc-900 text-[10px]">
                            <span className="text-zinc-500">Merchant GSTIN: </span>
                            <span className="text-zinc-300 font-bold">{selectedReviewExpense.merchantGstin}</span>
                          </div>
                        )}
                      </div>

                      <div className="space-y-1">
                        <span className="text-zinc-500">Purpose / Notes</span>
                        <p className="text-zinc-300 leading-normal">{selectedReviewExpense.notes || 'No description provided.'}</p>
                      </div>
                    </div>

                    {showRejectInput && (
                      <div className="space-y-1.5 pt-2 animate-fade-in">
                        <label className="text-xs font-semibold text-rose-400">Rejection Reason</label>
                        <input 
                          type="text"
                          value={rejectionReason}
                          onChange={(e) => setRejectionReason(e.target.value)}
                          placeholder="e.g. GSTIN invalid or receipt image blurred"
                          className="w-full bg-zinc-950 border border-rose-500/30 focus:border-rose-500 rounded-xl px-4 py-2.5 text-sm text-zinc-100 outline-none"
                          required
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3 pt-6 border-t border-zinc-800 mt-6">
                    {showRejectInput ? (
                      <>
                        <button 
                          onClick={() => handleReviewAction('rejected')}
                          className="flex-1 bg-rose-500 hover:bg-rose-400 text-zinc-950 font-bold py-3 rounded-xl text-xs transition-all cursor-pointer"
                        >
                          Confirm Rejection
                        </button>
                        <button 
                          onClick={() => setShowRejectInput(false)}
                          className="px-4 py-3 rounded-xl text-xs font-semibold text-zinc-400 bg-zinc-900 border border-zinc-850 hover:bg-zinc-850 transition-all cursor-pointer"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button 
                          onClick={() => handleReviewAction('approved')}
                          className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold py-3 rounded-xl text-xs transition-all shadow-[0_0_10px_rgba(16,185,129,0.2)] cursor-pointer"
                        >
                          <Check className="h-4 w-4" />
                          Approve Claim
                        </button>
                        <button 
                          onClick={() => setShowRejectInput(true)}
                          className="flex-1 flex items-center justify-center gap-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 font-bold py-3 rounded-xl text-xs transition-all cursor-pointer"
                        >
                          <X className="h-4 w-4" />
                          Reject Claim
                        </button>
                      </>
                    )}
                  </div>
                </div>

              </div>
            </div>
          )}
        </div>
      )}

      {/* -------------------- 2. EXPENSES TAB -------------------- */}
      {currentTab === 'expenses' && (
        <div className="bg-zinc-900/30 border border-zinc-800/60 rounded-2xl p-6 space-y-6 animate-fade-in">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-bold text-zinc-100">Claims Registry</h2>
              <p className="text-zinc-500 text-xs mt-1">Audit ledger of all submitted expense claims.</p>
            </div>
            <span className="text-xs text-zinc-500">{expenses.length} claims total</span>
          </div>

          <div className="border border-zinc-850/80 rounded-xl overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-zinc-900/60 border-b border-zinc-850 text-zinc-400 font-semibold uppercase tracking-wider">
                  <th className="p-4">Date</th>
                  <th className="p-4">Merchant</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Notes</th>
                  <th className="p-4 text-right">CGST</th>
                  <th className="p-4 text-right">SGST</th>
                  <th className="p-4 text-right font-bold">Total (₹)</th>
                  <th className="p-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-850">
                {expenses.map((exp) => {
                  const cgst = parseFloat(exp.cgst) || 0;
                  const sgst = parseFloat(exp.sgst) || 0;
                  return (
                    <tr key={exp.id} className="hover:bg-zinc-900/10 text-zinc-300">
                      <td className="p-4 font-mono">{exp.date}</td>
                      <td className="p-4 font-semibold text-zinc-100">{exp.merchantName}</td>
                      <td className="p-4">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] bg-zinc-800/50 text-zinc-400 font-semibold border border-zinc-800">
                          {exp.category}
                        </span>
                      </td>
                      <td className="p-4 text-zinc-400 max-w-xs truncate">{exp.notes || '-'}</td>
                      <td className="p-4 text-right font-mono text-zinc-500">{cgst > 0 ? `₹${cgst.toFixed(2)}` : '-'}</td>
                      <td className="p-4 text-right font-mono text-zinc-500">{sgst > 0 ? `₹${sgst.toFixed(2)}` : '-'}</td>
                      <td className="p-4 text-right font-mono text-zinc-100 font-bold">₹{parseFloat(exp.amount).toFixed(2)}</td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                          exp.status === 'approved' 
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                            : exp.status === 'rejected' 
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' 
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        }`}>
                          {exp.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* -------------------- 3. PROJECTS TAB -------------------- */}
      {currentTab === 'projects' && (
        <div className="bg-zinc-900/30 border border-zinc-800/60 rounded-2xl p-6 space-y-6 animate-fade-in">
          <div>
            <h2 className="text-lg font-bold text-zinc-100">Project Portfolios</h2>
            <p className="text-zinc-500 text-xs mt-1">Manage project boundaries and monitor budget expenditures.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {projects.map((proj) => {
              const budget = parseFloat(proj.budget);
              const spent = parseFloat(proj.spent);
              const percent = Math.min(Math.round((spent / budget) * 100), 100);
              const isOver = spent > budget;
              const remaining = Math.max(budget - spent, 0);

              return (
                <div key={proj.id} className="bg-zinc-900/50 border border-zinc-850 rounded-2xl p-6 space-y-4 hover:border-emerald-500/10 transition-all">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-zinc-200 text-md">{proj.name}</h4>
                      <p className="text-[10px] text-zinc-500 mt-0.5">Created: {new Date(proj.createdAt).toLocaleDateString()}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      isOver ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    }`}>
                      {isOver ? 'Exceeded' : 'Active'}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-zinc-400">
                      <span>Spent: <strong>₹{spent.toLocaleString('en-IN')}</strong></span>
                      <span>Total: ₹{budget.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="h-2 w-full bg-zinc-950 rounded-full overflow-hidden border border-zinc-850">
                      <div 
                        style={{ width: `${percent}%` }}
                        className={`h-full rounded-full ${isOver ? 'bg-rose-500' : 'bg-emerald-400'}`}
                      ></div>
                    </div>
                    <div className="flex justify-between text-[9px] text-zinc-500">
                      <span>{percent}% allocated</span>
                      <span>₹{remaining.toLocaleString('en-IN')} remaining</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-zinc-850 flex items-center justify-between text-xs">
                    <span className="text-zinc-500">Approved Claims:</span>
                    <span className="font-bold text-zinc-300 font-mono">
                      {expenses.filter(e => e.projectId === proj.id && e.status === 'approved').length}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* -------------------- 4. TALLY EXPORTS TAB -------------------- */}
      {currentTab === 'exports' && (
        <div className="bg-zinc-900/30 border border-zinc-800/60 rounded-2xl p-6 space-y-6 animate-fade-in">
          <div>
            <h2 className="text-lg font-bold text-zinc-100">Accounting Integration</h2>
            <p className="text-zinc-500 text-xs mt-1">Export approved claims in formats compatible with Indian standard ERP software.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Tally Card */}
            <div className="bg-zinc-950/40 border border-zinc-850 rounded-2xl p-6 space-y-4 hover:border-emerald-500/10 transition-all flex flex-col justify-between">
              <div className="space-y-2">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 w-fit">
                  <FileSpreadsheet className="h-6 w-6" />
                </div>
                <h4 className="font-bold text-zinc-200 text-md">Tally ERP / Prime Export (CSV)</h4>
                <p className="text-zinc-500 text-xs leading-relaxed">
                  Generates a CSV layout pre-mapped with debit journals, CGST/SGST input ledgers, and credit reclaims liability accounts. Import directly into Tally via the Import Data wizard.
                </p>
              </div>

              <div className="pt-4 flex items-center justify-between">
                <span className="text-xs text-zinc-500">
                  {expenses.filter(e => e.status === 'approved').length} ledger entries ready
                </span>
                <button 
                  onClick={() => window.open('/api/expenses/export')}
                  disabled={expenses.filter(e => e.status === 'approved').length === 0}
                  className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:hover:bg-emerald-500 text-zinc-950 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-[0_0_10px_rgba(16,185,129,0.15)] cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download CSV file
                </button>
              </div>
            </div>

            {/* General Report */}
            <div className="bg-zinc-950/40 border border-zinc-850 rounded-2xl p-6 space-y-4 hover:border-cyan-500/10 transition-all flex flex-col justify-between">
              <div className="space-y-2">
                <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 w-fit">
                  <FileText className="h-6 w-6" />
                </div>
                <h4 className="font-bold text-zinc-200 text-md">Monthly Expense Audit Report</h4>
                <p className="text-zinc-500 text-xs leading-relaxed">
                  Generate a summary PDF containing complete auditor signatures, verified receipt attachments, and tax claims reconciliation tables.
                </p>
              </div>

              <div className="pt-4 flex items-center justify-between">
                <span className="text-xs text-zinc-400 bg-zinc-900 border border-zinc-850 px-2.5 py-1 rounded-lg">PDF Format</span>
                <button 
                  onClick={() => alert('PDF generation is simulated for this demo. Download the Tally CSV to view formatted claims.')}
                  className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 hover:border-cyan-500/30 text-zinc-300 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Download Report
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
