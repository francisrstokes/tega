import { CALL, INC, LD, POP, PUSH } from "../ops";
import { Reg16, Reg16Ptr, Reg8 } from "../types";
import { addr, block, fn, inline, inlineBytes } from "../utils";
import { rngIndex } from "./ram";
import { applyOffsetToHLPtr, read_modify_write } from "../std";

// Table generated with following command:
// cat /dev/urandom | head -c256 | xxd -i
export const rngTable = block('rngTable', () => [
  inlineBytes(new Uint8Array([
    0x08, 0x26, 0x48, 0xa9, 0x96, 0x19, 0x8b, 0x84, 0xd0, 0xc1, 0x6d, 0x2a,
    0x9b, 0xcc, 0x57, 0x33, 0xde, 0x8f, 0xf6, 0x32, 0x3f, 0x92, 0x0d, 0x04,
    0xf8, 0xef, 0x7e, 0xce, 0xd0, 0x95, 0x48, 0x5b, 0xc1, 0xbd, 0x48, 0xa8,
    0x1a, 0xff, 0x44, 0x3d, 0xc3, 0x54, 0x05, 0xf8, 0x9b, 0x99, 0xfe, 0xbb,
    0xae, 0x1f, 0x19, 0x4a, 0x57, 0x6c, 0x93, 0xea, 0x46, 0x0e, 0x57, 0x0c,
    0x33, 0x14, 0x25, 0x22, 0xbe, 0x40, 0x58, 0x4f, 0xc8, 0x40, 0x9c, 0xbf,
    0x50, 0xa8, 0xba, 0x9e, 0x69, 0x8b, 0x34, 0xb5, 0xf0, 0x53, 0xf8, 0xba,
    0x99, 0xa3, 0x9c, 0xb1, 0x8e, 0xa4, 0x5e, 0xc4, 0x0c, 0x85, 0xb8, 0x7d,
    0x2a, 0xa0, 0x20, 0x81, 0x38, 0x84, 0x44, 0xae, 0x76, 0xcf, 0xf1, 0x47,
    0x00, 0xcf, 0xf6, 0xa0, 0x28, 0xf8, 0x40, 0x03, 0xc9, 0xd4, 0xeb, 0x9e,
    0xde, 0x83, 0x86, 0x27, 0xd4, 0xd1, 0x7e, 0x73, 0xe3, 0xc0, 0xfc, 0x83,
    0x32, 0xd3, 0x6b, 0x1c, 0x7b, 0x11, 0x6d, 0x4c, 0x6c, 0xf1, 0x1a, 0x71,
    0xd8, 0x99, 0x5c, 0xa0, 0x35, 0xd9, 0x4b, 0xb5, 0x0d, 0x36, 0xab, 0x97,
    0x2f, 0x74, 0xb7, 0x4e, 0x4e, 0xbf, 0x65, 0xff, 0x3f, 0x15, 0x87, 0xb4,
    0x1b, 0x13, 0x2e, 0xa0, 0x47, 0x68, 0xaf, 0xd8, 0xd0, 0x2b, 0xb7, 0xa1,
    0xbf, 0x40, 0x72, 0xfd, 0x7c, 0x7b, 0x79, 0x95, 0x9e, 0x35, 0x67, 0x54,
    0xb5, 0x67, 0xa8, 0x09, 0x02, 0x5e, 0xfd, 0x07, 0x7f, 0xcd, 0x48, 0xeb,
    0x32, 0xbf, 0xfa, 0x78, 0x0c, 0x3f, 0x75, 0xa6, 0x2c, 0x57, 0xca, 0x52,
    0x2c, 0x99, 0x48, 0xc8, 0x96, 0x08, 0x3b, 0xc1, 0xad, 0xad, 0x03, 0xaf,
    0x55, 0x78, 0xf7, 0x54, 0xf0, 0x3d, 0xe7, 0x69, 0x91, 0x6a, 0x17, 0x64,
    0xa3, 0xc0, 0xd9, 0x73, 0x5a, 0x91, 0xa0, 0x73, 0xde, 0x2d, 0x78, 0xad,
    0xea, 0xf1, 0x84, 0x4a
  ]))
]);

// void getRandom(void)
export const getRandom = fn('getRandom', () => [
  // Place a pointer to the current entry in the rng table into HL
  LD(Reg16.HL, rngTable.start),
  LD(Reg8.A, addr(rngIndex)),
  CALL(applyOffsetToHLPtr.start),

  // Load the current random number and push onto the stack
  LD(Reg8.A, Reg16Ptr.HL),
  PUSH('AF'),

  // Increment the table index
  read_modify_write(Reg8.A, addr(rngIndex), [ INC(Reg8.A) ]),

  // Place the result back into A
  POP('AF'),
]);

export const rngFunctions = inline([
  getRandom.block
]);
