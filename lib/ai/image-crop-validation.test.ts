import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ImagePreprocessValidationError,
  normalizeExtractRegion,
  validateExtractCoordinates,
} from "./image-preprocess";

const SOURCE_WIDTH = 2880;
const SOURCE_HEIGHT = 11612;

describe("validateExtractCoordinates", () => {
  it("accepts a valid full-width vertical crop", () => {
    assert.doesNotThrow(() =>
      validateExtractCoordinates(
        { left: 0, top: 0, width: 2880, height: 1600 },
        SOURCE_WIDTH,
        SOURCE_HEIGHT
      )
    );
  });

  it("rejects left below zero", () => {
    assert.throws(
      () =>
        validateExtractCoordinates(
          { left: -1, top: 0, width: 2880, height: 1600 },
          SOURCE_WIDTH,
          SOURCE_HEIGHT
        ),
      (error: unknown) =>
        error instanceof ImagePreprocessValidationError &&
        error.message === "extract.left must be an integer >= 0"
    );
  });

  it("rejects top below zero", () => {
    assert.throws(
      () =>
        validateExtractCoordinates(
          { left: 0, top: -1, width: 2880, height: 1600 },
          SOURCE_WIDTH,
          SOURCE_HEIGHT
        ),
      (error: unknown) =>
        error instanceof ImagePreprocessValidationError &&
        error.message === "extract.top must be an integer >= 0"
    );
  });

  it("rejects zero width", () => {
    assert.throws(
      () =>
        validateExtractCoordinates(
          { left: 0, top: 0, width: 0, height: 1600 },
          SOURCE_WIDTH,
          SOURCE_HEIGHT
        ),
      (error: unknown) =>
        error instanceof ImagePreprocessValidationError &&
        error.message === "extract.width must be an integer >= 1"
    );
  });

  it("rejects zero height", () => {
    assert.throws(
      () =>
        validateExtractCoordinates(
          { left: 0, top: 0, width: 2880, height: 0 },
          SOURCE_WIDTH,
          SOURCE_HEIGHT
        ),
      (error: unknown) =>
        error instanceof ImagePreprocessValidationError &&
        error.message === "extract.height must be an integer >= 1"
    );
  });

  it("rejects width exceeding source bounds", () => {
    assert.throws(
      () =>
        validateExtractCoordinates(
          { left: 0, top: 0, width: 2881, height: 1600 },
          SOURCE_WIDTH,
          SOURCE_HEIGHT
        ),
      (error: unknown) =>
        error instanceof ImagePreprocessValidationError &&
        error.message === "extract.width exceeds image bounds"
    );
  });

  it("rejects height exceeding source bounds", () => {
    assert.throws(
      () =>
        validateExtractCoordinates(
          { left: 0, top: 11000, width: 2880, height: 700 },
          SOURCE_WIDTH,
          SOURCE_HEIGHT
        ),
      (error: unknown) =>
        error instanceof ImagePreprocessValidationError &&
        error.message === "extract.height exceeds image bounds"
    );
  });
});

describe("normalizeExtractRegion", () => {
  it("keeps left at 0 for full-width vertical crops", () => {
    const normalized = normalizeExtractRegion(
      { left: 0, top: 0, width: 2880, height: 1600 },
      SOURCE_WIDTH,
      SOURCE_HEIGHT
    );

    assert.deepEqual(normalized, {
      left: 0,
      top: 0,
      width: 2880,
      height: 1600,
    });
  });

  it("clamps the last crop height to the remaining source height", () => {
    const normalized = normalizeExtractRegion(
      { left: 0, top: 11000, width: 2880, height: 2000 },
      SOURCE_WIDTH,
      SOURCE_HEIGHT
    );

    assert.equal(normalized.top, 11000);
    assert.equal(normalized.height, 612);
    assert.equal(normalized.top + normalized.height, SOURCE_HEIGHT);
  });
});
