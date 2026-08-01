export function renderedWheelItems(items, loop) {
  const real = items.map((item, index) => ({
    item,
    key: `real-${item.id}`,
    clone: null,
    realIndex: index,
  }));
  if (!loop || items.length < 2) return real;
  return [
    {
      item: items.at(-1),
      key: `clone-start-${items.at(-1).id}`,
      clone: "start",
      realIndex: items.length - 1,
    },
    ...real,
    {
      item: items[0],
      key: `clone-end-${items[0].id}`,
      clone: "end",
      realIndex: 0,
    },
  ];
}

export function logicalAdjacentIndex(index, length, direction, loop) {
  if (length <= 0) return -1;
  const step = Math.sign(direction || 0);
  if (!step) return Math.max(0, Math.min(length - 1, index));
  if (loop) return (index + step + length) % length;
  return Math.max(0, Math.min(length - 1, index + step));
}
