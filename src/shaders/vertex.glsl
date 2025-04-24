// Basic vertex shader that passes through the position
attribute vec2 a_position;

void main() {
    // Convert from 0->1 to -1->1 (clip space)
    vec2 position = a_position * 2.0 - 1.0;
    gl_Position = vec4(position, 0, 1);
}
