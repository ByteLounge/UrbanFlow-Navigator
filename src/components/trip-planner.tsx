
"use client";

import type { FC } from 'react';
import { useState } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { generateTripPlan, type GenerateTripPlanOutput } from '@/ai/flows/generate-trip-plan';
import { getAddressFromCoordinates, type Attraction, SERVER_CONFIG_ERROR_MSG } from '@/services/google-maps'; // Import reverse geocoding, Attraction type, and the specific error message
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox"; // Import Checkbox
import { Loader2, MapPin, Clock, Route as RouteIcon, BrainCircuit, CloudSun, Navigation, Sparkles, Landmark, CalendarDays, LocateFixed, MapPin as DestPin } from 'lucide-react'; // Added LocateFixed, DestPin
import { format, parseISO } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from "@/hooks/use-toast"; // Import useToast

// Define the Zod schema for form validation using addresses
const TripPlannerSchema = z.object({
  originAddress: z.string().min(3, "Origin address must be at least 3 characters").describe('Origin Address'),
  destinationAddress: z.string().min(3, "Destination address must be at least 3 characters").describe('Destination Address'),
  departureTime: z.string().min(1, "Departure time is required").describe('Desired Departure Time (YYYY-MM-DDTHH:mm)'), // Use string for datetime-local input
});

type TripPlannerFormValues = z.infer<typeof TripPlannerSchema>;

interface TripPlannerProps {
    onPlanGenerated: (plan: GenerateTripPlanOutput | null) => void; // Callback prop
}

