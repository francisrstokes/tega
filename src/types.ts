export enum ImmediateKey {
  u8imm = 'u8imm',
  i8imm = 'i8imm',
  u16imm = 'u16imm',
  u16ptr = 'u16ptr',
  ffPageOffset = 'ffPageOffset',
  spOffset = 'spOffset',
}
export type U8Imm = { type: ImmediateKey.u8imm, value: number };
export type I8Imm = { type: ImmediateKey.i8imm, value: number };
export type U16Imm = { type: ImmediateKey.u16imm, value: number };
export type U16Ptr = { type: ImmediateKey.u16ptr, value: number };
export type FFPageOffset = { type: ImmediateKey.ffPageOffset, value: number };
export type SPOffset = { type: ImmediateKey.spOffset, value: number };

export type ImmediateValue =
  | U8Imm
  | I8Imm
  | U16Imm
  | U16Ptr
  | FFPageOffset
  | SPOffset;

export type SymbolicLabel = { type: 'symbolicLabel', value: string };
export type SizeOfReference = {
  type: 'sizeOfReference';
  symbolA: SymbolicLabel;
  symbolB: SymbolicLabel;
};
export type RelativeToReference = {
  type: 'relativeToReference';
  symbol: SymbolicLabel;
}

export type SymbolReference = SymbolicLabel | SizeOfReference | RelativeToReference;

export type SymbolOr<T> = SymbolReference | T;

export type BaseOp = { type: 'opDescription'; opcode: number; isPrefix: boolean };
export type U8Op = BaseOp & { u8: SymbolOr<U8Imm>; };
export type I8Op = BaseOp & { i8: SymbolOr<I8Imm>; };
export type U16Op = BaseOp & { u16: SymbolOr<U16Imm>; };
export type U16ptrOp = BaseOp & { u16ptr: SymbolOr<U16Ptr>; };
export type FfPageOffsetOp = BaseOp & { ffPageOffset: SymbolOr<FFPageOffset>; };
export type SpOffsetOp = BaseOp & { spOffset: SymbolOr<SPOffset>; };

export type OpDescription =
  | BaseOp
  | U8Op
  | I8Op
  | U16Op
  | U16ptrOp
  | FfPageOffsetOp
  | SpOffsetOp;

export type ByteArray = Uint8Array | Int8Array;

export type InlineBytes = { type: 'inlineBytes', bytes: ByteArray; };
export type OffsetControl = { type: 'offsetControl', address: number; };
export type CompoundOperation = { type: 'compound', operations: AssemblerOperation[]; };
export type VirtualOffsetControl = { type: 'virtualOffsetControl', address: number, useROMOffset: boolean };
export type AlignOffsetControl = { type: 'alignOffsetControl', alignment: number };

export type AssemblerOperation =
  | SymbolicLabel
  | OpDescription
  | InlineBytes
  | OffsetControl
  | VirtualOffsetControl
  | AlignOffsetControl
  | CompoundOperation;

export enum Reg8 {
  A = 'A',
  B = 'B',
  C = 'C',
  D = 'D',
  E = 'E',
  H = 'H',
  L = 'L',
};

export enum Reg16 {
  BC = 'BC',
  DE = 'DE',
  HL = 'HL',
  SP = 'SP',
};

export enum Reg16Ptr {
  BC       = '(BC)',
  DE       = '(DE)',
  HL       = '(HL)',
  HLinc    = '(HL+)',
  HLdec    = '(HL-)',
  SP       = '(SP)',
};

export enum Flag {
  Carry    = 'C',
  NotCarry = 'NC',
  Zero     = 'Z',
  NotZero  = 'NZ',
};

export enum ResetOffset {
  x00 = '00h',
  x08 = '08h',
  x10 = '10h',
  x18 = '18h',
  x20 = '20h',
  x28 = '28h',
  x30 = '30h',
  x38 = '38h',
};

export enum Bit {
  b0 = "0",
  b1 = "1",
  b2 = "2",
  b3 = "3",
  b4 = "4",
  b5 = "5",
  b6 = "6",
  b7 = "7",
}

export type FF_PageC = '(FF00+C)';
