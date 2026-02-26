import { ArcadeHardware } from './base.js';

export class SpaceFuryHardware extends ArcadeHardware {
    constructor(cpu) {
        const config = {
            name: "Space Fury (1978)",
            year: 1978,
            manufacturer: "Sega",
            video: {
                width: 256,
                height: 224,
                rotation: 0
            },
            memoryMap: {
                rom: [
                    { start: 0x0000, end: 0x1FFF, size: 8192, fileMatch: "fury" }
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
                    2: "sound_3",
                    3: "sound_4"
                }
            },
            interrupts: [
                { vector: 0x08, period: 2 },
                { vector: 0x10, period: 4 }
            ]
        };
        
        super(cpu, config);
        
        // Space Fury specific: vector-like display, speech synthesis
        this.speech_rom = new Uint8Array(2048);
        this.speech_active = false;
    }
    
    createOutHandler(handlerName) {
        if (handlerName === "speech") {
            return (port, val) => {
                this.speech_active = val !== 0;
                // Trigger speech synthesis
                console.log("Speech: " + (val ? "ON" : "OFF"));
            };
        }
        return super.createOutHandler(handlerName);
    }
}