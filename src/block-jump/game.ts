import { BTN_A, BTN_START, LCDCF_BGON, LCDCF_OBJON, LCDCF_ON, P1F_GET_BTN, rLCDC, rP1, rSCX } from "../hardware-inc";
import { AND, CALL, INC, LD, XOR } from "../ops";
import { call_waitForVBlank, if_eq, if_ugte, load_from_mem, read_modify_write, switch_reg } from "../std";
import { Reg16, Reg8 } from "../types";
import { addr, fn, inline, u16, u8 } from "../utils";
import { moveObstacles } from "./obstacle";
import { jumpPhysics, PHYSICS_UPDATE_WAIT } from "./physics";
import { bgWait, charProp, gameState, jumpButtonPressed, obstacle0, obstacle1, physicsDebounceTimer } from "./ram";
import { call_rleUnpack } from "./rle";
import { CharJumpState, CharStruct, GameState } from "./structs";
import { tileMap } from "./tiles";

const BG_WAIT_TIMER = 0x5;

const mainGame = fn('mainGame', () => [
  // Scroll the background every X frames
  LD(Reg8.A, addr(bgWait)),
  INC(Reg8.A),
  LD(addr(bgWait), Reg8.A),
  if_ugte(Reg8.A, u8(BG_WAIT_TIMER), {
    then: [
      XOR(Reg8.A, Reg8.A),
      LD(addr(bgWait), Reg8.A),
      read_modify_write(Reg8.A, addr(rSCX), [ INC(Reg8.A) ]),
    ]
  }),

  // Update the obstacles
  LD(Reg16.DE, u16(obstacle0)),
  CALL(moveObstacles.start),
  LD(Reg16.DE, u16(obstacle1)),
  CALL(moveObstacles.start),

  // Update physics (jumping)
  // This is done *either* when enough time has elapsed since the last update,
  // or immediately if the player is in the idle state. The second prevents
  // the game from feeling like it responds sluggishly to input

  LD(Reg8.C, u8(0)), // shouldEvalPhysics = false
  read_modify_write(Reg8.A, addr(physicsDebounceTimer), [
    if_ugte(Reg8.A, u8(PHYSICS_UPDATE_WAIT), {
      then: [
        LD(Reg8.C, u8(1)), // shouldEvalPhysics = true
        // Reset physics timer
        XOR(Reg8.A, Reg8.A),
      ],
      else: [
        INC(Reg8.A),
      ]
    }),
  ]),

  load_from_mem(Reg8.A, charProp(CharStruct.state)),
  if_eq(Reg8.A, u8(CharJumpState.Idle), {
    then: [
      LD(Reg8.C, u8(1)) // shouldEvalPhysics = true
    ]
  }),

  if_eq(Reg8.C, u8(1), {
    then: [
      // Read the main buttons into the A register
      LD(Reg8.A, u8(P1F_GET_BTN)),      // Request Buttons
      LD(addr(rP1), Reg8.A),
      load_from_mem(Reg8.B, addr(rP1)), // Read result
      AND(Reg8.A, u8(BTN_A)),           // A reg is now zero *if* A button was pressed
      // Write the result into RAM where it can be read later by the physics code
      LD(addr(jumpButtonPressed), Reg8.A),

      // Call the physics routine
      CALL(jumpPhysics.start),
    ]
  }),
]);

const titleScreen = fn('titleScreen', () => [
  // Read the status of the "start" button
  LD(Reg8.A, u8(P1F_GET_BTN)),
  LD(addr(rP1), Reg8.A),
  load_from_mem(Reg8.B, addr(rP1)),
  AND(Reg8.A, u8(BTN_START)),

  if_eq(Reg8.A, u8(0), {
    then: [
      // Wait for VBlank before copying all the tile data
      call_waitForVBlank(),

      // Turn the LCD off
      XOR(Reg8.A, Reg8.A),
      LD(addr(rLCDC), Reg8.A),

      // Copy the main tile map to memory
      call_rleUnpack(tileMap.start, u16(0x9800), tileMap.size),

      // Turn the LCD on
      LD(Reg8.A, u8(LCDCF_ON | LCDCF_BGON | LCDCF_OBJON)),
      LD(addr(rLCDC), Reg8.A),

      // Change state
      LD(Reg8.A, u8(GameState.Main)),
      LD(addr(gameState), Reg8.A)
    ]
  })
]);

const gameOver = fn('gameOver', () => [
  // Read the status of the "start" button
  LD(Reg8.A, u8(P1F_GET_BTN)),
  LD(addr(rP1), Reg8.A),
  load_from_mem(Reg8.B, addr(rP1)),
  AND(Reg8.A, u8(BTN_START)),

  if_eq(Reg8.A, u8(0), {
    then: [
      // Wait for VBlank before copying all the tile data
      call_waitForVBlank(),

      // Turn the LCD off
      XOR(Reg8.A, Reg8.A),
      LD(addr(rLCDC), Reg8.A),

      // Copy the main tile map to memory
      call_rleUnpack(tileMap.start, u16(0x9800), tileMap.size),

      // Turn the LCD on
      LD(Reg8.A, u8(LCDCF_ON | LCDCF_BGON | LCDCF_OBJON)),
      LD(addr(rLCDC), Reg8.A),

      // Change state
      LD(Reg8.A, u8(GameState.Main)),
      LD(addr(gameState), Reg8.A)
    ]
  })
]);

export const mainGameStateMachine = fn('mainGameStateMachine', () => [
  LD(Reg8.A, addr(gameState)),
  switch_reg(Reg8.A, [
    [u8(GameState.Title),     [ CALL(titleScreen.start) ]],
    [u8(GameState.Main),      [ CALL(mainGame.start)    ]],
    [u8(GameState.GameOver),  [ CALL(gameOver.start)    ]],
  ]),
]);

export const gameFunctions = inline([
  mainGameStateMachine.block,
  titleScreen.block,
  mainGame.block,
  gameOver.block,
]);
