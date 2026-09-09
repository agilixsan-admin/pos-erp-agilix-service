import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { EmailTemplate } from './entities/email-template.entity';
import { MailService } from './mail.service';

@Module({
  imports: [TypeOrmModule.forFeature([EmailTemplate]), ConfigModule],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
