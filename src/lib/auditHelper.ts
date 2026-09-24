/**
 * Helper to safely create audit logs in PostgreSQL without risking Foreign Key constraint violations.
 * If `userId` is provided but does not exist in the `User` table (e.g., demo user, mock session),
 * it safely sets `userId: null` while preserving `userName`, `userEmail`, and all other details.
 */
export async function createSafeAuditLog(
  clientOrTx: any,
  data: {
    businessId: string;
    userId?: string | null;
    userName?: string | null;
    userEmail?: string | null;
    branchId?: string | null;
    action: string;
    entity: string;
    entityId?: string | null;
    details?: string | null;
    changes?: string | null;
    ipAddress?: string | null;
    createdAt?: Date;
  }
) {
  let validUserId: string | null = null;
  if (data.userId) {
    try {
      const user = await clientOrTx.user.findUnique({
        where: { id: data.userId },
        select: { id: true },
      });
      if (user) {
        validUserId = user.id;
      }
    } catch {
      validUserId = null;
    }
  }

  return clientOrTx.auditLog.create({
    data: {
      ...data,
      userId: validUserId,
    },
  });
}
