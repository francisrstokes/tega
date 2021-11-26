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
  CompoundOperation
} from "./types";

export const u8 = (value: number): U8Imm => ({ type: ImmediateKey.u8imm, value });
export const i8 = (value: number): I8Imm => ({ type: ImmediateKey.i8imm, value });
export const u16 = (value: number): U16Imm => ({ type: ImmediateKey.u16imm, value });
export const u16ptr = (value: number): U16Ptr => ({ type: ImmediateKey.u16ptr, value });
export const ffPageOffset = (value: number): FFPageOffset => ({ type: ImmediateKey.ffPageOffset, value });
export const symbol = (value: string): BaseSymbolReference => ({ type: 'symbolReference', value });
export const inlineBytes = (bytes: ByteArray): InlineBytes => ({ type: 'inlineBytes', bytes });
export const $addr: BaseSymbolReference = Object.freeze({type: 'symbolReference', value: '$currentAddress' });
export const moveTo = (address: number): MoveTo => ({ type: 'moveTo', address });
export const sizeOf = (symbolA: BaseSymbolReference, symbolB: BaseSymbolReference): SizeOfReference => ({
  type: 'sizeOfReference',
  symbolA,
  symbolB
});


export type Subroutine = {
  label: BaseSymbolReference;
  endLabel: BaseSymbolReference;
  size: SizeOfReference;
  subroutine: CompoundOperation;
}
export const subroutine = (
  name: string,
  getOperations: (symbols: Omit<Subroutine, 'subroutine'>) => AssemblerOperation[]
): Subroutine => {
  const label = symbol(name);
  const endLabel = symbol(`${name}_end`);
  const size = sizeOf(label, endLabel);
  return {
    label,
    endLabel,
    size,
    subroutine: { type: 'compound', operations: [
      label,
      ...getOperations({ label, endLabel, size }),
      endLabel
    ] }
  };
};
