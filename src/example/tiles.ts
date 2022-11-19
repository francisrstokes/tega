import * as path from 'path';
import * as fsSync from 'fs';
import { block, inline, inlineBytes } from '../utils';
import { runLengthEncodeTileData } from './rle';

const tileData = fsSync.readFileSync(path.join(__dirname, 'tiledata.bin'));
const titleMapData = runLengthEncodeTileData(fsSync.readFileSync(path.join(__dirname, 'titlemap.bin')));
const tileMapData = runLengthEncodeTileData(fsSync.readFileSync(path.join(__dirname, 'map.bin')));
const gameOverMapData = runLengthEncodeTileData(fsSync.readFileSync(path.join(__dirname, 'gameovermap.bin')));

export const tiles = block('Tiles', () => [inlineBytes(tileData)]);
export const titleMap = block('TitleMap', () => [inlineBytes(titleMapData)]);
export const tileMap = block('TileMap', () => [inlineBytes(tileMapData)]);
export const gameOverMap = block('gameOverMap', () => [inlineBytes(gameOverMapData)]);

export const allTileData = inline([
  tiles.block,
  tileMap.block,
  titleMap.block,
  gameOverMap.block,
]);
