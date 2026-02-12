import { useMemo } from "react";

export function useAppointmentPermissions(userRole?: string) {
  const permissions = useMemo(() => {
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
