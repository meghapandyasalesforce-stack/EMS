import React, { useMemo } from 'react';
import { buildConnectorEdges } from './chartUtils';

/**
 * Collapse sibling elbows into one trunk + one bus + drops.
 * Collect T-junction dots (mock-style; no arrowheads).
 */
function normalizeConnectorEdges(edges) {
  const trunks = new Map();
  const buses = new Map();
  const junctions = new Map();
  const rest = [];

  const addJunction = (x, y, edge) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const key = `${Math.round(x * 10) / 10}|${Math.round(y * 10) / 10}`;
    const existing = junctions.get(key);
    if (!existing) {
      junctions.set(key, {
        id: `junction-${key}`,
        x,
        y,
        highlighted: Boolean(edge.highlighted),
        focused: Boolean(edge.focused),
      });
      return;
    }
    existing.highlighted = existing.highlighted || Boolean(edge.highlighted);
    existing.focused = existing.focused || Boolean(edge.focused);
  };

  for (const edge of edges) {
    const simple = String(edge.d || '').match(
      /^M\s+([-\d.]+)\s+([-\d.]+)\s+V\s+([-\d.]+)\s+H\s+([-\d.]+)\s+V\s+([-\d.]+)$/
    );

    if (!simple) {
      const spine = String(edge.d || '').match(
        /^M\s+([-\d.]+)\s+([-\d.]+)\s+V\s+([-\d.]+)\s+H\s+([-\d.]+)\s+V\s+([-\d.]+)\s+H\s+([-\d.]+)\s+V\s+([-\d.]+)$/
      );
      if (spine) {
        const [, , , , spineX, busY] = spine.map(Number);
        rest.push({ ...edge });
        addJunction(spineX, busY, edge);
      } else {
        rest.push(edge);
      }
      continue;
    }

    const [, x1, y1, busY, x2, y2] = simple.map(Number);
    const trunkKey = `${edge.parentId || x1}|${y1}|${busY}`;
    if (!trunks.has(trunkKey)) {
      trunks.set(trunkKey, {
        id: `trunk-${trunkKey}`,
        d: `M ${x1} ${y1} V ${busY}`,
        highlighted: Boolean(edge.highlighted),
        focused: Boolean(edge.focused),
      });
      addJunction(x1, busY, edge);
    } else {
      const trunk = trunks.get(trunkKey);
      trunk.highlighted = trunk.highlighted || Boolean(edge.highlighted);
      trunk.focused = trunk.focused || Boolean(edge.focused);
      addJunction(x1, busY, edge);
    }

    const busKey = `${edge.parentId || x1}|${busY}`;
    const bus = buses.get(busKey) || {
      id: `bus-${busKey}`,
      y: busY,
      minX: Math.min(x1, x2),
      maxX: Math.max(x1, x2),
      highlighted: false,
      focused: false,
    };
    bus.minX = Math.min(bus.minX, x1, x2);
    bus.maxX = Math.max(bus.maxX, x1, x2);
    bus.highlighted = bus.highlighted || Boolean(edge.highlighted);
    bus.focused = bus.focused || Boolean(edge.focused);
    buses.set(busKey, bus);

    rest.push({
      id: edge.id,
      d: `M ${x2} ${busY} V ${y2}`,
      highlighted: edge.highlighted,
      focused: edge.focused,
    });
  }

  const busEdges = [...buses.values()].map((bus) => ({
    id: bus.id,
    d: bus.minX === bus.maxX ? `M ${bus.minX} ${bus.y}` : `M ${bus.minX} ${bus.y} H ${bus.maxX}`,
    highlighted: bus.highlighted,
    focused: bus.focused,
  }));

  return {
    edges: [...trunks.values(), ...busEdges, ...rest],
    junctions: [...junctions.values()],
  };
}

export default function OrgChartConnectors({
  positions,
  employees,
  pathIds,
  selectedId = null,
  width,
  height,
}) {
  const { edges, junctions } = useMemo(() => {
    const raw = buildConnectorEdges(positions, employees, pathIds || new Set(), selectedId);
    return normalizeConnectorEdges(raw);
  }, [positions, employees, pathIds, selectedId]);

  if (!width || !height) return null;

  const hasFocus = selectedId != null;

  return (
    <svg
      id="org-chart-connectors"
      className="connectors"
      width={width}
      height={height}
      aria-hidden="true"
    >
      {edges.map((edge) => {
        const active = Boolean(edge.highlighted);
        const dimmed = hasFocus && !edge.focused && !active;
        return (
          <path
            key={edge.id}
            d={edge.d}
            fill="none"
            stroke={active ? '#00694f' : '#9aa89f'}
            strokeWidth={active ? 2.25 : 1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={dimmed ? 0.14 : 1}
            className={`connector${active ? ' selected-path' : ''}${dimmed ? ' is-dimmed' : ''}`}
          />
        );
      })}
      {junctions.map((dot) => {
        const active = Boolean(dot.highlighted);
        const dimmed = hasFocus && !dot.focused && !active;
        return (
          <circle
            key={dot.id}
            cx={dot.x}
            cy={dot.y}
            r={active ? 4 : 3.25}
            fill={active ? '#00694f' : '#fff'}
            stroke={active ? '#00694f' : '#7f9086'}
            strokeWidth={1.5}
            opacity={dimmed ? 0.14 : 1}
            className={`connector-junction${active ? ' selected-path' : ''}${dimmed ? ' is-dimmed' : ''}`}
          />
        );
      })}
    </svg>
  );
}
