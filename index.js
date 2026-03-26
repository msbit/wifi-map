self.addEventListener('load', ({ target }) => {
  window.addEventListener('dragover', (event) => event.preventDefault());

  window.addEventListener('drop', async (event) => {
    event.preventDefault();

    const item = Array.prototype.find.call(
      event.dataTransfer.items,
      item => item.kind === 'file' && item.type === 'text/csv',
    );
    if (item === undefined) {
      return;
    }

    const contents = await item.getAsFile().text();

    const observations = contents.split("\n").map(row => {
      const columns = row.split(',');
      if (columns.length !== 5) {
        return undefined;
      }

      return {
        latlng: new google.maps.LatLng(
          parseFloat(columns[0]),
          parseFloat(columns[1]),
        ),
        radius: parseFloat(columns[2]),
        percentage: parseInt(columns[4], 10),
      };
    }).filter(x => x);
    const bounds = new google.maps.LatLngBounds();
    for (const observation of observations) {
      bounds.extend(observation.latlng);
    }

    const maxRadius = Math.max(...observations.map(o => o.radius));

    const southWest = bounds.getSouthWest();
    const northEast = bounds.getNorthEast();

    const south = southWest.lat() - subtended(maxRadius);
    const west = southWest.lng() - subtended(maxRadius);

    const north = northEast.lat() + subtended(maxRadius);
    const east = northEast.lng() + subtended(maxRadius);

    const map = new google.maps.Map(document.getElementById('map'));
    map.fitBounds(bounds);

    const delta = subtended(1);

    for (let lat = south; lat < north; lat += delta) {
      for (let lng = west; lng < east; lng += delta) {
        const containingObservations = observations.filter(o => observationContains(o, lat, lng));
        if (containingObservations.length === 0) {
          continue;
        }

        const percentage = averagePercentage(containingObservations);
        new google.maps.Rectangle({
          fillColor: `hsl(${(percentage * 120) / 100}deg 100% 50%)`,
          strokeWeight: 0,
          map,
          bounds: {
            north: lat + (delta/2),
            south: lat - (delta/2),
            east: lng + (delta/2),
            west: lng - (delta/2),
          }
        })
      }
    }
  });

  const head = target.getElementsByTagName('head')[0];
  const script = target.createElement('script');

  const url = new URL('https://maps.googleapis.com/maps/api/js');
  url.searchParams.set('key', GOOGLE_MAPS_API_KEY);
  url.searchParams.set('libraries', 'geometry');

  script.async = true;
  script.defer = true;
  script.src = url.toString();
  script.type = 'text/javascript';

  head.appendChild(script);
});

const averagePercentage = (observations) => {
  return observations.map(o => o.percentage).reduce((a, b) => a + b) / observations.length;
}

const observationContains = (observation, lat, lng, globalRadius = 6378135) => {
  const theta = subtended(observation.radius, globalRadius);
  const theta2 = theta * theta;

  const deltaLat = lat - observation.latlng.lat();
  const deltaLng = lng - observation.latlng.lng();
  const distance2 = (deltaLat * deltaLat) + (deltaLng * deltaLng);

  return distance2 < theta2;
};

const subtended = (distance, globalRadius = 6378135) => (distance * 360) / (2 * Math.PI * globalRadius);
