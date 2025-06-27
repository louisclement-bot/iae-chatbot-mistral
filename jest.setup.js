/**
 * @file Jest Setup File
 * 
 * This file provides global setup for the Jest test environment.
 * It includes polyfills for browser APIs that are not available in the JSDOM environment,
 * such as `TextEncoder` and `ReadableStream`, to ensure tests run correctly.
 */

// Polyfill for TextEncoder, which is used by TextDecoder
if (typeof TextEncoder === 'undefined') {
  global.TextEncoder = require('util').TextEncoder;
}

// Polyfill for ReadableStream, which is used in fetch responses for streaming
// This is a basic polyfill and might need more comprehensive implementation
// depending on the specific usage of ReadableStream in the application.
if (typeof ReadableStream === 'undefined') {
  const { Readable } = require('stream');
  global.ReadableStream = Readable;
}

// Mock the global fetch function if it's not already mocked by a testing library
// This is a common practice to prevent actual network requests during tests.
if (typeof global.fetch === 'undefined') {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({}),
      text: () => Promise.resolve(''),
      blob: () => Promise.resolve(new Blob()),
      headers: new Headers(),
      status: 200,
      statusText: 'OK',
      url: 'mock-url',
      clone: () => ({ ...global.fetch() }),
      body: null, // ReadableStream will be mocked separately if needed
      bodyUsed: false,
      redirected: false,
      type: 'basic'
    })
  );
}

// Mock TextDecoder for stream parsing if needed
if (typeof TextDecoder === 'undefined') {
  global.TextDecoder = class {
    decode(buffer, options) {
      // Simple mock: assume UTF-8 and return string
      return Buffer.from(buffer).toString('utf8');
    }
  };
}
