import { AND, CALL, DEC, INC, JP, LD, OR, POP, PUSH, RES } from "../ops";
import { Bit, Flag, Reg16, Reg16Ptr, Reg8, SymbolOr, U16Imm } from "../types";
import { fn, inline, label, u8, unnamedScope } from "../utils";

// void rleUnpack(u16 de_source, u16 hl_dest, u16 bc_source_size)
export const rleUnpack = fn('rleUnpack', ({ start }) => [
  unnamedScope([
    // Load a byte from the source
    LD(Reg8.A, Reg16Ptr.DE),

    // Backup the size on the stack
    PUSH(Reg16.BC),

    // Backup the value of A
    LD(Reg8.B, Reg8.A),

    // Check if this is a single or repeated byte
    AND(Reg8.A, u8(0x80)),
    JP(Flag.Zero, label('single_byte')),

  label('multi_byte'),
    // Restore the backed up, original value
    LD(Reg8.A, Reg8.B),

    // Unset the top bit, which indicates an RLE byte
    RES(Bit.b7, Reg8.A),

    // Copy the byte to write to A
    LD(Reg8.B, Reg8.A),

    // The next byte in the sequence contains the run length
    INC(Reg16.DE),
    LD(Reg8.A, Reg16Ptr.DE),
    INC(Reg16.DE),

    // Swap A and B through C
    LD(Reg8.C, Reg8.A),
    LD(Reg8.A, Reg8.B),
    LD(Reg8.B, Reg8.C),

    // A = byte to write, B = run length
  label('multi_byte_loop'),
    LD(Reg16Ptr.HLinc, Reg8.A),
    DEC(Reg8.B),
    JP(Flag.NotZero, label('multi_byte_loop')),

    // Decrement the source size twice, accounting for the byte
    POP(Reg16.BC),
    DEC(Reg16.BC),
    DEC(Reg16.BC),

    // Copy B to A
    LD(Reg8.A, Reg8.B),

    // Check (B | C) == 0 (BC == 0)
    OR(Reg8.A, Reg8.C),

    // While BC != 0, loop
    JP(Flag.NotZero, start),
    JP(label('check_done')),

  label('single_byte'),
    // Restore the backed up, original value
    LD(Reg8.A, Reg8.B),

    // Write that byte to the destination, incrementing the dest pointer
    LD(Reg16Ptr.HLinc, Reg8.A),

    // Increment the source pointer
    INC(Reg16.DE),

    // Decrement the size
    POP(Reg16.BC),
    DEC(Reg16.BC),

  label('check_done'),
    // Copy B to A
    LD(Reg8.A, Reg8.B),

    // Check (B | C) == 0 (BC == 0)
    OR(Reg8.A, Reg8.C),

    // While BC != 0, loop
    JP(Flag.NotZero, start),
  ]),
]);

export const call_rleUnpack = (source: SymbolOr<U16Imm>, dest: SymbolOr<U16Imm>, size: SymbolOr<U16Imm>) =>
  inline([
    LD(Reg16.DE, source),
    LD(Reg16.HL, dest),
    LD(Reg16.BC, size),
    CALL(rleUnpack.start)
  ]);

export const rleFunctions = inline([
  rleUnpack.block,
]);

// This function is used to apply RLE to the raw tilemaps before they are inserted into the ROM
export const runLengthEncodeTileData = (data: Uint8Array) => {
  const result: number[] = [];

  let inRun = false;
  let runLength = 0;
  let byteValue = 0;

  const newRun = (byte: number) => {
    inRun = true;
    runLength = 1;
    byteValue = byte;
  };

  const commitRun = () => {
    if (runLength === 1) {
      result.push(byteValue);
    } else {
      result.push(0x80 | byteValue, runLength);
    }
    inRun = false;
  };

  for (const byte of data) {
    if (!inRun) {
      newRun(byte);
    } else {
      if (byte === byteValue) {
        if (runLength === 0xff) {
          commitRun();
          newRun(byte);
        } else {
          runLength++;
        }
      } else {
        commitRun();
        newRun(byte);
      }
    }
  }

  if (inRun) {
    commitRun();
  }

  return new Uint8Array(result);
}
