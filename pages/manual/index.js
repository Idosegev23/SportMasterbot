import { useState } from 'react';
import Layout from '../../components/Layout';

export default function ManualSends() {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [content, setContent] = useState('');
  const [buttons, setButtons] = useState([{ text: '', url: '' }]);
  const [imageFile, setImageFile] = useState(null);
  const [type, setType] = useState('predictions');
  const [dryRun, setDryRun] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const ensureHttps = (url) => {
    if (!url) return url;
    if (/^https?:\/\//i.test(url)) return url;
    return `https://${url}`;
  };

  const send = async () => {
    setLoading(true); setMsg('');
    try {
      const form = new FormData();
      if (imageFile) form.append('file', imageFile);
      form.append('content', content);
      form.append('buttons', JSON.stringify(buttons.filter(b => b.text && b.url).map(b => ({ text: b.text, url: ensureHttps(b.url) }))));
      form.append('dryRun', String(dryRun));
      form.append('type', type);
      const res = await fetch('/api/manual/upload-and-send', { method: 'POST', body: form });
      const data = await res.json();
      setMsg(data.message || (data.success ? 'Sent successfully!' : 'Failed to send'));
    } catch (e) { setMsg('Error: ' + e.message); }
    setLoading(false);
  };

  const addButton = () => setButtons([...buttons, { text: '', url: '' }]);
  const setBtn = (i, key, val) => setButtons(buttons.map((b, idx) => idx === i ? { ...b, [key]: val } : b));
  const delBtn = (i) => setButtons(buttons.filter((_, idx) => idx !== i));

  const insertFormatting = (format) => {
    const formats = {
      bold: '**text**', italic: '__text__', underline: '++text++', strikethrough: '~~text~~',
      spoiler: '||hidden text||', code: '`code`', pre: '```\ncode block\n```',
      link: '[text](https://example.com)', mention: '@username', emoji: '🎯', quote: '> quoted text',
    };
    setContent(prev => prev + (formats[format] || format));
  };

  return (
    <Layout>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 24 }}>Manual Sends</h1>
        <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: 13 }}>
          Compose and send messages with Telegram formatting.
        </p>
      </div>

      <div className="panel">
        {/* Message Type */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Message Type</label>
          <select value={type} onChange={e => setType(e.target.value)}>
            <option value="predictions">Predictions</option>
            <option value="results">Results</option>
            <option value="promo">Promo</option>
            <option value="live-status">Live Status</option>
            <option value="announcement">Announcement</option>
            <option value="custom">Custom</option>
          </select>
        </div>

        {/* Formatting Toolbar */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <label style={labelStyle}>Content</label>
            <button className="btn-secondary" onClick={() => setShowPreview(!showPreview)} style={{ padding: '4px 10px', fontSize: 12 }}>
              {showPreview ? 'Hide Preview' : 'Live Preview'}
            </button>
          </div>

          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
            {[
              { label: 'B', value: 'bold' }, { label: 'I', value: 'italic' }, { label: 'U', value: 'underline' },
              { label: 'S', value: 'strikethrough' }, { label: '||', value: 'spoiler' }, { label: '</>', value: 'code' },
              { label: '{ }', value: 'pre' }, { label: 'Link', value: 'link' }, { label: '@', value: 'mention' },
              { label: '>', value: 'quote' },
            ].map(btn => (
              <button key={btn.value} onClick={() => insertFormatting(btn.value)} className="btn-secondary"
                style={{ padding: '4px 10px', fontSize: 12, minWidth: 32 }}>
                {btn.label}
              </button>
            ))}
          </div>

          <div style={showPreview ? { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 } : {}}>
            <textarea
              rows={12} value={content} onChange={e => setContent(e.target.value)}
              placeholder="Write your message with Telegram formatting...&#10;&#10;**bold** __italic__ ++underline++ ~~strikethrough~~&#10;||spoiler|| `code` @mention&#10;[links](https://example.com)&#10;```&#10;code blocks&#10;```"
              style={{ fontFamily: 'monospace', resize: 'vertical', minHeight: 200 }}
            />
            {showPreview && content && <TelegramPreview content={content} />}
          </div>
        </div>

        {/* Inline Buttons */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Inline Buttons</label>
          {buttons.map((b, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: 8, marginBottom: 8 }}>
              <input placeholder="Button Text" value={b.text} onChange={e => setBtn(i, 'text', e.target.value)} />
              <input placeholder="https://example.com" value={b.url} onChange={e => setBtn(i, 'url', e.target.value)} />
              <button onClick={() => delBtn(i)} className="btn-secondary" style={{ padding: '6px 10px', borderColor: 'var(--red)', color: 'var(--red)' }}>&times;</button>
            </div>
          ))}
          <button onClick={addButton} className="btn-secondary" style={{ fontSize: 12, borderStyle: 'dashed' }}>+ Add Button</button>
        </div>

        {/* Image */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Image (optional)</label>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input type="file" accept="image/*" onChange={e => setImageFile(e.target.files?.[0] || null)} />
            {imageFile && (
              <button onClick={() => setImageFile(null)} className="btn-secondary" style={{ padding: '4px 10px', fontSize: 12, borderColor: 'var(--red)', color: 'var(--red)' }}>
                Remove
              </button>
            )}
          </div>
        </div>

        {/* Send Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={dryRun} onChange={e => setDryRun(e.target.checked)} />
            Dry Run (Preview Only)
          </label>
          <button
            className="btn-primary" disabled={loading || (!content.trim() && !imageFile)} onClick={send}
            style={{ padding: '10px 24px', fontSize: 15 }}>
            {loading ? 'Sending...' : dryRun ? 'Preview' : 'Send Now'}
          </button>
        </div>

        {msg && (
          <div className="panel" style={{
            marginTop: 16, marginBottom: 0, padding: '12px 16px',
            borderColor: msg.includes('Error') || msg.includes('Failed') ? 'var(--red)' : 'var(--green)',
            background: msg.includes('Error') || msg.includes('Failed') ? 'var(--red-bg)' : 'var(--green-bg)',
          }}>
            {msg}
          </div>
        )}
      </div>
    </Layout>
  );
}

const labelStyle = {
  display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4,
};

function TelegramPreview({ content }) {
  const parseContent = (text) => {
    if (!text) return '';
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/__(.*?)__/g, '<em>$1</em>')
      .replace(/\+\+(.*?)\+\+/g, '<u>$1</u>')
      .replace(/~~(.*?)~~/g, '<s>$1</s>')
      .replace(/\|\|(.*?)\|\|/g, '<span style="background:#333;color:#333;border-radius:3px;padding:0 2px">$1</span>')
      .replace(/`([^`]+)`/g, '<code style="background:#1a1a1a;color:#7ec8e3;padding:2px 4px;border-radius:3px;font-family:monospace;font-size:13px">$1</code>')
      .replace(/```([\s\S]*?)```/g, '<pre style="background:#1a1a1a;padding:8px;border-radius:6px;margin:8px 0;overflow-x:auto"><code>$1</code></pre>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a style="color:#7ec8e3">$1</a>')
      .replace(/@(\w+)/g, '<span style="color:#7ec8e3">@$1</span>')
      .replace(/#(\w+)/g, '<span style="color:#7ec8e3">#$1</span>')
      .replace(/^> (.+)$/gm, '<blockquote style="border-left:3px solid #7ec8e3;padding-left:12px;margin:8px 0;color:rgba(255,255,255,.8);font-style:italic">$1</blockquote>')
      .replace(/\n/g, '<br>');
  };

  return (
    <div style={{ background: '#0e1621', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border)' }}>
      <div style={{ background: '#2b5278', padding: '6px 12px', fontSize: 12, fontWeight: 600, color: '#fff' }}>
        Telegram Preview
      </div>
      <div style={{ padding: 12 }}>
        <div
          style={{ background: '#182533', borderRadius: 12, padding: '12px 16px', color: '#fff', fontSize: 14, lineHeight: 1.4, wordWrap: 'break-word' }}
          dangerouslySetInnerHTML={{ __html: parseContent(content) }}
        />
      </div>
    </div>
  );
}
