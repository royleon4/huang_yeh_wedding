export function nextDialogFocusIndex({ current, count, reverse }) {
  const size = Math.max(0, Number(count) || 0);
  if (size === 0) return -1;
  if (!Number.isInteger(current) || current < 0 || current >= size) {
    return reverse ? size - 1 : 0;
  }
  return (current + (reverse ? -1 : 1) + size) % size;
}
