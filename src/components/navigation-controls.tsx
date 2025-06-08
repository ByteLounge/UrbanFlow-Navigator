
"use client";

import type { FC } from 'react';
import type { GenerateTripPlanOutput } from '@/ai/flows/generate-trip-plan';
import { Button } from '@/components/ui/button';
import { Play, XCircle, Navigation } from 'lucide-react';

interface NavigationControlsProps {
  tripPlan: GenerateTripPlanOutput | null;
  isNavigating: boolean;
  onStart: () => void;
  onStop: () => void;
}

export const NavigationControls: FC<NavigationControlsProps> = ({
  tripPlan,
  isNavigating,
  onStart,
  onStop,
}) => {
  return (
    <div className="flex flex-col gap-2">
      {tripPlan && !isNavigating && (
        <Button
          onClick={onStart}
          className="bg-accent hover:bg-accent/90 text-accent-foreground shadow-lg rounded-full p-3 h-auto"
          aria-label="Start Journey"
          title="Start Journey"
        >
          <Play className="w-6 h-6 mr-2" />
          Start Journey
        </Button>
      )}
      {isNavigating && (
        <Button
          onClick={onStop}
          variant="destructive"
          className="bg-destructive hover:bg-destructive/90 text-destructive-foreground shadow-lg rounded-full p-3 h-auto"
          aria-label="Exit Journey"
          title="Exit Journey"
        >
          <XCircle className="w-6 h-6 mr-2" />
          Exit Journey
        </Button>
      )}
      {/* Optional: Add a re-center button if needed */}
      {/* {isNavigating && (
        <Button
          // onClick={onRecenter} // Add a recenter handler if needed
          variant="secondary"
          className="bg-secondary hover:bg-secondary/80 text-secondary-foreground shadow-lg rounded-full p-3 h-auto aspect-square"
          aria-label="Recenter Map"
          title="Recenter Map"
        >
          <Navigation className="w-5 h-5" />
        </Button>
      )} */}
    </div>
  );
};
