export function catalogSequence(items, currentId) {
  const currentIndex = Math.max(0, items.findIndex((item) => item.id === currentId));
  return {
    currentIndex,
    previous: currentIndex > 0 ? items[currentIndex - 1] : null,
    current: items[currentIndex] ?? null,
    next: currentIndex < items.length - 1 ? items[currentIndex + 1] : null,
  };
}
