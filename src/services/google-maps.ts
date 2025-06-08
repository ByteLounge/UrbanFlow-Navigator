
import { decode } from '@googlemaps/polyline-codec';

/**
 * Represents a geographical coordinate.
 */
export interface Coordinate {
  /**
   * The latitude of the coordinate.
   */
  lat: number;
  /**
   * The longitude of the coordinate.
   */
  lng: number;
}

/**
 * Represents a route with path, distance, duration, and waypoints.
 */
export interface Route {
  /**
   * An array of coordinates representing the path of the route.
   */
  path: Coordinate[];
  /**
   * The total distance of the route in meters.
   */
  distanceMeters: number;
  /**
   * The total duration of the route in seconds (typically considering traffic and stop time if available).
   */
  durationSeconds: number;
  /**
   * The bounding box containing the entire route, including waypoints.
   */
  bounds: {
    northeast: Coordinate;
    southwest: Coordinate;
  };
  /**
   * The order in which the waypoints are visited in the optimized route.
   * This is an array of indices corresponding to the input `waypoints` array.
   * Only present if waypoints were provided and optimization occurred.
   */
  waypointsOrder?: number[];
}

/**
 * Represents a point of interest or attraction.
 */
export interface Attraction {
    /**
     * The name of the attraction.
     */
    name: string;
    /**
     * A brief description of the attraction (might be derived or added by AI).
     */
    description: string;
    /**
     * The geographical coordinates of the attraction.
     */
    location: Coordinate;
    /**
     * Optional: Place ID from Google Maps. Crucial for adding as a waypoint.
     */
    placeId?: string;
     /**
     * Optional: Rating from Google Maps.
     */
    rating?: number;
    /**
     * Optional: Types of the place (e.g., "museum", "park").
     */
    types?: string[];
}

// Use the server-side key for backend services
// Ensure GOOGLE_MAPS_API_KEY is set in your .env.local file
const API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const GEOCODING_API_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
const DIRECTIONS_API_URL = 'https://maps.googleapis.com/maps/api/directions/json';
const PLACES_API_URL = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json';

// Centralized error message for missing server-side API key configuration.
// Make sure this exact message is checked in components handling errors from these services.
export const SERVER_CONFIG_ERROR_MSG = 'Server Configuration Error: Google Maps API key (GOOGLE_MAPS_API_KEY) is not configured. Please ensure it is correctly set in your `.env.local` file and that the server has been restarted.';

/**
 * Checks if the server-side API key is configured.
 * Throws a specific error if the key is missing.
 * @param apiName The name of the API being called (for logging).
 * @throws {Error} Throws SERVER_CONFIG_ERROR_MSG if the key is not found.
 */
function checkApiKey(apiName: string): void {
    if (!API_KEY) {
        console.error(`${apiName} API Error: ${SERVER_CONFIG_ERROR_MSG}`);
        throw new Error(SERVER_CONFIG_ERROR_MSG); // Throw the specific config error
    }
}

/**
 * Finds the shortest route between two geographical coordinates, optionally via waypoints,
 * using Google Maps Directions API.
 *
 * @param origin The starting coordinate.
 * @param destination The destination coordinate.
 * @param waypoints Optional array of waypoint strings. Must be Google Place IDs prefixed with `place_id:`.
 *                  The API will attempt to optimize the order if `optimize:true` is included.
 *                  E.g., `['place_id:ChIJ...', 'place_id:ChIJ...']`.
 * @returns A promise that resolves to a Route object containing the path, distance, duration, bounds, and waypoint order.
 * @throws {Error} If the API call fails, no route is found, or API key is missing/invalid. Specific error message `SERVER_CONFIG_ERROR_MSG` is thrown if the key is missing.
 */
