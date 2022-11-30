import { RET } from "./ops";
import {
  I8Imm,
  U16Imm,
  U16Ptr,
  U8Imm,
  FFPageOffset,
  SymbolicLabel,
  ByteArray,
  InlineBytes,
  OffsetControl,
  SizeOfReference,
  ImmediateKey,
  AssemblerOperation,
  CompoundOperation,
  RelativeToReference,
  VirtualOffsetControl,
  AlignOffsetControl
} from "./types";

export const u8 = (value: number): U8Imm => ({ type: ImmediateKey.u8imm, value });
export const i8 = (value: number): I8Imm => ({ type: ImmediateKey.i8imm, value });
export const u16 = (value: number): U16Imm => ({ type: ImmediateKey.u16imm, value });
export const u16ptr = (value: number): U16Ptr => ({ type: ImmediateKey.u16ptr, value });
export const addr = u16ptr;
export const ffPageOffset = (value: number): FFPageOffset => ({ type: ImmediateKey.ffPageOffset, value });
export const label = (value: string): SymbolicLabel => ({ type: 'symbolicLabel', value });
export const inlineBytes = (bytes: ByteArray): InlineBytes => ({ type: 'inlineBytes', bytes });
export const $addr = Object.freeze(label('$addr'));
export const $inst = Object.freeze(label('$instructionAddr'));
export const setOffset = (address: number): OffsetControl => ({ type: 'offsetControl', address });
export const alignOffset = (alignment: number): AlignOffsetControl => ({ type: 'alignOffsetControl', alignment });
export const sizeOf = (symbolA: SymbolicLabel, symbolB: SymbolicLabel): SizeOfReference => ({
  type: 'sizeOfReference',
  symbolA,
  symbolB
});
export const relative = (symbol: SymbolicLabel): RelativeToReference => ({
  type: 'relativeToReference',
  symbol,
});
export const inline = (operations: AssemblerOperation[]): CompoundOperation => ({
  type: 'compound',
  operations
});

const virtualSpace = (address: number): VirtualOffsetControl => ({ type: "virtualOffsetControl", address, useROMOffset: false });
const romSpace = (): VirtualOffsetControl => ({ type: "virtualOffsetControl", address: 0, useROMOffset: true });
export const virtualOffset = (address: number, ops: AssemblerOperation[]): CompoundOperation => inline([
  virtualSpace(address),
  ...ops,
  romSpace()
]);

export const scope = (name: string, ops: AssemblerOperation[], discardSymbols = false) => {
  const prefix = `${discardSymbols ? '__discard_' : ''}${name}`;
  const labelsInScope: Record<string, true> = {};

  const prefixed = (label: string) => `${prefix}_${label}`;

  const process = {
    transformSymbol: (symbol: SymbolicLabel | RelativeToReference | SizeOfReference) => {
      switch (symbol.type) {
        case "symbolicLabel": {
          if (symbol.value in labelsInScope) {
            symbol.value = prefixed(symbol.value);
          }
        } break;

        case "sizeOfReference": {
          process.transformSymbol(symbol.symbolA);
          process.transformSymbol(symbol.symbolB);
        } break;

        case "relativeToReference": {
          process.transformSymbol(symbol.symbol);
        } break;
      }
    },
    recurseThroughOps: (op: AssemblerOperation) => {
      switch (op.type) {
        case "compound": {
          op.operations.forEach(process.recurseThroughOps);
        } break;

        case "opDescription": {
          if ('u8' in op && op.u8.type !== ImmediateKey.u8imm) {
            process.transformSymbol(op.u8);
          }
          if ('i8' in op && op.i8.type !== ImmediateKey.i8imm) {
            process.transformSymbol(op.i8);
          }
          if ('u16' in op && op.u16.type !== ImmediateKey.u16imm) {
            process.transformSymbol(op.u16);
          }
          if ('u16ptr' in op && op.u16ptr.type !== ImmediateKey.u16ptr) {
            process.transformSymbol(op.u16ptr);
          }
          if ('ffPageOffset' in op && op.ffPageOffset.type !== ImmediateKey.ffPageOffset) {
            process.transformSymbol(op.ffPageOffset);
          }
          if ('spOffset' in op && op.spOffset.type !== ImmediateKey.spOffset) {
            process.transformSymbol(op.spOffset);
          }
        } break;

        case "symbolicLabel":
        case "alignOffsetControl":
        case "virtualOffsetControl":
        case "offsetControl":
        case "inlineBytes": {
          // Do nothing
        } break;
      }
    },
    findLabels: (op: AssemblerOperation) => {
      switch (op.type) {
        case "compound": {
          op.operations.forEach(process.findLabels);
        } break;

        case "symbolicLabel": {
          labelsInScope[op.value] = true;
          op.value = prefixed(op.value);
        } break;

        case "opDescription":
        case "alignOffsetControl":
        case "virtualOffsetControl":
        case "offsetControl":
        case "inlineBytes": {
          // Do nothing
        } break;
      }
    }
  }

  ops.forEach(process.findLabels);
  ops.forEach(process.recurseThroughOps);
  return inline(ops);
}


export const unnamedScope = (ops: AssemblerOperation[]) => {
  const name = Math.random().toString(36).slice(2);
  return scope(name, ops, true);
}

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
    block: inline([
      start,
      ...getOperations({ start, end, size }),
      end
    ])
  };
};

export type FnBlock = {
  block: CompoundOperation;
  start: SymbolicLabel;
  end: SymbolicLabel;
  returnLabel: SymbolicLabel;
  size: SizeOfReference;
}
export const fn = (
  name: string,
  getOperations: (symbols: Omit<Block, 'block'>) => AssemblerOperation[]
): FnBlock => {
  const start = label(name);
  const end = label(`${name}_end`);
  const ret = label(`${name}_ret`);
  const size = sizeOf(start, end);

  return {
    start: start,
    end: end,
    size,
    returnLabel: ret,
    block: inline([
      start,
      ...getOperations({ start, end, size }),
      ret,
      RET(),
      end,
    ])
  };
}