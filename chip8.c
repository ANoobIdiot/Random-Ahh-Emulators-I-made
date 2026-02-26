#include "chip8.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <unistd.h>

// CHIP-8 font set (each digit is 5 bytes)
const uint8_t fontset[80] = {
    0xF0, 0x90, 0x90, 0x90, 0xF0, // 0
    0x20, 0x60, 0x20, 0x20, 0x70, // 1
    0xF0, 0x10, 0xF0, 0x80, 0xF0, // 2
    0xF0, 0x10, 0xF0, 0x10, 0xF0, // 3
    0x90, 0x90, 0xF0, 0x10, 0x10, // 4
    0xF0, 0x80, 0xF0, 0x10, 0xF0, // 5
    0xF0, 0x80, 0xF0, 0x90, 0xF0, // 6
    0xF0, 0x10, 0x20, 0x40, 0x40, // 7
    0xF0, 0x90, 0xF0, 0x90, 0xF0, // 8
    0xF0, 0x90, 0xF0, 0x10, 0xF0, // 9
    0xF0, 0x90, 0xF0, 0x90, 0x90, // A
    0xE0, 0x90, 0xE0, 0x90, 0xE0, // B
    0xF0, 0x80, 0x80, 0x80, 0xF0, // C
    0xE0, 0x90, 0x90, 0x90, 0xE0, // D
    0xF0, 0x80, 0xF0, 0x80, 0xF0, // E
    0xF0, 0x80, 0xF0, 0x80, 0x80  // F
};

void chip8_init(Chip8 *chip8) {
    // Initialize all memory to 0
    memset(chip8, 0, sizeof(Chip8));
    
    // Load fontset into memory [citation:1]
    for (int i = 0; i < 80; i++) {
        chip8->memory[FONT_START + i] = fontset[i];
    }
    
    // Set program counter to start [citation:1]
    chip8->PC = PROGRAM_START;
    
    // Initialize random number generator
    srand(time(NULL));
}

void chip8_reset(Chip8 *chip8) {
    // Clear registers and memory (except font)
    memset(chip8->V, 0, NUM_REGISTERS);
    memset(chip8->stack, 0, STACK_SIZE * sizeof(uint16_t));
    memset(chip8->display, 0, DISPLAY_SIZE * sizeof(uint32_t));
    memset(chip8->keypad, 0, 16);
    
    chip8->I = 0;
    chip8->PC = PROGRAM_START;
    chip8->SP = 0;
    chip8->delay_timer = 0;
    chip8->sound_timer = 0;
    chip8->draw_flag = false;
}

void chip8_load_rom(Chip8 *chip8, const char *rom_path) {
    FILE *rom = fopen(rom_path, "rb");
    if (!rom) {
        printf("Error: Could not open ROM file %s\n", rom_path);
        exit(1);
    }
    
    // Get file size
    fseek(rom, 0, SEEK_END);
    long rom_size = ftell(rom);
    fseek(rom, 0, SEEK_SET);
    
    // Check if ROM fits in memory
    if (rom_size > MEMORY_SIZE - PROGRAM_START) {
        printf("Error: ROM too large for memory\n");
        fclose(rom);
        exit(1);
    }
    
    // Load ROM into memory starting at 0x200 [citation:8]
    fread(&chip8->memory[PROGRAM_START], 1, rom_size, rom);
    fclose(rom);
    
    printf("Loaded ROM: %s (%ld bytes)\n", rom_path, rom_size);
}

uint16_t chip8_fetch_opcode(Chip8 *chip8) {
    // Fetch 2-byte opcode [citation:8]
    return (chip8->memory[chip8->PC] << 8) | chip8->memory[chip8->PC + 1];
}

