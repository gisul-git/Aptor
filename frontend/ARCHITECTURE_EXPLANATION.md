# Frontend Architecture - End-to-End Explanation

## 📁 Project Structure Overview

This is a **Next.js 14** application built with **TypeScript**, **React**, and **Tailwind CSS**. It's an AI-powered assessment platform with multiple assessment types (AIML, DSA, Custom MCQ, etc.).

---

## 🏗️ Architecture Layers

### 1. **Entry Point & Configuration**

#### `pages/_app.tsx`
- **Purpose**: Root component that wraps all pages
- **Key Features**:
  - Sets up `SessionProvider` (NextAuth) for authentication
  - Configures `QueryClientProvider` (React Query) for data fetching
  - Implements smooth scrolling with Lenis
  - Handles automatic token refresh (checks every 5 minutes)
  - Listens for token refresh events from API client

#### `middleware.ts`
- **Purpose**: Next.js middleware for route protection and role-based access
- **Key Features**:
  - Uses NextAuth's `withAuth` to protect routes
  - Role-based access control (employee, org_admin, super_admin)
  - Blocks employees from creation/management pages
  - Allows public routes (auth, candidate assessments, API routes)
  - Redirects based on user roles

#### `next.config.js`
- **Purpose**: Next.js configuration
- **Key Features**:
  - Proxies `/api/v1/*` and `/api/v2/*` to API Gateway (localhost:80)
  - Configures caching for MediaPipe assets
  - Enables React strict mode

---

### 2. **API Communication Layer**

#### `services/api/client.ts`
- **Purpose**: Centralized Axios instance with interceptors
- **Key Features**:
  - **Request Interceptor**: 
    - Adds JWT token from NextAuth session to all requests
    - Proactively refreshes tokens if expiring soon (within 5 minutes)
    - Handles token from sessionStorage as fallback
  - **Response Interceptor**:
    - Handles 401 errors with automatic token refresh
    - Queues failed requests during token refresh
    - Standardizes error messages
  - Base URL: Uses relative URLs (proxied through Next.js) or `NEXT_PUBLIC_API_URL`

#### `services/api/types.ts`
- **Purpose**: TypeScript interfaces for API responses
- **Key Types**:
  - `ApiResponse<T>`: Standard response wrapper with `success`, `data`, `message`
  - `PaginatedResponse<T>`: For paginated data
  - `ApiError`: Error response structure

#### Service Files (`services/*/`)
- **Pattern**: Each domain has its own service file
  - `services/aiml/aiml.service.ts` - AIML API calls
  - `services/dsa/dsa.service.ts` - DSA API calls
  - `services/assessment/assessment.service.ts` - Assessment API calls
  - etc.
- **Structure**: Each service exports typed functions that use `apiClient`

---

### 3. **Data Fetching Layer (React Query)**

#### `hooks/api/useAIML.ts` (Example)
- **Purpose**: React Query hooks for AIML data operations
- **Pattern**:
  - **Queries** (`useQuery`): For fetching data (GET requests)
    - `useAIMLTests()` - List all tests
    - `useAIMLTest(id)` - Get single test
    - `useAIMLQuestions()` - List all questions
  - **Mutations** (`useMutation`): For modifying data (POST/PUT/DELETE)
    - `useCreateAIMLTest()` - Create test
    - `useUpdateAIMLTest()` - Update test
    - `useDeleteAIMLTest()` - Delete test
- **Features**:
  - Automatic cache invalidation on mutations
  - Stale time configuration (5 minutes default)
  - Error handling with fallbacks

---

### 4. **State Management**

#### `store/` (Zustand Stores)
- **`auth.store.ts`**: Authentication state
  - User data
  - Authentication status
  - Persisted to localStorage
- **`assessment.store.ts`**: Assessment session state
- **`proctoring.store.ts`**: Proctoring state
- **`ui.store.ts`**: UI state (modals, toggles, etc.)

---

### 5. **Authentication Flow**

