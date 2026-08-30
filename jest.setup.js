/* eslint-env jest */
// Provides fake JSI bindings for llama.rn so components that import it can
// be rendered under Jest (no real native module is loaded in tests).
require('llama.rn/jest/mock');

// DocKit is this app's own native module. Under Jest it simply isn't
// registered, and the TS wrapper is written to degrade gracefully in that
// case — so the only thing needed here is a silent NativeEventEmitter.
jest.mock('react-native/Libraries/EventEmitter/NativeEventEmitter', () =>
  jest.fn().mockImplementation(() => ({
    addListener: jest.fn(() => ({ remove: jest.fn() })),
    removeAllListeners: jest.fn(),
  })),
);
