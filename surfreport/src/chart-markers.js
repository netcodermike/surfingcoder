export const DIRECTION_INTERVAL_SECONDS = 2 * 3600;
export const hasDirection = value => Number.isFinite(value) && value >= 0 && value <= 360;

export function createDirectionIcon(svg, from) {
  const icon = svg('svg', {
    class: 'week-direction-arrow', width: 16, height: 16, viewBox: '-8 -8 16 16',
    'aria-hidden': 'true', focusable: 'false', style: 'margin-inline-start:4px; vertical-align:-0.2em',
  });
  // Bearings describe where waves or wind come from. Arrows show travel direction.
  icon.append(svg('path', {
    d: 'M0 5V-5 M-3.5 -1.5L0 -5L3.5 -1.5', transform: 'rotate(' + (from + 180) + ')',
    fill: 'none', stroke: 'currentColor', 'stroke-width': 2.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
  }));
  return icon;
}

export function appendMarkerCheckbox(legend, { id, label, checked, onChange }) {
  const wrapper = document.createElement('label');
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.id = id;
  checkbox.checked = checked;
  checkbox.onchange = () => onChange(checkbox.checked);
  wrapper.append(checkbox, label);
  legend.append(wrapper);
}

export function createChartArrows(svg, { className, color, spacing, bottom = Infinity }) {
  const group = svg('g', {
    'aria-hidden': 'true', 'pointer-events': 'none', class: className,
    fill: 'none', stroke: color, 'stroke-width': 2.2,
    'stroke-linecap': 'round', 'stroke-linejoin': 'round',
  });
  const scale = Math.max(.45, Math.min(1, spacing / 15));

  function add(x, y, from) {
    if (!hasDirection(from) || y >= bottom) return false;
    const fittedScale = Math.min(scale, (bottom - y) / 16);
    // Source bearings describe where the waves or wind come from.
    group.append(svg('path', {
      d: 'M0 0V-14 M-4.5 -9L0 -14L4.5 -9',
      transform: `translate(${x} ${y}) rotate(${from + 180}) scale(${fittedScale})`,
    }));
    return true;
  }

  return { group, add };
}
