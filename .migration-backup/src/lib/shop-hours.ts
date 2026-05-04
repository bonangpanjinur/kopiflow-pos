// Shop opening hours utility
type DayKey = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";
const DAYS: DayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export type DayHours = { open: string; close: string; closed?: boolean };
export type OpenHours = Record<DayKey, DayHours>;

function parseHM(s: string) {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function shopStatus(open_hours: unknown, now: Date = new Date()): {
  open: boolean;
  label: string;
  nextChange: string | null;
} {
  if (!open_hours || typeof open_hours !== "object") {
    return { open: true, label: "Buka", nextChange: null };
  }
  const oh = open_hours as Partial<OpenHours>;
  const dayKey = DAYS[now.getDay()];
  const today = oh[dayKey];
  const cur = now.getHours() * 60 + now.getMinutes();
  if (!today || today.closed) {
    return { open: false, label: "Tutup hari ini", nextChange: null };
  }
  const o = parseHM(today.open);
  const c = parseHM(today.close);
  const open =
    c >= o ? cur >= o && cur < c : cur >= o || cur < c; // crosses midnight
  if (open) {
    return {
      open: true,
      label: `Buka — tutup ${today.close}`,
      nextChange: today.close,
    };
  }
  if (cur < o) {
    return { open: false, label: `Tutup — buka ${today.open}`, nextChange: today.open };
  }
  return { open: false, label: "Tutup hari ini", nextChange: null };
}
