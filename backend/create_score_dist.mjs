import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse/sync';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RAW_DIR = path.join(__dirname, '..', 'data', 'raw');
const REVIEWS_CSV = path.join(RAW_DIR, 'olist_order_reviews_dataset.csv');

try {
  const content = fs.readFileSync(REVIEWS_CSV, 'utf-8');
  const records = parse(content, { columns: true, skip_empty_lines: true });
  
  const dist = {};
  for (const r of records) {
    const score = parseInt(r.review_score);
    if (!isNaN(score)) {
      dist[score] = (dist[score] || 0) + 1;
    }
  }
  
  const result = Object.entries(dist).sort(([a], [b]) => parseInt(a) - parseInt(b)).map(([score, count]) => ({ score: parseInt(score), count }));
  
  const DATA_DIR = path.join(__dirname, '..', 'data', 'processed');
  const outputPath = path.join(DATA_DIR, 'review_score_distribution.json');
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
  console.log('Score distribution saved to:', outputPath);
  console.log('Distribution:', result);
} catch (error) {
  console.error('Error:', error.message);
}