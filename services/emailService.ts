import emailjs from '@emailjs/browser';

// These are placeholder values - replace with your actual EmailJS config
const SERVICE_ID = 'service_attendance_system';
const TEMPLATE_ID = 'template_absent_alert';
const OTP_TEMPLATE_ID = 'template_otp_verification'; // New OTP template
const PUBLIC_KEY = 'your_emailjs_public_key';

// Initialize EmailJS
emailjs.init(PUBLIC_KEY);

export interface EmailParams {
  parent_email: string;
  student_name: string;
  registration_number: string;
  attendance_date: string;
  parent_name?: string;
}

export const emailService = {
  /**
   * Send absence notification email to parent
   */
  sendAbsenceAlert: async (params: EmailParams): Promise<{ success: boolean; message: string }> => {
    try {
      const templateParams = {
        to_email: params.parent_email,
        student_name: params.student_name,
        registration_number: params.registration_number,
        attendance_date: params.attendance_date,
        message: `Dear Student,\n\nYou have been marked ABSENT for today's session in the KNCET Portal.\n\nIf this is a mistake, contact your staff immediately.\n\nBest regards,\nKNCET Attendance System`
      };

      const response = await emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams);
      
      if (response.status === 200) {
        return {
          success: true,
          message: `Absence alert sent to ${params.parent_email}`
        };
      }
      return {
        success: false,
        message: 'Failed to send email'
      };
    } catch (error) {
      console.error('Email service error:', error);
      return {
        success: false,
        message: 'Error sending email: ' + (error instanceof Error ? error.message : 'Unknown error')
      };
    }
  },

  /**
   * Send bulk absence alerts to multiple parents
   */
  sendBulkAbsenceAlerts: async (absentStudents: EmailParams[]): Promise<{ sent: number; failed: number; errors: string[] }> => {
    const results = { sent: 0, failed: 0, errors: [] as string[] };

    for (const student of absentStudents) {
      try {
        const response = await emailService.sendAbsenceAlert(student);
        if (response.success) {
          results.sent++;
        } else {
          results.failed++;
          results.errors.push(`${student.student_name}: ${response.message}`);
        }
      } catch (error) {
        results.failed++;
        results.errors.push(`${student.student_name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return results;
  },

  /**
   * Verify email configuration
   */
  verifyConfiguration: (): boolean => {
    return PUBLIC_KEY !== 'your_emailjs_public_key' && !!SERVICE_ID && !!TEMPLATE_ID;
  },

  /**
   * Send OTP email for password reset
   */
  sendOTPEmail: async (staffEmail: string, otp: string): Promise<{ success: boolean; message: string }> => {
    try {
      const templateParams = {
        staff_email: staffEmail,
        otp_code: otp,
        expiry_time: '5 minutes',
        to_email: staffEmail,
      };

      const response = await emailjs.send(SERVICE_ID, OTP_TEMPLATE_ID, templateParams);
      
      if (response.status === 200) {
        return {
          success: true,
          message: `OTP sent to ${staffEmail}`
        };
      }
      return {
        success: false,
        message: 'Failed to send OTP'
      };
    } catch (error) {
      console.error('OTP email service error:', error);
      return {
        success: false,
        message: 'Error sending OTP: ' + (error instanceof Error ? error.message : 'Unknown error')
      };
    }
  },

  /**
   * Update EmailJS configuration
   */
  updateConfig: (serviceId: string, templateId: string, publicKey: string): void => {
    // In production, this should be handled securely
    // Store in environment variables or backend
    if (publicKey) {
      emailjs.init(publicKey);
    }
  }
};
