// The sign-in code email, from design/emails/code-email (word for word; light and dark).
// Subject "{code} is your Manager Test code" so the code shows in the inbox and phones offer it.

export function codeEmail(code: string): { subject: string; html: string; text: string } {
  if (!/^\d{6}$/.test(code)) throw new Error("bad code");
  return {
    subject: `${code} is your Manager Test code`,
    text: `Your sign-in code\n\nType it on the sign-in screen to open your dashboard.\n\nYour code: ${code}\nIt works for 10 minutes.\n\nIf you didn't ask for this, ignore this email. Nobody can sign in without the code, and it stops working on its own.\n\nWe will never ask you for this code by phone, WhatsApp or chat.\n\nThe Beta team`,
    html: `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${code} is your Manager Test code</title>
<style>
  :root { color-scheme: light dark; supported-color-schemes: light dark; }
  @media (max-width:620px) { .px { padding-left:20px !important; padding-right:20px !important; } .h1 { font-size:26px !important; line-height:32px !important; } .code { font-size:40px !important; letter-spacing:8px !important; } }
  @media (prefers-color-scheme: dark) {
    .bg { background-color:#0A1424 !important; }
    .card { background-color:#111E33 !important; }
    .codebox { background-color:#0B1F3A !important; border-color:#2A4466 !important; }
    .code { color:#F5F6F4 !important; }
    .ink { color:#E6EAEE !important; }
    .mute { color:#AEB8C4 !important; }
    .foot { background-color:#0D182B !important; border-color:#22324A !important; }
    .lnk { color:#9FDCBE !important; }
  }
  [data-ogsc] .bg { background-color:#0A1424 !important; }
  [data-ogsc] .card { background-color:#111E33 !important; }
  [data-ogsc] .codebox { background-color:#0B1F3A !important; border-color:#2A4466 !important; }
  [data-ogsc] .code { color:#F5F6F4 !important; }
  [data-ogsc] .ink { color:#E6EAEE !important; }
  [data-ogsc] .mute { color:#AEB8C4 !important; }
  [data-ogsc] .foot { background-color:#0D182B !important; border-color:#22324A !important; }
  [data-ogsc] .lnk { color:#9FDCBE !important; }
</style>
</head>
<body class="bg" style="margin:0;padding:0;background-color:#F3F4F2;">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;color:#F3F4F2;">It works for 10 minutes. If you didn't ask for it, you can ignore this email. ͏ ͏ ͏ ͏</span>
<table role="presentation" class="bg" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F3F4F2;">
<tbody><tr><td align="center" style="padding:24px 12px;">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" class="card" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background-color:#FFFFFF;border-radius:16px;overflow:hidden;">

  <tbody><tr><td class="px" bgcolor="#0B1F3A" style="background-color:#0B1F3A;padding:28px 40px 32px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tbody><tr>
      <td style="font-family:Arial,Helvetica,sans-serif;font-size:22px;line-height:24px;font-weight:bold;color:#F5F6F4;letter-spacing:-0.5px;mso-line-height-rule:exactly;">beta</td>
      <td align="right" style="font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:14px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:#C3CBD5;">The Manager Test</td>
    </tr></tbody></table>
    <p class="h1" style="margin:28px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:30px;line-height:36px;font-weight:bold;color:#F5F6F4;mso-line-height-rule:exactly;">Your sign-in code</p>
    <p style="margin:10px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:24px;color:#C3CBD5;">Type it on the sign-in screen to open your dashboard.</p>
  </td></tr>

  <tr><td class="px" style="padding:32px 40px 0;">
    <table role="presentation" class="codebox" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#FAFAF8" style="background-color:#FAFAF8;border:1px solid #DDE2E7;border-radius:12px;">
      <tbody><tr><td align="center" style="padding:28px 16px 24px;font-family:Arial,Helvetica,sans-serif;">
        <p class="mute" style="margin:0;font-size:12px;line-height:16px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:#6B7684;">Your code</p>
        <p class="code" style="margin:12px 0 0;font-family:'Courier New',Courier,monospace;font-size:48px;line-height:56px;font-weight:bold;letter-spacing:12px;color:#0B1F3A;mso-line-height-rule:exactly;-webkit-user-select:all;user-select:all;">${code}</p>
        <p class="ink" style="margin:12px 0 0;font-size:15px;line-height:22px;color:#1C2430;">It works for 10 minutes.</p>
      </td></tr>
    </tbody></table>
  </td></tr>

  <tr><td class="px" style="padding:24px 40px 32px;font-family:Arial,Helvetica,sans-serif;">
    <p class="ink" style="margin:0;font-size:15px;line-height:23px;color:#1C2430;">If you didn't ask for this, ignore this email. Nobody can sign in without the code, and it stops working on its own.</p>
    <p class="mute" style="margin:14px 0 0;font-size:14px;line-height:21px;color:#4C5A6E;">We will never ask you for this code by phone, WhatsApp or chat.</p>
    <p class="ink" style="margin:18px 0 0;font-size:15px;line-height:23px;color:#1C2430;">The Beta team</p>
  </td></tr>

  <tr><td class="px foot" bgcolor="#FAFAF8" style="background-color:#FAFAF8;padding:24px 40px;border-top:1px solid #DDE2E7;font-family:Arial,Helvetica,sans-serif;">
    <p class="mute" style="margin:0;font-size:12px;line-height:18px;color:#4C5A6E;">The Manager Test by Beta · [Company postal address]<br>You're receiving this because someone asked to sign in with this email at managertest.betaapp.me. <a class="lnk" href="https://betaapp.me/privacy" style="color:#0E6B4F;text-decoration:underline;">Privacy policy</a></p>
  </td></tr>
</tbody></table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</tbody></table>


</body></html>`,
  };
}
