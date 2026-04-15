import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Flame, Trash2, Trophy } from 'lucide-react';
import { LocalFamilyMemberDialog } from '@/components/family/LocalFamilyMemberDialog';
import { MacroGoalDialog } from '@/components/nutrition/MacroGoalDialog';
import {
  acceptHouseholdInvite,
  createOrGetHousehold,
  getHouseholdDashboard,
  inviteHouseholdMember,
  revokeHouseholdInvite,
  type HouseholdDashboard,
} from '@/lib/api/family';
import { loadSmsPreferences, saveSmsPreferences } from '@/lib/api/sms';
import { useAuth } from '@/contexts/AuthContext';
import {
  getFamilyLeaderboard,
  listHouseholdProfiles,
  removeHouseholdProfile,
  setHouseholdProfileType,
  type DashboardProfile,
} from '@/lib/macroGame';
import { removeChildFromChores, upsertChildInChores } from '@/lib/choresSetup';
import { sendFamilyInviteEmail } from '@/lib/api/emails';
import { useToast } from '@/hooks/use-toast';

const EMPTY_DASHBOARD: HouseholdDashboard = {
  household: null,
  members: [],
  invites: [],
};

function householdRoleSummary(member: HouseholdDashboard['members'][number]): string {
  if (member.role === 'owner') {
    return 'Owns the household setup and can manage shared family settings.';
  }
  if (member.role === 'spouse') {
    return 'Can help manage family meals, grocery, calendar, chores, and tasks.';
  }
  return 'Part of the household with kid-focused access and chores visibility.';
}

