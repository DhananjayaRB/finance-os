"use client";

import { useEffect, useState } from "react";
import { BottomNav, AppHeader } from "@/components/layout/bottom-nav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { INSURANCE_TYPES, getInsuranceTypeLabel } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";
import { Plus, Pencil, Trash2, Shield } from "lucide-react";

interface Insurance {
  id: string;
  name: string;
  provider: string | null;
  insuranceType: string;
  premium: number | string;
  coverageAmount: number | string | null;
  cycle: string;
  renewalDay: number | null;
  payableAmount: number | string;
  paymentStatus: string;
  isActive: boolean;
}

function monthlyPremium(premium: number, cycle: string) {
  if (cycle === "YEARLY") return premium / 12;
  if (cycle === "QUARTERLY") return premium / 3;
  return premium;
}

export default function InsurancePage() {
  const [insurances, setInsurances] = useState<Insurance[]>([]);
  const [monthlyTotal, setMonthlyTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<Insurance | null>(null);

  const load = () => {
    fetch("/api/insurance")
      .then((r) => r.json())
      .then((d) => {
        setInsurances(d.insurances || []);
        setMonthlyTotal(d.monthlyTotal || 0);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const body = {
      id: editItem?.id,
      name: form.get("name"),
      provider: form.get("provider"),
      insuranceType: form.get("insuranceType"),
      premium: parseFloat(form.get("premium") as string),
      coverageAmount: parseFloat(form.get("coverageAmount") as string) || null,
      cycle: form.get("cycle"),
      renewalDay: parseInt(form.get("renewalDay") as string) || null,
      payableAmount: parseFloat(form.get("payableAmount") as string) || 0,
      isActive: form.get("isActive") !== "off",
    };

    await fetch("/api/insurance", {
      method: editItem?.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setShowForm(false);
    setEditItem(null);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this insurance policy?")) return;
    await fetch(`/api/insurance?id=${id}`, { method: "DELETE" });
    load();
  };

  const toggleActive = async (item: Insurance) => {
    await fetch("/api/insurance", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, isActive: !item.isActive }),
    });
    load();
  };

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-zinc-50 pb-24 dark:bg-zinc-950">
      <AppHeader title="Insurance" subtitle={`${formatCurrency(monthlyTotal)}/mo equivalent`} />

      <div className="space-y-4 p-4">
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-3">
              <p className="text-xs text-zinc-500">Monthly Premium</p>
              <p className="text-lg font-bold text-violet-600">{formatCurrency(monthlyTotal)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <p className="text-xs text-zinc-500">Active Policies</p>
              <p className="text-lg font-bold">{insurances.filter((i) => i.isActive).length}</p>
            </CardContent>
          </Card>
        </div>

        <Button className="w-full" onClick={() => { setEditItem(null); setShowForm(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Add Insurance
        </Button>

        {showForm && (
          <Card>
            <CardContent className="space-y-3 p-4">
              <p className="font-semibold">{editItem ? "Edit Policy" : "New Insurance Policy"}</p>
              <form onSubmit={handleSave} className="space-y-3">
                <Input name="name" placeholder="Policy name" defaultValue={editItem?.name} required />
                <Input name="provider" placeholder="Provider (LIC, Star Health...)" defaultValue={editItem?.provider ?? ""} />
                <select
                  name="insuranceType"
                  defaultValue={editItem?.insuranceType || "MEDICAL"}
                  className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 dark:border-zinc-700 dark:bg-zinc-900"
                >
                  {INSURANCE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
                  ))}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <Input name="premium" type="number" placeholder="Premium ₹" defaultValue={editItem ? Number(editItem.premium) : ""} required />
                  <select
                    name="cycle"
                    defaultValue={editItem?.cycle || "YEARLY"}
                    className="h-11 rounded-xl border border-zinc-200 bg-white px-3 dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    <option value="MONTHLY">Monthly</option>
                    <option value="QUARTERLY">Quarterly</option>
                    <option value="YEARLY">Yearly</option>
                  </select>
                </div>
                <Input
                  name="coverageAmount"
                  type="number"
                  placeholder="Coverage amount ₹ (optional)"
                  defaultValue={editItem?.coverageAmount ? Number(editItem.coverageAmount) : ""}
                />
                <Input
                  name="renewalDay"
                  type="number"
                  min={1}
                  max={28}
                  placeholder="Renewal day (1-28)"
                  defaultValue={editItem?.renewalDay ?? ""}
                />
                <Input
                  name="payableAmount"
                  type="number"
                  placeholder="Payable this month ₹"
                  defaultValue={editItem ? Number(editItem.payableAmount) : ""}
                />
                <div className="flex gap-2">
                  <Button type="submit" className="flex-1">Save</Button>
                  <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
          </div>
        ) : insurances.length === 0 ? (
          <p className="py-8 text-center text-zinc-500">No insurance policies yet. Add Medical, Life, Term, etc.</p>
        ) : (
          insurances.map((item) => {
            const premium = Number(item.premium);
            const monthly = monthlyPremium(premium, item.cycle);
            const typeMeta = INSURANCE_TYPES.find((t) => t.value === item.insuranceType);
            return (
              <Card key={item.id} className={!item.isActive ? "opacity-60" : ""}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex gap-3">
                      <span className="text-2xl">{typeMeta?.icon ?? "🛡️"}</span>
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-xs text-zinc-500">
                          {getInsuranceTypeLabel(item.insuranceType)}
                          {item.provider && ` • ${item.provider}`}
                        </p>
                        <p className="mt-1 text-sm">
                          {formatCurrency(monthly)}/mo
                          <span className="text-zinc-400"> ({formatCurrency(premium)} {item.cycle.toLowerCase()})</span>
                        </p>
                        {item.coverageAmount && (
                          <p className="text-xs text-emerald-600">Cover: {formatCurrency(Number(item.coverageAmount))}</p>
                        )}
                        {item.renewalDay && (
                          <p className="text-xs text-zinc-400">Renews on {item.renewalDay}th</p>
                        )}
                        {Number(item.payableAmount) > 0 && (
                          <p className="text-xs font-medium text-red-600">Payable: {formatCurrency(Number(item.payableAmount))}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button type="button" onClick={() => toggleActive(item)} className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100">
                        <Shield className={`h-4 w-4 ${item.isActive ? "text-emerald-600" : "text-zinc-300"}`} />
                      </button>
                      <button type="button" onClick={() => { setEditItem(item); setShowForm(true); }} className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => handleDelete(item.id)} className="rounded-lg p-2 text-zinc-400 hover:text-red-500">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <BottomNav />
    </div>
  );
}
