// Gameboy hardware definitions
// Based on hardware.inc

export const ROM0 = 0x0000;

export const VRAM = 0x8000;
export const VRAM8000 = VRAM;
export const VRAM8800 = VRAM + 0x800;
export const VRAM9000 = VRAM + 0x1000;
export const SCRN0 = 0x9800;
export const SCRN1 = 0x9C00;
export const SRAM = 0xA000;
export const RAM = 0xC000;
export const RAMBANK = 0xD000;
export const OAMRAM = 0xFE00;
export const IO = 0xFF00;
export const AUD3WAVERAM = 0xFF30;
export const HRAM = 0xFF80;

export const rP1 = 0xFF00;

export const P1F_5 = 0b00100000; // P15 out port, set to 0 to get buttons
export const P1F_4 = 0b00010000; // P14 out port, set to 0 to get dpad
export const P1F_3 = 0b00001000; // P13 in port
export const P1F_2 = 0b00000100; // P12 in port
export const P1F_1 = 0b00000010; // P11 in port
export const P1F_0 = 0b00000001; // P10 in port

export const P1F_GET_DPAD = P1F_5;
export const P1F_GET_BTN = P1F_4;
export const P1F_GET_NONE = P1F_4 | P1F_5;

export const rLCDC = 0xFF40;
export const LCDCF_OFF     = 0b00000000; // LCD Control Operation
export const LCDCF_ON      = 0b10000000; // LCD Control Operation
export const LCDCF_WIN9800 = 0b00000000; // Window Tile Map Display Select
export const LCDCF_WIN9C00 = 0b01000000; // Window Tile Map Display Select
export const LCDCF_WINOFF  = 0b00000000; // Window Display
export const LCDCF_WINON   = 0b00100000; // Window Display
export const LCDCF_BG8800  = 0b00000000; // BG & Window Tile Data Select
export const LCDCF_BG8000  = 0b00010000; // BG & Window Tile Data Select
export const LCDCF_BG9800  = 0b00000000; // BG Tile Map Display Select
export const LCDCF_BG9C00  = 0b00001000; // BG Tile Map Display Select
export const LCDCF_OBJ8    = 0b00000000; // OBJ Construction
export const LCDCF_OBJ16   = 0b00000100; // OBJ Construction
export const LCDCF_OBJOFF  = 0b00000000; // OBJ Display
export const LCDCF_OBJON   = 0b00000010; // OBJ Display
export const LCDCF_BGOFF   = 0b00000000; // BG Display
export const LCDCF_BGON    = 0b00000001; // BG Display

export const rBGP = 0xFF47;


export const rNR52 = 0xFF26;

export const rLY = 0xFF44;

