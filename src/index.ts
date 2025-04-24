// Main entry point for the Mandelbrot set visualization

// Configuration options
interface MandelbrotConfig {
    maxIterations: number;
    colorScheme: string;
}

// Enum for interaction modes
enum InteractionMode {
    Pan = 'pan',
    Select = 'select'
}

// Class to handle the Mandelbrot set calculation and visualization
class MandelbrotSet {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private config: MandelbrotConfig;
    private viewportX: number = -0.5;
    private viewportY: number = 0;
    private zoom: number = 1;
    private isDragging: boolean = false;
    private lastX: number = 0;
    private lastY: number = 0;
    private interactionMode: InteractionMode = InteractionMode.Pan;
    private selectionStart: { x: number, y: number } | null = null;
    private selectionRect: HTMLDivElement | null = null;
    
    constructor(canvasId: string, config: MandelbrotConfig) {
        this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        const ctx = this.canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Could not get canvas context');
        }
        this.ctx = ctx;
        this.config = config;
        
        // Set canvas dimensions to match display size
        this.resize();
        
        // Add event listeners for interactivity
        this.setupEventListeners();
        
        // Initial render
        this.render();
    }
    
    private resize(): void {
        const canvasContainer = this.canvas.parentElement;
        if (!canvasContainer) return;
        
        const displayWidth = canvasContainer.clientWidth;
        const displayHeight = canvasContainer.clientHeight;
        
        // Set canvas dimensions to match container size for better rendering
        this.canvas.width = displayWidth;
        this.canvas.height = displayHeight;
        
        // Re-render with new dimensions
        this.render();
    }
    
    private createSelectionRectangle(): HTMLDivElement {
        const canvasContainer = this.canvas.parentElement;
        if (!canvasContainer) {
            throw new Error('Canvas container not found');
        }
        
        // Remove any existing selection rectangle
        this.removeSelectionRectangle();
        
        // Create a new selection rectangle
        const rect = document.createElement('div');
        rect.className = 'selection-rectangle';
        canvasContainer.appendChild(rect);
        
        return rect;
    }
    
    private removeSelectionRectangle(): void {
        if (this.selectionRect) {
            this.selectionRect.remove();
            this.selectionRect = null;
        }
    }
    
    private updateSelectionRectangle(startX: number, startY: number, endX: number, endY: number): void {
        if (!this.selectionRect) {
            this.selectionRect = this.createSelectionRectangle();
        }
        
        // Calculate the rectangle dimensions
        const left = Math.min(startX, endX);
        const top = Math.min(startY, endY);
        const width = Math.abs(endX - startX);
        const height = Math.abs(endY - startY);
        
        // Update the rectangle position and size
        this.selectionRect.style.left = `${left}px`;
        this.selectionRect.style.top = `${top}px`;
        this.selectionRect.style.width = `${width}px`;
        this.selectionRect.style.height = `${height}px`;
    }
    
    private zoomToSelection(startX: number, startY: number, endX: number, endY: number): void {
        // Calculate the center of the selection in screen coordinates
        const centerX = (startX + endX) / 2;
        const centerY = (startY + endY) / 2;
        
        // Convert to fractal coordinates
        const aspectRatio = this.canvas.width / this.canvas.height;
        const rangeY = 2.0 / this.zoom;
        const rangeX = rangeY * aspectRatio;
        const minX = this.viewportX - rangeX / 2;
        const minY = this.viewportY - rangeY / 2;
        const stepX = rangeX / this.canvas.width;
        const stepY = rangeY / this.canvas.height;
        
        const fractalCenterX = minX + centerX * stepX;
        const fractalCenterY = minY + centerY * stepY;
        
        // Calculate the zoom factor based on the selection size
        const selectionWidth = Math.abs(endX - startX);
        const selectionHeight = Math.abs(endY - startY);
        const zoomFactorX = this.canvas.width / selectionWidth;
        const zoomFactorY = this.canvas.height / selectionHeight;
        const zoomFactor = Math.min(zoomFactorX, zoomFactorY);
        
        // Update viewport and zoom
        this.viewportX = fractalCenterX;
        this.viewportY = fractalCenterY;
        this.zoom *= zoomFactor;
        
        // Re-render with new viewport and zoom
        this.render();
    }
    
    private setupEventListeners(): void {
        // Set up ResizeObserver to detect changes to the canvas container
        const canvasContainer = this.canvas.parentElement;
        if (canvasContainer) {
            const resizeObserver = new ResizeObserver(() => {
                this.resize();
            });
            resizeObserver.observe(canvasContainer);
        }
        
        // Mode selection change event
        const panModeRadio = document.getElementById('mode-pan') as HTMLInputElement;
        const selectModeRadio = document.getElementById('mode-select') as HTMLInputElement;
        
        panModeRadio.addEventListener('change', () => {
            if (panModeRadio.checked) {
                this.interactionMode = InteractionMode.Pan;
                this.removeSelectionRectangle();
            }
        });
        
        selectModeRadio.addEventListener('change', () => {
            if (selectModeRadio.checked) {
                this.interactionMode = InteractionMode.Select;
                this.removeSelectionRectangle();
            }
        });
        
        // Mouse events for panning and selection
        this.canvas.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            this.lastX = e.offsetX;
            this.lastY = e.offsetY;
            
            if (this.interactionMode === InteractionMode.Select) {
                this.selectionStart = { x: e.offsetX, y: e.offsetY };
                this.updateSelectionRectangle(e.offsetX, e.offsetY, e.offsetX, e.offsetY);
            }
        });
        
        this.canvas.addEventListener('mousemove', (e) => {
            if (this.isDragging) {
                if (this.interactionMode === InteractionMode.Pan) {
                    const deltaX = e.offsetX - this.lastX;
                    const deltaY = e.offsetY - this.lastY;
                    
                    // Convert screen coordinates to fractal coordinates
                    const fractalDeltaX = deltaX * (3.0 / this.canvas.width) / this.zoom;
                    const fractalDeltaY = deltaY * (3.0 / this.canvas.height) / this.zoom;
                    
                    // Update viewport
                    this.viewportX -= fractalDeltaX;
                    this.viewportY -= fractalDeltaY;
                    
                    this.lastX = e.offsetX;
                    this.lastY = e.offsetY;
                    
                    // Re-render with new viewport
                    this.render();
                } else if (this.interactionMode === InteractionMode.Select && this.selectionStart) {
                    // Update selection rectangle
                    this.updateSelectionRectangle(
                        this.selectionStart.x,
                        this.selectionStart.y,
                        e.offsetX,
                        e.offsetY
                    );
                }
            }
        });
        
        this.canvas.addEventListener('mouseup', (e) => {
            if (this.isDragging && this.interactionMode === InteractionMode.Select && this.selectionStart) {
                // If the selection has a reasonable size, zoom to it
                const width = Math.abs(e.offsetX - this.selectionStart.x);
                const height = Math.abs(e.offsetY - this.selectionStart.y);
                
                if (width > 10 && height > 10) {
                    this.zoomToSelection(
                        this.selectionStart.x,
                        this.selectionStart.y,
                        e.offsetX,
                        e.offsetY
                    );
                }
                
                this.selectionStart = null;
                this.removeSelectionRectangle();
            }
            
            this.isDragging = false;
        });
        
        window.addEventListener('mouseup', () => {
            this.isDragging = false;
            if (this.interactionMode === InteractionMode.Select) {
                this.selectionStart = null;
                this.removeSelectionRectangle();
            }
        });
        
        // Mouse wheel for zooming
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            
            // Get position of mouse cursor in canvas
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            // Convert to normalized device coordinates (-1 to 1)
            const ndcX = (x / this.canvas.width) * 2 - 1;
            const ndcY = (y / this.canvas.height) * -2 + 1;
            
            // Convert to fractal coordinates
            const fractalX = this.viewportX + ndcX * (2 / this.zoom);
            const fractalY = this.viewportY + ndcY * (2 / this.zoom);
            
            // Determine zoom direction and factor
            const zoomFactor = e.deltaY > 0 ? 0.8 : 1.2;
            this.zoom *= zoomFactor;
            
            // Adjust viewport to zoom toward mouse position
            this.viewportX = fractalX - ndcX * (2 / this.zoom);
            this.viewportY = fractalY - ndcY * (2 / this.zoom);
            
            // Re-render with new zoom
            this.render();
        });
    }
    
    private calculateMandelbrot(x0: number, y0: number): number {
        let x = 0;
        let y = 0;
        let iteration = 0;
        const maxIter = this.config.maxIterations;
        
        while (x*x + y*y <= 4 && iteration < maxIter) {
            const xTemp = x*x - y*y + x0;
            y = 2*x*y + y0;
            x = xTemp;
            iteration++;
        }
        
        return iteration;
    }
    
    private getColor(iteration: number): string {
        // Return color based on the number of iterations and selected color scheme
        if (iteration === this.config.maxIterations) {
            return '#000000'; // Black for the Mandelbrot set
        }
        
        const normalized = iteration / this.config.maxIterations;
        
        if (this.config.colorScheme === 'grayscale') {
            const value = Math.floor(normalized * 255);
            return `rgb(${value}, ${value}, ${value})`;
        } else if (this.config.colorScheme === 'fire') {
            const red = Math.min(255, Math.floor(normalized * 510));
            const green = Math.min(255, Math.floor(normalized * 140));
            const blue = Math.floor(normalized * 40);
            return `rgb(${red}, ${green}, ${blue})`;
        } else {
            // Rainbow (default)
            const hue = 360 * normalized;
            return `hsl(${hue}, 100%, 50%)`;
        }
    }
    
    public render(): void {
        const { width, height } = this.canvas;
        const imageData = this.ctx.createImageData(width, height);
        const data = imageData.data;
        
        // Define the range of the complex plane to render
        const aspectRatio = width / height;
        const rangeY = 2.0 / this.zoom;
        const rangeX = rangeY * aspectRatio;
        
        // Calculate the top-left and bottom-right corners of the viewport
        const minX = this.viewportX - rangeX / 2;
        const maxX = this.viewportX + rangeX / 2;
        const minY = this.viewportY - rangeY / 2;
        const maxY = this.viewportY + rangeY / 2;
        
        // Calculate step sizes for moving through the complex plane
        const stepX = (maxX - minX) / width;
        const stepY = (maxY - minY) / height;
        
        // Render the Mandelbrot set
        for (let y = 0; y < height; y++) {
            const cy = minY + y * stepY;
            
            for (let x = 0; x < width; x++) {
                const cx = minX + x * stepX;
                
                // Calculate number of iterations for this point
                const iteration = this.calculateMandelbrot(cx, cy);
                
                // Get color for the pixel
                const colorStr = this.getColor(iteration);
                const matches = colorStr.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
                
                let r = 0, g = 0, b = 0;
                
                if (matches) {
                    [, r, g, b] = matches.map(Number);
                } else if (colorStr.startsWith('hsl')) {
                    // Convert HSL to RGB
                    const hsl = colorStr.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
                    if (hsl) {
                        const h = Number(hsl[1]) / 360;
                        const s = Number(hsl[2]) / 100;
                        const l = Number(hsl[3]) / 100;
                        
                        const hueToRgb = (p: number, q: number, t: number) => {
                            if (t < 0) t += 1;
                            if (t > 1) t -= 1;
                            if (t < 1/6) return p + (q - p) * 6 * t;
                            if (t < 1/2) return q;
                            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                            return p;
                        };
                        
                        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
                        const p = 2 * l - q;
                        
                        r = Math.round(hueToRgb(p, q, h + 1/3) * 255);
                        g = Math.round(hueToRgb(p, q, h) * 255);
                        b = Math.round(hueToRgb(p, q, h - 1/3) * 255);
                    }
                } else if (colorStr === '#000000') {
                    r = g = b = 0;
                }
                
                // Set pixel color in the image data
                const pixelIndex = (y * width + x) * 4;
                data[pixelIndex] = r;     // Red
                data[pixelIndex + 1] = g; // Green
                data[pixelIndex + 2] = b; // Blue
                data[pixelIndex + 3] = 255; // Alpha (fully opaque)
            }
        }
        
        // Draw the image data to the canvas
        this.ctx.putImageData(imageData, 0, 0);
    }
    
    public updateConfig(config: Partial<MandelbrotConfig>): void {
        this.config = { ...this.config, ...config };
        this.render();
    }
    
    public resetView(): void {
        this.viewportX = -0.5;
        this.viewportY = 0;
        this.zoom = 1;
        this.removeSelectionRectangle();
        this.render();
    }
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Get DOM elements
    const canvas = document.getElementById('mandelbrot-canvas') as HTMLCanvasElement;
    const iterationsSlider = document.getElementById('iterations') as HTMLInputElement;
    const iterationsValue = document.getElementById('iterations-value') as HTMLSpanElement;
    const colorSchemeSelect = document.getElementById('color-scheme') as HTMLSelectElement;
    const resetButton = document.getElementById('reset') as HTMLButtonElement;
    const fullscreenButton = document.getElementById('fullscreen') as HTMLButtonElement;
    const canvasContainer = document.querySelector('.canvas-container') as HTMLElement;
    
    // Initial configuration
    const config: MandelbrotConfig = {
        maxIterations: parseInt(iterationsSlider.value, 10),
        colorScheme: colorSchemeSelect.value
    };
    
    // Create Mandelbrot set visualization
    const mandelbrot = new MandelbrotSet('mandelbrot-canvas', config);
    
    // Update iterations value when slider changes
    iterationsSlider.addEventListener('input', () => {
        const value = parseInt(iterationsSlider.value, 10);
        iterationsValue.textContent = value.toString();
        mandelbrot.updateConfig({ maxIterations: value });
    });
    
    // Update color scheme when select changes
    colorSchemeSelect.addEventListener('change', () => {
        mandelbrot.updateConfig({ colorScheme: colorSchemeSelect.value });
    });
    
    // Reset view when reset button is clicked
    resetButton.addEventListener('click', () => {
        mandelbrot.resetView();
    });
    
    // No need for manual window resize handling as ResizeObserver takes care of it
    
    // Toggle fullscreen mode when the fullscreen button is clicked
    fullscreenButton.addEventListener('click', () => {
        document.body.classList.toggle('fullscreen-active');
        canvasContainer.classList.toggle('fullscreen');
        
        // Force re-render after a short delay to account for resize transition
        setTimeout(() => {
            mandelbrot.render();
        }, 100);
    });
    
    // Handle fullscreen exit via Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && canvasContainer.classList.contains('fullscreen')) {
            document.body.classList.remove('fullscreen-active');
            canvasContainer.classList.remove('fullscreen');
            
            // Force re-render after a short delay
            setTimeout(() => {
                mandelbrot.render();
            }, 100);
        }
    });
});
