-- Allow authenticated users to read notification-related settings (won notifications, etc.)
-- This is needed so closers can trigger won notifications without being CRM admins
CREATE POLICY "Authenticated users can read notification settings"
ON crm_settings
FOR SELECT
TO authenticated
USING (
  setting_key IN (
    'won_notification_enabled',
    'won_notification_instance_id',
    'won_notification_group_jid'
  )
);