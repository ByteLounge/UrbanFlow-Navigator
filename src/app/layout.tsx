
'use client'; // Required for APIProvider and hooks

import { type ReactNode } from 'react';
import { Inter } from 'next/font/google';
import './globals.css';
import { APIProvider } from '@vis.gl/react-google-maps';
import { Toaster } from "@/components/ui/toaster";
import { cn } from '@/lib/utils'; // Import cn for class merging

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

// Note: Metadata export is commented out as this is a Client Component.
// Manage title/meta tags directly in the <head> or via a different pattern if needed.

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  // Ensure the API key is read correctly on the client-side
  // IMPORTANT: This key is exposed in the client-side bundle.
  // Ensure it's properly restricted in your Google Cloud Console (e.g., HTTP referrers).
  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  // Check if the public key is missing or empty
  if (!googleMapsApiKey) {
    console.error("Configuration Error: NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is missing or empty in your environment variables.");
    // Render a clear error message to the user
    return (
       <html lang="en" suppressHydrationWarning={true}>
        <head>
            <title>Configuration Error</title>
            <meta name="description" content="Application requires Google Maps API Key configuration." />
        </head>
        {/* Apply fonts directly in the error message body */}
        <body className={cn(inter.variable, 'font-sans antialiased')} suppressHydrationWarning={true}>
          <div className="flex flex-col items-center justify-center h-screen p-4 text-center bg-background">
            <h1 className="text-2xl font-bold text-destructive mb-2">Configuration Error</h1>
            <p className="text-destructive mb-4">Required Google Maps API Keys are missing.</p>
             <p className="text-muted-foreground mt-1">Create a <code className="bg-muted px-1 py-0.5 rounded text-sm font-mono">.env.local</code> file in the project root (if it doesn't exist) and add the following lines:</p>
            <pre className="bg-muted p-2 rounded mt-2 text-sm text-left overflow-x-auto w-full max-w-xl">
              <code># Public key for map display (required by UI)</code>{'\n'}
              <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=YOUR_CLIENT_SIDE_MAPS_KEY</code>{'\n'}
              <code># Server-side key for services (Geocoding, Directions, Places - required by backend/server actions)</code>{'\n'}
              <code>GOOGLE_MAPS_API_KEY=YOUR_SERVER_SIDE_MAPS_KEY</code>{'\n'}
              <code># Optional: Add OpenWeatherMap API key if needed for weather features</code>{'\n'}
              <code># OPENWEATHERMAP_API_KEY=YOUR_OPENWEATHERMAP_KEY</code>{'\n'}
              <code># Optional: Add Google Generative AI API key if needed for AI features</code>{'\n'}
              <code># GOOGLE_GENAI_API_KEY=YOUR_GEMINI_API_KEY</code>
            </pre>
             <p className="text-muted-foreground mt-3">Replace <code className="bg-muted px-1 py-0.5 rounded text-sm font-mono">YOUR_CLIENT_SIDE_MAPS_KEY</code> and <code className="bg-muted px-1 py-0.5 rounded text-sm font-mono">YOUR_SERVER_SIDE_MAPS_KEY</code> with your actual keys. <strong className="text-foreground">For testing, you can often use the same key for both.</strong></p>
            <p className="text-muted-foreground mt-2">After adding the keys to <code className="bg-muted px-1 py-0.5 rounded text-sm font-mono">.env.local</code>, <strong className="text-foreground">you MUST restart the development server</strong> (stop the `npm run dev` process and start it again).</p>
             <p className="text-muted-foreground mt-4 text-xs">
                Ensure your keys are valid and have the following APIs enabled in the Google Cloud Console:
                <ul className="list-disc list-inside text-left pl-4 mt-1 max-w-md mx-auto">
                  <li><strong className="text-foreground">Maps JavaScript API</strong> (for <code className="text-xs font-mono">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code>)</li>
                  <li><strong className="text-foreground">Geocoding API</strong> (for <code className="text-xs font-mono">GOOGLE_MAPS_API_KEY</code> - Required for address lookup/reverse geocoding)</li>
                  <li><strong className="text-foreground">Directions API</strong> (for <code className="text-xs font-mono">GOOGLE_MAPS_API_KEY</code> - Required for route finding)</li>
                  <li><strong className="text-foreground">Places API</strong> (for <code className="text-xs font-mono">GOOGLE_MAPS_API_KEY</code> - Required for finding attractions/waypoints)</li>
                </ul>
                Also, check API key restrictions (e.g., HTTP referrers for the public key, IP addresses for the server key) and ensure <strong className="text-foreground">billing is enabled</strong> for your Google Cloud project. API errors often appear in the browser console.
            </p>
          </div>
        </body>
      </html>
    );
  }

  // If the key exists, render the app with the APIProvider
  return (
    <html lang="en" suppressHydrationWarning={true}>
      <head>
         {/* Static title/meta tags for client component layout */}
        <title>UrbanFlow Navigator</title>
        <meta name="description" content="Real-Time Smart City Navigator with Weather & Trip Intelligence" />
      </head>
      {/*
        Added suppressHydrationWarning to the body tag.
        This helps mitigate hydration errors common when using third-party libraries
        or browser extensions that might manipulate the DOM before React hydrates.
        While not a fix for the root cause of hydration mismatches, it can prevent
        the UI flicker/breakage during development.

        If you see Google Maps errors like `InvalidKeyMapError`, `AuthFailure`, or errors mentioning `REQUEST_DENIED`:
        1.  **Check API Keys**: Ensure `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (for map display) and `GOOGLE_MAPS_API_KEY` (for backend services) in `.env.local` are EXACTLY correct. Copy/paste them carefully.
        2.  **Restart Server**: After changing `.env.local`, ALWAYS restart your Next.js development server (`npm run dev`). This is essential for environment variables to be picked up.
        3.  **Enable APIs**: In Google Cloud Console -> APIs & Services -> Library, make sure the **Maps JavaScript API, Geocoding API, Directions API, and Places API** are ENABLED for your project. This is crucial! Double-check the APIs enabled for *both* keys if they are different.
        4.  **Check Restrictions**: In Google Cloud Console -> APIs & Services -> Credentials -> Your API Key(s):
            *   **Application restrictions**: For `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, if you set HTTP referrers, ensure your development URL (e.g., `localhost:9002/*` or your deployed domain) is listed. For `GOOGLE_MAPS_API_KEY`, consider IP address restrictions for security (e.g., your server's IP if deployed, or leave as 'None' for local testing if trusted). For initial testing, consider setting restrictions to 'None' temporarily (less secure).
            *   **API restrictions**: Ensure the required APIs (listed in step 3) are included in the list of allowed APIs for *each* key. Double-check this for `GOOGLE_MAPS_API_KEY`.
        5.  **Billing**: Ensure billing is enabled for your Google Cloud project. Maps usage often requires it.
        6.  **Browser Extensions**: Temporarily disable browser extensions.
        7.  **Check Console**: Look for detailed error messages from Google Maps in the browser's developer console (for `InvalidKeyMapError`, `AuthFailure`) AND your server logs (terminal where `npm run dev` is running for `REQUEST_DENIED` errors from services like Geocoding/Directions/Places).
      */}
       {/* Apply fonts via cn helper */}
      <body className={cn(inter.variable, 'font-sans antialiased')} suppressHydrationWarning={true}>
         {/* APIProvider requires a valid API key */}
         <APIProvider
             apiKey={googleMapsApiKey}
             // Optional: Add onLoad callback for debugging Google Maps specific loading issues
             onLoad={() => console.log('[Layout] Google Maps API Script Loaded Successfully via APIProvider')}
             // Note: Error handling for *invalid* keys (e.g., AuthFailure, InvalidKeyMapError)
             // or *denied requests* (e.g., due to disabled APIs or billing issues)
             // often manifests as console errors directly from the Google Maps library itself.
             // The UI might show an error overlay *from Google Maps*. Check the browser console!
         >
            {children}
            <Toaster />
          </APIProvider>
      </body>
    </html>
  );
}
