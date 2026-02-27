# Absence Alert Feature - Implementation & Usage Guide

## Feature Overview

The **Absence Alert System** automatically identifies students who have not submitted attendance for the current day and sends them notification emails. This helps improve accountability and engagement.

---

## What Happens at Each Step

### 1. Identifying Absent Students

**How It Works:**
- System compares list of all registered students with students who submitted attendance today
- Students NOT in today's attendance list = ABSENT
- Only counted as absent if they appear in "All Students" record in database

**Example:**

```
All Students in System:
- REG001: John Doe (email: john@example.com)
- REG002: Jane Smith (email: jane@example.com)  
- REG003: Bob Wilson (email: bob@example.com)
- REG004: Alice Brown (email: alice@example.com)

Today's Attendance (2/27/2026):
- REG001: John Doe (submitted 9:15 AM)
- REG002: Jane Smith (submitted 9:22 AM)

Absent Students:
✗ REG003: Bob Wilson ← Gets email
✗ REG004: Alice Brown ← Gets email
```

### 2. Preparing Emails

**Data Collected:**
- Student's registered email address
- Student's full name
- Student's registration number
- Current date

**Email Construction:**
```
To: bob@example.com
Subject: Absence Notification - KNCET Portal

Body:
Dear Student,

You have been marked ABSENT for today's session in the KNCET Portal.

If this is a mistake, contact your staff immediately.

Best regards,
KNCET Attendance System
```

### 3. Sending Emails

**Process:**
1. Staff clicks "SEND ABSENCE ALERTS" button
2. System retrieves all absent students
3. For each absent student with an email address:
   - Creates email with their data
   - Sends via EmailJS to their registered email
   - Tracks success/failure
4. Shows results to staff

**Status Indicator:**
- ✉️ **MAIL SENT** badge appears next to student name
- Shows which emails were sent successfully
- Persists until page refresh

### 4. Student Receives Email

**What Student Sees:**
- Email in inbox from KNCET system
- Clear indication they were marked absent
- Instructions to contact staff if there's a mistake
- Professional HTML formatted email

**Where Email Might Go:**
- ✅ Inbox (expected)
- ⚠️ Spam/Promotions folder (check there)
- ❌ Might not arrive if email invalid or service misconfigured

---

## How to Use - Step by Step

### As Staff/Admin:

#### Step 1: Ensure All Students Have Emails

**In Staff Dashboard:**
1. Go to **👨‍🎓 Students** tab
2. For each student, verify email is registered
3. Add students with email:
   - Name: Student Name
   - Reg No: REG001
   - Email: student@example.com ← **Required!**

#### Step 2: View Absent Students

1. Go to **📊 Dashboard** or **👥 Attendance** tab
2. Scroll down to **"ABSENT LIST"** section
3. See all students not present today
4. Notice no "✉️ MAIL SENT" badges (not sent yet)

#### Step 3: Send Absence Alerts

**Option A: From Dashboard Tab**
1. Go to **📊 Dashboard** tab
2. Find **"ACTIONS"** section
3. Click **"📧 SEND ABSENCE ALERTS"** button
4. Wait for message (usually < 30 seconds)

**Option B: From Reports Tab**
1. Go to **📋 Reports** tab
2. Find **"EXPORT REPORTS"** section
3. Click **"📧 SEND ABSENCE ALERTS"** button
4. Wait for status message

#### Step 4: Verify Emails Sent

**Check Dashboard:**
- Look for ✉️ **MAIL SENT** badge next to absent students
- See success message: "✅ Absence alerts sent to X students successfully!"
- Message disappears after 5 seconds

**What Success Looks Like:**
```
ABSENT LIST (2)
├─ John Doe (REG001)      ✉️ MAIL SENT  ABSENT
└─ Jane Smith (REG002)    ✉️ MAIL SENT  ABSENT
```

#### Step 5: Handle Errors

**Common Error Messages:**

| Error | Meaning | Solution |
|-------|---------|----------|
| "No absent students to notify" | Everyone marked present | Try again later with actual absences |
| "No student emails configured" | No emails in database | Add emails to student records |
| "EmailJS not configured" | Setup not done | Follow EMAILJS_SETUP_GUIDE.md |
| "Failed to send alerts" | EmailJS service issue | Check service status, retry |

**If Emails Don't Arrive:**
1. Check student email address is valid
2. Ask student to check spam folder
3. Verify EmailJS service is authenticated
4. Try sending test email from EmailJS dashboard

---

## Real-World Examples

### Example 1: Small Class (25 students)

**Scenario:** Class of 25 students, 20 present, 5 absent

**By Date:** 2/27/2026

**Step 1: Staff adds students**
```
Student List:
REG001 - John Doe - john@example.com
REG002 - Jane Smith - jane@example.com
... (total 25 students, all with emails)
```

