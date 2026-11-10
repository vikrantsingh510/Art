import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const backend = join(dirname(fileURLToPath(import.meta.url)), '..');
const sql = readFileSync(join(backend, 'src/db/migrations/0005_security_hardening.sql'), 'utf8');
const zero = readFileSync(join(backend, 'src/db/migrations/0000_phase1_identity_gallery.sql'), 'utf8');
const failures = [];

if ((sql.match(/^CREATE POLICY /gm) || []).length !== 74) {
  failures.push(`expected 74 CREATE POLICY, got ${(sql.match(/^CREATE POLICY /gm) || []).length}`);
}
if ((sql.match(/ENABLE ROW LEVEL SECURITY;/g) || []).length !== 22) {
  failures.push('expected 22 ENABLE ROW LEVEL SECURITY');
}
if (!sql.includes('prevent_audit_logs_mutation')) failures.push('audit trigger function missing');
if (!sql.includes('CREATE ROLE maison_app')) failures.push('CREATE ROLE missing');
if (!/^[\s\S]*IF NOT FOUND THEN\s*CREATE ROLE maison_app/m.test(sql)) {
  failures.push('CREATE ROLE is not gated on IF NOT FOUND');
}
if (/^\s*ALTER ROLE\b/m.test(sql)) failures.push('ALTER ROLE must not be present');
if (!sql.includes('RAISE EXCEPTION')) failures.push('missing RAISE EXCEPTION on attribute mismatch');
if (!sql.includes('Refusing to ALTER ROLE')) failures.push('exception must refuse silent ALTER ROLE');
for (const column of ['rolsuper', 'rolcreatedb', 'rolcreaterole', 'rolreplication', 'rolinherit', 'rolbypassrls', 'rolcanlogin']) {
  if (!sql.includes(column)) failures.push(`missing pg_roles column ${column}`);
}
for (const attr of ['NOSUPERUSER', 'NOCREATEDB', 'NOCREATEROLE', 'NOREPLICATION', 'NOINHERIT', 'NOBYPASSRLS', 'NOLOGIN']) {
  if (!sql.includes(`violations := violations || '${attr}'`)) {
    failures.push(`missing violation check for ${attr}`);
  }
}

if (!sql.includes('pg_catalog.pg_auth_members')) {
  failures.push('missing pg_catalog.pg_auth_members membership inspection');
}
if (!/WHERE\s+member\.rolname\s*=\s*'maison_app'/.test(sql)) {
  failures.push('membership check must inspect rows where maison_app is the member');
}
if (!sql.includes('is a member of other role')) {
  failures.push('missing exception when maison_app belongs to another role');
}
if (!sql.includes('Refusing to REVOKE memberships')) {
  failures.push('membership exception must refuse silent REVOKE');
}
if (/GRANT\s+[A-Za-z_][A-Za-z0-9_]*\s+TO\s+maison_app\b/.test(sql)) {
  failures.push('must not GRANT role membership to maison_app');
}
if (/REVOKE\s+[A-Za-z_][A-Za-z0-9_]*\s+FROM\s+maison_app\b/.test(sql)) {
  failures.push('must not REVOKE role memberships from maison_app');
}

if (/PASSWORD\s*'/.test(sql)) failures.push('password literal in 0005');
if (!zero.includes('REFERENCES "auth"."users"("id") ON DELETE cascade')) {
  failures.push('0000 Auth FK missing or weakened');
}

if (failures.length) {
  console.error('FAIL');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('PASS 0005 security static checks');
console.log('- seven attribute checks preserved');
console.log('- pg_auth_members membership validation present');
console.log('- 74 policies, 22 RLS enables, audit trigger, Auth FK preserved');
