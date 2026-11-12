import { formatDimensions } from './format.js';
import {
  SIZE_GUIDE_REFERENCES,
  sizeGuideArtworkCm,
} from './ar-assets/storefront.js';

export const SIZE_GUIDE_SCENE_ORDER = ['sofa', 'bed', 'wall'];

const SCENE_COPY = {
  sofa: {
    title: 'Above a three-seater sofa',
    furnitureLabel: 'Typical three-seat sofa',
  },
  bed: {
    title: 'Above a bed',
    furnitureLabel: 'Queen headboard',
  },
  wall: {
    title: 'On a representative wall',
    furnitureLabel: 'Representative interior wall',
  },
};

function positiveCm(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function sharedScaleScene(artworkCm, reference, { hangGapRatio, sidePadRatio, topPadRatio }) {
  const artW = positiveCm(artworkCm.widthCm);
  const artH = positiveCm(artworkCm.heightCm);
  const refW = positiveCm(reference.widthCm);
  const refH = positiveCm(reference.heightCm);
  if (!artW || !artH || !refW || !refH) {
    return null;
  }

  const hangGapCm = reference.id === 'wall' ? 0 : refH * hangGapRatio;
  const contentWidthCm = Math.max(artW, refW);
  const sidePadCm = contentWidthCm * sidePadRatio;
  const topPadCm = artH * topPadRatio;
  const sceneWidthCm = contentWidthCm + sidePadCm * 2;
  const sceneHeightCm = topPadCm + artH + hangGapCm + refH;

  return {
    id: reference.id,
    sceneAspect: sceneWidthCm / sceneHeightCm,
    artwork: {
      widthPct: (artW / sceneWidthCm) * 100,
      heightPct: (artH / sceneHeightCm) * 100,
      aspect: artW / artH,
      leftPct: ((sceneWidthCm - artW) / 2 / sceneWidthCm) * 100,
      bottomPct: ((refH + hangGapCm) / sceneHeightCm) * 100,
    },
    furniture: {
      widthPct: (refW / sceneWidthCm) * 100,
      heightPct: (refH / sceneHeightCm) * 100,
      aspect: refW / refH,
      leftPct: ((sceneWidthCm - refW) / 2 / sceneWidthCm) * 100,
      bottomPct: 0,
    },
  };
}

/**
 * Presentation-only layout. Reads catalogued centimetres and the stated
 * furniture references; never writes dimensions or AR placement.
 */
export function sizeGuideScene(artworkCm, reference) {
  if (!artworkCm || !reference) {
    return null;
  }

  const artW = positiveCm(artworkCm.widthCm);
  const artH = positiveCm(artworkCm.heightCm);
  const refW = positiveCm(reference.widthCm);
  const refH = positiveCm(reference.heightCm);
  if (!artW || !artH || !refW || !refH) {
    return null;
  }

  if (reference.id === 'wall') {
    const sceneWidthCm = Math.max(artW, refW);
    const sceneHeightCm = Math.max(artH, refH);
    return {
      id: reference.id,
      sceneAspect: sceneWidthCm / sceneHeightCm,
      artwork: {
        widthPct: (artW / sceneWidthCm) * 100,
        heightPct: (artH / sceneHeightCm) * 100,
        aspect: artW / artH,
        leftPct: ((sceneWidthCm - artW) / 2 / sceneWidthCm) * 100,
        bottomPct: ((sceneHeightCm - artH) / 2 / sceneHeightCm) * 100,
      },
      furniture: {
        widthPct: (refW / sceneWidthCm) * 100,
        heightPct: (refH / sceneHeightCm) * 100,
        aspect: refW / refH,
        leftPct: ((sceneWidthCm - refW) / 2 / sceneWidthCm) * 100,
        bottomPct: 0,
      },
    };
  }

  return sharedScaleScene(artworkCm, reference, {
    hangGapRatio: 0.16,
    sidePadRatio: 0.08,
    topPadRatio: 0.18,
  });
}

export function sizeGuideDimensionFields(artwork) {
  const unit = artwork?.dimensionUnit || '';
  return ['width', 'height', 'depth']
    .map((id) => {
      const raw = artwork?.[id];
      if (raw === null || raw === undefined || raw === '') {
        return null;
      }
      return {
        id,
        label: id.charAt(0).toUpperCase() + id.slice(1),
        value: String(raw),
        unit,
        display: unit ? `${raw} ${unit}` : String(raw),
      };
    })
    .filter(Boolean);
}

export function sizeGuideAxisLabel(fields) {
  if (!fields.length) {
    return null;
  }
  return fields.map((field) => field.label).join(' × ');
}

function sofaRelation(artworkCm, reference) {
  const ratio = artworkCm.widthCm / reference.widthCm;
  if (ratio < 0.85) {
    return 'The artwork is narrower than the sofa, so it reads as a companion above the seating rather than a wall-filling canvas.';
  }
  if (ratio > 1.05) {
    return 'The artwork is wider than the sofa and will command the wall above the seating.';
  }
  return 'The artwork is close to the sofa width and will fill the wall above the seating.';
}

function bedRelation(artworkCm, reference) {
  const ratio = artworkCm.widthCm / reference.widthCm;
  if (ratio < 0.85) {
    return 'The artwork is narrower than the headboard, sitting as a centred piece above the bed.';
  }
  if (ratio > 1.05) {
    return 'The artwork is wider than the headboard and will span beyond the bed.';
  }
  return 'The artwork is close to the headboard width, as a bed often carries a work.';
}

function wallRelation(artworkCm, reference) {
  const widthRatio = artworkCm.widthCm / reference.widthCm;
  const heightRatio = artworkCm.heightCm / reference.heightCm;
  if (widthRatio < 0.4 && heightRatio < 0.5) {
    return 'On this wall the work reads as an intimate hanging, with generous space around the frame.';
  }
  if (widthRatio > 0.75 || heightRatio > 0.75) {
    return 'On this wall the work reads as a substantial hanging and will occupy much of the surface.';
  }
  return 'On this wall the work has a clear presence without filling the entire surface.';
}

export function sizeGuideComparisonCopy(reference, artwork, artworkCm) {
  const meta = SCENE_COPY[reference.id];
  const dimensions = formatDimensions(artwork);
  const furnitureSize = `${reference.widthCm} × ${reference.heightCm} cm`;
  const relations = {
    sofa: sofaRelation,
    bed: bedRelation,
    wall: wallRelation,
  };
  const relation = relations[reference.id]?.(artworkCm, reference) || '';

  return {
    title: meta.title,
    furnitureLabel: meta.furnitureLabel,
    furnitureSize,
    body: `${relation} Artwork ${dimensions}.`,
  };
}

export function sizeGuideComparisons(artwork) {
  const artworkCm = sizeGuideArtworkCm(artwork);
  if (!artworkCm) {
    return [];
  }

  return SIZE_GUIDE_SCENE_ORDER.map((id) => {
    const reference = SIZE_GUIDE_REFERENCES[id];
    const scene = sizeGuideScene(artworkCm, reference);
    if (!scene) {
      return null;
    }
    return {
      reference,
      artworkCm,
      scene,
      copy: sizeGuideComparisonCopy(reference, artwork, artworkCm),
    };
  }).filter(Boolean);
}
