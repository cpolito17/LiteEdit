import { useMemo, useState, type DragEvent, type KeyboardEvent } from "react";

import {
  getLayerById,
  getLayerSubtreeIds,
  type DocumentModel,
  type LayerId,
  type LayerNode,
  type LayerTreeRow,
} from "../../editor/document-model";
import { SliderField, UiButton } from "../primitives/Ui";

type LayersPanelProps = {
  model: DocumentModel;
  onActivate: (layerId: LayerId) => void;
  onAddRaster: () => void;
  onAddGroup: () => void;
  onDuplicate: (layerId: LayerId) => void;
  onDelete: (layerId: LayerId) => void;
  onGroup: (layerId: LayerId) => void;
  onUngroup: (layerId: LayerId) => void;
  onRename: (layerId: LayerId, name: string) => void;
  onToggleVisibility: (layerId: LayerId, visible: boolean) => void;
  onToggleLock: (layerId: LayerId, locked: boolean) => void;
  onOpacityChange: (layerId: LayerId, opacity: number) => void;
  onMoveWithinParent: (layerId: LayerId, direction: "up" | "down") => void;
  onMove: (layerId: LayerId, parentId: LayerId | null, index: number) => void;
  onOutdent: (layerId: LayerId) => void;
  onRasterize: (layerId: LayerId) => void;
};

function getSiblingIds(model: DocumentModel, layer: LayerNode): LayerId[] {
  if (layer.parentId === null) {
    return model.rootLayerIds;
  }
  const parent = getLayerById(model, layer.parentId);
  return parent.kind === "group" ? parent.childIds : [];
}

function getVisibleRows(model: DocumentModel, collapsedIds: Set<LayerId>): LayerTreeRow[] {
  const rows: LayerTreeRow[] = [];
  const visit = (ids: LayerId[], depth: number) => {
    for (const id of [...ids].reverse()) {
      const layer = getLayerById(model, id);
      rows.push({ layer, depth });
      if (layer.kind === "group" && !collapsedIds.has(layer.id)) {
        visit(layer.childIds, depth + 1);
      }
    }
  };
  visit(model.rootLayerIds, 0);
  return rows;
}

function getDraggedLayerId(event: DragEvent): string {
  return (
    event.dataTransfer.getData("application/x-liteedit-layer") ||
    event.dataTransfer.getData("text/plain")
  );
}

