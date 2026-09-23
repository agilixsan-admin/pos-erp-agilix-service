import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateUserInvitationEmailTemplateForMobileIOS1700000000031 implements MigrationInterface {
  name = 'UpdateUserInvitationEmailTemplateForMobileIOS1700000000031';

  async up(queryRunner: QueryRunner): Promise<void> {
    const mobileOptimizedTemplate = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="id">
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>Undangan Bergabung ke Agilix POS</title>
  <style type="text/css">
    @import url("https://fonts.googleapis.com/css?family=Nunito+Sans:400,600,700&display=swap");
    body { width:100%!important; height:100%; margin:0; padding:0; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; background-color:#F1F5F9; font-family:"Nunito Sans",-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif; }
    a { color:#0D5C53; text-decoration:none; }
    a[x-apple-data-detectors] { color:inherit!important; text-decoration:none!important; font-size:inherit!important; font-family:inherit!important; font-weight:inherit!important; line-height:inherit!important; }
    td { word-break:break-word; }
    @media only screen and (max-width:600px) {
      .email-body_inner { width:100%!important; }
      .content-cell { padding:24px 18px!important; }
      .masthead { padding:24px 18px!important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#F1F5F9;font-family:'Nunito Sans',-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;-webkit-text-size-adjust:100%;">
  <table class="email-wrapper" width="100%" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;margin:0;padding:0;background-color:#F1F5F9;">
    <tr>
      <td align="center" style="padding:24px 10px;">
        <table class="email-body_inner" width="570" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;max-width:570px;margin:0 auto;background-color:#FFFFFF;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.05);border:1px solid #E2E8F0;">
          <!-- Header -->
          <tr>
            <td class="masthead" style="background-color:#0D5C53;padding:28px 40px;text-align:center;border-top-left-radius:12px;border-top-right-radius:12px;">
              <h2 style="color:#FFFFFF;font-size:22px;font-weight:bold;letter-spacing:1.5px;margin:0;text-transform:uppercase;">AGILIX POS</h2>
              <p style="color:#A7F3D0;font-size:12px;margin:4px 0 0 0;">Point of Sale &amp; ERP Operational System</p>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td class="content-cell" style="padding:36px 40px;color:#334155;line-height:1.6;">
              <h1 style="margin:0 0 16px 0;color:#0F172A;font-size:20px;font-weight:bold;">Halo, {{name}}! 👋</h1>
              <p style="margin:0 0 20px 0;font-size:14px;color:#475569;line-height:1.6;">
                Anda telah diundang untuk bergabung dengan tim <strong>{{businessName}}</strong> pada sistem operasional kasir Agilix POS.
              </p>

              <!-- Account Details Box -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;border-collapse:collapse;margin:20px 0;background-color:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;">
                <tr><td style="padding:10px 14px;font-size:13px;font-weight:bold;color:#0D5C53;width:40%;border-bottom:1px solid #E2E8F0;">Nama Lengkap</td><td style="padding:10px 14px;font-size:13px;color:#1E293B;border-bottom:1px solid #E2E8F0;">{{name}}</td></tr>
                <tr><td style="padding:10px 14px;font-size:13px;font-weight:bold;color:#0D5C53;border-bottom:1px solid #E2E8F0;">Alamat Email</td><td style="padding:10px 14px;font-size:13px;color:#1E293B;border-bottom:1px solid #E2E8F0;">{{email}}</td></tr>
                <tr><td style="padding:10px 14px;font-size:13px;font-weight:bold;color:#0D5C53;border-bottom:1px solid #E2E8F0;">Bisnis / Brand</td><td style="padding:10px 14px;font-size:13px;color:#1E293B;border-bottom:1px solid #E2E8F0;">{{businessName}}</td></tr>
                <tr><td style="padding:10px 14px;font-size:13px;font-weight:bold;color:#0D5C53;border-bottom:1px solid #E2E8F0;">Penugasan Outlet</td><td style="padding:10px 14px;font-size:13px;color:#1E293B;border-bottom:1px solid #E2E8F0;">{{outletName}}</td></tr>
                <tr><td style="padding:10px 14px;font-size:13px;font-weight:bold;color:#0D5C53;border-bottom:1px solid #E2E8F0;">Role / Jabatan</td><td style="padding:10px 14px;font-size:13px;color:#0D5C53;font-weight:bold;border-bottom:1px solid #E2E8F0;">{{roleName}}</td></tr>
                <tr><td style="padding:10px 14px;font-size:13px;font-weight:bold;color:#0D5C53;">Tingkat Akses</td><td style="padding:10px 14px;font-size:13px;color:#64748B;">{{accessLevel}}</td></tr>
              </table>

              <p style="margin:24px 0 16px 0;font-size:14px;color:#475569;line-height:1.6;text-align:center;">
                Untuk mengaktifkan akun dan mulai menggunakan sistem POS, silakan ketuk tombol di bawah ini untuk membuat kata sandi Anda:
              </p>

              <!-- Bulletproof Centered Button for iOS / Android / Desktop (NO target="_blank" to prevent iOS WebKit tap failure) -->
              <table border="0" cellpadding="0" cellspacing="0" role="presentation" align="center" style="margin:24px auto;border-collapse:separate;">
                <tr>
                  <td align="center" bgcolor="#0D5C53" style="background-color:#0D5C53;border-radius:10px;text-align:center;">
                    <a href="{{invitationUrl}}" style="background-color:#0D5C53;border:14px solid #0D5C53;border-radius:10px;color:#FFFFFF!important;display:inline-block;font-family:'Nunito Sans',-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;font-size:15px;font-weight:bold;line-height:1.2;text-align:center;text-decoration:none;-webkit-text-size-adjust:none;min-width:220px;">
                      Atur Password &amp; Aktifkan Akun
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Fallback Direct URL Box with Large Tap Area for Mobile iOS -->
              <div style="background-color:#F8FAFC;border:1px dashed #CBD5E1;border-radius:8px;padding:14px 16px;margin:24px 0 12px 0;text-align:center;">
                <p style="margin:0 0 6px 0;font-size:12px;color:#64748B;font-weight:bold;">
                  Jika tombol di atas tidak merespon di iPhone Anda, ketuk atau salin tautan berikut:
                </p>
                <a href="{{invitationUrl}}" style="color:#0D5C53;font-size:13px;font-weight:600;word-break:break-all;text-decoration:underline;line-height:1.5;display:inline-block;padding:6px 0;">
                  {{invitationUrl}}
                </a>
              </div>

              <p style="font-size:11px;color:#94A3B8;text-align:center;margin:8px 0 20px 0;">
                Tautan undangan ini aman dan berlaku selama <strong>{{expiryHours}} jam</strong>.
              </p>

              <hr style="border:none;border-top:1px solid #E2E8F0;margin:24px 0;" />

              <p style="margin:0;font-size:12px;color:#64748B;line-height:1.6;">
                Jika Anda tidak merasa didaftarkan oleh manajemen {{businessName}}, silakan abaikan email ini.<br />
                Salam hangat,<br />
                <strong style="color:#0F172A;">Tim Agilix POS</strong>
              </p>
            </td>
          </tr>

          <!-- Footer Bar -->
          <tr>
            <td style="background-color:#0D5C53;height:6px;border-bottom-left-radius:12px;border-bottom-right-radius:12px;"></td>
          </tr>
        </table>

        <!-- Outer Footer Note -->
        <table class="email-footer" width="570" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;max-width:570px;margin:0 auto;padding:16px 0;text-align:center;">
          <tr>
            <td style="color:#94A3B8;font-size:12px;text-align:center;padding:12px;">
              <p style="margin:0 0 4px 0;">Email ini dikirim secara otomatis oleh sistem Agilix POS. Mohon tidak membalas email ini.</p>
              <p style="margin:0;">&copy; 2026 Agilix POS. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    await queryRunner.query(
      `UPDATE "email_templates"
       SET "template" = $1, "updated_at" = now()
       WHERE "slug" = 'user-invitation'`,
      [mobileOptimizedTemplate],
    );
  }

  async down(): Promise<void> {
    // Safe no-op or revert if necessary
  }
}
