export class PostgresAuditRepository {
  constructor(pool) {
    if (!pool?.query) throw new Error("A PostgreSQL pool is required");
    this.pool = pool;
  }

  async record({
    actor,
    action,
    targetType,
    targetId,
    before = null,
    after = null,
    createdAt = new Date().toISOString(),
  }) {
    const result = await this.pool.query(
      `INSERT INTO memories_admin_audit_log (
         actor, action, target_type, target_id,
         before_state, after_state, created_at
       ) VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7)
       RETURNING id, created_at`,
      [
        actor,
        action,
        targetType,
        targetId,
        before === null ? null : JSON.stringify(before),
        after === null ? null : JSON.stringify(after),
        createdAt,
      ],
    );
    return {
      id: result.rows[0].id,
      createdAt: new Date(result.rows[0].created_at).toISOString(),
    };
  }
}
