import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  CalendarClock,
  Camera,
  CheckCircle2,
  Clock,
  History,
  PanelTop,
  Play,
  RotateCcw,
  Settings,
  Square,
  Trash2,
  Zap,
} from 'lucide-react';

import { CameraCapture } from '@/components/CameraCapture';
import { InspectionDetails } from '@/components/InspectionDetails';

import type {
  Inspection,
} from '@/types';


// ============================================================
// TYPES
// ============================================================

interface SolarPanel {
  id: string;
  name: string;
  location?: string;
}


// ============================================================
// DEFAULT PANELS
// ============================================================

const DEFAULT_PANELS: SolarPanel[] = [
  {
    id: 'SP-001',
    name: 'Solar Panel 01',
    location: 'Panel Array A',
  },
  {
    id: 'SP-002',
    name: 'Solar Panel 02',
    location: 'Panel Array A',
  },
  {
    id: 'SP-003',
    name: 'Solar Panel 03',
    location: 'Panel Array B',
  },
];


// ============================================================
// STORAGE KEYS
// ============================================================

const HISTORY_STORAGE_KEY =
  'solarai-inspection-history';

const SCHEDULE_STORAGE_KEY =
  'solarai-inspection-schedule';


// ============================================================
// HELPERS
// ============================================================

function loadHistory(): Inspection[] {

  try {

    const stored =
      localStorage.getItem(
        HISTORY_STORAGE_KEY
      );

    if (!stored) {
      return [];
    }

    const parsed =
      JSON.parse(stored);

    return Array.isArray(parsed)
      ? parsed
      : [];

  } catch (error) {

    console.error(
      'Failed to load inspection history:',
      error
    );

    return [];

  }
}


function saveHistory(
  history: Inspection[]
) {

  try {

    localStorage.setItem(
      HISTORY_STORAGE_KEY,
      JSON.stringify(history)
    );

  } catch (error) {

    console.error(
      'Failed to save inspection history:',
      error
    );

  }
}


function getCurrentTime(): string {

  const now =
    new Date();

  return [
    String(
      now.getHours()
    ).padStart(2, '0'),

    String(
      now.getMinutes()
    ).padStart(2, '0'),
  ].join(':');

}


// ============================================================
// APP
// ============================================================

