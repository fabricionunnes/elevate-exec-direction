import { useMemo } from 'react';

// Hook to check if user has edit permissions (only client users can edit)
export function useClientFinancialPermissions(userRole?: string) {
  const canEdit = useMemo(() => {
    // Only 'client' role can edit financial data
    return userRole === 'client';
  }, [userRole]);

  const canView = useMemo(() => {
    // All authenticated users can view
    return true;
  }, []);

  return {
    canEdit,
    canView,
    isReadOnly: !canEdit,
  };
}
