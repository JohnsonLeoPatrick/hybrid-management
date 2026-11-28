export const MAX_PHOTO_LENGTH = 140000;
export function validateRegistrationPhoto(photo?: string) {
 if (!photo) return 'Upload a clear photo of yourself.';
 if (photo.length > MAX_PHOTO_LENGTH || !/^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]*={0,2}$/.test(photo)) return 'Choose a valid photo and upload it again.';
 return '';
}

export async function prepareRegistrationPhoto(file: File): Promise<string> {
 if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choose a JPG, PNG or WebP photo.');
 if (!file.size || file.size > 10 * 1024 * 1024) throw new Error('Choose a photo smaller than 10 MB.');
 const url = URL.createObjectURL(file);
 try {
  const image = new Image();
  image.src = url;
  await image.decode().catch(() => { throw new Error('This photo could not be opened. Choose another JPG, PNG or WebP photo.'); });
  const scale = Math.min(1, 512 / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Photo processing is unavailable. Please try another browser.');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  for (const quality of [0.8, 0.6, 0.4]) {
   const photo = canvas.toDataURL('image/jpeg', quality);
   if (!validateRegistrationPhoto(photo)) return photo;
  }
  throw new Error('This photo is too large. Choose a smaller photo.');
 } finally { URL.revokeObjectURL(url); }
}
