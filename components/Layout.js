export default function Layout({ children }) {
  return (
    <div>
      <nav className="nav">
        <div className="inner container">
<a href="/" style={{ fontWeight: 800 }}>SportMaster</a>
          <div className="links">
            <a href="/analytics">Analytics</a>
            <a href="/users">Users</a>
            <a href="/admin">Admin</a>
            <a href="/manual">Manual Sends</a>
          </div>
        </div>
      </nav>
      <div className="container" style={{ paddingTop: 20 }}>{children}</div>
    </div>
  );
}

