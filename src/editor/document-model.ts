export const MAX_DOCUMENT_DIMENSION = 8192;
export const MAX_DOCUMENT_PIXELS = 32_000_000;
export const DOCUMENT_SCHEMA_VERSION = 1;

export type DocumentBackground = "transparent" | "white" | "black";
export type DocumentResampling = "nearest" | "bilinear" | "high";
export type LayerId = string;
export type Matrix2D = [number, number, number, number, number, number];

export const IDENTITY_MATRIX: Matrix2D = [1, 0, 0, 1, 0, 0];

export type LayerBase = {
  id: LayerId;
  parentId: LayerId | null;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  transform: Matrix2D;
};

export type RasterLayer = LayerBase & {
  kind: "raster";
  bufferId: string;
  width: number;
  height: number;
};

export type SerializedVectorObject = {
  type: string;
  properties: Record<string, unknown>;
};

export type VectorLayer = LayerBase & {
  kind: "vector";
  object: SerializedVectorObject;
};

export type GroupLayer = LayerBase & {
  kind: "group";
  childIds: LayerId[];
};

export type LayerNode = RasterLayer | VectorLayer | GroupLayer;

export type DocumentModel = {
  schemaVersion: typeof DOCUMENT_SCHEMA_VERSION;
  id: string;
  name: string;
  width: number;
  height: number;
  background: DocumentBackground;
  resampling: DocumentResampling;
  /** Sibling arrays are stored bottommost to topmost. */
  rootLayerIds: LayerId[];
  layers: LayerNode[];
  activeLayerId: LayerId;
};

export type DocumentDimensions = Pick<DocumentModel, "width" | "height">;

export type LayerTreeRow = {
  layer: LayerNode;
  depth: number;
};

export type BufferCopy = {
  sourceBufferId: string;
  targetBufferId: string;
};

let generatedId = 0;

function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  generatedId += 1;
  return `${prefix}-${generatedId}`;
}

export function createBufferId(): string {
  return createId("buffer");
}

export function assertSupportedDimensions(width: number, height: number): void {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new Error("Document dimensions must be positive whole numbers.");
  }

  if (width > MAX_DOCUMENT_DIMENSION || height > MAX_DOCUMENT_DIMENSION) {
    throw new Error(`Document dimensions cannot exceed ${MAX_DOCUMENT_DIMENSION} px.`);
  }

  if (width * height > MAX_DOCUMENT_PIXELS) {
    throw new Error("Document pixel count exceeds the safe browser limit.");
  }
}

function cloneVectorObject(object: SerializedVectorObject): SerializedVectorObject {
  return {
    type: object.type,
    properties: { ...object.properties },
  };
}

function cloneLayer(layer: LayerNode): LayerNode {
  if (layer.kind === "group") {
    return {
      ...layer,
      transform: [...layer.transform] as Matrix2D,
      childIds: [...layer.childIds],
    };
  }
  if (layer.kind === "vector") {
    return {
      ...layer,
      transform: [...layer.transform] as Matrix2D,
      object: cloneVectorObject(layer.object),
    };
  }
  return { ...layer, transform: [...layer.transform] as Matrix2D };
}

export function cloneDocumentModel(document: DocumentModel): DocumentModel {
  return {
    ...document,
    rootLayerIds: [...document.rootLayerIds],
    layers: document.layers.map(cloneLayer),
  };
}

function createLayerBase(name: string, parentId: LayerId | null): LayerBase {
  return {
    id: createId("layer"),
    parentId,
    name,
    visible: true,
    locked: false,
    opacity: 1,
    transform: [...IDENTITY_MATRIX],
  };
}

export function createVectorLayer(options: {
  name: string;
  object: SerializedVectorObject;
  parentId?: LayerId | null;
}): VectorLayer {
  return {
    ...createLayerBase(options.name, options.parentId ?? null),
    kind: "vector",
    object: cloneVectorObject(options.object),
  };
}

