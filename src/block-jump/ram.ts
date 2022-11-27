import { addr } from "../utils";
import { CharStruct, OAMStruct, ObstacleStruct } from "./structs";

export const RAMStart = 0xC000;
let RAMOffset = RAMStart;

export const reserveRAM = (bytes = 1) => {
  const address = RAMOffset;
  RAMOffset += bytes;
  return address;
};

// ----------------------------- Sprites
export const charShadowOAM = reserveRAM(OAMStruct.Size);
export const shadowOAM = charShadowOAM;

// Reserve for all the other entries
reserveRAM(OAMStruct.Size * 39);

// ----------------------------- Character Struct
export const charStruct = reserveRAM(CharStruct.Size);
export const charProp = (p: CharStruct) => addr(charStruct + p);

// ----------------------------- Physics
export const jumpButtonPressed = reserveRAM();
export const physicsDebounceTimer = reserveRAM();
export const physicsEvalTimer = reserveRAM();

// ----------------------------- Obstacles
export const obstacle0 = reserveRAM(ObstacleStruct.Size);
export const obstacle1 = reserveRAM(ObstacleStruct.Size);
export const obstacleProp = (base: number, prop: ObstacleStruct) => addr(base + prop);

// ----------------------------- BG Speed
export const bgWait = reserveRAM();

// ----------------------------- Game State
export const gameState = reserveRAM();

// ----------------------------- Random Number Generator
export const rngIndex = reserveRAM();

export const RAMLastUsed = RAMOffset;

export const allRAMSymbols = {
  charShadowOAM,
  shadowOAM,
  charStruct,
  jumpButtonPressed,
  physicsDebounceTimer,
  physicsEvalTimer,
  obstacle0,
  obstacle1,
  rngIndex,
  bgWait,
};
