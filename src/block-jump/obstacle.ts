import { LCDCF_BGON, LCDCF_ON, rLCDC, rSCX } from "../hardware-inc";
import { ADD, AND, CALL, DEC, INC, JP, LD, POP, PUSH, RET, SLA, XOR } from "../ops";
import { Flag, Reg16, Reg16Ptr, Reg8 } from "../types";
import { addr, block, fn, inline, inlineBytes, label, scope, u16, u8, unnamedScope } from "../utils";
import { charGroundPos, charXPos } from "./physics";
import { charShadowOAM, gameState, obstacle0, shadowOAM } from "./ram";
import { getRandom } from "./rng";
import { applyOffsetToDEPtr, applyOffsetToHLPtr, call_memcpy, call_waitForVBlank, if_eq, if_ugte, if_ugte_reg, if_ult_reg, load_from_mem, read_modify_write_hl } from "../std";
import { GameState, OAMStruct, ObstacleStruct } from "./structs";
import { gameOverMap } from "./tiles";
import { call_rleUnpack } from "./rle";

export const obstacleStartX = 21 * 8;

// This table represents a set of ObstacleTableEntry, as defined in struct.ts
export const obstacleTable = block('obstacleTable', () => [
  inlineBytes(new Uint8Array([
//  yHeight             tile0 tile1 tile2 tile3
    charGroundPos - 4,  3,    9,    9,    9,
    charGroundPos - 8,  4,    9,    9,    9,
    charGroundPos - 12, 5,    7,    9,    9,
    charGroundPos - 16, 5,    8,    9,    9,
    charGroundPos - 20, 5,    6,    7,    9,
    charGroundPos - 24, 5,    6,    8,    9,
    charGroundPos - 28, 5,    6,    6,    7,
    charGroundPos - 32, 5,    6,    6,    8,
  ])),
]);

export const numObstacles = 2;
const updateTimer = 0;

export const setupObstacles = fn('setupObstacles', () => [
  LD(Reg16.HL, u16(obstacle0)),

  // Obstacle 0
  XOR(Reg8.A, Reg8.A),
  LD(Reg16Ptr.HLinc, Reg8.A), // isActive
  LD(Reg16Ptr.HLinc, Reg8.A), // updateTimer
  LD(Reg16Ptr.HLinc, Reg8.A), // type
  LD(Reg16Ptr.HLinc, Reg8.A), // cooldownTimer
  LD(Reg8.A, u8(1)),
  LD(Reg16Ptr.HLinc, Reg8.A), // oamIndex
  LD(Reg16Ptr.HLinc, Reg8.A), // yHeight

  // Obstacle 1
  XOR(Reg8.A, Reg8.A),
  LD(Reg16Ptr.HLinc, Reg8.A), // isActive
  LD(Reg16Ptr.HLinc, Reg8.A), // updateTimer
  LD(Reg16Ptr.HLinc, Reg8.A), // type
  LD(Reg8.A, u8(0x30)),
  LD(Reg16Ptr.HLinc, Reg8.A), // cooldownTimer
  LD(Reg8.A, u8(5)),
  LD(Reg16Ptr.HLinc, Reg8.A), // oamIndex
  LD(Reg16Ptr.HLinc, Reg8.A), // yHeight

  // Align to the first obstacle entry in OAM, on the X property
  LD(Reg16.HL, u16(shadowOAM + OAMStruct.Size + OAMStruct.x)),
  LD(Reg8.C, u8(8)),
  unnamedScope([
    label('loop'),
    XOR(Reg8.A, Reg8.A),
    LD(Reg16Ptr.HL, Reg8.A),
    LD(Reg8.A, u8(OAMStruct.Size)),
    CALL(applyOffsetToHLPtr.start),
    DEC(Reg8.C),
    JP(Flag.NotZero, label('loop'))
  ]),
]);

// void loadHLWithObstaclePropAddr(u16* de_base, u8 a_prop)
const loadHLWithObstaclePropAddr = fn('loadHLWithObstaclePropAddr', () => [
  // The base obstacle address is in DE
  PUSH(Reg16.DE),
  POP(Reg16.HL),
  CALL(applyOffsetToHLPtr.start),
]);

// u8 loadObstaclePropAViaHL(u16* de_base, u8 a_prop)
const loadObstaclePropAViaHL = fn('loadAViaHL', () => [
  CALL(loadHLWithObstaclePropAddr.start),
  LD(Reg8.A, Reg16Ptr.HL),
]);

