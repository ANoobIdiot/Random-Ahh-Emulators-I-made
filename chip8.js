// chip8.js - Complete CHIP-8 Emulator
class Chip8 {
    constructor() {
        // Memory and registers
        this.memory = new Uint8Array(4096);
        this.V = new Uint8Array(16);        // General purpose registers
        this.I = 0;                          // Index register
        this.PC = 0x200;                      // Program counter
        this.stack = new Uint16Array(16);     
        this.SP = 0;
        
        // Timers
        this.delay_timer = 0;
        this.sound_timer = 0;
        
        // Display (64x32 pixels)
        this.display = new Uint8Array(64 * 32);
        this.draw_flag = false;
        
        // Keypad (16 keys)
        this.keypad = new Uint8Array(16);
        
        // Load font
        this.loadFont();
    }
    
    loadFont() {
        // CHIP-8 font set (each digit is 5 bytes)
        const font = [
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
        ];
        
        // Load font into memory starting at 0x50
        for (let i = 0; i < font.length; i++) {
            this.memory[i] = font[i];
        }
    }

    // Add this test method to the Chip8 class
/*testMode() {
    // Simple test pattern - draws a smiley face
    const testPattern = [
        0b01111110,
        0b10000001,
        0b10100101,
        0b10000001,
        0b10100101,
        0b10011001,
        0b10000001,
        0b01111110
    ];
    
    for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
            if (testPattern[y] & (0x80 >> x)) {
                this.display[(y + 12) * 64 + (x + 28)] = 1;
            }
        }
    }
    this.draw_flag = true;
}*/
    
    loadROM(romData) {
        // Load ROM into memory starting at 0x200
        for (let i = 0; i < romData.length; i++) {
            this.memory[0x200 + i] = romData[i];
        }
    }
    
