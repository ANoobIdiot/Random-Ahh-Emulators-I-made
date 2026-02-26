// Base class for all 8080 arcade hardware
export class ArcadeHardware {
    constructor(cpu, gameConfig) {
        this.cpu = cpu;
        this.config = gameConfig;
        
        // Common hardware states
        this.frame = 0;
        this.frame_buffer = new Uint8Array(this.config.video.width * this.config.video.height);
        this.cycles_per_frame = 2000000 / 60; // 2MHz / 60Hz
        
        // Input states
        this.inputs = {};
        this.initializeInputs();
        
        // Sound states
        this.sound_channels = new Array(8).fill(0);
        
        // Setup handlers
        this.setupMemoryMap();
        this.setupIOPorts();
    }
    
    initializeInputs() {
        // Initialize all possible input bits to 0
        for (let i = 0; i < 16; i++) {
            this.inputs[`port1_${i}`] = 0;
            this.inputs[`port2_${i}`] = 0;
        }
    }
    
    setupMemoryMap() {
        // Clear and setup memory based on config
        for (let i = 0; i < 0x10000; i++) {
            this.cpu.memory[i] = 0;
        }
        
        // Setup ROM regions (read-only)
        for (const region of this.config.memoryMap.rom) {
            this.romStart = region.start;
            this.romEnd = region.end;
            // ROM data will be loaded later
        }
        
        // Setup RAM regions (read-write)
        for (const region of this.config.memoryMap.ram) {
            // RAM is just normal memory, already zeroed
        }
        
        // Setup video RAM regions
        if (this.config.memoryMap.video) {
            this.videoRAM = this.config.memoryMap.video;
        }
    }
    
    setupIOPorts() {
        // Clear existing handlers
        for (let i = 0; i < 256; i++) {
            this.cpu.inHandlers[i] = null;
            this.cpu.outHandlers[i] = null;
        }
        
        // Setup IN handlers
        for (const [port, handler] of Object.entries(this.config.ports.in)) {
            this.cpu.inHandlers[port] = this.createInHandler(handler);
        }
        
        // Setup OUT handlers
        for (const [port, handler] of Object.entries(this.config.ports.out)) {
            this.cpu.outHandlers[port] = this.createOutHandler(handler);
        }
    }
    
    createInHandler(handlerName) {
        return (port) => {
            switch(handlerName) {
                case "dip_switches":
                    return this.readDipSwitches();
                case "player_1":
                    return this.readPlayer1Inputs();
                case "player_2":
                    return this.readPlayer2Inputs();
                case "coin":
                    return this.readCoinInputs();
                case "shift_register":
                    return this.readShiftRegister();
                case "watchdog":
                    return 0; // Watchdog reset
                case "sound_status":
                    return this.readSoundStatus();
                case "player_controls":
                    return this.readPlayerControls();
                default:
                    console.log(`Unhandled IN handler: ${handlerName}`);
                    return 0;
            }
        };
    }
    
    createOutHandler(handlerName) {
        return (port, val) => {
            switch(handlerName) {
                case "shift_offset":
                    this.shift_offset = val & 0x07;
                    break;
                case "shift_data":
                    this.shift_register = (val << 8) | (this.shift_register >> 8);
                    break;
                case "sound_1":
                case "sound_2":
                case "sound_3":
                case "sound_4":
                    this.handleSound(handlerName, val);
                    break;
                case "video_select":
                    this.video_page = val & 0x01;
                    break;
                case "watchdog_reset":
                    // Reset watchdog timer
                    break;
                case "coin_counter":
                    // Increment coin counter
                    break;
                default:
                    console.log(`Unhandled OUT handler: ${handlerName}`);
            }
        };
    }
    
    readDipSwitches() {
        return this.config.dipSettings.default || 0;
    }
    
    readPlayer1Inputs() {
        let val = 0;
        if (this.inputs.p1_up) val |= 0x01;
        if (this.inputs.p1_down) val |= 0x02;
        if (this.inputs.p1_left) val |= 0x04;
        if (this.inputs.p1_right) val |= 0x08;
        if (this.inputs.p1_fire) val |= 0x10;
        if (this.inputs.p1_fire2) val |= 0x20;
        if (this.inputs.p1_start) val |= 0x40;
        return val;
    }
    
    readPlayer2Inputs() {
        let val = 0;
        if (this.inputs.p2_up) val |= 0x01;
        if (this.inputs.p2_down) val |= 0x02;
        if (this.inputs.p2_left) val |= 0x04;
        if (this.inputs.p2_right) val |= 0x08;
        if (this.inputs.p2_fire) val |= 0x10;
        if (this.inputs.p2_fire2) val |= 0x20;
        if (this.inputs.p2_start) val |= 0x40;
        return val;
    }
    
    readCoinInputs() {
        let val = 0;
        if (this.inputs.coin1) val |= 0x01;
        if (this.inputs.coin2) val |= 0x02;
        if (this.inputs.service) val |= 0x04;
        return val;
    }
    
    readShiftRegister() {
        return (this.shift_register >> (8 - this.shift_offset)) & 0xFF;
    }
    
    handleSound(channel, val) {
        this.sound_channels[parseInt(channel.split('_')[1])] = val;
        // In a real implementation, this would drive audio
    }
    
    loadROMs(files) {
        const promises = [];
        
        for (const file of files) {
            const promise = new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const data = new Uint8Array(e.target.result);
                    const filename = file.name.toLowerCase();
                    
                    // Match filename to memory region
                    for (const region of this.config.memoryMap.rom) {
                        if (filename.includes(region.fileMatch)) {
                            for (let i = 0; i < data.length && i < region.size; i++) {
                                this.cpu.memory[region.start + i] = data[i];
                            }
                            console.log(`Loaded ${filename} at 0x${region.start.toString(16)}`);
                            break;
                        }
                    }
                    resolve();
                };
                reader.readAsArrayBuffer(file);
            });
            promises.push(promise);
        }
        
        return Promise.all(promises);
    }
    
    render() {
        // To be implemented by specific games
        throw new Error("Render method must be implemented by game hardware");
    }
    
    runFrame() {
        let cycles = 0;
        
        while (cycles < this.cycles_per_frame) {
            cycles += this.cpu.step();
        }
        
        // Handle interrupts based on game config
        if (this.config.interrupts) {
            for (const int of this.config.interrupts) {
                if (this.frame % int.period === 0) {
                    this.cpu.int_active = true;
                    this.cpu.int_vector = int.vector;
                }
            }
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
        this.frame = 0;
        this.shift_register = 0;
        this.shift_offset = 0;
    }
}