# ADR 0002: Do not select an Object Selection engine before the fixture gate

Status: Provisional implementation / acceptance blocked

## Decision

Ship Quick Selection independently and keep Object Selection behind a worker/service interface. Use a lazy-loaded model-free foreground extractor provisionally; do not add OpenCV or a segmentation dependency to the initial bundle before representative fixtures justify its cost.

## Required comparison

1. A model-free foreground method such as GrabCut or an equivalent local implementation.
2. A quantized, lazy-loaded segmentation model.

The selected candidate must isolate the intended foreground subject in at least four of five cases within two seconds on the recorded reference computer. The lazy-loaded candidate must not enter the initial route chunk.

## Current evidence

`spikes/selection-candidates.ts` compares two small model-free algorithms on a deterministic synthetic fixture. Production Object Selection removes border-connected pixels similar to a user-drawn region's corners and loads only when requested. Unit coverage proves mask correctness and lazy boundaries, not the real-photo acceptance gate.

## Consequence

Marquee, lasso, Quick Selection, mask combination, and selection-aware editing may ship because they do not depend on semantic subject isolation. Object Selection must remain labeled provisional until the owner provides or approves five local photos and the benchmark records a passing candidate. A layer hit-test is not an acceptable substitute.
