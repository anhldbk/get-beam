import { useEffect, useState } from "react";
interface LoaderProps {
  role: "sender" | "receiver";
  file?: File | null;
  resumed?: boolean;
  children: React.ReactNode;
}

export default function Loader({ file, children }: LoaderProps) {
  const [isLoading, setIsLoading] = useState(true);
  const init = async () => {
    // No longer need complex initialization with the new Beam library
    // Just a brief delay to show the loading state
    await new Promise(resolve => setTimeout(resolve, 500));
    setIsLoading(false);
  };
  useEffect(() => {
    init();
  }, [file]);

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center">
        <div className="mb-4 size-12 animate-spin rounded-full border-b-2 border-blue-600">
        </div>
        <h3 className="text-xl font-semibold text-gray-700">Loading file...</h3>
      </div>
    );
  }

  return <>{children}</>;
}
