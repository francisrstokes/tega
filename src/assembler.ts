import { AssemblerOperation, ImmediateValue, SymbolOr, SymbolReference } from "./types";

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
};

// Well, I definitely don't have the actual bytes stored in the source code
const nintendoLogo = new Uint8Array([
  0x10, 0x33, 0xb8, 0xb8, 0x12, 0xd3, 0xde, 0xd5, 0xdd, 0xad, 0xde, 0x5d, 0xde, 0xd2, 0xde, 0xd3,
  0xde, 0xd6, 0xcf, 0xc1, 0x56, 0x57, 0xde, 0xd0, 0x02, 0x12, 0xb0, 0x38, 0x03, 0x03, 0x07, 0x47,
  0x65, 0x65, 0xb9, 0xbd, 0xb0, 0xd0, 0x32, 0x12, 0x03, 0x02, 0x47, 0x41, 0x65, 0x67, 0xed, 0xe0,
]).map(x => x ^ 0xDE);

const stringToUint8Array = (s: string) => new Uint8Array(s.split('').map(c => c.charCodeAt(0)));

type RevisitItem = { symbol: SymbolReference, offset: number, size: 1 | 2 };
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
  offset: number
): ResolutionResult => {
  if (symbol.type === 'symbolReference') {
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
    const a = resolveSymbol(symbol.symbolA, symbols, offset);
    const b = resolveSymbol(symbol.symbolB, symbols, offset);

    return {
      resolved: a.resolved && b.resolved,
      value: b.value - a.value
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

const processOp = (
  op: AssemblerOperation,
  buffer: Uint8Array,
  offset: number,
  symbols: SymbolTable,
  revisit: RevisitQueue,
) => {
  switch (op.type) {
    case "moveTo": {
      offset = op.address;
      return offset;
    }

    case "inlineBytes": {
      buffer.set(op.bytes, offset);
      offset += op.bytes.byteLength;
      return offset;
    }

    case "symbolDefinition": {
      if (op.value in symbols) {
        // TODO: Improve these errors with positional information
        throw new Error(`Symbol "${op.value}" has already been declared`);
      }
      if (reservedSymbols.includes(op.value)) {
        throw new Error(`Symbol "${op.value}" has reserved`);
      }

      console.log(`${op.value}: 0x${offset.toString(16)}`);

      symbols[op.value] = offset;
      return offset;
    }

    case "opDescription": {
      if (op.isPrefix) {
        buffer[offset++] = 0xCB;
      }
      buffer[offset++] = op.opcode;

      // Can't figure out a straightforward way to group the one and two byte immediate resolutions
      // They only differ by key, the rest of the code block is the same.

      // One Byte immediates
      if ('u8' in op) {
        revisit.push({ offset, size: 1, symbol: op.u8 as SymbolReference });
        offset += 1;
      } else if ('i8' in op) {
        revisit.push({ offset, size: 1, symbol: op.i8 as SymbolReference });
        offset += 1;
      } else if ('ffPageOffset' in op) {
        revisit.push({ offset, size: 1, symbol: op.ffPageOffset as SymbolReference });
        offset += 1;
      } else if ('spOffset' in op) {
        revisit.push({ offset, size: 1, symbol: op.spOffset as SymbolReference });
        offset += 1;
      }
      // Two Byte Immediates
      else if ('u16' in op) {
        revisit.push({ offset, size: 2, symbol: op.u16 as SymbolReference });
        offset += 2;
      } else if ('u16ptr' in op) {
        revisit.push({ offset, size: 2, symbol: op.u16ptr as SymbolReference });
        offset += 2;
      }

      return offset;
    }

    case "compound": {
      for (let compoundOp of op.operations) {
        offset = processOp(compoundOp, buffer, offset, symbols, revisit);
      }
      return offset;
    }
  }
};

export const assemble = (ops: AssemblerOperation[], header: ROMHeader = {}) => {
  const ROMBuffer = new Uint8Array(0x8000); // Simple 32kb ROM only (for now)

  const revisit: RevisitQueue = [];
  const symbols: SymbolTable = {};
  let offset = 0x150;

  for (let op of ops) {
    offset = processOp(op, ROMBuffer, offset, symbols, revisit);
  }

  // Resolve anything that wasn't found during the operations pass
  for (const item of revisit) {
    const result = resolveSymbol(item.symbol, symbols, item.offset);
    if (!result.resolved) {
      if (item.symbol.type === 'symbolReference') {
        throw new Error(`Unable to resolve symbol "${item.symbol.value}"`);
      } else {
        const symbolA = item.symbol.symbolA.value;
        const symbolB = item.symbol.symbolB.value;

        if (!(symbolA in symbols)) {
          throw new Error(`Unable to resolve symbol "${symbolA}"`);
        }
        throw new Error(`Unable to resolve symbol "${symbolB}"`);
      }
    }

    insertBytes(ROMBuffer, item.offset, result.value, item.size);
  }

  // JP $0150
  ROMBuffer.set(new Uint8Array([0xc3, 0x50, 0x01]), 0x100);

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

  // Checksum calculation for header
  for (let i = 0x134; i <= 0x14c; i++) {
    ROMBuffer[0x14D] = ROMBuffer[0x14D] - ROMBuffer[i] - 1;
  }

  // Global checksum calculation
  let checksum = 0;
  for (let i = 0; i <= ROMBuffer.byteLength; i++) {
    checksum += ROMBuffer[i];
  }
  insertBytes(ROMBuffer, 0x14F, checksum & 0xffff, 2);

  return ROMBuffer;
};
