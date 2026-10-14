export function desktopConnectorPath(child, parent) {
  const x1 = parent.x + parent.width / 2;
  const y1 = parent.y + parent.height;
  const x2 = child.x + child.width / 2;
  const y2 = child.y;
  const route = child.parentRoute;
  if (route?.row > 0) return `M ${x1} ${y1} V ${y1 + 24} H ${route.lane} V ${y2 - 20} H ${x2} V ${y2}`;
  return `M ${x1} ${y1} V ${y1 + 24} H ${x2} V ${y2}`;
}

