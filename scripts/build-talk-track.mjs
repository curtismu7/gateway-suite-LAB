// Writes docs/talk-track.md from the app's own prompt categories (so the doc cannot drift).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { PROMPT_CATEGORIES } = await import(pathToFileURL(path.join(ROOT, 'server/src/app.js')));

const lines = [];
lines.push('# AI Gateway Suite LAB — talk track');
lines.push('');
lines.push('Open http://localhost:5750. Every page carries the simulation banner; the header has the Mock/Real toggle (rule 19).');
lines.push('');
lines.push('## End to End');
lines.push('');
lines.push('1. Read the diagram: Main Agent → AI Gateway (A2A) → Worker Agent → AI Gateway (MCP) → MCP tool → LLM. Drag a box to show it is live; Reset layout restores it.');
lines.push('2. Walk the categories, one prompt each:');
for (const c of PROMPT_CATEGORIES) {
  lines.push(`   - **${c.label}**: "${c.prompts[0]}"`);
}
lines.push('3. Watch the trace: one traceparent per hop, guard events in red, MCP call/result pairs, then the rendered answer.');
lines.push('4. Reset between demos (header button or `npm run reset`).');
lines.push('');
lines.push('## Personal Agent');
lines.push('');
lines.push('1. In Mock mode the URL field pre-fills with the in-process mock MCP server (loopback). Connect: four tools are discovered.');
lines.push('2. Run `who_has_role` with `prod-db-admin`; the human view shows holders with Active / Expired / Never-used tags.');
lines.push('3. Run `open_ticket` with a justification containing `rm -rf`: the tool refuses — MCP-side policy.');
lines.push('4. In Real mode, paste a real MCP server URL; if it needs OAuth the dialog opens and the callback completes the flow.');
lines.push('');

fs.writeFileSync(fileURLToPath(new URL('../docs/talk-track.md', import.meta.url)), lines.join('\n'));
console.log('wrote docs/talk-track.md');
