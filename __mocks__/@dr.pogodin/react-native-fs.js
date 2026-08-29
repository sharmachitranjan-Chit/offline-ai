// Manual Jest mock for @dr.pogodin/react-native-fs — the real package
// relies on native modules that don't exist in the Jest environment.
// Only the surface area ModelManager actually uses is implemented.
module.exports = {
  DocumentDirectoryPath: '/mock/documents',
  exists: jest.fn(async () => false),
  mkdir: jest.fn(async () => undefined),
  unlink: jest.fn(async () => undefined),
  moveFile: jest.fn(async () => undefined),
  downloadFile: jest.fn(() => ({
    jobId: 0,
    promise: Promise.resolve({ statusCode: 200, bytesWritten: 0 }),
  })),
  stopDownload: jest.fn(),
};
