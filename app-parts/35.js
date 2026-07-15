// Compact central Shift-selection labels with guaranteed non-overlapping placement.
// Loads after app-parts/34.js and before app-parts/08.js.

const layoutSelectionDensityVersionV69 = '20260715-central-packed-labels-v69';
const selectionAssistMeasureCanvasV69 = document.createElement('canvas');
const selectionAssistMeasureContextV69 = selectionAssistMeasureCanvasV69.getContext('2d');

function selectionAssistLabelWidthV69(text) {
  const label = String(text || 'Object');
  if (selectionAssistMeasureContextV69) {
    selectionAssistMeasureContextV69.font = '600 11px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    return Math.max(42, Math.min(220, Math.ceil(selectionAssistMeasureContextV69.measureText(label).width + 14)));
  }
  return Math.max(42, Math.min(220, 14 + label.length * 6.1));
}

function selectionAssistCentralEntriesV69(entries, metrics) {
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

  if (!central.length) central = [...mapped].sort((a, b) => a.centreScore - b.centreScore).slice(0, 6);

  const review = typeof architectureReviewActiveV67 === 'function' && architectureReviewActiveV67();
  const limit = width < 700 ? 8 : review ? 12 : 14;
  return central
    .sort((a, b) => a.centreScore - b.centreScore)
    .slice(0, limit);
}

