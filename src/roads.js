import React, {
  useState,
  useMemo,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { MapPin, AlertCircle, Construction, Eye } from "lucide-react";

// ============================================================================
// CONSTANTS & THEME
// ============================================================================

const THEME = {
  colors: {
    black: "#000000",
    white: "#FFFFFF",
    gray: {
      dark: "#333333",
      medium: "#666666",
      light: "#999999",
      lighter: "#CCCCCC",
      lightest: "#E0E0E0",
      background: "#F5F5F5",
      backgroundAlt: "#FAFAFA",
    },
  },
  typography: {
    sizes: {
      xlarge: "1.5rem",
      large: "1.1rem",
      base: "0.9rem",
      small: "0.75rem",
      xsmall: "0.7rem",
      xxsmall: "0.65rem",
      tiny: "0.6rem",
    },
    weights: {
      light: "300",
      normal: "400",
      medium: "500",
      semibold: "600",
      bold: "700",
    },
  },
  spacing: {
    xs: "0.25rem",
    sm: "0.5rem",
    md: "0.75rem",
    lg: "1rem",
    xl: "1.5rem",
    xxl: "2rem",
  },
};

const MAP_CONFIG = {
  center: [19.076, 72.8777], // Mumbai
  initialZoom: 12,
  minZoom: 8,
  maxZoom: 18,
  clusterRadiusPixels: 50,
  localPatternRadius: 200, // meters for nearby pattern analysis
};

const PATTERN_MODE = {
  NONE: "none",
  CITY_WIDE: "city_wide",
  LOCAL: "local",
};

const TIME_WINDOWS = {
  "24h": { ms: 24 * 60 * 60 * 1000, label: "24h" },
  "7d": { ms: 7 * 24 * 60 * 60 * 1000, label: "7d" },
  "30d": { ms: 30 * 24 * 60 * 60 * 1000, label: "30d" },
  persistent: { ms: Infinity, label: "All" },
};

// ============================================================================
// DATA LAYER (Seeded for deterministic mock data)
// ============================================================================

class ObservationDataService {
  static seed = 12345; // Fixed seed for deterministic data

  static seededRandom() {
    const x = Math.sin(this.seed++) * 10000;
    return x - Math.floor(x);
  }

  static generateMockObservations(count = 150) {
    const types = ["violation", "risk", "infrastructure"];
    const statuses = [
      "under_review",
      "acknowledged",
      "resolved",
      "dismissed",
      "pending",
    ];

    const baseLocations = [
      { lat: 19.076, lng: 72.8777, name: "South Mumbai" },
      { lat: 19.0176, lng: 72.8561, name: "Colaba" },
      { lat: 19.0896, lng: 72.8656, name: "Bandra" },
      { lat: 19.1136, lng: 72.8697, name: "Andheri" },
      { lat: 19.2183, lng: 72.9781, name: "Thane" },
    ];

    const sampleMedia = [
      {
        type: "image",
        url: "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=400",
      },
      {
        type: "image",
        url: "https://images.unsplash.com/photo-1502877338535-766e1452684a?w=400",
      },
      {
        type: "image",
        url: "https://images.unsplash.com/photo-1486299267070-83823f5448dd?w=400",
      },
      { type: "video", url: "https://www.w3schools.com/html/mov_bbb.mp4" },
      {
        type: "image",
        url: "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=400",
      },
      null,
      null,
    ];

    return Array.from({ length: count }, (_, i) => {
      const baseLocation =
        baseLocations[Math.floor(this.seededRandom() * baseLocations.length)];
      const media =
        sampleMedia[Math.floor(this.seededRandom() * sampleMedia.length)];
      const timestamp =
        Date.now() - this.seededRandom() * 30 * 24 * 60 * 60 * 1000;

      return {
        id: `obs_${String(i).padStart(4, "0")}`,
        type: types[Math.floor(this.seededRandom() * types.length)],
        lat: baseLocation.lat + (this.seededRandom() - 0.5) * 0.05,
        lng: baseLocation.lng + (this.seededRandom() - 0.5) * 0.05,
        timestamp,
        status: statuses[Math.floor(this.seededRandom() * statuses.length)],
        description: "Observed behavior pattern",
        reviewed_at: timestamp + this.seededRandom() * 15 * 24 * 60 * 60 * 1000,
        response_time: Math.floor(this.seededRandom() * 14) + 1,
        media: media ? { ...media, metadataStripped: true } : null,
        hasMultipleMedia: this.seededRandom() > 0.7,
      };
    });
  }
}

// ============================================================================
// UTILITIES
// ============================================================================

const TimeUtils = {
  getDaysAgo(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    if (diff < 0) return 0; // Prevent negative values
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  },

  getTimeWindow(timestamp) {
    const date = new Date(timestamp);
    const hour = date.getHours();

    if (hour < 6) return "Early morning";
    if (hour < 10) return "Morning peak";
    if (hour < 16) return "Midday";
    if (hour < 20) return "Evening peak";
    return "Night hours";
  },

  formatRelativeTime(timestamp) {
    const daysAgo = this.getDaysAgo(timestamp);
    if (daysAgo === 0) return "Today";
    if (daysAgo === 1) return "1 day ago";
    return `${daysAgo} days ago`;
  },
};

const StatsUtils = {
  calculateObservationStats(observations) {
    const total = observations.length;

    if (total === 0) {
      return {
        total: 0,
        byType: { violation: 0, risk: 0, infrastructure: 0 },
        avgResponseTime: 0,
        reviewRate: "0.0",
      };
    }

    const byType = {
      violation: observations.filter((o) => o.type === "violation").length,
      risk: observations.filter((o) => o.type === "risk").length,
      infrastructure: observations.filter((o) => o.type === "infrastructure")
        .length,
    };

    const withResponseTime = observations.filter(
      (o) => o.response_time && o.response_time > 0
    );
    const avgResponseTime =
      withResponseTime.length > 0
        ? Math.round(
            withResponseTime.reduce((acc, o) => acc + o.response_time, 0) /
              withResponseTime.length
          )
        : 0;

    const reviewed = observations.filter((o) => o.status !== "pending").length;
    const reviewRate =
      total > 0 ? ((reviewed / total) * 100).toFixed(1) : "0.0";

    return { total, byType, avgResponseTime, reviewRate };
  },
};

const MapUtils = {
  getMarkerRadius(zoomLevel) {
    if (zoomLevel <= 10) return 6;
    if (zoomLevel <= 13) return 5;
    return 4;
  },

  getMarkerWeight(status) {
    const weights = {
      pending: 1,
      under_review: 2,
      acknowledged: 2,
      resolved: 3,
      dismissed: 1,
    };
    return weights[status] || 1;
  },

  getClusterSize(count) {
    if (count > 50) return "large";
    if (count > 10) return "medium";
    return "small";
  },

  getClusterDimensions(size) {
    const dimensions = {
      large: { width: 50, height: 50, fontSize: "16px" },
      medium: { width: 40, height: 40, fontSize: "14px" },
      small: { width: 32, height: 32, fontSize: "12px" },
    };
    return dimensions[size] || dimensions.small;
  },

  // Calculate distance between two lat/lng points in meters (Haversine formula)
  getDistance(lat1, lng1, lat2, lng2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lng2 - lng1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  },

  // Get bounding box that contains all points
  getBoundsForPoints(points) {
    if (points.length === 0) return null;

    let minLat = points[0].lat;
    let maxLat = points[0].lat;
    let minLng = points[0].lng;
    let maxLng = points[0].lng;

    points.forEach((p) => {
      if (p.lat < minLat) minLat = p.lat;
      if (p.lat > maxLat) maxLat = p.lat;
      if (p.lng < minLng) minLng = p.lng;
      if (p.lng > maxLng) maxLng = p.lng;
    });

    return [
      [minLat, minLng],
      [maxLat, maxLng],
    ];
  },
};

const PatternUtils = {
  // Filter observations matching a pattern type
  getMatchingObservations(observations, referenceObservation) {
    return observations.filter((obs) => obs.type === referenceObservation.type);
  },

  // Get observations within radius of a point
  getNearbyObservations(observations, centerLat, centerLng, radiusMeters) {
    return observations.filter((obs) => {
      const distance = MapUtils.getDistance(
        centerLat,
        centerLng,
        obs.lat,
        obs.lng
      );
      return distance <= radiusMeters;
    });
  },

  // Calculate pattern statistics for city-wide analysis
  calculateCityWideStats(observations, timeWindowMs) {
    const now = Date.now();
    const recentObs = observations.filter(
      (obs) => now - obs.timestamp < timeWindowMs
    );

    // Calculate unique zones (simplified grid-based approach)
    const uniqueZones = new Set(
      observations.map(
        (obs) => `${Math.floor(obs.lat * 100)}_${Math.floor(obs.lng * 100)}`
      )
    ).size;

    // Calculate trend (compare first half vs second half of time window)
    const midpoint = now - timeWindowMs / 2;
    const recentCount = observations.filter(
      (obs) => obs.timestamp > midpoint
    ).length;
    const olderCount = observations.filter(
      (obs) => obs.timestamp <= midpoint
    ).length;

    let trend = "stable";
    if (recentCount > olderCount * 1.2) trend = "increasing";
    else if (recentCount < olderCount * 0.8) trend = "declining";

    return {
      total: observations.length,
      affectedZones: uniqueZones,
      trend,
      recentCount,
    };
  },

  // Calculate local pattern statistics
  calculateLocalStats(observations, timeWindowMs) {
    if (observations.length === 0) return null;

    const timestamps = observations
      .map((o) => o.timestamp)
      .sort((a, b) => a - b);
    const timeSpan = timestamps[timestamps.length - 1] - timestamps[0];
    const timeSpanDays = Math.ceil(timeSpan / (1000 * 60 * 60 * 24));

    // Local trend
    const now = Date.now();
    const midpoint = now - timeWindowMs / 2;
    const recentCount = observations.filter(
      (obs) => obs.timestamp > midpoint
    ).length;
    const olderCount = observations.filter(
      (obs) => obs.timestamp <= midpoint
    ).length;

    let trend = "stable";
    if (recentCount > olderCount * 1.2) trend = "increasing";
    else if (recentCount < olderCount * 0.8) trend = "declining";

    return {
      count: observations.length,
      timeSpanDays,
      trend,
    };
  },
};

const ContentUtils = {
  getTypeLabel(type) {
    const labels = {
      violation: "Violation",
      risk: "Risk Behavior",
      infrastructure: "Infrastructure",
    };
    return labels[type] || "Observation";
  },

  getStatusExplanation(status) {
    const explanations = {
      resolved:
        "Marked resolved following infrastructure adjustment in this area.",
      acknowledged:
        "Acknowledged and under continued monitoring by traffic management.",
      pending: "Currently in institutional review queue.",
      dismissed:
        "Reviewed and determined non-actionable based on pattern analysis.",
      under_review: "Under evaluation by municipal traffic authority.",
    };
    return explanations[status] || "Status under review.";
  },

  getOutcomeDetails(status) {
    const details = {
      resolved: {
        change: "Road marking restoration",
        authority: "Municipal roads division",
      },
      acknowledged: {
        change: "Monitoring protocol active",
        authority: "Traffic management cell",
      },
      dismissed: {
        change:
          "Pattern analysis determined no systemic intervention required at this time.",
        authority: null,
      },
    };
    return details[status] || null;
  },
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const RoadCommonsTransparency = () => {
  // State
  const [lens, setLens] = useState("all");
  const [timeFilter, setTimeFilter] = useState("30d");
  const [zoomLevel, setZoomLevel] = useState(MAP_CONFIG.initialZoom);
  const [selectedObservation, setSelectedObservation] = useState(null);
  const [expandedDetail, setExpandedDetail] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [visibleObservations, setVisibleObservations] = useState([]);

  // Pattern analysis mode state
  const [patternMode, setPatternMode] = useState(PATTERN_MODE.NONE);
  const [patternData, setPatternData] = useState(null);
  const [savedMapState, setSavedMapState] = useState(null);

  // Refs
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersLayerRef = useRef(null);
  const sidebarContentRef = useRef(null);
  const localPatternCircleRef = useRef(null);

  // Generate observations once (deterministic)
  const observations = useMemo(
    () => ObservationDataService.generateMockObservations(150),
    []
  );

  // Memoized filtered data
  const filteredData = useMemo(() => {
    let filtered = observations;

    // Apply lens filter
    if (lens !== "all") {
      filtered = filtered.filter((obs) => obs.type === lens);
    }

    // Apply time filter
    const now = Date.now();
    const timeWindow = TIME_WINDOWS[timeFilter];
    if (timeWindow && timeWindow.ms !== Infinity) {
      filtered = filtered.filter((obs) => now - obs.timestamp < timeWindow.ms);
    }

    return filtered;
  }, [observations, lens, timeFilter]);

  // Calculate stats from visible or filtered data
  const stats = useMemo(() => {
    const dataToUse =
      visibleObservations.length > 0 ? visibleObservations : filteredData;
    return StatsUtils.calculateObservationStats(dataToUse);
  }, [visibleObservations, filteredData]);

  // Check if selected observation is still in filtered dataset
  useEffect(() => {
    if (
      selectedObservation &&
      !filteredData.find((obs) => obs.id === selectedObservation.id)
    ) {
      setSelectedObservation(null);
      setExpandedDetail(false);
    }
  }, [filteredData, selectedObservation]);

  // Reset sidebar scroll when new observation selected
  useEffect(() => {
    if (selectedObservation && sidebarContentRef.current) {
      sidebarContentRef.current.scrollTop = 0;
    }
  }, [selectedObservation]);

  // Load Leaflet dynamically
  useEffect(() => {
    if (typeof window === "undefined" || mapLoaded) return;

    const loadLeaflet = () => {
      if (window.L) {
        setMapLoaded(true);
        return;
      }

      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);

      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.onload = () => {
        const clusterCSS = document.createElement("link");
        clusterCSS.rel = "stylesheet";
        clusterCSS.href =
          "https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css";
        document.head.appendChild(clusterCSS);

        const clusterDefaultCSS = document.createElement("link");
        clusterDefaultCSS.rel = "stylesheet";
        clusterDefaultCSS.href =
          "https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css";
        document.head.appendChild(clusterDefaultCSS);

        const clusterScript = document.createElement("script");
        clusterScript.src =
          "https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js";
        clusterScript.onload = () => setMapLoaded(true);
        clusterScript.onerror = () =>
          console.error("Failed to load Leaflet MarkerCluster");
        document.head.appendChild(clusterScript);
      };
      script.onerror = () => console.error("Failed to load Leaflet");
      document.head.appendChild(script);
    };

    loadLeaflet();
  }, [mapLoaded]);

  // Initialize map (once)
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || mapInstanceRef.current) return;

    try {
      const L = window.L;

      const map = L.map(mapRef.current, {
        center: MAP_CONFIG.center,
        zoom: MAP_CONFIG.initialZoom,
        zoomControl: true,
        minZoom: MAP_CONFIG.minZoom,
        maxZoom: MAP_CONFIG.maxZoom,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        className: "grayscale-tiles",
      }).addTo(map);

      map.on("zoom", () => setZoomLevel(map.getZoom()));

      mapInstanceRef.current = map;
    } catch (error) {
      console.error("Map initialization failed:", error);
    }

    return () => {
      if (mapInstanceRef.current) {
        try {
          // Remove local pattern circle if exists
          if (localPatternCircleRef.current) {
            mapInstanceRef.current.removeLayer(localPatternCircleRef.current);
            localPatternCircleRef.current = null;
          }
          mapInstanceRef.current.remove();
        } catch (error) {
          console.error("Map cleanup failed:", error);
        }
        mapInstanceRef.current = null;
      }
    };
  }, [mapLoaded]);

  // Track visible observations based on map bounds
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const map = mapInstanceRef.current;

    const updateVisibleObservations = () => {
      try {
        const bounds = map.getBounds();
        const visible = filteredData.filter((obs) =>
          bounds.contains([obs.lat, obs.lng])
        );

        setVisibleObservations((prev) => {
          // Only update if actually different
          if (
            prev.length === visible.length &&
            prev.every((obs, idx) => obs.id === visible[idx]?.id)
          ) {
            return prev;
          }
          return visible;
        });
      } catch (error) {
        console.error("Failed to update visible observations:", error);
      }
    };

    map.on("moveend", updateVisibleObservations);
    map.on("zoomend", updateVisibleObservations);

    updateVisibleObservations();

    return () => {
      map.off("moveend", updateVisibleObservations);
      map.off("zoomend", updateVisibleObservations);
    };
  }, [filteredData]);

  // Update markers when filtered data changes
  useEffect(() => {
    if (!mapInstanceRef.current || !window.L) return;

    try {
      const L = window.L;
      const map = mapInstanceRef.current;

      if (markersLayerRef.current) {
        map.removeLayer(markersLayerRef.current);
      }

      const markers = L.markerClusterGroup({
        maxClusterRadius: MAP_CONFIG.clusterRadiusPixels,
        iconCreateFunction: function (cluster) {
          const count = cluster.getChildCount();
          const size = MapUtils.getClusterSize(count);
          const dims = MapUtils.getClusterDimensions(size);

          return L.divIcon({
            html: `<div style="
              width: ${dims.width}px;
              height: ${dims.height}px;
              border: 2px solid ${THEME.colors.black};
              background: ${THEME.colors.white};
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              font-family: 'IBM Plex Mono', monospace;
              font-size: ${dims.fontSize};
              font-weight: 600;
              color: ${THEME.colors.black};
            ">${count}</div>`,
            className: "custom-cluster-icon",
            iconSize: L.point(dims.width, dims.height),
          });
        },
      });

      filteredData.forEach((obs) => {
        const isSelected = selectedObservation?.id === obs.id;

        // Apply pattern mode emphasis
        let fillOpacity = 0.9;
        let strokeOpacity = 1.0;
        let weight = MapUtils.getMarkerWeight(obs.status);

        if (patternMode === PATTERN_MODE.CITY_WIDE && patternData) {
          const isEmphasized = obs.type === patternData.type;
          fillOpacity = isEmphasized ? 0.9 : 0.3;
          strokeOpacity = isEmphasized ? 1.0 : 0.3;
          weight = isEmphasized ? weight + 1 : 1;
        } else if (patternMode === PATTERN_MODE.LOCAL && patternData) {
          const isEmphasized = patternData.observations.some(
            (o) => o.id === obs.id
          );
          fillOpacity = isEmphasized ? 0.9 : 0.3;
          strokeOpacity = isEmphasized ? 1.0 : 0.3;
          weight = isEmphasized ? weight + 1 : 1;
        }

        const marker = L.circleMarker([obs.lat, obs.lng], {
          radius: MapUtils.getMarkerRadius(zoomLevel),
          color: THEME.colors.black,
          fillColor: isSelected ? THEME.colors.black : THEME.colors.white,
          fillOpacity: fillOpacity,
          weight: weight,
          opacity: strokeOpacity,
          zIndex: isSelected ? 1000 : 1,
        });

        marker.bindPopup(`
          <div style="font-family: 'IBM Plex Mono', monospace; font-size: ${
            THEME.typography.sizes.xsmall
          };">
            <strong>${ContentUtils.getTypeLabel(obs.type)}</strong><br/>
            ${obs.id}
          </div>
        `);

        marker.on("click", () => {
          // In pattern mode, clicking markers does nothing
          if (patternMode === PATTERN_MODE.NONE) {
            setSelectedObservation(obs);
            setExpandedDetail(false);
            setSidebarOpen(true);
          }
        });

        markers.addLayer(marker);
      });

      map.addLayer(markers);
      markersLayerRef.current = markers;
    } catch (error) {
      console.error("Failed to update markers:", error);
    }
  }, [filteredData, selectedObservation, zoomLevel, patternMode, patternData]);

  // Pattern analysis handlers
  const handleCityWidePattern = useCallback(() => {
    if (!selectedObservation || !mapInstanceRef.current) return;

    const map = mapInstanceRef.current;
    const L = window.L;

    // Save current state for restoration
    setSavedMapState({
      center: map.getCenter(),
      zoom: map.getZoom(),
      selectedObservation,
    });

    // Filter matching observations
    const matchingObs = PatternUtils.getMatchingObservations(
      filteredData,
      selectedObservation
    );

    // Calculate stats
    const timeWindowMs = TIME_WINDOWS[timeFilter].ms;
    const stats = PatternUtils.calculateCityWideStats(
      matchingObs,
      timeWindowMs
    );

    // Zoom to fit all matching observations
    const bounds = MapUtils.getBoundsForPoints(matchingObs);
    if (bounds) {
      map.fitBounds(bounds, { padding: [50, 50], animate: true });
    }

    // Set pattern mode
    setPatternMode(PATTERN_MODE.CITY_WIDE);
    setPatternData({
      type: selectedObservation.type,
      observations: matchingObs,
      stats,
    });
    setSelectedObservation(null);
    setExpandedDetail(false);
  }, [selectedObservation, filteredData, timeFilter]);

  const handleLocalPattern = useCallback(() => {
    if (!selectedObservation || !mapInstanceRef.current) return;

    const map = mapInstanceRef.current;
    const L = window.L;

    // Save current state
    setSavedMapState({
      center: map.getCenter(),
      zoom: map.getZoom(),
      selectedObservation,
    });

    // Get nearby matching observations
    const nearbyObs = PatternUtils.getNearbyObservations(
      filteredData.filter((obs) => obs.type === selectedObservation.type),
      selectedObservation.lat,
      selectedObservation.lng,
      MAP_CONFIG.localPatternRadius
    );

    // Calculate local stats
    const timeWindowMs = TIME_WINDOWS[timeFilter].ms;
    const stats = PatternUtils.calculateLocalStats(nearbyObs, timeWindowMs);

    // Center map on selected observation
    map.setView(
      [selectedObservation.lat, selectedObservation.lng],
      map.getZoom(),
      { animate: true }
    );

    // Draw proximity circle
    if (localPatternCircleRef.current) {
      map.removeLayer(localPatternCircleRef.current);
    }

    const circle = L.circle(
      [selectedObservation.lat, selectedObservation.lng],
      {
        radius: MAP_CONFIG.localPatternRadius,
        color: THEME.colors.gray.medium,
        fillColor: "transparent",
        weight: 1,
        opacity: 0.5,
        dashArray: "5, 5",
      }
    ).addTo(map);

    localPatternCircleRef.current = circle;

    // Set pattern mode
    setPatternMode(PATTERN_MODE.LOCAL);
    setPatternData({
      type: selectedObservation.type,
      observations: nearbyObs,
      stats,
      center: { lat: selectedObservation.lat, lng: selectedObservation.lng },
    });
    setSelectedObservation(null);
    setExpandedDetail(false);
  }, [selectedObservation, filteredData, timeFilter]);

  const handleClearPatternMode = useCallback(() => {
    if (!mapInstanceRef.current || !savedMapState) return;

    const map = mapInstanceRef.current;

    // Remove local pattern circle if exists
    if (localPatternCircleRef.current) {
      map.removeLayer(localPatternCircleRef.current);
      localPatternCircleRef.current = null;
    }

    // Restore map state
    map.setView(savedMapState.center, savedMapState.zoom, { animate: true });

    // Restore selection
    setSelectedObservation(savedMapState.selectedObservation);

    // Clear pattern mode
    setPatternMode(PATTERN_MODE.NONE);
    setPatternData(null);
    setSavedMapState(null);
  }, [savedMapState]);

  // Pattern context generation (memoized to avoid re-calculation)
  const getPatternContext = useCallback((observation) => {
    const nearbyCount = Math.floor(Math.random() * 15) + 3;
    const cityAvg = Math.random() > 0.5 ? "more frequently" : "less frequently";
    const trend = ["increasing", "stable", "declining"][
      Math.floor(Math.random() * 3)
    ];
    const frequency = Math.random() > 0.5 ? "+40%" : "-25%";
    const trendSymbol =
      trend === "increasing"
        ? "↑ Rising"
        : trend === "declining"
        ? "↓ Declining"
        : "→ Stable";

    return {
      summary: `This behavior is observed ${cityAvg} than city average in this area. Reports have been ${trend} over the past 30 days.`,
      nearbyCount,
      trend: trendSymbol,
      frequency,
    };
  }, []);

  const isViewportFiltered =
    visibleObservations.length > 0 &&
    visibleObservations.length !== filteredData.length;

  return (
    <div
      style={{
        width: "100%",
        height: "100vh",
        background: THEME.colors.white,
        fontFamily: "'IBM Plex Mono', 'Courier New', monospace",
        color: THEME.colors.black,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <header
        style={{
          borderBottom: `1px solid ${THEME.colors.black}`,
          padding: `${THEME.spacing.lg} ${THEME.spacing.xl}`,
          background: THEME.colors.white,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            maxWidth: "100%",
          }}
        >
          <div>
            <h1
              style={{
                fontSize: THEME.typography.sizes.base,
                fontWeight: THEME.typography.weights.semibold,
                letterSpacing: "0.02em",
                margin: `0 0 ${THEME.spacing.xs} 0`,
                textTransform: "uppercase",
              }}
            >
              Road Commons Observatory
            </h1>
            <p
              style={{
                fontSize: THEME.typography.sizes.small,
                margin: 0,
                color: THEME.colors.gray.medium,
                fontWeight: THEME.typography.weights.normal,
                maxWidth: "600px",
              }}
            >
              A public observatory for aggregated road behavior and
              infrastructure signals
            </p>
          </div>

          <div
            style={{
              display: "flex",
              gap: THEME.spacing.xxl,
              fontSize: THEME.typography.sizes.small,
              fontWeight: THEME.typography.weights.medium,
            }}
          >
            <div>
              <span style={{ color: THEME.colors.gray.medium }}>
                OBSERVATIONS{isViewportFiltered ? " (IN VIEW)" : ""}:
              </span>
              <span style={{ marginLeft: THEME.spacing.sm }}>
                {stats.total}
              </span>
            </div>
            <div>
              <span style={{ color: THEME.colors.gray.medium }}>REVIEWED:</span>
              <span style={{ marginLeft: THEME.spacing.sm }}>
                {stats.reviewRate}%
              </span>
            </div>
            <div>
              <span style={{ color: THEME.colors.gray.medium }}>
                AVG RESPONSE:
              </span>
              <span style={{ marginLeft: THEME.spacing.sm }}>
                {stats.avgResponseTime}d
              </span>
            </div>
          </div>
        </div>
      </header>

      <div
        style={{
          flex: 1,
          display: "flex",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Map Surface */}
        <div
          style={{
            flex: 1,
            position: "relative",
            background: THEME.colors.gray.background,
          }}
        >
          {/* Controls Overlay */}
          <div
            style={{
              position: "absolute",
              top: THEME.spacing.lg,
              left: THEME.spacing.lg,
              zIndex: 1000,
              background: THEME.colors.white,
              border: `1px solid ${THEME.colors.black}`,
              padding: THEME.spacing.md,
            }}
          >
            <div style={{ marginBottom: THEME.spacing.md }}>
              <div
                style={{
                  fontSize: THEME.typography.sizes.tiny,
                  fontWeight: THEME.typography.weights.semibold,
                  letterSpacing: "0.1em",
                  marginBottom: THEME.spacing.sm,
                  color: THEME.colors.black,
                }}
              >
                LENS
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: THEME.spacing.xs,
                }}
              >
                {[
                  { value: "all", label: "All" },
                  { value: "violation", label: "Violations" },
                  { value: "risk", label: "Risk" },
                  { value: "infrastructure", label: "Infrastructure" },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setLens(option.value)}
                    aria-label={`Filter by ${option.label}`}
                    aria-pressed={lens === option.value}
                    style={{
                      padding: `${THEME.spacing.sm} ${THEME.spacing.md}`,
                      border: "none",
                      borderLeft: `3px solid ${
                        lens === option.value
                          ? THEME.colors.black
                          : "transparent"
                      }`,
                      background:
                        lens === option.value
                          ? THEME.colors.gray.background
                          : "transparent",
                      cursor: "pointer",
                      fontSize: THEME.typography.sizes.xsmall,
                      textAlign: "left",
                      fontWeight:
                        lens === option.value
                          ? THEME.typography.weights.semibold
                          : THEME.typography.weights.normal,
                      color: THEME.colors.black,
                      fontFamily: "inherit",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div
              style={{
                borderTop: `1px solid ${THEME.colors.gray.lightest}`,
                paddingTop: THEME.spacing.md,
              }}
            >
              <div
                style={{
                  fontSize: THEME.typography.sizes.tiny,
                  fontWeight: THEME.typography.weights.semibold,
                  letterSpacing: "0.1em",
                  marginBottom: THEME.spacing.sm,
                  color: THEME.colors.black,
                }}
              >
                PERIOD
              </div>
              <div
                style={{
                  display: "flex",
                  gap: THEME.spacing.sm,
                  fontSize: THEME.typography.sizes.xsmall,
                }}
              >
                {Object.entries(TIME_WINDOWS).map(([value, config]) => (
                  <button
                    key={value}
                    onClick={() => setTimeFilter(value)}
                    aria-label={`Filter by ${config.label}`}
                    aria-pressed={timeFilter === value}
                    style={{
                      padding: `${THEME.spacing.xs} ${THEME.spacing.sm}`,
                      border: `1px solid ${THEME.colors.black}`,
                      background:
                        timeFilter === value
                          ? THEME.colors.black
                          : THEME.colors.white,
                      color:
                        timeFilter === value
                          ? THEME.colors.white
                          : THEME.colors.black,
                      cursor: "pointer",
                      fontSize: THEME.typography.sizes.xsmall,
                      fontWeight: THEME.typography.weights.medium,
                      fontFamily: "inherit",
                    }}
                  >
                    {config.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Zoom Level Indicator */}
          <div
            style={{
              position: "absolute",
              bottom: THEME.spacing.lg,
              left: THEME.spacing.lg,
              zIndex: 1000,
              background: THEME.colors.white,
              border: `1px solid ${THEME.colors.black}`,
              padding: `${THEME.spacing.sm} ${THEME.spacing.md}`,
              fontSize: THEME.typography.sizes.xsmall,
              fontWeight: THEME.typography.weights.medium,
            }}
          >
            {zoomLevel <= 10 ? "DISTRICT" : zoomLevel <= 14 ? "WARD" : "STREET"}
          </div>

          {/* Map Container */}
          <div
            ref={mapRef}
            style={{
              width: "100%",
              height: "100%",
              filter: "grayscale(100%) contrast(1.1)",
            }}
          />

          {!mapLoaded && (
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                fontSize: THEME.typography.sizes.base,
                color: THEME.colors.gray.medium,
              }}
            >
              Loading map...
            </div>
          )}
        </div>

        {/* Sidebar */}
        {sidebarOpen && (
          <div
            style={{
              width: "340px",
              borderLeft: `1px solid ${THEME.colors.black}`,
              background: THEME.colors.white,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <div
              ref={sidebarContentRef}
              style={{
                flex: 1,
                overflow: "auto",
                padding: THEME.spacing.xl,
              }}
            >
              {selectedObservation ? (
                <ObservationDetail
                  observation={selectedObservation}
                  patternContext={getPatternContext(selectedObservation)}
                  expandedDetail={expandedDetail}
                  onToggleExpanded={() => setExpandedDetail(!expandedDetail)}
                  onBack={() => {
                    setSelectedObservation(null);
                    setExpandedDetail(false);
                  }}
                  onCityWidePattern={handleCityWidePattern}
                  onLocalPattern={handleLocalPattern}
                />
              ) : patternMode !== PATTERN_MODE.NONE && patternData ? (
                <PatternAnalysisView
                  mode={patternMode}
                  data={patternData}
                  typeLabel={ContentUtils.getTypeLabel(patternData.type)}
                  onClear={handleClearPatternMode}
                />
              ) : (
                <CurrentViewSummary
                  stats={stats}
                  isViewportFiltered={isViewportFiltered}
                />
              )}
            </div>
          </div>
        )}

        {/* Sidebar toggle when closed */}
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Open data panel"
            style={{
              position: "absolute",
              right: 0,
              top: "50%",
              transform: "translateY(-50%)",
              padding: `${THEME.spacing.xxl} ${THEME.spacing.sm}`,
              background: THEME.colors.white,
              border: `1px solid ${THEME.colors.black}`,
              borderRight: "none",
              cursor: "pointer",
              fontSize: THEME.typography.sizes.xsmall,
              fontWeight: THEME.typography.weights.semibold,
              writingMode: "vertical-rl",
              letterSpacing: "0.1em",
              fontFamily: "inherit",
              zIndex: 1000,
            }}
          >
            DATA
          </button>
        )}
      </div>

      {/* Footer */}
      <footer
        style={{
          borderTop: `1px solid ${THEME.colors.black}`,
          padding: `${THEME.spacing.md} ${THEME.spacing.xl}`,
          fontSize: THEME.typography.sizes.tiny,
          color: THEME.colors.gray.medium,
          textAlign: "center",
          background: THEME.colors.white,
          fontStyle: "italic",
        }}
      >
        This is an observatory, not a courtroom. Data shown reflects reported
        observations.
      </footer>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@300;400;600&display=swap');
        
        * {
          box-sizing: border-box;
        }
        
        button:hover {
          opacity: 0.8;
        }
        
        button:active {
          opacity: 0.6;
        }
        
        button:focus-visible {
          outline: 2px solid ${THEME.colors.black};
          outline-offset: 2px;
        }
        
        .leaflet-control-zoom {
          border: 1px solid ${THEME.colors.black} !important;
          border-radius: 0 !important;
        }
        
        .leaflet-control-zoom a {
          background: ${THEME.colors.white} !important;
          color: ${THEME.colors.black} !important;
          border: none !important;
          border-bottom: 1px solid ${THEME.colors.black} !important;
          border-radius: 0 !important;
          font-family: 'IBM Plex Mono', monospace !important;
          font-weight: 600 !important;
          width: 30px !important;
          height: 30px !important;
          line-height: 30px !important;
        }
        
        .leaflet-control-zoom a:last-child {
          border-bottom: none !important;
        }
        
        .leaflet-control-zoom a:hover {
          background: ${THEME.colors.gray.background} !important;
        }
        
        .leaflet-bar {
          box-shadow: none !important;
        }
        
        .custom-cluster-icon {
          background: transparent !important;
        }
        
        .marker-cluster {
          background: transparent !important;
        }
        
        .leaflet-popup-content-wrapper {
          background: ${THEME.colors.white};
          border: 1px solid ${THEME.colors.black};
          border-radius: 0;
          box-shadow: none;
          padding: 8px;
        }
        
        .leaflet-popup-tip {
          background: ${THEME.colors.white};
          border: 1px solid ${THEME.colors.black};
          box-shadow: none;
        }
        
        .leaflet-popup-close-button {
          color: ${THEME.colors.black} !important;
          font-size: 18px !important;
          font-weight: bold !important;
        }
      `}</style>
    </div>
  );
};

// ============================================================================
// SUBCOMPONENTS
// ============================================================================

const CurrentViewSummary = ({ stats, isViewportFiltered }) => (
  <div>
    <div
      style={{
        fontSize: THEME.typography.sizes.tiny,
        fontWeight: THEME.typography.weights.semibold,
        letterSpacing: "0.1em",
        marginBottom: THEME.spacing.lg,
        color: THEME.colors.black,
      }}
    >
      CURRENT VIEW{isViewportFiltered ? " · MAP VIEWPORT" : ""}
    </div>

    <table
      style={{
        width: "100%",
        fontSize: THEME.typography.sizes.small,
        borderCollapse: "collapse",
        marginBottom: THEME.spacing.xxl,
      }}
    >
      <tbody>
        <tr style={{ borderBottom: `1px solid ${THEME.colors.gray.lightest}` }}>
          <td
            style={{
              padding: `${THEME.spacing.sm} 0`,
              fontWeight: THEME.typography.weights.semibold,
            }}
          >
            Total
          </td>
          <td
            style={{
              padding: `${THEME.spacing.sm} 0`,
              textAlign: "right",
              fontSize: THEME.typography.sizes.xlarge,
              fontFamily: "'IBM Plex Sans', sans-serif",
              fontWeight: THEME.typography.weights.light,
            }}
          >
            {stats.total}
          </td>
        </tr>
        <tr style={{ borderBottom: `1px solid ${THEME.colors.gray.lightest}` }}>
          <td
            style={{
              padding: `${THEME.spacing.sm} 0`,
              color: THEME.colors.gray.medium,
            }}
          >
            Violations
          </td>
          <td style={{ padding: `${THEME.spacing.sm} 0`, textAlign: "right" }}>
            {stats.byType.violation}
          </td>
        </tr>
        <tr style={{ borderBottom: `1px solid ${THEME.colors.gray.lightest}` }}>
          <td
            style={{
              padding: `${THEME.spacing.sm} 0`,
              color: THEME.colors.gray.medium,
            }}
          >
            Risk
          </td>
          <td style={{ padding: `${THEME.spacing.sm} 0`, textAlign: "right" }}>
            {stats.byType.risk}
          </td>
        </tr>
        <tr>
          <td
            style={{
              padding: `${THEME.spacing.sm} 0`,
              color: THEME.colors.gray.medium,
            }}
          >
            Infrastructure
          </td>
          <td style={{ padding: `${THEME.spacing.sm} 0`, textAlign: "right" }}>
            {stats.byType.infrastructure}
          </td>
        </tr>
      </tbody>
    </table>

    <div
      style={{
        borderTop: `2px solid ${THEME.colors.black}`,
        paddingTop: THEME.spacing.lg,
      }}
    >
      <div
        style={{
          fontSize: THEME.typography.sizes.tiny,
          fontWeight: THEME.typography.weights.semibold,
          letterSpacing: "0.1em",
          marginBottom: THEME.spacing.lg,
          color: THEME.colors.black,
        }}
      >
        INSTITUTIONAL METRICS
      </div>

      <table
        style={{
          width: "100%",
          fontSize: THEME.typography.sizes.small,
          borderCollapse: "collapse",
          marginBottom: THEME.spacing.lg,
        }}
      >
        <tbody>
          <tr
            style={{ borderBottom: `1px solid ${THEME.colors.gray.lightest}` }}
          >
            <td
              style={{
                padding: `${THEME.spacing.sm} 0`,
                color: THEME.colors.gray.medium,
              }}
            >
              Review Rate
            </td>
            <td
              style={{
                padding: `${THEME.spacing.sm} 0`,
                textAlign: "right",
                fontWeight: THEME.typography.weights.semibold,
              }}
            >
              {stats.reviewRate}%
            </td>
          </tr>
          <tr>
            <td
              style={{
                padding: `${THEME.spacing.sm} 0`,
                color: THEME.colors.gray.medium,
              }}
            >
              Avg Response
            </td>
            <td
              style={{
                padding: `${THEME.spacing.sm} 0`,
                textAlign: "right",
                fontWeight: THEME.typography.weights.semibold,
              }}
            >
              {stats.avgResponseTime} days
            </td>
          </tr>
        </tbody>
      </table>

      <div
        style={{
          fontSize: THEME.typography.sizes.tiny,
          lineHeight: "1.5",
          color: THEME.colors.gray.light,
          fontStyle: "italic",
        }}
      >
        Visibility indicators, not performance targets.
      </div>
    </div>

    <div
      style={{
        marginTop: THEME.spacing.xxl,
        paddingTop: THEME.spacing.lg,
        borderTop: `1px solid ${THEME.colors.gray.lightest}`,
      }}
    >
      <div
        style={{
          fontSize: THEME.typography.sizes.xsmall,
          lineHeight: "1.6",
          color: THEME.colors.gray.medium,
        }}
      >
        Each observation contributes to pattern recognition. This observatory
        exists to inform collective understanding and institutional response.
      </div>
    </div>
  </div>
);

const ObservationDetail = ({
  observation,
  patternContext,
  expandedDetail,
  onToggleExpanded,
  onBack,
  onCityWidePattern,
  onLocalPattern,
}) => (
  <div>
    {/* Back Button */}
    <button
      onClick={onBack}
      aria-label="Back to current view"
      style={{
        padding: `${THEME.spacing.md} 0`,
        border: "none",
        background: "transparent",
        cursor: "pointer",
        fontSize: THEME.typography.sizes.xsmall,
        fontWeight: THEME.typography.weights.medium,
        fontFamily: "inherit",
        color: THEME.colors.gray.medium,
        marginBottom: THEME.spacing.lg,
        display: "flex",
        alignItems: "center",
        gap: THEME.spacing.sm,
      }}
    >
      <span>←</span>
      <span>Back to current view</span>
    </button>

    {/* Pattern Context - PRIMARY */}
    <div
      style={{
        marginBottom: THEME.spacing.xxl,
        paddingBottom: THEME.spacing.xl,
        borderBottom: `2px solid ${THEME.colors.black}`,
      }}
    >
      <div
        style={{
          fontSize: THEME.typography.sizes.base,
          fontWeight: THEME.typography.weights.semibold,
          marginBottom: THEME.spacing.lg,
          lineHeight: "1.4",
          color: THEME.colors.black,
          fontFamily: "'IBM Plex Sans', sans-serif",
        }}
      >
        {patternContext.summary}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: THEME.spacing.lg,
          fontSize: THEME.typography.sizes.xsmall,
        }}
      >
        <div>
          <div
            style={{
              color: THEME.colors.gray.medium,
              marginBottom: THEME.spacing.xs,
            }}
          >
            Within 100m
          </div>
          <div
            style={{
              fontSize: THEME.typography.sizes.xlarge,
              fontWeight: THEME.typography.weights.light,
              fontFamily: "'IBM Plex Sans', sans-serif",
            }}
          >
            {patternContext.nearbyCount}
          </div>
        </div>
        <div>
          <div
            style={{
              color: THEME.colors.gray.medium,
              marginBottom: THEME.spacing.xs,
            }}
          >
            30-day trend
          </div>
          <div
            style={{
              fontSize: THEME.typography.sizes.base,
              fontWeight: THEME.typography.weights.semibold,
              textTransform: "uppercase",
            }}
          >
            {patternContext.trend}
          </div>
        </div>
        <div>
          <div
            style={{
              color: THEME.colors.gray.medium,
              marginBottom: THEME.spacing.xs,
            }}
          >
            Relative freq.
          </div>
          <div
            style={{
              fontSize: THEME.typography.sizes.base,
              fontWeight: THEME.typography.weights.semibold,
            }}
          >
            {patternContext.frequency}
          </div>
        </div>
      </div>
    </div>

    {/* Media Documentation */}
    {observation.media && (
      <MediaSection
        media={observation.media}
        hasMultiple={observation.hasMultipleMedia}
      />
    )}

    {/* System Status - SECONDARY */}
    <SystemStatusSection observation={observation} />

    {/* Pattern Analysis Navigation */}
    <PatternNavigationSection
      onCityWide={onCityWidePattern}
      onLocal={onLocalPattern}
    />

    {/* Timeline */}
    <TimelineSection
      observation={observation}
      expanded={expandedDetail}
      onToggle={onToggleExpanded}
    />

    {/* Record Metadata - TERTIARY */}
    <RecordMetadataSection observation={observation} />
  </div>
);

const MediaSection = ({ media, hasMultiple }) => (
  <div
    style={{
      marginBottom: THEME.spacing.xl,
      border: `1px solid ${THEME.colors.gray.lightest}`,
    }}
  >
    <div
      style={{
        padding: `${THEME.spacing.sm} ${THEME.spacing.md}`,
        background: THEME.colors.gray.background,
        borderBottom: `1px solid ${THEME.colors.gray.lightest}`,
        fontSize: THEME.typography.sizes.tiny,
        fontWeight: THEME.typography.weights.semibold,
        letterSpacing: "0.1em",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <span>DOCUMENTATION</span>
      {hasMultiple && (
        <span
          style={{
            color: THEME.colors.gray.medium,
            fontWeight: THEME.typography.weights.normal,
          }}
        >
          1 of 2
        </span>
      )}
    </div>

    {media.type === "image" ? (
      <img
        src={media.url}
        alt="Observation documentation"
        style={{
          width: "100%",
          display: "block",
          maxHeight: "200px",
          objectFit: "cover",
          filter: "grayscale(100%)",
          background: THEME.colors.black,
        }}
      />
    ) : (
      <video
        src={media.url}
        controls
        style={{
          width: "100%",
          display: "block",
          maxHeight: "200px",
          background: THEME.colors.black,
          filter: "grayscale(100%)",
        }}
      />
    )}

    <div
      style={{
        padding: `${THEME.spacing.sm} ${THEME.spacing.md}`,
        background: THEME.colors.gray.backgroundAlt,
        fontSize: THEME.typography.sizes.tiny,
        color: THEME.colors.gray.light,
      }}
    >
      Metadata stripped
      {hasMultiple && (
        <button
          style={{
            background: "none",
            border: "none",
            padding: 0,
            color: THEME.colors.gray.medium,
            textDecoration: "underline",
            cursor: "pointer",
            fontSize: THEME.typography.sizes.tiny,
            fontFamily: "inherit",
            marginLeft: THEME.spacing.sm,
          }}
        >
          Additional evidence available
        </button>
      )}
    </div>
  </div>
);

const SystemStatusSection = ({ observation }) => {
  const outcome = ContentUtils.getOutcomeDetails(observation.status);

  return (
    <div
      style={{
        marginBottom: THEME.spacing.xl,
        paddingBottom: THEME.spacing.xl,
        borderBottom: `1px solid ${THEME.colors.gray.lightest}`,
      }}
    >
      <div
        style={{
          fontSize: THEME.typography.sizes.tiny,
          fontWeight: THEME.typography.weights.semibold,
          letterSpacing: "0.1em",
          marginBottom: THEME.spacing.md,
          color: THEME.colors.black,
        }}
      >
        SYSTEM STATUS
      </div>

      <div
        style={{
          fontSize: THEME.typography.sizes.small,
          lineHeight: "1.6",
          color: THEME.colors.gray.dark,
          marginBottom: THEME.spacing.md,
        }}
      >
        {ContentUtils.getStatusExplanation(observation.status)}
      </div>

      <div
        style={{
          display: "flex",
          gap: THEME.spacing.xl,
          fontSize: THEME.typography.sizes.xsmall,
          color: THEME.colors.gray.medium,
        }}
      >
        <div>
          <span style={{ fontWeight: THEME.typography.weights.semibold }}>
            Confidence:
          </span>{" "}
          HIGH
        </div>
        <div>
          <span style={{ fontWeight: THEME.typography.weights.semibold }}>
            Response:
          </span>{" "}
          {observation.response_time}d
        </div>
      </div>
    </div>
  );
};

const PatternNavigationSection = ({ onCityWide, onLocal }) => (
  <div
    style={{
      marginBottom: THEME.spacing.xl,
      paddingBottom: THEME.spacing.xl,
      borderBottom: `1px solid ${THEME.colors.gray.lightest}`,
    }}
  >
    <div
      style={{
        fontSize: THEME.typography.sizes.tiny,
        fontWeight: THEME.typography.weights.semibold,
        letterSpacing: "0.05em",
        marginBottom: THEME.spacing.md,
        color: THEME.colors.gray.medium,
      }}
    >
      PATTERN ANALYSIS
    </div>
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr",
        gap: THEME.spacing.sm,
      }}
    >
      <button
        onClick={onCityWide}
        aria-label="View this pattern across the city"
        style={{
          padding: THEME.spacing.md,
          border: `1px solid ${THEME.colors.black}`,
          background: THEME.colors.white,
          cursor: "pointer",
          fontSize: THEME.typography.sizes.xsmall,
          fontWeight: THEME.typography.weights.semibold,
          fontFamily: "inherit",
          textAlign: "left",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span>View this pattern across the city</span>
        <span>→</span>
      </button>
      <button
        onClick={onLocal}
        aria-label="View similar observations nearby"
        style={{
          padding: THEME.spacing.md,
          border: `1px solid ${THEME.colors.gray.lighter}`,
          background: THEME.colors.white,
          cursor: "pointer",
          fontSize: THEME.typography.sizes.xsmall,
          fontWeight: THEME.typography.weights.medium,
          fontFamily: "inherit",
          textAlign: "left",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span>View similar observations nearby</span>
        <span>→</span>
      </button>
    </div>
  </div>
);

const TimelineSection = ({ observation, expanded, onToggle }) => {
  const outcome = ContentUtils.getOutcomeDetails(observation.status);

  return (
    <div>
      {!expanded ? (
        <div>
          {observation.status !== "pending" && (
            <div
              style={{
                marginBottom: THEME.spacing.md,
                fontSize: THEME.typography.sizes.xsmall,
                color: THEME.colors.gray.medium,
                lineHeight: "1.5",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: THEME.spacing.sm,
                  marginBottom: THEME.spacing.sm,
                }}
              >
                <div>Submitted</div>
                <div
                  style={{
                    flex: 1,
                    height: "1px",
                    background: THEME.colors.gray.lightest,
                  }}
                />
                <div>Reviewed</div>
                <div
                  style={{
                    flex: 1,
                    height: "1px",
                    background: THEME.colors.gray.lightest,
                  }}
                />
                <div>Actioned</div>
              </div>
              <div style={{ fontSize: THEME.typography.sizes.tiny }}>
                Process completed in {observation.response_time}d
              </div>
            </div>
          )}

          <button
            onClick={onToggle}
            aria-label="View process timeline"
            aria-expanded="false"
            style={{
              width: "100%",
              padding: THEME.spacing.md,
              border: `1px solid ${THEME.colors.gray.lighter}`,
              background: THEME.colors.white,
              cursor: "pointer",
              fontSize: THEME.typography.sizes.tiny,
              fontWeight: THEME.typography.weights.medium,
              letterSpacing: "0.05em",
              fontFamily: "inherit",
            }}
          >
            VIEW PROCESS TIMELINE
          </button>
        </div>
      ) : (
        <div
          style={{
            border: `1px solid ${THEME.colors.gray.lightest}`,
            padding: THEME.spacing.lg,
            background: THEME.colors.gray.backgroundAlt,
          }}
        >
          <div
            style={{
              fontSize: THEME.typography.sizes.tiny,
              fontWeight: THEME.typography.weights.semibold,
              letterSpacing: "0.1em",
              marginBottom: THEME.spacing.lg,
              color: THEME.colors.black,
            }}
          >
            PROCESS TIMELINE
          </div>

          <table
            style={{
              width: "100%",
              fontSize: THEME.typography.sizes.xsmall,
              borderCollapse: "collapse",
              marginBottom: THEME.spacing.lg,
            }}
          >
            <tbody>
              <tr
                style={{
                  borderBottom: `1px solid ${THEME.colors.gray.lightest}`,
                }}
              >
                <td
                  style={{
                    padding: `${THEME.spacing.sm} 0`,
                    color: THEME.colors.gray.medium,
                  }}
                >
                  Submitted
                </td>
                <td
                  style={{
                    padding: `${THEME.spacing.sm} 0`,
                    textAlign: "right",
                  }}
                >
                  {TimeUtils.formatRelativeTime(observation.timestamp)}
                </td>
              </tr>
              {observation.status !== "pending" && (
                <>
                  <tr
                    style={{
                      borderBottom: `1px solid ${THEME.colors.gray.lightest}`,
                    }}
                  >
                    <td
                      style={{
                        padding: `${THEME.spacing.sm} 0`,
                        color: THEME.colors.gray.medium,
                      }}
                    >
                      Reviewed
                    </td>
                    <td
                      style={{
                        padding: `${THEME.spacing.sm} 0`,
                        textAlign: "right",
                      }}
                    >
                      {TimeUtils.formatRelativeTime(observation.reviewed_at)}
                    </td>
                  </tr>
                  <tr
                    style={{
                      borderBottom: `1px solid ${THEME.colors.gray.lightest}`,
                    }}
                  >
                    <td
                      style={{
                        padding: `${THEME.spacing.sm} 0`,
                        color: THEME.colors.gray.medium,
                      }}
                    >
                      Authority
                    </td>
                    <td
                      style={{
                        padding: `${THEME.spacing.sm} 0`,
                        textAlign: "right",
                      }}
                    >
                      Municipal traffic dept.
                    </td>
                  </tr>
                </>
              )}
              {observation.response_time && (
                <tr>
                  <td
                    style={{
                      padding: `${THEME.spacing.sm} 0`,
                      color: THEME.colors.gray.medium,
                    }}
                  >
                    Duration
                  </td>
                  <td
                    style={{
                      padding: `${THEME.spacing.sm} 0`,
                      textAlign: "right",
                    }}
                  >
                    {observation.response_time} days
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {outcome && observation.status !== "pending" && (
            <div
              style={{
                padding: THEME.spacing.md,
                background: THEME.colors.white,
                marginBottom: THEME.spacing.lg,
                fontSize: THEME.typography.sizes.xsmall,
                lineHeight: "1.5",
                color: THEME.colors.gray.dark,
              }}
            >
              {outcome.authority ? (
                <>
                  <div style={{ marginBottom: THEME.spacing.sm }}>
                    <strong>System change:</strong> {outcome.change}
                  </div>
                  <div>
                    <strong>Authority:</strong> {outcome.authority}
                  </div>
                </>
              ) : (
                <div>{outcome.change}</div>
              )}
            </div>
          )}

          <div
            style={{
              fontSize: THEME.typography.sizes.tiny,
              lineHeight: "1.4",
              color: THEME.colors.gray.light,
              paddingTop: THEME.spacing.md,
              borderTop: `1px solid ${THEME.colors.gray.lightest}`,
              fontStyle: "italic",
            }}
          >
            This timeline reflects institutional process, not individual
            responsibility.
          </div>

          <button
            onClick={onToggle}
            aria-label="Collapse timeline"
            aria-expanded="true"
            style={{
              marginTop: THEME.spacing.lg,
              padding: THEME.spacing.sm,
              border: `1px solid ${THEME.colors.gray.lighter}`,
              background: THEME.colors.white,
              cursor: "pointer",
              fontSize: THEME.typography.sizes.tiny,
              fontWeight: THEME.typography.weights.medium,
              width: "100%",
              fontFamily: "inherit",
            }}
          >
            COLLAPSE
          </button>
        </div>
      )}
    </div>
  );
};

const RecordMetadataSection = ({ observation }) => (
  <div
    style={{
      marginTop: THEME.spacing.xl,
      paddingTop: THEME.spacing.xl,
      borderTop: `1px solid ${THEME.colors.gray.lightest}`,
    }}
  >
    <div
      style={{
        fontSize: THEME.typography.sizes.tiny,
        fontWeight: THEME.typography.weights.semibold,
        letterSpacing: "0.1em",
        marginBottom: THEME.spacing.md,
        color: THEME.colors.gray.light,
      }}
    >
      RECORD METADATA
    </div>

    <table
      style={{
        width: "100%",
        fontSize: THEME.typography.sizes.tiny,
        borderCollapse: "collapse",
        color: THEME.colors.gray.light,
      }}
    >
      <tbody>
        <tr
          style={{ borderBottom: `1px solid ${THEME.colors.gray.background}` }}
        >
          <td style={{ padding: `${THEME.spacing.sm} 0` }}>Record ID</td>
          <td style={{ padding: `${THEME.spacing.sm} 0`, textAlign: "right" }}>
            {observation.id}
          </td>
        </tr>
        <tr
          style={{ borderBottom: `1px solid ${THEME.colors.gray.background}` }}
        >
          <td style={{ padding: `${THEME.spacing.sm} 0` }}>Type</td>
          <td style={{ padding: `${THEME.spacing.sm} 0`, textAlign: "right" }}>
            {ContentUtils.getTypeLabel(observation.type)}
          </td>
        </tr>
        <tr
          style={{ borderBottom: `1px solid ${THEME.colors.gray.background}` }}
        >
          <td style={{ padding: `${THEME.spacing.sm} 0` }}>Recorded</td>
          <td style={{ padding: `${THEME.spacing.sm} 0`, textAlign: "right" }}>
            {TimeUtils.getTimeWindow(observation.timestamp)} ·{" "}
            {TimeUtils.getDaysAgo(observation.timestamp)}d ago
          </td>
        </tr>
        <tr>
          <td style={{ padding: `${THEME.spacing.sm} 0` }}>Source type</td>
          <td style={{ padding: `${THEME.spacing.sm} 0`, textAlign: "right" }}>
            {observation.media
              ? observation.media.type === "video"
                ? "Observer (video)"
                : "Observer (photo)"
              : "Observer"}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
);

// ============================================================================
// PATTERN ANALYSIS COMPONENTS
// ============================================================================

const PatternAnalysisView = ({ mode, data, typeLabel, onClear }) => {
  const isCityWide = mode === PATTERN_MODE.CITY_WIDE;

  return (
    <div>
      {/* Back button */}
      <button
        onClick={onClear}
        aria-label="Clear pattern analysis"
        style={{
          padding: `${THEME.spacing.md} 0`,
          border: "none",
          background: "transparent",
          cursor: "pointer",
          fontSize: THEME.typography.sizes.xsmall,
          fontWeight: THEME.typography.weights.medium,
          fontFamily: "inherit",
          color: THEME.colors.gray.medium,
          marginBottom: THEME.spacing.lg,
          display: "flex",
          alignItems: "center",
          gap: THEME.spacing.sm,
        }}
      >
        <span>←</span>
        <span>Clear pattern analysis</span>
      </button>

      {/* Pattern Summary Header */}
      <div
        style={{
          marginBottom: THEME.spacing.xxl,
          paddingBottom: THEME.spacing.xl,
          borderBottom: `2px solid ${THEME.colors.black}`,
        }}
      >
        <div
          style={{
            fontSize: THEME.typography.sizes.tiny,
            fontWeight: THEME.typography.weights.semibold,
            letterSpacing: "0.1em",
            marginBottom: THEME.spacing.sm,
            color: THEME.colors.gray.medium,
          }}
        >
          {isCityWide ? "CITY-WIDE PATTERN" : "LOCAL PATTERN"}
        </div>

        <div
          style={{
            fontSize: THEME.typography.sizes.large,
            fontWeight: THEME.typography.weights.semibold,
            marginBottom: THEME.spacing.md,
            lineHeight: "1.4",
            color: THEME.colors.black,
            fontFamily: "'IBM Plex Sans', sans-serif",
          }}
        >
          {typeLabel} Pattern Analysis
        </div>

        <div
          style={{
            fontSize: THEME.typography.sizes.small,
            lineHeight: "1.6",
            color: THEME.colors.gray.dark,
          }}
        >
          {isCityWide
            ? `Aggregated observations of this behavior type across the city during the selected time window.`
            : `Similar observations have been reported repeatedly in this area over the selected time window.`}
        </div>
      </div>

      {/* Statistics */}
      {isCityWide ? (
        <CityWideStats stats={data.stats} />
      ) : (
        <LocalStats stats={data.stats} />
      )}

      {/* Explanatory Note */}
      <div
        style={{
          marginTop: THEME.spacing.xxl,
          paddingTop: THEME.spacing.lg,
          borderTop: `1px solid ${THEME.colors.gray.lightest}`,
          fontSize: THEME.typography.sizes.xsmall,
          lineHeight: "1.6",
          color: THEME.colors.gray.medium,
          fontStyle: "italic",
        }}
      >
        Pattern analysis aggregates observations to identify systemic trends.
        Individual records are not shown in this view.
      </div>
    </div>
  );
};

const CityWideStats = ({ stats }) => (
  <div>
    <table
      style={{
        width: "100%",
        fontSize: THEME.typography.sizes.small,
        borderCollapse: "collapse",
        marginBottom: THEME.spacing.xxl,
      }}
    >
      <tbody>
        <tr style={{ borderBottom: `1px solid ${THEME.colors.gray.lightest}` }}>
          <td
            style={{
              padding: `${THEME.spacing.sm} 0`,
              fontWeight: THEME.typography.weights.semibold,
            }}
          >
            Total occurrences
          </td>
          <td
            style={{
              padding: `${THEME.spacing.sm} 0`,
              textAlign: "right",
              fontSize: THEME.typography.sizes.xlarge,
              fontFamily: "'IBM Plex Sans', sans-serif",
              fontWeight: THEME.typography.weights.light,
            }}
          >
            {stats.total}
          </td>
        </tr>
        <tr style={{ borderBottom: `1px solid ${THEME.colors.gray.lightest}` }}>
          <td
            style={{
              padding: `${THEME.spacing.sm} 0`,
              color: THEME.colors.gray.medium,
            }}
          >
            Affected zones
          </td>
          <td style={{ padding: `${THEME.spacing.sm} 0`, textAlign: "right" }}>
            {stats.affectedZones}
          </td>
        </tr>
        <tr style={{ borderBottom: `1px solid ${THEME.colors.gray.lightest}` }}>
          <td
            style={{
              padding: `${THEME.spacing.sm} 0`,
              color: THEME.colors.gray.medium,
            }}
          >
            Pattern trend
          </td>
          <td
            style={{
              padding: `${THEME.spacing.sm} 0`,
              textAlign: "right",
              textTransform: "capitalize",
              fontWeight: THEME.typography.weights.semibold,
            }}
          >
            {stats.trend}
          </td>
        </tr>
        <tr>
          <td
            style={{
              padding: `${THEME.spacing.sm} 0`,
              color: THEME.colors.gray.medium,
            }}
          >
            Recent reports
          </td>
          <td style={{ padding: `${THEME.spacing.sm} 0`, textAlign: "right" }}>
            {stats.recentCount}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
);

const LocalStats = ({ stats }) => {
  if (!stats) return null;

  return (
    <div>
      <table
        style={{
          width: "100%",
          fontSize: THEME.typography.sizes.small,
          borderCollapse: "collapse",
          marginBottom: THEME.spacing.xxl,
        }}
      >
        <tbody>
          <tr
            style={{ borderBottom: `1px solid ${THEME.colors.gray.lightest}` }}
          >
            <td
              style={{
                padding: `${THEME.spacing.sm} 0`,
                fontWeight: THEME.typography.weights.semibold,
              }}
            >
              Nearby occurrences
            </td>
            <td
              style={{
                padding: `${THEME.spacing.sm} 0`,
                textAlign: "right",
                fontSize: THEME.typography.sizes.xlarge,
                fontFamily: "'IBM Plex Sans', sans-serif",
                fontWeight: THEME.typography.weights.light,
              }}
            >
              {stats.count}
            </td>
          </tr>
          <tr
            style={{ borderBottom: `1px solid ${THEME.colors.gray.lightest}` }}
          >
            <td
              style={{
                padding: `${THEME.spacing.sm} 0`,
                color: THEME.colors.gray.medium,
              }}
            >
              Time span
            </td>
            <td
              style={{ padding: `${THEME.spacing.sm} 0`, textAlign: "right" }}
            >
              {stats.timeSpanDays} days
            </td>
          </tr>
          <tr>
            <td
              style={{
                padding: `${THEME.spacing.sm} 0`,
                color: THEME.colors.gray.medium,
              }}
            >
              Local trend
            </td>
            <td
              style={{
                padding: `${THEME.spacing.sm} 0`,
                textAlign: "right",
                textTransform: "capitalize",
                fontWeight: THEME.typography.weights.semibold,
              }}
            >
              {stats.trend}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default RoadCommonsTransparency;
