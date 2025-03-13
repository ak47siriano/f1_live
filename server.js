// server.js
const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

// Serviamo i file statici dalla cartella "public"
app.use(express.static('public'));

app.get('/api/currentRace', async (req, res) => {
  try {
    // Otteniamo il prossimo weekend di gara
    const raceResponse = await axios.get('http://ergast.com/api/f1/current/next.json');
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
    res.status(500).json({ error: 'Errore nel recupero dei dati della gara' });
  }
});

app.get('/api/leaderboard', async (req, res) => {
  try {
    // Classifica piloti
    const driversResponse = await axios.get('http://ergast.com/api/f1/current/driverStandings.json');
    const drivers = driversResponse.data.MRData.StandingsTable.StandingsLists[0].DriverStandings.map(ds => ({
      position: ds.position,
      name: `${ds.Driver.givenName} ${ds.Driver.familyName}`,
      points: ds.points
    }));
    // Classifica costruttori
    const constructorsResponse = await axios.get('http://ergast.com/api/f1/current/constructorStandings.json');
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
    res.status(500).json({ error: 'Errore nel recupero della classifica' });
  }
});

app.get('/api/calendar', async (req, res) => {
  try {
    const calendarResponse = await axios.get('http://ergast.com/api/f1/current.json');
    const races = calendarResponse.data.MRData.RaceTable.Races.map(race => ({
      date: race.date,
      circuitName: race.Circuit.circuitName,
      country: race.Circuit.Location.country
    }));
    res.json({ races: races });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Errore nel recupero del calendario' });
  }
});

app.listen(PORT, () => {
  console.log(`Server in ascolto sulla porta ${PORT}`);
});
// Add this new endpoint to server.js
app.get('/api/circuitImage', async (req, res) => {
  try {
    // Get the current race information
    const raceResponse = await axios.get('http://ergast.com/api/f1/current/next.json');
    const race = raceResponse.data.MRData.RaceTable.Races[0];
    
    // Get the circuit ID
    const circuitId = race.Circuit.circuitId;
    
    // Return the circuit information
    res.json({
      circuitId: circuitId,
      circuitName: race.Circuit.circuitName,
      // You would typically get this from a real API, but for now we'll use a placeholder
      circuitImageUrl: `https://www.formula1.com/content/dam/fom-website/2018-redesign-assets/Circuit%20maps%2016x9/${circuitId}.png.transform/7col/image.png`
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Errore nel recupero dell\'immagine del circuito' });
  }
});

// Add this endpoint for live timing data
app.get('/api/liveTiming', async (req, res) => {
  try {
    // In a real application, you would fetch this from the F1 API
    // For now, we'll return mock data
    const mockDrivers = [
      { position: "1", number: "1", code: "VER", name: "Max Verstappen", team: "Red Bull Racing", time: "1:32.564" },
      { position: "2", number: "11", code: "PER", name: "Sergio Perez", team: "Red Bull Racing", time: "1:32.978" },
      { position: "3", number: "16", code: "LEC", name: "Charles Leclerc", team: "Ferrari", time: "1:33.121" },
      { position: "4", number: "55", code: "SAI", name: "Carlos Sainz", team: "Ferrari", time: "1:33.245" },
      { position: "5", number: "44", code: "HAM", name: "Lewis Hamilton", team: "Mercedes", time: "1:33.356" }
    ];
    
    res.json({ drivers: mockDrivers });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Errore nel recupero dei dati di timing' });
  }
});
