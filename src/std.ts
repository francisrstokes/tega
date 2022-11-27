import { rLY } from "./hardware-inc";
import { CALL, CP, DEC, INC, JP, LD, OR } from "./ops";
import { AssemblerOperation, CompoundOperation, Flag, Reg16, Reg16Ptr, Reg8, SymbolOr, U16Imm, U16Ptr, U8Imm } from "./types";
import { addr, block, fn, inline, u8 } from "./utils";

type IfBody = {
  then: AssemblerOperation[];
  else?: AssemblerOperation[];
};

export const if_eq = (reg: Reg8, lit: SymbolOr<U8Imm>, body: IfBody) => {
  const prelude: AssemblerOperation[] = [];
  const rndId = Math.random().toString(16).slice(2);
  const elseBlock = block(`__discard_if_else_${rndId}`, () => body.else || []);

  if (reg !== Reg8.A) {
    // Copy the target comparison register to A
    prelude.push(LD(Reg8.A, reg));
  }
  // Perform comparison
  prelude.push(CP(Reg8.A, lit));

  // Check if *not* equal, skipping if block code
  prelude.push(
    JP(Flag.NotZero, elseBlock.start)
  );

  // Only populate this list *if* we have an else clause
  const jumpPastElse: AssemblerOperation[] = [];
  if (body.else && body.else.length > 0) {
    jumpPastElse.push(JP(elseBlock.end));
  }

  return inline([
    ...prelude,
    inline(body.then),
    ...jumpPastElse,
    elseBlock.block
  ]);
}

export const if_neq = (reg: Reg8, lit: SymbolOr<U8Imm>, body: IfBody) => {
  const prelude: AssemblerOperation[] = [];
  const rndId = Math.random().toString(16).slice(2);
  const elseBlock = block(`__discard_if_else_${rndId}`, () => body.else || []);

  if (reg !== Reg8.A) {
    // Copy the target comparison register to A
    prelude.push(LD(Reg8.A, reg));
  }
  // Perform comparison
  prelude.push(CP(Reg8.A, lit));

  // Check if *equal*, skipping if block code
  prelude.push(
    JP(Flag.Zero, elseBlock.start)
  );

  // Only populate this list *if* we have an else clause
  const jumpPastElse: AssemblerOperation[] = [];
  if (body.else && body.else.length > 0) {
    jumpPastElse.push(JP(elseBlock.end));
  }

  return inline([
    ...prelude,
    inline(body.then),
    ...jumpPastElse,
    elseBlock.block
  ]);
}

export const if_ugt = (reg: Reg8, lit: SymbolOr<U8Imm>, body: IfBody) => {
  const prelude: AssemblerOperation[] = [];
  const rndId = Math.random().toString(16).slice(2);
  const elseBlock = block(`__discard_if_else_${rndId}`, () => body.else || []);

  if (reg !== Reg8.A) {
    // Copy the target comparison register to A
    prelude.push(LD(Reg8.A, reg));
  }

  // For unsigned comparisons, CP(A, x) will set the carry flag when >
  // Jump here on the inverse into the else block
  prelude.push(
    CP(Reg8.A, lit),
    JP(Flag.Zero, elseBlock.start),
    JP(Flag.Carry, elseBlock.start),
  );

  // Only populate this list *if* we have an else clause
  const jumpPastElse: AssemblerOperation[] = [];
  if (body.else && body.else.length > 0) {
    jumpPastElse.push(JP(elseBlock.end));
  }

  return inline([
    ...prelude,
    inline(body.then),
    ...jumpPastElse,
    elseBlock.block
  ]);
}

export const if_ugte = (reg: Reg8, lit: SymbolOr<U8Imm>, body: IfBody) => {
  const prelude: AssemblerOperation[] = [];
  const rndId = Math.random().toString(16).slice(2);
  const thenBlock = block(`__discard_if_then_${rndId}`, () => body.then);
  const elseBlock = block(`__discard_if_else_${rndId}`, () => body.else || []);

  if (reg !== Reg8.A) {
    // Copy the target comparison register to A
    prelude.push(LD(Reg8.A, reg));
  }

  prelude.push(
    CP(Reg8.A, lit),
    JP(Flag.Zero, thenBlock.start),
    JP(Flag.Carry, elseBlock.start),
  );

  // Only populate this list *if* we have an else clause
  const jumpPastElse: AssemblerOperation[] = [];
  if (body.else && body.else.length > 0) {
    jumpPastElse.push(JP(elseBlock.end));
  }

  return inline([
    ...prelude,
    thenBlock.block,
    ...jumpPastElse,
    elseBlock.block
  ]);
}

