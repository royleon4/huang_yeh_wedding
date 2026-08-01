function wheelEntry(item, key, clone, realIndex) {
  return { item, key, clone, realIndex };
}

export function renderedWheelItems(items, loop) {
  const real = items.map((item, index) =>
    wheelEntry(item, `real-${item.id}`, null, index),
  );
  if (!loop || items.length < 2) return real;

  const leading = items.map((item, index) =>
    wheelEntry(item, `clone-start-${item.id}`, "start", index),
  );
  const trailing = items.map((item, index) =>
    wheelEntry(item, `clone-end-${item.id}`, "end", index),
  );

  return [...leading, ...real, ...trailing];
}

export function logicalAdjacentIndex(index, length, direction, loop) {
  if (length <= 0) return -1;
  const step = Math.sign(direction || 0);
  if (!step) return Math.max(0, Math.min(length - 1, index));
  if (loop) return (index + step + length) % length;
  return Math.max(0, Math.min(length - 1, index + step));
}
