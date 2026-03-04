import React, { useState, useMemo, useEffect } from 'react';
import { emailService } from '../services/emailService';
import { LogOut, Trash2, Plus, Search, Mail, Download, Users, AlertTriangle, Lock, Settings, Unlock } from 'lucide-react';
import PhotoModal from './PhotoModal';
import { MemoizedPresentItem, MemoizedAbsentItem, MemoizedStudentListItem } from './MemoizedListItems';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { validatePasswordStrength, hashPassword, comparePassword } from '../utils/passwordUtils';
import { collection, doc, getDoc, getDocs, query, where, updateDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

ChartJS.register(ArcElement, Tooltip, Legend);

interface AdminDashboardComponentProps {
  records: any[];
  allStudents: Record<string, any>;
  onLogout: () => void;
  onSendEmails?: (callback?: (sentRegNos: string[]) => void) => void;
  onExport?: () => void;
  onAddStudent?: (studentData: { name: string; regNo: string; email: string }) => Promise<void>;
  onDeleteStudent?: (regNo: string) => Promise<void>;
  onClearAttendance?: () => Promise<void>;
}

const AdminDashboardComponent: React.FC<AdminDashboardComponentProps> = ({
  records,
  allStudents,
  onLogout,
  onSendEmails,
  onExport,
  onAddStudent,
  onDeleteStudent,
  onClearAttendance
}) => {
  const [view, setView] = useState('dashboard');
  const [selectedPhoto, setSelectedPhoto] = useState<{ url: string; name: string; regNo: string } | null>(null);
  
  // Student Management State
  const [searchQuery, setSearchQuery] = useState('');
  const [newStudent, setNewStudent] = useState({ name: '', regNo: '', email: '' });
  const [addingStudent, setAddingStudent] = useState(false);
  const [deletingStudent, setDeletingStudent] = useState<string | null>(null);
  const [confirmDeleteRegNo, setConfirmDeleteRegNo] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [resettingDevice, setResettingDevice] = useState<string | null>(null);
  const [emailsSentTo, setEmailsSentTo] = useState<Set<string>>(new Set());
  
  // Clear Attendance State
  const [clearConfirmStage, setClearConfirmStage] = useState(0); // 0 = no, 1 = first confirm, 2 = second confirm
  const [clearingAttendance, setClearingAttendance] = useState(false);

  // Send single absence email via emailService for debugging/status
  const sendAbsenceEmail = async (name: string, regNo: string, email: string) => {
    try {
      const params = {
        parent_email: email,
        student_name: name,
        registration_number: regNo,
        attendance_date: new Date().toISOString().split('T')[0]
      };
      const resp = await emailService.sendAbsenceAlert(params);
      if (resp.success) console.log('Email sent to', email);
      else console.error('Email failed for', email, resp.message);
    } catch (err) {
      console.error('Email send error', err);
    }
  };

  // wrapper used by buttons to send alerts and track state
  const triggerAbsenceAlerts = async () => {
    try {
      // compute absentee list from props as a quick path
      const emailsToSend = absentList
        .filter(s => (s as any).email)
        .map(s => ({
          parent_email: (s as any).email,
          student_name: s.name,
          registration_number: s.regNo,
          attendance_date: new Date().toISOString().split('T')[0]
        }));

      if (emailsToSend.length === 0) {
        setMessage({ type: 'error', text: '❌ No configured parent emails to send' });
        return;
      }

      if (!emailService.verifyConfiguration()) {
        setMessage({ type: 'error', text: '❌ EmailJS not configured. Check services/emailService.ts' });
        return;
      }

      const results = await emailService.sendBulkAbsenceAlerts(emailsToSend);
      // mark sent regNos in local state
      const sent = absentList.slice(0, results.sent).map(s => s.regNo);
      setEmailsSentTo(new Set([...Array.from(emailsSentTo), ...sent]));
      onSendEmails?.(sent);
      if (results.sent > 0) setMessage({ type: 'success', text: `✅ Sent ${results.sent} absence alerts` });
      if (results.failed > 0) setMessage({ type: 'error', text: `❌ ${results.failed} failed to send` });
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: `❌ Error sending alerts: ${err instanceof Error ? err.message : ''}` });
    }
  };

  // Change Password State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [storedPasswordHash, setStoredPasswordHash] = useState<string | null>(null);

  // load password hash from firebase so change-password form validates against latest value
  useEffect(() => {
    // Try to load admin password hash from Firestore once
    (async () => {
      try {
        const cfgDoc = doc(db, 'admin', 'config');
        const snap = await getDoc(cfgDoc);
        if (snap.exists()) {
          const val = snap.data();
          if (val && (val as any).password && (val as any).password.hash) {
            setStoredPasswordHash((val as any).password.hash);
          }
        }
      } catch (err) {
        // ignore silently
      }
    })();
  }, []);

  // Handle Device Lock Reset
  const handleResetDeviceLock = async (regNo: string) => {
    setResettingDevice(regNo);
    try {
      const studentDoc = doc(db, 'students', regNo);
      await updateDoc(studentDoc, { deviceId: '' });
      setMessage({ type: 'success', text: `✅ Device lock reset for ${regNo}.` });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage({ type: 'error', text: `❌ Error resetting device lock: ${error instanceof Error ? error.message : 'Unknown error'}` });
    } finally {
      setResettingDevice(null);
    }
  };

  // Find absentees by querying Firestore: students without attendance record today
  const sendAbsenteeAlerts = async (): Promise<{ sent: number; failed: number; errors: string[] }> => {
    const results = { sent: 0, failed: 0, errors: [] as string[] };
    try {
      const todayISO = new Date().toISOString().split('T')[0];
      // load all students
      const studentsSnap = await getDocs(collection(db, 'students'));
      const students = studentsSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));

      // load attendance for today
      const attendanceQ = query(collection(db, 'attendance'), where('date', '==', todayISO));
      const attendanceSnap = await getDocs(attendanceQ);
      const presentRegSet = new Set(attendanceSnap.docs.map(d => (d.data() as any).regNo));

      const absentees = students.filter(s => !presentRegSet.has(s.id));

      const emailsToSend = absentees
        .filter(s => s.parentEmail || s.email)
        .map(s => ({
          parent_email: s.parentEmail || s.email,
          student_name: s.name,
          registration_number: s.id,
          attendance_date: todayISO
        }));

      if (emailsToSend.length === 0) return results;

      if (!emailService.verifyConfiguration()) {
        results.errors.push('EmailJS not configured');
        return results;
      }

      const bulk = await emailService.sendBulkAbsenceAlerts(emailsToSend);
      return bulk;
    } catch (err) {
      results.errors.push(err instanceof Error ? err.message : 'Unknown error');
      return results;
    }
  };

  // Calculate metrics
  const totalStudents = Object.keys(allStudents).length;
  const presentCount = records.length;
  const attendancePercentage = totalStudents > 0 ? ((presentCount / totalStudents) * 100).toFixed(1) : '0.0';

  // Generate absent list with useMemo to prevent unnecessary calculations
  const absentList = useMemo(() => {
    const presentRegNos = records.map(r => r.regNo);
    return Object.entries(allStudents)
      .filter(([regNo]) => !presentRegNos.includes(regNo))
      .map(([regNo, details]: [string, any]) => ({ regNo, name: (details as any).name }));
  }, [records, allStudents]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#05050a] via-[#0a0a15] to-[#05050a] text-white p-4 md:p-8 overflow-hidden relative">
      
      {/* ANIMATED BACKGROUNDS */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-[#ff007a] rounded-full blur-[150px] opacity-15 animate-pulse"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-[#00d1ff] rounded-full blur-[150px] opacity-15 animate-pulse"></div>

      <div className="relative z-10">
        {/* HEADER */}
        <div className="mb-8 flex items-center justify-between px-8 py-4 bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10">
          <div>
            <h1 className="text-3xl font-black tracking-tighter">
              STAFF PORTAL <span className="text-[#ff007a]">DASHBOARD</span>
            </h1>
            <p className="text-xs text-gray-400 mt-1">Real-time Attendance Management System</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-gray-400">{new Date().toLocaleDateString()}</p>
              <p className="text-2xl font-black text-[#00d1ff]">{attendancePercentage}%</p>
            </div>
            <button
              onClick={onLogout}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 rounded-xl font-bold text-sm hover:shadow-[0_0_20px_rgba(220,38,38,0.5)] transition-all"
            >
              <LogOut className="w-4 h-4" />
              LOGOUT
            </button>
          </div>
        </div>

        {/* NAVIGATION TABS */}
        <div className="mb-8 flex gap-3 flex-wrap">
          {[
            { id: 'dashboard', label: '📊 Dashboard' },
            { id: 'attendance', label: '👥 Attendance' },
            { id: 'students', label: '👨‍🎓 Students' },
            { id: 'reports', label: '📋 Reports' },
            { id: 'security', label: '🔐 Security' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setView(tab.id)}
              className={`px-6 py-3 rounded-xl font-bold text-sm transition-all ${
                view === tab.id
                  ? 'bg-[#ff007a] shadow-[0_0_30px_#ff007a] text-white'
                  : 'bg-white/5 border border-white/20 text-gray-300 hover:bg-white/10'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* DASHBOARD VIEW */}
        {view === 'dashboard' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            {/* STATS GRID */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {[
                { label: 'Total Students', value: totalStudents, color: 'from-[#ff007a]' },
                { label: 'Present Today', value: presentCount, color: 'from-[#00ffa3]' },
                { label: 'Absent Today', value: absentList.length, color: 'from-red-500' },
                { label: 'Attendance Rate', value: `${attendancePercentage}%`, color: 'from-[#00d1ff]' }
              ].map((stat, idx) => (
                <div
                  key={idx}
                  className={`bg-gradient-to-br ${stat.color} via-transparent to-transparent/5 backdrop-blur-xl p-6 rounded-2xl border border-white/10 hover:border-white/20 transition-all`}
                >
                  <p className="text-gray-400 text-xs font-bold tracking-widest uppercase mb-2">{stat.label}</p>
                  <p className="text-4xl font-black">{stat.value}</p>
                </div>
              ))}
            </div>

            {/* CHART & CONTROLS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* CHART */}
              <div className="lg:col-span-2 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl p-8 rounded-[30px] border border-white/10">
                <h3 className="text-lg font-black mb-6 text-[#00d1ff]">ATTENDANCE OVERVIEW</h3>
                <div className="flex justify-center">
                  <div className="relative w-[300px] h-[300px]">
                    <Doughnut
                      data={{
                        labels: ['Present', 'Absent'],
                        datasets: [{
                          data: [presentCount, absentList.length],
                          backgroundColor: ['#00ffa3', '#ff007a'],
                          borderWidth: 3,
                          borderColor: '#05050a',
                        }]
                      }}
                      options={{
                        cutout: '75%',
                        plugins: {
                          legend: { display: false }
                        }
                      }}
                    />
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-5xl font-black text-[#00d1ff]">{presentCount}</span>
                      <span className="text-xs text-gray-400 font-bold uppercase tracking-widest">PRESENT</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* CONTROLS */}
              <div className="bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl p-8 rounded-[30px] border border-white/10">
                <h3 className="text-lg font-black mb-6">ACTIONS</h3>
                <div className="space-y-3">
                  <button
                    onClick={async () => {
                      setMessage({ type: 'idle', text: 'Sending absence alerts...' });
                      const res = await sendAbsenteeAlerts();
                      if (res.sent > 0) {
                        setMessage({ type: 'success', text: `✅ Sent ${res.sent} alerts` });
                        const sentRegNos: string[] = []; // we don't have mapping here
                        onSendEmails?.(sentRegNos);
                      } else if (res.failed > 0) {
                        setMessage({ type: 'error', text: `❌ ${res.failed} failed to send` });
                      } else {
                        setMessage({ type: 'error', text: `❌ No alerts sent` });
                      }
                      setTimeout(() => setMessage(null), 4000);
                    }}
                    className="w-full py-3 bg-gradient-to-r from-[#ff007a] to-[#ff1493] text-white rounded-xl font-bold text-sm hover:shadow-[0_0_30px_#ff007a] transition-all active:scale-95"
                  >
                    📧 SEND ABSENCE ALERTS
                  </button>
                  <button
                    onClick={onExport}
                    className="w-full py-3 bg-gradient-to-r from-[#00d1ff] to-[#00ffa3] text-black rounded-xl font-bold text-sm hover:shadow-[0_0_20px_#00d1ff] transition-all"
                  >
                    📥 EXPORT EXCEL
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ATTENDANCE VIEW */}
        {view === 'attendance' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            {/* PRESENT */}
            <div className="bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl p-8 rounded-[30px] border border-white/10">
              <h3 className="text-lg font-black mb-6 text-[#00ffa3]">PRESENT TODAY ({presentCount})</h3>
              <div className="grid gap-4">
                {records.length > 0 ? (
                  records.map((record, idx) => (
                    <MemoizedPresentItem
                      key={`${record.regNo}-${record.time}`}
                      name={record.name}
                      regNo={record.regNo}
                      time={record.time}
                      photoUrl={record.face}
                      onPhotoClick={(regNo) =>
                        setSelectedPhoto({ url: record.face || '', name: record.name, regNo })
                      }
                    />
                  ))
                ) : (
                  <p className="text-center text-gray-400 py-8">No attendance recorded yet</p>
                )}
              </div>
            </div>

            {/* ABSENT */}
            {absentList.length > 0 && (
              <div className="bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl p-8 rounded-[30px] border border-red-500/20">
                <h3 className="text-lg font-black mb-6 text-red-500">ABSENT LIST ({absentList.length})</h3>
                <div className="grid gap-4">
                  {absentList.map((student) => (
                    <MemoizedAbsentItem
                      key={student.regNo}
                      name={student.name}
                      regNo={student.regNo}
                      emailSent={emailsSentTo.has(student.regNo)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* STUDENT MANAGEMENT VIEW */}
        {view === 'students' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            {/* ADD STUDENT SECTION */}
            <div className="bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl p-8 rounded-[30px] border border-white/10">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-[#00d1ff]/20 border border-[#00d1ff] rounded-xl">
                  <Plus className="w-5 h-5 text-[#00d1ff]" />
                </div>
                <h3 className="text-lg font-black text-[#00d1ff]">ADD NEW STUDENT</h3>
              </div>
              
              {message && (
                <div className={`mb-6 p-4 rounded-xl text-sm font-bold border ${
                  message.type === 'success'
                    ? 'bg-[#00ffa3]/10 border-[#00ffa3] text-[#00ffa3]'
                    : 'bg-red-500/10 border-red-500 text-red-400'
                }`}>
                  {message.text}
                </div>
              )}
              
              <div className="grid md:grid-cols-4 gap-4 items-end">
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-widest">Name</label>
                  <input
                    type="text"
                    placeholder="Student Name"
                    value={newStudent.name}
                    onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                    className="w-full bg-black/50 border border-white/20 p-3 rounded-xl text-white placeholder-gray-600 focus:border-[#00d1ff] focus:outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-widest">Reg No</label>
                  <input
                    type="text"
                    placeholder="Reg Number"
                    value={newStudent.regNo}
                    onChange={(e) => setNewStudent({ ...newStudent, regNo: e.target.value.toUpperCase() })}
                    className="w-full bg-black/50 border border-white/20 p-3 rounded-xl text-white placeholder-gray-600 focus:border-[#00d1ff] focus:outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-widest">Email</label>
                  <input
                    type="email"
                    placeholder="Email (Optional)"
                    value={newStudent.email}
                    onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })}
                    className="w-full bg-black/50 border border-white/20 p-3 rounded-xl text-white placeholder-gray-600 focus:border-[#00d1ff] focus:outline-none transition-all"
                  />
                </div>
                <button
                  onClick={async () => {
                    if (!newStudent.name.trim() || !newStudent.regNo.trim()) {
                      setMessage({ type: 'error', text: '❌ Name and Reg No are required' });
                      return;
                    }
                    setAddingStudent(true);
                    setMessage(null);
                    try {
                      await onAddStudent?.(newStudent);
                      setMessage({ type: 'success', text: `✅ ${newStudent.name} added successfully!` });
                      setNewStudent({ name: '', regNo: '', email: '' });
                      setTimeout(() => setMessage(null), 3000);
                    } catch (error) {
                      setMessage({ type: 'error', text: `❌ Error: ${error instanceof Error ? error.message : 'Failed to add student'}` });
                    } finally {
                      setAddingStudent(false);
                    }
                  }}
                  disabled={addingStudent}
                  className="px-6 py-3 bg-gradient-to-r from-[#00d1ff] to-[#00ffa3] text-black rounded-xl font-bold text-sm hover:shadow-[0_0_20px_#00d1ff] transition-all disabled:opacity-50"
                >
                  {addingStudent ? 'ADDING...' : '➕ ADD'}
                </button>
              </div>
            </div>

            {/* SEARCH STUDENTS SECTION */}
            <div className="bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl p-8 rounded-[30px] border border-white/10">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-[#ff007a]/20 border border-[#ff007a] rounded-xl">
                  <Users className="w-5 h-5 text-[#ff007a]" />
                </div>
                <h3 className="text-lg font-black text-[#ff007a]">MANAGE STUDENTS</h3>
                <div className="ml-auto text-sm font-bold text-gray-400">{Object.keys(allStudents).length} Total</div>
              </div>

              {/* SEARCH BAR */}
              <div className="mb-6 flex items-center gap-2 bg-black/50 border border-white/20 p-3 rounded-xl">
                <Search className="w-5 h-5 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search by name or registration number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 bg-transparent text-white placeholder-gray-600 focus:outline-none"
                />
              </div>

              {/* STUDENTS LIST */}
              <div className="grid gap-3">
                {(() => {
                  const filteredStudents = Object.entries(allStudents).filter(([regNo, student]: [string, any]) => {
                    const searchLower = searchQuery.toLowerCase();
                    return (
                      regNo.toLowerCase().includes(searchLower) ||
                      (student.name || '').toLowerCase().includes(searchLower)
                    );
                  });

                  if (filteredStudents.length === 0) {
                    return (
                      <div className="text-center py-12 text-gray-400">
                        <Users className="w-12 h-12 mx-auto mb-4 opacity-20" />
                        <p>{searchQuery ? 'No students found matching your search' : 'No students registered'}</p>
                      </div>
                    );
                  }

                  return filteredStudents.map(([regNo, student]: [string, any]) => (
                    <MemoizedStudentListItem
                      key={regNo}
                      name={student.name || 'Unnamed'}
                      regNo={regNo}
                      email={student.email}
                      isDeleting={deletingStudent === regNo}
                      isConfirming={confirmDeleteRegNo === regNo}
                      isResettingDevice={resettingDevice === regNo}
                      onDelete={() => setConfirmDeleteRegNo(regNo)}
                      onCancelDelete={() => setConfirmDeleteRegNo(null)}
                      onResetDevice={() => handleResetDeviceLock(regNo)}
                      onConfirmDelete={async () => {
                        setDeletingStudent(regNo);
                        try {
                          await onDeleteStudent?.(regNo);
                          setMessage({ type: 'success', text: `✅ Student deleted successfully!` });
                          setConfirmDeleteRegNo(null);
                          setTimeout(() => setMessage(null), 3000);
                        } catch (error) {
                          setMessage({ type: 'error', text: `❌ Error deleting student` });
                        } finally {
                          setDeletingStudent(null);
                        }
                      }}
                    />
                  ));
                })()}
              </div>
            </div>
          </div>
        )}

        {/* REPORTS VIEW */}
        {view === 'reports' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            {/* EXPORT REPORTS SECTION */}
            <div className="bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl p-8 rounded-[30px] border border-white/10">
              <h3 className="text-lg font-black mb-6">EXPORT REPORTS</h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
                  <p className="text-gray-400 text-sm mb-4">Generate Excel attendance report with all student data</p>
                  <button
                    onClick={onExport}
                    className="w-full py-3 bg-gradient-to-r from-[#00d1ff] to-[#00ffa3] text-black rounded-xl font-bold text-sm"
                  >
                    📊 EXPORT EXCEL
                  </button>
                </div>
                <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
                  <p className="text-gray-400 text-sm mb-4">Send absence notifications to all absent students via email</p>
                  <button
                    onClick={async () => {
                      setMessage({ type: 'idle', text: 'Sending absence alerts...' });
                      const res = await sendAbsenteeAlerts();
                      if (res.sent > 0) setMessage({ type: 'success', text: `✅ Sent ${res.sent} alerts` });
                      else if (res.failed > 0) setMessage({ type: 'error', text: `❌ ${res.failed} failed to send` });
                      else setMessage({ type: 'error', text: '❌ No alerts sent' });
                      setTimeout(() => setMessage(null), 4000);
                    }}
                    className="w-full py-3 bg-gradient-to-r from-[#ff007a] to-[#ff1493] text-white rounded-xl font-bold text-sm hover:shadow-[0_0_30px_#ff007a] transition-all active:scale-95"
                  >
                    📧 SEND ABSENCE ALERTS
                  </button>
                </div>
              </div>
            </div>

            {/* DANGER ZONE - CLEAR ATTENDANCE */}
            <div className="bg-gradient-to-br from-red-950/20 to-red-900/10 backdrop-blur-xl p-8 rounded-[30px] border border-red-500/30">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-red-500/20 border border-red-500 rounded-xl">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                </div>
                <h3 className="text-lg font-black text-red-400">DANGER ZONE</h3>
              </div>
              
              <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-xl mb-6">
                <p className="text-sm text-gray-300 mb-2">⚠️ <span className="font-bold text-red-400">Clear Today's Attendance</span></p>
                <p className="text-xs text-gray-400">This will permanently delete all attendance records for today. The student master list will remain intact. This action cannot be undone.</p>
              </div>

              {clearConfirmStage === 0 && (
                <button
                  onClick={() => setClearConfirmStage(1)}
                  className="w-full px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl font-bold text-sm hover:shadow-[0_0_20px_rgba(239,68,68,0.5)] transition-all flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  CLEAR ALL ATTENDANCE
                </button>
              )}

              {clearConfirmStage === 1 && (
                <div className="space-y-3">
                  <div className="p-4 bg-red-500/10 border border-red-400 rounded-lg">
                    <p className="text-sm font-bold text-red-400 text-center">⚠️ Are you sure? This cannot be undone.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setClearConfirmStage(2)}
                      className="px-4 py-2 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg font-bold text-xs hover:bg-red-700 transition-all"
                    >
                      CONFIRM CLEAR
                    </button>
                    <button
                      onClick={() => setClearConfirmStage(0)}
                      className="px-4 py-2 bg-gray-700 text-white rounded-lg font-bold text-xs hover:bg-gray-600 transition-all"
                    >
                      CANCEL
                    </button>
                  </div>
                </div>
              )}

              {clearConfirmStage === 2 && (
                <div className="space-y-3">
                  <div className="p-4 bg-orange-500/10 border border-orange-400 rounded-lg">
                    <p className="text-sm font-bold text-orange-400 text-center">🔴 Type 'DELETE' to confirm permanent deletion</p>
                  </div>
                  <div className="flex gap-3 items-center">
                    <input
                      type="text"
                      placeholder="Type DELETE to confirm"
                      id="deleteConfirmInput"
                      className="flex-1 bg-black/50 border border-red-500/30 px-4 py-2 rounded-lg text-white placeholder-gray-600 focus:border-red-500 focus:outline-none text-center font-mono"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && (e.target as HTMLInputElement).value === 'DELETE') {
                          (e.target as HTMLInputElement).value = '';
                          setClearingAttendance(true);
                          onClearAttendance?.().then(() => {
                            setMessage({ type: 'success', text: '✅ All attendance records cleared successfully!' });
                            setClearConfirmStage(0);
                            setTimeout(() => setMessage(null), 3000);
                          }).catch((error) => {
                            setMessage({ type: 'error', text: `❌ Error: ${error instanceof Error ? error.message : 'Failed to clear'}` });
                            setClearConfirmStage(0);
                          }).finally(() => {
                            setClearingAttendance(false);
                          });
                        }
                      }}
                    />
                    <button
                      onClick={() => {
                        const input = document.getElementById('deleteConfirmInput') as HTMLInputElement;
                        if (input?.value === 'DELETE') {
                          input.value = '';
                          setClearingAttendance(true);
                          onClearAttendance?.().then(() => {
                            setMessage({ type: 'success', text: '✅ All attendance records cleared successfully!' });
                            setClearConfirmStage(0);
                            setTimeout(() => setMessage(null), 3000);
                          }).catch((error) => {
                            setMessage({ type: 'error', text: `❌ Error: ${error instanceof Error ? error.message : 'Failed to clear'}` });
                            setClearConfirmStage(0);
                          }).finally(() => {
                            setClearingAttendance(false);
                          });
                        }
                      }}
                      disabled={clearingAttendance}
                      className="px-6 py-2 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg font-bold text-xs hover:bg-red-700 transition-all disabled:opacity-50"
                    >
                      {clearingAttendance ? '...' : 'DELETE'}
                    </button>
                    <button
                      onClick={() => setClearConfirmStage(0)}
                      className="px-6 py-2 bg-gray-700 text-white rounded-lg font-bold text-xs hover:bg-gray-600 transition-all"
                    >
                      CANCEL
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* SECURITY VIEW */}
        {view === 'security' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            {/* CHANGE PASSWORD SECTION */}
            <div className="bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl p-8 rounded-[30px] border border-white/10">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-[#ff007a]/20 border border-[#ff007a] rounded-xl">
                  <Lock className="w-5 h-5 text-[#ff007a]" />
                </div>
                <h3 className="text-lg font-black text-[#ff007a]">CHANGE PASSWORD</h3>
              </div>

              {message && (
                <div className={`mb-6 p-4 rounded-xl text-sm font-bold border ${
                  message.type === 'success'
                    ? 'bg-[#00ffa3]/10 border-[#00ffa3] text-[#00ffa3]'
                    : 'bg-red-500/10 border-red-500 text-red-400'
                }`}>
                  {message.text}
                </div>
              )}

              <form
                onSubmit={async (e) => {
                  e.preventDefault();

                  if (!currentPassword.trim()) {
                    setMessage({ type: 'error', text: '❌ Please enter your current password' });
                    return;
                  }

                  if (!newPassword.trim()) {
                    setMessage({ type: 'error', text: '❌ Please enter a new password' });
                    return;
                  }

                  if (newPassword !== confirmPassword) {
                    setMessage({ type: 'error', text: '❌ Passwords do not match' });
                    return;
                  }

                  if (currentPassword === newPassword) {
                    setMessage({ type: 'error', text: '❌ New password must be different from current password' });
                    return;
                  }

                  const passwordStrength = validatePasswordStrength(newPassword);
                  if (!passwordStrength.isValid) {
                    setMessage({ type: 'error', text: `❌ ${passwordStrength.errors[0]}` });
                    return;
                  }

                  // Validate current password against stored hash or fallback to default
                  const isValidCurrent = storedPasswordHash
                    ? comparePassword(currentPassword, storedPasswordHash)
                    : currentPassword === 'admin123';

                  if (!isValidCurrent) {
                    setMessage({ type: 'error', text: '❌ Incorrect current password' });
                    return;
                  }

                  setChangingPassword(true);
                  setMessage(null);

                  try {
                    // update password in realtime database
                    const db = getDatabase();
                    const passwordRef = ref(db, 'admin/config/password');
                    const hashed = hashPassword(newPassword);
                    await set(passwordRef, {
                      hash: hashed,
                      lastUpdated: new Date().toISOString()
                    });

                    // update local copy so further checks use latest
                    setStoredPasswordHash(hashed);

                    setMessage({
                      type: 'success',
                      text: '✅ Password updated successfully!'
                    });
                    setCurrentPassword('');
                    setNewPassword('');
                    setConfirmPassword('');
                    setTimeout(() => setMessage(null), 3000);
                  } catch (error) {
                    setMessage({
                      type: 'error',
                      text: `❌ Error: ${error instanceof Error ? error.message : 'Failed to update password'}`
                    });
                  } finally {
                    setChangingPassword(false);
                  }
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-widest">
                    Current Password
                  </label>
                  <input
                    type="password"
                    placeholder="Enter current password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full bg-black/50 border border-white/20 p-4 rounded-xl text-white placeholder-gray-600 focus:border-[#ff007a] focus:outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-widest">
                    New Password
                  </label>
                  <input
                    type="password"
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-black/50 border border-white/20 p-4 rounded-xl text-white placeholder-gray-600 focus:border-[#ff007a] focus:outline-none transition-all"
                  />
                  <p className="text-[10px] text-gray-500 mt-2">
                    • Minimum 8 characters • Uppercase letter • Lowercase letter • Number • Special character
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-widest">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-black/50 border border-white/20 p-4 rounded-xl text-white placeholder-gray-600 focus:border-[#ff007a] focus:outline-none transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={changingPassword}
                  className="w-full px-6 py-3 bg-gradient-to-r from-[#ff007a] to-[#ff1493] text-white rounded-xl font-bold text-sm hover:shadow-[0_0_30px_#ff007a] transition-all disabled:opacity-50"
                >
                  {changingPassword ? '⏳ UPDATING...' : '🔐 UPDATE PASSWORD'}
                </button>
              </form>

              {/* Security Tips */}
              <div className="mt-8 pt-8 border-t border-white/10">
                <h4 className="text-sm font-bold text-[#00d1ff] mb-4">🛡️ Security Tips:</h4>
                <ul className="space-y-2 text-xs text-gray-400">
                  <li>✓ Use a strong, unique password</li>
                  <li>✓ Don't share your password with anyone</li>
                  <li>✓ Change your password regularly</li>
                  <li>✓ Never use the same password for multiple accounts</li>
                  <li>✓ Use a combination of letters, numbers, and symbols</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* PHOTO MODAL */}
      <PhotoModal
        isOpen={selectedPhoto !== null}
        photoUrl={selectedPhoto?.url || null}
        studentName={selectedPhoto?.name}
        regNumber={selectedPhoto?.regNo}
        onClose={() => setSelectedPhoto(null)}
      />

      {/* GPU ACCELERATION STYLES */}
      <style dangerouslySetInnerHTML={{ __html: `
        @supports (will-change: transform) {
          .group {
            will-change: transform;
          }
          .animate-pulse {
            will-change: opacity;
          }
        }
        
        /* Enable 3D acceleration for cards */
        .bg-gradient-to-br {
          transform: translateZ(0);
          backface-visibility: hidden;
        }
        
        /* Optimize transitions */
        .transition-all {
          transition-property: all;
          transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
          transition-duration: 150ms;
        }
        
        /* GPU accelerate hover effects */
        .group:hover {
          transform: translateZ(0);
        }
      `}} />
    </div>
  );
};

export default AdminDashboardComponent;