export const TripPlanner: FC<TripPlannerProps> = ({ onPlanGenerated }) => {
  const [tripPlan, setTripPlan] = useState<GenerateTripPlanOutput | null>(null);
  const [loadingPlan, setLoadingPlan] = useState<boolean>(false);
  const [loadingLocation, setLoadingLocation] = useState<boolean>(false); // Loading state for geolocation
  const [error, setError] = useState<string | null>(null);
  const [selectedWaypoints, setSelectedWaypoints] = useState<string[]>([]); // State for selected waypoint place IDs
  const { toast } = useToast(); // Initialize toast

  const {
    register,
    handleSubmit,
    setValue, // Add setValue to programmatically update form fields
    formState: { errors },
    reset,
    getValues, // Get form values for regeneration
  } = useForm<TripPlannerFormValues>({
    resolver: zodResolver(TripPlannerSchema),
     defaultValues: { // Provide default example values
            originAddress: "San Francisco, CA",
            destinationAddress: "Los Angeles, CA",
            departureTime: format(new Date(), "yyyy-MM-dd'T'HH:mm"), // Default to current time
        }
  });

   // --- Geolocation Handler ---
   const handleUseCurrentLocation = () => {
     if (!navigator.geolocation) {
       toast({
         variant: "destructive",
         title: "Geolocation Error",
         description: "Geolocation is not supported by your browser.",
       });
       return;
     }

     setLoadingLocation(true);
     setError(null); // Clear previous errors

     navigator.geolocation.getCurrentPosition(
       async (position) => {
         const { latitude, longitude } = position.coords;
         console.log("Current location coords:", { latitude, longitude });
         try {
           // Reverse geocode to get address
           const address = await getAddressFromCoordinates({ lat: latitude, lng: longitude });
           setValue('originAddress', address, { shouldValidate: true }); // Update form field
           toast({
             title: "Location Updated",
             description: "Origin set to your current location.",
           });
         } catch (err) {
            console.error("Reverse geocoding failed:", err);
             let errorMessage = "Could not determine address from your location.";
             if (err instanceof Error) {
                 // Check for the specific server configuration error using the imported constant
                 if (err.message === SERVER_CONFIG_ERROR_MSG) {
                     // Use the exact message for consistency
                     errorMessage = SERVER_CONFIG_ERROR_MSG;
                 } else if (err.message.includes('REQUEST_DENIED')) {
                      errorMessage = "Error: Reverse Geocoding failed. Ensure the Geocoding API is enabled and authorized for your server-side key (GOOGLE_MAPS_API_KEY).";
                 } else if (err.message.includes('ZERO_RESULTS')) {
                     errorMessage = "Error: Could not find an address for your current coordinates.";
                 } else {
                     errorMessage = `Reverse geocoding failed: ${err.message}`; // Use the original message for other errors
                 }
             }
             toast({
                 variant: "destructive",
                 title: "Reverse Geocoding Error",
                 description: errorMessage,
             });
             setError(errorMessage); // Also set the main error state
         } finally {
           setLoadingLocation(false);
         }
       },
       (error) => {
         console.error("Geolocation Error:", error.message);
         let errorMessage = "Could not retrieve your location.";
         switch (error.code) {
           case error.PERMISSION_DENIED:
             errorMessage = "Location permission denied. Please enable it in your browser settings.";
             break;
           case error.POSITION_UNAVAILABLE:
             errorMessage = "Location information is unavailable.";
             break;
           case error.TIMEOUT:
             errorMessage = "The request to get user location timed out.";
             break;
           default:
              errorMessage = `An unknown error occurred (${error.message}).`;
              break;
         }
          toast({
            variant: "destructive",
            title: "Geolocation Error",
            description: errorMessage,
          });
          setError(errorMessage); // Also set the main error state
         setLoadingLocation(false);
       },
       {
         enableHighAccuracy: true, // Request high accuracy
         timeout: 10000,        // Give up after 10 seconds
         maximumAge: 60000       // Use cached position if younger than 1 minute
       }
     );
   };
   // --- End Geolocation Handler ---


  // Updated onSubmit to accept an optional 'isUpdate' flag
  const onSubmit: SubmitHandler<TripPlannerFormValues> = async (data) => {
        // This function is now only called by handleSubmit, which handles validation.
        // We need a way to know if this submission is for initial generation or update.
        // We can use a separate state variable or pass a flag via the button click.
        // Let's assume the 'Update Route' button will call a different handler that sets a flag
        // or directly calls a version of this logic.

        // For simplicity, we'll check if waypoints are selected to determine if it's an update.
        // This isn't perfect but avoids adding more state complexity right now.
        const isUpdate = selectedWaypoints.length > 0;
        const waypointsToSubmit = selectedWaypoints; // Always use current selected waypoints

        setLoadingPlan(true);
        setError(null);
        // Don't clear the full trip plan on update, only on initial generation or full reset
        if (!isUpdate) {
            setTripPlan(null);
            setSelectedWaypoints([]); // Clear waypoints on new plan generation
            onPlanGenerated(null); // Clear previous plan in parent
        } else {
            // Keep existing plan basics, but indicate loading for route update
            onPlanGenerated(tripPlan ? { ...tripPlan, route: { ...tripPlan.route, path: [] } } : null); // Clear path visually
        }

        try {
            // Convert local datetime string to ISO 8601 UTC string
            const departureDate = new Date(data.departureTime);
            if (isNaN(departureDate.getTime())) {
                throw new Error("Invalid date/time format for departure");
            }
            const departureISO = departureDate.toISOString();

            // Call the AI flow with address data and selected waypoints
            console.log(`Generating/Updating trip plan. Waypoints: ${waypointsToSubmit}`);
            const plan = await generateTripPlan({
                originAddress: data.originAddress,
                destinationAddress: data.destinationAddress,
                departureTime: departureISO, // Send ISO string to the flow
                waypoints: waypointsToSubmit, // Send selected place IDs
            });
            setTripPlan(plan);
            onPlanGenerated(plan); // Pass the generated/updated plan to the parent
            toast({ // Add success toast
                title: isUpdate ? "Route Updated" : "Trip Plan Generated",
                description: isUpdate ? "Route updated with selected stops." : "Your AI-powered trip plan is ready.",
            });
        } catch (err) {
            console.error("Failed to generate/update trip plan:", err);
            let errorMessage = "Could not generate trip plan. Please check your inputs and try again later.";
            if (err instanceof Error) {
                const originalMessage = err.message;
                const lowerCaseMessage = originalMessage.toLowerCase();

                // Check for the specific server configuration error message FIRST
                if (originalMessage === SERVER_CONFIG_ERROR_MSG) {
                    errorMessage = SERVER_CONFIG_ERROR_MSG; // Use the exact message
                } else if (lowerCaseMessage.includes('api key not valid') || lowerCaseMessage.includes('unauthorized') || lowerCaseMessage.includes('forbidden')) {
                    errorMessage = "Error: Invalid Google Maps API key. Please verify the `GOOGLE_MAPS_API_KEY` and `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` values in your `.env.local` file and ensure they are correctly configured in your Google Cloud Console.";
                } else if (lowerCaseMessage.includes('request_denied')) {
                    if (lowerCaseMessage.includes('api project is not authorized') || lowerCaseMessage.includes('api is not enabled')) {
                        errorMessage = `Error: Google Maps API request denied. Ensure the required APIs (Geocoding, Directions, Places) are ENABLED and authorized for your server-side key (GOOGLE_MAPS_API_KEY) in Google Cloud Console. Check billing status and key restrictions. Restart server after changes. (${originalMessage})`;
                    } else {
                        errorMessage = `Error: Google Maps API request denied. ${originalMessage}`;
                    }
                } else if (lowerCaseMessage.includes('quota') || lowerCaseMessage.includes('limit')) {
                    errorMessage = "Error: Could not generate trip plan due to exceeding Google Maps API usage limits. Please check your quotas in the Google Cloud Console.";
                } else if (lowerCaseMessage.includes('geocode') && lowerCaseMessage.includes('zero_results')) {
                    errorMessage = `Error: Could not find coordinates for the specified address. Please ensure the address is valid. (${originalMessage})`;
                } else if (lowerCaseMessage.includes('directions') && lowerCaseMessage.includes('zero_results')) {
                     errorMessage = `Error: No route found between the specified locations${selectedWaypoints.length > 0 ? ' including the selected stops' : ''}. (${originalMessage})`;
                } else if (lowerCaseMessage.includes('places') && lowerCaseMessage.includes('zero_results')) {
                    errorMessage = `Error: No attractions found for the specified area. (${originalMessage})`;
                } else if (lowerCaseMessage.includes('fetch') && lowerCaseMessage.includes('failed')) {
                     errorMessage = `Error: Network request failed. Could not connect to Google Maps services. Please check your internet connection and firewall settings. (${originalMessage})`;
                } else if (originalMessage.startsWith('Trip plan generation failed:')) {
                    // Extract the core message if it's the configuration error, otherwise use the full message
                    if (originalMessage.includes(SERVER_CONFIG_ERROR_MSG)) {
                         errorMessage = SERVER_CONFIG_ERROR_MSG;
                    } else {
                        // Use the message directly from the flow error, but potentially shorten if too long
                        errorMessage = originalMessage;
                    }
               } else {
                    // If none of the specific checks matched, use the original error message, possibly shortened
                    errorMessage = `Error generating trip plan: ${originalMessage}`;
                }
            }
            setError(errorMessage);
            onPlanGenerated(null); // Ensure parent state is cleared on error
            toast({ // Add error toast
                variant: "destructive",
                title: "Trip Plan Error",
                description: errorMessage, // Show the detailed message here
            });
        } finally {
            setLoadingPlan(false);
        }
    };


   // Handler for waypoint checkbox changes
   const handleWaypointChange = (checked: boolean | string, placeId: string) => {
       setSelectedWaypoints(prev => {
           if (checked === true) {
               return [...prev, placeId];
           } else {
               return prev.filter(id => id !== placeId);
           }
       });
       // Note: We don't trigger a full regeneration here. The user explicitly clicks "Update Route".
   };


   // Helper to format duration
    const formatDuration = (seconds: number): string => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        let durationString = '';
        if (hours > 0) durationString += `${hours} hr `;
        if (minutes > 0 || hours === 0) durationString += `${minutes} min`;
        return durationString.trim() || '0 min'; // Handle zero duration
    };

    // Helper to format distance
    const formatDistance = (meters: number): string => {
        if (meters < 1000) {
            return `${Math.round(meters)} m`;
        }
        const kilometers = (meters / 1000).toFixed(1);
        return `${kilometers} km`;
    };


  return (
    <div className="space-y-4"> {/* Reduced overall spacing */}
      {/* Use FormProvider context if needed by deeper components, otherwise standard form is fine */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3"> {/* `onSubmit` handles both generate and update */}
         {/* Origin Address Input and Button */}
         <div>
           <Label htmlFor="originAddress" className="text-sm mb-1 flex justify-between items-center">
             <span>Origin Address</span>
             <Button
               type="button"
               variant="ghost"
               size="sm"
               onClick={handleUseCurrentLocation}
               disabled={loadingLocation}
               className="text-xs h-auto p-1 text-accent hover:text-accent/90"
             >
               {loadingLocation ? (
                 <Loader2 className="mr-1 h-3 w-3 animate-spin" />
               ) : (
                 <LocateFixed className="mr-1 h-3 w-3" />
               )}
               Use Current Location
             </Button>
           </Label>
           <Input id="originAddress" type="text" {...register('originAddress')} placeholder="e.g., San Francisco, CA" className="h-9 text-sm" />
           {errors.originAddress && <p className="text-destructive text-xs mt-1">{errors.originAddress.message}</p>}
         </div>

         {/* Destination Address Input */}
         <div>
            <Label htmlFor="destinationAddress" className="text-sm">Destination Address</Label>
            <Input id="destinationAddress" type="text" {...register('destinationAddress')} placeholder="e.g., Los Angeles, CA" className="h-9 text-sm" />
            {errors.destinationAddress && <p className="text-destructive text-xs mt-1">{errors.destinationAddress.message}</p>}
         </div>

         {/* Departure Time Input */}
        <div>
          <Label htmlFor="departureTime" className="text-sm">Desired Departure Time</Label>
          <Input id="departureTime" type="datetime-local" {...register('departureTime')} className="h-9 text-sm" />
          {errors.departureTime && <p className="text-destructive text-xs mt-1">{errors.departureTime.message}</p>}
        </div>

        {/* Submit Button for Initial Generation OR Update */}
        {/* The text could change based on context (selectedWaypoints > 0) */}
         <Button type="submit" disabled={loadingPlan || loadingLocation} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground h-9 text-sm">
            {loadingPlan ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : selectedWaypoints.length > 0 ? (
                <RouteIcon className="mr-2 h-4 w-4" />
            ) : (
                <BrainCircuit className="mr-2 h-4 w-4" />
            )}
            {selectedWaypoints.length > 0 ? `Update Route with Stops (${selectedWaypoints.length})` : 'Generate Smart Trip Plan'}
         </Button>
      </form>

      {/* Main Error Display Area */}
      {error && !loadingPlan && !loadingLocation && ( // Only show general error if not loading
         <Alert variant="destructive" className="mt-4 p-3 text-sm">
            <AlertTitle className="text-base font-semibold">Error</AlertTitle>
           <AlertDescription className="text-xs">{error}</AlertDescription>
            {/* Conditionally add a hint about checking API keys/settings */}
           {(error.includes(SERVER_CONFIG_ERROR_MSG) || error.includes('API') || error.includes('denied') || error.includes('authorized') || error.includes('GOOGLE_MAPS_API_KEY') ) && (
                <AlertDescription className="text-xs mt-2">
                    Please double-check your API key setup in <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">.env.local</code> and ensure the required APIs (Geocoding, Directions, Places) are enabled and authorized for the <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">GOOGLE_MAPS_API_KEY</code> in your Google Cloud Console. Remember to restart the development server after changes.
                </AlertDescription>
           )}
         </Alert>
      )}

      {/* Trip Plan Results Area */}
       {tripPlan && (
           <ScrollArea className="mt-4 h-[calc(100vh-500px)] pr-3"> {/* Adjust height, added space for update button */}
             <Card className="shadow-md rounded-lg border border-border">
                <CardHeader className="p-4"> {/* Reduced padding */}
                    <CardTitle className="flex items-center gap-2 text-primary text-lg"> {/* Reduced text size */}
                    <RouteIcon className="w-5 h-5" /> Suggested Trip Plan
                    </CardTitle>
                    <CardDescription className="text-xs">AI-powered recommendation.</CardDescription> {/* Reduced text size */}
                </CardHeader>
                 <CardContent className="space-y-3 p-4 pt-0"> {/* Reduced padding and spacing */}
                     <div className="flex items-start gap-2 text-sm"> {/* Use items-start */}
                         <Navigation className="w-4 h-4 text-accent mt-0.5 flex-shrink-0"/>
                         <p><span className="font-semibold">From:</span> {tripPlan.originAddress}</p>
                     </div>
                     <div className="flex items-start gap-2 text-sm">
                         <DestPin className="w-4 h-4 text-accent mt-0.5 flex-shrink-0"/> {/* Changed icon */}
                         <p><span className="font-semibold">To:</span> {tripPlan.destinationAddress}</p>
                     </div>
                     <div className="flex items-center gap-2 text-sm">
                         <CalendarDays className="w-4 h-4 text-accent flex-shrink-0"/>
                         <p><span className="font-semibold">Suggest Depart:</span> {format(parseISO(tripPlan.suggestedDepartureTime), 'MMM d, HH:mm')}</p>
                     </div>
                     <div className="flex items-center gap-2 text-sm">
                         <RouteIcon className="w-4 h-4 text-accent flex-shrink-0"/>
                         <p><span className="font-semibold">Route:</span> {formatDistance(tripPlan.route.distanceMeters)}, ~{formatDuration(tripPlan.route.durationSeconds)}</p>
                     </div>
                     <div className="flex items-center gap-2 text-sm">
                         <CloudSun className="w-4 h-4 text-accent flex-shrink-0"/>
                         {/* Display actual weather from plan */}
                          <p><span className="font-semibold">Origin Weather:</span> {tripPlan.weatherForecast ? `${tripPlan.weatherForecast.currentTemperatureCelsius}°C, ${tripPlan.weatherForecast.conditions}` : 'N/A'}</p>
                     </div>
                     {/* Attractions Section with Checkboxes */}
                     {tripPlan.nearbyAttractions && tripPlan.nearbyAttractions.length > 0 && (
                         <div className="space-y-2 pt-2">
                             <p className="font-semibold flex items-center gap-2 text-sm"><Landmark className="w-4 h-4 text-primary"/> Attractions Nearby (Select stops):</p>
                             <div className="space-y-2 bg-secondary p-2 rounded-md">
                                 {tripPlan.nearbyAttractions.map((attraction) => (
                                     <div key={attraction.placeId} className="flex items-start space-x-2">
                                         <Checkbox
                                            id={`waypoint-${attraction.placeId}`}
                                            checked={selectedWaypoints.includes(attraction.placeId || '')}
                                            onCheckedChange={(checked) => handleWaypointChange(checked, attraction.placeId || '')}
                                            disabled={!attraction.placeId || loadingPlan} // Disable if no placeId or loading
                                            className="mt-1"
                                         />
                                         <Label
                                             htmlFor={`waypoint-${attraction.placeId}`}
                                             className={`text-xs text-muted-foreground cursor-pointer ${!attraction.placeId ? 'opacity-50' : ''}`}
                                         >
                                             <strong>{attraction.name}:</strong> {attraction.description}
                                             {attraction.rating && <span className="text-yellow-600 ml-1">({attraction.rating}★)</span>}
                                             {!attraction.placeId && <span className="text-destructive text-xs ml-1">(Cannot be added as stop)</span>}
                                         </Label>
                                     </div>
                                 ))}
                             </div>
                             {/* Button to Update Route is now the main submit button when waypoints > 0 */}
                         </div>
                     )}
                     {/* Reasoning Section */}
                     <div className="space-y-1 pt-2">
                         <p className="font-semibold flex items-center gap-2 text-sm"><BrainCircuit className="w-4 h-4 text-primary"/> AI Reasoning:</p>
                         <p className="text-xs text-muted-foreground bg-secondary p-2 rounded-md">{tripPlan.reasoning}</p>
                     </div>
                 </CardContent>
             </Card>
           </ScrollArea>
       )}
    </div>
  );
};
