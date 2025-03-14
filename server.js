// server.js
const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;
// Serve static files from the "public" directory
app.use(express.static('public'));

app.get('/api/currentRace', async (req, res) => {
  try {
    // Get the next race weekend for the 2025 season
    const raceResponse = await axios.get('http://ergast.com/api/f1/2025/next.json');
    const race = raceResponse.data.MRData.RaceTable.Races[0];

    res.json({
      circuit: {
        name: race.Circuit.circuitName,
        country: race.Circuit.Location.country
      },
      raceDate: race.date
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error fetching race data' });
  }
});

app.get('/api/leaderboard', async (req, res) => {
  try {
    // Driver standings for the 2025 season
    const driversResponse = await axios.get('https://api.jolpi.ca/ergast/f1/2025/driverstandings/?format=json');
    const drivers = driversResponse.data.MRData.StandingsTable.StandingsLists[0].DriverStandings.map(ds => ({
      position: ds.position,
      name: `${ds.Driver.givenName} ${ds.Driver.familyName}`,
      points: ds.points
    }));
    // Constructor standings for the 2025 season
    const constructorsResponse = await axios.get('https://api.jolpi.ca/ergast/f1/2025/constructorstandings/?format=json');
    const constructors = constructorsResponse.data.MRData.StandingsTable.StandingsLists[0].ConstructorStandings.map(cs => ({
      position: cs.position,
      name: cs.Constructor.name,
      points: cs.points
    }));
    res.json({
      drivers: drivers,
      constructors: constructors
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error fetching leaderboard data' });
  }
});

app.get('/api/calendar', async (req, res) => {
  try {
    const calendarResponse = await axios.get('https://api.jolpi.ca/ergast/f1/2025/races/?format=json');
    const races = calendarResponse.data.MRData.RaceTable.Races.map(race => ({
      date: race.date,
      circuitName: race.Circuit.circuitName,
      country: race.Circuit.Location.country
    }));
    res.json({ races: races });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error fetching calendar data' });
  }
});



app.get('/api/liveTiming', async (req, res) => {
  try {
    // Create a custom axios instance with better timeout and retry config
    const f1ApiClient = axios.create({
      timeout: 30000, // 30 seconds
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'F1-Timing-App/1.0'
      },
      validateStatus: status => status < 500 // Only reject if status >= 500
    });

    // First try to get session data
    const sessionsResponse = await f1ApiClient.get('https://api.openf1.org/v1/sessions?session_key=latest')
      .catch(error => {
        console.log('Session fetch error:', error.message);
        // Try with hardcoded session key as fallback
        return { data: [{ session_key: 0 }] };
      });

    const sessionKey = sessionsResponse.data[0]?.session_key;
    console.log('Using session key:', sessionKey);

    if (!sessionKey) {
      return res.status(404).json({
        status: 'error',
        error: 'No session available',
        message: 'No active F1 session found'
      });
    }

    // Try to fetch all data with individual error handling
    const [driversData, positionData, carData] = await Promise.all([
      f1ApiClient.get(`https://api.openf1.org/v1/drivers?session_key=${sessionKey}`)
        .then(res => res.data)
        .catch(error => {
          console.log('Drivers fetch error:', error.message);
          return [];
        }),
      
      f1ApiClient.get(`https://api.openf1.org/v1/position?session_key=${sessionKey}`)
        .then(res => res.data)
        .catch(error => {
          console.log('Position fetch error:', error.message);
          return [];
        }),
      
      f1ApiClient.get(`https://api.openf1.org/v1/car_data?session_key=${sessionKey}`)
        .then(res => res.data)
        .catch(error => {
          console.log('Car data fetch error:', error.message);
          return [];
        })
    ]);

    // Check if we have at least some data
    if (!driversData.length) {
      return res.status(404).json({
        status: 'error',
        error: 'No data available',
        message: 'No driver data available for this session'
      });
    }

    // Process the data we have
    const latestPositions = {};
    const latestCarData = {};

    // Process position data if available
    if (positionData.length) {
      positionData.forEach(pos => {
        if (!latestPositions[pos.driver_number] || 
            new Date(pos.date) > new Date(latestPositions[pos.driver_number].date)) {
          latestPositions[pos.driver_number] = {
            position: pos.position,
            date: pos.date
          };
        }
      });
    }

    // Process car data if available
    if (carData.length) {
      carData.forEach(data => {
        if (!latestCarData[data.driver_number] || 
            new Date(data.date) > new Date(latestCarData[data.driver_number].date)) {
          latestCarData[data.driver_number] = data;
        }
      });
    }

    // Combine available data
    const drivers = driversData.map(driver => {
      const driverNumber = driver.driver_number;
      const position = latestPositions[driverNumber]?.position || null;
      const telemetry = latestCarData[driverNumber] || {};

      return {
        position: position,
        number: driverNumber,
        code: driver.name_acronym || '',
        name: driver.full_name || '',
        team: driver.team_name || '',
        speed: telemetry.speed || 0,
        rpm: telemetry.rpm || 0,
        throttle: telemetry.throttle || 0,
        brake: telemetry.brake || 0,
        gear: telemetry.n_gear || 'N',
        drs: telemetry.drs || 0,
        lastUpdate: telemetry.date || new Date().toISOString()
      };
    });

    // Sort drivers
    drivers.sort((a, b) => {
      if (!a.position) return 1;
      if (!b.position) return -1;
      return parseInt(a.position) - parseInt(b.position);
    });

    // Send response with data availability flags
    res.json({
      status: 'success',
      sessionKey: sessionKey,
      timestamp: new Date().toISOString(),
      driversCount: drivers.length,
      dataAvailability: {
        positions: positionData.length > 0,
        telemetry: carData.length > 0
      },
      drivers: drivers
    });

  } catch (error) {
    console.error("Live timing error:", {
      message: error.message,
      cause: error.cause
    });

    res.status(500).json({
      status: 'error',
      error: 'Error fetching live timing data',
      message: 'Unable to fetch complete timing data. Please try again.',
      timestamp: new Date().toISOString()
    });
  }
});

// Aggiungi questa route in server.js
app.get('/api/stints', async (req, res) => {
  try {
    const sessionKey = req.query.session_key || '9165'; // Usa un session_key di default o quello fornito
    const response = await axios.get(`https://api.openf1.org/v1/stints?session_key=${sessionKey}`);
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching stint data:', error);
    res.status(500).json({ error: 'Error fetching stint data' });
  }
});
app.get('/api/weather', async (req, res) => {
  try {
    const response = await axios.get('https://api.openf1.org/v1/weather?session_key=latest');
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching weather data:', error);
    res.status(500).json({ error: 'Error fetching weather data' });
  }
});


app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
