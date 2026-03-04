import React, { useRef, useState, useEffect, useCallback } from 'react';
import { LogOut, Camera, Send, Loader } from 'lucide-react';
import { getOptimizedCameraConstraints } from '../utils/performanceUtils';
import { getStoredDeviceFingerprint } from '../utils/deviceFingerprint';
import { doc, getDoc, setDoc, query, collection, where, getDocs } from 'firebase/firestore';
import { db } from './firebase';

interface StudentPortalNewProps {
  onLogout: () => void;
  // updated to return a promise so parent can report back errors
  onSubmitAttendance?: (data: { name: string; regNo: string; photo: string; time: string; date: string; deviceId: string }) => Promise<void>;
}

const StudentPortalNew: React.FC<StudentPortalNewProps> = ({ onLogout, onSubmitAttendance }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [regNumber, setRegNumber] = useState('');
  const [studentName, setStudentName] = useState('');
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<{ type: 'idle' | 'success' | 'error'; text: string }>({ type: 'idle', text: '' });
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [initializing, setInitializing] = useState(false);
  const [deviceFingerprint, setDeviceFingerprint] = useState<string | null>(null);

  // refs to avoid unnecessary rerenders while camera active
  const cameraActiveRef = useRef(cameraActive);
  useEffect(() => { cameraActiveRef.current = cameraActive; }, [cameraActive]);
  const streamRef = useRef(stream);
  useEffect(() => { streamRef.current = stream; }, [stream]);

  // Initialize camera with optimized constraints
  const initializeCamera = useCallback(async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Browser does not support camera API');
      }

      // check permission state if the API is available
      if (navigator.permissions && (navigator.permissions as any).query) {
        try {
          const perm = await (navigator.permissions as any).query({ name: 'camera' });
          if (perm.state === 'denied') {
            throw new Error('Camera permission has been denied. Please enable it in browser settings.');
          }
        } catch (permErr) {
          // some browsers do not support querying camera permission; ignore
        }
      }

      const constraints = getOptimizedCameraConstraints();
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);

      // attach error/inactive handlers
      mediaStream.getTracks().forEach(track => {
        track.onended = () => {
          // track ended (device unplugged or stopped)
          setCameraActive(false);
          setStreamError('Camera stream ended unexpectedly');
        };
      });

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.onloadedmetadata = () => {
          // once metadata is loaded we consider the camera active
          setCameraActive(true);
          setStreamError(null);
        };

        videoRef.current.onerror = () => {
          setCameraActive(false);
          setStreamError('Video element error - unable to play stream');
        };
      }

      setStream(mediaStream);
    } catch (error) {
      console.error('Camera access error:', error);
      setCameraActive(false);
      let msg = 'permission or device issue';
      if (error instanceof DOMException) {
        switch (error.name) {
          case 'NotAllowedError':
          case 'PermissionDeniedError':
            msg = 'Permission denied';
            break;
          case 'NotFoundError':
          case 'DevicesNotFoundError':
            msg = 'No camera found';
            break;
          case 'NotReadableError':
          case 'TrackStartError':
            msg = 'Camera is already in use';
            break;
          default:
            msg = error.message;
        }
      }
      setStreamError(msg);
      setSubmitMessage({
        type: 'error',
        text: `❌ Camera error: ${msg}`
      });
    }
  }, []);

  // Cleanup camera - properly stop all tracks to free resources
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      // clear srcObject to release memory immediately
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setStream(null);
    }
    setCameraActive(false);
  }, []);

  // Capture photo with optimized compression
  const capturePhoto = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d', { willReadFrequently: true });
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        // Use 0.8 quality instead of 0.9 for faster processing on mobile
        const photoData = canvasRef.current.toDataURL('image/jpeg', 0.8);
        setCapturedPhoto(photoData);
        stopCamera();
        setSubmitMessage({ type: 'idle', text: '' });
      }
    }
  }, [stopCamera]);

  // Retake photo
  const retakePhoto = useCallback(() => {
    setCapturedPhoto(null);
    initializeCamera();
  }, [initializeCamera]);

  // Submit attendance with device lock and daily limit checks
  // timestamp ref for simple debounce
  const lastSubmitRef = useRef<number>(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const now = Date.now();
    if (now - lastSubmitRef.current < 1000) {
      // ignore if tapped twice within 1 second
      return;
    }
    lastSubmitRef.current = now;

    if (!regNumber.trim()) {
      setSubmitMessage({ type: 'error', text: '❌ Please enter your registration number' });
      return;
    }

    if (!studentName.trim()) {
      setSubmitMessage({ type: 'error', text: '❌ Please enter your name' });
      return;
    }

    if (!capturedPhoto) {
      setSubmitMessage({ type: 'error', text: '❌ Please capture a photo' });
      return;
    }

    if (!deviceFingerprint) {
      setSubmitMessage({ type: 'error', text: '❌ Could not identify device. Please refresh and try again.' });
      return;
    }

    setIsSubmitting(true);
    setSubmitMessage({ type: 'idle', text: '' });

    try {
      const regNoUpper = regNumber.trim().toUpperCase();
      // Use ISO date (YYYY-MM-DD) for consistent queries
      const todayISO = new Date().toISOString().split('T')[0];

      // Check 1: Device Lock - verify this reg no is not locked to a different device (Firestore)
      const studentDocRef = doc(db, 'students', regNoUpper);
      const studentSnapshot = await getDoc(studentDocRef);
      const studentData = studentSnapshot.exists() ? studentSnapshot.data() : null;

      if (studentData && studentData.deviceId && studentData.deviceId !== deviceFingerprint) {
        setSubmitMessage({
          type: 'error',
          text: `❌ Device Lock Error\nThis Register Number is already locked to another device.\nPlease contact Staff.`
        });
        setIsSubmitting(false);
        return;
      }

      // Check 2: Daily Limit - query Firestore attendance collection for same regNo and date
      const attendanceQ = query(
        collection(db, 'attendance'),
        where('regNo', '==', regNoUpper),
        where('date', '==', todayISO)
      );
      const attendanceSnap = await getDocs(attendanceQ);
      if (!attendanceSnap.empty) {
        setSubmitMessage({
          type: 'error',
          text: `⚠️ Daily Limit Reached\nYou have already registered attendance for today!`
        });
        setIsSubmitting(false);
        return;
      }

      // All checks passed - proceed with submission
      const timestamp = new Date().toLocaleTimeString();
      const todayISOForRecord = new Date().toISOString().split('T')[0];
      const newAttendanceData = {
        name: studentName.trim(),
        regNo: regNoUpper,
        photo: capturedPhoto,
        time: timestamp,
        date: todayISOForRecord,
        deviceId: deviceFingerprint
      };

      // Call the submission handler and wait for it to finish
      if (onSubmitAttendance) {
        await onSubmitAttendance(newAttendanceData);
      }

      // Also update student record with device ID if new (merge to preserve other fields)
      if (!studentData || !studentData.deviceId) {
        await setDoc(studentDocRef, {
          ...(studentData || {}),
          name: studentName.trim(),
          deviceId: deviceFingerprint,
          firstAttendance: new Date().toISOString()
        }, { merge: true });
      }

      setSubmitMessage({
        type: 'success',
        text: `✅ Attendance submitted successfully!\nTime: ${timestamp}`
      });

      // Reset form after 2 seconds
      setTimeout(() => {
        setRegNumber('');
        setStudentName('');
        setCapturedPhoto(null);
        setSubmitMessage({ type: 'idle', text: '' });
      }, 2000);
    } catch (error) {
      setSubmitMessage({
        type: 'error',
        text: `❌ Error submitting attendance: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Load device fingerprint on mount
  useEffect(() => {
    const loadFingerprint = async () => {
      const fp = await getStoredDeviceFingerprint();
      setDeviceFingerprint(fp);
    };
    loadFingerprint();
  }, []);

  // clear camera when component unmounts; camera is started only on user action
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // optional: pre-check permission/state when the component mounts so errors show early
  useEffect(() => {
    // do not automatically open, just verify permissions
    if (navigator.permissions && (navigator.permissions as any).query) {
      navigator.permissions
        .query({ name: 'camera' as PermissionName })
        .then((perm) => {
          if (perm.state === 'denied') {
            setSubmitMessage({ type: 'error', text: '❌ Camera permission has been denied. Please allow access in browser settings.' });
          }
        })
        .catch(() => {
          // ignore unsupported
        });
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#05050a] via-[#0a0a15] to-[#05050a] text-white overflow-hidden relative">
      
      {/* ANIMATED BACKGROUNDS */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-[#00d1ff] rounded-full blur-[150px] opacity-15 animate-pulse"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-[#ff007a] rounded-full blur-[150px] opacity-15 animate-pulse"></div>

      <div className="relative z-10 min-h-screen flex flex-col">
        
        {/* HEADER */}
        <div className="p-4 md:p-8 border-b border-white/10 bg-white/5 backdrop-blur-xl">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-black tracking-tighter">
                STUDENT <span className="text-[#00d1ff]">ATTENDANCE</span>
              </h1>
              <p className="text-xs text-gray-400 mt-1">Mark your attendance with photo verification</p>
            </div>
            <button
              onClick={onLogout}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 rounded-xl font-bold text-sm hover:shadow-[0_0_20px_rgba(220,38,38,0.5)] transition-all"
            >
              <LogOut className="w-4 h-4" />
              BACK
            </button>
          </div>
        </div>

        {/* MAIN CONTENT */}
        <div className="flex-1 p-4 md:p-8 flex items-center justify-center">
          <div className="w-full max-w-4xl">
            
            {/* CONTAINER */}
            <div className="grid md:grid-cols-2 gap-8">
              
              {/* LEFT: CAMERA/PHOTO */}
              <div className="bg-gradient-to-br from-white/[0.08] to-white/[0.02] backdrop-blur-xl p-8 rounded-[40px] border border-white/10 flex flex-col justify-between h-full">
                <div>
                  <h2 className="text-2xl font-black mb-4 flex items-center gap-2">
                    <Camera className="w-6 h-6 text-[#00d1ff]" />
                    PHOTO VERIFICATION
                  </h2>
                  <p className="text-gray-400 text-sm mb-6">
                    {!cameraActive && !capturedPhoto
                      ? 'Camera inactive - click below to request permission and start.'
                      : cameraActive
                      ? 'Position your face in the camera frame and click "Capture Photo".'
                      : 'Your photo has been captured. Review and submit or retake.'}
                  </p>
                  {streamError && (
                    <p className="text-red-400 text-xs mt-2">⚠️ {streamError.includes('Permission') ? 'Camera blocked by browser or permission denied' : streamError}</p>
                  )}
                </div>

                {/* CAMERA/PHOTO DISPLAY */}
                <div className="relative w-full aspect-video bg-black rounded-2xl border-2 border-[#00d1ff] overflow-hidden mb-6 shadow-[0_0_30px_rgba(0,209,255,0.3)]" style={{transform:'translateZ(0)', willChange:'transform'}}>
                  {!capturedPhoto ? (
                    <>
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className={`w-full h-full object-cover ${cameraActive ? 'block' : 'hidden'}`}
                        style={{ 
                          willChange: 'contents',
                          transform: 'translateZ(0)'
                        }}
                      />
                      {!cameraActive && (
                        <div className="w-full h-full flex items-center justify-center">
                          <div className="text-center">
                            <Camera className="w-16 h-16 text-[#00d1ff] opacity-40 mx-auto mb-4" />
                            <p className="text-gray-400 text-sm">Camera inactive</p>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <img
                      src={capturedPhoto}
                      alt="Captured"
                      className="w-full h-full object-cover"
                    />
                  )}

                  {/* CAPTURE INDICATOR */}
                  {cameraActive && (
                    <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1 bg-[#00d1ff]/20 border border-[#00d1ff] rounded-full text-xs font-bold text-[#00d1ff]">
                      <div className="w-2 h-2 bg-[#00d1ff] rounded-full animate-pulse"></div>
                      LIVE
                    </div>
                  )}
                </div>

                {/* CAMERA CONTROLS */}
                <div className="flex gap-3">
                  {!capturedPhoto ? (
                    <>
                      {!cameraActive ? (
                        <button
                          onClick={initializeCamera}
                          disabled={initializing}
                          className="flex-1 py-3 bg-gradient-to-r from-[#00d1ff] to-[#00ffa3] text-black rounded-xl font-bold text-sm hover:shadow-[0_0_30px_#00d1ff] transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{ transform: 'translateZ(0)', willChange: 'transform' }}
                        >
                          📷 {initializing ? 'OPENING...' : 'OPEN CAMERA'}
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={capturePhoto}
                            className="flex-1 py-3 bg-gradient-to-r from-[#00d1ff] to-[#00ffa3] text-black rounded-xl font-bold text-sm hover:shadow-[0_0_30px_#00d1ff] transition-all active:scale-95 flex items-center justify-center gap-2"
                          >
                            <Camera className="w-4 h-4" />
                            CAPTURE PHOTO
                          </button>
                          <button
                            onClick={stopCamera}
                            className="flex-1 py-3 bg-white/5 border border-white/20 text-white rounded-xl font-bold text-sm hover:bg-white/10 transition-all"
                          >
                            CLOSE
                          </button>
                        </>
                      )}
                    </>
                  ) : (
                    <button
                      onClick={retakePhoto}
                      className="w-full py-3 bg-white/5 border border-white/20 text-white rounded-xl font-bold text-sm hover:bg-white/10 transition-all"
                    >
                      🔄 RETAKE PHOTO
                    </button>
                  )}
                </div>
              </div>

              {/* RIGHT: FORM */}
              <div className="bg-gradient-to-br from-white/[0.08] to-white/[0.02] backdrop-blur-xl p-8 rounded-[40px] border border-white/10 flex flex-col">
                <h2 className="text-2xl font-black mb-6">ATTENDANCE DETAILS</h2>

                <form onSubmit={handleSubmit} className="flex-1 flex flex-col justify-between space-y-6">
                  
                  {/* INPUTS */}
                  <div className="space-y-5">
                    {/* NAME */}
                    <div>
                      <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-widest">
                        Your Full Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., John Doe"
                        value={studentName}
                        onChange={(e) => {
                          setStudentName(e.target.value);
                          if (submitMessage.type === 'error') {
                            setSubmitMessage({ type: 'idle', text: '' });
                          }
                        }}
                        className="w-full bg-black/50 border border-white/20 p-4 rounded-xl text-white placeholder-gray-600 focus:border-[#00d1ff] focus:outline-none transition-all focus:shadow-[0_0_20px_rgba(0,209,255,0.3)]"
                      />
                    </div>

                    {/* REGISTRATION NUMBER */}
                    <div>
                      <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-widest">
                        Registration Number
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., KNC001"
                        value={regNumber}
                        onChange={(e) => {
                          setRegNumber(e.target.value.toUpperCase());
                          if (submitMessage.type === 'error') {
                            setSubmitMessage({ type: 'idle', text: '' });
                          }
                        }}
                        className="w-full bg-black/50 border border-white/20 p-4 rounded-xl text-white placeholder-gray-600 focus:border-[#00d1ff] focus:outline-none transition-all focus:shadow-[0_0_20px_rgba(0,209,255,0.3)]"
                      />
                    </div>

                    {/* TIME DISPLAY */}
                    <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                      <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mb-2">Submission Time</p>
                      <p className="text-lg font-black text-[#00d1ff]">{new Date().toLocaleTimeString()}</p>
                    </div>
                  </div>

                  {/* STATUS MESSAGE */}
                  {submitMessage.text && (
                    <div className={`p-4 rounded-xl text-sm font-bold text-center whitespace-pre-line border ${
                      submitMessage.type === 'success'
                        ? 'bg-[#00ffa3]/10 border-[#00ffa3] text-[#00ffa3]'
                        : 'bg-red-500/10 border-red-500 text-red-400'
                    }`}>
                      {submitMessage.text}
                    </div>
                  )}

                  {/* SUBMIT BUTTON */}
                  <button
                    type="submit"
                    disabled={isSubmitting || !capturedPhoto || !studentName.trim() || !regNumber.trim()}
                    className="w-full py-4 bg-gradient-to-r from-[#00d1ff] to-[#00ffa3] text-black rounded-xl font-black text-sm tracking-[2px] hover:shadow-[0_0_40px_#00d1ff] transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    style={{ transform: 'translateZ(0)', willChange: 'transform' }}
                    onClick={() => {
                      if (isSubmitting) return; // additional guard
                    }}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader className="w-4 h-4 animate-spin" />
                        SUBMITTING...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        ✔️ SUBMIT ATTENDANCE
                      </>
                    )}
                  </button>
                </form>

                {/* INFO */}
                <div className="mt-6 pt-6 border-t border-white/10">
                  <p className="text-[10px] text-gray-500 text-center">
                    Your attendance data will be securely stored in our database with timestamp and photo verification.
                  </p>
                </div>
              </div>
            </div>

            {/* GUIDELINES */}
            <div className="mt-8 p-6 bg-white/5 border border-white/10 rounded-2xl">
              <h3 className="text-sm font-black text-[#00d1ff] mb-3 uppercase tracking-widest">📋 Guidelines</h3>
              <ul className="space-y-2 text-xs text-gray-400 list-disc list-inside">
                <li>Ensure adequate lighting for clear photo capture</li>
                <li>Face must be clearly visible in the camera frame</li>
                <li>Provide your correct name and registration number</li>
                <li>Submit only once per session to avoid duplicates</li>
                <li>Data is recorded with timestamp for verification</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* HIDDEN CANVAS FOR PHOTO CAPTURE */}
      <canvas ref={canvasRef} className="hidden" />

      {/* ANIMATIONS */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
        .animate-pulse {
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
      `}} />
    </div>
  );
};

export default StudentPortalNew;