interface ReceiptMessageLike {
  id: string;
  isOwn: boolean;
  deliveryStatus?: 'sent' | 'sending' | 'failed';
  readByNames?: string[] | null;
}

export function findLatestOwnReadReceipt(
  messages: ReceiptMessageLike[]
): { messageId: string; readerNames: string[] } | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message.isOwn || message.deliveryStatus === 'failed') {
      continue;
    }

    const readerNames = message.readByNames ?? [];
    if (readerNames.length > 0) {
      return {
        messageId: message.id,
        readerNames,
      };
    }
  }

  return null;
}
