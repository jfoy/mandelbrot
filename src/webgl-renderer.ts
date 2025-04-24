// Define shader code directly as strings to bypass import issues
const vertexShaderSource = `
// Basic vertex shader that passes through the position
attribute vec2 a_position;

void main() {
    // Convert from 0->1 to -1->1 (clip space)
    vec2 position = a_position * 2.0 - 1.0;
    gl_Position = vec4(position, 0, 1);
}
`;

/**
 * Fragment shader for rendering the Mandelbrot set.
 * 
 * The Mandelbrot set is defined as the set of complex numbers c for which the function
 * f_c(z) = z² + c does not diverge when iterated from z = 0.
 * 
 * Mathematically, a complex number c is in the Mandelbrot set if and only if
 * |f_c^n(0)| ≤ 2 for all n > 0, where f_c^n represents the nth iteration of f_c.
 * 
 * In this implementation:
 * 1. We map each pixel to a point c in the complex plane
 * 2. We iterate z₀ = 0, z_{n+1} = z_n² + c until either:
 *    a. |z_n| > 2 (the point diverges and is not in the set), or
 *    b. We reach the maximum iteration count (the point is likely in the set)
 * 3. We color based on how quickly the sequence diverged (if it did)
 */
const fragmentShaderSource = `
precision highp float;

// Uniforms passed from JavaScript
uniform vec2 u_viewport_center; // Center point (c_x, c_y) in the complex plane
uniform float u_zoom;           // Zoom level (higher values = more zoomed in)
uniform vec2 u_resolution;      // Canvas resolution (width, height) in pixels
uniform int u_max_iterations;   // Maximum iterations before assuming the point is in the set
uniform int u_color_scheme;     // Color scheme selection (0 = rainbow, 1 = grayscale, 2 = fire)

// HSL to RGB conversion
vec3 hsl2rgb(float h, float s, float l) {
    float c = (1.0 - abs(2.0 * l - 1.0)) * s;
    float x = c * (1.0 - abs(mod(h / 60.0, 2.0) - 1.0));
    float m = l - c / 2.0;
    
    vec3 rgb;
    if (h < 60.0) {
        rgb = vec3(c, x, 0.0);
    } else if (h < 120.0) {
        rgb = vec3(x, c, 0.0);
    } else if (h < 180.0) {
        rgb = vec3(0.0, c, x);
    } else if (h < 240.0) {
        rgb = vec3(0.0, x, c);
    } else if (h < 300.0) {
        rgb = vec3(x, 0.0, c);
    } else {
        rgb = vec3(c, 0.0, x);
    }
    
    return rgb + vec3(m);
}

/**
 * Determine the color of a point based on its escape behavior.
 * 
 * Points in the Mandelbrot set (that never escape) are colored black.
 * Points outside the set are colored based on how quickly they escape,
 * creating bands of color that reveal the complex structure of the boundary.
 * 
 * The normalized iteration count creates a smooth gradient between colors,
 * where points that escape quickly are colored differently than those that
 * take many iterations to escape.
 */
vec4 getColor(float iteration, int maxIterations) {
    // Points that don't escape within max_iterations are considered to be in the set
    if (iteration >= float(maxIterations)) {
        return vec4(0.0, 0.0, 0.0, 1.0); // Black for points in the set
    }
    
    // Normalize the iteration count to a value between 0 and 1
    // This creates a smooth gradient based on how quickly points escape
    float normalized = iteration / float(maxIterations);
    
    if (u_color_scheme == 1) {
        // Grayscale - simpler visualization where brightness corresponds to escape time
        return vec4(vec3(normalized), 1.0);
    } else if (u_color_scheme == 2) {
        // Fire - creates a hot, fiery appearance with emphasis on reds and yellows
        float red = min(1.0, normalized * 2.0);
        float green = min(1.0, normalized * 0.6);
        float blue = normalized * 0.15;
        return vec4(red, green, blue, 1.0);
    } else {
        // Rainbow (default) - maps the full color spectrum to escape time
        // This provides the most detailed view of the set's structure
        float hue = 360.0 * normalized;
        return vec4(hsl2rgb(hue, 1.0, 0.5), 1.0);
    }
}

void main() {
    // Step 1: Map each pixel to a point in the complex plane (a complex number c)
    // The complex plane is centered at u_viewport_center with width and height determined by zoom level
    float aspectRatio = u_resolution.x / u_resolution.y;
    float complexPlaneHeight = 2.0 / u_zoom;          // Height of our viewport in the complex plane
    float complexPlaneWidth = complexPlaneHeight * aspectRatio; // Width adjusted for aspect ratio
    
    // Convert from pixel coordinates to UV coordinates (0 to 1)
    vec2 uv = gl_FragCoord.xy / u_resolution;
    
    // Map UV coordinates to complex plane coordinates centered at the viewport center
    // This creates c = (real, imaginary) components of our complex number
    vec2 c = u_viewport_center + vec2(
        (uv.x - 0.5) * complexPlaneWidth,   // Map x from [0,1] to [-width/2, width/2]
        (uv.y - 0.5) * complexPlaneHeight   // Map y from [0,1] to [-height/2, height/2]
    );
    
    // Step 2: Apply the Mandelbrot iteration: z_{n+1} = z_n² + c starting with z_0 = 0
    vec2 z = vec2(0.0, 0.0);    // z_0 = 0 (starting value for iteration)
    float iterCount = 0.0;      // Count how many iterations before escaping
    int maxIter = u_max_iterations; // Local copy of max iterations
    
    // WebGL 1.0 requires loop conditions to be constant or simple variable comparisons
    // We use a fixed upper bound and break out when needed
    for (int iter = 0; iter < 1000; iter++) {
        // Break if we've reached the maximum iteration count
        if (float(iter) >= float(maxIter)) break;
        
        // Calculate z² = (a+bi)² = (a²-b²) + (2ab)i
        // Where z = a+bi is represented as vec2(a,b)
        vec2 zSquared = vec2(
            z.x * z.x - z.y * z.y,  // Real part: a²-b²
            2.0 * z.x * z.y         // Imaginary part: 2ab
        );
        
        // z_{n+1} = z_n² + c
        z = zSquared + c;
        
        // Check if |z| > 2
        // We use |z|² > 4 instead of |z| > 2 to avoid a square root calculation
        // |z|² = a² + b² = dot(z,z)
        if (dot(z, z) > 4.0) {  // This is the escape condition
            iterCount = float(iter);
            break;  // The sequence is diverging, so c is not in the Mandelbrot set
        }
        iterCount = float(iter);
    }
    
    // Step 3: Apply smooth coloring for better visual quality
    // Instead of using discrete iteration bands, we apply a logarithmic smoothing
    if (iterCount < float(maxIter)) {
        // For smooth coloring, we use: iterCount + 1 - log(log|z_n|)/log(2)
        // This creates a continuous coloring that removes the discrete "bands"
        float logZn = log(dot(z, z)) / 2.0;       // log|z_n|
        float smoothingTerm = log(logZn / log(2.0)) / log(2.0);
        
        // Apply smoothing to the iteration count
        iterCount = iterCount + 1.0 - smoothingTerm;
    }
    
    // Step 4: Color the pixel based on the (smooth) iteration count
    gl_FragColor = getColor(iterCount, maxIter);
}
`;

