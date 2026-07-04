export function normalizeMobile(mobile: string): string {
  const digits = mobile.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits;
}

export function isValidMobile(mobile: string): boolean {
  return /^[6-9]\d{9}$/.test(normalizeMobile(mobile));
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function isValidPin(pin: string): boolean {
  return /^\d{5}$/.test(pin);
}

export function formatMobileDisplay(mobile: string): string {
  const normalized = normalizeMobile(mobile);
  if (normalized.length !== 10) return mobile;
  return `+91 ${normalized.slice(0, 5)} ${normalized.slice(5)}`;
}
