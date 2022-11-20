import { ADD,CALL, INC, LD, RET, XOR } from "../ops";
import { Reg8 } from "../types";
import { addr, fn, inline, u8 } from "../utils";
import { charProp, charShadowOAM, jumpButtonPressed, physicsEvalTimer } from "./ram";
import { if_eq, if_neq, if_ugte,  load_from_mem, switch_reg } from "../std";
import { CharJumpState, CharStruct, OAMStruct } from "./structs";

// TODO: Add a floating state that occurs for a few frames before falling

const jumpStartAmount = 4;  // px
const gravityMax      = 7;  // px/frame
const jumpTimerMax    = 8;  // frames
const jumpMaxVel      = 9;  // px/frame

export const charGroundPos       = 16 * 8;
export const charXPos            = 5 * 8;
export const PHYSICS_UPDATE_WAIT = 2;

const setCharState = (s: CharJumpState) => inline([
  LD(Reg8.A, u8(s)),
  LD(charProp(CharStruct.state), Reg8.A),
]);

// void jumpPhysicsIdle()
const jumpPhysicsIdle = fn('jumpPhysicsIdle', () => [
  // When in idle, yVel should always be zero
  XOR(Reg8.A, Reg8.A),
  LD(charProp(CharStruct.yVel), Reg8.A),

  // Did the player jump?
  load_from_mem(Reg8.A, addr(jumpButtonPressed)),

  // Button pressed is "active low" (i.e. 0 = pressed)
  if_eq(Reg8.A, u8(0), {
    then: [
      // Set the state to Jumping
      setCharState(CharJumpState.Jumping),

      // Set the jump timer to zero
      XOR(Reg8.A, Reg8.A),
      LD(charProp(CharStruct.jumpTimer), Reg8.A),

      // Set the jump amount to the configured start amount
      LD(Reg8.A, u8(jumpStartAmount)),
      LD(charProp(CharStruct.jumpAmount), Reg8.A),
    ]
  })
]);

// void jumpPhysicsJumping()
const jumpPhysicsJumping = fn('jumpPhysicsJumping', () => [
  // When jumping, there are things things to be considered:
  // 1. Player is jumping, but reached the maximum amount of allowed frames
  // 2. Player is jumping, but release the jump button
  // 3. The actual logic of jumping

  // Jump button is still pressed?
  load_from_mem(Reg8.A, addr(jumpButtonPressed)),
  if_neq(Reg8.A, u8(0), {
    then: [
      // If the jump button has been released, it's time to start falling
      // Reset the jump timer
      XOR(Reg8.A, Reg8.A),
      LD(charProp(CharStruct.jumpTimer), Reg8.A),

      // Reset y velocity
      LD(charProp(CharStruct.yVel), Reg8.A),

      // Reset gravity
      LD(charProp(CharStruct.gravity), Reg8.A),

      // Change state to falling
      setCharState(CharJumpState.Falling),

      // Early return
      RET(),
    ]
  }),

  // Jump timer expired?
  load_from_mem(Reg8.A, charProp(CharStruct.jumpTimer)),
  if_ugte(Reg8.A, u8(jumpTimerMax), {
    then: [
      // Reset the jump timer
      XOR(Reg8.A, Reg8.A),
      LD(charProp(CharStruct.jumpTimer), Reg8.A),

      // Reset y velocity
      LD(charProp(CharStruct.yVel), Reg8.A),

      // Reset gravity
      LD(charProp(CharStruct.gravity), Reg8.A),

      // Change state to falling
      setCharState(CharJumpState.Falling),

      // Early return
      RET(),
    ],
    else: [
      // Increment the jump timer
      INC(Reg8.A),
      LD(charProp(CharStruct.jumpTimer), Reg8.A)
    ]
  }),

  // Jump logic
  // Increment the jump amount
  load_from_mem(Reg8.A, charProp(CharStruct.jumpAmount)),
  INC(Reg8.A),

  // Clamp it to max
  if_ugte(Reg8.A, u8(jumpMaxVel), {
    then: [
      LD(Reg8.A, u8(jumpMaxVel)),
    ]
  }),

  // Write it back
  LD(charProp(CharStruct.jumpAmount), Reg8.A),

  // Jump velocity is actually a *subtraction*, so flip the sign
  XOR(Reg8.A, u8(0xff)),  // xor with 0xff is essentially ~x
  INC(Reg8.A),            // Add one to complete the twos complement

  // Set yVel to the inverted jump amount
  LD(charProp(CharStruct.yVel), Reg8.A),
]);

// void jumpPhysicsFalling()
const jumpPhysicsFalling = fn('jumpPhysicsFalling', () => [
  // Increment gravity
  LD(Reg8.A, charProp(CharStruct.gravity)),
  INC(Reg8.A),

  // Clamp to the max value
  if_ugte(Reg8.A, u8(gravityMax), {
    then: [
      LD(Reg8.A, u8(gravityMax)),
    ]
  }),

  // Write it back
  LD(charProp(CharStruct.gravity), Reg8.A),

  // Set the yVel
  LD(charProp(CharStruct.yVel), Reg8.A),

  // Calculate the next y position
  LD(Reg8.B, Reg8.A),
  LD(Reg8.A, addr(charShadowOAM + OAMStruct.y)),
  ADD(Reg8.A, Reg8.B),

  // Did the player hit the ground?
  if_ugte(Reg8.A, u8(charGroundPos), {
    then: [
      // Set the final y position
      LD(Reg8.A, u8(charGroundPos)),
      LD(addr(charShadowOAM + OAMStruct.y), Reg8.A),

      // Set yVel to zero
      XOR(Reg8.A, Reg8.A),
      LD(charProp(CharStruct.yVel), Reg8.A),

      // Set gravity to zero
      LD(charProp(CharStruct.gravity), Reg8.A),

      // Return to the idle state
      setCharState(CharJumpState.Idle),

      // Early return
      RET(),
    ]
  }),
]);

// void applyVelocity()
const applyVelocity = fn('applyVelocity', () => [
  load_from_mem(Reg8.B, charProp(CharStruct.yVel)),
  load_from_mem(Reg8.A, addr(charShadowOAM + OAMStruct.y)),
  ADD(Reg8.A, Reg8.B),
  LD(addr(charShadowOAM + OAMStruct.y), Reg8.A),
]);

// void jumpPhysics()
export const jumpPhysics = fn('jumpPhysics', () => [
  load_from_mem(Reg8.A, addr(physicsEvalTimer)),

  // Reset timer
  XOR(Reg8.A, Reg8.A),
  LD(addr(physicsEvalTimer), Reg8.A),

  // Load state
  load_from_mem(Reg8.A, charProp(CharStruct.state)),

  // Run the appropriate code for the state
  switch_reg(Reg8.A, [
    [u8(CharJumpState.Idle),    [ CALL(jumpPhysicsIdle.start)     ]],
    [u8(CharJumpState.Jumping), [ CALL(jumpPhysicsJumping.start)  ]],
    [u8(CharJumpState.Falling), [ CALL(jumpPhysicsFalling.start)  ]],
  ]),

  // Apply velocity
  CALL(applyVelocity.start),
]);

export const physicsFunctions = inline([
  jumpPhysicsIdle.block,
  jumpPhysicsFalling.block,
  jumpPhysicsJumping.block,
  applyVelocity.block,
  jumpPhysics.block,
]);