// Color scheme enum
export enum ColorScheme {
    Rainbow = 0,
    Grayscale = 1,
    Fire = 2
}

// Configuration for the WebGL Mandelbrot renderer
export interface WebGLMandelbrotConfig {
    maxIterations: number;
    colorScheme: ColorScheme;
}

export class WebGLMandelbrotRenderer {
    private canvas: HTMLCanvasElement;
    private gl: WebGLRenderingContext;
    private program: WebGLProgram;
    private config: WebGLMandelbrotConfig;
    
    // Shader locations
    private positionAttributeLocation: number;
    private resolutionUniformLocation: WebGLUniformLocation | null;
    private viewportCenterUniformLocation: WebGLUniformLocation | null;
    private zoomUniformLocation: WebGLUniformLocation | null;
    private maxIterationsUniformLocation: WebGLUniformLocation | null;
    private colorSchemeUniformLocation: WebGLUniformLocation | null;
    
    // Buffer for the rectangle
    private positionBuffer: WebGLBuffer | null;

    // Viewport settings
    private viewportX: number = -0.5;
    private viewportY: number = 0;
    private zoom: number = 1;
    
    // Dynamic resolution settings
    private baseResolutionFactor: number = 1.0;
    private maxResolutionFactor: number = 2.0; // Maximum super-sampling factor
    private zoomThreshold: number = 100.0;     // Zoom level where we start increasing resolution
    
