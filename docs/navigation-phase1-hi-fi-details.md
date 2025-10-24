# High-Fidelity Specification (Textual)

Since we are not producing visual mock files, this document serves as the “hi-fi” reference. It captures precise layout, component states, and copy so implementation can begin without a design tool.

## Global Elements
- **Typography:**  
  - Title (page): `text-3xl font-semibold` (Tailwind equivalent).  
  - Section headings: `text-xl font-semibold`.  
  - Body text: `text-sm` (default).  
  - Metadata chips: uppercase `text-xs tracking-wide`.
- **Spacing:**  
  - Primary vertical rhythm: 24px between modules.  
  - Card padding: 16px top/bottom, 20px left/right.  
  - Two-column layout gap: 32px.
- **Colors (Tailwind tokens):**  
  - Primary accent: `bg-primary`, `text-primary-foreground`.  
  - Status chips:  
    - Success: `bg-emerald-100 text-emerald-700`.  
    - Warning: `bg-amber-100 text-amber-700`.  
    - Danger: `bg-rose-100 text-rose-700`.  
  - AI suggestion badge: `bg-indigo-100 text-indigo-700`.

## Component Specs

### Navigation Rail
- Background: `bg-slate-950` (dark).  
- Active item: left accent bar (`border-l-4 border-primary`), text `text-white font-medium`.  
- Default item: `text-slate-300 hover:text-white`.  
- Collapsed state: icons centered in 72px column with tooltip on hover.  
- Team switcher (top): pill button containing team name + chevron; opens popover.

### My Tasks Card (Developer)
- Width fills column; displayed as stacked cards.  
- Fields:  
  - Title (story/task name).  
  - Subtitle: `Sprint {name} • {story points} pts`.  
  - Status badge (e.g., “Ready”, “In Progress”).  
  - Due indicator: clock icon + due date or “Soon”.  
  - CTA button (primary) labelled `Start` or `Complete`.  
  - Overflow icon (three dots).  
- Interaction:  
  - Hover: card elevation (`shadow-md`).  
  - CTA disabled if already in completing state (pending API).  
  - Overflow menu: `View story`, `Reassign`, `Log note`.

### Sprint Snapshot Tile
- Layout: horizontal split.  
  - Left: progress ring (SVG) showing committed vs completed (percentage).  
  - Right: list of metrics (Capacity Used, Stories Remaining, Blockers).  
- Background: `bg-slate-50`.  
- CTA buttons: “Open board”, “Manage sprint”.

### AI Suggestion Card
- Structure:  
  - Header chip with context (“Blocker”, “Backlog Health”, “AI Recommendation”).  
  - Title sentence (imperative).  
  - Body: one-line rationale (“Because Story ABC has no ACs”).  
  - Actions: primary `Apply` button (`bg-indigo-600 text-white`), secondary `Dismiss` ghost button.  
  - Optional link: “View details”.
- On Apply: card collapses to confirmation state with check icon and summary.

### Backlog Health Mini-Chart
- Bar chart with two bars (Ready, Needs refinement); show counts.  
- Colors: `Ready = bg-emerald-500`, `Needs = bg-amber-500`.  
- Provide descriptive alt text for accessibility.

### Notifications & Rituals Panel
- Use segmented list with icons:  
  - Calendar icon for upcoming events.  
  - Chat icon for stand-up summary.  
  - Bell icon for new notifications.  
- Each item has CTA link for “View notes” or “Join stand-up”.

## Copy Guidelines
- Use action-oriented titles (e.g., “Start work on Task ABC”).  
- Avoid jargon in AI suggestions; include reason tokens (“Based on story size > 8”).  
- When no data, show supportive messages:  
  - My Tasks empty: “Great work! No assigned tasks. Pull a ready story?”  
  - AI feed empty: “You’re all set. I’ll surface suggestions when something needs attention.”

## Interaction Rules
- Clicking CTA triggers micro-loading state (button spinner).  
- Dismissing suggestion removes it and logs event.  
- Team switcher selection reloads dashboard modules with skeleton loading states.  
- On mobile:  
  - My Tasks becomes vertical list with swipe actions (swipe right to complete, left to view).  
  - AI suggestions become carousel cards.

## Accessibility
- All CTAs have focus outlines.  
- Provide keyboard shortcuts: `T` for My Tasks, `S` for Current Sprint, `B` for Backlog.  
- Dynamic updates (AI suggestions added) announce via aria-live polite region.

## Acceptance Criteria (Phase 1 Hand-off)
1. Dashboard page renders with modules ordered per persona spec.  
2. Navigation rail supports desktop + collapsed states; mobile bottom nav toggles.  
3. Task cards and suggestion cards include defined actions and states.  
4. Sprint snapshot displays progress using ring + metrics alignment.  
5. Accessibility requirements met (contrast, focus, announcements).  
6. Responsive behaviour documented (desktop, tablet, mobile).

Use this as the reference for implementation stories during Phase 3/4.
