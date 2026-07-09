"use client";

import { useEffect, useState } from "react";
import { BottomNav, AppHeader } from "@/components/layout/bottom-nav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CASH_BOX_TYPES } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";
import { Plus, Pencil, Trash2, Star } from "lucide-react";

interface CashBox {
  id: string;
  name: string;
  type: string;
  balance: string | number;
  isPrimary: boolean;
}

function getBoxIcon(type: string) {
  return CASH_BOX_TYPES.find((t) => t.value === type)?.icon ?? "💵";
}

export default function CashBoxPage() {
  const [boxes, setBoxes] = useState<CashBox[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editBox, setEditBox] = useState<CashBox | null>(null);
  const [adjustAmount, setAdjustAmount] = useState("");

  const load = () => {
    fetch("/api/cash-box")
      .then((r) => r.json())
      .then(setBoxes)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const total = boxes.reduce((s, b) => s + Number(b.balance), 0);

  const openAdd = () => {
    setEditBox(null);
    setAdjustAmount("");
    setShowForm(true);
  };

  const openEdit = (box: CashBox) => {
    setEditBox(box);
    setAdjustAmount("");
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const name = form.get("name") as string;
    const type = form.get("type") as string;
    const balance = parseFloat(form.get("balance") as string) || 0;
    const isPrimary = form.get("isPrimary") === "on";

    if (editBox?.id) {
      await fetch("/api/cash-box", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editBox.id, name, type, balance, isPrimary }),
      });
    } else {
      await fetch("/api/cash-box", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, type, balance, isPrimary }),
      });
    }

    setShowForm(false);
    setEditBox(null);
    load();
  };

  const handleAdjust = async (direction: "in" | "out") => {
    if (!editBox?.id || !adjustAmount) return;
    const amount = parseFloat(adjustAmount);
    if (!amount || amount <= 0) return;

    await fetch("/api/cash-box", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editBox.id,
        adjustment: direction === "in" ? amount : -amount,
        description: direction === "in" ? "Cash added" : "Cash spent",
      }),
    });

    setAdjustAmount("");
    setShowForm(false);
    setEditBox(null);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this cash box?")) return;
    await fetch(`/api/cash-box?id=${id}`, { method: "DELETE" });
    load();
  };

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-zinc-50 pb-24 dark:bg-zinc-950">
      <AppHeader title="Cash Box" subtitle={`Total: ${formatCurrency(total)}`} />

      <div className="space-y-3 p-4">
        <Button className="w-full" onClick={openAdd}>
          <Plus className="mr-2 h-4 w-4" /> Add Cash Box
        </Button>

        {showForm && (
          <Card>
            <CardContent className="space-y-3 p-4">
              <p className="font-semibold">{editBox ? "Edit Cash Box" : "New Cash Box"}</p>
              <form onSubmit={handleSave} className="space-y-3">
                <Input
                  name="name"
                  placeholder="Name (e.g. Wallet, Car petty cash)"
                  defaultValue={editBox?.name}
                  required
                />
                <select
                  name="type"
                  defaultValue={editBox?.type || "CUSTOM"}
                  className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 dark:border-zinc-700 dark:bg-zinc-900"
                >
                  {CASH_BOX_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
                  ))}
                </select>
                <Input
                  name="balance"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Balance ₹"
                  defaultValue={editBox ? Number(editBox.balance) : ""}
                  required={!editBox}
                />
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="isPrimary"
                    defaultChecked={editBox?.isPrimary ?? !editBox}
                  />
                  Set as primary cash box (default for cash expenses)
                </label>
                <div className="flex gap-2">
                  <Button type="submit" className="flex-1">Save</Button>
                  <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
                </div>
              </form>

              {editBox && (
                <div className="border-t border-zinc-200 pt-3 dark:border-zinc-800">
                  <p className="mb-2 text-sm font-medium text-zinc-500">Quick adjust</p>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="Amount ₹"
                      value={adjustAmount}
                      onChange={(e) => setAdjustAmount(e.target.value)}
                      min="0"
                    />
                    <Button type="button" variant="outline" onClick={() => handleAdjust("in")}>+ Add</Button>
                    <Button type="button" variant="outline" onClick={() => handleAdjust("out")}>- Remove</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
          </div>
        ) : boxes.length === 0 ? (
          <p className="py-8 text-center text-zinc-500">No cash boxes yet. Add one above.</p>
        ) : (
          boxes.map((box) => (
            <Card key={box.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{getBoxIcon(box.type)}</span>
                  <div>
                    <p className="flex items-center gap-1 font-medium">
                      {box.name}
                      {box.isPrimary && (
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      )}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {CASH_BOX_TYPES.find((t) => t.value === box.type)?.label ?? box.type}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-lg font-bold">{formatCurrency(Number(box.balance))}</p>
                  <button
                    type="button"
                    onClick={() => openEdit(box)}
                    className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    aria-label="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(box.id)}
                    className="rounded-lg p-2 text-zinc-400 hover:text-red-500"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <BottomNav />
    </div>
  );
}
