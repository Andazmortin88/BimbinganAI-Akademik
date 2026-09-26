type AdminWhatsAppNotification = {
  title: string;
  body: string;
};

function buildPayload(to: string, title: string, body: string) {
  const templateName = process.env.WHATSAPP_TEMPLATE_NAME?.trim();
  if (templateName) {
    return {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "template",
      template: {
        name: templateName,
        language: { code: process.env.WHATSAPP_TEMPLATE_LANGUAGE?.trim() || "id" },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: title.slice(0, 900) },
              { type: "text", text: body.slice(0, 900) },
            ],
          },
        ],
      },
    };
  }

  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "text",
    text: {
      preview_url: false,
      body: `BimbinganAI Akademik\n\n${title}\n${body}`.slice(0, 3900),
    },
  };
}

export async function sendAdminWhatsAppNotification({ title, body }: AdminWhatsAppNotification) {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  const adminTo = process.env.WHATSAPP_ADMIN_TO?.replace(/\D/g, "");
  if (!accessToken || !phoneNumberId || !adminTo) return;

  const apiVersion = process.env.WHATSAPP_GRAPH_API_VERSION?.trim() || "v24.0";
  try {
    const response = await fetch(
      `https://graph.facebook.com/${encodeURIComponent(apiVersion)}/${encodeURIComponent(phoneNumberId)}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildPayload(adminTo, title, body)),
        signal: AbortSignal.timeout(5_000),
        cache: "no-store",
      },
    );

    if (!response.ok) {
      const detail = (await response.text().catch(() => "")).slice(0, 600);
      console.error("whatsapp_notification_failed", { status: response.status, detail });
    }
  } catch (error) {
    console.error("whatsapp_notification_error", error);
  }
}
