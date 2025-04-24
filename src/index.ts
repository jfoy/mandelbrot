// Main entry point for the Mandelbrot set visualization
import { WebGLMandelbrotRenderer, WebGLMandelbrotConfig, ColorScheme } from './webgl-renderer';

// Enum for interaction modes
enum InteractionMode {
    Pan = 'pan',
    Select = 'select'
}

// Class to handle the Mandelbrot set visualization and interaction
class MandelbrotSet {
    private canvas: HTMLCanvasElement;
    public renderer: WebGLMandelbrotRenderer;
    private isDragging: boolean = false;
    private lastX: number = 0;
    private lastY: number = 0;
    private interactionMode: InteractionMode = InteractionMode.Pan;
    private selectionStart: { x: number, y: number } | null = null;
    private selectionRect: HTMLDivElement | null = null;
    
    constructor(canvasId: string, config: { maxIterations: number, colorScheme: string }) {
        this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        
        // Convert string colorScheme to enum ColorScheme
        const colorSchemeEnum = this.getColorSchemeEnum(config.colorScheme);
        
        // Create WebGL renderer
        const webglConfig: WebGLMandelbrotConfig = {
            maxIterations: config.maxIterations,
            colorScheme: colorSchemeEnum
        };
        
        this.renderer = new WebGLMandelbrotRenderer(this.canvas, webglConfig);
        
        // Add event listeners for interactivity
        this.setupEventListeners();
        
        // Initial render
        this.renderer.render();
    }
    
    private getColorSchemeEnum(schemeName: string): ColorScheme {
        switch (schemeName) {
            case 'grayscale': return ColorScheme.Grayscale;
            case 'fire': return ColorScheme.Fire;
            default: return ColorScheme.Rainbow;
        }
    }
    
    // Not needed anymore as the WebGL renderer handles resizing internally
    
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
        
        // Get current viewport values
        const currentViewport = this.renderer.getViewport();
        
        // Convert to fractal coordinates (similar calculation as in the renderer)
        const aspectRatio = this.canvas.width / this.canvas.height;
        const rangeY = 2.0 / currentViewport.zoom;
        const rangeX = rangeY * aspectRatio;
        const minX = currentViewport.x - rangeX / 2;
        const minY = currentViewport.y - rangeY / 2;
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
        
