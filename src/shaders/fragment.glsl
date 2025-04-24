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
    float i;
    
    for (i = 0.0; i < float(u_max_iterations); i++) {
        // z = z^2 + c
        vec2 zSquared = vec2(
            z.x * z.x - z.y * z.y,
            2.0 * z.x * z.y
        );
        z = zSquared + c;
        
        // Check if |z| > 2
        if (dot(z, z) > 4.0) {
            break;
        }
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
