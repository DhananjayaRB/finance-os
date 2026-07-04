"use client";

import { useState, useEffect, useCallback, useRef, useLayoutEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Lock, Delete } from "lucide-react";

interface PinPadProps {
  mode: "login" | "setup";
}

export function PinPad({ mode }: PinPadProps) {
  const [pin, setPin] = useState("");
  const [name, setName] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [step, setStep] = useState<"pin" | "confirm" | "name">("pin");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useLayoutEffect(() => {
    inputRef.current?.focus();
  }, [step]);

  const submitLogin = useCallback(
    async (pinValue: string) => {
      if (pinValue.length !== 5 || loading) return;
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin: pinValue }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Invalid PIN");
          setPin("");
          inputRef.current?.focus();
          return;
        }
        router.push("/");
        router.refresh();
      } catch {
        setError("Connection failed");
        setPin("");
        inputRef.current?.focus();
      } finally {
        setLoading(false);
      }
    },
    [loading, router]
  );

  const applyPin = useCallback(
    (value: string) => {
      const digits = value.replace(/\D/g, "").slice(0, 5);
      setError("");

      if (mode === "setup") {
        if (step === "pin") {
          setPin(digits);
          if (digits.length === 5) setStep("confirm");
        } else if (step === "confirm") {
          setConfirmPin(digits);
          if (digits.length === 5) {
            if (digits !== pin) {
              setError("PINs don't match");
              setPin("");
              setConfirmPin("");
              setStep("pin");
            } else {
              setStep("name");
            }
          }
        }
      } else {
        setPin(digits);
        if (digits.length === 5) {
          void submitLogin(digits);
        }
      }
    },
    [mode, step, pin, submitLogin]
  );

  const handleDigit = (digit: string) => {
    if (loading) return;
    const current = step === "confirm" ? confirmPin : pin;
    if (current.length < 5) {
      applyPin(current + digit);
    }
    inputRef.current?.focus();
  };

  const handleDelete = () => {
    if (loading) return;
    setError("");
    if (mode === "setup" && step === "confirm") {
      setConfirmPin((p) => p.slice(0, -1));
    } else {
      setPin((p) => p.slice(0, -1));
    }
    inputRef.current?.focus();
  };

  const submitSetup = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin, name: name || "Finance User" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Setup failed");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Connection failed");
    } finally {
      setLoading(false);
    }
  };

  const currentPin = step === "confirm" ? confirmPin : pin;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-emerald-50 to-white p-6 dark:from-zinc-950 dark:to-zinc-900">
      {/* Hidden input captures keyboard + ensures interactivity */}
      {!(mode === "setup" && step === "name") && (
        <input
          ref={inputRef}
          type="tel"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={currentPin}
          onChange={(e) => applyPin(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Backspace") {
              e.preventDefault();
              handleDelete();
            }
          }}
          className="absolute h-px w-px opacity-0"
          aria-label="Enter 5-digit PIN"
          disabled={loading}
        />
      )}

      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg">
          <Lock className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-bold">Finance OS</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {mode === "setup"
            ? step === "name"
              ? "Enter your name"
              : step === "confirm"
                ? "Confirm your PIN"
                : "Create a 5-digit PIN"
            : "Enter your PIN"}
        </p>
      </div>

      {mode === "setup" && step === "name" ? (
        <Card className="w-full max-w-sm">
          <CardContent className="space-y-4 p-6">
            <Input
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button className="w-full" onClick={submitSetup} disabled={loading}>
              {loading ? "Setting up..." : "Complete Setup"}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <button
            type="button"
            className="mb-8 flex gap-3"
            onClick={() => inputRef.current?.focus()}
            aria-label="PIN progress"
          >
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={`h-4 w-4 rounded-full border-2 transition-all ${
                  i < currentPin.length
                    ? "border-emerald-600 bg-emerald-600 scale-110"
                    : "border-zinc-300 dark:border-zinc-600"
                }`}
              />
            ))}
          </button>

          {error && <p className="mb-4 text-sm text-red-500">{error}</p>}

          <div className="grid w-full max-w-xs grid-cols-3 gap-3 touch-manipulation">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", "spacer", "0", "del"].map(
              (key) => {
                if (key === "spacer") {
                  return <div key="spacer" aria-hidden="true" />;
                }
                if (key === "del") {
                  return (
                    <button
                      key="del"
                      type="button"
                      onPointerDown={(e) => {
                        e.preventDefault();
                        handleDelete();
                      }}
                      disabled={loading}
                      className="flex h-16 select-none items-center justify-center rounded-2xl bg-zinc-100 text-zinc-600 active:scale-95 active:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
                    >
                      <Delete className="h-6 w-6" />
                    </button>
                  );
                }
                return (
                  <button
                    key={key}
                    type="button"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      handleDigit(key);
                    }}
                    disabled={loading}
                    className="flex h-16 select-none items-center justify-center rounded-2xl bg-zinc-100 text-2xl font-medium text-zinc-900 active:scale-95 active:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100"
                  >
                    {key}
                  </button>
                );
              }
            )}
          </div>

          <p className="mt-4 text-xs text-zinc-400">
            Tap numbers or type on keyboard
          </p>
        </>
      )}

      <p className="mt-8 text-xs text-zinc-400">
        Salary cycle: 7th to 6th • Bangalore Finance OS
      </p>
    </div>
  );
}

export function LoginClient() {
  const [ready, setReady] = useState(false);
  const [hasAccount, setHasAccount] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth/setup")
      .then((r) => r.json())
      .then((d) => {
        setHasAccount(d.hasAccount);
        if (!d.hasAccount) router.replace("/setup");
      })
      .catch(() => setHasAccount(true))
      .finally(() => setReady(true));
  }, [router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
      </div>
    );
  }

  if (!hasAccount) return null;
  return <PinPad mode="login" />;
}

export function SetupClient() {
  const [ready, setReady] = useState(false);
  const [hasAccount, setHasAccount] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth/setup")
      .then((r) => r.json())
      .then((d) => {
        setHasAccount(d.hasAccount);
        if (d.hasAccount) router.replace("/login");
      })
      .finally(() => setReady(true));
  }, [router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
      </div>
    );
  }

  if (hasAccount) return null;
  return <PinPad mode="setup" />;
}
