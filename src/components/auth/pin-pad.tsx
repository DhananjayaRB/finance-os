"use client";

import { useState, useCallback, useRef, useLayoutEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Lock, Delete } from "lucide-react";

function PinDots({ length, value }: { length: number; value: string }) {
  return (
    <div className="mb-8 flex gap-3">
      {Array.from({ length }).map((_, i) => (
        <div
          key={i}
          className={`h-4 w-4 rounded-full border-2 transition-all ${
            i < value.length
              ? "border-emerald-600 bg-emerald-600 scale-110"
              : "border-zinc-300 dark:border-zinc-600"
          }`}
        />
      ))}
    </div>
  );
}

function PinKeypad({
  loading,
  onDigit,
  onDelete,
}: {
  loading: boolean;
  onDigit: (digit: string) => void;
  onDelete: () => void;
}) {
  return (
    <div className="grid w-full max-w-xs grid-cols-3 gap-3 touch-manipulation">
      {["1", "2", "3", "4", "5", "6", "7", "8", "9", "spacer", "0", "del"].map((key) => {
        if (key === "spacer") return <div key="spacer" aria-hidden="true" />;
        if (key === "del") {
          return (
            <button
              key="del"
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                onDelete();
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
              onDigit(key);
            }}
            disabled={loading}
            className="flex h-16 select-none items-center justify-center rounded-2xl bg-zinc-100 text-2xl font-medium text-zinc-900 active:scale-95 active:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100"
          >
            {key}
          </button>
        );
      })}
    </div>
  );
}

export function LoginClient() {
  const [identifier, setIdentifier] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const pinRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useLayoutEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submitLogin = useCallback(
    async (pinValue: string, idValue: string) => {
      if (pinValue.length !== 5 || !idValue.trim() || loading) return;
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier: idValue.trim(), pin: pinValue }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Login failed");
          setPin("");
          pinRef.current?.focus();
          return;
        }
        router.push("/");
        router.refresh();
      } catch {
        setError("Connection failed");
        setPin("");
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
      setPin(digits);
      if (digits.length === 5 && identifier.trim()) {
        void submitLogin(digits, identifier);
      }
    },
    [identifier, submitLogin]
  );

  const handleDigit = (digit: string) => {
    if (loading || !identifier.trim()) {
      if (!identifier.trim()) setError("Enter email or mobile first");
      return;
    }
    if (pin.length < 5) applyPin(pin + digit);
    pinRef.current?.focus();
  };

  const handleDelete = () => {
    if (loading) return;
    setError("");
    setPin((p) => p.slice(0, -1));
    pinRef.current?.focus();
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-emerald-50 to-white p-6 dark:from-zinc-950 dark:to-zinc-900">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg">
          <Lock className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-bold">Finance OS</h1>
        <p className="mt-1 text-sm text-zinc-500">Sign in with email or mobile + PIN</p>
      </div>

      <Card className="mb-6 w-full max-w-sm">
        <CardContent className="space-y-3 p-4">
          <div>
            <Label htmlFor="identifier">Email or Mobile</Label>
            <Input
              id="identifier"
              ref={inputRef}
              type="text"
              inputMode="email"
              autoComplete="username"
              placeholder="you@email.com or 9876543210"
              value={identifier}
              onChange={(e) => {
                setError("");
                setIdentifier(e.target.value);
              }}
            />
          </div>
        </CardContent>
      </Card>

      <input
        ref={pinRef}
        type="tel"
        inputMode="numeric"
        autoComplete="one-time-code"
        value={pin}
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

      <button type="button" className="mb-2" onClick={() => pinRef.current?.focus()}>
        <PinDots length={5} value={pin} />
      </button>

      {error && <p className="mb-4 text-sm text-red-500">{error}</p>}

      <PinKeypad loading={loading} onDigit={handleDigit} onDelete={handleDelete} />

      <p className="mt-6 text-sm text-zinc-500">
        New user?{" "}
        <Link href="/signup" className="font-medium text-emerald-600 underline">
          Create account
        </Link>
      </p>
    </div>
  );
}

type SignupStep = "details" | "pin" | "confirm";

export function SignupClient() {
  const [step, setStep] = useState<SignupStep>("details");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const pinRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useLayoutEffect(() => {
    if (step !== "details") pinRef.current?.focus();
  }, [step]);

  const currentPin = step === "confirm" ? confirmPin : pin;

  const submitSignup = useCallback(async (pinValue: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, mobile, pin: pinValue }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Signup failed");
        setPin("");
        setConfirmPin("");
        setStep("pin");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Connection failed");
    } finally {
      setLoading(false);
    }
  }, [name, email, mobile, router]);

  const applyPin = useCallback(
    (value: string) => {
      const digits = value.replace(/\D/g, "").slice(0, 5);
      setError("");

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
            void submitSignup(digits);
          }
        }
      }
    },
    [step, pin, submitSignup]
  );

  const handleDigit = (digit: string) => {
    if (loading || currentPin.length >= 5) return;
    applyPin(currentPin + digit);
    pinRef.current?.focus();
  };

  const handleDelete = () => {
    if (loading) return;
    setError("");
    if (step === "confirm") setConfirmPin((p) => p.slice(0, -1));
    else setPin((p) => p.slice(0, -1));
    pinRef.current?.focus();
  };

  const continueToPin = () => {
    setError("");
    if (!name.trim()) return setError("Name is required");
    if (!email.trim()) return setError("Email is required");
    if (!mobile.trim()) return setError("Mobile number is required");
    setStep("pin");
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-emerald-50 to-white p-6 dark:from-zinc-950 dark:to-zinc-900">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg">
          <Lock className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-bold">Create Account</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {step === "details"
            ? "Your details stay private on this device"
            : step === "confirm"
              ? "Confirm your 5-digit PIN"
              : "Choose a 5-digit PIN"}
        </p>
      </div>

      {step === "details" ? (
        <Card className="w-full max-w-sm">
          <CardContent className="space-y-3 p-6">
            <div>
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoFocus />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
              />
            </div>
            <div>
              <Label htmlFor="mobile">Mobile Number</Label>
              <Input
                id="mobile"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="9876543210"
              />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button className="w-full" onClick={continueToPin}>
              Continue
            </Button>
            <p className="text-center text-sm text-zinc-500">
              Already have an account?{" "}
              <Link href="/login" className="font-medium text-emerald-600 underline">
                Sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <input
            ref={pinRef}
            type="tel"
            inputMode="numeric"
            autoComplete="new-password"
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

          <button type="button" onClick={() => pinRef.current?.focus()}>
            <PinDots length={5} value={currentPin} />
          </button>

          {error && <p className="mb-4 mt-4 text-sm text-red-500">{error}</p>}

          <div className="mt-6">
            <PinKeypad loading={loading} onDigit={handleDigit} onDelete={handleDelete} />
          </div>

          <button
            type="button"
            className="mt-4 text-sm text-zinc-500 underline"
            onClick={() => {
              setError("");
              setPin("");
              setConfirmPin("");
              setStep(step === "confirm" ? "pin" : "details");
            }}
          >
            Back
          </button>
        </>
      )}
    </div>
  );
}

// Backward-compatible exports
export function PinPad({ mode }: { mode: "login" | "setup" }) {
  return mode === "setup" ? <SignupClient /> : <LoginClient />;
}

export function SetupClient() {
  return <SignupClient />;
}
