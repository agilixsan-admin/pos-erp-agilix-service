import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEmailTemplatesAndUserInvitations1700000000024 implements MigrationInterface {
  name = 'CreateEmailTemplatesAndUserInvitations1700000000024';

  async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create email_templates table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "email_templates" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "subject" character varying(500) NOT NULL,
        "slug" character varying(100) NOT NULL,
        "template" text NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_email_templates" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_email_templates_slug" UNIQUE ("slug")
      )
    `);

    // 2. Create user_invitations table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_invitations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "token_hash" character varying(255) NOT NULL,
        "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "used_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_invitations" PRIMARY KEY ("id"),
        CONSTRAINT "FK_user_invitations_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    // 3. Create indexes
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_user_invitations_token_hash" ON "user_invitations" ("token_hash")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_user_invitations_user_id" ON "user_invitations" ("user_id")`,
    );

    // 4. Seed default email template for user staff invitation
    const userInvitationTemplate = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <title>Undangan Bergabung ke Agilix POS</title>
  <style type="text/css">
    @import url("https://fonts.googleapis.com/css?family=Nunito+Sans:400,700&display=swap");
    body { width:100%!important; height:100%; margin:0; -webkit-text-size-adjust:none; background-color:#F2F4F6; font-family:"Nunito Sans",Helvetica,Arial,sans-serif; }
    a { color:#1A3A5C; }
    td { word-break:break-word; }
    h1 { margin-top:0; color:#1A3A5C; font-size:22px; font-weight:bold; }
    h2 { margin-top:0; color:#1A3A5C; font-size:16px; font-weight:bold; }
    p { margin:.4em 0 1.1875em; font-size:14px; line-height:1.625; color:#51545E; }
    .email-wrapper { width:100%; margin:0; padding:0; background-color:#F2F4F6; }
    .email-body_inner { width:570px; margin:0 auto; padding:0; background-color:#FFFFFF; border-radius:8px; overflow:hidden; }
    .email-footer { width:570px; margin:0 auto; padding:20px 0; text-align:center; }
    .email-footer p { color:#A8AAAF; font-size:12px; }
    .masthead { background-color:#1A3A5C; padding:30px 45px; text-align:center; }
    .masthead-title { color:#FFFFFF; font-size:24px; font-weight:bold; letter-spacing:2px; margin:0; }
    .masthead-subtitle { color:#A8C4E0; font-size:12px; margin:4px 0 0 0; }
    .content-cell { padding:45px; }
    .divider { border:none; border-top:1px solid #EAEAEC; margin:24px 0; }
    .info-table { width:100%; border-collapse:collapse; margin:20px 0; }
    .info-table td { padding:10px 14px; font-size:14px; color:#51545E; }
    .info-table tr:nth-child(odd) td { background-color:#F8F9FB; }
    .info-table .label { font-weight:bold; color:#1A3A5C; width:40%; }
    .badge { display:inline-block; background-color:#E8F0F8; color:#1A3A5C; font-size:12px; font-weight:bold; padding:4px 12px; border-radius:20px; }
    .btn-container { text-align:center; margin:30px 0; }
    .btn-primary { background-color:#1A3A5C; color:#FFFFFF!important; font-size:15px; font-weight:bold; text-decoration:none; padding:12px 28px; border-radius:6px; display:inline-block; }
    .footer-bar { background-color:#1A3A5C; height:6px; }
    @media only screen and (max-width:600px) { .email-body_inner,.email-footer { width:100%!important; } .content-cell { padding:24px!important; } }
  </style>
</head>
<body style="margin:0;padding:0;">
  <table class="email-wrapper" width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 0;">
      <table class="email-body_inner" width="570" cellpadding="0" cellspacing="0">
        <tr><td class="masthead">
          <p class="masthead-title">AGILIX POS</p>
          <p class="masthead-subtitle">Point of Sale & ERP Operational System</p>
        </td></tr>
        <tr><td class="content-cell">
          <h1>Halo, {{name}}! 👋</h1>
          <p>Anda telah diundang untuk bergabung dengan tim <strong>{{businessName}}</strong> pada sistem operasional Agilix POS.</p>
          <hr class="divider" />
          <h2>Detail Akun Staff</h2>
          <table class="info-table" cellpadding="0" cellspacing="0">
            <tr><td class="label">Nama Lengkap</td><td>{{name}}</td></tr>
            <tr><td class="label">Alamat Email</td><td>{{email}}</td></tr>
            <tr><td class="label">Bisnis / Brand</td><td>{{businessName}}</td></tr>
            <tr><td class="label">Penugasan Outlet</td><td>{{outletName}}</td></tr>
            <tr><td class="label">Role / Jabatan</td><td><span class="badge">{{roleName}}</span></td></tr>
            <tr><td class="label">Tingkat Akses</td><td>{{accessLevel}}</td></tr>
          </table>
          <hr class="divider" />
          <p>Untuk mengaktifkan akun dan mulai menggunakan sistem POS, silakan klik tombol di bawah ini untuk membuat password akun Anda:</p>
          <div class="btn-container">
            <a href="{{invitationUrl}}" class="btn-primary" target="_blank">Atur Password & Aktifkan Akun</a>
          </div>
          <p style="font-size:12px; color:#888888; text-align:center;">Link undangan ini berlaku selama <strong>{{expiryHours}} jam</strong>. Jika tombol di atas tidak dapat diklik, salin dan buka tautan berikut di browser Anda:<br /><a href="{{invitationUrl}}" style="word-break:break-all; font-size:11px;">{{invitationUrl}}</a></p>
          <hr class="divider" />
          <p>Jika Anda tidak merasa didaftarkan oleh manajemen {{businessName}}, silakan abaikan email ini.</p>
          <p>Salam hangat,<br /><strong>Tim Agilix POS</strong></p>
        </td></tr>
        <tr><td class="footer-bar"></td></tr>
      </table>
      <table class="email-footer" width="570" cellpadding="0" cellspacing="0">
        <tr><td>
          <p>Email ini dikirim secara otomatis oleh sistem Agilix POS. Mohon tidak membalas email ini.</p>
          <p>© 2026 Agilix POS. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    await queryRunner.query(
      `INSERT INTO "email_templates" ("slug", "subject", "template")
       VALUES ($1, $2, $3)
       ON CONFLICT ("slug") DO UPDATE SET "subject" = EXCLUDED."subject", "template" = EXCLUDED."template", "updated_at" = now()`,
      [
        'user-invitation',
        'Undangan Bergabung ke Agilix POS - {{businessName}}',
        userInvitationTemplate,
      ],
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "user_invitations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "email_templates"`);
  }
}
