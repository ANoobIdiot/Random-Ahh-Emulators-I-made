import { i8080 } from './i8080.js';
import { SpaceInvadersHardware } from './hardware/invaders.js';
import { GunFightHardware } from './hardware/gunfight.js';
import { SeaWolfHardware } from './hardware/seawolf.js';
import { BlockadeHardware } from './hardware/blockade.js';
import { SpaceFuryHardware } from './hardware/spacefury.js';
import { AlienInvasionHardware } from './hardware/alieninvasion.js';
import { LupinIIIHardware } from './hardware/lupin3.js';
import { StratovoxHardware } from './hardware/stratovox.js';
import { GalaxianHardware } from './hardware/galaxian.js';

export class MultiGameEmulator {
    constructor() {
        this.cpu = new i8080();
        this.currentGame = null;
        this.running = false;
        this.animationFrame = null;
        
        // Available games
        this.games = {
            invaders: { 
                name: "Space Invaders (1978)",
                hardware: SpaceInvadersHardware,
                roms: ["invaders.e", "invaders.f", "invaders.g", "invaders.h"],
                canvasSize: { width: 224, height: 256 }
            },
            gunfight: {
                name: "Gun Fight (1975)",
                hardware: GunFightHardware,
                roms: ["gunfight.1", "gunfight.2"],
                canvasSize: { width: 256, height: 224 }
            },
            seawolf: {
                name: "Sea Wolf (1976)",
                hardware: SeaWolfHardware,
                roms: ["seawolf.bin"],
                canvasSize: { width: 256, height: 224 }
            },
            blockade: {
                name: "Blockade (1976)",
                hardware: BlockadeHardware,
                roms: ["blockade.bin"],
                canvasSize: { width: 256, height: 224 }
            },
            spacefury: {
                name: "Space Fury (1978)",
                hardware: SpaceFuryHardware,
                roms: ["fury.bin"],
                canvasSize: { width: 256, height: 224 }
            },
            alieninvasion: {
                name: "Alien Invasion (1978)",
                hardware: AlienInvasionHardware,
                roms: ["alien.bin"],
                canvasSize: { width: 224, height: 256 }
            },
            lupin3: {
                name: "Lupin III (1980)",
                hardware: LupinIIIHardware,
                roms: ["lupin.bin"],
                canvasSize: { width: 256, height: 224 }
            },
            stratovox: {
                name: "Stratovox (1980)",
                hardware: StratovoxHardware,
                roms: ["strat.bin"],
                canvasSize: { width: 256, height: 224 }
            },
            galaxian: {
                name: "Galaxian (1979)",
                hardware: GalaxianHardware,
                roms: ["gal1.bin", "gal2.bin"],
                canvasSize: { width: 256, height: 224 }
            }
        };
        
        this.initUI();
    }
    
    initUI() {
        this.canvas = document.getElementById('display');
        this.ctx = this.canvas.getContext('2d');
        this.statusDiv = document.getElementById('status');
        
        // Game selector buttons
        const selectorDiv = document.getElementById('game-selector');
        for (const [key, game] of Object.entries(this.games)) {
            const btn = document.createElement('button');
            btn.className = 'game-btn';
            btn.textContent = game.name;
            btn.dataset.game = key;
            btn.onclick = () => this.selectGame(key);
            selectorDiv.appendChild(btn);
        }
        
        // File loader
        document.getElementById('romLoader').addEventListener('change', (e) => {
            this.loadROMs(e.target.files);
        });
        
        document.getElementById('startBtn').addEventListener('click', () => this.start());
        document.getElementById('resetBtn').addEventListener('click', () => this.reset());
        
        // Keyboard controls
        this.setupControls();
    }
    
