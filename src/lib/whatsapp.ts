function digitsOnly(v: string) {
  return v.replace(/\D/g, "");
}

/**
 * Normalizes a phone number into the digits-only format WhatsApp's wa.me
 * links expect (country code + number, no +, no spaces, no leading 0).
 */
export function formatWaPhone(
  phone: string | null | undefined,
  waCountry?: string | null
): string | null {
  if (!phone) return null;
  const raw = phone.trim();
  if (!raw) return null;

  const prefix = digitsOnly(waCountry || "");

  if (raw.startsWith("+")) {
    const digits = digitsOnly(raw);
    return digits || null;
  }

  if (raw.startsWith("00")) {
    const digits = digitsOnly(raw.slice(2));
    return digits || null;
  }

  const digits = digitsOnly(raw);
  if (!digits) return null;

  if (digits.startsWith("0")) {
    const rest = digits.slice(1);
    return prefix ? prefix + rest : rest;
  }

  if (prefix && !digits.startsWith(prefix)) {
    return prefix + digits;
  }

  return digits;
}

/**
 * Builds a wa.me link that opens WhatsApp with the given phone number and,
 * optionally, a pre-filled message. Returns null when there's no usable
 * phone number (caller should hide the button in that case).
 */
export function waLink(
  phone: string | null | undefined,
  waCountry?: string | null,
  message?: string
): string | null {
  const formatted = formatWaPhone(phone, waCountry);
  if (!formatted) return null;
  const base = `https://wa.me/${formatted}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

/**
 * Normalizes a phone number into E.164 format (e.g. "+40722123456"), the
 * format Twilio's WhatsApp API requires. Returns null when there's no
 * usable phone number.
 */
export function toE164(
  phone: string | null | undefined,
  waCountry?: string | null
): string | null {
  const digits = formatWaPhone(phone, waCountry);
  return digits ? `+${digits}` : null;
}
