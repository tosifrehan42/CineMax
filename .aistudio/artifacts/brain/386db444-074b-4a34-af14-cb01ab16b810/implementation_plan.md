# CineMax — Gemini Timeout & Secondary Model Fallback Fix

Resolve the timeout-handling control-flow bug in the server-side Gemini title resolution service so primary-model timeouts (`gemini-3.8-flash`) and timed-out `503` retries reliably reach the secondary model (`gemini-3.7-flash`) with proper request cancellation and a meaningful remaining execution budget.

### User Review & Critical Decisions

> [!IMPORTANT]
> This targeted server-side fix modifies **only** the title resolution service (`src/server/titleResolutionService.ts`). All existing prompts, structured JSON schemas, caching, deterministic fallback rules, and frontend components remain untouched.

- **Primary Timeout Direct Failover**: When `gemini-3.8-flash` times out (after `8500ms`), treat it as a transient failure and immediately invoke `gemini-3.7-flash` without wasting time on a second primary attempt.
- **Primary 503 Retry & Failover**: When `gemini-3.8-flash` returns HTTP `503` (`UNAVAILABLE`), perform one short jittered backoff retry (`500ms + 0..350ms`) on `gemini-3.8-flash`; if that retry returns `503` **or** times out, immediately invoke `gemini-3.7-flash`.
- **Meaningful Secondary Timeout & 25s Overall Budget**: Set the overall execution budget to `24500ms` (under the 25-second ceiling) and allocate the full remaining execution budget (up to `14000ms`, rather than capping at `8500ms` or a tiny remainder) to `gemini-3.7-flash`.
- **In-Flight Request Cancellation**: Pass an `AbortController` (`config.abortSignal`) to every `ai.models.generateContent()` call and abort it on timeout so timed-out primary requests never continue consuming resources in the background.

---

### 1. Overview & Core Concept

- **What It Does**: Guarantees that when `gemini-3.8-flash` hangs or experiences `503` overload spikes, the request cleanly aborts the stalled attempt and fails over to `gemini-3.7-flash` with a generous remaining timeout before falling back to deterministic TMDB title normalization.
- **Target Audience / Persona**: CineMax users searching for informal movie/TV titles or importing completed watchlists during periods of high demand on the primary Gemini Flash endpoint.
- **Key Value**: Eliminates false-negative AI fallbacks caused by `gemini-3.8-flash` timeouts bypassing `gemini-3.7-flash`, while preventing leaked background HTTP requests.

---

### 2. User Experience & Visual Design

- **Key User Flows**:
  - **Smart Search & Batch Import**: Users experience faster, more reliable canonical title recognition even when the primary model is slow or overloaded, with zero changes to the UI or response payload format.
- **Visual Identity & Theme**:
  - Preserves the existing CineMax dark cinema interface and existing `"AI-assisted search"` indicator with no frontend modifications.
- **Interactive Feedback & Motion**:
  - Unchanged; if both primary and secondary Gemini attempts fail or exhaust the 25-second ceiling, the API continues returning HTTP `200` with deterministic fallback items so the UI never breaks.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Immediate Secondary Failover on Primary Timeout**
  - *Chosen Approach*: Skip retrying `gemini-3.8-flash` when the initial attempt times out at `8500ms`, jumping straight to `gemini-3.7-flash` with the remaining ~`16000ms` budget (capped at `14000ms`).
  - *Why*: A full `8500ms` timeout already consumed ~35% of the 25-second budget; retrying the same stalled model risks exhausting the entire budget before `gemini-3.7-flash` can run.
  - *Alternatives Considered*: Retrying `gemini-3.8-flash` on timeout was rejected because two consecutive `8500ms` timeouts would leave almost no time for `gemini-3.7-flash`.
- **Decision 2: Native `AbortSignal` Cancellation per Attempt**
  - *Chosen Approach*: Attach a dedicated `AbortController` via `config.abortSignal` inside `withTimeoutAndAbort()` so the underlying `fetch` in `@google/genai` is aborted the instant an attempt timer fires.
  - *Why*: Prevents overlapping model requests from continuing to consume server sockets or model quota after a timeout.
- **Decision 3: Structured, Secret-Safe Stage Logging**
  - *Chosen Approach*: Emit explicit diagnostic stage tags (`PRIMARY_TIMEOUT`, `PRIMARY_503`, `SECONDARY_ATTEMPT`, `SECONDARY_SUCCESS`, `SECONDARY_FAILURE`) with sanitized error metadata.
  - *Why*: Makes production triage unambiguous while ensuring `GEMINI_API_KEY`, bearer tokens, and query keys are always redacted.

