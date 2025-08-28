export const metadata = {
  title: "Offline",
};

export default function Offline() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <h1 className="text-2xl font-semibold">You are offline</h1>
      <p className="text-sm opacity-70 max-w-sm">
        Some features like authentication and live data require an internet
        connection. You can continue browsing cached pages.
      </p>
    </div>
  );
}

