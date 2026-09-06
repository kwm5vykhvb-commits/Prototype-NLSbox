import fs from 'fs';
import path from 'path';

function patchFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    if (content.includes('Pending promise was never set')) {
      const patched = content
        .replaceAll("debugAssert(this.pendingPromise, 'Pending promise was never set');", 'if (!this.pendingPromise) { return; }')
        .replaceAll('debugAssert(this.pendingPromise, "Pending promise was never set");', 'if (!this.pendingPromise) { return; }');
      fs.writeFileSync(filePath, patched, 'utf8');
      console.log(`[Patch] Successfully patched ${filePath}`);
    }
  } catch (err) {
    console.warn(`[Patch] Could not patch ${filePath}:`, err);
  }
}

function walkDir(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath);
    } else if (entry.isFile() && fullPath.endsWith('.js')) {
      patchFile(fullPath);
    }
  }
}

walkDir(path.resolve('node_modules/@firebase/auth'));
