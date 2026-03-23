

## Responsive & Color-Coded Polish for PIN Entry + Cleaner Portal

### What's changing

Two areas get optimized: the PIN entry screen and the Cleaning tab — both refined for one-handed mobile use on a 390px viewport with the property management color system (light grays, emerald for ready, coral for busy).

### 1. PIN Entry — Mobile-First Optimization

**File: `src/pages/Index.tsx`**

- Increase PIN input tap targets: `w-11 h-14` on mobile (44px minimum touch target per Apple HIG)
- Add `safe-area-inset` padding at bottom for phones with home indicators
- Position the entire form in the lower-third of the screen so thumbs reach easily: `justify-end pb-safe` on mobile, `justify-center` on desktop
- Larger gap between inputs on small screens for fat-finger tolerance
- Add a subtle emerald accent on the icon instead of the warm primary to match the "property management" professional feel

### 2. Cleaning Tab — One-Handed Mobile UX

**File: `src/pages/Dashboard.tsx`** (cleaning section, lines 438-529)

- Make the "Mark as Cleaned" button full-width and taller (`h-12`) with a prominent emerald color for easy thumb tap
- Increase card padding on mobile for better touch spacing
- Status cards use the refined color system consistently:
  - **Same-day turnover**: `bg-red-50 border-red-300 text-red-700` (coral)
  - **Checkout only**: `bg-amber-50 border-amber-300 text-amber-700`
  - **Arrival pending**: `bg-orange-50 border-orange-300 text-orange-700`
  - **Ready / Cleaned**: `bg-emerald-50 border-emerald-300 text-emerald-700`
  - **Idle**: `bg-gray-50 border-gray-200 text-gray-500`
- Tab switcher: make `TabsTrigger` larger on mobile (`h-10 px-4 text-sm`) for thumb tapping
- Refresh button: move to a floating action position or make it more prominent
- Add bottom padding (`pb-24`) so content doesn't hide behind mobile nav bars

### 3. Header — Mobile Responsive

**File: `src/pages/Dashboard.tsx`** (header, lines 235-272)

- Stack property selector below the header on mobile instead of cramming it inline
- Make logout button touch-friendly (`h-10 w-10`)
- Reduce title font size on mobile to prevent overflow

### 4. CSS Utility Additions

**File: `src/index.css`**

- Add `pb-safe` utility using `env(safe-area-inset-bottom)` for notched phones
- Ensure the cleaning status utility classes use the refined gray/emerald/coral palette

### Summary of files

| File | Changes |
|---|---|
| `src/pages/Index.tsx` | Larger touch targets, bottom-aligned on mobile, safe area padding |
| `src/pages/Dashboard.tsx` | Bigger buttons, better card spacing, responsive header, mobile tab sizing |
| `src/index.css` | Safe area utility, refined status colors |

