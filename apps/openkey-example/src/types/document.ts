export interface DocumentEnvelope {
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  encrypted?: boolean;
}

export function createDocument(title: string, encrypted?: boolean): DocumentEnvelope {
  const now = new Date().toISOString();
  return {
    title,
    content: '',
    createdAt: now,
    updatedAt: now,
    ...(encrypted ? { encrypted: true } : {}),
  };
}

export function updateDocument(doc: DocumentEnvelope, content: string): DocumentEnvelope {
  return {
    ...doc,
    content,
    updatedAt: new Date().toISOString(),
  };
}

export function titleToKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    || 'untitled';
}