function selectionAssistCompactRectV69(centreX, centreY, width, height) {
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

function selectionAssistRectInsideV69(rect, bounds) {
  return (
    rect.left >= bounds.left &&
    rect.right <= bounds.right &&
    rect.top >= bounds.top &&
    rect.bottom <= bounds.bottom
  );
}

function selectionAssistRectFreeV69(rect, occupied, gap = 5) {
  return !occupied.some(other => rectanglesOverlapV65(rect, other, gap));
}

function localSelectionAssistCandidatesV69(anchor, width, height) {
  const candidates = [];
  const horizontalStep = Math.max(34, width * .42);
  const verticalStep = height + 7;

  for (let ring = 1; ring <= 10; ring++) {
    const yOffsets = [-ring, ring];
    const xLimit = Math.max(1, Math.min(8, ring + 2));
    yOffsets.forEach(yIndex => {
      for (let xIndex = -xLimit; xIndex <= xLimit; xIndex++) {
        candidates.push({
          x: anchor.x + xIndex * horizontalStep,
          y: anchor.y + yIndex * verticalStep,
          distance: Math.hypot(xIndex * horizontalStep, yIndex * verticalStep)
        });
      }
    });
  }

  candidates.sort((a, b) => a.distance - b.distance);
  return candidates;
}

function nearestFreeViewportSlotV69(anchor, width, height, occupied, bounds) {
  let best = null;
  const xMin = bounds.left + width / 2;
  const xMax = bounds.right - width / 2;
  const yMin = bounds.top + height / 2;
  const yMax = bounds.bottom - height / 2;
  const stepX = 8;
  const stepY = 6;

  if (xMax < xMin || yMax < yMin) return null;

  for (let y = yMin; y <= yMax; y += stepY) {
    for (let x = xMin; x <= xMax; x += stepX) {
      const rect = selectionAssistCompactRectV69(x, y, width, height);
      if (!selectionAssistRectFreeV69(rect, occupied, 5)) continue;
      const distance = Math.hypot(x - anchor.x, y - anchor.y);
      if (!best || distance < best.distance) best = { rect, distance };
    }
  }

  return best?.rect || null;
}

function placeCompactSelectionAssistLabelV69(anchor, text, occupied, bounds) {
  const measuredWidth = selectionAssistLabelWidthV69(text);
  const heightOptions = [24, 22, 20];
  const widthOptions = [
    measuredWidth,
    Math.min(measuredWidth, 190),
    Math.min(measuredWidth, 160),
    Math.min(measuredWidth, 130),
    Math.min(measuredWidth, 104)
  ].filter((value, index, values) => values.indexOf(value) === index);

  for (const height of heightOptions) {
    for (const width of widthOptions) {
      const localCandidates = localSelectionAssistCandidatesV69(anchor, width, height);
      for (const candidate of localCandidates) {
        const rect = selectionAssistCompactRectV69(candidate.x, candidate.y, width, height);
        if (!selectionAssistRectInsideV69(rect, bounds)) continue;
        if (!selectionAssistRectFreeV69(rect, occupied, 5)) continue;
        occupied.push(rect);
        return rect;
      }

      const viewportSlot = nearestFreeViewportSlotV69(anchor, width, height, occupied, bounds);
      if (viewportSlot) {
        occupied.push(viewportSlot);
        return viewportSlot;
      }
    }
  }

  // Emergency deterministic packing. This should only run on extremely small
  // viewports, but still keeps every label instead of omitting one.
  const width = Math.max(72, Math.min(104, measuredWidth));
  const height = 19;
  const columns = Math.max(1, Math.floor((bounds.right - bounds.left) / (width + 5)));
  const index = occupied.length;
  const column = index % columns;
  const row = Math.floor(index / columns);
  const centreX = Math.min(
    bounds.right - width / 2,
    bounds.left + width / 2 + column * (width + 5)
  );
  const centreY = Math.min(
    bounds.bottom - height / 2,
    bounds.top + height / 2 + row * (height + 5)
  );
  const rect = selectionAssistCompactRectV69(centreX, centreY, width, height);
  occupied.push(rect);
  return rect;
}

renderSelectionAssistV65 = function(force = false) {
  if (!selectionAssistActiveV65 || !selectionAssistOverlayV65) return;
  const now = performance.now();
  if (!force && now - selectionAssistLastRenderV65 < 70) return;
  selectionAssistLastRenderV65 = now;

  enforceHiddenFurnitureLabelsV65();
  const metrics = selectionAssistCanvasMetricsV65();
  if (!metrics) return;

  const entries = selectionAssistCentralEntriesV69(collectSelectionAssistEntriesV65(), metrics);
  selectionAssistOverlayV65.replaceChildren();

  const hint = document.createElement('div');
  hint.className = 'selection-assist-hint-v65 selection-assist-hint-v69';
  const review = typeof architectureReviewActiveV67 === 'function' && architectureReviewActiveV67();
  hint.textContent = review
    ? 'Central walls, doors and windows · click to select'
    : 'Central objects · click to select';
  selectionAssistOverlayV65.appendChild(hint);

  const bounds = {
    left: 7,
    right: Math.max(7, metrics.viewportRect.width - 7),
    top: 42,
    bottom: Math.max(42, metrics.viewportRect.height - 7)
  };
  const occupied = [];

  entries.forEach(entry => {
    const rect = placeCompactSelectionAssistLabelV69(
      entry.anchor,
      entry.displayName || entry.name,
      occupied,
      bounds
    );

    addSelectionAssistLineV65(entry.anchor, rect);

    const button = document.createElement('button');
    button.type = 'button';
    button.className = `selection-assist-label-v65 selection-assist-${entry.kind}-v65 selection-assist-compact-v69`;
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

if (!document.getElementById('layoutSelectionDensityStylesV69')) {
  const style = document.createElement('style');
  style.id = 'layoutSelectionDensityStylesV69';
  style.textContent = `
    #selectionAssistOverlayV65 .selection-assist-label-v65.selection-assist-compact-v69{
      min-width:0!important;
      min-height:19px!important;
      max-width:220px!important;
      padding:2px 6px!important;
      border-radius:5px!important;
      font:600 11px/1 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;
      letter-spacing:0!important;
      box-sizing:border-box!important;
      white-space:nowrap!important;
      overflow:hidden!important;
      text-overflow:ellipsis!important;
      box-shadow:0 3px 11px rgba(0,0,0,.28)!important;
    }
    #selectionAssistOverlayV65 .selection-assist-label-v65.selection-assist-compact-v69:hover,
    #selectionAssistOverlayV65 .selection-assist-label-v65.selection-assist-compact-v69:focus-visible{
      transform:translate(-50%,-50%) scale(1.04)!important;
    }
    #selectionAssistOverlayV65 .selection-assist-hint-v69{
      top:8px!important;
      padding:4px 8px!important;
      font-size:10px!important;
      line-height:1.1!important;
    }
    #selectionAssistOverlayV65 .selection-assist-line-v65{
      opacity:.62;
    }
  `;
  document.head.appendChild(style);
}
