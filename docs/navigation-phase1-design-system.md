# Design System Impact (Phase 1)

This note tracks anticipated component/tasks needed to support the new navigation and dashboard experience.

## Components Requiring Updates
- **Navigation Rail**
  - Support workflow-first menu (icons + labels; active states).
  - Collapsible behaviour for smaller screens.
  - Integrate team switcher in header region.
- **Dashboard Card**
  - Variants: task card, sprint snapshot tile, AI suggestion card, risk summary.
  - Need consistent padding, status chips, action buttons.
- **Progress Indicators**
  - Capacity meter (ring + numeric).
  - Sprint timeline bar (days remaining).
- **List/Queue Components**
  - Task queue with inline actions.
  - Blocker board (grouped list).
- **Suggestion Feed**
  - Dismissible cards with reason chips and logbook of accepted actions.
- **Notification/Ritual Panel**
  - Calendar integration, quick join button.

## New Design Tokens
- `color-status-blocker`, `color-status-risk`.
- `spacing-card-stack` for tighter vertical lists.
- `radius-card-lg` for new spotlight modules.

## Accessibility Considerations
- Ensure nav icons meet 3:1 contrast w/ background.
- Keyboard focus for quick actions (Start, Complete) in card lists.
- Provide accessible toggles for dismissal of AI suggestions.
- Announce team switcher change via ARIA live region.

## Documentation Tasks
- Update design system docs (navigation, cards, metrics) once hi-fi designs finalised.
- Provide Figma component variants and usage guidance.
- Add developer notes for each component (props, default behaviours).