export const if_ult = (reg: Reg8, lit: U8Imm, body: IfBody) => {
  const prelude: AssemblerOperation[] = [];
  const rndId = Math.random().toString(16).slice(2);
  const thenBlock = block(`__discard_if_then_${rndId}`, () => body.then);
  const elseBlock = block(`__discard_if_else_${rndId}`, () => body.else || []);

  if (reg !== Reg8.A) {
    // Copy the target comparison register to A
    prelude.push(LD(Reg8.A, reg));
  }

  prelude.push(
    CP(Reg8.A, lit),
    JP(Flag.Zero, elseBlock.start),
    JP(Flag.NotCarry, elseBlock.start),
  );

  // Only populate this list *if* we have an else clause
  const jumpPastElse: AssemblerOperation[] = [];
  if (body.else && body.else.length > 0) {
    jumpPastElse.push(JP(elseBlock.end));
  }

  return inline([
    ...prelude,
    thenBlock.block,
    ...jumpPastElse,
    elseBlock.block
  ]);
}

export const if_ulte = (reg: Reg8, lit: U8Imm, body: IfBody) => {
  const prelude: AssemblerOperation[] = [];
  const rndId = Math.random().toString(16).slice(2);
  const thenBlock = block(`__discard_if_then_${rndId}`, () => body.then);
  const elseBlock = block(`__discard_if_else_${rndId}`, () => body.else || []);

  if (reg !== Reg8.A) {
    // Copy the target comparison register to A
    prelude.push(LD(Reg8.A, reg));
  }

  prelude.push(
    CP(Reg8.A, lit),
    JP(Flag.Zero, thenBlock.start),
    JP(Flag.NotCarry, elseBlock.start),
  );

  // Only populate this list *if* we have an else clause
  const jumpPastElse: AssemblerOperation[] = [];
  if (body.else && body.else.length > 0) {
    jumpPastElse.push(JP(elseBlock.end));
  }

  return inline([
    ...prelude,
    thenBlock.block,
    ...jumpPastElse,
    elseBlock.block
  ]);
}

export const if_eq_reg = (reg: Reg8, body: IfBody) => {
  const prelude: AssemblerOperation[] = [];
  const rndId = Math.random().toString(16).slice(2);
  const elseBlock = block(`__discard_ifr_else_${rndId}`, () => body.else || []);

  // Perform comparison
  prelude.push(CP(Reg8.A, reg));

  // Check if *not* equal, skipping if block code
  prelude.push(JP(Flag.NotZero, elseBlock.start));

  // Only populate this list *if* we have an else clause
  const jumpPastElse: AssemblerOperation[] = [];
  if (body.else && body.else.length > 0) {
    jumpPastElse.push(JP(elseBlock.end));
  }

  return inline([
    ...prelude,
    inline(body.then),
    ...jumpPastElse,
    elseBlock.block
  ]);
}

export const if_ugt_reg = (reg: Reg8, body: IfBody) => {
  const prelude: AssemblerOperation[] = [];
  const rndId = Math.random().toString(16).slice(2);
  const elseBlock = block(`__discard_ifr_else_${rndId}`, () => body.else || []);

  // For unsigned comparisons, CP(A, x) will set the carry flag when >
  // Jump here on the inverse into the else block
  prelude.push(
    CP(Reg8.A, reg),
    JP(Flag.Zero, elseBlock.start),
    JP(Flag.NotCarry, elseBlock.start),
  );

  // Only populate this list *if* we have an else clause
  const jumpPastElse: AssemblerOperation[] = [];
  if (body.else && body.else.length > 0) {
    jumpPastElse.push(JP(elseBlock.end));
  }

  return inline([
    ...prelude,
    inline(body.then),
    ...jumpPastElse,
    elseBlock.block
  ]);
}

export const if_ugte_reg = (reg: Reg8, body: IfBody) => {
  const prelude: AssemblerOperation[] = [];
  const rndId = Math.random().toString(16).slice(2);
  const thenBlock = block(`__discard_ifr_then_${rndId}`, () => body.then);
  const elseBlock = block(`__discard_ifr_else_${rndId}`, () => body.else || []);

  prelude.push(
    CP(Reg8.A, reg),
    JP(Flag.Zero, thenBlock.start),
    JP(Flag.NotCarry, elseBlock.start),
  );

  // Only populate this list *if* we have an else clause
  const jumpPastElse: AssemblerOperation[] = [];
  if (body.else && body.else.length > 0) {
    jumpPastElse.push(JP(elseBlock.end));
  }

  return inline([
    ...prelude,
    thenBlock.block,
    ...jumpPastElse,
    elseBlock.block
  ]);
}

export const if_ult_reg = (reg: Reg8, body: IfBody) => {
  return if_ugte_reg(reg, { then: body.else || [], else: body.then });
}

export type SwitchCase = [ SymbolOr<U8Imm>, AssemblerOperation[] ];
export const switch_reg = (reg: Reg8, cases: SwitchCase[], defaultCase?: AssemblerOperation[]) => {
  if (cases.length === 0) return inline([]);

  // Build the switch/case structure from inside out
  const casesReversed = [...cases].reverse();

  let currentConditional: CompoundOperation = inline(defaultCase || []);
  casesReversed.forEach(([cond, body], i) => {
    currentConditional = if_eq(reg, cond, { then: body, else: [currentConditional] });
  });

  return currentConditional;
}

