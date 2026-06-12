"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Button from "@/components/ui/Button";

const inputClass =
  "w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500";

interface Props {
  email: string;
  phone: string | null;
  hasPassword: boolean;
}

function Feedback({ error, success }: { error: string | null; success: string | null }) {
  if (error) return <p className="text-red-500 text-sm bg-red-50 rounded-lg p-3">{error}</p>;
  if (success)
    return <p className="text-green-600 text-sm bg-green-50 rounded-lg p-3">{success}</p>;
  return null;
}

export default function AccountSettings({ email, phone, hasPassword }: Props) {
  const router = useRouter();
  const { update } = useSession();

  const [emailValue, setEmailValue] = useState(email);
  const [emailState, setEmailState] = useState<{ error: string | null; success: string | null; loading: boolean }>({ error: null, success: null, loading: false });

  const [phoneValue, setPhoneValue] = useState(phone ?? "");
  const [phoneState, setPhoneState] = useState<{ error: string | null; success: string | null; loading: boolean }>({ error: null, success: null, loading: false });

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordState, setPasswordState] = useState<{ error: string | null; success: string | null; loading: boolean }>({ error: null, success: null, loading: false });

  async function saveEmail(e: React.FormEvent) {
    e.preventDefault();
    setEmailState({ error: null, success: null, loading: true });
    const res = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: emailValue }),
    });
    if (!res.ok) {
      const json = await res.json();
      setEmailState({ error: json.error ?? "Something went wrong", success: null, loading: false });
      return;
    }
    await update();
    router.refresh();
    setEmailState({ error: null, success: "Email updated", loading: false });
  }

  async function savePhone(e: React.FormEvent) {
    e.preventDefault();
    setPhoneState({ error: null, success: null, loading: true });
    const res = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: phoneValue }),
    });
    if (!res.ok) {
      const json = await res.json();
      setPhoneState({ error: json.error ?? "Something went wrong", success: null, loading: false });
      return;
    }
    router.refresh();
    setPhoneState({ error: null, success: "Phone number updated", loading: false });
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordState({ error: "New passwords don't match", success: null, loading: false });
      return;
    }
    setPasswordState({ error: null, success: null, loading: true });
    const res = await fetch("/api/account/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    if (!res.ok) {
      const json = await res.json();
      setPasswordState({ error: json.error ?? "Something went wrong", success: null, loading: false });
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordState({ error: null, success: "Password changed", loading: false });
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={saveEmail}
        className="bg-white rounded-2xl border border-gray-100 p-6 space-y-3"
      >
        <h2 className="font-bold">Email</h2>
        <input
          type="email"
          value={emailValue}
          onChange={(e) => setEmailValue(e.target.value)}
          className={inputClass}
          required
        />
        <Feedback {...emailState} />
        <Button type="submit" size="sm" disabled={emailState.loading || emailValue === email}>
          {emailState.loading ? "Saving..." : "Save email"}
        </Button>
      </form>

      <form
        onSubmit={savePhone}
        className="bg-white rounded-2xl border border-gray-100 p-6 space-y-3"
      >
        <h2 className="font-bold">Phone number</h2>
        <input
          type="tel"
          value={phoneValue}
          onChange={(e) => setPhoneValue(e.target.value)}
          className={inputClass}
          placeholder="(555) 123-4567"
        />
        <Feedback {...phoneState} />
        <Button type="submit" size="sm" disabled={phoneState.loading}>
          {phoneState.loading ? "Saving..." : "Save phone number"}
        </Button>
      </form>

      <form
        onSubmit={savePassword}
        className="bg-white rounded-2xl border border-gray-100 p-6 space-y-3"
      >
        <h2 className="font-bold">Password</h2>
        {!hasPassword ? (
          <p className="text-sm text-gray-500">
            This account doesn&apos;t use a password to sign in.
          </p>
        ) : (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Current password
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                New password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={inputClass}
                minLength={6}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirm new password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={inputClass}
                minLength={6}
                required
              />
            </div>
            <Feedback {...passwordState} />
            <Button type="submit" size="sm" disabled={passwordState.loading}>
              {passwordState.loading ? "Saving..." : "Change password"}
            </Button>
          </>
        )}
      </form>
    </div>
  );
}
