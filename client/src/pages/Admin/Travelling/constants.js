export const TRANSPORT_OPTIONS = ['Train', 'Flight'];

export const TYPE_OPTIONS_BY_MODE = {
  Train: ['1AC', '2AC', '3AC', '3AC Economy', 'Chair Car (CC)', 'Sleeper (SL)'],
  Flight: ['Economy Class', 'Premium Economy', 'Business Class', 'First Class'],
};

export function normalizeTransportType(value) {
  const text = String(value || '').trim().toLowerCase();
  if (text === 'train') return 'Train';
  if (text === 'flight') return 'Flight';
  return 'Train';
}

export function getSuggestedTypes(transportType) {
  return TYPE_OPTIONS_BY_MODE[normalizeTransportType(transportType)] || [];
}

export function getLocationLabel(transportType) {
  return normalizeTransportType(transportType) === 'Train' ? 'Platform Name' : 'Airport Name';
}
