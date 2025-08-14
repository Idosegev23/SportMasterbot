import React from 'react';
import Head from 'next/head';
import Layout from '../../components/Layout';

export default function AnalyticsPage() {
  return (
    <>
      <Head>
        <title>Channel Analytics Dashboard</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <Layout>
        <main style={{ padding: '28px', maxWidth: '1200px', margin: '0 auto' }}>
          <header>
            <h1>Channel Analytics</h1>
            <p>Analytics dashboard is temporarily disabled during deployment.</p>
          </header>
          <div style={{ 
            background: 'rgba(255,255,255,.04)', 
            border: '1px solid rgba(255,255,255,.08)', 
            borderRadius: '12px', 
            padding: '24px',
            textAlign: 'center'
          }}>
            <h3>🚧 Under Maintenance</h3>
            <p>The analytics dashboard will be restored after the GitHub deployment is complete.</p>
          </div>
        </main>
      </Layout>
    </>
  );
}