void chip8_execute(Chip8 *chip8, uint16_t opcode) {
    uint8_t x = (opcode & 0x0F00) >> 8;
    uint8_t y = (opcode & 0x00F0) >> 4;
    uint8_t n = opcode & 0x000F;
    uint8_t kk = opcode & 0x00FF;
    uint16_t nnn = opcode & 0x0FFF;
    
    // Default: increment PC by 2 (will be overridden for jumps/calls)
    int pc_increment = 2;
    
    switch (opcode & 0xF000) {
        case 0x0000:
            switch (opcode & 0x00FF) {
                case 0x00E0: // CLS - Clear display [citation:8]
                    memset(chip8->display, 0, DISPLAY_SIZE * sizeof(uint32_t));
                    chip8->draw_flag = true;
                    break;
                    
                case 0x00EE: // RET - Return from subroutine [citation:8]
                    chip8->SP--;
                    chip8->PC = chip8->stack[chip8->SP];
                    pc_increment = 0;
                    break;
                    
                default: // 0NNN - RCA 1802 program call (ignored)
                    break;
            }
            break;
            
        case 0x1000: // 1NNN - Jump to NNN [citation:8]
            chip8->PC = nnn;
            pc_increment = 0;
            break;
            
        case 0x2000: // 2NNN - Call subroutine at NNN [citation:8]
            chip8->stack[chip8->SP] = chip8->PC + 2;
            chip8->SP++;
            chip8->PC = nnn;
            pc_increment = 0;
            break;
            
        case 0x3000: // 3XNN - Skip next if VX == NN [citation:8]
            if (chip8->V[x] == kk)
                pc_increment = 4;
            break;
            
        case 0x4000: // 4XNN - Skip next if VX != NN [citation:8]
            if (chip8->V[x] != kk)
                pc_increment = 4;
            break;
            
        case 0x5000: // 5XY0 - Skip next if VX == VY [citation:8]
            if (chip8->V[x] == chip8->V[y])
                pc_increment = 4;
            break;
            
        case 0x6000: // 6XNN - Set VX = NN [citation:8]
            chip8->V[x] = kk;
            break;
            
        case 0x7000: // 7XNN - Set VX = VX + NN [citation:8]
            chip8->V[x] += kk;
            break;
            
        case 0x8000:
            switch (n) {
                case 0x0: // 8XY0 - Set VX = VY [citation:8]
                    chip8->V[x] = chip8->V[y];
                    break;
                    
                case 0x1: // 8XY1 - Set VX = VX OR VY [citation:8]
                    chip8->V[x] |= chip8->V[y];
                    break;
                    
                case 0x2: // 8XY2 - Set VX = VX AND VY [citation:8]
                    chip8->V[x] &= chip8->V[y];
                    break;
                    
                case 0x3: // 8XY3 - Set VX = VX XOR VY [citation:8]
                    chip8->V[x] ^= chip8->V[y];
                    break;
                    
                case 0x4: // 8XY4 - Add VY to VX, set VF on carry [citation:8]
                    {
                        uint16_t sum = chip8->V[x] + chip8->V[y];
                        chip8->V[0xF] = (sum > 0xFF) ? 1 : 0;
                        chip8->V[x] = sum & 0xFF;
                    }
                    break;
                    
                case 0x5: // 8XY5 - Subtract VY from VX, set VF on borrow [citation:8]
                    chip8->V[0xF] = (chip8->V[x] >= chip8->V[y]) ? 1 : 0;
                    chip8->V[x] -= chip8->V[y];
                    break;
                    
                case 0x6: // 8XY6 - Shift right VX, set VF to LSB [citation:8]
                    chip8->V[0xF] = chip8->V[x] & 0x1;
                    chip8->V[x] >>= 1;
                    break;
                    
                case 0x7: // 8XY7 - Set VX = VY - VX, set VF on borrow [citation:8]
                    chip8->V[0xF] = (chip8->V[y] >= chip8->V[x]) ? 1 : 0;
                    chip8->V[x] = chip8->V[y] - chip8->V[x];
                    break;
                    
                case 0xE: // 8XYE - Shift left VX, set VF to MSB [citation:8]
                    chip8->V[0xF] = (chip8->V[x] & 0x80) >> 7;
                    chip8->V[x] <<= 1;
                    break;
            }
            break;
            
        case 0x9000: // 9XY0 - Skip next if VX != VY [citation:8]
            if (chip8->V[x] != chip8->V[y])
                pc_increment = 4;
            break;
            
        case 0xA000: // ANNN - Set I = NNN [citation:8]
            chip8->I = nnn;
            break;
            
        case 0xB000: // BNNN - Jump to NNN + V0 [citation:8]
            chip8->PC = nnn + chip8->V[0];
            pc_increment = 0;
            break;
            
        case 0xC000: // CXNN - Set VX = random & NN [citation:8]
            chip8->V[x] = (rand() % 256) & kk;
            break;
            
        case 0xD000: // DXYN - Draw sprite at (VX, VY) with height N [citation:8]
            {
                uint8_t x_pos = chip8->V[x] % DISPLAY_WIDTH;
                uint8_t y_pos = chip8->V[y] % DISPLAY_HEIGHT;
                chip8->V[0xF] = 0;
                
                for (int row = 0; row < n; row++) {
                    uint8_t sprite_byte = chip8->memory[chip8->I + row];
                    
                    for (int col = 0; col < 8; col++) {
                        if (sprite_byte & (0x80 >> col)) {
                            int pixel_x = (x_pos + col) % DISPLAY_WIDTH;
                            int pixel_y = (y_pos + row) % DISPLAY_HEIGHT;
                            int idx = pixel_y * DISPLAY_WIDTH + pixel_x;
                            
                            // Check for collision
                            if (chip8->display[idx] == 0xFFFFFFFF)
                                chip8->V[0xF] = 1;
                            
                            // XOR pixel
                            chip8->display[idx] ^= 0xFFFFFFFF;
                        }
                    }
                }
                chip8->draw_flag = true;
            }
            break;
            
        case 0xE000:
            switch (opcode & 0x00FF) {
                case 0x9E: // EX9E - Skip if key VX pressed
                    if (chip8->keypad[chip8->V[x]])
                        pc_increment = 4;
                    break;
                    
                case 0xA1: // EXA1 - Skip if key VX not pressed
                    if (!chip8->keypad[chip8->V[x]])
                        pc_increment = 4;
                    break;
            }
            break;
            
        case 0xF000:
            switch (opcode & 0x00FF) {
                case 0x07: // FX07 - Set VX = delay timer [citation:8]
                    chip8->V[x] = chip8->delay_timer;
                    break;
                    
                case 0x0A: // FX0A - Wait for key press, store in VX [citation:8]
                    {
                        int key_pressed = 0;
                        for (int i = 0; i < 16; i++) {
                            if (chip8->keypad[i]) {
                                chip8->V[x] = i;
                                key_pressed = 1;
                                break;
                            }
                        }
                        if (!key_pressed)
                            pc_increment = 0; // Repeat instruction
                    }
                    break;
                    
                case 0x15: // FX15 - Set delay timer = VX [citation:8]
                    chip8->delay_timer = chip8->V[x];
                    break;
                    
                case 0x18: // FX18 - Set sound timer = VX [citation:8]
                    chip8->sound_timer = chip8->V[x];
                    break;
                    
                case 0x1E: // FX1E - Set I = I + VX [citation:8]
                    chip8->I += chip8->V[x];
                    break;
                    
                case 0x29: // FX29 - Set I to sprite location for digit VX
                    chip8->I = FONT_START + (chip8->V[x] * 5);
                    break;
                    
                case 0x33: // FX33 - Store BCD of VX in memory [citation:8]
                    chip8->memory[chip8->I] = chip8->V[x] / 100;
                    chip8->memory[chip8->I + 1] = (chip8->V[x] / 10) % 10;
                    chip8->memory[chip8->I + 2] = chip8->V[x] % 10;
                    break;
                    
                case 0x55: // FX55 - Store V0-VX in memory starting at I [citation:8]
                    for (int i = 0; i <= x; i++)
                        chip8->memory[chip8->I + i] = chip8->V[i];
                    break;
                    
                case 0x65: // FX65 - Read V0-VX from memory starting at I [citation:8]
                    for (int i = 0; i <= x; i++)
                        chip8->V[i] = chip8->memory[chip8->I + i];
                    break;
            }
            break;
    }
    
    chip8->PC += pc_increment;
}

void chip8_update_timers(Chip8 *chip8) {
    // Decrement timers at 60 Hz [citation:1][citation:8]
    if (chip8->delay_timer > 0)
        chip8->delay_timer--;
    
    if (chip8->sound_timer > 0) {
        chip8->sound_timer--;
        // In a full implementation, beep when sound_timer > 0
        if (chip8->sound_timer > 0) {
            // printf("\a"); // Terminal bell - simple sound
        }
    }
}

// Simple terminal display for vscode.dev
void chip8_display_terminal(Chip8 *chip8) {
    printf("\033[H"); // Move cursor to home
    
    for (int y = 0; y < DISPLAY_HEIGHT; y++) {
        for (int x = 0; x < DISPLAY_WIDTH; x++) {
            if (chip8->display[y * DISPLAY_WIDTH + x])
                printf("█");
            else
                printf(" ");
        }
        printf("\n");
    }
    printf("\n");
}

// Map keyboard input to CHIP-8 keypad [citation:4]
uint8_t chip8_get_key(void) {
    // This is a simplified version - in real use, you'd use termios for raw input
    // For vscode.dev, you'll need to modify based on your needs
    return 0xFF; // No key pressed
}