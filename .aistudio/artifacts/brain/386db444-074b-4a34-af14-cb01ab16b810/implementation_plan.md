# Prominent Forgot Password Entry Point on Sign In

Make the existing password recovery workflow immediately discoverable on both desktop and mobile by placing a dedicated, high-visibility **"Forgot Password?"** action row directly beneath the password field whenever the user is in Sign In mode, connected directly to the existing Supabase password-reset flow.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following design and scope decisions have been confirmed and govern this targeted update:

- **Confirmed Decision 1 — Dedicated Row Directly Below Password Input**: The **"Forgot Password?"** trigger will be rendered in its own dedicated, uncluttered row immediately below the password input field on both the full-screen Sign In view and the Sign In modal, rather than sharing a cramped helper line.
- **Confirmed Decision 2 — Signed-Out Sign In Scope Only**: The **"Forgot Password?"** link will appear exclusively on the Sign In form. The signed-in Profile page (`Edit Profile`, `Change Password`, `Sign Out`) and the signed-in `Change Password` modal remain completely unchanged.

---

## 1. Overview & Core Concept

- **What It Does**: Elevates the **"Forgot Password?"** trigger into a dedicated, unmistakable interactive link row directly beneath the password field whenever the user is in Sign In mode (both in the initial full-screen authentication gate and the overlay authentication modal).
- **Target Audience / Persona**: CineMax web and Android users who are signing into their account on desktop or mobile and need to recover a forgotten password without hunting through menus.
- **Key Value**: Eliminates visual crowding under the password input, provides a generous mobile-friendly touch target, and connects seamlessly to the existing Supabase recovery email and password-reset flow with a single tap.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Sign In Form (Default State)**: Below the password input, a dedicated right-aligned row displays a high-contrast amber **"Forgot Password?"** link button (`data-testid="forgot-password-link"`).
  2. **Entering Password Recovery Mode**: Clicking **"Forgot Password?"** switches the authentication card into the existing recovery view (**"Reset Your Password"**), preserving any email address the user already typed into the Email field and clearing prior form errors.
  3. **Requesting the Reset Link**: Submitting the recovery form validates the email address and invokes the existing Supabase password reset email handler, displaying a confirmation banner when sent.
  4. **Returning to Sign In**: At any point before or after requesting a recovery email, the user can click **"Back to Sign In"** (top of card) or **"Remembered your password? Return to Sign In"** (below the submit button) to return to normal Sign In mode with their email preserved.
- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Dark obsidian cinema palette (`#0A0D12`) with Apple-inspired Liquid Glass panels and warm amber-gold accents (`#F59E0B` / `text-amber-400`).
  - *Typography & Hierarchy*: `Plus Jakarta Sans` UI body with `font-semibold text-xs sm:text-[13px]` styling, subtle key icon affordance, and high-contrast hover/focus underline feedback (`hover:text-amber-300 underline-offset-4 hover:underline`).
  - *Touch Ergonomics*: Minimum 38px–44px interactive tap height on mobile viewports (`320px–430px`) with `whitespace-nowrap` so the link never clips or wraps awkwardly.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Dedicated Action Row Under Password Field in Sign In Mode**
  - *Chosen Approach*: Give **"Forgot Password?"** its own dedicated row directly beneath the password input when `mode === 'signin'`, while keeping password length helper text for `mode === 'signup'`.
  - *Why*: Previously, the link shared a tight horizontal line with muted security caption text and used a tiny tap target, making it easy to overlook on mobile screens. A dedicated row makes the entry point immediately scannable.
- **Decision 2: Reuse Existing Recovery State & Supabase Handler**
  - *Chosen Approach*: Connect the link directly to the existing `forgot_password` mode state and `requestPasswordResetEmail` handler without altering Supabase Auth configuration, deep-link routing, or the signed-in `Change Password` workflow.
  - *Why*: Preserves 100% compatibility with existing web and Android Capacitor password recovery deep links and avoids introducing duplicate reset logic.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Component Diagram**:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        CineMax Authentication UI                        │
├────────────────────────────────────┬────────────────────────────────────┤
│     Full-Screen Sign In Gate       │       Overlay Sign In Modal        │
│  ┌──────────────────────────────┐  │  ┌──────────────────────────────┐  │
│  │ Mode: Sign In                │  │  │ Mode: Sign In                │  │
│  │  • Email Input               │  │  │  • Email Input               │  │
│  │  • Password Input + Eye Icon │  │  │  • Password Input + Eye Icon │  │
│  │  • [Forgot Password?] Row ───┼──┼──┼─► Switches to Recovery Mode  │  │
│  └──────────────┬───────────────┘  │  └──────────────┬───────────────┘  │
└─────────────────┼──────────────────┴─────────────────┼──────────────────┘
                  │                                    │
                  ▼                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     Existing Password Recovery Mode                     │
│  • Header: "Reset Your Password" + "Back to Sign In" button             │
│  • Pre-filled Email Address Input                                       │
│  • Primary CTA: "Send Password Reset Link"                              │
│  • Footer Link: "Remembered your password? Return to Sign In"           │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│             Existing Supabase Auth Recovery Email Service               │
│  • Sends single-use recovery link → Opens ResetPasswordScreen           │
└─────────────────────────────────────────────────────────────────────────┘
```

- **Interactive Component & State Mapping**:
  - **Sign In Mode (`mode === 'signin'`)**: Renders Email input, Password input with show/hide toggle, the dedicated **"Forgot Password?"** action row directly below the password input, and the primary **Sign In** submit button.
  - **Forgot Password Mode (`mode === 'forgot_password'`)**: Hides the password input, displays the **"Back to Sign In"** control at the top and **"Remembered your password? Return to Sign In"** at the bottom, and submits the email to the existing password-reset handler.
  - **Signed-In Profile Page (Unchanged)**: Retains `Edit Profile`, `Change Password` (opening the current-password verification modal), and `Sign Out` without modification.
