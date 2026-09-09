import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { EmailTemplate } from './entities/email-template.entity';

export interface UserInvitationMailData {
  to: string;
  name: string;
  email: string;
  businessName: string;
  outletName: string;
  roleName: string;
  accessLevel: string;
  invitationUrl: string;
  expiryHours: number;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter!: Transporter;

  constructor(
    @InjectRepository(EmailTemplate)
    private readonly templateRepo: Repository<EmailTemplate>,
    private readonly config: ConfigService,
  ) {
    this.initTransporter();
  }

  private initTransporter() {
    const host = this.config.get<string>('mail.host') ?? 'smtp.mailtrap.io';
    const port = Number(this.config.get<number>('mail.port') ?? 2525);
    const user = this.config.get<string>('mail.username') ?? '';
    const pass = this.config.get<string>('mail.password') ?? '';
    const secure =
      Boolean(this.config.get<boolean>('mail.secure')) || port === 465;

    const transportOptions: nodemailer.TransportOptions = {
      host,
      port,
      secure,
      auth: user ? { user, pass } : undefined,
      tls: {
        rejectUnauthorized: false,
      },
    } as unknown as nodemailer.TransportOptions;

    this.transporter = nodemailer.createTransport(transportOptions);
  }

  /**
   * Helper to replace {{placeholder}} or {{ placeholder }} in a string
   */
  compile(
    templateStr: string,
    variables: Record<string, string | number>,
  ): string {
    return templateStr.replace(
      /\{\{\s*(\w+)\s*\}\}/g,
      (_match: string, key: string): string => {
        const val = Object.prototype.hasOwnProperty.call(variables, key)
          ? variables[key]
          : undefined;
        return val !== undefined ? String(val) : '';
      },
    );
  }

  /**
   * Convert HTML string to plain text for multipart/alternative email delivery.
   * This prevents spam filter penalties (such as SpamAssassin MIME_HTML_ONLY) and improves deliverability.
   */
  htmlToPlainText(html: string): string {
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(
        /<a\s+(?:[^>]*?\s+)?href=["']([^"']*)["'][^>]*>(.*?)<\/a>/gi,
        '$2 ($1)',
      )
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/tr>/gi, '\n')
      .replace(/<\/h[1-6]>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&copy;/gi, '©')
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      .trim();
  }

  /**
   * Send an email using a database template identified by slug
   */
  async sendBySlug(
    slug: string,
    to: string,
    variables: Record<string, string | number>,
    customSubject?: string,
  ): Promise<boolean> {
    try {
      const templateRecord = await this.templateRepo.findOne({
        where: { slug },
      });

      if (!templateRecord) {
        this.logger.error(
          `Email template with slug "${slug}" not found in database.`,
        );
        return false;
      }

      const subject = this.compile(
        customSubject || templateRecord.subject,
        variables,
      );
      const html = this.compile(templateRecord.template, variables);
      const text = this.htmlToPlainText(html);
      const from = this.config.get<string>('mail.from') ?? 'noreply@agilix.id';

      const info = await this.transporter.sendMail({
        from,
        to,
        subject,
        text,
        html,
        headers: {
          'X-Mailer': 'Agilix POS Mailer',
          'Auto-Submitted': 'auto-generated',
        },
      });

      this.logger.log(
        `Email [${slug}] successfully sent to ${to}. MessageId: ${info?.messageId}`,
      );
      return true;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Failed to send email [${slug}] to ${to}: ${errorMsg}`,
        err instanceof Error ? err.stack : undefined,
      );
      return false;
    }
  }

  /**
   * Send user invitation email
   */
  async sendUserInvitation(data: UserInvitationMailData): Promise<boolean> {
    const variables: Record<string, string | number> = {
      name: data.name,
      email: data.email,
      businessName: data.businessName || 'Agilix POS',
      outletName: data.outletName || 'Semua Outlet',
      roleName: data.roleName || 'Staff',
      accessLevel: data.accessLevel || 'Standard Access',
      invitationUrl: data.invitationUrl,
      expiryHours: data.expiryHours,
    };

    return this.sendBySlug('user-invitation', data.to, variables);
  }
}
