import { LCDCF_BGON, LCDCF_ON, rBGP, rLCDC, rLY, rNR52 } from "./hardware-inc";
import { CP, DEC, INC, JP, LD, OR } from "./ops";
import { inlineBytes, moveTo, sizeOf, symbol, u16, u16ptr, u8 } from "./utils";
import {
  AssemblerOperation,
  Flag,
  Reg16,
  Reg16Ptr,
  Reg8,
} from "./types";

import * as path from 'path';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import { assemble } from "./assembler";

const Header = symbol('Header');
const EntryPoint = symbol('EntryPoint');
const WaitVBlank = symbol('WaitVBlank');
const Tiles = symbol('Tiles');
const TilesEnd = symbol('TilesEnd');
const CopyTiles = symbol('CopyTiles');
const TileMap = symbol('TileMap');
const TileMapEnd = symbol('TileMapEnd');
const CopyTileMap = symbol('CopyTileMap');
const Done = symbol('Done');

const tileData = fsSync.readFileSync(path.join(__dirname, '..', 'tiledata.bin'));
const tileMapData = fsSync.readFileSync(path.join(__dirname, '..', 'map.bin'));

const program: AssemblerOperation[] = [
  moveTo(0x100),

Header,
  JP(EntryPoint),
  moveTo(0x150),

EntryPoint,
  LD(Reg8.A, u8(0)),
  LD(u16ptr(rNR52), Reg8.A),

  // Do not turn off the LCD outside of VBlank
WaitVBlank,
  LD(Reg8.A, u16ptr(rLY)),
  CP(Reg8.A, u8(144)),
  JP(Flag.Carry, WaitVBlank),

  // Turn the LCD off
  LD(Reg8.A, u8(0)),
  LD(u16ptr(rLCDC), Reg8.A),

  // Copy the tile data
  LD(Reg16.DE, Tiles),
  LD(Reg16.HL, u16(0x9000)),
  LD(Reg16.BC, sizeOf(Tiles, TilesEnd)),

CopyTiles,
  LD(Reg8.A, Reg16Ptr.DE),
  LD(Reg16Ptr.HLplus, Reg8.A),
  INC(Reg16.DE),
  DEC(Reg16.BC),
  LD(Reg8.A, Reg8.B),
  OR(Reg8.A, Reg8.C),
  JP(Flag.NotZero, CopyTiles),

  // Copy the tilemap
  LD(Reg16.DE, TileMap),
  LD(Reg16.HL, u16(0x9800)),
  LD(Reg16.BC, sizeOf(TileMap, TileMapEnd)),

CopyTileMap,
  LD(Reg8.A, Reg16Ptr.DE),
  LD(Reg16Ptr.HLplus, Reg8.A),
  INC(Reg16.DE),
  DEC(Reg16.BC),
  LD(Reg8.A, Reg8.B),
  OR(Reg8.A, Reg8.C),
  JP(Flag.NotZero, CopyTileMap),

  // Turn the LCD on
  LD(Reg8.A, u8(LCDCF_ON | LCDCF_BGON)),
  LD(u16ptr(rLCDC), Reg8.A),

  // During the first (blank) frame, initialize display registers
  LD(Reg8.A, u8(0b11100100)),
  LD(u16ptr(rBGP), Reg8.A),

Done,
  JP(Done),

Tiles, inlineBytes(tileData), TilesEnd,
TileMap, inlineBytes(tileMapData), TileMapEnd
];

const main = async () => {
  const buffer = assemble(program);
  await fs.writeFile('test.gb', buffer);
}

main();

debugger;