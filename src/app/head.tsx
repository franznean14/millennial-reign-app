export default function Head() {
  // Explicitly include the manifest link to guarantee discovery on first paint
  // across all routes, even if metadata processing is delayed by the browser.
  return (
    <>
      <link rel="manifest" href="/manifest.webmanifest" />
      <meta name="theme-color" content="#000000" />
    </>
  );
}

