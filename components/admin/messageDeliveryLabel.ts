'use client';

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export function getMessageDeliveryLabel(data: Record<string, unknown>) {
  const deliveryMode = cleanText(data.deliveryMode);
  if (deliveryMode === 'both') return 'Brief und Mail';
  if (deliveryMode === 'letter') return 'Brief';
  if (deliveryMode === 'email') return 'Mail';

  const channel = cleanText(data.channel);
  if (channel === 'letter') return 'Brief';
  if (channel === 'email') return 'Mail';

  return '';
}

export function appendDeliveryLabel(title: string, data: Record<string, unknown>) {
  const label = getMessageDeliveryLabel(data);
  return label ? `${title} (${label})` : title;
}
