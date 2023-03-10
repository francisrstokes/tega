import * as fs from 'fs';
import * as path from 'path';

import { assemble } from "../assembler";
import { rNR52 } from '../hardware-inc';
import { CALL, JP, LD, XOR } from '../ops';
import { memcpy } from '../std';
import { AssemblerOperation, Reg8 } from "../types";
import { addr } from '../utils';
import { copyFunctionsToRAM, dumpROM, romDumperFunctions } from './rom-dumper';

const ROM_NAME = 'ROM_Dump';
const BUILD_PATH = path.join(__dirname, 'build');

const program: AssemblerOperation[] = [
  // Turn off audio
  XOR(Reg8.A, Reg8.A),
  LD(addr(rNR52), Reg8.A),

  // Copy code to RAM
  CALL(copyFunctionsToRAM.start),

  // Jump to the RAM code
  JP(dumpROM.start),

  // ----------------------------------

  romDumperFunctions,
  memcpy.block,
];

const result = assemble(program, {
  title: ROM_NAME
});

fs.mkdirSync(BUILD_PATH, { recursive: true });
fs.writeFileSync(path.join(BUILD_PATH, `${ROM_NAME}.gb`), result.buffer);
