import { db } from '../config/database.js';
import { auditLogs } from '../db/schema/index.js';

export async function writeAuditLog({
  actorUserId,
  action,
  entityType,
  entityId,
  metadata,
  ipAddress,
}) {
  await db.insert(auditLogs).values({
    actorUserId: actorUserId || null,
    action,
    entityType,
    entityId: entityId || null,
    metadata: metadata || null,
    ipAddress: ipAddress || null,
  });
}

export default {
  writeAuditLog,
};
