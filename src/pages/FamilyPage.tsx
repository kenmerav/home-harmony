import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Flame, Trophy } from 'lucide-react';
import { LocalFamilyMemberDialog } from '@/components/family/LocalFamilyMemberDialog';
import {
  acceptHouseholdInvite,
  createOrGetHousehold,
  getHouseholdDashboard,
  inviteHouseholdMember,
  type HouseholdDashboard,
} from '@/lib/api/family';
import { useAuth } from '@/contexts/AuthContext';
import { getFamilyLeaderboard, listHouseholdProfiles, setHouseholdProfileType } from '@/lib/macroGame';
import { removeChildFromChores, upsertChildInChores } from '@/lib/choresSetup';
import { sendFamilyInviteEmail } from '@/lib/api/emails';
import { useToast } from '@/hooks/use-toast';

const EMPTY_DASHBOARD: HouseholdDashboard = {
  household: null,
  members: [],
  invites: [],
};

export default function FamilyPage() {
  const { profile, user } = useAuth();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('invite');
  const inviteRolePrefill = searchParams.get('role');

  const [dashboard, setDashboard] = useState<HouseholdDashboard>(EMPTY_DASHBOARD);
  const [loading, setLoading] = useState(true);
  const [creatingHousehold, setCreatingHousehold] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'spouse' | 'kid'>('spouse');
  const [submittingInvite, setSubmittingInvite] = useState(false);
  const [acceptingInvite, setAcceptingInvite] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [lastInviteLink, setLastInviteLink] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [localMemberDialogOpen, setLocalMemberDialogOpen] = useState(false);
  const inviteSectionRef = useRef<HTMLElement | null>(null);
  const inviteEmailInputRef = useRef<HTMLInputElement | null>(null);
  const { toast } = useToast();

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

  useEffect(() => {
    if (inviteRolePrefill === 'kid' || inviteRolePrefill === 'spouse') {
      setInviteRole(inviteRolePrefill);
    }
  }, [inviteRolePrefill]);

  useEffect(() => {
    const refresh = () => setRefreshTick((prev) => prev + 1);
    window.addEventListener('homehub:macro-state-updated', refresh);
    window.addEventListener('homehub:chores-state-updated', refresh);
    return () => {
      window.removeEventListener('homehub:macro-state-updated', refresh);
      window.removeEventListener('homehub:chores-state-updated', refresh);
    };
  }, []);

  const canInvite = useMemo(
    () => dashboard.members.some((m) => m.role === 'owner' || m.role === 'spouse'),
    [dashboard.members],
  );
  const localProfiles = useMemo(() => listHouseholdProfiles(), [refreshTick]);
  const familyLeaderboard = useMemo(() => getFamilyLeaderboard(new Date(), user?.id), [refreshTick, user?.id]);

  const updateLocalMemberType = (memberId: string, nextType: 'adult' | 'child') => {
    const updated = setHouseholdProfileType(memberId, nextType);
    if (nextType === 'child') {
      upsertChildInChores({ id: updated.id, name: updated.name }, user?.id);
    } else {
      removeChildFromChores(updated.id, user?.id);
    }
    toast({
      title: nextType === 'child' ? 'Moved to kids chores' : 'Moved to adult dashboards',
      description:
        nextType === 'child'
          ? `${updated.name} will score from chores instead of calorie tracking.`
          : `${updated.name} now shows up as an adult dashboard again.`,
    });
  };

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
    const targetEmail = inviteEmail.trim().toLowerCase();
    try {
      const token = await inviteHouseholdMember(targetEmail, inviteRole);
      const link = `${window.location.origin}/family?invite=${token}`;
      setLastInviteLink(link);
      try {
        await sendFamilyInviteEmail({
          email: targetEmail,
          role: inviteRole,
          inviteLink: link,
          householdName: dashboard.household?.name || profile?.householdName || null,
        });
        setMessage(`Invite email sent to ${targetEmail}.`);
      } catch (emailError) {
        console.error('Failed sending invite email:', emailError);
        setMessage(`Invite created, but email could not be sent. Share this link manually: ${link}`);
      }
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

  const onAddFamilyMemberClick = () => {
    if (!dashboard.household) {
      setMessage('Create your household first, then add family members.');
      return;
    }
    inviteSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => inviteEmailInputRef.current?.focus(), 120);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="font-display text-3xl">Family</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Invite your spouse or kids to collaborate on meals, groceries, chores, and tasks.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={onAddFamilyMemberClick} disabled={loading || creatingHousehold}>
                Invite family member
              </Button>
              <Button onClick={() => setLocalMemberDialogOpen(true)}>
                Add adult or child
              </Button>
            </div>
          </div>
        </div>

        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">Local Family Setup</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Adults get dashboards and nutrition tracking. Kids go into chores and the kid scoreboard.
              </p>
            </div>
            <Button size="sm" onClick={() => setLocalMemberDialogOpen(true)}>
              Add Member
            </Button>
          </div>
          <div className="mt-3 space-y-2">
            {localProfiles.map((member) => {
              const canChangeType = member.id !== 'me' && member.id !== 'wife';
              return (
                <div key={member.id} className="rounded-md border border-border px-3 py-2 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{member.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {member.memberType === 'adult' ? 'Adult dashboard' : 'Kid chores member'}
                      {canChangeType ? '' : ' • Primary profile'}
                    </p>
                  </div>
                  {canChangeType ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        updateLocalMemberType(
                          member.id,
                          member.memberType === 'adult' ? 'child' : 'adult',
                        )
                      }
                    >
                      {member.memberType === 'adult' ? 'Move to Kids' : 'Move to Adults'}
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">Adult</span>
                  )}
                </div>
              );
            })}
            {localProfiles.length === 0 && (
              <p className="text-sm text-muted-foreground">No local family members set up yet.</p>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-semibold">Family leaderboard</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Weekly score combines macro goal progress, healthy habits, and kids&apos; completed chores.
          </p>
          <div className="mt-3 space-y-2">
            {familyLeaderboard.map((entry, index) => (
              <div key={entry.id} className="rounded-md border border-border px-3 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-5 text-xs font-semibold text-muted-foreground">{index + 1}</span>
                  <p className="text-sm font-medium">{entry.name}</p>
                  {index === 0 && <Trophy className="w-4 h-4 text-yellow-500" />}
                  <span className="text-xs text-muted-foreground">{entry.headline}</span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{entry.weekPoints} pts</p>
                  <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
                    <Flame className="w-3 h-3 text-orange-500" />
                    {entry.streak} streak
                  </p>
                </div>
              </div>
            ))}
            {familyLeaderboard.length === 0 && <p className="text-sm text-muted-foreground">No score data yet.</p>}
          </div>
        </section>

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

                <section ref={inviteSectionRef} className="rounded-xl border border-border bg-card p-5">
                  <h2 className="font-semibold">Invite family member</h2>
                  <form className="mt-3 grid gap-3 md:grid-cols-[1fr_180px_auto]" onSubmit={onInvite}>
                    <Input
                      ref={inviteEmailInputRef}
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
      <LocalFamilyMemberDialog
        open={localMemberDialogOpen}
        onOpenChange={setLocalMemberDialogOpen}
        userId={user?.id}
      />
    </AppLayout>
  );
}
