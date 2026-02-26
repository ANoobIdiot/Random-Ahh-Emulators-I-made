// i8080.js - Intel 8080 CPU Emulator
export class i8080 {
    constructor() {
        // Registers
        this.a = 0;  this.b = 0;  this.c = 0;
        this.d = 0;  this.e = 0;  this.h = 0;  this.l = 0;
        this.sp = 0;  // Stack pointer (16-bit)
        this.pc = 0;  // Program counter (16-bit)
        
        // Flags (stored in single byte)
        // Bit 7: Sign, Bit 6: Zero, Bit 4: Aux Carry
        // Bit 2: Parity, Bit 0: Carry
        this.f = 0;
        
        // Interrupts
        this.iff = false;     // Interrupt flip-flop
        this.halted = false;
        this.int_active = false;
        this.int_vector = 0;
        
        // Memory
        this.memory = new Uint8Array(0x10000);
        
        // I/O handlers
        this.inHandlers = new Array(256).fill(null);
        this.outHandlers = new Array(256).fill(null);
        
        // Cycle counting
        this.cycles = 0;
    }
    
    // Flag helpers
    getFlag(bit) { return (this.f >> bit) & 1; }
    setFlag(bit) { this.f |= (1 << bit); }
    clearFlag(bit) { this.f &= ~(1 << bit); }
    
    updateFlag(bit, condition) {
        if (condition) this.setFlag(bit);
        else this.clearFlag(bit);
    }
    
    // Parity: even number of 1 bits
    parity(x) {
        let ones = 0;
        for (let i = 0; i < 8; i++)
            if (x & (1 << i)) ones++;
        return (ones % 2) === 0;
    }
    
    // Register pairs
    getBC() { return (this.b << 8) | this.c; }
    setBC(val) { this.b = (val >> 8) & 0xFF; this.c = val & 0xFF; }
    
    getDE() { return (this.d << 8) | this.e; }
    setDE(val) { this.d = (val >> 8) & 0xFF; this.e = val & 0xFF; }
    
    getHL() { return (this.h << 8) | this.l; }
    setHL(val) { this.h = (val >> 8) & 0xFF; this.l = val & 0xFF; }
    
    // Memory access
    read(addr) { return this.memory[addr & 0xFFFF]; }
    write(addr, val) { this.memory[addr & 0xFFFF] = val & 0xFF; }
    
    // Stack operations
    push(val) {
        this.write(--this.sp, (val >> 8) & 0xFF);
        this.write(--this.sp, val & 0xFF);
    }
    
    pop() {
        const low = this.read(this.sp++);
        const high = this.read(this.sp++);
        return (high << 8) | low;
    }
    
    // Fetch next instruction byte
    fetch() { return this.read(this.pc++); }
    
    // Fetch 16-bit word (little endian)
    fetch16() {
        const low = this.fetch();
        const high = this.fetch();
        return (high << 8) | low;
    }
    
    // I/O
    in(port) {
        if (this.inHandlers[port])
            return this.inHandlers[port](port);
        return 0;
    }
    
    out(port, val) {
        if (this.outHandlers[port])
            this.outHandlers[port](port, val);
    }
    
    // Update flags for arithmetic
    setArithmeticFlags(result, carry, aux) {
        this.updateFlag(7, result & 0x80);  // Sign
        this.updateFlag(6, (result & 0xFF) === 0);  // Zero
        this.updateFlag(4, aux);  // Aux carry
        this.updateFlag(2, this.parity(result & 0xFF));  // Parity
        this.updateFlag(0, carry);  // Carry
    }
    
    // ADD instruction
    add(val) {
        const result = this.a + val;
        const aux = ((this.a & 0xF) + (val & 0xF)) > 0xF;
        this.setArithmeticFlags(result, result > 0xFF, aux);
        this.a = result & 0xFF;
    }
    