    constructor(canvas: HTMLCanvasElement, config: WebGLMandelbrotConfig) {
        console.log('Initializing WebGL renderer with config:', config);
        this.canvas = canvas;
        this.config = config;
        
        // Initialize WebGL context
        console.log('Getting WebGL context...');
        const gl = this.canvas.getContext('webgl');
        if (!gl) {
            console.error('WebGL not supported by browser');
            throw new Error('WebGL not supported');
        }
        console.log('WebGL context obtained successfully');
        this.gl = gl;
        
        // Create shader program
        console.log('Creating shader program...');
        console.log('Vertex shader source length:', vertexShaderSource.length);
        console.log('Fragment shader source length:', fragmentShaderSource.length);
        this.program = this.createShaderProgram(gl, vertexShaderSource, fragmentShaderSource);
        console.log('Shader program created successfully');
        
        // Get attribute and uniform locations
        console.log('Getting attribute and uniform locations...');
        this.positionAttributeLocation = gl.getAttribLocation(this.program, 'a_position');
        console.log('Position attribute location:', this.positionAttributeLocation);
        
        this.resolutionUniformLocation = gl.getUniformLocation(this.program, 'u_resolution');
        this.viewportCenterUniformLocation = gl.getUniformLocation(this.program, 'u_viewport_center');
        this.zoomUniformLocation = gl.getUniformLocation(this.program, 'u_zoom');
        this.maxIterationsUniformLocation = gl.getUniformLocation(this.program, 'u_max_iterations');
        this.colorSchemeUniformLocation = gl.getUniformLocation(this.program, 'u_color_scheme');
        
        console.log('Uniform locations:', {
            resolution: this.resolutionUniformLocation !== null,
            viewportCenter: this.viewportCenterUniformLocation !== null,
            zoom: this.zoomUniformLocation !== null,
            maxIterations: this.maxIterationsUniformLocation !== null,
            colorScheme: this.colorSchemeUniformLocation !== null
        });
        
        // Create and set up buffers
        console.log('Creating rectangle buffer...');
        this.positionBuffer = this.createRectangleBuffer(gl);
        console.log('Rectangle buffer created successfully');
    }
    
    // Create and compile a shader
    private createShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
        console.log('Creating shader of type:', type === gl.VERTEX_SHADER ? 'VERTEX_SHADER' : 'FRAGMENT_SHADER');
        const shader = gl.createShader(type);
        if (!shader) {
            throw new Error('Could not create shader');
        }
        
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        
        const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
        if (!success) {
            const info = gl.getShaderInfoLog(shader);
            console.error('Shader compilation failed:', info);
            console.error('Shader source:', source);
            gl.deleteShader(shader);
            throw new Error('Could not compile shader: ' + info);
        }
        console.log('Shader compiled successfully');
        
