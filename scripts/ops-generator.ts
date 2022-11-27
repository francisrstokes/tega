import * as fs from 'fs/promises';
import * as path from 'path';

const OUTPUT_PATH = path.join(__dirname, '..', 'src', 'ops.ts');

// The idea here is to parse the ops json file from https://github.com/izik1/gbops/
// and automatically generate function definitions that for the assembly DSL.
// The position in the array provides the opcode, and the name provides arguments
// and obviously the instruction name.
// With an instruction like `LD A,u8`, the u8 indicates that we need to take an 8-bit
// numeric argument to the function  (or possibly a symbol/label).

type TimingEntry = {
  Type: string;
  Comment: string;
};

type InstructionEntry = {
  Name: string,
  Group: string,
  TCyclesBranch: number,
  TCyclesNoBranch: number,
  Length: number,
  Flags: {
    Z: string,
    N: string,
    H: string,
    C: string
  },
  TimingNoBranch: TimingEntry[],
  TimingBranch?: TimingEntry[],
};

type OpsJson = {
  Unprefixed: InstructionEntry[];
  CBPrefixed: InstructionEntry[];
};

const is8BitReg = (arg: string) => [
  'A', 'B', 'C', 'D', 'E', 'H', 'L',
].includes(arg);

const is16BitReg = (arg: string) => [
  'BC', 'DE', 'AF', 'SP', 'HL'
].includes(arg);

const is16BitRegPtr = (arg: string) => [
  '(BC)', '(DE)', '(SP)', '(HL)', '(HL+)', '(HL-)'
].includes(arg);

const isFlagCondition = (arg: string) => [
  'NC', 'NZ', 'Z', 'C'
].includes(arg);

const isHexOffset = (arg: string) => [
  '00h', '08h', '10h', '18h',
  '20h', '28h', '30h', '38h',
].includes(arg);

const isBitIndex = (arg: string) => [
  '0', '1', '2', '3', '4', '5', '6', '7'
].includes(arg);

const isU16Imm = (arg: string) => arg === 'u16';
const isU8Imm = (arg: string) => arg === 'u8';
const isI8Imm = (arg: string) => arg === 'i8';
const isImmPtr = (arg: string) => arg === '(u16)';
const isFFPageOffset = (arg: string) => arg === '(FF00+u8)';
const isFFPageC = (arg: string) => arg === '(FF00+C)';
const isSPOffset = (arg: string) => arg === 'SP+i8';
const isCBPrefix = (arg: string) => arg === 'CB';

const getArgTypeName = (arg: string, opName: string) => {
  // We need to disambiguate between registers and flags here
  if (['JP', 'JR', 'CALL', 'RET'].includes(opName) && isFlagCondition(arg)) {
    return 'flagCondition';
  }

  switch (true) {
    case isBitIndex(arg): return 'bitIndex';
    case is8BitReg(arg): return 'reg8';
    case is16BitReg(arg): return 'reg16';
    case is16BitRegPtr(arg): return 'reg16ptr';
    case isU8Imm(arg): return 'u8imm';
    case isU16Imm(arg): return 'u16imm';
    case isImmPtr(arg): return 'u16ptr';
    case isI8Imm(arg): return 'i8imm';
    case isFFPageOffset(arg): return 'ffPageOffset';
    case isFFPageC(arg): return 'ffPageC';
    case isSPOffset(arg): return 'spOffset';
    case isFlagCondition(arg): return 'flagCondition';
    case isHexOffset(arg): return 'hexOffset';
    case isCBPrefix(arg): return 'CBPrefix';

    default: throw new Error(`Not implemented: ${arg}`);
  }
}

const groupBy = <T>(keyFn: (x: T) => string, arr: T[]): Record<string, T[]> => {
  const out: Record<string, T[]> = {};

  arr.forEach(x => {
    const key = keyFn(x);
    if (!(key in out)) {
      out[key] = [];
    }
    out[key].push(x);
  });

  return out;
}

const mapObjValues = <T, R>(fn: (x: T) => R, obj: Record<string, T>): Record<string, R> => {
  return Object.fromEntries(Object.entries(obj).map(([key, value]) => [key, fn(value)]));
}

const toHex = (opcode: number) => `0x${opcode.toString(16).padStart(2, '0')}`;