export function createRasterLayer(options: {
  name: string;
  width: number;
  height: number;
  bufferId?: string;
  parentId?: LayerId | null;
}): RasterLayer {
  assertSupportedDimensions(options.width, options.height);
  return {
    ...createLayerBase(options.name, options.parentId ?? null),
    kind: "raster",
    bufferId: options.bufferId ?? createBufferId(),
    width: options.width,
    height: options.height,
  };
}

export function createGroupLayer(options: {
  name: string;
  parentId?: LayerId | null;
  childIds?: LayerId[];
}): GroupLayer {
  return {
    ...createLayerBase(options.name, options.parentId ?? null),
    kind: "group",
    childIds: [...(options.childIds ?? [])],
  };
}

export function createDocumentModel(options: {
  name: string;
  width: number;
  height: number;
  background: DocumentBackground;
  layerName: string;
}): DocumentModel {
  assertSupportedDimensions(options.width, options.height);
  const layer = createRasterLayer({
    name: options.layerName,
    width: options.width,
    height: options.height,
  });
  const model: DocumentModel = {
    schemaVersion: DOCUMENT_SCHEMA_VERSION,
    id: createId("document"),
    name: options.name,
    width: options.width,
    height: options.height,
    background: options.background,
    resampling: "high",
    rootLayerIds: [layer.id],
    layers: [layer],
    activeLayerId: layer.id,
  };

  assertDocumentInvariant(model);
  return model;
}

export function createBlankDocument(options: {
  width: number;
  height: number;
  background: DocumentBackground;
}): DocumentModel {
  return createDocumentModel({
    ...options,
    name: "Untitled",
    layerName: "Background",
  });
}

export function createImportedDocument(options: {
  name: string;
  width: number;
  height: number;
}): DocumentModel {
  return createDocumentModel({
    ...options,
    background: "transparent",
    layerName: options.name,
  });
}

export function getLayerById(document: DocumentModel, layerId: LayerId): LayerNode {
  const layer = document.layers.find((candidate) => candidate.id === layerId);
  if (!layer) {
    throw new Error(`Layer ${layerId} does not exist.`);
  }
  return layer;
}

export function getActiveLayer(document: DocumentModel): LayerNode {
  return getLayerById(document, document.activeLayerId);
}

function getSiblingIds(document: DocumentModel, parentId: LayerId | null): LayerId[] {
  if (parentId === null) {
    return document.rootLayerIds;
  }
  const parent = getLayerById(document, parentId);
  if (parent.kind !== "group") {
    throw new Error("Only groups can own child layers.");
  }
  return parent.childIds;
}

export function getLayerSubtreeIds(document: DocumentModel, layerId: LayerId): LayerId[] {
  const ids: LayerId[] = [];
  const visit = (id: LayerId) => {
    const layer = getLayerById(document, id);
    ids.push(id);
    if (layer.kind === "group") {
      layer.childIds.forEach(visit);
    }
  };
  visit(layerId);
  return ids;
}

export function flattenLayerTree(document: DocumentModel, topmostFirst = true): LayerTreeRow[] {
  const rows: LayerTreeRow[] = [];
  const visit = (ids: LayerId[], depth: number) => {
    const ordered = topmostFirst ? [...ids].reverse() : ids;
    for (const id of ordered) {
      const layer = getLayerById(document, id);
      rows.push({ layer, depth });
      if (layer.kind === "group") {
        visit(layer.childIds, depth + 1);
      }
    }
  };
  visit(document.rootLayerIds, 0);
  return rows;
}

export function serializeDocumentModel(document: DocumentModel): string {
  assertDocumentInvariant(document);
  return JSON.stringify(document);
}

