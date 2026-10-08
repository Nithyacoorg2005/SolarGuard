import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from 'react';

import {
  Camera,
  RefreshCw,
  Upload,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  CloudSun,
  Droplets,
  ScanSearch,
} from 'lucide-react';

import { runInspection } from '@/lib/inspectionApi';

import {
  ensureNotificationPermission,
  sendFaultNotification,
} from '@/lib/notificationService';

import { isModelConnected } from '@/lib/modelAdapter';

import type {
  CleaningDecision,
  Inspection,
  WeatherSnapshot,
} from '@/types';

import {
  ErrorBanner,
  FaultBadge,
  ConfidenceBar,
} from './StatusBadges';


// ============================================================
// TYPES
// ============================================================

type CapturePhase =
  | 'idle'
  | 'preview'
  | 'processing'
  | 'success'
  | 'error';

interface CameraCaptureProps {
  panelId: string;

  /*
   * App.tsx changes this to true when
   * the scheduled inspection time is reached.
   */
  scheduledCapture: boolean;

  /*
   * Sends completed inspection back to App.tsx.
   */
  onInspectionComplete: (
    inspection: Inspection
  ) => void;
}


// ============================================================
// COMPONENT
// ============================================================

export function CameraCapture({
  panelId,
  scheduledCapture,
  onInspectionComplete,
}: CameraCaptureProps) {

  // ==========================================================
  // STATE
  // ==========================================================

  const [phase, setPhase] =
    useState<CapturePhase>('idle');

  const [error, setError] =
    useState<string | null>(null);

  const [cameraError, setCameraError] =
    useState<string | null>(null);

  const [result, setResult] =
    useState<Inspection | null>(null);

  const [imageDataUrl, setImageDataUrl] =
    useState<string | null>(null);

  const [imageBlob, setImageBlob] =
    useState<Blob | null>(null);

  const [cameraActive, setCameraActive] =
    useState(false);

  const [facingMode, setFacingMode] =
    useState<'environment' | 'user'>(
      'environment'
    );

  const [countdown, setCountdown] =
    useState<number | null>(null);

  const [captureStatus, setCaptureStatus] =
    useState(
      'Start the camera to begin.'
    );

  const [scheduledRunning, setScheduledRunning] =
    useState(false);


  // ==========================================================
  // REFS
  // ==========================================================

  const videoRef =
    useRef<HTMLVideoElement | null>(null);

  const streamRef =
    useRef<MediaStream | null>(null);

  const fileInputRef =
    useRef<HTMLInputElement | null>(null);

  /*
   * Prevent two inspections from running
   * at the same time.
   */
  const processingRef =
    useRef(false);

  /*
   * Prevent duplicate scheduled captures.
   */
  const scheduledCaptureRunningRef =
    useRef(false);

  /*
   * Keep latest scheduledCapture value available
   * inside asynchronous functions.
   */
  const scheduledCaptureRef =
    useRef(scheduledCapture);

  /*
   * Used to cancel countdown/capture when
   * component unmounts or schedule is cancelled.
   */
  const cancelledRef =
    useRef(false);

  const modelConnected =
    isModelConnected();


  // ==========================================================
  // KEEP SCHEDULE VALUE UPDATED
  // ==========================================================

  useEffect(() => {

    scheduledCaptureRef.current =
      scheduledCapture;

  }, [
    scheduledCapture,
  ]);


  // ==========================================================
  // STOP STREAM
  // ==========================================================

  const stopStream =
    useCallback(() => {

      if (
        streamRef.current
      ) {

        streamRef.current
          .getTracks()
          .forEach(
            track => {
              track.stop();
            }
          );

        streamRef.current =
          null;
      }


      if (
        videoRef.current
      ) {

        videoRef.current.srcObject =
          null;
      }


      setCameraActive(
        false
      );

    }, []);


  // ==========================================================
  // START CAMERA
  // ==========================================================

  const startCamera =
    useCallback(
      async () => {

        setCameraError(null);
        setError(null);


        try {

          if (
            !navigator.mediaDevices ||
            !navigator.mediaDevices.getUserMedia
          ) {

            throw new Error(
              'Camera access is not supported by this browser.'
            );

          }


          /*
           * Stop previous camera if one exists.
           */
          stopStream();


          setCaptureStatus(
            'Connecting to phone camera...'
          );


          /*
           * DroidCam appears to the browser
           * as a normal webcam.
           */
          const stream =
            await navigator.mediaDevices.getUserMedia(
              {
                video: {
                  width: {
                    ideal: 1280,
                  },

                  height: {
                    ideal: 720,
                  },

                  facingMode: {
                    ideal: facingMode,
                  },
                },

                audio: false,
              }
            );


          streamRef.current =
            stream;


          setCameraActive(
            true
          );


          /*
           * Attach stream to video element.
           */
          if (
            videoRef.current
          ) {

            videoRef.current.srcObject =
              stream;

            videoRef.current.muted =
              true;

            videoRef.current.playsInline =
              true;


            await videoRef.current.play();

          }


          setCaptureStatus(
            scheduledCaptureRef.current
              ? 'Camera connected. Waiting for scheduled capture...'
              : 'Phone camera connected successfully.'
          );


        } catch (
          err
        ) {

          console.error(
            '[Camera] Failed to start:',
            err
          );


          const message =
            err instanceof Error
              ? err.message
              : 'Unable to access camera.';


          if (
            message.includes(
              'NotAllowed'
            ) ||
            message.includes(
              'Permission'
            )
          ) {

            setCameraError(
              'Camera permission was denied. Allow camera access in the browser.'
            );

          } else if (
            message.includes(
              'NotFound'
            )
          ) {

            setCameraError(
              'No camera found. Make sure DroidCam is connected and running.'
            );

          } else {

            setCameraError(
              message
            );

          }


          setCameraActive(
            false
          );

        }

      },
      [
        facingMode,
        stopStream,
      ]
    );


  // ==========================================================
  // CAPTURE CURRENT VIDEO FRAME
  // ==========================================================

  const captureFrame =
    useCallback(
      async (): Promise<Blob | null> => {

        const video =
          videoRef.current;


        if (!video) {

          console.error(
            '[Capture] Video element not available.'
          );

          return null;
        }


        if (!streamRef.current) {

          console.error(
            '[Capture] Camera stream not available.'
          );

          return null;
        }


        if (
          video.readyState < 2
        ) {

          console.error(
            '[Capture] Video is not ready.'
          );

          return null;
        }


        if (
          video.videoWidth === 0 ||
          video.videoHeight === 0
        ) {

          console.error(
            '[Capture] Invalid video dimensions.'
          );

          return null;
        }


        /*
         * Create canvas matching camera resolution.
         */
        const canvas =
          document.createElement(
            'canvas'
          );


        canvas.width =
          video.videoWidth;

        canvas.height =
          video.videoHeight;


        const context =
          canvas.getContext(
            '2d'
          );


        if (!context) {

          return null;
        }


        /*
         * Copy the current camera frame.
         */
        context.drawImage(
          video,
          0,
          0,
          canvas.width,
          canvas.height
        );


        /*
         * Convert frame to JPEG.
         */
        const blob =
          await new Promise<Blob | null>(
            resolve => {

              canvas.toBlob(
                resultBlob => {
                  resolve(
                    resultBlob
                  );
                },
                'image/jpeg',
                0.90
              );

            }
          );


        if (!blob) {

          return null;
        }


        /*
         * Save image for preview / inspection.
         */
        const dataUrl =
          canvas.toDataURL(
            'image/jpeg',
            0.90
          );


        setImageDataUrl(
          dataUrl
        );

        setImageBlob(
          blob
        );


        console.log(
          '[Capture] Image captured:',
          blob.size,
          'bytes'
        );


        return blob;

      },
      []
    );


  // ==========================================================
  // RUN INSPECTION
  // ==========================================================

  const inspectImage =
    useCallback(
      async (
        blob: Blob,
        mode: 'manual' | 'scheduled'
      ) => {

        if (
          processingRef.current
        ) {

          console.log(
            '[Inspection] Inspection already running.'
          );

          return null;
        }


        processingRef.current =
          true;


        setPhase(
          'processing'
        );

        setError(
          null
        );


        setCaptureStatus(
          mode === 'scheduled'
            ? 'Automatic capture complete. Analyzing solar panel...'
            : 'Analyzing solar panel...'
        );


        try {

          /*
           * Request browser notification permission.
           */
          try {

            await ensureNotificationPermission();

          } catch (
            permissionError
          ) {

            console.warn(
              '[Notification] Permission unavailable:',
              permissionError
            );

          }


          /*
           * IMPORTANT:
           *
           * scheduled -> automatic inspection
           * manual    -> user initiated inspection
           *
           * Your existing inspectionApi handles:
           *
           * image
           * weather
           * MobileNetV3
           * Grad-CAM
           * cleaning decision
           */
          const inspection =
            await runInspection(
              panelId,
              blob,
              mode
            );


          /*
           * Send notification only if
           * MobileNetV3 reports a fault.
           */
          if (
            inspection.is_fault &&
            inspection.processing_status ===
              'completed'
          ) {

            try {

              await sendFaultNotification(
                inspection
              );

            } catch (
              notificationError
            ) {

              console.warn(
                '[Notification] Fault notification failed:',
                notificationError
              );

            }

          }


          /*
           * Store inspection result.
           */
          setResult(
            inspection
          );


          setPhase(
            'success'
          );


          setCaptureStatus(
            mode === 'scheduled'
              ? 'Scheduled inspection completed successfully.'
              : 'Inspection completed successfully.'
          );


          /*
           * Give result to App.tsx.
           */
          onInspectionComplete(
            inspection
          );


          console.log(
            '[Inspection] Result:',
            inspection
          );


          return inspection;


        } catch (
          err
        ) {

          console.error(
            '[Inspection] Failed:',
            err
          );


          const message =
            err instanceof Error
              ? err.message
              : 'Inspection failed.';


          setError(
            message
          );


          setPhase(
            'error'
          );


          setCaptureStatus(
            mode === 'scheduled'
              ? 'Scheduled inspection failed.'
              : 'Inspection failed.'
          );


          return null;

        } finally {

          processingRef.current =
            false;

        }

      },
      [
        panelId,
        onInspectionComplete,
      ]
    );


  // ==========================================================
  // MANUAL CAPTURE
  // ==========================================================

  const captureNow =
    useCallback(
      async () => {

        if (
          processingRef.current
        ) {

          return;
        }


        const blob =
          await captureFrame();


        if (!blob) {

          setError(
            'Unable to capture image from the phone camera.'
          );

          return;
        }


        setResult(
          null
        );


        setPhase(
          'preview'
        );


        setCaptureStatus(
          'Photo captured. Click "Run Inspection" to analyze it.'
        );

      },
      [
        captureFrame,
      ]
    );


  // ==========================================================
  // MANUAL INSPECTION
  // ==========================================================

  const runManualInspection =
    useCallback(
      async () => {

        if (!imageBlob) {

          setError(
            'No image available for inspection.'
          );

          return;
        }


        await inspectImage(
          imageBlob,
          'manual'
        );

      },
      [
        imageBlob,
        inspectImage,
      ]
    );


  // ==========================================================
  // SCHEDULED AUTOMATIC INSPECTION
  // ==========================================================

  useEffect(() => {

    /*
     * Schedule is not currently active.
     */
    if (
      !scheduledCapture
    ) {

      cancelledRef.current =
        true;

      setScheduledRunning(
        false
      );

      setCountdown(
        null
      );

      return;

    }


    /*
     * Prevent duplicate execution.
     */
    if (
      scheduledCaptureRunningRef.current
    ) {

      return;

    }


    scheduledCaptureRunningRef.current =
      true;

    cancelledRef.current =
      false;

    setScheduledRunning(
      true
    );


    const wait =
      (
        milliseconds: number
      ) =>
        new Promise<void>(
          resolve => {

            window.setTimeout(
              resolve,
              milliseconds
            );

          }
        );


    const performScheduledCapture =
      async () => {

        /*
         * If camera is not connected,
         * start it first.
         */
        if (
          !streamRef.current ||
          !videoRef.current ||
          !cameraActive
        ) {

          setCaptureStatus(
            'Scheduled time reached. Starting phone camera...'
          );


          await startCamera();


          /*
           * Allow camera/video a moment to stabilize.
           */
          await wait(
            1500
          );

        }


        /*
         * Check whether schedule was cancelled.
         */
        if (
          cancelledRef.current ||
          !scheduledCaptureRef.current
        ) {

          return;

        }


        /*
         * Make sure camera is actually ready.
         */
        const video =
          videoRef.current;


        if (
          !video ||
          !streamRef.current ||
          video.readyState < 2 ||
          video.videoWidth <= 0 ||
          video.videoHeight <= 0
        ) {

          throw new Error(
            'Phone camera is not ready for scheduled capture.'
          );

        }


        // ======================================================
        // 5 SECOND COUNTDOWN
        // ======================================================

        for (
          let seconds = 5;
          seconds >= 1;
          seconds--
        ) {

          if (
            cancelledRef.current ||
            !scheduledCaptureRef.current
          ) {

            return;

          }


          setCountdown(
            seconds
          );


          setCaptureStatus(
            `Automatic capture in ${seconds}...`
          );


          await wait(
            1000
          );

        }


        setCountdown(
          null
        );


        if (
          cancelledRef.current ||
          !scheduledCaptureRef.current
        ) {

          return;

        }


        // ======================================================
        // AUTO CLICK / CAPTURE
        // ======================================================

        setCaptureStatus(
          '📸 Capturing solar-panel image automatically...'
        );


        const blob =
          await captureFrame();


        if (!blob) {

          throw new Error(
            'Automatic camera capture failed.'
          );

        }


        /*
         * IMPORTANT:
         *
         * This is a scheduled inspection.
         * Therefore use "scheduled", NOT "manual".
         */
        await inspectImage(
          blob,
          'scheduled'
        );


      };


    performScheduledCapture()
      .catch(
        err => {

          console.error(
            '[Scheduled Capture] Failed:',
            err
          );


          setError(
            err instanceof Error
              ? err.message
              : 'Scheduled capture failed.'
          );


          setPhase(
            'error'
          );


          setCaptureStatus(
            'Scheduled inspection failed. Waiting for the next schedule.'
          );

        }
      )
      .finally(
        () => {

          /*
           * IMPORTANT:
           *
           * Only ONE automatic inspection happens
           * for each scheduledCapture activation.
           *
           * App.tsx must activate scheduledCapture
           * again at the next scheduled time.
           */
          scheduledCaptureRunningRef.current =
            false;

          setScheduledRunning(
            false
          );

          setCountdown(
            null
          );

        }
      );


    return () => {

      cancelledRef.current =
        true;

    };

  }, [
    scheduledCapture,
    cameraActive,
    startCamera,
    captureFrame,
    inspectImage,
  ]);


  // ==========================================================
  // SWITCH CAMERA
  // ==========================================================

  const switchCamera =
    useCallback(
      async () => {

        /*
         * Do not switch while AI is processing.
         */
        if (
          processingRef.current
        ) {

          return;

        }


        stopStream();


        setCaptureStatus(
          'Switching camera...'
        );


        setFacingMode(
          current =>
            current === 'environment'
              ? 'user'
              : 'environment'
        );

      },
      [
        stopStream,
      ]
    );


  // ==========================================================
  // RESTART CAMERA AFTER FACING MODE CHANGE
  // ==========================================================

  useEffect(() => {

    if (
      !cameraActive
    ) {

      return;
    }


    /*
     * Camera was active and facingMode changed.
     * Restart it.
     */
    startCamera();

  }, [
    facingMode,
  ]);


  // ==========================================================
  // FILE UPLOAD
  // ==========================================================

  const handleFileUpload =
    (
      event: ChangeEvent<HTMLInputElement>
    ) => {

      const file =
        event.target.files?.[0];


      if (!file) {

        return;

      }


      if (
        !file.type.startsWith(
          'image/'
        )
      ) {

        setError(
          'Please select a valid image file.'
        );

        return;

      }


      /*
       * Stop camera when using uploaded image.
       */
      stopStream();


      setImageBlob(
        file
      );


      setResult(
        null
      );


      setError(
        null
      );


      const reader =
        new FileReader();


      reader.onload =
        () => {

          setImageDataUrl(
            reader.result as string
          );


          setPhase(
            'preview'
          );


          setCaptureStatus(
            'Image uploaded. Click "Run Inspection".'
          );

        };


      reader.onerror =
        () => {

          setError(
            'Unable to read the selected image.'
          );

        };


      reader.readAsDataURL(
        file
      );

    };


  // ==========================================================
  // RESET
  // ==========================================================

  const resetCapture =
    useCallback(
      () => {

        cancelledRef.current =
          true;

        scheduledCaptureRunningRef.current =
          false;


        stopStream();


        setImageDataUrl(
          null
        );

        setImageBlob(
          null
        );

        setResult(
          null
        );

        setError(
          null
        );

        setCameraError(
          null
        );

        setCountdown(
          null
        );

        setScheduledRunning(
          false
        );

        setPhase(
          'idle'
        );

        setCaptureStatus(
          'Start the camera to begin.'
        );


        if (
          fileInputRef.current
        ) {

          fileInputRef.current.value =
            '';

        }

      },
      [
        stopStream,
      ]
    );


  // ==========================================================
  // CLEANUP ON UNMOUNT
  // ==========================================================

  useEffect(() => {

    return () => {

      cancelledRef.current =
        true;


      if (
        streamRef.current
      ) {

        streamRef.current
          .getTracks()
          .forEach(
            track => {
              track.stop();
            }
          );

      }

    };

  }, []);


  // ==========================================================
  // UI
  // ==========================================================

  return (

    <div className="max-w-2xl mx-auto">

      {/* ======================================================
          MODEL CONNECTION WARNING
          ====================================================== */}

      {!modelConnected &&
        phase === 'idle' && (

          <div className="mb-6 px-5 py-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">

            <strong className="font-semibold">
              AI model is not connected.
            </strong>

            {' '}

            Configure your model inference URL before
            running an inspection.

          </div>

        )}


      {/* ======================================================
          GENERAL ERROR
          ====================================================== */}

      {error && (

        <div className="mb-6">

          <ErrorBanner
            message={error}
            onDismiss={() =>
              setError(null)
            }
          />

        </div>

      )}


      {/* ======================================================
          CAMERA ERROR
          ====================================================== */}

      {cameraError && (

        <div className="mb-6 px-5 py-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">

          {cameraError}

        </div>

      )}


      {/* ======================================================
          IDLE / CAMERA
          ====================================================== */}

      {phase === 'idle' && (

        <div className="space-y-4">

          {cameraActive ? (

            <div className="relative bg-ink-950 rounded-2xl overflow-hidden">

              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full aspect-video object-cover"
              />


              {/* Camera border */}

              <div className="absolute inset-0 pointer-events-none border-2 border-white/20 m-4 rounded-xl" />


              {/* Connection indicator */}

              <div className="absolute top-4 left-4">

                <div className="flex items-center gap-2 px-3 py-2 bg-black/70 backdrop-blur-sm rounded-lg text-white text-xs">

                  <span
                    className={`w-2 h-2 rounded-full ${
                      scheduledRunning
                        ? 'bg-green-400 animate-pulse'
                        : 'bg-green-400'
                    }`}
                  />

                  {scheduledRunning
                    ? 'Scheduled inspection active'
                    : 'DroidCam connected'}

                </div>

              </div>


              {/* Countdown */}

              {countdown !== null && (

                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">

                  <div className="w-32 h-32 rounded-full bg-black/75 backdrop-blur-sm flex items-center justify-center">

                    <span className="text-6xl font-bold text-white">

                      {countdown}

                    </span>

                  </div>

                </div>

              )}


              {/* Status */}

              <div className="absolute bottom-20 left-1/2 -translate-x-1/2">

                <div className="px-4 py-2 bg-black/75 backdrop-blur-sm rounded-lg text-white text-xs whitespace-nowrap">

                  {captureStatus}

                </div>

              </div>


              {/* Controls */}

              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2">

                <button
                  type="button"
                  onClick={
                    captureNow
                  }
                  disabled={
                    scheduledRunning ||
                    processingRef.current
                  }
                  className="flex items-center gap-2 px-5 py-2.5 bg-white text-ink-900 text-sm font-medium rounded-xl hover:bg-ink-100 disabled:opacity-50"
                >

                  <Camera
                    size={16}
                  />

                  Capture Now

                </button>


                <button
                  type="button"
                  onClick={
                    switchCamera
                  }
                  disabled={
                    scheduledRunning ||
                    processingRef.current
                  }
                  className="px-3 py-2.5 bg-white/90 text-ink-900 rounded-xl disabled:opacity-50"
                  title="Switch camera"
                >

                  <RefreshCw
                    size={16}
                  />

                </button>


                <button
                  type="button"
                  onClick={
                    stopStream
                  }
                  disabled={
                    scheduledRunning
                  }
                  className="px-3 py-2.5 bg-white/90 text-ink-900 rounded-xl disabled:opacity-50"
                  title="Stop camera"
                >

                  <X
                    size={16}
                  />

                </button>

              </div>

            </div>

          ) : (

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              {/* Start camera */}

              <button
                type="button"
                onClick={
                  startCamera
                }
                className="group flex flex-col items-center gap-3 py-12 border-2 border-ink-200 rounded-2xl hover:border-ink-900 hover:bg-ink-50 transition-all"
              >

                <div className="w-12 h-12 rounded-full bg-ink-100 group-hover:bg-ink-900 flex items-center justify-center">

                  <Camera
                    size={22}
                    className="text-ink-600 group-hover:text-white"
                  />

                </div>


                <span className="text-sm font-medium text-ink-700">

                  Start Camera

                </span>


                <span className="text-xs text-ink-400">

                  Phone Camera • DroidCam

                </span>

              </button>


              {/* Upload image */}

              <button
                type="button"
                onClick={() =>
                  fileInputRef.current?.click()
                }
                className="group flex flex-col items-center gap-3 py-12 border-2 border-ink-200 rounded-2xl hover:border-ink-900 hover:bg-ink-50 transition-all"
              >

                <div className="w-12 h-12 rounded-full bg-ink-100 group-hover:bg-ink-900 flex items-center justify-center">

                  <Upload
                    size={22}
                    className="text-ink-600 group-hover:text-white"
                  />

                </div>


                <span className="text-sm font-medium text-ink-700">

                  Upload Image

                </span>


                <span className="text-xs text-ink-400">

                  Select an existing image

                </span>

              </button>


              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={
                  handleFileUpload
                }
                className="hidden"
              />

            </div>

          )}

        </div>

      )}


      {/* ======================================================
          IMAGE PREVIEW
          ====================================================== */}

      {phase === 'preview' &&
        imageDataUrl && (

          <div className="space-y-5">

            <div className="bg-ink-950 rounded-2xl overflow-hidden">

              <img
                src={imageDataUrl}
                alt="Captured solar panel"
                className="w-full object-contain max-h-[450px]"
              />

            </div>


            <div className="flex items-center justify-between">

              <div className="text-sm text-ink-500">

                Panel:

                {' '}

                <span className="font-medium text-ink-700">

                  {panelId}

                </span>

              </div>


              <div className="flex gap-2.5">

                <button
                  type="button"
                  onClick={
                    resetCapture
                  }
                  className="px-4 py-2.5 text-sm font-medium text-ink-600 border border-ink-200 rounded-xl"
                >

                  Retake

                </button>


                <button
                  type="button"
                  onClick={
                    runManualInspection
                  }
                  className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-ink-900 rounded-xl"
                >

                  <CheckCircle2
                    size={16}
                  />

                  Run Inspection

                </button>

              </div>

            </div>

          </div>

        )}


      {/* ======================================================
          PROCESSING
          ====================================================== */}

      {phase === 'processing' && (

        <div className="flex flex-col items-center justify-center py-24">

          <div className="w-16 h-16 rounded-full bg-ink-100 flex items-center justify-center">

            <Loader2
              size={28}
              className="animate-spin text-ink-400"
            />

          </div>


          <p className="mt-6 text-sm font-medium text-ink-700">

            Analyzing solar panel

          </p>


          <p className="mt-1.5 text-xs text-ink-400">

            MobileNetV3 + Grad-CAM + Weather Analysis

          </p>

        </div>

      )}


      {/* ======================================================
          SUCCESS
          ====================================================== */}

      {phase === 'success' &&
        result && (

          <div className="space-y-5">

            {/* Inspection summary */}

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-px bg-ink-200/60 rounded-xl overflow-hidden">

              <div className="bg-white p-5">

                <p className="text-xs text-ink-400 mb-1">
                  Panel
                </p>

                <p className="text-sm font-medium text-ink-800">
                  {result.panel_id}
                </p>

              </div>


              <div className="bg-white p-5">

                <p className="text-xs text-ink-400 mb-1">
                  Status
                </p>

                <FaultBadge
                  isFault={
                    result.is_fault
                  }
                />

              </div>


              <div className="bg-white p-5">

                <p className="text-xs text-ink-400 mb-1">
                  Prediction
                </p>

                <p className="text-sm font-medium text-ink-800">
                  {result.prediction ?? 'N/A'}
                </p>

              </div>


              <div className="bg-white p-5">

                <p className="text-xs text-ink-400 mb-1">
                  Confidence
                </p>

                <ConfidenceBar
                  confidence={
                    result.confidence
                  }
                />

              </div>

            </div>


            {/* Backend error */}

            {result.error_message && (

              <div className="px-5 py-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">

                <div className="flex items-center gap-2 mb-1">

                  <AlertCircle
                    size={14}
                  />

                  Error

                </div>

                {result.error_message}

              </div>

            )}


            {/* Weather and cleaning */}

            <InspectionContext
              result={result}
            />


            {/* Grad-CAM */}

            <GradCamPanel
              result={result}
            />


            {/* New inspection */}

            <button
              type="button"
              onClick={
                resetCapture
              }
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-ink-900 rounded-xl"
            >

              <Camera
                size={16}
              />

              New Inspection

            </button>

          </div>

        )}


      {/* ======================================================
          ERROR PHASE
          ====================================================== */}

      {phase === 'error' && (

        <div className="flex flex-col items-center justify-center py-20">

          <AlertCircle
            size={32}
            className="text-red-500"
          />


          <p className="mt-4 text-sm font-medium text-ink-700">

            Inspection failed

          </p>


          <p className="mt-2 text-xs text-ink-400 text-center max-w-sm">

            {scheduledCapture
              ? 'The system will wait for the next scheduled inspection.'
              : 'Try capturing another image.'}

          </p>


          <button
            type="button"
            onClick={() =>
              setPhase(
                imageBlob
                  ? 'preview'
                  : 'idle'
              )
            }
            className="mt-5 px-4 py-2.5 text-sm font-medium text-ink-600 border border-ink-200 rounded-xl"
          >

            Try Again

          </button>

        </div>

      )}

    </div>

  );
}