    // SUB instruction
    sub(val) {
        const result = this.a - val;
        const aux = ((this.a & 0xF) - (val & 0xF)) < 0;
        this.setArithmeticFlags(result, result < 0, aux);
        this.a = result & 0xFF;
    }
    
    // AND instruction
    ana(val) {
        const result = this.a & val;
        this.updateFlag(7, result & 0x80);
        this.updateFlag(6, result === 0);
        this.updateFlag(4, ((this.a | val) & 0x08) ? true : false);
        this.updateFlag(2, this.parity(result));
        this.updateFlag(0, false);  // Carry cleared
        this.a = result;
    }
    
    // XOR instruction
    xra(val) {
        const result = this.a ^ val;
        this.updateFlag(7, result & 0x80);
        this.updateFlag(6, result === 0);
        this.updateFlag(4, false);  // Aux carry reset
        this.updateFlag(2, this.parity(result));
        this.updateFlag(0, false);  // Carry cleared
        this.a = result;
    }
    
    // OR instruction
    ora(val) {
        const result = this.a | val;
        this.updateFlag(7, result & 0x80);
        this.updateFlag(6, result === 0);
        this.updateFlag(4, false);  // Aux carry reset
        this.updateFlag(2, this.parity(result));
        this.updateFlag(0, false);  // Carry cleared
        this.a = result;
    }
    
    // Compare instruction
    cmp(val) {
        const result = this.a - val;
        this.updateFlag(7, result & 0x80);
        this.updateFlag(6, (result & 0xFF) === 0);
        this.updateFlag(4, ((this.a & 0xF) - (val & 0xF)) < 0);
        this.updateFlag(2, this.parity(result & 0xFF));
        this.updateFlag(0, result < 0);
    }
    
    // INR instruction
    inr(val) {
        const result = (val + 1) & 0xFF;
        this.updateFlag(7, result & 0x80);
        this.updateFlag(6, result === 0);
        this.updateFlag(4, ((val & 0xF) + 1) > 0xF);
        this.updateFlag(2, this.parity(result));
        // Carry flag unaffected
        return result;
    }
    
    // DCR instruction
    dcr(val) {
        const result = (val - 1) & 0xFF;
        this.updateFlag(7, result & 0x80);
        this.updateFlag(6, result === 0);
        this.updateFlag(4, ((val & 0xF) - 1) < 0);
        this.updateFlag(2, this.parity(result));
        // Carry flag unaffected
        return result;
    }
    
    // DAD instruction (double add)
    dad(val) {
        const hl = this.getHL();
        const result = hl + val;
        this.updateFlag(0, result > 0xFFFF);  // Carry only
        this.setHL(result & 0xFFFF);
    }
    
