
"use client";

import type { FC } from 'react';
import { useState, useEffect, useCallback } from 'react';
import { getWeatherForecast, type WeatherForecast, type Location } from '@/services/open-weather-map';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Sun, Cloud, CloudRain, CloudSnow, Thermometer, Calendar, RefreshCcw, Loader2 } from 'lucide-react'; // Added RefreshCcw, Loader2
import { format } from 'date-fns';
import { Button } from '@/components/ui/button'; // Import Button
import { useToast } from "@/hooks/use-toast"; // Import useToast

interface WeatherDisplayProps {
  initialLocation: Location;
}

const WeatherIcon: FC<{ conditions: string }> = ({ conditions }) => {
  const lowerCaseConditions = conditions.toLowerCase();
  if (lowerCaseConditions.includes('clear') || lowerCaseConditions.includes('sunny')) {
    return <Sun className="w-6 h-6 text-yellow-500" />;
  }
  if (lowerCaseConditions.includes('cloud')) {
    return <Cloud className="w-6 h-6 text-gray-400" />;
  }
  if (lowerCaseConditions.includes('rain') || lowerCaseConditions.includes('drizzle')) {
    return <CloudRain className="w-6 h-6 text-blue-500" />;
  }
    if (lowerCaseConditions.includes('snow')) {
    return <CloudSnow className="w-6 h-6 text-blue-300" />;
  }
  return <Sun className="w-6 h-6 text-yellow-500" />; // Default icon
};


export const WeatherDisplay: FC<WeatherDisplayProps> = ({ initialLocation }) => {
  const [weatherData, setWeatherData] = useState<WeatherForecast | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast(); // Initialize toast

  const fetchWeather = useCallback(async (showToast = false) => {
    setLoading(true);
    setError(null);
    console.log("[WeatherDisplay] Fetching weather data...");
    try {
      const data = await getWeatherForecast(initialLocation);
      setWeatherData(data);
      if (showToast) {
        toast({
          title: "Weather Updated",
          description: `Current conditions: ${data.currentTemperatureCelsius}°C, ${data.conditions}`,
        });
      }
    } catch (err) {
      console.error("[WeatherDisplay] Failed to fetch weather data:", err);
      const errorMessage = err instanceof Error ? err.message : "Could not fetch weather forecast.";
      setError(`Could not fetch weather forecast. ${errorMessage === 'OpenWeatherMap API Error: Invalid API key. Please check your OPENWEATHERMAP_API_KEY.' ? 'Check your API key configuration.' : 'Please try again later.'}`);
       if (showToast) {
           toast({
                variant: "destructive",
                title: "Weather Update Failed",
                description: error || "Could not fetch weather forecast.",
           });
       }
    } finally {
      setLoading(false);
      console.log("[WeatherDisplay] Finished fetching weather data.");
    }
  }, [initialLocation, toast, error]); // Include error in dependencies? Maybe not needed.

  useEffect(() => {
    fetchWeather(); // Fetch on initial load
    // No need to return cleanup unless initialLocation changes often,
    // which it probably doesn't in this component's lifecycle.
  }, [fetchWeather]); // Depend on the memoized fetchWeather

  const handleRefresh = () => {
    fetchWeather(true); // Fetch again and show toast on completion/error
  };

  return (
    <div className="space-y-4">
      {/* Header with Refresh Button */}
      <div className="flex justify-between items-center mb-2">
         {/* The CardHeader usually contains the title, keep it in the parent component */}
         {/* <h3 className="text-md font-semibold text-foreground/80">Current Weather</h3> */}
         <Button
             variant="ghost"
             size="icon"
             onClick={handleRefresh}
             disabled={loading}
             className="text-muted-foreground hover:text-primary h-7 w-7"
             aria-label="Refresh Weather"
             title="Refresh Weather"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
         </Button>
       </div>

      {/* Loading Skeleton */}
      {loading && !weatherData && ( // Show skeleton only on initial load
        <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <div className="grid grid-cols-5 gap-2 pt-4">
                {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex flex-col items-center space-y-1">
                        <Skeleton className="h-4 w-10" />
                        <Skeleton className="h-6 w-6 rounded-full" />
                        <Skeleton className="h-4 w-8" />
                    </div>
                ))}
            </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
         <Alert variant="destructive">
           <AlertTitle>Error</AlertTitle>
           <AlertDescription>{error}</AlertDescription>
         </Alert>
      )}

      {/* Weather Data Display */}
      {weatherData && (
          <>
              {/* Current Weather */}
              <div className="flex items-center justify-between p-4 bg-secondary rounded-lg relative">
                  {loading && <div className="absolute inset-0 bg-background/30 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary"/></div>}
                  <div>
                      <p className="text-lg font-semibold">Current Weather</p>
                      <p className="text-3xl font-bold">{weatherData.currentTemperatureCelsius}°C</p>
                      <p className="text-muted-foreground">{weatherData.conditions}</p>
                  </div>
                  <WeatherIcon conditions={weatherData.conditions} />
              </div>

              {/* 5-Day Forecast */}
              <div>
                  <h3 className="text-md font-semibold mb-2 text-foreground/80">5-Day Outlook</h3>
                  <div className="grid grid-cols-5 gap-2 text-center">
                      {weatherData.fiveDayOutlook.map((day, index) => (
                          <Card key={index} className="p-2 bg-secondary/50 shadow-sm rounded-md">
                              <CardContent className="p-0 flex flex-col items-center space-y-1">
                                  <p className="text-xs font-medium text-muted-foreground">{format(new Date(day.date), 'EEE')}</p>
                                  <WeatherIcon conditions={day.conditions} />
                                  <p className="text-sm font-semibold">{day.temperatureCelsius}°C</p>
                              </CardContent>
                          </Card>
                      ))}
                  </div>
              </div>
          </>
      )}

       {/* Show "No data" only if not loading, no error, and no data */}
       {!loading && !error && !weatherData && (
            <p className="text-muted-foreground text-center py-4">No weather data available.</p>
       )}
    </div>
  );
};