**Step 2: 20 students submit attendance**
```
Attendance Submitted (20):
- John Doe (9:15 AM)
- Jane Smith (9:22 AM)
- ... (18 more)
```

**Step 3: Identify 5 absent**
```
Absent (5):
- REG021 - Bob Wilson (bob@example.com)
- REG022 - Alice Brown (alice@example.com)
- REG023 - Charlie Davis (charlie@example.com)
- REG024 - Diana Evans (diana@example.com)
- REG025 - Edward Frank (edward@example.com)
```

**Step 4: Staff sends alerts**
- Clicks "SEND ABSENCE ALERTS"
- System sends 5 emails
- Success: "✅ Absence alerts sent to 5 students successfully!"
- Each student sees ✉️ MAIL SENT badge

**Step 5: Students receive emails**
- Bob gets email (bob@example.com)
- Alice gets email (alice@example.com)
- ... (3 more)
- Each knows they were marked absent

---

### Example 2: Missing Configuration (Error Handling)

**Scenario:** Staff tries to send but EmailJS not configured

**Flow:**
1. Staff clicks "SEND ABSENCE ALERTS"
2. System shows: ❌ "EmailJS not configured. Check services/emailService.ts"
3. Button doesn't do anything further
4. Staff checks emailService.ts
5. Realizes PUBLIC_KEY still says "your_emailjs_public_key"
6. Follows EMAILJS_SETUP_GUIDE.md
7. Updates with actual credentials
8. Tries again - works! ✅

---

### Example 3: Partial Email List

**Scenario:** Some students have emails, others don't

**Student List:**
```
REG001 - John Doe - john@example.com       ← HAS EMAIL
REG002 - Jane Smith - (no email)           ← NO EMAIL
REG003 - Bob Wilson - bob@example.com      ← HAS EMAIL
```

**Absent Today:** REG002, REG003

**When Staff Sends:**
- REG002 (Jane Smith): ❌ NO EMAIL - skipped
- REG003 (Bob Wilson): ✅ HAS EMAIL - gets email alert

**Success Message:** "✅ Absence alerts sent to 1 students successfully!"

**Note:** Jane doesn't get email because no email on file. Staff might need to follow up manually.

---

## Database Structure

### Students Collection:

```json
{
  "students": {
    "REG001": {
      "name": "John Doe",
      "email": "john@example.com",        // ← Required for emails
      "deviceId": "abc123...",
      "firstAttendance": "2026-02-27T..."
    },
    "REG002": {
      "name": "Jane Smith",
      "email": "jane@example.com",        // ← Required for emails
      "deviceId": "def456...",
      "firstAttendance": "2026-02-27T..."
    }
  }
}
```

### Attendance Collection:

```json
{
  "attendance": {
    "1708956000000": {
      "name": "John Doe",
      "regNo": "REG001",
      "email": "john@example.com",
      "date": "2/27/2026",
      "time": "9:15:30 AM",
      "deviceId": "abc123...",
      "face": "base64_image_data...",
      "submittedAt": "2026-02-27T14:15:30.000Z"
    }
    // ... more attendance records
  }
}
```

---

## Technical Details

### Code Location: Email Service

**File:** `services/emailService.ts`

**Main Function:**
```typescript
sendAbsenceAlert(params: EmailParams): Promise<{ success: boolean; message: string }>
```

**Parameters:**
- `parent_email`: string - Student's email address
- `student_name`: string - Full name of student
- `registration_number`: string - Reg no (REG001, etc.)
- `attendance_date`: string - Date string from toLocaleDateString()

**Returns:**
- `success`: boolean - True if email sent, false if failed
- `message`: string - Description of result

### Code Location: UI Management

**File:** `components/StaffDashboard.tsx`

**Key State:**
```typescript
const [emailsSentTo, setEmailsSentTo] = useState<Set<string>>(new Set());
```

**Updates when:**
- "SEND ABSENCE ALERTS" button clicked
- Emails sent successfully
- Callback receives list of regNos that got emails

**Used to:**
- Show ✉️ MAIL SENT badge next to student names
- Show which students had emails sent

### Code Location: Button Implementation

**Attendance View:**
```tsx
onClick={() => onSendEmails?.((regNos) => {
  setEmailsSentTo(new Set([...emailsSentTo, ...regNos]));
})}
```

**Reports View:**
```tsx
<button onClick={() => onSendEmails?.((regNos) => {...})}>
  📧 SEND ABSENCE ALERTS
</button>
```

---

## Customization

### Change Email Message

1. **Go to EmailJS Dashboard**
2. **Email Templates** → Your template
3. **Edit Subject & Body**
4. **Save changes**
5. **No code changes needed!**

