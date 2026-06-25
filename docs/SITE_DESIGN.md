# Site Design — Abundance Architecture
*CSS approach, design system, component conventions.*

---

## Public Teaser Page

**File:** `public/index.html`
**CSS approach:** Custom CSS embedded directly in the HTML `<style>` block. No framework.
**Status:** Approved final design — do not restyle, restructure, or edit.

### Design Tokens (for reference only — do not modify)

The teaser page uses these approximate values (extracted for reference, not a design system):

- **Background:** Deep navy `#0a0a1a` with gradient overlays
- **Accent:** Gold `#c9a84c`
- **Body text:** Off-white `#e8e6e0`
- **Font:** Georgia (serif) for headings; system-ui for body/labels
- **Max content width:** 900px centered

The hero background image slot is `public/images/hero.jpg`. When artwork is ready
it drops into that path with no code changes.

**This page is frozen.** Any future design changes require explicit approval and a
new decision recorded in `docs/wip/` before touching the file.

---

## Admin SPA

**Files:** `admin/src/`
**CSS approach:** Inline styles and minimal CSS-in-JS via the `style` prop on React elements.
No CSS framework. Base reset in `admin/index.html` `<style>` block.

### Current Layout (Pre-Module 6)

The current admin uses a **top-tab navigation** layout (Login → AdminLayout with
People / Inbox / Analytics tabs). This does not comply with the Module 6 left-nav
standard in `shared/SHARED_ADMIN_MODULES.md`.

The left-nav migration is deferred to after PR3 (auth hardening). Until then, the
current layout is intentional — do not refactor the nav structure mid-transition.

### Current Design Values

- **Body background:** `#f5f5f5`
- **Header background:** `#1a1a2e` (dark navy)
- **Header text:** white
- **Accent / active tab:** `#4a9eff` (blue)
- **Card background:** white
- **Border color:** `#e0e0e0`
- **Font:** system-ui, sans-serif

### Target Layout (Post-Module 6 Migration)

After the Module 6 migration:
- Fixed 240px left nav with site name at top, Logout at bottom
- Module order: Dashboard (Analytics) → People → Inbox
- Main content area: page title top-left, action buttons top-right
- Admin color palette does not need to match the public teaser page

Document color/typography decisions here when the migration is implemented.
