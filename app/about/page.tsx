import Header from "../components/header";
import Footer from "../components/footer";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "About Beam - How Beam Transfer Works | No Trace, Offline",
  description: "Learn how Beam enables anonymous, surveillance-free file transfers using QR codes. No internet, no servers, no detection. Complete privacy for sensitive document sharing.",
  keywords: "how private file transfer works, QR code file sharing guide, offline file transfer tutorial, anonymous file sharing, surveillance-free sharing, no trace file transfer, privacy file sharing guide",
  openGraph: {
    title: "About Beam - How Beam Transfer Works",
    description: "Learn how Beam enables anonymous, surveillance-free file transfers using QR codes. No internet, no servers, no detection.",
    url: "https://get-beam.vercel.app/about",
    type: "article",
  },
  twitter: {
    title: "About Beam - How Beam Transfer Works",
    description: "Learn how Beam enables anonymous, surveillance-free file transfers using QR codes.",
  },
  alternates: {
    canonical: "https://get-beam.vercel.app/about",
  },
};

export default function AboutPage() {

  return (
    <div>
      <Header />
      <main className="flex grow items-center justify-center">
        <div className="relative isolate px-6 pt-14 lg:px-8">
          <div
            className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80"
            aria-hidden="true"
          >
            <div
              className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-[#ff80b5] to-[#9089fc] opacity-30 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"
              style={{
                "clipPath":
                  "polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)",
              }}
            >
            </div>
          </div>
          <div className="mx-auto max-w-4xl py-16">
            <div className="text-center">
              <h1 className="text-balance text-5xl tracking-tight text-gray-900 sm:text-5xl">
                About Beam
              </h1>
            </div>

            <div className="mt-16 space-y-12">
              <div className="text-center">
                <p className="mt-6 text-lg leading-8 text-gray-600">
                  Beam uses QR-based protocol to enable direct device-to-device file transfers through QR codes and cameras.
                </p>
              </div>

              <div className="grid gap-8 lg:grid-cols-2">
                <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                  <h3 className="mb-4 text-xl font-semibold text-gray-900">
                    📱 Device Positioning
                  </h3>
                  <p className="text-gray-600">
                    Align two nearby devices front-to-front so their cameras can see each other&apos;s screens. Both devices need working front cameras for the transfer to work.
                  </p>
                </div>

                <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                  <h3 className="mb-4 text-xl font-semibold text-gray-900">
                    🔄 Chunked Transfer
                  </h3>
                  <p className="text-gray-600">
                    Files are broken into small chunks (64 bytes each) and transferred piece by piece. This ensures reliability and allows for progress tracking during transfer.
                  </p>
                </div>

                <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                  <h3 className="mb-4 text-xl font-semibold text-gray-900">
                    🌐 Completely Offline
                  </h3>
                  <p className="text-gray-600">
                    No internet connection required. Data travels directly between nearby devices through QR codes, ensuring complete privacy and security.
                  </p>
                </div>

                <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                  <h3 className="mb-4 text-xl font-semibold text-gray-900">
                    🔒 Privacy First
                  </h3>
                  <p className="text-gray-600">
                    Your files never leave your devices or touch any servers. The transfer happens locally between your nearby devices without a trace.
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6">
                <h3 className="mb-4 text-xl font-semibold text-yellow-800">
                  ⚡ Transfer Speed Considerations
                </h3>
                <p className="mb-4 text-yellow-700">
                  Beam prioritizes privacy and offline capability over speed. Transfer speeds are intentionally low due to the QR code method, making it ideal for small files, documents, and situations where internet isn&apos;t available.
                </p>
                <p className="text-yellow-700">
                  <strong>Need faster transfers?</strong> Join our{" "}
                  <a
                    href="https://chat.whatsapp.com/ER9s5LBtcz49xVA7pOpB1H"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-yellow-800 underline hover:text-yellow-900"
                  >
                    support group
                  </a>{" "}
                  to discuss your needs and explore potential solutions.
                </p>
              </div>



              <div className="text-center">
                <h2 className="mb-6 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                  Perfect For
                </h2>
                <div className="grid gap-6 md:grid-cols-3">
                  <div className="text-center">
                    <div className="mb-3 text-4xl">📄</div>
                    <h4 className="font-semibold text-gray-900">Documents</h4>
                    <p className="text-sm text-gray-600">Small files, PDFs, text documents</p>
                  </div>
                  <div className="text-center">
                    <div className="mb-3 text-4xl">🔐</div>
                    <h4 className="font-semibold text-gray-900">Sensitive Data</h4>
                    <p className="text-sm text-gray-600">When privacy is paramount</p>
                  </div>
                  <div className="text-center">
                    <div className="mb-3 text-4xl">🚫</div>
                    <h4 className="font-semibold text-gray-900">No Internet</h4>
                    <p className="text-sm text-gray-600">Offline environments</p>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}