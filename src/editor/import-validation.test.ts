import { describe, expect, it } from "vitest";

import {
  ImageImportError,
  MAX_IMAGE_FILE_BYTES,
  validateDecodedDimensions,
  validateImageFile,
} from "./import-validation";
import { MAX_DOCUMENT_DIMENSION, MAX_DOCUMENT_PIXELS } from "./document-model";

describe("local image import validation", () => {
  it("accepts the supported image formats", () => {
    expect(() =>
      validateImageFile({ name: "photo.png", size: 100, type: "image/png" }),
    ).not.toThrow();
    expect(() =>
      validateImageFile({ name: "photo.jpeg", size: 100, type: "image/jpeg" }),
    ).not.toThrow();
    expect(() =>
      validateImageFile({ name: "photo.webp", size: 100, type: "image/webp" }),
    ).not.toThrow();
  });

  it("rejects unsupported formats and oversized files", () => {
    expect(() => validateImageFile({ name: "photo.gif", size: 100, type: "image/gif" })).toThrow(
      ImageImportError,
    );
    expect(() => validateImageFile({ name: "photo.png", size: 100, type: "image/jpeg" })).toThrow(
      "accepts PNG",
    );
    expect(() =>
      validateImageFile({
        name: "large.png",
        size: MAX_IMAGE_FILE_BYTES + 1,
        type: "image/png",
      }),
    ).toThrow("100 MB");
  });

  it("rejects decoded dimensions before a canvas is created", () => {
    expect(() => validateDecodedDimensions(MAX_DOCUMENT_DIMENSION + 1, 1)).toThrow("one side");
    const heightOverPixelLimit = Math.floor(MAX_DOCUMENT_PIXELS / 6400) + 1;
    expect(() => validateDecodedDimensions(6400, heightOverPixelLimit)).toThrow("too many pixels");
    expect(() => validateDecodedDimensions(0, 100)).toThrow("positive whole numbers");
  });
});
