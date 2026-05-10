// Manual mock for socket.io-client
// Provides a controllable mockSocket so tests can simulate events.

export const mockSocket = {
  on: jest.fn(),
  off: jest.fn(),
  emit: jest.fn(),
  disconnect: jest.fn(),
  connected: false,
};

const io = jest.fn(() => mockSocket);

export { io };
export default io;
