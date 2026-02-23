# Face Verification Setup Guide

This guide explains how to set up face-api.js models for client-side face verification.

## Installation

1. **Install face-api.js package:**
   ```bash
   cd frontend
   npm install face-api.js
   ```

2. **Download face-api.js models:**
   
   The models need to be placed in the `public/models/face-api/` directory.
   
   Download the following model files from the [face-api.js repository](https://github.com/justadudewhohacks/face-api.js-models):
   
   - `ssd_mobilenetv1_model-weights_manifest.json`
   - `ssd_mobilenetv1_model-shard1`
   - `face_recognition_model-weights_manifest.json`
   - `face_recognition_model-shard1`
   - `face_recognition_model-shard2`
   - `face_landmark_68_model-weights_manifest.json`
   - `face_landmark_68_model-shard1`
   
   **Quick setup script:**
   ```bash
   cd frontend/public
   mkdir -p models/face-api
   cd models/face-api
   
   # Download models (using curl or wget)
   curl -O https://raw.githubusercontent.com/justadudewhohacks/face-api.js-models/master/ssd_mobilenetv1_model-weights_manifest.json
   curl -O https://raw.githubusercontent.com/justadudewhohacks/face-api.js-models/master/ssd_mobilenetv1_model-shard1
   curl -O https://raw.githubusercontent.com/justadudewhohacks/face-api.js-models/master/face_recognition_model-weights_manifest.json
   curl -O https://raw.githubusercontent.com/justadudewhohacks/face-api.js-models/master/face_recognition_model-shard1
   curl -O https://raw.githubusercontent.com/justadudewhohacks/face-api.js-models/master/face_recognition_model-shard2
   curl -O https://raw.githubusercontent.com/justadudewhohacks/face-api.js-models/master/face_landmark_68_model-weights_manifest.json
   curl -O https://raw.githubusercontent.com/justadudewhohacks/face-api.js-models/master/face_landmark_68_model-shard1
   ```
   
   **Or manually:**
   1. Visit: https://github.com/justadudewhohacks/face-api.js-models
   2. Download the model files listed above
   3. Place them in `frontend/public/models/face-api/`

## Directory Structure

After setup, your directory structure should look like:

```
frontend/
├── public/
│   └── models/
│       └── face-api/
│           ├── ssd_mobilenetv1_model-weights_manifest.json
│           ├── ssd_mobilenetv1_model-shard1
│           ├── face_recognition_model-weights_manifest.json
│           ├── face_recognition_model-shard1
│           ├── face_recognition_model-shard2
│           ├── face_landmark_68_model-weights_manifest.json
│           └── face_landmark_68_model-shard1
```

## Verification

After installation, the face verification will:
1. Load models automatically during the Precheck phase
2. Extract reference embedding during Identity Verification
3. Continuously verify faces during assessment (every 5 seconds)
4. Trigger violations if face mismatch detected for 10+ seconds

## Debug Logging

The implementation includes comprehensive debug logging. Check browser console for:
- Model loading status
- Reference embedding extraction
- Face verification checks
- Similarity scores
- Violation triggers

## Troubleshooting

**Models not loading:**
- Check browser console for errors
- Verify models are in `public/models/face-api/`
- Check network tab for 404 errors on model files

**Face verification not working:**
- Check console logs for "Face Recognition model loaded"
- Verify reference embedding is stored in sessionStorage
- Check that exactly 1 face is detected during assessment

**Low similarity scores:**
- Ensure good lighting
- Face should be clearly visible
- Reference photo should be clear and front-facing