export async function findShortestRoute(
    origin: Coordinate,
    destination: Coordinate,
    waypoints?: string[] // Expecting Place IDs like 'place_id:xxxx'
): Promise<Route> {
  checkApiKey('Directions'); // Check if the key is configured FIRST

  const paramsObj: Record<string, string> = {
      origin: `${origin.lat},${origin.lng}`,
      destination: `${destination.lat},${destination.lng}`,
      key: API_KEY!, // Key is guaranteed to exist due to checkApiKey
  };

  if (waypoints && waypoints.length > 0) {
    // Validate that waypoints are in the correct format (place_id:...)
    const validWaypoints = waypoints.filter(wp => typeof wp === 'string' && wp.startsWith('place_id:'));
    if (validWaypoints.length !== waypoints.length) {
        console.warn('[Google Maps Service] Some provided waypoints were not valid Place IDs (format: place_id:...). Only valid ones will be used.', waypoints);
    }

    if (validWaypoints.length > 0) {
        // Prefix with optimize:true| to let Google Maps optimize the waypoint order
        paramsObj.waypoints = `optimize:true|${validWaypoints.join('|')}`;
        console.log(`[Google Maps Service] Using valid waypoints: ${paramsObj.waypoints}`);
    } else {
         console.log(`[Google Maps Service] No valid waypoints provided or found.`);
    }
  }

  const params = new URLSearchParams(paramsObj);
  const url = `${DIRECTIONS_API_URL}?${params.toString()}`;
  // Log URL without the API key for security
  const loggedUrlParts = [`${DIRECTIONS_API_URL}?origin=${params.get('origin')}&destination=${params.get('destination')}`];
  if(params.has('waypoints')) loggedUrlParts.push(`&waypoints=${encodeURIComponent(params.get('waypoints') || '')}`);
  loggedUrlParts.push('&key=YOUR_API_KEY');
  const loggedUrl = loggedUrlParts.join('');
  console.log(`[Google Maps Service] Fetching directions: ${loggedUrl}`);

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK') {
        console.error(`[Google Maps Service] Directions API Error: Status=${data.status}, Message=${data.error_message || 'No error message provided.'}`);
        if (data.status === 'REQUEST_DENIED') {
             // More specific message if possible
             const reason = data.error_message || 'Check if the Directions API is enabled and authorized for your GOOGLE_MAPS_API_KEY.';
             throw new Error(`Directions API Error: Request Denied. ${reason}`);
        }
        if (data.status === 'ZERO_RESULTS' && waypoints && waypoints.length > 0) {
             throw new Error(`Directions API Error: No route found including the specified waypoints. Status: ${data.status}.`);
        }
        // Handle other common errors
        if (data.status === 'INVALID_REQUEST') {
             throw new Error(`Directions API Error: Invalid Request. ${data.error_message || 'Check origin, destination, and waypoint format.'}`);
        }
        if (data.status === 'MAX_WAYPOINTS_EXCEEDED') {
            throw new Error(`Directions API Error: Too many waypoints provided. ${data.error_message || ''}`);
        }
        if (data.status === 'OVER_QUERY_LIMIT') {
            throw new Error(`Directions API Error: Usage limit exceeded. ${data.error_message || 'Check your Google Cloud Console quotas.'}`);
        }
        // Generic fallback
        throw new Error(`Could not find route. Status: ${data.status}. ${data.error_message || ''}`);
    }

    if (!data.routes || data.routes.length === 0) {
      console.error('[Google Maps Service] Directions API Error: No routes found in response.');
      throw new Error('Could not find route. Status: ZERO_RESULTS.');
    }

    // Select the first route provided (usually the optimized one)
    const route = data.routes[0];

    if (!route.legs || !route.overview_polyline?.points || !route.bounds) {
        console.error('[Google Maps Service] Directions API Error: Response missing required fields (legs, overview_polyline, or bounds). Response:', JSON.stringify(data));
        throw new Error('Directions API response missing required fields.');
    }

    // Calculate total distance and duration by summing up all legs
    let totalDistanceMeters = 0;
    let totalDurationSeconds = 0;
    route.legs.forEach((leg: any) => {
        totalDistanceMeters += leg.distance?.value || 0;
        totalDurationSeconds += leg.duration?.value || 0; // duration_in_traffic might be more accurate if available
    });


    // Decode the overview polyline to get the path coordinates
    const decodedPath: Coordinate[] = decode(route.overview_polyline.points, 5).map(([lat, lng]) => ({ lat, lng }));

    // Waypoint order is provided if optimization occurred
    const waypointsOrder = route.waypoint_order; // Array of indices

    console.log(`[Google Maps Service] Directions found: Distance=${(totalDistanceMeters/1000).toFixed(1)} km, Duration=${Math.round(totalDurationSeconds/60)} min. Waypoint order: ${waypointsOrder ? waypointsOrder.join(', ') : 'N/A'}`);

    return {
      path: decodedPath,
      distanceMeters: totalDistanceMeters, // Use summed distance
      durationSeconds: totalDurationSeconds, // Use summed duration
      bounds: { // LatLngBoundsLiteral format for the entire route
        northeast: route.bounds.northeast, // { lat, lng }
        southwest: route.bounds.southwest, // { lat, lng }
      },
      waypointsOrder: waypointsOrder // Include the optimized order
    };
  } catch (error) {
    console.error('[Google Maps Service] Error fetching directions:', error);
    // Re-throw specific errors or a generic one
    if (error instanceof Error) {
        // Check if it's the configuration error FIRST
        if (error.message === SERVER_CONFIG_ERROR_MSG) {
            throw error;
        }
        // Check for specific API errors thrown above
        if (error.message.startsWith('Could not find route') || error.message.startsWith('Directions API Error:')) {
            throw error;
        }
        // Catch fetch errors (e.g., network issues)
        throw new Error(`Failed to fetch directions: ${error.message}`);
    }
    // Unknown error
    throw new Error('An unknown error occurred while fetching directions.');
  }
}

