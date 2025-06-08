
"use client";

import type { FC } from 'react';
import { Map, AdvancedMarker, Pin, useMap, InfoWindow } from '@vis.gl/react-google-maps';
import type { Coordinate, Route, Attraction } from '@/services/google-maps';
import { useEffect, useState, useRef } from 'react';
import { Landmark, Star, LocateFixed, Navigation, MapPin as WaypointIcon, MapPin } from 'lucide-react'; // Added LocateFixed, Navigation, WaypointIcon, MapPin

interface MapComponentProps {
  initialCenter: Coordinate;
  route?: Route | null; // Optional: To display the route
  attractions?: Attraction[] | null; // Optional: To display attractions
  zoom?: number;
  isNavigating: boolean; // To track navigation status
}

export const MapComponent: FC<MapComponentProps> = ({
  initialCenter,
  route,
  attractions,
  zoom = 12,
  isNavigating,
}) => {
  const map = useMap();
  const [selectedAttraction, setSelectedAttraction] = useState<Attraction | null>(null);
  const polylineRef = useRef<google.maps.Polyline | null>(null); // Ref to hold the polyline instance
  const [currentLocation, setCurrentLocation] = useState<Coordinate | null>(null);
  const [geolocationError, setGeolocationError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null); // Ref to store watchPosition ID

  // --- Helper to identify which attractions are waypoints based on route.waypointsOrder ---
  const getWaypointAttractions = (route: Route | null | undefined, attractions: Attraction[] | null | undefined): Attraction[] => {
      if (!route?.waypointsOrder || !attractions) {
          return [];
      }
      // Note: route.waypointsOrder contains the *original* indices of the waypoints passed to the API.
      // We need the Place IDs from the *original* input. This requires modification in the parent component
      // or the AI flow to associate the optimized order with the actual Place IDs.
      // For now, assuming the `attractions` prop *includes* the waypoints, we can filter by placeId.
      // This is a limitation - ideally, the flow passes back the selected waypoints' details.
      // Let's refine this: We assume the route object might contain the waypoint place IDs used.
      // This needs adjustment in `generate-trip-plan.ts` and `google-maps.ts` potentially.
      // **Temporary Simplification**: We'll assume waypoints are marked within the main `attractions` list for now.
      // A better approach is needed.
      // Filter attractions whose placeId might be in a hypothetical route.waypointPlaceIds array (needs adding)
      // return attractions.filter(att => route.waypointPlaceIds?.includes(att.placeId || ''));

      // **Revised Temporary Logic**: Look for attractions included in the route that ARE NOT origin or destination.
      // This is fragile. We really need the waypoints passed back explicitly.
      const waypointPlaceIds = new Set<string>(); // Need a way to get the actual Place IDs used as waypoints

      // **Let's assume for now the full attractions list is passed and we can mark them**
      // This requires the parent component to know which attractions were selected as waypoints.
      // This component doesn't have that info directly.
      // TODO: Refactor parent/flow to pass waypoint details or IDs explicitly with the route.

      // --- **Placeholder/Illustrative Logic (Needs Real Data)** ---
      // Example: If tripPlan included selectedWaypointIds:
      // const selectedWaypointIds = new Set(tripPlan?.selectedWaypointIds || []);
      // return attractions?.filter(att => att.placeId && selectedWaypointIds.has(att.placeId)) || [];
       return []; // Placeholder - needs proper waypoint data
  };

  const waypoints = getWaypointAttractions(route, attractions);
  // --- End Helper ---

  // Effect to handle Geolocation updates when navigating
  useEffect(() => {
    if (!map) return;

    if (isNavigating) {
      setGeolocationError(null); // Clear previous errors
      console.log("[MapComponent] Starting geolocation watch...");

      if (!navigator.geolocation) {
          console.error("[MapComponent] Geolocation is not supported by this browser.");
          setGeolocationError("Geolocation is not supported by your browser.");
          return;
      }

      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const newLocation: Coordinate = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          console.log("[MapComponent] New location received:", newLocation);
          setCurrentLocation(newLocation);
          // Pan map to current location smoothly
          map.panTo(newLocation);
          if (map.getZoom() < 15) { // Zoom in if map is too zoomed out
            map.setZoom(15);
          }
        },
        (error) => {
          console.error("[MapComponent] Geolocation Error:", error.message);
           switch (error.code) {
                case error.PERMISSION_DENIED:
                    setGeolocationError("Location permission denied. Please enable it in your browser settings.");
                    break;
                case error.POSITION_UNAVAILABLE:
                    setGeolocationError("Location information is unavailable.");
                    break;
                case error.TIMEOUT:
                    setGeolocationError("The request to get user location timed out.");
                    break;
                default:
                     setGeolocationError(`An unknown error occurred (${error.message}).`);
                     break;
            }
          setCurrentLocation(null); // Clear location on error
           // Stop watching if permission denied or unavailable
           if (watchIdRef.current && (error.code === error.PERMISSION_DENIED || error.code === error.POSITION_UNAVAILABLE)) {
                navigator.geolocation.clearWatch(watchIdRef.current);
                watchIdRef.current = null;
           }
        },
        {
          enableHighAccuracy: true, // Request high accuracy
          maximumAge: 10000,      // Use cached position if younger than 10 seconds
          timeout: 15000          // Give up after 15 seconds
        }
      );

      // Cleanup function for when isNavigating turns false or component unmounts
      return () => {
        if (watchIdRef.current !== null) {
          console.log("[MapComponent] Stopping geolocation watch...");
          navigator.geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = null;
          setCurrentLocation(null); // Clear location when stopping navigation
        }
      };
    } else {
       // Ensure watch is cleared if isNavigating becomes false while watch is active
       if (watchIdRef.current !== null) {
          console.log("[MapComponent] Stopping geolocation watch (isNavigating became false)...");
          navigator.geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = null;
       }
       setCurrentLocation(null); // Clear location when not navigating
       setGeolocationError(null); // Clear errors when not navigating
    }
  }, [isNavigating, map]); // Rerun effect when isNavigating or map instance changes

  // Effect to draw/update the route Polyline and adjust map bounds
  useEffect(() => {
    if (!map) return;

    // --- Polyline Handling ---
    // Clear previous polyline
    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
       console.log("[MapComponent] Cleared previous route polyline.");
    }
    // Draw new polyline if route path exists
    if (route?.path && route.path.length > 0) {
       console.log(`[MapComponent] Drawing route polyline with ${route.path.length} points.`);
      const newPolyline = new google.maps.Polyline({
        path: route.path,
        strokeColor: 'hsl(var(--primary))', // Use primary theme color
        strokeOpacity: 0.8,
        strokeWeight: 6, // Slightly thicker
        geodesic: true,
        zIndex: 1, // Ensure polyline is below markers
      });
      newPolyline.setMap(map);
      polylineRef.current = newPolyline;
    } else {
        console.log("[MapComponent] No route path to draw.");
    }

    // --- Map Bounds/Center Handling ---
    // Don't adjust bounds if actively navigating, let geolocation handle panning
    if (!isNavigating) {
        if (route?.bounds) {
            try {
                const { northeast, southwest } = route.bounds;
                 // Validate bounds coordinates
                if (isValidCoordinate(northeast) && isValidCoordinate(southwest)) {
                    const bounds = new google.maps.LatLngBounds(
                        new google.maps.LatLng(southwest.lat, southwest.lng),
                        new google.maps.LatLng(northeast.lat, northeast.lng)
                    );
                    // Add padding to the bounds fit
                    console.log("[MapComponent] Fitting map to route bounds:", bounds.toJSON());
                    map.fitBounds(bounds, 100); // 100px padding
                } else {
                     console.warn("[MapComponent] Invalid route bounds received:", route.bounds);
                     // Fallback if bounds are invalid but path exists
                     if (route.path && route.path.length > 0 && isValidCoordinate(route.path[0])) {
                        map.setCenter(route.path[0]);
                        map.setZoom(zoom);
                     } else {
                        map.setCenter(initialCenter);
                        map.setZoom(zoom);
                     }
                }
            } catch (error) {
                console.error("[MapComponent] Error fitting bounds:", error);
                 // Fallback in case of error during bounds fitting
                 if (route.path && route.path.length > 0 && isValidCoordinate(route.path[0])) {
                     map.setCenter(route.path[0]);
                     map.setZoom(zoom);
                 } else {
                    map.setCenter(initialCenter);
                    map.setZoom(zoom);
                 }
            }
        } else if (route?.path && route.path.length > 0) {
            // Fallback if bounds are missing but path exists: center on origin
             if(isValidCoordinate(route.path[0])) {
                console.log("[MapComponent] Centering on route origin (no bounds):", route.path[0]);
                map.setCenter(route.path[0]);
                map.setZoom(14); // Zoom a bit closer than default
             } else {
                 console.warn("[MapComponent] Invalid route path start coordinate.");
                 map.setCenter(initialCenter);
                 map.setZoom(zoom);
             }
        } else {
            // If no route, center on initial location with default zoom
             if(isValidCoordinate(initialCenter)){
                console.log("[MapComponent] Centering on initial location:", initialCenter);
                map.setCenter(initialCenter);
                map.setZoom(zoom);
             } else {
                 console.error("[MapComponent] Invalid initialCenter coordinate.");
                 // Maybe set a default valid coordinate like { lat: 0, lng: 0 }?
             }
        }
    } else if (currentLocation) {
        // If navigating and have current location, pan there (already handled by watchPosition)
        // map.panTo(currentLocation); // Pan is handled in watchPosition
    } else if (route?.path?.[0] && isValidCoordinate(route.path[0])) {
        // If navigating but no current location yet, center on route start
        map.setCenter(route.path[0]);
        map.setZoom(15); // Start reasonably zoomed in
    } else if (isValidCoordinate(initialCenter)) {
         // Fallback if navigating but no route/location: use initial center
         map.setCenter(initialCenter);
         map.setZoom(zoom);
    }


    // Cleanup function specifically for the polyline when route changes or component unmounts
    // This is crucial to prevent multiple polylines from stacking on route updates.
    return () => {
      if (polylineRef.current) {
        polylineRef.current.setMap(null);
        polylineRef.current = null;
         console.log("[MapComponent] Cleaned up route polyline.");
      }
    };
  // IMPORTANT: Include initialCenter and zoom in dependency array if they can change and should trigger a re-center/re-zoom when not navigating.
  }, [map, route, isNavigating, initialCenter, zoom]); // Added initialCenter and zoom


   // Coordinate validation helper
   const isValidCoordinate = (coord: Coordinate | undefined | null): coord is Coordinate => {
       return coord != null && typeof coord.lat === 'number' && typeof coord.lng === 'number' && !isNaN(coord.lat) && !isNaN(coord.lng);
   };

  const handleMarkerClick = (attraction: Attraction) => {
     if (!isValidCoordinate(attraction.location)) {
         console.warn("[MapComponent] Clicked attraction has invalid location:", attraction);
         return;
     }
     setSelectedAttraction(attraction);
     if (map) {
         map.panTo(attraction.location); // Pan to the attraction when its marker is clicked
         if (map.getZoom() < 14) map.setZoom(14); // Zoom in if necessary
     }
  };

  const handleInfoWindowClose = () => {
     setSelectedAttraction(null);
  };


  return (
    <div style={{ height: '100%', width: '100%' }} className="relative">
      {/* Display Geolocation Error Message */}
      {geolocationError && (
           <div className="absolute top-2 left-1/2 transform -translate-x-1/2 z-50 bg-destructive/90 text-destructive-foreground text-xs font-medium px-3 py-1.5 rounded-md shadow-lg">
              {geolocationError}
           </div>
      )}
      <Map
        mapId={'urbanflow-map'}
        // Initial center/zoom are handled by the effect
        gestureHandling={'greedy'}
        disableDefaultUI={true}
        style={{ borderRadius: 'inherit' }}
        // Optional: Add map options like min/max zoom
        // minZoom={3}
        // maxZoom={20}
      >
        {/* Marker for the Current Location (if navigating) */}
        {isNavigating && currentLocation && isValidCoordinate(currentLocation) && (
            <AdvancedMarker position={currentLocation} title="Your Location" zIndex={10}>
                 {/* Simple blue dot for current location */}
                 <div className="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-md flex items-center justify-center animate-pulse">
                    {/* Inner dot for visual center */}
                     <div className="w-2 h-2 bg-white rounded-full"></div>
                 </div>
            </AdvancedMarker>
        )}

        {/* Marker for the origin */}
        {route?.path?.[0] && isValidCoordinate(route.path[0]) && (
            <AdvancedMarker position={route.path[0]} title="Origin" zIndex={5}>
                <Pin background={'hsl(var(--primary))'} glyphColor={'#fff'} borderColor={'#fff'} >
                   {/* Using Navigation icon for origin */}
                   <Navigation size={16} transform='rotate(-45)'/>
                </Pin>
            </AdvancedMarker>
        )}

         {/* Marker for the destination */}
        {route?.path && route.path.length > 1 && isValidCoordinate(route.path[route.path.length - 1]) && (
            <AdvancedMarker position={route.path[route.path.length - 1]} title="Destination" zIndex={5}>
                <Pin background={'hsl(var(--accent))'} glyphColor={'#fff'} borderColor={'#fff'} >
                   {/* Using MapPin for destination */}
                   <MapPin size={16}/>
                </Pin>
            </AdvancedMarker>
        )}

         {/* Markers for Waypoints (Needs real data) */}
         {/* TODO: Pass actual waypoints here */}
         {waypoints.map((waypoint, index) => (
             isValidCoordinate(waypoint.location) && (
                 <AdvancedMarker
                    key={`waypoint-${waypoint.placeId || index}`}
                    position={waypoint.location}
                    title={`Stop ${index + 1}: ${waypoint.name}`}
                    zIndex={7} // Above origin/destination, below current location
                 >
                    <Pin background={'hsl(var(--secondary))'} glyphColor={'hsl(var(--secondary-foreground))'} borderColor={'hsl(var(--secondary-foreground))'} scale={0.9}>
                        {/* Display index+1 for waypoint number */}
                        <span className="text-xs font-bold">{index + 1}</span>
                    </Pin>
                 </AdvancedMarker>
             )
         ))}


        {/* Display Markers for other attractions (not waypoints) */}
        {attractions?.filter(att => !waypoints.some(wp => wp.placeId === att.placeId)) // Exclude waypoints
            .map((attraction, index) => (
           isValidCoordinate(attraction.location) && (
               <AdvancedMarker
                    key={attraction.placeId || `attraction-${index}`}
                    position={attraction.location}
                    title={attraction.name}
                    onClick={() => handleMarkerClick(attraction)} // Open info window on click
                    zIndex={3} // Lower zIndex for non-waypoint attractions
               >
                   <Pin background={'hsl(var(--muted))'} glyphColor={'hsl(var(--primary))'} borderColor={'hsl(var(--primary))'} scale={0.8}>
                      <Landmark size={16} />
                   </Pin>
               </AdvancedMarker>
           )
        ))}

        {/* InfoWindow for selected attraction */}
        {selectedAttraction?.location && isValidCoordinate(selectedAttraction.location) && (
             <InfoWindow
                position={selectedAttraction.location}
                onCloseClick={handleInfoWindowClose}
                pixelOffset={new google.maps.Size(0, -30)} // Adjust offset based on pin size
                maxWidth={250} // Limit width
             >
                <div className="p-1 text-sm font-sans">
                  <h4 className="font-semibold text-base mb-1 text-foreground">{selectedAttraction.name}</h4>
                  <p className="text-muted-foreground mb-1 text-xs leading-tight">{selectedAttraction.description}</p>
                  {selectedAttraction.rating && (
                     <div className="flex items-center gap-1 text-xs mt-1">
                         <Star className="w-3 h-3 fill-yellow-400 text-yellow-500" />
                         <span className="font-medium">{selectedAttraction.rating}</span>
                         {selectedAttraction.types && <span className="text-muted-foreground/80 ml-1">({selectedAttraction.types?.[0]?.replace(/_/g, ' ')})</span>}
                     </div>
                  )}
                 </div>
             </InfoWindow>
        )}

      </Map>
    </div>
  );
};
