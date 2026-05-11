const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const tmpSqlPath = path.join(rootDir, '.tmp_schema_introspection.sql');
const markdownPath = path.join(rootDir, 'DATABASE_SCHEMA.md');
const mermaidPath = path.join(rootDir, 'DATABASE_SCHEMA_ERD.mmd');

const excludedSchemas = [
  'auth',
  'cron',
  'extensions',
  'graphql',
  'graphql_public',
  'information_schema',
  'net',
  'pgbouncer',
  'pg_catalog',
  'pg_toast',
  'pgsodium',
  'realtime',
  'storage',
  'supabase_functions',
  'supabase_migrations',
  'vault',
];

const sql = `
with app_schemas as (
  select n.oid, n.nspname as schema_name
  from pg_namespace n
  where n.nspname !~ '^pg_'
    and n.nspname <> all (${sqlArray(excludedSchemas)})
),
relations as (
  select
    ns.nspname as table_schema,
    cls.relname as table_name,
    case cls.relkind
      when 'r' then 'table'
      when 'p' then 'partitioned table'
      when 'v' then 'view'
      when 'm' then 'materialized view'
      when 'f' then 'foreign table'
      else cls.relkind::text
    end as relation_type,
    cls.relrowsecurity as rls_enabled,
    cls.relforcerowsecurity as rls_forced,
    obj_description(cls.oid, 'pg_class') as comment
  from pg_class cls
  join pg_namespace ns on ns.oid = cls.relnamespace
  join app_schemas app on app.oid = ns.oid
  where cls.relkind in ('r', 'p', 'v', 'm', 'f')
),
columns as (
  select
    ns.nspname as table_schema,
    cls.relname as table_name,
    att.attnum as ordinal_position,
    att.attname as column_name,
    pg_catalog.format_type(att.atttypid, att.atttypmod) as data_type,
    not att.attnotnull as is_nullable,
    pg_get_expr(def.adbin, def.adrelid) as column_default,
    case att.attidentity
      when 'a' then 'always'
      when 'd' then 'by default'
      else null
    end as identity_generation,
    case att.attgenerated
      when 's' then 'stored'
      else null
    end as generated_kind,
    col_description(att.attrelid, att.attnum) as comment
  from pg_attribute att
  join pg_class cls on cls.oid = att.attrelid
  join pg_namespace ns on ns.oid = cls.relnamespace
  join app_schemas app on app.oid = ns.oid
  left join pg_attrdef def on def.adrelid = att.attrelid and def.adnum = att.attnum
  where att.attnum > 0
    and not att.attisdropped
    and cls.relkind in ('r', 'p', 'v', 'm', 'f')
),
constraints as (
  select
    con.oid as constraint_oid,
    ns.nspname as table_schema,
    cls.relname as table_name,
    con.conname as constraint_name,
    case con.contype
      when 'p' then 'primary key'
      when 'u' then 'unique'
      when 'f' then 'foreign key'
      when 'c' then 'check'
      when 'x' then 'exclusion'
      else con.contype::text
    end as constraint_type,
    coalesce(
      array_agg(att.attname order by keys.ordinality) filter (where att.attname is not null),
      array[]::text[]
    ) as columns,
    pg_get_constraintdef(con.oid, true) as definition
  from pg_constraint con
  join pg_class cls on cls.oid = con.conrelid
  join pg_namespace ns on ns.oid = cls.relnamespace
  join app_schemas app on app.oid = ns.oid
  left join unnest(con.conkey) with ordinality as keys(attnum, ordinality) on true
  left join pg_attribute att on att.attrelid = cls.oid and att.attnum = keys.attnum
  where con.contype in ('p', 'u', 'c', 'x')
  group by con.oid, ns.nspname, cls.relname, con.conname, con.contype
),
foreign_keys as (
  select
    con.conname as constraint_name,
    src_ns.nspname as source_schema,
    src_cls.relname as source_table,
    array_agg(src_att.attname order by src_keys.ordinality) as source_columns,
    tgt_ns.nspname as target_schema,
    tgt_cls.relname as target_table,
    array_agg(tgt_att.attname order by src_keys.ordinality) as target_columns,
    case con.confupdtype
      when 'a' then 'no action'
      when 'r' then 'restrict'
      when 'c' then 'cascade'
      when 'n' then 'set null'
      when 'd' then 'set default'
    end as on_update,
    case con.confdeltype
      when 'a' then 'no action'
      when 'r' then 'restrict'
      when 'c' then 'cascade'
      when 'n' then 'set null'
      when 'd' then 'set default'
    end as on_delete,
    con.condeferrable as deferrable,
    con.condeferred as initially_deferred,
    pg_get_constraintdef(con.oid, true) as definition
  from pg_constraint con
  join pg_class src_cls on src_cls.oid = con.conrelid
  join pg_namespace src_ns on src_ns.oid = src_cls.relnamespace
  join app_schemas app on app.oid = src_ns.oid
  join pg_class tgt_cls on tgt_cls.oid = con.confrelid
  join pg_namespace tgt_ns on tgt_ns.oid = tgt_cls.relnamespace
  join unnest(con.conkey) with ordinality as src_keys(attnum, ordinality) on true
  join unnest(con.confkey) with ordinality as tgt_keys(attnum, ordinality)
    on tgt_keys.ordinality = src_keys.ordinality
  join pg_attribute src_att on src_att.attrelid = src_cls.oid and src_att.attnum = src_keys.attnum
  join pg_attribute tgt_att on tgt_att.attrelid = tgt_cls.oid and tgt_att.attnum = tgt_keys.attnum
  where con.contype = 'f'
  group by
    con.oid,
    con.conname,
    src_ns.nspname,
    src_cls.relname,
    tgt_ns.nspname,
    tgt_cls.relname,
    con.confupdtype,
    con.confdeltype,
    con.condeferrable,
    con.condeferred
),
indexes as (
  select
    ns.nspname as table_schema,
    tbl.relname as table_name,
    idx.relname as index_name,
    ix.indisunique as is_unique,
    ix.indisprimary as is_primary,
    ix.indisvalid as is_valid,
    pg_get_indexdef(ix.indexrelid) as definition
  from pg_index ix
  join pg_class tbl on tbl.oid = ix.indrelid
  join pg_namespace ns on ns.oid = tbl.relnamespace
  join app_schemas app on app.oid = ns.oid
  join pg_class idx on idx.oid = ix.indexrelid
),
policies as (
  select
    schemaname as table_schema,
    tablename as table_name,
    policyname as policy_name,
    permissive,
    roles,
    cmd,
    qual,
    with_check
  from pg_policies
  where schemaname in (select schema_name from app_schemas)
),
enum_types as (
  select
    ns.nspname as enum_schema,
    typ.typname as enum_name,
    array_agg(enum.enumlabel order by enum.enumsortorder) as values
  from pg_type typ
  join pg_namespace ns on ns.oid = typ.typnamespace
  join app_schemas app on app.oid = ns.oid
  join pg_enum enum on enum.enumtypid = typ.oid
  group by ns.nspname, typ.typname
)
select jsonb_build_object(
  'generated_at', now(),
  'schemas', coalesce((select jsonb_agg(schema_name order by schema_name) from app_schemas), '[]'::jsonb),
  'relations', coalesce((select jsonb_agg(to_jsonb(relations) order by table_schema, table_name) from relations), '[]'::jsonb),
  'columns', coalesce((select jsonb_agg(to_jsonb(columns) order by table_schema, table_name, ordinal_position) from columns), '[]'::jsonb),
  'constraints', coalesce((select jsonb_agg(to_jsonb(constraints) order by table_schema, table_name, constraint_name) from constraints), '[]'::jsonb),
  'foreign_keys', coalesce((select jsonb_agg(to_jsonb(foreign_keys) order by source_schema, source_table, constraint_name) from foreign_keys), '[]'::jsonb),
  'indexes', coalesce((select jsonb_agg(to_jsonb(indexes) order by table_schema, table_name, index_name) from indexes), '[]'::jsonb),
  'policies', coalesce((select jsonb_agg(to_jsonb(policies) order by table_schema, table_name, policy_name) from policies), '[]'::jsonb),
  'enum_types', coalesce((select jsonb_agg(to_jsonb(enum_types) order by enum_schema, enum_name) from enum_types), '[]'::jsonb)
) as schema_json;
`;