/**
 * Geocodes an address string into geographical coordinates using Google Maps Geocoding API.
 *
 * @param address The address string to geocode.
 * @returns A promise that resolves to a Coordinate object.
 * @throws {Error} If the address cannot be geocoded, the API call fails, or API key is missing/invalid. Specific error message `SERVER_CONFIG_ERROR_MSG` is thrown if the key is missing.
 */
export async function getCoordinatesFromAddress(address: string): Promise<Coordinate> {
    checkApiKey('Geocoding'); // Check if the key is configured FIRST

    const params = new URLSearchParams({
      address: address,
      key: API_KEY!, // Key is guaranteed to exist due to checkApiKey
    });

    const url = `${GEOCODING_API_URL}?${params.toString()}`;
    // Log URL without the API key
    const loggedUrl = `${GEOCODING_API_URL}?address=${encodeURIComponent(address)}&key=YOUR_API_KEY`;
    console.log(`[Google Maps Service] Geocoding address: "${address}" using URL: ${loggedUrl}`);

    try {
      const response = await fetch(url);
      const data = await response.json();

      if (data.status !== 'OK') {
        console.error(`[Google Maps Service] Geocoding API Error for address "${address}": Status=${data.status}, Message=${data.error_message || 'No error message provided.'}`);
        if (data.status === 'REQUEST_DENIED') {
            const reason = data.error_message || 'Check if the Geocoding API is enabled and authorized for your GOOGLE_MAPS_API_KEY.';
            throw new Error(`Geocoding API Error: Request Denied for address "${address}". ${reason}`);
        }
        if (data.status === 'ZERO_RESULTS') {
            throw new Error(`Geocoding API Error: No results found for address "${address}". Please ensure the address is valid.`);
        }
         if (data.status === 'OVER_QUERY_LIMIT') {
             throw new Error(`Geocoding API Error: Usage limit exceeded. ${data.error_message || 'Check your Google Cloud Console quotas.'}`);
         }
         // Generic fallback
         throw new Error(`Could not geocode address "${address}". Status: ${data.status}. ${data.error_message || ''}`);
      }

      if (!data.results || data.results.length === 0) {
        // This case should be caught by status ZERO_RESULTS, but added as a fallback
        console.error(`[Google Maps Service] Geocoding API Error: No results found for address "${address}".`);
        throw new Error(`Could not geocode address "${address}". Status: ZERO_RESULTS (unexpected).`);
      }

      const location = data.results[0].geometry.location; // { lat, lng }
      console.log(`[Google Maps Service] Geocoded "${address}" to:`, location);
      return location;

    } catch (error) {
      console.error(`[Google Maps Service] Error geocoding address "${address}":`, error);
       if (error instanceof Error) {
           // Check if it's the configuration error FIRST
            if (error.message === SERVER_CONFIG_ERROR_MSG) {
                throw error;
            }
            // Check for specific API errors thrown above
            if (error.message.startsWith('Could not geocode address') || error.message.startsWith('Geocoding API Error:')) {
                throw error;
            }
           // Catch fetch errors
           throw new Error(`Failed to geocode address: ${error.message}`);
       }
        // Unknown error
        throw new Error('An unknown error occurred during geocoding.');
    }
}

