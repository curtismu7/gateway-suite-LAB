// Customer branding and vocabulary (rule 12), loaded from server/data/customer.config.json.
// Demo data only; the file renames labels, it never changes behaviour.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../data/customer.config.json');

export function loadCustomerConfig(file = FILE) {
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  const problems = [];
  if (!raw.branding || typeof raw.branding.productName !== 'string') problems.push('branding.productName missing');
  if (!raw.vocabulary || typeof raw.vocabulary !== 'object') problems.push('vocabulary missing');
  if (problems.length) throw new Error(`customer.config: ${problems.join('; ')}`);
  return raw;
}
