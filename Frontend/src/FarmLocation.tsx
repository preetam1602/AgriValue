import { useRef, useState } from 'react';
import { api } from './api';

export default function FarmLocation({ districts }: { districts: string[] }) {
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState('');
  const [district, setDistrict] = useState('');
  const [village, setVillage] = useState('');
  const [detectedDistrict, setDetectedDistrict] = useState('');
  const addressRevision = useRef(0);
  const manualRef = useRef<HTMLDetailsElement>(null);

  function locate() {
    if (!window.isSecureContext || !navigator.geolocation) {
      setMessage('Location is unavailable in this browser. Ask someone to help enter the farm coordinates below, or try on your phone using a secure connection.');
      return;
    }
    setLocating(true);
    setMessage('Finding your location. Allow location access when your browser asks.');
    const revision = addressRevision.current;
    navigator.geolocation.getCurrentPosition(async position => {
      setLatitude(position.coords.latitude.toFixed(7));
      setLongitude(position.coords.longitude.toFixed(7));
      setMessage('Location captured. Finding your district and village...');
      try {
        const address = await api.reverseLocation(position.coords.latitude, position.coords.longitude);
        if (addressRevision.current !== revision) {
          setMessage('Location captured. Your manually edited district and village have been kept.');
          return;
        }
        const normalize = (name: string) => name.toLowerCase().replace(/\bdistrict\b/g, '').trim();
        const match = districts.find(name => normalize(name) === normalize(address.district));
        setDetectedDistrict(address.district);
        setDistrict(match ?? (districts.length ? '' : address.district));
        setVillage(address.village);
        const districtNote = address.district && !match && districts.length ? ` Detected district: ${address.district}. Select an available district only if it is correct for your farm.` : '';
        setMessage(`Location captured, accurate to about ${Math.ceil(position.coords.accuracy)} metres. Please check the detected district and village before saving.${districtNote}${!address.village ? ' Village could not be found; enter it below.' : ''}`);
      } catch {
        setMessage('Location captured, but the address lookup failed. Enter the district and village manually; you do not need to capture the location again.');
      } finally { setLocating(false); }
    }, error => {
      setMessage(error.code === 1 ? 'Location permission was not allowed. Enable it in your browser and try again, or ask someone to help enter the farm location below.' : error.code === 3 ? 'Finding your location took too long. Move to an open area and try again.' : 'Your location could not be found. Try again from your phone, or enter the farm location with help.');
      setLocating(false);
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  }

  return <div className="farm-location">
    <h3>Farm location</h3><p>If you are at your farm, use your phone’s location to fill the coordinates, district and village. Coordinates are sent to OpenStreetMap for address lookup.</p>
    <button id="capture-farm-location" className="button" type="button" onClick={locate} disabled={locating} aria-describedby="farm-location-status">{locating ? 'Finding your location...' : latitude && longitude ? 'Update my current location' : 'Use my current location'}</button>
    <p id="farm-location-status" className="location-status" role="status">{message || 'Away from the farm? Do not use your current location. Ask someone to help enter the farm location instead.'}</p>
    <div className="field-row"><div><label htmlFor="district">District</label><select id="district" name="district" required value={district} onChange={event => { addressRevision.current += 1; setDistrict(event.target.value); }}><option value="">{detectedDistrict && districts.length ? `Detected: ${detectedDistrict} — choose supported district` : 'Choose district'}</option>{!districts.length && detectedDistrict && <option value={detectedDistrict}>{detectedDistrict}</option>}{districts.map(name => <option key={name}>{name}</option>)}</select></div><div><label htmlFor="village">Village / locality</label><input id="village" name="village" placeholder="Enter your village" maxLength={100} autoComplete="address-level3" required value={village} onChange={event => { addressRevision.current += 1; setVillage(event.target.value); }} /></div></div>
    <p className="location-attribution">Address data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>. Nearby locality names may need correction.</p>
    <details ref={manualRef}><summary>Enter or check coordinates with help</summary>
      <div className="field-row"><div><label htmlFor="latitude">Latitude</label><input id="latitude" name="latitude" type="number" min="-90" max="90" step="0.0000001" value={latitude} onChange={event => { setLatitude(event.target.value); setMessage('Farm location edited manually.'); }} onInvalid={() => { if (manualRef.current) manualRef.current.open = true; }} /></div><div><label htmlFor="longitude">Longitude</label><input id="longitude" name="longitude" type="number" min="-180" max="180" step="0.0000001" value={longitude} onChange={event => { setLongitude(event.target.value); setMessage('Farm location edited manually.'); }} onInvalid={() => { if (manualRef.current) manualRef.current.open = true; }} /></div></div>
    </details>
  </div>;
}
