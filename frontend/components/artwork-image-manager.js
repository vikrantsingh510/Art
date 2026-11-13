'use client';

import { useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  acceptAttributeFromConstraints,
  formatFileBytes,
  isSelectedImageFile,
  validateArtworkImageFile,
} from '@/lib/artwork-image-constraints';
import { imageInspectionWarnings, inspectArtworkImageFile } from '@/lib/artwork-image-inspect';
import {
  MAX_ARTWORK_IMAGES,
  capacityLabel,
  moveImageItem,
  pendingImageKey,
  remainingImageSlots,
  savedImageKey,
  sortArtworkImages,
  takeFilesWithinLimit,
} from '@/lib/artwork-image-queue';
import { isArtworkDisplayDerivativePath, publicStorageUrl } from '@/lib/media';
import { InlineLoader } from './loading';
import { Field } from './ui';

function SortableImageCard({ item, disabled, onPrimary, onMove, onRemove, canMoveUp, canMoveDown }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.key,
    disabled,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`border border-fillet bg-stone p-4 space-y-3 ${isDragging ? 'artwork-image-dragging' : ''}`}
    >
      <div className="flex gap-4">
        <button
          type="button"
          className="shrink-0 cursor-grab active:cursor-grabbing"
          aria-label={`Drag to reorder ${item.label}`}
          {...attributes}
          {...listeners}
        >
          <div className="h-24 w-20 bg-surface-container-low overflow-hidden">
            {item.previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.previewUrl} alt="" className="h-full w-full object-contain" />
            ) : (
              <div className="h-full w-full flex items-end p-2">
                <p className="label-sm text-patina">No preview</p>
              </div>
            )}
          </div>
        </button>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm truncate">{item.label}</p>
          {item.sizeLabel ? <p className="text-xs text-patina">{item.sizeLabel}</p> : null}
          {item.pixelLabel ? <p className="text-xs text-patina">{item.pixelLabel}</p> : null}
          {Array.isArray(item.warnings) && item.warnings.length > 0 ? (
            item.warnings.map((warning) => (
              <p key={warning} className="text-xs text-patina">{warning}</p>
            ))
          ) : null}
          {item.isPrimary ? <p className="label-sm text-bronze">Primary image</p> : null}
          {item.error ? <p className="text-xs text-error">{item.error}</p> : null}
          {typeof item.progress === 'number' ? (
            <div className="space-y-1">
              <p className="label-sm text-patina">Upload progress {item.progress}%</p>
              <div className="upload-progress" aria-hidden="true">
                <span style={{ width: `${Math.max(0, Math.min(100, item.progress))}%` }} />
              </div>
            </div>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <button className="text-link min-h-11 inline-flex items-center" type="button" disabled={item.isPrimary} onClick={() => onPrimary(item.key)}>
          {item.isPrimary ? 'Primary' : 'Set as primary'}
        </button>
        <button className="text-link min-h-11 inline-flex items-center" type="button" disabled={!canMoveUp} onClick={() => onMove(item.key, -1)}>
          Move up
        </button>
        <button className="text-link min-h-11 inline-flex items-center" type="button" disabled={!canMoveDown} onClick={() => onMove(item.key, 1)}>
          Move down
        </button>
        <button className="text-link min-h-11 inline-flex items-center" type="button" onClick={() => onRemove(item.key)}>
          Remove
        </button>
      </div>
    </article>
  );
}

