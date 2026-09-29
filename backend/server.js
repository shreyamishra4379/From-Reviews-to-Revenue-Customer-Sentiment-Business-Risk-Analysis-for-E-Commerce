import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse/sync';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Data paths
const DATA_DIR = path.join(__dirname, '..', 'data', 'processed');
const S4_DIR = path.join(DATA_DIR, 'stage4');
const RAW_DIR = path.join(__dirname, '..', 'data', 'raw');

// Utility to read JSON files
function readJson(filePath) {
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error.message);
    return null;
  }
}

// Utility to read CSV files
function readCsv(filePath) {
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    return parse(data, { columns: true, skip_empty_lines: true });
  } catch (error) {
    console.error(`Error reading CSV ${filePath}:`, error.message);
    return [];
  }
}

// Map table names to CSV files
const TABLE_CSV_MAP = {
  'nlp_reviews': path.join(DATA_DIR, 'nlp_reviews.parquet'), // parquet - use stage4 data
  'fact_orders': path.join(RAW_DIR, 'olist_orders_dataset.csv'),
  'fact_order_items': path.join(RAW_DIR, 'olist_order_items_dataset.csv'),
  'dim_products': path.join(RAW_DIR, 'olist_products_dataset.csv'),
  'dim_customers': path.join(RAW_DIR, 'olist_customers_dataset.csv'),
  'dim_sellers': path.join(RAW_DIR, 'olist_sellers_dataset.csv'),
  'dim_geolocation': path.join(RAW_DIR, 'olist_geolocation_dataset.csv'),
  'dim_payments': path.join(RAW_DIR, 'olist_order_payments_dataset.csv'),
  'fact_order_reviews': path.join(RAW_DIR, 'olist_order_reviews_dataset.csv'),
  // Stage 4 aggregated tables
  'agg_category': path.join(S4_DIR, 'agg_category.csv'),
  'agg_seller': path.join(S4_DIR, 'agg_seller.csv'),
  'agg_state': path.join(S4_DIR, 'agg_state.csv'),
  'agg_monthly': path.join(S4_DIR, 'agg_monthly.csv'),
  'agg_quarterly': path.join(S4_DIR, 'agg_quarterly.csv'),
  'business_prioritization': path.join(S4_DIR, 'business_prioritization.csv'),
  'complaint_matrix': path.join(S4_DIR, 'complaint_matrix.csv'),
};

// Load all CSV data into memory for SQL execution
let csvCache = {};
function loadAllCsvData() {
  console.log('[INFO] Loading CSV data for SQL execution...');
  for (const [table, csvPath] of Object.entries(TABLE_CSV_MAP)) {
    if (fs.existsSync(csvPath)) {
      try {
        const data = readCsv(csvPath);
        csvCache[table] = data;
        console.log(`[INFO] Loaded ${table}: ${data.length} rows`);
      } catch (e) {
        console.error(`[ERROR] Failed to load ${table}:`, e.message);
        csvCache[table] = [];
      }
    } else {
      csvCache[table] = [];
      console.log(`[WARN] CSV not found for ${table}: ${csvPath}`);
    }
  }
}

// Simple SQL parser for basic SELECT queries
function executeSqlOnCsv(query) {
  const upperQuery = query.trim().toUpperCase();
  
  // Only support SELECT queries
  if (!upperQuery.startsWith('SELECT')) {
    throw new Error('Only SELECT queries are supported in CSV fallback mode');
  }
  
  // Parse basic SELECT query
  // SELECT col1, col2 FROM table WHERE condition LIMIT n
  const selectMatch = query.match(/SELECT\s+(.+?)\s+FROM\s+(\w+)(\s+WHERE\s+(.+?))?(\s+LIMIT\s+(\d+))?$/i);
  if (!selectMatch) {
    throw new Error('Unsupported query format. Use: SELECT columns FROM table [WHERE condition] [LIMIT n]');
  }
  
  const [, columnsStr, tableName, , whereClause, , limitStr] = selectMatch;
  const limit = limitStr ? parseInt(limitStr) : null;
  
  // Get data for table
  const data = csvCache[tableName] || [];
  if (data.length === 0) {
    return [];
  }
  
  // Parse columns
  const columns = columnsStr.trim() === '*' ? null : columnsStr.split(',').map(c => c.trim());
  
  // Filter by WHERE clause (simple implementation)
  let filtered = data;
  if (whereClause) {
    filtered = data.filter(row => evaluateWhere(row, whereClause.trim()));
  }
  
  // Apply LIMIT
  if (limit && filtered.length > limit) {
    filtered = filtered.slice(0, limit);
  }
  
  // Select columns
  if (columns) {
    filtered = filtered.map(row => {
      const result = {};
      for (const col of columns) {
        result[col] = row[col];
      }
      return result;
    });
  }
  
  return filtered;
}