export default function App() {

  // ==========================================================
  // PANELS
  // ==========================================================

  const [
    panels,
    setPanels,
  ] = useState<SolarPanel[]>(
    DEFAULT_PANELS
  );


  const [
    selectedPanelId,
    setSelectedPanelId,
  ] = useState(
    DEFAULT_PANELS[0].id
  );


  const selectedPanel =
    useMemo(
      () =>
        panels.find(
          panel =>
            panel.id ===
            selectedPanelId
        ) ??
        panels[0],
      [
        panels,
        selectedPanelId,
      ]
    );


  // ==========================================================
  // INSPECTION
  // ==========================================================

  const [
    currentInspection,
    setCurrentInspection,
  ] = useState<Inspection | null>(
    null
  );


  const [
    inspectionHistory,
    setInspectionHistory,
  ] = useState<Inspection[]>(
    () => loadHistory()
  );


  // ==========================================================
  // SCHEDULE
  // ==========================================================

  const [
    inspectionTime,
    setInspectionTime,
  ] = useState(
    '10:30'
  );


  const [
    scheduleEnabled,
    setScheduleEnabled,
  ] = useState(
    false
  );


  /*
   * This is the important state passed to
   * CameraCapture.tsx.
   *
   * false = normal camera mode
   *
   * true = scheduled capture should happen
   */
  const [
    scheduledCapture,
    setScheduledCapture,
  ] = useState(
    false
  );


  /*
   * Prevent the same scheduled minute from
   * triggering repeatedly.
   *
   * Example:
   *
   * 10:30:00
   * 10:30:01
   * 10:30:02
   *
   * should NOT create three inspections.
   */
  const [
    lastTriggeredDate,
    setLastTriggeredDate,
  ] = useState<
    string | null
  >(null);


  // ==========================================================
  // UI STATE
  // ==========================================================

  const [
    activeTab,
    setActiveTab,
  ] = useState<
    'inspect' | 'history'
  >(
    'inspect'
  );


  const [
    showScheduleSettings,
    setShowScheduleSettings,
  ] = useState(
    false
  );


  // ==========================================================
  // LOAD SAVED SCHEDULE
  // ==========================================================

  useEffect(() => {

    try {

      const stored =
        localStorage.getItem(
          SCHEDULE_STORAGE_KEY
        );

      if (!stored) {
        return;
      }

      const schedule =
        JSON.parse(stored);

      if (
        typeof schedule?.time ===
        'string'
      ) {

        setInspectionTime(
          schedule.time
        );

      }

      if (
        typeof schedule?.enabled ===
        'boolean'
      ) {

        setScheduleEnabled(
          schedule.enabled
        );

      }

    } catch (error) {

      console.error(
        'Failed to load schedule:',
        error
      );

    }

  }, []);


  // ==========================================================
  // SAVE SCHEDULE
  // ==========================================================

  useEffect(() => {

    try {

      localStorage.setItem(
        SCHEDULE_STORAGE_KEY,
        JSON.stringify({
          time:
            inspectionTime,

          enabled:
            scheduleEnabled,
        })
      );

    } catch (error) {

      console.error(
        'Failed to save schedule:',
        error
      );

    }

  }, [
    inspectionTime,
    scheduleEnabled,
  ]);


  // ==========================================================
  // SCHEDULE CHECKER
  // ==========================================================

  useEffect(() => {

    /*
     * Don't run the scheduler when disabled.
     */
    if (
      !scheduleEnabled
    ) {

      return;

    }


    /*
     * Check immediately when schedule is enabled.
     */
    const checkSchedule =
      () => {

        const now =
          new Date();


        const currentHour =
          String(
            now.getHours()
          ).padStart(
            2,
            '0'
          );


        const currentMinute =
          String(
            now.getMinutes()
          ).padStart(
            2,
            '0'
          );


        const currentTime =
          `${currentHour}:${currentMinute}`;


        /*
         * Unique key for today's scheduled minute.
         *
         * Example:
         *
         * 2026-08-29-10:30
         */
        const todayKey =
          `${now
            .toISOString()
            .slice(0, 10)}-${currentTime}`;


        /*
         * Schedule matches current time.
         */
        if (
          currentTime ===
          inspectionTime
        ) {

          /*
           * Don't trigger repeatedly during
           * the same minute.
           */
          if (
            lastTriggeredDate ===
            todayKey
          ) {

            return;

          }


          console.log(
            '[Schedule] Scheduled inspection triggered:',
            currentTime
          );


          setLastTriggeredDate(
            todayKey
          );


          /*
           * This activates CameraCapture.tsx.
           */
          setScheduledCapture(
            true
          );

        }

      };


    checkSchedule();


    /*
     * Check every second.
     *
     * This allows the user to set a precise
     * minute without requiring the page to
     * be refreshed.
     */
    const interval =
      window.setInterval(
        checkSchedule,
        1000
      );


    return () => {

      window.clearInterval(
        interval
      );

    };

  }, [
    scheduleEnabled,
    inspectionTime,
    lastTriggeredDate,
  ]);


  // ==========================================================
  // INSPECTION COMPLETE
  // ==========================================================

  const handleInspectionComplete =
    (
      inspection: Inspection
    ) => {

      console.log(
        '[App] Inspection completed:',
        inspection
      );


      /*
       * Show latest inspection.
       */
      setCurrentInspection(
        inspection
      );


      /*
       * Add newest inspection
       * to history.
       */
      setInspectionHistory(
        previous => {

          const updated = [
            inspection,
            ...previous,
          ];

          /*
           * Keep the latest 100 records.
           */
          const limited =
            updated.slice(
              0,
              100
            );


          saveHistory(
            limited
          );


          return limited;

        }
      );


      /*
       * IMPORTANT:
       *
       * This turns scheduledCapture back
       * OFF after the scheduled inspection.
       *
       * The next scheduled time will turn it
       * ON again.
       */
      setScheduledCapture(
        false
      );


      /*
       * Open the inspection result.
       */
      setActiveTab(
        'inspect'
      );

    };


  // ==========================================================
  // ENABLE SCHEDULE
  // ==========================================================

  const enableSchedule =
    () => {

      setLastTriggeredDate(
        null
      );

      setScheduleEnabled(
        true
      );

    };


  // ==========================================================
  // DISABLE SCHEDULE
  // ==========================================================

  const disableSchedule =
    () => {

      /*
       * Stop future automatic captures.
       */
      setScheduleEnabled(
        false
      );


      /*
       * Cancel any pending scheduled capture.
       */
      setScheduledCapture(
        false
      );


      setLastTriggeredDate(
        null
      );

    };


  // ==========================================================
  // MANUAL TRIGGER FOR TESTING
  // ==========================================================

  const triggerScheduledInspectionNow =
    () => {

      console.log(
        '[App] Manual scheduled-capture test.'
      );


      /*
       * This is useful for testing without
       * waiting until 10:30.
       */
      setScheduledCapture(
        true
      );

    };


  // ==========================================================
  // CLEAR HISTORY
  // ==========================================================

  const clearHistory =
    () => {

      const confirmed =
        window.confirm(
          'Delete all inspection history?'
        );


      if (!confirmed) {

        return;

      }


      setInspectionHistory(
        []
      );


      setCurrentInspection(
        null
      );


      localStorage.removeItem(
        HISTORY_STORAGE_KEY
      );

    };


  // ==========================================================
  // DELETE ONE INSPECTION
  // ==========================================================

  const deleteInspection =
    (
      index: number
    ) => {

      setInspectionHistory(
        previous => {

          const updated =
            previous.filter(
              (_, i) =>
                i !== index
            );


          saveHistory(
            updated
          );


          return updated;

        }
      );

    };


  // ==========================================================
  // PANEL CHANGE
  // ==========================================================

  const handlePanelChange =
    (
      event: React.ChangeEvent<HTMLSelectElement>
    ) => {

      setSelectedPanelId(
        event.target.value
      );


      /*
       * Clear previous result when
       * changing to another panel.
       */
      setCurrentInspection(
        null
      );


      /*
       * A scheduled capture should not
       * accidentally run against a panel
       * after the user changes selection.
       */
      setScheduledCapture(
        false
      );

    };


  // ==========================================================
  // SCHEDULE STATUS
  // ==========================================================

  const scheduleStatus =
    scheduleEnabled
      ? `Automatic inspection scheduled for ${inspectionTime}`
      : 'Automatic inspection is disabled';


  // ==========================================================
  // RENDER
  // ==========================================================

  return (

    <div className="min-h-screen bg-ink-50 text-ink-900">

      {/* ======================================================
          HEADER
          ====================================================== */}

      <header className="border-b border-ink-200 bg-white">

        <div className="max-w-7xl mx-auto px-6 py-4">

          <div className="flex items-center justify-between gap-4">

            {/* Logo / title */}

            <div className="flex items-center gap-3">

              <div className="w-10 h-10 rounded-xl bg-ink-900 flex items-center justify-center">

                <Zap
                  size={20}
                  className="text-white"
                />

              </div>


              <div>

                <h1 className="text-lg font-semibold">

                  SolarAI

                </h1>


                <p className="text-xs text-ink-400">

                  Intelligent Solar Panel Inspection

                </p>

              </div>

            </div>


            {/* Status */}

            <div className="hidden sm:flex items-center gap-2 text-xs text-ink-500">

              <span className="w-2 h-2 rounded-full bg-green-500" />

              MobileNetV3 Inspection System

            </div>

          </div>

        </div>

      </header>


      {/* ======================================================
          MAIN
          ====================================================== */}

      <main className="max-w-7xl mx-auto px-6 py-8">

        {/* ====================================================
            PANEL + SCHEDULE BAR
            ==================================================== */}

        <section className="bg-white border border-ink-200/60 rounded-2xl p-5 mb-6">

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

            {/* Panel selection */}

            <div>

              <label className="block text-xs font-medium text-ink-500 mb-2">

                Solar Panel

              </label>


              <div className="relative">

                <PanelTop
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
                />


                <select
                  value={
                    selectedPanelId
                  }
                  onChange={
                    handlePanelChange
                  }
                  className="w-full pl-9 pr-4 py-3 border border-ink-200 rounded-xl bg-white text-sm outline-none focus:border-ink-900"
                >

                  {panels.map(
                    panel => (

                      <option
                        key={
                          panel.id
                        }
                        value={
                          panel.id
                        }
                      >

                        {panel.id}
                        {' — '}
                        {panel.name}

                      </option>

                    )
                  )}

                </select>

              </div>

            </div>


            {/* Schedule time */}

            <div>

              <label className="block text-xs font-medium text-ink-500 mb-2">

                Automatic Inspection Time

              </label>


              <div className="flex gap-2">

                <div className="relative flex-1">

                  <Clock
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
                  />


                  <input
                    type="time"
                    value={
                      inspectionTime
                    }
                    onChange={
                      event =>
                        setInspectionTime(
                          event.target.value
                        )
                    }
                    className="w-full pl-9 pr-3 py-3 border border-ink-200 rounded-xl text-sm outline-none focus:border-ink-900"
                  />

                </div>


                <button
                  type="button"
                  onClick={() =>
                    setShowScheduleSettings(
                      value =>
                        !value
                    )
                  }
                  className="px-3 border border-ink-200 rounded-xl hover:bg-ink-50"
                  title="Schedule settings"
                >

                  <Settings
                    size={16}
                  />

                </button>

              </div>

            </div>


            {/* Schedule control */}

            <div>

              <label className="block text-xs font-medium text-ink-500 mb-2">

                Automatic Capture

              </label>


              {scheduleEnabled ? (

                <button
                  type="button"
                  onClick={
                    disableSchedule
                  }
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-sm font-medium hover:bg-red-100"
                >

                  <Square
                    size={15}
                  />

                  Stop Schedule

                </button>

              ) : (

                <button
                  type="button"
                  onClick={
                    enableSchedule
                  }
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-ink-900 text-white rounded-xl text-sm font-medium hover:bg-ink-800"
                >

                  <Play
                    size={15}
                  />

                  Start Schedule

                </button>

              )}

            </div>

          </div>


          {/* Schedule information */}

          <div className="mt-4 pt-4 border-t border-ink-100 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">

            <div className="flex items-center gap-2 text-ink-500">

              <CalendarClock
                size={14}
              />

              {scheduleStatus}

            </div>


            {scheduledCapture && (

              <div className="flex items-center gap-2 text-green-700 font-medium">

                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />

                Scheduled capture is active

              </div>

            )}

          </div>


          {/* Testing controls */}

          {showScheduleSettings && (

            <div className="mt-4 pt-4 border-t border-ink-100">

              <p className="text-xs text-ink-400 mb-3">

                Testing

              </p>


              <button
                type="button"
                onClick={
                  triggerScheduledInspectionNow
                }
                className="flex items-center gap-2 px-4 py-2.5 border border-ink-200 rounded-xl text-sm text-ink-700 hover:bg-ink-50"
              >

                <Camera
                  size={15}
                />

                Test Automatic Capture Now

              </button>


              <p className="text-xs text-ink-400 mt-2">

                This triggers the same automatic
                capture flow without waiting for
                the scheduled time.

              </p>

            </div>

          )}

        </section>


        {/* ====================================================
            TABS
            ==================================================== */}

        <div className="flex items-center gap-1 p-1 bg-ink-100 rounded-xl w-fit mb-6">

          <button
            type="button"
            onClick={() =>
              setActiveTab(
                'inspect'
              )
            }
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeTab ===
              'inspect'
                ? 'bg-white text-ink-900 shadow-sm'
                : 'text-ink-500'
            }`}
          >

            <Camera
              size={15}
            />

            Inspection

          </button>


          <button
            type="button"
            onClick={() =>
              setActiveTab(
                'history'
              )
            }
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeTab ===
              'history'
                ? 'bg-white text-ink-900 shadow-sm'
                : 'text-ink-500'
            }`}
          >

            <History
              size={15}
            />

            History

            {inspectionHistory.length >
              0 && (

              <span className="px-1.5 py-0.5 rounded-full bg-ink-100 text-xs">

                {inspectionHistory.length}

              </span>

            )}

          </button>

        </div>


        {/* ====================================================
            INSPECTION TAB
            ==================================================== */}

        {activeTab ===
          'inspect' && (

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

            {/* Camera */}

            <section className="bg-white border border-ink-200/60 rounded-2xl p-6">

              <div className="mb-5">

                <h2 className="text-base font-semibold">

                  Panel Inspection

                </h2>


                <p className="text-xs text-ink-400 mt-1">

                  {selectedPanel?.name}
                  {' • '}
                  {selectedPanel?.location}

                </p>

              </div>


              <CameraCapture
                panelId={
                  selectedPanel?.id ??
                  selectedPanelId
                }

                scheduledCapture={
                  scheduledCapture
                }

                onInspectionComplete={
                  handleInspectionComplete
                }
              />

            </section>


            {/* Result */}

            <section className="bg-white border border-ink-200/60 rounded-2xl p-6">

              <div className="mb-5">

                <h2 className="text-base font-semibold">

                  Inspection Analysis

                </h2>


                <p className="text-xs text-ink-400 mt-1">

                  MobileNetV3 + Grad-CAM + Weather

                </p>

              </div>


              {currentInspection ? (

                <InspectionDetails
                  inspectionId={
                    currentInspection.id
                  }
                  onBack={
                    () => setCurrentInspection(null)
                  }
                />

              ) : (

                <div className="flex flex-col items-center justify-center min-h-[400px] text-center">

                  <div className="w-14 h-14 rounded-full bg-ink-100 flex items-center justify-center">

                    <PanelTop
                      size={24}
                      className="text-ink-400"
                    />

                  </div>


                  <p className="mt-4 text-sm font-medium text-ink-700">

                    No inspection result yet

                  </p>


                  <p className="mt-2 text-xs text-ink-400 max-w-xs">

                    Capture a solar panel image
                    using the phone camera or wait
                    for the scheduled inspection.

                  </p>

                </div>

              )}

            </section>

          </div>

        )}


        {/* ====================================================
            HISTORY TAB
            ==================================================== */}

        {activeTab ===
          'history' && (

          <section className="bg-white border border-ink-200/60 rounded-2xl overflow-hidden">

            <div className="px-6 py-5 border-b border-ink-100 flex items-center justify-between">

              <div>

                <h2 className="text-base font-semibold">

                  Inspection History

                </h2>


                <p className="text-xs text-ink-400 mt-1">

                  Previous solar panel inspections

                </p>

              </div>


              {inspectionHistory.length >
                0 && (

                <button
                  type="button"
                  onClick={
                    clearHistory
                  }
                  className="flex items-center gap-2 px-3 py-2 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
                >

                  <Trash2
                    size={14}
                  />

                  Clear History

                </button>

              )}

            </div>


            {inspectionHistory.length ===
            0 ? (

              <div className="py-20 text-center">

                <History
                  size={28}
                  className="mx-auto text-ink-300"
                />


                <p className="mt-4 text-sm font-medium text-ink-600">

                  No inspections yet

                </p>


                <p className="mt-1 text-xs text-ink-400">

                  Completed inspections will appear here.

                </p>

              </div>

            ) : (

              <div className="divide-y divide-ink-100">

                {inspectionHistory.map(
                  (
                    inspection,
                    index
                  ) => (

                    <div
                      key={
                        inspection.id ??
                        `${inspection.panel_id}-${index}`
                      }
                      className="px-6 py-5 flex items-center justify-between gap-4"
                    >

                      <div className="min-w-0">

                        <div className="flex items-center gap-2">

                          <p className="text-sm font-medium text-ink-800">

                            {inspection.panel_id}

                          </p>


                          {inspection.is_fault ? (

                            <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-700 text-[10px] font-medium">

                              Fault

                            </span>

                          ) : (

                            <span className="px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-[10px] font-medium">

                              Normal

                            </span>

                          )}

                        </div>


                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-ink-400">

                          <span>

                            {inspection.prediction ??
                              'Unknown'}

                          </span>


                          {inspection.confidence !=
                            null && (

                            <span>

                              Confidence:

                              {' '}

                              {(
                                inspection.confidence *
                                100
                              ).toFixed(1)}

                              %

                            </span>

                          )}


                          <span>

                            {inspection.processing_status}

                          </span>

                        </div>

                      </div>


                      <div className="flex items-center gap-2">

                        <button
                          type="button"
                          onClick={() => {

                            setCurrentInspection(
                              inspection
                            );

                            setActiveTab(
                              'inspect'
                            );

                          }}
                          className="flex items-center gap-2 px-3 py-2 text-xs font-medium border border-ink-200 rounded-lg hover:bg-ink-50"
                        >

                          <CheckCircle2
                            size={13}
                          />

                          View

                        </button>


                        <button
                          type="button"
                          onClick={() =>
                            deleteInspection(
                              index
                            )
                          }
                          className="p-2 text-ink-400 hover:text-red-600"
                          title="Delete inspection"
                        >

                          <Trash2
                            size={14}
                          />

                        </button>

                      </div>

                    </div>

                  )
                )}

              </div>

            )}

          </section>

        )}

      </main>


      {/* ======================================================
          FOOTER
          ====================================================== */}

      <footer className="max-w-7xl mx-auto px-6 pb-8">

        <div className="pt-5 border-t border-ink-200 text-xs text-ink-400 flex flex-wrap items-center justify-between gap-3">

          <span>

            SolarAI • MobileNetV3 Small

          </span>


          <span>

            Grad-CAM Explainable AI

          </span>

        </div>

      </footer>

    </div>

  );

}
