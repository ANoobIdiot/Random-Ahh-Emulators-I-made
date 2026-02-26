import { ArcadeHardware } from './base.js';

export class LupinIIIHardware extends ArcadeHardware {
    constructor(cpu) {
        const config = {
            name: "Lupin III (1980)",
            year: 1980,
            manufacturer: "Taito",
            video: {
                width: 256,
                height: 224,
                rotation: 0,
                color: true  // Actually color!
            },
            memoryMap: {
                rom: [
                    { start: 0x0000, end: 0x1FFF, size: 8192, fileMatch: "lupin" }
                ],
                ram: [
                    { start: 0x8000, end: 0x83FF, size: 1024 }
                ],
                video: {
                    start: 0x8800,
                    format: "color",
                    palette: "lupin"
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
                    2: "video_select",
                    3: "color_bank"
                }
            },
            interrupts: [
                { vector: 0x08, period: 2 }
            ]
        };
        
        super(cpu, config);
        
        // Lupin III specific: color palette
        this.color_bank = 0;
        this.palette = [
            0x000000, 0xFFFFFF, 0xFF0000, 0x00FF00,
            0x0000FF, 0xFFFF00, 0xFF00FF, 0x00FFFF
        ];
    }
    
    createOutHandler(handlerName) {
        if (handlerName === "color_bank") {
            return (port, val) => {
                this.color_bank = val & 0x07;
            };
        }
        return super.createOutHandler(handlerName);
    }
    
    render() {
        // Color rendering
        for (let y = 0; y < 224; y++) {
            for (let x = 0; x < 256; x++) {
                const byteAddr = this.videoRAM.start + (y * 32) + Math.floor(x / 4); // 2 bits per pixel
                const shift = 6 - ((x % 4) * 2);
                const colorIndex = (this.cpu.read(byteAddr) >> shift) & 0x03;
                
                // Apply color bank
                const paletteIndex = (this.color_bank << 2) | colorIndex;
                const color = this.palette[paletteIndex % this.palette.length];
                
                const idx = (y * 256 + x) * 4;
                // Set RGB pixels
            }
        }
    }
}