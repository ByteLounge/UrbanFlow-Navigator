
'use server';

/**
 * @fileOverview Generates an ideal trip plan based on weather, traffic predictions, and nearby attractions using addresses.
 *               Optionally includes waypoints (stops) in the route calculation.
 *
 * - generateTripPlan - A function that generates a trip plan.
 * - GenerateTripPlanInput - The input type for the generateTripPlan function.
 * - GenerateTripPlanOutput - The return type for the generateTripPlan function.
 */

import {ai} from '@/ai/ai-instance';
import {
  findShortestRoute,
  getCoordinatesFromAddress,
  findAttractionsNearRoute, // Use the updated service function
  type Coordinate,
  type Route,
  type Attraction,
} from '@/services/google-maps';
import {getWeatherForecast, type WeatherForecast} from '@/services/open-weather-map';
import {z} from 'genkit';

// Input schema updated to include optional waypoints
const GenerateTripPlanInputSchema = z.object({
  originAddress: z.string().describe('The starting address of the trip.'),
  destinationAddress: z.string().describe('The destination address of the trip.'),
  departureTime: z
    .string()
    .describe(
      'The desired departure time as an ISO 8601 string (e.g., 2024-08-03T10:00:00Z). The AI should suggest a departure time close to this, considering traffic and weather.'
    ),
  waypoints: z.array(z.string()) // Array of Google Place IDs
   .optional()
   .describe('Optional list of Google Place IDs for stops between origin and destination.'),
});
export type GenerateTripPlanInput = z.infer<typeof GenerateTripPlanInputSchema>;

// Output schema remains the same
const GenerateTripPlanOutputSchema = z.object({
  originAddress: z.string().describe('The starting address of the trip.'),
  destinationAddress: z.string().describe('The destination address of the trip.'),
  suggestedDepartureTime: z
    .string()
    .describe('The suggested departure time as an ISO 8601 string.'),
  route: z.object({
    path: z.array(z.object({lat: z.number(), lng: z.number()})).describe('The detailed route path as coordinates, including waypoints.'),
    distanceMeters: z.number().describe('The total route distance in meters.'),
    durationSeconds: z.number().describe('The total estimated route duration in seconds (including traffic and stops if available).'),
    bounds: z.object({ // Include bounds for map fitting
        northeast: z.object({lat: z.number(), lng: z.number()}),
        southwest: z.object({lat: z.number(), lng: z.number()}),
    }).describe('The bounding box containing the entire route.'),
    waypointsOrder: z.array(z.number()).optional().describe('The optimized order of waypoints as indices from the input `waypoints` array. Only present if waypoints were provided and optimization occurred.'),
  }).describe('The suggested route information'),
  weatherForecast: z.object({
    currentTemperatureCelsius: z.number().describe('The current temperature at the origin in Celsius.'),
    conditions: z.string().describe('The current weather conditions at the origin.'),
    fiveDayOutlook: z.array(z.object({
      date: z.string().describe('The date of the forecast.'),
      temperatureCelsius: z.number().describe('The temperature in Celsius.'),
      conditions: z.string().describe('The weather conditions.'),
    })).describe('The five day weather outlook at the origin.'),
  }).describe('The weather forecast information for the origin'),
  nearbyAttractions: z.array(z.object({
    name: z.string().describe('Name of the attraction.'),
    description: z.string().describe('Brief description of the attraction.'), // Keep description simple for AI
    location: z.object({ lat: z.number(), lng: z.number() }).describe('Coordinates of the attraction.'),
    placeId: z.string().optional().describe('Google Maps Place ID.'),
    rating: z.number().optional().describe('Google Maps Rating.'),
    types: z.array(z.string()).optional().describe('Types of the place (e.g., museum, park).'),
  })).describe('List of famous attractions found near the route.'),
  reasoning: z.string().describe('The AI reasoning for the suggested departure time and route, considering traffic (based on duration), weather, waypoints (if any), and mentioning specific attractions if they influence the plan or are notable points of interest.'),
});
export type GenerateTripPlanOutput = z.infer<typeof GenerateTripPlanOutputSchema>;

export async function generateTripPlan(input: GenerateTripPlanInput): Promise<GenerateTripPlanOutput> {
  return generateTripPlanFlow(input);
}