// Note: Always clobbers A, even when loading another reg
export const load_from_mem = (reg: Reg8, addr: SymbolOr<U16Ptr>) => {
  const out: AssemblerOperation[] = [];

  out.push(LD(Reg8.A, addr));
  if (reg !== Reg8.A) {
    out.push(LD(reg, Reg8.A));
  }

  return inline(out);
}

// Note: Always clobbers A, even when loading another reg
export const read_modify_write = (reg: Reg8, addr: SymbolOr<U16Ptr>, modify: AssemblerOperation[], wbReg = reg) => {
  const ops: AssemblerOperation[] = [];

  ops.push(
    load_from_mem(reg, addr),
    inline(modify),
  );

  if (wbReg !== Reg8.A) {
    ops.push(LD(Reg8.A, wbReg));
  }

  ops.push(LD(addr, Reg8.A));

  return inline(ops);
}

// Note: Always clobbers A, even when loading another reg
export const read_modify_write_hl = (reg: Reg8, modify: AssemblerOperation[], wbReg = reg) => {
  const ops: AssemblerOperation[] = [];

  ops.push(
    LD(Reg8.A, Reg16Ptr.HL),
    ...(reg !== Reg8.A ? [LD(reg, Reg8.A)] : []),
    inline(modify),
  );

  if (wbReg !== Reg8.A) {
    ops.push(LD(Reg8.A, wbReg));
  }

  ops.push(LD(Reg16Ptr.HL, Reg8.A));

  return inline(ops);
}

// void waitForVBlank(void)
export const waitForVBlank = fn('waitForVBlank', ({ start }) => [
  LD(Reg8.A, addr(rLY)),
  CP(Reg8.A, u8(144)),
  JP(Flag.Carry, start),
]);

// void memcpy(u16 de_source, u16 hl_dest, u16 bc_size)
export const memcpy = fn('memcpy', ({ start }) => [
  // Load a byte from the source
  LD(Reg8.A, Reg16Ptr.DE),

  // Write that byte to the destination, incrementing the dest pointer
  LD(Reg16Ptr.HLinc, Reg8.A),

  // Increment the source pointer
  INC(Reg16.DE),

  // Decrement the size
  DEC(Reg16.BC),

  // Copy B to A
  LD(Reg8.A, Reg8.B),

  // Check (B | C) == 0 (BC == 0)
  OR(Reg8.A, Reg8.C),

  // While BC != 0, loop
  JP(Flag.NotZero, start),
]);

// void applyOffsetToHLPtr(u16* hl_ptr, u8 a_offset)
export const applyOffsetToHLPtr = fn('applyOffsetToHLPtr', ({ start }) => [
  if_neq(Reg8.A, u8(0), { then: [
    INC(Reg16.HL),
    DEC(Reg8.A),
    JP(start),
  ]}),
]);

// void applyOffsetToDEPtr(u16* hl_ptr, u8 a_offset)
export const applyOffsetToDEPtr = fn('applyOffsetToDEPtr', ({ start }) => [
  if_neq(Reg8.A, u8(0), { then: [
    INC(Reg16.DE),
    DEC(Reg8.A),
    JP(start),
  ]}),
]);

// void memset(u16 hl_dest, u8 d_value, u16 bc_size)
export const memset = fn('memset', ({ start }) => [
  // Load the "to copy" value into A
  LD(Reg8.A, Reg8.D),

  // Write it through the HL ptr, incrementing HL
  LD(Reg16Ptr.HLinc, Reg8.A),

  // Decrement the size
  DEC(Reg16.BC),

  // Perform "B | C"
  LD(Reg8.A, Reg8.B),
  OR(Reg8.A, Reg8.C),

  // If BC (size) is not zero, there is still copying to do
  JP(Flag.NotZero, start),
]);

export const call_memset = (dest: SymbolOr<U16Imm>, value: SymbolOr<U8Imm>, size: SymbolOr<U16Imm>) =>
  inline([
    LD(Reg16.HL, dest),
    LD(Reg8.D, value),
    LD(Reg16.BC, size),
    CALL(memset.start)
  ]);

export const call_memcpy = (source: SymbolOr<U16Imm>, dest: SymbolOr<U16Imm>, size: SymbolOr<U16Imm>) =>
  inline([
    LD(Reg16.DE, source),
    LD(Reg16.HL, dest),
    LD(Reg16.BC, size),
    CALL(memcpy.start)
  ]);

export const call_waitForVBlank = () => CALL(waitForVBlank.start);

export const stdFunctions = inline([
  waitForVBlank.block,
  memcpy.block,
  applyOffsetToHLPtr.block,
  applyOffsetToDEPtr.block,
  memset.block,
]);