export function ArtworkImageManager({
  constraints,
  constraintsError,
  constraintsLoading,
  disabled = false,
  items,
  onItemsChange,
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const [pickerError, setPickerError] = useState('');
  const savedCount = items.filter((item) => item.kind === 'saved').length;
  const pendingCount = items.filter((item) => item.kind === 'pending').length;
  const remaining = remainingImageSlots(savedCount, pendingCount);
  const accept = acceptAttributeFromConstraints(constraints);
  const limitLabel = Number.isFinite(Number(constraints?.fileSizeLimitBytes))
    ? formatFileBytes(constraints.fileSizeLimitBytes)
    : null;
  const typesLabel = Array.isArray(constraints?.allowedMimeTypes) && constraints.allowedMimeTypes.length > 0
    ? constraints.allowedMimeTypes.join(', ')
    : null;

  function updateItems(next) {
    onItemsChange(next.map((item, index) => ({ ...item, displayOrder: index })));
  }

  async function onFilesSelected(fileList) {
    setPickerError('');
    const chosen = takeFilesWithinLimit(fileList, remaining);
    if ((fileList?.length || 0) > chosen.length) {
      setPickerError(`Only ${MAX_ARTWORK_IMAGES} images can be catalogued. Extra files were not added.`);
    }
    const additions = [];
    for (const file of chosen) {
      if (!isSelectedImageFile(file)) {
        continue;
      }
      const inspection = await inspectArtworkImageFile(file);
      const validation = validateArtworkImageFile(file, constraints, inspection);
      const warnings = validation.ok
        ? imageInspectionWarnings(inspection, {
          fileSize: file.size,
          fileSizeLimitBytes: constraints?.fileSizeLimitBytes,
        })
        : [];
      additions.push({
        key: pendingImageKey(`${file.lastModified}-${file.size}-${file.name}-${additions.length}`),
        kind: 'pending',
        file,
        label: file.name,
        sizeLabel: formatFileBytes(file.size),
        pixelLabel: inspection.width && inspection.height
          ? `${inspection.width} × ${inspection.height} px`
          : null,
        pixelWidth: inspection.width || null,
        pixelHeight: inspection.height || null,
        imageKind: inspection.kind || null,
        imageOk: inspection.ok === true,
        warnings,
        previewUrl: URL.createObjectURL(file),
        isPrimary: items.length + additions.length === 0,
        error: validation.ok ? '' : validation.message,
        progress: null,
      });
    }
    if (additions.length === 0) {
      return;
    }
    const next = [...items, ...additions];
    if (!next.some((item) => item.isPrimary)) {
      next[0].isPrimary = true;
    }
    updateItems(next);
  }

  function onPrimary(key) {
    updateItems(items.map((item) => ({ ...item, isPrimary: item.key === key })));
  }

  function onMove(key, offset) {
    const fromIndex = items.findIndex((item) => item.key === key);
    updateItems(moveImageItem(items, fromIndex, fromIndex + offset));
  }

  function onRemove(key) {
    const target = items.find((item) => item.key === key);
    if (!target) {
      return;
    }
    if (target.kind === 'saved') {
      const confirmed = window.confirm('Remove this catalogue image? The stored file will be deleted after save.');
      if (!confirmed) {
        return;
      }
    }
    if (target.previewUrl && target.kind === 'pending') {
      URL.revokeObjectURL(target.previewUrl);
    }
    const next = items.filter((item) => item.key !== key);
    if (target.isPrimary && next[0]) {
      next[0].isPrimary = true;
    }
    updateItems(next);
  }

  function onDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }
    const oldIndex = items.findIndex((item) => item.key === active.id);
    const newIndex = items.findIndex((item) => item.key === over.id);
    updateItems(arrayMove(items, oldIndex, newIndex));
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl">Public images</h2>
          <p className="text-sm text-on-surface-variant mt-2">
            Up to five gallery images. Files go to the public `artwork-images` bucket, then the path is registered. Size and type limits come from that bucket.
          </p>
        </div>
        <p className="label-md text-patina">{capacityLabel(savedCount, pendingCount)}</p>
      </div>
      {constraintsLoading ? (
        <InlineLoader label="Loading artwork-images bucket limits…" />
      ) : null}
      {constraintsError ? <p className="notice notice-error">{constraintsError}</p> : null}
      {limitLabel || typesLabel ? (
        <p className="text-sm text-on-surface-variant">
          {limitLabel ? `Maximum size: ${limitLabel}.` : 'This bucket does not publish a file size limit.'}
          {typesLabel ? ` Allowed types: ${typesLabel}.` : ''}
        </p>
      ) : null}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={items.map((item) => item.key)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {items.map((item, index) => (
              <SortableImageCard
                key={item.key}
                item={item}
                disabled={disabled}
                onPrimary={onPrimary}
                onMove={onMove}
                onRemove={onRemove}
                canMoveUp={index > 0}
                canMoveDown={index < items.length - 1}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      {items.length === 0 ? (
        <p className="text-sm text-on-surface-variant">No images selected. A published lot needs at least one catalogue image.</p>
      ) : null}
      <Field label="Add images" error={pickerError}>
        <input
          className="field-input"
          name="imageFiles"
          type="file"
          multiple
          accept={accept}
          disabled={disabled || remaining === 0 || constraintsLoading || Boolean(constraintsError && remaining > 0 && !constraints)}
          onChange={(event) => {
            onFilesSelected(event.target.files);
            event.target.value = '';
          }}
        />
      </Field>
      {remaining === 0 ? (
        <p className="text-xs text-patina">Five images are catalogued. Remove one to add another.</p>
      ) : (
        <p className="text-xs text-patina">{remaining} remaining. Drag to reorder, or use move up and move down.</p>
      )}
    </section>
  );
}

function kindFromStoragePath(storagePath) {
  const lower = String(storagePath || '').toLowerCase();
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
    return 'jpeg';
  }
  if (lower.endsWith('.png')) {
    return 'png';
  }
  if (lower.endsWith('.webp')) {
    return 'webp';
  }
  if (lower.endsWith('.avif')) {
    return 'avif';
  }
  return null;
}

export function createManagerItems(artwork) {
  const images = sortArtworkImages(artwork?.images)
    .filter((image) => !isArtworkDisplayDerivativePath(image.storagePath));
  return images.map((image, index) => ({
    key: savedImageKey(image.id),
    kind: 'saved',
    id: image.id,
    storagePath: image.storagePath,
    label: image.altText || image.storagePath,
    sizeLabel: null,
    previewUrl: publicStorageUrl(image.storagePath),
    isPrimary: Boolean(image.isPrimary) || (index === 0 && !images.some((item) => item.isPrimary)),
    error: '',
    progress: null,
    imageKind: kindFromStoragePath(image.storagePath),
    imageOk: true,
  }));
}

export function managerHasBlockingError(items, constraints) {
  return items.some((item) => {
    if (item.kind !== 'pending' || !item.file) {
      return false;
    }
    if (item.error) {
      return true;
    }
    const result = validateArtworkImageFile(item.file, constraints);
    return !result.ok;
  });
}
