import * as fs from 'fs';
import * as path from 'path';

const filepath = path.join(__dirname, 'tetris.csv');
const tetrisCsv = fs.readFileSync(filepath, 'utf8');

const tetrisRom = new Uint8Array(tetrisCsv.split('\n')
  .slice(1)
  .map(line => {
    const parts = line.split(',');
    return parseInt(parts.at(-2) || '0', 16);
  }));

fs.writeFileSync('tetris.gb', tetrisRom);
