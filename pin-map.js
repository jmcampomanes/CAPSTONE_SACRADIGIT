/* ============================================
   SacraDigit — Pin-a-location map (Leaflet + OpenStreetMap)
   Used on Request a Service (House Blessing) so the parishioner
   can mark exactly where the house is. Tap/click the map to drop
   the pin, drag it to fine-tune, or use the two helpers:
   - "Use my current location" (browser geolocation)
   - "Find my address" (looks up the typed address with
     OpenStreetMap's free Nominatim geocoder, Philippines only)

   No API key needed. The marker is an inline SVG (divIcon), so no
   marker image files have to be bundled.
   ============================================ */

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Default view: Cubao, Quezon City (the parish area used in the form examples)
const DEFAULT_CENTER = [14.6197, 121.0535];
const DEFAULT_ZOOM = 14;
const PINNED_ZOOM = 17;

const PIN_ICON = L.divIcon({
  className: 'pin-map-marker',
  html: `<svg viewBox="0 0 32 42" width="32" height="42" aria-hidden="true">
    <path d="M16 1C7.7 1 1 7.6 1 15.8 1 27 16 41 16 41s15-14 15-25.2C31 7.6 24.3 1 16 1z" fill="#1e2a4a" stroke="#ffffff" stroke-width="2"/>
    <circle cx="16" cy="15.5" r="5.5" fill="#c9a84c"/>
  </svg>`,
  iconSize: [32, 42],
  iconAnchor: [16, 41],
});

export function formatLatLng({ lat, lng }) {
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

/**
 * Creates the map inside `container` (which must be visible and sized).
 * `onChange(latLng | null)` fires whenever the pin moves.
 * Returns { getValue, locateMe, findAddress, destroy, resize }.
 */
export function createPinMap(container, { onChange = () => {} } = {}) {
  const map = L.map(container, { zoomControl: true, attributionControl: true }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
  }).addTo(map);

  let marker = null;

  function setPin(latlng, { zoom = false } = {}) {
    if (!marker) {
      marker = L.marker(latlng, { icon: PIN_ICON, draggable: true, keyboard: true, title: 'Your location — drag to adjust' }).addTo(map);
      marker.on('dragend', () => onChange(marker.getLatLng()));
    } else {
      marker.setLatLng(latlng);
    }
    if (zoom) map.setView(latlng, Math.max(map.getZoom(), PINNED_ZOOM));
    onChange(marker.getLatLng());
  }

  map.on('click', (e) => setPin(e.latlng));

  return {
    getValue: () => (marker ? marker.getLatLng() : null),

    locateMe() {
      return new Promise((resolve, reject) => {
        if (!navigator.geolocation) { reject(new Error('Location is not available in this browser.')); return; }
        navigator.geolocation.getCurrentPosition(
          (pos) => { setPin(L.latLng(pos.coords.latitude, pos.coords.longitude), { zoom: true }); resolve(); },
          (err) => reject(new Error(err.code === err.PERMISSION_DENIED
            ? 'Location permission was denied. Tap the map to place the pin instead.'
            : "Couldn't get your location. Tap the map to place the pin instead.")),
          { enableHighAccuracy: true, timeout: 10000 },
        );
      });
    },

    async findAddress(query) {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ph&q=${encodeURIComponent(query)}`;
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error('Address lookup is unavailable right now. Tap the map to place the pin instead.');
      const [hit] = await res.json();
      if (!hit) throw new Error("Couldn't find that address. Tap the map to place the pin instead.");
      setPin(L.latLng(Number(hit.lat), Number(hit.lon)), { zoom: true });
    },

    // Call after the container changes size (e.g. once a slide-in animation ends)
    resize: () => map.invalidateSize(),
    destroy: () => map.remove(),
  };
}
