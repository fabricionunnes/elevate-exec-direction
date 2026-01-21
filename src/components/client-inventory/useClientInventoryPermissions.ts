import { useMemo } from "react";

export function useClientInventoryPermissions(userRole?: string) {
  const permissions = useMemo(() => {
    // Only 'client' role can edit. All others (admin, cs, consultant) are read-only
    const isClient = userRole === "client";
    
    return {
      canEdit: isClient,
      isReadOnly: !isClient,
      canCreate: isClient,
      canDelete: isClient,
      canConfigure: isClient,
    };
  }, [userRole]);

  return permissions;
}