export function assertDocumentInvariant(document: DocumentModel): void {
  assertSupportedDimensions(document.width, document.height);

  if (document.schemaVersion !== DOCUMENT_SCHEMA_VERSION) {
    throw new Error("Unsupported document schema version.");
  }
  if (
    document.resampling !== undefined &&
    !(["nearest", "bilinear", "high"] as const).includes(document.resampling)
  ) {
    throw new Error("Unsupported document resampling mode.");
  }
  if (document.layers.length === 0 || document.rootLayerIds.length === 0) {
    throw new Error("A document must contain at least one root layer.");
  }

  const layerById = new Map<LayerId, LayerNode>();
  for (const layer of document.layers) {
    if (layerById.has(layer.id)) {
      throw new Error("Document layer IDs must be unique.");
    }
    layerById.set(layer.id, layer);

    if (!layer.name.trim()) {
      throw new Error("Layer names cannot be empty.");
    }
    if (layer.opacity < 0 || layer.opacity > 1) {
      throw new Error("Layer opacity must be between 0 and 1.");
    }
    if (layer.transform.some((value) => !Number.isFinite(value))) {
      throw new Error("Layer transforms must contain only finite numbers.");
    }
    const determinant =
      layer.transform[0] * layer.transform[3] - layer.transform[1] * layer.transform[2];
    if (Math.abs(determinant) < 1e-8) {
      throw new Error("Layer transforms cannot be singular.");
    }
    if (layer.kind === "raster" && (layer.width < 1 || layer.height < 1)) {
      throw new Error("Layer dimensions must be positive.");
    }
  }

  if (!layerById.has(document.activeLayerId)) {
    throw new Error("The active layer must exist in the document layer tree.");
  }

  const rootIds = new Set<LayerId>();
  for (const rootId of document.rootLayerIds) {
    const root = layerById.get(rootId);
    if (!root) {
      throw new Error("Every root layer ID must reference an existing layer.");
    }
    if (rootIds.has(rootId)) {
      throw new Error("Root layer IDs must be unique.");
    }
    rootIds.add(rootId);
    if (root.parentId !== null) {
      throw new Error("Root layers cannot have a parent.");
    }
  }

  const childOwner = new Map<LayerId, LayerId>();
  for (const layer of document.layers) {
    if (layer.kind !== "group") {
      continue;
    }
    const localIds = new Set<LayerId>();
    for (const childId of layer.childIds) {
      if (childId === layer.id) {
        throw new Error("A group cannot contain itself.");
      }
      if (localIds.has(childId) || childOwner.has(childId)) {
        throw new Error("A layer can have only one parent.");
      }
      const child = layerById.get(childId);
      if (!child) {
        throw new Error("Every child ID must reference an existing layer.");
      }
      if (child.parentId !== layer.id) {
        throw new Error("Child and parent references must agree.");
      }
      localIds.add(childId);
      childOwner.set(childId, layer.id);
    }
  }

  for (const layer of document.layers) {
    if (layer.parentId === null) {
      if (!rootIds.has(layer.id)) {
        throw new Error("Every parentless layer must appear in the root order.");
      }
    } else if (childOwner.get(layer.id) !== layer.parentId) {
      throw new Error("Every nested layer must appear in its parent group.");
    }
  }

  const visited = new Set<LayerId>();
  const visiting = new Set<LayerId>();
  const visit = (layerId: LayerId) => {
    if (visiting.has(layerId)) {
      throw new Error("The layer tree cannot contain a cycle.");
    }
    if (visited.has(layerId)) {
      return;
    }
    visiting.add(layerId);
    const layer = getLayerById(document, layerId);
    if (layer.kind === "group") {
      layer.childIds.forEach(visit);
    }
    visiting.delete(layerId);
    visited.add(layerId);
  };
  document.rootLayerIds.forEach(visit);

  if (visited.size !== document.layers.length) {
    throw new Error("Every layer must be reachable from the document root.");
  }
}

function withLayerUpdate(
  document: DocumentModel,
  layerId: LayerId,
  update: (layer: LayerNode) => LayerNode,
): DocumentModel {
  const next = cloneDocumentModel(document);
  next.layers = next.layers.map((layer) => (layer.id === layerId ? update(layer) : layer));
  assertDocumentInvariant(next);
  return next;
}

export function setActiveLayer(document: DocumentModel, layerId: LayerId): DocumentModel {
  getLayerById(document, layerId);
  if (document.activeLayerId === layerId) {
    return document;
  }
  return { ...document, activeLayerId: layerId };
}

