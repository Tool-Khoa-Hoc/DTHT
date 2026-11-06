# Google OAuth & Authentication UX Playbook (Web SPA + Supabase PKCE)

> **Scope:** Production authentication interfaces supporting **Google Sign-In (OAuth 2.0 PKCE)** alongside Email/Password credentials in Dual-Theme Web SPAs, aligned with official Google Identity Branding Guidelines and **WCAG 2.2 AA (Criterion 3.3.8 Accessible Authentication)**.

---

## 1. Official Google Sign-In Branding Rules

Users trust OAuth buttons when they immediately recognize authentic provider branding. Never improvise the Google logo with a plain text `"G"`, a monochrome icon font glyph, or brand-tinted red/gold fills.

### 1.1 Official 4-Color Google `G` Vector Mark
Always render the official 4-color SVG `G` mark (`viewBox="0 0 24 24"` or `"0 0 48 48"`) at `18px–20px` (`w-5 h-5 shrink-0`) with `aria-hidden="true"`:

- **Blue:** `#4285F4`
- **Green:** `#34A853`
- **Yellow:** `#FBBC05`
- **Red:** `#EA4335`

```jsx
<svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
  <path
    fill="#4285F4"
    d="M23.49 12.275c0-.85-.075-1.675-.215-2.475H12v4.69h6.45c-.28 1.5-1.125 2.775-2.395 3.63v3.015h3.875c2.265-2.085 3.56-5.16 3.56-8.86Z"
  />
  <path
    fill="#34A853"
    d="M12 24c3.24 0 5.955-1.075 7.94-2.91l-3.875-3.015c-1.075.72-2.45 1.15-4.065 1.15-3.125 0-5.77-2.11-6.715-4.945H1.28v3.11C3.255 21.31 7.31 24 12 24Z"
  />
  <path
    fill="#FBBC05"
    d="M5.285 14.28A7.21 7.21 0 0 1 4.91 12c0-.795.135-1.565.375-2.28V6.61H1.28A11.99 11.99 0 0 0 0 12c0 1.935.465 3.765 1.28 5.39l4.005-3.11Z"
  />
  <path
    fill="#EA4335"
    d="M12 4.775c1.76 0 3.34.605 4.585 1.795l3.435-3.435C17.95 1.19 15.235 0 12 0 7.31 0 3.255 2.69 1.28 6.61l4.005 3.11c.945-2.835 3.59-4.945 6.715-4.945Z"
  />
</svg>
```

### 1.2 Dual-Theme Button Surface & Contrast Parity

Google Sign-In buttons must maintain crisp boundaries (`>= 3:1` border/surface separation) and high text contrast (`>= 7:1`) in **both** Light and Dark themes:

| Theme | Background Surface | Border | Label Color | Hover / Focus State |
| :--- | :--- | :--- | :--- | :--- |
| **Light Mode** (`Thư Phòng Sáng`) | `#FFFFFF` (`bg-white`) | `1px solid #D6CFC2` (or `#747775` / `border-border`) | `#1F1F1F` / `#1C1917` | `hover:bg-[#F8F6F1]` + visible `focus-visible:ring-2 focus-visible:ring-primary` |
| **Dark Mode** (`Mặc Dạ Tối`) | `#131314` or elevated `#2A2420` (`dark:bg-[#1E1A17]`) | `1px solid #8E918F` or `dark:border-[#4A4036]` | `#F5EFE6` (`dark:text-[#F5EFE6]`) | `dark:hover:bg-[#2B2521]` + visible `focus-visible:ring-2 focus-visible:ring-primary` |

- **Sizing & Rhythm:** Minimum height `44px` (`min-h-11` / `h-12`), horizontal padding `px-4`, gap `gap-3` (`12px`) between the `G` mark and text, `font-sans font-semibold text-sm sm:text-base`.
- **Approved Vietnamese Copy:** `"Tiếp tục với Google"` (preferred for unified Login/Register friction reduction) or `"Đăng nhập bằng Google"`.
- **Visual Separation:** Separate Google OAuth from Email/Password inputs with an accessible horizontal rule + `"hoặc đăng nhập bằng email"` label (`aria-hidden` on decorative lines only, keeping text readable).

---

## 2. Explicit Account-Picker UX (`prompt: 'select_account'`)

Students frequently log in from shared school labs, library terminals, or family laptops where another Google account is already active in the browser. Omitting `prompt: 'select_account'` silently logs the user into the wrong account with no chance to switch.

### Required OAuth Invocation Contract (Supabase JS v2)