#### Login Flow:
1. User visits `/auth/signin`
2. Form submits to `/api/v1/auth/login` (via API Gateway)
3. Backend returns JWT token + refresh token
4. NextAuth stores tokens in session
5. `apiClient` interceptor adds token to all requests
6. Middleware checks authentication for protected routes

#### Token Refresh Flow:
1. `apiClient` request interceptor checks token expiration
2. If expiring soon (< 5 minutes), proactively refreshes
3. Calls `/api/v1/auth/refresh-token` with refresh token
4. Updates session with new tokens
5. Retries original request with new token
6. `_app.tsx` also checks every 5 minutes in background

---

### 6. **Page Structure**

#### Example: AIML Question Creation Flow

**File**: `pages/aiml/questions/create.tsx`

**Flow**:
1. **Server-Side Auth Check**:
   ```typescript
   export const getServerSideProps: GetServerSideProps = requireAuth
   ```
   - Checks if user is authenticated
   - Redirects to login if not

2. **Component Initialization**:
   - Uses `useRouter` for navigation
   - Uses `useCreateAIMLQuestion()` hook for mutations
   - State management with `useState` for form fields

3. **AI Topic Suggestion**:
   ```typescript
   const response = await aimlService.suggestTopics({
     skill: skill,
     difficulty: aiDifficulty
   })
   ```
   - Calls `aimlService.suggestTopics()`
   - Which uses `apiClient.post('/api/v1/aiml/questions/suggest-topics')`
   - Request goes through:
     - Next.js proxy (`/api/v1/*` → `http://localhost:80/api/v1/*`)
     - API Gateway (adds auth headers)
     - AIML Service (processes request)

4. **AI Question Generation**:
   ```typescript
   const response = await aimlService.generateAIQuestion({...})
   ```
   - Similar flow to topic suggestions
   - Backend generates question using OpenAI
   - Returns structured response with assessment, question, dataset

5. **Form Submission**:
   ```typescript
   await createQuestionMutation.mutateAsync(payload)
   ```
   - Uses React Query mutation
   - Automatically invalidates cache
   - Redirects to questions list on success

---

### 7. **Component Architecture**

#### Component Structure:
```
components/
├── aiml/              # AIML-specific components
│   ├── AIMLNotebookIDE.tsx
│   └── NotebookCell.tsx
├── assessment/        # Assessment components
├── auth/             # Authentication components
├── dsa/              # DSA components
├── proctor/          # Proctoring components
└── landing/          # Landing page components
```

#### Component Pattern:
- **Presentational Components**: UI-only, receive props
- **Container Components**: Handle logic, use hooks
- **Feature Components**: Domain-specific functionality

---

### 8. **Routing Structure**

#### File-Based Routing (Next.js):
```
pages/
├── _app.tsx          # Root layout
├── _document.tsx     # HTML document structure
├── index.tsx         # Landing page (/)
├── dashboard.tsx     # Main dashboard (/dashboard)
├── auth/
│   ├── signin.tsx    # Login page (/auth/signin)
│   └── signup.tsx    # Signup page (/auth/signup)
├── aiml/
│   ├── questions/
│   │   ├── index.tsx           # List questions (/aiml/questions)
│   │   ├── create.tsx          # Create question (/aiml/questions/create)
│   │   └── [id]/
│   │       ├── edit.tsx        # Edit question (/aiml/questions/:id/edit)
│   │       └── preview.tsx     # Preview question (/aiml/questions/:id/preview)
│   └── tests/
│       └── [id]/
│           ├── analytics.tsx   # Test analytics
│           └── candidates.tsx  # Manage candidates
└── assessment/
    └── [id]/
        └── [token]/
            └── take.tsx        # Candidate takes assessment
```

---

### 9. **End-to-End Request Flow Example**

**Scenario**: User creates an AIML question with AI generation

1. **User Action**: 
   - Clicks "Generate Question with AI" button
   - Fills form: title, skill, topic, difficulty

2. **Frontend Code** (`create.tsx`):
   ```typescript
   const response = await aimlService.generateAIQuestion({...})
   ```