    emulateCycle() {
        // Fetch opcode (2 bytes)
        const opcode = (this.memory[this.PC] << 8) | this.memory[this.PC + 1];
        let pc_increment = 2;
        
        // Decode and execute
        const firstNibble = (opcode & 0xF000) >> 12;
        
        switch (firstNibble) {
            case 0x0:
                if (opcode === 0x00E0) { // CLS - Clear display
                    this.display.fill(0);
                    this.draw_flag = true;
                } else if (opcode === 0x00EE) { // RET - Return from subroutine
                    this.SP--;
                    this.PC = this.stack[this.SP];
                    pc_increment = 0;
                }
                break;
                
            case 0x1: // 1NNN - Jump
                this.PC = opcode & 0x0FFF;
                pc_increment = 0;
                break;
                
            case 0x2: // 2NNN - Call subroutine
                this.stack[this.SP] = this.PC + 2;
                this.SP++;
                this.PC = opcode & 0x0FFF;
                pc_increment = 0;
                break;
                
            case 0x3: { // 3XNN - Skip if VX == NN
                const x = (opcode & 0x0F00) >> 8;
                const val = opcode & 0x00FF;
                if (this.V[x] === val) pc_increment = 4;
                break;
            }
            
            case 0x4: { // 4XNN - Skip if VX != NN
                const x = (opcode & 0x0F00) >> 8;
                const val = opcode & 0x00FF;
                if (this.V[x] !== val) pc_increment = 4;
                break;
            }
            
            case 0x5: { // 5XY0 - Skip if VX == VY
                const x = (opcode & 0x0F00) >> 8;
                const y = (opcode & 0x00F0) >> 4;
                if (this.V[x] === this.V[y]) pc_increment = 4;
                break;
            }
            
            case 0x6: { // 6XNN - Set VX = NN
                const x = (opcode & 0x0F00) >> 8;
                this.V[x] = opcode & 0x00FF;
                break;
            }
            
            case 0x7: { // 7XNN - Set VX = VX + NN
                const x = (opcode & 0x0F00) >> 8;
                this.V[x] += opcode & 0x00FF;
                break;
            }
            
            case 0x8: {
                const x = (opcode & 0x0F00) >> 8;
                const y = (opcode & 0x00F0) >> 4;
                const n = opcode & 0x000F;
                
                switch (n) {
                    case 0x0: // 8XY0 - Set VX = VY
                        this.V[x] = this.V[y];
                        break;
                    case 0x1: // 8XY1 - VX = VX OR VY
                        this.V[x] |= this.V[y];
                        break;
                    case 0x2: // 8XY2 - VX = VX AND VY
                        this.V[x] &= this.V[y];
                        break;
                    case 0x3: // 8XY3 - VX = VX XOR VY
                        this.V[x] ^= this.V[y];
                        break;
                    case 0x4: // 8XY4 - Add with carry
                        const sum = this.V[x] + this.V[y];
                        this.V[0xF] = (sum > 0xFF) ? 1 : 0;
                        this.V[x] = sum & 0xFF;
                        break;
                    case 0x5: // 8XY5 - Subtract with borrow
                        this.V[0xF] = (this.V[x] >= this.V[y]) ? 1 : 0;
                        this.V[x] -= this.V[y];
                        break;
                    case 0x6: // 8XY6 - Shift right
                        this.V[0xF] = this.V[x] & 0x1;
                        this.V[x] >>= 1;
                        break;
                    case 0x7: // 8XY7 - Set VX = VY - VX
                        this.V[0xF] = (this.V[y] >= this.V[x]) ? 1 : 0;
                        this.V[x] = this.V[y] - this.V[x];
                        break;
                    case 0xE: // 8XYE - Shift left
                        this.V[0xF] = (this.V[x] & 0x80) >> 7;
                        this.V[x] <<= 1;
                        break;
                }
                break;
            }
            
            case 0x9: { // 9XY0 - Skip if VX != VY
                const x = (opcode & 0x0F00) >> 8;
                const y = (opcode & 0x00F0) >> 4;
                if (this.V[x] !== this.V[y]) pc_increment = 4;
                break;
            }
            
            case 0xA: // ANNN - Set I = NNN
                this.I = opcode & 0x0FFF;
                break;
                
            case 0xB: // BNNN - Jump to NNN + V0
                this.PC = (opcode & 0x0FFF) + this.V[0];
                pc_increment = 0;
                break;
                
            case 0xC: { // CXNN - Random
                const x = (opcode & 0x0F00) >> 8;
                this.V[x] = Math.floor(Math.random() * 256) & (opcode & 0x00FF);
                break;
            }
            
            case 0xD: { // DXYN - Draw sprite
                const x = this.V[(opcode & 0x0F00) >> 8] % 64;
                const y = this.V[(opcode & 0x00F0) >> 4] % 32;
                const height = opcode & 0x000F;
                
                this.V[0xF] = 0;
                
                for (let row = 0; row < height; row++) {
                    const sprite = this.memory[this.I + row];
                    
                    for (let col = 0; col < 8; col++) {
                        if (sprite & (0x80 >> col)) {
                            const pixelX = (x + col) % 64;
                            const pixelY = (y + row) % 32;
                            const idx = pixelY * 64 + pixelX;
                            
                            if (this.display[idx] === 1) {
                                this.V[0xF] = 1;
                            }
                            
                            this.display[idx] ^= 1;
                        }
                    }
                }
                this.draw_flag = true;
                break;
            }
            
            case 0xE: {
                const x = (opcode & 0x0F00) >> 8;
                
                if ((opcode & 0x00FF) === 0x9E) { // EX9E - Skip if key pressed
                    if (this.keypad[this.V[x]]) pc_increment = 4;
                } else if ((opcode & 0x00FF) === 0xA1) { // EXA1 - Skip if key not pressed
                    if (!this.keypad[this.V[x]]) pc_increment = 4;
                }
                break;
            }
            
            case 0xF: {
                const x = (opcode & 0x0F00) >> 8;
                const last = opcode & 0x00FF;
                
                switch (last) {
                    case 0x07: // FX07 - Set VX = delay timer
                        this.V[x] = this.delay_timer;
                        break;
                        
                    case 0x0A: { // FX0A - Wait for key press
                        let pressed = false;
                        for (let i = 0; i < 16; i++) {
                            if (this.keypad[i]) {
                                this.V[x] = i;
                                pressed = true;
                                break;
                            }
                        }
                        if (!pressed) pc_increment = 0; // Repeat instruction
                        break;
                    }
                    
                    case 0x15: // FX15 - Set delay timer
                        this.delay_timer = this.V[x];
                        break;
                        
                    case 0x18: // FX18 - Set sound timer
                        this.sound_timer = this.V[x];
                        break;
                        
                    case 0x1E: // FX1E - Add to I
                        this.I += this.V[x];
                        break;
                        
                    case 0x29: // FX29 - Set I to font character
                        this.I = this.V[x] * 5;
                        break;
                        
                    case 0x33: // FX33 - Store BCD
                        this.memory[this.I] = Math.floor(this.V[x] / 100);
                        this.memory[this.I + 1] = Math.floor((this.V[x] % 100) / 10);
                        this.memory[this.I + 2] = this.V[x] % 10;
                        break;
                        
                    case 0x55: // FX55 - Store registers
                        for (let i = 0; i <= x; i++) {
                            this.memory[this.I + i] = this.V[i];
                        }
                        break;
                        
                    case 0x65: // FX65 - Load registers
                        for (let i = 0; i <= x; i++) {
                            this.V[i] = this.memory[this.I + i];
                        }
                        break;
                }
                break;
            }
        }
        
        this.PC += pc_increment;
        
        // Update timers
        if (this.delay_timer > 0) this.delay_timer--;
        if (this.sound_timer > 0) this.sound_timer--;
    }
}

