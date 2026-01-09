# AGENTs.md


## Development Commands

### Core Development

- `npm run dev` - Start development server with Node.js debugging and Turbopack
- `npm run build` - Build production Next.js application
- `npm start` - Start production server
- `npm run lint` - Run ESLint for code quality checks

### Testing

- `npm run test` - Run Jest tests in watch mode

Run single test file: `npx jest <test-file-name>`

## Architecture Overview

### High-Level Structure

This is a Next.js application implementing a peer-to-peer file transfer system using the Beam (QR File Transfer Protocol). The application uses QR codes to facilitate file transfers between devices without requiring a shared network connection.

### Core Architectural Patterns

#### Beam Protocol Layer (`app/lib/beam/`)

The core file transfer system built on Beam specification:

**Core Components**:

- `FileSender` - Manages file transmission with state machine (IDLE → HANDSHAKE → TRANSFER → DONE)
- `FileReceiver` - Handles file reception with pull-based chunk requesting
- `protocol.ts` - Message serialization/deserialization and protocol utilities
- `types.ts` - Core TypeScript types, enums, and message interfaces

**Protocol Features**:

- MessagePack serialization with Base64 encoding for QR codes
- 5 message types: HELLO, ACK, PULL, DATA, ERROR
- Session ID generation based on file hash
- File chunking with configurable chunk size (default 64 bytes)
- Sequence number validation and collision detection

#### Utility Libraries (`app/lib/utils/`)

Supporting utilities for the application:

- `conv.ts` - Data conversion utilities
- `format.ts` - Formatting helpers
- `hash.ts` - Hashing utilities
- `id.ts` - ID generation
- `gui.ts` - GUI-related utilities

### Component Architecture (Next.js)

**Frontend Structure**:

- `app/page.tsx` - Main entry point using App Router
- `app/components/` - React components for UI
  - `send-card.tsx` / `recv-card.tsx` - File sending/receiving interfaces
  - `transfer-modal.tsx` - Active transfer management
  - `session-table.tsx` - Transfer session management
  - `file-upload.tsx` - File selection interface
- Uses Flowbite React components with Tailwind CSS styling
- QR code generation via `qrcode.react` and scanning via `html5-qrcode`
- File upload via React Dropzone

### Key Design Decisions

1. **Beam Protocol**: Custom protocol designed for QR code-based file transfers:
   - Pull-based model where receiver requests chunks
   - MessagePack serialization for efficient encoding
   - Base64 encoding for QR code compatibility
   - Built-in collision detection for multiple receivers

2. **State Machine Architecture**: Uses `typescript-fsm` for state management:
   - Sender states: IDLE → HANDSHAKE → TRANSFER → DONE
   - Receiver states: IDLE → HANDSHAKE → TRANSFER → DONE
   - Event-driven transitions with error handling

3. **Chunk-Based Transfer**: Files are split into configurable chunks (default 64 bytes):
   - Memory efficiency for large files
   - Progress tracking granularity
   - Error recovery at chunk level
   - QR code size optimization

4. **Crypto Integration**: Uses `@noble/hashes` for:
   - Session ID generation from file hash
   - File integrity verification

## Common Patterns

### File Transfer Operations

```typescript
import { FileSender, FileReceiver } from '@/lib/beam';

// Sending a file
const sender = new FileSender(writer, reader, {
  chunkSize: 64,
  onProgress: (progress) => console.log(`${progress.percentComplete}%`),
  onHandshake: (sessionId) => console.log(`Session started: ${sessionId}`),
  onDone: () => console.log('Transfer complete!')
});

await sender.send(file);

// Receiving a file
const receiver = new FileReceiver(writer, reader, {
  chunkSize: 64,
  onProgress: (progress) => console.log(`Received ${progress.chunksReceived}/${progress.totalChunks} chunks`),
  onDone: (file) => console.log(`Received file: ${file.name}`)
});

const receivedFile = await receiver.receive();
```

### Protocol Message Handling

```typescript
import { encodeMessage, decodeMessage, MessageType } from '@/lib/beam/protocol';

// Create and encode a message
const helloMessage = {
  type: MessageType.HELLO,
  sessionId: 'session123',
  fileName: 'example.txt',
  fileSize: 1024,
  totalChunks: 16
};

const encoded = encodeMessage(helloMessage);

// Decode a received message
const decoded = decodeMessage(encodedData);
```

## Testing Patterns

### Unit Tests

- Test files follow `*.test.ts` pattern in `app/lib/beam/`
- Uses Jest with ts-jest preset for TypeScript support
- Node environment for testing
- Mock implementations available in `__mocks__/mock-io.ts`

### Key Test Areas

- **Protocol Tests**: Message serialization/deserialization, validation
- **Sender Tests**: State machine transitions, progress callbacks, error handling
- **Receiver Tests**: Chunk requesting, collision detection, file assembly
- **Integration Tests**: End-to-end file transfers between sender and receiver
- **Types Tests**: Data structure validation and edge cases

### Test Coverage

Current coverage: 94.87% statement coverage, 79.67% branch coverage

## Important Constants

Located in `app/settings.ts`:

- File transfer configuration and system constants

## Project Structure

- **Main App**: `app/` - Next.js application files
- **Components**: `app/components/` - React UI components
- **Beam Library**: `app/lib/beam/` - Core file transfer protocol implementation
- **Utilities**: `app/lib/utils/` - Supporting utility functions
- **Documentation**: `docs/` - Protocol specification and architecture docs
- **Infrastructure**: `environments/prod/` - Terraform deployment configuration

## Infrastructure

- **Deployment**: Terraform configuration for production deployment
- **Package Manager**: Uses pnpm (lockfile present)
- **Runtime**: Supports both Node.js and Bun execution
- **Testing**: Jest with comprehensive test coverage
- **Styling**: Tailwind CSS with Flowbite components
