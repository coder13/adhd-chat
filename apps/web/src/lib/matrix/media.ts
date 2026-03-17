import { MsgType, type MatrixClient } from 'matrix-js-sdk';

export type MatrixMediaPayload = {
  body: string;
  filename?: string;
  info?: {
    mimetype?: string;
    size?: number;
    w?: number;
    h?: number;
  };
  msgtype: MsgType;
  url: string;
};

async function getImageDimensions(file: File) {
  return await new Promise<{ w: number; h: number }>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      resolve({ w: image.naturalWidth, h: image.naturalHeight });
      URL.revokeObjectURL(objectUrl);
    };

    image.onerror = () => {
      reject(new Error('Failed to read image dimensions.'));
      URL.revokeObjectURL(objectUrl);
    };

    image.src = objectUrl;
  });
}

function isImageFile(file: File) {
  return file.type.startsWith('image/');
}

export async function buildMatrixMediaPayload(
  client: MatrixClient,
  file: File,
  options?: {
    caption?: string | null;
  }
): Promise<MatrixMediaPayload> {
  const upload = await client.uploadContent(file, {
    type: file.type || undefined,
    includeFilename: true,
  });

  const caption = options?.caption?.trim() || null;
  const messageBody = caption || file.name;

  const baseInfo = {
    mimetype: file.type || undefined,
    size: file.size,
  };

  if (isImageFile(file)) {
    const dimensions = await getImageDimensions(file);

    return {
      body: messageBody,
      ...(caption ? { filename: file.name } : {}),
      msgtype: MsgType.Image,
      url: upload.content_uri,
      info: {
        ...baseInfo,
        ...dimensions,
      },
    };
  }

  return {
    body: messageBody,
    ...(caption ? { filename: file.name } : {}),
    msgtype: MsgType.File,
    url: upload.content_uri,
    info: baseInfo,
  };
}