    selectGame(gameKey) {
        this.currentGameKey = gameKey;
        const game = this.games[gameKey];
        
        // Update canvas size
        this.canvas.width = game.canvasSize.width;
        this.canvas.height = game.canvasSize.height;
        
        // Update controls display
        this.updateControlsDisplay(gameKey);
        
        // Highlight active button
        document.querySelectorAll('.game-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.game === gameKey) {
                btn.classList.add('active');
            }
        });
        
        this.statusDiv.textContent = `Selected: ${game.name}. Load ROM files.`;
    }
    
    updateControlsDisplay(gameKey) {
        const controlsDiv = document.getElementById('controls-display');
        const controls = {
            invaders: `
                <div class="control-item"><span class="key">5</span> Coin</div>
                <div class="control-item"><span class="key">1</span> 1P Start</div>
                <div class="control-item"><span class="key">2</span> 2P Start</div>
                <div class="control-item"><span class="key">A/D</span> Move Left/Right</div>
                <div class="control-item"><span class="key">Space</span> Shoot</div>
            `,
            gunfight: `
                <div class="control-item"><span class="key">5</span> Coin</div>
                <div class="control-item"><span class="key">1</span> 1P Start</div>
                <div class="control-item"><span class="key">2</span> 2P Start</div>
                <div class="control-item"><span class="key">WASD</span> Move P1</div>
                <div class="control-item"><span class="key">Space</span> Fire P1</div>
            `,
            seawolf: `
                <div class="control-item"><span class="key">5</span> Coin</div>
                <div class="control-item"><span class="key">1</span> Start</div>
                <div class="control-item"><span class="key">A/D</span> Periscope</div>
                <div class="control-item"><span class="key">Space</span> Fire Torpedo</div>
            `
        };
        
        controlsDiv.innerHTML = controls[gameKey] || controls.invaders;
    }
    
    async loadROMs(files) {
        if (!this.currentGameKey) {
            this.statusDiv.textContent = 'Select a game first!';
            return;
        }
        
        const game = this.games[this.currentGameKey];
        this.currentGame = new game.hardware(this.cpu);
        
        try {
            await this.currentGame.loadROMs(files);
            this.statusDiv.textContent = `${game.name} ROMs loaded! Click START.`;
        } catch (error) {
            this.statusDiv.textContent = `Error loading ROMs: ${error.message}`;
        }
    }
    
    setupControls() {
        document.addEventListener('keydown', (e) => {
            if (!this.currentGame) return;
            
            switch(e.key) {
                case '5': this.currentGame.inputs.coin1 = 1; break;
                case '1': this.currentGame.inputs.p1_start = 1; break;
                case '2': this.currentGame.inputs.p2_start = 1; break;
                case ' ': 
                case 'Space':
                    this.currentGame.inputs.p1_fire = 1;
                    this.currentGame.inputs.p1_shoot = 1;
                    break;
                case 'a':
                case 'A':
                    this.currentGame.inputs.p1_left = 1;
                    break;
                case 'd':
                case 'D':
                    this.currentGame.inputs.p1_right = 1;
                    break;
                case 'w':
                case 'W':
                    this.currentGame.inputs.p1_up = 1;
                    break;
                case 's':
                case 'S':
                    this.currentGame.inputs.p1_down = 1;
                    break;
            }
            e.preventDefault();
        });
        
        document.addEventListener('keyup', (e) => {
            if (!this.currentGame) return;
            
            switch(e.key) {
                case '5': this.currentGame.inputs.coin1 = 0; break;
                case '1': this.currentGame.inputs.p1_start = 0; break;
                case '2': this.currentGame.inputs.p2_start = 0; break;
                case ' ': 
                case 'Space':
                    this.currentGame.inputs.p1_fire = 0;
                    this.currentGame.inputs.p1_shoot = 0;
                    break;
                case 'a':
                case 'A':
                    this.currentGame.inputs.p1_left = 0;
                    break;
                case 'd':
                case 'D':
                    this.currentGame.inputs.p1_right = 0;
                    break;
                case 'w':
                case 'W':
                    this.currentGame.inputs.p1_up = 0;
                    break;
                case 's':
                case 'S':
                    this.currentGame.inputs.p1_down = 0;
                    break;
            }
            e.preventDefault();
        });
    }
    
    start() {
        if (!this.currentGame) {
            this.statusDiv.textContent = 'Load ROMs first!';
            return;
        }
        
        if (!this.running) {
            this.running = true;
            this.runLoop();
            this.statusDiv.textContent = 'Running...';
        }
    }
    
    reset() {
        this.running = false;
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
        if (this.currentGame) {
            this.currentGame.reset();
        }
        this.ctx.fillStyle = 'black';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.statusDiv.textContent = 'Reset complete';
    }
    
    runLoop() {
        if (!this.running) return;
        
        if (this.currentGame) {
            this.currentGame.runFrame();
            this.renderToCanvas();
        }
        
        this.animationFrame = requestAnimationFrame(() => this.runLoop());
    }
    
    renderToCanvas() {
        if (!this.currentGame) return;
        
        // Create ImageData from game's frame buffer
        const width = this.canvas.width;
        const height = this.canvas.height;
        const imageData = this.ctx.createImageData(width, height);
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                const pixel = this.currentGame.frame_buffer[y * width + x];
                
                if (this.currentGame.config.video.color) {
                    // Color game - pixel value is palette index
                    const color = this.currentGame.palette?.[pixel] || 0xFFFFFF;
                    imageData.data[idx] = (color >> 16) & 0xFF;     // R
                    imageData.data[idx+1] = (color >> 8) & 0xFF;   // G
                    imageData.data[idx+2] = color & 0xFF;          // B
                } else {
                    // Monochrome game
                    imageData.data[idx] = pixel;     // R
                    imageData.data[idx+1] = pixel;   // G
                    imageData.data[idx+2] = pixel;   // B
                }
                imageData.data[idx+3] = 255; // A
            }
        }
        
        this.ctx.putImageData(imageData, 0, 0);
    }
}

// Initialize when page loads
window.addEventListener('load', () => {
    new MultiGameEmulator();
});