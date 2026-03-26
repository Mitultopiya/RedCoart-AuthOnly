import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  getActivities,
  getCities,
  getHotels,
  getItineraryTemplates,
  getTravellingLocations,
  getTravellingPrices,
  getTravellingTypes,
  getVehicles,
} from '../../services/api';
import { branchParams } from '../../utils/branch';
import { getStoredUser } from '../../utils/auth';
import { getUniqueStates } from '../../utils/cities';
import { getTravellingRowAmount, normalizeTravellingType } from '../../utils/travelling';
import TripDetails from './RateCalculator/TripDetails';
import PassengerDetails from './RateCalculator/PassengerDetails';
import HotelInfo from './RateCalculator/HotelInfo';
import TransferDetails from './RateCalculator/TransferDetails';
import Activity from './RateCalculator/Activity';
import OtherSection from './RateCalculator/OtherSection';
import Button from '../../components/ui/Button';

const PREVIEW_STORAGE_KEY = 'vth_rate_calculator_preview';
const DRAFT_STORAGE_KEY = 'vth_rate_calculator_draft';

function parseItinerary(value) {
  if (!value) return [];
  return value
    .split('/')
    .map((chunk) => chunk.trim())
    .map((chunk) => {
      const match = chunk.match(/^(\d+)\s*N\s*(.+)$/i);
      if (!match) return null;
      return { nights: Number(match[1]), location: match[2].trim() };
    })
    .filter(Boolean);
}

function buildPlanFromDays(days = []) {
  const validDays = (Array.isArray(days) ? days : []).filter((d) => d?.city_name && Number(d?.night_count) > 0);
  if (!validDays.length) return '';
  return validDays.map((d) => `${Number(d.night_count)}N ${d.city_name}`).join(' / ');
}

