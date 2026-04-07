import { supabase } from '@/integrations/supabase/client';

export type FeedbackKind = 'feature_request' | 'bug_report' | 'general_feedback';

export async function submitFeedback(payload: {
  userId: string;
  email?: string | null;
  userName?: string | null;
  kind: FeedbackKind;
  pagePath: string;
  pageUrl?: string | null;
  pageTitle?: string | null;
  subject?: string | null;
  details: string;
}) {
  const { error } = await supabase.from('feedback_submissions').insert({
    user_id: payload.userId,
    email: payload.email || null,
    user_name: payload.userName || null,
    kind: payload.kind,
    page_path: payload.pagePath,
    page_url: payload.pageUrl || null,
    page_title: payload.pageTitle || null,
    subject: payload.subject?.trim() || null,
    details: payload.details.trim(),
  });

  if (error) {
    throw new Error(error.message || 'Could not send feedback.');
  }
}
