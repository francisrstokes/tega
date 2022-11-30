import { AssemblerOperation, ImmediateValue, SymbolicLabel, SymbolOr, SymbolReference } from "./types";

export enum CGBFlag {
  NoSupport = 0x00,
  CGBPlusGB = 0x80,
  CGBOnly   = 0xC0,
}
export enum SGBFlag {
  NoSupport    = 0x00,
  SGBFunctions = 0x03,
}
export enum CartridgeType {
  ROMOnly = 0x00
}
export enum ROMSize {
  s32KB = 0x00
}
export enum RAMSize {
  sZero = 0x00
}
export enum DestinationCode {
  Japanese    = 0x00,
  NonJapanese = 0x01,
}
export type ROMHeader = {
  title?: string;
  CGB?: CGBFlag;
  newLicenseeCode?: number;
  SGB?: SGBFlag;
  cartridgeType?: CartridgeType;
  ROMSize?: ROMSize;
  RAMSize?: RAMSize;
  destinationCode?: DestinationCode;
  oldLicenseeCode?: number;
  maskROMVersion?: number;
  useManualCartHeader?: boolean;
  useManualChecksums?: boolean;
};

export type VectorTable = {
  VBlank?: SymbolicLabel;
  Stat?: SymbolicLabel;
  Timer?: SymbolicLabel;
  Serial?: SymbolicLabel;
  Joypad?: SymbolicLabel;
};

const interruptVectorAddress: Record<keyof VectorTable, number> = {
  VBlank: 0x0040,
  Stat:   0x0048,
  Timer:  0x0050,
  Serial: 0x0058,
  Joypad: 0x0060,
};

// Well, I definitely don't have the actual bytes stored in the source code
export const nintendoLogo = new Uint8Array([
  0x10, 0x33, 0xb8, 0xb8, 0x12, 0xd3, 0xde, 0xd5, 0xdd, 0xad, 0xde, 0x5d, 0xde, 0xd2, 0xde, 0xd3,
  0xde, 0xd6, 0xcf, 0xc1, 0x56, 0x57, 0xde, 0xd0, 0x02, 0x12, 0xb0, 0x38, 0x03, 0x03, 0x07, 0x47,
  0x65, 0x65, 0xb9, 0xbd, 0xb0, 0xd0, 0x32, 0x12, 0x03, 0x02, 0x47, 0x41, 0x65, 0x67, 0xed, 0xe0,
]).map(x => x ^ 0xDE);

export const stringToUint8Array = (s: string) => new Uint8Array(s.split('').map(c => c.charCodeAt(0)));

type RevisitItem = {
  symbol: SymbolReference;
  useVirtualOffset: boolean;
  virtualOffset: number;
  itemOffset: number;
  itemSize: 1 | 2;
  opcodeSize: 1 | 2;
};
type SymbolTable = Record<string, number>;
type RevisitQueue = Array<RevisitItem>;
type ResolutionResult = {
  resolved: boolean;
  value: number;
}

const reservedSymbols = ['$addr', '$instructionAddr'];

const resolveSymbol = (
  symbol: SymbolOr<ImmediateValue>,
  symbols: SymbolTable,
  offset: number,
  opcodeSize: number,
): ResolutionResult => {
  if (symbol.type === 'symbolicLabel') {
    // Builtins
    switch (symbol.value) {
      case '$addr':             return { resolved: true, value: offset };
      case '$instructionAddr':  return { resolved: true, value: offset - 1 }
    }

    return {
      resolved: symbol.value in symbols,
      value: symbols[symbol.value] ?? 0
    };
  } else if (symbol.type === 'sizeOfReference') {
    const a = resolveSymbol(symbol.symbolA, symbols, offset, opcodeSize);
    const b = resolveSymbol(symbol.symbolB, symbols, offset, opcodeSize);

    return {
      resolved: a.resolved && b.resolved,
      value: b.value - a.value
    };
  } else if (symbol.type === 'relativeToReference') {
    const symbolLoc = resolveSymbol(symbol.symbol, symbols, offset, opcodeSize);
    return {
      resolved: symbolLoc.resolved,
      value: symbolLoc.value - offset - opcodeSize
    };
  } else {
    return {
      resolved: true,
      value: symbol.value
    };
  }
};