const toArgName = (argType: string, position: 'a' | 'b') => {
  switch (argType) {
    case 'bitIndex': return `bitIndex`;
    case 'reg8': return `r8${position}`;
    case 'reg16': return `r16${position}`;
    case 'reg16ptr': return `r16ptr${position}`;
    case 'u8imm': return `u8`;
    case 'u16imm': return `u16`;
    case 'u16ptr': return `u16ptr`;
    case 'i8imm': return `i8`;
    case 'ffPageOffset': return `ffPageOffset`;
    case 'ffPageC': return `ffPageC`;
    case 'spOffset': return `spOffset`;
    case 'flagCondition': return `flag`;
    case 'hexOffset': return `offset`;

    default: throw new Error(`Not implemented: ${argType}`);
  }
}

const isAllReg8 = (regs: string[]) => {
  const regsCopy = [...regs];
  const asStr = regsCopy.sort().join('');
  return asStr === 'ABCDEHL';
}

const instRegex = /^([A-Z]+)(?:\s(?:(.+),)?(.+)?)?$/g;
const getInstructionParts = (instruction: string) => {
  let m;
  const groups: string[] = [];

  while ((m = instRegex.exec(instruction)) !== null) {
    if (m.index === instRegex.lastIndex) {
      instRegex.lastIndex++;
    }
    groups.push(...m.slice(1));
  }

  instRegex.lastIndex = 0;
  return groups.filter(x => typeof x !== 'undefined');
}

const immToTypeName = (immOrPtr: string) => {
  switch (immOrPtr) {
    case 'u8imm':         return `SymbolOr<U8Imm>`;
    case 'u16imm':        return `SymbolOr<U16Imm>`;
    case 'u16ptr':        return `SymbolOr<U16Ptr>`;
    case 'i8imm':         return `SymbolOr<I8Imm>`;
    case 'ffPageOffset':  return `SymbolOr<FFPageOffset>`;
    case 'spOffset':      return `SymbolOr<SPOffset>`;

    default: throw new Error(`Not implemented: ${immOrPtr}`);
  }
}