// Updated prompt input schema to mention waypoints
const generateTripPlanPrompt = ai.definePrompt({
  name: 'generateTripPlanPrompt',
  input: {
    schema: z.object({
      originAddress: z.string().describe('The starting address of the trip.'),
      destinationAddress: z.string().describe('The destination address of the trip.'),
      desiredDepartureTime: z.string().describe('The user\'s desired departure time (ISO 8601).'),
      routeInfo: z.object({
        distanceKm: z.number().describe('The route distance in kilometers.'),
        durationMinutes: z.number().describe('The estimated route duration in minutes (factors in typical traffic and waypoints).'),
        hasWaypoints: z.boolean().describe('Whether the route includes stops/waypoints.'), // Indicate if waypoints were included
      }).describe('Summary of the calculated route.'),
      weatherForecast: z.object({
        currentTemperatureCelsius: z.number().describe('Current temperature at the origin in Celsius.'),
        currentConditions: z.string().describe('Current weather conditions at the origin.'),
        outlookSummary: z.string().describe('Brief summary of the 5-day weather outlook (e.g., "Generally sunny for the next few days, potential rain later").'),
      }).describe('Summary of the weather forecast at the origin.'),
      attractions: z.array(z.object({ // Pass simplified attractions
        name: z.string().describe('Name of the attraction.'),
        type: z.string().optional().describe('Primary type of the attraction (e.g., Museum, Park).'), // Pass primary type if available
        rating: z.number().optional().describe('User rating (out of 5).')
      }))
      .optional() // Make attractions optional
      .describe('List of potential attractions near the route (name, type, rating). Optional field.'),
    }),
  },
  output: {
    schema: z.object({
      suggestedDepartureTime: z
        .string()
        .describe('The suggested optimal departure time as an ISO 8601 string, close to the desired time.'),
      reasoning: z.string().describe('Clear reasoning for the suggested departure time. Explain how traffic (inferred from duration vs. distance), weather conditions (current and outlook), waypoints (if included), and potentially interesting attractions influenced the decision. Mention specific weather concerns (like rain or snow) or highlight 1-2 highly-rated or relevant attractions as points of interest along the way, but don\'t suggest altering the route unless explicitly asked.'),
    }),
  },
  // Updated prompt to mention waypoints if present
  prompt: `You are an expert Trip Planner AI. Your task is to suggest the optimal departure time for a trip based on the provided information.

**Trip Details:**
*   **Origin:** {{{originAddress}}}
*   **Destination:** {{{destinationAddress}}}
*   **Desired Departure:** {{{desiredDepartureTime}}} (User's preferred time)

**Route & Conditions:**
*   **Route Summary:** Approximately {{{routeInfo.distanceKm}}} km, estimated travel time: {{{routeInfo.durationMinutes}}} minutes (this considers typical traffic{{#if routeInfo.hasWaypoints}} and includes planned stops{{/if}}).
*   **Weather at Origin:** Currently {{{weatherForecast.currentTemperatureCelsius}}}°C and {{{weatherForecast.currentConditions}}}. Outlook: {{{weatherForecast.outlookSummary}}}.

**Nearby Attractions:**
{{#if attractions}}
Here are some points of interest near the calculated route:
{{#each attractions}}
    *   {{{name}}} ({{#if type}}{{type}}{{else}}Attraction{{/if}}{{#if rating}}, Rating: {{rating}}★{{/if}})
{{/each}}
{{else}}
No specific major attractions were flagged directly along the route.
{{/if}}

**Your Goal:**
Recommend the *best departure time* (as an ISO 8601 string) that is close to the user's desired time.

**Reasoning Requirements:**
*   **Analyze Traffic:** Consider the estimated duration relative to the distance. A long duration for the distance implies potential traffic delays around the suggested time.
*   **Factor in Waypoints:** {{#if routeInfo.hasWaypoints}}Acknowledge that the duration includes stops. {{/if}}Consider if the departure time needs adjustment based on the number/nature of stops (though details of stops are not provided here).
*   **Evaluate Weather:** Factor in the current conditions and the forecast. Avoid suggesting departure during potentially hazardous weather (heavy rain, snow) if possible, or advise caution.
*   **Consider Attractions (Optional):** Briefly mention 1-2 highly-rated or relevant attractions listed above as points of interest the user might pass, especially if the trip is longer. Do *not* suggest detours unless the user explicitly asked for stops.
*   **Justify:** Clearly explain *why* the suggested departure time is optimal, linking it directly to traffic, waypoints (if any), weather, and any mentioned attractions. Be concise and actionable. Output only the suggested time and reasoning in the specified format.
`,
});