        // Update viewport and zoom in the renderer
        this.renderer.updateViewport(fractalCenterX, fractalCenterY);
        this.renderer.updateZoom(currentViewport.zoom * zoomFactor);
    }
    
    private setupEventListeners(): void {
        // Set up ResizeObserver to detect changes to the canvas container
        const canvasContainer = this.canvas.parentElement;
        if (canvasContainer) {
            const resizeObserver = new ResizeObserver(() => {
                // Trigger re-render when container size changes
                this.renderer.render();
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
                    
                    // Use the WebGL renderer to pan
                    this.renderer.pan(deltaX, deltaY);
                    
                    this.lastX = e.offsetX;
                    this.lastY = e.offsetY;
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
            // Calculate relative position within the canvas element
            // This accounts for any resolution scaling in the WebGL renderer
            const relativeX = (e.clientX - rect.left) / rect.width;
            const relativeY = (e.clientY - rect.top) / rect.height;
            
            // Get current viewport values
            const viewport = this.renderer.getViewport();
            
            // Calculate the aspect ratio
            const aspectRatio = this.canvas.clientWidth / this.canvas.clientHeight;
            const rangeY = 2.0 / viewport.zoom;
            const rangeX = rangeY * aspectRatio;
            
            // Convert to fractal coordinates directly using relative position
            const fractalX = viewport.x + (relativeX - 0.5) * rangeX;
            const fractalY = viewport.y + (0.5 - relativeY) * rangeY;
            
            // Determine zoom direction and factor
            const zoomFactor = e.deltaY > 0 ? 0.8 : 1.2;
            const newZoom = viewport.zoom * zoomFactor;
            
            // Calculate new ranges after zoom
            const newRangeY = 2.0 / newZoom;
            const newRangeX = newRangeY * aspectRatio;
            
            // Calculate new viewport center to keep the mouse position fixed
            const newViewportX = fractalX - (relativeX - 0.5) * newRangeX;
            const newViewportY = fractalY - (0.5 - relativeY) * newRangeY;
            
            // Update in renderer
            this.renderer.updateViewport(newViewportX, newViewportY);
            this.renderer.updateZoom(newZoom);
            
            console.log(`Zoom to mouse at (${relativeX.toFixed(2)}, ${relativeY.toFixed(2)}) - ` +
                      `New center: (${newViewportX.toExponential(4)}, ${newViewportY.toExponential(4)})`);
        });
    }
    
    // These methods are no longer needed as the WebGL renderer handles all the rendering
    // They are removed to optimize the code
    
    public updateConfig(config: Partial<{ maxIterations: number, colorScheme: string }>): void {
        // Convert string colorScheme to enum ColorScheme if provided
        const updatedConfig: Partial<WebGLMandelbrotConfig> = {};
        
        if (config.maxIterations !== undefined) {
            updatedConfig.maxIterations = config.maxIterations;
        }
        
        if (config.colorScheme !== undefined) {
            updatedConfig.colorScheme = this.getColorSchemeEnum(config.colorScheme);
        }
        
        this.renderer.updateConfig(updatedConfig);
    }
    
    public resetView(): void {
        this.removeSelectionRectangle();
        this.renderer.resetView();
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
    const config = {
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
    
    // Coordinate tooltip functionality
    const tooltip = document.getElementById('coordinates-tooltip') as HTMLDivElement;
    
    // Convert screen coordinates to complex plane coordinates
    function screenToComplex(x: number, y: number): {real: number, imag: number} {
        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;
        
        // Get current viewport from renderer
        const viewport = mandelbrot.renderer.getViewport();
        const aspectRatio = canvasWidth / canvasHeight;
        
        // Calculate the bounds of the current view based on the viewport center and zoom
        const rangeY = 2.0 / viewport.zoom; // Height in the complex plane
        const rangeX = rangeY * aspectRatio; // Width in the complex plane
        
        // Calculate the min/max coordinates in the complex plane
        const minReal = viewport.x - (rangeX / 2);
        const maxReal = viewport.x + (rangeX / 2);
        const minImag = viewport.y - (rangeY / 2);
        const maxImag = viewport.y + (rangeY / 2);
        
        // Convert from screen coordinates to normalized coordinates (0 to 1)
        const normalizedX = x / canvasWidth;
        const normalizedY = y / canvasHeight;
        
        // Convert normalized coordinates to complex plane coordinates
        const real = minReal + normalizedX * (maxReal - minReal);
        const imag = minImag + normalizedY * (maxImag - minImag);
        
        return { real, imag };
    }
    
    // Format number for display with appropriate precision based on zoom level
    function formatCoordinate(value: number): string {
        // Get current viewport from renderer
        const viewport = mandelbrot.renderer.getViewport();
        
        // Calculate required decimal places based on zoom level
        // More decimal places as we zoom in
        const decimals = Math.max(4, Math.min(15, Math.floor(Math.log10(viewport.zoom)) + 2));
        return value.toFixed(decimals);
    }
    
    // Handle mouse movement to update tooltip
    canvas.addEventListener('mousemove', (event) => {
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        // Convert screen position to complex coordinates
        const complexCoords = screenToComplex(x, y);
        
        // Update tooltip content
        tooltip.textContent = `c = ${formatCoordinate(complexCoords.real)} + ${formatCoordinate(complexCoords.imag)}i`;
        
        // Position the tooltip near the cursor
        tooltip.style.left = `${event.clientX + 10}px`;
        tooltip.style.top = `${event.clientY + 10}px`;
        tooltip.style.display = 'block';
    });
    
    // Hide tooltip when mouse leaves canvas
    canvas.addEventListener('mouseleave', () => {
        tooltip.style.display = 'none';
    });
    
    // Handle mathematical explanation visibility
    const toggleMathButton = document.getElementById('toggle-math') as HTMLButtonElement;
    const showMathButton = document.getElementById('show-math') as HTMLButtonElement;
    
    // Function to show the mathematical explanation
    const showMathExplanation = () => {
        document.body.classList.remove('math-hidden');
        if (toggleMathButton) {
            toggleMathButton.textContent = 'Hide Mathematical Explanation';
        }
    };
    
    // Function to hide the mathematical explanation
    const hideMathExplanation = () => {
        document.body.classList.add('math-hidden');
        if (toggleMathButton) {
            toggleMathButton.textContent = 'Show Mathematical Explanation';
        }
    };
    
    // Toggle button inside the math explanation section
    if (toggleMathButton) {
        toggleMathButton.addEventListener('click', () => {
            const isHidden = document.body.classList.contains('math-hidden');
            
            if (isHidden) {
                showMathExplanation();
            } else {
                hideMathExplanation();
            }
        });
    }
    
    // Persistent show button in the instructions area
    if (showMathButton) {
        showMathButton.addEventListener('click', showMathExplanation);
    }
    
    // Initially hide the math explanation to keep the interface clean
    hideMathExplanation();
    
    // Toggle fullscreen mode when the fullscreen button is clicked
    fullscreenButton.addEventListener('click', () => {
        document.body.classList.toggle('fullscreen-active');
        canvasContainer.classList.toggle('fullscreen');
        
        // Force re-render after a short delay to account for resize transition
        setTimeout(() => {
            mandelbrot.renderer.render();
        }, 100);
    });
    
    // Handle fullscreen exit via Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && canvasContainer.classList.contains('fullscreen')) {
            document.body.classList.remove('fullscreen-active');
            canvasContainer.classList.remove('fullscreen');
            
            // Force re-render after a short delay
            setTimeout(() => {
                mandelbrot.renderer.render();
            }, 100);
        }
    });
});
