# Subsystem dependency graph

```mermaid
graph TD
  B[Unchanged blueprint and IDs] --> V[Versioned schemas and tuning]
  V --> N[Integer clock, randomness, geometry]
  N --> C[Construction and route validation]
  V --> P[Atomic persistence and writer fencing]
  P --> C
  C --> S[Headless combat, perception and AI]
  V --> E[Encounter compiler and authored fixtures]
  E --> S
  S --> R[Terminal receipts, rewards and progression]
  P --> R
  R --> M[Campaign, Archive, Calibration, Endurance, Watch, Mastery]
  C --> UI[Semantic UI and gestures]
  S --> UI
  UI --> A[Original raster and audio presentation]
  M --> Q[Integrated acceptance and physical-device release]
  A --> Q
```

Per-requirement source lines, subsystem, dependency, gate, state, evidence and compatibility consequences are indexed in TRACEABILITY.csv. Registry-only content is Designed and must not be exposed as functional runtime content.
