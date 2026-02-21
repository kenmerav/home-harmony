import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  acceptHouseholdInvite,
  createOrGetHousehold,
  getHouseholdDashboard,
  inviteHouseholdMember,
  type HouseholdDashboard,
} from '@/lib/api/family';
import { useAuth } from '@/contexts/AuthContext';

const EMPTY_DASHBOARD: HouseholdDashboard = {
  household: null,
  members: [],
  invites: [],
};

export default function FamilyPage() {
  const { profile } = useAuth();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('invite');

  const [dashboard, setDashboard] = useState<HouseholdDashboard>(EMPTY_DASHBOARD);
  const [loading, setLoading] = useState(true);
  const [creatingHousehold, setCreatingHousehold] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'spouse' | 'kid'>('spouse');
  const [submittingInvite, setSubmittingInvite] = useState(false);
  const [acceptingInvite, setAcceptingInvite] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [lastInviteLink, setLastInviteLink] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getHouseholdDashboard();
      setDashboard(data);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : 'Failed to load household.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const canInvite = useMemo(
    () => dashboard.members.some((m) => m.role === 'owner' || m.role === 'spouse'),
    [dashboard.members],
  );

  const onCreateHousehold = async () => {
    setCreatingHousehold(true);
    setMessage(null);
    try {
      await createOrGetHousehold(profile?.householdName || undefined);
      await loadDashboard();
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : 'Unable to create household.');
    } finally {
      setCreatingHousehold(false);
    }
  };

  const onInvite = async (event: FormEvent) => {
    event.preventDefault();
    setSubmittingInvite(true);
    setMessage(null);
    setLastInviteLink(null);
    try {
      const token = await inviteHouseholdMember(inviteEmail, inviteRole);
      const link = `${window.location.origin}/family?invite=${token}`;
      setLastInviteLink(link);
      setInviteEmail('');
      await loadDashboard();
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : 'Unable to send invite.');
    } finally {
      setSubmittingInvite(false);
    }
  };

  const onAcceptInvite = async () => {
    if (!inviteToken) return;
    setAcceptingInvite(true);
    setMessage(null);
    try {
      await acceptHouseholdInvite(inviteToken);
      setMessage('Invite accepted. You are now part of this household.');
      await loadDashboard();
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : 'Unable to accept invite.');
    } finally {
      setAcceptingInvite(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl">Family</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Invite your spouse or kids to collaborate on meals, groceries, chores, and tasks.
          </p>
        </div>

        {inviteToken && (
          <section className="rounded-xl border border-border bg-card p-4">
            <p className="text-sm">
              You have a household invite waiting. Accept it with this account to join your family workspace.
            </p>
            <Button className="mt-3" onClick={onAcceptInvite} disabled={acceptingInvite}>
              {acceptingInvite ? 'Accepting...' : 'Accept invite'}
            </Button>
          </section>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading family setup...</p>
        ) : (
          <>
            {!dashboard.household ? (
              <section className="rounded-xl border border-border bg-card p-5">
                <h2 className="font-semibold">Create your household</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Set up a household once, then invite your family members.
                </p>
                <Button className="mt-4" onClick={onCreateHousehold} disabled={creatingHousehold}>
                  {creatingHousehold ? 'Creating...' : 'Create household'}
                </Button>
              </section>
            ) : (
              <>
                <section className="rounded-xl border border-border bg-card p-5">
                  <h2 className="font-semibold">{dashboard.household.name}</h2>
                  <p className="text-xs text-muted-foreground mt-1">Household ID: {dashboard.household.id}</p>
                </section>

                <section className="rounded-xl border border-border bg-card p-5">
                  <h2 className="font-semibold">Invite family member</h2>
                  <form className="mt-3 grid gap-3 md:grid-cols-[1fr_180px_auto]" onSubmit={onInvite}>
                    <Input
                      type="email"
                      required
                      placeholder="spouse-or-kid@example.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                    />
                    <select
                      className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as 'spouse' | 'kid')}
                    >
                      <option value="spouse">Spouse</option>
                      <option value="kid">Kid</option>
                    </select>
                    <Button type="submit" disabled={submittingInvite || !canInvite}>
                      {submittingInvite ? 'Inviting...' : 'Invite'}
                    </Button>
                  </form>
                  {!canInvite && (
                    <p className="mt-2 text-xs text-muted-foreground">Only owner or spouse can invite members.</p>
                  )}
                  {lastInviteLink && (
                    <div className="mt-3 rounded-md border border-border bg-background p-3">
                      <p className="text-xs text-muted-foreground">Invite link</p>
                      <p className="text-sm break-all">{lastInviteLink}</p>
                    </div>
                  )}
                </section>

                <section className="rounded-xl border border-border bg-card p-5">
                  <h2 className="font-semibold">Members</h2>
                  <div className="mt-3 space-y-2">
                    {dashboard.members.map((member) => (
                      <div key={member.id} className="rounded-md border border-border p-3">
                        <p className="text-sm font-medium">{member.full_name || member.email || 'Unknown member'}</p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {member.role} • {member.status}
                        </p>
                      </div>
                    ))}
                    {dashboard.members.length === 0 && (
                      <p className="text-sm text-muted-foreground">No members yet.</p>
                    )}
                  </div>
                </section>

                <section className="rounded-xl border border-border bg-card p-5">
                  <h2 className="font-semibold">Pending invites</h2>
                  <div className="mt-3 space-y-2">
                    {dashboard.invites.map((invite) => (
                      <div key={invite.id} className="rounded-md border border-border p-3">
                        <p className="text-sm font-medium">{invite.email}</p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {invite.role} • expires {new Date(invite.expires_at).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                    {dashboard.invites.length === 0 && (
                      <p className="text-sm text-muted-foreground">No pending invites.</p>
                    )}
                  </div>
                </section>
              </>
            )}
          </>
        )}

        {message && <p className="text-sm text-muted-foreground">{message}</p>}
      </div>
    </AppLayout>
  );
}
