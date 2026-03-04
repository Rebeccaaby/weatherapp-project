# Weather Information App

This is a full-stack weather application that allows users to retrieve real-time weather data, view forecasts, save weather requests with date ranges, and visualize the saved locations on a map. The application integrates external weather APIs, persistent storage, and a frontend interface.

## Live Application
Open the Vercel link to use the app.

Frontend (User Interface):
https://weatherapp-project-seven.vercel.app

Backend API: The backend service is hosted on Render and exposes REST API endpoints used by the frontend.
https://weatherapp-project-d8k6.onrender.com

Note: The backend may take a few seconds to wake up on the first request due to Render free-tier cold start.

## Features:
- Current Weather and Forecast
- View current weather conditions for a location
- View a 5-day forecast with icons

## Location Search Supports:
- City names
- Zip codes
- User’s current GPS location

## Location Mapping: 
- Displays selected saved locations on a map using Leaflet and OpenStreetMap
- Map marker updates automatically when a saved location is selected

## Data Persistence (CRUD):
- Users can save weather requests including:
    - Location
    - Start date
    - End date

## Other Supported operations:
- Create request to save weather information
- View saved requests
- Edit existing requests
- Delete requests
- Export Functionality (Export all saved requests as JSON/CSV/MarkDown/PDF)

## Error Handling:
- Error handling for:
    - Invalid locations
    - API failures
    - Forecast range limits (max 16 days)
    - Browser geolocation errors

## Tools and frameworks Used:

1. Frontend:
    - React (Vite)
    - Leaflet
    - OpenStreetMap Tiles

2. Backend:
    - Node.js
    - Express
    - Prisma ORM
    - SQLite database

3. External APIs:
    - Open-Meteo Geocoding API & Weather Forecast API


## Running the Application Locally:

1. Clone the repository

HTTPS:  
git clone https://github.com/Rebeccaaby/weatherapp-project.git  
cd weatherapp-project  

SSH:  
git@github.com:Rebeccaaby/weatherapp-project.git  
cd weatherapp-project  

2. Environment Variables: 
The backend requires environment variables to configure the database connection. Create a .env file inside the backend folder.
After creating the file add the following variable to configure Prisma to use a local SQLite database file:
    DATABASE_URL="file:./dev.db"

3. Backend Setup: Follow the commands one after the other, below to setup the backend with all libraires and tools to run application:
    1. cd backend
    2. npm install
    3. npx prisma generate
    3. npx prisma db push
    4. npm run dev

    5. Backend will run on:
        http://localhost:4000
    
    6. Example API calls to test:
        1. http://localhost:4000/api/geocode?q=Buffalo (will list all coordinates for Buffalo cities in the US)
        2. http://localhost:4000/api/weather?lat=42.8864&lon=-78.8784 (Coordinates for Buffalo, NY)

4. Frontend Setup: Similary=ly follow all the steps one after the other to get the frontend setup:
    1. cd frontend
    2. npm install
    3. npm run dev
    4. Frontend runs on: http://localhost:3000


## Application Functionality:

### Step 1 — Get Weather
Users can:
    - Click Use my location
    - Enter a city name and click Get weather

The frontend:
- Calls /api/geocode
- Receives coordinates
- Calls /api/weather

### Step 2 — Save Weather Request
Users can save:
    - Location
    - Date range

The backend:
- Validates the location
- Retrieves weather data
- Stores results in SQLite DB

### Step 3 — View Saved Requests
Saved locations appear in the list. Selecting a location:
    - Updates the map
    - Displays saved daily temperatures
    - Loads current weather

### Step 4 — Edit or Delete Requests
Users can:
    - Modify location or date range
    - Delete saved requests
    - The backend updates the database accordingly

### Step 5 — Export Data
Saved weather requests can be exported as: JSON/CSV/Markdown/PDF

## API Endpoints
1. GET /api/geocode?q=location  (Please update or change `location` to name of a city)
2. GET /api/weather?lat=<lat>&lon=<lon>
3. POST /api/requests
4. GET /api/requests
5. PUT /api/requests/:id
6. DELETE /api/requests/:id
7. GET /api/requests/export?format=json
8. GET /api/requests/export?format=csv
9. GET /api/requests/export?format=md
10. GET /api/requests/export?format=pdf

