import { useEffect, useState } from 'react';

import {
  ArrowLeft,
  Calendar,
  Clock,
  ImageOff,
  Cpu,
  Bell,
  MapPin,
  AlertCircle,
  CloudSun,
  Droplets,
  Wind,
  ScanSearch,
  Play,
  Gauge,
  Cloud,
  Map,
  Sparkles,
} from 'lucide-react';

import {
  getInspectionById,
  formatDateTime,
  formatDate,
  formatTime,
  runInspection,
} from '@/lib/inspectionApi';

import {
  ensureNotificationPermission,
  sendFaultNotification,
} from '@/lib/notificationService';

import type {
  CleaningDecision,
  Inspection,
  WeatherSnapshot,
} from '@/types';

import {
  FaultBadge,
  StatusBadge,
  NotificationBadge,
  ConfidenceBar,
  Spinner,
} from './StatusBadges';


interface InspectionDetailsProps {
  inspectionId: string;
  onBack: () => void;
}


/**
 * Inspection Details
 *
 * Displays the complete result of one inspection.
 */
export function InspectionDetails({
  inspectionId,
  onBack,
}: InspectionDetailsProps) {

  const [
    inspection,
    setInspection,
  ] =
    useState<Inspection | null>(null);


  const [
    loading,
    setLoading,
  ] =
    useState(true);


  const [
    error,
    setError,
  ] =
    useState<string | null>(null);


  const [
    running,
    setRunning,
  ] =
    useState(false);


  // ---------------------------------------------------------
  // Load inspection
  // ---------------------------------------------------------

  useEffect(() => {

    let cancelled = false;


    async function load() {

      setLoading(true);
      setError(null);


      try {

        const data =
          await getInspectionById(
            inspectionId
          );


        if (
          cancelled
        ) {

          return;

        }


        setInspection(data);


        if (
          !data
        ) {

          setError(
            'Inspection not found.'
          );

        }

      } catch (err) {

        if (
          !cancelled
        ) {

          setError(
            err instanceof Error
              ? err.message
              : 'Failed to load inspection.'
          );

        }

      } finally {

        if (
          !cancelled
        ) {

          setLoading(false);

        }

      }

    }


    load();


    return () => {

      cancelled = true;

    };

  }, [inspectionId]);


  // ---------------------------------------------------------
  // Run saved inspection again
  // ---------------------------------------------------------

  const runSavedInspection =
    async () => {

      if (
        !inspection?.image_path ||
        running
      ) {

        return;

      }


      setRunning(true);
      setError(null);


      try {

        const response =
          await fetch(
            inspection.image_path
          );


        if (
          !response.ok
        ) {

          throw new Error(
            'Unable to load the saved inspection image.'
          );

        }


        const imageBlob =
          await response.blob();


        await ensureNotificationPermission();


        const updated =
          await runInspection(
            inspection.panel_id,
            imageBlob,
            inspection.trigger_type,
            inspection.id
          );


        if (
          updated.is_fault &&
          updated.processing_status ===
            'completed'
        ) {

          await sendFaultNotification(
            updated
          );

        }


        setInspection(
          updated
        );

      } catch (err) {

        setError(
          err instanceof Error
            ? err.message
            : 'Failed to run inspection.'
        );

      } finally {

        setRunning(false);

      }

    };


  // ---------------------------------------------------------
  // Loading
  // ---------------------------------------------------------

  if (
    loading
  ) {

    return (

      <div className="flex items-center justify-center py-24">

        <Spinner
          className="w-6 h-6 text-ink-300"
        />

      </div>

    );

  }


  // ---------------------------------------------------------
  // Error
  // ---------------------------------------------------------

  if (
    error ||
    !inspection
  ) {

    return (

      <div className="space-y-6">

        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-ink-500 hover:text-ink-900 transition-colors"
        >

          <ArrowLeft size={16} />

          Back to History

        </button>


        <div className="px-5 py-4 bg-red-50 border border-red-200 text-sm text-red-700 rounded-xl">

          {error ?? 'Inspection not found.'}

        </div>

      </div>

    );

  }


  // ---------------------------------------------------------
  // Extract stored information
  // ---------------------------------------------------------

  const rawOutput =
    inspection.raw_output ??
    {};


  const rawClasses =
    rawOutput.all_classes as
      | {
          class: string;
          confidence: number;
        }[]
      | undefined;


  const weather =
    rawOutput.weather as
      | WeatherSnapshot
      | undefined;


  const cleaningDecision =
    rawOutput.cleaning_decision as
      | CleaningDecision
      | undefined;


  const gradcamImage =
    rawOutput.gradcam_image as
      | string
      | undefined;


  const gradcamError =
    rawOutput.gradcam_error as
      | string
      | undefined;


  const model =
    rawOutput.model as
      | Record<string, unknown>
      | undefined;


  // ---------------------------------------------------------
  // Main UI
  // ---------------------------------------------------------

  return (

    <div className="space-y-8 max-w-4xl mx-auto animate-fade-in">

      {/* Back */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-ink-500 hover:text-ink-900 transition-colors"
      >

        <ArrowLeft size={16} />

        Back

      </button>


      {/* Header */}
      <div className="flex items-center justify-between gap-4">

        <div>

          <h2 className="text-2xl font-semibold tracking-tight text-ink-900">

            Inspection Details

          </h2>


          <p className="text-sm text-ink-400 mt-1">

            {formatDateTime(
              inspection.inspection_at
            )}

          </p>

        </div>


        <FaultBadge
          isFault={
            inspection.is_fault
          }
        />

      </div>


      {/* Run pending inspection */}
      {inspection.processing_status ===
        'pending' && (

        <button
          type="button"
          onClick={
            runSavedInspection
          }
          disabled={running}
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-ink-900 rounded-xl hover:bg-ink-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >

          <Play size={16} />

          {running
            ? 'Running Inspection...'
            : 'Run Inspection'}

        </button>

      )}


      {/* =====================================================
          IMAGE
      ====================================================== */}

      <section className="space-y-3">

        <p className="text-xs font-medium text-ink-400">

          Original Image

        </p>


        <div className="bg-ink-950 rounded-2xl overflow-hidden">

          {inspection.image_path ? (

            <img
              src={
                inspection.image_path
              }
              alt="Inspected solar panel"
              className="w-full object-contain max-h-[550px]"
            />

          ) : (

            <div className="w-full h-64 flex items-center justify-center">

              <ImageOff
                size={32}
                className="text-ink-600"
              />

            </div>

          )}

        </div>

      </section>


      {/* =====================================================
          MAIN AI RESULT
      ====================================================== */}

      <section className="bg-white rounded-2xl border border-ink-200/60 overflow-hidden">

        <div className="px-6 py-5 border-b border-ink-100 flex items-center justify-between">

          <div className="flex items-center gap-2">

            <Sparkles
              size={18}
              className="text-ink-500"
            />

            <h3 className="text-base font-semibold text-ink-800">

              AI Inspection Result

            </h3>

          </div>


          <FaultBadge
            isFault={
              inspection.is_fault
            }
          />

        </div>


        <div className="p-6 space-y-6">

          {/* Prediction */}

          <div>

            <p className="text-xs text-ink-400 mb-1">

              Prediction

            </p>


            <p className="text-xl font-semibold text-ink-900">

              {inspection.prediction ??
                'Unknown'}

            </p>

          </div>


          {/* Confidence */}

          <div>

            <div className="flex items-center justify-between mb-2">

              <p className="text-xs text-ink-400 flex items-center gap-1.5">

                <Gauge size={14} />

                Confidence

              </p>


              <p className="text-sm font-semibold text-ink-700">

                {formatPercent(
                  inspection.confidence
                )}

              </p>

            </div>


            <ConfidenceBar
              confidence={
                inspection.confidence
              }
            />

          </div>


          {/* AI interpretation */}

          <div className="rounded-xl bg-ink-50 border border-ink-100 px-5 py-4">

            <p className="text-xs text-ink-400 mb-1">

              AI Assessment

            </p>


            <p className="text-sm text-ink-700">

              {inspection.is_fault
                ? `The AI model detected a possible ${inspection.prediction ?? 'fault'} condition in the solar panel.`
                : `The AI model classified this panel as ${inspection.prediction ?? 'normal'}, indicating no detected fault.`}

            </p>

          </div>

        </div>

      </section>


      {/* =====================================================
          MODEL OUTPUT
      ====================================================== */}

      {rawClasses &&
        rawClasses.length > 0 && (

        <section className="bg-white rounded-2xl border border-ink-200/60 overflow-hidden">

          <div className="px-6 py-4 border-b border-ink-100">

            <h3 className="text-sm font-semibold text-ink-700 flex items-center gap-2">

              <Cpu size={15} />

              Model Output — All Classes

            </h3>

          </div>


          <div className="p-6 space-y-4">

            {rawClasses.map(
              (item) => (

                <div
                  key={
                    item.class
                  }
                  className="space-y-1.5"
                >

                  <div className="flex items-center justify-between">

                    <span className="text-sm text-ink-600">

                      {item.class}

                    </span>


                    <span className="text-xs font-medium text-ink-500">

                      {formatPercent(
                        item.confidence
                      )}

                    </span>

                  </div>


                  <ConfidenceBar
                    confidence={
                      item.confidence
                    }
                  />

                </div>

              )
            )}

          </div>

        </section>

      )}


      {/* =====================================================
          GRAD-CAM
      ====================================================== */}

      {(gradcamImage ||
        gradcamError) && (

        <section className="bg-white rounded-2xl border border-ink-200/60 overflow-hidden">

          <div className="px-6 py-4 border-b border-ink-100">

            <h3 className="text-sm font-semibold text-ink-700 flex items-center gap-2">

              <ScanSearch size={15} />

              AI Explainability — Grad-CAM

            </h3>

          </div>


          {gradcamImage ? (

            <>

              <div className="bg-ink-950">

                <img
                  src={
                    gradcamImage
                  }
                  alt="Grad-CAM heatmap for inspected solar panel"
                  className="w-full object-contain max-h-[550px]"
                />

              </div>


              <div className="px-6 py-4 text-sm text-ink-600">

                The highlighted region represents
                the image area that contributed
                to the model's prediction.

              </div>

            </>

          ) : (

            <div className="px-6 py-5 text-sm text-amber-700 bg-amber-50">

              {gradcamError ??
                'Grad-CAM heatmap could not be generated for this image.'}

            </div>

          )}

        </section>

      )}


      {/* =====================================================
          INSPECTION INFORMATION
      ====================================================== */}

      <section className="bg-white rounded-2xl border border-ink-200/60 overflow-hidden">

        <div className="px-6 py-4 border-b border-ink-100">

          <h3 className="text-sm font-semibold text-ink-700">

            Inspection Information

          </h3>

        </div>


        <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-ink-200/60">

          <DetailCell
            icon={
              <MapPin size={14} />
            }
            label="Panel / Site"
            value={
              inspection.panel_id
            }
          />


          <DetailCell
            icon={
              <Calendar size={14} />
            }
            label="Date"
            value={
              formatDate(
                inspection.inspection_at
              )
            }
          />


          <DetailCell
            icon={
              <Clock size={14} />
            }
            label="Time"
            value={
              formatTime(
                inspection.inspection_at
              )
            }
          />


          <DetailCell
            icon={
              <Cpu size={14} />
            }
            label="AI Prediction"
            value={
              inspection.prediction ??
              'Unknown'
            }
          />


          <DetailCell
            icon={
              <Play size={14} />
            }
            label="Trigger Type"
            value={
              inspection.trigger_type
                ? capitalize(
                    inspection.trigger_type
                  )
                : 'Unknown'
            }
          />


          <DetailCell
            icon={
              <Cpu size={14} />
            }
            label="Processing Status"
            value={
              <StatusBadge
                status={
                  inspection.processing_status
                }
              />
            }
          />

        </div>


        <div className="px-6 py-5 border-t border-ink-100">

          <p className="text-xs text-ink-400 mb-2 flex items-center gap-1.5">

            <Gauge size={14} />

            Confidence Score

          </p>


          <ConfidenceBar
            confidence={
              inspection.confidence
            }
          />

        </div>


        <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-ink-200/60 border-t border-ink-100">

          <div className="bg-white px-6 py-5">

            <p className="text-xs text-ink-400 mb-1.5 flex items-center gap-1.5">

              <Bell size={12} />

              Notification

            </p>


            <NotificationBadge
              status={
                inspection.notification_status
              }
            />

          </div>


          <div className="bg-white px-6 py-5">

            <p className="text-xs text-ink-400 mb-1.5">

              Fault Status

            </p>


            <FaultBadge
              isFault={
                inspection.is_fault
              }
            />

          </div>

        </div>

      </section>


      {/* =====================================================
          WEATHER
      ====================================================== */}

      {weather && (

        <section className="bg-white rounded-2xl border border-ink-200/60 overflow-hidden">

          <div className="px-6 py-4 border-b border-ink-100">

            <h3 className="text-sm font-semibold text-ink-700 flex items-center gap-2">

              <CloudSun size={16} />

              Weather Conditions

            </h3>

          </div>


          {weather.error ? (

            <div className="px-6 py-5 bg-amber-50 text-sm text-amber-700">

              Weather information could not
              be retrieved.

              <div className="mt-1 text-xs">

                {weather.error}

              </div>

            </div>

          ) : (

            <>

              {/* Main weather */}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-ink-200/60">

                <DetailCell
                  icon={
                    <CloudSun size={14} />
                  }
                  label="Temperature"
                  value={
                    formatWeatherValue(
                      weather.temperature_c,
                      ' °C'
                    )
                  }
                />


                <DetailCell
                  icon={
                    <Droplets size={14} />
                  }
                  label="Humidity"
                  value={
                    formatWeatherValue(
                      weather.humidity_pct,
                      ' %'
                    )
                  }
                />


                <DetailCell
                  icon={
                    <Droplets size={14} />
                  }
                  label="Rain"
                  value={
                    formatWeatherValue(
                      weather.rain_mm,
                      ' mm'
                    )
                  }
                />


                <DetailCell
                  icon={
                    <Droplets size={14} />
                  }
                  label="Precipitation"
                  value={
                    formatWeatherValue(
                      weather.precipitation_mm,
                      ' mm'
                    )
                  }
                />


                <DetailCell
                  icon={
                    <Droplets size={14} />
                  }
                  label="Showers"
                  value={
                    formatWeatherValue(
                      weather.showers_mm,
                      ' mm'
                    )
                  }
                />


                <DetailCell
                  icon={
                    <Wind size={14} />
                  }
                  label="Wind Speed"
                  value={
                    formatWeatherValue(
                      weather.wind_speed_kmh,
                      ' km/h'
                    )
                  }
                />


                <DetailCell
                  icon={
                    <Wind size={14} />
                  }
                  label="Wind Gusts"
                  value={
                    formatWeatherValue(
                      weather.wind_gusts_kmh,
                      ' km/h'
                    )
                  }
                />


                <DetailCell
                  icon={
                    <Cloud size={14} />
                  }
                  label="Cloud Cover"
                  value={
                    formatWeatherValue(
                      weather.cloud_cover_pct,
                      ' %'
                    )
                  }
                />


                <DetailCell
                  icon={
                    <CloudSun size={14} />
                  }
                  label="Weather Code"
                  value={
                    weather.weather_code == null
                      ? 'N/A'
                      : String(
                          weather.weather_code
                        )
                  }
                />

              </div>


              {/* Forecast */}

              <div className="px-6 py-5 border-t border-ink-100">

                <p className="text-xs text-ink-400 mb-3">

                  Next 24 Hours

                </p>


                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                  <div className="rounded-xl bg-ink-50 border border-ink-100 px-4 py-4">

                    <p className="text-xs text-ink-400">

                      Expected precipitation

                    </p>


                    <p className="text-lg font-semibold text-ink-800 mt-1">

                      {formatWeatherValue(
                        weather.forecast_24h_precipitation_mm,
                        ' mm'
                      )}

                    </p>

                  </div>


                  <div className="rounded-xl bg-ink-50 border border-ink-100 px-4 py-4">

                    <p className="text-xs text-ink-400">

                      Maximum rain probability

                    </p>


                    <p className="text-lg font-semibold text-ink-800 mt-1">

                      {formatWeatherValue(
                        weather.forecast_24h_precipitation_probability_max_pct,
                        ' %'
                      )}

                    </p>

                  </div>

                </div>

              </div>


              {/* GPS */}

              <div className="px-6 py-5 border-t border-ink-100">

                <p className="text-xs text-ink-400 mb-2 flex items-center gap-1.5">

                  <Map size={14} />

                  Inspection Location

                </p>


                <p className="text-sm text-ink-700">

                  Latitude:{' '}

                  {formatCoordinate(
                    weather.latitude
                  )}

                  {'  '}

                  Longitude:{' '}

                  {formatCoordinate(
                    weather.longitude
                  )}

                </p>


                <p className="text-xs text-ink-400 mt-1">

                  Weather source:{' '}

                  {weather.source ??
                    'Open-Meteo'}

                </p>

              </div>

            </>

          )}

        </section>

      )}


      {/* =====================================================
          CLEANING DECISION
      ====================================================== */}

      {cleaningDecision && (

        <section className="bg-white rounded-2xl border border-ink-200/60 overflow-hidden">

          <div className="px-6 py-4 border-b border-ink-100">

            <h3 className="text-sm font-semibold text-ink-700 flex items-center gap-2">

              <Droplets size={16} />

              Cleaning Decision

            </h3>

          </div>


          <div className="px-6 py-5">

            <p className="text-base font-semibold text-ink-800">

              {cleaningDecision.label}

            </p>


            <p className="text-sm text-ink-600 mt-2">

              {cleaningDecision.reason}

            </p>

          </div>

        </section>

      )}


      {/* =====================================================
          ERROR
      ====================================================== */}

      {inspection.error_message && (

        <div className="px-5 py-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">

          <p className="font-medium mb-1 flex items-center gap-2">

            <AlertCircle size={14} />

            Error

          </p>


          {inspection.error_message}

        </div>

      )}


      {/* =====================================================
          RAW MODEL RESPONSE
      ====================================================== */}

      {model && (

        <section className="bg-white rounded-2xl border border-ink-200/60 overflow-hidden">

          <div className="px-6 py-4 border-b border-ink-100">

            <h3 className="text-sm font-semibold text-ink-700 flex items-center gap-2">

              <Cpu size={15} />

              AI Model Response

            </h3>

          </div>


          <pre className="p-6 text-xs font-mono text-ink-600 overflow-x-auto bg-ink-50/50">

            {JSON.stringify(
              model,
              null,
              2
            )}

          </pre>

        </section>

      )}


      {/* =====================================================
          RAW OUTPUT
      ====================================================== */}

      {inspection.raw_output && (

        <section className="bg-white rounded-2xl border border-ink-200/60 overflow-hidden">

          <div className="px-6 py-4 border-b border-ink-100">

            <h3 className="text-sm font-semibold text-ink-700">

              Complete Inspection Data

            </h3>

          </div>


          <pre className="p-6 text-xs font-mono text-ink-600 overflow-x-auto bg-ink-50/50">

            {JSON.stringify(
              inspection.raw_output,
              null,
              2
            )}

          </pre>

        </section>

      )}

    </div>

  );
}


/**
 * Reusable detail cell.
 */
function DetailCell({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {

  return (

    <div className="bg-white px-6 py-5">

      <p className="text-xs text-ink-400 mb-1 flex items-center gap-1.5">

        {icon}

        {label}

      </p>


      <div className="text-sm text-ink-800">

        {value}

      </div>

    </div>

  );

}


/**
 * Format weather number.
 */
function formatWeatherValue(
  value:
    | number
    | null
    | undefined,
  unit: string
): string {

  if (
    value == null
  ) {

    return 'N/A';

  }


  return `${Number(value.toFixed(2))}${unit}`;

}


/**
 * Format confidence.
 *
 * Handles both:
 * 0.72
 * and
 * 72
 */
function formatPercent(
  value:
    | number
    | null
    | undefined
): string {

  if (
    value == null ||
    !Number.isFinite(value)
  ) {

    return 'N/A';

  }


  const percentage =
    value <= 1
      ? value * 100
      : value;


  return `${percentage.toFixed(0)}%`;

}


/**
 * Format GPS coordinate.
 */
function formatCoordinate(
  value:
    | number
    | null
    | undefined
): string {

  if (
    value == null ||
    !Number.isFinite(value)
  ) {

    return 'N/A';

  }


  return value.toFixed(6);

}


/**
 * Capitalize trigger type.
 */
function capitalize(
  value: string
): string {

  if (
    !value
  ) {

    return '';

  }


  return (
    value.charAt(0).toUpperCase() +
    value.slice(1)
  );

}