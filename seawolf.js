import { ArcadeHardware } from './base.js';

export class SeaWolfHardware extends ArcadeHardware {
    constructor(cpu) {
        const config = {
            name: "Sea Wolf (1976)",
            year: 1976,
            manufacturer: "Midway",
            video: {
                width: 256,
                height: 224,
                rotation: 0
            },
            memoryMap: {
                rom: [
                    { start: 0x0000, end: 0x0FFF, size: 4096, fileMatch: "seawolf" }
                ],
                ram: [
                    { start: 0x8000, end: 0x83FF, size: 1024 }
                ],
                video: {
                    start: 0x8000,
                    format: "1bpp"
                }
            },
            ports: {
                in: {
                    0: "player_1",
                    1: "player_2",
                    2: "coin"
                },
                out: {
                    0: "sound_1",
                    1: "sound_2",
                    2: "torpedo_sound"
                }
            },
            interrupts: [
                { vector: 0x08, period: 2 }
            ],
            dipSettings: {
                default: 0x00
            }
        };
        
        super(cpu, config);
        
        // Sea Wolf specific: periscope view, torpedo counter
        this.torpedoes = 10;
        this.periscope_position = 0;
    }
    
    createInHandler(handlerName) {
        if (handlerName === "player_1") {
            return () => {
                let val = super.readPlayer1Inputs();
                // Add periscope position to input
                val |= (this.periscope_position & 0x0F) << 4;
                return val;
            };
        }
        return super.createInHandler(handlerName);
    }
    
    render() {
        // Similar to Gun Fight but with overlay graphics for periscope
        for (let y = 0; y < 224; y++) {
            for (let x = 0; x < 256; x++) {
                const byteAddr = this.videoRAM.start + (y * 32) + Math.floor(x / 8);
                const bit = 0x80 >> (x % 8);
                let pixel = (this.cpu.read(byteAddr) & bit) ? 255 : 0;
                
                // Add periscope reticle
                if (Math.abs(x - this.periscope_position * 16) < 4 && y > 100 && y < 124) {
                    pixel = 255;
                }
                
                const idx = (y * 256 + x) * 4;
                // Set pixel in frame buffer
            }
        }
    }
}