/**
 * Reverse geocodes geographical coordinates into a human-readable address string using Google Maps Geocoding API.
 *
 * @param coordinate The Coordinate object {lat, lng} to reverse geocode.
 * @returns A promise that resolves to the formatted address string.
 * @throws {Error} If the coordinates cannot be reverse geocoded, the API call fails, or API key is missing/invalid. Specific error message `SERVER_CONFIG_ERROR_MSG` is thrown if the key is missing.
 */
export async function getAddressFromCoordinates(coordinate: Coordinate): Promise<string> {
    // Check API key config FIRST
    checkApiKey('Reverse Geocoding');

    const params = new URLSearchParams({
        latlng: `${coordinate.lat},${coordinate.lng}`,
        key: API_KEY!, // Key is guaranteed to exist due to checkApiKey
        // Optionally specify result_type or location_type filters
        // result_type: 'street_address',
    });

    const url = `${GEOCODING_API_URL}?${params.toString()}`;
    const loggedUrl = `${GEOCODING_API_URL}?latlng=${coordinate.lat},${coordinate.lng}&key=YOUR_API_KEY`;
    console.log(`[Google Maps Service] Reverse geocoding coordinates: ${JSON.stringify(coordinate)} using URL: ${loggedUrl}`);

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.status !== 'OK') {
            console.error(`[Google Maps Service] Reverse Geocoding API Error for coords ${JSON.stringify(coordinate)}: Status=${data.status}, Message=${data.error_message || 'No error message provided.'}`);
            if (data.status === 'REQUEST_DENIED') {
                 const reason = data.error_message || 'Check if the Geocoding API is enabled and authorized for your GOOGLE_MAPS_API_KEY.';
                 throw new Error(`Reverse Geocoding API Error: Request Denied for coordinates ${JSON.stringify(coordinate)}. ${reason}`);
            }
            if (data.status === 'ZERO_RESULTS') {
                 throw new Error(`Reverse Geocoding API Error: No address found for coordinates ${JSON.stringify(coordinate)}.`);
            }
            if (data.status === 'OVER_QUERY_LIMIT') {
                throw new Error(`Reverse Geocoding API Error: Usage limit exceeded. ${data.error_message || 'Check your Google Cloud Console quotas.'}`);
            }
            // Generic fallback
             throw new Error(`Could not reverse geocode coordinates ${JSON.stringify(coordinate)}. Status: ${data.status}. ${data.error_message || ''}`);
        }

        if (!data.results || data.results.length === 0) {
            // Should be caught by ZERO_RESULTS status
            console.error(`[Google Maps Service] Reverse Geocoding API Error: No results found for coordinates ${JSON.stringify(coordinate)}.`);
             throw new Error(`Could not find address for coordinates ${JSON.stringify(coordinate)}. Status: ZERO_RESULTS (unexpected).`);
        }

        // Return the first (usually most specific) formatted address
        const formattedAddress = data.results[0].formatted_address;
        console.log(`[Google Maps Service] Reverse geocoded ${JSON.stringify(coordinate)} to: "${formattedAddress}"`);
        return formattedAddress;

    } catch (error) {
        console.error(`[Google Maps Service] Error reverse geocoding coordinates ${JSON.stringify(coordinate)}:`, error);
        if (error instanceof Error) {
            // Check for config error first
             if (error.message === SERVER_CONFIG_ERROR_MSG) {
                throw error;
            }
            // Check for specific API errors
            if (error.message.startsWith('Could not reverse geocode') || error.message.startsWith('Reverse Geocoding API Error:')) {
                throw error;
            }
            // Catch fetch errors
            throw new Error(`Failed to reverse geocode coordinates: ${error.message}`);
        }
         // Unknown error
         throw new Error('An unknown error occurred during reverse geocoding.');
    }
}


/**
 * Finds famous attractions near a given coordinate using Google Maps Places API (Nearby Search).
 * Searches for types like 'tourist_attraction', 'museum', 'park'.
 *
 * @param center The coordinate around which to search.
 * @param radius The search radius in meters (defaults to 15000m). Max 50000.
 * @returns A promise that resolves to an array of Attraction objects.
 * @throws {Error} If the API call fails or API key is missing/invalid. Specific error message `SERVER_CONFIG_ERROR_MSG` is thrown if the key is missing.
 */