        return shader;
    }
    
    // Create a shader program from vertex and fragment shaders
    private createShaderProgram(gl: WebGLRenderingContext, vertexSource: string, fragmentSource: string): WebGLProgram {
        const vertexShader = this.createShader(gl, gl.VERTEX_SHADER, vertexSource);
        const fragmentShader = this.createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
        
        const program = gl.createProgram();
        if (!program) {
            throw new Error('Could not create program');
        }
        
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        
        const success = gl.getProgramParameter(program, gl.LINK_STATUS);
        if (!success) {
            const info = gl.getProgramInfoLog(program);
            console.error('Program linking failed:', info);
            gl.deleteProgram(program);
            throw new Error('Could not link program: ' + info);
        }
        console.log('Program linked successfully');
        
        return program;
    }
    
    // Create a buffer for a rectangle covering the entire canvas
    private createRectangleBuffer(gl: WebGLRenderingContext): WebGLBuffer {
        const buffer = gl.createBuffer();
        if (!buffer) {
            throw new Error('Could not create buffer');
        }
        
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        
        // Two triangles forming a rectangle covering the entire canvas
        const positions = [
            0, 0,
            1, 0,
            0, 1,
            0, 1,
            1, 0,
            1, 1,
        ];
        
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
        
        return buffer;
    }
    
    // Render the Mandelbrot set
    public render(): void {
        console.log('Rendering Mandelbrot set...');
        const gl = this.gl;
        
        // Set the canvas size with dynamic resolution
        console.log('Resizing canvas with dynamic resolution...');
        this.resizeCanvasToDisplaySize();
        console.log('Canvas dimensions:', { width: gl.canvas.width, height: gl.canvas.height });
        
        // Set the viewport to the full canvas size
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        
        // Apply CSS scaling to match display size (this makes high-resolution canvas display at normal size)
        const canvas = gl.canvas as HTMLCanvasElement;
        const resolutionFactor = this.calculateResolutionFactor();
        if (resolutionFactor > 1.0) {
            canvas.style.width = `${canvas.clientWidth}px`;
            canvas.style.height = `${canvas.clientHeight}px`;
        } else {
            canvas.style.width = '';
            canvas.style.height = '';
        }
        
        // Clear the canvas
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        
        try {
            // Tell WebGL to use our program
            gl.useProgram(this.program);
            
            // Set up the position attribute
            gl.enableVertexAttribArray(this.positionAttributeLocation);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
            gl.vertexAttribPointer(
                this.positionAttributeLocation,
                2,          // 2 components per vertex
                gl.FLOAT,   // data type
                false,      // don't normalize
                0,          // stride (0 = auto)
                0,          // offset
            );
            
            // Set uniforms with extra error checking
            if (this.resolutionUniformLocation) {
                gl.uniform2f(this.resolutionUniformLocation, gl.canvas.width, gl.canvas.height);
                console.log('Set resolution uniform:', gl.canvas.width, gl.canvas.height);
            } else {
                console.warn('Resolution uniform location is null');
            }
            
            if (this.viewportCenterUniformLocation) {
                gl.uniform2f(this.viewportCenterUniformLocation, this.viewportX, this.viewportY);
                console.log('Set viewport center uniform:', this.viewportX, this.viewportY);
            } else {
                console.warn('Viewport center uniform location is null');
            }
            
            if (this.zoomUniformLocation) {
                gl.uniform1f(this.zoomUniformLocation, this.zoom);
                console.log('Set zoom uniform:', this.zoom);
            } else {
                console.warn('Zoom uniform location is null');
            }
            
            if (this.maxIterationsUniformLocation) {
                gl.uniform1i(this.maxIterationsUniformLocation, this.config.maxIterations);
                console.log('Set max iterations uniform:', this.config.maxIterations);
            } else {
                console.warn('Max iterations uniform location is null');
            }
            
            if (this.colorSchemeUniformLocation) {
                gl.uniform1i(this.colorSchemeUniformLocation, this.config.colorScheme);
                console.log('Set color scheme uniform:', this.config.colorScheme);
            } else {
                console.warn('Color scheme uniform location is null');
            }
            
            // Draw
            console.log('Drawing with uniforms:', {
                resolution: [gl.canvas.width, gl.canvas.height],
                viewportCenter: [this.viewportX, this.viewportY],
                zoom: this.zoom,
                maxIterations: this.config.maxIterations,
                colorScheme: this.config.colorScheme
            });
            
            gl.drawArrays(gl.TRIANGLES, 0, 6);
            console.log('Draw completed');
        } catch (error) {
            console.error('Error during WebGL rendering:', error);
        }
    }
    
    // Calculate the dynamic resolution factor based on zoom level
    private calculateResolutionFactor(): number {
        if (this.zoom <= this.zoomThreshold) {
            return this.baseResolutionFactor;
        }
        
        // Gradually increase resolution factor as zoom increases
        const zoomRatio = Math.min(this.zoom / this.zoomThreshold, this.maxResolutionFactor);
        return Math.min(this.baseResolutionFactor * zoomRatio, this.maxResolutionFactor);
    }
    
    // Make sure the canvas size matches its display size with dynamic resolution scaling
    private resizeCanvasToDisplaySize(): void {
        const canvas = this.gl.canvas as HTMLCanvasElement;
        const displayWidth = canvas.clientWidth;
        const displayHeight = canvas.clientHeight;
        
        // Calculate the resolution factor based on current zoom
        const resolutionFactor = this.calculateResolutionFactor();
        console.log(`Zoom: ${this.zoom.toExponential(2)}, Resolution factor: ${resolutionFactor.toFixed(2)}`);
        
        // Calculate target dimensions with dynamic resolution
        const targetWidth = Math.floor(displayWidth * resolutionFactor);
        const targetHeight = Math.floor(displayHeight * resolutionFactor);
        
        if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            console.log(`Canvas resized to: ${targetWidth}x${targetHeight} (display: ${displayWidth}x${displayHeight})`);
        }
    }
    
    // Update the configuration
    public updateConfig(config: Partial<WebGLMandelbrotConfig>): void {
        this.config = { ...this.config, ...config };
        this.render();
    }
    
    // Update the viewport position
    public updateViewport(x: number, y: number): void {
        this.viewportX = x;
        this.viewportY = y;
        this.render();
    }
    
    // Update the zoom level
    public updateZoom(zoom: number): void {
        this.zoom = zoom;
        this.render();
    }
    
    // Pan the viewport
    public pan(deltaX: number, deltaY: number): void {
        // Convert screen coordinates to fractal coordinates based on zoom
        const canvas = this.gl.canvas as HTMLCanvasElement;
        const aspectRatio = canvas.width / canvas.height;
        const fractalWidth = 3.0 / this.zoom * aspectRatio;
        const fractalHeight = 3.0 / this.zoom;
        
        const fractalDeltaX = deltaX * fractalWidth / canvas.width;
        const fractalDeltaY = deltaY * fractalHeight / canvas.height;
        
        // Note: Invert deltaY for intuitive movement (screen Y axis is inverted relative to math Y axis)
        this.viewportX -= fractalDeltaX;
        this.viewportY += fractalDeltaY;  // Changed from -= to += to invert the direction
        
        this.render();
    }
    
    // Reset the view to the default position
    public resetView(): void {
        this.viewportX = -0.5;
        this.viewportY = 0;
        this.zoom = 1;
        this.render();
    }
    
    // Get the current viewport values
    public getViewport(): { x: number, y: number, zoom: number } {
        return {
            x: this.viewportX,
            y: this.viewportY,
            zoom: this.zoom
        };
    }
}