```javascript
const nextPath = getSafeNextPath(searchParams.get('next'));
const callbackUrl = new URL('/auth/callback', window.location.origin);
if (nextPath && nextPath !== '/') {
  callbackUrl.searchParams.set('next', nextPath);
}

const { error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: callbackUrl.toString(),
    queryParams: {
      prompt: 'select_account',
    },
  },
});
```

### Pre-Redirect Loading Feedback
- Immediately lock the button (`disabled={isSubmittingOAuth || isSubmittingForm}`) when clicked so rapid double-clicks cannot spawn duplicate PKCE code verifiers in `localStorage`.
- Replace or accompany the label with `"Đang chuyển tới Google..."` and `aria-busy="true"` while preserving button height (`min-h-11`) so the card layout never jumps.

---

## 3. PKCE Callback State Machine & Error Recovery UX

In OAuth 2.0 PKCE flows, the user returns to `/auth/callback?code=...` (or `?error=access_denied&error_description=...`). A production callback screen must handle every state explicitly without flashing blank white screens or raw technical error codes.

```
[Click Google Button]
        │
        ▼
(1. Initiating Redirect) ──► Network failure? ──► Inline `role="alert"` banner on Login card
        │
        ▼
[Google Account Picker (`prompt=select_account`)]
        │
        ├──► User clicks Cancel (`?error=access_denied`) ──► Return to `/login` with calm info banner:
        │                                                    "Bạn đã hủy đăng nhập Google. Vui lòng chọn lại tài khoản hoặc dùng Email."
        ▼
(2. Callback Code Exchange `/auth/callback`)
        │   • Calm centered scholarly card (`bg-surface border-border`)
        │   • Non-jarring spinner + status text: "Đang xác thực ấn tín khoa trường..."
        │   • Timeout watchdog (10s–12s) in case of stalled network
        │
        ├──► Code expired / PKCE verifier mismatch ──► (4. Recoverable Error Card)
        │                                                • Clear Vietnamese explanation
        │                                                • Primary CTA: "Thử đăng nhập lại với Google"
        │                                                • Secondary link: "Quay về trang Đăng nhập"
        ▼
(3. Profile Hydration `tram_sv`)
        │   • Ensure user profile row exists / syncs avatar & display name
        ▼
[Navigate (`replace: true`) to validated `next` path (default `/`)]
```

---

## 4. Safe `next` Redirect Preservation (Open-Redirect Defense)

When an unauthenticated learner clicks a deep link (e.g., `/arena`, `/roadmap`, `/notes`), route guards should redirect to `/login?next=%2Froadmap` and preserve that target across both Email/Password login and Google OAuth roundtrips.

### Mandatory Security Sanitizer (`getSafeNextPath`)
Never pass an unvalidated `?next=` parameter to `window.location.href` or router navigation—attackers craft `?next=//evil.example.com` or `?next=https://phishing.site`. Always sanitize:

```javascript
export function getSafeNextPath(rawNext, fallback = '/') {
  if (typeof rawNext !== 'string') return fallback;
  const trimmed = rawNext.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('\\')) {
    return fallback;
  }
  if (trimmed.startsWith('/login') || trimmed.startsWith('/register') || trimmed.startsWith('/auth/callback')) {
    return fallback;
  }
  return trimmed;
}
```

---

## 5. Accessible Credential Form Standards (WCAG 2.2 AA — 3.3.8)

1. **Zero Paste Blocking & Password Manager Support:**
   - Never attach `onPaste={(e) => e.preventDefault()}` on email or password fields.
   - Use exact HTML `autoComplete` tokens: `autoComplete="email"`, `autoComplete="current-password"` (Login), `autoComplete="new-password"` (Register/Reset), `autoComplete="name"`.
2. **Programmatic Labels & Error Associations:**
   - Every `<input>` MUST have a paired `<label htmlFor="...">`. Placeholder text is **never** a substitute for a visible label.
   - Field-level validation errors set `aria-invalid="true"` and `aria-describedby="field-error-id"` on the input.
   - Form-level authentication errors (invalid credentials, unconfirmed email, rate limit) render inside an inline `<div role="alert" aria-live="assertive">` banner inside the auth card—**never** via `window.alert()`.
3. **Accessible Password Visibility Toggle:**
   - Provide a `<button type="button">` inside the password field wrapper with `aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}` and `aria-pressed={showPassword}`, ensuring minimum `44×44px` hit target or comfortable padding without stealing form submit (`type="button"` is mandatory!).
