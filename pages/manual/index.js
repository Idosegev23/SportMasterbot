import { useState } from 'react';
import Layout from '../../components/Layout';
import Head from 'next/head';

export default function ManualSends() {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [content, setContent] = useState('');
  const [buttons, setButtons] = useState([{ text: '', url: '' }]);
  const [imageFile, setImageFile] = useState(null);
  const [type, setType] = useState('predictions');
  const [dryRun, setDryRun] = useState(false);
  const [showFormatting, setShowFormatting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const ensureHttps = (url) => {
    if (!url) return url;
    if (/^https?:\/\//i.test(url)) return url;
    return `https://${url}`;
  };

  const send = async () => {
    setLoading(true); setMsg('');
    try {
      // Always use upload-and-send endpoint for direct sending (with or without image)
      const form = new FormData();
      if (imageFile) form.append('file', imageFile);
      form.append('content', content);
      form.append('buttons', JSON.stringify(
        buttons
          .filter(b=>b.text && b.url)
          .map(b=>({ text: b.text, url: ensureHttps(b.url) }))
      ));
      form.append('dryRun', String(dryRun));
      form.append('type', type); // Include type for logging/tracking
      
      const res = await fetch('/api/manual/upload-and-send', { method: 'POST', body: form });
      const data = await res.json();
      setMsg(data.message || (data.success ? 'Sent successfully!' : 'Failed to send'));
    } catch (e) { setMsg('Error: ' + e.message); }
    setLoading(false);
  };

  const addButton = () => setButtons([...buttons, { text: '', url: '' }]);
  const setBtn = (i, key, val) => setButtons(buttons.map((b,idx)=> idx===i? { ...b, [key]: val } : b));
  const delBtn = (i) => setButtons(buttons.filter((_,idx)=> idx!==i));

  const insertFormatting = (format) => {
    const formats = {
      bold: '**text**',
      italic: '__text__',
      underline: '++text++',
      strikethrough: '~~text~~',
      spoiler: '||hidden text||',
      code: '`code`',
      pre: '```\ncode block\n```',
      link: '[text](https://example.com)',
      mention: '@username',
      emoji: '🎯',
      quote: '> quoted text'
    };
    
    const insertion = formats[format] || format;
    setContent(prev => prev + insertion);
  };

  return (
    <>
      <Head>
        <title>Manual Sends - Advanced Telegram Formatting</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Layout>
        <main className="manual-page">
          <header className="page-header">
            <h1>✍️ Manual Sends</h1>
            <p className="page-description">
              Compose and send manual messages with advanced Telegram formatting and styling options.
            </p>
          </header>

          <div className="manual-container">
            <section className="compose-section">
              <div className="form-group">
                <label>Message Type:</label>
                <select value={type} onChange={e=>setType(e.target.value)} className="type-select">
                  <option value="predictions">🔮 Predictions</option>
                  <option value="results">📊 Results</option>
                  <option value="promo">🎁 Promo</option>
                  <option value="live-status">⚡ Live Status</option>
                  <option value="announcement">📢 Announcement</option>
                  <option value="custom">✨ Custom</option>
                </select>
              </div>

              <div className="form-group">
                <div className="content-header">
                  <label>Content:</label>
                  <div className="content-tools">
                    <button 
                      type="button" 
                      onClick={() => setShowFormatting(!showFormatting)} 
                      className={`tool-btn ${showFormatting ? 'active' : ''}`}
                    >
                      {showFormatting ? '📝 Hide Tools' : '🎨 Formatting Tools'}
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setShowPreview(!showPreview)} 
                      className={`tool-btn ${showPreview ? 'active' : ''}`}
                    >
                      {showPreview ? '👁️ Hide Preview' : '👀 Live Preview'}
                    </button>
                  </div>
                </div>
                
                {showFormatting && <TelegramFormattingToolbar onInsert={insertFormatting} />}
                
                <div className={`content-container ${showPreview ? 'with-preview' : ''}`}>
                  <textarea 
                    rows="12" 
                    value={content} 
                    onChange={e => setContent(e.target.value)} 
                    placeholder="✨ Write your message with Telegram formatting...&#10;&#10;🎨 Use formatting tools above or type manually:&#10;**bold** __italic__ ++underline++ ~~strikethrough~~&#10;||spoiler|| `code` @mention #hashtag&#10;&#10;[links](https://example.com)&#10;```&#10;code blocks&#10;```"
                    className="content-textarea"
                  />
                  {showPreview && content && <TelegramPreview content={content} />}
                </div>
              </div>

              <div className="form-group">
                <label>Inline Buttons:</label>
                <div className="buttons-container">
                  {buttons.map((b,i)=> (
                    <div key={i} className="button-row">
                      <input 
                        placeholder="Button Text" 
                        value={b.text} 
                        onChange={e=>setBtn(i,'text',e.target.value)}
                        className="button-input"
                      />
                      <input 
                        placeholder="https://example.com" 
                        value={b.url} 
                        onChange={e=>setBtn(i,'url',e.target.value)}
                        className="button-input"
                      />
                      <button onClick={()=>delBtn(i)} className="delete-btn">🗑️</button>
                    </div>
                  ))}
                  <button onClick={addButton} className="add-button">➕ Add Button</button>
                </div>
              </div>

              <div className="form-group">
                <label>Image (optional):</label>
                <div className="file-upload">
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={e=>setImageFile(e.target.files?.[0]||null)}
                    className="file-input"
                    id="image-upload"
                  />
                  <label htmlFor="image-upload" className="file-label">
                    {imageFile ? `📷 ${imageFile.name}` : '📁 Choose Image'}
                  </label>
                  {imageFile && (
                    <button onClick={() => setImageFile(null)} className="clear-file">❌ Remove</button>
                  )}
                </div>
              </div>

              <div className="send-controls">
                <label className="dry-run-toggle">
                  <input 
                    type="checkbox" 
                    checked={dryRun} 
                    onChange={e=>setDryRun(e.target.checked)}
                  /> 
                  <span className="checkmark"></span>
                  🧪 Dry Run (Preview Only)
                </label>
                
                <button 
                  disabled={loading || (!content.trim() && !imageFile)} 
                  onClick={send}
                  className={`send-button ${dryRun ? 'dry-run' : 'live'}`}
                >
                  {loading ? '⏳ Sending...' : dryRun ? '🔍 Preview' : '🚀 Send Now'}
                </button>
              </div>

              {msg && (
                <div className={`message-result ${msg.includes('✅') ? 'success' : msg.includes('❌') ? 'error' : 'info'}`}>
                  {msg}
                </div>
              )}
            </section>
          </div>
        </main>
      </Layout>

      <style jsx>{`
        .manual-page {
          max-width: 1000px;
          margin: 0 auto;
          padding: 20px;
        }

        .page-header {
          text-align: center;
          margin-bottom: 32px;
        }

        .page-header h1 {
          font-size: 32px;
          color: #e7ecf2;
          margin-bottom: 8px;
        }

        .page-description {
          color: rgba(231, 236, 242, 0.8);
          font-size: 16px;
        }

        .manual-container {
          background: #203140;
          border-radius: 16px;
          padding: 32px;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .form-group {
          margin-bottom: 24px;
        }

        .form-group label {
          display: block;
          margin-bottom: 8px;
          font-weight: 600;
          color: #e7ecf2;
          font-size: 14px;
        }

        .type-select, .content-textarea, .button-input {
          background: rgba(255, 255, 255, 0.06);
          color: #e7ecf2;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 12px;
          width: 100%;
          font-size: 14px;
          transition: border-color 0.2s ease;
        }

        .type-select:focus, .content-textarea:focus, .button-input:focus {
          outline: none;
          border-color: #2CBF6C;
        }

        .content-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .content-tools {
          display: flex;
          gap: 8px;
        }

        .tool-btn {
          background: rgba(255, 255, 255, 0.08);
          color: #e7ecf2;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          padding: 6px 12px;
          cursor: pointer;
          font-size: 12px;
          transition: all 0.2s ease;
        }

        .tool-btn:hover, .tool-btn.active {
          background: linear-gradient(135deg, #2CBF6C, #A7F25C);
          color: #0b0f1a;
          border-color: transparent;
        }

        .content-container {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
        }

        .content-container.with-preview {
          grid-template-columns: 1fr 1fr;
        }

        .content-textarea {
          min-height: 200px;
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
          line-height: 1.5;
          resize: vertical;
        }

        .buttons-container {
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 16px;
          background: rgba(255, 255, 255, 0.02);
        }

        .button-row {
          display: grid;
          grid-template-columns: 1fr 2fr auto;
          gap: 8px;
          margin-bottom: 8px;
          align-items: center;
        }

        .delete-btn {
          background: rgba(242, 12, 12, 0.1);
          color: #F20C0C;
          border: 1px solid rgba(242, 12, 12, 0.3);
          border-radius: 6px;
          padding: 8px;
          cursor: pointer;
          width: 40px;
          height: 40px;
        }

        .add-button {
          background: rgba(47, 191, 108, 0.1);
          color: #2CBF6C;
          border: 1px solid rgba(47, 191, 108, 0.3);
          border-radius: 6px;
          padding: 8px 16px;
          cursor: pointer;
          font-size: 14px;
        }

        .file-upload {
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .file-input {
          display: none;
        }

        .file-label {
          background: rgba(255, 255, 255, 0.06);
          color: #e7ecf2;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 12px 20px;
          cursor: pointer;
          transition: background-color 0.2s ease;
        }

        .file-label:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        .clear-file {
          background: rgba(242, 12, 12, 0.1);
          color: #F20C0C;
          border: 1px solid rgba(242, 12, 12, 0.3);
          border-radius: 6px;
          padding: 6px 12px;
          cursor: pointer;
          font-size: 12px;
        }

        .send-controls {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 0;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        .dry-run-toggle {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          color: #e7ecf2;
        }

        .dry-run-toggle input[type="checkbox"] {
          width: 18px;
          height: 18px;
        }

        .send-button {
          background: linear-gradient(135deg, #2CBF6C, #A7F25C);
          color: #0b0f1a;
          border: none;
          border-radius: 8px;
          padding: 12px 24px;
          font-weight: 600;
          cursor: pointer;
          font-size: 16px;
          transition: transform 0.2s ease;
        }

        .send-button:hover:not(:disabled) {
          transform: translateY(-1px);
        }

        .send-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }

        .send-button.dry-run {
          background: linear-gradient(135deg, #3E5159, #203140);
          color: #e7ecf2;
        }

        .message-result {
          padding: 16px;
          border-radius: 8px;
          margin-top: 16px;
          font-weight: 500;
        }

        .message-result.success {
          background: rgba(47, 191, 108, 0.1);
          border: 1px solid rgba(47, 191, 108, 0.3);
          color: #2CBF6C;
        }

        .message-result.error {
          background: rgba(242, 12, 12, 0.1);
          border: 1px solid rgba(242, 12, 12, 0.3);
          color: #F20C0C;
        }

        .message-result.info {
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #e7ecf2;
        }

        @media (max-width: 768px) {
          .content-container.with-preview {
            grid-template-columns: 1fr;
          }
          
          .content-tools {
            flex-direction: column;
            gap: 4px;
          }
          
          .send-controls {
            flex-direction: column;
            gap: 16px;
          }
          
          .button-row {
            grid-template-columns: 1fr;
            gap: 8px;
          }
        }
      `}</style>
    </>
  );
}

// Telegram Formatting Toolbar Component
function TelegramFormattingToolbar({ onInsert }) {
  const formatButtons = [
    { label: '**Bold**', value: 'bold', icon: '𝗕' },
    { label: '__Italic__', value: 'italic', icon: '𝐼' },
    { label: '++Underline++', value: 'underline', icon: 'U̲' },
    { label: '~~Strike~~', value: 'strikethrough', icon: 'S̶' },
    { label: '||Spoiler||', value: 'spoiler', icon: '⚫' },
    { label: '`Code`', value: 'code', icon: '</>' },
    { label: '```Block```', value: 'pre', icon: '{ }' },
    { label: '[Link](url)', value: 'link', icon: '🔗' },
    { label: '@Mention', value: 'mention', icon: '@' },
    { label: 'Emoji', value: 'emoji', icon: '😀' },
    { label: '> Quote', value: 'quote', icon: '❝' }
  ];

  return (
    <div className="formatting-toolbar">
      <div className="toolbar-section">
        <span className="section-title">✨ Text Formatting:</span>
        <div className="toolbar-buttons">
          {formatButtons.slice(0, 5).map(btn => (
            <button
              key={btn.value}
              onClick={() => onInsert(btn.value)}
              className="format-btn"
              title={btn.label}
            >
              {btn.icon}
            </button>
          ))}
        </div>
      </div>
      
      <div className="toolbar-section">
        <span className="section-title">🔧 Special:</span>
        <div className="toolbar-buttons">
          {formatButtons.slice(5).map(btn => (
            <button
              key={btn.value}
              onClick={() => onInsert(btn.value)}
              className="format-btn"
              title={btn.label}
            >
              {btn.icon}
            </button>
          ))}
        </div>
      </div>

      <style jsx>{`
        .formatting-toolbar {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 12px;
        }

        .toolbar-section {
          margin-bottom: 12px;
        }

        .toolbar-section:last-child {
          margin-bottom: 0;
        }

        .section-title {
          display: block;
          font-size: 12px;
          font-weight: 600;
          color: rgba(231, 236, 242, 0.8);
          margin-bottom: 8px;
        }

        .toolbar-buttons {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }

        .format-btn {
          background: rgba(255, 255, 255, 0.08);
          color: #e7ecf2;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          padding: 6px 10px;
          cursor: pointer;
          font-size: 12px;
          transition: all 0.2s ease;
          min-width: 32px;
        }

        .format-btn:hover {
          background: rgba(167, 242, 92, 0.2);
          border-color: #A7F25C;
          color: #A7F25C;
        }
      `}</style>
    </div>
  );
}

// Telegram Preview Component
function TelegramPreview({ content }) {
  const parseContent = (text) => {
    if (!text) return '';
    
    return text
      // Bold
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // Italic
      .replace(/__(.*?)__/g, '<em>$1</em>')
      // Underline
      .replace(/\+\+(.*?)\+\+/g, '<u>$1</u>')
      // Strikethrough
      .replace(/~~(.*?)~~/g, '<s>$1</s>')
      // Spoiler
      .replace(/\|\|(.*?)\|\|/g, '<span class="spoiler">$1</span>')
      // Code
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      // Code blocks
      .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
      // Links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
      // Mentions
      .replace(/@(\w+)/g, '<span class="mention">@$1</span>')
      // Hashtags
      .replace(/#(\w+)/g, '<span class="hashtag">#$1</span>')
      // Quotes
      .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
      // Line breaks
      .replace(/\n/g, '<br>');
  };

  return (
    <div className="telegram-preview">
      <div className="preview-header">
        <span className="preview-title">📱 Telegram Preview</span>
      </div>
      <div className="preview-content">
        <div 
          className="message-bubble"
          dangerouslySetInnerHTML={{ __html: parseContent(content) }}
        />
      </div>

      <style jsx>{`
        .telegram-preview {
          background: #17212b;
          border-radius: 8px;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .preview-header {
          background: #2b5278;
          padding: 8px 12px;
          color: #ffffff;
          font-size: 12px;
          font-weight: 600;
        }

        .preview-content {
          padding: 16px;
          background: #0e1621;
        }

        .message-bubble {
          background: #182533;
          border-radius: 12px;
          padding: 12px 16px;
          color: #ffffff;
          font-size: 14px;
          line-height: 1.4;
          word-wrap: break-word;
        }

        :global(.message-bubble strong) {
          font-weight: bold;
        }

        :global(.message-bubble em) {
          font-style: italic;
        }

        :global(.message-bubble u) {
          text-decoration: underline;
        }

        :global(.message-bubble s) {
          text-decoration: line-through;
        }

        :global(.message-bubble .spoiler) {
          background: #333;
          color: #333;
          border-radius: 3px;
          padding: 0 2px;
        }

        :global(.message-bubble .spoiler:hover) {
          background: #555;
          color: #fff;
        }

        :global(.message-bubble code) {
          background: #1a1a1a;
          color: #7ec8e3;
          padding: 2px 4px;
          border-radius: 3px;
          font-family: monospace;
          font-size: 13px;
        }

        :global(.message-bubble pre) {
          background: #1a1a1a;
          padding: 8px;
          border-radius: 6px;
          margin: 8px 0;
          overflow-x: auto;
        }

        :global(.message-bubble pre code) {
          background: none;
          padding: 0;
        }

        :global(.message-bubble a) {
          color: #7ec8e3;
          text-decoration: none;
        }

        :global(.message-bubble .mention) {
          color: #7ec8e3;
          background: rgba(126, 200, 227, 0.1);
          padding: 1px 3px;
          border-radius: 3px;
        }

        :global(.message-bubble .hashtag) {
          color: #7ec8e3;
        }

        :global(.message-bubble blockquote) {
          border-left: 3px solid #7ec8e3;
          padding-left: 12px;
          margin: 8px 0;
          color: rgba(255, 255, 255, 0.8);
          font-style: italic;
        }
      `}</style>
    </div>
  );
}