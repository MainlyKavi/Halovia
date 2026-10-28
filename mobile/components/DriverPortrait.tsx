/**
 * Illustrated stand-in for the driver photo a ride app would provide. The mock
 * ride has no photo of a real person, so this draws a neutral portrait.
 */
export function DriverPortrait({ name, photoUrl, size = 64 }: { name: string; photoUrl?: string; size?: number }) {
  // A static Vite build has no next/image optimizer, and provider photos are small remote thumbnails.
  // eslint-disable-next-line @next/next/no-img-element
  if (photoUrl) return <img className="m-driver-photo" src={photoUrl} alt={name} width={size} height={size} />;
  return (
    <svg className="m-driver-photo" width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={name}>
      <rect width="64" height="64" rx="20" fill="#e9dfd6" />
      <path d="M12 64c1.5-12 9.5-18 20-18s18.5 6 20 18z" fill="#3e5c76" />
      <path d="M26 44h12l-2 7h-8z" fill="#b7835d" />
      <circle cx="32" cy="30" r="12" fill="#c58f67" />
      <path d="M20 28c0-8 5.5-12.5 12-12.5S44 20 44 28c-2.5-4-6.5-5.5-12-5.5S22.5 24 20 28z" fill="#2b211c" />
      <path d="M26.5 36.5c3.2 2.3 7.8 2.3 11 0" stroke="#7a4d33" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <path d="M25 47l7 6 7-6" stroke="#f2f2f2" strokeWidth="2" fill="none" />
    </svg>
  );
}
