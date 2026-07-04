"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BottomNav, AppHeader } from "@/components/layout/bottom-nav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTheme } from "next-themes";
import {
  LogOut,
  Upload,
  Moon,
  Sun,
  Wallet,
  CreditCard,
  Target,
  Bell,
  FileSpreadsheet,
  Repeat,
  CalendarRange,
  Landmark,
  Pencil,
  X,
} from "lucide-react";

interface UserProfile {
  id: string;
  name: string;
  email: string | null;
  salaryDay: number;
  currency: string;
}

function ProfileEditSheet({
  open,
  profile,
  onClose,
  onSave,
}: {
  open: boolean;
  profile: UserProfile | null;
  onClose: () => void;
  onSave: (data: Partial<UserProfile>) => Promise<boolean>;
}) {
  if (!open || !profile) return null;

  return (
    <ProfileEditForm
      key={profile.id}
      profile={profile}
      onClose={onClose}
      onSave={onSave}
    />
  );
}

function ProfileEditForm({
  profile,
  onClose,
  onSave,
}: {
  profile: UserProfile;
  onClose: () => void;
  onSave: (data: Partial<UserProfile>) => Promise<boolean>;
}) {
  const nameRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    name: profile.name,
    email: profile.email ?? "",
    salaryDay: String(profile.salaryDay),
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => nameRef.current?.focus(), 50);
    return () => window.clearTimeout(timer);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const ok = await onSave({
        name: form.name.trim(),
        email: form.email.trim() || null,
        salaryDay: parseInt(form.salaryDay) || 7,
      });
      if (ok) onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50" onClick={onClose} role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-4 dark:bg-zinc-900" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Edit Profile</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label>Display Name</Label>
            <Input ref={nameRef} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
          </div>
          <div>
            <Label>Email (optional)</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="you@email.com" />
          </div>
          <div>
            <Label>Salary Date (day of month)</Label>
            <select
              value={form.salaryDay}
              onChange={(e) => setForm((f) => ({ ...f, salaryDay: e.target.value }))}
              className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 dark:border-zinc-700 dark:bg-zinc-900"
            >
              {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>{d}{d === 1 ? "st" : d === 2 ? "nd" : d === 3 ? "rd" : "th"} of every month</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-zinc-500">Your salary cycle runs from this day to the day before next month.</p>
          </div>
          <div className="flex gap-2 pt-1">
            <Button type="submit" className="flex-1" disabled={saving}>{saving ? "Saving..." : "Save Profile"}</Button>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadProfile = () => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then(setProfile);
  };

  useEffect(() => { loadProfile(); }, []);

  const handleSaveProfile = async (data: Partial<UserProfile>): Promise<boolean> => {
    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Failed to save profile");
      return false;
    }
    const updated = await res.json();
    setProfile(updated);
    router.refresh();
    return true;
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/import", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok) {
        setImportResult(
          `Imported: ${data.loans} loans, ${data.incomes} incomes, ${data.fixedExpenses} expenses, ${data.subscriptions} subscriptions`
        );
        router.refresh();
      } else {
        setImportResult(data.error || "Import failed");
      }
    } catch {
      setImportResult("Import failed");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const menuItems = [
    { icon: CalendarRange, label: "Monthly Plan", href: "/plan" },
    { icon: Landmark, label: "Loan Manager", href: "/loans" },
    { icon: Repeat, label: "Subscriptions", href: "/subscriptions" },
    { icon: Wallet, label: "Cash Box", href: "/cash-box" },
    { icon: CreditCard, label: "Credit Cards", href: "/cards" },
    { icon: Target, label: "Goals", href: "/goals" },
    { icon: Bell, label: "Notifications", href: "/notifications" },
    { icon: FileSpreadsheet, label: "Reports", href: "/reports" },
  ];

  const salarySuffix = (day: number) => {
    if (day >= 11 && day <= 13) return "th";
    switch (day % 10) {
      case 1: return "st";
      case 2: return "nd";
      case 3: return "rd";
      default: return "th";
    }
  };

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-zinc-50 pb-24 dark:bg-zinc-950">
      <AppHeader title="Profile" subtitle="Finance OS • Bangalore" />

      <ProfileEditSheet
        open={showEdit}
        profile={profile}
        onClose={() => setShowEdit(false)}
        onSave={handleSaveProfile}
      />

      <div className="space-y-4 p-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-600 text-2xl text-white">
                💰
              </div>
              <div className="flex-1">
                <p className="font-semibold">{profile?.name ?? "Finance User"}</p>
                <p className="text-sm text-zinc-500">
                  Salary: {profile?.salaryDay ?? 7}{salarySuffix(profile?.salaryDay ?? 7)} of every month
                </p>
                {profile?.email && (
                  <p className="text-sm text-zinc-500">{profile.email}</p>
                )}
                <p className="text-sm text-zinc-500">PIN protected • JWT session</p>
              </div>
              <button
                type="button"
                onClick={() => setShowEdit(true)}
                className="rounded-lg p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                aria-label="Edit profile"
              >
                <Pencil className="h-5 w-5 text-emerald-600" />
              </button>
            </div>
            <Button variant="outline" className="mt-3 w-full" onClick={() => setShowEdit(true)}>
              Edit Profile & Salary Date
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="divide-y divide-zinc-100 p-0 dark:divide-zinc-800">
            {menuItems.map(({ icon: Icon, label, href }) => (
              <a
                key={href}
                href={href}
                className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900"
              >
                <Icon className="h-5 w-5 text-emerald-600" />
                <span>{label}</span>
              </a>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="mb-3 flex items-center gap-2 font-medium">
              <Upload className="h-4 w-4" /> Import Excel / CSV
            </p>
            <p className="mb-3 text-sm text-zinc-500">
              Upload your &quot;My 2026 Finance Management&quot; sheet to auto-import loans, EMIs,
              subscriptions, savings, and budget data.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleImport}
              className="hidden"
              id="excel-import"
            />
            <Button
              variant="outline"
              className="w-full"
              onClick={() => fileRef.current?.click()}
              disabled={importing}
            >
              {importing ? "Importing..." : "Choose File (.xlsx / .csv)"}
            </Button>
            {importResult && (
              <p className="mt-2 text-sm text-emerald-600">{importResult}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              {theme === "dark" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
              <span>Dark Mode</span>
            </div>
            <button
              type="button"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className={`relative h-7 w-12 rounded-full transition-colors ${
                theme === "dark" ? "bg-emerald-600" : "bg-zinc-300"
              }`}
            >
              <span
                className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                  theme === "dark" ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
          </CardContent>
        </Card>

        <Button variant="destructive" className="w-full" onClick={handleLogout}>
          <LogOut className="h-4 w-4" /> Logout
        </Button>

        <p className="text-center text-xs text-zinc-400">
          Finance OS v1.0 • PWA • Offline Ready
        </p>
      </div>

      <BottomNav />
    </div>
  );
}
