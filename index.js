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
      if (columns.length !== 4) {
        return undefined;
      }

      return {
        latlng: new google.maps.LatLng(
          parseFloat(columns[0]),
          parseFloat(columns[1]),
        ),
        radius: parseFloat(columns[2]),
        rssi: parseInt(columns[3], 10),
      };
    }).filter(x => x);
    const bounds = new google.maps.LatLngBounds();
    for (const observation of observations) {
      bounds.extend(observation.latlng);
    }

    const map = new google.maps.Map(document.getElementById('map'));
    map.fitBounds(bounds);

    for (const observation of observations) {
      const circle = new google.maps.Circle({
        center: observation.latlng,
        radius: observation.radius,
        fillOpacity: 0.35,
        fillColor: '#ffdd00ff',
        strokeColor: '#ffdd00ff',
        strokeOpacity: 0.8,
        strokeWeight: 2,
        map,
      });
    }
  });

  const head = target.getElementsByTagName('head')[0];
  const script = target.createElement('script');

  const url = new URL('https://maps.googleapis.com/maps/api/js');
  url.searchParams.set('callback', 'init');
  url.searchParams.set('key', GOOGLE_MAPS_API_KEY);
  url.searchParams.set('libraries', 'geometry');

  script.async = true;
  script.defer = true;
  script.src = url.toString();
  script.type = 'text/javascript';

  head.appendChild(script);
});