function sqlArray(values) {
  return `array[${values.map((value) => `'${value.replace(/'/g, "''")}'`).join(', ')}]`;
}

function extractJson(stdout) {
  const text = stdout.trim();

  try {
    return JSON.parse(text);
  } catch (_) {
    const start = text.indexOf('[');
    const end = text.lastIndexOf(']');

    if (start >= 0 && end > start) {
      return JSON.parse(text.slice(start, end + 1));
    }

    throw new Error(`Unable to parse Supabase CLI JSON output:\n${text}`);
  }
}

function runQuery() {
  fs.writeFileSync(tmpSqlPath, sql, 'utf8');

  try {
    const stdout = execFileSync(
      'cmd.exe',
      ['/c', 'npx', 'supabase', 'db', 'query', '--linked', '-f', tmpSqlPath, '-o', 'json', '--agent=no'],
      {
        cwd: rootDir,
        encoding: 'utf8',
        maxBuffer: 1024 * 1024 * 20,
      },
    );

    const rows = extractJson(stdout);
    if (!Array.isArray(rows) || rows.length === 0 || !rows[0].schema_json) {
      throw new Error(`Unexpected query result shape:\n${stdout}`);
    }

    return rows[0].schema_json;
  } finally {
    fs.rmSync(tmpSqlPath, { force: true });
  }
}

