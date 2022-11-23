import { BTN_A, BTN_DPAD_DOWN, BTN_DPAD_LEFT, BTN_DPAD_RIGHT, BTN_DPAD_UP, HRAM, LCDCF_BGON, LCDCF_OBJON, LCDCF_ON, P1F_GET_BTN, P1F_GET_DPAD, rBGP, rLCDC, rLY, rNR52, rP1 } from "./hardware-inc";
import { ADD, AND, CALL, CP, DEC, HALT, INC, JP, JR, LD, OR, POP, PUSH, RET, SRA, SUB } from "./ops";
import { inlineBytes, sizeOf, block, u16, u16ptr, u8, label, relative, inline, addr, scope } from "./utils";
import {
  AssemblerOperation,
  Flag,
  Reg16,
  Reg16Ptr,
  Reg8,
  SymbolOr,
  U16Imm,
  U16Ptr,
  U8Imm,
} from "./types";

import * as path from 'path';
import * as fsSync from 'fs';
import { assemble } from "./assembler";
import { switch_reg } from "./std";

const program: AssemblerOperation[] = [
  LD(Reg8.A, u8(4)),
  switch_reg(Reg8.A, [
    [u8(1), [
      LD(Reg8.B, u8(1))
    ]],
    [u8(2), [
      LD(Reg8.B, u8(2)),
    ]],
    [u8(3), [
      LD(Reg8.B, u8(3)),
    ]],
  ]),
  HALT(),
];

const result = assemble(program);

fsSync.writeFileSync('experiment.gb', result.buffer);
fsSync.writeFileSync('experiment.sym', result.formattedSym);
