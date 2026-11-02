export type SignDateValue = { signature: string; date: string };

export function readSignDateValue(value: string): SignDateValue {
  try {
    const parsed = JSON.parse(value) as Partial<SignDateValue>;
    return { signature: parsed.signature ?? "", date: parsed.date ?? "" };
  } catch {
    return { signature: "", date: "" };
  }
}

export function singaporeDate(reference = new Date()): string {
  const parts = new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Singapore",
  }).formatToParts(reference);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function signedToday(signature: string, reference = new Date()): string {
  return JSON.stringify({ signature, date: signature ? singaporeDate(reference) : "" } satisfies SignDateValue);
}
