import {
  I8Imm,
  U16Imm,
  U16Ptr,
  U8Imm,
  FFPageOffset,
  SymbolicLabel,
  ByteArray,
  InlineBytes,
  MoveTo,
  SizeOfReference,
  ImmediateKey,
  AssemblerOperation,
  CompoundOperation,
  RelativeToReference
} from "./types";

export const u8 = (value: number): U8Imm => ({ type: ImmediateKey.u8imm, value });
export const i8 = (value: number): I8Imm => ({ type: ImmediateKey.i8imm, value });
export const u16 = (value: number): U16Imm => ({ type: ImmediateKey.u16imm, value });
export const u16ptr = (value: number): U16Ptr => ({ type: ImmediateKey.u16ptr, value });
export const ffPageOffset = (value: number): FFPageOffset => ({ type: ImmediateKey.ffPageOffset, value });
export const label = (value: string): SymbolicLabel => ({ type: 'symbolicLabel', value });
export const inlineBytes = (bytes: ByteArray): InlineBytes => ({ type: 'inlineBytes', bytes });
export const $addr = Object.freeze(label('$addr'));
export const $inst = Object.freeze(label('$instructionAddr'));
export const moveTo = (address: number): MoveTo => ({ type: 'moveTo', address });
export const sizeOf = (symbolA: SymbolicLabel, symbolB: SymbolicLabel): SizeOfReference => ({
  type: 'sizeOfReference',
  symbolA,
  symbolB
});
export const relative = (symbol: SymbolicLabel): RelativeToReference => ({
  type: 'relativeToReference',
  symbol,
});
export const group = (operations: AssemblerOperation[]): CompoundOperation => ({
  type: 'compound',
  operations
});

export type Block = {
  block: CompoundOperation;
  start: SymbolicLabel;
  end: SymbolicLabel;
  size: SizeOfReference;
}
export const block = (
  name: string,
  getOperations: (symbols: Omit<Block, 'block'>) => AssemblerOperation[]
): Block => {
  const start = label(name);
  const end = label(`${name}_end`);
  const size = sizeOf(start, end);

  return {
    start: start,
    end: end,
    size,
    block: group([
      start,
      ...getOperations({ start, end, size }),
      end
    ])
  };
};