3. **Service Layer** (`aiml.service.ts`):
   ```typescript
   generateAIQuestion: async (data) => {
     const response = await apiClient.post('/api/v1/aiml/questions/generate-ai', data);
     return response.data;
   }
   ```

4. **API Client** (`client.ts`):
   - Request interceptor adds JWT token from session
   - Makes POST request to `/api/v1/aiml/questions/generate-ai`

5. **Next.js Proxy** (`next.config.js`):
   - Rewrites `/api/v1/*` → `http://localhost:80/api/v1/*`

6. **API Gateway** (`services/api-gateway/src/index.js`):
   - Verifies JWT token with auth service
   - Extracts user ID, org ID, role
   - Adds headers: `X-User-Id`, `X-Org-Id`, `X-Role`
   - Proxies to AIML service at `http://localhost:3003`

7. **AIML Service** (`services/aiml-service/`):
   - Receives request with user context headers
   - Validates user permissions
   - Calls OpenAI API to generate question
   - Saves to MongoDB
   - Returns response

8. **Response Flow**:
   - AIML Service → API Gateway → Next.js Proxy → Frontend
   - `apiClient` response interceptor handles errors
   - Component receives response
   - Updates UI, shows success message, redirects

---

### 10. **Key Libraries & Technologies**

- **Next.js 14**: React framework with SSR/SSG
- **TypeScript**: Type safety
- **React Query (@tanstack/react-query)**: Data fetching & caching
- **NextAuth**: Authentication
- **Zustand**: State management
- **Axios**: HTTP client
- **Tailwind CSS**: Styling
- **Framer Motion**: Animations
- **Monaco Editor**: Code editor
- **MediaPipe**: Face detection for proctoring
- **TensorFlow.js**: ML models for proctoring

---

### 11. **Environment Variables**

```env
NEXT_PUBLIC_API_URL=http://localhost:80  # API Gateway URL
NEXTAUTH_URL=http://localhost:3000       # NextAuth callback URL
NEXTAUTH_SECRET=...                      # NextAuth secret
```

---

### 12. **Error Handling Pattern**

1. **API Errors**: Handled by `apiClient` interceptor
   - 401 → Auto token refresh
   - 403 → Access denied
   - 500 → Server error message

2. **Component Errors**: Try-catch blocks with user-friendly messages

3. **React Query Errors**: Automatic retry with exponential backoff

---

### 13. **Code Organization Principles**

1. **Separation of Concerns**:
   - Services: API calls
   - Hooks: Data fetching logic
   - Components: UI rendering
   - Pages: Route handlers

2. **Type Safety**: TypeScript interfaces for all API responses

3. **Reusability**: Shared components, hooks, utilities

4. **Consistency**: Standardized patterns across domains

---

## 🔄 Complete Flow Diagram

```
User Action
    ↓
Page Component (create.tsx)
    ↓
React Hook (useCreateAIMLQuestion)
    ↓
Service Layer (aiml.service.ts)
    ↓
API Client (client.ts) + Token Injection
    ↓
Next.js Proxy (next.config.js)
    ↓
API Gateway (verifies auth, adds headers)
    ↓
Backend Service (AIML Service)
    ↓
Database (MongoDB)
    ↓
Response flows back up
    ↓
React Query Cache Update
    ↓
UI Update
```

---

## 📝 Key Files Summary

| File | Purpose |
|------|---------|
| `pages/_app.tsx` | App initialization, providers |
| `middleware.ts` | Route protection, RBAC |
| `services/api/client.ts` | HTTP client with auth |
| `services/aiml/aiml.service.ts` | AIML API functions |
| `hooks/api/useAIML.ts` | React Query hooks |
| `store/auth.store.ts` | Auth state management |
| `lib/auth.ts` | Auth utilities |
| `pages/aiml/questions/create.tsx` | Question creation page |

---

This architecture provides:
- ✅ Type-safe API communication
- ✅ Automatic token management
- ✅ Centralized error handling
- ✅ Efficient data caching
- ✅ Role-based access control
- ✅ Scalable component structure




