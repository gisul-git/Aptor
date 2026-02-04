# Face Mismatch Cleanup - Inventory (Step 1)

## PART 1: Inventory of Face Mismatch / Face Verification Code

### REMOVE (face verification/matching - "is this the same person?")

#### Files to DELETE
| File | Purpose |
|------|---------|
| `src/universal-proctoring/services/FaceVerificationService.ts` | Extracts embeddings, compares faces |
| `src/universal-proctoring/services/faceMismatchTelemetry.ts` | Telemetry for face verification |
| `src/pages/api/analytics/face-verification.ts` | API for face verification logs |
| `src/pages/api/analytics/face-verification-stats.ts` | API for face verification stats |
| `src/proctoring/engine/faceMatching.ts` | Landmark-based face matching (matchFace, loadReferenceFaceFromImage) |

#### Files to MODIFY

| File | Changes |
|------|---------|
| `src/universal-proctoring/services/aiProctoring.ts` | Remove FaceVerificationService, faceMismatchTelemetry, referenceEmbedding, loadReferenceEmbedding, checkFaceVerification, handleFaceMismatchIncident, all FACE_VERIFICATION_* constants, faceMismatchIncident; remove face verification block from loop |
| `src/proctoring/components/IdentityVerification.tsx` | Remove FaceVerificationService, extractEmbedding, sessionStorage for faceVerificationReferenceEmbedding / faceVerificationReferenceQuality; remove embedding extraction path (keep photo capture) |
| `src/proctoring/engine/proctorEngine.ts` | Remove faceMatching import, loadReferenceFace, referenceLandmarks, consecutiveMismatches, face matching block, state.faceMatchResult, loadReferenceFace() in start() |
| `src/proctoring/index.ts` | Remove exports: matchFace, loadReferenceFaceFromImage, FaceMatchingResult from faceMatching |
| `src/proctoring/hooks/useProctorEngine.ts` | Remove faceMatchResult from initial state |
| `src/hooks/proctoring/useCameraProctor.ts` | Remove face mismatch threshold, faceMismatchCountRef, FACE_MISMATCH recording block |

### KEEP (face detection + other proctoring)
- Face detection (BlazeFace, faceDetection.ts, detectFaces, SINGLE_FACE, MULTIPLE_FACES, NO_FACE)
- Multi-face detection violations (MULTIPLE_FACES_DETECTED)
- Gaze, tab switch, fullscreen, etc.
- Violation types/UI for FACE_MISMATCH (for future FaceNet)
- faceMismatchEnabled in settings/UI (option remains; no runtime verification)
- ModelService (BlazeFace/FaceMesh); getFaceDescriptor can remain unused