const insertBytes = (
  buffer: Uint8Array,
  address: number,
  value: number,
  size: 1 | 2
) => {
  if (size === 1) {
    buffer[address] = value & 0xff;
  } else {
    buffer[address] = value & 0xff;
    buffer[address + 1] = (value >> 8) & 0xff;
  }
};

const incrementOffset = (state: AssemblerState, amount = 1) => {
  state.offset += amount;
  state.virtualOffset += amount;
}

const alignTo = (offset: number, alignment: number) => {
  return (offset - 1 + alignment) & -alignment;
};

const processOp = (
  op: AssemblerOperation,
  buffer: Uint8Array,
  state: AssemblerState
) => {
  switch (op.type) {
    case "offsetControl": {
      state.offset = op.address;
    } break;

    case "alignOffsetControl": {
      state.offset = alignTo(state.offset, op.alignment);
      state.virtualOffset = alignTo(state.virtualOffset, op.alignment);
    } break;

    case "virtualOffsetControl": {
      if (op.useROMOffset) {
        state.useVirtualOffset = false;
      } else {
        state.useVirtualOffset = true;
        state.virtualOffset = op.address;
      }
    } break;

    case "inlineBytes": {
      buffer.set(op.bytes, state.offset);
      incrementOffset(state, op.bytes.byteLength);
    } break;

    case "symbolicLabel": {
      if (op.value in state.symbols) {
        // TODO: Improve these errors with positional information
        throw new Error(`Symbol "${op.value}" has already been declared`);
      }
      if (reservedSymbols.includes(op.value)) {
        throw new Error(`Symbol "${op.value}" has reserved`);
      }

      const labelOffset = state.useVirtualOffset
        ? state.virtualOffset
        : state.offset;

      if (!op.value.startsWith('__discard')) {
        console.log(`${op.value.padEnd(30, ' ')} 0x${labelOffset.toString(16)}`);
      }

      state.symbols[op.value] = labelOffset;
    } break;

    case "opDescription": {
      let opcodeSize: RevisitItem["opcodeSize"] = 1;
      if (op.isPrefix) {
        buffer[state.offset] = 0xCB;
        incrementOffset(state);
        opcodeSize = 2;
      }
      buffer[state.offset] = op.opcode;
      incrementOffset(state);

      // Can't figure out a straightforward way to group the one and two byte immediate resolutions
      // They only differ by key, the rest of the code block is the same.

      const revisit: Omit<RevisitItem, 'symbol' | 'itemSize'> = {
        itemOffset: state.offset,
        virtualOffset: state.virtualOffset,
        useVirtualOffset: state.useVirtualOffset,
        opcodeSize,
      };

      // One Byte immediates
      if ('u8' in op) {
        state.revisit.push({ ...revisit, itemSize: 1, symbol: op.u8 as SymbolReference });
        incrementOffset(state);
      } else if ('i8' in op) {
        state.revisit.push({ ...revisit, itemSize: 1, symbol: op.i8 as SymbolReference });
        incrementOffset(state);
      } else if ('ffPageOffset' in op) {
        state.revisit.push({ ...revisit, itemSize: 1, symbol: op.ffPageOffset as SymbolReference });
        incrementOffset(state);
      } else if ('spOffset' in op) {
        state.revisit.push({ ...revisit, itemSize: 1, symbol: op.spOffset as SymbolReference });
        incrementOffset(state);
      }
      // Two Byte Immediates
      else if ('u16' in op) {
        state.revisit.push({ ...revisit, itemSize: 2, symbol: op.u16 as SymbolReference });
        incrementOffset(state, 2);
      } else if ('u16ptr' in op) {
        state.revisit.push({ ...revisit, itemSize: 2, symbol: op.u16ptr as SymbolReference });
        incrementOffset(state, 2);
      }
    } break;

    case "compound": {
      for (let compoundOp of op.operations) {
        processOp(compoundOp, buffer, state);
      }
    } break;
  }
};

const symbolsToSymFile = (symbols: SymbolTable) => {
  // Format the symbol table to a .sym file
  return Object.entries(symbols)
  .filter(([name]) => !(name.startsWith('__discard') || name.endsWith('_end')))
  .map(([name, offset]) => {
    return `${offset.toString(16).padStart(4, '0')} ${name}`;
  })
  .join('\n');
}

const unconditionalJumpBuffer = (address: number) => new Uint8Array([0xc3, (address & 0xff), (address >> 8)]);

