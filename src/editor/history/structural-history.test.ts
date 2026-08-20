import { describe, expect, it } from "vitest";

import {
  createBlankDocument,
  deleteLayerSubtree,
  duplicateLayerSubtree,
  insertGroupLayer,
  insertRasterLayer,
  moveLayer,
  moveLayerWithinParent,
  outdentLayer,
  renameLayer,
  serializeDocumentModel,
  setLayerLocked,
  setLayerOpacity,
  setLayerVisibility,
  ungroupLayer,
  wrapLayerInGroup,
  type DocumentModel,
} from "../document-model";
import { StructuralHistory } from "./structural-history";
import type { RasterSnapshot } from "../raster/raster-snapshot";

describe("structural history", () => {
  it("round-trips a scripted 25-operation layer sequence", () => {
    const history = new StructuralHistory();
    const initial = createBlankDocument({ width: 64, height: 64, background: "transparent" });
    let current = initial;
    let operationCount = 0;
    const commit = (label: string, next: DocumentModel) => {
      operationCount += 1;
      history.commit(label, current, next, { committedAt: operationCount * 1000 });
      current = next;
    };

    const layer2Result = insertRasterLayer(current, { name: "Layer 2" });
    const layer2Id = layer2Result.layer.id;
    commit("01 Add layer", layer2Result.document);
    commit("02 Rename", renameLayer(current, layer2Id, "Paint"));
    commit("03 Opacity", setLayerOpacity(current, layer2Id, 0.8));
    commit("04 Hide", setLayerVisibility(current, layer2Id, false));
    commit("05 Show", setLayerVisibility(current, layer2Id, true));
    commit("06 Lock", setLayerLocked(current, layer2Id, true));
    commit("07 Unlock", setLayerLocked(current, layer2Id, false));

    const layer3Result = insertRasterLayer(current, { name: "Layer 3" });
    const layer3Id = layer3Result.layer.id;
    commit("08 Add layer", layer3Result.document);
    commit("09 Move down", moveLayerWithinParent(current, layer3Id, "down"));
    commit("10 Move up", moveLayerWithinParent(current, layer3Id, "up"));
    commit("11 Group", wrapLayerInGroup(current, layer3Id, "Subject"));
    const subjectGroupId = current.activeLayerId;
    commit("12 Group opacity", setLayerOpacity(current, subjectGroupId, 0.5));
    commit("13 Rename group", renameLayer(current, subjectGroupId, "Subject Group"));

    const layer4Result = insertRasterLayer(current, { name: "Layer 4" });
    const layer4Id = layer4Result.layer.id;
    commit("14 Add layer", layer4Result.document);
    commit("15 Nest layer", moveLayer(current, layer4Id, subjectGroupId, 1));
    commit("16 Outdent layer", outdentLayer(current, layer4Id));
    const layer4CopyResult = duplicateLayerSubtree(current, layer4Id);
    const layer4CopyId = layer4CopyResult.rootLayerId;
    commit("17 Duplicate", layer4CopyResult.document);
    commit("18 Rename copy", renameLayer(current, layer4CopyId, "Layer 4 Copy"));
    commit("19 Delete copy", deleteLayerSubtree(current, layer4CopyId));

    const secondGroupResult = insertGroupLayer(current, { name: "Second Group" });
    const secondGroupId = secondGroupResult.layer.id;
    commit("20 Add group", secondGroupResult.document);
    commit("21 Move into group", moveLayer(current, layer2Id, secondGroupId, 0));
    const groupCopyResult = duplicateLayerSubtree(current, secondGroupId);
    const groupCopyId = groupCopyResult.rootLayerId;
    commit("22 Duplicate group", groupCopyResult.document);
    commit("23 Ungroup copy", ungroupLayer(current, groupCopyId));
    commit("24 Delete group", deleteLayerSubtree(current, secondGroupId));
    const backgroundId = initial.activeLayerId;
    commit("25 Rename base", renameLayer(current, backgroundId, "Base"));

    expect(operationCount).toBe(25);
    expect(history.snapshot().applied).toHaveLength(25);
    const finalHash = serializeDocumentModel(current);

    for (let index = 0; index < 25; index += 1) {
      current = history.undo()?.document ?? current;
    }
    expect(serializeDocumentModel(current)).toBe(serializeDocumentModel(initial));
    expect(history.snapshot().canUndo).toBe(false);

    for (let index = 0; index < 25; index += 1) {
      current = history.redo()?.document ?? current;
    }
    expect(serializeDocumentModel(current)).toBe(finalHash);
    expect(history.snapshot().canRedo).toBe(false);
  });

  it("coalesces related edits and clears redo after a new branch", () => {
    const history = new StructuralHistory();
    const initial = createBlankDocument({ width: 16, height: 16, background: "white" });
    const layerId = initial.activeLayerId;
    const first = setLayerOpacity(initial, layerId, 0.9);
    const second = setLayerOpacity(first, layerId, 0.8);

    history.commit("Opacity 90%", initial, first, {
      coalesceKey: `opacity:${layerId}`,
      committedAt: 1000,
    });
    history.commit("Opacity 80%", first, second, {
      coalesceKey: `opacity:${layerId}`,
      committedAt: 1100,
    });
    expect(history.snapshot().applied).toHaveLength(1);
    expect(history.undo()?.document.layers[0]?.opacity).toBe(1);
    expect(history.snapshot().canRedo).toBe(true);

    const branched = renameLayer(initial, layerId, "Branched");
    history.commit("Rename", initial, branched, { committedAt: 2000 });
    expect(history.snapshot().canRedo).toBe(false);
  });

  it("evicts only complete oldest transactions at the step limit", () => {
    const history = new StructuralHistory(3, 1024 * 1024);
    let current = createBlankDocument({ width: 8, height: 8, background: "black" });
    const layerId = current.activeLayerId;

    for (let index = 1; index <= 5; index += 1) {
      const next = renameLayer(current, layerId, `Layer ${index}`);
      history.commit(`Rename ${index}`, current, next, { committedAt: index * 1000 });
      current = next;
    }

    expect(history.snapshot().applied.map((entry) => entry.label)).toEqual([
      "Rename 3",
      "Rename 4",
      "Rename 5",
    ]);
  });

  it("stores raster edits as one byte-accounted transaction and restores exact pixels", () => {
    const history = new StructuralHistory();
    const model = createBlankDocument({ width: 2, height: 1, background: "transparent" });
    const layer = model.layers[0];
    if (!layer || layer.kind !== "raster") throw new Error("Expected a raster layer.");
    const before: RasterSnapshot = {
      width: 2,
      height: 1,
      pixels: new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 255, 255]),
    };
    const after: RasterSnapshot = {
      width: 2,
      height: 1,
      pixels: new Uint8ClampedArray([0, 255, 0, 255, 255, 255, 0, 255]),
    };

    expect(
      history.commit("Warp", model, model, {
        rasterChanges: [{ bufferId: layer.bufferId, before, after }],
      }),
    ).toBe(true);
    expect(history.snapshot().applied).toHaveLength(1);
    expect(history.snapshot().estimatedBytes).toBeGreaterThanOrEqual(
      before.pixels.byteLength + after.pixels.byteLength,
    );

    before.pixels.fill(0);
    after.pixels.fill(0);
    expect([...(history.undo()?.rasterChanges[0]?.snapshot.pixels ?? [])]).toEqual([
      255, 0, 0, 255, 0, 0, 255, 255,
    ]);
    expect([...(history.redo()?.rasterChanges[0]?.snapshot.pixels ?? [])]).toEqual([
      0, 255, 0, 255, 255, 255, 0, 255,
    ]);
  });
});
