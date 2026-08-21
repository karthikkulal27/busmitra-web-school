import { useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useSession } from '../lib/session';

/**
 * SA-01. School code + phone OTP, no passwords — the office shares one PC.
 */
export function SignIn(): React.ReactElement {
  const signIn = useSession((s) => s.signIn);
  const [schoolCode, setSchoolCode] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (!sent) {
        await api.requestOtp(schoolCode, phone);
        setSent(true);
      } else {
        const session = await api.verifyOtp(schoolCode, phone, code);
        signIn(session);
      }
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 401
          ? 'That code did not work. Check the number and try again.'
          : err instanceof ApiError && err.status === 400
            ? 'Check the school code and mobile number.'
            : 'Could not reach the server.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid h-full grid-cols-1 md:grid-cols-[1.1fr_1fr]">
      <div className="hidden flex-col justify-between bg-ink p-10 text-white md:flex">
        <div className="flex items-center gap-2.5">
          <div className="grid h-10 w-10 place-items-center rounded-[12px] bg-bus font-head text-[22px] font-bold text-ink">
            B
          </div>
          <div>
            <div className="font-head text-[17px] font-bold">BusMitra</div>
            <div className="text-[11.5px] text-[#93A3B8]">School console</div>
          </div>
        </div>

        <h2 className="font-head text-[46px] leading-[1.05] font-bold">
          Every bus,
          <br />
          every stop,
          <br />
          every morning.
        </h2>

        <div className="font-mono text-[11.5px] text-[#6C7D95]">
          Support · +91 824 000 0000 · Mon–Sat 6 AM–7 PM
        </div>
      </div>

      <div className="flex items-center justify-center bg-paper p-8">
        <form onSubmit={submit} className="w-full max-w-[360px]">
          <h3 className="font-head text-[26px] font-bold">Sign in</h3>
          <p className="mt-1 mb-6 text-[13.5px] text-slate">
            Use the school code printed on your welcome letter.
          </p>

          <Field label="School code">
            <input
              value={schoolCode}
              onChange={(e) => setSchoolCode(e.target.value)}
              placeholder="SVK-MNG-014"
              autoFocus
              disabled={sent}
              className="w-full rounded-[9px] border border-line bg-white px-3 py-2.5 font-mono text-[15px] outline-none focus:border-ink disabled:bg-paper"
            />
          </Field>

          <Field label="Mobile number">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="98450 11223"
              inputMode="tel"
              disabled={sent}
              className="w-full rounded-[9px] border border-line bg-white px-3 py-2.5 font-mono text-[15px] outline-none focus:border-ink disabled:bg-paper"
            />
          </Field>

          {sent ? (
            <Field label="6-digit code sent by SMS">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                inputMode="numeric"
                autoFocus
                className="w-full rounded-[9px] border border-line bg-white px-3 py-2.5 text-center font-mono text-[22px] tracking-[0.35em] outline-none focus:border-ink"
              />
            </Field>
          ) : null}

          {error ? (
            <p className="mb-3 rounded-[9px] border border-alert bg-[#FBE4E1] px-3 py-2 text-[12.5px] text-[#A62A1B]">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-[9px] bg-ink px-3 py-3 text-[15px] font-bold text-white disabled:opacity-60"
          >
            {busy ? 'One moment…' : sent ? 'Sign in' : 'Send code'}
          </button>

          {sent ? (
            <button
              type="button"
              onClick={() => {
                setSent(false);
                setCode('');
                setError(null);
              }}
              className="mt-3 w-full text-[12px] font-semibold text-slate hover:text-ink"
            >
              Use a different number
            </button>
          ) : null}

          <p className="mt-5 text-[11.5px] leading-relaxed text-slate">
            Signing in as office staff. Principal accounts open a read-only view.
          </p>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="mb-4">
      <label className="mb-1.5 block font-head text-[10px] font-bold tracking-[0.13em] text-slate uppercase">
        {label}
      </label>
      {children}
    </div>
  );
}
