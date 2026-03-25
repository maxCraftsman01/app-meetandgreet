

## Fix Empty Space and Scroll Position on Dashboard

### Problem 1: Empty space below header on mobile
The `<main>` element has `py-8` (2rem top padding) and `space-y-6` on the Tabs container. The desktop-only TabsList wrapper (`hidden md:flex`) is hidden on mobile but the `space-y-6` gap class on the Tabs still reserves spacing. Reducing the top padding on mobile will tighten this up.

### Problem 2: Page scrolled down after login
After navigating from Index to Dashboard, the browser may retain scroll position or the page starts mid-scroll. Adding a `scrollTo(0, 0)` on mount will fix this.

### Changes

**`src/pages/Dashboard.tsx`**
1. Line 198: Change `py-8` to `py-4 md:py-8` — less top padding on mobile
2. In the `useEffect` that runs on mount (around line 56), add `window.scrollTo(0, 0)` to ensure the page starts at the top after login

Two small changes, no structural modifications.