export function renameLayer(
  document: DocumentModel,
  layerId: LayerId,
  name: string,
): DocumentModel {
  const normalizedName = name.trim();
  if (!normalizedName) {
    throw new Error("Layer names cannot be empty.");
  }
  return withLayerUpdate(document, layerId, (layer) => ({ ...layer, name: normalizedName }));
}

export function setLayerVisibility(
  document: DocumentModel,
  layerId: LayerId,
  visible: boolean,
): DocumentModel {
  return withLayerUpdate(document, layerId, (layer) => ({ ...layer, visible }));
}

export function setLayerLocked(
  document: DocumentModel,
  layerId: LayerId,
  locked: boolean,
): DocumentModel {
  return withLayerUpdate(document, layerId, (layer) => ({ ...layer, locked }));
}

export function setLayerOpacity(
  document: DocumentModel,
  layerId: LayerId,
  opacity: number,
): DocumentModel {
  if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1) {
    throw new Error("Layer opacity must be between 0 and 1.");
  }
  return withLayerUpdate(document, layerId, (layer) => ({ ...layer, opacity }));
}

export function setLayerTransform(
  document: DocumentModel,
  layerId: LayerId,
  transform: Matrix2D,
): DocumentModel {
  return withLayerUpdate(document, layerId, (layer) => ({
    ...layer,
    transform: [...transform] as Matrix2D,
  }));
}

function insertId(ids: LayerId[], id: LayerId, index: number): void {
  ids.splice(Math.max(0, Math.min(index, ids.length)), 0, id);
}

function defaultInsertPosition(document: DocumentModel): {
  parentId: LayerId | null;
  index: number;
} {
  const active = getActiveLayer(document);
  const siblings = getSiblingIds(document, active.parentId);
  return {
    parentId: active.parentId,
    index: siblings.indexOf(active.id) + 1,
  };
}

export function insertRasterLayer(
  document: DocumentModel,
  options: {
    name?: string;
    bufferId?: string;
    parentId?: LayerId | null;
    index?: number;
  } = {},
): { document: DocumentModel; layer: RasterLayer } {
  const next = cloneDocumentModel(document);
  const fallback = defaultInsertPosition(next);
  const parentId = options.parentId === undefined ? fallback.parentId : options.parentId;
  const siblings = getSiblingIds(next, parentId);
  const layer = createRasterLayer({
    name: options.name ?? "Paint Layer",
    width: next.width,
    height: next.height,
    bufferId: options.bufferId,
    parentId,
  });
  next.layers.push(layer);
  insertId(
    siblings,
    layer.id,
    options.index ?? (parentId === fallback.parentId ? fallback.index : siblings.length),
  );
  next.activeLayerId = layer.id;
  assertDocumentInvariant(next);
  return { document: next, layer };
}

export function insertVectorLayer(
  document: DocumentModel,
  options: {
    name?: string;
    object: SerializedVectorObject;
    parentId?: LayerId | null;
    index?: number;
  },
): { document: DocumentModel; layer: VectorLayer } {
  const next = cloneDocumentModel(document);
  const fallback = defaultInsertPosition(next);
  const parentId = options.parentId === undefined ? fallback.parentId : options.parentId;
  const siblings = getSiblingIds(next, parentId);
  const layer = createVectorLayer({
    name: options.name ?? "Shape",
    object: options.object,
    parentId,
  });
  next.layers.push(layer);
  insertId(
    siblings,
    layer.id,
    options.index ?? (parentId === fallback.parentId ? fallback.index : siblings.length),
  );
  next.activeLayerId = layer.id;
  assertDocumentInvariant(next);
  return { document: next, layer };
}

export function setVectorObject(
  document: DocumentModel,
  layerId: LayerId,
  object: SerializedVectorObject,
): DocumentModel {
  return withLayerUpdate(document, layerId, (layer) => {
    if (layer.kind !== "vector") throw new Error("Only vector layers have editable shape data.");
    return { ...layer, object: cloneVectorObject(object) };
  });
}