    // Execute one instruction, returns cycles
    step() {
        if (this.halted) return 4;
        
        // Handle interrupts
        if (this.iff && this.int_active) {
            this.iff = false;
            this.push(this.pc);
            this.pc = 8 * this.int_vector;  // RST instruction vector
            this.int_active = false;
            this.cycles += 11;
            return 11;
        }
        
        const opcode = this.fetch();
        let cycles = 4;
        
        switch(opcode) {
            // === NOP ===
            case 0x00: break;
            
            // === LXI (Load immediate 16-bit) ===
            case 0x01: this.setBC(this.fetch16()); cycles = 10; break;
            case 0x11: this.setDE(this.fetch16()); cycles = 10; break;
            case 0x21: this.setHL(this.fetch16()); cycles = 10; break;
            case 0x31: this.sp = this.fetch16(); cycles = 10; break;
            
            // === STAX (Store A indirect) ===
            case 0x02: this.write(this.getBC(), this.a); cycles = 7; break;
            case 0x12: this.write(this.getDE(), this.a); cycles = 7; break;
            
            // === INX (Increment register pair) ===
            case 0x03: this.setBC(this.getBC() + 1); cycles = 5; break;
            case 0x13: this.setDE(this.getDE() + 1); cycles = 5; break;
            case 0x23: this.setHL(this.getHL() + 1); cycles = 5; break;
            case 0x33: this.sp++; cycles = 5; break;
            
            // === INR (Increment register) ===
            case 0x04: this.b = this.inr(this.b); cycles = 5; break;
            case 0x0C: this.c = this.inr(this.c); cycles = 5; break;
            case 0x14: this.d = this.inr(this.d); cycles = 5; break;
            case 0x1C: this.e = this.inr(this.e); cycles = 5; break;
            case 0x24: this.h = this.inr(this.h); cycles = 5; break;
            case 0x2C: this.l = this.inr(this.l); cycles = 5; break;
            case 0x34: 
                this.write(this.getHL(), this.inr(this.read(this.getHL())));
                cycles = 10;
                break;
            case 0x3C: this.a = this.inr(this.a); cycles = 5; break;
            
            // === DCR (Decrement register) ===
            case 0x05: this.b = this.dcr(this.b); cycles = 5; break;
            case 0x0D: this.c = this.dcr(this.c); cycles = 5; break;
            case 0x15: this.d = this.dcr(this.d); cycles = 5; break;
            case 0x1D: this.e = this.dcr(this.e); cycles = 5; break;
            case 0x25: this.h = this.dcr(this.h); cycles = 5; break;
            case 0x2D: this.l = this.dcr(this.l); cycles = 5; break;
            case 0x35:
                this.write(this.getHL(), this.dcr(this.read(this.getHL())));
                cycles = 10;
                break;
            case 0x3D: this.a = this.dcr(this.a); cycles = 5; break;
            
            // === MVI (Move immediate) ===
            case 0x06: this.b = this.fetch(); cycles = 7; break;
            case 0x0E: this.c = this.fetch(); cycles = 7; break;
            case 0x16: this.d = this.fetch(); cycles = 7; break;
            case 0x1E: this.e = this.fetch(); cycles = 7; break;
            case 0x26: this.h = this.fetch(); cycles = 7; break;
            case 0x2E: this.l = this.fetch(); cycles = 7; break;
            case 0x36: this.write(this.getHL(), this.fetch()); cycles = 10; break;
            case 0x3E: this.a = this.fetch(); cycles = 7; break;
            
            // === RLC (Rotate left) ===
            case 0x07:
                this.f = (this.f & 0xFE) | ((this.a & 0x80) >> 7);
                this.a = ((this.a << 1) | ((this.a & 0x80) >> 7)) & 0xFF;
                cycles = 4;
                break;
                
            // === DAD (Double add) ===
            case 0x09: this.dad(this.getBC()); cycles = 10; break;
            case 0x19: this.dad(this.getDE()); cycles = 10; break;
            case 0x29: this.dad(this.getHL()); cycles = 10; break;
            case 0x39: this.dad(this.sp); cycles = 10; break;
            
            // === LDAX (Load A indirect) ===
            case 0x0A: this.a = this.read(this.getBC()); cycles = 7; break;
            case 0x1A: this.a = this.read(this.getDE()); cycles = 7; break;
            
            // === DCX (Decrement register pair) ===
            case 0x0B: this.setBC(this.getBC() - 1); cycles = 5; break;
            case 0x1B: this.setDE(this.getDE() - 1); cycles = 5; break;
            case 0x2B: this.setHL(this.getHL() - 1); cycles = 5; break;
            case 0x3B: this.sp--; cycles = 5; break;
            
            // === RRC (Rotate right) ===
            case 0x0F:
                this.f = (this.f & 0xFE) | (this.a & 0x01);
                this.a = ((this.a >> 1) | ((this.a & 0x01) << 7)) & 0xFF;
                cycles = 4;
                break;
                
            // === MOV instructions (register to register) ===
            case 0x40: break; // MOV B,B (NOP)
            case 0x41: this.b = this.c; break;
            case 0x42: this.b = this.d; break;
            case 0x43: this.b = this.e; break;
            case 0x44: this.b = this.h; break;
            case 0x45: this.b = this.l; break;
            case 0x46: this.b = this.read(this.getHL()); cycles = 7; break;
            case 0x47: this.b = this.a; break;
            
            case 0x48: this.c = this.b; break;
            case 0x49: break; // MOV C,C
            case 0x4A: this.c = this.d; break;
            case 0x4B: this.c = this.e; break;
            case 0x4C: this.c = this.h; break;
            case 0x4D: this.c = this.l; break;
            case 0x4E: this.c = this.read(this.getHL()); cycles = 7; break;
            case 0x4F: this.c = this.a; break;
            
            case 0x50: this.d = this.b; break;
            case 0x51: this.d = this.c; break;
            case 0x52: break; // MOV D,D
            case 0x53: this.d = this.e; break;
            case 0x54: this.d = this.h; break;
            case 0x55: this.d = this.l; break;
            case 0x56: this.d = this.read(this.getHL()); cycles = 7; break;
            case 0x57: this.d = this.a; break;
            
            case 0x58: this.e = this.b; break;
            case 0x59: this.e = this.c; break;
            case 0x5A: this.e = this.d; break;
            case 0x5B: break; // MOV E,E
            case 0x5C: this.e = this.h; break;
            case 0x5D: this.e = this.l; break;
            case 0x5E: this.e = this.read(this.getHL()); cycles = 7; break;
            case 0x5F: this.e = this.a; break;
            
            case 0x60: this.h = this.b; break;
            case 0x61: this.h = this.c; break;
            case 0x62: this.h = this.d; break;
            case 0x63: this.h = this.e; break;
            case 0x64: break; // MOV H,H
            case 0x65: this.h = this.l; break;
            case 0x66: this.h = this.read(this.getHL()); cycles = 7; break;
            case 0x67: this.h = this.a; break;
            
            case 0x68: this.l = this.b; break;
            case 0x69: this.l = this.c; break;
            case 0x6A: this.l = this.d; break;
            case 0x6B: this.l = this.e; break;
            case 0x6C: this.l = this.h; break;
            case 0x6D: break; // MOV L,L
            case 0x6E: this.l = this.read(this.getHL()); cycles = 7; break;
            case 0x6F: this.l = this.a; break;
            
            case 0x70: this.write(this.getHL(), this.b); cycles = 7; break;
            case 0x71: this.write(this.getHL(), this.c); cycles = 7; break;
            case 0x72: this.write(this.getHL(), this.d); cycles = 7; break;
            case 0x73: this.write(this.getHL(), this.e); cycles = 7; break;
            case 0x74: this.write(this.getHL(), this.h); cycles = 7; break;
            case 0x75: this.write(this.getHL(), this.l); cycles = 7; break;
            case 0x77: this.write(this.getHL(), this.a); cycles = 7; break;
            
            case 0x78: this.a = this.b; break;
            case 0x79: this.a = this.c; break;
            case 0x7A: this.a = this.d; break;
            case 0x7B: this.a = this.e; break;
            case 0x7C: this.a = this.h; break;
            case 0x7D: this.a = this.l; break;
            case 0x7E: this.a = this.read(this.getHL()); cycles = 7; break;
            case 0x7F: break; // MOV A,A
            
            // === HLT ===
            case 0x76: this.halted = true; cycles = 7; break;
            
            // === ADD ===
            case 0x80: this.add(this.b); break;
            case 0x81: this.add(this.c); break;
            case 0x82: this.add(this.d); break;
            case 0x83: this.add(this.e); break;
            case 0x84: this.add(this.h); break;
            case 0x85: this.add(this.l); break;
            case 0x86: this.add(this.read(this.getHL())); cycles = 7; break;
            case 0x87: this.add(this.a); break;
            
            // === SUB ===
            case 0x90: this.sub(this.b); break;
            case 0x91: this.sub(this.c); break;
            case 0x92: this.sub(this.d); break;
            case 0x93: this.sub(this.e); break;
            case 0x94: this.sub(this.h); break;
            case 0x95: this.sub(this.l); break;
            case 0x96: this.sub(this.read(this.getHL())); cycles = 7; break;
            case 0x97: this.sub(this.a); break;
            
            // === ANA ===
            case 0xA0: this.ana(this.b); break;
            case 0xA1: this.ana(this.c); break;
            case 0xA2: this.ana(this.d); break;
            case 0xA3: this.ana(this.e); break;
            case 0xA4: this.ana(this.h); break;
            case 0xA5: this.ana(this.l); break;
            case 0xA6: this.ana(this.read(this.getHL())); cycles = 7; break;
            case 0xA7: this.ana(this.a); break;
            
            // === XRA ===
            case 0xA8: this.xra(this.b); break;
            case 0xA9: this.xra(this.c); break;
            case 0xAA: this.xra(this.d); break;
            case 0xAB: this.xra(this.e); break;
            case 0xAC: this.xra(this.h); break;
            case 0xAD: this.xra(this.l); break;
            case 0xAE: this.xra(this.read(this.getHL())); cycles = 7; break;
            case 0xAF: this.xra(this.a); break;
            
            // === ORA ===
            case 0xB0: this.ora(this.b); break;
            case 0xB1: this.ora(this.c); break;
            case 0xB2: this.ora(this.d); break;
            case 0xB3: this.ora(this.e); break;
            case 0xB4: this.ora(this.h); break;
            case 0xB5: this.ora(this.l); break;
            case 0xB6: this.ora(this.read(this.getHL())); cycles = 7; break;
            case 0xB7: this.ora(this.a); break;
            
            // === CMP ===
            case 0xB8: this.cmp(this.b); break;
            case 0xB9: this.cmp(this.c); break;
            case 0xBA: this.cmp(this.d); break;
            case 0xBB: this.cmp(this.e); break;
            case 0xBC: this.cmp(this.h); break;
            case 0xBD: this.cmp(this.l); break;
            case 0xBE: this.cmp(this.read(this.getHL())); cycles = 7; break;
            case 0xBF: this.cmp(this.a); break;
            
            // === RNZ ===
            case 0xC0:
                if (!this.getFlag(6)) {
                    this.pc = this.pop();
                    cycles = 11;
                } else cycles = 5;
                break;
                
            // === POP B ===
            case 0xC1: this.setBC(this.pop()); cycles = 10; break;
            
            // === JNZ ===
            case 0xC2:
                {
                    const addr = this.fetch16();
                    if (!this.getFlag(6)) this.pc = addr;
                    cycles = 10;
                }
                break;
                
            // === JMP ===
            case 0xC3: this.pc = this.fetch16(); cycles = 10; break;
            
            // === CNZ ===
            case 0xC4:
                {
                    const addr = this.fetch16();
                    if (!this.getFlag(6)) {
                        this.push(this.pc);
                        this.pc = addr;
                        cycles = 17;
                    } else cycles = 11;
                }
                break;
                
            // === PUSH B ===
            case 0xC5: this.push(this.getBC()); cycles = 11; break;
            
            // === ADI ===
            case 0xC6: this.add(this.fetch()); cycles = 7; break;
            
            // === RST 0 ===
            case 0xC7: this.push(this.pc); this.pc = 0x00; cycles = 11; break;
            
            // === RZ ===
            case 0xC8:
                if (this.getFlag(6)) {
                    this.pc = this.pop();
                    cycles = 11;
                } else cycles = 5;
                break;
                
            // === RET ===
            case 0xC9: this.pc = this.pop(); cycles = 10; break;
            
            // === JZ ===
            case 0xCA:
                {
                    const addr = this.fetch16();
                    if (this.getFlag(6)) this.pc = addr;
                    cycles = 10;
                }
                break;
                
            // === CZ ===
            case 0xCC:
                {
                    const addr = this.fetch16();
                    if (this.getFlag(6)) {
                        this.push(this.pc);
                        this.pc = addr;
                        cycles = 17;
                    } else cycles = 11;
                }
                break;
                
            // === CALL ===
            case 0xCD:
                {
                    const addr = this.fetch16();
                    this.push(this.pc);
                    this.pc = addr;
                    cycles = 17;
                }
                break;
                
            // === ACI ===
            case 0xCE:
                this.add(this.fetch() + this.getFlag(0));
                cycles = 7;
                break;
                
            // === RST 1 ===
            case 0xCF: this.push(this.pc); this.pc = 0x08; cycles = 11; break;
            
            // === RNC ===
            case 0xD0:
                if (!this.getFlag(0)) {
                    this.pc = this.pop();
                    cycles = 11;
                } else cycles = 5;
                break;
                
            // === POP D ===
            case 0xD1: this.setDE(this.pop()); cycles = 10; break;
            
            // === JNC ===
            case 0xD2:
                {
                    const addr = this.fetch16();
                    if (!this.getFlag(0)) this.pc = addr;
                    cycles = 10;
                }
                break;
                
            // === OUT ===
            case 0xD3:
                this.out(this.fetch(), this.a);
                cycles = 10;
                break;
                
            // === CNC ===
            case 0xD4:
                {
                    const addr = this.fetch16();
                    if (!this.getFlag(0)) {
                        this.push(this.pc);
                        this.pc = addr;
                        cycles = 17;
                    } else cycles = 11;
                }
                break;
                
            // === PUSH D ===
            case 0xD5: this.push(this.getDE()); cycles = 11; break;
            
            // === SUI ===
            case 0xD6: this.sub(this.fetch()); cycles = 7; break;
            
            // === RST 2 ===
            case 0xD7: this.push(this.pc); this.pc = 0x10; cycles = 11; break;
            
            // === RC ===
            case 0xD8:
                if (this.getFlag(0)) {
                    this.pc = this.pop();
                    cycles = 11;
                } else cycles = 5;
                break;
                
            // === JC ===
            case 0xDA:
                {
                    const addr = this.fetch16();
                    if (this.getFlag(0)) this.pc = addr;
                    cycles = 10;
                }
                break;
                
            // === IN ===
            case 0xDB:
                this.a = this.in(this.fetch());
                cycles = 10;
                break;
                
            // === CC ===
            case 0xDC:
                {
                    const addr = this.fetch16();
                    if (this.getFlag(0)) {
                        this.push(this.pc);
                        this.pc = addr;
                        cycles = 17;
                    } else cycles = 11;
                }
                break;
                
            // === SBI ===
            case 0xDE: this.sub(this.fetch() + this.getFlag(0)); cycles = 7; break;
            
            // === RST 3 ===
            case 0xDF: this.push(this.pc); this.pc = 0x18; cycles = 11; break;
            
            // === RPO ===
            case 0xE0:
                if (!this.getFlag(2)) {
                    this.pc = this.pop();
                    cycles = 11;
                } else cycles = 5;
                break;
                
            // === POP H ===
            case 0xE1: this.setHL(this.pop()); cycles = 10; break;
            
            // === JPO ===
            case 0xE2:
                {
                    const addr = this.fetch16();
                    if (!this.getFlag(2)) this.pc = addr;
                    cycles = 10;
                }
                break;
                
            // === XTHL ===
            case 0xE3:
                {
                    const low = this.read(this.sp);
                    const high = this.read(this.sp + 1);
                    this.write(this.sp, this.l);
                    this.write(this.sp + 1, this.h);
                    this.l = low;
                    this.h = high;
                    cycles = 18;
                }
                break;
                
            // === CPO ===
            case 0xE4:
                {
                    const addr = this.fetch16();
                    if (!this.getFlag(2)) {
                        this.push(this.pc);
                        this.pc = addr;
                        cycles = 17;
                    } else cycles = 11;
                }
                break;
                
            // === PUSH H ===
            case 0xE5: this.push(this.getHL()); cycles = 11; break;
            
            // === ANI ===
            case 0xE6: this.ana(this.fetch()); cycles = 7; break;
            
            // === RST 4 ===
            case 0xE7: this.push(this.pc); this.pc = 0x20; cycles = 11; break;
            
            // === RPE ===
            case 0xE8:
                if (this.getFlag(2)) {
                    this.pc = this.pop();
                    cycles = 11;
                } else cycles = 5;
                break;
                
            // === PCHL ===
            case 0xE9: this.pc = this.getHL(); cycles = 5; break;
            
            // === JPE ===
            case 0xEA:
                {
                    const addr = this.fetch16();
                    if (this.getFlag(2)) this.pc = addr;
                    cycles = 10;
                }
                break;
                
            // === XCHG ===
            case 0xEB:
                {
                    const tmp = this.getDE();
                    this.setDE(this.getHL());
                    this.setHL(tmp);
                    cycles = 4;
                }
                break;
                
            // === CPE ===
            case 0xEC:
                {
                    const addr = this.fetch16();
                    if (this.getFlag(2)) {
                        this.push(this.pc);
                        this.pc = addr;
                        cycles = 17;
                    } else cycles = 11;
                }
                break;
                
            // === XRI ===
            case 0xEE: this.xra(this.fetch()); cycles = 7; break;
            
            // === RST 5 ===
            case 0xEF: this.push(this.pc); this.pc = 0x28; cycles = 11; break;
            
            // === RP ===
            case 0xF0:
                if (!this.getFlag(7)) {
                    this.pc = this.pop();
                    cycles = 11;
                } else cycles = 5;
                break;
                
            // === POP PSW ===
            case 0xF1:
                {
                    const val = this.pop();
                    this.a = (val >> 8) & 0xFF;
                    this.f = val & 0xFF;
                    cycles = 10;
                }
                break;
                
            // === JP ===
            case 0xF2:
                {
                    const addr = this.fetch16();
                    if (!this.getFlag(7)) this.pc = addr;
                    cycles = 10;
                }
                break;
                
            // === DI ===
            case 0xF3: this.iff = false; cycles = 4; break;
            
            // === CP ===
            case 0xF4:
                {
                    const addr = this.fetch16();
                    if (!this.getFlag(7)) {
                        this.push(this.pc);
                        this.pc = addr;
                        cycles = 17;
                    } else cycles = 11;
                }
                break;
                
            // === PUSH PSW ===
            case 0xF5: this.push((this.a << 8) | this.f); cycles = 11; break;
            
            // === ORI ===
            case 0xF6: this.ora(this.fetch()); cycles = 7; break;
            
            // === RST 6 ===
            case 0xF7: this.push(this.pc); this.pc = 0x30; cycles = 11; break;
            
            // === RM ===
            case 0xF8:
                if (this.getFlag(7)) {
                    this.pc = this.pop();
                    cycles = 11;
                } else cycles = 5;
                break;
                
            // === SPHL ===
            case 0xF9: this.sp = this.getHL(); cycles = 5; break;
            
            // === JM ===
            case 0xFA:
                {
                    const addr = this.fetch16();
                    if (this.getFlag(7)) this.pc = addr;
                    cycles = 10;
                }
                break;
                
            // === EI ===
            case 0xFB: this.iff = true; cycles = 4; break;
            
            // === CM ===
            case 0xFC:
                {
                    const addr = this.fetch16();
                    if (this.getFlag(7)) {
                        this.push(this.pc);
                        this.pc = addr;
                        cycles = 17;
                    } else cycles = 11;
                }
                break;
                
            // === CPI ===
            case 0xFE: this.cmp(this.fetch()); cycles = 7; break;
            
            // === RST 7 ===
            case 0xFF: this.push(this.pc); this.pc = 0x38; cycles = 11; break;
            
            default:
                console.log(`Unimplemented opcode: ${opcode.toString(16)} at PC=${(this.pc-1).toString(16)}`);
        }
        
        this.cycles += cycles;
        return cycles;
    }
}