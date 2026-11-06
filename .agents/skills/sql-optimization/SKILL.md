---
name: sql-optimization
description: 'Universal SQL performance optimization assistant for comprehensive query tuning, indexing strategies, and database performance analysis across all SQL databases (MySQL, PostgreSQL, SQL Server, Oracle). Provides execution plan analysis, pagination optimization, batch operations, and performance monitoring guidance.'
---

# SQL Performance Optimization Assistant

Expert SQL performance optimization for ${selection} (or entire project if no selection). Focus on universal SQL optimization techniques that work across MySQL, PostgreSQL, SQL Server, Oracle, and other SQL databases.

## 🎯 Core Optimization Areas

### Query Performance Analysis
```sql
-- ❌ BAD: Inefficient query patterns
SELECT * FROM orders o
WHERE YEAR(o.created_at) = 2024
  AND o.customer_id IN (
      SELECT c.id FROM customers c WHERE c.status = 'active'
  );

-- ✅ GOOD: Optimized query with proper indexing hints
SELECT o.id, o.customer_id, o.total_amount, o.created_at
FROM orders o
INNER JOIN customers c ON o.customer_id = c.id
WHERE o.created_at >= '2024-01-01' 
  AND o.created_at < '2025-01-01'
  AND c.status = 'active';

-- Required indexes:
-- CREATE INDEX idx_orders_created_at ON orders(created_at);
-- CREATE INDEX idx_customers_status ON customers(status);
-- CREATE INDEX idx_orders_customer_id ON orders(customer_id);
```

### Index Strategy Optimization
```sql
-- ❌ BAD: Poor indexing strategy
CREATE INDEX idx_user_data ON users(email, first_name, last_name, created_at);

-- ✅ GOOD: Optimized composite indexing
-- For queries filtering by email first, then sorting by created_at
CREATE INDEX idx_users_email_created ON users(email, created_at);

-- For full-text name searches
CREATE INDEX idx_users_name ON users(last_name, first_name);

-- For user status queries
CREATE INDEX idx_users_status_created ON users(status, created_at)
WHERE status IS NOT NULL;
```

### Subquery Optimization
```sql
-- ❌ BAD: Correlated subquery
SELECT p.product_name, p.price
FROM products p
WHERE p.price > (
    SELECT AVG(price) 
    FROM products p2 
    WHERE p2.category_id = p.category_id
);

-- ✅ GOOD: Window function approach
SELECT product_name, price
FROM (
    SELECT product_name, price,
           AVG(price) OVER (PARTITION BY category_id) as avg_category_price
    FROM products
) ranked
WHERE price > avg_category_price;
```

## 📊 Performance Tuning Techniques

### JOIN Optimization
```sql
-- ❌ BAD: Inefficient JOIN order and conditions
SELECT o.*, c.name, p.product_name
FROM orders o
LEFT JOIN customers c ON o.customer_id = c.id
LEFT JOIN order_items oi ON o.id = oi.order_id
LEFT JOIN products p ON oi.product_id = p.id
WHERE o.created_at > '2024-01-01'
  AND c.status = 'active';

-- ✅ GOOD: Optimized JOIN with filtering
SELECT o.id, o.total_amount, c.name, p.product_name
FROM orders o
INNER JOIN customers c ON o.customer_id = c.id AND c.status = 'active'
INNER JOIN order_items oi ON o.id = oi.order_id
INNER JOIN products p ON oi.product_id = p.id
WHERE o.created_at > '2024-01-01';
```

### Pagination Optimization
```sql
-- ❌ BAD: OFFSET-based pagination (slow for large offsets)
SELECT * FROM products 
ORDER BY created_at DESC 
LIMIT 20 OFFSET 10000;

-- ✅ GOOD: Cursor-based pagination
SELECT * FROM products 
WHERE created_at < '2024-06-15 10:30:00'
ORDER BY created_at DESC 
LIMIT 20;

-- Or using ID-based cursor
SELECT * FROM products 
WHERE id > 1000
ORDER BY id 
LIMIT 20;
```

### Aggregation Optimization
```sql
-- ❌ BAD: Multiple separate aggregation queries
SELECT COUNT(*) FROM orders WHERE status = 'pending';
SELECT COUNT(*) FROM orders WHERE status = 'shipped';
SELECT COUNT(*) FROM orders WHERE status = 'delivered';

-- ✅ GOOD: Single query with conditional aggregation
SELECT 
    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
    COUNT(CASE WHEN status = 'shipped' THEN 1 END) as shipped_count,
    COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered_count
FROM orders;
```

## 🔍 Query Anti-Patterns

### SELECT Performance Issues
```sql
-- ❌ BAD: SELECT * anti-pattern
SELECT * FROM large_table lt
JOIN another_table at ON lt.id = at.ref_id;

-- ✅ GOOD: Explicit column selection
SELECT lt.id, lt.name, at.value
FROM large_table lt
JOIN another_table at ON lt.id = at.ref_id;
```