export async function findAttractionsNearCoordinate(center: Coordinate, radius: number = 15000): Promise<Attraction[]> {
     checkApiKey('Places'); // Check if the key is configured FIRST

     // Define the types of places we're interested in
    // const types = 'tourist_attraction|museum|park|landmark|art_gallery'; // Pipe-separated list

    const params = new URLSearchParams({
        location: `${center.lat},${center.lng}`,
        radius: radius.toString(),
        // rankby: 'prominence', // Alternative to radius, prioritizes well-known places
        // type: types, // Specify multiple types - Using keyword search instead for broader results
        keyword: 'famous attraction point of interest landmark museum park', // Broad keywords
        key: API_KEY!, // Key is guaranteed to exist due to checkApiKey
    });

     const url = `${PLACES_API_URL}?${params.toString()}`;
    // Log URL without the API key
     const loggedUrlParts = [`${PLACES_API_URL}?location=${params.get('location')}&radius=${radius}&keyword=${encodeURIComponent(params.get('keyword') || '')}`];
     loggedUrlParts.push('&key=YOUR_API_KEY');
     const loggedUrl = loggedUrlParts.join('');
    console.log(`[Google Maps Service] Finding attractions near ${JSON.stringify(center)} (Radius: ${radius}m): ${loggedUrl}`);


    try {
        const response = await fetch(url);
        const data = await response.json();

         if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
            console.error(`[Google Maps Service] Places API Error near ${JSON.stringify(center)}: Status=${data.status}, Message=${data.error_message || 'No error message provided.'}`);
             if (data.status === 'REQUEST_DENIED') {
                  const reason = data.error_message || 'Check if the Places API is enabled and authorized for your GOOGLE_MAPS_API_KEY.';
                 throw new Error(`Places API Error: Request Denied. ${reason}`);
             }
             if (data.status === 'INVALID_REQUEST') {
                 throw new Error(`Places API Error: Invalid Request. ${data.error_message || 'Check search parameters.'}`);
             }
             if (data.status === 'OVER_QUERY_LIMIT') {
                 throw new Error(`Places API Error: Usage limit exceeded. ${data.error_message || 'Check your Google Cloud Console quotas.'}`);
             }
             // Generic fallback
            throw new Error(`Places API request failed. Status: ${data.status}. ${data.error_message || ''}`);
        }

        if (data.status === 'ZERO_RESULTS' || !data.results) {
            console.log(`[Google Maps Service] No attractions found near ${JSON.stringify(center)} within ${radius}m.`);
            return [];
        }

        // Map the results to our Attraction interface
        const attractions: Attraction[] = data.results
            // Optional: Filter further, e.g., require a certain rating or specific types
            .filter((place: any) => place.rating && place.rating >= 3.5 && place.business_status === 'OPERATIONAL') // Filter for reasonably rated and operational places
            .slice(0, 15) // Limit the number of results slightly more
            .map((place: any) => ({
                name: place.name,
                // Use vicinity or types as description fallback
                description: place.vicinity || place.types?.filter((t: string) => t !== 'point_of_interest' && t !== 'establishment').join(', ').replace(/_/g, ' ') || 'Notable place',
                location: place.geometry.location, // { lat, lng }
                placeId: place.place_id, // Ensure place_id is included
                rating: place.rating,
                types: place.types,
            }));

        console.log(`[Google Maps Service] Found ${attractions.length} attractions near ${JSON.stringify(center)}.`);
        return attractions;

    } catch (error) {
        console.error(`[Google Maps Service] Error finding attractions near ${JSON.stringify(center)}:`, error);
        if (error instanceof Error) {
            // Check config error first
             if (error.message === SERVER_CONFIG_ERROR_MSG) {
                throw error;
             }
             // Check specific API errors
             if (error.message.startsWith('Places API Error:')) {
                 throw error;
             }
            // Catch fetch errors
             throw new Error(`Failed to find attractions: ${error.message}`);
         }
        // Unknown error
        throw new Error('An unknown error occurred while finding attractions.');
    }
}


