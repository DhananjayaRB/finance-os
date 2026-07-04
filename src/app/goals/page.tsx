"use client";

import { useEffect, useRef, useState } from "react";
import { BottomNav, AppHeader } from "@/components/layout/bottom-nav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/utils";
import { Plus, Pencil, Trash2, X } from "lucide-react";

interface GoalItem {
  id: string;
  name: string;
  targetAmount: string | number;
  currentAmount: string | number;
  targetDate: string | null;
  isCompleted: boolean;
}

interface GoalFormData {
  id?: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string;
  isCompleted: boolean;
}

function buildGoalForm(goal: GoalFormData | null): GoalFormData {
  return {
    id: goal?.id,
    name: goal?.name ?? "",
    targetAmount: Number(goal?.targetAmount) || 0,
    currentAmount: Number(goal?.currentAmount) || 0,
    targetDate: goal?.targetDate ?? "",
    isCompleted: goal?.isCompleted ?? false,
  };
}

function GoalEditSheet({
  open,
  goal,
  onClose,
  onSave,
}: {
  open: boolean;
  goal: GoalFormData | null;
  onClose: () => void;
  onSave: (data: GoalFormData) => Promise<boolean>;
}) {
  if (!open || !goal) return null;
  return <GoalEditForm key={goal.id ?? "new"} goal={goal} onClose={onClose} onSave={onSave} />;
}

function GoalEditForm({
  goal,
  onClose,
  onSave,
}: {
  goal: GoalFormData;
  onClose: () => void;
  onSave: (data: GoalFormData) => Promise<boolean>;
}) {
  const nameRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState(() => buildGoalForm(goal));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => nameRef.current?.focus(), 50);
    return () => window.clearTimeout(timer);
  }, []);

  const set = (key: keyof GoalFormData, value: string | boolean) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: GoalFormData = {
        id: goal.id,
        name: form.name.trim(),
        targetAmount: parseFloat(String(form.targetAmount)) || 0,
        currentAmount: parseFloat(String(form.currentAmount)) || 0,
        targetDate: form.targetDate,
        isCompleted: form.isCompleted,
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
          <h2 className="text-lg font-bold">{goal.id ? "Edit Goal" : "Add Goal"}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label>Goal Name</Label>
            <Input ref={nameRef} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Emergency Fund, Bike..." required />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Target ₹</Label>
              <Input type="number" value={form.targetAmount || ""} onChange={(e) => set("targetAmount", e.target.value)} required />
            </div>
            <div>
              <Label>Current ₹</Label>
              <Input type="number" value={form.currentAmount || ""} onChange={(e) => set("currentAmount", e.target.value)} required />
            </div>
          </div>
          <div>
            <Label>Target Date (optional)</Label>
            <Input type="date" value={form.targetDate} onChange={(e) => set("targetDate", e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isCompleted} onChange={(e) => set("isCompleted", e.target.checked)} />
            Mark as completed
          </label>
          <div className="flex gap-2 pt-1">
            <Button type="submit" className="flex-1" disabled={saving}>{saving ? "Saving..." : "Save Goal"}</Button>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function GoalsPage() {
  const [goals, setGoals] = useState<GoalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editGoal, setEditGoal] = useState<GoalFormData | null>(null);

  const load = () => {
    fetch("/api/goals")
      .then((r) => r.json())
      .then(setGoals)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setEditGoal(buildGoalForm(null));
    setShowForm(true);
  };

  const openEdit = (goal: GoalItem) => {
    setEditGoal({
      id: goal.id,
      name: goal.name,
      targetAmount: Number(goal.targetAmount),
      currentAmount: Number(goal.currentAmount),
      targetDate: goal.targetDate ? goal.targetDate.slice(0, 10) : "",
      isCompleted: goal.isCompleted,
    });
    setShowForm(true);
  };

  const handleSave = async (data: GoalFormData): Promise<boolean> => {
    const payload = {
      ...data,
      targetDate: data.targetDate || null,
    };
    const res = await fetch("/api/goals", {
      method: data.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Failed to save goal");
      return false;
    }
    load();
    return true;
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this goal?")) return;
    await fetch(`/api/goals?id=${id}`, { method: "DELETE" });
    load();
  };

  const activeGoals = goals.filter((g) => !g.isCompleted);
  const completedGoals = goals.filter((g) => g.isCompleted);

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-zinc-50 pb-24 dark:bg-zinc-950">
      <AppHeader title="Financial Goals" subtitle={`${activeGoals.length} active • ${completedGoals.length} done`} />

      <div className="space-y-3 p-4">
        <Button className="w-full" onClick={openAdd}>
          <Plus className="mr-2 h-4 w-4" /> Add Goal
        </Button>

        <GoalEditSheet
          open={showForm}
          goal={editGoal}
          onClose={() => { setShowForm(false); setEditGoal(null); }}
          onSave={handleSave}
        />

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
          </div>
        ) : goals.length === 0 ? (
          <p className="py-8 text-center text-zinc-500">No goals yet. Add your first goal above.</p>
        ) : (
          [...activeGoals, ...completedGoals].map((goal) => {
            const target = Number(goal.targetAmount);
            const current = Number(goal.currentAmount);
            const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
            return (
              <Card key={goal.id} className={goal.isCompleted ? "opacity-70" : ""}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{goal.name}</p>
                      <p className="text-sm text-zinc-500">
                        {formatCurrency(current)} / {formatCurrency(target)}
                        {goal.isCompleted && " • Completed"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-emerald-600">{pct}%</p>
                      <button type="button" onClick={() => openEdit(goal)} className="rounded-lg p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="Edit">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => handleDelete(goal.id)} className="rounded-lg p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950" aria-label="Delete">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 h-3 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                  </div>
                  {goal.targetDate && (
                    <p className="mt-2 text-xs text-zinc-500">
                      Target: {new Date(goal.targetDate).toLocaleDateString("en-IN")}
                    </p>
                  )}
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
