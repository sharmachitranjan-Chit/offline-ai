module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['./jest.setup.js'],
  // llama.rn ships its "react-native" entry point as TypeScript source
  // (per RN convention), so it needs to go through babel-jest like our
  // own code rather than being treated as pre-built node_modules JS.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|llama\\.rn)/)',
  ],
};
