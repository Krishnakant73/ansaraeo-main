import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

// ============================================================
// POST /api/contact
//
// Sends the contact form submission to admin@ansaraeo.com via Zoho Mail's
// SMTP server. Requires ZOHO_SMTP_USER + ZOHO_SMTP_PASS in your env vars.
//
// IMPORTANT — Zoho requires an "App Password", not your normal login
// password, if you have two-factor authentication enabled (recommended).
// Generate one at: Zoho Mail > Settings > Security > App Passwords.
//
// Zoho SMTP host is smtp.zoho.com for most accounts, or smtp.zoho.in if
// your Zoho org was created under the India data center — check
// Zoho Mail > Settings > Mail Accounts > POP/IMAP to confirm which one
// applies to admin@ansaraeo.com.
// ============================================================

export async function POST(request: NextRequest) {
  try {
    const { name, email, company, message } = await request.json();

    if (!name || !email || !message) {
      return NextResponse.json({ error: "Name, email, and message are required" }, { status: 400 });
    }

    const transporter = nodemailer.createTransport({
      host: process.env.ZOHO_SMTP_HOST || "smtp.zoho.com",
      port: 465,
      secure: true, // true for port 465
      auth: {
        user: process.env.ZOHO_SMTP_USER, // admin@ansaraeo.com
        pass: process.env.ZOHO_SMTP_PASS, // Zoho App Password
      },
    });

    await transporter.sendMail({
      from: `"AnsarAEO Contact Form" <${process.env.ZOHO_SMTP_USER}>`,
      to: "admin@ansaraeo.com",
      replyTo: email, // so hitting "Reply" in your inbox goes straight to the visitor
      subject: `New contact form message from ${name}${company ? ` (${company})` : ""}`,
      text: `Name: ${name}\nEmail: ${email}\nCompany: ${company || "—"}\n\nMessage:\n${message}`,
      html: `
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Company:</strong> ${company || "—"}</p>
        <p><strong>Message:</strong></p>
        <p>${message.replace(/\n/g, "<br/>")}</p>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("contact form error:", err);
    return NextResponse.json({ error: "Failed to send message. Please try again." }, { status: 500 });
  }
}
