# ADR 0002: Do not select an Object Selection engine before the fixture gate

Status: Open / decision blocked

## Decision

Do not add OpenCV, a segmentation model, or a semantic-selection dependency to the production bundle during Phase 1. Keep the selection engine behind an interface until two local candidates are measured on five representative photos.

## Required comparison

1. A model-free foreground method such as GrabCut or an equivalent local implementation.
2. A quantized, lazy-loaded segmentation model.

The selected candidate must isolate the intended foreground subject in at least four of five cases within two seconds on the recorded reference computer. The lazy-loaded candidate must not enter the initial route chunk.

## Current evidence

`spikes/selection-candidates.ts` compares two small model-free algorithms on a deterministic synthetic fixture. This proves the test harness shape only. It does not satisfy the real-photo acceptance gate.

## Consequence

The dependent selection and editing phases remain blocked until the owner provides or approves the five-image fixture set and the benchmark records a passing candidate. A layer hit-test is not an acceptable substitute for semantic Object Selection.