### WHERE Clause Optimization
```sql
-- ❌ BAD: Function calls in WHERE clause
SELECT * FROM orders 
WHERE UPPER(customer_email) = 'JOHN@EXAMPLE.COM';

-- ✅ GOOD: Index-friendly WHERE clause
SELECT * FROM orders 
WHERE customer_email = 'john@example.com';
-- Consider: CREATE INDEX idx_orders_email ON orders(LOWER(customer_email));
```

### OR vs UNION Optimization
```sql
-- ❌ BAD: Complex OR conditions
SELECT * FROM products 
WHERE (category = 'electronics' AND price < 1000)
   OR (category = 'books' AND price < 50);

-- ✅ GOOD: UNION approach for better optimization
SELECT * FROM products WHERE category = 'electronics' AND price < 1000
UNION ALL
SELECT * FROM products WHERE category = 'books' AND price < 50;
```

## 📈 Database-Agnostic Optimization

### Batch Operations
```sql
-- ❌ BAD: Row-by-row operations
INSERT INTO products (name, price) VALUES ('Product 1', 10.00);
INSERT INTO products (name, price) VALUES ('Product 2', 15.00);
INSERT INTO products (name, price) VALUES ('Product 3', 20.00);

-- ✅ GOOD: Batch insert
INSERT INTO products (name, price) VALUES 
('Product 1', 10.00),
('Product 2', 15.00),
('Product 3', 20.00);
```

### Temporary Table Usage
```sql
-- ✅ GOOD: Using temporary tables for complex operations
CREATE TEMPORARY TABLE temp_calculations AS
SELECT customer_id, 
       SUM(total_amount) as total_spent,
       COUNT(*) as order_count
FROM orders 
WHERE created_at >= '2024-01-01'
GROUP BY customer_id;

-- Use the temp table for further calculations
SELECT c.name, tc.total_spent, tc.order_count
FROM temp_calculations tc
JOIN customers c ON tc.customer_id = c.id
WHERE tc.total_spent > 1000;
```

## 🛠️ Index Management

### Index Design Principles
```sql
-- ✅ GOOD: Covering index design
CREATE INDEX idx_orders_covering 
ON orders(customer_id, created_at) 
INCLUDE (total_amount, status);  -- SQL Server syntax
-- Or: CREATE INDEX idx_orders_covering ON orders(customer_id, created_at, total_amount, status); -- Other databases
```

### Partial Index Strategy
```sql
-- ✅ GOOD: Partial indexes for specific conditions
CREATE INDEX idx_orders_active 
ON orders(created_at) 
WHERE status IN ('pending', 'processing');
```

## 🚀 High-Concurrency PostgreSQL & Supabase (10k+ CCU) Patterns

### 1. RLS `InitPlan` Optimization (Per-Query vs Per-Row Auth Evaluation)
```sql
-- ❌ BAD: Bare auth.uid() / helper calls are re-evaluated for EVERY scanned row
CREATE POLICY "campaigns_select" ON public.campaigns
FOR SELECT USING (is_public = true OR auth.uid() = user_id);

-- ✅ GOOD: Scalar sub-SELECT forces PostgreSQL to evaluate once per query (InitPlan)
CREATE POLICY "campaigns_select" ON public.campaigns
FOR SELECT USING (is_public = true OR (SELECT auth.uid()) = user_id);
```

### 2. Avoid Cross-Table `COALESCE` in `ORDER BY` (Index-Driven Fallback CTEs)
```sql
-- ❌ BAD: ORDER BY spans LEFT JOINed tables with COALESCE -> forces Full Table Scan + Sort
SELECT p.id, p.display_name
FROM public.profiles p
LEFT JOIN public.study_daily sd ON sd.user_id = p.id AND sd.study_date = CURRENT_DATE - 1
ORDER BY COALESCE(sd.seconds, 0) DESC, p.exp DESC
LIMIT 50;

-- ✅ GOOD: Split into index-backed CTE branches so each branch uses a pure B-Tree Index Scan
WITH yesterday_top AS (
  SELECT p.id, p.display_name, 1 AS bucket, sd.seconds AS sort_val
  FROM public.study_daily sd
  INNER JOIN public.profiles p ON p.id = sd.user_id
  WHERE sd.study_date = CURRENT_DATE - 1 AND sd.seconds >= 60
  ORDER BY sd.seconds DESC, sd.updated_at ASC
  LIMIT 50
),
alltime_fallback AS (
  SELECT p.id, p.display_name, 2 AS bucket, p.exp AS sort_val
  FROM public.profiles p
  WHERE NOT EXISTS (SELECT 1 FROM yesterday_top y WHERE y.id = p.id)
  ORDER BY p.exp DESC, p.study_seconds DESC
  LIMIT GREATEST(0, 50 - (SELECT count(*)::int FROM yesterday_top))
)
SELECT * FROM yesterday_top
UNION ALL
SELECT * FROM alltime_fallback;
```

