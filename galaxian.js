import { ArcadeHardware } from './base.js';

export class GalaxianHardware extends ArcadeHardware {
    constructor(cpu) {
        const config = {
            name: "Galaxian (1979)",
            year: 1979,
            manufacturer: "Namco",
            cpu: "Z80",  // Note: Uses Z80, but our CPU is 8080-compatible
            video: {
                width: 256,
                height: 224,
                rotation: 0,
                color: true,
                sprites: true
            },
            memoryMap: {
                rom: [
                    { start: 0x0000, end: 0x3FFF, size: 16384, fileMatch: "gal" }
                ],
                ram: [
                    { start: 0x4000, end: 0x47FF, size: 2048 }
                ],
                video: {
                    start: 0x4000,
                    tilemap: 0x4400,
                    sprites: 0x4600
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
                    2: "sound_3",
                    3: "flip_screen"
                }
            },
            interrupts: [
                { vector: 0x08, period: 2 } // VBLANK
            ]
        };
        
        super(cpu, config);
        
        // Galaxian specific: hardware sprites, tilemap, star field
        this.sprite_ram = new Uint8Array(64 * 4); // 64 sprites, 4 bytes each
        this.tile_ram = new Uint8Array(32 * 28); // 32x28 tilemap
        this.star_field = new Array(256);
        this.flip_screen = false;
        
        // Initialize star field
        for (let i = 0; i < 256; i++) {
            this.star_field[i] = {
                x: Math.random() * 256,
                y: Math.random() * 224,
                bright: Math.random() > 0.7
            };
        }
    }
    
    createOutHandler(handlerName) {
        if (handlerName === "flip_screen") {
            return (port, val) => {
                this.flip_screen = (val & 0x01) !== 0;
            };
        }
        return super.createOutHandler(handlerName);
    }
    
    render() {
        // Render background (stars)
        for (const star of this.star_field) {
            if (star.bright) {
                const x = Math.floor(star.x);
                const y = Math.floor(star.y);
                if (x >= 0 && x < 256 && y >= 0 && y < 224) {
                    const idx = (y * 256 + x) * 4;
                    // Draw star pixel
                }
            }
        }
        
        // Render tilemap (background graphics)
        for (let ty = 0; ty < 28; ty++) {
            for (let tx = 0; tx < 32; tx++) {
                const tileIndex = this.cpu.read(0x4400 + ty * 32 + tx);
                this.drawTile(tileIndex, tx * 8, ty * 8);
            }
        }
        
        // Render sprites (enemies, player, bullets)
        for (let i = 0; i < 64; i++) {
            const base = 0x4600 + i * 4;
            const y = this.cpu.read(base);
            const x = this.cpu.read(base + 1);
            const pattern = this.cpu.read(base + 2);
            const attr = this.cpu.read(base + 3);
            
            if (y !== 0 && x !== 0) {
                this.drawSprite(pattern, x, y, attr);
            }
        }
    }
    
    drawTile(index, x, y) {
        // Tile drawing logic
        const tileData = this.cpu.memory.slice(0x4000 + index * 16, 0x4000 + index * 16 + 16);
        for (let py = 0; py < 8; py++) {
            for (let px = 0; px < 8; px++) {
                const bit = 0x80 >> px;
                const pixel = (tileData[py * 2] & bit) ? 1 : 0;
                const color = (tileData[py * 2 + 1] & bit) ? 2 : 0;
                if (pixel) {
                    // Draw pixel at (x + px, y + py)
                }
            }
        }
    }
    
    drawSprite(pattern, x, y, attr) {
        // Sprite drawing logic (16x16 sprites)
        const spriteData = this.cpu.memory.slice(0x5000 + pattern * 32, 0x5000 + pattern * 32 + 32);
        for (let py = 0; py < 16; py++) {
            for (let px = 0; px < 16; px++) {
                const bit = 0x80 >> (px % 8);
                const byte = spriteData[py * 2 + Math.floor(px / 8)];
                if (byte & bit) {
                    // Draw pixel at calculated position with flip handling
                }
            }
        }
    }
}