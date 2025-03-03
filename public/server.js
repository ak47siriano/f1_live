// server.js
const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

// Serviamo i file statici dalla cartella "public"
app.use(express.static('public'));

// Mappatura dei km di pista per alcuni circuiti (da ampliare in base alle esigenze)
const trackLengthMapping = {
  'monza': 5.793,
  'silverstone': 5.891,
  'catalunya': 4.655
};

app.get('/api/currentRace', async (req, res) => {
  try {
    // Otteniamo il prossimo weekend di gara (puoi modificare la logica per selezionare il "live" in base alla data)
    const raceResponse = await axios.get('http://ergast.com/api/f1/current/next.json');
    const race = raceResponse.data.MRData.RaceTable.Races[0];

    // Tentativo di ottenere il miglior giro dalla gara precedente
    let bestLap = "N/A";
    try {
      const lastRaceResponse = await axios.get('http://ergast.com/api/f1/current/last/results.json');
      const results = lastRaceResponse.data.MRData.RaceTable.Races[0].Results;
      let fastestTime = Infinity;
      results.forEach(r => {
        if (r.FastestLap && r.FastestLap.Time && r.FastestLap.Time.time) {
          const parts = r.FastestLap.Time.time.split(':');
          const seconds = parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
          if (seconds < fastestTime) {
            fastestTime = seconds;
            bestLap = r.FastestLap.Time.time;
          }
        }
      });
      if (fastestTime === Infinity) bestLap = "N/A";
    } catch (e) {
      bestLap = "N/A";
    }

    // Determiniamo il track length se disponibile
    const circuitId = race.Circuit.circuitId;
    const trackKm = trackLengthMapping[circuitId] || "N/A";
    // Simuliamo la temperatura (valore casuale tra 20°C e 35°C)
    const temperature = Math.floor(Math.random() * 16) + 20;

    res.json({
      circuit: {
        name: race.Circuit.circuitName,
        country: race.Circuit.Location.country,
        trackKm: trackKm,
        bestLapTime: bestLap
      },
      temperature: temperature
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
