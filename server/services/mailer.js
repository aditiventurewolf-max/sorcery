import nodemailer from 'nodemailer'

function createTransport() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD
    }
  })
}

export async function sendEmail({ to, subject, body }) {
  const transport = createTransport()
  const info = await transport.sendMail({
    from: `"Scaler Sourcing" <${process.env.GMAIL_USER}>`,
    to,
    subject,
    text: body,
    html: body.replace(/\n/g, '<br>')
  })
  return info
}