// void setOAMTilesForObstacle(u16* hl_table_entry, u16* de_oam_entry)
const setOAMTilesForObstacle = fn('setOAMTilesForObstacle', () => [
  // Tile 0
  LD(Reg8.A, Reg16Ptr.HLinc),
  LD(Reg16Ptr.DE, Reg8.A),
  LD(Reg8.A, u8(OAMStruct.Size)),
  CALL(applyOffsetToDEPtr.start),
  // Tile 1
  LD(Reg8.A, Reg16Ptr.HLinc),
  LD(Reg16Ptr.DE, Reg8.A),
  LD(Reg8.A, u8(OAMStruct.Size)),
  CALL(applyOffsetToDEPtr.start),
  // Tile 2
  LD(Reg8.A, Reg16Ptr.HLinc),
  LD(Reg16Ptr.DE, Reg8.A),
  LD(Reg8.A, u8(OAMStruct.Size)),
  CALL(applyOffsetToDEPtr.start),
  // Tile 3
  LD(Reg8.A, Reg16Ptr.HLinc),
  LD(Reg16Ptr.DE, Reg8.A)
]);

const call_loadHLWithObstaclePropAddr = (prop: ObstacleStruct) => inline([
  LD(Reg8.A, u8(prop)),
  CALL(loadHLWithObstaclePropAddr.start),
]);

const call_loadObstaclePropAViaHL = (prop: ObstacleStruct) => inline([
  LD(Reg8.A, u8(prop)),
  CALL(loadObstaclePropAViaHL.start),
]);

const setupGameOverScreen = fn('setupGameOverScreen', () => [
  // Wait for VBlank before copying all the tile data
  call_waitForVBlank(),

  // Turn the LCD off
  XOR(Reg8.A, Reg8.A),
  LD(addr(rLCDC), Reg8.A),

  // Copy the main tile map to memory
  call_rleUnpack(gameOverMap.start, u16(0x9800), gameOverMap.size),

  // Reset the scroll X register
  XOR(Reg8.A, Reg8.A),
  LD(addr(rSCX), Reg8.A),

  // Turn the LCD on
  LD(Reg8.A, u8(LCDCF_ON | LCDCF_BGON)),
  LD(addr(rLCDC), Reg8.A),

  // Change state
  LD(Reg8.A, u8(GameState.GameOver)),
  LD(addr(gameState), Reg8.A),

  // Reset the obstacles
  CALL(setupObstacles.start)
]);

