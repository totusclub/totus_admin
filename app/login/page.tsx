'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { login, storeUser, type LoginCredentials } from '@/lib/auth-api';
import PageShell from '@/components/PageShell';
import Icon from '@/components/Icon';
import { t, radius, text, cardStyle, inputStyle, button } from '@/lib/theme';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const credentials: LoginCredentials = { email, password };
      const response = await login(credentials);

      if (response.ok && response.user) {
        // Store user data
        storeUser(response.user);

        // Redirect to the first admin section
        router.push('/users');
      } else {
        setError('Login failed. Please check your credentials.');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: 6,
    ...text.caption,
    color: t.textSecondary,
    fontWeight: 500,
  };

  return (
    <PageShell>
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ ...cardStyle, width: '100%', maxWidth: 420 }}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              marginBottom: 24,
              gap: 12,
            }}
          >
            <div
              style={{
                width: 54,
                height: 54,
                borderRadius: radius.pill,
                background: t.accentSoft,
                color: t.accent,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="user" size={26} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <h1 style={{ ...text.pageTitle, margin: '0 0 4px' }}>Totus Admin</h1>
              <p style={{ ...text.caption, margin: 0 }}>
                Войдите как агент, чтобы управлять платформой
              </p>
            </div>
          </div>

          {error && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 18,
                padding: '10px 12px',
                background: t.errorSoft,
                border: `1px solid ${t.error}`,
                borderRadius: radius.sm,
                color: t.error,
                fontSize: 13,
                lineHeight: '18px',
              }}
            >
              <Icon name="info" size={16} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                placeholder="agent@totus.club"
                style={{ ...inputStyle, outline: 'none' }}
              />
            </div>

            <div style={{ marginBottom: 22 }}>
              <label style={labelStyle}>Пароль</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                placeholder="Введите пароль агента"
                style={{ ...inputStyle, outline: 'none' }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                ...button('primary', 'lg'),
                width: '100%',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? 'Вход...' : 'Войти'}
            </button>
          </form>

          <div
            style={{
              marginTop: 20,
              padding: '10px 12px',
              borderRadius: radius.md,
              background: t.surfaceInset,
              border: `1px dashed ${t.border}`,
              ...text.caption,
              textAlign: 'center',
            }}
          >
            Только пользователи с ролью <strong>agent</strong> могут войти в
            систему.
          </div>
        </div>
      </div>
    </PageShell>
  );
}
