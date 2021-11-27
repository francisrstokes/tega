import { LCDCF_BGON, LCDCF_ON, rBGP, rLCDC, rLY, rNR52, rSCX, rSCY, rWX, rWY } from "./hardware-inc";
import { CALL, CP, DEC, INC, JP, LD, OR, RET } from "./ops";
import { inlineBytes, moveTo, sizeOf, block, symbol, u16, u16ptr, u8, label, symbolFromLabel } from "./utils";
import {
  AssemblerOperation,
  Flag,
  Reg16,
  Reg16Ptr,
  Reg8,
  SymbolOr,
  U16Imm,
} from "./types";

import * as path from 'path';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import { assemble } from "./assembler";

const Tiles = label('Tiles');
const TilesEnd = label('TilesEnd');
const TileMap = label('TileMap');
const TileMapEnd = label('TileMapEnd');
const Done = label('Done');

const sTiles = symbolFromLabel(Tiles);
const sTilesEnd = symbolFromLabel(TilesEnd);
const sTileMap = symbolFromLabel(TileMap);
const sTileMapEnd = symbolFromLabel(TileMapEnd);
const sDone = symbolFromLabel(Done);

const tileData = fsSync.readFileSync(path.join(__dirname, '..', 'tiledata.bin'));
const tileMapData = fsSync.readFileSync(path.join(__dirname, '..', 'map.bin'));

const waitForVBlank = block('WaitForVBlank', ({ start: WaitVBlank }) => [
  LD(Reg8.A, u16ptr(rLY)),
  CP(Reg8.A, u8(144)),
  JP(Flag.Carry, WaitVBlank),
  RET()
]);

const copyData = (
  name: string,
  dataAddress: SymbolOr<U16Imm>,
  targetAddress: SymbolOr<U16Imm>,
  size: SymbolOr<U16Imm>
) => block(name, () => [
  LD(Reg16.DE, dataAddress),
  LD(Reg16.HL, targetAddress),
  LD(Reg16.BC, size),
// copy_start:
  label(`${name}_copy_start`),
  LD(Reg8.A, Reg16Ptr.DE),
  LD(Reg16Ptr.HLplus, Reg8.A),
  INC(Reg16.DE),
  DEC(Reg16.BC),
  LD(Reg8.A, Reg8.B),
  OR(Reg8.A, Reg8.C),
  JP(Flag.NotZero, symbol(`${name}_copy_start`)),
]);

const copyTiles = copyData('CopyTiles', sTiles, u16(0x9000), sizeOf(sTiles, sTilesEnd));
const copyTileMap = copyData('CopyMap', sTileMap, u16(0x9800), sizeOf(sTileMap, sTileMapEnd));

const scyWaitTimer = u16ptr(0xC100);
const scxWaitTimer = u16ptr(0xC101);

const program: AssemblerOperation[] = [
  LD(Reg8.A, u8(0)),
  LD(u16ptr(rNR52), Reg8.A),

  CALL(waitForVBlank.start),

  // Turn the LCD off
  LD(Reg8.A, u8(0)),
  LD(u16ptr(rLCDC), Reg8.A),

  copyTiles.block,
  copyTileMap.block,

  // Turn the LCD on
  LD(Reg8.A, u8(LCDCF_ON | LCDCF_BGON)),
  LD(u16ptr(rLCDC), Reg8.A),

  // During the first (blank) frame, initialize display registers
  LD(Reg8.A, u8(0b11100100)),
  LD(u16ptr(rBGP), Reg8.A),

Done,
  CALL(waitForVBlank.start),
label('scyTimer'),
  LD(Reg8.A, scyWaitTimer),
  INC(Reg8.A),
  LD(scyWaitTimer, Reg8.A),
  CP(Reg8.A, u8(0xff)),
  JP(Flag.NotZero, symbol('scyTimer')),

  LD(Reg8.A, u16ptr(rSCY)),
  INC(Reg8.A),
  LD(u16ptr(rSCY), Reg8.A),

label('scxTimer'),
  LD(Reg8.A, scxWaitTimer),
  INC(Reg8.A),
  LD(scxWaitTimer, Reg8.A),
  CP(Reg8.A, u8(0xff)),
  JP(Flag.NotZero, symbol('scxTimer')),

  LD(Reg8.A, u16ptr(rSCX)),
  DEC(Reg8.A),
  LD(u16ptr(rSCX), Reg8.A),
  JP(sDone),

  waitForVBlank.block,

  // Raw tiles and tilemap data
  Tiles, inlineBytes(tileData), TilesEnd,
  TileMap, inlineBytes(tileMapData), TileMapEnd
];

const main = async () => {
  const buffer = assemble(program);
  await fs.writeFile('test.gb', buffer);
}

main();
