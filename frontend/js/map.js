// Карта на Leaflet + OpenStreetMap. Если библиотека не загрузилась (нет интернета),
// показываем координаты текстом, а в форме — поля ввода.

export const MINSK = { lat: 53.9023, lon: 27.5619 };

const TILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTR = '&copy; участники OpenStreetMap';

function hasLeaflet() {
  return typeof window.L !== 'undefined';
}

function base(el, lat, lon, zoom) {
  const map = window.L.map(el, { scrollWheelZoom: false }).setView([lat, lon], zoom);
  window.L.tileLayer(TILES, { attribution: ATTR, maxZoom: 19 }).addTo(map);
  setTimeout(() => map.invalidateSize(), 50);
  return map;
}

export function showMap(el, lat, lon) {
  if (!hasLeaflet() || lat == null || lon == null) {
    el.innerHTML = `<div class="map-fallback">Координаты: ${Number(lat).toFixed(5)}, ${Number(lon).toFixed(5)}</div>`;
    return;
  }
  const map = base(el, lat, lon, 15);
  window.L.marker([lat, lon]).addTo(map);
}

// Выбор точки кликом. onChange({lat, lon}) вызывается при каждом изменении.
export function pickMap(el, initial, onChange) {
  const start = initial && initial.lat != null ? initial : MINSK;
  if (!hasLeaflet()) {
    el.innerHTML = `
      <div class="map-fallback">
        Карта недоступна — введите координаты вручную
        <div class="row">
          <input type="number" step="0.00001" data-lat value="${start.lat}">
          <input type="number" step="0.00001" data-lon value="${start.lon}">
        </div>
      </div>`;
    const read = () => onChange({ lat: Number(el.querySelector('[data-lat]').value), lon: Number(el.querySelector('[data-lon]').value) });
    el.querySelectorAll('input').forEach((i) => { i.oninput = read; });
    read();
    return;
  }
  const map = base(el, start.lat, start.lon, initial && initial.lat != null ? 15 : 12);
  let marker = null;
  const place = (lat, lon) => {
    if (marker) marker.setLatLng([lat, lon]);
    else marker = window.L.marker([lat, lon], { draggable: true }).addTo(map)
      .on('dragend', (e) => { const p = e.target.getLatLng(); onChange({ lat: p.lat, lon: p.lng }); });
    onChange({ lat, lon });
  };
  if (initial && initial.lat != null) place(initial.lat, initial.lon);
  map.on('click', (e) => place(e.latlng.lat, e.latlng.lng));
}