// Simple WHERE clause evaluator (supports =, !=, >, <, >=, <=, AND, OR)
function evaluateWhere(row, whereClause) {
  // This is a very basic implementation
  // For production, consider using a proper SQL parser
  try {
    // Replace column names with row['column'] and evaluate
    let expr = whereClause;
    
    // Handle string comparisons
    expr = expr.replace(/(\w+)\s*=\s*'([^']*)'/gi, (match, col, val) => {
      return `(row['${col}'] === '${val}')`;
    });
    expr = expr.replace(/(\w+)\s*!=\s*'([^']*)'/gi, (match, col, val) => {
      return `(row['${col}'] !== '${val}')`;
    });
    expr = expr.replace(/(\w+)\s*>\s*'([^']*)'/gi, (match, col, val) => {
      return `(row['${col}'] > '${val}')`;
    });
    expr = expr.replace(/(\w+)\s*<\s*'([^']*)'/gi, (match, col, val) => {
      return `(row['${col}'] < '${val}')`;
    });
    expr = expr.replace(/(\w+)\s*>=\s*'([^']*)'/gi, (match, col, val) => {
      return `(row['${col}'] >= '${val}')`;
    });
    expr = expr.replace(/(\w+)\s*<=\s*'([^']*)'/gi, (match, col, val) => {
      return `(row['${col}'] <= '${val}')`;
    });
    
    // Handle numeric comparisons
    expr = expr.replace(/(\w+)\s*=\s*([\d.]+)/gi, (match, col, val) => {
      return `(row['${col}'] == ${val})`;
    });
    expr = expr.replace(/(\w+)\s*!=\s*([\d.]+)/gi, (match, col, val) => {
      return `(row['${col}'] != ${val})`;
    });
    expr = expr.replace(/(\w+)\s*>\s*([\d.]+)/gi, (match, col, val) => {
      return `(row['${col}'] > ${val})`;
    });
    expr = expr.replace(/(\w+)\s*<\s*([\d.]+)/gi, (match, col, val) => {
      return `(row['${col}'] < ${val})`;
    });
    expr = expr.replace(/(\w+)\s*>=\s*([\d.]+)/gi, (match, col, val) => {
      return `(row['${col}'] >= ${val})`;
    });
    expr = expr.replace(/(\w+)\s*<=\s*([\d.]+)/gi, (match, col, val) => {
      return `(row['${col}'] <= ${val})`;
    });
    
    // Handle AND/OR
    expr = expr.replace(/\s+AND\s+/gi, ' && ');
    expr = expr.replace(/\s+OR\s+/gi, ' || ');
    
    // Create function and evaluate
    const fn = new Function('row', `return ${expr};`);
    return fn(row);
  } catch (e) {
    console.warn('WHERE clause evaluation failed:', e.message);
    return true; // If evaluation fails, include row
  }
}

// ============= API ROUTES =============

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get all NLP summary metrics
app.get('/api/nlp/metrics', (req, res) => {
  const metrics = readJson(path.join(DATA_DIR, 'nlp_summary_metrics.json'));
  if (!metrics) return res.status(404).json({ error: 'Metrics not found' });
  res.json(metrics);
});

// Get NLP topics
app.get('/api/nlp/topics', (req, res) => {
  const topics = readJson(path.join(DATA_DIR, 'nlp_topics.json'));
  if (!topics) return res.status(404).json({ error: 'Topics not found' });
  res.json(topics);
});

// Get NLP aspects
app.get('/api/nlp/aspects', (req, res) => {
  const aspects = readJson(path.join(DATA_DIR, 'nlp_aspects.json'));
  if (!aspects) return res.status(404).json({ error: 'Aspects not found' });
  res.json(aspects);
});

// Get Stage 4 metrics
app.get('/api/stage4/metrics', (req, res) => {
  const metrics = readJson(path.join(S4_DIR, 'stage4_metrics.json'));
  if (!metrics) return res.status(404).json({ error: 'Stage 4 metrics not found' });
  res.json(metrics);
});

