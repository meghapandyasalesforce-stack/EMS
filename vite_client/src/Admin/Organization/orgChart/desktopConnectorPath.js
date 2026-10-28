/**
 * Parent → child orthogonal path.
 *
 * firstRow: T-junction under the parent (shared bus).
 * later rows: left spine OUTSIDE the subtree, then a bus for that row only —
 * never a long drop from the parent's top bus through upper cards.
 */
export function desktopConnectorPath(child, parent, options = {}) {
  const x1 = parent.x + parent.width / 2;
  const y1 = parent.y + parent.height;
  const x2 = child.x + child.width / 2;
  const y2 = child.y;

  if (!Number.isFinite(x1) || !Number.isFinite(y1) || !Number.isFinite(x2) || !Number.isFinite(y2)) {
    return `M ${x1 || 0} ${y1 || 0}`;
  }

  if (y2 - y1 <= 0) {
    return `M ${x1} ${y1} L ${x2} ${y2}`;
  }

  const stub = 24;
  const busY = Number.isFinite(options.busY) ? options.busY : y1 + stub;
  const firstRow = options.firstRow !== false;

  if (Math.abs(x1 - x2) < 0.5 && firstRow) {
    return `M ${x1} ${y1} V ${y2}`;
  }

  // Later sibling rows: route around the left of the whole sibling group.
  if (!firstRow && Number.isFinite(options.spineX)) {
    const spineX = options.spineX;
    return `M ${x1} ${y1} V ${y1 + stub} H ${spineX} V ${busY} H ${x2} V ${y2}`;
  }

  return `M ${x1} ${y1} V ${busY} H ${x2} V ${y2}`;
}
