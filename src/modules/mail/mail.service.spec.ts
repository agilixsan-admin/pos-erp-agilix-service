import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';
import { EmailTemplate } from './entities/email-template.entity';
import { Repository } from 'typeorm';

describe('MailService', () => {
  let service: MailService;
  let mockTemplateRepo: Partial<Repository<EmailTemplate>>;
  let mockConfigService: Partial<ConfigService>;
  let sendMailMock: jest.Mock;

  beforeEach(() => {
    sendMailMock = jest.fn().mockResolvedValue({ messageId: 'msg-123' });

    mockTemplateRepo = {
      findOne: jest.fn(),
    };

    mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'mail.host') return 'smtp.mailtrap.io';
        if (key === 'mail.port') return 2525;
        if (key === 'mail.username') return 'testuser';
        if (key === 'mail.password') return 'testpass';
        if (key === 'mail.from') return 'noreply@agilix.id';
        if (key === 'mail.secure') return false;
        return null;
      }),
    };

    service = new MailService(
      mockTemplateRepo as Repository<EmailTemplate>,
      mockConfigService as ConfigService,
    );

    // Replace transporter with mocked sendMail
    (service as any).transporter = {
      sendMail: sendMailMock,
    };
  });

  describe('compile', () => {
    it('replaces all placeholders with variable values', () => {
      const template = 'Hello {{ name }}, welcome to {{ businessName }}!';
      const result = service.compile(template, {
        name: 'Ahmad',
        businessName: 'Coffee Shop',
      });
      expect(result).toBe('Hello Ahmad, welcome to Coffee Shop!');
    });

    it('handles missing variables by replacing with empty string', () => {
      const template = 'Hello {{ name }}, role is {{ role }}';
      const result = service.compile(template, { name: 'Ahmad' });
      expect(result).toBe('Hello Ahmad, role is ');
    });
  });

  describe('htmlToPlainText', () => {
    it('converts html tags, links, and line breaks into clean readable plain text', () => {
      const html = `
        <style>body { color: red; }</style>
        <h1>Welcome to Agilix</h1>
        <p>Hello <strong>Ahmad</strong>,</p>
        <p>Click <a href="https://app.agilix.id/invitation">here</a> to join.</p>
        <br/>
        <footer>&copy; 2026 Agilix POS</footer>
      `;
      const plainText = service.htmlToPlainText(html);
      expect(plainText).toContain('Welcome to Agilix');
      expect(plainText).toContain('Hello Ahmad,');
      expect(plainText).toContain('here (https://app.agilix.id/invitation)');
      expect(plainText).toContain('© 2026 Agilix POS');
      expect(plainText).not.toContain('<style>');
      expect(plainText).not.toContain('<h1>');
    });
  });

  describe('sendBySlug', () => {
    it('fetches template from DB, compiles, and sends email successfully', async () => {
      (mockTemplateRepo.findOne as jest.Mock).mockResolvedValue({
        id: 'tpl-1',
        slug: 'user-invitation',
        subject: 'Undangan Bergabung ke {{businessName}}',
        template:
          '<h1>Halo {{name}}</h1><a href="{{invitationUrl}}">Set Password</a>',
      });

      const result = await service.sendBySlug(
        'user-invitation',
        'staff@test.com',
        {
          name: 'Budi',
          businessName: 'Cafe Agilix',
          invitationUrl: 'http://localhost:3000/auth/set-password?token=abc',
        },
      );

      expect(result).toBe(true);
      expect(mockTemplateRepo.findOne).toHaveBeenCalledWith({
        where: { slug: 'user-invitation' },
      });
      expect(sendMailMock).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'noreply@agilix.id',
          to: 'staff@test.com',
          subject: 'Undangan Bergabung ke Cafe Agilix',
          html: '<h1>Halo Budi</h1><a href="http://localhost:3000/auth/set-password?token=abc">Set Password</a>',
          text: expect.stringContaining('Set Password'),
          headers: {
            'X-Mailer': 'Agilix POS Mailer',
            'Auto-Submitted': 'auto-generated',
          },
        }),
      );
    });

    it('returns false when template is not found in database', async () => {
      (mockTemplateRepo.findOne as jest.Mock).mockResolvedValue(null);

      const result = await service.sendBySlug(
        'unknown-slug',
        'staff@test.com',
        {},
      );
      expect(result).toBe(false);
      expect(sendMailMock).not.toHaveBeenCalled();
    });

    it('handles sendMail rejection gracefully', async () => {
      (mockTemplateRepo.findOne as jest.Mock).mockResolvedValue({
        id: 'tpl-1',
        slug: 'user-invitation',
        subject: 'Test Subject',
        template: '<p>Test</p>',
      });
      sendMailMock.mockRejectedValue(new Error('SMTP connection error'));

      const result = await service.sendBySlug(
        'user-invitation',
        'staff@test.com',
        {},
      );
      expect(result).toBe(false);
    });
  });

  describe('sendUserInvitation', () => {
    it('formats invitation variables and delegates to sendBySlug', async () => {
      jest.spyOn(service, 'sendBySlug').mockResolvedValue(true);

      const result = await service.sendUserInvitation({
        to: 'staff@test.com',
        name: 'Siti Rahayu',
        email: 'staff@test.com',
        businessName: 'Bakery Co',
        outletName: 'Outlet Pusat',
        roleName: 'CASHIER',
        accessLevel: 'Standard Privileges',
        invitationUrl: 'http://localhost:3000/auth/set-password?token=123',
        expiryHours: 24,
      });

      expect(result).toBe(true);
      expect(service.sendBySlug).toHaveBeenCalledWith(
        'user-invitation',
        'staff@test.com',
        expect.objectContaining({
          name: 'Siti Rahayu',
          email: 'staff@test.com',
          businessName: 'Bakery Co',
          outletName: 'Outlet Pusat',
          roleName: 'CASHIER',
          accessLevel: 'Standard Privileges',
          invitationUrl: 'http://localhost:3000/auth/set-password?token=123',
          expiryHours: 24,
        }),
      );
    });
  });
});
