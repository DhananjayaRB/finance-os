"use client";

import { useEffect, useRef, useState } from "react";
import { BottomNav, AppHeader } from "@/components/layout/bottom-nav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/utils";
import { Plus, Pencil, Trash2, X } from "lucide-react";

interface CreditCardItem {
  id: string;
  name: string;
  limit: string | number;
  used: string | number;
  statementDay: number | null;
  dueDay: number | null;
  minimumDue: string | number | null;
  rewardPoints: number;
  annualFee: string | number | null;
}

interface CardFormData {
  id?: string;
  name: string;
  limit: number;
  used: number;
  statementDay: number;
  dueDay: number;
  minimumDue: number;
  rewardPoints: number;
  annualFee: number;
}

function buildCardForm(card: CardFormData | null): CardFormData {
  return {
    id: card?.id,
    name: card?.name ?? "",
    limit: Number(card?.limit) || 0,
    used: Number(card?.used) || 0,
    statementDay: Number(card?.statementDay) || 1,
    dueDay: Number(card?.dueDay) || 21,
    minimumDue: Number(card?.minimumDue) || 0,
    rewardPoints: Number(card?.rewardPoints) || 0,
    annualFee: Number(card?.annualFee) || 0,
  };
}

function CardEditSheet({
  open,
  card,
  onClose,
  onSave,
}: {
  open: boolean;
  card: CardFormData | null;
  onClose: () => void;
  onSave: (data: CardFormData) => Promise<boolean>;
}) {
  if (!open || !card) return null;

  return (
    <CardEditForm key={card.id ?? "new"} card={card} onClose={onClose} onSave={onSave} />
  );
}

function CardEditForm({
  card,
  onClose,
  onSave,
}: {
  card: CardFormData;
  onClose: () => void;
  onSave: (data: CardFormData) => Promise<boolean>;
}) {
  const nameRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState(() => buildCardForm(card));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => nameRef.current?.focus(), 50);
    return () => window.clearTimeout(timer);
  }, []);

  const set = (key: keyof CardFormData, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: CardFormData = {
        id: card.id,
        name: form.name.trim(),
        limit: parseFloat(String(form.limit)) || 0,
        used: parseFloat(String(form.used)) || 0,
        statementDay: parseInt(String(form.statementDay)) || 1,
        dueDay: parseInt(String(form.dueDay)) || 21,
        minimumDue: parseFloat(String(form.minimumDue)) || 0,
        rewardPoints: parseInt(String(form.rewardPoints)) || 0,
        annualFee: parseFloat(String(form.annualFee)) || 0,
      };
      const ok = await onSave(payload);
      if (ok) onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50" onClick={onClose} role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-4 dark:bg-zinc-900" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{card.id ? "Edit Card" : "Add Card"}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label>Card Name</Label>
            <Input ref={nameRef} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="HDFC Millenia" required />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Credit Limit ₹</Label>
              <Input type="number" value={form.limit || ""} onChange={(e) => set("limit", e.target.value)} required />
            </div>
            <div>
              <Label>Used ₹</Label>
              <Input type="number" value={form.used || ""} onChange={(e) => set("used", e.target.value)} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Statement Day</Label>
              <Input type="number" min={1} max={28} value={form.statementDay || ""} onChange={(e) => set("statementDay", e.target.value)} />
            </div>
            <div>
              <Label>Due Day</Label>
              <Input type="number" min={1} max={28} value={form.dueDay || ""} onChange={(e) => set("dueDay", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Min Due ₹</Label>
              <Input type="number" value={form.minimumDue || ""} onChange={(e) => set("minimumDue", e.target.value)} />
            </div>
            <div>
              <Label>Reward Points</Label>
              <Input type="number" value={form.rewardPoints || ""} onChange={(e) => set("rewardPoints", e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Annual Fee ₹</Label>
            <Input type="number" value={form.annualFee || ""} onChange={(e) => set("annualFee", e.target.value)} />
          </div>
          <div className="flex gap-2 pt-1">
            <Button type="submit" className="flex-1" disabled={saving}>{saving ? "Saving..." : "Save Card"}</Button>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CardsPage() {
  const [cards, setCards] = useState<CreditCardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editCard, setEditCard] = useState<CardFormData | null>(null);

  const load = () => {
    fetch("/api/cards")
      .then((r) => r.json())
      .then(setCards)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setEditCard(buildCardForm(null));
    setShowForm(true);
  };

  const openEdit = (card: CreditCardItem) => {
    setEditCard({
      id: card.id,
      name: card.name,
      limit: Number(card.limit),
      used: Number(card.used),
      statementDay: card.statementDay ?? 1,
      dueDay: card.dueDay ?? 21,
      minimumDue: Number(card.minimumDue) || 0,
      rewardPoints: card.rewardPoints,
      annualFee: Number(card.annualFee) || 0,
    });
    setShowForm(true);
  };

  const handleSave = async (data: CardFormData): Promise<boolean> => {
    const res = await fetch("/api/cards", {
      method: data.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Failed to save card");
      return false;
    }
    load();
    return true;
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this card?")) return;
    await fetch(`/api/cards?id=${id}`, { method: "DELETE" });
    load();
  };

  const totalLimit = cards.reduce((s, c) => s + Number(c.limit), 0);
  const totalUsed = cards.reduce((s, c) => s + Number(c.used), 0);

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-zinc-50 pb-24 dark:bg-zinc-950">
      <AppHeader title="Credit Cards" subtitle={`Used: ${formatCurrency(totalUsed)} / ${formatCurrency(totalLimit)}`} />

      <div className="space-y-3 p-4">
        <Button className="w-full" onClick={openAdd}>
          <Plus className="mr-2 h-4 w-4" /> Add Credit Card
        </Button>

        <CardEditSheet
          open={showForm}
          card={editCard}
          onClose={() => { setShowForm(false); setEditCard(null); }}
          onSave={handleSave}
        />

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
          </div>
        ) : cards.length === 0 ? (
          <p className="py-8 text-center text-zinc-500">No credit cards yet. Add one above.</p>
        ) : (
          cards.map((card) => {
            const available = Number(card.limit) - Number(card.used);
            const usagePct = Number(card.limit) > 0
              ? Math.round((Number(card.used) / Number(card.limit)) * 100)
              : 0;
            return (
              <Card key={card.id} className="overflow-hidden">
                <div className="h-2 bg-gradient-to-r from-emerald-500 to-teal-600" />
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold">{card.name}</p>
                      <p className="text-sm text-zinc-500">{usagePct}% used</p>
                    </div>
                    <div className="flex gap-1">
                      <button type="button" onClick={() => openEdit(card)} className="rounded-lg p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="Edit">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => handleDelete(card.id)} className="rounded-lg p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950" aria-label="Delete">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
                    <div>
                      <p className="text-xs text-zinc-500">Limit</p>
                      <p className="font-medium">{formatCurrency(Number(card.limit))}</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">Used</p>
                      <p className="font-medium text-red-500">{formatCurrency(Number(card.used))}</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">Available</p>
                      <p className="font-medium text-emerald-600">{formatCurrency(available)}</p>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-zinc-500">
                    Stmt: {card.statementDay ?? "—"}th • Due: {card.dueDay ?? "—"}th • Rewards: {card.rewardPoints} pts
                  </p>
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
