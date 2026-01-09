# Beam

**Beam** is a secure, offline file transfer application that enables data transmission between devices using QR codes. Designed for environments with unreliable or non-existent network connectivity, Beam utilizes a custom protocol to chunk, encode, and transmit files visually from a sender's screen to a receiver's camera.

## Features

- **Offline Capability:** Transfer files without Wi-Fi, Bluetooth, or mobile data.
- **Cross-Platform:** Web-based architecture works on any device with a modern browser and camera.
- **Visual Protocol:** Uses optimized QR code sequences for data transmission.
- **Reliable Transfer:** Implements a custom handshake, sequence tracking, and error correction (Beam Protocol).
- **Secure:** Direct device-to-device transfer with no intermediate servers.
- **Resume Capability:** Supports session resumption and chunk tracking.

## Technology Stack

- **Framework:** [Next.js 15](https://nextjs.org/) (App Router)
- **UI Library:** [React 19](https://react.dev/)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/), [Flowbite](https://flowbite.com/), [DaisyUI](https://daisyui.com/)
- **QR Processing:**
  - Encoding: `qrcode.react`
  - Decoding: `@zxing/browser`, `html5-qrcode`
- **Data Serialization:** `@msgpack/msgpack`
- **Testing:** Jest

## Getting Started

### Prerequisites

- Node.js 20+
- npm, pnpm, yarn, or bun

### Installation

1. Clone the repository:

    ```bash
    git clone https://github.com/yourusername/beam-app.git
    cd beam-app
    ```

2. Install dependencies:

    ```bash
    npm install
    # or
    pnpm install
    # or
    bun install
    ```

### Running the Development Server

Start the application on port 8080:

```bash
npm run dev
# or
pnpm dev
```

Open [http://localhost:8080](http://localhost:8080) with your browser to see the result.

> **Note:** For file transfer to work, you need two devices (or two browser windows/tabs for testing loopback) capable of displaying and scanning QR codes.

### Running Tests

Execute the test suite (includes protocol and integration tests):

```bash
npm test
```

## Project Structure

```text
/
├── app/
│   ├── components/      # UI components (Scanner, QR Display, etc.)
│   ├── lib/
│   │   └── beam/        # Core Protocol Implementation (Sender/Receiver)
│   └── page.tsx         # Main application entry
├── docs/                # Detailed Protocol Documentation
└── public/              # Static assets
```

## Documentation

- **[Protocol Specification](docs/beam.md):** Detailed breakdown of the Beam QR File Transfer Protocol, including message formats, state machines, and error handling.
- **[Library Implementation](app/lib/beam/README.md):** technical details of the TypeScript implementation of the protocol.

## Contributing

Contributions are welcome! Whether it's reporting a bug, suggesting a feature, or submitting a pull request, your help is appreciated. Please feel free to open an issue or submit a PR.

## License

[MIT](LICENSE)
