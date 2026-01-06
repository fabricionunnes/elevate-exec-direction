// ChatNotifications component - notifications are now handled only by GlobalChatWidget badge
// This component is kept for backwards compatibility but renders nothing

export const ChatNotifications = () => {
  // All notification logic is now centralized in GlobalChatWidget
  // This component returns null to prevent duplicate notifications
  return null;
};
