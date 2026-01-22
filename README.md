# Gisul-AI-Assessment-Production

## Optional: Speed up TFJS Face models (avoid Kaggle → GCS redirects)

The camera proctoring models are fetched by the browser. If you want to route model downloads through our app (to remove Kaggle redirects and enable strong caching), create a local env file at `frontend/.env.local` with:

```bash
NEXT_PUBLIC_PROCTOR_MODEL_PROXY=true
NEXT_PUBLIC_FACE_DETECTION_MODEL_URL=https://www.kaggle.com/models/mediapipe/face-detection/tfJs/short/1/model.json?tfjs-format=file&tfhub-redirect=true
# Paste the FaceMesh model.json URL you see in DevTools Network:
NEXT_PUBLIC_FACE_MESH_MODEL_URL=<paste_face_mesh_model_json_url_here>
```

To revert instantly to the current direct-fetch behavior, set:

```bash
NEXT_PUBLIC_PROCTOR_MODEL_PROXY=false
```