const generateFunctions = (fnGroup: Record<string, [string[], number][]>, isPrefix: boolean) => {
  const fnName = Object.values(fnGroup)[0][0][0][0]; // 😵
  const minArgs = Object.keys(fnGroup)
    .map(pair => pair === 'noArgs' ? 0 : pair.split(',').length)
    .reduce((a, b) => Math.min(a, b));

  const signatures: string[] = [];
  const mainFnLines: string[] = [];

  Object.entries(fnGroup).forEach(([argTypeStr, fns]) => {
    const argTypes = argTypeStr.split(',');

    if (argTypes[0] === 'noArgs') {
      const opcode = fns[0][1];
      signatures.push(`export function ${fnName}(): OpDescription;`);
      mainFnLines.push(`if (arguments.length === 0) return { type: 'opDescription', opcode: ${toHex(opcode)}, isPrefix: ${isPrefix} };`);
    } else if (argTypes.length === 1) {
      mainFnLines.push('if (arguments.length === 1) {');
      if (['i8imm', 'u16imm'].includes(argTypes[0])) {
        fns.forEach(([_, opcode]) => {
          const argA = toArgName(argTypes[0], 'a');
          const argAType = immToTypeName(argTypes[0]);

          signatures.push(`export function ${fnName}(${argA}: ${argAType}): OpDescription;`);
          mainFnLines.push(
            `  if (a0.type === '${argTypes[0]}' || isSymbolRef(a0.type)) {`,
            `    return { type: 'opDescription', opcode: ${toHex(opcode)}, ${argA}: a0, isPrefix: ${isPrefix} };`,
            `  }`
          );
        });
      } else if (['reg8', 'reg16', 'reg16ptr', 'hexOffset', 'flagCondition'].includes(argTypes[0])) {
        fns.forEach(([[_, arg0], opcode]) => {
          const argA = toArgName(argTypes[0], 'a');

          signatures.push(`export function ${fnName}(${argA}: '${arg0}'): OpDescription;`);
          mainFnLines.push(`  if (a0 === '${arg0}') return { type: 'opDescription', opcode: ${toHex(opcode)}, isPrefix: ${isPrefix} };`);
        });
      } else {
        debugger;
      }
      mainFnLines.push('}');
    } else if (argTypes.length === 2) {
      const groupedByArg0 = groupBy(([opParts]) => opParts[1], fns);

      mainFnLines.push('if (arguments.length === 2) {');

      const allowedArg0s = Object.keys(groupedByArg0);

      // Check for special cases where we can have the most generic implementation
      // e.g. LD(Reg8, Reg8)
      if (argTypes[0] === 'reg8' && argTypes[1] === 'reg8') {
        const arg0IsGeneric = isAllReg8(allowedArg0s);

        if (arg0IsGeneric) {
          const opsPerArg0 = groupedByArg0[allowedArg0s[0]];
          const allowedArg1s = opsPerArg0.map(([parts]) => parts[2]);
          const arg1IsGeneric = isAllReg8(allowedArg1s);
          if (arg0IsGeneric && arg1IsGeneric) {
            // emit a generic signature
            const argA = toArgName('reg8', 'a');
            const argB = toArgName('reg8', 'b');
            signatures.push(`export function ${fnName}(${argA}: Reg8, ${argB}: Reg8): OpDescription;`);
          }
        }
      }

      allowedArg0s.forEach(arg0 => {
        const opsPerArg0 = groupedByArg0[arg0];
        const allowedArg1s = opsPerArg0.map(([parts]) => parts[2]);
        const arg1Union = allowedArg1s.map(x => `'${x}'`).join(' | ');
        const argA = toArgName(argTypes[0], 'a');
        const argB = toArgName(argTypes[1], 'b');

        if (
          (argTypes[0] === 'reg16' && argTypes[1] === 'reg16')
          || (argTypes[0] === 'reg8' && argTypes[1] === 'reg8')
          || (argTypes[0] === 'reg8' && argTypes[1] === 'reg16ptr')
          || (argTypes[0] === 'reg16ptr' && argTypes[1] === 'reg8')
          || (argTypes[0] === 'ffPageC' && argTypes[1] === 'reg8')
          || (argTypes[0] === 'reg8' && argTypes[1] === 'ffPageC')
          || (argTypes[0] === 'bitIndex' && argTypes[1] === 'reg8')
          || (argTypes[0] === 'bitIndex' && argTypes[1] === 'reg16ptr')
        ) {
          signatures.push(`export function ${fnName}(${argA}: '${arg0}', ${argB}: ${arg1Union}): OpDescription;`);

          mainFnLines.push(`  if (a0 === '${arg0}') {`);
          opsPerArg0.forEach(([[_, __, arg1], opcode]) => {
            mainFnLines.push(
              `    if (a1 === '${arg1}') return { type: 'opDescription', opcode: ${toHex(opcode)}, isPrefix: ${isPrefix} };`,
            );
          });
          mainFnLines.push('  }');
        } else if (
          (argTypes[0] === 'reg8' && argTypes[1] === 'u8imm')
          || (argTypes[0] === 'reg16' && argTypes[1] === 'i8imm')
          || (argTypes[0] === 'reg8' && argTypes[1] === 'u16imm')
          || (argTypes[0] === 'reg16' && argTypes[1] === 'u16imm')
          || (argTypes[0] === 'reg16ptr' && argTypes[1] === 'u8imm')
          || (argTypes[0] === 'reg8' && argTypes[1] === 'ffPageOffset')
          || (argTypes[0] === 'flagCondition' && argTypes[1] === 'u16imm')
          || (argTypes[0] === 'flagCondition' && argTypes[1] === 'i8imm')
          || (argTypes[0] === 'reg8' && argTypes[1] === 'u16ptr')
          || (argTypes[0] === 'reg16' && argTypes[1] === 'spOffset')
        ) {
          signatures.push(`export function ${fnName}(${argA}: '${arg0}', ${argB}: ${immToTypeName(argTypes[1])}): OpDescription;`);
          const opcode = opsPerArg0[0][1];

          mainFnLines.push(
            `  if (a0 === '${arg0}' && (a1.type === '${argTypes[1]}' || isSymbolRef(a1.type))) {`,
            `    return { type: 'opDescription', opcode: ${toHex(opcode)}, ${argB}: a1, isPrefix: ${isPrefix} };`,
            '  }'
          );
        } else if (
          (argTypes[0] === 'u16ptr' && argTypes[1] === 'reg16')
          || (argTypes[0] === 'u16ptr' && argTypes[1] === 'reg8')
          || (argTypes[0] === 'ffPageOffset' && argTypes[1] === 'reg8')
        ) {
          signatures.push(`export function ${fnName}(${argA}: ${immToTypeName(argTypes[0])}, ${argB}: ${arg1Union}): OpDescription;`);
          const opcode = opsPerArg0[0][1];

          allowedArg1s.forEach(arg1 => {
            mainFnLines.push(
              `  if ((a0.type === '${argTypes[0]}' || isSymbolRef(a0.type)) && a1 === '${arg1}') {`,
              `    return { type: 'opDescription', opcode: ${toHex(opcode)}, ${argA}: a0, isPrefix: ${isPrefix} };`,
              '  }'
            );
          });
        } else {
          debugger;
        }
      });
      mainFnLines.push('}');
    }
  });

  const mainFnDecl = signatures.length === 1
    ? signatures.pop()?.replace(';', ' {')
    : `export function ${fnName}(a0${minArgs < 1 ? '?' : ''}: any, a1${minArgs < 2 ? '?' : ''}: any): OpDescription {`;

  const fnDef = [
    mainFnDecl,
    mainFnLines.map(line => '  ' + line).join('\n'),
    `  throw new Error('${fnName}: Invalid argument combination provided');`,
    '}',
  ].join('\n');

  return [
    ...signatures,
    fnDef
  ].join('\n');
};

