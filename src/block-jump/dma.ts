import { HRAM } from "../hardware-inc";
import { DEC, JP, LD } from "../ops";
import { Flag, Reg8 } from "../types";
import { fn, inline, label, u16, u8, unnamedScope, virtualOffset } from "../utils";
import { OAM_DMA_Address } from "./oam";
import { shadowOAM } from "./ram";
import { call_memcpy } from "../std";

// void __attribute__((ram_function)) initiateDMA(void)
export const initiateDMA = fn('initiateDMA', () => [
  unnamedScope([
    LD(Reg8.A, u8(shadowOAM >> 8)),
    LD(OAM_DMA_Address, Reg8.A),
    label('wait'),
    DEC(Reg8.A),
    JP(Flag.NotZero, label('wait')),
  ])
]);

export const copyDMAToRAM = () => call_memcpy(label('ROMInitiateDMAStart'), u16(HRAM), initiateDMA.size);

export const DMAFunctions = inline([
  label('ROMInitiateDMAStart'), // Symbol that refers to the function in rom space
  virtualOffset(HRAM, [
    initiateDMA.block           // Function is generated such that internally defined symbols
  ]),                           // resolve relative to the virtual offset (in this case, in HRAM)
]);
