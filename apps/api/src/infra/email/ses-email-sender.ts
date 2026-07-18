import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import type { EmailMessage, EmailSender } from '../../app/ports/email-sender.js';

/**
 * Production transport. Sends via SESv2 using the EC2 instance role — no static
 * credentials (docs/06; the IAM grant already exists in modules/compute). The
 * SDK's default provider chain picks up the instance role automatically.
 */
export class SesEmailSender implements EmailSender {
  private readonly client: SESv2Client;

  constructor(
    private readonly from: string,
    region: string,
  ) {
    this.client = new SESv2Client({ region });
  }

  async send(message: EmailMessage): Promise<void> {
    await this.client.send(
      new SendEmailCommand({
        FromEmailAddress: this.from,
        Destination: { ToAddresses: [message.to] },
        Content: {
          Simple: {
            Subject: { Data: message.subject },
            Body: {
              Text: { Data: message.text },
              Html: { Data: message.html },
            },
          },
        },
      }),
    );
  }
}