function readProjectRef() {
  const projectRefPath = path.join(rootDir, 'supabase', '.temp', 'project-ref');
  if (!fs.existsSync(projectRefPath)) {
    return null;
  }

  return fs.readFileSync(projectRefPath, 'utf8').trim() || null;
}

function keyFor(schema, table) {
  return `${schema}.${table}`;
}

function entityName(schema, table) {
  return `${schema}__${table}`.replace(/[^A-Za-z0-9_]/g, '_');
}

function identifier(name) {
  const safe = String(name).replace(/[^A-Za-z0-9_]/g, '_').replace(/^([0-9])/, '_$1');
  return safe || 'value';
}

function mermaidType(type) {
  return String(type || 'unknown')
    .replace(/\[\]/g, '_array')
    .replace(/[^A-Za-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '') || 'unknown';
}

function mdEscape(value) {
  return String(value ?? '')
    .replace(/\r?\n/g, '<br>')
    .replace(/\|/g, '\\|');
}

function list(value) {
  return Array.isArray(value) ? value.join(', ') : '';
}

function formatDefault(value) {
  if (value == null) {
    return '';
  }

  const text = String(value);
  return text.length > 90 ? `${text.slice(0, 87)}...` : text;
}

function groupBy(items, getKey) {
  const grouped = new Map();

  for (const item of items) {
    const groupKey = getKey(item);
    if (!grouped.has(groupKey)) {
      grouped.set(groupKey, []);
    }
    grouped.get(groupKey).push(item);
  }

  return grouped;
}

function getColumnBadges(tableKey, columnName, primaryKeys, uniqueColumns, foreignKeysBySourceColumn) {
  const badges = [];

  if (primaryKeys.get(tableKey)?.has(columnName)) {
    badges.push('PK');
  }

  if (uniqueColumns.get(tableKey)?.has(columnName)) {
    badges.push('UNIQUE');
  }

  for (const fk of foreignKeysBySourceColumn.get(`${tableKey}.${columnName}`) || []) {
    badges.push(`FK -> ${fk.target_schema}.${fk.target_table}(${list(fk.target_columns)})`);
  }

  return badges.join(', ');
}

function buildDerivedMaps(payload) {
  const primaryKeys = new Map();
  const uniqueColumns = new Map();
  const foreignKeysBySourceColumn = new Map();

  for (const constraint of payload.constraints) {
    const tableKey = keyFor(constraint.table_schema, constraint.table_name);
    if (constraint.constraint_type === 'primary key') {
      primaryKeys.set(tableKey, new Set(constraint.columns || []));
    }

    if (constraint.constraint_type === 'unique') {
      if (!uniqueColumns.has(tableKey)) {
        uniqueColumns.set(tableKey, new Set());
      }
      for (const column of constraint.columns || []) {
        uniqueColumns.get(tableKey).add(column);
      }
    }
  }

  for (const fk of payload.foreign_keys) {
    const tableKey = keyFor(fk.source_schema, fk.source_table);
    for (const column of fk.source_columns || []) {
      const columnKey = `${tableKey}.${column}`;
      if (!foreignKeysBySourceColumn.has(columnKey)) {
        foreignKeysBySourceColumn.set(columnKey, []);
      }
      foreignKeysBySourceColumn.get(columnKey).push(fk);
    }
  }

  return { primaryKeys, uniqueColumns, foreignKeysBySourceColumn };
}

function buildMermaid(payload, derived) {
  const lines = ['erDiagram'];
  const relations = payload.relations.filter((relation) => relation.relation_type.includes('table'));
  const relationKeys = new Set(relations.map((relation) => keyFor(relation.table_schema, relation.table_name)));
  const columnsByTable = groupBy(payload.columns, (column) => keyFor(column.table_schema, column.table_name));
  const externalEntities = new Map();

  for (const fk of payload.foreign_keys) {
    const targetKey = keyFor(fk.target_schema, fk.target_table);
    if (!relationKeys.has(targetKey)) {
      externalEntities.set(targetKey, {
        schema: fk.target_schema,
        table: fk.target_table,
        columns: fk.target_columns || [],
      });
    }
  }

  for (const relation of relations) {
    const tableKey = keyFor(relation.table_schema, relation.table_name);
    lines.push(`  ${entityName(relation.table_schema, relation.table_name)} {`);

    for (const column of columnsByTable.get(tableKey) || []) {
      const badges = [];
      if (derived.primaryKeys.get(tableKey)?.has(column.column_name)) {
        badges.push('PK');
      }
      if (derived.foreignKeysBySourceColumn.has(`${tableKey}.${column.column_name}`)) {
        badges.push('FK');
      }
      const suffix = badges.length ? ` "${badges.join(', ')}"` : '';
      lines.push(`    ${mermaidType(column.data_type)} ${identifier(column.column_name)}${suffix}`);
    }

    lines.push('  }');
  }

  for (const external of externalEntities.values()) {
    lines.push(`  ${entityName(external.schema, external.table)} {`);
    for (const column of external.columns) {
      lines.push(`    unknown ${identifier(column)} "referenced"`);
    }
    lines.push('  }');
  }

  for (const fk of payload.foreign_keys) {
    const sourceKey = keyFor(fk.source_schema, fk.source_table);
    const sourceHasUnique = payload.constraints.some((constraint) => (
      constraint.table_schema === fk.source_schema
      && constraint.table_name === fk.source_table
      && ['primary key', 'unique'].includes(constraint.constraint_type)
      && sameSet(constraint.columns || [], fk.source_columns || [])
    ));
    const rightCardinality = sourceHasUnique ? 'o|' : 'o{';
    lines.push(
      `  ${entityName(fk.target_schema, fk.target_table)} ||--${rightCardinality} ${entityName(fk.source_schema, fk.source_table)} : "${fk.constraint_name}"`,
    );
    relationKeys.add(sourceKey);
  }

  return `${lines.join('\n')}\n`;
}

function sameSet(left, right) {
  if (left.length !== right.length) {
    return false;
  }

  const rightSet = new Set(right);
  return left.every((value) => rightSet.has(value));
}

function buildMarkdown(payload, projectRef, mermaid) {
  const derived = buildDerivedMaps(payload);
  const relations = payload.relations;
  const tables = relations.filter((relation) => relation.relation_type.includes('table'));
  const views = relations.filter((relation) => relation.relation_type.includes('view'));
  const columnsByTable = groupBy(payload.columns, (column) => keyFor(column.table_schema, column.table_name));
  const constraintsByTable = groupBy(payload.constraints, (constraint) => keyFor(constraint.table_schema, constraint.table_name));
  const indexesByTable = groupBy(payload.indexes, (index) => keyFor(index.table_schema, index.table_name));
  const policiesByTable = groupBy(payload.policies, (policy) => keyFor(policy.table_schema, policy.table_name));

  const lines = [];
  lines.push('# Supabase Database Schema');
  lines.push('');
  lines.push(`Generated: ${payload.generated_at}`);
  if (projectRef) {
    lines.push(`Project ref: \`${projectRef}\``);
  }
  lines.push(`Schemas: ${payload.schemas.map((schema) => `\`${schema}\``).join(', ') || '_none_'}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Tables: ${tables.length}`);
  lines.push(`- Views: ${views.length}`);
  lines.push(`- Foreign keys: ${payload.foreign_keys.length}`);
  lines.push(`- Indexes: ${payload.indexes.length}`);
  lines.push(`- RLS policies: ${payload.policies.length}`);
  lines.push('');
  lines.push('## Entity Relationship Diagram');
  lines.push('');
  lines.push('```mermaid');
  lines.push(mermaid.trimEnd());
  lines.push('```');
  lines.push('');

  if (payload.enum_types.length > 0) {
    lines.push('## Enum Types');
    lines.push('');
    lines.push('| Enum | Values |');
    lines.push('| --- | --- |');
    for (const enumType of payload.enum_types) {
      lines.push(`| \`${enumType.enum_schema}.${enumType.enum_name}\` | ${mdEscape(list(enumType.values))} |`);
    }
    lines.push('');
  }

  lines.push('## Tables');
  lines.push('');

  for (const table of tables) {
    const tableKey = keyFor(table.table_schema, table.table_name);
    lines.push(`### ${tableKey}`);
    lines.push('');
    lines.push(`Type: ${table.relation_type}`);
    lines.push(`RLS: ${table.rls_enabled ? 'enabled' : 'disabled'}${table.rls_forced ? ', forced' : ''}`);
    if (table.comment) {
      lines.push(`Comment: ${mdEscape(table.comment)}`);
    }
    lines.push('');
    lines.push('| Column | Type | Nullable | Default | Key | Comment |');
    lines.push('| --- | --- | --- | --- | --- | --- |');

    for (const column of columnsByTable.get(tableKey) || []) {
      const nullable = column.is_nullable ? 'yes' : 'no';
      const badges = getColumnBadges(
        tableKey,
        column.column_name,
        derived.primaryKeys,
        derived.uniqueColumns,
        derived.foreignKeysBySourceColumn,
      );
      lines.push(
        `| \`${mdEscape(column.column_name)}\` | \`${mdEscape(column.data_type)}\` | ${nullable} | ${mdEscape(formatDefault(column.column_default))} | ${mdEscape(badges)} | ${mdEscape(column.comment)} |`,
      );
    }

    const constraints = constraintsByTable.get(tableKey) || [];
    if (constraints.length > 0) {
      lines.push('');
      lines.push('Constraints:');
      for (const constraint of constraints) {
        lines.push(`- \`${constraint.constraint_name}\` (${constraint.constraint_type}): ${mdEscape(constraint.definition)}`);
      }
    }

    const indexes = indexesByTable.get(tableKey) || [];
    if (indexes.length > 0) {
      lines.push('');
      lines.push('Indexes:');
      for (const index of indexes) {
        const flags = [
          index.is_primary ? 'primary' : null,
          index.is_unique ? 'unique' : null,
          index.is_valid ? null : 'invalid',
        ].filter(Boolean);
        lines.push(`- \`${index.index_name}\`${flags.length ? ` (${flags.join(', ')})` : ''}: ${mdEscape(index.definition)}`);
      }
    }

    const policies = policiesByTable.get(tableKey) || [];
    if (policies.length > 0) {
      lines.push('');
      lines.push('RLS policies:');
      for (const policy of policies) {
        lines.push(`- \`${policy.policy_name}\` ${policy.cmd} to ${list(policy.roles) || 'public'} (${policy.permissive})`);
      }
    }

    lines.push('');
  }

  if (views.length > 0) {
    lines.push('## Views');
    lines.push('');
    for (const view of views) {
      const tableKey = keyFor(view.table_schema, view.table_name);
      lines.push(`### ${tableKey}`);
      lines.push('');
      lines.push('| Column | Type | Nullable | Comment |');
      lines.push('| --- | --- | --- | --- |');
      for (const column of columnsByTable.get(tableKey) || []) {
        lines.push(`| \`${mdEscape(column.column_name)}\` | \`${mdEscape(column.data_type)}\` | ${column.is_nullable ? 'yes' : 'no'} | ${mdEscape(column.comment)} |`);
      }
      lines.push('');
    }
  }

  lines.push('## Foreign Keys');
  lines.push('');
  if (payload.foreign_keys.length === 0) {
    lines.push('_No foreign keys found._');
  } else {
    lines.push('| Constraint | Source | Target | On update | On delete |');
    lines.push('| --- | --- | --- | --- | --- |');
    for (const fk of payload.foreign_keys) {
      lines.push(
        `| \`${fk.constraint_name}\` | \`${fk.source_schema}.${fk.source_table}(${list(fk.source_columns)})\` | \`${fk.target_schema}.${fk.target_table}(${list(fk.target_columns)})\` | ${fk.on_update} | ${fk.on_delete} |`,
      );
    }
  }
  lines.push('');

  return `${lines.join('\n')}\n`;
}

function main() {
  const payload = runQuery();
  const projectRef = readProjectRef();
  const derived = buildDerivedMaps(payload);
  const mermaid = buildMermaid(payload, derived);
  const markdown = buildMarkdown(payload, projectRef, mermaid);

  fs.writeFileSync(markdownPath, markdown, 'utf8');
  fs.writeFileSync(mermaidPath, mermaid, 'utf8');

  console.log(`Wrote ${path.relative(rootDir, markdownPath)}`);
  console.log(`Wrote ${path.relative(rootDir, mermaidPath)}`);
  console.log(`Tables: ${payload.relations.filter((relation) => relation.relation_type.includes('table')).length}`);
  console.log(`Views: ${payload.relations.filter((relation) => relation.relation_type.includes('view')).length}`);
  console.log(`Foreign keys: ${payload.foreign_keys.length}`);
}

main();
