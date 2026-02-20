# Terms & Conditions — Client Implementation Guide

This document describes how to implement the terms-acceptance flow in the frontend. The backend exposes:

- **`terms_definitions`**: Metadata and SHA-256 hash of legal documents (T&C, Privacy, etc.). Read-only for the client; only active rows (`is_active = true`) are visible.
- **`user_terms_acceptance`**: Append-only audit log of acceptances, keyed by **profile** (`profile_id` = current user's id, which matches `auth.users.id` / `profiles.id`).
- **RPC `get_pending_terms()`**: Returns the list of active terms that the current user has not yet accepted.

---

## 1. When to Run the Check

- Run **immediately after** the user is authenticated: after `signIn`, `signUp`, or when restoring the session (e.g. `getSession()` or `onAuthStateChange`).
- Run **before** rendering the main app or dashboard so you can block access until all pending terms are accepted.

---

## 2. Calling the RPC

Use the Supabase client while the user is authenticated:

```ts
const { data: pendingTerms, error } = await supabase.rpc('get_pending_terms');
```

- **Success**: `pendingTerms` is an array of `{ term_id: string, type: string, version: string }`, or `null` if the RPC returns nothing.
- **Empty array `[]`**: The user has accepted all active terms; allow access to the app.
- **Non-empty array**: Show the acceptance UI and block the dashboard until the user accepts.

Always handle `error` (e.g. network or permission issues) and optionally show a retry or error message.

---

## 3. TypeScript Types (Optional)

```ts
type PendingTerm = {
  term_id: string;
  type: string;
  version: string;
};

const { data } = await supabase.rpc('get_pending_terms');
const pending = (data ?? []) as PendingTerm[];
```

---

## 4. Showing the Acceptance UI and Blocking the App

When `pendingTerms.length > 0`:

- Do **not** render the main app/dashboard (or render it behind a full-screen overlay).
- Show a modal (or dedicated screen) that:
  - Lists the pending terms (e.g. by `type` and `version`).
  - Optionally links to or embeds the legal document (the DB only stores metadata and hash; see section 9).
  - Has a single **“Aceptar”** (or **“Aceptar todos”**) action.

Only after all pending terms are recorded (see section 5) should you allow the user into the app (e.g. clear state and hide the modal).

---

## 5. Recording Acceptance

When the user clicks **“Aceptar”**, insert one row per pending term into `user_terms_acceptance`. Use the **current user’s id** as `profile_id` (it matches `profiles.id`):

```ts
const { data: { user } } = await supabase.auth.getUser();
if (!user?.id) return;

const rows = pendingTerms.map((t) => ({
  profile_id: user.id,
  term_id: t.term_id,
}));

const { error } = await supabase.from('user_terms_acceptance').insert(rows);
```

- **On success**: Clear pending state, hide the modal, and allow access to the app.
- **On error**: Show an error message and allow retry.

---

## 6. Optional: Re-check After Accept

You can call `get_pending_terms()` again after a successful insert; if it returns `[]`, then clear the modal and unlock the UI. Alternatively, if the insert succeeded and you only inserted for the terms you showed, you can unlock without re-calling.

---

## 7. End-to-End Flow (Summary)

1. User signs in (or session is restored).
2. Call `get_pending_terms()`.
3. If `pending.length === 0` → render the app.
4. Else → show modal with the list of pending terms (`type` + `version`).
5. On **“Aceptar”**: insert one row per pending term (`profile_id = user.id`, `term_id = t.term_id`).
6. On insert success → hide modal and render the app (optionally re-call `get_pending_terms()` to confirm).
7. On insert error → show error and allow retry.

---

## 8. Where to Run the Check in the App

- **SPA with router**: Run the check in a layout or route guard that wraps the authenticated area (e.g. dashboard layout). After auth, before rendering children, call `get_pending_terms`; if there are pending terms, render the modal instead of the main content.
- **Next.js / React**: For example in a `useEffect` in a root layout or auth wrapper that mounts only when a session exists. Store “pending terms” and “modal visible” in state (or context) and drive the modal and blocking from there.

---

## 9. Displaying Document Content

The database stores only metadata and `content_hash` in `terms_definitions`, not the document body. To show the actual text or PDF:

- Serve documents from a static site, CMS, or storage (e.g. `/legal/terms-v2.pdf`, or a page that renders the text).
- Map `type` and `version` from `get_pending_terms()` to the correct URL or content key in the frontend (e.g. a config map: `terms` + `2.0` → `https://yoursite.com/legal/terms-2.0`).

---

## 10. Backend Reference

- Migrations: `supabase/migrations/20260219210000_create_terms_definitions_and_acceptance.sql`, `20260219210100_rpc_get_pending_terms.sql`.
- RPC signature: `get_pending_terms()` returns `TABLE(term_id uuid, type varchar, version varchar)`.
- Table for insert: `user_terms_acceptance` with columns `profile_id`, `term_id` (and optional `accepted_at`; default is `now()`).
