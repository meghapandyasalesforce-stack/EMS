import React, { useMemo } from 'react';
import { buildConnectorEdges } from './chartUtils';

/** Prototype-style SVG connectors: CSS classes for stroke, no filters or vector-effect. */
export default function OrgChartConnectors({ positions, employees, pathIds, width, height }) {
  const edges = useMemo(
    () => buildConnectorEdges(positions, employees, pathIds || new Set()),
    [positions, employees, pathIds]
  );

  if (!width || !height) return null;

  return (
    <svg
      id="org-chart-connectors"
      className="connectors"
      width={width}
      height={height}
      aria-hidden="true"
    >
      {edges.map((edge) => (
        <path
          key={edge.id}
          d={edge.d}
          fill="none"
          stroke={edge.highlighted ? '#6c8a57' : '#c5cfc0'}
          strokeWidth={edge.highlighted ? 2 : 1.4}
          className={`connector${edge.highlighted ? ' selected-path' : ''}`}
        />
      ))}
    </svg>
  );
}