// Get category aggregation
app.get('/api/agg/category', async (req, res) => {
  const data = readCsv(path.join(S4_DIR, 'agg_category.csv'));
  res.json(data);
});

// Get seller aggregation
app.get('/api/agg/seller', async (req, res) => {
  const data = readCsv(path.join(S4_DIR, 'agg_seller.csv'));
  res.json(data);
});

// Get state aggregation
app.get('/api/agg/state', async (req, res) => {
  const data = readCsv(path.join(S4_DIR, 'agg_state.csv'));
  res.json(data);
});

// Get monthly aggregation
app.get('/api/agg/monthly', async (req, res) => {
  const data = readCsv(path.join(S4_DIR, 'agg_monthly.csv'));
  res.json(data);
});

// Get quarterly aggregation
app.get('/api/agg/quarterly', async (req, res) => {
  const data = readCsv(path.join(S4_DIR, 'agg_quarterly.csv'));
  res.json(data);
});

// Get business prioritization
app.get('/api/business/prioritization', async (req, res) => {
  const data = readCsv(path.join(S4_DIR, 'business_prioritization.csv'));
  res.json(data);
});

// Get complaint matrix
app.get('/api/business/complaint-matrix', async (req, res) => {
  const data = readCsv(path.join(S4_DIR, 'complaint_matrix.csv'));
  res.json(data);
});

// Get review score distribution (from pre-computed JSON)
app.get('/api/reviews/score-distribution', async (req, res) => {
  try {
    const distPath = path.join(DATA_DIR, 'review_score_distribution.json');
    if (!fs.existsSync(distPath)) {
      return res.status(404).json({ error: 'Score distribution not found. Run create_score_dist.mjs first.' });
    }
    const data = readJson(distPath);
    res.json(data);
  } catch (error) {
    console.error('Error reading score distribution:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get SQL queries
app.get('/api/sql/queries', (req, res) => {
  const sqlDir = path.join(__dirname, '..', 'sql');
  try {
    const files = fs.readdirSync(sqlDir).filter(f => f.endsWith('.sql')).sort();
    const queries = files.map(f => ({
      filename: f,
      content: fs.readFileSync(path.join(sqlDir, f), 'utf-8')
    }));
    res.json(queries);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Execute SQL query - tries DuckDB first, falls back to CSV
app.post('/api/sql/execute', async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'Query required' });

  // Try DuckDB first
  try {
    const duckdb = await import('duckdb');
    const db = new duckdb.Database(':memory:');
    const conn = db.connect();

    // Register parquet files as views
    const tables = [
      'nlp_reviews',
      'fact_orders',
      'fact_order_items',
      'dim_products',
      'dim_customers',
      'dim_sellers'
    ];

    for (const tbl of tables) {
      const pqPath = path.join(DATA_DIR, `${tbl}.parquet`);
      if (fs.existsSync(pqPath)) {
        await new Promise((resolve, reject) => {
          conn.run(`CREATE VIEW ${tbl} AS SELECT * FROM read_parquet('${pqPath.replace(/\\/g, '/')}')`, (err) => {
            if (err) reject(err); else resolve();
          });
        });
      }
    }

    const result = await new Promise((resolve, reject) => {
      conn.all(query, (err, rows) => {
        if (err) reject(err); else resolve(rows);
      });
    });

    await new Promise((resolve, reject) => {
      conn.close((err) => err ? reject(err) : resolve());
    });

    res.json({ data: result, rowCount: result.length, engine: 'duckdb' });
    return;
  } catch (duckdbError) {
    console.log('[INFO] DuckDB not available, falling back to CSV engine:', duckdbError.message);
  }

  // Fallback to CSV-based execution
  try {
    const result = executeSqlOnCsv(query);
    res.json({ data: result, rowCount: result.length, engine: 'csv-fallback' });
  } catch (csvError) {
    console.error('CSV SQL execution failed:', csvError.message);
    res.status(500).json({ 
      error: csvError.message,
      hint: 'CSV fallback supports basic SELECT queries: SELECT columns FROM table [WHERE condition] [LIMIT n]'
    });
  }
});

// Start server
loadAllCsvData();
app.listen(PORT, () => {
  console.log(`🚀 Backend API running on http://localhost:${PORT}`);
  console.log(`📊 Data directory: ${DATA_DIR}`);
  console.log(`🔧 SQL Engine: CSV Fallback (DuckDB optional)`);
});