// This code is a little messy. Maybe one day I'll come back and split it all into
// nice functions, but for now, you know what they say - "if it ain't broke, don't fix it"
export const moveObstacles = fn('moveObstacles', () => [
  call_loadObstaclePropAViaHL(ObstacleStruct.isActive),
  if_eq(Reg8.A, u8(1), {
    then: [
      // Is this obstacle ready to be updated?
      call_loadObstaclePropAViaHL(ObstacleStruct.updateTimer),
      if_ugte(Reg8.A, u8(updateTimer), {
        then: [
          // Reset the timer
          XOR(Reg8.A, Reg8.A),
          LD(Reg16Ptr.HL, Reg8.A),

          // C = number of possible tiles in an obstacle
          LD(Reg8.C, u8(4)),

          // Load and add the oam start index for this obstacle
          call_loadObstaclePropAViaHL(ObstacleStruct.oamIndex),
          // Multiply by 4 to get the offset of the first entry
          SLA(Reg8.A),
          SLA(Reg8.A),
          // A = Offset to the x position
          ADD(Reg8.A, u8(OAMStruct.x)),

          // Load the first OAM entry x-position address for this obstacle into HL
          LD(Reg16.HL, u16(shadowOAM)),
          // LD(Reg8.A, Reg8.B),
          CALL(applyOffsetToHLPtr.start),

          // B = whether or not the obstacle is now at x=0 (1), or obstacle in collision zone (2)
          LD(Reg8.B, u8(0)),

          scope('update_loop', [
            label('loop'),
            read_modify_write_hl(Reg8.A, [
              DEC(Reg8.A),
              // Did we reach the end?
              if_eq(Reg8.A, u8(0), {
                then: [
                  LD(Reg8.B, u8(1)),              // Yes, we reached the end
                  LD(Reg8.A, u8(obstacleStartX)), // Reset x position
                ],
                else: [
                  label('moveObstacles_collision_range'),

                  // Backup the x pos in D
                  // Note: DE contains the base address of the obstacle, so it needs to
                  // be backed up itself
                  PUSH('DE'),
                  LD(Reg8.D, Reg8.A),
                  // Check if the obstacle is in range of the character (x, x+8)
                  LD(Reg8.A, u8(charXPos)),
                  // if (D >= A && D < A+8)
                  if_ugte_reg(Reg8.D, {
                    then: [
                      ADD(Reg8.A, u8(8)),

                      label('moveObstacles_debug_write_x_back'),
                      if_ult_reg(Reg8.D, {
                        then: [
                          LD(Reg8.B, u8(2)),
                        ]
                      }),
                    ]}),
                  // Reload A with the x pos
                  LD(Reg8.A, Reg8.D),

                  // Restore the obstacle base pointer
                  POP('DE'),
                ]
              }),
            ]),
            LD(Reg8.A, u8(OAMStruct.Size)), // Move HL* along to the next OAM entry x position
            CALL(applyOffsetToHLPtr.start),
            DEC(Reg8.C),
            JP(Flag.NotZero, label('loop')),
          ]),

          // Check if the obstacle is at zero (B=1)
          label('moveObstacles_obstacle_at_zero'),
          if_eq(Reg8.B, u8(1), {
            then: [
              // Set to inactive
              call_loadHLWithObstaclePropAddr(ObstacleStruct.isActive),
              XOR(Reg8.A, Reg8.A),
              LD(Reg16Ptr.HL, Reg8.A),

              CALL(getRandom.start),
              // AND(Reg8.A, u8(0x7)),
              LD(Reg8.B, Reg8.A),

              call_loadHLWithObstaclePropAddr(ObstacleStruct.cooldownTimer),
              LD(Reg16Ptr.HL, Reg8.B),
            ],
            else: [
              // In x range for collision?
              label('moveObstacles_collision_check'),
              if_eq(Reg8.B, u8(2), {
                then: [
                  // Collision when Cy < Oy -> [Oy >= Cy]
                  load_from_mem(Reg8.B, addr(charShadowOAM + OAMStruct.y)),
                  call_loadObstaclePropAViaHL(ObstacleStruct.yHeight),
                  if_ugte_reg(Reg8.B, {
                    then: [
                      // Trigger the game over condition
                      CALL(setupGameOverScreen.start),
                      // Early return
                      RET(),
                    ]
                  })
                ]
              })
            ]
          }),
      ],
      else: [
        // Increment the timer
        INC(Reg8.A),
        LD(Reg8.B, Reg8.A),
        call_loadHLWithObstaclePropAddr(ObstacleStruct.updateTimer),
        LD(Reg16Ptr.HL, Reg8.B),
      ]})
    ],
    else: [
      label("moveObstacles_cooldown_period"),
      call_loadObstaclePropAViaHL(ObstacleStruct.cooldownTimer),
      if_eq(Reg8.A, u8(0), {
        then: [
          label("moveObstacles_cooldown_complete"),
          // Make the obstacle active
          LD(Reg8.B, u8(1)),

          call_loadHLWithObstaclePropAddr(ObstacleStruct.isActive),
          LD(Reg16Ptr.HL, Reg8.B),

          // Choose a random new obstacle type
          CALL(getRandom.start),
          AND(Reg8.A, u8(0x7)),
          LD(Reg8.B, Reg8.A),
          call_loadHLWithObstaclePropAddr(ObstacleStruct.type),
          LD(Reg16Ptr.HL, Reg8.B),

          // Load the start of the obstacle table into HL
          LD(Reg16.HL, obstacleTable.start),

          // Each entry in the table is 6 bytes. type * 6 gives the offset into the table
          // type * 5 == (type << 2) + type
          LD(Reg8.A, Reg8.B),
          SLA(Reg8.A),
          SLA(Reg8.A),
          ADD(Reg8.A, Reg8.B),
          // HL = &ObstacleTable[type]
          CALL(applyOffsetToHLPtr.start),

          // Load the yHeight into the obstacle struct, then increment HL to land
          // on the the first tile of the table entry
          label('Load_yheight_into_obstacle_struct'),
          LD(Reg8.A, Reg16Ptr.HLinc),
          LD(Reg8.B, Reg8.A),
          PUSH('HL'),
          call_loadHLWithObstaclePropAddr(ObstacleStruct.yHeight),
          LD(Reg8.A, Reg8.B),
          LD(Reg16Ptr.HL, Reg8.A),

          // Set up the tiles
          call_loadObstaclePropAViaHL(ObstacleStruct.oamIndex),
          // Multiply by 4 to get the offset of the first entry
          SLA(Reg8.A),
          SLA(Reg8.A),
          // A = Offset to the tile property
          ADD(Reg8.A, u8(OAMStruct.tile)),

          // Load the OAM base address into DE and add the offset
          LD(Reg16.DE, u16(shadowOAM)),
          CALL(applyOffsetToDEPtr.start),

          // Copy the tiles to OAM
          POP('HL'),
          CALL(setOAMTilesForObstacle.start),
        ],
        else: [
          // Decrement cooldown timer
          DEC(Reg8.A),
          LD(Reg16Ptr.HL, Reg8.A)
        ]
      }),

      // Waste some cycles so that the game doesn't feel weirdly fast
      // when no obstacles are being updated :/
      LD(Reg8.A, u8(0x40)),
      label('moveObstacles_waste_time'),
      DEC(Reg8.A),
      JP(Flag.NotZero, label('moveObstacles_waste_time')),
    ]
  }),
]);

export const obstacleFunctions = inline([
  moveObstacles.block,
  loadObstaclePropAViaHL.block,
  loadHLWithObstaclePropAddr.block,
  setOAMTilesForObstacle.block,
  setupGameOverScreen.block,
  setupObstacles.block,
]);
