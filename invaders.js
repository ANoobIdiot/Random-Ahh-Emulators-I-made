// invaders.js - Space Invaders hardware emulation
import { i8080 } from '../i8080.js';

class SpaceInvaders {
    constructor() {
        this.cpu = new i8080();
        this.initMemory();
        this.initIO();
        this.initDisplay();
        this.setupInputHandlers();
        
        // Shift register hardware
        this.shift_register = 0;
        this.shift_offset = 0;
        
        // Frame timing
        this.cycles_per_frame = 2000000 / 60; // 2MHz / 60Hz ≈ 33,333 cycles
        this.frame_buffer = new Uint8Array(224 * 256);
        this.frame = 0;
    }
    
    initMemory() {
        // Clear memory
        for (let i = 0; i < 0x10000; i++)
            this.cpu.memory[i] = 0;
            
        // Video RAM is at 0x2400-0x3FFF
        // Two pages: 0x2400 and 0x2800
    }
    
    initIO() {
        // Port 1: Input (DIP switches, coin, start)
        this.cpu.inHandlers[1] = () => {
            let val = 0;
            if (this.port1_coins) val |= 0x01;
            if (this.port1_2p) val |= 0x02;
            if (this.port1_1p) val |= 0x04;
            if (this.port1_shoot) val |= 0x10;
            if (this.port1_left) val |= 0x20;
            if (this.port1_right) val |= 0x40;
            return val;
        };
        
        // Port 2: Input (player controls)
        this.cpu.inHandlers[2] = () => {
            let val = 0x08; // Bit 3 always set (dip switch)
            if (this.port2_shoot) val |= 0x10;
            if (this.port2_left) val |= 0x20;
            if (this.port2_right) val |= 0x40;
            return val;
        };
        
        // Port 3: Shift register result
        this.cpu.inHandlers[3] = () => {
            return (this.shift_register >> (8 - this.shift_offset)) & 0xFF;
        };
        
        // Port 4: Shift register result (alternate)
        this.cpu.inHandlers[4] = () => {
            return (this.shift_register >> (8 - this.shift_offset)) & 0xFF;
        };
        
        // Port 2: Output (shift register offset)
        this.cpu.outHandlers[2] = (port, val) => {
            this.shift_offset = val & 0x07;
        };
        
        // Port 3: Output (sound 1)
        this.cpu.outHandlers[3] = (port, val) => {
            // UFO sound
        };
        
        // Port 4: Output (shift register data)
        this.cpu.outHandlers[4] = (port, val) => {
            this.shift_register = (val << 8) | (this.shift_register >> 8);
        };
        
        // Port 5: Output (sound 2)
        this.cpu.outHandlers[5] = (port, val) => {
            // Shot, invader death
        };
        
        // Port 6: Output (sound 3)
        this.cpu.outHandlers[6] = (port, val) => {
            // Fleet movement
        };
    }
    
    initDisplay() {
        this.canvas = document.getElementById('display');
        this.ctx = this.canvas.getContext('2d');
        
        // Create image data for direct pixel manipulation
        this.imageData = this.ctx.createImageData(224, 256);
    }
    
    setupInputHandlers() {
        // Reset input states
        this.port1_coins = false;
        this.port1_1p = false;
        this.port1_2p = false;
        this.port1_shoot = false;
        this.port1_left = false;
        this.port1_right = false;
        
        this.port2_shoot = false;
        this.port2_left = false;
        this.port2_right = false;
        
        document.addEventListener('keydown', (e) => {
            switch(e.key) {
                case '5': this.port1_coins = true; break; // Coin
                case '1': this.port1_1p = true; break;   // 1P start
                case '2': this.port1_2p = true; break;   // 2P start
                case ' ': this.port1_shoot = true; 
                         this.port2_shoot = true; break; // Shoot
                case 'a':
                case 'A': this.port1_left = true;
                         this.port2_left = true; break;  // Left
                case 'd':
                case 'D': this.port1_right = true;
                         this.port2_right = true; break; // Right
            }
            e.preventDefault();
        });
        
        document.addEventListener('keyup', (e) => {
            switch(e.key) {
                case '5': this.port1_coins = false; break;
                case '1': this.port1_1p = false; break;
                case '2': this.port1_2p = false; break;
                case ' ': this.port1_shoot = false;
                         this.port2_shoot = false; break;
                case 'a':
                case 'A': this.port1_left = false;
                         this.port2_left = false; break;
                case 'd':
                case 'D': this.port1_right = false;
                         this.port2_right = false; break;
            }
            e.preventDefault();
        });
    }
    
