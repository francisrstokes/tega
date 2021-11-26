import { AssemblerOperation, ImmediateValue, SymbolOr, SymbolReference } from "./types";

// Well, I definitely don't have the actual bytes stored in the source code
const nintendoLogo = new Uint8Array([
  0x10, 0x33, 0xb8, 0xb8, 0x12, 0xd3, 0xde, 0xd5, 0xdd, 0xad, 0xde, 0x5d, 0xde, 0xd2, 0xde, 0xd3,
  0xde, 0xd6, 0xcf, 0xc1, 0x56, 0x57, 0xde, 0xd0, 0x02, 0x12, 0xb0, 0x38, 0x03, 0x03, 0x07, 0x47,
  0x65, 0x65, 0xb9, 0xbd, 0xb0, 0xd0, 0x32, 0x12, 0x03, 0x02, 0x47, 0x41, 0x65, 0x67, 0xed, 0xe0,
]).map(x => x ^ 0xDE);

const stringToUint8Array = (s: string) => new Uint8Array(s.split('').map(c => c.charCodeAt(0)));

type RevisitItem = { symbol: SymbolReference, offset: number, size: number };
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

    case "symbolReference": {
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
        const result = resolveSymbol(op.u8, symbols, offset);
        if (result.resolved) {
          buffer[offset] = result.value & 0xff;
        } else {
          revisit.push({ offset, size: 1, symbol: op.u8 as SymbolReference });
        }
        offset += 1;
      } else if ('i8' in op) {
        const result = resolveSymbol(op.i8, symbols, offset);
        if (result.resolved) {
          buffer[offset] = result.value & 0xff;
        } else {
          revisit.push({ offset, size: 1, symbol: op.i8 as SymbolReference });
        }
        offset += 1;
      } else if ('ffPageOffset' in op) {
        const result = resolveSymbol(op.ffPageOffset, symbols, offset);
        if (result.resolved) {
          buffer[offset] = result.value & 0xff;
        } else {
          revisit.push({ offset, size: 1, symbol: op.ffPageOffset as SymbolReference });
        }
        offset += 1;
      } else if ('spOffset' in op) {
        const result = resolveSymbol(op.spOffset, symbols, offset);
        if (result.resolved) {
          buffer[offset] = result.value & 0xff;
        } else {
          revisit.push({ offset, size: 1, symbol: op.spOffset as SymbolReference });
        }
        offset += 1;
      }

      // Two Byte Immediates
      else if ('u16' in op) {
        const result = resolveSymbol(op.u16, symbols, offset);
        if (result.resolved) {
          buffer[offset] = result.value & 0xff;
          buffer[offset + 1] = (result.value >> 8) & 0xff;
        } else {
          revisit.push({ offset, size: 2, symbol: op.u16 as SymbolReference });
        }
        offset += 2;
      } else if ('u16ptr' in op) {
        const result = resolveSymbol(op.u16ptr, symbols, offset);
        if (result.resolved) {
          buffer[offset] = result.value & 0xff;
          buffer[offset + 1] = (result.value >> 8) & 0xff;
        } else {
          revisit.push({ offset, size: 2, symbol: op.u16ptr as SymbolReference });
        }
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

export const assemble = (ops: AssemblerOperation[]) => {
  const ROMBuffer = new Uint8Array(0x8000); // Simple 32kb ROM only (for now)

  const revisit: RevisitQueue = [];
  const symbols: SymbolTable = {};
  let offset = 0;

  for (let op of ops) {
    offset = processOp(op, ROMBuffer, offset, symbols, revisit);
  }

  // Resolve anything that wasn't found during the operations pass
  for (const item of revisit) {
    const result = resolveSymbol(item.symbol, symbols, offset);
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

    if (item.size === 1) {
      ROMBuffer[item.offset] = result.value & 0xff;
    } else {
      ROMBuffer[item.offset] = result.value & 0xff;
      ROMBuffer[item.offset + 1] = (result.value >> 8) & 0xff;
    }
  }

  // Insert header information
  ROMBuffer.set(nintendoLogo, 0x104);
  ROMBuffer.set(stringToUint8Array('TEGA Generated'), 0x134);
  ROMBuffer[0x14A] = 0x01; // Non-Japanese

  // Checksum calculatiion for header
  for (let i = 0x134; i <= 0x14c; i++) {
    ROMBuffer[0x14D] = ROMBuffer[0x14D] - ROMBuffer[i] - 1;
  }

  return ROMBuffer;
};