// Updated flow using actual API calls and refined data passing
const generateTripPlanFlow = ai.defineFlow<
  typeof GenerateTripPlanInputSchema,
  typeof GenerateTripPlanOutputSchema
>(
  {
    name: 'generateTripPlanFlow',
    inputSchema: GenerateTripPlanInputSchema,
    outputSchema: GenerateTripPlanOutputSchema,
  },
  async (input) => {
    console.log("Generating trip plan for input:", input);
    try {
      // 1. Geocode addresses to coordinates (still needed for start/end)
      // We don't need to geocode waypoint Place IDs, Directions API handles them
      const originCoord: Coordinate = await getCoordinatesFromAddress(input.originAddress);
      const destinationCoord: Coordinate = await getCoordinatesFromAddress(input.destinationAddress);
      console.log("Coordinates obtained:", { originCoord, destinationCoord });

      // 2. Fetch route using origin/destination and WAYPOINTS
      const waypointsParam = input.waypoints?.map(id => `place_id:${id}`) || [];
      const route: Route = await findShortestRoute(originCoord, destinationCoord, waypointsParam);
      console.log("Route obtained:", { distance: route.distanceMeters, duration: route.durationSeconds, waypoints: input.waypoints });

      // 3. Fetch weather forecast for the origin
      const weatherForecast: WeatherForecast = await getWeatherForecast(originCoord);
      console.log("Weather obtained:", weatherForecast.conditions);

      // 4. Find attractions near the route (using the route object which now includes bounds)
      // Consider if attractions should be skipped if waypoints are already selected? Maybe still show some.
      const nearbyAttractions: Attraction[] = await findAttractionsNearRoute(route);
      console.log(`Found ${nearbyAttractions.length} attractions.`);

      // 5. Prepare summarized data for the AI prompt
      const promptInput = {
        originAddress: input.originAddress,
        destinationAddress: input.destinationAddress,
        desiredDepartureTime: input.departureTime,
        routeInfo: {
          distanceKm: Math.round(route.distanceMeters / 1000),
          durationMinutes: Math.round(route.durationSeconds / 60),
          hasWaypoints: !!(input.waypoints && input.waypoints.length > 0), // Check if waypoints were provided
        },
        weatherForecast: {
          currentTemperatureCelsius: weatherForecast.currentTemperatureCelsius,
          currentConditions: weatherForecast.conditions,
          // Create a simple summary for the AI
          outlookSummary: weatherForecast.fiveDayOutlook
            .map(day => `${new Date(day.date).toLocaleDateString(undefined, { weekday: 'short' })}: ${day.conditions}`)
            .join(', ') || 'No outlook available.',
        },
        attractions: nearbyAttractions
         .filter(att => !input.waypoints?.includes(att.placeId || '')) // Filter out attractions already selected as waypoints
         .slice(0, 5) // Limit attractions sent to AI
         .map(att => ({
            name: att.name,
            type: att.types?.[0]?.replace(/_/g, ' '), // Get primary type, make readable
            rating: att.rating,
          })),
      };

      // 6. Call the AI prompt
      console.log("Calling AI prompt with:", promptInput);
      const { output } = await generateTripPlanPrompt(promptInput);

      if (!output?.suggestedDepartureTime || !output?.reasoning) {
          throw new Error("AI failed to generate a valid suggestion or reasoning.");
      }
      console.log("AI output:", output);


      // 7. Combine inputs, service results, and AI output into the final response
      return {
        originAddress: input.originAddress,
        destinationAddress: input.destinationAddress,
        suggestedDepartureTime: output.suggestedDepartureTime,
        reasoning: output.reasoning,
        route, // Include the full route object (with path, bounds, waypoint order etc.)
        weatherForecast, // Include the full weather forecast
        nearbyAttractions, // Include the full attractions list (including those selected as waypoints, but filtered from AI prompt)
      };
    } catch (error) {
        console.error("Error in generateTripPlanFlow:", error);
        // Re-throw the error to be caught by the calling component
        if (error instanceof Error) {
            throw new Error(`Trip plan generation failed: ${error.message}`);
        }
        throw new Error("An unknown error occurred during trip plan generation.");
    }
  }
);

    