const typeImports = [
  'import {',
  '  FFPageOffset,',
  '  I8Imm,',
  '  OpDescription,',
  '  SPOffset,',
  '  SymbolOr,',
  '  U16Imm,',
  '  U16Ptr,',
  '  U8Imm,',
  '  Reg8,',
  '} from "./types";',
  '',
].join('\n');

const fns = [
  'const isSymbolRef = (x: string) => [',
  '  "symbolicLabel",',
  '  "sizeOfReference",',
  '  "relativeToReference",',
  '].includes(x);',
  ''
].join('\n');

const autogenMessage = [
  `// =============================================================================`,
  `// TEGA: TypeScript Embedded GameBoy Macro Assembler`,
  `//`,
  `// This file is autogenerated - do not edit by hand.`,
  `// Instead edit ${path.basename(__filename)} and run "npm run generate"`,
  `// =============================================================================`,
  '',
].join('\n');

const main = async () => {
  const ops: OpsJson = JSON.parse(await fs.readFile(path.join(__dirname, '..', 'dmgops.json'), { encoding: 'utf-8' }));

  const grouped = groupBy(
    op => op[0][0],
    ops.Unprefixed.map<[string[], number]>((x, i) => [getInstructionParts(x.Name), i])
  );

  const groupedCB = groupBy(
    op => op[0][0],
    ops.CBPrefixed.map<[string[], number]>((x, i) => [getInstructionParts(x.Name), i])
  );

  const groupOnArg0 = (instrs: [string[], number][]) => groupBy(([inst]) => {
    const [opName, arg0, arg1] = inst;
    const numArgs = inst.length - 1;

    if (numArgs === 0) return 'noArgs';
    if (numArgs === 1) return getArgTypeName(arg0, opName);
    return `${getArgTypeName(arg0, opName)},${getArgTypeName(arg1, opName)}`;
  }, instrs);

  const groupedGroups = mapObjValues(groupOnArg0, grouped);
  const groupedCBGroups = mapObjValues(groupOnArg0, groupedCB);

  // These can be handled independantly
  delete groupedGroups['PREFIX'];

  // These should be added later as the undocumented instructions
  delete groupedGroups['UNUSED'];

  const generatedBaseAPI = Object.values(groupedGroups)
    .map(fnGroup => generateFunctions(fnGroup, false))
    .join('\n\n');
  const generatedCBAPI = Object.values(groupedCBGroups)
    .map(fnGroup => generateFunctions(fnGroup, true))
    .join('\n\n');

  const file = [
    autogenMessage,
    typeImports,
    fns,
    generatedBaseAPI,
    generatedCBAPI,
  ].join('\n');

  return fs.writeFile(OUTPUT_PATH, file);
};

main();
