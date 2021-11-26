import { LCDCF_BGON, LCDCF_ON, rBGP, rLCDC, rLY, rNR52 } from "./hardware-inc";
import { CP, DEC, INC, JP, LD, OR } from "./ops";
import { inlineBytes, moveTo, sizeOf, subroutine, symbol, u16, u16ptr, u8 } from "./utils";
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

const Header = symbol('Header');
const EntryPoint = symbol('EntryPoint');
const Tiles = symbol('Tiles');
const TilesEnd = symbol('TilesEnd');
const TileMap = symbol('TileMap');
const TileMapEnd = symbol('TileMapEnd');
const Done = symbol('Done');

const tileData = fsSync.readFileSync(path.join(__dirname, '..', 'tiledata.bin'));
const tileMapData = fsSync.readFileSync(path.join(__dirname, '..', 'map.bin'));

const waitVBlank = subroutine('WaitVBlank', ({ label: WaitVBlank }) => [
  LD(Reg8.A, u16ptr(rLY)),
  CP(Reg8.A, u8(144)),
  JP(Flag.Carry, WaitVBlank),

  // Turn the LCD off
  LD(Reg8.A, u8(0)),
  LD(u16ptr(rLCDC), Reg8.A),
]);

const copyData = (
  name: string,
  dataAddress: SymbolOr<U16Imm>,
  targetAddress: SymbolOr<U16Imm>,
  size: SymbolOr<U16Imm>
) => subroutine(name, () => [
  LD(Reg16.DE, dataAddress),
  LD(Reg16.HL, targetAddress),
  LD(Reg16.BC, size),
// copy_start:
  symbol(`${name}_copy_start`),
  LD(Reg8.A, Reg16Ptr.DE),
  LD(Reg16Ptr.HLplus, Reg8.A),
  INC(Reg16.DE),
  DEC(Reg16.BC),
  LD(Reg8.A, Reg8.B),
  OR(Reg8.A, Reg8.C),
  JP(Flag.NotZero, symbol(`${name}_copy_start`)),
]);

const copyTiles = copyData('CopyTiles', Tiles, u16(0x9000), sizeOf(Tiles, TilesEnd));
const copyTileMap = copyData('CopyMap', TileMap, u16(0x9800), sizeOf(TileMap, TileMapEnd));

const program: AssemblerOperation[] = [
  moveTo(0x100),

Header,
  JP(EntryPoint),
  moveTo(0x150),

EntryPoint,
  LD(Reg8.A, u8(0)),
  LD(u16ptr(rNR52), Reg8.A),
  waitVBlank.subroutine,
  copyTiles.subroutine,
  copyTileMap.subroutine,

  // Turn the LCD on
  LD(Reg8.A, u8(LCDCF_ON | LCDCF_BGON)),
  LD(u16ptr(rLCDC), Reg8.A),

  // During the first (blank) frame, initialize display registers
  LD(Reg8.A, u8(0b11100100)),
  LD(u16ptr(rBGP), Reg8.A),

Done,
  // Loop forever
  JP(Done),

  // Raw tiles and tilemap data
  Tiles, inlineBytes(tileData), TilesEnd,
  TileMap, inlineBytes(tileMapData), TileMapEnd
];

const main = async () => {
  const buffer = assemble(program);
  await fs.writeFile('test.gb', buffer);
}

main();
