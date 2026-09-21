"use client";

import React, { useState, useRef, useEffect } from "react";
import { formatMoney } from "@/lib/decimal";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Camera,
  Upload,
  Mic,
  Square,
  FileText,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Check,
  X,
  RefreshCw,
  Settings,
  HelpCircle,
  Eye,
  Edit3,
  Sliders,
  Info,
  ExternalLink,
  Copy,
  ChevronDown,
  ChevronUp,
  Zap,
  BookOpen,
  Image as ImageIcon,
  Trash2,
  Languages,
  Save,
} from "lucide-react";
import { BrandPageLoader } from "@/components/ui/loader";
import { generateSampleSlip } from "@/lib/sampleImageGenerator";

export default function AIDataEntryPage() {
  const [activeTab, setActiveTab] = useState<"IMAGE" | "VOICE" | "TEXT">("IMAGE");

  // Input states
  const [textInput, setTextInput] = useState(
    "1. Ali Traders ko 25,000 ki sale hui, 10,000 cash received.\n2. Ahmed se 15,000 ka maal purchase kiya, payment baqi hai.\n3. Shop electricity 3,000 paid cash.\n4. Bilal ne purana udhaar 8,000 diya."
  );
  const [isRecording, setIsRecording] = useState(false);
  const [voiceLanguage, setVoiceLanguage] = useState<"ur-PK" | "en-PK">("ur-PK");
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [cameraActive, setCameraActive] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageSourceName, setImageSourceName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [optimizedSizeKb, setOptimizedSizeKb] = useState<number | null>(null);
  const [extractElapsed, setExtractElapsed] = useState(0);

  // Review & Extraction State
  const [extracting, setExtracting] = useState(false);
  const [extractionResult, setExtractionResult] = useState<any | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<any | null>(null);
  const [rawOcrText, setRawOcrText] = useState<string>("");
  const [isEditingOcr, setIsEditingOcr] = useState(false);
  const [engineUsed, setEngineUsed] = useState<string>("TESSERACT_OCR");
  const [postingId, setPostingId] = useState<string | null>(null);
  const [postedMap, setPostedMap] = useState<Record<string, boolean>>({});

  // Settings & Modals
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [isGuideModalOpen, setIsGuideModalOpen] = useState(false);
  const [customApiKey, setCustomApiKey] = useState("");
  const [selectedSampleType, setSelectedSampleType] = useState<"DIARY" | "BILL" | "EXPENSE" | "PURCHASE">("DIARY");

  // WebRTC Video element ref
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recognitionRef = useRef<any>(null);

  // Load API key from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedKey = localStorage.getItem("smartbiz_ai_key") || "";
      if (savedKey) setCustomApiKey(savedKey);
    }
  }, []);

  // Global Clipboard Paste Handler (Ctrl + V to paste any screenshot or copied image)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith("image/")) {
          const file = items[i].getAsFile();
          if (file) {
            setImageSourceName("Pasted from Clipboard (اسکرین شاٹ)");
            handleImageFile(file);
            break;
          }
        }
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

  // Setup Web Speech API if supported
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recog = new SpeechRecognition();
        recog.continuous = true;
        recog.interimResults = true;
        recog.lang = voiceLanguage;
        recog.onresult = (event: any) => {
          let current = "";
          for (let i = 0; i < event.results.length; i++) {
            current += event.results[i][0].transcript + " ";
          }
          setVoiceTranscript(current);
          setTextInput(current);
        };
        recognitionRef.current = recog;
      }
    }
  }, [voiceLanguage]);

  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  const optimizeImageForOcr = (file: File): Promise<{ dataUrl: string; sizeKb: number }> => {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 2200;
        const MAX_HEIGHT = 2600;
        let width = img.width;
        let height = img.height;

        if (width > MAX_WIDTH || height > MAX_HEIGHT) {
          const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          const reader = new FileReader();
          reader.onload = () => resolve({ dataUrl: reader.result as string, sizeKb: Math.round(file.size / 1024) });
          reader.readAsDataURL(file);
          return;
        }

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const optimizedDataUrl = canvas.toDataURL("image/jpeg", 0.92);
        const sizeKb = Math.round((optimizedDataUrl.length * 3) / 4 / 1024);
        resolve({ dataUrl: optimizedDataUrl, sizeKb });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        const reader = new FileReader();
        reader.onload = () => resolve({ dataUrl: reader.result as string, sizeKb: Math.round(file.size / 1024) });
        reader.readAsDataURL(file);
      };
      img.src = url;
    });
  };

  const handleImageFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      alert("براہ کرم درست تصویر والی فائل (PNG, JPG, JPEG, WebP) منتخب کریں۔");
      return;
    }
    setImageSourceName(file.name || "Uploaded Image");
    try {
      const { dataUrl, sizeKb } = await optimizeImageForOcr(file);
      setOptimizedSizeKb(sizeKb);
      setImagePreview(dataUrl);
      setActiveTab("IMAGE");
      setExtractionResult(null);
      setRawOcrText("");
    } catch {
      const reader = new FileReader();
      reader.onload = () => {
        setImagePreview(reader.result as string);
        setActiveTab("IMAGE");
        setExtractionResult(null);
        setRawOcrText("");
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleImageFile(file);
    }
  };

  const saveApiKey = (key: string) => {
    setCustomApiKey(key);
    if (typeof window !== "undefined") {
      localStorage.setItem("smartbiz_ai_key", key);
    }
    setIsKeyModalOpen(false);
  };

  const toggleRecording = () => {
    if (isRecording) {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) { console.error(e); }
      }
      setIsRecording(false);
    } else {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.lang = voiceLanguage;
          recognitionRef.current.start();
        } catch (e) {
          console.error(e);
        }
      } else {
        const fallbackSpeech =
          voiceLanguage === "ur-PK"
            ? "علی ٹریڈرز کو ۲۵ ہزار کی سیل ہوئی، ۱۰ ہزار نقد ملا۔"
            : "Aaj Ali Traders ko 25 hazar ki sale hui, 10 hazar cash mila.";
        setVoiceTranscript(fallbackSpeech);
        setTextInput(fallbackSpeech);
      }
      setIsRecording(true);
    }
  };

  const clearVoiceRecording = () => {
    if (isRecording && recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
      setIsRecording(false);
    }
    setVoiceTranscript("");
  };

  const startCamera = async () => {
    try {
      setCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      alert("Could not access camera. Please allow camera permissions or upload an image file.");
      setCameraActive(false);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/png");
        setImageSourceName("Camera Captured Photo");
        setImagePreview(dataUrl);
        setExtractionResult(null);
        setRawOcrText("");
        const stream = videoRef.current.srcObject as MediaStream;
        stream?.getTracks().forEach((t) => t.stop());
        setCameraActive(false);
      }
    }
  };

  const handleLoadSample = (type: "DIARY" | "BILL" | "EXPENSE" | "PURCHASE") => {
    setSelectedSampleType(type);
    const names = {
      DIARY: "Sample: Daily Diary Slip (روزنامچہ ڈائری)",
      BILL: "Sample: Printed Cash Memo (سیلز کیش میمو)",
      EXPENSE: "Sample: Petty Expense Voucher (اخراجات واؤچر)",
      PURCHASE: "Sample: Wholesale Vendor Bill (سپلائر انوائس)",
    };
    setImageSourceName(names[type]);
    const dataUrl = generateSampleSlip(type);
    setImagePreview(dataUrl);
    setActiveTab("IMAGE");
    setExtractionResult(null);
    setRawOcrText("");
  };

  const handleExtract = async (overrideText?: string) => {
    setExtracting(true);
    setExtractElapsed(0);
    const timerInterval = setInterval(() => {
      setExtractElapsed((prev) => prev + 1);
    }, 1000);

    try {
      let textToExtract: string | undefined = undefined;
      if (overrideText) {
        textToExtract = overrideText;
      } else if (activeTab === "TEXT") {
        textToExtract = textInput;
      } else if (activeTab === "VOICE") {
        textToExtract = voiceTranscript;
      }

      const res = await fetch("/api/ai/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: overrideText ? "TEXT" : activeTab,
          text: textToExtract,
          imageUrl: !overrideText && activeTab === "IMAGE" ? imagePreview : undefined,
          customApiKey: customApiKey.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setExtractionResult(json.data);
        if (typeof json.data.rawOcrText === "string") {
          setRawOcrText(json.data.rawOcrText);
        } else if (overrideText) {
          setRawOcrText(overrideText);
        }
        if (json.data.engineUsed) {
          setEngineUsed(json.data.engineUsed);
        }
      } else {
        alert(json.error || "Failed to extract transactions");
      }
    } catch (err: any) {
      alert(`Error extracting entries: ${err.message}`);
    } finally {
      clearInterval(timerInterval);
      setExtracting(false);
    }
  };

  const handleReanalyzeOcr = () => {
    handleExtract(rawOcrText);
    setIsEditingOcr(false);
  };

  const handleDeleteEntry = (transactionId: string) => {
    if (!extractionResult) return;
    const remaining = extractionResult.transactions?.filter((t: any) => t.id !== transactionId);
    if (!remaining || remaining.length === 0) {
      setExtractionResult(null);
    } else {
      setExtractionResult({ ...extractionResult, transactions: remaining });
    }
  };

  const handleClearAllEntries = () => {
    if (confirm("کیا آپ واقعی تمام اندراجات خارج کرنا چاہتے ہیں؟ (Clear all extracted entries?)")) {
      setExtractionResult(null);
      setPostedMap({});
    }
  };

  const handleStartEdit = (t: any) => {
    setEditingTransaction({
      ...t,
      totalAmount: t.totalAmount ?? 0,
      paidAmount: t.paidAmount ?? 0,
      remainingAmount: t.remainingAmount ?? Math.max(0, (t.totalAmount ?? 0) - (t.paidAmount ?? 0)),
      partyName: t.partyName ?? "",
      paymentMethod: t.paymentMethod ?? "CASH",
      type: t.type ?? "SALE",
      notes: t.notes ?? "",
    });
  };

  const handleSaveEditedEntry = (updated: any) => {
    if (!extractionResult) return;
    const total = Number(updated.totalAmount) || 0;
    const paid = Number(updated.paidAmount) || 0;
    const remaining = Math.max(0, total - paid);

    const finalTx = {
      ...updated,
      totalAmount: total,
      paidAmount: paid,
      remainingAmount: remaining,
      needsConfirmation: false,
      warnings: [],
    };

    const updatedList = extractionResult.transactions.map((t: any) =>
      t.id === finalTx.id ? finalTx : t
    );
    setExtractionResult({ ...extractionResult, transactions: updatedList });
    setEditingTransaction(null);
  };

  const handlePostEntry = async (transactionId: string, customOverrides?: any) => {
    setPostingId(transactionId);
    try {
      const currentTx = extractionResult?.transactions?.find((t: any) => t.id === transactionId);
      const overrides = customOverrides || (currentTx ? {
        type: currentTx.type,
        partyName: currentTx.partyName,
        totalAmount: currentTx.totalAmount,
        paidAmount: currentTx.paidAmount,
        paymentMethod: currentTx.paymentMethod,
      } : undefined);

      const res = await fetch("/api/ai/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          extractedTransactionId: transactionId,
          overrides,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setPostedMap((prev) => ({ ...prev, [transactionId]: true }));
      } else {
        alert(json.error);
      }
    } catch (err: any) {
      alert(`Error posting entry: ${err.message}`);
    } finally {
      setPostingId(null);
    }
  };

  const handlePostAllValid = async () => {
    if (!extractionResult) return;
    for (const t of extractionResult.transactions) {
      if (!postedMap[t.id] && !t.needsConfirmation) {
        await handlePostEntry(t.id);
      }
    }
  };

  const sampleFormats = [
    {
      id: "DIARY" as const,
      name: "Daily Diary Slip",
      urdu: "روزنامچہ ڈائری",
      badge: "Handwritten Diary",
      desc: "Pakistani trading diary with sales, purchases, bank transfers, and customer recovery.",
      color: "border-blue-300 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20",
      sampleText: `1. Ali Traders ko 25,000 ki sale hui, 10,000 cash received
2. Ahmed se 15,000 ka maal purchase kiya, payment baqi hai
3. Shop electricity 3,000 paid cash
4. Bilal ne purana udhaar 8,000 diya
5. IPH 11 NON 64 - HBL 36,000
6. Pixel 7A - Cash 35,000
7. Staff lunch and tea - 650 cash paid
8. HYD Rec - HBL 50,000`,
    },
    {
      id: "BILL" as const,
      name: "Printed Cash Memo",
      urdu: "سیلز کیش میمو",
      badge: "Cash Memo / Bill",
      desc: "Printed sales receipt with item details, subtotal, partial cash received, and balance due.",
      color: "border-emerald-300 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20",
      sampleText: `CASH MEMO / SALES INVOICE
Customer: Usman Telecom
1. Samsung Galaxy S25 256GB - Qty 1 - 285,000
2. Fast Charger 45W Original - Qty 2 - 9,000
Total Bill Amount: Rs. 294,000
Cash Received: Rs. 150,000
Balance Due: Rs. 144,000`,
    },
    {
      id: "EXPENSE" as const,
      name: "Petty Expense Voucher",
      urdu: "روزانہ اخراجات واؤچر",
      badge: "Daily Expenses",
      desc: "Daily business expenses like electricity, tea, generator petrol, and transit courier.",
      color: "border-amber-300 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20",
      sampleText: `DAILY EXPENSE VOUCHER
1. Shop Electricity Bill - Rs. 12,500 Cash
2. Staff Tea & Refreshment - Rs. 850 Cash
3. Generator Petrol / Fuel - Rs. 2,500 Cash
4. Transport Delivery Courier - Rs. 1,500 HBL Bank
5. Cleaning & Shop Supplies - Rs. 600 Cash
TOTAL EXPENSES: Rs. 17,950`,
    },
    {
      id: "PURCHASE" as const,
      name: "Wholesale Vendor Bill",
      urdu: "سپلائر خریداری بل",
      badge: "Inward Stock",
      desc: "Vendor inventory inward with item quantities, unit rates, bank advance, and credit payable.",
      color: "border-purple-300 bg-purple-50/50 dark:border-purple-800 dark:bg-purple-950/20",
      sampleText: `VENDOR PURCHASE BILL
Supplier: Ahmed Tech Wholesale
1. iPhone 13 128GB Apple - Qty 5 - Rate 125,000 - Total 625,000
2. Tecno Camon 40 Pro - Qty 10 - Rate 42,000 - Total 420,000
Gross Inward Value: Rs. 1,045,000
Paid via Meezan Bank: Rs. 500,000
Remaining Payable: Rs. 545,000`,
    },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Hidden Master File Input accessible from anywhere */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        className="hidden"
        aria-label="Upload document image"
      />

      {/* Top Banner & Action Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              AI Smart Document & OCR Data Entry
            </h2>
            <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300 flex items-center gap-1">
              <Zap className="h-3 w-3" /> Smart Vision & OCR
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Handwritten diary slips, printed cash memos, receipts & Urdu notes converted to double-entry accounting ledgers.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Primary Upload Button */}
          <Button
            variant="primary"
            size="sm"
            onClick={triggerFileInput}
            className="flex items-center gap-1.5 shadow-sm font-bold bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Upload className="h-3.5 w-3.5" />
            <span>Upload Image (تصویر اپلوڈ کریں)</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsGuideModalOpen(true)}
            className="flex items-center gap-1.5"
          >
            <BookOpen className="h-3.5 w-3.5 text-blue-600" />
            <span>Format Guidelines (رہنمائی)</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsKeyModalOpen(true)}
            className="flex items-center gap-1.5 relative"
          >
            <Sliders className="h-3.5 w-3.5 text-slate-600 dark:text-slate-300" />
            <span>AI Engine & Key</span>
            {customApiKey && (
              <span className="h-2 w-2 rounded-full bg-emerald-500 absolute -top-0.5 -right-0.5 ring-2 ring-white dark:ring-slate-900" />
            )}
          </Button>
        </div>
      </div>

      {/* SAMPLE FORMATS & DIRECT UPLOAD SHOWCASE SECTION */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-3 gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                Upload Your Own Slip OR Select a Test Sample
              </h3>
              <p className="text-[11px] text-slate-400">
                Upload your mobile photo directly OR click any sample to test the AI reader:
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={triggerFileInput}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 border border-blue-200 dark:bg-blue-950 dark:border-blue-900 dark:text-blue-300 shadow-sm transition"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Upload Custom Slip / اپنی پرچی اپلوڈ کریں</span>
            </button>
          </div>
        </div>

        {/* 5-Card Grid: Card 1 is Custom Upload, Cards 2-5 are Authentic Samples */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {/* CARD 1: DIRECT CUSTOM UPLOAD CARD */}
          <div
            onClick={triggerFileInput}
            className="cursor-pointer group flex flex-col justify-between rounded-xl border-2 border-dashed border-blue-500 bg-blue-50/50 p-3.5 transition hover:border-blue-600 hover:bg-blue-100/60 dark:border-blue-700 dark:bg-blue-950/40 dark:hover:border-blue-500 hover:shadow-md ring-2 ring-blue-500/20"
          >
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-blue-900 dark:text-blue-100 flex items-center gap-1.5">
                  <Upload className="h-4 w-4 text-blue-600" /> Upload Your Slip
                </span>
                <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 bg-blue-200/70 dark:bg-blue-900/80 px-1.5 py-0.5 rounded">
                  اپنی پرچی
                </span>
              </div>
              <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
                Upload any real photo from mobile gallery, WhatsApp, or PC camera.
              </p>
            </div>

            <div className="flex items-center gap-1.5 pt-2 border-t border-blue-200 dark:border-blue-800/60">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  triggerFileInput();
                }}
                className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700"
              >
                <Upload className="h-3 w-3" /> Select File
              </button>
              <button
                type="button"
                title="Open Camera"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveTab("IMAGE");
                  startCamera();
                }}
                className="rounded-lg bg-white p-1.5 text-slate-700 hover:bg-slate-100 border border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
              >
                <Camera className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* CARDS 2-5: SAMPLES */}
          {sampleFormats.map((sample) => (
            <div
              key={sample.id}
              className={`flex flex-col justify-between rounded-xl border p-3.5 transition hover:shadow-md ${sample.color}`}
            >
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    {sample.name}
                  </span>
                  <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                    {sample.urdu}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
                  {sample.desc}
                </p>
              </div>

              <div className="flex items-center gap-1.5 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                <button
                  type="button"
                  onClick={() => handleLoadSample(sample.id)}
                  className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-xs font-bold text-blue-700 shadow-sm border border-blue-200 hover:bg-blue-50 dark:bg-slate-800 dark:border-blue-900 dark:text-blue-300 dark:hover:bg-slate-700"
                >
                  <Eye className="h-3 w-3" /> Load Sample
                </button>
                <button
                  type="button"
                  title="Copy Sample Text"
                  onClick={() => {
                    navigator.clipboard.writeText(sample.sampleText);
                    setTextInput(sample.sampleText);
                    setActiveTab("TEXT");
                  }}
                  className="rounded-lg bg-white/80 p-1.5 text-slate-600 hover:bg-white hover:text-slate-900 border border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Input Mode Tabs */}
      <div className="flex rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <button
          onClick={() => setActiveTab("IMAGE")}
          className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-semibold transition ${
            activeTab === "IMAGE"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          }`}
        >
          <Camera className="h-4 w-4" />
          <span>Picture & OCR Scanner (تصویر اپلوڈ اور اسکین)</span>
        </button>

        <button
          onClick={() => setActiveTab("TEXT")}
          className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-semibold transition ${
            activeTab === "TEXT"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>Daily Diary Text (روزنامچہ نوٹس)</span>
        </button>

        <button
          onClick={() => setActiveTab("VOICE")}
          className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-semibold transition ${
            activeTab === "VOICE"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          }`}
        >
          <Mic className="h-4 w-4" />
          <span>Voice Accounting (بول کر اندراج)</span>
        </button>
      </div>

      {/* IMAGE / SCANNER INPUT */}
      {activeTab === "IMAGE" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle>Document & Receipt OCR Recognition</CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">
                Upload or capture any bill, handwritten memo, or diary slip. Smart engine reads text automatically.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={triggerFileInput}
                className="text-xs flex items-center gap-1.5"
              >
                <Upload className="h-3.5 w-3.5 text-blue-600" />
                <span>Upload New File</span>
              </Button>

              <span className="text-[10px] font-medium px-2 py-1 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                Engine: {customApiKey ? "Gemini AI Vision" : "Local Tesseract OCR"}
              </span>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {cameraActive ? (
              <div className="space-y-3">
                <video ref={videoRef} autoPlay playsInline className="w-full max-h-80 rounded-xl bg-black object-contain mx-auto" />
                <div className="flex gap-2 justify-center">
                  <Button variant="danger" size="sm" onClick={() => setCameraActive(false)}>
                    Cancel Camera
                  </Button>
                  <Button variant="primary" size="sm" onClick={capturePhoto}>
                    Capture Photo
                  </Button>
                </div>
              </div>
            ) : imagePreview ? (
              <div className="space-y-3">
                {/* Source title badge */}
                <div className="flex items-center justify-between px-3 py-2 bg-slate-100 dark:bg-slate-800/70 rounded-xl text-xs border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-medium truncate max-w-md">
                    <ImageIcon className="h-4 w-4 text-blue-600 shrink-0" />
                    <span className="truncate">{imageSourceName || "Loaded Document Image"}</span>
                  </div>
                  <button
                    type="button"
                    onClick={triggerFileInput}
                    className="text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1 shrink-0"
                  >
                    <Upload className="h-3.5 w-3.5" /> دوسری تصویر اپلوڈ کریں
                  </button>
                </div>

                <div className="relative border rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-900 max-h-96 flex items-center justify-center p-2">
                  <img
                    src={imagePreview}
                    alt="Document preview"
                    className="max-h-92 rounded-lg object-contain mx-auto shadow-sm border border-slate-200 dark:border-slate-800"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setImagePreview(null);
                      setImageSourceName(null);
                      setExtractionResult(null);
                      setRawOcrText("");
                    }}
                    className="absolute top-3 right-3 rounded-full bg-rose-600 p-1.5 text-white shadow-md hover:bg-rose-700"
                    title="Remove Photo"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" size="sm" onClick={triggerFileInput}>
                      <Upload className="h-3.5 w-3.5 mr-1 text-blue-600" />
                      Upload Other Image (دوسری تصویر)
                    </Button>
                    <Button variant="outline" size="sm" onClick={startCamera}>
                      <Camera className="h-3.5 w-3.5 mr-1" /> Use Camera
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setImagePreview(null);
                        setImageSourceName(null);
                        setExtractionResult(null);
                        setRawOcrText("");
                      }}
                    >
                      <X className="h-3.5 w-3.5 mr-1 text-rose-600" /> Remove
                    </Button>
                  </div>

                  <Button variant="primary" size="md" onClick={() => handleExtract()} isLoading={extracting} className="shadow-sm">
                    <Sparkles className="h-4 w-4 mr-1.5" />
                    Read Image & Extract Entries
                  </Button>
                </div>
              </div>
            ) : (
              /* INTERACTIVE DRAG & DROP & CLICK UPLOAD ZONE */
              <div
                onClick={triggerFileInput}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`cursor-pointer flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 text-center transition-all ${
                  isDragging
                    ? "border-blue-600 bg-blue-100/60 dark:bg-blue-950/60 scale-[1.01]"
                    : "border-slate-300 hover:border-blue-500 bg-slate-50/50 hover:bg-blue-50/30 dark:border-slate-700 dark:bg-slate-900/50"
                }`}
              >
                <div className="rounded-full bg-blue-100 p-4 text-blue-600 dark:bg-blue-950 dark:text-blue-400 mb-3 shadow-inner">
                  <Upload className="h-8 w-8 animate-pulse" />
                </div>
                <p className="text-base font-bold text-slate-800 dark:text-slate-200">
                  Click Anywhere to Upload or Drag & Drop Image Here
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 mb-2 font-medium">
                  اپنی پرچی، بل، رسید یا ڈائری کی تصویر یہاں اپلوڈ کریں
                </p>
                <p className="text-[11px] text-slate-400 mb-6 max-w-md">
                  Supports mobile camera photos, WhatsApp receipts, handwritten diary pages, and bills (PNG, JPG, JPEG, WebP). Or press <kbd className="rounded bg-slate-200 px-1.5 py-0.5 font-mono text-[10px] dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold">Ctrl + V</kbd> anywhere to paste screenshot.
                </p>

                <div className="flex flex-wrap items-center justify-center gap-3">
                  <Button
                    variant="primary"
                    size="md"
                    onClick={(e) => {
                      e.stopPropagation();
                      triggerFileInput();
                    }}
                    className="shadow-sm font-bold bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Upload className="h-4 w-4 mr-1.5" />
                    Browse & Upload Image File (فائل منتخب کریں)
                  </Button>

                  <Button
                    variant="outline"
                    size="md"
                    onClick={(e) => {
                      e.stopPropagation();
                      startCamera();
                    }}
                  >
                    <Camera className="h-4 w-4 mr-1.5 text-slate-600 dark:text-slate-300" />
                    Use Web Camera (کیمرہ کھولیں)
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* TEXT INPUT */}
      {activeTab === "TEXT" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle>Daily Diary & Notes in Urdu, Roman Urdu or English</CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">
                Type or paste entries in conversational Urdu/English format.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() =>
                  setTextInput(
                    "HYD Rec - HBL 50000\nImran c/o Asif Rec - HBL 10000\nSami Rec - HBL 265000\nIPH 11 NON 64 - HBL 36000\nPixel 7A - 35000\nRelme C85 Pro - 54000\nExpense - 500\nSpark 10C - 21000"
                  )
                }
                className="rounded-lg bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-300"
              >
                📋 Mobile Market Diary
              </button>
              <button
                type="button"
                onClick={() =>
                  setTextInput(
                    "1. Ali Traders ko 25,000 ki sale hui, 10,000 cash received.\n2. Ahmed se 15,000 ka maal purchase kiya, payment baqi hai.\n3. Shop electricity 3,000 paid cash.\n4. Bilal ne purana udhaar 8,000 diya."
                  )
                }
                className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
              >
                Roman Urdu Standard
              </button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Quick Banner to switch to Image Upload */}
            <div className="flex items-center justify-between rounded-xl bg-blue-50 p-2.5 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-xs">
              <div className="flex items-center gap-2 text-blue-800 dark:text-blue-200">
                <Camera className="h-4 w-4 text-blue-600 shrink-0" />
                <span>Have a picture of your diary or receipt instead of typing?</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setActiveTab("IMAGE");
                  setTimeout(() => triggerFileInput(), 50);
                }}
                className="text-xs font-bold text-blue-700 border-blue-300 hover:bg-blue-100 dark:text-blue-300 dark:border-blue-800 shrink-0"
              >
                <Upload className="h-3 w-3 mr-1" /> Upload Diary Image (تصویر اپلوڈ کریں)
              </Button>
            </div>

            <textarea
              rows={6}
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Enter daily transactions e.g.
HYD Rec - HBL 50000
Ali Traders 25000 sale, 10000 cash mila
Ahmed se 15000 purchase udhar
IPH 11 NON 64 - 36000
Expense tea - 500"
              className="w-full rounded-xl border border-slate-300 bg-slate-50/50 p-3.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white font-mono"
            />
            <div className="flex justify-between items-center pt-2">
              <span className="text-[11px] text-slate-400">
                AI extracts parties, mobile items, prices, bank/cash receipts, credit balances, and expenses.
              </span>
              <Button variant="primary" size="md" onClick={() => handleExtract()} isLoading={extracting}>
                <Sparkles className="h-4 w-4 mr-1.5" />
                Analyze & Extract Entries
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* VOICE INPUT */}
      {activeTab === "VOICE" && (
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-2 gap-2">
            <div>
              <CardTitle>Voice Accounting Assistant (آواز کے ذریعے اندراج)</CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">
                Speak transactions in Urdu, Roman Urdu, or English. Smart NLP extracts party, amount, and payment status.
              </p>
            </div>

            {/* Language Selector */}
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setVoiceLanguage("ur-PK");
                  if (recognitionRef.current) recognitionRef.current.lang = "ur-PK";
                }}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition ${
                  voiceLanguage === "ur-PK"
                    ? "bg-white text-blue-700 shadow-sm dark:bg-slate-700 dark:text-blue-300"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
              >
                اردو آواز (Urdu)
              </button>
              <button
                type="button"
                onClick={() => {
                  setVoiceLanguage("en-PK");
                  if (recognitionRef.current) recognitionRef.current.lang = "en-PK";
                }}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition ${
                  voiceLanguage === "en-PK"
                    ? "bg-white text-blue-700 shadow-sm dark:bg-slate-700 dark:text-blue-300"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
              >
                Roman / English (رومن اردو)
              </button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-center py-5">
            <div className="flex flex-col items-center justify-center">
              <button
                onClick={toggleRecording}
                className={`h-20 w-20 rounded-full flex items-center justify-center transition-all shadow-xl ${
                  isRecording
                    ? "bg-rose-600 text-white animate-pulse ring-8 ring-rose-200 dark:ring-rose-950 scale-105"
                    : "bg-blue-600 text-white hover:bg-blue-700 hover:scale-105"
                }`}
              >
                {isRecording ? <Square className="h-8 w-8" /> : <Mic className="h-8 w-8" />}
              </button>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-3">
                {isRecording ? (
                  <span className="text-rose-600 flex items-center gap-1.5 justify-center">
                    <span className="h-2 w-2 rounded-full bg-rose-600 animate-ping" />
                    Recording... Speak clearly ({voiceLanguage === "ur-PK" ? "اردو" : "Roman Urdu / English"})
                  </span>
                ) : (
                  "Click Microphone to Speak (مائیکروفون پر کلک کریں اور بولیں)"
                )}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Press button to start speaking. Click again when finished.
              </p>
            </div>

            {/* Editable Transcript Textarea */}
            <div className="text-left space-y-2 max-w-2xl mx-auto">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-blue-600" />
                  <span>Spoken Transcript (بولا گیا کلام - آپ یہاں تحریر درست بھی کر سکتے ہیں):</span>
                </label>
                {voiceTranscript && (
                  <button
                    type="button"
                    onClick={clearVoiceRecording}
                    className="text-[11px] font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1"
                  >
                    <Trash2 className="h-3 w-3" /> Clear & Re-record (آواز دوبارہ ریکارڈ کریں)
                  </button>
                )}
              </div>

              <textarea
                rows={3}
                value={voiceTranscript}
                onChange={(e) => {
                  setVoiceTranscript(e.target.value);
                  setTextInput(e.target.value);
                }}
                placeholder={
                  voiceLanguage === "ur-PK"
                    ? "بولیں مثلاً: علی ٹریڈرز کو ۲۵ ہزار کی سیل ہوئی، ۱۰ ہزار نقد ملا۔"
                    : "Speak or type e.g.: Aaj Ali Traders ko 25 hazar ki sale hui, 10 hazar cash mila."
                }
                className="w-full rounded-xl border border-slate-300 bg-slate-50/70 p-3.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
            </div>

            {/* Quick Suggestions Pills */}
            <div className="max-w-2xl mx-auto pt-1">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  💡 Quick Voice Templates (آزمانے کے لیے کلک کریں):
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 justify-center sm:justify-start">
                <button
                  type="button"
                  onClick={() => {
                    const text = "Ali Traders ko 25 hazar ki sale hui, 10 hazar cash mila";
                    setVoiceTranscript(text);
                    setTextInput(text);
                  }}
                  className="rounded-lg bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-900"
                >
                  Sale: Ali Traders 25 hazar (10k cash)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const text = "علی ٹریڈرز کو ۲۵ ہزار کی سیل ہوئی ۱۰ ہزار نقد ملا";
                    setVoiceTranscript(text);
                    setTextInput(text);
                  }}
                  className="rounded-lg bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-900"
                >
                  اردو سیل: ۲۵ ہزار سیل (۱۰ ہزار نقد)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const text = "Ahmed se 15 hazar ka maal khareeda udhar";
                    setVoiceTranscript(text);
                    setTextInput(text);
                  }}
                  className="rounded-lg bg-purple-50 px-2.5 py-1 text-[11px] font-medium text-purple-700 hover:bg-purple-100 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-900"
                >
                  Purchase: Ahmed se 15 hazar udhar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const text = "Shop electricity bill 3500 cash paid";
                    setVoiceTranscript(text);
                    setTextInput(text);
                  }}
                  className="rounded-lg bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-900"
                >
                  Expense: Electricity 3500 cash
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const text = "Bilal ne 8000 purana udhar wapas diya";
                    setVoiceTranscript(text);
                    setTextInput(text);
                  }}
                  className="rounded-lg bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900"
                >
                  Recovery: Bilal 8000 udhar wapsi
                </button>
              </div>
            </div>

            {voiceTranscript && (
              <div className="pt-2 flex flex-wrap justify-center gap-3">
                <Button variant="outline" size="md" onClick={clearVoiceRecording}>
                  <Trash2 className="h-4 w-4 mr-1 text-rose-600" />
                  Discard Voice (آواز ختم کریں)
                </Button>
                <Button variant="primary" size="md" onClick={() => handleExtract()} isLoading={extracting} className="shadow-md">
                  <Sparkles className="h-4 w-4 mr-1.5" />
                  Extract Transactions from Speech (اندراج حاصل کریں)
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* AI EXTRACTION IN PROGRESS LOADER */}
      {extracting && (
        <div className="rounded-2xl border border-indigo-200 bg-white p-8 dark:border-indigo-900/50 dark:bg-slate-900 shadow-sm">
          <BrandPageLoader
            message={`High-Speed Smart OCR Reading Document (${extractElapsed}s)...`}
            submessage={
              optimizedSizeKb
                ? `Optimized to ${optimizedSizeKb}KB for high speed. High-speed OCR engine extracting ledger lines, mobile models, and amounts...`
                : "Scanning document lines, detecting Pakistani trading items, party balances, and voucher amounts..."
            }
          />
        </div>
      )}

      {/* RAW OCR TEXT INSPECTOR & LIVE EDIT */}
      {rawOcrText && !extracting && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-3 gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                <Check className="h-3.5 w-3.5" />
              </div>
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                Extracted Document Text (تصویر سے پڑھا گیا ٹیکسٹ)
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                Engine: {engineUsed}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditingOcr(!isEditingOcr)}
                className="text-xs"
              >
                <Edit3 className="h-3.5 w-3.5 mr-1" />
                {isEditingOcr ? "Cancel Edit" : "Edit / Fix Text"}
              </Button>

              {isEditingOcr && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleReanalyzeOcr}
                  className="text-xs"
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1" />
                  Re-analyze Edited Text
                </Button>
              )}
            </div>
          </div>

          {isEditingOcr ? (
            <div className="space-y-2">
              <p className="text-[11px] text-amber-700 dark:text-amber-400">
                💡 Tip: If handwriting had unclear numbers, edit them here and click "Re-analyze Edited Text".
              </p>
              <textarea
                rows={5}
                value={rawOcrText}
                onChange={(e) => setRawOcrText(e.target.value)}
                className="w-full rounded-xl border border-blue-300 bg-blue-50/20 p-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono dark:border-blue-800 dark:bg-slate-950 dark:text-white"
              />
            </div>
          ) : (
            <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-xs text-slate-700 dark:bg-slate-800/60 dark:text-slate-300 font-mono border border-slate-200 dark:border-slate-800">
              {rawOcrText}
            </pre>
          )}
        </div>
      )}

      {/* AI REVIEW SCREEN (Rule 12: Human Review & Approval Required) */}
      {extractionResult && (
        <div className="space-y-4 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between rounded-2xl bg-blue-50/80 p-4 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 gap-3">
            <div>
              <h3 className="text-sm font-bold text-blue-900 dark:text-blue-200">
                AI Extraction Review ({extractionResult.transactions?.length} entries detected)
              </h3>
              <p className="text-xs text-blue-700 dark:text-blue-300">
                Review, edit, or delete entries below. Transactions will only be posted to accounting after your explicit confirmation.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearAllEntries}
                className="text-xs text-rose-600 border-rose-200 hover:bg-rose-50 dark:border-rose-900 dark:hover:bg-rose-950/30 font-bold"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Clear All (تمام خارج کریں)
              </Button>
              <Button variant="primary" size="sm" onClick={handlePostAllValid}>
                <CheckCircle2 className="h-4 w-4 mr-1.5" />
                Approve & Post All Valid
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {extractionResult.transactions?.map((t: any, index: number) => {
              const isPosted = postedMap[t.id] || t.status === "POSTED";
              const isPosting = postingId === t.id;
              const hasWarnings = t.needsConfirmation || t.isDuplicate;

              return (
                <div
                  key={t.id || index}
                  className={`rounded-2xl border p-4 shadow-sm transition-all ${
                    isPosted
                      ? "border-emerald-300 bg-emerald-50/40 dark:border-emerald-900 dark:bg-emerald-950/20"
                      : hasWarnings
                      ? "border-amber-300 bg-amber-50/30 dark:border-amber-900 dark:bg-amber-950/20"
                      : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
                  }`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        variant={
                          t.type === "SALE"
                            ? "default"
                            : t.type === "PURCHASE"
                            ? "info"
                            : t.type === "EXPENSE"
                            ? "danger"
                            : "success"
                        }
                      >
                        {t.type}
                      </Badge>
                      <span className="font-bold text-sm text-slate-900 dark:text-white">
                        {t.partyName || "Unspecified Party"}
                      </span>
                      {t.confidence && (
                        <span className="text-[10px] text-slate-400">
                          {Math.round(t.confidence * 100)}% Confidence
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {isPosted ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-900">
                          <Check className="h-4 w-4" /> Posted to Ledger (پوسٹ ہو گیا)
                        </span>
                      ) : (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleStartEdit(t)}
                            className="text-xs text-blue-700 border-blue-200 hover:bg-blue-50 dark:text-blue-300 dark:border-blue-900 font-semibold"
                          >
                            <Edit3 className="h-3.5 w-3.5 mr-1" />
                            Edit (ترمیم کریں)
                          </Button>

                          <button
                            type="button"
                            onClick={() => handleDeleteEntry(t.id)}
                            className="rounded-lg border border-rose-200 p-1.5 text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-400 dark:hover:bg-rose-950/40 transition"
                            title="Delete Entry (یہ اندراج حذف کریں)"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>

                          <Button
                            variant={hasWarnings ? "secondary" : "primary"}
                            size="sm"
                            onClick={() => handlePostEntry(t.id)}
                            isLoading={isPosting}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                            Approve & Post
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Warnings Banner */}
                  {hasWarnings && !isPosted && (
                    <div className="my-2.5 rounded-lg bg-amber-100/70 p-2 text-xs text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      <span>
                        {t.needsConfirmation
                          ? "Ambiguous transaction amount or type: Please verify details before posting."
                          : "Possible duplicate entry detected."}
                      </span>
                    </div>
                  )}

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 pt-3 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Total Amount</span>
                      <span className="font-bold text-slate-900 dark:text-white tabular-nums">
                        {formatMoney(t.totalAmount)}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Paid / Cash</span>
                      <span className="font-semibold text-emerald-600 tabular-nums">{formatMoney(t.paidAmount)}</span>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Remaining Balance</span>
                      <span className="font-semibold text-rose-600 tabular-nums">
                        {formatMoney(t.remainingAmount)}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Payment Method</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">{t.paymentMethod}</span>
                    </div>
                  </div>

                  {/* Items List if detected */}
                  {t.items && t.items.length > 0 && (
                    <div className="mt-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 p-2.5 border border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                        Detected Items ({t.items.length})
                      </span>
                      <div className="space-y-1">
                        {t.items.map((item: any, idx: number) => (
                          <div key={idx} className="flex justify-between text-[11px] text-slate-700 dark:text-slate-300">
                            <span>
                              {item.name || item.productName}{" "}
                              {item.quantity ? `(Qty: ${item.quantity})` : ""}
                            </span>
                            <span className="font-semibold tabular-nums">
                              {formatMoney(item.total || item.unitPrice * (item.quantity || 1))}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Notes / Source Text */}
                  {t.notes && (
                    <p className="mt-2.5 text-[11px] text-slate-500 italic bg-slate-50 dark:bg-slate-800/40 p-2 rounded-lg">
                      "{t.notes}"
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL: FORMAT GUIDELINES (رہنمائی برائے تصویر اور لکھائی) */}
      {isGuideModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="max-w-2xl w-full rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                  <BookOpen className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Format & Photography Guidelines (رہنمائی برائے تصویر اور پرچی)
                  </h3>
                  <p className="text-xs text-slate-500">
                    How to write and photograph your diary pages for 100% accurate extraction.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsGuideModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs text-slate-600 dark:text-slate-300">
              {/* Photo Tips */}
              <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3.5 dark:border-blue-900 dark:bg-blue-950/20">
                <h4 className="font-bold text-blue-900 dark:text-blue-200 text-sm mb-2 flex items-center gap-1.5">
                  <Camera className="h-4 w-4" /> 1. تصویر لینے کے اہم اصول (Photography Rules)
                </h4>
                <ul className="space-y-1.5 list-disc list-inside leading-relaxed text-slate-700 dark:text-slate-300">
                  <li>
                    <strong>سیدھا اینگل (Flat Angle):</strong> کیمرہ پرچی یا ڈائری کے بالکل اوپر سیدھا رکھیں تاکہ تحریر ترچھی نہ ہو۔
                  </li>
                  <li>
                    <strong>اچھی روشنی (Proper Lighting):</strong> سایہ (shadow) یا چمک (glare) نہ آئے، کاغذ کے دونوں کنارے تصویر میں نظر آئیں۔
                  </li>
                  <li>
                    <strong>صاف لکھائی (Clear Writing):</strong> ہندسے (Numbers) صاف لکھیں جیسے 25,000 یا 10,000 تاکہ OCR الجھن کا شکار نہ ہو۔
                  </li>
                </ul>
              </div>

              {/* Writing Structure */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
                <h4 className="font-bold text-slate-900 dark:text-white text-sm mb-2 flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-blue-600" /> 2. ڈائری میں اندراج کا بہترین فارمیٹ (Writing Structure)
                </h4>
                <div className="space-y-2">
                  <p>ہر ٹرانزیکشن کو الگ لائن پر لکھیں، مثلاً:</p>
                  <div className="rounded-lg bg-white p-3 font-mono text-[11px] border border-slate-200 dark:bg-slate-900 dark:border-slate-700 space-y-1">
                    <p className="text-blue-600">Ali Traders ko 25,000 ki sale, 10,000 cash mila</p>
                    <p className="text-emerald-600">Ahmed se 15,000 purchase udhaar</p>
                    <p className="text-amber-600">Shop electricity 3,000 paid cash</p>
                    <p className="text-purple-600">IPH 11 NON 64 - HBL 36,000</p>
                  </div>
                </div>
              </div>

              {/* Supported Formats */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
                <h4 className="font-bold text-slate-900 dark:text-white text-sm mb-2">
                  3. سپورٹ شدہ دستاویزات (Supported Slip Types)
                </h4>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2 rounded-lg bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-700">
                    <strong className="text-blue-600 block">📒 روزنامچہ ڈائری:</strong> ہاتھ سے لکھی ہوئی دکان کی روزانہ ڈائری
                  </div>
                  <div className="p-2 rounded-lg bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-700">
                    <strong className="text-emerald-600 block">🧾 سیلز کیش میمو:</strong> کسٹمر کو دی جانے والی انوائس یا پرچی
                  </div>
                  <div className="p-2 rounded-lg bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-700">
                    <strong className="text-amber-600 block">📑 اخراجات واؤچر:</strong> بجلی، چائے، پیٹرول، اور کرایہ کی پرچیاں
                  </div>
                  <div className="p-2 rounded-lg bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-700">
                    <strong className="text-purple-600 block">📦 سپلائر بل:</strong> ہول سیل ڈسٹری بیوٹر کی مال خریداری رسید
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <Button variant="primary" size="sm" onClick={() => setIsGuideModalOpen(false)}>
                سمجھ آگیا (Got It)
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: AI ENGINE & API KEY CONFIG */}
      {isKeyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="max-w-md w-full rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                  <Sliders className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    AI Vision Engine Configuration
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Switch between Offline OCR and Cloud AI Vision
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsKeyModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="rounded-xl bg-slate-50 p-3 border border-slate-200 dark:bg-slate-800/50 dark:border-slate-700 text-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-slate-800 dark:text-slate-200">Default Mode:</span>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                    Local Tesseract OCR (Free & Offline)
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  No API key required. Works completely inside the app. For complex cursive Urdu handwriting, an optional Google Gemini Vision key provides 99% accuracy.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Custom Google Gemini or OpenAI API Key (Optional):
                </label>
                <input
                  type="password"
                  value={customApiKey}
                  onChange={(e) => setCustomApiKey(e.target.value)}
                  placeholder="AIzaSy... or sk-proj-..."
                  className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Saved securely in your browser session. Free Gemini key available from{" "}
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 underline"
                  >
                    Google AI Studio
                  </a>.
                </p>
              </div>

              <div className="flex justify-between items-center pt-2">
                {customApiKey ? (
                  <button
                    type="button"
                    onClick={() => saveApiKey("")}
                    className="text-xs text-rose-600 hover:underline font-medium"
                  >
                    Clear Saved Key
                  </button>
                ) : (
                  <div />
                )}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setIsKeyModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button variant="primary" size="sm" onClick={() => saveApiKey(customApiKey.trim())}>
                    Save Settings
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDIT TRANSACTION (اندراج میں تبدیلی / ترمیم کریں) */}
      {editingTransaction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="max-w-lg w-full rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                  <Edit3 className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Edit Extracted Transaction (اندراج میں تبدیلی کریں)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Fix party name, amounts, transaction type, or payment status before posting.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingTransaction(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveEditedEntry(editingTransaction);
              }}
              className="mt-4 space-y-3.5"
            >
              {/* Type */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Transaction Type (قسم کا انتخاب کریں):
                </label>
                <select
                  value={editingTransaction.type}
                  onChange={(e) => setEditingTransaction({ ...editingTransaction, type: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white font-medium"
                >
                  <option value="SALE">SALE (گاہک کو سیل / فروخت)</option>
                  <option value="PURCHASE">PURCHASE (سپلائر سے خریداری)</option>
                  <option value="EXPENSE">EXPENSE (دکان کے اخراجات)</option>
                  <option value="PAYMENT_RECEIVED">PAYMENT_RECEIVED (گاہک سے پرانا ادھار وصولی)</option>
                  <option value="PAYMENT_MADE">PAYMENT_MADE (سپلائر کو ادائیگی)</option>
                </select>
              </div>

              {/* Party Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Party / Customer / Vendor Name (پارٹی یا گاہک کا نام):
                </label>
                <input
                  type="text"
                  value={editingTransaction.partyName || ""}
                  onChange={(e) => setEditingTransaction({ ...editingTransaction, partyName: e.target.value })}
                  placeholder="e.g. Ali Traders, Ahmed Telecom"
                  className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  required
                />
              </div>

              {/* Total & Paid Amounts */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Total Amount Rs. (کل رقم):
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={editingTransaction.totalAmount ?? ""}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setEditingTransaction({
                        ...editingTransaction,
                        totalAmount: val,
                        remainingAmount: Math.max(0, val - (Number(editingTransaction.paidAmount) || 0)),
                      });
                    }}
                    className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white tabular-nums font-semibold"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Paid / Received Rs. (نقد رقم):
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={editingTransaction.paidAmount ?? ""}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setEditingTransaction({
                        ...editingTransaction,
                        paidAmount: val,
                        remainingAmount: Math.max(0, (Number(editingTransaction.totalAmount) || 0) - val),
                      });
                    }}
                    className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white tabular-nums font-semibold text-emerald-600"
                  />
                </div>
              </div>

              {/* Balance & Payment Method */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Remaining Balance Rs. (بقایا ادھار):
                  </label>
                  <div className="w-full rounded-xl border border-slate-200 bg-slate-100 p-2.5 text-xs font-bold text-rose-600 dark:border-slate-700 dark:bg-slate-800 tabular-nums">
                    {formatMoney(
                      Math.max(
                        0,
                        (Number(editingTransaction.totalAmount) || 0) -
                          (Number(editingTransaction.paidAmount) || 0)
                      )
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Payment Method (طریقہ ادائیگی):
                  </label>
                  <select
                    value={editingTransaction.paymentMethod || "CASH"}
                    onChange={(e) => setEditingTransaction({ ...editingTransaction, paymentMethod: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  >
                    <option value="CASH">CASH (نقد کیش)</option>
                    <option value="BANK">BANK / ONLINE (بینک ٹرانسفر)</option>
                    <option value="CREDIT">CREDIT (مکمل ادھار)</option>
                    <option value="PARTIAL">PARTIAL (جزوی ادائیگی)</option>
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Notes / Voice Transcript (تفصیل / نوٹس):
                </label>
                <textarea
                  rows={2}
                  value={editingTransaction.notes || ""}
                  onChange={(e) => setEditingTransaction({ ...editingTransaction, notes: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white font-mono"
                />
              </div>

              <div className="flex justify-between items-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    handleDeleteEntry(editingTransaction.id);
                    setEditingTransaction(null);
                  }}
                  className="text-xs text-rose-600 hover:underline font-bold flex items-center gap-1"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete Entry (حذف کریں)
                </button>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" type="button" onClick={() => setEditingTransaction(null)}>
                    Cancel (منسوخ)
                  </Button>
                  <Button variant="primary" size="sm" type="submit">
                    <Check className="h-3.5 w-3.5 mr-1" /> Save Changes (محفوظ کریں)
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
