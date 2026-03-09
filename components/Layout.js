import { useRouter } from 'next/router';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard' },
  { href: '/analytics', label: 'Analytics' },
  { href: '/channels', label: 'Channels' },
  { href: '/users', label: 'Users' },
  { href: '/admin', label: 'Admin' },
  { href: '/manual', label: 'Manual Sends' },
];

export default function Layout({ children }) {
  const router = useRouter();
  const currentPath = router.pathname;

  return (
    <div>
      <nav className="nav">
        <div className="inner container">
          <a href="/" style={{ fontWeight: 700, fontSize: 15, color: '#e2e8f0', marginRight: 28, letterSpacing: '-.3px' }}>
            SportMaster
          </a>
          <div className="links">
            {NAV_ITEMS.map(item => (
              <a
                key={item.href}
                href={item.href}
                style={currentPath === item.href ? { color: '#e2e8f0', background: 'rgba(59,130,246,.15)' } : undefined}
              >
                {item.label}
              </a>
            ))}
          </div>
        </div>
      </nav>
      <div className="container" style={{ paddingTop: 24, paddingBottom: 40 }}>
        {children}
      </div>
    </div>
  );
}
