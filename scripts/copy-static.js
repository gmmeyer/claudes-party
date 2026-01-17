const fs = require('fs');
const path = require('path');

// Directories to copy
const staticDirs = [
  { src: 'src/renderer/popover', dest: 'dist/renderer/popover', extensions: ['.html', '.css'] },
  { src: 'src/renderer/settings', dest: 'dist/renderer/settings', extensions: ['.html', '.css'] }
];

function copyFile(src, dest) {
  const destDir = path.dirname(dest);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  fs.copyFileSync(src, dest);
  console.log(`Copied: ${src} -> ${dest}`);
}

function copyStaticFiles() {
  for (const dir of staticDirs) {
    const srcPath = path.resolve(dir.src);
    const destPath = path.resolve(dir.dest);

    if (!fs.existsSync(srcPath)) {
      console.warn(`Source directory not found: ${srcPath}`);
      continue;
    }

    const files = fs.readdirSync(srcPath);
    for (const file of files) {
      const ext = path.extname(file);
      if (dir.extensions.includes(ext)) {
        copyFile(
          path.join(srcPath, file),
          path.join(destPath, file)
        );
      }
    }
  }
}

copyStaticFiles();
console.log('Static files copied successfully!');