export function rasterizeRootVectorLayer(
  document: DocumentModel,
  layerId: LayerId,
  bufferId = createBufferId(),
): { document: DocumentModel; layer: RasterLayer } {
  const next = cloneDocumentModel(document);
  const current = getLayerById(next, layerId);
  if (current.kind !== "vector") throw new Error("Only vector layers can be rasterized.");
  if (current.parentId !== null) {
    throw new Error("Move the vector layer to the document root before rasterizing it.");
  }
  const layer: RasterLayer = {
    id: current.id,
    parentId: null,
    name: current.name,
    visible: current.visible,
    locked: current.locked,
    opacity: 1,
    transform: [...IDENTITY_MATRIX],
    kind: "raster",
    bufferId,
    width: next.width,
    height: next.height,
  };
  next.layers = next.layers.map((candidate) => (candidate.id === layerId ? layer : candidate));
  assertDocumentInvariant(next);
  return { document: next, layer };
}

export function insertGroupLayer(
  document: DocumentModel,
  options: { name?: string; parentId?: LayerId | null; index?: number } = {},
): { document: DocumentModel; layer: GroupLayer } {
  const next = cloneDocumentModel(document);
  const fallback = defaultInsertPosition(next);
  const parentId = options.parentId === undefined ? fallback.parentId : options.parentId;
  const siblings = getSiblingIds(next, parentId);
  const layer = createGroupLayer({ name: options.name ?? "Layer Group", parentId });
  next.layers.push(layer);
  insertId(
    siblings,
    layer.id,
    options.index ?? (parentId === fallback.parentId ? fallback.index : siblings.length),
  );
  next.activeLayerId = layer.id;
  assertDocumentInvariant(next);
  return { document: next, layer };
}

export function duplicateLayerSubtree(
  document: DocumentModel,
  layerId: LayerId,
): { document: DocumentModel; rootLayerId: LayerId; bufferCopies: BufferCopy[] } {
  const next = cloneDocumentModel(document);
  const originalRoot = getLayerById(next, layerId);
  const subtreeIds = getLayerSubtreeIds(next, layerId);
  const idMap = new Map(subtreeIds.map((id) => [id, createId("layer")]));
  const bufferCopies: BufferCopy[] = [];
  const clones = subtreeIds.map((id) => {
    const original = getLayerById(next, id);
    const clone = cloneLayer(original);
    clone.id = idMap.get(id) ?? clone.id;
    clone.name = id === layerId ? `${original.name} copy` : original.name;
    clone.parentId =
      id === layerId
        ? original.parentId
        : original.parentId
          ? (idMap.get(original.parentId) ?? original.parentId)
          : null;
    if (clone.kind === "group") {
      clone.childIds = clone.childIds.map((childId) => idMap.get(childId) ?? childId);
    } else if (clone.kind === "raster") {
      const targetBufferId = createBufferId();
      bufferCopies.push({ sourceBufferId: clone.bufferId, targetBufferId });
      clone.bufferId = targetBufferId;
    }
    return clone;
  });
  next.layers.push(...clones);

  const siblings = getSiblingIds(next, originalRoot.parentId);
  const originalIndex = siblings.indexOf(layerId);
  const rootLayerId = idMap.get(layerId);
  if (!rootLayerId || originalIndex < 0) {
    throw new Error("The layer could not be duplicated.");
  }
  siblings.splice(originalIndex + 1, 0, rootLayerId);
  next.activeLayerId = rootLayerId;
  assertDocumentInvariant(next);
  return { document: next, rootLayerId, bufferCopies };
}

export function deleteLayerSubtree(document: DocumentModel, layerId: LayerId): DocumentModel {
  const next = cloneDocumentModel(document);
  const layer = getLayerById(next, layerId);
  const removedIds = new Set(getLayerSubtreeIds(next, layerId));
  if (removedIds.size === next.layers.length) {
    throw new Error("A document must keep at least one layer.");
  }

  const siblings = getSiblingIds(next, layer.parentId);
  const index = siblings.indexOf(layerId);
  siblings.splice(index, 1);
  next.layers = next.layers.filter((candidate) => !removedIds.has(candidate.id));

  if (removedIds.has(next.activeLayerId)) {
    next.activeLayerId =
      siblings[Math.min(index, siblings.length - 1)] ??
      layer.parentId ??
      next.rootLayerIds[next.rootLayerIds.length - 1] ??
      next.layers[0]!.id;
  }
  assertDocumentInvariant(next);
  return next;
}

