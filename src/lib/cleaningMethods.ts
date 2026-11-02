import type { CleaningDecision, WeatherSnapshot } from '@/types';

export type PanelClass =
  | 'clean'
  | 'dusty'
  | 'bird-drop'
  | 'snow-covered'
  | 'electrical-damage'
  | 'physical-damage';

export interface CleaningMethod {
  id: 'standby' | 'dry_brush' | 'water_spray' | 'spot_jet' | 'defrost_heater' | 'lockout';
  label: string;
  how: string;
  waterL: number;
  energyWh: number;
  durationS: number;
}

export interface CleaningActivation {
  method: CleaningMethod;
  activate: boolean;
  reason: string;
}

export const METHODS: Record<CleaningMethod['id'], CleaningMethod> = {
  standby: {
    id: 'standby',
    label: 'Standby',
    how: 'Keep all cleaning actuators parked.',
    waterL: 0,
    energyWh: 0,
    durationS: 0,
  },
  dry_brush: {
    id: 'dry_brush',
    label: 'Dry brush',
    how: 'A soft brush traverses the panel without using water.',
    waterL: 0,
    energyWh: 8,
    durationS: 15,
  },
  water_spray: {
    id: 'water_spray',
    label: 'Water spray',
    how: 'A light spray loosens dust in humid conditions before brushing.',
    waterL: 0.25,
    energyWh: 5,
    durationS: 18,
  },
  spot_jet: {
    id: 'spot_jet',
    label: 'Targeted jet',
    how: 'A short, targeted rinse treats bird-drop contamination.',
    waterL: 0.5,
    energyWh: 6,
    durationS: 12,
  },
  defrost_heater: {
    id: 'defrost_heater',
    label: 'Defrost heater',
    how: 'A low-power heater loosens frozen snow; no brush or pump is activated.',
    waterL: 0,
    energyWh: 30,
    durationS: 24,
  },
  lockout: {
    id: 'lockout',
    label: 'Safety lockout',
    how: 'Keep actuators disabled and request technician review.',
    waterL: 0,
    energyWh: 0,
    durationS: 0,
  },
};

export const SIM_OUTPUT_LOSS: Record<PanelClass, number> = {
  clean: 0,
  dusty: 28,
  'bird-drop': 16,
  'snow-covered': 35,
  'electrical-damage': 42,
  'physical-damage': 38,
};

const DAMAGE_CLASSES = new Set<PanelClass>(['electrical-damage', 'physical-damage']);

export function normalizePanelClass(prediction: string): PanelClass {
  const normalized = prediction.trim().toLowerCase().replace(/[_ ]/g, '-');
  switch (normalized) {
    case 'clean':
    case 'healthy':
    case 'normal':
      return 'clean';
    case 'dusty':
    case 'dust':
      return 'dusty';
    case 'bird-drop':
    case 'bird-dropping':
    case 'bird':
      return 'bird-drop';
    case 'snow-covered':
    case 'snow':
      return 'snow-covered';
    case 'electrical-damage':
    case 'electrical':
      return 'electrical-damage';
    case 'physical-damage':
    case 'physical':
      return 'physical-damage';
    default:
      return 'physical-damage';
  }
}

export function selectCleaningMethod(
  panelClass: PanelClass,
  decision: Pick<CleaningDecision, 'action'>,
  weather: WeatherSnapshot | null,
): CleaningActivation {
  if (panelClass === 'clean') {
    return { method: METHODS.standby, activate: false, reason: 'Clean panel detected; no actuator is needed.' };
  }

  if (DAMAGE_CLASSES.has(panelClass)) {
    return {
      method: METHODS.lockout,
      activate: false,
      reason: 'Damage faults require technician review. Cleaning actuators remain locked out for safety.',
    };
  }

  const rainNow = (weather?.precipitation_mm ?? 0) > 0
    || (weather?.rain_mm ?? 0) > 0
    || (weather?.showers_mm ?? 0) > 0;
  if (rainNow || decision.action === 'defer_for_rain') {
    return { method: METHODS.standby, activate: false, reason: 'Cleaning is deferred because rain is present or expected.' };
  }

  if (panelClass === 'dusty') {
    const method = (weather?.humidity_pct ?? 0) >= 85 ? METHODS.water_spray : METHODS.dry_brush;
    return { method, activate: true, reason: method.how };
  }

  if (panelClass === 'bird-drop') {
    return { method: METHODS.spot_jet, activate: true, reason: METHODS.spot_jet.how };
  }

  if (panelClass === 'snow-covered') {
    if (weather?.temperature_c != null && weather.temperature_c <= 0) {
      return { method: METHODS.defrost_heater, activate: true, reason: METHODS.defrost_heater.how };
    }
    return {
      method: METHODS.standby,
      activate: false,
      reason: 'Snow is not below freezing or temperature is unavailable; wait for safe natural melt.',
    };
  }

  return { method: METHODS.lockout, activate: false, reason: 'Unknown fault: actuators are locked out.' };
}

export function lossAfter(panelClass: PanelClass, method: CleaningMethod): number {
  const baseline = SIM_OUTPUT_LOSS[panelClass];
  if (panelClass === 'dusty' && (method.id === 'dry_brush' || method.id === 'water_spray')) return 4;
  if (panelClass === 'bird-drop' && method.id === 'spot_jet') return 2;
  if (panelClass === 'snow-covered' && method.id === 'defrost_heater') return 0;
  if (panelClass === 'clean' && method.id === 'standby') return 0;
  return baseline;
}
