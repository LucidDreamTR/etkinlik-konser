import { resolveRecipient } from '@/lib/address';

type ResolvePageProps = {
  searchParams?: {
    value?: string;
  };
};

export default async function ResolvePage({ searchParams }: ResolvePageProps) {
  const input = typeof searchParams?.value === 'string' ? searchParams.value : 'konser.eth';

  let address: string | null = null;
  let error: string | null = null;

  try {
    address = await resolveRecipient(input);
  } catch (err) {
    error = err instanceof Error ? err.message : 'Unknown error';
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: 640 }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.5rem' }}>Resolve</h1>
      <p style={{ marginBottom: '0.75rem' }}>
        Value: <strong>{input}</strong>
      </p>
      <p style={{ marginBottom: '0.75rem' }}>
        Address:{' '}
        <strong>
          {address ?? 'not found'}
        </strong>
      </p>
      {error ? (
        <p style={{ color: 'red', marginTop: '0.5rem' }}>
          Error: <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}
