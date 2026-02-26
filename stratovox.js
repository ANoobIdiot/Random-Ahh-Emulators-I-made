import { ArcadeHardware } from './base.js';

export class StratovoxHardware extends ArcadeHardware {
    constructor(cpu) {
        const config = {
            name: "Stratovox (1980)",
            year: 1980,
            manufacturer: "Taito",
            video: {
                width: 256,
                height: 224,
                rotation: 0
            },
            memoryMap: {
                rom: [
                    { start: 0x0000, end: 0x1FFF, size: 8192, fileMatch: "strat" }
                ],
                ram: [
                    { start: 0x8000, end: 0x83FF, size: 1024 }
                ],
                video: {
                    start: 0x8400,
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
                    2: "speech",
                    3: "speech_data"
                }
            },
            interrupts: [
                { vector: 0x08, period: 2 }
            ]
        };
        
        super(cpu, config);
        
        // Stratovox specific: speech synthesis
        this.speech_data = 0;
        this.speech_rom = new Uint8Array(4096);
        this.speech_playing = false;
    }
    
    createOutHandler(handlerName) {
        switch(handlerName) {
            case "speech":
                return (port, val) => {
                    this.speech_playing = val !== 0;
                };
            case "speech_data":
                return (port, val) => {
                    this.speech_data = val;
                    // Trigger speech synthesis
                    console.log("Speech data: " + val.toString(16));
                };
            default:
                return super.createOutHandler(handlerName);
        }
    }
}