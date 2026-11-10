/**
 * Finder-style multi-select over `order`: a click picks one item, `toggle` (Cmd/Ctrl) adds or removes it,
 * `range` (Shift) picks everything between the anchor (last non-Shift click) and the clicked item.
 */
export function pick(order: string[], picked: string[], anchor: string | null, clicked: string, mod: { toggle: boolean; range: boolean }): string[] {
  if (mod.range && anchor !== null && order.includes(anchor)) {
    const [a, b] = [order.indexOf(anchor), order.indexOf(clicked)].sort((x, y) => x - y)
    return order.slice(a, b + 1)
  }
  if (mod.toggle) return picked.includes(clicked) ? picked.filter((p) => p !== clicked) : [...picked, clicked]
  return [clicked]
}
