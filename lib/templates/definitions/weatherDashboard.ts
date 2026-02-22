import { Template } from '../schema';

export const weatherDashboardTemplate: Template = {
  id: 'weather-dashboard',
  name: 'Weather Dashboard',
  description: 'Real-time weather app with city search and forecasts',
  category: 'dashboard',
  thumbnail: '🌤️',
  tags: ['weather', 'api', 'dashboard', 'search'],
  framework: 'vite',
  startCommand: 'npm run dev',
  dependencies: {
    'react': '^18.3.1',
    'react-dom': '^18.3.1',
    'lucide-react': '^0.344.0',
  },
  files: {
    'package.json': JSON.stringify({
      name: 'weather-dashboard',
      private: true,
      version: '0.0.0',
      type: 'module',
      scripts: {
        dev: 'vite',
        build: 'vite build',
        preview: 'vite preview',
      },
      dependencies: {
        react: '^18.3.1',
        'react-dom': '^18.3.1',
        'lucide-react': '^0.344.0',
      },
      devDependencies: {
        '@types/react': '^18.3.12',
        '@types/react-dom': '^18.3.1',
        '@vitejs/plugin-react': '^4.3.4',
        vite: '^5.4.11',
      },
    }, null, 2),

    'index.html': `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Weather Dashboard</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>`,

    'vite.config.js': `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});`,

    'src/main.jsx': `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`,

    'src/App.jsx': `import { useState, useEffect } from 'react';
import { Cloud, Sun, CloudRain, Wind, Droplets, Eye, Gauge, Search } from 'lucide-react';
import './App.css';

// Using Open-Meteo free API (no API key required)
const GEOCODING_API = 'https://geocoding-api.open-meteo.com/v1/search';
const WEATHER_API = 'https://api.open-meteo.com/v1/forecast';

function App() {
  const [city, setCity] = useState('');
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Load default city (London)
    fetchWeather('London');
  }, []);

  const fetchWeather = async (cityName) => {
    setLoading(true);
    setError('');
    try {
      // Get coordinates
      const geoRes = await fetch(\`\${GEOCODING_API}?name=\${encodeURIComponent(cityName)}&count=1\`);
      const geoData = await geoRes.json();

      if (!geoData.results || geoData.results.length === 0) {
        throw new Error('City not found');
      }

      const { latitude, longitude, name, country } = geoData.results[0];

      // Get weather
      const weatherRes = await fetch(
        \`\${WEATHER_API}?latitude=\${latitude}&longitude=\${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,pressure_msl,visibility&timezone=auto\`
      );
      const weatherData = await weatherRes.json();

      setWeather({
        city: \`\${name}, \${country}\`,
        ...weatherData.current,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (city.trim()) {
      fetchWeather(city);
    }
  };

  const getWeatherIcon = (code) => {
    if (code === 0 || code === 1) return <Sun size={64} />;
    if (code <= 3) return <Cloud size={64} />;
    return <CloudRain size={64} />;
  };

  const getWeatherDescription = (code) => {
    if (code === 0) return 'Clear sky';
    if (code === 1) return 'Mainly clear';
    if (code === 2) return 'Partly cloudy';
    if (code === 3) return 'Overcast';
    if (code >= 51 && code <= 67) return 'Rainy';
    return 'Cloudy';
  };

  return (
    <div className="app">
      <div className="container">
        <header>
          <h1>Weather Dashboard</h1>
          <form onSubmit={handleSearch} className="search-form">
            <input
              type="text"
              placeholder="Search city..."
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
            <button type="submit">
              <Search size={20} />
            </button>
          </form>
        </header>

        {loading && <div className="loading">Loading...</div>}
        {error && <div className="error">{error}</div>}

        {weather && !loading && (
          <div className="weather-content">
            <div className="main-card">
              <div className="weather-icon">
                {getWeatherIcon(weather.weather_code)}
              </div>
              <div className="main-info">
                <h2>{weather.city}</h2>
                <div className="temperature">{Math.round(weather.temperature_2m)}°C</div>
                <div className="description">{getWeatherDescription(weather.weather_code)}</div>
                <div className="feels-like">
                  Feels like {Math.round(weather.apparent_temperature)}°C
                </div>
              </div>
            </div>

            <div className="details-grid">
              <div className="detail-card">
                <Wind size={32} />
                <div className="detail-value">{Math.round(weather.wind_speed_10m)} km/h</div>
                <div className="detail-label">Wind Speed</div>
              </div>
              <div className="detail-card">
                <Droplets size={32} />
                <div className="detail-value">{weather.relative_humidity_2m}%</div>
                <div className="detail-label">Humidity</div>
              </div>
              <div className="detail-card">
                <Gauge size={32} />
                <div className="detail-value">{Math.round(weather.pressure_msl)} hPa</div>
                <div className="detail-label">Pressure</div>
              </div>
              <div className="detail-card">
                <Eye size={32} />
                <div className="detail-value">{(weather.visibility / 1000).toFixed(1)} km</div>
                <div className="detail-label">Visibility</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;`,

    'src/index.css': `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
  color: #1a202c;
}

#root {
  min-height: 100vh;
}`,

    'src/App.css': `.app {
  min-height: 100vh;
  padding: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.container {
  width: 100%;
  max-width: 800px;
}

header {
  text-align: center;
  margin-bottom: 2rem;
  color: white;
}

header h1 {
  font-size: 2.5rem;
  font-weight: 700;
  margin-bottom: 1.5rem;
}

.search-form {
  display: flex;
  gap: 0.75rem;
  max-width: 400px;
  margin: 0 auto;
}

.search-form input {
  flex: 1;
  padding: 0.875rem 1rem;
  border: none;
  border-radius: 12px;
  font-size: 0.95rem;
  background: rgba(255, 255, 255, 0.95);
}

.search-form button {
  padding: 0.875rem 1.25rem;
  border: none;
  border-radius: 12px;
  background: white;
  color: #667eea;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.search-form button:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
}

.loading,
.error {
  text-align: center;
  padding: 2rem;
  color: white;
  font-size: 1.125rem;
}

.error {
  background: rgba(239, 68, 68, 0.2);
  border-radius: 12px;
}

.weather-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.main-card {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 20px;
  padding: 2.5rem;
  display: flex;
  align-items: center;
  gap: 2rem;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
}

.weather-icon {
  color: #f59e0b;
}

.main-info {
  flex: 1;
}

.main-info h2 {
  font-size: 1.75rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.temperature {
  font-size: 4rem;
  font-weight: 700;
  line-height: 1;
  margin-bottom: 0.5rem;
  color: #667eea;
}

.description {
  font-size: 1.25rem;
  color: #64748b;
  margin-bottom: 0.25rem;
}

.feels-like {
  font-size: 0.95rem;
  color: #94a3b8;
}

.details-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 1rem;
}

.detail-card {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 16px;
  padding: 1.5rem;
  text-align: center;
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.1);
  transition: all 0.2s;
}

.detail-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 15px 30px rgba(0, 0, 0, 0.15);
}

.detail-card svg {
  color: #667eea;
  margin-bottom: 0.75rem;
}

.detail-value {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 0.25rem;
  color: #1a202c;
}

.detail-label {
  font-size: 0.875rem;
  color: #64748b;
  font-weight: 500;
}

@media (max-width: 640px) {
  .main-card {
    flex-direction: column;
    text-align: center;
  }

  .temperature {
    font-size: 3rem;
  }
}`,
  },
};
