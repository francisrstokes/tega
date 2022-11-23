import * as fsSync from 'fs';

import { assemble } from "../assembler";
import { LCDCF_BGON, LCDCF_ON, rBGP, rLCDC, rNR52, rOBP0 } from "../hardware-inc";
import { ADD, CALL, DEC, JP, LD, XOR } from "../ops";
import {
  AssemblerOperation,
  Flag,
  Reg16,
  Reg16Ptr,
  Reg8
} from "../types";
import { addr, label, scope, u16, u8 } from "../utils";

import { copyDMAToRAM, DMAFunctions, initiateDMA } from './dma';
import { gameFunctions, mainGameStateMachine } from './game';
import { call_setOAMEntryValues, OAMFunctions, setOAMEntryValues } from './oam';
import { obstacleFunctions, obstacleStartX, obstacleTable } from './obstacle';
import { charGroundPos, charXPos, physicsFunctions } from "./physics";
import { allRAMSymbols, charShadowOAM, charStruct, obstacle0, RAMLastUsed, RAMStart, rngIndex } from "./ram";
import { rngFunctions, rngTable } from './rng';
import { call_memcpy, call_memset, call_waitForVBlank, stdFunctions } from "../std";
import { CharJumpState } from './structs';
import { allTileData, tiles, titleMap } from './tiles';


// Main Program ------------------------------
const program: AssemblerOperation[] = [
label('program_setup'),
  XOR(Reg8.A, Reg8.A),
  LD(addr(rNR52), Reg8.A),

  call_waitForVBlank(),

  // Turn the LCD off
  XOR(Reg8.A, Reg8.A),
  LD(addr(rLCDC), Reg8.A),

  // Copy tiles and tile maps
  call_memcpy(tiles.start, u16(0x8000), tiles.size),
  call_memcpy(tiles.start, u16(0x9000), tiles.size),
  call_memcpy(titleMap.start, u16(0x9800), titleMap.size),

  // Copy the DMA routine to HRAM
  copyDMAToRAM(),

  // Turn the LCD on
  LD(Reg8.A, u8(LCDCF_ON | LCDCF_BGON)),
  LD(addr(rLCDC), Reg8.A),

  // During the first (blank) frame, initialize display registers
  // Set up the background palette
  LD(Reg8.A, u8(0b11_10_01_00)),
  LD(addr(rBGP), Reg8.A),
  LD(addr(rOBP0), Reg8.A),

  // Zero out all used RAM addresses
  call_memset(u16(RAMStart), u8(0x00), u16(RAMLastUsed - RAMStart)),

  // Setup OAM values
  LD(Reg16.HL, u16(charShadowOAM)),

  // Character
  call_setOAMEntryValues(charGroundPos, charXPos, 2),

  // Obstacles
  scope('init_obstacle0', [
    LD(Reg8.D, u8(4)),
    LD(Reg8.E, u8(charGroundPos)),
    label('loop'),
    LD(Reg8.A, Reg8.E),               // Y
    LD(Reg8.B, u8(obstacleStartX)),   // X
    LD(Reg8.C, u8(1)),                // Tile
    CALL(setOAMEntryValues.start),
    LD(Reg8.A, u8(-8)),               // The next tile is 8 pixel higher
    ADD(Reg8.A, Reg8.E),
    LD(Reg8.E, Reg8.A),
    DEC(Reg8.D),
    JP(Flag.NotZero, label('loop')),
  ]),

  scope('init_obstacle1', [
    LD(Reg8.D, u8(4)),
    LD(Reg8.E, u8(charGroundPos)),
    label('loop'),
    LD(Reg8.A, Reg8.E),               // Y
    LD(Reg8.B, u8(obstacleStartX)),   // X
    LD(Reg8.C, u8(1)),                // Tile
    CALL(setOAMEntryValues.start),
    LD(Reg8.A, u8(-8)),               // The next tile is 8 pixel higher
    ADD(Reg8.A, Reg8.E),
    LD(Reg8.E, Reg8.A),
    DEC(Reg8.D),
    JP(Flag.NotZero, label('loop')),
  ]),

  // Setup the character properties
  LD(Reg16.HL, u16(charStruct)),

  LD(Reg8.A, u8(CharJumpState.Idle)),
  LD(Reg16Ptr.HLinc, Reg8.A),  // state
  XOR(Reg8.A, Reg8.A),
  LD(Reg16Ptr.HLinc, Reg8.A), // yVel
  LD(Reg16Ptr.HLinc, Reg8.A), // gravity
  LD(Reg16Ptr.HLinc, Reg8.A), // jumpAmount
  LD(Reg16Ptr.HLinc, Reg8.A), // jumpTimer

  // Setup the obstacle properties
  LD(Reg16.HL, u16(obstacle0)),

  XOR(Reg8.A, Reg8.A),
  LD(Reg16Ptr.HLinc, Reg8.A), // isActive
  LD(Reg16Ptr.HLinc, Reg8.A), // updateTimer
  LD(Reg16Ptr.HLinc, Reg8.A), // type
  LD(Reg16Ptr.HLinc, Reg8.A), // cooldownTimer
  LD(Reg8.A, u8(1)),
  LD(Reg16Ptr.HLinc, Reg8.A), // oamIndex
  LD(Reg16Ptr.HLinc, Reg8.A), // yHeight

  XOR(Reg8.A, Reg8.A),
  LD(Reg16Ptr.HLinc, Reg8.A), // isActive
  LD(Reg16Ptr.HLinc, Reg8.A), // updateTimer
  LD(Reg16Ptr.HLinc, Reg8.A), // type
  LD(Reg8.A, u8(0x30)),
  LD(Reg16Ptr.HLinc, Reg8.A), // cooldownTimer
  LD(Reg8.A, u8(5)),
  LD(Reg16Ptr.HLinc, Reg8.A), // oamIndex
  LD(Reg16Ptr.HLinc, Reg8.A), // yHeight

  // Set the random number generator table index
  LD(Reg8.A, addr(0xCFFF)), // Read an uninitialised value from RAM
  LD(addr(rngIndex), Reg8.A),

  call_waitForVBlank(),

label('game_loop'),
  CALL(mainGameStateMachine.start),

  call_waitForVBlank(),

  CALL(initiateDMA.start),
  JP(label('game_loop')),

// Functions ---------------------------------

  OAMFunctions,
  stdFunctions,
  physicsFunctions,
  obstacleFunctions,
  rngFunctions,
  DMAFunctions,
  gameFunctions,

// Data --------------------------------------

  // Raw tiles and tilemap data
  allTileData,

  // Obstacle OAM mapping table
  obstacleTable.block,

  // Random number table
  rngTable.block,
];

const result = assemble(program);

console.log(`\nAssembled ROM: ${result.finalOffset} / ${1<<15} bytes\n`);

for (const [name, value] of Object.entries(allRAMSymbols)) {
  console.log(`${name.padEnd(30, ' ')} 0x${value.toString(16).toUpperCase()}`)
}

// Add RAM symbols and write to sym file
const ramSymbols = Object.entries(allRAMSymbols).map(([name, offset]) => {
  return `${offset.toString(16).padStart(4, '0')} ${name}`;
}).join('\n');
const symFile = result.formattedSym + '\n' + ramSymbols;

fsSync.writeFileSync('test.gb', result.buffer);
fsSync.writeFileSync('test.sym', symFile);
