---
name: Tenant Isolation in Notification Triggers
description: Broadcast triggers must filter staff by tenant_id matching the source entity to keep WL tenants isolated from master UNV
type: constraint
---

Notification triggers that broadcast to staff "by role" (admin/cs/rh/master) MUST filter `onboarding_staff.tenant_id IS NOT DISTINCT FROM <entity_tenant>`. The entity tenant is resolved from `NEW.tenant_id` (companies) or via `onboarding_projects.tenant_id` (project-bound entities).

Triggers updated to enforce this:
- `notify_company_without_consultant` (NEW.tenant_id)
- `notify_service_request` (project.tenant_id)
- `notify_disc_completed` (project.tenant_id)
- `notify_candidate_created` (project.tenant_id)
- `notify_job_opening_created` (project.tenant_id)
- `notify_low_nps_score` (project.tenant_id)
- `notify_support_room_entry` (project.tenant_id)

**Why:** master UNV (tenant_id NULL) and WL tenants must never receive each other's alerts. The `onboarding_notifications` table has no tenant_id column — isolation is enforced at insert time by selecting only same-tenant staff.

Direct-target triggers (notify a specific cs_id/consultant_id/responsible_staff_id) are already safe because the target staff_id was assigned within the entity's tenant.
