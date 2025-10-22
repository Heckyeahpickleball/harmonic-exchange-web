// /lib/notify.ts
import { supabase } from '@/lib/supabaseClient';

/**
 * NOTE: This expects you to have created the SQL RPC:
 *   create or replace function public.send_notification(...)
 *   -- I gave you this SQL earlier. If you want it again, say the word and I’ll paste it.
 */

export async function sendNotification(opts: {
  profileId: string; // recipient
  type:
    | 'comment_on_post'
    | 'heart_on_post'
    | 'heart_on_comment'
    | string;
  data?: Record<string, any>;
  requestId?: string | null;
  offerId?: string | null;
}) {
  const { profileId, type, data = {}, requestId = null, offerId = null } = opts;

  // Don’t notify yourself
  const me = (await supabase.auth.getUser())?.data?.user?.id;
  if (!profileId || !type || me === profileId) return { error: null, skipped: true };

  return supabase.rpc('send_notification', {
    _profile_id: profileId,
    _type: type,
    _data: data,
    _request_id: requestId,
    _offer_id: offerId,
  });
}

export async function notifyOnNewComment(args: {
  postId: string;
  postAuthorId: string;      // recipient
  commenterName?: string | null;
  commentText?: string | null;
}) {
  const { postId, postAuthorId, commenterName, commentText } = args;
  return sendNotification({
    profileId: postAuthorId,
    type: 'comment_on_post',
    data: {
      post_id: postId,
      commenter_name: commenterName ?? null,
      text: commentText ?? null,
    },
  });
}

export async function notifyOnHeartPost(args: {
  postId: string;
  postAuthorId: string;      // recipient
  likerName?: string | null;
}) {
  const { postId, postAuthorId, likerName } = args;
  return sendNotification({
    profileId: postAuthorId,
    type: 'heart_on_post',
    data: {
      post_id: postId,
      liker_name: likerName ?? null,
    },
  });
}

export async function notifyOnHeartComment(args: {
  commentId: string;
  commentAuthorId: string;   // recipient
  postId?: string | null;
  likerName?: string | null;
}) {
  const { commentId, commentAuthorId, postId, likerName } = args;
  return sendNotification({
    profileId: commentAuthorId,
    type: 'heart_on_comment',
    data: {
      comment_id: commentId,
      post_id: postId ?? null,
      liker_name: likerName ?? null,
    },
  });
}
