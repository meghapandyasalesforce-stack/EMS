import React, { memo, useState } from 'react';
import { FiMap, FiX } from 'react-icons/fi';

function OrgChartMinimap({
  positions,
  dimensions,
  viewport,
  zoom,
  pan,
  onNavigate,
  total,
  onExpandAll,
  onFitSelected,
  selectedId = null,
  initiallyOpen = true,
}) {
  const [open, setOpen] = useState(initiallyOpen);
  if (!dimensions.width || !dimensions.height) return null;
  const left = Math.max(0, -pan.x / zoom);
  const top = Math.max(0, -pan.y / zoom);
  const right = Math.min(dimensions.width, (viewport.width - pan.x) / zoom);
  const bottom = Math.min(dimensions.height, (viewport.height - pan.y) / zoom);
  const selectedKey = selectedId != null ? String(selectedId) : null;

  return (
    <div className="org-minimap" onPointerDown={event => event.stopPropagation()}>
      <button
        type="button"
        className="org-minimap-toggle"
        onClick={() => setOpen(value => !value)}
        aria-label={open ? 'Hide minimap' : 'Show minimap'}
        aria-expanded={open}
      >
        {open ? <FiX /> : <FiMap />}
      </button>
      {open ? (
        <>
          <svg
            role="button"
            tabIndex={0}
            aria-label="Chart minimap: click to navigate; arrow keys to pan"
            viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
            preserveAspectRatio="none"
            onClick={event => {
              const rect = event.currentTarget.getBoundingClientRect();
              onNavigate({
                x: ((event.clientX - rect.left) / rect.width) * dimensions.width,
                y: ((event.clientY - rect.top) / rect.height) * dimensions.height,
              });
            }}
            onKeyDown={event => {
              if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
              event.preventDefault();
              onNavigate({
                x: (-pan.x + viewport.width / 2) / zoom + (event.key === 'ArrowLeft' ? -120 : event.key === 'ArrowRight' ? 120 : 0),
                y: (-pan.y + viewport.height / 2) / zoom + (event.key === 'ArrowUp' ? -120 : event.key === 'ArrowDown' ? 120 : 0),
              });
            }}
          >
            {[...positions].map(([id, position]) => (
              <rect
                key={id}
                x={position.x}
                y={position.y}
                width={position.width}
                height={position.height}
                className={`org-minimap-node${selectedKey === String(id) ? ' is-selected' : ''}`}
              />
            ))}
            <rect
              x={left}
              y={top}
              width={Math.max(0, right - left)}
              height={Math.max(0, bottom - top)}
              className="org-minimap-viewport"
            />
          </svg>
          <span>{positions.size} visible / {total} people</span>
          <div className="org-minimap-actions">
            {onFitSelected ? (
              <button type="button" className="org-minimap-all" onClick={onFitSelected}>
                Fit selected branch
              </button>
            ) : null}
            {positions.size < total ? (
              <button type="button" className="org-minimap-all" onClick={onExpandAll}>
                Overview all people
              </button>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

export default memo(OrgChartMinimap);
