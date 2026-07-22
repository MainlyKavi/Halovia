"use client";

import { useEffect, useId, useRef, useState } from "react";
import { LoaderCircle, MapPin, RefreshCw, Search } from "lucide-react";
import { useApp } from "@/components/app/AppProvider";
import { haversineMetres } from "@/lib/backend/validation";
import { LOCATION_POLICY } from "@/lib/config";
import { logOpenMapDevelopmentError, MAP_SEARCH_ENDPOINT } from "@/lib/open-map";

export interface DestinationSelection {
  name: string;
  latitude: number;
  longitude: number;
  placeId?: string;
}

interface Coordinate {
  latitude: number;
  longitude: number;
}

interface PhotonFeature {
  geometry: { coordinates: [number, number]; type: "Point" };
  properties: {
    city?: string;
    country?: string;
    district?: string;
    name?: string;
    osm_id?: number;
    osm_type?: string;
    postcode?: string;
    state?: string;
    street?: string;
  };
}

interface PhotonResponse { features?: PhotonFeature[] }

interface DestinationSuggestion extends DestinationSelection {
  id: string;
  primary: string;
  secondary: string;
  distanceMetres?: number;
}

function uniqueParts(parts: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  return parts.filter((part): part is string => {
    const normalized = part?.trim();
    if (!normalized || seen.has(normalized.toLocaleLowerCase())) return false;
    seen.add(normalized.toLocaleLowerCase());
    return true;
  });
}

function suggestionFromFeature(feature: PhotonFeature, index: number, bias?: Coordinate | null): DestinationSuggestion | null {
  const [longitude, latitude] = feature.geometry.coordinates;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const primary = feature.properties.name ?? feature.properties.street ?? feature.properties.city;
  if (!primary) return null;
  const secondaryParts = uniqueParts([
    feature.properties.street === primary ? undefined : feature.properties.street,
    feature.properties.district,
    feature.properties.city === primary ? undefined : feature.properties.city,
    feature.properties.state,
    feature.properties.postcode,
    feature.properties.country,
  ]);
  const secondary = secondaryParts.join(", ");
  const name = [primary, secondary].filter(Boolean).join(", ");
  return {
    id: `${feature.properties.osm_type ?? "place"}:${feature.properties.osm_id ?? index}:${longitude}:${latitude}`,
    name,
    primary,
    secondary,
    latitude,
    longitude,
    placeId: feature.properties.osm_id ? `${feature.properties.osm_type ?? "osm"}:${feature.properties.osm_id}` : undefined,
    distanceMetres: bias ? haversineMetres(bias, { latitude, longitude }) : undefined,
  };
}

