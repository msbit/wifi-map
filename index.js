import { GOOGLE_MAPS_API_KEY } from './local.js';
self.addEventListener('load', ({ target }) => {
    window.addEventListener('dragover', (event) => event.preventDefault());
    let observations = [];
    window.addEventListener('drop', async (event) => {
        event.preventDefault();
        if (event.dataTransfer === null) {
            return;
        }
        const items = Array.prototype.filter.call(event.dataTransfer.items, item => item.kind === 'file' && item.type === 'text/csv');
        if (items.length === 0) {
            return;
        }
        const allContents = await Promise.all(items.map(x => x.getAsFile()?.text()));
        for (const contents of allContents) {
            if (contents === undefined) {
                continue;
            }
            observations = observations.concat(contentsToObservations(contents));
        }
        observations = deduplicate(observations, compareObservations);
        const bounds = new google.maps.LatLngBounds();
        for (const observation of observations) {
            bounds.extend(observation.latlng);
        }
        const maxRadius = Math.max(...observations.map(o => o.radius));
        const southWest = bounds.getSouthWest();
        const northEast = bounds.getNorthEast();
        const south = southWest.lat() - subtendedLat(maxRadius);
        const west = southWest.lng() - subtendedLng(south, maxRadius);
        const north = northEast.lat() + subtendedLat(maxRadius);
        const east = northEast.lng() + subtendedLng(north, maxRadius);
        const mapElement = document.getElementById('map');
        if (mapElement === null) {
            return;
        }
        const map = new google.maps.Map(mapElement);
        map.fitBounds(bounds);
        const deltaLat = subtendedLat(4);
        for (let lat = south; lat < north; lat += deltaLat) {
            const deltaLng = subtendedLng(lat, 4);
            for (let lng = west; lng < east; lng += deltaLng) {
                const containingObservations = observations.filter(o => observationContains(o, lat, lng));
                if (containingObservations.length === 0) {
                    continue;
                }
                const percentage = weightedAveragePercentage(containingObservations);
                new google.maps.Rectangle({
                    fillColor: `hsl(${(percentage * 120) / 100}deg 100% 50%)`,
                    strokeWeight: 0,
                    map,
                    bounds: {
                        north: lat + (deltaLat / 2),
                        south: lat - (deltaLat / 2),
                        east: lng + (deltaLng / 2),
                        west: lng - (deltaLng / 2),
                    }
                });
            }
        }
        //for (const observation of observations) {
        //  new google.maps.Circle({
        //    center: observation.latlng,
        //    fillOpacity: 0,
        //    map,
        //    radius: observation.radius,
        //    strokeOpacity: 0.2,
        //    strokeWeight: 1,
        //  });
        //}
    });
    const head = document.getElementsByTagName('head')[0];
    const script = document.createElement('script');
    const url = new URL('https://maps.googleapis.com/maps/api/js');
    url.searchParams.set('key', GOOGLE_MAPS_API_KEY);
    url.searchParams.set('libraries', 'geometry');
    url.searchParams.set('loading', 'async');
    script.async = true;
    script.defer = true;
    script.src = url.toString();
    script.type = 'text/javascript';
    head.appendChild(script);
});
const contentsToObservations = (contents) => contents.split("\n").map(row => {
    const columns = row.split(',');
    if (columns.length !== 5) {
        return undefined;
    }
    return {
        latlng: new google.maps.LatLng(parseFloat(columns[0]), parseFloat(columns[1])),
        radius: parseFloat(columns[2]),
        percentage: parseInt(columns[4], 10),
    };
}).filter(x => x !== undefined);
const averagePercentage = (observations) => {
    return observations.map(o => o.percentage).reduce(sum) / observations.length;
};
const weightedAveragePercentage = (observations) => {
    return observations.map(o => o.percentage / o.radius).reduce(sum) / observations.map(o => 1 / o.radius).reduce(sum);
};
const sum = (a, b) => a + b;
const observationContains = (observation, lat, lng) => {
    const theta2 = subtendedLat(observation.radius) * subtendedLng(lat, observation.radius);
    const deltaLat = lat - observation.latlng.lat();
    const deltaLng = lng - observation.latlng.lng();
    const distance2 = (deltaLat * deltaLat) + (deltaLng * deltaLng);
    return distance2 < theta2;
};
const subtendedLat = (distance, polarRadius = 6356752) => (distance * 180) / (Math.PI * polarRadius);
const subtendedLng = (latitude, distance, equatorialRadius = 6378137) => {
    const radians = (latitude * Math.PI) / 180;
    return (distance * 180) / (Math.cos(radians) * Math.PI * equatorialRadius);
};
const compareObservations = (a, b) => a.radius === b.radius && a.percentage === b.percentage && a.latlng.lat() === b.latlng.lat() && a.latlng.lng() === b.latlng.lng();
const deduplicate = (arr, compare) => {
    const result = [];
    for (const a of arr) {
        if (result.some(b => compare(a, b))) {
            continue;
        }
        result.push(a);
    }
    return result;
};