// ============================================================
// GRAD-CAM PANEL
// ============================================================

function GradCamPanel({
  result,
}: {
  result: Inspection;
}) {

  const gradcamImage =
    result.raw_output
      ?.gradcam_image as
      | string
      | undefined;


  const gradcamError =
    result.raw_output
      ?.gradcam_error as
      | string
      | undefined;


  return (

    <div className="space-y-3">

      <p className="text-xs font-medium text-ink-400 flex items-center gap-1.5">

        <ScanSearch
          size={13}
        />

        AI Explainability - Grad-CAM

      </p>


      {gradcamImage ? (

        <div className="bg-ink-950 rounded-2xl overflow-hidden">

          <img
            src={gradcamImage}
            alt="Grad-CAM heatmap showing important solar panel regions"
            className="w-full object-contain max-h-[350px]"
          />

        </div>

      ) : (

        <div className="px-5 py-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">

          {gradcamError ??
            'Grad-CAM heatmap was not returned by the AI service.'}

        </div>

      )}

    </div>

  );
}


// ============================================================
// WEATHER + CLEANING DECISION
// ============================================================

function InspectionContext({
  result,
}: {
  result: Inspection;
}) {

  const weather =
    result.raw_output
      ?.weather as
      | WeatherSnapshot
      | undefined;


  const cleaningDecision =
    result.raw_output
      ?.cleaning_decision as
      | CleaningDecision
      | undefined;


  if (
    !weather &&
    !cleaningDecision
  ) {

    return null;

  }


  return (

    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

      {/* ======================================================
          WEATHER
          ====================================================== */}

      {weather && (

        <div className="bg-white border border-ink-200/60 rounded-xl p-4">

          <p className="text-xs text-ink-400 mb-3 flex items-center gap-1.5">

            <CloudSun
              size={13}
            />

            Weather at Inspection

          </p>


          {weather.error ? (

            <p className="text-sm text-amber-700">

              {weather.error}

            </p>

          ) : (

            <>

              <WeatherRow
                label="Temperature"
                value={
                  weather.temperature_c
                }
                unit=" °C"
              />


              <WeatherRow
                label="Humidity"
                value={
                  weather.humidity_pct
                }
                unit=" %"
              />


              <WeatherRow
                label="Rain"
                value={
                  weather.rain_mm
                }
                unit=" mm"
              />


              <WeatherRow
                label="Cloud Cover"
                value={
                  weather.cloud_cover_pct
                }
                unit=" %"
              />


              <WeatherRow
                label="Wind"
                value={
                  weather.wind_speed_kmh
                }
                unit=" km/h"
              />


              <WeatherRow
                label="Next 24h Rain"
                value={
                  weather.forecast_24h_precipitation_mm
                }
                unit=" mm"
              />


              <p className="text-xs text-ink-400 mt-3">

                Location:

                {' '}

                {formatCoordinate(
                  weather.latitude
                )}

                ,{' '}

                {formatCoordinate(
                  weather.longitude
                )}

              </p>

            </>

          )}

        </div>

      )}


      {/* ======================================================
          CLEANING DECISION
          ====================================================== */}

      {cleaningDecision && (

        <div className="bg-white border border-ink-200/60 rounded-xl p-4">

          <p className="text-xs text-ink-400 mb-3 flex items-center gap-1.5">

            <Droplets
              size={13}
            />

            Cleaning Decision

          </p>


          <p className="text-sm font-medium text-ink-800">

            {cleaningDecision.label}

          </p>


          <p className="text-xs text-ink-500 mt-2">

            {cleaningDecision.reason}

          </p>

        </div>

      )}

    </div>

  );

}


// ============================================================
// WEATHER ROW
// ============================================================

function WeatherRow({
  label,
  value,
  unit,
}: {
  label: string;
  value: number | null | undefined;
  unit: string;
}) {

  return (

    <p className="text-sm text-ink-700 mt-1">

      {label}:

      {' '}

      {value == null
        ? 'N/A'
        : `${value}${unit}`}

    </p>

  );

}


// ============================================================
// GPS FORMAT
// ============================================================

function formatCoordinate(
  value:
    | number
    | null
    | undefined
) {

  return typeof value === 'number'
    ? value.toFixed(4)
    : 'N/A';

}