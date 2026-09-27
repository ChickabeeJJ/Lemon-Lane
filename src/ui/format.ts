// Number and time formatting that stays readable for very large values.
const SUFFIXES = ["", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc"];

export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const sign = n < 0 ? "-" : "";
  let v = Math.abs(n);
  if (v < 1000) return sign + (v < 10 && v % 1 !== 0 ? v.toFixed(1).replace(/\.0$/, "") : Math.floor(v).toString());
  let i = 0;
  while (v >= 1000 && i < SUFFIXES.length - 1) {
    v /= 1000;
    i++;
  }
  if (v >= 1000) return sign + Math.abs(n).toExponential(2).replace("+", "");
  const digits = v < 10 ? 2 : v < 100 ? 1 : 0;
  // Floor instead of round so "999.99K" never displays as "1000K".
  const f = Math.floor(v * 10 ** digits) / 10 ** digits;
  return sign + f.toFixed(digits).replace(/\.?0+$/, "") + SUFFIXES[i];
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}