function inr(amount) {
  return `Rs. ${Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getHotelStar(roomType) {
  const text = String(roomType || '').toLowerCase();
  const m = text.match(/([1-5])\s*\*|([1-5])\s*star/);
  if (m?.[1]) return m[1];
  if (m?.[2]) return m[2];
  const simple = text.match(/\b([1-5])\b/);
  return simple?.[1] || '';
}

const emptyTravellingRow = () => ({
  transport_type: 'Train',
  travelling_type_id: '',
  from_location_id: '',
  to_location_id: '',
  from_date: '',
  to_date: '',
});

function getTravellingPersonUnits(passenger) {
  const couples = Number(passenger?.couples || 0);
  const adults = Number(passenger?.adults || 0);
  const children = Number(passenger?.children || 0);
  return (couples * 2) + adults + (children * 0.5);
}

function buildPackageInfoText({
  trip,
  itineraryLabel,
  itineraryNote,
  stops,
  passenger,
  hotelRows,
  transfers,
  activities,
  travellingRows,
  other,
  hotelsMaster,
  vehiclesMaster,
  activitiesMaster,
  travellingPricesMaster,
  travellingLocationsMaster,
}) {
  const totalNights = stops.reduce((sum, s) => sum + Number(s.nights || 0), 0);
  const totalDays = Number(trip.nights || totalNights || 0);
  const couples = Number(passenger.couples || 0);
  const extraAdults = Number(passenger.adults || 0);
  const extraChildren = Number(passenger.children || 0);
  const paxMultiplier = couples + (extraChildren * 0.25);
  const roomCount = Math.max(1, couples || 0);
  const locationLines = stops.map((s) => `- ${s.nights}N ${s.location}`).join('\n');
  const hotelPriceMap = {};
  const hotelExtraAdultPriceMap = {};
  (hotelsMaster || []).forEach((h) => {
    if (!h?.name) return;
    hotelPriceMap[String(h.name).toLowerCase()] = Number(h.price || 0);
    hotelExtraAdultPriceMap[String(h.name).toLowerCase()] = Number(h.extra_adult_price || 0);
  });
  const vehiclePriceMap = {};
  (vehiclesMaster || []).forEach((v) => {
    if (!v?.name) return;
    vehiclePriceMap[String(v.name).toLowerCase()] = Number(v.price || 0);
  });
  const activityPriceMap = {};
  (activitiesMaster || []).forEach((a) => {
    if (!a?.name) return;
    activityPriceMap[String(a.name).toLowerCase()] = Number(a.price || 0);
  });

  const nightsByLocation = Object.fromEntries(stops.map((s) => [String(s.location).toLowerCase(), Number(s.nights || 0)]));

  const hotelDetails = hotelRows.map((row) => {
    const unit = hotelPriceMap[String(row.hotel || '').toLowerCase()] || 0;
    const extraAdultUnit = hotelExtraAdultPriceMap[String(row.hotel || '').toLowerCase()] || 0;
    const nights = nightsByLocation[String(row.location || '').toLowerCase()] || 0;
    const stayNights = Math.max(1, nights);
    const baseTotal = unit * stayNights * roomCount;
    const extraAdultTotal = extraAdults * extraAdultUnit * stayNights;
    const total = baseTotal + extraAdultTotal;
    return {
      ...row,
      nights,
      unit,
      extraAdultUnit,
      total,
    };
  });
  const hotelTotal = hotelDetails.reduce((sum, h) => sum + Number(h.total || 0), 0);
  const hotels = hotelDetails
    .map((row, idx) => (
      `${idx + 1}) ${row.location}: Hotel: ${row.hotel || '-'}\n` +
      `  Meal: ${row.meal || '-'}\n` +
      `  Nights: ${row.nights || 0} | Rooms: ${roomCount}`
    ))
    .join('\n\n') || '-';

  const transferDetails = (transfers || [])
    .filter((t) => t.vehicle)
    .map((t) => {
      const qty = Number(t.quantity || 1);
      const rate = vehiclePriceMap[String(t.vehicle || '').toLowerCase()] || 0;
      const amount = qty * rate * Math.max(1, totalDays);
      return { ...t, qty, rate, amount };
    });
  const transferTotal = transferDetails.reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const transferLines = transferDetails
    .map((t, idx) => `${idx + 1}) ${t.vehicle} x ${t.qty}`)
    .join('\n') || '-';

  const activityDetails = (activities || [])
    .filter((a) => a.activity)
    .map((a) => {
      const rate = activityPriceMap[String(a.activity || '').toLowerCase()] || 0;
      const amount = rate * Math.max(0, paxMultiplier);
      return { ...a, rate, amount };
    });
  const activityTotal = activityDetails.reduce((sum, a) => sum + Number(a.amount || 0), 0);
  const activityLines = activityDetails
    .map((a, idx) => `${idx + 1}) ${a.activity}`)
    .join('\n') || '-';

  const travellingLocationMap = Object.fromEntries(
    (travellingLocationsMaster || []).map((loc) => [Number(loc.id), loc])
  );
  const travellingPriceMap = Object.fromEntries(
    (travellingPricesMaster || []).map((price) => [
      `${normalizeTravellingType(price.transport_type)}|${Number(price.from_location_id)}|${Number(price.to_location_id)}`,
      price,
    ])
  );
  const travellingPersonUnits = Math.max(0, getTravellingPersonUnits(passenger));
  const travellingDetails = (travellingRows || [])
    .filter((row) => row.from_location_id && row.to_location_id && row.from_date)
    .map((row) => {
      const key = `${normalizeTravellingType(row.transport_type)}|${Number(row.from_location_id)}|${Number(row.to_location_id)}`;
      const priceRow = travellingPriceMap[key];
      const amountPerPerson = getTravellingRowAmount(priceRow, row.from_date, row.to_date);
      const amount = amountPerPerson * travellingPersonUnits;
      const fromLabel = travellingLocationMap[Number(row.from_location_id)]?.location_name || '-';
      const toLabel = travellingLocationMap[Number(row.to_location_id)]?.location_name || '-';
      return { ...row, amount, fromLabel, toLabel };
    });
  const travellingTotal = travellingDetails.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const travellingLines = travellingDetails
    .map((row, idx) => {
      const toDate = row.to_date || row.from_date;
      const dateLabel = toDate && toDate !== row.from_date
        ? `${row.from_date} to ${toDate}`
        : row.from_date;
      return (
        `${idx + 1}) ${row.transport_type} / ${row.type_name || '-'}\n` +
        `   Route: ${row.fromLabel} -> ${row.toLabel}\n` +
        `   Date: ${dateLabel}`
      );
    })
    .join('\n') || '-';

  const subtotal = hotelTotal + transferTotal + activityTotal + travellingTotal;
  const markupValue = Number(other.markup || 0);
  const grandTotal = subtotal + markupValue;
  const templateNote = String(itineraryNote || '').trim();

  return (
    `📦 PACKAGE INFO\n` +
    `============\n\n` +
    `🙏 Greetings from Vision Travel Hub,\n\n` +
    `🧭 Trip Details:\n` +
    `- State: ${trip.stateName || '-'}\n` +
    `- Nights: ${trip.nights || totalNights || '-'}\n` +
    `- Itinerary: ${itineraryLabel || '-'}\n` +
    `- Note: ${templateNote || '-'}\n\n` +
    `👨‍👩‍👧 Passenger Details:\n` +
    `- Travel Date: ${passenger.travelDate || '-'}\n` +
    `- No. of Couples: ${passenger.couples || '0'}\n` +
    `- Adults: ${passenger.adults || '0'}\n` +
    `- Children (6-10 yrs): ${passenger.children || '0'}\n\n` +
    `Dear Customer, please find below your ${totalNights} Nights itinerary:\n` +
    `${locationLines}\n\n` +
    `📞 Phone Number: ${other.companyContact || '-'}\n` +
    `🏢 Company: ${other.companyName || '-'}\n\n` +
    `🏨 Hotels:\n${hotels}\n\n` +
    `🚕 Transfers:\n${transferLines}\n\n` +
    `🛫 Travelling:\n${travellingLines}\n\n` +
    `🎯 Activities:\n${activityLines}\n\n` +
    `💰 PRICE SUMMARY:\n` +
    `- GRAND TOTAL: ${inr(grandTotal)}`
  );
}

export default function RateCalculator() {
  const navigate = useNavigate();
  const location = useLocation();
  const currentUser = getStoredUser();
  const isStaffUser = String(currentUser?.role || '').toLowerCase() === 'staff';
  const staffMobile = String(
    currentUser?.mobile
    || currentUser?.phone
    || currentUser?.phone_number
    || currentUser?.contact_mobile
    || ''
  ).trim();
  const defaultCompanyContact = isStaffUser && staffMobile ? staffMobile : '7818814380';
  const isEditMode = useMemo(() => new URLSearchParams(location.search).get('edit') === '1', [location.search]);
  const [trip, setTrip] = useState({
    stateName: '',
    nights: '',
    itineraryId: '',
  });
  const [passenger, setPassenger] = useState({
    travelDate: '',
    couples: '1',
    adults: '0',
    children: '0',
  });
  const [transfers, setTransfers] = useState([{ vehicle: '', quantity: '1' }]);
  const [travellingRows, setTravellingRows] = useState([emptyTravellingRow()]);
  const [activities, setActivities] = useState([{ activity: '' }]);
  const [other, setOther] = useState({
    markup: '0',
    companyContact: defaultCompanyContact,
    companyName: 'Vision Travel Hub',
  });
  const [hotelStarFilter, setHotelStarFilter] = useState('');
  const [hotelInfoRows, setHotelInfoRows] = useState([]);
  const [itineraryTemplates, setItineraryTemplates] = useState([]);
  const [cities, setCities] = useState([]);
  const [hotels, setHotels] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [activityMasters, setActivityMasters] = useState([]);
  const [travellingTypesMaster, setTravellingTypesMaster] = useState([]);
  const [travellingLocationsMaster, setTravellingLocationsMaster] = useState([]);
  const [travellingPricesMaster, setTravellingPricesMaster] = useState([]);
  const [draftLoaded, setDraftLoaded] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isEditMode) {
      sessionStorage.removeItem(DRAFT_STORAGE_KEY);
      setDraftLoaded(true);
      return;
    }
    try {
      const raw = sessionStorage.getItem(DRAFT_STORAGE_KEY);
      if (raw) {
        const draft = JSON.parse(raw);
        if (draft?.trip) setTrip(draft.trip);
        if (draft?.passenger) setPassenger(draft.passenger);
        if (Array.isArray(draft?.transfers)) setTransfers(draft.transfers);
        if (Array.isArray(draft?.travellingRows)) setTravellingRows(draft.travellingRows);
        if (Array.isArray(draft?.activities)) setActivities(draft.activities);
        if (draft?.other) setOther(draft.other);
        if (Array.isArray(draft?.hotelInfoRows)) setHotelInfoRows(draft.hotelInfoRows);
      }
    } catch {
      // ignore corrupt draft data
    } finally {
      setDraftLoaded(true);
    }
  }, [isEditMode]);

  useEffect(() => {
    if (typeof window === 'undefined' || !draftLoaded) return;
    const draft = {
      trip,
      passenger,
      transfers,
      travellingRows,
      activities,
      other,
      hotelInfoRows,
    };
    sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
  }, [trip, passenger, transfers, travellingRows, activities, other, hotelInfoRows, draftLoaded]);

  useEffect(() => {
    const params = branchParams('all');
    Promise.allSettled([
      getItineraryTemplates(params),
      getCities(params),
      getHotels(params),
      getVehicles(params),
      getActivities(params),
      getTravellingTypes(params),
      getTravellingLocations(params),
      getTravellingPrices(params),
    ])
      .then((results) => {
        const [itinerariesRes, citiesRes, hotelsRes, vehiclesRes, activitiesRes, travellingTypesRes, travellingLocationsRes, travellingPricesRes] = results;
        setItineraryTemplates(
          itinerariesRes.status === 'fulfilled'
            ? (itinerariesRes.value.data || []).filter((t) => t.is_active)
            : []
        );
        setCities(citiesRes.status === 'fulfilled' ? (citiesRes.value.data || []) : []);
        setHotels(hotelsRes.status === 'fulfilled' ? (hotelsRes.value.data || []) : []);
        setVehicles(vehiclesRes.status === 'fulfilled' ? (vehiclesRes.value.data || []) : []);
        setActivityMasters(activitiesRes.status === 'fulfilled' ? (activitiesRes.value.data || []) : []);
        setTravellingTypesMaster(travellingTypesRes.status === 'fulfilled' ? (travellingTypesRes.value.data || []) : []);
        setTravellingLocationsMaster(travellingLocationsRes.status === 'fulfilled' ? (travellingLocationsRes.value.data || []) : []);
        setTravellingPricesMaster(travellingPricesRes.status === 'fulfilled' ? (travellingPricesRes.value.data || []) : []);
      });
  }, []);

  const selectedTemplate = useMemo(
    () => itineraryTemplates.find((item) => String(item.id) === String(trip.itineraryId)) || null,
    [itineraryTemplates, trip.itineraryId]
  );
  const parsedStops = useMemo(() => {
    if (selectedTemplate?.days?.length) {
      return selectedTemplate.days.map((d) => ({
        nights: Number(d.night_count || 0),
        location: d.city_name || '',
      })).filter((d) => d.location);
    }
    return parseItinerary(selectedTemplate?.plan || '');
  }, [selectedTemplate]);
  const autoNights = useMemo(
    () => parsedStops.reduce((sum, stop) => sum + Number(stop.nights || 0), 0),
    [parsedStops]
  );
  const itineraryOptions = useMemo(() => {
    return itineraryTemplates.map((t) => {
      const days = Array.isArray(t.days) ? t.days : [];
      const planLabel = buildPlanFromDays(days) || t.plan || t.title || `Itinerary ${t.id}`;
      const total = days.length
        ? days.reduce((sum, d) => sum + Number(d.night_count || 0), 0)
        : Number(t.total_nights || 0);
      return {
        id: t.id,
        label: planLabel,
        stateName: t.state_name || '',
        totalNights: total,
      };
    });
  }, [itineraryTemplates]);
  const stateOptions = useMemo(
    () => getUniqueStates(itineraryTemplates.map((t) => ({ country: t.state_name }))),
    [itineraryTemplates]
  );
  const stateFilteredItineraryOptions = useMemo(() => {
    if (!trip.stateName) return [];
    return itineraryOptions.filter((item) => String(item.stateName || '').trim() === String(trip.stateName).trim());
  }, [itineraryOptions, trip.stateName]);
  const availableNights = useMemo(
    () => [...new Set(stateFilteredItineraryOptions.map((item) => Number(item.totalNights || 0)).filter((n) => n > 0))].sort((a, b) => a - b),
    [stateFilteredItineraryOptions]
  );
  const filteredItineraryOptions = useMemo(() => {
    if (!trip.stateName) return [];
    if (!trip.nights) return stateFilteredItineraryOptions;
    return stateFilteredItineraryOptions.filter((item) => Number(item.totalNights) === Number(trip.nights));
  }, [trip.stateName, trip.nights, stateFilteredItineraryOptions]);
  const noItineraryForSelectedNights = Boolean(trip.nights) && filteredItineraryOptions.length === 0;
  const cityIdToName = useMemo(
    () => Object.fromEntries(cities.map((city) => [Number(city.id), city.name])),
    [cities]
  );
  const hotelOptionsByLocation = useMemo(() => {
    const grouped = {};
    for (const hotel of hotels) {
      const location = cityIdToName[Number(hotel.city_id)];
      if (!location) continue;
      if (!grouped[location]) grouped[location] = [];
      grouped[location].push({ name: hotel.name, star: getHotelStar(hotel.room_type) });
    }
    return grouped;
  }, [hotels, cityIdToName]);
  useEffect(() => {
    if (!hotelStarFilter) return;
    setHotelInfoRows((prev) => prev.map((row) => {
      const options = (hotelOptionsByLocation[row.location] || []).filter((h) => !h.star || h.star === hotelStarFilter);
      const exists = options.some((h) => h.name === row.hotel);
      return exists ? row : { ...row, hotel: '' };
    }));
  }, [hotelStarFilter, hotelOptionsByLocation]);
  const vehicleOptions = useMemo(
    () => [...new Set(vehicles.map((v) => v.name).filter(Boolean))],
    [vehicles]
  );
  const activityOptions = useMemo(
    () => [...new Set(activityMasters.map((a) => a.name).filter(Boolean))],
    [activityMasters]
  );
  const activityRateMap = useMemo(
    () => Object.fromEntries(activityMasters.map((a) => [String(a.name || '').toLowerCase(), Number(a.price || 0)])),
    [activityMasters]
  );
  const travellingTypesByMode = useMemo(() => {
    const grouped = { Train: [], Flight: [] };
    (travellingTypesMaster || []).forEach((row) => {
      const mode = normalizeTravellingType(row.transport_type);
      grouped[mode].push(row);
    });
    return grouped;
  }, [travellingTypesMaster]);
  const travellingLocationsByModeType = useMemo(() => {
    const grouped = {};
    (travellingLocationsMaster || []).forEach((row) => {
      const mode = normalizeTravellingType(row.transport_type);
      const typeId = Number(row.travelling_type_id || 0);
      const key = `${mode}|${typeId}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(row);
    });
    return grouped;
  }, [travellingLocationsMaster]);
  const travellingPriceMap = useMemo(
    () =>
      Object.fromEntries(
        (travellingPricesMaster || []).map((price) => [
          `${normalizeTravellingType(price.transport_type)}|${Number(price.from_location_id)}|${Number(price.to_location_id)}`,
          price,
        ])
      ),
    [travellingPricesMaster]
  );
  const getTravellingAmount = (row) => {
    const key = `${normalizeTravellingType(row.transport_type)}|${Number(row.from_location_id)}|${Number(row.to_location_id)}`;
    const units = Math.max(0, getTravellingPersonUnits(passenger));
    const amountPerPerson = getTravellingRowAmount(travellingPriceMap[key], row.from_date, row.to_date);
    return amountPerPerson * units;
  };
  useEffect(() => {
    if (!trip.itineraryId) return;
    const existsInFiltered = filteredItineraryOptions.some((item) => String(item.id) === String(trip.itineraryId));
    if (!existsInFiltered) {
      setTrip((prev) => ({ ...prev, itineraryId: '' }));
    }
  }, [filteredItineraryOptions, trip.itineraryId, trip.stateName]);

  const nightsOptions = availableNights;

  const hotelRows = useMemo(
    () => parsedStops.map((stop) => ({ location: stop.location, hotel: '', meal: '' })),
    [parsedStops]
  );

  useEffect(() => {
    setHotelInfoRows((prev) => {
      const prevByLocation = new Map((prev || []).map((row) => [row.location, row]));
      const merged = hotelRows.map((row) => {
        const existing = prevByLocation.get(row.location);
        return existing ? { ...row, ...existing, location: row.location } : row;
      });
      return merged;
    });
  }, [hotelRows]);

  const isValidForCalculation = Boolean(trip.itineraryId && passenger.travelDate && parsedStops.length);
  const handleCalculate = () => {
    const text = buildPackageInfoText({
      trip,
      itineraryLabel: selectedTemplate?.title || '',
      itineraryNote: selectedTemplate?.notes || '',
      stops: parsedStops,
      passenger,
      hotelRows: hotelInfoRows,
      transfers,
      activities,
      travellingRows: travellingRows.map((row) => {
        const typeName = travellingTypesMaster.find((t) => Number(t.id) === Number(row.travelling_type_id))?.name || '';
        return { ...row, type_name: typeName };
      }),
      other,
      hotelsMaster: hotels,
      vehiclesMaster: vehicles,
      activitiesMaster: activityMasters,
      travellingLocationsMaster,
      travellingPricesMaster,
    });
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(PREVIEW_STORAGE_KEY, text);
    }
    navigate('preview');
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      <h1 className="text-2xl font-bold text-slate-800">Rate Calculator</h1>

      <TripDetails
        stateName={trip.stateName}
        setStateName={(value) => setTrip((prev) => ({ ...prev, stateName: value, nights: '', itineraryId: '' }))}
        stateOptions={stateOptions}
        nights={trip.nights || (autoNights ? String(autoNights) : '')}
        setNights={(value) => setTrip((prev) => ({ ...prev, nights: value, itineraryId: '' }))}
        itineraryId={trip.itineraryId}
        setItineraryId={(value) => {
          const selected = filteredItineraryOptions.find((item) => String(item.id) === String(value));
          setTrip((prev) => ({
            ...prev,
            itineraryId: value,
            nights: selected?.totalNights ? String(selected.totalNights) : prev.nights,
            stateName: selected?.stateName || prev.stateName,
          }));
        }}
        parsedStops={parsedStops}
        itineraryOptions={filteredItineraryOptions}
        nightsOptions={nightsOptions}
        noItineraryForSelectedNights={noItineraryForSelectedNights}
      />

      <PassengerDetails form={passenger} setForm={setPassenger} />

      <HotelInfo
        rows={hotelInfoRows}
        setRows={setHotelInfoRows}
        hotelOptionsByLocation={hotelOptionsByLocation}
        hotelStarFilter={hotelStarFilter}
        setHotelStarFilter={setHotelStarFilter}
      />


      <TransferDetails transfers={transfers} setTransfers={setTransfers} vehicleOptions={vehicleOptions} />

      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm sm:text-base font-semibold text-slate-800">Travelling</h3>
          <Button type="button" size="sm" onClick={() => setTravellingRows((prev) => [...prev, emptyTravellingRow()])}>+ Add Row</Button>
        </div>
        {travellingRows.map((row, idx) => {
          const mode = normalizeTravellingType(row.transport_type);
          const typeOptions = travellingTypesByMode[mode] || [];
          const locationOptions = travellingLocationsByModeType[`${mode}|${Number(row.travelling_type_id || 0)}`] || [];
          const amount = getTravellingAmount(row);
          return (
            <div key={idx} className="grid grid-cols-1 md:grid-cols-8 gap-2 items-end">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Transport Type</label>
                <select value={row.transport_type} onChange={(e) => setTravellingRows((prev) => prev.map((r, i) => (i === idx ? { ...r, transport_type: e.target.value, travelling_type_id: '', from_location_id: '', to_location_id: '' } : r)))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                  <option value="Train">Train</option>
                  <option value="Flight">Flight</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
                <select value={row.travelling_type_id} onChange={(e) => setTravellingRows((prev) => prev.map((r, i) => (i === idx ? { ...r, travelling_type_id: e.target.value, from_location_id: '', to_location_id: '' } : r)))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                  <option value="">Select type</option>
                  {typeOptions.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">From Location</label>
                <select value={row.from_location_id} onChange={(e) => setTravellingRows((prev) => prev.map((r, i) => (i === idx ? { ...r, from_location_id: e.target.value } : r)))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                  <option value="">Select from</option>
                  {locationOptions.map((l) => <option key={l.id} value={l.id}>{l.location_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">To Location</label>
                <select value={row.to_location_id} onChange={(e) => setTravellingRows((prev) => prev.map((r, i) => (i === idx ? { ...r, to_location_id: e.target.value } : r)))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                  <option value="">Select to</option>
                  {locationOptions.map((l) => <option key={l.id} value={l.id}>{l.location_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
                <input type="date" value={row.from_date} onChange={(e) => setTravellingRows((prev) => prev.map((r, i) => (i === idx ? { ...r, from_date: e.target.value } : r)))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Price</label>
                <input value={amount ? `Rs. ${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'} readOnly className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-700 font-medium" />
              </div>
              <div>
                <Button type="button" variant="danger" size="sm" onClick={() => setTravellingRows((prev) => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev)} disabled={travellingRows.length === 1}>Remove</Button>
              </div>
            </div>
          );
        })}
      </div>

      <Activity
        activities={activities}
        setActivities={setActivities}
        activityOptions={activityOptions}
        activityRateMap={activityRateMap}
      />

      <OtherSection other={other} setOther={setOther} />

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleCalculate}
          disabled={!isValidForCalculation}
          className="h-10 px-4 rounded-lg bg-primary-600 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary-700 transition"
        >
          Calculate Trip Cost
        </button>
      </div>
    </div>
  );
}
