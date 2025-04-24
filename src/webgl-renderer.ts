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

const fragmentShaderSource = `
precision highp float;

// Uniforms passed from JavaScript
uniform vec2 u_viewport_center; // Center point of the viewport in Mandelbrot coordinates
uniform float u_zoom;           // Zoom level
uniform vec2 u_resolution;      // Canvas resolution (width, height)
uniform int u_max_iterations;   // Maximum iterations
uniform int u_color_scheme;     // 0 = rainbow, 1 = grayscale, 2 = fire

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

// Get color based on iteration count and color scheme
vec4 getColor(float iteration, int maxIterations) {
    if (iteration >= float(maxIterations)) {
        return vec4(0.0, 0.0, 0.0, 1.0); // Black for points in the set
    }
    
    float normalized = iteration / float(maxIterations);
    
    if (u_color_scheme == 1) {
        // Grayscale
        return vec4(vec3(normalized), 1.0);
    } else if (u_color_scheme == 2) {
        // Fire
        float red = min(1.0, normalized * 2.0);
        float green = min(1.0, normalized * 0.6);
        float blue = normalized * 0.15;
        return vec4(red, green, blue, 1.0);
    } else {
        // Rainbow (default)
        float hue = 360.0 * normalized;
        return vec4(hsl2rgb(hue, 1.0, 0.5), 1.0);
    }
}

void main() {
    // Convert pixel coordinates to mandelbrot coordinates
    float aspectRatio = u_resolution.x / u_resolution.y;
    float rangeY = 2.0 / u_zoom;
    float rangeX = rangeY * aspectRatio;
    
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec2 c = u_viewport_center + vec2(
        (uv.x - 0.5) * rangeX,
        (uv.y - 0.5) * rangeY
    );
    
    // Mandelbrot set calculation
    vec2 z = vec2(0.0, 0.0);
    float i = 0.0;
    int iterations = u_max_iterations; // Make a local copy
    
    // WebGL 1.0 requires loop conditions to be constant or simple variable comparisons
    for (int iter = 0; iter < 1000; iter++) {
        // Break out if we've reached our iteration limit
        if (float(iter) >= float(iterations)) break;
        // z = z^2 + c
        vec2 zSquared = vec2(
            z.x * z.x - z.y * z.y,
            2.0 * z.x * z.y
        );
        z = zSquared + c;
        
        // Check if |z| > 2
        if (dot(z, z) > 4.0) {
            i = float(iter);
            break;
        }
        i = float(iter);
    }
    
    // Smooth coloring
    if (i < float(u_max_iterations)) {
        // Log_2(log_2(|z|))
        float log_zn = log(dot(z, z)) / 2.0;
        float nu = log(log_zn / log(2.0)) / log(2.0);
        
        // Subtract the remaining part from the iteration count
        i = i + 1.0 - nu;
    }
    
    gl_FragColor = getColor(i, u_max_iterations);
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
        
        // Set the canvas size to match its display size
        console.log('Resizing canvas to display size...');
        this.resizeCanvasToDisplaySize();
        console.log('Canvas dimensions:', { width: gl.canvas.width, height: gl.canvas.height });
        
        // Set the viewport
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        
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
    
    // Make sure the canvas size matches its display size
    private resizeCanvasToDisplaySize(): void {
        const canvas = this.gl.canvas as HTMLCanvasElement;
        const displayWidth = canvas.clientWidth;
        const displayHeight = canvas.clientHeight;
        
        if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
            canvas.width = displayWidth;
            canvas.height = displayHeight;
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