// Emulator UI Controller
class Chip8Emulator {
    constructor() {
        this.chip8 = new Chip8();
        this.scale = 10;
        this.running = false;
        this.animationFrame = null;
        
        // Set up canvas
        this.canvas = document.getElementById('display');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = 64 * this.scale;
        this.canvas.height = 32 * this.scale;
        
        // Key mapping [citation:3]
        this.keyMap = {
            '1': 0x1, '2': 0x2, '3': 0x3, '4': 0xC,
            'q': 0x4, 'w': 0x5, 'e': 0x6, 'r': 0xD,
            'a': 0x7, 's': 0x8, 'd': 0x9, 'f': 0xE,
            'z': 0xA, 'x': 0x0, 'c': 0xB, 'v': 0xF
        };
        
        // Bind events
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Keyboard input
        document.addEventListener('keydown', (e) => {
            if (e.key in this.keyMap) {
                this.chip8.keypad[this.keyMap[e.key]] = 1;
                e.preventDefault();
            }
        });
        
        document.addEventListener('keyup', (e) => {
            if (e.key in this.keyMap) {
                this.chip8.keypad[this.keyMap[e.key]] = 0;
                e.preventDefault();
            }
        });
        
        // File upload
        document.getElementById('romFile').addEventListener('change', (e) => {
            this.loadROM(e.target.files[0]);
        });
        
        // Control buttons
        document.getElementById('startBtn').addEventListener('click', () => this.start());
        document.getElementById('pauseBtn').addEventListener('click', () => this.pause());
        document.getElementById('resetBtn').addEventListener('click', () => this.reset());
    }
    
    loadROM(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const romData = new Uint8Array(e.target.result);
            this.chip8.loadROM(romData);
            document.getElementById('status').textContent = `Loaded: ${file.name}`;
        };
        reader.readAsArrayBuffer(file);
    }
    
    render() {
        // Clear canvas
        this.ctx.fillStyle = 'black';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw pixels
        this.ctx.fillStyle = '#00ff00'; // Classic green phosphor
        
        for (let y = 0; y < 32; y++) {
            for (let x = 0; x < 64; x++) {
                if (this.chip8.display[y * 64 + x]) {
                    this.ctx.fillRect(
                        x * this.scale,
                        y * this.scale,
                        this.scale,
                        this.scale
                    );
                }
            }
        }
    }
    
    emulationLoop() {
        if (!this.running) return;
        
        // Run 10 cycles per frame (~600 Hz CPU)
        for (let i = 0; i < 10; i++) {
            this.chip8.emulateCycle();
        }
        
        // Render if needed
        if (this.chip8.draw_flag) {
            this.render();
            this.chip8.draw_flag = false;
        }
        
        // Schedule next frame (~60 FPS)
        this.animationFrame = requestAnimationFrame(() => this.emulationLoop());
    }
    
    start() {
        if (!this.running) {
            this.running = true;
            this.emulationLoop();
            document.getElementById('status').textContent = 'Running...';
        }
    }
    
    pause() {
        this.running = false;
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
        document.getElementById('status').textContent = 'Paused';
    }
    
    reset() {
        this.pause();
        this.chip8 = new Chip8();
        /*this.chip8.testMode(); Add this line*/        
        this.render();
        document.getElementById('status').textContent = 'Reset';
    }
}

// Initialize when page loads
window.onload = () => {
    new Chip8Emulator();
};