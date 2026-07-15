// Compact central Shift-selection labels with strict collision avoidance.
// Loads after app-parts/34.js and before app-parts/08.js.

const layoutSelectionDensityVersionV68 = '20260715-central-compact-labels-v68';
const selectionAssistMeasureCanvasV68 = document.createElement('canvas');
const selectionAssistMeasureContextV68 = selectionAssistMeasureCanvasV68.getContext('2d');

function selectionAssistLabelWidthV68(text) {
  const label = String(text || 'Object');
  if (selectionAssistMeasureContextV68) {
    selectionAssistMeasureContextV68.font = '600 12px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    return Math.max(48, Math.min(230, Math.ceil(selectionAssistMeasureContextV68.measureText(label).width + 16)));
  }
  return Math.max(48, Math.min(230, 16 + label.length * 6.6));
}

function selectionAssistCentralEntriesV68(entries, metrics) {
  const width = metrics.viewportRect.width;
  const height = metrics.viewportRect.height;
  const centreX = width / 2;
  const centreY = height / 2;
  const marginX = Math.max(64, width * .16);
  const marginY = Math.max(52, height * .14);

  const mapped = entries.map(entry => {
    const anchor = selectionAssistScreenPointV65(entry.point, metrics);
    const dx = (anchor.x - centreX) / Math.max(1, width);
    const dy = (anchor.y - centreY) / Math.max(1, height);
    return {
      ...entry,
      anchor,
      centreScore: dx * dx + dy * dy
    };
  });

  let central = mapped.filter(entry => (
    entry.anchor.x >= marginX &&
    entry.anchor.x <= width - marginX &&
    entry.anchor.y >= marginY &&
    entry.anchor.y <= height - marginY
  ));

  // Keep the control useful when the exact middle is empty, while still choosing
  // only the objects nearest the user's current point of attention.
  if (!central.length) central = [...mapped].sort((a, b) => a.centreScore - b.centreScore).slice(0, 6);

  const review = typeof architectureReviewActiveV67 === 'function' && architectureReviewActiveV67();
  const limit = width < 700 ? 8 : review ? 12 : 14;
  return central
    .sort((a, b) => a.centreScore - b.centreScore)
    .slice(0, limit);
}

function selectionAssistCompactRectV68(centreX, centreY, width, height) {
  return {
    left: centreX - width / 2,
    right: centreX + width / 2,
    top: centreY - height / 2,
    bottom: centreY + height / 2,
    centreX,
    centreY,
    width,
    height
  };
}

function selectionAssistRectInsideV68(rect, bounds) {
  return (
    rect.left >= bounds.left &&
    rect.right <= bounds.right &&
    rect.top >= bounds.top &&
    rect.bottom <= bounds.bottom
  );
}

function placeCompactSelectionAssistLabelV68(anchor, text, occupied, bounds) {
  const width = selectionAssistLabelWidthV68(text);
  const height = 26;
  const xStep = width / 2 + 16;
  const yStep = height / 2 + 9;
  const candidates = [];

  // Search outward from the object's screen anchor. No fallback placement is used:
  // if a collision-free slot is unavailable, that label is omitted rather than stacked.
  [ -1, 1, -2, 2, -3, 3, -4, 4 ].forEach(yIndex => {
    [ 0, 1, -1, 2, -2, 3, -3 ].forEach(xIndex => {
      candidates.push({
        x: anchor.x + xIndex * xStep,
        y: anchor.y + yIndex * yStep,
        distance: Math.hypot(xIndex * xStep, yIndex * yStep)
      });
    });
  });
  candidates.sort((a, b) => a.distance - b.distance);

  for (const candidate of candidates) {
    const rect = selectionAssistCompactRectV68(candidate.x, candidate.y, width, height);
    if (!selectionAssistRectInsideV68(rect, bounds)) continue;
    if (occupied.some(other => rectanglesOverlapV65(rect, other, 6))) continue;
    occupied.push(rect);
    return rect;
  }
  return null;
}

