# Gemini API Error Diagnostics & Timeout Hardening

This update enhances server-side observability and timeout resilience for Gemini AI title resolution by adding sanitized error logging (`console.error`) and extending the request timeout from 8,500ms to 25,000ms while preserving the existing fallback behavior and frontend privacy.

## User Review & Critical Decisions

> [!IMPORTANT]
> All requirements were explicitly specified in the prompt. No changes will be made to the Gemini model, prompts, response schema, TMDB matching, search UI, import logic, or any other files.

- **Sanitized Server Diagnostics**: Log structured error fields (`name`, `message`, HTTP `status`, and error `code`) via `console.error()` in the `resolveTitlesWithGemini()` catch block, while scrubbing any potential API key or token substrings and never logging `GEMINI_API_KEY` or authorization headers.
- **Extended Request Timeout**: Increase `GEMINI_TIMEOUT_MS` from `8500` to `25000` (25 seconds) so batch and cold-start Gemini calls complete reliably without premature fallback.
- **Preserved Frontend Safety**: Keep the existing user-friendly fallback response (`provider: 'fallback'`, `aiAvailable: false`, and generic warning string) without leaking internal error details to the client.

---

## 1. Overview & Core Concept

- **What It Does**: Captures actionable server-side diagnostics when a Gemini API request fails or times out, and gives slower or larger batch requests up to 25 seconds to resolve before triggering the deterministic fallback.
- **Target Audience / Persona**: Developers and operators monitoring backend logs in development or production environments.
- **Key Value**: Eliminates silent catch blocks on the server and prevents premature timeouts on multi-title import batches while maintaining strict secret hygiene.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  - End-user Search and Completed List Import UX, visual styling, and fallback messaging remain completely unchanged.
  - When a Gemini request succeeds within 25 seconds, canonical title matches are returned as usual.
  - When a Gemini request fails, rate-limits, or exceeds 25 seconds, the server logs a sanitized diagnostic entry via `console.error()` and returns the safe fallback resolution to the UI.
- **Visual Identity & Theme**: Preserves CineMax's existing Obsidian (`#0A0D12`) and Amber (`#F59E0B`) Liquid Glass interface with zero UI modifications.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Structured & Redacted `console.error` Diagnostics**
  - *Chosen Approach*: Extract only safe diagnostic metadata (`name`, sanitized `message`, `status` / `statusCode`, and `code` / `errorCode`) and pass a structured diagnostic object to `console.error('[TitleResolutionService] Gemini API error:', ...)`.
  - *Why*: Provides immediate visibility into HTTP 400/403/429/503 or timeout errors in server logs while guaranteeing that `GEMINI_API_KEY`, bearer tokens, and request headers can never be printed.
  - *Alternatives Considered*: Logging the raw `err` object directly (rejected because SDK error objects can attach request configs or headers containing sensitive credentials).
- **Decision 2: 25,000ms Timeout Threshold**
  - *Chosen Approach*: Update `GEMINI_TIMEOUT_MS` from `8500` to `25000`.
  - *Why*: Batch import requests (up to 25–50 titles) and cold-start model calls can take longer than 8.5 seconds; 25 seconds prevents false-positive timeouts while still bounding server request latency.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

```
┌─────────────────────────────────────────────────────────────────────────┐
│                   POST /api/ai/resolve-titles                           │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│              resolveTitlesWithGemini() (25,000ms Timeout)               │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ try:                                                              │  │
│  │   withTimeout(ai.models.generateContent(...), 25000)              │  │
│  └───────────────┬───────────────────────────────────┬───────────────┘  │
│                  │ Success                           │ Error / Timeout  │
│                  ▼                                   ▼                  │
│  ┌──────────────────────────────┐    ┌───────────────────────────────┐  │
│  │ Return Structured Gemini     │    │ catch (err):                  │  │
│  │ Title Resolutions            │    │ 1. Extract safe fields:       │  │
│  │ (provider: 'gemini')         │    │    name, message, status, code│  │
│  └──────────────────────────────┘    │    (redact any key/secrets)   │  │
│                                      │ 2. console.error(...)         │  │
│                                      │ 3. Return Safe Fallback       │  │
│                                      │    (provider: 'fallback')     │  │
│                                      └───────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

- **Data Model & State**: No changes to `TitleResolutionInputItem`, `ResolvedTitleItem`, `TitleResolutionRequestBody`, or `TitleResolutionResponseBody`.
- **Verification**: Run TypeScript verification (`npm run lint` / `tsc --noEmit`) after updating the service and report the exact file changed.
