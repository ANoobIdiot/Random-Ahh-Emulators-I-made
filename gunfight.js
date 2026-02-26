import { ArcadeHardware } from './base.js';

export class GunFightHardware extends ArcadeHardware {
    constructor(cpu) {
        const config = {
            name: "Gun Fight (1975)",
            year: 1975,
            manufacturer: "Midway",
            video: {
                width: 256,
                height: 224,
                rotation: 0
            },
            memoryMap: {
                rom: [
                    { start: 0x0000, end: 0x07FF, size: 2048, fileMatch: "gunfight.1" },
                    { start: 0x0800, end: 0x0FFF, size: 2048, fileMatch: "gunfight.2" }
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
                    1: "sound_2"
                }
            },
            interrupts: [
                { vector: 0x08, period: 2 } // 30Hz interrupt
            ],
            dipSettings: {
                default: 0x00
            }
        };
        
        super(cpu, config);
        
        // Gun Fight specific hardware
        this.bullet_sprites = [];
    }
    
    render() {
        // Gun Fight uses bitmapped display at 0x8000
        for (let y = 0; y < 224; y++) {
            for (let x = 0; x < 256; x++) {
                const byteAddr = this.videoRAM.start + (y * 32) + Math.floor(x / 8);
                const bit = 0x80 >> (x % 8);
                const pixel = (this.cpu.read(byteAddr) & bit) ? 255 : 0;
                
                const idx = (y * 256 + x) * 4;
                // Access frame buffer through canvas later
            }
        }
    }
}