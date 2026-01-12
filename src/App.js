import React, { useState, useMemo } from "react";
import {
  MapPin,
  AlertCircle,
  Construction,
  Eye,
  ChevronDown,
} from "lucide-react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

// Component to sync map zoom with state
const ZoomHandler = ({ setZoomLevel }) => {
  const map = useMap();

  React.useEffect(() => {
    const onZoom = () => {
      setZoomLevel(map.getZoom());
    };

    map.on("zoom", onZoom);
    return () => {
      map.off("zoom", onZoom);
    };
  }, [map, setZoomLevel]);

  return null;
};

// Mock data generator - using Mumbai coordinates
const generateMockObservations = () => {
  const types = ["violation", "risk", "infrastructure"];
  const statuses = [
    "under_review",
    "acknowledged",
    "resolved",
    "dismissed",
    "pending",
  ];

  // Mumbai area coordinates
  const baseLocations = [
    { lat: 19.076, lng: 72.8777, name: "South Mumbai" },
    { lat: 19.0176, lng: 72.8561, name: "Colaba" },
    { lat: 19.0896, lng: 72.8656, name: "Bandra" },
    { lat: 19.1136, lng: 72.8697, name: "Andheri" },
    { lat: 19.2183, lng: 72.9781, name: "Thane" },
  ];

  return Array.from({ length: 150 }, (_, i) => {
    const baseLocation =
      baseLocations[Math.floor(Math.random() * baseLocations.length)];
    return {
      id: `obs_${i}`,
      type: types[Math.floor(Math.random() * types.length)],
      lat: baseLocation.lat + (Math.random() - 0.5) * 0.05,
      lng: baseLocation.lng + (Math.random() - 0.5) * 0.05,
      timestamp: Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000,
      status: statuses[Math.floor(Math.random() * statuses.length)],
      description: "Observed behavior pattern",
      reviewed_at: Date.now() - Math.random() * 20 * 24 * 60 * 60 * 1000,
      response_time: Math.floor(Math.random() * 14) + 1,
    };
  });
};