renderSelectionAssistV65 = function(force = false) {
  if (!selectionAssistActiveV65 || !selectionAssistOverlayV65) return;
  const now = performance.now();
  if (!force && now - selectionAssistLastRenderV65 < 70) return;
  selectionAssistLastRenderV65 = now;

  enforceHiddenFurnitureLabelsV65();
  const metrics = selectionAssistCanvasMetricsV65();
  if (!metrics) return;

  const entries = selectionAssistCentralEntriesV68(collectSelectionAssistEntriesV65(), metrics);
  selectionAssistOverlayV65.replaceChildren();

  const hint = document.createElement('div');
  hint.className = 'selection-assist-hint-v65 selection-assist-hint-v68';
  const review = typeof architectureReviewActiveV67 === 'function' && architectureReviewActiveV67();
  hint.textContent = review
    ? 'Central walls, doors and windows · click to select'
    : 'Central objects · click to select';
  selectionAssistOverlayV65.appendChild(hint);

  const bounds = {
    left: 8,
    right: Math.max(8, metrics.viewportRect.width - 8),
    top: 46,
    bottom: Math.max(46, metrics.viewportRect.height - 8)
  };
  const occupied = [];

  entries.forEach(entry => {
    const rect = placeCompactSelectionAssistLabelV68(
      entry.anchor,
      entry.displayName || entry.name,
      occupied,
      bounds
    );
    if (!rect) return;

    addSelectionAssistLineV65(entry.anchor, rect);

    const button = document.createElement('button');
    button.type = 'button';
    button.className = `selection-assist-label-v65 selection-assist-${entry.kind}-v65 selection-assist-compact-v68`;
    button.textContent = entry.displayName || entry.name;
    button.title = `Select ${entry.name}`;
    button.setAttribute('aria-label', `Select ${entry.name}`);
    button.style.left = `${rect.centreX}px`;
    button.style.top = `${rect.centreY}px`;
    button.style.width = `${rect.width}px`;
    button.style.height = `${rect.height}px`;
    button.onpointerdown = event => {
      event.preventDefault();
      event.stopPropagation();
    };
    button.onclick = event => {
      event.preventDefault();
      event.stopPropagation();
      selectFromAssistLabelV65(entry);
    };
    selectionAssistOverlayV65.appendChild(button);
  });

  if (typeof hideNormalLabelsForReviewAssistV67 === 'function') hideNormalLabelsForReviewAssistV67();
  if (typeof bindSelectionAssistHoverV67 === 'function') bindSelectionAssistHoverV67();
};

if (!document.getElementById('layoutSelectionDensityStylesV68')) {
  const style = document.createElement('style');
  style.id = 'layoutSelectionDensityStylesV68';
  style.textContent = `
    #selectionAssistOverlayV65 .selection-assist-label-v65.selection-assist-compact-v68{
      min-width:0!important;
      min-height:26px!important;
      max-width:230px!important;
      padding:3px 7px!important;
      border-radius:6px!important;
      font:600 12px/1.05 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;
      letter-spacing:0!important;
      box-sizing:border-box!important;
      white-space:nowrap!important;
      overflow:hidden!important;
      text-overflow:ellipsis!important;
      box-shadow:0 4px 13px rgba(0,0,0,.30)!important;
    }
    #selectionAssistOverlayV65 .selection-assist-label-v65.selection-assist-compact-v68:hover,
    #selectionAssistOverlayV65 .selection-assist-label-v65.selection-assist-compact-v68:focus-visible{
      transform:translate(-50%,-50%) scale(1.04)!important;
    }
    #selectionAssistOverlayV65 .selection-assist-hint-v68{
      top:9px!important;
      padding:5px 9px!important;
      font-size:10px!important;
      line-height:1.15!important;
    }
    #selectionAssistOverlayV65 .selection-assist-line-v65{
      opacity:.65;
    }
  `;
  document.head.appendChild(style);
}