type AssemblerState = {
  revisit: RevisitQueue;
  symbols: SymbolTable;
  offset: number;
  virtualOffset: number;
  useVirtualOffset: boolean;
}
export const assemble = (ops: AssemblerOperation[], header: ROMHeader = {}, vectorTable: VectorTable = {}) => {
  const ROMBuffer = new Uint8Array(0x8000); // Simple 32kb ROM only (for now)

  const state: AssemblerState = {
    offset: header?.useManualCartHeader ? 0x0000 : 0x0150,
    virtualOffset: 0x0000,
    useVirtualOffset: false,
    symbols: {},
    revisit: [],
  };

  for (let op of ops) {
    processOp(op, ROMBuffer, state);
  }

  // Resolve anything that wasn't found during the operations pass
  for (const item of state.revisit) {
    const offset = item.useVirtualOffset
      ? item.virtualOffset
      : item.itemOffset;

    const result = resolveSymbol(item.symbol, state.symbols, offset, item.opcodeSize);
    if (!result.resolved) {
      if (item.symbol.type === 'symbolicLabel') {
        throw new Error(`Unable to resolve symbol "${item.symbol.value}"`);
      } else if (item.symbol.type === 'sizeOfReference') {
        const symbolA = item.symbol.symbolA.value;
        const symbolB = item.symbol.symbolB.value;

        if (!(symbolA in state.symbols)) {
          throw new Error(`Unable to resolve symbol "${symbolA}"`);
        }
        throw new Error(`Unable to resolve symbol "${symbolB}"`);
      } else if (item.symbol.type === 'relativeToReference') {
        throw new Error(`Unable to resolve referenced relative symbol "${item.symbol.symbol.value}"`);
      }
    }

    insertBytes(ROMBuffer, item.itemOffset, result.value, item.itemSize);
  }

  if (!header?.useManualCartHeader) {
    // JP $0150
    ROMBuffer.set(unconditionalJumpBuffer(0x0150), 0x100);

    // Insert header information
    ROMBuffer.set(nintendoLogo, 0x104);
    ROMBuffer.set(stringToUint8Array(header.title ?? 'TEGA Generated'), 0x134);
    ROMBuffer[0x143] = header.CGB ?? CGBFlag.NoSupport;
    insertBytes(ROMBuffer, 0x144, header.newLicenseeCode ?? 0, 2);
    ROMBuffer[0x146] = header.SGB ?? SGBFlag.NoSupport;
    ROMBuffer[0x147] = header.cartridgeType ?? CartridgeType.ROMOnly;
    ROMBuffer[0x148] = header.ROMSize ?? ROMSize.s32KB;
    ROMBuffer[0x149] = header.RAMSize ?? RAMSize.sZero;
    ROMBuffer[0x14A] = header.destinationCode ?? DestinationCode.NonJapanese;
    ROMBuffer[0x14B] = header.SGB ? 0x33 : header.newLicenseeCode ?? 0;
    ROMBuffer[0x14C] = header.maskROMVersion ?? 0;
  }

  for (const [vector, label] of Object.entries(vectorTable)) {
    // Attempt to resolve the label value
    const jumpAddress = resolveSymbol(label, state.symbols, 0, 0);
    if (!jumpAddress.resolved) {
      throw new Error(`Unable to interrupt vector [${vector}] symbol "${label.value}"`);
    }

    const vectorAddress = interruptVectorAddress[vector as keyof VectorTable];
    ROMBuffer.set(unconditionalJumpBuffer(jumpAddress.value), vectorAddress);
  }

  if (!header?.useManualChecksums) {
    // Checksum calculation for header
    for (let i = 0x134; i <= 0x14c; i++) {
      ROMBuffer[0x14D] = ROMBuffer[0x14D] - ROMBuffer[i] - 1;
    }

    // Global checksum calculation
    let checksum = 0;
    for (let i = 0; i < ROMBuffer.byteLength; i++) {
      checksum += ROMBuffer[i];
    }
    checksum & 0xffff;
    ROMBuffer[0x14E] = checksum >> 8;
    ROMBuffer[0x14F] = checksum & 0xff;
  }

  // Remove discarded symbols
  const symbolKeys = Object.keys(state.symbols).filter(key =>
    key.includes('__discard')
  );
  for (const key of symbolKeys) {
    delete state.symbols[key];
  }

  return {
    buffer: ROMBuffer,
    symbols: state.symbols,
    formattedSym: symbolsToSymFile(state.symbols),
    finalOffset: state.offset,
  };
};
