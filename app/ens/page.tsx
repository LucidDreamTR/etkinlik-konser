import { resolveEnsAddressCached } from '@/lib/ens';

type EnsPageProps = {
  searchParams?: {
    name?: string;
  };
};

export default async function EnsPage({ searchParams }: EnsPageProps) {
  const rawName = typeof searchParams?.name === 'string' ? searchParams.name : undefined;
  const name = (rawName ?? 'konser.eth').trim().toLowerCase();

  let address: string | null = null;
  let error: string | null = null;

  try {
    address = await resolveEnsAddressCached(name);
  } catch (err) {
    error = err instanceof Error ? err.message : 'Unknown error';
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: 640 }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.5rem' }}>ENS Lookup</h1>
      <p style={{ marginBottom: '0.75rem' }}>
        Name: <strong>{name}</strong>
      </p>
      <p style={{ marginBottom: '0.75rem' }}>
        Address: <strong>{address ?? 'not found'}</strong>
      </p>
      {error ? (
        <p style={{ color: 'red', marginTop: '0.5rem' }}>
          Error: <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}
