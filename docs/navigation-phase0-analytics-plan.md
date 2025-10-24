# Analytics Instrumentation Plan (Phase 0 – M0.2)

This plan details the telemetry we will instrument in later phases to measure the success metrics defined in `navigation-phase0-metrics.md`. During Phase 0 we validate event taxonomy and payloads; implementation happens during Phase 3/4 builds.

## Event Taxonomy

| Event Name | Trigger | Key Properties | Notes |
| --- | --- | --- | --- |
| `dashboard_viewed` | Dashboard route renders | `user_id`, `persona_role`, `team_id`, `project_context`, `timestamp` | Fires once per load (debounce on route changes). |
| `task_action_initiated` | User clicks start/complete on task | `user_id`, `task_id`, `story_id`, `team_id`, `action_type` (`start`, `complete`, `reassign`), `time_from_dashboard` | Used to measure time-to-action (H1). |
| `sprint_spotlight_opened` | User expands sprint spotlight module | `user_id`, `team_id`, `sprint_id`, `interaction_type` (`view_details`, `navigate_board`, `navigate_backlog`) | Gauge engagement with new sprint module. |
| `ai_suggestion_presented` | AI suggestion card rendered | `user_id`, `persona_role`, `suggestion_id`, `suggestion_type` (`story_split`, `add_acs`, `address_blocker`), `priority` | |
| `ai_suggestion_response` | User accepts/dismisses suggestion | `user_id`, `suggestion_id`, `response` (`accepted`, `dismissed`, `ignored`), `follow_up_action` (optional) | Aggregated to satisfy H4. |
| `backlog_prompt_triggered` | Between-task nudge displayed | `user_id`, `persona_role`, `context` (`task_completed`, `no_tasks`), `prompt_id` | |
| `team_switch` | User changes active team | `user_id`, `from_team_id`, `to_team_id` | |
| `navigation_shortcut_used` | Any click on new quick-access nav items | `user_id`, `shortcut` (`my_tasks`, `current_sprint`, `backlog`, etc.), `from_route` | Indicator of nav adoption. |

## Payload Standards
- **Identifiers:** use UUIDs where available; fall back to stable string IDs from existing APIs.
- **Persona Role:** derived from team membership (developer, po, sm, sponsor); allow multi-role via array.
- **Time-from-dashboard:** calculated client-side by storing timestamp when `dashboard_viewed` fired.
- **Context Aggregation:** adopt consistent property names for `team_id`, `project_id`, `sprint_id`.

## Implementation Notes
- **Client:** use existing analytics abstraction (if none, create simple event dispatcher that batches to BI endpoint or console logs during Phase 0).
- **Server:** backlog service already emits events; ensure we can correlate suggestion acceptance with resulting domain events (e.g., story updated).
- **Privacy:** verify no PII beyond user IDs already present; ensure compliance with existing telemetry policy.
- **Testing:** during Phase 4, add Cypress/Vitest coverage to assert events fire with correct payloads.

## Phase 0 Action Items
1. Review taxonomy with James; adjust event names to align with current analytics conventions.
2. Document mock schema in analytics repo (if applicable) or note instrumentation backlog item.
3. During usability simulations, manually log when hypothetical events would fire to validate usefulness.

## Future Work (Outside Phase 0)
- Configure dashboards (e.g., Superset/Metabase) to visualise time-to-action and suggestion engagement.
- Set up alerts for significant drops in dashboard_viewed or spikes in dismissals of AI suggestions.
- Evaluate need for funnel tracking (dashboard → my_tasks → action).
