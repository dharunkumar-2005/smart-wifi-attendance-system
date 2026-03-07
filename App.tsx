import React, { useState, useEffect, useCallback, useMemo, ErrorInfo } from 'react';
import { ref, set, onValue, remove, off } from "firebase/database";
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db as firestoreDb, realtimeDb } from './components/firebase';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import LandingPage from './components/LandingPage';
import StaffDashboard from './components/StaffDashboard';
import StudentPortalNew from './components/StudentPortal';
import PhotoModal from './components/PhotoModal';
import { excelService } from './services/excelService';
import { emailService } from './services/emailService';

// Register Chart.js plugins
ChartJS.register(ArcElement, Tooltip, Legend);

interface StudentRecord {
  name: string;
  regNo: string;
  time?: string;
  face?: string;
  status?: string;
}

interface Student {
  name: string;
  email?: string;
  parentEmail?: string;
}

interface AbsentStudent extends StudentRecord {
  parentEmail?: string;
  email?: string;
}

type AppView = 'landing' | 'staff' | 'student';

// authorized hotspot IP address (for production security)
const AUTHORIZED_IP = '210.16.87.86';
// IMPORTANT: Set to true to enable IP check in production only
// Set to false for development/testing on mobile
const ENABLE_IP_CHECK = false;

// Enable debug mode to see IP info
const DEBUG_MODE = true;