---

### 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Control-Flow Diagram**:

```
┌────────────────────────────────────────────────────────────────────────────┐
│               resolveTitlesWithGemini() — 24.5s Total Budget               │
└─────────────────────────────────────┬──────────────────────────────────────┘
                                      │
                                      ▼
┌────────────────────────────────────────────────────────────────────────────┐
│ Attempt 1: gemini-3.8-flash (8.5s timeout + AbortController)               │
└──┬────────────────────────┬──────────────────────────────┬─────────────────┘
   │ Non-Retryable          │ Timeout (8.5s)               │ HTTP 503
   │ (400/401/403/404/429)  │                              │
   ▼                        ▼                              ▼
┌──────────────┐   ┌────────────────────────┐   ┌────────────────────────────┐
│ Rethrow Fast │   │ Log: PRIMARY_TIMEOUT   │   │ Log: PRIMARY_503           │
│ (No Retry /  │   │ Abort Attempt 1        │   │ Jittered Backoff (~500-850)│
│  No Fallback)│   └───────────┬────────────┘   │ Retry gemini-3.8-flash(6.5s)│
└──────┬───────┘               │                └──────────┬─────────────────┘
       │                       │                           │
       │                       │             ┌─────────────┴─────────────┐
       │                       │             │ 503 OR Timeout on Retry   │
       │                       │             ▼                           │
       │                       │   ┌─────────────────────────────────┐   │
       │                       └──►│ Log: SECONDARY_ATTEMPT          │◄──┘
       │                           │ Invoke gemini-3.7-flash         │
       │                           │ (Remaining budget up to 14.0s,  │
       │                           │  min 4.0s + AbortController)    │
       │                           └─────────┬───────────────┬───────┘
       │                                     │ Success       │ Error / Timeout
       │                                     ▼               ▼
       │                           ┌──────────────────┐ ┌────────────────────┐
       │                           │ SECONDARY_SUCCESS│ │ SECONDARY_FAILURE  │
       │                           │ Return AI Items  │ │ Rethrow to Catch   │
       │                           └──────────────────┘ └────────┬───────────┘
       │                                                         │
       └───────────────────────────┬─────────────────────────────┘
                                   ▼
┌────────────────────────────────────────────────────────────────────────────┐
│ Outer Catch: Log Safe Diagnostics & Return Deterministic TMDB Fallback     │
└────────────────────────────────────────────────────────────────────────────┘
```

- **Timeout & Budget Allocation Math**:
  - `GEMINI_TOTAL_BUDGET_MS = 24500` (strictly within the 25-second ceiling).
  - `PRIMARY_ATTEMPT_TIMEOUT_MS = 8500` (initial `gemini-3.8-flash` call).
  - `PRIMARY_RETRY_TIMEOUT_MS = 6500` (used only when the initial call fails fast with HTTP `503`).
  - `SECONDARY_MAX_TIMEOUT_MS = 14000` and `SECONDARY_MIN_BUDGET_MS = 3500`:
    - **Case A (Primary Timeout at 8.5s)**: Remaining budget is `~16000ms` -> `gemini-3.7-flash` gets `14000ms`.
    - **Case B (Primary 503 at ~1s + 0.7s backoff + Retry Timeout at 6.5s)**: Elapsed is `~8.2s`, remaining budget is `~16300ms` -> `gemini-3.7-flash` gets `14000ms`.
    - **Case C (Primary 503 at ~4s + 0.7s backoff + Retry Timeout at 6.5s)**: Elapsed is `~11.2s`, remaining budget is `~13300ms` -> `gemini-3.7-flash` gets `13300ms`.
- **Error Classification & Cancellation Rules**:
  - `isTimeoutError(err)` detects timeout rejections (`err?.isTimeout === true`, `err?.name === 'AbortError'`, or message matching `timed out`).
  - `isHttp503UnavailableError(err)` detects HTTP `503` / `UNAVAILABLE` / high-demand overload responses.
  - `isNonRetryableGeminiError(err)` detects `400`, `401`, `403`, `404`, `422`, and `429` (`INVALID_ARGUMENT`, `UNAUTHENTICATED`, `PERMISSION_DENIED`, `API_KEY_INVALID`, `RESOURCE_EXHAUSTED`) and immediately aborts further retries or model switches.
