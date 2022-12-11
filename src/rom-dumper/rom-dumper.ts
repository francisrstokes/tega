import { BTN_START, LCDCF_BGON, LCDCF_OBJON, LCDCF_ON, P1F_GET_BTN, RAM, rLCDC, rLY, rP1, rSB, rSC, SCF_SOURCE, SCF_START } from "../hardware-inc";
import { AND, CALL, CP, DEC, DI, JP, LD, OR, XOR } from "../ops";
import { call_memcpy } from "../std";
import { Flag, Reg16, Reg16Ptr, Reg8 } from "../types";
import { addr, fn, inline, label, sizeOf, u16, u8, unnamedScope, virtualOffset } from "../utils";

const ROMFunctionsStart = label('ROMFunctionsStart');
const ROMFunctionsEnd = label('ROMFunctionsEnd');
const ROMFunctionsSize = sizeOf(ROMFunctionsStart, ROMFunctionsEnd);

export const copyFunctionsToRAM = fn('copyFunctionsToRAM', () => [
  call_memcpy(ROMFunctionsStart, u16(RAM), ROMFunctionsSize)
]);

export const waitForCartSwap = fn('waitForCartSwap', ({ start }) => [
  LD(Reg8.A, u8(P1F_GET_BTN)), // Request buttons
  LD(addr(rP1), Reg8.A),
  LD(Reg8.A, addr(rP1)),       // Get value of buttons
  AND(Reg8.A, u8(BTN_START)),  // Isolate start button
  JP(Flag.NotZero, start),     // Loop until start is pressed
]);

export const waitForVBlankRAM = fn('waitForVBlankRAM', ({ start }) => [
  LD(Reg8.A, addr(rLY)),
  CP(Reg8.A, u8(144)),
  JP(Flag.Carry, start),
]);

export const waitForSerialReady = fn('waitForSerialReady', ({ start }) => [
  LD(Reg8.A, addr(rSC)),
  AND(Reg8.A, u8(SCF_START)),
  JP(Flag.NotZero, start)
]);

export const dumpBytesOverSerial = fn('dumpBytesOverSerial', () => [
  // Setup the size and cart pointer
  LD(Reg16.BC, u16(0x8000)),
  LD(Reg16.HL, u16(0x0000)),

  unnamedScope([
    label('loop'),

    // Read the next byte from the cartridge
    LD(Reg8.A, Reg16Ptr.HLinc),

    // Initiate a transfer
    LD(addr(rSB), Reg8.A),
    LD(Reg8.A, u8(SCF_START | SCF_SOURCE)),
    LD(addr(rSC), Reg8.A),

    CALL(waitForSerialReady.start),

    // Decrement the size counter
    DEC(Reg16.BC),
    LD(Reg8.A, Reg8.B),
    OR(Reg8.A, Reg8.C),
    JP(Flag.NotZero, label('loop')),
  ]),
]);

export const dumpROM = fn('dumpROM', () => [
  // Disable interrupts
  DI(),

  CALL(waitForCartSwap.start),

  // Turn off the LCD
  CALL(waitForVBlankRAM.start),
  XOR(Reg8.A, Reg8.A),
  LD(addr(rLCDC), Reg8.A),

  // Perform the dump
  CALL(dumpBytesOverSerial.start),

  // Turn on the LCD
  LD(Reg8.A, u8(LCDCF_ON | LCDCF_BGON | LCDCF_OBJON)),
  LD(addr(rLCDC), Reg8.A),

  // Jump to the game!
  JP(u16(0x0150)),
]);

export const romDumperFunctions = inline([
  copyFunctionsToRAM.block,
  ROMFunctionsStart,
  virtualOffset(RAM, [
    dumpROM.block,
    waitForCartSwap.block,
    waitForVBlankRAM.block,
    dumpBytesOverSerial.block,
    waitForSerialReady.block
  ]),
  ROMFunctionsEnd,
]);