export default function FamilyPage() {
  const { profile, user, isProfileComplete } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('invite');
  const inviteRolePrefill = searchParams.get('role');
  const inviteFlow = Boolean(inviteToken);

  const [dashboard, setDashboard] = useState<HouseholdDashboard>(EMPTY_DASHBOARD);
  const [loading, setLoading] = useState(true);
  const [creatingHousehold, setCreatingHousehold] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'spouse' | 'kid'>('spouse');
  const [submittingInvite, setSubmittingInvite] = useState(false);
  const [acceptingInvite, setAcceptingInvite] = useState(false);
  const [revokingInviteId, setRevokingInviteId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [lastInviteLink, setLastInviteLink] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [localMemberDialogOpen, setLocalMemberDialogOpen] = useState(false);
  const [pendingDeleteMember, setPendingDeleteMember] = useState<DashboardProfile | null>(null);
  const [editingLeaderboardAdultId, setEditingLeaderboardAdultId] = useState<string | null>(null);
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

  const deleteLocalMember = async () => {
    if (!pendingDeleteMember) return;

    const memberToDelete = pendingDeleteMember;

    const deleted = removeHouseholdProfile(memberToDelete.id);
    removeChildFromChores(memberToDelete.id, user?.id);
    setPendingDeleteMember(null);

    if (!deleted) {
      toast({
        title: 'Unable to remove member',
        description: 'Primary profiles stay in place. Try deleting a custom adult or child instead.',
      });
      return;
    }

    if (memberToDelete.id === 'wife') {
      try {
        const prefs = await loadSmsPreferences();
        const ownerPhone = String(prefs.phone_e164 || '').trim();
        const cleanedRecipients = Object.fromEntries(
          Object.entries(prefs.module_recipients).map(([moduleName, recipients]) => [
            moduleName,
            Array.isArray(recipients)
              ? recipients.filter((recipient) => String(recipient || '').trim() === ownerPhone)
              : [],
          ]),
        ) as typeof prefs.module_recipients;

        await saveSmsPreferences({
          ...prefs,
          module_recipients: cleanedRecipients,
        });
      } catch (error) {
        console.error('Failed clearing spouse SMS recipients:', error);
        toast({
          title: 'Removed wife profile',
          description:
            'The local wife dashboard was removed, but we could not fully clear extra SMS recipients. Check Settings > Text reminders if needed.',
        });
        return;
      }
    }

    toast({
      title: 'Family member removed',
      description: deleted.memberType === 'child'
        ? `${deleted.name} was removed from chores and the kid leaderboard.`
        : deleted.id === 'wife'
          ? `${deleted.name} was removed, and extra spouse text recipients were cleared.`
          : `${deleted.name} was removed from dashboards and nutrition tracking.`,
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
      const link = `${window.location.origin}/onboarding?force=1&invite=${token}&role=${inviteRole}`;
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
      if (!isProfileComplete) {
        navigate('/onboarding', { replace: true, state: { from: '/family' } });
      }
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : 'Unable to accept invite.');
    } finally {
      setAcceptingInvite(false);
    }
  };

  const onRevokeInvite = async (inviteId: string, inviteEmail: string) => {
    setRevokingInviteId(inviteId);
    setMessage(null);
    try {
      await revokeHouseholdInvite(inviteId);
      await loadDashboard();
      setMessage(`Pending invite removed for ${inviteEmail}.`);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : 'Unable to remove invite.');
    } finally {
      setRevokingInviteId(null);
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

  const onLeaderboardNameClick = (entry: (typeof familyLeaderboard)[number]) => {
    if (entry.type === 'adult') {
      setEditingLeaderboardAdultId(entry.id);
      return;
    }
    navigate(`/chores?child=${encodeURIComponent(entry.id)}`);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="font-display text-3xl">Family</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {inviteFlow
                  ? 'Join your family workspace, then finish your own profile setup.'
                  : 'Invite your spouse or kids to collaborate on meals, groceries, chores, and tasks.'}
              </p>
            </div>
            {!inviteFlow && (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={onAddFamilyMemberClick} disabled={loading || creatingHousehold}>
                  Invite family member
                </Button>
                <Button onClick={() => setLocalMemberDialogOpen(true)}>
                  Add adult or child
                </Button>
              </div>
            )}
          </div>
        </div>

        {!inviteFlow && (
          <>
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
                  const canDelete = member.id !== 'me';
                  const isBuiltInWifeProfile = member.id === 'wife';
                  return (
                    <div key={member.id} className="rounded-md border border-border px-3 py-2 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{member.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {member.memberType === 'adult' ? 'Adult dashboard' : 'Kid chores member'}
                          {member.id === 'me'
                            ? ' • Primary profile'
                            : isBuiltInWifeProfile
                              ? ' • Built-in spouse profile'
                              : ''}
                        </p>
                        {isBuiltInWifeProfile && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Delete this if you want your wife to join through a real email invite instead.
                          </p>
                        )}
                      </div>
                      {canDelete ? (
                        <div className="flex flex-wrap justify-end gap-2">
                          {canChangeType && (
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
                          )}
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => setPendingDeleteMember(member)}
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </Button>
                        </div>
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
                      <button
                        type="button"
                        onClick={() => onLeaderboardNameClick(entry)}
                        className="text-sm font-medium underline-offset-4 hover:underline text-left"
                        title={
                          entry.type === 'adult'
                            ? `Edit ${entry.name}'s scoring targets`
                            : `Edit ${entry.name}'s chores and skills`
                        }
                      >
                        {entry.name}
                      </button>
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
          </>
        )}

        {inviteToken && (
          <section className="rounded-xl border border-border bg-card p-4">
            <p className="text-sm">
              You have a household invite waiting. Accept it with this account to join the family workspace, then finish your own personal profile setup.
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
                        {member.email ? (
                          <p className="mt-1 text-xs text-muted-foreground">{member.email}</p>
                        ) : null}
                        <p className="mt-1 text-xs text-muted-foreground">{householdRoleSummary(member)}</p>
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
                      <div key={invite.id} className="rounded-md border border-border p-3 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">{invite.email}</p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {invite.role} • expires {new Date(invite.expires_at).toLocaleDateString()}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={revokingInviteId === invite.id}
                          onClick={() => void onRevokeInvite(invite.id, invite.email)}
                        >
                          {revokingInviteId === invite.id ? 'Removing...' : 'Delete'}
                        </Button>
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
      <MacroGoalDialog
        personId={editingLeaderboardAdultId || 'me'}
        open={Boolean(editingLeaderboardAdultId)}
        onOpenChange={(open) => {
          if (!open) setEditingLeaderboardAdultId(null);
        }}
        onSaved={() => setRefreshTick((prev) => prev + 1)}
      />
      <AlertDialog open={Boolean(pendingDeleteMember)} onOpenChange={(open) => !open && setPendingDeleteMember(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove family member?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDeleteMember
                ? pendingDeleteMember.memberType === 'child'
                  ? `${pendingDeleteMember.name} will be removed from chores, the kid leaderboard, and local family setup.`
                  : pendingDeleteMember.id === 'wife'
                    ? `${pendingDeleteMember.name} will be removed from local dashboards and nutrition tracking so you can replace this profile with a real invited spouse account.`
                  : `${pendingDeleteMember.name} will be removed from dashboards, nutrition tracking, and local family setup.`
                : 'This will remove the selected family member from local family setup.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={deleteLocalMember}
            >
              Delete member
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
