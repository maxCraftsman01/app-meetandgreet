

## Add Missing Owner PIN Field to Property Form

The property form has `owner_pin` in its state and validation, but the actual input field is missing from the form JSX.

### Change

**`src/pages/Admin.tsx`** — Add an Owner PIN input field in the form grid, next to the Owner Name field (lines 219-222). Replace the single Owner Name field with a row containing both Owner Name and Owner PIN:

```
<div>
  <Label>Owner Name</Label>
  <Input value={form.owner_name} onChange={...} placeholder="John Smith" />
</div>
<div>
  <Label>Owner PIN</Label>
  <Input value={form.owner_pin} onChange={...} placeholder="12345678" className="font-mono" />
</div>
```

This goes inside the existing `grid-cols-2` container at line 214, so both fields sit side-by-side. No backend or schema changes needed — the field is already stored and validated, it was just missing from the UI.