    loadROMs(files) {
        const readers = [];
        const romOrder = ['invaders.h', 'invaders.g', 'invaders.f', 'invaders.e'];
        
        for (const file of files) {
            const reader = new FileReader();
            readers.push(new Promise((resolve) => {
                reader.onload = (e) => {
                    const data = new Uint8Array(e.target.result);
                    const name = file.name.toLowerCase();
                    
                    // Load ROMs at specific addresses [citation:2]
                    if (name.includes('invaders.h'))
                        for (let i = 0; i < data.length; i++)
                            this.cpu.memory[0x0000 + i] = data[i];
                    else if (name.includes('invaders.g'))
                        for (let i = 0; i < data.length; i++)
                            this.cpu.memory[0x0800 + i] = data[i];
                    else if (name.includes('invaders.f'))
                        for (let i = 0; i < data.length; i++)
                            this.cpu.memory[0x1000 + i] = data[i];
                    else if (name.includes('invaders.e'))
                        for (let i = 0; i < data.length; i++)
                            this.cpu.memory[0x1800 + i] = data[i];
                    
                    resolve();
                };
                reader.readAsArrayBuffer(file);
            }));
        }
        
        return Promise.all(readers);
    }
    
    render() {
        // Space Invaders screen is rotated 90° and mirrored
        for (let y = 0; y < 256; y++) {
            for (let x = 0; x < 224; x++) {
                const srcX = 255 - y;  // Rotate
                const srcY = x;
                
                const byteAddr = 0x2400 + (srcY * 32) + Math.floor(srcX / 8);
                const bit = 0x80 >> (srcX % 8);
                const pixel = (this.cpu.read(byteAddr) & bit) ? 255 : 0;
                
                const idx = (y * 224 + x) * 4;
                this.imageData.data[idx] = pixel;      // R
                this.imageData.data[idx+1] = pixel;    // G
                this.imageData.data[idx+2] = pixel;    // B
                this.imageData.data[idx+3] = 255;      // A
            }
        }
        
        this.ctx.putImageData(this.imageData, 0, 0);
    }
    
    runFrame() {
        let cycles = 0;
        const targetCycles = this.cycles_per_frame;
        
        while (cycles < targetCycles) {
            cycles += this.cpu.step();
        }
        
        // Interrupts: RST 1 at VBLANK (60Hz)
        if (this.frame % 2 === 0) {
            this.cpu.int_active = true;
            this.cpu.int_vector = 1;  // RST 1 at 0x08
        } else {
            this.cpu.int_active = true;
            this.cpu.int_vector = 2;  // RST 2 at 0x10
        }
        
        this.render();
        this.frame++;
    }
    
    reset() {
        this.cpu.pc = 0;
        this.cpu.sp = 0;
        this.cpu.a = 0;
        this.cpu.b = 0;
        this.cpu.c = 0;
        this.cpu.d = 0;
        this.cpu.e = 0;
        this.cpu.h = 0;
        this.cpu.l = 0;
        this.cpu.f = 0;
        this.cpu.halted = false;
        this.cpu.iff = false;
        this.shift_register = 0;
        this.shift_offset = 0;
    }
}

// Main emulator controller
class EmulatorController {
    constructor() {
        this.invaders = new SpaceInvaders();
        this.running = false;
        this.animationFrame = null;
        
        this.setupUI();
    }
    
    setupUI() {
        document.getElementById('romLoader').addEventListener('change', async (e) => {
            if (e.target.files.length > 0) {
                document.getElementById('status').textContent = 'Loading ROMs...';
                await this.invaders.loadROMs(e.target.files);
                document.getElementById('status').textContent = 'ROMs loaded! Click START';
            }
        });
        
        document.getElementById('startBtn').addEventListener('click', () => {
            if (!this.running) {
                this.running = true;
                this.run();
            }
        });
        
        document.getElementById('resetBtn').addEventListener('click', () => {
            this.running = false;
            if (this.animationFrame) {
                cancelAnimationFrame(this.animationFrame);
            }
            this.invaders.reset();
            document.getElementById('status').textContent = 'Reset complete';
        });
    }
    
    run() {
        if (!this.running) return;
        
        this.invaders.runFrame();
        
        this.animationFrame = requestAnimationFrame(() => this.run());
    }
}

// Start when page loads
window.onload = () => {
    new EmulatorController();
};