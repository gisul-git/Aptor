## AI Proctoring Toggle – Implementation Notes

This file documents how the **“Enable AI Proctoring (camera-based: no face, multiple faces, gaze away)”** checkbox is wired front‑to‑back.  
Use this as a reference if the implementation is ever overwritten (e.g., after pulling from another branch).

---

## 1. Schedule Schema & Backend Merge Logic

### Where

- File: `backend/app/api/v1/assessments/routers.py`
- Endpoint: `update_schedule_and_candidates`

### Rule

When updating `assessment["schedule"]`, **do not overwrite the entire dict**.  
Always merge new fields into the existing schedule so we keep extra settings such as `candidateRequirements` and `proctoringSettings`.

#### Correct code pattern

```python
existing_schedule = assessment.get("schedule") or {}
schedule = existing_schedule.copy()
schedule.update(
    {
        "startTime": payload.get("startTime"),
        "endTime": payload.get("endTime"),
        "timezone": "Asia/Kolkata",  # IST
    }
)
assessment["schedule"] = schedule
```

### Expected schedule structure

```jsonc
{
  "startTime": "2025-12-15T16:28",
  "endTime": "2025-12-15T22:28",
  "duration": 360,
  "visibilityMode": "public",
  "candidateRequirements": {
    "requireEmail": true,
    "requireName": true,
    "requirePhone": false,
    "requireResume": false
  },
  "proctoringSettings": {
    "aiProctoringEnabled": true   // set by checkbox
  },
  "timezone": "Asia/Kolkata",
  "isActive": false
}
```

If you ever see `schedule` in Mongo or in `get-assessment-full` **without** `proctoringSettings`, it means some code path is still overwriting the schedule instead of merging.

---

## 2. Proctoring Settings UI (Assessment Creation – `create-new.tsx`)

### Where

- File: `frontend/src/pages/assessments/create-new.tsx`
- Section: Schedule (Station 4), under the **“Proctoring Settings”** card.

### State

```ts
// Existing candidate requirements (unchanged)
const [candidateRequirements, setCandidateRequirements] = useState({
  requireEmail: true,
  requireName: true,
  requirePhone: false,
  requireResume: false,
});

// New proctoring settings
const [proctoringSettings, setProctoringSettings] = useState({
  aiProctoringEnabled: false, // default OFF until explicitly enabled
});
```

### Checkbox JSX

```tsx
<div /* Proctoring Settings card */>
  <h3>Proctoring Settings</h3>
  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
    <input
      type="checkbox"
      checked={proctoringSettings.aiProctoringEnabled}
      onChange={(e) =>
        setProctoringSettings((prev) => ({
          ...prev,
          aiProctoringEnabled: e.target.checked,
        }))
      }
    />
    <span>Enable AI Proctoring (camera-based: no face, multiple faces, gaze away)</span>
  </label>
</div>
```

### Saving the schedule

When the user clicks **Save & Next** on Schedule (which calls `PUT /api/assessments/update-draft`), the payload must include both `candidateRequirements` and `proctoringSettings`:

```ts
await axios.put('/api/assessments/update-draft', {
  assessmentId,
  schedule: {
    startTime,
    endTime,
    duration: Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / (1000 * 60)),
    visibilityMode,
    candidateRequirements,
    proctoringSettings, // <- { aiProctoringEnabled }
  },
});
```

### Loading existing values

When editing an assessment, `create-new.tsx` reads from `assessment.schedule`:

```ts
const schedule = assessment.schedule || {};

if (schedule.candidateRequirements) {
  setCandidateRequirements({
    requireEmail:  schedule.candidateRequirements.requireEmail ?? true,
    requireName:   schedule.candidateRequirements.requireName ?? true,
    requirePhone:  schedule.candidateRequirements.requirePhone ?? false,
    requireResume: schedule.candidateRequirements.requireResume ?? false,
  });
}

if (schedule.proctoringSettings) {
  setProctoringSettings({
    aiProctoringEnabled: schedule.proctoringSettings.aiProctoringEnabled ?? false,
  });
}
```

---

## 3. Candidate Side – Using the Flag in `take.tsx`

### Where

- File: `frontend/src/pages/assessment/[id]/[token]/take.tsx`

### State

```ts
const [webcamLive, setWebcamLive] = useState(false);
const [faceMeshStatus, setFaceMeshStatus] =
  useState<'loading' | 'loaded' | 'error'>('loading');
const [displayedFacesCount, setDisplayedFacesCount] = useState(0);

// Overall proctoring (tab switch, focus lost)
const [proctoringEnabled, setProctoringEnabled] = useState(false);

// AI (camera-based) proctoring toggle from schedule.proctoringSettings
const [aiProctoringEnabled, setAiProctoringEnabled] = useState(false);
```

### Reading from `get-assessment-full`

After calling `GET /api/assessment/get-assessment-full?assessmentId=...&token=...`:

```ts
const assessment = assessmentResponse.data.data;

const aiFlagFromSchedule =
  assessment?.schedule?.proctoringSettings?.aiProctoringEnabled;

// Only explicit true enables AI proctoring; missing/false => OFF
setAiProctoringEnabled(aiFlagFromSchedule === true);
```

### Starting proctoring

```ts
useEffect(() => {
  if (!isClient || proctoringEnabled || appState !== 'ready') return;

  console.log('[Proctor] Starting proctoring...');
  setProctoringEnabled(true); // always enable TAB_SWITCH & FOCUS_LOST listeners

  if (aiProctoringEnabled) {
    startWebcam(); // starts webcam + FaceMesh
  } else {
    console.log(
      '[Proctor] AI proctoring disabled for this assessment; skipping webcam/FaceMesh'
    );
  }
}, [appState, proctoringEnabled, isClient, aiProctoringEnabled, startWebcam]);
```

### Gating FaceMesh

```ts
const { isModelLoaded, modelError, facesCount } = useFaceMesh({
  videoRef: thumbVideoRef,
  onDetection: handleDetection,
  enabled: aiProctoringEnabled && webcamLive, // OFF when toggle is false
});
```

### Semantics

- If `proctoringSettings.aiProctoringEnabled` is **false** or not present in `schedule`:
  - `aiProctoringEnabled` remains `false`.
  - `startWebcam()` is not called.
  - No `GAZE_AWAY`, `MULTIPLE_FACES_DETECTED`, or `NO_FACE_DETECTED` events or snapshots are generated.
  - `TAB_SWITCH` and `FOCUS_LOST` violations still work (they are controlled by `proctoringEnabled`, not the AI flag).

- If `proctoringSettings.aiProctoringEnabled` is **true**:
  - `startWebcam()` runs when the assessment is ready.
  - `useFaceMesh` runs and drives camera-based proctoring exactly as described in this repository.

---

Keeping these three pieces (schedule merge on the backend, Proctoring Settings UI wiring, and `take.tsx` gating) in sync ensures the AI proctoring toggle behaves correctly even after refactors or branch merges. If anything breaks, compare the current code against these snippets to restore the intended behavior.





