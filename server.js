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