### 3. HOT (Heap-Only Tuple) Updates for High-Frequency Heartbeat Tables
```sql
-- ✅ GOOD: Leave 10-20% free space per 8KB page on tables updated every 30-60s by 10k users
-- Prevents index bloat and page splits when updating non-indexed heartbeat/counter columns
ALTER TABLE public.study_sessions SET (fillfactor = 80);
ALTER TABLE public.study_daily    SET (fillfactor = 80);
ALTER TABLE public.profiles       SET (fillfactor = 90);
```

### 4. Short-Circuit `SECURITY DEFINER` Checks in `BEFORE UPDATE` Triggers
```sql
-- ❌ BAD: Calling is_admin(auth.uid()) before checking if protected columns actually changed
IF NOT public.is_admin(auth.uid()) THEN
  IF NEW.role IS DISTINCT FROM OLD.role THEN RAISE EXCEPTION 'Forbidden'; END IF;
END IF;

-- ✅ GOOD: Check column diff FIRST; only execute is_admin() query when a protected field changed
IF (NEW.role IS DISTINCT FROM OLD.role OR NEW.is_vip IS DISTINCT FROM OLD.is_vip)
   AND NOT public.is_admin(auth.uid()) THEN
  RAISE EXCEPTION 'Forbidden';
END IF;
```

### 5. Scoped Server-Side Aggregation RPC Instead of Client-Side Full-Table Counting
```sql
-- ❌ BAD: Fetching all rows to count in JS (hits PostgREST 1000-row cap & wastes bandwidth)
-- supabase.from('campaigns').select('user_id').eq('is_completed', true)

-- ✅ GOOD: Index-Only Scan aggregation scoped to visible user IDs
CREATE INDEX IF NOT EXISTS idx_campaigns_completed_by_user
  ON public.campaigns (user_id) WHERE is_completed = true;

CREATE OR REPLACE FUNCTION public.get_completed_campaign_counts(p_user_ids uuid[])
RETURNS TABLE (user_id uuid, completed_count integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.user_id, COUNT(*)::integer AS completed_count
  FROM public.campaigns c
  WHERE c.is_completed = true
    AND c.user_id = ANY(p_user_ids)
  GROUP BY c.user_id;
$$;
```

## 📊 Performance Monitoring Queries

### Query Performance Analysis
```sql
-- Generic approach to identify slow queries
-- (Specific syntax varies by database)

-- For MySQL:
SELECT query_time, lock_time, rows_sent, rows_examined, sql_text
FROM mysql.slow_log
ORDER BY query_time DESC;

-- For PostgreSQL:
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
ORDER BY total_time DESC;

-- For SQL Server:
SELECT 
    qs.total_elapsed_time/qs.execution_count as avg_elapsed_time,
    qs.execution_count,
    SUBSTRING(qt.text, (qs.statement_start_offset/2)+1,
        ((CASE qs.statement_end_offset WHEN -1 THEN DATALENGTH(qt.text)
        ELSE qs.statement_end_offset END - qs.statement_start_offset)/2)+1) as query_text
FROM sys.dm_exec_query_stats qs
CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) qt
ORDER BY avg_elapsed_time DESC;
```

## 🎯 Universal Optimization Checklist

### Query Structure
- [ ] Avoiding SELECT * in production queries
- [ ] Using appropriate JOIN types (INNER vs LEFT/RIGHT)
- [ ] Filtering early in WHERE clauses
- [ ] Using EXISTS instead of IN for subqueries when appropriate
- [ ] Avoiding functions in WHERE clauses that prevent index usage

### Index Strategy
- [ ] Creating indexes on frequently queried columns
- [ ] Using composite indexes in the right column order
- [ ] Avoiding over-indexing (impacts INSERT/UPDATE performance)
- [ ] Using covering indexes where beneficial
- [ ] Creating partial indexes for specific query patterns

### Data Types and Schema
- [ ] Using appropriate data types for storage efficiency
- [ ] Normalizing appropriately (3NF for OLTP, denormalized for OLAP)
- [ ] Using constraints to help query optimizer
- [ ] Partitioning large tables when appropriate

### Query Patterns
- [ ] Using LIMIT/TOP for result set control
- [ ] Implementing efficient pagination strategies
- [ ] Using batch operations for bulk data changes
- [ ] Avoiding N+1 query problems
- [ ] Using prepared statements for repeated queries

### Performance Testing
- [ ] Testing queries with realistic data volumes
- [ ] Analyzing query execution plans
- [ ] Monitoring query performance over time
- [ ] Setting up alerts for slow queries
- [ ] Regular index usage analysis

## 📝 Optimization Methodology

1. **Identify**: Use database-specific tools to find slow queries
2. **Analyze**: Examine execution plans and identify bottlenecks
3. **Optimize**: Apply appropriate optimization techniques
4. **Test**: Verify performance improvements
5. **Monitor**: Continuously track performance metrics
6. **Iterate**: Regular performance review and optimization

Focus on measurable performance improvements and always test optimizations with realistic data volumes and query patterns.