### Add More Information to Email

**In EmailJS Template:**
```html
<p>Student: {{student_name}}</p>
<p>Registration: {{registration_number}}</p>
<p>Date: {{attendance_date}}</p>
<p>Class: {{class_name}}</p>  <!-- Add custom variables -->
```

**Then in Code:**
```typescript
const templateParams = {
  to_email: params.parent_email,
  student_name: params.student_name,
  registration_number: params.registration_number,
  attendance_date: params.attendance_date,
  class_name: params.class_name  // Add new param
};
```

### Change Email Recipient

**To Send to Parents Instead of Students:**
1. Update database to store parent emails
2. Change `student_email` to `parent_email`
3. Update email template greeting to "Dear Parent,"
4. Update button label to "SEND PARENT ALERTS"

---

## Performance Considerations

### Email Sending Speed

**Expected Times:**
- 1-5 students: < 5 seconds
- 5-20 students: 5-15 seconds
- 20-50 students: 15-30 seconds
- 50+ students: 30+ seconds (queued)

**Why delays?**
- EmailJS adds 100ms delay between emails to avoid rate limiting
- Network latency to EmailJS service
- Email service processing time

### During High Traffic

If all students try submitting attendance while sending alerts:
- Attendance submission still works (separate)
- Email sending may slow down slightly
- Both operations are non-blocking

---

## Frequently Asked Questions

**Q: What if a student has multiple emails?**
A: System uses the single email in the database. Only one email sent per student.

**Q: Can I send to multiple recipients per student?**
A: Not without code changes. Would need to loop through array of emails per student.

**Q: What if student email bounces?**
A: EmailJS handles bounce. Check EmailJS logs. No retry in current system.

**Q: Can I schedule emails to send automatically?**
A: Not with free EmailJS. Requires server-side scheduler (Cloud Functions, Cron, etc.).

**Q: How long are emails stored?**
A: According to EmailJS privacy policy, short term (7-30 days). No long-term storage of email content.

**Q: Can I see who opened the email?**
A: Not with free EmailJS. Requires email tracking service (paid add-on).

**Q: Do students get duplicates if I send twice?**
A: Yes! Each click sends new email. No deduplication in system.

**Q: Can I undo sending emails?**
A: No. Once sent, can't be recalled. Tell staff to use caution!

---

## Best Practices

### Do's ✅
- ✅ Test with sample students before going live
- ✅ Verify all student emails before deployment
- ✅ Use professional email address for from address
- ✅ Monitor EmailJS dashboard for failures
- ✅ Keep email template concise and clear
- ✅ Use variables for personalization

### Don'ts ❌
- ❌ Don't send duplicate alerts (no deduplication)
- ❌ Don't share public key in code repositories
- ❌ Don't use personal email for bulk sending
- ❌ Don't include malware/phishing-like content
- ❌ Don't ignore email bounces
- ❌ Don't manually send individual emails (use system)

---

## Troubleshooting Guide

### Symptom: "No student emails configured"

**Cause:**
- No students in system have email addresses
- All students' email fields are empty/null

**Solution:**
1. Go to Students tab
2. Check each student's email field
3. Add emails for all students:
   ```
   Name: John Doe
   Reg No: REG001
   Email: john.doe@example.com  ← Must add!
   ```

### Symptom: Button doesn't do anything (no error message)

**Cause:**
- No absent students (everyone present)
- OnSendEmails callback not connected

**Solution:**
1. Mark some students as absent (don't submit attendance)
2. Clear browser console errors (F12)
3. Check that app is not in offline mode
4. Try refreshing and retrying

### Symptom: Some emails sent, some failed

**Cause:**
- Invalid email addresses
- EmailJS rate limiting fired
- Network timeout for some emails

**Solution:**
1. Check email format (user@domain.com)
2. Wait 5 minutes and retry (EmailJS rate limit resets)
3. Check EmailJS dashboard for specific error messages

### Symptom: Emails arrive with no content

**Cause:**
- Template variables not matching
- EmailJS configuration issue

**Solution:**
1. Check template variables in EmailJS dashboard:
   - `{{student_name}}` - correct spelling?
   - `{{registration_number}}` - correct spelling?
   - `{{attendance_date}}` - correct spelling?
2. Re-authenticate EmailJS service
3. Test email from EmailJS dashboard

---

## Next Steps

1. ✅ Follow EMAILJS_SETUP_GUIDE.md
2. ✅ Add emails to student records
3. ✅ Test with sample data
4. ✅ Monitor first bulk send
5. ✅ Adjust email template if needed
6. ✅ Train staff on feature

---

**Feature Version**: 1.0.0
**Status**: Production Ready ✅
**Last Updated**: February 27, 2026