/**
 * Finds famous attractions along a route.
 * This implementation simplifies by searching near the midpoint of the route's bounding box.
 * A more robust implementation would search at multiple points along the route.
 *
 * @param route The route object containing path and bounds.
 * @returns A promise that resolves to an array of Attraction objects found near the route.
 * @throws {Error} If the underlying API call fails or API key is missing/invalid. Specific error message `SERVER_CONFIG_ERROR_MSG` is thrown if the key is missing.
 */
export async function findAttractionsNearRoute(route: Route): Promise<Attraction[]> {
    console.log(`[Google Maps Service] Finding attractions near route...`);

    if (!route.bounds) {
        console.warn("[Google Maps Service] Route bounds are missing, cannot reliably find attractions near route.");
        // Fallback: Use the middle point of the path if bounds are missing
        if (route.path.length > 0) {
             const midPointIndex = Math.floor(route.path.length / 2);
             const midPoint = route.path[midPointIndex];
             console.log("[Google Maps Service] Using route midpoint as fallback search center:", midPoint);
             // Use a default radius if bounds are missing
             // Propagate errors from findAttractionsNearCoordinate
             try {
                return await findAttractionsNearCoordinate(midPoint, 20000); // Search within 20km of the midpoint
             } catch (error) {
                console.error("[Google Maps Service] Error finding attractions near route midpoint:", error);
                if (error instanceof Error && error.message === SERVER_CONFIG_ERROR_MSG) {
                     throw error; // Propagate config error specifically
                }
                // Log other errors but return empty array to allow trip planning to continue maybe?
                // Or rethrow a generic error
                console.warn("[Google Maps Service] Continuing trip plan despite error finding attractions near midpoint.");
                return []; // Return empty array instead of throwing for non-config errors
             }
        } else {
            console.warn("[Google Maps Service] Cannot search for attractions without route path or bounds.");
            return []; // Cannot search without path or bounds
        }
    }

    // Calculate the center of the bounding box
    const centerLat = (route.bounds.northeast.lat + route.bounds.southwest.lat) / 2;
    const centerLng = (route.bounds.northeast.lng + route.bounds.southwest.lng) / 2;
    const centerCoord: Coordinate = { lat: centerLat, lng: centerLng };

    // Calculate a search radius based on the diagonal of the bounding box (rough estimate)
    // Using Haversine formula for better distance calculation
    const R = 6371e3; // Earth radius in meters
    const phi1 = route.bounds.southwest.lat * Math.PI / 180;
    const phi2 = route.bounds.northeast.lat * Math.PI / 180;
    const deltaPhi = (route.bounds.northeast.lat - route.bounds.southwest.lat) * Math.PI / 180;
    const deltaLambda = (route.bounds.northeast.lng - route.bounds.southwest.lng) * Math.PI / 180;

    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const diagonalDistance = R * c; // Distance in meters

    // Use half the diagonal as radius, clamped between 5km and 50km (API limit)
    // Increase the minimum radius slightly for better coverage on longer routes
    const radius = Math.min(Math.max(diagonalDistance / 1.8, 10000), 50000); // Min 10km, Max 50km

    console.log(`[Google Maps Service] Calculated search center: ${JSON.stringify(centerCoord)}, Radius: ${Math.round(radius)}m (based on route bounds)`);

    // Perform a nearby search around the center of the route's bounds
    // Propagate errors from findAttractionsNearCoordinate
    try {
         return await findAttractionsNearCoordinate(centerCoord, Math.round(radius));
    } catch (error) {
        console.error("[Google Maps Service] Error finding attractions near route bounds center:", error);
        if (error instanceof Error && error.message === SERVER_CONFIG_ERROR_MSG) {
            throw error; // Propagate config error specifically
        }
        // Log other errors but maybe return empty array
        console.warn("[Google Maps Service] Continuing trip plan despite error finding attractions near route bounds center.");
        return []; // Return empty array instead of throwing for non-config errors
    }

    // --- Alternative / More Advanced Approach (Not implemented here) ---
    // 1. Segment the route path into several points (e.g., every 10-20km).
    // 2. Perform a Nearby Search around each point with a smaller radius.
    // 3. Collect results, deduplicate based on place_id.
    // 4. Optionally rank/filter results based on proximity to the actual route line.
    // This is more complex but gives better coverage along the entire route.
}