export function LayersPanel({
  model,
  onActivate,
  onAddRaster,
  onAddGroup,
  onDuplicate,
  onDelete,
  onGroup,
  onUngroup,
  onRename,
  onToggleVisibility,
  onToggleLock,
  onOpacityChange,
  onMoveWithinParent,
  onMove,
  onOutdent,
  onRasterize,
}: LayersPanelProps) {
  const [collapsedIds, setCollapsedIds] = useState<Set<LayerId>>(new Set());
  const [editingLayerId, setEditingLayerId] = useState<LayerId | null>(null);
  const [draftName, setDraftName] = useState("");
  const rows = useMemo(() => getVisibleRows(model, collapsedIds), [collapsedIds, model]);
  const activeLayer = getLayerById(model, model.activeLayerId);
  const activeSiblings = getSiblingIds(model, activeLayer);
  const activeIndex = activeSiblings.indexOf(activeLayer.id);
  const canDelete = getLayerSubtreeIds(model, activeLayer.id).length < model.layers.length;

  const beginRename = (layer: LayerNode) => {
    onActivate(layer.id);
    setEditingLayerId(layer.id);
    setDraftName(layer.name);
  };

  const commitRename = () => {
    if (editingLayerId && draftName.trim()) {
      onRename(editingLayerId, draftName);
    }
    setEditingLayerId(null);
  };

  const handleRenameKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitRename();
    } else if (event.key === "Escape") {
      event.preventDefault();
      setEditingLayerId(null);
    }
  };

  return (
    <div className="layers-panel">
      <div className="layer-toolbar" role="toolbar" aria-label="Layer commands">
        <UiButton className="layer-command" aria-label="Add paint layer" onClick={onAddRaster}>
          +LAYER
        </UiButton>
        <UiButton className="layer-command" aria-label="Add group" onClick={onAddGroup}>
          +GROUP
        </UiButton>
        <UiButton
          className="layer-command"
          aria-label="Duplicate active layer"
          onClick={() => onDuplicate(activeLayer.id)}
        >
          DUP
        </UiButton>
        <UiButton
          className="layer-command"
          aria-label="Rename active layer"
          onClick={() => beginRename(activeLayer)}
        >
          NAME
        </UiButton>
        <UiButton
          className="layer-command"
          aria-label="Delete active layer"
          tone="danger"
          disabled={!canDelete}
          onClick={() => onDelete(activeLayer.id)}
        >
          DEL
        </UiButton>
      </div>

      <div
        className="layer-toolbar layer-toolbar-secondary"
        role="toolbar"
        aria-label="Layer order and grouping"
      >
        <UiButton
          className="layer-command"
          aria-label="Move active layer up"
          disabled={activeIndex === activeSiblings.length - 1}
          onClick={() => onMoveWithinParent(activeLayer.id, "up")}
        >
          ↑
        </UiButton>
        <UiButton
          className="layer-command"
          aria-label="Move active layer down"
          disabled={activeIndex === 0}
          onClick={() => onMoveWithinParent(activeLayer.id, "down")}
        >
          ↓
        </UiButton>
        <UiButton
          className="layer-command"
          aria-label="Group active layer"
          onClick={() => onGroup(activeLayer.id)}
        >
          GROUP
        </UiButton>
        <UiButton
          className="layer-command"
          aria-label="Ungroup active group"
          disabled={activeLayer.kind !== "group"}
          onClick={() => onUngroup(activeLayer.id)}
        >
          UNGROUP
        </UiButton>
        <UiButton
          className="layer-command"
          aria-label="Move active layer out of group"
          disabled={activeLayer.parentId === null}
          onClick={() => onOutdent(activeLayer.id)}
        >
          OUT
        </UiButton>
        <UiButton
          className="layer-command"
          aria-label="Rasterize active vector layer"
          disabled={activeLayer.kind !== "vector" || activeLayer.parentId !== null}
          onClick={() => onRasterize(activeLayer.id)}
        >
          RASTER
        </UiButton>
      </div>

      <p className="layer-drag-help">DRAG ONTO GROUP TO NEST / ONTO LAYER TO PLACE ABOVE</p>

      <div className="layer-tree" role="tree" aria-label="Document layers">
        {rows.map(({ layer, depth }) => {
          const isActive = layer.id === model.activeLayerId;
          const isEditing = layer.id === editingLayerId;
          const isCollapsed = collapsedIds.has(layer.id);
          return (
            <div
              key={layer.id}
              className={`layer-row${isActive ? " is-active" : ""}`}
              role="treeitem"
              aria-level={depth + 1}
              aria-selected={isActive}
              aria-expanded={layer.kind === "group" ? !isCollapsed : undefined}
              draggable
              style={{ "--layer-depth": depth } as React.CSSProperties}
              onClick={() => onActivate(layer.id)}
              onDoubleClick={() => beginRename(layer)}
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("application/x-liteedit-layer", layer.id);
                event.dataTransfer.setData("text/plain", layer.id);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
              }}
              onDrop={(event) => {
                event.preventDefault();
                event.stopPropagation();
                const sourceId = getDraggedLayerId(event);
                if (!sourceId || sourceId === layer.id) {
                  return;
                }
                if (layer.kind === "group") {
                  onMove(sourceId, layer.id, layer.childIds.length);
                } else {
                  const siblings = getSiblingIds(model, layer);
                  onMove(sourceId, layer.parentId, siblings.indexOf(layer.id) + 1);
                }
              }}
            >
              <button
                className="layer-icon-button layer-visibility-button"
                type="button"
                aria-label={`${layer.visible ? "Hide" : "Show"} ${layer.name}`}
                aria-pressed={layer.visible}
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleVisibility(layer.id, !layer.visible);
                }}
              >
                {layer.visible ? "●" : "○"}
              </button>
              {layer.kind === "group" ? (
                <button
                  className="layer-icon-button layer-disclosure"
                  type="button"
                  aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${layer.name}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    setCollapsedIds((current) => {
                      const next = new Set(current);
                      if (next.has(layer.id)) {
                        next.delete(layer.id);
                      } else {
                        next.add(layer.id);
                      }
                      return next;
                    });
                  }}
                >
                  {isCollapsed ? "▸" : "▾"}
                </button>
              ) : (
                <span className="layer-kind-glyph" aria-hidden="true">
                  ▧
                </span>
              )}
              {isEditing ? (
                <input
                  className="layer-name-input"
                  aria-label={`Rename ${layer.name}`}
                  value={draftName}
                  autoFocus
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) => setDraftName(event.target.value)}
                  onBlur={commitRename}
                  onKeyDown={handleRenameKeyDown}
                />
              ) : (
                <span className="layer-name">{layer.name}</span>
              )}
              <span className="layer-type">{layer.kind.toUpperCase()}</span>
              <button
                className="layer-icon-button layer-lock-button"
                type="button"
                aria-label={`${layer.locked ? "Unlock" : "Lock"} ${layer.name}`}
                aria-pressed={layer.locked}
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleLock(layer.id, !layer.locked);
                }}
              >
                {layer.locked ? "◆" : "◇"}
              </button>
            </div>
          );
        })}
        <div
          className="layer-root-drop-zone"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            const sourceId = getDraggedLayerId(event);
            if (sourceId) {
              onMove(sourceId, null, 0);
            }
          }}
        >
          DROP HERE FOR BOTTOM OF ROOT
        </div>
      </div>

      <div className="layer-active-controls">
        <SliderField
          label={`${activeLayer.kind.toUpperCase()} OPACITY`}
          value={Math.round(activeLayer.opacity * 100)}
          min={0}
          max={100}
          suffix="%"
          onChange={(value) => onOpacityChange(activeLayer.id, value / 100)}
        />
        <span className="panel-empty-code">
          {model.layers.length} NODE{model.layers.length === 1 ? "" : "S"} / TOPMOST FIRST
        </span>
      </div>
    </div>
  );
}
