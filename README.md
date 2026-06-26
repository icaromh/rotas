# Rotas Planner 🚴‍♂️🏃‍♀️

Plan optimized routes to cover every single street in a drawn area! Perfect for running, cycling, or just exploring your neighborhood. 

![Rotas Planner UI](public/screenshot.png)

## Features
- **Draw Area:** Use the map tools to draw a custom polygon over any area.
- **Optimized Eulerian Path:** The application calculates the most efficient route (Mixed Chinese Postman Problem) to traverse every street segment inside your selected area.
- **Sport Modes:** Choose between Cycling or Walking to get accurate pace and time estimates.
- **Export & Share:** Export the generated route as a GPX file for your Garmin/Wahoo/Strava, or share the route directly via a unique URL.
- **Preview:** Animate the planned route directly on the map.

## Technology Stack
- **Frontend:** Vanilla TypeScript, Vite, Tailwind CSS
- **Map:** Leaflet, OpenStreetMap, Overpass API
- **Algorithms:** Hierholzer's Algorithm, LP Solver (Mixed Chinese Postman Problem)
- **Web Workers:** Heavy graph processing and optimization runs in the background to keep the UI smooth.

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run the development server:
   ```bash
   npm run dev
   ```

3. Open `http://localhost:5173` in your browser.

## Contributing
Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.