export function wrapLayerInGroup(
  document: DocumentModel,
  layerId: LayerId,
  name = "Layer Group",
): DocumentModel {
  const next = cloneDocumentModel(document);
  const layer = getLayerById(next, layerId);
  const siblings = getSiblingIds(next, layer.parentId);
  const index = siblings.indexOf(layerId);
  const group = createGroupLayer({ name, parentId: layer.parentId, childIds: [layer.id] });
  siblings.splice(index, 1, group.id);
  layer.parentId = group.id;
  next.layers.push(group);
  next.activeLayerId = group.id;
  assertDocumentInvariant(next);
  return next;
}

export function ungroupLayer(document: DocumentModel, groupId: LayerId): DocumentModel {
  const next = cloneDocumentModel(document);
  const group = getLayerById(next, groupId);
  if (group.kind !== "group") {
    throw new Error("Only a group layer can be ungrouped.");
  }
  const siblings = getSiblingIds(next, group.parentId);
  const index = siblings.indexOf(group.id);
  siblings.splice(index, 1, ...group.childIds);
  for (const childId of group.childIds) {
    getLayerById(next, childId).parentId = group.parentId;
  }
  next.layers = next.layers.filter((layer) => layer.id !== group.id);
  next.activeLayerId =
    group.childIds[group.childIds.length - 1] ??
    siblings[Math.min(index, siblings.length - 1)] ??
    group.parentId ??
    next.rootLayerIds[next.rootLayerIds.length - 1]!;
  assertDocumentInvariant(next);
  return next;
}

export function moveLayerWithinParent(
  document: DocumentModel,
  layerId: LayerId,
  direction: "up" | "down",
): DocumentModel {
  const next = cloneDocumentModel(document);
  const layer = getLayerById(next, layerId);
  const siblings = getSiblingIds(next, layer.parentId);
  const index = siblings.indexOf(layerId);
  const targetIndex = index + (direction === "up" ? 1 : -1);
  if (targetIndex < 0 || targetIndex >= siblings.length) {
    return document;
  }
  [siblings[index], siblings[targetIndex]] = [siblings[targetIndex]!, siblings[index]!];
  next.activeLayerId = layerId;
  assertDocumentInvariant(next);
  return next;
}

export function moveLayer(
  document: DocumentModel,
  layerId: LayerId,
  destinationParentId: LayerId | null,
  destinationIndex: number,
): DocumentModel {
  const next = cloneDocumentModel(document);
  const layer = getLayerById(next, layerId);
  if (destinationParentId !== null) {
    const destination = getLayerById(next, destinationParentId);
    if (destination.kind !== "group") {
      throw new Error("Layers can only be nested inside a group.");
    }
    if (getLayerSubtreeIds(next, layerId).includes(destinationParentId)) {
      throw new Error("A group cannot move into its own descendant.");
    }
  }

  const oldSiblings = getSiblingIds(next, layer.parentId);
  const oldIndex = oldSiblings.indexOf(layerId);
  oldSiblings.splice(oldIndex, 1);

  const destinationSiblings = getSiblingIds(next, destinationParentId);
  const adjustedIndex =
    layer.parentId === destinationParentId && destinationIndex > oldIndex
      ? destinationIndex - 1
      : destinationIndex;
  insertId(destinationSiblings, layerId, adjustedIndex);
  layer.parentId = destinationParentId;
  next.activeLayerId = layerId;
  assertDocumentInvariant(next);
  return next;
}

export function outdentLayer(document: DocumentModel, layerId: LayerId): DocumentModel {
  const layer = getLayerById(document, layerId);
  if (layer.parentId === null) {
    return document;
  }
  const parent = getLayerById(document, layer.parentId);
  const grandParentId = parent.parentId;
  const parentSiblings = getSiblingIds(document, grandParentId);
  return moveLayer(document, layerId, grandParentId, parentSiblings.indexOf(parent.id) + 1);
}