export function DestinationSearch({
  value,
  onChange,
  bias,
}: {
  value: DestinationSelection | null;
  onChange: (selection: DestinationSelection | null) => void;
  bias?: Coordinate | null;
}) {
  const { t, state } = useApp();
  const listId = useId();
  const onChangeRef = useRef(onChange);
  const requestSequence = useRef(0);
  const [query, setQuery] = useState(value?.name ?? "");
  const [suggestions, setSuggestions] = useState<DestinationSuggestion[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [retryNonce, setRetryNonce] = useState(0);
  const biasLatitude = bias?.latitude;
  const biasLongitude = bias?.longitude;

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const input = query.trim();
    const sequence = ++requestSequence.current;
    if (input === value?.name || input.length < LOCATION_POLICY.destinationSearchMinimumCharacters) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const url = new URL(MAP_SEARCH_ENDPOINT, window.location.origin);
      url.searchParams.set("q", input);
      url.searchParams.set("limit", "5");
      if (biasLatitude !== undefined && biasLongitude !== undefined) {
        url.searchParams.set("lat", String(biasLatitude));
        url.searchParams.set("lon", String(biasLongitude));
      }
      setStatus("loading");
      void fetch(url, { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) throw new Error(`search_${response.status}`);
          return response.json() as Promise<PhotonResponse>;
        })
        .then((result) => {
          if (sequence !== requestSequence.current) return;
          const nextSuggestions = (result.features ?? [])
            .map((feature, index) => suggestionFromFeature(feature, index, bias))
            .filter((suggestion): suggestion is DestinationSuggestion => Boolean(suggestion));
          setSuggestions(nextSuggestions);
          setActiveIndex(nextSuggestions.length ? 0 : -1);
          setStatus("ready");
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          logOpenMapDevelopmentError("destination search", error);
          if (sequence === requestSequence.current) {
            setSuggestions([]);
            setActiveIndex(-1);
            setStatus("error");
          }
        });
    }, LOCATION_POLICY.destinationSearchDebounceMs);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [bias, biasLatitude, biasLongitude, query, retryNonce, value?.name]);

  function updateQuery(nextQuery: string) {
    setQuery(nextQuery);
    if (nextQuery.trim().length < LOCATION_POLICY.destinationSearchMinimumCharacters) {
      setSuggestions([]);
      setActiveIndex(-1);
      setStatus("idle");
    }
    if (value && nextQuery !== value.name) onChangeRef.current(null);
  }

  function selectSuggestion(suggestion: DestinationSuggestion) {
    const selection: DestinationSelection = {
      name: suggestion.name,
      latitude: suggestion.latitude,
      longitude: suggestion.longitude,
      placeId: suggestion.placeId,
    };
    onChangeRef.current(selection);
    setQuery(selection.name);
    setSuggestions([]);
    setActiveIndex(-1);
    setStatus("ready");
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!suggestions.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => (current <= 0 ? suggestions.length - 1 : current - 1));
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      selectSuggestion(suggestions[activeIndex]);
    } else if (event.key === "Escape") {
      setSuggestions([]);
      setActiveIndex(-1);
    }
  }

  return (
    <div className="destination-search">
      <div className="destination-input-wrap">
        <Search size={18} aria-hidden="true" />
        <input
          className="input destination-input"
          value={query}
          placeholder={t("map.searchPlaceholder")}
          aria-label={t("map.searchPlaceholder")}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={suggestions.length > 0}
          aria-controls={listId}
          aria-activedescendant={activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
          onChange={(event) => updateQuery(event.target.value)}
          onKeyDown={onKeyDown}
        />
        {status === "loading" && <LoaderCircle className="spin" size={18} aria-label={t("common.loading")} />}
      </div>
      {suggestions.length > 0 && <ul id={listId} className="destination-suggestions" role="listbox" aria-label={t("map.searchDescription")}>
        {suggestions.map((suggestion, index) => <li key={suggestion.id}><button id={`${listId}-${index}`} type="button" role="option" aria-selected={activeIndex === index} className={activeIndex === index ? "active" : ""} onMouseEnter={() => setActiveIndex(index)} onClick={() => selectSuggestion(suggestion)}><MapPin size={17} /><span><strong>{suggestion.primary}</strong><small>{suggestion.secondary}</small></span>{suggestion.distanceMetres !== undefined && <em>{new Intl.NumberFormat(state.user.locale, { style: "unit", unit: suggestion.distanceMetres >= 1000 ? "kilometer" : "meter", maximumFractionDigits: 1 }).format(suggestion.distanceMetres >= 1000 ? suggestion.distanceMetres / 1000 : suggestion.distanceMetres)}</em>}</button></li>)}
      </ul>}
      {status === "ready" && query.trim().length >= LOCATION_POLICY.destinationSearchMinimumCharacters && !suggestions.length && !value && <p className="field-hint" role="status">{t("map.noResults")}</p>}
      {status === "idle" && query.trim().length > 0 && query.trim().length < LOCATION_POLICY.destinationSearchMinimumCharacters && <p className="field-hint">{t("map.searchHint")}</p>}
      {status === "error" && <div className="inline-retry" role="alert"><span>{t("map.searchError")}</span><button type="button" onClick={() => { setStatus("loading"); setRetryNonce((current) => current + 1); }}><RefreshCw size={15} />{t("common.retry")}</button></div>}
    </div>
  );
}
