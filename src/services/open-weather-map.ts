/**
 * Represents a geographical location with latitude and longitude coordinates.
 */
export interface Location {
  /**
   * The latitude of the location.
   */
  lat: number;
  /**
   * The longitude of the location.
   */
  lng: number;
}

/**
 * Represents weather forecast information, including temperature and conditions.
 */
export interface WeatherForecast {
  /**
   * The current temperature in Celsius.
   */
  currentTemperatureCelsius: number;
  /**
   * The weather conditions (e.g., Sunny, Cloudy, Rainy).
   */
  conditions: string;
  /**
   * The 5-day weather outlook, containing daily temperature and conditions.
   */
  fiveDayOutlook: { date: string; temperatureCelsius: number; conditions: string }[];
}

/**
 * Asynchronously retrieves weather forecast information for a given location.
 * Includes current weather and a 5-day outlook.
 *
 * @param location The location for which to retrieve weather data.
 * @returns A promise that resolves to a WeatherForecast object containing current temperature, conditions, and 5-day outlook.
 */
export async function getWeatherForecast(location: Location): Promise<WeatherForecast> {
  // TODO: Implement this by calling the OpenWeatherMap API.

  return {
    currentTemperatureCelsius: 23,
    conditions: 'Partly Cloudy',
    fiveDayOutlook: [
      { date: '2024-07-29', temperatureCelsius: 25, conditions: 'Sunny' },
      { date: '2024-07-30', temperatureCelsius: 27, conditions: 'Sunny' },
      { date: '2024-07-31', temperatureCelsius: 26, conditions: 'Cloudy' },
      { date: '2024-08-01', temperatureCelsius: 24, conditions: 'Rainy' },
      { date: '2024-08-02', temperatureCelsius: 23, conditions: 'Partly Cloudy' },
    ],
  };
}
