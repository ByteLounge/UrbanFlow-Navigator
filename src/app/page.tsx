
"use client"; // Ensure this page is a Client Component

import { useState } from 'react';
import { MapComponent } from '@/components/map-component';
import { WeatherDisplay } from '@/components/weather-display';
import { TripPlanner } from '@/components/trip-planner';
import { NavigationControls } from '@/components/navigation-controls'; // Import NavigationControls
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { GenerateTripPlanOutput } from '@/ai/flows/generate-trip-plan'; // Import the type

export default function Home() {
  // Default location (e.g., San Francisco)
  const defaultLocation = { lat: 37.7749, lng: -122.4194 };

  // State to hold the generated trip plan
  const [tripPlan, setTripPlan] = useState<GenerateTripPlanOutput | null>(null);
  // State to track if navigation is active
  const [isNavigating, setIsNavigating] = useState<boolean>(false);

  const handlePlanGenerated = (plan: GenerateTripPlanOutput | null) => {
    setTripPlan(plan);
    setIsNavigating(false); // Reset navigation when a new plan is generated or cleared
  };

  const handleStartNavigation = () => {
    if (tripPlan) {
        console.log("Starting navigation...");
        setIsNavigating(true);
    }
  };

  const handleStopNavigation = () => {
     console.log("Stopping navigation...");
     setIsNavigating(false);
  };


  return (
    <div className="flex flex-col h-screen bg-secondary">
      <header className="bg-primary text-primary-foreground p-4 shadow-md z-10">
        <h1 className="text-2xl font-bold">UrbanFlow Navigator</h1>
      </header>

      <div className="flex flex-1 overflow-hidden p-4 gap-4 relative"> {/* Added relative positioning */}
        {/* Left Panel: Weather and Trip Planner */}
        <div className="w-1/3 flex flex-col gap-4 overflow-y-auto pr-2"> {/* Added padding-right */}
           <Card className="shadow-lg rounded-lg">
             {/* Keep CardHeader here for consistent styling */}
             <CardHeader>
                <CardTitle>Weather Forecast</CardTitle>
             </CardHeader>
            <CardContent>
              {/* WeatherDisplay now manages its own refresh button */}
              <WeatherDisplay initialLocation={defaultLocation} />
            </CardContent>
          </Card>

          <Card className="shadow-lg rounded-lg flex-shrink-0"> {/* Prevent trip planner from shrinking excessively */}
             <CardHeader>
               <CardTitle>AI Trip Planner</CardTitle>
             </CardHeader>
             <CardContent>
              {/* Pass handlePlanGenerated function to TripPlanner */}
              <TripPlanner onPlanGenerated={handlePlanGenerated} />
             </CardContent>
           </Card>
        </div>

        {/* Right Panel: Map */}
        <div className="w-2/3 flex-1 rounded-lg overflow-hidden shadow-lg relative"> {/* Added relative for positioning controls */}
          {/* Pass tripPlan data and navigation status to MapComponent */}
          <MapComponent
            initialCenter={tripPlan?.route?.path[0] || defaultLocation} // Center on origin if plan exists
            route={tripPlan?.route} // Pass the entire route object
            attractions={tripPlan?.nearbyAttractions} // Pass attractions
            isNavigating={isNavigating} // Pass navigation status
            key={tripPlan?.suggestedDepartureTime || 'map'} // Re-render map when plan changes significantly
          />
           {/* Navigation Controls positioned over the map */}
           <div className="absolute bottom-4 right-4 z-10">
               <NavigationControls
                 tripPlan={tripPlan}
                 isNavigating={isNavigating}
                 onStart={handleStartNavigation}
                 onStop={handleStopNavigation}
               />
           </div>
        </div>
      </div>
    </div>
  );
}
