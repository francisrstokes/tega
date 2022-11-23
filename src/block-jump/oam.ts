import { CALL, LD } from "../ops";
import { Reg16Ptr, Reg8 } from "../types";
import { addr, fn, inline, u8 } from "../utils";
import { OAMStruct } from "./structs";

export const OAM_StartAddress  = addr(0xFE00);
export const OAM_DMA_Address   = addr(0xFF46);

export const OAMProp = (base: number, prop: OAMStruct) => addr(base + prop);

// void setOAMEntryValues(u16* hl_oam_entry, u8 a_y, u8 b_x, u8 c_tile)
export const setOAMEntryValues = fn('setOAMEntryValues', () => [
  LD(Reg16Ptr.HLinc, Reg8.A),  // Y
  LD(Reg8.A, Reg8.B),
  LD(Reg16Ptr.HLinc, Reg8.A),  // X
  LD(Reg8.A, Reg8.C),
  LD(Reg16Ptr.HLinc, Reg8.A),  // TileIndex
  LD(Reg8.A, u8(2)),
  LD(Reg16Ptr.HLinc, Reg8.A),  // Flags
]);

export const call_setOAMEntryValues = (y: number, x: number, tile: number) =>
  inline([
    LD(Reg8.A, u8(y)),
    LD(Reg8.B, u8(x)),
    LD(Reg8.C, u8(tile)),
    CALL(setOAMEntryValues.start)
  ]);

export const OAMFunctions = inline([
  setOAMEntryValues.block
]);
