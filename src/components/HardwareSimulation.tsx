import { useEffect, useState } from 'react';
import { CheckCircle2, Droplets, ExternalLink, Flame, MapPin, Phone, RotateCcw, ShieldCheck, Sun, Wind } from 'lucide-react';
import type { CleaningDecision, WeatherSnapshot } from '@/types';
import { lossAfter, normalizePanelClass, selectCleaningMethod, SIM_OUTPUT_LOSS } from '@/lib/cleaningMethods';

interface HardwareSimulationProps {
  prediction: string;
  decision: CleaningDecision;
  weather: WeatherSnapshot | null;
}

export function HardwareSimulation({ prediction, decision, weather }: HardwareSimulationProps) {
  const [run, setRun] = useState(0);
  const panelClass = normalizePanelClass(prediction);
  const simulation = selectCleaningMethod(panelClass, decision, weather);
  const [complete, setComplete] = useState(!simulation.activate);
  const [deviceLocation, setDeviceLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [requestingLocation, setRequestingLocation] = useState(false);
  const running = simulation.activate && !complete;
  const [clockNow, setClockNow] = useState(() => Date.now());
  const rainDetected = isRainDetected(weather);
  const rainAmount = [weather?.precipitation_mm, weather?.rain_mm, weather?.showers_mm]
    .find((amount) => amount != null && amount > 0) ?? null;
  const rainIntensity = rainAmount != null && rainAmount >= 7
    ? 'heavy'
    : rainAmount != null && rainAmount >= 2
      ? 'moderate'
      : 'light';
  const outputBefore = 100 - SIM_OUTPUT_LOSS[panelClass];
  const outputAfter = 100 - (complete && simulation.activate
    ? lossAfter(panelClass, simulation.method)
    : SIM_OUTPUT_LOSS[panelClass]);

  useEffect(() => {
    if (!simulation.activate) {
      setComplete(true);
      return;
    }

    setComplete(false);
    const timer = window.setTimeout(() => setComplete(true), 6_000);
    return () => window.clearTimeout(timer);
  }, [simulation.activate, simulation.method.id, run]);

  useEffect(() => {
    if (panelClass !== 'snow-covered' || !weather?.sunrise_at) return;
    const timer = window.setInterval(() => setClockNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [panelClass, weather?.sunrise_at]);

  const sunriseCountdown = formatSunriseCountdown(weather?.sunrise_at, clockNow);
  const title = simulation.activate
    ? complete ? 'Simulated cleaning cycle complete' : 'Simulated cleaning in progress'
    : decision.action === 'defer_for_rain'
      ? 'Cleaning deferred by weather'
      : simulation.method.id === 'lockout'
        ? 'Cleaning locked out for maintenance review'
        : simulation.method.id === 'defrost_heater'
          ? 'Snow defrost cycle'
          : panelClass === 'snow-covered'
            ? 'Waiting for safe snow melt'
          : 'Panel is clean — actuators remain off';

  const statusText = simulation.activate
    ? complete
      ? 'The simulated cycle finished. The inspection result is unchanged; output values are illustrative.'
      : `The system identified ${prediction}. Simulating ${simulation.method.label.toLowerCase()}; no physical hardware is connected.`
    : simulation.reason;

  const showsBrush = simulation.method.id === 'dry_brush' || simulation.method.id === 'water_spray';
  const showsWater = simulation.method.id === 'water_spray' || simulation.method.id === 'spot_jet';
  const estimatedResourcesUsed = simulation.activate && (running || complete);
  const isDamage = panelClass === 'electrical-damage' || panelClass === 'physical-damage';
  const inspectionLocation = weather
    && !weather.error
    && (weather.latitude !== 0 || weather.longitude !== 0)
    ? { latitude: weather.latitude, longitude: weather.longitude }
    : null;
  const serviceLocation = inspectionLocation ?? deviceLocation;
  const isNearBengaluru = serviceLocation !== null
    && distanceKm(serviceLocation.latitude, serviceLocation.longitude, 12.9716, 77.5946) <= 80;
  const mapsSearch = (service: string) => {
    const query = serviceLocation
      ? `${service} near ${serviceLocation.latitude},${serviceLocation.longitude}`
      : `${service} near me`;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Location access is not available in this browser.');
      return;
    }

    setRequestingLocation(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setDeviceLocation({ latitude: coords.latitude, longitude: coords.longitude });
        setRequestingLocation(false);
      },
      (error) => {
        setLocationError(`Could not get your location: ${error.message}`);
        setRequestingLocation(false);
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60 * 1000 },
    );
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-ink-200 bg-white" aria-live="polite">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ink-100 px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-ink-600" />
            <h3 className="font-semibold text-ink-900">Hardware response simulation</h3>
          </div>
          <p className="mt-1 text-xs text-ink-500">Illustrative demo only — no physical hardware is connected or controlled.</p>
        </div>
        {simulation.activate && (
          <button
            type="button"
            onClick={() => setRun((current) => current + 1)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 px-3 py-2 text-xs font-medium text-ink-700 hover:bg-ink-50"
          >
            <RotateCcw size={14} /> Run again
          </button>
        )}
      </div>

      <div className={`hardware-simulation-scene p-5 ${running ? 'hardware-simulation-running' : ''}`}>
        <div className="relative mx-auto h-40 max-w-xl overflow-hidden rounded-xl border border-slate-600 bg-slate-900">
          <div className="absolute inset-x-0 top-5 h-2 rounded bg-slate-500" />
          <div className="absolute inset-x-0 bottom-5 h-2 rounded bg-slate-500" />
          <div className={`hardware-panel hardware-panel-${panelClass} absolute inset-x-[8%] top-10 bottom-10 overflow-hidden rounded border-2 border-slate-500 bg-sky-950`}>
            <div className="absolute inset-0 hardware-panel-grid" />
            {rainDetected && (
              <div className={`hardware-rain hardware-rain-${rainIntensity}`} aria-hidden="true">
                <i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i />
                <i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i />
              </div>
            )}
            {!rainDetected && showsWater && running && <div className="hardware-water-film" aria-hidden="true" />}
            {panelClass === 'dusty' && (
              <div className="hardware-dust-particles" aria-hidden="true">
                <i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i />
              </div>
            )}
            {panelClass === 'bird-drop' && <div className={`hardware-bird-mark ${running ? 'hardware-bird-mark-cleaning' : ''}`} aria-hidden="true" />}
            {panelClass === 'snow-covered' && <div className={`hardware-snow-cover ${running ? 'hardware-snow-melting' : ''}`} aria-hidden="true" />}
            {(panelClass === 'electrical-damage' || panelClass === 'physical-damage') && (
              <div className="hardware-fault-mark" aria-hidden="true">{panelClass === 'electrical-damage' ? '!' : '╱'}</div>
            )}
            <div className="absolute inset-0 flex items-center justify-center text-xs font-medium uppercase tracking-[0.2em] text-sky-100/70">
              Solar panel
            </div>
          </div>
          {showsBrush && (
            <div className={`hardware-brush absolute left-[9%] top-8 z-10 h-24 w-[18%] rounded-md border-2 border-slate-300 bg-slate-400/90 ${running ? 'hardware-brush-moving' : ''}`}>
              <div className="absolute inset-x-1 top-1/2 h-2 -translate-y-1/2 rounded bg-amber-300" />
            </div>
          )}
          {simulation.method.id === 'defrost_heater' && (
            <div className={`hardware-heater absolute inset-x-[12%] top-[44%] z-10 h-2 rounded ${running ? 'hardware-heater-active' : ''}`} />
          )}
          {showsWater && running && !rainDetected && (
            <div className="hardware-water-spray absolute inset-x-[12%] top-[43%] z-20 h-6" aria-hidden="true">
              <i /><i /><i /><i /><i />
            </div>
          )}
          {rainDetected && (
            <span className="absolute right-3 top-2 rounded bg-sky-950/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-sky-100">
              Rain {rainAmount != null ? `${rainAmount.toFixed(1)} mm/h` : 'detected'}
            </span>
          )}
          <span className="absolute bottom-1 left-3 text-[10px] font-medium uppercase tracking-wider text-white/70">
            {running ? `${simulation.method.label}: simulated on` : `${simulation.method.label}: off`}
          </span>
        </div>

        <div className="mt-4 flex items-start gap-2">
          {simulation.method.id === 'defrost_heater'
            ? <Flame size={17} className="mt-0.5 shrink-0 text-orange-600" />
            : simulation.activate
              ? <Droplets size={17} className="mt-0.5 shrink-0 text-sky-600" />
              : simulation.method.id === 'lockout'
                ? <ShieldCheck size={17} className="mt-0.5 shrink-0 text-amber-600" />
                : <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-emerald-600" />}
          <div>
            <p className="text-sm font-semibold text-ink-800">{title}</p>
            <p className="mt-1 text-sm text-ink-600">{statusText}</p>
          </div>
        </div>

        {panelClass === 'snow-covered' && (
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <Sun size={19} className="mt-0.5 shrink-0 text-amber-600" />
            <div>
              <p className="text-sm font-semibold text-amber-950">Sunrise estimate</p>
              <p className="mt-1 text-sm text-amber-900">
                {sunriseCountdown ?? 'Sunrise time is unavailable; weather location data is needed for an estimate.'}
              </p>
              {weather?.sunrise_at && (
                <p className="mt-1 text-xs text-amber-800">
                  Local sunrise: {new Date(weather.sunrise_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                </p>
              )}
            </div>
          </div>
        )}

        {isDamage && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck size={19} className="mt-0.5 shrink-0 text-red-600" />
              <div>
                <p className="text-sm font-semibold text-red-900">Technical issue — contact a qualified solar technician</p>
                <p className="mt-1 text-sm text-red-800">
                  {panelClass === 'electrical-damage'
                    ? 'Electrical damage may be hazardous. Keep cleaning and electrical actuators disabled; do not touch damaged wiring or panel components.'
                    : 'Physical panel damage needs professional inspection. Automatic cleaning is locked out to avoid causing further damage.'}
                </p>
              </div>
            </div>

            <div className="mt-4 border-t border-red-200 pt-4">
              <h4 className="text-sm font-semibold text-red-950">Solar service contacts</h4>
              <p className="mt-1 text-xs text-red-800">
                {serviceLocation
                  ? `Showing nearby service searches for ${serviceLocation.latitude.toFixed(4)}, ${serviceLocation.longitude.toFixed(4)}.`
                  : 'Allow location access to find solar service companies near you. Your location is only used when opening a map search.'}
              </p>
              {!serviceLocation && (
                <button
                  type="button"
                  onClick={useCurrentLocation}
                  disabled={requestingLocation}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-3 py-2 text-xs font-medium text-red-900 hover:bg-red-100 disabled:opacity-60"
                >
                  <MapPin size={14} /> {requestingLocation ? 'Getting location…' : 'Use my current location'}
                </button>
              )}
              {locationError && <p role="alert" className="mt-2 text-xs text-red-800">{locationError}</p>}

              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <a
                  href={mapsSearch('solar electrical repair service')}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between gap-2 rounded-lg border border-red-200 bg-white p-3 text-xs font-medium text-ink-800 hover:bg-red-100"
                >
                  <span><MapPin size={14} className="mr-1 inline" />Nearby electrical repair</span>
                  <ExternalLink size={13} />
                </a>
                <a
                  href={mapsSearch('solar panel physical damage repair')}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between gap-2 rounded-lg border border-red-200 bg-white p-3 text-xs font-medium text-ink-800 hover:bg-red-100"
                >
                  <span><MapPin size={14} className="mr-1 inline" />Nearby panel-damage repair</span>
                  <ExternalLink size={13} />
                </a>
                <a
                  href={mapsSearch('solar panel repair and maintenance company')}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between gap-2 rounded-lg border border-red-200 bg-white p-3 text-xs font-medium text-ink-800 hover:bg-red-100"
                >
                  <span><MapPin size={14} className="mr-1 inline" />Nearby solar service companies</span>
                  <ExternalLink size={13} />
                </a>
              </div>

              <div className="mt-3 rounded-lg border border-red-200 bg-white p-3">
                <p className="text-xs font-semibold text-ink-900">Tata Power Solar — official customer support</p>
                <p className="mt-1 text-xs text-ink-600">
                  Call to ask about service options or a qualified local technician referral. Confirm repair availability for your system before booking.
                </p>
                <a href="tel:18004198777" className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-sky-800 hover:underline">
                  <Phone size={13} /> India support: 1800-419-8777
                </a>
                {isNearBengaluru && (
                  <p className="mt-1">
                    <a href="tel:+918067772000" className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-800 hover:underline">
                      <Phone size={13} /> Bengaluru office: +91 80 6777 2000 / 3000
                    </a>
                  </p>
                )}
                <a
                  href="https://www.tatapowersolar.com/contact-us/offices/"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-[11px] text-ink-500 hover:underline"
                >
                  Verify contact on Tata Power Solar <ExternalLink size={11} />
                </a>
              </div>
              <p className="mt-2 text-[11px] text-red-800">
                Confirm service coverage, warranty eligibility, and charges before booking. For electrical damage, stay clear of the panel and exposed wiring.
              </p>
            </div>
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <SimulationStatus icon={<ShieldCheck size={15} />} label="Controller" value="Decision received" />
          <SimulationStatus
            icon={<Wind size={15} />}
            label={simulation.method.id === 'defrost_heater' ? 'Defrost heater' : 'Cleaning actuator'}
            value={running ? `${simulation.method.label} active` : simulation.method.id === 'lockout' ? 'Locked out' : 'Off / parked'}
          />
          <SimulationStatus
            icon={<Droplets size={15} />}
            label="Water pump"
            value={running && showsWater ? 'Flowing (simulated)' : 'Off'}
          />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <SimulationStatus icon={<CheckCircle2 size={15} />} label="Simulation stage" value={running ? 'Actuator active' : simulation.activate ? 'Cycle complete' : 'Standby / lockout'} />
          <SimulationStatus icon={<Wind size={15} />} label="Estimated panel output" value={`${outputBefore}% → ${outputAfter}%`} />
          <SimulationStatus icon={<Droplets size={15} />} label="Illustrative water use" value={`${estimatedResourcesUsed ? simulation.method.waterL : 0} L`} />
          <SimulationStatus icon={<Flame size={15} />} label="Illustrative energy" value={`${estimatedResourcesUsed ? simulation.method.energyWh : 0} Wh`} />
        </div>

        <p className="mt-3 text-xs text-ink-500">
          Baseline estimated output loss for {prediction}: {SIM_OUTPUT_LOSS[panelClass]}%. Values are demo estimates, not measured system telemetry.
        </p>
      </div>
    </section>
  );
}

function SimulationStatus({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg bg-ink-50 p-3">
      <p className="flex items-center gap-1.5 text-xs text-ink-500">{icon}{label}</p>
      <p className="mt-1 text-xs font-semibold text-ink-800">{value}</p>
    </div>
  );
}

function isRainDetected(weather: WeatherSnapshot | null): boolean {
  if (!weather) return false;
  const code = weather.weather_code;
  const rainCode = code != null && (
    (code >= 51 && code <= 67)
    || (code >= 80 && code <= 82)
    || (code >= 95 && code <= 99)
  );
  const snowCode = code != null && (
    (code >= 71 && code <= 77)
    || code === 85
    || code === 86
  );
  return rainCode
    || (weather.rain_mm ?? 0) > 0
    || (weather.showers_mm ?? 0) > 0
    || (!snowCode && (weather.precipitation_mm ?? 0) > 0);
}

function formatSunriseCountdown(sunriseAt: string | null | undefined, now: number): string | null {
  if (!sunriseAt) return null;
  const sunrise = Date.parse(sunriseAt);
  if (!Number.isFinite(sunrise)) return null;
  const remainingMs = sunrise - now;
  if (remainingMs <= 0) return 'Sunrise has passed; daylight is expected now.';
  const minutes = Math.ceil(remainingMs / 60_000);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours === 0) return `Sunrise in ${remainingMinutes} minute${remainingMinutes === 1 ? '' : 's'}.`;
  return `Sunrise in ${hours} hour${hours === 1 ? '' : 's'} ${remainingMinutes} minute${remainingMinutes === 1 ? '' : 's'}.`;
}

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const latitudeDelta = radians(lat2 - lat1);
  const longitudeDelta = radians(lon2 - lon1);
  const value = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(longitudeDelta / 2) ** 2;
  return 6_371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}
