#include "chip8.h"
#include <stdio.h>
#include <unistd.h>
#include <termios.h>
#include <fcntl.h>

// Simple keyboard input for Unix-like systems
void set_terminal_mode() {
    struct termios t;
    tcgetattr(0, &t);
    t.c_lflag &= ~(ICANON | ECHO);
    tcsetattr(0, TCSANOW, &t);
}

void reset_terminal_mode() {
    struct termios t;
    tcgetattr(0, &t);
    t.c_lflag |= ICANON | ECHO;
    tcsetattr(0, TCSANOW, &t);
}

int kbhit() {
    struct timeval tv = {0L, 0L};
    fd_set fds;
    FD_ZERO(&fds);
    FD_SET(0, &fds);
    return select(1, &fds, NULL, NULL, &tv);
}

int main(int argc, char *argv[]) {
    if (argc != 2) {
        printf("Usage: %s <rom.ch8>\n", argv[0]);
        return 1;
    }
    
    Chip8 chip8;
    chip8_init(&chip8);
    chip8_load_rom(&chip8, argv[1]);
    
    // Key mapping for CHIP-8 keypad [citation:4]
    const char keymap[] = {
        'x',  // 0
        '1',  // 1
        '2',  // 2
        '3',  // 3
        'q',  // 4
        'w',  // 5
        'e',  // 6
        'a',  // 7
        's',  // 8
        'd',  // 9
        'z',  // A
        'c',  // B
        '4',  // C
        'r',  // D
        'f',  // E
        'v'   // F
    };
    
    set_terminal_mode();
    printf("\033[2J"); // Clear screen
    
    int cycles_per_frame = 10; // ~600 Hz CPU [citation:1]
    int running = 1;
    
    while (running) {
        // Handle input
        if (kbhit()) {
            char c = getchar();
            if (c == 'q') { // Quit
                running = 0;
                break;
            }
            
            // Map keypress to CHIP-8 keypad
            for (int i = 0; i < 16; i++) {
                if (c == keymap[i]) {
                    chip8.keypad[i] = 1;
                }
            }
        } else {
            // Clear keypad when no keys pressed
            memset(chip8.keypad, 0, 16);
        }
        
        // Emulate CPU cycles
        for (int i = 0; i < cycles_per_frame; i++) {
            uint16_t opcode = chip8_fetch_opcode(&chip8);
            chip8_execute(&chip8, opcode);
        }
        
        // Update timers (60 Hz)
        chip8_update_timers(&chip8);
        
        // Render if needed
        if (chip8.draw_flag) {
            chip8_display_terminal(&chip8);
            chip8.draw_flag = false;
        }
        
        // ~60 FPS
        usleep(16666);
    }
    
    reset_terminal_mode();
    printf("\033[2J\033[H"); // Clear screen and reset cursor
    return 0;
}