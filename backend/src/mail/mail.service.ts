import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class MailService {
  constructor(private readonly mailerService: MailerService) {}

  async sendVerificationCode(to: string, code: string) {
    await this.mailerService.sendMail({
      to,
      subject: 'Confirme seu email',
      text: `Seu código de verificação é ${code}. Ele expira em 10 minutos.`,
      html: `
        <div style="font-family: sans-serif; line-height: 1.5;">
          <p>Seu código de verificação é:</p>
          <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px;">${code}</p>
          <p>Ele expira em 10 minutos.</p>
        </div>
      `,
    });
  }
}
