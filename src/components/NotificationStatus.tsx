import { Bell, BellOff, CheckCircle2, AlertCircle } from 'lucide-react';
import { getNotificationPermission, ensureNotificationPermission } from '@/lib/notificationService';
import { useEffect, useState } from 'react';

export function NotificationStatus() {
  const [permission, setPermission] = useState(getNotificationPermission());
  const [requesting, setRequesting] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);

  useEffect(() => {
    const refreshPermission = () => setPermission(getNotificationPermission());
    window.addEventListener('focus', refreshPermission);
    document.addEventListener('visibilitychange', refreshPermission);
    refreshPermission();
    return () => {
      window.removeEventListener('focus', refreshPermission);
      document.removeEventListener('visibilitychange', refreshPermission);
    };
  }, []);

  const handleEnable = async () => {
    setRequesting(true);
    setRequestError(null);
    try {
      await ensureNotificationPermission();
      setPermission(getNotificationPermission());
    } catch (err) {
      setRequestError(err instanceof Error ? err.message : 'Could not request notification permission.');
    } finally {
      setRequesting(false);
    }
  };

  if (permission === 'unsupported') {
    return (
      <div className="flex items-center gap-2.5 text-sm text-ink-400 px-5 py-4 bg-ink-50 rounded-xl border border-ink-200/60">
        <BellOff size={16} /> Notifications not supported on this device.
      </div>
    );
  }

  if (permission === 'granted') {
    return (
      <div className="flex items-center gap-2.5 text-sm text-green-700 px-5 py-4 bg-green-50 rounded-xl border border-green-200/60">
        <CheckCircle2 size={16} /> Notifications enabled — you'll be alerted when a fault is detected.
      </div>
    );
  }

  if (permission === 'denied') {
    return (
      <div className="flex items-start gap-2.5 text-sm text-amber-700 px-5 py-4 bg-amber-50 rounded-xl border border-amber-200/60">
        <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
        <div>
          <p>Notifications are blocked for this site. To enable them, open the browser’s site settings, set Notifications to Allow, then reload this page.</p>
          <p className="mt-1 text-xs text-amber-600">The browser does not allow websites to override a blocked permission.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 py-4 bg-ink-50 rounded-xl border border-ink-200/60">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 text-sm text-ink-500">
          <Bell size={16} /> Notifications not enabled.
        </div>
        <button
          onClick={handleEnable}
          disabled={requesting}
          className="px-4 py-2 text-xs font-medium text-ink-700 border border-ink-200 rounded-lg hover:bg-white transition-colors disabled:opacity-50"
        >
          {requesting ? 'Requesting...' : 'Enable'}
        </button>
      </div>
      {requestError && <p role="alert" className="mt-2 text-xs text-red-600">{requestError}</p>}
    </div>
  );
}
