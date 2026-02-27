# Device Lock & Once-Per-Day Attendance - Quick Start Guide

## What's New

Your Smart Wi-Fi Attendance System now has:
✅ **Device Locking** - Each student is locked to one device
✅ **Once-Per-Day Limit** - Students can only mark attendance once per day
✅ **Staff Reset Option** - Staff can reset device locks if needed
✅ **Audit Trail** - All attendance is tracked with device IDs

---

## For Students

### First Time Submitting Attendance

1. **Open the Student Portal**
   - Click "Student" button on landing page
   - Allow camera permission when prompted

2. **Fill Your Details**
   - Enter your Full Name
   - Enter your Registration Number
   - Capture a clear photo of your face

3. **Submit**
   - Click "✔️ SUBMIT ATTENDANCE"
   - Your device will be locked to this Registration Number
   - You'll see: `✅ Attendance submitted successfully!`

### Submitting Attendance on Subsequent Days

1. **Use the Same Device**
   - Your device is already locked to your reg number
   - Simply log in and submit as usual
   - The system recognizes your device

2. **Tried Submitting Twice in One Day?**
   - Error: `⚠️ Daily Limit Reached`
   - You can only submit once per calendar day
   - Try again tomorrow!

### Lost Access or Using a New Device?

- **Contact Staff/Admin**
- They'll reset your device lock
- You can then use the new device

---

## For Staff/Admin

### Viewing Student Attendance

1. **Go to Students Tab**
   - In Staff Dashboard, click 👨‍🎓 **Students**

2. **Find the Student**
   - Use the search box to find by Name or Reg No
   - View all registered students

### Resetting a Student's Device Lock

1. **Find the Student**
   - Go to 👨‍🎓 **Students** tab
   - Search for the student by name or reg number

2. **Click Reset Button**
   - Click the orange/yellow 🔓 **RESET LOCK** button
   - Wait for confirmation: `✅ Device lock reset for [REG_NO]`

3. **What Happens**
   - Student can now use a different/new device
   - First attendance from new device locks it again

4. **View Success Message**
   - Message: "Device lock reset for REG_NO. This student can now use a different device."
   - Message auto-clears after 3 seconds

---

## How It Works (Technical)

### Device Fingerprint

Your device is identified by a unique fingerprint created from:
- Browser type and version
- Screen resolution
- Color depth
- Timezone
- Language settings
- Hardware capabilities

This fingerprint is stored locally on your device and sent with each attendance.

### Security Flow

```
Student Submits → Device Check → Daily Limit Check → Attendance Saved
                     ↓                  ↓
              (Pass: Device OK)   (Pass: No duplicate)
                     ↓                  ↓
              (Lock to Device)    (Save Record)
```

### Firebase Storage

**Student Records:**
```
{
  "name": "Student Name",
  "email": "student@example.com",
  "deviceId": "a1b2c3d4...",  ← Device lock
  "firstAttendance": "2026-02-27T..."
}
```

**Attendance Records:**
```
{
  "name": "Student Name",
  "regNo": "REG001",
  "date": "2/27/2026",  ← Prevents duplicates
  "time": "10:30:45 AM",
  "deviceId": "a1b2c3d4...",  ← Audit trail
  "face": "image_data...",
  "submittedAt": "2026-02-27T..."
}
```

---

## Error Messages & Solutions

### ❌ Device Lock Error
**Message:** "This Register Number is already locked to another device. Please contact Staff."

**Causes:**
- You're trying to use a different device with this Reg No
- Device fingerprint doesn't match

**Solution:**
- Use the original device, OR
- Contact staff to reset your device lock

### ⚠️ Daily Limit Reached
**Message:** "You have already registered attendance for today!"

**Causes:**
- You already submitted attendance today
- Same Reg No was already marked present

**Solution:**
- Try again tomorrow (after midnight)
- Contact staff if it's an error

### ❌ Could not identify device
**Message:** "Could not identify device. Please refresh and try again."

**Causes:**
- Browser localStorage is disabled
- Crypto API unavailable
- Browser update issue

**Solution:**
- Refresh the page (Ctrl+R or Cmd+R)
- Enable localStorage in browser settings
- Try a different browser if issue persists

---

## Testing the System

### For Students (Self Test)

1. **Test Device Lock**
   - [ ] Submit attendance from Device A (Phone/Laptop)
   - [ ] Try submitting with same Reg No from Device B
   - [ ] Verify error message appears

2. **Test Daily Limit**
   - [ ] Submit attendance once
   - [ ] Try to submit again immediately
   - [ ] Verify "already registered" message appears

3. **Test Next Day**
   - [ ] Wait until next calendar day
   - [ ] Submit attendance again
   - [ ] Verify it succeeds

### For Staff (System Test)

1. **Test Reset Functionality**
   - [ ] Go to Students tab
   - [ ] Click Reset Lock button
   - [ ] Verify success message appears
   - [ ] Have student try new device
   - [ ] Verify they can now use it

2. **Test Audit Trail**
   - [ ] Check attendance records
   - [ ] Verify deviceId is stored for each record
   - [ ] Confirm deviceId matches student record

3. **Test Data Integrity**
   - [ ] Export attendance to Excel
   - [ ] Verify no duplicate entries for same day
   - [ ] Check all deviceIds are recorded

---

## Important Notes

### Browser localStorage
- Device fingerprint is stored in localStorage
- **Clearing browser data will reset your device ID**
- You'll need to re-register with a new device

### Date & Time
- Date is based on your device's system date
- Uses your local timezone
- Ensure your device date/time is correct

### Camera Access
- Camera permission is required for photo verification
- First time: Grant permission when prompted
- Already given: Check browser camera settings

### Network
- Requires internet connection to Firebase
- Attendance data syncs in real-time
- Slow connection may delay submission

---

## FAQ

**Q: Can I use the same Reg No on multiple devices?**
A: No. Each Reg No is locked to one device. Contact staff to reset if needed.

**Q: What happens if I clear my browser data?**
A: Your device ID is stored locally. Clearing data removes it, and you'll need staff to reset your lock.

**Q: Can I submit attendance from a different time zone?**
A: Yes. The system uses your device's local date/time. A new day in your timezone = new attendance allowed.

**Q: What if the daily limit is wrong?**
A: Contact staff or try again after midnight. If it's still wrong, contact your instructor.

**Q: How long before a device lock expires?**
A: Device locks don't expire. Staff must manually reset them.

**Q: Can I reset my own device lock?**
A: No. Only staff can reset device locks. Contact your instructor or admin.

---

## Support

**If you encounter any issues:**

1. **Screenshot the error message**
2. **Note the time and date**
3. **Contact your course instructor or IT support**
4. **Provide the Reg No and error details**

**Staff:**
- Check DEVICE_LOCK_ATTENDANCE_SYSTEM.md for technical details
- Check troubleshooting section
- Review Firebase logs if issues persist

---

## Quick Reference

| Action | User Type | Location |
|--------|-----------|----------|
| Submit Attendance | Student | Student Portal |
| View Attendance | Staff | Attendance Tab |
| Reset Device Lock | Staff | Students Tab → Orange Button |
| Check Records | Staff | Reports Tab → Export |
| Change Password | Staff | Security Tab |

---

**System Status:** ✅ Active
**Last Updated:** February 27, 2026
**Version:** 1.0.0
