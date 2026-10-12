export function fmtNum(value: number, digits = 4): string {
  if (!Number.isFinite(value)) {
    return "—";
  }
  if (Number.isInteger(value)) {
    return String(value);
  }
  const rounded = Number(value.toFixed(digits));
  if (Number.isInteger(rounded)) {
    return rounded.toFixed(1);
  }
  return String(rounded);
}
