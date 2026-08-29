// Provides fake JSI bindings for llama.rn so components that import it can
// be rendered under Jest (no real native module is loaded in tests).
require('llama.rn/jest/mock');