const RoadCommonsTransparency = () => {
  const [lens, setLens] = useState("all");
  const [timeFilter, setTimeFilter] = useState("30d");
  const [zoomLevel, setZoomLevel] = useState(12);
  const [selectedObservation, setSelectedObservation] = useState(null);
  const [expandedDetail, setExpandedDetail] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const observations = useMemo(() => generateMockObservations(), []);

  const filterObservations = () => {
    let filtered = observations;

    if (lens !== "all") {
      filtered = filtered.filter((obs) => obs.type === lens);
    }

    const now = Date.now();
    const timeMap = {
      "24h": 24 * 60 * 60 * 1000,
      "7d": 7 * 24 * 60 * 60 * 1000,
      "30d": 30 * 24 * 60 * 60 * 1000,
      persistent: Infinity,
    };

    filtered = filtered.filter(
      (obs) => now - obs.timestamp < timeMap[timeFilter]
    );

    return filtered;
  };

  const filteredData = filterObservations();

  const getMarkerRadius = () => {
    if (zoomLevel <= 10) return 8;
    if (zoomLevel <= 13) return 6;
    return 5;
  };

  const getMarkerWeight = (status) => {
    const weights = {
      pending: 1,
      under_review: 2,
      acknowledged: 2,
      resolved: 3,
      dismissed: 1,
    };
    return weights[status] || 1;
  };

  const getTypeLabel = (type) => {
    const labels = {
      violation: "Violation",
      risk: "Risk Behavior",
      infrastructure: "Infrastructure",
    };
    return labels[type] || "Observation";
  };

  const calculateStats = () => {
    const total = filteredData.length;
    const byType = {
      violation: filteredData.filter((o) => o.type === "violation").length,
      risk: filteredData.filter((o) => o.type === "risk").length,
      infrastructure: filteredData.filter((o) => o.type === "infrastructure")
        .length,
    };

    const avgResponseTime =
      filteredData
        .filter((o) => o.response_time)
        .reduce((acc, o) => acc + o.response_time, 0) /
      filteredData.filter((o) => o.response_time).length;

    const reviewRate = (
      (filteredData.filter((o) => o.status !== "pending").length / total) *
      100
    ).toFixed(1);

    return {
      total,
      byType,
      avgResponseTime: Math.round(avgResponseTime),
      reviewRate,
    };
  };

  const stats = calculateStats();

  return (
    <div
      style={{
        width: "100%",
        height: "100vh",
        background: "#FFFFFF",
        fontFamily: "'IBM Plex Mono', 'Courier New', monospace",
        color: "#000000",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Minimal Header */}
      <header
        style={{
          borderBottom: "1px solid #000000",
          padding: "1rem 1.5rem",
          background: "#FFFFFF",
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
                fontSize: "1rem",
                fontWeight: "600",
                letterSpacing: "0.02em",
                margin: "0 0 0.25rem 0",
                textTransform: "uppercase",
              }}
            >
              Road Commons Observatory
            </h1>
            <p
              style={{
                fontSize: "0.75rem",
                margin: 0,
                color: "#666666",
                fontWeight: "400",
                maxWidth: "600px",
              }}
            >
              A public observatory for aggregated road behavior and
              infrastructure signals
            </p>
          </div>

          {/* Inline stats */}
          <div
            style={{
              display: "flex",
              gap: "2rem",
              fontSize: "0.75rem",
              fontWeight: "500",
            }}
          >
            <div>
              <span style={{ color: "#666666" }}>OBSERVATIONS:</span>
              <span style={{ marginLeft: "0.5rem" }}>{stats.total}</span>
            </div>
            <div>
              <span style={{ color: "#666666" }}>REVIEWED:</span>
              <span style={{ marginLeft: "0.5rem" }}>{stats.reviewRate}%</span>
            </div>
            <div>
              <span style={{ color: "#666666" }}>AVG RESPONSE:</span>
              <span style={{ marginLeft: "0.5rem" }}>
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
        {/* Map Surface - Dominant */}
        <div
          style={{
            flex: 1,
            position: "relative",
            background: "#F5F5F5",
          }}
        >
          {/* Controls Overlay - Top Left */}
          <div
            style={{
              position: "absolute",
              top: "1rem",
              left: "1rem",
              zIndex: 10,
              background: "#FFFFFF",
              border: "1px solid #000000",
              padding: "0.75rem",
            }}
          >
            {/* Lens Filter */}
            <div style={{ marginBottom: "0.75rem" }}>
              <div
                style={{
                  fontSize: "0.65rem",
                  fontWeight: "600",
                  letterSpacing: "0.1em",
                  marginBottom: "0.5rem",
                  color: "#000000",
                }}
              >
                LENS
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.25rem",
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
                    style={{
                      padding: "0.4rem 0.6rem",
                      border: "none",
                      borderLeft:
                        lens === option.value
                          ? "3px solid #000000"
                          : "3px solid transparent",
                      background:
                        lens === option.value ? "#F5F5F5" : "transparent",
                      cursor: "pointer",
                      fontSize: "0.7rem",
                      textAlign: "left",
                      fontWeight: lens === option.value ? "600" : "400",
                      color: "#000000",
                      fontFamily: "inherit",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Time Window */}
            <div
              style={{
                borderTop: "1px solid #E0E0E0",
                paddingTop: "0.75rem",
              }}
            >
              <div
                style={{
                  fontSize: "0.65rem",
                  fontWeight: "600",
                  letterSpacing: "0.1em",
                  marginBottom: "0.5rem",
                  color: "#000000",
                }}
              >
                PERIOD
              </div>
              <div
                style={{
                  display: "flex",
                  gap: "0.5rem",
                  fontSize: "0.7rem",
                }}
              >
                {[
                  { value: "24h", label: "24h" },
                  { value: "7d", label: "7d" },
                  { value: "30d", label: "30d" },
                  { value: "persistent", label: "All" },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setTimeFilter(option.value)}
                    style={{
                      padding: "0.3rem 0.5rem",
                      border: "1px solid #000000",
                      background:
                        timeFilter === option.value ? "#000000" : "#FFFFFF",
                      color:
                        timeFilter === option.value ? "#FFFFFF" : "#000000",
                      cursor: "pointer",
                      fontSize: "0.7rem",
                      fontWeight: "500",
                      fontFamily: "inherit",
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Zoom Controls - Removed, using native map controls */}

          {/* Zoom Level Indicator - Bottom Left */}
          <div
            style={{
              position: "absolute",
              bottom: "1rem",
              left: "1rem",
              zIndex: 1000,
              background: "#FFFFFF",
              border: "1px solid #000000",
              padding: "0.5rem 0.75rem",
              fontSize: "0.7rem",
              fontWeight: "500",
            }}
          >
            {zoomLevel <= 10 ? "DISTRICT" : zoomLevel <= 14 ? "WARD" : "STREET"}
          </div>

          {/* Leaflet Map */}
          <MapContainer
            center={[19.076, 72.8777]}
            zoom={12}
            style={{
              width: "100%",
              height: "100%",
              background: "#F5F5F5",
              filter: "grayscale(100%) contrast(1.1)",
            }}
            zoomControl={true}
          >
            <ZoomHandler setZoomLevel={setZoomLevel} />

            {/* Grayscale OpenStreetMap tiles */}
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* Observation markers */}
            {filteredData.map((obs) => (
              <CircleMarker
                key={obs.id}
                center={[obs.lat, obs.lng]}
                radius={getMarkerRadius()}
                pathOptions={{
                  color: "#000000",
                  fillColor:
                    selectedObservation?.id === obs.id ? "#000000" : "#FFFFFF",
                  fillOpacity: selectedObservation?.id === obs.id ? 1 : 0.8,
                  weight: getMarkerWeight(obs.status),
                }}
                eventHandlers={{
                  click: () => {
                    setSelectedObservation(obs);
                    setExpandedDetail(false);
                    setSidebarOpen(true);
                  },
                }}
              >
                <Popup>
                  <div
                    style={{
                      fontFamily: "'IBM Plex Mono', monospace",
                      fontSize: "0.7rem",
                    }}
                  >
                    <strong>{getTypeLabel(obs.type)}</strong>
                    <br />
                    {obs.id}
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>

        {/* Right Sidebar - Collapsible */}
        {sidebarOpen && (
          <div
            style={{
              width: "360px",
              borderLeft: "1px solid #000000",
              background: "#FFFFFF",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Close button */}
            <button
              onClick={() => setSidebarOpen(false)}
              style={{
                padding: "0.75rem",
                border: "none",
                borderBottom: "1px solid #E0E0E0",
                background: "#FFFFFF",
                cursor: "pointer",
                fontSize: "0.7rem",
                fontWeight: "600",
                textAlign: "left",
                fontFamily: "inherit",
                letterSpacing: "0.05em",
              }}
            >
              ✕ CLOSE
            </button>

            <div
              style={{
                flex: 1,
                overflow: "auto",
                padding: "1.5rem",
              }}
            >
              {selectedObservation ? (
                // Observation Detail
                <div>
                  <div
                    style={{
                      fontSize: "0.65rem",
                      fontWeight: "600",
                      letterSpacing: "0.1em",
                      marginBottom: "0.5rem",
                      color: "#666666",
                    }}
                  >
                    OBSERVATION
                  </div>

                  <div
                    style={{
                      fontSize: "1.1rem",
                      fontWeight: "600",
                      marginBottom: "1.5rem",
                      fontFamily: "'IBM Plex Sans', sans-serif",
                    }}
                  >
                    {getTypeLabel(selectedObservation.type)}
                  </div>

                  {/* Data Table */}
                  <table
                    style={{
                      width: "100%",
                      fontSize: "0.75rem",
                      borderCollapse: "collapse",
                      marginBottom: "1.5rem",
                    }}
                  >
                    <tbody>
                      <tr style={{ borderBottom: "1px solid #E0E0E0" }}>
                        <td
                          style={{
                            padding: "0.5rem 0",
                            fontWeight: "600",
                            color: "#666666",
                          }}
                        >
                          ID
                        </td>
                        <td style={{ padding: "0.5rem 0", textAlign: "right" }}>
                          {selectedObservation.id}
                        </td>
                      </tr>
                      <tr style={{ borderBottom: "1px solid #E0E0E0" }}>
                        <td
                          style={{
                            padding: "0.5rem 0",
                            fontWeight: "600",
                            color: "#666666",
                          }}
                        >
                          Recorded
                        </td>
                        <td style={{ padding: "0.5rem 0", textAlign: "right" }}>
                          {new Date(
                            selectedObservation.timestamp
                          ).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </td>
                      </tr>
                      <tr style={{ borderBottom: "1px solid #E0E0E0" }}>
                        <td
                          style={{
                            padding: "0.5rem 0",
                            fontWeight: "600",
                            color: "#666666",
                          }}
                        >
                          Status
                        </td>
                        <td
                          style={{
                            padding: "0.5rem 0",
                            textAlign: "right",
                            textTransform: "uppercase",
                            fontSize: "0.7rem",
                            fontWeight: "600",
                          }}
                        >
                          {selectedObservation.status.replace("_", " ")}
                        </td>
                      </tr>
                      <tr>
                        <td
                          style={{
                            padding: "0.5rem 0",
                            fontWeight: "600",
                            color: "#666666",
                          }}
                        >
                          Source
                        </td>
                        <td style={{ padding: "0.5rem 0", textAlign: "right" }}>
                          Observer
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {!expandedDetail ? (
                    <button
                      onClick={() => setExpandedDetail(true)}
                      style={{
                        width: "100%",
                        padding: "0.75rem",
                        border: "1px solid #000000",
                        background: "#FFFFFF",
                        cursor: "pointer",
                        fontSize: "0.7rem",
                        fontWeight: "600",
                        letterSpacing: "0.05em",
                        fontFamily: "inherit",
                      }}
                    >
                      VIEW RESPONSE TIMELINE
                    </button>
                  ) : (
                    <div
                      style={{
                        border: "1px solid #000000",
                        padding: "1rem",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "0.65rem",
                          fontWeight: "600",
                          letterSpacing: "0.1em",
                          marginBottom: "1rem",
                          color: "#000000",
                        }}
                      >
                        INSTITUTIONAL RESPONSE
                      </div>

                      <table
                        style={{
                          width: "100%",
                          fontSize: "0.7rem",
                          borderCollapse: "collapse",
                          marginBottom: "1rem",
                        }}
                      >
                        <tbody>
                          <tr style={{ borderBottom: "1px solid #E0E0E0" }}>
                            <td
                              style={{ padding: "0.5rem 0", color: "#666666" }}
                            >
                              Submitted
                            </td>
                            <td
                              style={{
                                padding: "0.5rem 0",
                                textAlign: "right",
                              }}
                            >
                              {new Date(
                                selectedObservation.timestamp
                              ).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              })}
                            </td>
                          </tr>
                          {selectedObservation.status !== "pending" && (
                            <tr style={{ borderBottom: "1px solid #E0E0E0" }}>
                              <td
                                style={{
                                  padding: "0.5rem 0",
                                  color: "#666666",
                                }}
                              >
                                Reviewed
                              </td>
                              <td
                                style={{
                                  padding: "0.5rem 0",
                                  textAlign: "right",
                                }}
                              >
                                {new Date(
                                  selectedObservation.reviewed_at
                                ).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                })}
                              </td>
                            </tr>
                          )}
                          {selectedObservation.response_time && (
                            <tr>
                              <td
                                style={{
                                  padding: "0.5rem 0",
                                  color: "#666666",
                                }}
                              >
                                Duration
                              </td>
                              <td
                                style={{
                                  padding: "0.5rem 0",
                                  textAlign: "right",
                                }}
                              >
                                {selectedObservation.response_time} days
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>

                      <div
                        style={{
                          fontSize: "0.7rem",
                          lineHeight: "1.5",
                          color: "#666666",
                          paddingTop: "0.75rem",
                          borderTop: "1px solid #E0E0E0",
                        }}
                      >
                        {selectedObservation.status === "pending"
                          ? "Observation in review queue."
                          : selectedObservation.status === "resolved"
                          ? "Pattern addressed."
                          : selectedObservation.status === "acknowledged"
                          ? "Acknowledged. Data collection ongoing."
                          : "Reviewed and categorized."}
                      </div>

                      <button
                        onClick={() => setExpandedDetail(false)}
                        style={{
                          marginTop: "1rem",
                          padding: "0.5rem",
                          border: "1px solid #CCCCCC",
                          background: "#FFFFFF",
                          cursor: "pointer",
                          fontSize: "0.65rem",
                          fontWeight: "500",
                          width: "100%",
                          fontFamily: "inherit",
                        }}
                      >
                        COLLAPSE
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                // Summary View
                <div>
                  <div
                    style={{
                      fontSize: "0.65rem",
                      fontWeight: "600",
                      letterSpacing: "0.1em",
                      marginBottom: "1rem",
                      color: "#000000",
                    }}
                  >
                    CURRENT VIEW
                  </div>

                  {/* Stats Table */}
                  <table
                    style={{
                      width: "100%",
                      fontSize: "0.75rem",
                      borderCollapse: "collapse",
                      marginBottom: "2rem",
                    }}
                  >
                    <tbody>
                      <tr style={{ borderBottom: "1px solid #E0E0E0" }}>
                        <td style={{ padding: "0.5rem 0", fontWeight: "600" }}>
                          Total
                        </td>
                        <td
                          style={{
                            padding: "0.5rem 0",
                            textAlign: "right",
                            fontSize: "1.5rem",
                            fontFamily: "'IBM Plex Sans', sans-serif",
                            fontWeight: "300",
                          }}
                        >
                          {stats.total}
                        </td>
                      </tr>
                      <tr style={{ borderBottom: "1px solid #E0E0E0" }}>
                        <td style={{ padding: "0.5rem 0", color: "#666666" }}>
                          Violations
                        </td>
                        <td style={{ padding: "0.5rem 0", textAlign: "right" }}>
                          {stats.byType.violation}
                        </td>
                      </tr>
                      <tr style={{ borderBottom: "1px solid #E0E0E0" }}>
                        <td style={{ padding: "0.5rem 0", color: "#666666" }}>
                          Risk
                        </td>
                        <td style={{ padding: "0.5rem 0", textAlign: "right" }}>
                          {stats.byType.risk}
                        </td>
                      </tr>
                      <tr>
                        <td style={{ padding: "0.5rem 0", color: "#666666" }}>
                          Infrastructure
                        </td>
                        <td style={{ padding: "0.5rem 0", textAlign: "right" }}>
                          {stats.byType.infrastructure}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Institutional Metrics */}
                  <div
                    style={{
                      borderTop: "2px solid #000000",
                      paddingTop: "1rem",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "0.65rem",
                        fontWeight: "600",
                        letterSpacing: "0.1em",
                        marginBottom: "1rem",
                        color: "#000000",
                      }}
                    >
                      INSTITUTIONAL METRICS
                    </div>

                    <table
                      style={{
                        width: "100%",
                        fontSize: "0.75rem",
                        borderCollapse: "collapse",
                        marginBottom: "1rem",
                      }}
                    >
                      <tbody>
                        <tr style={{ borderBottom: "1px solid #E0E0E0" }}>
                          <td style={{ padding: "0.5rem 0", color: "#666666" }}>
                            Review Rate
                          </td>
                          <td
                            style={{
                              padding: "0.5rem 0",
                              textAlign: "right",
                              fontWeight: "600",
                            }}
                          >
                            {stats.reviewRate}%
                          </td>
                        </tr>
                        <tr>
                          <td style={{ padding: "0.5rem 0", color: "#666666" }}>
                            Avg Response
                          </td>
                          <td
                            style={{
                              padding: "0.5rem 0",
                              textAlign: "right",
                              fontWeight: "600",
                            }}
                          >
                            {stats.avgResponseTime} days
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    <div
                      style={{
                        fontSize: "0.65rem",
                        lineHeight: "1.5",
                        color: "#999999",
                        fontStyle: "italic",
                      }}
                    >
                      Visibility indicators, not performance targets.
                    </div>
                  </div>

                  {/* Context */}
                  <div
                    style={{
                      marginTop: "2rem",
                      paddingTop: "1rem",
                      borderTop: "1px solid #E0E0E0",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "0.7rem",
                        lineHeight: "1.6",
                        color: "#666666",
                      }}
                    >
                      Each observation contributes to pattern recognition. This
                      observatory exists to inform collective understanding and
                      institutional response.
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Open Sidebar Button (when closed) */}
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            style={{
              position: "absolute",
              right: 0,
              top: "50%",
              transform: "translateY(-50%)",
              padding: "2rem 0.5rem",
              background: "#FFFFFF",
              border: "1px solid #000000",
              borderRight: "none",
              cursor: "pointer",
              fontSize: "0.7rem",
              fontWeight: "600",
              writingMode: "vertical-rl",
              letterSpacing: "0.1em",
              fontFamily: "inherit",
            }}
          >
            DATA
          </button>
        )}
      </div>

      {/* Footer */}
      <footer
        style={{
          borderTop: "1px solid #000000",
          padding: "0.75rem 1.5rem",
          fontSize: "0.65rem",
          color: "#666666",
          textAlign: "center",
          background: "#FFFFFF",
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
        
        /* Leaflet map styling */
        .leaflet-container {
          font-family: 'IBM Plex Mono', monospace;
        }
        
        .leaflet-popup-content-wrapper {
          background: #FFFFFF;
          border: 1px solid #000000;
          border-radius: 0;
          box-shadow: none;
        }
        
        .leaflet-popup-tip {
          background: #FFFFFF;
          border: 1px solid #000000;
          box-shadow: none;
        }
        
        .leaflet-control-zoom {
          border: 1px solid #000000 !important;
          border-radius: 0 !important;
        }
        
        .leaflet-control-zoom a {
          background: #FFFFFF !important;
          color: #000000 !important;
          border: none !important;
          border-bottom: 1px solid #000000 !important;
          border-radius: 0 !important;
          font-family: 'IBM Plex Mono', monospace !important;
          font-weight: 600 !important;
        }
        
        .leaflet-control-zoom a:last-child {
          border-bottom: none !important;
        }
        
        .leaflet-control-zoom a:hover {
          background: #F5F5F5 !important;
        }
        
        .leaflet-bar {
          box-shadow: none !important;
        }
      `}</style>
    </div>
  );
};

export default RoadCommonsTransparency;
