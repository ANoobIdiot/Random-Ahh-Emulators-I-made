import { ArcadeHardware } from './base.js';

export class AlienInvasionHardware extends ArcadeHardware {
    constructor(cpu) {
        const config = {
            name: "Alien Invasion (1978)",
            year: 1978,
            manufacturer: "Midway",
            video: {
                width: 224,
                height: 256,
                rotation: 90  // Like Space Invaders
            },
            memoryMap: {
                rom: [
                    { start: 0x0000, end: 0x1FFF, size: 8192, fileMatch: "alien" }
                ],
                ram: [
                    { start: 0x2000, end: 0x23FF, size: 1024 }
                ],
                video: {
                    start: 0x2400,
                    end: 0x3FFF,
                    format: "1bpp"
                }
            },
            ports: {
                in: {
                    1: "dip_switches",
                    2: "player_controls",
                    3: "shift_register"
                },
                out: {
                    2: "shift_offset",
                    3: "sound_1",
                    4: "shift_data",
                    5: "sound_2",
                    6: "sound_3"
                }
            },
            interrupts: [
                { vector: 0x08, period: 2 },
                { vector: 0x10, period: 2 }
            ],
            dipSettings: {
                default: 0x08  // Bit 3 set
            }
        };
        
        super(cpu, config);
        
        // Same shift register hardware as Space Invaders
        this.shift_register = 0;
        this.shift_offset = 0;
    }
    
    readPlayerControls() {
        let val = 0x08; // Bit 3 always set
        if (this.inputs.p1_shoot) val |= 0x10;
        if (this.inputs.p1_left) val |= 0x20;
        if (this.inputs.p1_right) val |= 0x40;
        return val;
    }
    
    render() {
        // Rotated display like Space Invaders
        for (let y = 0; y < 256; y++) {
            for (let x = 0; x < 224; x++) {
                // Rotate coordinates
                const srcX = 255 - y;
                const srcY = x;
                
                const byteAddr = this.videoRAM.start + (srcY * 32) + Math.floor(srcX / 8);
                const bit = 0x80 >> (srcX % 8);
                const pixel = (this.cpu.read(byteAddr) & bit) ? 255 : 0;
                
                const idx = (y * 224 + x) * 4;
                // Set pixel in frame buffer
            }
        }
    }
}