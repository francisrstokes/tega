import {
  I8Imm,
  U16Imm,
  U16Ptr,
  U8Imm,
  FFPageOffset,
  BaseSymbolReference,
  ByteArray,
  SymbolOr,
  InlineBytes,
  MoveTo,
  SizeOfReference,
  ImmediateKey,
  AssemblerOperation,
  CompoundOperation,
  SymbolDefinition
} from "./types";

export const u8 = (value: number): U8Imm => ({ type: ImmediateKey.u8imm, value });
export const i8 = (value: number): I8Imm => ({ type: ImmediateKey.i8imm, value });
export const u16 = (value: number): U16Imm => ({ type: ImmediateKey.u16imm, value });
export const u16ptr = (value: number): U16Ptr => ({ type: ImmediateKey.u16ptr, value });
export const ffPageOffset = (value: number): FFPageOffset => ({ type: ImmediateKey.ffPageOffset, value });
export const symbol = (value: string): BaseSymbolReference => ({ type: 'symbolReference', value });
export const label = (value: string): SymbolDefinition => ({ type: 'symbolDefinition', value });
export const inlineBytes = (bytes: ByteArray): InlineBytes => ({ type: 'inlineBytes', bytes });
export const $addr: BaseSymbolReference = Object.freeze({type: 'symbolReference', value: '$currentAddress' });
export const moveTo = (address: number): MoveTo => ({ type: 'moveTo', address });
export const sizeOf = (symbolA: BaseSymbolReference, symbolB: BaseSymbolReference): SizeOfReference => ({
  type: 'sizeOfReference',
  symbolA,
  symbolB
});

export const symbolFromLabel = (s: SymbolDefinition): BaseSymbolReference => ({ type: 'symbolReference', value: s.value });

export type Block = {
  block: CompoundOperation;
  start: BaseSymbolReference;
  end: BaseSymbolReference;
  size: SizeOfReference;
}
export const block = (
  name: string,
  getOperations: (symbols: Omit<Block, 'block'>) => AssemblerOperation[]
): Block => {
  const startLabel = label(name);
  const endLabel = label(`${name}_end`);

  const start = symbolFromLabel(startLabel);
  const end = symbolFromLabel(endLabel);

  const size = sizeOf(start, end);
  return {
    start: start,
    end: end,
    size,
    block: { type: 'compound', operations: [
      startLabel,
      ...getOperations({ start, end, size }),
      endLabel
    ] }
  };
};
