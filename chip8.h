#ifndef CHIP8_H
#define CHIP8_H

#include <stdint.h>
#include <stdbool.h>

// CHIP-8 system constants
#define MEMORY_SIZE 4096
#define NUM_REGISTERS 16
#define STACK_SIZE 16
#define DISPLAY_WIDTH 64
#define DISPLAY_HEIGHT 32
#define DISPLAY_SIZE (DISPLAY_WIDTH * DISPLAY_HEIGHT)
#define PROGRAM_START 0x200
#define FONT_START 0x50

typedef struct {
    // Memory and registers
    uint8_t memory[MEMORY_SIZE];
    uint8_t V[NUM_REGISTERS];      // General purpose registers
    uint16_t I;                     // Index register
    uint16_t PC;                    // Program counter
    uint8_t delay_timer;
    uint8_t sound_timer;
    
    // Stack
    uint16_t stack[STACK_SIZE];
    uint8_t SP;                     // Stack pointer
    
    // Display
    uint32_t display[DISPLAY_SIZE]; // Using uint32_t for RGB colors
    bool draw_flag;                  // Indicates screen needs update
    
    // Keypad
    uint8_t keypad[16];
} Chip8;

// Core functions
void chip8_init(Chip8 *chip8);
void chip8_load_rom(Chip8 *chip8, const char *rom_path);
void chip8_emulate_cycle(Chip8 *chip8);
void chip8_update_timers(Chip8 *chip8);
void chip8_reset(Chip8 *chip8);

// Helper functions
uint16_t chip8_fetch_opcode(Chip8 *chip8);
void chip8_execute(Chip8 *chip8, uint16_t opcode);
uint8_t chip8_get_key(void);

#endif