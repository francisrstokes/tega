// Actual addresses are defined (with space allocated) in ram.ts

export enum OAMStruct {
  y,
  x,
  tile,
  flags,

  Size,
};

export enum CharStruct {
  state = 0,
  yVel,
  gravity,
  gravityWait,
  jumpAmount,
  jumpTimer,

  Size
};

export enum CharJumpState {
  Idle,
  Jumping,
  Falling,
};

export enum GameState {
  Title,
  Main,
  GameOver,
}

export enum ObstacleStruct {
  isActive,
  updateTimer,
  type,
  cooldownTimer,
  oamIndex,
  // Note: This property exists in the obstacle table as well, but looking it up
  // is a little expensive, so storing it here when assigning a type saves some hassle
  yHeight,

  Size
}

export enum ObstacleTableEntryStruct {
  yHeight,
  tile0,
  tile1,
  tile2,
  tile3,

  Size
}