export default function App() {
  const [currentView, setCurrentView] = useState<AppView>('landing');
  const [ipCheckStatus, setIpCheckStatus] = useState<'pending' | 'authorized' | 'denied'>(ENABLE_IP_CHECK ? 'pending' : 'authorized');
  const [userIP, setUserIP] = useState<string | null>(null);
  const [firebaseError, setFirebaseError] = useState<string | null>(null);
  const [records, setRecords] = useState<StudentRecord[]>([]);
  const [allStudents, setAllStudents] = useState<Record<string, Student>>({});
  const [selectedPhoto, setSelectedPhoto] = useState<{ url: string; name: string; regNo: string } | null>(null);
  const [sendingEmails, setSendingEmails] = useState(false);
  const [emailStatus, setEmailStatus] = useState<{ type: 'idle' | 'sending' | 'success' | 'error'; message: string }>({ type: 'idle', message: '' });

  // perform IP gatekeeper before rendering anything else
  useEffect(() => {
    const checkIp = async () => {
      try {
        const resp = await fetch('https://api.ipify.org?format=json');
        const data = await resp.json();
        const detectedIP = data.ip;
        setUserIP(detectedIP);
        
        if (DEBUG_MODE) {
          console.log('🔍 Your IP Address:', detectedIP);
          console.log('🔐 Authorized IP:', AUTHORIZED_IP);
        }
        
        if (ENABLE_IP_CHECK) {
          if (detectedIP === AUTHORIZED_IP) {
            setIpCheckStatus('authorized');
            console.log('✅ IP authorized');
          } else {
            setIpCheckStatus('denied');
            console.log('❌ IP not authorized');
          }
        } else {
          // Disable IP check for development
          setIpCheckStatus('authorized');
          if (DEBUG_MODE) console.log('ℹ️ IP check disabled for development');
        }
      } catch (err) {
        console.error('❌ IP check failed', err);
        // Allow access anyway if IP check fails
        setIpCheckStatus('authorized');
      }
    };
    checkIp();
  }, []);

  useEffect(() => {
    if (ipCheckStatus !== 'authorized') return;
    
    try {
      setFirebaseError(null); // Clear previous errors
      
      // Fetch all students from Firebase
      const studentsRef = ref(realtimeDb, 'students');
      const unsubscribeStudents = onValue(studentsRef, (snapshot) => {
        const data = snapshot.val();
        setAllStudents(data || {});
      }, (error) => {
        console.error('❌ Error fetching students:', error);
        setFirebaseError('Failed to fetch students: ' + error.message);
      });

      // Fetch today's attendance records
      const attendanceRef = ref(realtimeDb, 'attendance');
      const unsubscribeAttendance = onValue(attendanceRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const attendanceArray = Array.isArray(data) ? data : Object.values(data);
          setRecords(attendanceArray.reverse() as StudentRecord[]);
        }
      }, (error) => {
        console.error('❌ Error fetching attendance:', error);
        setFirebaseError('Failed to fetch attendance: ' + error.message);
      });

      // Cleanup function - properly unsubscribe from listeners to prevent memory leaks
      return () => {
        off(studentsRef);
        off(attendanceRef);
      };
    } catch (error) {
      console.error('❌ Error setting up Firebase listeners:', error);
      setFirebaseError('Failed to connect to database: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }, [ipCheckStatus]);

  // TEMPORARY: Upload student list to Firestore
  useEffect(() => {
    const uploadStudents = async () => {
      const studentNames = [
        'Ashan Mohamed A',
        'Dharunkumar M',
        'Manoj S'
        // Add more student names here as needed
      ];

      try {
        for (const name of studentNames) {
          await addDoc(collection(firestoreDb, 'students'), {
            name: name,
            createdAt: serverTimestamp()
          });
        }
        console.log('Students uploaded to Firestore successfully');
      } catch (error) {
        console.error('Error uploading students:', error);
      }
    };

    // Uncomment the line below to run the upload (remove after use)
    // uploadStudents();
  }, []);

  // Calculate attendance metrics
  const totalStudents = Object.keys(allStudents).length;
  const presentCount = records.length;
  const attendancePercentage = totalStudents > 0 ? ((presentCount / totalStudents) * 100).toFixed(1) : '0.0';

  // Generate absent list using useMemo to prevent unnecessary recalculations
  const absentList: AbsentStudent[] = useMemo(() => {
    const presentRegNos = records.map(r => r.regNo);
    return Object.entries(allStudents)
      .filter(([regNo]) => !presentRegNos.includes(regNo))
      .map(([regNo, details]) => ({
        regNo,
        name: (details as Student).name,
        parentEmail: (details as Student).parentEmail
      }));
  }, [records, allStudents]);

  // --- Export Excel Report ---
  const handleExportExcel = () => {
    try {
      const exportData = [
        ...records.map(r => ({
          name: r.name,
          regNo: r.regNo,
          status: 'Present' as const,
          time: r.time || 'N/A',
          date: new Date().toLocaleDateString()
        })),
        ...absentList.map(a => ({
          name: a.name,
          regNo: a.regNo,
          status: 'Absent' as const,
          time: 'N/A',
          date: new Date().toLocaleDateString()
        }))
      ];

      excelService.exportAttendanceToExcel(
        exportData,
        `Attendance_Report_${new Date().toISOString().split('T')[0]}.xlsx`
      );
      setEmailStatus({ type: 'success', message: '✅ Excel report exported successfully!' });
      setTimeout(() => setEmailStatus({ type: 'idle', message: '' }), 3000);
    } catch (error) {
      setEmailStatus({ type: 'error', message: '❌ Error exporting Excel' });
    }
  };

  // --- Send Absence Alerts to Students ---
  const handleSendEmailAlerts = async (onEmailsSent?: (sentRegNos: string[]) => void) => {
    if (absentList.length === 0) {
      setEmailStatus({ type: 'idle', message: 'No absent students to notify' });
      return;
    }

    setSendingEmails(true);
    setEmailStatus({ type: 'sending', message: `📧 Sending absence alerts to ${absentList.length} students...` });

    try {
      const emailsToSend = absentList
        .filter(student => student.email)
        .map(student => ({
          parent_email: student.email!,
          student_name: student.name,
          registration_number: student.regNo,
          attendance_date: new Date().toLocaleDateString()
        }));

      if (emailsToSend.length === 0) {
        setEmailStatus({ type: 'error', message: '❌ No student emails configured' });
        setSendingEmails(false);
        return;
      }

      // Verify EmailJS is configured
      if (!emailService.verifyConfiguration()) {
        setEmailStatus({
          type: 'error',
          message: '❌ EmailJS not configured. Check services/emailService.ts for setup instructions.'
        });
        setSendingEmails(false);
        return;
      }

      const results = await emailService.sendBulkAbsenceAlerts(emailsToSend);
      setSendingEmails(false);

      // Calculate which reg nos had their emails sent successfully
      const sentRegNos = absentList
        .filter(student => emailsToSend.some(e => e.registration_number === student.regNo))
        .slice(0, results.sent)
        .map(student => student.regNo);
      
      onEmailsSent?.(sentRegNos);

      if (results.sent > 0) {
        setEmailStatus({
          type: 'success',
          message: `✅ Absence alerts sent to ${results.sent} students successfully!${results.failed > 0 ? ` (${results.failed} failed)` : ''}`
        });
      } else {
        setEmailStatus({
          type: 'error',
          message: `❌ Failed to send alerts. ${results.errors[0] || 'Please check configuration.'}`
        });
      }
    } catch (error) {
      setEmailStatus({
        type: 'error',
        message: `❌ Error: ${error instanceof Error ? error.message : 'Failed to send alerts'}`
      });
      setSendingEmails(false);
    }

    setTimeout(() => setEmailStatus({ type: 'idle', message: '' }), 5000);
  };

  // --- Handle Student Attendance Submission ---
  // this function returns a promise so that the caller (StudentPortal) can react to success/failure
  const handleStudentSubmitAttendance = async (data: { name: string; regNo: string; photo: string; time: string; date: string; deviceId: string }) => {
    try {
      const submissionData = {
        name: data.name,
        regNo: data.regNo.toUpperCase(),
        face: data.photo,
        time: data.time,
        // store date in YYYY-MM-DD format
        date: data.date || new Date().toISOString().split('T')[0],
        deviceId: data.deviceId,
        // accurate server timestamp
        timestamp: serverTimestamp()
      };

      // Save to Firestore attendance collection
      await addDoc(collection(firestoreDb, 'attendance'), submissionData);
    } catch (error) {
      console.error('Error submitting attendance:', error);
      // rethrow so UI can display proper error
      throw error;
    }
  };

  // --- Add New Student ---
  const handleAddStudent = async (studentData: { name: string; regNo: string; email: string }) => {
    try {
      const regNoUpper = studentData.regNo.toUpperCase().trim();
      if (!regNoUpper || !studentData.name.trim()) {
        throw new Error('Name and Registration Number are required');
      }

      const studentRef = ref(realtimeDb, `students/${regNoUpper}`);
      await set(studentRef, {
        name: studentData.name.trim(),
        email: studentData.email.trim() || null,
        added: new Date().toISOString(),
        parentEmail: studentData.email.trim() || null // Store for alerts
      });
    } catch (error) {
      throw error instanceof Error ? error : new Error('Failed to add student');
    }
  };

  // --- Delete Student ---
  const handleDeleteStudent = async (regNo: string) => {
    try {
      const regNoUpper = regNo.toUpperCase().trim();
      const studentRef = ref(realtimeDb, `students/${regNoUpper}`);
      await remove(studentRef);
    } catch (error) {
      throw error instanceof Error ? error : new Error('Failed to delete student');
    }
  };

  // --- Clear All Attendance Records ---
  const handleClearAttendance = async () => {
    try {
      const attendanceRef = ref(realtimeDb, 'attendance');
      await remove(attendanceRef);
    } catch (error) {
      throw error instanceof Error ? error : new Error('Failed to clear attendance');
    }
  };

  // --- IP Gatekeeper: render loader/denied before the app view ---
  if (ipCheckStatus === 'pending') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-[#00d1ff]"></div>
      </div>
    );
  }
  if (ipCheckStatus === 'denied') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white p-4">
        <div className="text-center max-w-md">
          <h1 className="text-3xl font-black mb-4 text-[#ff007a]">Access Denied</h1>
          <p className="text-lg mb-6">Unauthorized Network! Please connect to the KNCET Official Hotspot to access this portal.</p>
          {DEBUG_MODE && userIP && (
            <div className="bg-gray-800 p-4 rounded text-left text-sm mb-4">
              <p className="text-gray-400">Debug Info:</p>
              <p className="text-gray-300">Your IP: {userIP}</p>
              <p className="text-gray-300">Authorized IP: {AUTHORIZED_IP}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Show Firebase error if any
  if (firebaseError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50 p-4">
        <div className="bg-white p-6 rounded-lg shadow-lg max-w-md">
          <h1 className="text-2xl font-bold text-red-600 mb-4">⚠️ Connection Error</h1>
          <p className="text-gray-700 mb-4">{firebaseError}</p>
          <button
            onClick={() => { setFirebaseError(null); window.location.reload(); }}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition w-full"
          >
            Retry
          </button>
          {DEBUG_MODE && (
            <div className="mt-4 bg-gray-100 p-3 rounded text-xs text-gray-700">
              <p className="font-bold mb-2">Debug: IP Check Status</p>
              <p>IP: {userIP || 'Detecting...'}</p>
              <p>Status: {ipCheckStatus}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- Return Conditional Rendering Based on Current View ---
  if (currentView === 'landing') {
    return (
      <LandingPage
        onStaffClick={() => setCurrentView('staff')}
        onStudentClick={() => setCurrentView('student')}
      />
    );
  }

  if (currentView === 'student') {
    return (
      <StudentPortalNew
        onLogout={() => setCurrentView('landing')}
        onSubmitAttendance={handleStudentSubmitAttendance}
      />
    );
  }

  if (currentView === 'staff') {
    return (
      <StaffDashboard
        records={records}
        allStudents={allStudents}
        onLogout={() => setCurrentView('landing')}
        onSendEmails={handleSendEmailAlerts}
        onExport={handleExportExcel}
        onAddStudent={handleAddStudent}
        onDeleteStudent={handleDeleteStudent}
        onClearAttendance={handleClearAttendance}
      />
    );
  }

  // Return landing page initially
  return (
    <LandingPage
      onStaffClick={() => setCurrentView('staff')}
      onStudentClick={() => setCurrentView('student')}
    />
  );
}
