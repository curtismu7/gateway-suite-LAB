// Diagrams load by name from server/diagrams (diagram-studio/1 data, no hand-built nodes in the UI).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../diagrams');
export const DIAGRAM_NAMES = fs.readdirSync(DIR).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''));

export function loadDiagram(name) {
  if (!DIAGRAM_NAMES.includes(name)) throw new Error(`unknown diagram ${name}`);
  const d = JSON.parse(fs.readFileSync(path.join(DIR, `${name}.json`), 'utf8'));
  const problems = [];
  if (d.schema !== 'diagram-studio/1') problems.push('schema must be diagram-studio/1');
  if (!Array.isArray(d.nodes) || !d.nodes.length) problems.push('nodes missing');
  if (!Array.isArray(d.edges)) problems.push('edges missing');
  const ids = new Set((d.nodes ?? []).map((n) => n.id));
  for (const e of d.edges ?? []) {
    if (!ids.has(e.from) || !ids.has(e.to)) problems.push(`edge ${e.id} references an unknown node`);
  }
  for (const p of d.paths ?? []) {
    if (!p.id) problems.push('a path is missing its id');
    for (const h of p.hops ?? []) if (!ids.has(h)) problems.push(`path ${p.id} references an unknown node ${h}`);
  }
  if (problems.length) throw new Error(`diagram ${name}: ${problems.join('; ')}`);
  return d;
}
