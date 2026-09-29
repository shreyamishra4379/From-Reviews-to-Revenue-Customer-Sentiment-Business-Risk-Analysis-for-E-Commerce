import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

const DATA_DIR = path.join(process.cwd(), 'data', 'processed');
const S4_DIR = path.join(DATA_DIR, 'stage4');
const RAW_DIR = path.join(process.cwd(), 'data', 'raw');

export function readJson(filePath: string): any {
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export function readCsv(filePath: string): any[] {
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    return parse(data, { columns: true, skip_empty_lines: true });
  } catch {
    return [];
  }
}

const TABLE_CSV_MAP: Record<string, string> = {
  fact_orders: path.join(RAW_DIR, 'olist_orders_dataset.csv'),
  fact_order_items: path.join(RAW_DIR, 'olist_order_items_dataset.csv'),
  dim_products: path.join(RAW_DIR, 'olist_products_dataset.csv'),
  dim_customers: path.join(RAW_DIR, 'olist_customers_dataset.csv'),
  dim_sellers: path.join(RAW_DIR, 'olist_sellers_dataset.csv'),
  dim_geolocation: path.join(RAW_DIR, 'olist_geolocation_dataset.csv'),
  dim_payments: path.join(RAW_DIR, 'olist_order_payments_dataset.csv'),
  fact_order_reviews: path.join(RAW_DIR, 'olist_order_reviews_dataset.csv'),
  agg_category: path.join(S4_DIR, 'agg_category.csv'),
  agg_seller: path.join(S4_DIR, 'agg_seller.csv'),
  agg_state: path.join(S4_DIR, 'agg_state.csv'),
  agg_monthly: path.join(S4_DIR, 'agg_monthly.csv'),
  agg_quarterly: path.join(S4_DIR, 'agg_quarterly.csv'),
  business_prioritization: path.join(S4_DIR, 'business_prioritization.csv'),
  complaint_matrix: path.join(S4_DIR, 'complaint_matrix.csv'),
};

let csvCache: Record<string, any[]> = {};

export function loadAllCsvData(): void {
  for (const [table, csvPath] of Object.entries(TABLE_CSV_MAP)) {
    if (fs.existsSync(csvPath)) {
      try {
        csvCache[table] = readCsv(csvPath);
      } catch {
        csvCache[table] = [];
      }
    } else {
      csvCache[table] = [];
    }
  }
}

export function getTableData(tableName: string): any[] {
  return csvCache[tableName] || [];
}

export function executeSql(query: string): { data: any[]; rowCount: number; engine: string } {
  const trimmed = query.trim();
  const upperQuery = trimmed.toUpperCase();

  if (!upperQuery.startsWith('SELECT')) {
    throw new Error('Only SELECT queries are supported');
  }

  const selectMatch = trimmed.match(/SELECT\s+(.+?)\s+FROM\s+(\w+)(\s+WHERE\s+(.+?))?(\s+LIMIT\s+(\d+))?$/i);
  if (!selectMatch) {
    throw new Error('Unsupported query format. Use: SELECT columns FROM table [WHERE condition] [LIMIT n]');
  }

  const [, columnsStr, tableName, , whereClause, , limitStr] = selectMatch;
  const limit = limitStr ? parseInt(limitStr) : null;
  const data = getTableData(tableName);

  if (!data.length) {
    return { data: [], rowCount: 0, engine: 'csv' };
  }

  const columns = columnsStr.trim() === '*' ? null : columnsStr.split(',').map(c => c.trim());

  let filtered = data;
  if (whereClause) {
    filtered = data.filter(row => evaluateWhere(row, whereClause.trim()));
  }

  if (limit && filtered.length > limit) {
    filtered = filtered.slice(0, limit);
  }

  if (columns) {
    filtered = filtered.map(row => {
      const result: Record<string, any> = {};
      for (const col of columns) {
        result[col] = row[col];
      }
      return result;
    });
  }

  return { data: filtered, rowCount: filtered.length, engine: 'csv' };
}

function evaluateWhere(row: Record<string, any>, whereClause: string): boolean {
  try {
    let expr = whereClause;

    expr = expr.replace(/(\w+)\s*=\s*'([^']*)'/gi, (_, col, val) => `(row['${col}'] === '${val}')`);
    expr = expr.replace(/(\w+)\s*!=\s*'([^']*)'/gi, (_, col, val) => `(row['${col}'] !== '${val}')`);
    expr = expr.replace(/(\w+)\s*>\s*'([^']*)'/gi, (_, col, val) => `(row['${col}'] > '${val}')`);
    expr = expr.replace(/(\w+)\s*<\s*'([^']*)'/gi, (_, col, val) => `(row['${col}'] < '${val}')`);
    expr = expr.replace(/(\w+)\s*>=\s*'([^']*)'/gi, (_, col, val) => `(row['${col}'] >= '${val}')`);
    expr = expr.replace(/(\w+)\s*<=\s*'([^']*)'/gi, (_, col, val) => `(row['${col}'] <= '${val}')`);

    expr = expr.replace(/(\w+)\s*=\s*([\d.]+)/gi, (_, col, val) => `(row['${col}'] == ${val})`);
    expr = expr.replace(/(\w+)\s*!=\s*([\d.]+)/gi, (_, col, val) => `(row['${col}'] != ${val})`);
    expr = expr.replace(/(\w+)\s*>\s*([\d.]+)/gi, (_, col, val) => `(row['${col}'] > ${val})`);
    expr = expr.replace(/(\w+)\s*<\s*([\d.]+)/gi, (_, col, val) => `(row['${col}'] < ${val})`);
    expr = expr.replace(/(\w+)\s*>=\s*([\d.]+)/gi, (_, col, val) => `(row['${col}'] >= ${val})`);
    expr = expr.replace(/(\w+)\s*<=\s*([\d.]+)/gi, (_, col, val) => `(row['${col}'] <= ${val})`);

    expr = expr.replace(/\s+AND\s+/gi, ' && ');
    expr = expr.replace(/\s+OR\s+/gi, ' || ');

    const fn = new Function('row', `return ${expr};`);
    return fn(row);
  } catch {
    return true;
  }
}

loadAllCsvData();